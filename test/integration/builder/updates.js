'use strict';

const {expect} = require('chai');

const {TEST_TIMESTAMP} = require('../../util/constants');

module.exports = function (knex) {
    describe('Updates', function () {
        it('should handle updates', async function () {
            await knex.schema.dropTableIfExists('accounts')
            await knex.schema.createTableIfNotExists('accounts', (t) => {
                t.increments('id')
                t.string('email').nullable()
                t.integer('balance').nullable()
                t.integer('logins').defaultTo(0)
                t.timestamp('created_at').nullable()
            })

            await knex.table('accounts').insert([
                {
                    id: 1,
                    email: 'test@example.com',
                    balance: 0,
                    created_at: TEST_TIMESTAMP,
                },
            ])

            return knex.table('accounts')
                .where('id', 1)
                .update({email: 'test100@example.com', balance: 2})
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'update `accounts` set `email` = ?, `balance` = ? where `id` = ?',
                        ['test100@example.com', 2, 1],
                        1
                    );
                });
        });

        it('should immediately return updated value for other connections when updating row to DB returns', async function () {
            const res = await knex.table('accounts')

            function runTest() {
                return Promise.all(
                    res.map((origRow) => {
                        return Promise.resolve()
                            .then(() => {
                                return knex.transaction((trx) => {
                                    return trx.table('accounts')
                                        .where('id', origRow.id)
                                        .update({balance: 654})
                                });
                            })
                            .then(() => {
                                return knex.table('accounts')
                                    .where('id', origRow.id)
                                    .then((res) => res[0]);
                            })
                            .then((updatedRow) => {
                                expect(updatedRow.balance).to.equal(654);
                                return knex.transaction((trx) =>
                                    trx.table('accounts')
                                        .where('id', origRow.id)
                                        .update({balance: origRow.balance})
                                );
                            })
                            .then(() => {
                                return knex.table('accounts')
                                    .where('id', origRow.id)
                                    .then((res) => res[0]);
                            })
                            .then((updatedRow) => {
                                expect(updatedRow.balance).to.equal(origRow.balance);
                            });
                    })
                );
            }

            // run few times to try to catch the problem
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
            await runTest()
        });

        it('should increment a value', async function () {
            const accounts = await knex.table('accounts')
                .select('logins')
                .where('id', 1)

            const rowsAffected = await knex.table('accounts')
                .where('id', 1)
                .increment('logins')

            expect(rowsAffected).to.equal(1);
            const accounts2 = await knex.table('accounts').select('logins').where('id', 1);
            expect(accounts[0].logins + 1).to.equal(accounts2[0].logins);
        });

        it('should increment a negative value', async function () {
            const accounts = await knex.table('accounts')
                .select('logins')
                .where('id', 1)

            const rowsAffected = await knex.table('accounts')
                .where('id', 1)
                .increment('logins', -2)

            expect(rowsAffected).to.equal(1);
            const accounts2 = await knex.table('accounts').select('logins').where('id', 1);
            expect(accounts[0].logins - 2).to.equal(accounts2[0].logins);
        });

        it('should increment a float value', async function () {
            const accounts = await knex.table('accounts')
                .select('balance')
                .where('id', 1)
            const rowsAffected = await knex.table('accounts')
                .where('id', 1)
                .increment('balance', 22.53)

            expect(rowsAffected).to.equal(1);
            const accounts2 = await knex.table('accounts').select('balance').where('id', 1);
            expect(accounts[0].balance + 22.53).to.be.closeTo(accounts2[0].balance, 0.001);

        });

        it('should decrement a value', async function () {
            const accounts = await knex.table('accounts')
                .select('logins')
                .where('id', 1)
            const rowsAffected = await knex.table('accounts')
                .where('id', 1)
                .decrement('logins')
            expect(rowsAffected).to.equal(1);
            const accounts2 = await knex.table('accounts').select('logins').where('id', 1);
            expect(accounts[0].logins - 1).to.equal(accounts2[0].logins);
        });

        it('should decrement a negative value', async function () {
            const accounts = await knex.table('accounts')
                .select('logins')
                .where('id', 1)

            const rowsAffected = await knex.table('accounts')
                .where('id', 1)
                .decrement('logins', -2)
            expect(rowsAffected).to.equal(1);
            const accounts2 = await knex.table('accounts').select('logins').where('id', 1);
            expect(accounts[0].logins + 2).to.equal(accounts2[0].logins);
        });

        it('should decrement a float value', async function () {
            const accounts = await knex.table('accounts')
                .select('balance')
                .where('id', 1)
            const rowsAffected = await knex.table('accounts')
                .where('id', 1)
                .decrement('balance', 10.29)
            expect(rowsAffected).to.equal(1);
            const accounts2 = await knex.table('accounts').select('balance').where('id', 1);
            expect(accounts[0].balance - 10.29).to.be.closeTo(
                accounts2[0].balance,
                0.001
            );

        });
    });
};
