'use strict';



const {Knex, SQLite3Client} = require('../../knex');
const logger = require('./logger');
const config = require('../knexfile');
const sqlite3 = require('sqlite3')
const fs = require('fs');

const knex = new Knex(new SQLite3Client(config.sqlite3, sqlite3))
Object.keys(config).forEach((dialectName) => {
  return require('./suite')(logger(knex));
});

before(async function () {
  if (config.sqlite3.connection.filename !== ':memory:') {

  }
});

after(function () {
  if (config.sqlite3 && config.sqlite3.connection.filename !== ':memory:') {
    fs.unlinkSync(config.sqlite3.connection.filename);
  }
});
