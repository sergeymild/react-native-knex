// SQLite3 Query Builder & Compiler

const QueryCompiler = require('../../../query/compiler')

const noop = require('../../../util/noop')
const constant = require('lodash.constant')
const identity = require('lodash.identity')
const reduce = require('lodash.reduce')

const emptyStr = constant('');

class QueryCompiler_SQLite3 extends QueryCompiler {
  constructor(client, builder) {
    super(client, builder);

    // The locks are not applicable in SQLite3
    this.forShare = emptyStr;
    this.forUpdate = emptyStr;
  }

  _ignore(columns) {
    return ` on conflict (${this.formatter.columnize(columns)}) do nothing`;
  }

  insert() {
    const insertValues = this.single.insert || [];
    let sql = super.insert();
    const { onConflict, ignore, merge } = this.single;
    if (onConflict && ignore) sql += this._ignore(onConflict);
    else if (onConflict && merge) {
      sql += this._merge(merge.updates, onConflict, insertValues);
    }
    return sql
  }

  _merge(updates, columns, insert) {
    let sql = ` on conflict (${this.formatter.columnize(
      columns
    )}) do update set `;
    if (updates) {
      const updateData = this._prepUpdate(updates);
      if (typeof updateData === 'string') {
        sql += updateData;
      } else {
        sql += updateData.join(',');
      }

      return sql;
    } else {
      const insertData = this._prepInsert(insert);
      if (typeof insertData === 'string') {
        throw new Error(
          'If using merge with a raw insert query, then updates must be provided'
        );
      }

      sql += insertData.columns
        .map((column) => this.formatter.wrapString(column.split('.').pop()))
        .map((column) => `${column} = excluded.${column}`)
        .join(', ');

      return sql;
    }
  }

  // Compile a truncate table statement into SQL.
  truncate() {
    const { table } = this.single;
    return {
      sql: `delete from ${this.tableName}`,
      output() {
        return this.query({
          sql: `delete from sqlite_sequence where name = '${table}'`,
        }).catch(noop);
      },
    };
  }

  // Compiles a `columnInfo` query
  columnInfo() {
    const column = this.single.columnInfo;

    // The user may have specified a custom wrapIdentifier function in the config. We
    // need to run the identifiers through that function, but not format them as
    // identifiers otherwise.
    const table = identity(this.single.table);

    return {
      sql: `PRAGMA table_info(\`${table}\`)`,
      output(resp) {
        const maxLengthRegex = /.*\((\d+)\)/;
        const out = reduce(
          resp,
          function(columns, val) {
            let { type } = val;
            let maxLength = type.match(maxLengthRegex);
            if (maxLength) {
              maxLength = maxLength[1];
            }
            type = maxLength ? type.split('(')[0] : type;
            columns[val.name] = {
              type: type.toLowerCase(),
              maxLength,
              nullable: !val.notnull,
              defaultValue: val.dflt_value,
            };
            return columns;
          },
          {}
        );
        return (column && out[column]) || out;
      },
    };
  }

  limit() {
    const noLimit = !this.single.limit && this.single.limit !== 0;
    if (noLimit && !this.single.offset) return '';

    // Workaround for offset only,
    // see http://stackoverflow.com/questions/10491492/sqllite-with-skip-offset-only-not-limit
    return `limit ${this.formatter.parameter(
      noLimit ? -1 : this.single.limit
    )}`;
  }
}

module.exports = QueryCompiler_SQLite3;
