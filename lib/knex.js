const EventEmitter = require('./EventEmitter')

const FunctionHelper = require('./functionhelper')
const batchInsert = require('./util/batchInsert')

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

    batchInsert(table, batch, chunkSize = 1000) {
        return batchInsert(this, table, batch, chunkSize);
    }
    // Creates a new transaction.
    // If container is provided, returns a promise for when the transaction is resolved.
    // If container is not provided, returns a promise with a transaction that is resolved
    // when transaction is ready to be used.
    transaction(container, _config) {
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

    table = (tableName, options) => {
        const qb = this.queryBuilder();
        if (!tableName) this.client.logger.warn('calling knex without a tableName is deprecated. Use knex.queryBuilder() instead.');
        return tableName ? qb.table(tableName, options) : qb;
    }

    withRecursive = (alias, statement) => this.queryBuilder().withRecursive(alias, statement);
    with = (alias, statement) => this.queryBuilder().with(alias, statement);
    select = (...columns) => this.queryBuilder().select(columns);
    as = (column) => this.queryBuilder().as(column);
    columns = (column) => this.queryBuilder().columns(column);
    column = (column) => this.queryBuilder().column(column);
    from = (tableName, options = {}) => this.queryBuilder().from(tableName, options);
    into = (tableName, options = {}) => this.queryBuilder().into(tableName, options);
    table = (tableName, options = {}) => this.queryBuilder().table(tableName, options);
    withSchema = (schemaName) => this.queryBuilder().withSchema(schemaName);
    distinct = () => this.queryBuilder().distinct();
    join = (table, first) => this.queryBuilder().join(table, first);
    leftJoin = (...args) => this.queryBuilder().leftJoin(args);
    crossJoin = (...args) => this.queryBuilder().crossJoin(args);
    where = (...args) => this.queryBuilder().where(args);
    andWhere = (...args) => this.queryBuilder().andWhere(args);
    orWhere = (...args) => this.queryBuilder().orWhere(args);
    whereNot = (...args) => this.queryBuilder().whereNot(args);
    orWhereNot = (...args) => this.queryBuilder().orWhereNot(args);
    whereRaw = (...args) => this.queryBuilder().whereRaw(args);
    whereWrapped = (...args) => this.queryBuilder().whereWrapped(args);
    havingWrapped = (...args) => this.queryBuilder().havingWrapped(args);
    orWhereRaw = (...args) => this.queryBuilder().orWhereRaw(args);
    whereExists = (...args) => this.queryBuilder().whereExists(args);
    orWhereExists = (...args) => this.queryBuilder().orWhereExists(args);
    whereNotExists = (...args) => this.queryBuilder().whereNotExists(args);
    orWhereNotExists = (...args) => this.queryBuilder().orWhereNotExists(args);
    whereIn = (...args) => this.queryBuilder().whereIn(args);
    orWhereIn = (...args) => this.queryBuilder().orWhereIn(args);
    whereNotIn = (...args) => this.queryBuilder().whereNotIn(args);
    orWhereNotIn = (...args) => this.queryBuilder().orWhereNotIn(args);
    whereNull = (...args) => this.queryBuilder().whereNull(args);
    orWhereNull = (...args) => this.queryBuilder().orWhereNull(args);
    whereNotNull = (...args) => this.queryBuilder().whereNotNull(args);
    orWhereNotNull = (...args) => this.queryBuilder().orWhereNotNull(args);
    whereBetween = (...args) => this.queryBuilder().whereBetween(args);
    whereNotBetween = (...args) => this.queryBuilder().whereNotBetween(args);
    andWhereBetween = (...args) => this.queryBuilder().andWhereBetween(args);

    andWhereNotBetween = (...args) => this.queryBuilder().andWhereNotBetween(args);
    orWhereBetween = (...args) => this.queryBuilder().orWhereBetween(args);
    orWhereNotBetween = (...args) => this.queryBuilder().orWhereNotBetween(args);
    groupBy = (...args) => this.queryBuilder().groupBy(args);
    groupByRaw = (...args) => this.queryBuilder().groupByRaw(args);
    orderBy = (...args) => this.queryBuilder().orderBy(args);
    orderByRaw = (...args) => this.queryBuilder().orderByRaw(args);
    union = (...args) => this.queryBuilder().union(args);
    unionAll = (...args) => this.queryBuilder().unionAll(args);
    intersect = (...args) => this.queryBuilder().intersect(args);
    having = (...args) => this.queryBuilder().having(args);
    havingRaw = (...args) => this.queryBuilder().havingRaw(args);
    orHaving = (...args) => this.queryBuilder().orHaving(args);
    orHavingRaw = (...args) => this.queryBuilder().orHavingRaw(args);
    offset = (...args) => this.queryBuilder().offset(args);
    limit = (...args) => this.queryBuilder().limit(args);
    count = (...args) => this.queryBuilder().count(args);

    countDistinct = (...args) => this.queryBuilder().countDistinct(args);
    min = (...args) => this.queryBuilder().min(args);
    max = (...args) => this.queryBuilder().max(args);
    sum = (...args) => this.queryBuilder().sum(args);
    sumDistinct = (...args) => this.queryBuilder().sumDistinct(args);
    avg = (...args) => this.queryBuilder().avg(args);
    avgDistinct = (...args) => this.queryBuilder().avgDistinct(args);
    increment = (...args) => this.queryBuilder().increment(args);
    decrement = (...args) => this.queryBuilder().decrement(args);
    first = (...args) => this.queryBuilder().first(args);
    debug = (...args) => this.queryBuilder().debug(args);
    pluck = (column) => this.queryBuilder().pluck(column);
    clearSelect = (...args) => this.queryBuilder().clearSelect(args);
    clearWhere = (...args) => this.queryBuilder().clearWhere(args);
    clearGroup = (...args) => this.queryBuilder().clearGroup(args);
    clearOrder = (...args) => this.queryBuilder().clearOrder(args);
    clearHaving = (...args) => this.queryBuilder().clearHaving(args);
    insert = (...args) => this.queryBuilder().insert(args);
    update = (...args) => this.queryBuilder().update(args);
    del = (...args) => this.queryBuilder().del(args);
    delete = (...args) => this.queryBuilder().delete(args);
    truncate = (...args) => this.queryBuilder().truncate(args);
    transacting = (...args) => this.queryBuilder().transacting(args);
    connection = (conn) => this.queryBuilder().connection(conn);


    _addInternalListener(eventName, listener) {
        this.client.on(eventName, listener);
        this._internalListeners.push({eventName, listener,});
    }
}

module.exports = Knex
