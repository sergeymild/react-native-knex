// TableBuilder

// Takes the function passed to the "createTable" or "table/editTable"
// functions and calls it with the "TableBuilder" as both the context and
// the first argument. Inside this function we can specify what happens to the
// method, pushing everything we want to do onto the "allStatements" array,
// which is then compiled into sql.
// ------
const each = require('lodash.foreach')
const extend = require('lodash.assign')
const toArray = require('lodash.toarray')
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
      extend(this, AlterMethods);
    }
    this._fn?.call(this, this);
    return this.client.tableCompiler(this).toSQL();
  };

  _addStatement = (method, args) => {
    this._statements.push({grouping: 'alterTable', method, args});
    return this;
  }

  index = (...args) => this._addStatement('index', args)
  primary = (...args) =>  this._addStatement('primary', args)
  unique = (...args) =>  this._addStatement('unique', args)
  dropPrimary = (...args) =>  this._addStatement('dropPrimary', args)
  dropUnique = (...args) =>  this._addStatement('dropUnique', args)
  dropIndex = (...args) =>  this._addStatement('dropIndex', args)
  dropForeign = (...args) =>  this._addStatement('dropForeign', args)

  _addColumn = (name, args) => {
    const builder = this.client.columnBuilder(this, name, args);
    this._statements.push({grouping: 'columns', builder});
    return builder;
  }

  decimal = (...args) => this._addColumn('decimal', args)
  float = (...args) => this._addColumn('float', args)
  double = (...args) => this._addColumn('double', args)
  real = (...args) => this._addColumn('real', args)
  boolean = (...args) => this._addColumn('boolean', args)
  serial = (...args) => this._addColumn('serial', args)
  date = (...args) => this._addColumn('date', args)
  datetime = (...args) => this._addColumn('datetime', args)
  timestamp = (...args) => this._addColumn('timestamp', args)
  time = (...args) => this._addColumn('time', args)
  year = (...args) => this._addColumn('year', args)
  char = (...args) => this._addColumn('char', args)
  varchar = (...args) => this._addColumn('varchar', args)
  tinytext = (...args) => this._addColumn('tinytext', args)
  tinyText = (...args) => this._addColumn('tinyText', args)
  text = (...args) => this._addColumn('text', args)
  mediumtext = (...args) => this._addColumn('mediumtext', args)
  mediumText = (...args) => this._addColumn('mediumText', args)
  longtext = (...args) => this._addColumn('longtext', args)
  longText = (...args) => this._addColumn('longText', args)
  binary = (...args) => this._addColumn('binary', args)
  varbinary = (...args) => this._addColumn('varbinary', args)
  tinyblob = (...args) => this._addColumn('tinyblob', args)
  tinyBlob = (...args) => this._addColumn('tinyBlob', args)
  mediumblob = (...args) => this._addColumn('mediumblob', args)
  mediumBlob = (...args) => this._addColumn('mediumBlob', args)
  blob = (...args) => this._addColumn('blob', args)
  longblob = (...args) => this._addColumn('longblob', args)
  longBlob = (...args) => this._addColumn('longBlob', args)
  enum = (...args) => this._addColumn('enum', args)
  set = (...args) => this._addColumn('set', args)
  bool = (...args) => this._addColumn('bool', args)
  dateTime = (...args) => this._addColumn('dateTime', args)
  increments = (...args) => this._addColumn('increments', args)
  integer = (...args) => this._addColumn('integer', args)
  string = (...args) => this._addColumn('string', args)
  json = (...args) => this._addColumn('json', args)
  uuid = (...args) => this._addColumn('uuid', args)
  enu = (...args) => this._addColumn('enu', args)
  specificType = (...args) => this._addColumn('specificType', args)
  // The "timestamps" call is really just sets the `created_at` and `updated_at` columns.
  timestamps = (...args) => {
    const method = args[0] === true ? 'timestamp' : 'datetime';
    const createdAt = this[method]('created_at');
    const updatedAt = this[method]('updated_at');
    if (args[1] === true) {
      const now = this.client.raw('CURRENT_TIMESTAMP');
      createdAt.notNullable().defaultTo(now);
      updatedAt.notNullable().defaultTo(now);
    }
    return this;
  };

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
        extend(builder, returnObj);
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

  dropTimestamps() {
    return this.dropColumns(['created_at', 'updated_at']);
  },

  // TODO: changeType
};

// Drop a column from the current table.
// TODO: Enable this.column(columnName).drop();
AlterMethods.dropColumn = AlterMethods.dropColumns = function () {
  this._statements.push({
    grouping: 'alterTable',
    method: 'dropColumn',
    args: toArray(arguments),
  });
  return this;
};

module.exports = TableBuilder;
