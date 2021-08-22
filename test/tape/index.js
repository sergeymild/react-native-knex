/*eslint no-var:0*/
'use strict';

var makeKnex = require('../../knex');
var knexfile = require('../knexfile');

const {Knex, SQLite3Client} = require("../../knex");
const sqlite3 = require("sqlite3");
const config = require('../knexfile');

const knex = new Knex(new SQLite3Client(config, sqlite3))


require('./query-builder');
require('./transactions')(knex);
