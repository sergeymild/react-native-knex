'use strict';
/* eslint no-var: 0 */

const _ = require('lodash');

// excluding redshift, oracle, and mssql dialects from default integrations test
const testIntegrationDialects = (
  process.env.DB || 'sqlite3 postgres mysql mysql2 mssql oracledb'
).match(/\w+/g);

const testConfigs = {

  sqlite3: {
    debug: true,
    connection: {
      filename: ":memory:"
    },
  },
};

// export only copy the specified dialects
module.exports = _.reduce(
  testIntegrationDialects,
  function (res, dialectName) {
    res[dialectName] = testConfigs[dialectName];
    return res;
  },
  {}
);
