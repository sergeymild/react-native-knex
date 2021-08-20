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

  withSchema = (schemaName) => {
    this._schema = schemaName;
    return this;
  }

  _addMethod = (method, args) => {
    if (method === 'table') method = 'alterTable';
    this._sequence.push({ method, args });
    return this;
  }

  createTable = (...args) => this._addMethod('createTable', args)
  createTableIfNotExists = (...args) => this._addMethod('createTableIfNotExists', args)
  createSchema = (...args) => this._addMethod('createSchema', args)
  createSchemaIfNotExists = (...args) => this._addMethod('createSchemaIfNotExists', args)
  createExtension = (...args) => this._addMethod('createExtension', args)
  createExtensionIfNotExists = (...args) => this._addMethod('createExtensionIfNotExists', args)
  dropExtension = (...args) => this._addMethod('dropExtension', args)
  dropExtensionIfExists = (...args) => this._addMethod('dropExtensionIfExists', args)
  table = (...args) => this._addMethod('table', args)
  alterTable = (...args) => this._addMethod('alterTable', args)
  hasTable = (...args) => this._addMethod('hasTable', args)
  hasColumn = (...args) => this._addMethod('hasColumn', args)
  dropTable = (...args) => this._addMethod('dropTable', args)
  renameTable = (...args) => this._addMethod('renameTable', args)
  dropTableIfExists = (...args) => this._addMethod('dropTableIfExists', args)
  raw = (...args) => this._addMethod('raw', args)

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
