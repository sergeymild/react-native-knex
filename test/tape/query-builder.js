'use strict';

const tape = require('tape');
const omit = require('lodash.omit');
const QueryBuilder = require('../../lib/query/builder');
const Client = require('../../lib/client');

tape('accumulates multiple update calls #647', function (t) {
  t.plan(1);
  const qb = new QueryBuilder({});
  qb.update('a', 1).update('b', 2);
  t.deepEqual(qb._single.update, { a: 1, b: 2 });
});
