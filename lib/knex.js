import Raw from './raw';
import Client from './client';
import QueryBuilder from './query/builder';
import QueryInterface from './query/methods';

import makeKnex from './util/make-knex';
import { KnexTimeoutError } from './util/timeout';
import fakeClient from './util/fake-client';

function Knex(client) {
  const newKnex = makeKnex(client);
  if (client.config.userParams) {
    newKnex.userParams = client.config.userParams;
  }
  return newKnex;
}

// Expose Client on the main Knex namespace.
Knex.Client = Client;

Knex.KnexTimeoutError = KnexTimeoutError;

Knex.QueryBuilder = {
  extend: function(methodName, fn) {
    QueryBuilder.extend(methodName, fn);
    QueryInterface.push(methodName);
  },
};

/* eslint no-console:0 */

// Run a "raw" query, though we can't do anything with it other than put
// it in a query statement.
Knex.raw = (sql, bindings) => {
  console.warn(
    'global Knex.raw is deprecated, use knex.raw (chain off an initialized knex object)',
  );
  return new Raw(fakeClient).set(sql, bindings);
};

export default Knex;
