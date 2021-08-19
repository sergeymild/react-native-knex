/*eslint no-var:0, max-len:0 */
'use strict';

const {expect} = require('chai');

const Knex = require('../../../knex');
const _ = require('lodash');
const delay = require('../../../lib/util/delay');

module.exports = function (knex) {
    describe('Additional', function () {
        it('should truncate a table with truncate', async function () {
            await knex.schema.dropTableIfExists('test_table_two')
            await knex.schema.createTableIfNotExists('test_table_two', (t) => {
                t.increments('id')
                t.integer('account_id')
                t.boolean('status')
            })

            return knex.table('test_table_two')
                .truncate()
                .testSql(function (tester) {
                    tester('sqlite3', 'delete from `test_table_two`');
                })
                .then(() => {
                    return knex.table('test_table_two')
                        .select('*')
                        .then((resp) => {
                            expect(resp).to.have.length(0);
                        });
                })
                .then(() => {
                    return knex.table('test_table_two')
                        .insert({status: 1})
                        .then((res) => {
                            return knex.table('test_table_two')
                                .select('id')
                                .first()
                                .then((res) => {
                                    expect(res).to.be.an('object');
                                    expect(res.id).to.equal(1);
                                });
                        });
                });
        });

        it('should allow raw queries directly with `knex.raw`', function () {
            const tables = {
                sqlite3: "SELECT name FROM sqlite_master WHERE type='table';",
            };
            return knex
                .raw(tables[knex.client.driverName])
                .testSql(function (tester) {
                    tester(knex.client.driverName, tables[knex.client.driverName]);
                });
        });

        it('should allow using the primary table as a raw statement', function () {
            expect(knex.table(knex.raw('raw_table_name')).toQuery()).to.equal(
                'select * from raw_table_name'
            );
        });

        it('should allow using .fn-methods to create raw statements', function () {
            expect(knex.fn.now().prototype === knex.raw().prototype);
            expect(knex.fn.now().toQuery()).to.equal('CURRENT_TIMESTAMP');
            expect(knex.fn.now(6).toQuery()).to.equal('CURRENT_TIMESTAMP(6)');
        });

        it('gets the columnInfo', async function () {
            await knex.schema.dropTableIfExists('datatype_test')
            await knex.schema.createTableIfNotExists('datatype_test', (t) => {
                t.enum('enum_value', ['one', 'two'])
                t.uuid('uuid').notNullable()
            })
            return knex.table('datatype_test')
                .columnInfo()
                .testSql(function (tester) {
                    tester('sqlite3', 'PRAGMA table_info(`datatype_test`)', [], {
                        enum_value: {
                            defaultValue: null,
                            maxLength: null,
                            nullable: true,
                            type: 'text',
                        },
                        uuid: {
                            defaultValue: null,
                            maxLength: '36',
                            nullable: false,
                            type: 'char',
                        },
                    });
                });
        });

        it('gets the columnInfo with columntype', function () {
            return knex.table('datatype_test')
                .columnInfo('uuid')
                .testSql(function (tester) {
                    tester('sqlite3', 'PRAGMA table_info(`datatype_test`)', [], {
                        defaultValue: null,
                        maxLength: '36',
                        nullable: false,
                        type: 'char',
                    });
                });
        });

        it('#2184 - should properly escape table name for SQLite columnInfo', function () {
            if (knex.client.driverName !== 'sqlite3') {
                return this.skip();
            }

            return knex.schema
                .dropTableIfExists('group')
                .then(function () {
                    return knex.schema.createTable('group', function (table) {
                        table.integer('foo');
                    });
                })
                .then(function () {
                    return knex.table('group').columnInfo();
                })
                .then(function (columnInfo) {
                    expect(columnInfo).to.deep.equal({
                        foo: {
                            type: 'integer',
                            maxLength: null,
                            nullable: true,
                            defaultValue: null,
                        },
                    });
                });
        });


        it('should allow renaming a column', async function () {
            await knex.schema.dropTable('accounts')
            await knex.schema.createTable('accounts', (t) => {
                t.increments('id')
                t.string('first_name')
                t.string('last_name')
                t.string('email')
                t.string('about')
            })
            const countColumn = 'count(*)';
            let count;
            const inserts = [];
            _.times(10, function (i) {
                inserts.push({
                    email: 'email' + i,
                    first_name: 'Test',
                    last_name: 'Data',
                    about: 'some'
                });
            });
            return knex.table('accounts')
                .insert(inserts)
                .then(() => knex.count('*').from('accounts'))
                .then(function (resp) {
                    count = resp[0][countColumn];
                    return knex.schema
                        .table('accounts', function (t) {
                            t.renameColumn('about', 'about_col');
                        })
                        .testSql(function (tester) {
                            tester('sqlite3', ['PRAGMA table_info(`accounts`)']);
                        });
                })
                .then(function () {
                    return knex.count('*').from('accounts');
                })
                .then(function (resp) {
                    expect(resp[0][countColumn]).to.equal(count);
                })
                .then(function () {
                    return knex.table('accounts').select('about_col');
                })
                .then(function () {
                    return knex.schema.table('accounts', function (t) {
                        t.renameColumn('about_col', 'about');
                    });
                })
                .then(function () {
                    return knex.count('*').from('accounts');
                })
                .then(function (resp) {
                    expect(resp[0][countColumn]).to.equal(count);
                });
        });

        it('should allow dropping a column', function () {
            const countColumn = 'count(*)';
            let count;
            return knex
                .count('*')
                .from('accounts')
                .then(function (resp) {
                    count = resp[0][countColumn];
                })
                .then(function () {
                    return knex.schema
                        .table('accounts', function (t) {
                            t.dropColumn('first_name');
                        })
                        .testSql(function (tester) {
                            tester('sqlite3', ['PRAGMA table_info(`accounts`)']);
                        });
                })
                .then(function () {
                    return knex.select('*').from('accounts').first();
                })
                .then(function (resp) {
                    expect(_.keys(resp).sort()).to.eql([
                        'about',
                        'email',
                        'id',
                        'last_name',
                    ]);
                })
                .then(function () {
                    return knex.count('*').from('accounts');
                })
                .then(function (resp) {
                    expect(resp[0][countColumn]).to.equal(count);
                });
        });


        it('Event: query-response', function () {
            let queryCount = 0;

            const onQueryResponse = function (response, obj, builder) {
                queryCount++;
                expect(response).to.be.an('array');
                expect(obj).to.be.an('object');
                expect(obj.__knexUid).to.be.a('string');
                expect(obj.__knexQueryUid).to.be.a('string');
                expect(builder).to.be.an('object');
            };
            knex.on('query-response', onQueryResponse);

            return knex.table('accounts')
                .select()
                .on('query-response', onQueryResponse)
                .then(function () {
                    return knex.transaction(function (tr) {
                        return tr.table('accounts')
                            .select()
                            .on('query-response', onQueryResponse); //Transactions should emit the event as well
                    });
                })
                .then(function () {
                    knex.removeListener('query-response', onQueryResponse);
                    expect(queryCount).to.equal(4);
                });
        });

        it('Event: query-error', function () {
            let queryCountKnex = 0;
            let queryCountBuilder = 0;
            const onQueryErrorKnex = function (error, obj) {
                queryCountKnex++;
                expect(obj).to.be.an('object');
                expect(obj.__knexUid).to.be.a('string');
                expect(obj.__knexQueryUid).to.be.a('string');
                expect(error).to.be.an('error');
            };

            const onQueryErrorBuilder = function (error, obj) {
                queryCountBuilder++;
                expect(obj).to.be.an('object');
                expect(obj.__knexUid).to.be.a('string');
                expect(obj.__knexQueryUid).to.be.a('string');
                expect(error).to.be.an('error');
            };

            knex.on('query-error', onQueryErrorKnex);

            return knex
                .raw('Broken query')
                .on('query-error', onQueryErrorBuilder)
                .then(function () {
                    expect(true).to.equal(false); //Should not be resolved
                })
                .catch(function () {
                    knex.removeListener('query-error', onQueryErrorKnex);
                    knex.removeListener('query-error', onQueryErrorBuilder);
                    expect(queryCountBuilder).to.equal(1);
                });
        });

        it('Event: start', function () {
            return knex.table('accounts')
                .insert({last_name: 'Start event test'})
                .then(function () {
                    const queryBuilder = knex.table('accounts').select();

                    queryBuilder.on('start', function (builder) {
                        //Alter builder prior to compilation
                        //Select only one row
                        builder.where('last_name', 'Start event test').first();
                    });

                    return queryBuilder;
                })
                .then(function (row) {
                    expect(row).to.exist;
                    expect(row.last_name).to.equal('Start event test');
                });
        });

        it("Event 'query' should not emit native sql string", function () {
            const builder = knex.table('accounts').where('id', 1).select();

            builder.on('query', function (obj) {
                const native = builder.toSQL().toNative().sql;
                const sql = builder.toSQL().sql;

                //Only assert if they diff to begin with.
                //IE Maria does not diff
                if (native !== sql) {
                    expect(obj.sql).to.not.equal(builder.toSQL().toNative().sql);
                    expect(obj.sql).to.equal(builder.toSQL().sql);
                }
            });

            return builder;
        });

        describe('async stack traces', function () {
            before(() => {
                knex.client.config.asyncStackTraces = true;
            });
            after(() => {
                delete knex.client.config.asyncStackTraces;
            });
            it('should capture stack trace on raw query', () => {
                return knex.raw('select * from some_nonexisten_table').catch((err) => {
                    expect(err.stack.split('\n')[1]).to.equal('SQLITE_ERROR: no such table: some_nonexisten_table'); // the index 2 might need adjustment if the code is refactored
                });
            });
            it('should capture stack trace on schema builder', () => {
                return knex.schema
                    .renameTable('some_nonexisten_table', 'whatever')
                    .catch((err) => {
                        expect(err.stack.split('\n')[1]).to.equal('SQLITE_ERROR: no such table: some_nonexisten_table'); // the index 1 might need adjustment if the code is refactored
                    });
            });
        });
    });
};
