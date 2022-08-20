'use strict';

module.exports = function (knex) {
    describe('Aggregate', function () {
        it('has a sum', async () => {
            await knex.schema.dropTableIfExists('accounts')
            await knex.schema.createTableIfNotExists('accounts', (t) => {
                t.increments('id')
                t.integer('logins')
                t.integer('balance').defaultTo(0)
            })
            await knex.table('accounts').insert([
                {logins: 1},
                {logins: 3},
                {logins: 1},
                {logins: 1},
                {logins: 2},
                {logins: 2},
            ])

            return knex.table('accounts')
                .sum('logins')
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'select sum(`logins`) from `accounts`',
                        [],
                        [{'sum(`logins`)': 10,},]
                    );
                });
        });

        it('supports sum with an alias', function () {
            return knex.table('accounts')
                .sum('logins', {as: 'login_sum'})
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'select sum(`logins`) as `login_sum` from `accounts`',
                        [],
                        [{login_sum: 10,}]
                    );
                });
        });

        it('supports sum through object containing multiple aliases', function () {
            return knex.table('accounts')
                .sum({login_sum: 'logins', balance_sum: 'balance'})
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'select sum(`logins`) as `login_sum`, sum(`balance`) as `balance_sum` from `accounts`',
                        [],
                        [{balance_sum: 0, login_sum: 10,},]
                    );
                });
        });

        it('has an avg', function () {
            return knex.table('accounts')
                .avg('logins')
                .testSql(function (tester) {
                    const checkResRange = (key, resp) => 1;
                    tester(
                        'sqlite3',
                        'select avg(`logins`) from `accounts`',
                        [],
                        checkResRange.bind(null, 'avg(`logins`)')
                    );
                });
        });

        it('has a count', function () {
            return knex.table('accounts')
                .count('id')
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'select count(`id`) from `accounts`',
                        [],
                        [{'count(`id`)': 6,}]
                    );
                });
        });

        it('supports multiple aggregate functions', function () {
            return knex.table('accounts')
                .count('id')
                .max('logins')
                .min('logins')
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'select count(`id`), max(`logins`), min(`logins`) from `accounts`',
                        [],
                        [{'count(`id`)': 6, 'max(`logins`)': 3, 'min(`logins`)': 1,},]
                    );
                });
        });

        it('has distinct modifier for aggregates', function () {
            return knex.table('accounts')
                .countDistinct('id')
                .sumDistinct('logins')
                .avgDistinct('logins')
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'select count(distinct `id`), sum(distinct `logins`), avg(distinct `logins`) from `accounts`',
                        [],
                        [
                            {
                                'count(distinct `id`)': 6,
                                'sum(distinct `logins`)': 6,
                                'avg(distinct `logins`)': 2,
                            },
                        ]
                    );
                });
        });

        it('support the groupBy function', function () {
            return knex.table('accounts')
                .count('id')
                .groupBy('logins')
                .orderBy('logins', 'asc')
                .testSql(function (tester) {
                    tester(
                        'sqlite3',
                        'select count(`id`) from `accounts` group by `logins` order by `logins` asc',
                        [],
                        [
                            {'count(`id`)': 3,},
                            {'count(`id`)': 2,},
                            {'count(`id`)': 1,},
                        ]
                    );
                })
        });
    });
};
