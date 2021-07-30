'use strict';

const { TEST_TIMESTAMP } = require('../../util/constants');

module.exports = function (knex) {
  describe('Deletes', function () {
    it('should handle deletes', function () {
      return knex.table('accounts')
        .where('id', 1)
        .del()
        .testSql(function (tester) {
          tester('sqlite3', 'delete from `accounts` where `id` = ?', [1], 1);
        });
    });

    it('should allow returning for deletes in sqlite3', async function () {
      return knex.table('accounts')
        .where('id', 2)
        .del('*')
        .testSql(function (tester) {
          tester('sqlite3', 'delete from `accounts` where `id` = ?', [2], 1);
        });
    });
  });
};
