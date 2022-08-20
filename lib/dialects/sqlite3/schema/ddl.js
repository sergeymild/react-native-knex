// SQLite3_DDL
//
// All of the SQLite3 specific DDL helpers for renaming/dropping
// columns and changing datatypes.
// -------

const chunk = require('lodash.chunk')

// So altering the schema in SQLite3 is a major pain.
// We have our own object to deal with the renaming and altering the types
// for sqlite3 things.
const identity = (value) => value
let ddlCounter = 0
class SQLite3_DDL {
  constructor(client, tableCompiler, pragma, connection) {
    this.client = client;
    this.tableCompiler = tableCompiler;
    this.pragma = pragma;
    this.tableNameRaw = this.tableCompiler.tableNameRaw;
    this.alteredName = `${++ddlCounter}_knex_temp_alter`
    this.connection = connection;
  }

  tableName = () => this.tableNameRaw

  getColumn = (column) => {
    const currentCol = this.pragma.find((col) => {
      return (
          this.client.wrapIdentifier(col.name).toLowerCase() ===
          this.client.wrapIdentifier(column).toLowerCase()
      );
    });
    if (!currentCol) throw new Error(`The column ${column} is not in the ${this.tableName()} table`);
    return currentCol;
  }

  getTableSql = async () => this.trx.raw(`SELECT name, sql FROM sqlite_master WHERE type="table" AND name="${this.tableName()}"`)
  renameTable = async () => this.trx.raw(`ALTER TABLE "${this.tableName()}" RENAME TO "${this.alteredName}"`)
  dropOriginal = () => this.trx.raw(`DROP TABLE "${this.tableName()}"`)
  dropTempTable = () => this.trx.raw(`DROP TABLE "${this.alteredName}"`)

  copyData = async () => {
    const result = await this.trx.raw(`SELECT * FROM "${this.tableName()}"`)
    return this.insertChunked(20, this.alteredName, identity, result)
  }

  reinsertData = async (iterator) => {
    const result = await this.trx.raw(`SELECT * FROM "${this.alteredName}"`)
    return this.insertChunked(20, this.tableName(), iterator, result)
  }

  async insertChunked(chunkSize, target, iterator, result) {
    iterator = iterator || identity;
    const chunked = chunk(result, chunkSize);
    for (const batch of chunked) {
      await this.trx.queryBuilder().table(target).insert(batch.map(iterator));
    }
  }

  createTempTable = (createTable) => {
    return this.trx.raw(createTable.sql.replace(this.tableName(), this.alteredName));
  }

