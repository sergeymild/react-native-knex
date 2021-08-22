'use strict';

const omit = require('lodash.omit');
const QueryBuilder = require('../../lib/query/builder');
const Client = require('../../lib/client');

describe('query-builder', () => {
  it('accumulates multiple update calls #647', function () {
    const qb = new QueryBuilder({});
    qb.update('a', 1).update('b', 2);
    if (!qb._single.update.a === 1 || !qb._single.update.b === 2) {
      throw new Error('not eual')
    }
  });

})
