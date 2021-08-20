/* eslint max-len:0 */

// Table Compiler
// -------
const { normalizeArr} = require('../helpers')
const groupBy = require('lodash.groupby')
const indexOf = require('lodash.indexof')
const isEmpty = require('lodash.isempty')
const tail = require('lodash.tail')

class TableCompiler {
  // Add a new column.
  addColumnsPrefix = 'ADD COLUMN ';
  // Alter column
  alterColumnsPrefix = 'ALTER COLUMN ';
  dropColumnPrefix = 'DROP COLUMN ';

  // If this is a table "creation", we need to first run through all
  // of the columns to build them into a single string,
  // and then run through anything else and push it to the query sequence.
  createAlterTableMethods = null;

  constructor(client, tableBuilder) {
    this.client = client;
    this.tableBuilder = tableBuilder;
    this._commonBuilder = this.tableBuilder;
    this.method = tableBuilder._method;
    this.schemaNameRaw = tableBuilder._schemaName;
    this.tableNameRaw = tableBuilder._tableName;
    this.single = tableBuilder._single;
    this.grouped = groupBy(tableBuilder._statements, 'grouping');
    this.formatter = client.formatter(tableBuilder);
    this.sequence = [];
  }

  pushQuery = (query) => {
    if (!query) return;
    if (typeof query === 'string') query = { sql: query };
    if (!query.bindings) query.bindings = this.formatter.bindings;
    this.sequence.push(query);
    this.formatter = this.client.formatter(this._commonBuilder);
  }
  pushAdditional = (fn, ...args) => {
    const child = new TableCompiler(this.client, this.tableBuilder);
    fn.call(child, ...args);
    this.sequence.additional = (this.sequence.additional || []).concat(child.sequence);
  }
  unshiftQuery = (query) => {
    if (!query) return;
    if (typeof query === 'string') query = { sql: query };
    if (!query.bindings) query.bindings = this.formatter.bindings;
    this.sequence.unshift(query);
    this.formatter = this.client.formatter(this._commonBuilder);
  }

  // Convert the tableCompiler toSQL
  toSQL = () => {
    this[this.method]();
    return this.sequence;
  };

  // Column Compilation
  // -------

  create = (ifNot) => {
    const columnBuilders = this.getColumns();
    const columns = columnBuilders.map((col) => col.toSQL());
    if (columns.length === 0 && (this.method === "create" || this.method === "createIfNot")) {
      columns.push([{
        sql: '`rowid` INTEGER PRIMARY KEY',
        bindings: []
      }])
    }
    const columnTypes = this.getColumnTypes(columns);
    if (this.createAlterTableMethods) {
      this.alterTableForCreate(columnTypes);
    }
    this.createQuery(columnTypes, ifNot);
    this.columnQueries(columns);
    this.alterTable();
  };

  // Only create the table if it doesn't exist.
  createIfNot = () => this.create(true);

  // If we're altering the table, we need to one-by-one
  // go through and handle each of the queries associated
  // with altering the table's schema.
  alter = () => {
    const addColBuilders = this.getColumns();
    const addColumns = addColBuilders.map((col) => col.toSQL());
    const alterColBuilders = this.getColumns('alter');
    const alterColumns = alterColBuilders.map((col) => col.toSQL());
    const addColumnTypes = this.getColumnTypes(addColumns);
    const alterColumnTypes = this.getColumnTypes(alterColumns);

    this.addColumns(addColumnTypes);
    this.alterColumns(alterColumnTypes, alterColBuilders);
    this.columnQueries(addColumns);
    this.columnQueries(alterColumns);
    this.alterTable();
  };

  foreign = (foreignData) => {
    if (foreignData.inTable && foreignData.references) {
      const keyName = foreignData.keyName
          ? this.formatter.wrap(foreignData.keyName)
          : this._indexCommand('foreign', this.tableNameRaw, foreignData.column);
      const column = this.formatter.columnize(foreignData.column);
      const references = this.formatter.columnize(foreignData.references);
      const inTable = this.formatter.wrap(foreignData.inTable);
      const onUpdate = foreignData.onUpdate
          ? ` ON UPDATE ${foreignData.onUpdate}`
          : '';
      const onDelete = foreignData.onDelete
          ? ` ON DELETE ${foreignData.onDelete}`
          : '';
      this.pushQuery(
          (!this.forCreate ? `ALTER TABLE ${this.tableName()} ADD ` : '') +
          'CONSTRAINT ' +
          keyName +
          ' ' +
          'FOREIGN KEY (' +
          column +
          ') REFERENCES ' +
          inTable +
          ' (' +
          references +
          ')' +
          onUpdate +
          onDelete
      );
    }
  }

