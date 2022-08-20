// TableBuilder

// Takes the function passed to the "createTable" or "table/editTable"
// functions and calls it with the "TableBuilder" as both the context and
// the first argument. Inside this function we can specify what happens to the
// method, pushing everything we want to do onto the "allStatements" array,
// which is then compiled into sql.
// ------
const { isString, isFunction } = require('../util/is')

class TableBuilder {
  constructor(client, method, tableName, fn) {
    this.client = client;
    this._fn = fn;
    this._method = method;
    this._schemaName = undefined;
    this._tableName = tableName;
    this._statements = [];
    this._single = {};

    if (!isFunction(this._fn)) {
      console.log("-")
      // throw new TypeError(
      //   'A callback function must be supplied to calls against `.createTable` ' +
      //     'and `.table`'
      // );
    }
  }

  setSchema = (schemaName) => this._schemaName = schemaName

  // Convert the current tableBuilder object "toSQL"
  // giving us additional methods if we're altering
  // rather than creating the table.
  toSQL = () => {
    if (this._method === 'alter') {
      Object.assign(this, AlterMethods)
    }
    this._fn?.call(this, this);
    return this.client.tableCompiler(this).toSQL();
  };

  _addStatement = (method, args) => {
    this._statements.push({grouping: 'alterTable', method, args});
    return this;
  }

  _addColumn = (name, args) => {
    const builder = this.client.columnBuilder(this, name, args);
    this._statements.push({grouping: 'columns', builder});
    return builder;
  }

  increments = (columnName) => this._addColumn('increments', [columnName])
  integer = (columnName, length) => this._addColumn('integer', [columnName, length])
  text = (columnName) => this._addColumn('text', [columnName])
  string = (columnName, length) => this._addColumn('string', [columnName, length])
  real = (columnName, precision, scale) => this._addColumn('real', [columnName, precision, scale])
  boolean = (columnName) => this._addColumn('boolean', [columnName])
  date = (columnName) => this._addColumn('date', [columnName])
  dateTime = (columnName) => this._addColumn('dateTime', [columnName])
  time = (columnName) => this._addColumn('time', [columnName])
  timestamp = (columnName) => this._addColumn('timestamp', [columnName])
  // The "timestamps" call is really just sets the `created_at` and `updated_at` columns.
  timestamps = (makeDefaultNow) => {
    const createdAt = this.dateTime('created_at');
    const updatedAt = this.dateTime('updated_at');
    if (makeDefaultNow && makeDefaultNow === true) {
      const now = this.client.raw('CURRENT_TIMESTAMP');
      createdAt.notNullable().defaultTo(now);
      updatedAt.notNullable().defaultTo(now);
    }
    return this;
  };
  binary = (columnName) => this._addColumn('binary', [columnName])
  enum = (columnName, values) => this._addColumn('enum', [columnName, values])
  json = (columnName) => this._addColumn('json', [columnName])
  uuid = (columnName) => this._addColumn('uuid', [columnName])
  specificType = (...args) => this._addColumn('specificType', args)


  index = (columnNames, indexName) => this._addStatement('index', [columnNames, indexName])
  unique = (columnNames, indexName) =>  this._addStatement('unique', [columnNames, indexName])
  primary = (...args) =>  this._addStatement('primary', args)
  dropForeign = (columnNames, foreignKeyName) =>  this._addStatement('dropForeign', [columnNames, foreignKeyName])
  dropUnique = (columnNames, indexName) =>  this._addStatement('dropUnique', [columnNames, indexName])
  dropIndex = (columnNames, indexName) =>  this._addStatement('dropIndex', [columnNames, indexName])

  // Set a foreign key on the table, calling
  // `table.foreign('column_name').references('column').on('table').onDelete()...
  // Also called from the ColumnBuilder context when chaining.
  foreign = (column, keyName) => {
    const foreignData = { column: column, keyName: keyName };
    this._statements.push({
      grouping: 'alterTable',
      method: 'foreign',
      args: [foreignData],
    });
    let returnObj = {
      references(tableColumn) {
        let pieces;
        if (isString(tableColumn)) {
          pieces = tableColumn.split('.');
        }
        if (!pieces || pieces.length === 1) {
          foreignData.references = pieces ? pieces[0] : tableColumn;
          return {
            on(tableName) {
              if (typeof tableName !== 'string') {
                throw new TypeError(
                    `Expected tableName to be a string, got: ${typeof tableName}`
                );
              }
              foreignData.inTable = tableName;
              return returnObj;
            },
            inTable() {
              return this.on.apply(this, arguments);
            },
          };
        }
        foreignData.inTable = pieces[0];
        foreignData.references = pieces[1];
        return returnObj;
      },
      withKeyName(keyName) {
        foreignData.keyName = keyName;
        return returnObj;
      },
      onUpdate(statement) {
        foreignData.onUpdate = statement;
        return returnObj;
      },
      onDelete(statement) {
        foreignData.onDelete = statement;
        return returnObj;
      },
      _columnBuilder(builder) {
        Object.assign(builder, returnObj)
        returnObj = builder;
        return builder;
      },
    };
    return returnObj;
  };
}

const AlterMethods = {
  // Renames the current column `from` the current
  // TODO: this.column(from).rename(to)
  renameColumn(from, to) {
    this._statements.push({
      grouping: 'alterTable',
      method: 'renameColumn',
      args: [from, to],
    });
    return this;
  },
};

// Drop a column from the current table.
// TODO: Enable this.column(columnName).drop();
AlterMethods.dropColumn = AlterMethods.dropColumns = function (columns) {
  if (Array.isArray(columns)) {
    for (let column of columns) {
      this._statements.push({
        grouping: 'alterTable',
        method: 'dropColumn',
        args: [column],
      });
    }
    return this
  }

  this._statements.push({
    grouping: 'alterTable',
    method: 'dropColumn',
    args: [columns],
  });

  return this;
};

module.exports = TableBuilder;
