'use strict';

const {expect} = require('chai');

const _ = require('lodash');
const sinon = require('sinon');

const {TEST_TIMESTAMP} = require('../../util/constants');

module.exports = function (knex) {
    describe('Inserts', function () {
        it('should handle simple inserts', async function () {
            await knex.schema.dropTableIfExists('accounts')
            await knex.schema.createTableIfNotExists('accounts', (t) => {
                t.string('first_name')
                t.string('last_name')
                t.string('email')
                t.boolean('logins')
                t.text('about')
                t.timestamp('created_at')
                t.timestamp('updated_at')
            })
            const q = knex.table('accounts')
                .insert(
                    {
                        first_name: 'Test',
                        last_name: 'User',
                        email: 'test@example.com',
                        logins: 1,
                        about: 'Lorem ipsum Dolore labore incididunt enim.',
                        created_at: TEST_TIMESTAMP,
                        updated_at: TEST_TIMESTAMP,
                    },
                    'id'
                )
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?)',
                        [
                            'Lorem ipsum Dolore labore incididunt enim.',
                            TEST_TIMESTAMP,
                            'test@example.com',
                            'Test',
                            'User',
                            1,
                            TEST_TIMESTAMP,
                        ],
                        [1]
                    );
                });
            return q
        });

        it('should handle multi inserts', function () {
            return knex.table('accounts')
                .insert(
                    [
                        {
                            first_name: 'Test',
                            last_name: 'User',
                            email: 'test2@example.com',
                            logins: 1,
                            about: 'Lorem ipsum Dolore labore incididunt enim.',
                            created_at: TEST_TIMESTAMP,
                            updated_at: TEST_TIMESTAMP,
                        },
                        {
                            first_name: 'Test',
                            last_name: 'User',
                            email: 'test3@example.com',
                            about: 'Lorem ipsum Dolore labore incididunt enim.',
                            logins: 2,
                            created_at: TEST_TIMESTAMP,
                            updated_at: TEST_TIMESTAMP,
                        },
                    ],
                    'id'
                )
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)',
                        [
                            'Lorem ipsum Dolore labore incididunt enim.',
                            TEST_TIMESTAMP,
                            'test2@example.com',
                            'Test',
                            'User',
                            1,
                            TEST_TIMESTAMP,
                            'Lorem ipsum Dolore labore incididunt enim.',
                            TEST_TIMESTAMP,
                            'test3@example.com',
                            'Test',
                            'User',
                            2,
                            TEST_TIMESTAMP,
                        ],
                        [3]
                    );
                });
        });


        it('should take hashes passed into insert and keep them in the correct order', function () {
            return knex.table('accounts')
                .insert(
                    [
                        {
                            first_name: 'Test',
                            last_name: 'User',
                            email: 'test4@example.com',
                            about: 'Lorem ipsum Dolore labore incididunt enim.',
                            logins: 2,
                            created_at: TEST_TIMESTAMP,
                            updated_at: TEST_TIMESTAMP,
                        },
                        {
                            first_name: 'Test',
                            about: 'Lorem ipsum Dolore labore incididunt enim.',
                            logins: 2,
                            created_at: TEST_TIMESTAMP,
                            updated_at: TEST_TIMESTAMP,
                            last_name: 'User',
                            email: 'test5@example.com',
                        },
                    ],
                    'id'
                )
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)',
                        [
                            'Lorem ipsum Dolore labore incididunt enim.',
                            TEST_TIMESTAMP,
                            'test4@example.com',
                            'Test',
                            'User',
                            2,
                            TEST_TIMESTAMP,
                            'Lorem ipsum Dolore labore incididunt enim.',
                            TEST_TIMESTAMP,
                            'test5@example.com',
                            'Test',
                            'User',
                            2,
                            TEST_TIMESTAMP,
                        ],
                        [5]
                    );
                });
        });

        // it('will fail when multiple inserts are made into a unique column', function () {
        //   return knex.table('accounts')
        //     .where('id', '>', 1)
        //     .orWhere('x', 2)
        //     .insert(
        //       {
        //         first_name: 'Test',
        //         last_name: 'User',
        //         email: 'test5@example.com',
        //         about: 'Lorem ipsum Dolore labore incididunt enim.',
        //         logins: 2,
        //         created_at: TEST_TIMESTAMP,
        //         updated_at: TEST_TIMESTAMP,
        //       },
        //       'id'
        //     )
        //     .testSql(function (tester) {
        //       tester(
        //         'sqlite3',
        //         'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?)',
        //         [
        //           'Lorem ipsum Dolore labore incididunt enim.',
        //           TEST_TIMESTAMP,
        //           'test5@example.com',
        //           'Test',
        //           'User',
        //           2,
        //           TEST_TIMESTAMP,
        //         ]
        //       );
        //     })
        //     .then(
        //       function () {
        //         throw new Error(
        //           'There should be a fail when multi-insert are made in unique col.'
        //         );
        //       },
        //       function () {}
        //     );
        // });

        // it('should drop any where clause bindings', function () {
        //   return knex.table('accounts')
        //     .where('id', '>', 1)
        //     .orWhere('x', 2)
        //     .insert(
        //       {
        //         first_name: 'Test',
        //         last_name: 'User',
        //         email: 'test6@example.com',
        //         about: 'Lorem ipsum Dolore labore incididunt enim.',
        //         logins: 2,
        //         created_at: TEST_TIMESTAMP,
        //         updated_at: TEST_TIMESTAMP,
        //       },
        //       'id'
        //     )
        //     .testSql(function (tester) {
        //       tester(
        //         'sqlite3',
        //         'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?)',
        //         [
        //           'Lorem ipsum Dolore labore incididunt enim.',
        //           TEST_TIMESTAMP,
        //           'test6@example.com',
        //           'Test',
        //           'User',
        //           2,
        //           TEST_TIMESTAMP,
        //         ],
        //         [6]
        //       );
        //     });
        // });

        it('should not allow inserting invalid values into enum fields', async () => {
            // await knex.schema.createTableIfNotExists('datatype_test', (t) => {
            //     t.enu('enum_value', ['a', 'b', 'c'])
            //     t.uuid('uuid')
            // })
            // try {
            //     await knex.table('datatype_test').insert({enum_value: 'd'})
            //         .testSql(function (tester) {
            //             tester('sqlite3', 'insert into `datatype_test` (`enum_value`) values (?)', ['d'], [1]);
            //         })
            // } catch (e) {
            //     expect(e.message).to.equal('insert into `datatype_test` (`enum_value`) values (\'d\')\nSQLITE_CONSTRAINT: CHECK constraint failed: enum_value')
            // }
        });

        it('should not mutate the array passed in', async function () {
            const a = {
                enum_value: 'a',
                uuid: '00419fc1-7eed-442c-9c01-cf757e74b8f0',
            };
            const b = {
                enum_value: 'c',
                uuid: '13ac5acd-c5d7-41a0-8db0-dacf64d0e4e2',
            };
            const x = [a, b];
            await knex.schema.createTableIfNotExists('datatype_test', (t) => {
                t.enum('enum_value', ['a', 'c'])
                t.uuid('uuid')
            })
            knex.table('datatype_test')
                .insert(x)
                .then(function () {
                    expect(x).to.eql([a, b]);
                });
        });

        it('should handle empty inserts', function () {
            return knex.schema
                .createTable('test_default_table', function (qb) {
                    qb.increments().primary();
                    qb.string('string').defaultTo('hello');
                    qb.text('text').nullable();
                })
                .then(function () {
                    return knex.table('test_default_table')
                        .insert({})
                        .testSql(function (tester) {
                            tester(
                                'sqlite3',
                                'insert into `test_default_table` default values',
                                [],
                                [1]
                            );
                        });
                });
        });

        it('should handle empty arrays inserts', function () {
            return knex.schema
                .createTable('test_default_table2', function (qb) {
                    qb.increments().primary();
                    qb.string('string').defaultTo('hello');
                    qb.text('text').nullable();
                })
                .then(function () {
                    return knex.table('test_default_table2')
                        .insert([{}], 'id')
                        .testSql(function (tester) {
                            tester(
                                'sqlite3',
                                'insert into `test_default_table2` default values',
                                [],
                                [1]
                            );
                        });
                });
        });

        describe('batchInsert', function () {
            const fiftyLengthString =
                'rO8F8YrFS6uoivuRiVnwrO8F8YrFS6uoivuRiVnwuoivuRiVnw';
            const items = [];
            const amountOfItems = 3;
            const amountOfColumns = 3;
            for (let i = 0; i < amountOfItems; i++) {
                const item = {};
                for (let x = 0; x < amountOfColumns; x++) {
                    item['Col' + x] = fiftyLengthString;
                }
                items.push(item);
            }

            beforeEach(function () {
                return knex.schema.dropTableIfExists('BatchInsert').then(function () {
                    return knex.schema.createTable('BatchInsert', function (table) {
                        for (let i = 0; i < amountOfColumns; i++) {
                            table.string('Col' + i, 50);
                        }
                    });
                });
            });

            it('#757 - knex.batchInsert(tableName, bulk, chunkSize)', function () {
                this.timeout(30000);
                return knex
                    .batchInsert('BatchInsert', items, 1)
                    .then(function (result) {
                        return knex.table('BatchInsert').select();
                    })
                    .then(function (result) {
                        const count = result.length;
                        expect(count).to.equal(amountOfItems);
                    });
            });

            it('#1880 - Duplicate keys in batchInsert should not throw unhandled exception', async function () {
                this.timeout(10000);

                const fn = sinon.stub();
                process.on('unhandledRejection', fn);
                await knex.schema
                    .dropTableIfExists('batchInsertDuplicateKey')
                    .then(function () {
                        return knex.schema.createTable('batchInsertDuplicateKey', function (
                            table
                        ) {
                            table.string('col');
                            table.primary('col');
                        });
                    })
                    .then(function () {
                        const rows = [{col: 'a'}, {col: 'a'}];
                        return knex.batchInsert(
                            'batchInsertDuplicateKey',
                            rows,
                            rows.length
                        );
                    })
                    .then(function () {
                        expect.fail('Should not reach this point');
                    })
                    .catch(function (error) {
                        //Should reach this point before timeout of 10s
                        expect(error.message.toLowerCase()).to.include(
                            'batchinsertduplicatekey'
                        );
                    });
                expect(fn).have.not.been.called;
                process.removeListener('unhandledRejection', fn);
            });

            it('knex.batchInsert with specified transaction', function () {
                return knex.transaction(function (tr) {
                    knex
                        .batchInsert('BatchInsert', items, 30)
                        .transacting(tr)
                        .then(tr.commit)
                        .catch(tr.rollback);
                });
            });

            it('transaction.batchInsert using specified transaction', function () {
                return knex.transaction(function (tr) {
                    return tr
                        .batchInsert('BatchInsert', items, 30)
                });
            });
        });

        it('should validate batchInsert batchSize parameter', function () {
            //Should not throw, batchSize default
            return knex
                .batchInsert('test', [])
                .then(function () {
                    //Should throw, null not valid
                    return knex.batchInsert('test', [], null);
                })
                .catch(function (error) {
                    expect(error.message).to.equal('Invalid chunkSize: null');

                    //Should throw, 0 is not a valid chunkSize
                    return knex.batchInsert('test', [], 0);
                })
                .catch(function (error) {
                    expect(error.message).to.equal('Invalid chunkSize: 0');

                    //Also faulty
                    return knex.batchInsert('test', [], 'still no good');
                })
                .catch(function (error) {
                    expect(error.message).to.equal('Invalid chunkSize: still no good');

                    return true;
                });
        });

        it('will silently do nothing when multiple inserts are made into a unique column and ignore is specified', async function () {

            // Setup: Create table with unique email column
            await knex.schema.dropTableIfExists('upsert_tests');
            await knex.schema.createTable('upsert_tests', (table) => {
                table.string('name');
                table.string('email');
                table.unique('email');
            });

            // Setup: Create row to conflict against
            await knex.table('upsert_tests').insert({
                email: 'ignoretest@example.com',
                name: 'BEFORE',
            });

            // Test: Insert..ignore with same email as existing row
            try {
                await knex.table('upsert_tests')
                    .insert({email: 'ignoretest@example.com', name: 'AFTER'}, 'email')
                    .onConflict('email')
                    .ignore()
                    .testSql(function (tester) {
                        tester(
                            'sqlite3',
                            'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do nothing',
                            ['ignoretest@example.com', 'AFTER']
                        );
                    });
            } catch (err) {
                throw err;
            }

            // Assert: there is still only 1 row, and that it HAS NOT been updated
            const rows = await knex.table('upsert_tests')
                .where({email: 'ignoretest@example.com'})
                .select();
            expect(rows.length).to.equal(1);
            expect(rows[0].name).to.equal('BEFORE');
        });

        it('will silently do nothing when multiple inserts are made into a composite unique column and ignore is specified', async function () {
            // Setup: Create table with unique email column
            await knex.schema.dropTableIfExists('upsert_composite_key_tests');
            await knex.schema.createTable('upsert_composite_key_tests', (table) => {
                table.string('name');
                table.string('email');
                table.string('org');
                table.unique(['org', 'email']);
            });

            // Setup: Create row to conflict against
            await knex.table('upsert_composite_key_tests').insert({
                org: 'acme-inc',
                email: 'ignoretest@example.com',
                name: 'BEFORE',
            });

            // Test: Insert..ignore with same email as existing row
            try {
                await knex.table('upsert_composite_key_tests')
                    .insert(
                        {org: 'acme-inc', email: 'ignoretest@example.com', name: 'AFTER'},
                        'email'
                    )
                    .onConflict(['org', 'email'])
                    .ignore()
                    .testSql(function (tester) {
                        tester(
                            'sqlite3',
                            'insert into `upsert_composite_key_tests` (`email`, `name`, `org`) values (?, ?, ?) on conflict (`org`, `email`) do nothing',
                            ['ignoretest@example.com', 'AFTER', 'acme-inc']
                        );
                    });
            } catch (err) {
                throw err;
            }

            // Assert: there is still only 1 row, and that it HAS NOT been updated
            const rows = await knex.table('upsert_composite_key_tests')
                .where({email: 'ignoretest@example.com'})
                .select();
            expect(rows.length).to.equal(1);
            expect(rows[0].name).to.equal('BEFORE');
        });

        it('updates columns when inserting a duplicate key to unique column and merge is specified', async function () {
            // Setup: Create table with unique email column
            await knex.schema.dropTableIfExists('upsert_tests');
            await knex.schema.createTable('upsert_tests', (table) => {
                table.string('name');
                table.string('email');
                table.unique('email');
            });

            // Setup: Create row to conflict against
            await knex.table('upsert_tests').insert({
                email: 'mergetest@example.com',
                name: 'BEFORE',
            });

            // Perform insert..merge (upsert)
            try {
                await knex.table('upsert_tests')
                    .insert({email: 'mergetest@example.com', name: 'AFTER'}, 'email')
                    .onConflict('email')
                    .merge()
                    .testSql(function (tester) {
                        tester(
                            'sqlite3',
                            'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name`',
                            ['mergetest@example.com', 'AFTER']
                        );
                    });
            } catch (err) {
                throw err;
            }

            // Check that row HAS been updated
            const rows = await knex.table('upsert_tests')
                .where({email: 'mergetest@example.com'})
                .select();
            expect(rows.length).to.equal(1);
            expect(rows[0].name).to.equal('AFTER');
        });

        it('conditionally updates rows when inserting a duplicate key to unique column and merge with where clause matching row(s) is specified', async function () {
            // Setup: Create table with unique email column
            await knex.schema.dropTableIfExists('upsert_tests');
            await knex.schema.createTable('upsert_tests', (table) => {
                table.string('name');
                table.string('email');
                table.string('role');
                table.unique('email');
            });

            // Setup: Create row to conflict against
            await knex.table('upsert_tests').insert({
                email: 'mergetest@example.com',
                role: 'tester',
                name: 'BEFORE',
            });

            // Perform insert..merge (upsert)
            try {
                await knex.table('upsert_tests')
                    .insert({email: 'mergetest@example.com', name: 'AFTER'}, 'email')
                    .onConflict('email')
                    .merge()
                    .where('upsert_tests.role', 'tester')
                    .testSql(function (tester) {
                        tester(
                            'sqlite3',
                            'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name` where `upsert_tests`.`role` = ?',
                            ['mergetest@example.com', 'AFTER', 'tester']
                        );
                    });
            } catch (err) {
                throw err;
            }

            // Check that row HAS been updated
            const rows = await knex.table('upsert_tests')
                .where({email: 'mergetest@example.com'})
                .select();
            expect(rows.length).to.equal(1);
            expect(rows[0].name).to.equal('AFTER');
        });

        it('will silently do nothing when inserting a duplicate key to unique column and merge with where clause matching no rows is specified', async function () {
            // Setup: Create table with unique email column
            await knex.schema.dropTableIfExists('upsert_tests');
            await knex.schema.createTable('upsert_tests', (table) => {
                table.string('name');
                table.string('email');
                table.string('role');
                table.unique('email');
            });

            // Setup: Create row to conflict against
            await knex.table('upsert_tests').insert({
                email: 'mergetest@example.com',
                role: 'tester',
                name: 'BEFORE',
            });

            // Perform insert..merge (upsert)
            try {
                await knex.table('upsert_tests')
                    .insert({email: 'mergetest@example.com', name: 'AFTER'}, 'email')
                    .onConflict('email')
                    .merge()
                    .where('upsert_tests.role', 'fake-role')
                    .testSql(function (tester) {
                        tester(
                            'sqlite3',
                            'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name` where `upsert_tests`.`role` = ?',
                            ['mergetest@example.com', 'AFTER', 'fake-role']
                        );
                    });
            } catch (err) {
                throw err;
            }

            // Check that row HAS NOT been updated
            const rows = await knex.table('upsert_tests')
                .where({email: 'mergetest@example.com'})
                .select();
            expect(rows.length).to.equal(1);
            expect(rows[0].name).to.equal('BEFORE');
        });

        it('updates columns with raw value when inserting a duplicate key to unique column and merge is specified', async function () {
            // Setup: Create table with unique email column
            await knex.schema.dropTableIfExists('upsert_tests');
            await knex.schema.createTable('upsert_tests', (table) => {
                table.string('name');
                table.string('email');
                table.unique('email');
            });

            // Setup: Create row to conflict against
            await knex.table('upsert_tests').insert([
                {email: 'mergesource@example.com', name: 'SOURCE'},
                {email: 'mergedest@example.com', name: 'DEST'},
            ]);

            // Perform insert..merge (upsert)
            try {
                await knex.table('upsert_tests')
                    .insert(
                        {
                            email: 'mergedest@example.com',
                            name: knex.raw(
                                "(SELECT name FROM (SELECT * FROM upsert_tests) AS t WHERE email = 'mergesource@example.com')"
                            ),
                        },
                        'email'
                    )
                    .onConflict('email')
                    .merge()
                    .testSql(function (tester) {
                        tester(
                            'sqlite3',
                            "insert into `upsert_tests` (`email`, `name`) values (?, (SELECT name FROM (SELECT * FROM upsert_tests) AS t WHERE email = 'mergesource@example.com')) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name`",
                            ['mergedest@example.com']
                        );
                    });
            } catch (err) {
                throw err;
            }

            // Check that row HAS been updated
            const rows = await knex.table('upsert_tests')
                .where({email: 'mergedest@example.com'})
                .select();
            expect(rows.length).to.equal(1);
            expect(rows[0].name).to.equal('SOURCE');
        });

        it('updates columns with raw value when inserting a duplicate key to unique column and merge with updates is specified', async function () {
            // Setup table for testing knex.raw with
            await knex.schema.dropTableIfExists('upsert_value_source');
            await knex.schema.createTable('upsert_value_source', (table) => {
                table.string('name');
            });
            await knex.table('upsert_value_source').insert([{name: 'SOURCE'}]);

            // Setup: Create table with unique email column
            await knex.schema.dropTableIfExists('upsert_tests');
            await knex.schema.createTable('upsert_tests', (table) => {
                table.string('name');
                table.string('email');
                table.unique('email');
            });

            // Setup: Create row to conflict against
            await knex.table('upsert_tests').insert([
                {email: 'mergedest@example.com', name: 'DEST'},
            ]);

            // Perform insert..merge (upsert)
            try {
                await knex.table('upsert_tests')
                    .insert(
                        {email: 'mergedest@example.com', name: 'SHOULD NOT BE USED'},
                        'email'
                    )
                    .onConflict('email')
                    .merge({name: knex.raw('(SELECT name FROM upsert_value_source)')})
                    .testSql(function (tester) {
                        tester(
                            'sqlite3',
                            'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `name` = (SELECT name FROM upsert_value_source)',
                            ['mergedest@example.com', 'SHOULD NOT BE USED']
                        );
                    });
            } catch (err) {
                throw err;
            }

            // Check that row HAS been updated
            const rows = await knex.table('upsert_tests')
                .where({email: 'mergedest@example.com'})
                .select();
            expect(rows.length).to.equal(1);
            expect(rows[0].name).to.equal('SOURCE');
        });

        it('updates and inserts columns when inserting multiple rows merge is specified', async function () {
            // Setup: Create table with unique email column
            await knex.schema.dropTableIfExists('upsert_tests');
            await knex.schema.createTable('upsert_tests', (table) => {
                table.string('name');
                table.string('email');
                table.unique('email');
            });

            // Setup: Create row to conflict against
            await knex.table('upsert_tests').insert([
                {email: 'one@example.com', name: 'BEFORE'},
                {email: 'two@example.com', name: 'BEFORE'},
            ]);

            // Perform insert..merge (upsert)
            try {
                await knex.table('upsert_tests')
                    .insert(
                        [
                            {email: 'two@example.com', name: 'AFTER'},
                            {email: 'three@example.com', name: 'AFTER'},
                        ],
                        'email'
                    )
                    .onConflict('email')
                    .merge()
                    .testSql(function (tester) {
                        tester(
                            'sqlite3',
                            'insert into `upsert_tests` (`email`, `name`) values (?, ?), (?, ?) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name`',
                            ['two@example.com', 'AFTER', 'three@example.com', 'AFTER']
                        );
                    });
            } catch (err) {
                throw err;
            }

            // Check that row HAS been updated
            const rows = await knex.table('upsert_tests').select();
            expect(rows.length).to.equal(3);

            const row1 = rows.find((row) => row.email === 'one@example.com');
            expect(row1 && row1.name).to.equal('BEFORE');
            const row2 = rows.find((row) => row.email === 'two@example.com');
            expect(row2 && row2.name).to.equal('AFTER');
            const row3 = rows.find((row) => row.email === 'three@example.com');
            expect(row3 && row3.name).to.equal('AFTER');
        });
    });
};