  _doReplace(sql, from, to) {
    const oneLineSql = sql.replace(/\s+/g, ' ');
    const matched = oneLineSql.match(/^CREATE TABLE\s+(\S+)\s*\((.*)\)/);

    const tableName = matched[1];
    const defs = matched[2];

    if (!defs) throw new Error('No column definitions in this statement!');

    let parens = 0
    let args = []
    let ptr = 0
    let i = 0;
    const x = defs.length;
    for (i = 0; i < x; i++) {
      switch (defs[i]) {
        case '(':
          parens++;
          break;
        case ')':
          parens--;
          break;
        case ',':
          if (parens === 0) {
            args.push(defs.slice(ptr, i));
            ptr = i + 1;
          }
          break;
        case ' ':
          if (ptr === i) ptr = i + 1;
          break;
      }
    }
    args.push(defs.slice(ptr, i));

    const fromIdentifier = from.replace(/[`"'[\]]/g, '');

    args = args.map((item) => {
      let split = item.trim().split(' ');

      // SQLite supports all quoting mechanisms prevalent in all major dialects of SQL
      // and preserves the original quoting in sqlite_master.
      //
      // Also, identifiers are never case sensitive, not even when quoted.
      //
      // Ref: https://www.sqlite.org/lang_keywords.html
      const fromMatchCandidates = [
        new RegExp(`\`${fromIdentifier}\``, 'i'),
        new RegExp(`"${fromIdentifier}"`, 'i'),
        new RegExp(`'${fromIdentifier}'`, 'i'),
        new RegExp(`\\[${fromIdentifier}\\]`, 'i'),
      ];
      if (fromIdentifier.match(/^\S+$/)) {
        fromMatchCandidates.push(new RegExp(`\\b${fromIdentifier}\\b`, 'i'));
      }

      const doesMatchFromIdentifier = (target) =>
          fromMatchCandidates.some((c) => target.match(c));

      const replaceFromIdentifier = (target) =>
          fromMatchCandidates.reduce(
              (result, candidate) => result.replace(candidate, to),
              target
          );

      if (doesMatchFromIdentifier(split[0])) {
        // column definition
        if (to) {
          split[0] = to;
          return split.join(' ');
        }
        return ''; // for deletions
      }

      // skip constraint name
      const idx = /constraint/i.test(split[0]) ? 2 : 0;

      // primary key and unique constraints have one or more
      // columns from this table listed between (); replace
      // one if it matches
      if (/primary|unique/i.test(split[idx])) {
        const ret = item.replace(/\(.*\)/, replaceFromIdentifier);
        // If any member columns are dropped then uniqueness/pk constraint
        // can not be retained
        if (ret !== item && !to) return '';
        return ret;
      }

      // foreign keys have one or more columns from this table
      // listed between (); replace one if it matches
      // foreign keys also have a 'references' clause
      // which may reference THIS table; if it does, replace
      // column references in that too!
      if (/foreign/.test(split[idx])) {
        split = item.split(/ references /i);
        // the quoted column names save us from having to do anything
        // other than a straight replace here
        const replacedKeySpec = replaceFromIdentifier(split[0]);

        if (split[0] !== replacedKeySpec) {
          // If we are removing one or more columns of a foreign
          // key, then we should not retain the key at all
          if (!to) return '';
          else split[0] = replacedKeySpec;
        }

        if (split[1].slice(0, tableName.length) === tableName) {
          // self-referential foreign key
          const replacedKeyTargetSpec = split[1].replace(/\(.*\)/, replaceFromIdentifier);
          if (split[1] !== replacedKeyTargetSpec) {
            // If we are removing one or more columns of a foreign
            // key, then we should not retain the key at all
            if (!to) return '';
            else split[1] = replacedKeyTargetSpec;
          }
        }
        return split.join(' references ');
      }

      return item;
    });

    args = args.filter(a => !!a)

    if (args.length === 0) {
      throw new Error('Unable to drop last column from table');
    }

    return oneLineSql
        .replace(/\(.*\)/, () => `(${args.join(', ')})`)
        .replace(/,\s*([,)])/, '$1');
  }

  renameColumn = async (from, to) => {
    return this.client.transaction(
        async (trx) => {
          this.trx = trx;
          const column = this.getColumn(from);
          const sql = await this.getTableSql(column);
          const a = this.client.wrapIdentifier(from);
          const b = this.client.wrapIdentifier(to);
          const createTable = sql[0];
          const newSql = this._doReplace(createTable.sql, a, b);
          if (sql === newSql) {
            throw new Error('Unable to find the column to change');
          }

          return this.reinsertMapped(createTable, newSql, (row) => {
            row[to] = row[from]
            delete row[from]
            return row
          });
        },
        { connection: this.connection }
    );
  }

  dropColumn = async (columns) => {
    return this.client.transaction(
        async (trx) => {
          this.trx = trx;
          const sql = await this.getTableSql()
          const createTable = sql[0];
          let newSql = createTable.sql;
          for (let column of columns) {
              const a = this.client.wrapIdentifier(column);
              newSql = this._doReplace(newSql, a, '');
          }
          if (sql === newSql) throw new Error('Unable to find the column to change');
          return this.reinsertMapped(createTable, newSql, (row) => {
              for (let column of columns) {delete row[column]}
              return row
          });
        },
        { connection: this.connection }
    );
  }

  dropForeign = async (columns, indexName) => {
    return this.client.transaction(
        async (trx) => {
          this.trx = trx;
          const sql = await this.getTableSql();
          const createTable = sql[0];
          const oneLineSql = createTable.sql.replace(/\s+/g, ' ');
          const matched = oneLineSql.match(/^CREATE TABLE\s+(\S+)\s*\((.*)\)/);
          const defs = matched[2];

          if (!defs) throw new Error('No column definitions in this statement!');

          const updatedDefs = defs
              .split(',')
              .map((line) => line.trim())
              .filter((defLine) => {
                if (
                    defLine.startsWith('constraint') === false &&
                    defLine.includes('foreign key') === false
                )
                  return true;

                if (indexName) {
                  return !defLine.includes(indexName);
                } else {
                  const matched = defLine.match(/\(`(\S+)`\)/);
                  const columnName = matched[1];
                  return columns.includes(columnName) === false;
                }
              }).join(', ');

          const newSql = oneLineSql.replace(defs, updatedDefs);
          return this.reinsertMapped(createTable, newSql, (row) => row);
        },
        { connection: this.connection }
    );
  }

  reinsertMapped = async (createTable, newSql, mapRow) => {
    await this.createTempTable(createTable)
    await this.copyData()
    await this.dropOriginal()
    await this.trx.raw(newSql)
    await this.reinsertData(mapRow)
    await this.dropTempTable()
  }
}

module.exports = SQLite3_DDL;
