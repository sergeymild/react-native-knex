const EventEmitter = require('../EventEmitter')
const saveAsyncStack = require('../util/save-async-stack')
const isEmpty = require("lodash.isempty");

// Constructor for the builder instance, typically called from
// `knex.builder`, accepting the current `knex` instance,
// and pulling out the `client` and `grammar` from the current
// knex instance.

class SchemaBuilder extends EventEmitter {
  _schema = ''
  constructor(client) {
    super()
    this.client = client;
    this._sequence = [];

    if (client.config) {
      this._debug = client.config.debug;
      saveAsyncStack(this, 4);
    }
  }

  _addMethod = (method, args) => {
    this._sequence.push({ method, args });
    return this;
  }

  createTable = (tableName, callback) => this._addMethod('createTable', [tableName, callback])
  createTableIfNotExists = (tableName, callback) => this._addMethod('createTableIfNotExists', [tableName, callback])
  alterTable = (tableName, callback) => this._addMethod('alterTable', [tableName, callback])
  renameTable = (oldTableName, newTableName) => this._addMethod('renameTable', [oldTableName, newTableName])
  dropTable = (tableName) => this._addMethod('dropTable', [tableName])
  hasTable = (tableName) => this._addMethod('hasTable', [tableName])
  hasColumn = (tableName, columnName) => this._addMethod('hasColumn', [tableName, columnName])
  dropTableIfExists = (tableName) => this._addMethod('dropTableIfExists', [tableName])
  raw = (statement) => this._addMethod('raw', [statement])
  createExtension = (...args) => this._addMethod('createExtension', args)
  createExtensionIfNotExists = (...args) => this._addMethod('createExtensionIfNotExists', args)
  dropExtension = (...args) => this._addMethod('dropExtension', args)
  dropExtensionIfExists = (...args) => this._addMethod('dropExtensionIfExists', args)

  toString = () => this.toQuery()
  toSQL = () => this.client.schemaCompiler(this).toSQL()

  then = (resolve, reject) => {
    let result = this.client.runner(this).run();
    return result.then.call(result, resolve, reject);
  }

  catch = (onReject) => {
    return this.then().catch(onReject);
  }

  finally = (onFinally) => {
    return this.then().finally(onFinally);
  }

  connection = (connection) => {
    this._connection = connection;
    return this;
  };

  debug = (enabled) => {
    this._debug = enabled ?? true;
    return this;
  }

  transacting = (transaction) => {
    if (transaction && transaction.client) {
      if (!transaction.client.transacting) {
        transaction.client.logger.warn(
            `Invalid transaction value: ${transaction.client}`
        );
      } else {
        this.client = transaction.client;
      }
    }
    if (isEmpty(transaction)) {
      this.client.logger.error(
          'Invalid value on transacting call, potential bug'
      );
      throw Error(
          'Invalid transacting value (null, undefined or empty object)'
      );
    }
    return this;
  }
}

module.exports = SchemaBuilder;