  // Get all of the column sql & bindings individually for building the table queries.
  getColumnTypes = (columns) => {
    return columns.reduce(
        function (memo, columnSQL) {
          const column = columnSQL[0];
          memo.sql.push(column.sql);
          memo.bindings.concat(column.bindings);
          return memo;
        },
        { sql: [], bindings: [] }
    );
  }

  // Adds all of the additional queries from the "column"
  columnQueries = (columns) => {
    const queries = columns.reduce((memo, columnSQL) => {
      const column = tail(columnSQL);
      if (!isEmpty(column)) return memo.concat(column);
      return memo;
    }, []);
    for (const q of queries) this.pushQuery(q);
  };

  // All of the columns to "add" for the query
  addColumns = (columns, prefix) => {
    prefix = prefix || this.addColumnsPrefix;
    if (columns.sql.length === 0) return
    const columnSql = columns.sql.map((column) => prefix + column);
    this.pushQuery({
      sql: `ALTER TABLE ${this.tableName()} ${columnSql.join(', ')}`,
      bindings: columns.bindings,
    });
  };

  alterColumns = (columns, colBuilders) => {
    if (columns.sql.length === 0) return
    this.addColumns(columns, this.alterColumnsPrefix, colBuilders);
  };

  // Compile the columns as needed for the current create or alter table
  getColumns = (method) => {
    const columns = this.grouped.columns || [];
    method = method || 'add';

    return columns
        .filter((column) => column.builder._method === method)
        .map((column) => this.client.columnCompiler(this, column.builder));
  };

  tableName = () => {
    const name = this.schemaNameRaw
        ? `${this.schemaNameRaw}.${this.tableNameRaw}`
        : this.tableNameRaw;

    return this.formatter.wrap(name);
  };

  // Generate all of the alter column statements necessary for the query.
  alterTable = () => {
    const alterTable = this.grouped.alterTable || [];
    for (let i = 0, l = alterTable.length; i < l; i++) {
      const statement = alterTable[i];
      if (this[statement.method]) {
        this[statement.method].apply(this, statement.args);
      } else {
        this.client.logger.error(`Debug: ${statement.method} does not exist`);
      }
    }
    for (const item in this.single) {
      if (typeof this[item] === 'function') this[item](this.single[item]);
    }
  };

  alterTableForCreate = (columnTypes) => {
    this.forCreate = true;
    const savedSequence = this.sequence;
    const alterTable = this.grouped.alterTable || [];
    this.grouped.alterTable = [];
    for (let i = 0, l = alterTable.length; i < l; i++) {
      const statement = alterTable[i];
      if (indexOf(this.createAlterTableMethods, statement.method) < 0) {
        this.grouped.alterTable.push(statement);
        continue;
      }
      if (this[statement.method]) {
        this.sequence = [];
        this[statement.method].apply(this, statement.args);
        columnTypes.sql.push(this.sequence[0].sql);
      } else {
        this.client.logger.error(`Debug: ${statement.method} does not exist`);
      }
    }
    this.sequence = savedSequence;
    this.forCreate = false;
  };

  dropColumn = (...args) => {
    const columns = normalizeArr.apply(null, ...args);
    const drops = (Array.isArray(columns) ? columns : [columns]).map((column) => {
      return this.dropColumnPrefix + this.formatter.wrap(column);
    });
    this.pushQuery(`ALTER TABLE ${this.tableName()} ${drops.join(', ')}`);
  };

  // If no name was specified for this index, we will create one using a basic
// convention of the table name, followed by the columns, followed by an
// index type, such as primary or index, which makes the index unique.
  _indexCommand = (type, tableName, columns) => {
    if (!Array.isArray(columns)) columns = columns ? [columns] : [];
    const table = tableName.replace(/\.|-/g, '_');
    const indexName = `${table}_${columns.join('_')}_${type}`.toLowerCase();
    return this.formatter.wrap(indexName);
  };
}

module.exports = TableCompiler;
