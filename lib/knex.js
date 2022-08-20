const EventEmitter = require('./EventEmitter')

const FunctionHelper = require('./functionhelper')
const BatchInsert = require("./util/batchInsert");

class Knex extends EventEmitter {
  _internalListeners = []

  constructor(client) {
    super()
    this.client = client

    // Passthrough all "start" and "query" events to the knex object.
    this._addInternalListener('start', (obj) => {
      this.emit('start', obj);
    });
    this._addInternalListener('query', (obj) => {
      this.emit('query', obj);
    });
    this._addInternalListener('query-error', (err, obj) => {
      this.emit('query-error', err, obj);
    });
    this._addInternalListener('query-response', (response, obj, builder) => {
      this.emit('query-response', response, obj, builder);
    });
  }

  get schema() {
    return this.client.schemaBuilder();
  }

  get fn() {
    return new FunctionHelper(this.client);
  }

  raw() {
    return this.client.raw.apply(this.client, arguments);
  }

  batchInsert(table) {
    return new BatchInsert(this, table)
  }

  // Creates a new transaction.
  // If container is provided, returns a promise for when the transaction is resolved.
  // If container is not provided, returns a promise with a transaction that is resolved
  // when transaction is ready to be used.
  transaction = (container, _config) => {
    const config = Object.assign({}, _config);
    if (config.doNotRejectOnRollback === undefined) {
      // Backwards-compatibility: default value changes depending upon
      // whether or not a `container` was provided.
      config.doNotRejectOnRollback = !container;
    }

    return this._transaction(container, config);
  }

  // Internal method that actually establishes the Transaction.  It makes no assumptions
  // about the `config` or `outerTx`, and expects the caller to handle these details.
  _transaction(container, config, outerTx = null) {
    if (container) {
      const trx = this.client.transaction(container, config, outerTx);
      return trx;
    } else {
      return new Promise((resolve, reject) => {
        const trx = this.client.transaction(resolve, config, outerTx);
        trx.catch(reject);
      });
    }
  }

  transactionProvider(config) {
    let trx;
    return () => {
      if (!trx) {
        trx = this.transaction(undefined, config);
      }
      return trx;
    };
  }

  // Convenience method for tearing down the pool.
  destroy(callback) {
    return this.client.destroy(callback);
  }

  ref(ref) {
    return this.client.ref(ref);
  }

  queryBuilder() {
    return this.client.queryBuilder();
  }

  select = (...columns) => this.queryBuilder().select(columns);
  table = (tableName, options = {}) => this.queryBuilder().table(tableName, options);
  transacting = (...args) => this.queryBuilder().transacting(args);
  connection = (conn) => this.queryBuilder().connection(conn);


  _addInternalListener(eventName, listener) {
    this.client.on(eventName, listener);
    this._internalListeners.push({eventName, listener,});
  }
}

module.exports = Knex
