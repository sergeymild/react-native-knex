const {KnexTimeoutError} = require('./util/timeout');
const {timeout} = require('./util/timeout');

let Transform;


// The "Runner" constructor takes a "builder" (query, schema, or raw)
// and runs through each of the query statements, calling any additional
// "output" method provided alongside the query and bindings.
class Runner {
  constructor(client, builder) {
    this.client = client;
    this.builder = builder;

    // The "connection" object is set on the runner when
    // "run" is called.
    this.connection = void 0;
  }

  // "Run" the target, calling "toSQL" on the builder, returning
  // an object or array of queries to run, each of which are run on
  // a single connection.
  run = async () => {
    try {
      this.connection = await this.ensureConnection();

      this.client.emit('start', this.builder);
      this.builder.emit('start', this.builder);
      const sql = this.builder.toSQL();

      let promise;
      if (Array.isArray(sql)) promise = this.queryArray(sql);
      else promise = this.query(sql);
      this.builder.emit('end');
      return promise;
    } catch (err) {
      if (this.builder._events?.error) this.builder.emit('error', err);
      throw err;
    }
  }

  // "Runs" a query, returning a promise. All queries specified by the builder are guaranteed
  // to run in sequence, and on the same connection, especially helpful when schema building
  // and dealing with foreign key constraints, etc.
  query = async (obj) => {
    const {__knexUid, __knexTxId} = this.connection;

    this.builder.emit('query', Object.assign({__knexUid, __knexTxId}, obj));

    const runner = this;
    let queryPromise = this.client.query(this.connection, obj);

    if (obj.timeout) {
      queryPromise = timeout(queryPromise, obj.timeout);
    }

    // Await the return value of client.processResponse; in the case of sqlite3's
    // dropColumn()/renameColumn(), it will be a Promise for the transaction
    // containing the complete rename procedure.
    return queryPromise
      .then((resp) => {
        return this.client.processResponse(resp, runner)
      })
      .then((processedResponse) => {
        const postProcessedResponse = processedResponse

        this.builder.emit(
          'query-response',
          postProcessedResponse,
          Object.assign({__knexUid, __knexTxId}, obj),
          this.builder,
        );

        this.client.emit(
          'query-response',
          postProcessedResponse,
          Object.assign({__knexUid, __knexTxId}, obj),
          this.builder,
        );

        return postProcessedResponse;
      })
      .catch((error) => {
        if (!(error instanceof KnexTimeoutError)) {
          return Promise.reject(error);
        }
        const {timeout, sql, bindings} = obj;

        let cancelQuery;
        if (obj.cancelOnTimeout) {
          cancelQuery = this.client.cancelQuery(this.connection);
        } else {
          // If we don't cancel the query, we need to mark the connection as disposed so that
          // it gets destroyed and is never used again. If we don't do this and
          // return the connection, it will be useless until the current operation
          // that timed out, finally finishes.
          this.connection.__knex__disposed = error;
          cancelQuery = Promise.resolve();
        }

        return cancelQuery
          .catch((cancelError) => {
            // If the cancellation failed, we need to mark the connection as disposed so that
            // it gets destroyed and is never used again. If we don't do this and
            // return the connection, it will be useless until the current operation
            // that timed out, finally finishes.
            this.connection.__knex__disposed = error;

            // cancellation failed
            throw Object.assign(cancelError, {
              message: `After query timeout of ${timeout}ms exceeded, cancelling of query failed.`,
              sql,
              bindings,
              timeout,
            });
          })
          .then(() => {
            // cancellation succeeded, rethrow timeout error
            throw Object.assign(error, {
              message: `Defined query timeout of ${timeout}ms exceeded when running query.`,
              sql,
              bindings,
              timeout,
            });
          });
      })
      .catch((error) => {
        this.builder.emit(
          'query-error',
          error,
          Object.assign({__knexUid, __knexTxId}, obj),
        );
        throw error;
      });
  }

  // In the case of the "schema builder" we call `queryArray`, which runs each
  // of the queries in sequence.
  queryArray = async (queries) => {
    if (queries.length === 1) {
      return this.query(queries[0]);
    }

    const results = [];
    for (const query of queries) {
      results.push(await this.query(query));
    }
    return results;
  }

  // Check whether there's a transaction flag, and that it has a connection.
  ensureConnection = async (cb) => {
    // Use override from a builder if passed
    if (this.builder._connection) return this.builder._connection;

    if (this.connection) return this.connection;
    try {
      const connection = await this.client.acquireConnection()
      try {
        return connection;
      } finally {
        await this.client.releaseConnection(this.connection);
      }
    } catch (error) {
      if (!(error instanceof KnexTimeoutError)) {
        return Promise.reject(error);
      }
      if (this.builder) {
        error.sql = this.builder.sql;
        error.bindings = this.builder.bindings;
      }
      throw error;
    }
  }
}

module.exports = Runner;
