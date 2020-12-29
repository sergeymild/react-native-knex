const Raw = require('./raw')
const Ref = require('./ref')
const Runner = require('./runner')
const Formatter = require('./formatter')
const Transaction = require('./transaction')

const QueryBuilder = require('./query/builder')
const QueryCompiler = require('./query/compiler')

const SchemaBuilder = require('./schema/builder')
const SchemaCompiler = require('./schema/compiler')
const TableBuilder = require('./schema/tablebuilder')
const TableCompiler = require('./schema/tablecompiler')
const ColumnBuilder = require('./schema/columnbuilder')
const ColumnCompiler = require('./schema/columncompiler')
const EventEmitter = require('./EventEmitter')
const { makeEscape } = require('./query/string')

const Logger = require('./logger')


// The base client provides the general structure
// for a dialect specific client object.

module.exports = class Client extends EventEmitter {
  constructor(config = {}, driver) {
    super();
    this.config = config;
    this.driver = driver;
    this.logger = new Logger(config);

    this.valueForUndefined = this.raw('DEFAULT');
    if (config.useNullAsDefault) {
      this.valueForUndefined = null;
    }
  }

  formatter(builder) {
    return new Formatter(this, builder);
  }

  queryBuilder() {
    return new QueryBuilder(this);
  }

  queryCompiler(builder) {
    return new QueryCompiler(this, builder);
  }

  schemaBuilder() {
    return new SchemaBuilder(this);
  }

  schemaCompiler(builder) {
    return new SchemaCompiler(this, builder);
  }

  tableBuilder(type, tableName, fn) {
    return new TableBuilder(this, type, tableName, fn);
  }

  tableCompiler(tableBuilder) {
    return new TableCompiler(this, tableBuilder);
  }

  columnBuilder(tableBuilder, type, args) {
    return new ColumnBuilder(this, tableBuilder, type, args);
  }

  columnCompiler(tableBuilder, columnBuilder) {
    return new ColumnCompiler(this, tableBuilder, columnBuilder);
  }

  runner(builder) {
    return new Runner(this, builder);
  }

  transaction(container, config, outerTx) {
    return new Transaction(this, container, config, outerTx);
  }

  raw() {
    return new Raw(this).set(...arguments);
  }

  ref() {
    return new Ref(this, ...arguments);
  }

  _formatQuery(sql, bindings, timeZone) {
    bindings = bindings == null ? [] : [].concat(bindings);
    let index = 0;
    return sql.replace(/\\?\?/g, (match) => {
      if (match === '\\?') {
        return '?';
      }
      if (index === bindings.length) {
        return match;
      }
      const value = bindings[index++];
      return this._escapeBinding(value, { timeZone });
    });
  }

  _escapeBinding = makeEscape({
    escapeString(str) {
      return `'${str.replace(/'/g, '\'\'')}'`;
    },
  });

  query(connection, obj) {
    if (typeof obj === 'string') obj = { sql: obj };
    obj.bindings = this.prepBindings(obj.bindings);

    const { __knexUid, __knexTxId } = connection;

    this.emit('query', Object.assign({ __knexUid, __knexTxId }, obj));

    obj.sql = this.positionBindings(obj.sql);

    return this._query(connection, obj).catch((err) => {
      err.message =
        this._formatQuery(obj.sql, obj.bindings) + ' - ' + err.message;
      this.emit(
        'query-error',
        err,
        Object.assign({ __knexUid, __knexTxId }, obj),
      );
      throw err;
    });
  }

  prepBindings(bindings) {
    return bindings;
  }

  positionBindings(sql) {
    return sql;
  }

  postProcessResponse(resp, queryContext) {
    if (this.config.postProcessResponse) {
      return this.config.postProcessResponse(resp, queryContext);
    }
    return resp;
  }

  wrapIdentifier(value, queryContext) {
    return this.customWrapIdentifier(
      value,
      this.wrapIdentifierImpl,
      queryContext,
    );
  }

  customWrapIdentifier(value, origImpl, queryContext) {
    return origImpl(value);
  }

  wrapIdentifierImpl(value) {
    return value !== '*' ? `"${value.replace(/"/g, '""')}"` : '*';
  }

  validateConnection(connection) {
    return true;
  }

  releaseConnection(connection) {
    return Promise.resolve();
  }

// Destroy the current connection pool for the client.
  destroy(callback) {
    callback();
  }

  toString() {
    return '[object KnexClient]';
  }

  canCancelQuery = false;

  assertCanCancelQuery() {
    if (!this.canCancelQuery) {
      throw new Error('Query cancelling not supported for this dialect');
    }
  }

  cancelQuery() {
    throw new Error('Query cancelling not supported for this dialect');
  }
}
