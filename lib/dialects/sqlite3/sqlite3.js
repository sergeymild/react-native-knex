const Client = require('../../client')

const QueryCompiler = require('../../query/compiler')
const SchemaCompiler = require('../../schema/compiler')
const ColumnCompiler = require('../../schema/columncompiler')
const TableCompiler = require('../../schema/tablecompiler')
const SQLite3_DDL = require('./schema/ddl')
const SQLite3_Formatter = require('./formatter')
const {uniqueId} = require("../../util/helper-functions");

module.exports = class Client_SQLite3 extends Client {

  schemaCompiler(builder) {
    return new SchemaCompiler(this, builder);
  }

  queryCompiler() {
    return new QueryCompiler(this, ...arguments);
  }

  columnCompiler() {
    return new ColumnCompiler(this, ...arguments);
  }

  tableCompiler() {
    return new TableCompiler(this, ...arguments);
  }

  ddl(compiler, pragma, connection) {
    return new SQLite3_DDL(this, compiler, pragma, connection);
  }

  wrapIdentifierImpl(value) {
    return value !== '*' ? `\`${value.replace(/`/g, '``')}\`` : '*';
  }

  // Get a raw connection from the database, returning a promise with the connection object.
  acquireConnection() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise(async (resolve, reject) => {
      try {
        this.db = new (await this.driver).Database(
          this.config.name,
          (err) => {
            if (err) {
              return reject(err);
            }
            this.db.__knexUid = uniqueId('__knexUid');
            resolve(this.db);
          }
        );
      } catch (e) {
        reject(e)
      }
    });
  }

  destroy(callback) {
    super.destroy(callback);
    if (!this.db) return
    this.db.close();
    this.db = null
  }

  logQuery(obj) {
    if (!this.config.debug) return
    try {
      const debugSql = Array.isArray(obj.sql) ? obj.sql : [obj]
      for (const dsql of debugSql) {
        let query = [dsql.sql];
        if (dsql.bindings?.length > 0) {
          query.push(`[${dsql.bindings.join(',')}]`);
        }
        this.logger.debug(`SQL: ${query.join(" ")}`);
      }
    } catch (e) {
      this.logger.error(e.message)
    }
  }

  // Runs the query on the specified connection, providing the bindings and any
  // other necessary prep work.
  _query(connection, obj) {
    const { method } = obj;
    let callMethod;
    switch (method) {
      case 'del':
        callMethod = 'run';
        break;
      case 'insert':
      case 'update':
      case 'counter':
        callMethod = 'run';
        break;
      default:
        callMethod = 'all';
    }
    return new Promise((resolver, reject) => {
      if (!connection || !connection[callMethod]) {
        return reject(new Error(`Error calling ${callMethod} on connection.`));
      }

      this.logQuery(obj)

      connection[callMethod](obj.sql, obj.bindings, function(err, response) {
        if (err) return reject(err);
        obj.response = response;

        // We need the context here, as it contains
        // the "this.lastID" or "this.changes"
        obj.context = this;
        return resolver(obj);
      });
    });
  }

  // Ensures the response is returned in the same format as other clients.
  processResponse(obj, runner) {
    const ctx = obj.context;
    let { response } = obj;
    if (obj.output) return obj.output.call(runner, response);
    switch (obj.method) {
      case 'select':
      case 'pluck':
      case 'first':
        if (obj.method === 'pluck' && obj.pluck) {
          response = response.map(r => r[obj.pluck]);
        }
        return obj.method === 'first' ? response[0] : response;
      case 'insert':
        return [ctx.lastID];
      case 'del':
      case 'update':
      case 'counter':
        return ctx.changes;
      default:
        return response;
    }
  }

  formatter() {
    return new SQLite3_Formatter(this, ...arguments);
  }
}
