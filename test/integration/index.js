'use strict';



const {Knex, SQLite3Client} = require('../../knex');
const logger = require('./logger');
const config = require('../knexfile');
const sqlite3 = require('sqlite3')
const fs = require('fs');

Object.keys(config).forEach((dialectName) => {
  require('./connection-config-provider')(config[dialectName]);
  return require('./suite')(logger(new Knex(new SQLite3Client(config.sqlite3, sqlite3))));
});

before(function () {
  if (config.sqlite3 && config.sqlite3.connection.filename !== ':memory:') {
    fs.copyFileSync(
      __dirname + '/../multilineCreateMasterSample.sqlite3',
      __dirname + '/../multilineCreateMaster.sqlite3'
    );
  }
});

after(function () {
  if (config.sqlite3 && config.sqlite3.connection.filename !== ':memory:') {
    fs.unlinkSync(config.sqlite3.connection.filename);
    fs.unlinkSync(__dirname + '/../multilineCreateMaster.sqlite3');
  }
});
