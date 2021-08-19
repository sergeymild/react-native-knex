'use strict';

const {TEST_TIMESTAMP} = require('../../util/constants');

module.exports = function (knex) {
    describe('Deletes', function () {
        it('should handle deletes', async function () {
            await knex.schema.dropTableIfExists('accounts')
            await knex.schema.createTableIfNotExists('accounts', (t) => {
                t.increments('id')
                t.string('first_name')
            })

            await knex.table('accounts').insert({first_name: 'some'})
            await knex.table('accounts').insert({first_name: '22'})

            return knex.table('accounts')
                .where('id', 1)
                .delete()
                .testSql(function (tester) {
                    tester('sqlite3', 'delete from `accounts` where `id` = ?', [1], 1);
                });
        });

        it('should allow returning for deletes in sqlite3', async function () {
            return knex.table('accounts')
                .where('id', 2)
                .delete()
                .testSql(function (tester) {
                    tester('sqlite3', 'delete from `accounts` where `id` = ?', [2], 1);
                });
        });
    });
};
