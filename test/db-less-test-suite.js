const { initTests } = require('./testInitializer');

initTests();

describe('Util Tests', function () {
  // Unit Tests for utilities.
  require('./unit/query/string');
  require('./unit/util/nanoid');
  require('./unit/util/save-async-stack');
});

describe('Query Building Tests', function () {
  this.timeout(process.env.KNEX_TEST_TIMEOUT || 5000);

  require('./unit/query/builder');
  require('./unit/query/formatter');
  require('./unit/query/string');
  require('./unit/schema/sqlite3');
  require('./unit/knex');

  require('./integration-test-suite')
});
