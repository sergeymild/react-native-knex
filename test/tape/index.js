/*eslint no-var:0*/
'use strict';
// var wtf = require('wtfnode');
require('../util/chai-setup');
var tape = require('tape');
var makeKnex = require('../../knex');
var knexfile = require('../knexfile');

require('./raw');
require('./query-builder');
require('./pool');
require('./knex');

Object.keys(knexfile).forEach(function (key) {
  var knex = makeKnex(knexfile[key]);

  // require('./transactions')(knex);

  // Tear down the knex connection
  tape('sqlite3 - transactions: after', function (t) {
    knex.destroy(function () {
      t.pass('Knex client destroyed');
      t.end();
    });
  });
});
