'use strict';

const { expect } = require('chai');

const { TEST_TIMESTAMP } = require('../../util/constants');

module.exports = function (knex) {
  describe('Joins', function () {
    it('uses inner join by default', async function () {
      await knex.schema.dropTableIfExists('test_table_two')
      await knex.schema.createTableIfNotExists('test_table_two', (t) => {
        t.increments('id')
        t.integer('account_id')
        t.boolean('status')
        t.string('details')
      })

      await knex.table('test_table_two').insert({
        details: 'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
        account_id: 1,
      })
      await knex.table('test_table_two').insert({
        details: 'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
        account_id: 2,
      })
      await knex.table('test_table_two').insert({details: '', account_id: 3})

      await knex.schema.dropTableIfExists('accounts')
      await knex.schema.createTableIfNotExists('accounts', (t) => {
        t.increments('id')
        t.string('first_name').nullable()
        t.string('last_name').nullable()
        t.string('email').nullable()
        t.boolean('logins').nullable()
        t.integer('balance').nullable()
        t.string('phone').nullable()
        t.text('about').nullable()
        t.string('details')
        t.timestamp('created_at').nullable()
        t.timestamp('updated_at').nullable()
      })

      await knex.table('accounts').insert([
        {
          id: 1,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
          logins: 1,
          balance: 0,
          about: 'Lorem ipsum Dolore labore incididunt enim.',
          created_at: TEST_TIMESTAMP,
          updated_at: TEST_TIMESTAMP,
          phone: null,
          details:
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
        },
        {
          id: 2,
          first_name: 'Test',
          last_name: 'User',
          email: 'test2@example.com',
          logins: 1,
          balance: 0,
          about: 'Lorem ipsum Dolore labore incididunt enim.',
          created_at: TEST_TIMESTAMP,
          updated_at: TEST_TIMESTAMP,
          phone: null,
          details:
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
        },
        {
          id: 3,
          first_name: 'Test',
          last_name: 'User',
          email: 'test3@example.com',
          logins: 2,
          balance: 0,
          about: 'Lorem ipsum Dolore labore incididunt enim.',
          created_at: TEST_TIMESTAMP,
          updated_at: TEST_TIMESTAMP,
          phone: null,
          details: '',
        },
        {
          id: 4,
          first_name: 'Test',
          last_name: 'User',
          email: 'test4@example.com',
          logins: 2,
          balance: 0,
          about: 'Lorem ipsum Dolore labore incididunt enim.',
          created_at: TEST_TIMESTAMP,
          updated_at: TEST_TIMESTAMP,
          phone: null,
          details: null,
        },
        {
          id: 5,
          first_name: 'Test',
          last_name: 'User',
          email: 'test5@example.com',
          logins: 2,
          balance: 0,
          about: 'Lorem ipsum Dolore labore incididunt enim.',
          created_at: TEST_TIMESTAMP,
          updated_at: TEST_TIMESTAMP,
          phone: null,
          details: null,
        },
        {
          id: 6,
          first_name: 'Test',
          last_name: 'User',
          email: 'test6@example.com',
          logins: 2,
          balance: 0,
          about: 'Lorem ipsum Dolore labore incididunt enim.',
          created_at: TEST_TIMESTAMP,
          updated_at: TEST_TIMESTAMP,
          phone: null,
          details: null,
        },
      ])


      return knex.table('accounts')
        .join('test_table_two', 'accounts.id', '=', 'test_table_two.account_id')
        .select('accounts.*', 'test_table_two.details')
        .orderBy('accounts.id')
        .testSql(function (tester) {
          tester(
            'sqlite3',
            'select `accounts`.*, `test_table_two`.`details` from `accounts` inner join `test_table_two` on `accounts`.`id` = `test_table_two`.`account_id` order by `accounts`.`id` asc',
            [],
            [
              {
                id: 1,
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com',
                logins: 1,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              },
              {
                id: 2,
                first_name: 'Test',
                last_name: 'User',
                email: 'test2@example.com',
                logins: 1,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              },
              {
                id: 3,
                first_name: 'Test',
                last_name: 'User',
                email: 'test3@example.com',
                logins: 2,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                details: '',
              },
            ]
          );
        });
    });

    it('has a leftJoin method parameter to specify the join type', function () {
      return knex.table('accounts')
        .leftJoin(
          'test_table_two',
          'accounts.id',
          '=',
          'test_table_two.account_id'
        )
        .select('accounts.*', 'test_table_two.details')
        .orderBy('accounts.id')
        .testSql(function (tester) {
          tester(
            'sqlite3',
            'select `accounts`.*, `test_table_two`.`details` from `accounts` left join `test_table_two` on `accounts`.`id` = `test_table_two`.`account_id` order by `accounts`.`id` asc',
            [],
            [
              {
                id: 1,
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com',
                logins: 1,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              },
              {
                id: 2,
                first_name: 'Test',
                last_name: 'User',
                email: 'test2@example.com',
                logins: 1,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              },
              {
                id: 3,
                first_name: 'Test',
                last_name: 'User',
                email: 'test3@example.com',
                logins: 2,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                details: '',
              },
              {
                id: 4,
                first_name: 'Test',
                last_name: 'User',
                email: 'test4@example.com',
                logins: 2,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                details: null,
              },
              {
                id: 5,
                first_name: 'Test',
                last_name: 'User',
                email: 'test5@example.com',
                logins: 2,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                details: null,
              },
              {
                id: 6,
                first_name: 'Test',
                last_name: 'User',
                email: 'test6@example.com',
                logins: 2,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                details: null,
              },
            ]
          );
        });
    });

    it('accepts a callback as the second argument for advanced joins', function () {
      return knex.table('accounts')
        .leftJoin('test_table_two', function (join) {
          join.on('accounts.id', '=', 'test_table_two.account_id');
          join.orOn('accounts.email', '=', 'test_table_two.details');
        })
        .select()
        .orderBy('accounts.id')
        .testSql(function (tester) {
          tester(
            'sqlite3',
            'select * from `accounts` left join `test_table_two` on `accounts`.`id` = `test_table_two`.`account_id` or `accounts`.`email` = `test_table_two`.`details` order by `accounts`.`id` asc',
            [],
            [
              {
                id: 1,
                json_data: null,
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com',
                logins: 1,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                account_id: 1,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
                status: null,
              },
              {
                id: 2,
                json_data: null,
                first_name: 'Test',
                last_name: 'User',
                email: 'test2@example.com',
                logins: 1,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                account_id: 2,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
                status: null,
              },

              {
                id: null,
                first_name: 'Test',
                last_name: 'User',
                email: 'test3@example.com',
                logins: 2,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                account_id: 3,
                details: '',
                status: null,
                json_data: null,
              },
              {
                id: null,
                first_name: 'Test',
                last_name: 'User',
                email: 'test5@example.com',
                logins: 2,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                account_id: null,
                details: null,
                status: null,
                json_data: null,
              },
              {
                id: null,
                first_name: 'Test',
                last_name: 'User',
                email: 'test6@example.com',
                logins: 2,
                balance: 0,
                about: 'Lorem ipsum Dolore labore incididunt enim.',
                created_at: TEST_TIMESTAMP,
                updated_at: TEST_TIMESTAMP,
                phone: null,
                account_id: null,
                details: null,
                status: null,
                json_data: null,
              },
            ]
          );
        });
    });

    it('supports join aliases', function () {
      //Expected output: all pairs of account emails, excluding pairs where the emails are the same.
      return knex.table('accounts')
        .join('accounts as a2', 'a2.email', '<>', 'accounts.email')
        .select(['accounts.email as e1', 'a2.email as e2'])
        .where('a2.email', 'test2@example.com')
        .orderBy('e1')
        .limit(5)
        .testSql(function (tester) {
          tester(
            'sqlite3',
            'select `accounts`.`email` as `e1`, `a2`.`email` as `e2` from `accounts` inner join `accounts` as `a2` on `a2`.`email` <> `accounts`.`email` where `a2`.`email` = ? order by `e1` asc limit ?',
            ['test2@example.com', 5],
            [
              {
                e1: 'test3@example.com',
                e2: 'test2@example.com',
              },
              {
                e1: 'test4@example.com',
                e2: 'test2@example.com',
              },
              {
                e1: 'test5@example.com',
                e2: 'test2@example.com',
              },
              {
                e1: 'test6@example.com',
                e2: 'test2@example.com',
              },
              {
                e1: 'test@example.com',
                e2: 'test2@example.com',
              },
            ]
          );
        });
    });

    it('supports join aliases with advanced joins', function () {
      //Expected output: all pairs of account emails, excluding pairs where the emails are the same.
      //But also include the case where the emails are the same, for account 2.
      return knex.table('accounts')
        .join('accounts as a2', function () {
          this.on('accounts.email', '<>', 'a2.email').orOn('accounts.id', '=', 2);
        })
        .where('a2.email', 'test2@example.com')
        .select(['accounts.email as e1', 'a2.email as e2'])
        .limit(5)
        .orderBy('e1')
        .testSql(function (tester) {
          tester(
            'sqlite3',
            'select `accounts`.`email` as `e1`, `a2`.`email` as `e2` from `accounts` inner join `accounts` as `a2` on `accounts`.`email` <> `a2`.`email` or `accounts`.`id` = 2 where `a2`.`email` = ? order by `e1` asc limit ?',
            ['test2@example.com', 5],
            [
              {
                e1: 'test2@example.com',
                e2: 'test2@example.com',
              },
              {
                e1: 'test3@example.com',
                e2: 'test2@example.com',
              },
              {
                e1: 'test4@example.com',
                e2: 'test2@example.com',
              },
              {
                e1: 'test5@example.com',
                e2: 'test2@example.com',
              },
              {
                e1: 'test6@example.com',
                e2: 'test2@example.com',
              },
            ]
          );
        });
    });

    it('supports cross join without arguments', function () {
      return knex
        .select('account_id')
        .from('accounts')
        .crossJoin('test_table_two')
        .orderBy('account_id')
        .testSql(function (tester) {
          tester(
            'sqlite3',
            'select `account_id` from `accounts` cross join `test_table_two` order by `account_id` asc',
            [],
            function (res) {
              return res.length === 30;
            }
          );
        });
    });

    it('supports joins with overlapping column names', function () {
      return knex.table('accounts as a1')
        .leftJoin('accounts as a2', function () {
          this.on('a1.email', '<>', 'a2.email');
        })
        .orderBy('a2.id', 'asc')
        .select(['a1.email', 'a2.email'])
        .where(knex.raw('a1.id = 1'))
        .options({
          nestTables: true,
          rowMode: 'array',
        })
        .limit(2)
        .testSql(function (tester) {
          tester(
            'sqlite3',
            'select `a1`.`email`, `a2`.`email` from `accounts` as `a1` left join `accounts` as `a2` on `a1`.`email` <> `a2`.`email` where a1.id = 1 order by `a2`.`id` asc limit ?',
            [2],
            [
              {
                email: 'test2@example.com',
              },
              {
                email: 'test3@example.com',
              },
            ]
          );
        });
    });

    if (knex.client.driverName !== 'mssql') {
      it('Can use .using()', () => {
        const joinName = 'accounts_join_test';

        return knex.schema
          .dropTableIfExists(joinName)
          .then(() =>
            knex.schema.createTable(joinName, (table) => {
              table.string('email');
              table.integer('testcolumn');
            })
          )
          .then(() =>
            knex.table(joinName).insert([
              {
                id: 3,
                email: 'test3@example.com',
                testcolumn: 50,
              },
              {
                id: 3,
                email: 'random@email.com',
                testcolumn: 70,
              },
            ])
          )
          .then(() =>
            knex.table('accounts').join(joinName, (builder) =>
              builder.using(['id', 'email'])
            )
          )
          .then((rows) => {
            expect(rows.length).to.equal(1);
            expect(rows[0].testcolumn).to.equal(50);

            return knex.table('accounts')
              .join(joinName, (builder) => builder.using(['id']))
              .orderBy('testcolumn');
          })
          .then((rows) => {
            expect(rows.length).to.equal(2);
            expect(rows[0].testcolumn).to.equal(50);
            expect(rows[1].testcolumn).to.equal(70);

            return true;
          });
      });
    }
  });
};
