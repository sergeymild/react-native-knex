'use strict';
const {expect} = require('chai');

module.exports = function (knex) {
    describe('sqlite3 - transactions', () => {
        beforeEach(async () => {
            await knex.schema.dropTableIfExists('test_table')
            await knex.schema.createTable('test_table', function (table) {
                table.integer('id');
                table.string('name');
            })
        })

        afterEach(async () => {
            await knex.schema.dropTableIfExists('test_table')
        })

        it('has a dropTableIfExists method', async function () {
            await knex.transaction((trx) =>
                trx.table('test_table').insert({id: 1, name: 'A'})
            );
            const results = await knex.table('test_table').select('*');
            expect(results.length).to.equal(1)
        })

        it('transaction rollback on returned rejected promise', async function () {
            await knex.table('test_table').delete()
            const testError = new Error('Not inserting');
            let trxQueryCount = 0;
            let trxRejected;
            try {
                await knex
                    .transaction(function (trx) {
                        return trx
                            .table('test_table')
                            .insert({id: 1, name: 'B'})
                            .then(function () {
                                throw testError;
                            });
                    })
                    .on('query', function () {
                        ++trxQueryCount;
                    });
            } catch (err) {
                expect(err.message).to.equal('Not inserting')
                trxRejected = true;
            } finally {
                // BEGIN, INSERT, ROLLBACK
                // oracle & mssql: BEGIN & ROLLBACK not reported as queries
                const expectedQueryCount = 3

                expect(trxQueryCount).to.equal(expectedQueryCount)
                expect(trxRejected).to.equal(true)
                const results = await knex.table('test_table').select('*');
                expect(results.length).to.equal(0)
            }
        })

        it('transaction rollback on error throw', async function () {
            const testError = new Error('Boo!!!');
            let trxQueryCount = 0;
            let trxRejected;
            try {
                await knex
                    .transaction(() => {throw testError})
                    .on('query', () => ++trxQueryCount);
            } catch (err) {
                expect(err).to.equal(testError)
                trxRejected = true;
            } finally {
                // BEGIN, ROLLBACK
                // oracle & mssql: BEGIN & ROLLBACK not reported as queries
                const expectedQueryCount = 2

                expect(trxQueryCount).to.equal(expectedQueryCount)
                expect(trxRejected).to.equal(true)
            }
        });

        it('transaction savepoint rollback on returned rejected promise', async function () {
            await knex.table('test_table').delete()
            const testError = new Error('Rolling Back Savepoint');
            let trx1QueryCount = 0;
            let trx2QueryCount = 0;
            let trx2Rejected = false;
            try {
                await knex
                    .transaction(function (trx1) {
                        return trx1
                            .table('test_table')
                            .insert({ id: 1, name: 'A' })
                            .then(function () {
                                // Nested transaction (savepoint)
                                return trx1
                                    .transaction(function (trx2) {
                                        // Insert and then roll back to savepoint
                                        return trx2
                                            .table('test_table')
                                            .insert({ id: 2, name: 'B' })
                                            .then(function () {
                                                return trx2.table('test_table')
                                                    .then((results) => {expect(results.length).to.equal(2)})
                                                    .then(() => {throw testError;});
                                            });
                                    })
                                    .on('query', () => {++trx2QueryCount;});
                            })
                            .catch(function (err) {
                                expect(err).to.equal(testError)
                                trx2Rejected = true;
                            });
                    })
                    .on('query', function () {
                        ++trx1QueryCount;
                    });
            } finally {
                // trx1: BEGIN, INSERT, ROLLBACK
                // trx2: SAVEPOINT, INSERT, SELECT, ROLLBACK TO SAVEPOINT
                // oracle & mssql: BEGIN & ROLLBACK not reported as queries
                let expectedTrx1QueryCount = 3
                const expectedTrx2QueryCount = 4;
                expectedTrx1QueryCount += expectedTrx2QueryCount;
                expect(trx1QueryCount).to.equal(expectedTrx1QueryCount)
                expect(trx2QueryCount).to.equal(expectedTrx2QueryCount)
                expect(trx2Rejected).to.equal(true)

                const results = await knex.table('test_table').select('*');
                expect(results.length).to.equal(1)
            }
        });

        it('transaction savepoint rollback on error throw', async function () {
            const testError = new Error('Rolling Back Savepoint');
            let trx1QueryCount = 0;
            let trx2QueryCount = 0;
            let trx2Rejected = false;
            try {
                await knex
                    .transaction(function (trx1) {
                        return trx1
                            .table('test_table')
                            .insert({ id: 1, name: 'A' })
                            .then(function () {
                                // Nested transaction (savepoint)
                                return trx1
                                    .transaction(function () {
                                        // trx2
                                        // Roll back to savepoint
                                        throw testError;
                                    })
                                    .on('query', function () {
                                        ++trx2QueryCount;
                                    });
                            })
                            .catch(function (err) {
                                expect(err).to.equal(testError)
                                trx2Rejected = true;
                            });
                    })
                    .on('query', function () {
                        ++trx1QueryCount;
                    });
            } finally {
                // trx1: BEGIN, INSERT, ROLLBACK
                // trx2: SAVEPOINT, ROLLBACK TO SAVEPOINT
                // oracle & mssql: BEGIN & ROLLBACK not reported as queries
                let expectedTrx1QueryCount = 3
                const expectedTrx2QueryCount = 2;
                expectedTrx1QueryCount += expectedTrx2QueryCount;
                expect(trx1QueryCount).to.equal(expectedTrx1QueryCount)
                expect(trx2QueryCount).to.equal(expectedTrx2QueryCount)
                expect(trx2Rejected).to.equal(true)

                const results = await knex.table('test_table').select('*');
                expect(results.length).to.equal(1)
            }
        });

        it('sibling nested transactions - second created after first one commits', async function () {
            let secondTransactionCompleted = false;
            try {
                await knex.transaction(function (trx) {
                    return trx
                        .transaction(function (trx1) {
                            return trx1
                                .table('test_table')
                                .insert({ id: 1, name: 'A' })
                                .then(function () {
                                    return trx1.table('test_table').insert({ id: 2, name: 'B' });
                                });
                        })
                        .then(function () {
                            return trx.transaction(function (trx2) {
                                return trx2.table('test_table').then(function (results) {
                                    secondTransactionCompleted = true;
                                    expect(results.length).to.equal(2)
                                });
                            });
                        });
                });
            } finally {
                expect(secondTransactionCompleted).to.equal(true)
            }
        });

        it('sibling nested transactions - both chained sibling transactions committed', async function () {
            try {
                await knex.transaction(function (trx) {
                    return trx
                        .transaction(function (trx1) {
                            return trx1.table('test_table').insert({ id: 1, name: 'A' });
                        })
                        .then(function () {
                            return trx.transaction(function (trx2) {
                                return trx2.table('test_table').insert({ id: 2, name: 'B' });
                            });
                        });
                });
            } finally {
                const results = await knex.table('test_table');
                expect(results.length).to.eql(2)
            }
        });

        it('sibling nested transactions - second created after first one rolls back by returning a rejected promise', async function () {
            let secondTransactionCompleted = false;
            try {
                await knex.transaction(function (trx) {
                    return trx
                        .transaction(function (trx1) {
                            return trx1
                                .table('test_table')
                                .insert({ id: 1, name: 'A' })
                                .then(function () {
                                    throw new Error('test rollback');
                                });
                        })
                        .catch(function (err) {
                            expect(err.message).to.equal('test rollback')
                            return trx.transaction(function (trx2) {
                                return trx2.table('test_table').then(function () {
                                    secondTransactionCompleted = true;
                                });
                            });
                        });
                });
            } finally {
                expect(secondTransactionCompleted).to.equal(true)
            }
        });

        it('sibling nested transactions - second commits data after first one rolls back by returning a rejected promise', async () => {
            try {
                await knex.transaction(function (trx) {
                    return trx
                        .transaction(async function (trx1) {
                            await trx1.table('test_table').insert({ id: 1, name: 'A' });
                            throw new Error('test rollback');
                        })
                        .catch(function (err) {
                            expect(err.message).to.eql('test rollback')
                            return trx.transaction(function (trx2) {
                                return trx2
                                    .table('test_table')
                                    .insert([
                                        { id: 2, name: 'B' },
                                        { id: 3, name: 'C' },
                                    ]);
                            });
                        });
                });
            } finally {
                const results = await knex.table('test_table');
                expect(results.length).to.eql(2)
            }
        });

        it('sibling nested transactions - second created after first one rolls back by throwing', async function () {
            let secondTransactionCompleted = false;
            try {
                await knex.transaction(function (trx) {
                    return trx
                        .transaction(function () {
                            throw new Error('test rollback');
                        })
                        .catch(function (err) {
                            expect(err.message).to.eql('test rollback')
                            return trx.transaction(function (trx2) {
                                return trx2.table('test_table').then(function () {
                                    secondTransactionCompleted = true;
                                });
                            });
                        });
                });
            } finally {
                expect(secondTransactionCompleted).to.eql(true)
            }
        });

        it('sibling nested transactions - second commits data after first one rolls back by throwing', async function () {
            try {
                await knex.transaction(function (trx) {
                    return trx
                        .transaction(function () {
                            throw new Error('test rollback');
                        })
                        .catch(function (err) {
                            expect(err.message).to.eql('test rollback')
                            return trx.transaction(function (trx2) {
                                return trx2.table('test_table').insert([{ id: 1, name: 'A' }]);
                            });
                        });
                });
            } finally {
                const results = await knex.table('test_table');
                expect(results.length).to.eql(1)
            }
        });

        it('sibling nested transactions - first commits data even though second one rolls back by returning a rejected promise', async () => {
            let secondTransactionCompleted = false;
            try {
                await knex.transaction(function (trx) {
                    return trx
                        .transaction(function (trx1) {
                            return trx1.table('test_table').insert({ id: 1, name: 'A' });
                        })
                        .then(function () {
                            return trx
                                .transaction(function (trx2) {
                                    return trx2
                                        .table('test_table')
                                        .insert([
                                            { id: 2, name: 'B' },
                                            { id: 3, name: 'C' },
                                        ])
                                        .then(function () {
                                            secondTransactionCompleted = true;
                                            throw new Error('test rollback');
                                        });
                                })
                                .catch(function () {});
                        });
                });
            } finally {
                expect(secondTransactionCompleted).to.eql(true)
                const results = await knex.table('test_table');
                expect(results.length).to.eql(1)
            }
        });

        it('sibling nested transactions - first commits data even though second one rolls back by throwing', async () => {
            let secondTransactionCompleted = false;
            try {
                await knex.transaction(function (trx) {
                    return trx
                        .transaction(function (trx1) {
                            return trx1.table('test_table').insert({ id: 1, name: 'A' });
                        })
                        .then(function () {
                            return trx
                                .transaction(function () {
                                    secondTransactionCompleted = true;
                                    throw new Error('test rollback');
                                })
                                .catch(function () {});
                        });
                });
            } finally {
                expect(secondTransactionCompleted).to.eql(true)
                const results = await knex.table('test_table');
                expect(results.length).to.eql(1)
            }
        });

        it('#785 - skipping extra transaction statements after commit / rollback', async function () {
            let queryCount = 0;

            try {
                await knex
                    .transaction(function (trx) {
                        knex.table('test_table')
                            .transacting(trx)
                            .insert({ id: 2, name: 'Inserted before rollback called.' })
                            .then(function () {
                                trx.rollback(new Error('Rolled back'));
                            })
                            .then(function () {
                                return knex.table('test_table')
                                    .transacting(trx)
                                    .insert({ name: 'Inserted after rollback called.' })
                                    .then(function (resp) {
                                        t.error(resp);
                                    })
                                    .catch(function () {});
                            });
                    })
                    .on('query', function () {
                        queryCount++;
                    });
            } catch (err) {
                expect(err.message).to.equal('Rolled back')
            } finally {
                // oracle & mssql: BEGIN & ROLLBACK not reported as queries
                const expectedQueryCount = 3
                expect(queryCount).to.equal(expectedQueryCount)
            }
        });

        it('#805 - nested ddl transaction', async function () {
            try {
                await knex.transaction(function (knex) {
                    return knex.transaction(function (trx) {
                        return trx.schema.createTable('ages', function (t) {
                            t.increments('id').primary();
                            t.string('name').unique().notNull();
                        });
                    });
                });
            } finally {
                await knex.schema.dropTableIfExists('ages');
            }
        });

        it('transaction savepoint do not rollback when instructed', async function () {
            let trx1QueryCount = 0;
            let trx2QueryCount = 0;
            let trx2Rejected = false;

            try {
                await knex
                    .transaction(function (trx1) {
                        return trx1
                            .table('test_table')
                            .insert({ id: 1, name: 'A' })
                            .then(function () {
                                // Nested transaction (savepoint)
                                return trx1
                                    .transaction(
                                        function (trx2) {
                                            return trx2.rollback();
                                        },
                                        { doNotRejectOnRollback: true }
                                    )
                                    .on('query', function () {
                                        ++trx2QueryCount;
                                    });
                            })
                            .then(function () {
                                trx2Rejected = true;
                            });
                    })
                    .on('query', function () {
                        ++trx1QueryCount;
                    });
            } finally {
                // trx1: BEGIN, INSERT, ROLLBACK
                // trx2: SAVEPOINT, ROLLBACK TO SAVEPOINT
                // oracle & mssql: BEGIN & ROLLBACK not reported as queries
                let expectedTrx1QueryCount = 3
                const expectedTrx2QueryCount = 2;
                expectedTrx1QueryCount += expectedTrx2QueryCount;
                expect(trx1QueryCount).to.eql(expectedTrx1QueryCount)
                expect(trx2QueryCount).to.eql(expectedTrx2QueryCount)
                expect(trx2Rejected).to.eql(true)

                const results = await knex.table('test_table').select('*');
                expect(results.length).to.eql(1)
            }
        });
    })
};
