// Knex.js
// --------------
//     (c) 2013-present Tim Griesser
//     Knex may be freely distributed under the MIT license.
//     For details and documentation:
//     http://knexjs.org

const Knex = require('./lib/knex')
const NativeClient = require('./lib/dialects/sqlite3/sqlite-native')
const SQLite3Client = require('./lib/dialects/sqlite3/sqlite3')
module.exports = {Knex, NativeClient, SQLite3Client}
