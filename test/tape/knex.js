'use strict';

const knex = require('../../lib/index');
const test = require('tape');

test('it should throw error if client is omitted in config', function (t) {
  t.plan(1);
  try {
    knex({});
    t.deepEqual(true, false); //Don't reach this point
  } catch (error) {
    t.deepEqual(
      error.message,
      "knex: Required configuration option 'client' is missing."
    );
  }
});
