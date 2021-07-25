'use strict';



const {Knex, SQLite3Client} = require('../../knex');
const logger = require('./logger');
const config = require('../knexfile');
const sqlite3 = require('sqlite3')
const fs = require('fs');

const knex = new Knex(new SQLite3Client(config, sqlite3))
require('./suite')(logger(knex))
