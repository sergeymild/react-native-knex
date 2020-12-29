const Raw = require('./raw')
const Client = require('./client')
const QueryBuilder = require('./query/builder')
const QueryInterface = require('./query/methods')

const KnexClass = require('./util/make-knex')
const { KnexTimeoutError } = require('./util/timeout')
const fakeClient = require('./util/fake-client')



// function initializeKnex(client) {
//   const newKnex = makeKnex(client);
//   if (client.config.userParams) {
//     newKnex.userParams = client.config.userParams;
//   }
//   return newKnex;
// }

// Expose Client on the main Knex namespace.
KnexClass.Client = Client;

KnexClass.KnexTimeoutError = KnexTimeoutError;

KnexClass.QueryBuilder = {
  extend: function(methodName, fn) {
    QueryBuilder.extend(methodName, fn);
    QueryInterface.push(methodName);
  },
};

/* eslint no-console:0 */

// Run a "raw" query, though we can't do anything with it other than put
// it in a query statement.
KnexClass.raw = (sql, bindings) => {
  console.warn(
    'global Knex.raw is deprecated, use knex.raw (chain off an initialized knex object)',
  );
  return new Raw(fakeClient).set(sql, bindings);
};

module.exports = KnexClass;
