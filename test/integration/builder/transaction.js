'use strict';

const {expect} = require('chai');

const Knex = require('../../../knex');
const _ = require('lodash');
const sinon = require('sinon');
const {KnexTimeoutError} = require('../../../lib/util/timeout');
const delay = require('../../../lib/util/delay');

module.exports = function (knex) {
    // Certain dialects do not have proper insert with returning, so if this is true
    // then pick an id to use as the "foreign key" just for testing transactions.
    const constid = /redshift/.test(knex.client.driverName);
    let fkid = 1;

    describe('Transactions', function () {
        it('should throw when undefined transaction is sent to transacting', async function () {
            await knex.schema.dropTableIfExists('accounts')
            await knex.schema.createTableIfNotExists('accounts', (t) => {
                t.increments('id')
                t.string('first_name')
                t.string('last_name')
                t.string('email')
                t.boolean('logins')
                t.text('about')
                t.timestamp('created_at')
                t.timestamp('updated_at')
            })

            await knex.schema.dropTableIfExists('test_table_two')
            await knex.schema.createTableIfNotExists('test_table_two', (t) => {
                t.increments('id')
                t.integer('account_id')
                t.boolean('status')
                t.string('details')
            })

            return knex
                .transaction(function (t) {
                    knex.table('accounts').transacting(undefined);
                })
                .catch(function handle(error) {
                    expect(error.message).to.equal(
                        'Invalid transacting value (null, undefined or empty object)'
                    );
                });
        });

        it('supports direct retrieval of a transaction without a callback', () => {
            const trxPromise = knex.transaction();
            const query =
                knex.client.driverName === 'oracledb'
                    ? '1 as "result" from DUAL'
                    : '1 as result';

            let transaction;
            return trxPromise
                .then((trx) => {
                    transaction = trx;
                    expect(trx.client.transacting).to.equal(true);
                    return knex.transacting(trx).select(knex.raw(query));
                })
                .then((rows) => {
                    expect(rows[0].result).to.equal(1);
                    return transaction.commit();
                });
        });

        it('should throw when null transaction is sent to transacting', function () {
            return knex
                .transaction(function (t) {
                    knex.table('accounts').transacting(null);
                })
                .catch(function handle(error) {
                    expect(error.message).to.equal(
                        'Invalid transacting value (null, undefined or empty object)'
                    );
                });
        });

        it('should throw when empty object transaction is sent to transacting', function () {
            return knex
                .transaction(function (t) {
                    knex.table('accounts').transacting({});
                })
                .catch(function handle(error) {
                    expect(error.message).to.equal(
                        'Invalid transacting value (null, undefined or empty object)'
                    );
                });
        });

        it('should be able to commit transactions', function () {
            let id = null;
            return knex
                .transaction(function (t) {
                    knex.table('accounts')
                        .transacting(t)
                        .insert({
                            first_name: 'Transacting',
                            last_name: 'User',
                            email: 'transaction-test1@example.com',
                            logins: 1,
                            about: 'Lorem ipsum Dolore labore incididunt enim.',
                            created_at: new Date(),
                            updated_at: new Date(),
                        })
                        .then(function (resp) {
                            return knex.table('test_table_two')
                                .transacting(t)
                                .insert({
                                    account_id: constid ? ++fkid : (id = resp[0]),
                                    details: '',
                                    status: 1,
                                });
                        })
                        .then(function () {
                            t.commit('Hello world');
                        });
                })
                .then(function (commitMessage) {
                    expect(commitMessage).to.equal('Hello world');
                    return knex.table('accounts').where('id', id).select('first_name');
                })
                .then(function (resp) {
                    if (!constid) {
                        expect(resp).to.have.length(1);
                    }
                });
        });

        it('should be able to rollback transactions', function () {
            let id = null;
            const err = new Error('error message');
            return knex
                .transaction(function (t) {
                    knex.table('accounts')
                        .transacting(t)
                        .insert({
                            first_name: 'Transacting',
                            last_name: 'User2',
                            email: 'transaction-test2@example.com',
                            logins: 1,
                            about: 'Lorem ipsum Dolore labore incididunt enim.',
                            created_at: new Date(),
                            updated_at: new Date(),
                        })
                        .then(function (resp) {
                            return knex.table('test_table_two')
                                .transacting(t)
                                .insert({
                                    account_id: constid ? ++fkid : (id = resp[0]),
                                    details: '',
                                    status: 1,
                                });
                        })
                        .then(function () {
                            t.rollback(err);
                        });
                })
                .catch(function (msg) {
                    expect(msg).to.equal(err);
                    return knex.table('accounts').where('id', id).select('first_name');
                })
                .then(function (resp) {
                    expect(resp.length).to.equal(0);
                });
        });

        it('should be able to commit transactions with a resolved trx query', function () {
            let id = null;
            return knex
                .transaction(function (trx) {
                    return trx.table('accounts')
                        .insert({
                            first_name: 'Transacting',
                            last_name: 'User',
                            email: 'transaction-test3@example.com',
                            logins: 1,
                            about: 'Lorem ipsum Dolore labore incididunt enim.',
                            created_at: new Date(),
                            updated_at: new Date(),
                        })
                        .then(function (resp) {
                            return trx.table('test_table_two').insert({
                                account_id: constid ? ++fkid : (id = resp[0]),
                                details: '',
                                status: 1,
                            });
                        })
                        .then(function () {
                            return 'Hello World';
                        });
                })
                .then(function (commitMessage) {
                    expect(commitMessage).to.equal('Hello World');
                    return knex.table('accounts').where('id', id).select('first_name');
                })
                .then(function (resp) {
                    if (!constid) {
                        expect(resp).to.have.length(1);
                    }
                });
        });

        it('should be able to rollback transactions with rejected trx query', function () {
            let id = null;
            const err = new Error('error message');
            let __knexUid,
                count = 0;
            return knex
                .transaction(function (trx) {
                    return trx.table('accounts')
                        .insert({
                            first_name: 'Transacting',
                            last_name: 'User2',
                            email: 'transaction-test4@example.com',
                            logins: 1,
                            about: 'Lorem ipsum Dolore labore incididunt enim.',
                            created_at: new Date(),
                            updated_at: new Date(),
                        })
                        .then(function (resp) {
                            return trx
                                .insert({
                                    account_id: constid ? ++fkid : (id = resp[0]),
                                    details: '',
                                    status: 1,
                                })
                                .into('test_table_two');
                        })
                        .then(function () {
                            throw err;
                        });
                })
                .on('query', function (obj) {
                    count++;
                    if (!__knexUid) __knexUid = obj.__knexUid;
                    expect(__knexUid).to.equal(obj.__knexUid);
                })
                .catch(function (msg) {
                    // oracle & mssql: BEGIN & ROLLBACK not reported as queries
                    const expectedCount =
                        knex.client.driverName === 'oracledb' ||
                        knex.client.driverName === 'mssql'
                            ? 2
                            : 4;
                    expect(count).to.equal(expectedCount);
                    expect(msg).to.equal(err);
                    return knex.table('accounts').where('id', id).select('first_name');
                })
                .then(function (resp) {
                    expect(resp).to.eql([]);
                });
        });

        it('should be able to run schema methods', async () => {
            let __knexUid,
                count = 0;
            const err = new Error('error message');
            let id = null;
            const promise = knex
                .transaction(function (trx) {
                    return trx.table('accounts')
                        .insert({
                            first_name: 'Transacting',
                            last_name: 'User3',
                            email: 'transaction-test5@example.com',
                            logins: 1,
                            about: 'Lorem ipsum Dolore labore incididunt enim.',
                            created_at: new Date(),
                            updated_at: new Date(),
                        })
                        .then(function (resp) {
                            return trx.table('test_table_two').insert({
                                account_id: constid ? ++fkid : (id = resp[0]),
                                details: '',
                                status: 1,
                            });
                        })
                        .then(function () {
                            return trx.schema.createTable(
                                'test_schema_transactions',
                                function (table) {
                                    table.increments();
                                    table.string('name');
                                    table.timestamps();
                                }
                            );
                        });
                })
                .on('query', function (obj) {
                    count++;
                    if (!__knexUid) __knexUid = obj.__knexUid;
                    expect(__knexUid).to.equal(obj.__knexUid);
                })
                .then(function () {
                    if (knex.client.driverName === 'mssql') {
                        expect(count).to.equal(3);
                    } else if (knex.client.driverName === 'oracledb') {
                        expect(count).to.equal(4);
                    } else {
                        expect(count).to.equal(5);
                    }
                    return knex.table('accounts').where('id', id).select('first_name');
                })
                .then(function (resp) {
                    if (!constid) {
                        expect(resp).to.have.length(1);
                    }
                });

            try {
                await promise;
            } finally {
                await knex.schema.dropTableIfExists('test_schema_transactions');
            }
        });

        it('should resolve with the correct value, #298', function () {
            return knex
                .transaction(function (trx) {
                    trx.debugging = true;
                    return Promise.resolve(null);
                })
                .then(function (result) {
                    expect(result).to.equal(null);
                });
        });

        it('does not reject promise when rolling back a transaction', async () => {
            const trxProvider = knex.transactionProvider();
            const trx = await trxProvider();

            await trx.rollback();
            await trx.executionPromise;
        });

        it('should allow for nested transactions', function () {
            if (/redshift/i.test(knex.client.driverName)) {
                return Promise.resolve();
            }
            return knex.transaction(function (trx) {
                return trx
                    .select('*')
                    .from('accounts')
                    .then(function () {
                        return trx.transaction(function () {
                            return trx.select('*').from('accounts');
                        });
                    });
            });
        });

        it('#2213 - should wait for sibling transactions to finish', function () {

            const first = delay(50);
            const second = first.then(() => delay(50));
            return knex.transaction(function (trx) {
                return Promise.all([
                    trx.transaction(function (trx2) {
                        return first;
                    }),
                    trx.transaction(function (trx3) {
                        return second;
                    }),
                ]);
            });
        });

        it('#2213 - should not evaluate a Transaction container until all previous siblings have completed', async function () {
            if (/redshift/i.test(knex.client.driverName)) {
                return this.skip();
            }

            const TABLE_NAME = 'test_sibling_transaction_order';
            await knex.schema.dropTableIfExists(TABLE_NAME);
            await knex.schema.createTable(TABLE_NAME, function (t) {
                t.string('username');
            });

            await knex.transaction(async function (trx) {
                await Promise.all([
                    trx.transaction(async function (trx1) {
                        // This delay provides `trx2` with an opportunity to run first.
                        await delay(200);
                        await trx1.table(TABLE_NAME).insert({username: 'bob'});
                    }),
                    trx.transaction(async function (trx2) {
                        const rows = await trx2.table(TABLE_NAME);

                        // Even though `trx1` was delayed, `trx2` waited patiently for `trx1`
                        // to finish.  Therefore, `trx2` discovers that there is already 1 row.
                        expect(rows.length).to.equal(1);
                    }),
                ]);
            });
        });

        it('#855 - Query Event should trigger on Transaction Client AND main Client', function () {
            let queryEventTriggered = false;

            knex.once('query', function (queryData) {
                queryEventTriggered = true;
                return queryData;
            });

            function expectQueryEventToHaveBeenTriggered() {
                expect(queryEventTriggered).to.equal(true);
            }

            return knex
                .transaction(function (trx) {
                    trx.select('*').from('accounts').then(trx.commit).catch(trx.rollback);
                })
                .then(expectQueryEventToHaveBeenTriggered)
                .catch(expectQueryEventToHaveBeenTriggered);
        });

        it('Rollback without an error should not reject with undefined #1966', function () {
            return knex
                .transaction(function (tr) {
                    tr.rollback();
                })
                .then(function () {
                    expect(true).to.equal(false, 'Transaction should not have commited');
                })
                .catch(function (error) {
                    expect(error instanceof Error).to.equal(true);
                    expect(error.message).to.equal(
                        'Transaction rejected with non-error: undefined'
                    );
                });
        });

        it('#1052 - transaction promise mutating', function () {
            const transactionReturning = knex.transaction(function (trx) {
                return trx
                    .insert({
                        first_name: 'foo',
                        last_name: 'baz',
                        email: 'fbaz@example.com',
                        logins: 1,
                        about: 'Lorem ipsum Dolore labore incididunt enim.',
                        created_at: new Date(),
                        updated_at: new Date(),
                    })
                    .into('accounts');
            });

            return Promise.all([transactionReturning, transactionReturning]).then(
                ([ret1, ret2]) => {
                    expect(ret1).to.equal(ret2);
                }
            );
        });

        it('connection should contain __knexTxId which is also exposed in query event', function () {
            return knex.transaction(function (trx) {
                const builder = trx.select().from('accounts');

                trx.on('query', function (obj) {
                    expect(typeof obj.__knexTxId).to.equal(typeof '');
                });

                builder.on('query', function (obj) {
                    expect(typeof obj.__knexTxId).to.equal(typeof '');
                });

                return builder;
            });
        });
    });

    it('handles promise rejections in nested Transactions (#3706)', async function () {
        const fn = sinon.stub();
        process.on('unhandledRejection', fn);
        try {
            await knex.transaction(async function (trx1) {
                // These two lines together will cause the underlying Transaction
                // to be rejected.  Prior to #3706, this rejection would be unhandled.
                const trx2 = await trx1.transaction(undefined, {
                    doNotRejectOnRollback: false,
                });
                await trx2.rollback();

                await expect(trx2.executionPromise).to.have.been.rejected;
            });

            expect(fn).have.not.been.called;
        } finally {
            process.removeListener('unhandledRejection', fn);
        }
    });

    context('when a `connection` is passed in explicitly', function () {
        beforeEach(function () {
            this.sandbox = sinon.createSandbox();
        });

        afterEach(function () {
            this.sandbox.restore();
        });
    });
};
