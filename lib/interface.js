const clone = require('lodash.clone')
const isEmpty = require('lodash.isempty')
const finallyMixin = require('./util/finally-mixin')

// class SqlInterface {
//   constructor() {
//     Object.defineProperty(this, Symbol.toStringTag, {
//       get: () => 'object',
//     });
//     finallyMixin(this);
//   }
//   toQuery = (tz) => {
//     let data = this.toSQL(this._method, tz);
//     if (!Array.isArray(data)) data = [data];
//     if (!data.length) {
//       return '';
//     }
//     return data
//         .map((statement) => {
//           return this.client._formatQuery(statement.sql, statement.bindings, tz);
//         })
//         .reduce((a, c) => a.concat(a.endsWith(';') ? '\n' : ';\n', c));
//   };
//
//   // Create a new instance of the `Runner`, passing in the current object.
//   then = (/* onFulfilled, onRejected */) => {
//     let result = this.client.runner(this).run();
//     return result.then.apply(result, arguments);
//   };
//
//   // Add additional "options" to the builder. Typically used for client specific
//   // items, like the `sqlite3` drivers.
//   options = (opts) => {
//     this._options = this._options || [];
//     this._options.push(clone(opts) || {});
//     return this;
//   };
//
//   // Sets an explicit "connection" we wish to use for this query.
//   connection = (connection) => {
//     this._connection = connection;
//     return this;
//   };
//
//   // Set a debug flag for the current schema query stack.
//   debug = (enabled) => {
//     this._debug = arguments.length ? enabled : true;
//     return this;
//   };
//
//   // Set the transaction object for this query.
//   transacting = (t) => {
//     if (t && t.client) {
//       if (!t.client.transacting) {
//         t.client.logger.warn(`Invalid transaction value: ${t.client}`);
//       } else {
//         this.client = t.client;
//       }
//     }
//     if (isEmpty(t)) {
//       this.client.logger.error(
//           'Invalid value on transacting call, potential bug'
//       );
//       throw Error(
//           'Invalid transacting value (null, undefined or empty object)'
//       );
//     }
//     return this;
//   };
//
//   catch = (onReject) => {
//     return this.then().catch(onReject);
//   };
// }
//
// module.exports = SqlInterface

module.exports = function (Target) {
  Target.prototype.toQuery = function (tz) {
    let data = this.toSQL(this._method, tz);
    if (!Array.isArray(data)) data = [data];
    if (!data.length) {
      return '';
    }
    return data
      .map((statement) => {
        return this.client._formatQuery(statement.sql, statement.bindings, tz);
      })
      .reduce((a, c) => a.concat(a.endsWith(';') ? '\n' : ';\n', c));
  };

  // Create a new instance of the `Runner`, passing in the current object.
  Target.prototype.then = function (/* onFulfilled, onRejected */) {
    let result = this.client.runner(this).run();
    return result.then.apply(result, arguments);
  };

  // Add additional "options" to the builder. Typically used for client specific
  // items, like the `sqlite3` drivers.
  Target.prototype.options = function (opts) {
    this._options = this._options || [];
    this._options.push(clone(opts) || {});
    return this;
  };

  // Sets an explicit "connection" we wish to use for this query.
  Target.prototype.connection = function (connection) {
    this._connection = connection;
    return this;
  };

  // Set a debug flag for the current schema query stack.
  Target.prototype.debug = function (enabled) {
    this._debug = arguments.length ? enabled : true;
    return this;
  };

  // Set the transaction object for this query.
  Target.prototype.transacting = function (t) {
    if (t && t.client) {
      if (!t.client.transacting) {
        t.client.logger.warn(`Invalid transaction value: ${t.client}`);
      } else {
        this.client = t.client;
      }
    }
    if (isEmpty(t)) {
      this.client.logger.error(
        'Invalid value on transacting call, potential bug'
      );
      throw Error(
        'Invalid transacting value (null, undefined or empty object)'
      );
    }
    return this;
  };

  Target.prototype.catch = function (onReject) {
    return this.then().catch(onReject);
  };

  Object.defineProperty(Target.prototype, Symbol.toStringTag, {
    get: () => 'object',
  });

  finallyMixin(Target.prototype);
};
