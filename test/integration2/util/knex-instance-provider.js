const { promisify } = require('util');
const knex = require('../../../lib');

const Db = {
  SQLite: 'sqlite3',
};

const defaultDbs = [Db.SQLite];

function getAllDbs() {
  return process.env.DB ? process.env.DB.split(' ') : defaultDbs;
}

const pool = {
  afterCreate: function (connection, callback) {
    callback(null, connection);
  },
};

const poolSqlite = {
  min: 0,
  max: 1,
  acquireTimeoutMillis: 1000,
  afterCreate: function (connection, callback) {
    connection.run('PRAGMA foreign_keys = ON', callback);
  },
};

const mysqlPool = Object.assign({}, pool, {
  afterCreate: function (connection, callback) {
    promisify(connection.query)
      .call(connection, "SET sql_mode='TRADITIONAL';", [])
      .then(function () {
        callback(null, connection);
      });
  },
});

const migrations = {
  directory: 'test/integration/migrate/migration',
};

const seeds = {
  directory: 'test/integration/seed/seeds',
};

const testConfigs = {
  sqlite3: {
    client: 'sqlite3',
    connection: ':memory:',
    pool: poolSqlite,
    migrations,
    seeds,
  },
};

function getKnexForDb(db) {
  const config = testConfigs[db];
  return knex(config);
}

module.exports = {
  Db,
  getAllDbs,
  getKnexForDb,
};
