'use strict';

const expect = require('chai').expect;

module.exports = function (knex) {
  describe('unions', function () {
    it('handles unions with a callback', async function () {
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
        t.timestamp('created_at').nullable()
        t.timestamp('updated_at').nullable()
      })

      return knex.table('accounts')
        .select('*')
        .where('id', '=', 1)
        .union(function () {
          this.table('accounts').select('*').where('id', 2);
        });
    });

    it('handles unions with an array of callbacks', function () {
      return knex.table('accounts')
        .select('*')
        .where('id', '=', 1)
        .union([
          function () {
            this.table('accounts').select('*').where('id', 2);
          },
          function () {
            this.table('accounts').select('*').where('id', 3);
          },
        ]);
    });

    it('handles unions with a list of callbacks', function () {
      return knex.table('accounts')
        .select('*')
        .where('id', '=', 1)
        .union(
          function () {
            this.table('accounts').select('*').where('id', 2);
          },
          function () {
            this.table('accounts').select('*').where('id', 3);
          }
        );
    });

    it('handles unions with an array of builders', function () {
      return knex.table('accounts')
        .select('*')
        .where('id', '=', 1)
        .union([
          knex.table('accounts').select('*').where('id', 2),
          knex.table('accounts').select('*').where('id', 3),
        ]);
    });

    it('handles unions with a list of builders', function () {
      return knex.table('accounts')
        .select('*')
        .where('id', '=', 1)
        .union(
          knex.table('accounts').select('*').where('id', 2),
          knex.table('accounts').select('*').where('id', 3)
        );
    });

    it('handles unions with a raw query', function () {
      return knex.table('accounts')
        .select('*')
        .where('id', '=', 1)
        .union(
          knex.raw('select * from ?? where ?? = ?', ['accounts', 'id', 2])
        );
    });

    it('handles unions with an array raw queries', function () {
      return knex.table('accounts')
        .select('*')
        .where('id', '=', 1)
        .union([
          knex.raw('select * from ?? where ?? = ?', ['accounts', 'id', 2]),
          knex.raw('select * from ?? where ?? = ?', ['accounts', 'id', 3]),
        ]);
    });

    it('handles unions with a list of raw queries', function () {
      return knex.table('accounts')
        .select('*')
        .where('id', '=', 1)
        .union(
          knex.raw('select * from ?? where ?? = ?', ['accounts', 'id', 2]),
          knex.raw('select * from ?? where ?? = ?', ['accounts', 'id', 3])
        );
    });
  });

  if (
    ['pg', 'mssql', 'pg-redshift', 'oracledb', 'sqlite3'].includes(
      knex.client.driverName
    )
  ) {
    describe('intersects', function () {
      before(function () {
        return knex.schema.createTable('intersect_test', function (t) {
          t.integer('id');
          t.integer('test_col_1');
          t.integer('test_col_2');
          t.integer('test_col_3');
        });
      });

      beforeEach(function () {
        return knex.table('intersect_test').insert([
          {
            id: 1,
            test_col_1: 1,
            test_col_2: 2,
            test_col_3: 1,
          },
          {
            id: 2,
            test_col_1: 2,
            test_col_2: 3,
            test_col_3: 1,
          },
          {
            id: 3,
            test_col_1: 2,
            test_col_2: 3,
            test_col_3: 2,
          },
          {
            id: 4,
            test_col_1: 1,
            test_col_2: 2,
            test_col_3: 2,
          },
          {
            id: 5,
            test_col_1: 1,
            test_col_2: 2,
            test_col_3: 1,
          },
        ]);
      });

      after(function () {
        return knex.schema.dropTable('intersect_test');
      });

      it('handles intersects with a callback', function () {
        return knex.table('intersect_test')
          .select('*')
          .where('test_col_1', '=', 1)
          .intersect(function () {
            this.table('intersect_test').select('*').where('test_col_2', 2);
          })
          .then(function (result) {
            expect(result.length).to.equal(3);
            expect(result.map((r) => r.id)).to.have.members([1, 4, 5]);
          });
      });

      it('handles intersects with an array of callbacks', function () {
        return knex.table('intersect_test')
          .select('*')
          .where('test_col_1', '=', 1)
          .intersect([
            function () {
              this.table('intersect_test').select('*').where('test_col_2', 2);
            },
            function () {
              this.table('intersect_test').select('*').where('test_col_3', 1);
            },
          ])
          .then(function (result) {
            expect(result.length).to.equal(2);
            expect(result.map((r) => r.id)).to.have.members([1, 5]);
          });
      });

      it('handles intersects with a list of callbacks', function () {
        return knex.table('intersect_test')
          .select('*')
          .where('test_col_1', '=', 1)
          .intersect(
            function () {
              this.table('intersect_test').select('*').where('test_col_2', 2);
            },
            function () {
              this.table('intersect_test').select('*').where('test_col_3', 1);
            }
          )
          .then(function (result) {
            expect(result.length).to.equal(2);
            expect(result.map((r) => r.id)).to.have.members([1, 5]);
          });
      });

      it('handles intersects with an array of builders', function () {
        return knex.table('intersect_test')
          .select('*')
          .where('test_col_1', '=', 1)
          .intersect([
            knex.table('intersect_test').select('*').where('test_col_2', 2),
            knex.table('intersect_test').select('*').where('test_col_3', 1),
          ])
          .then(function (result) {
            expect(result.length).to.equal(2);
            expect(result.map((r) => r.id)).to.have.members([1, 5]);
          });
      });

      it('handles intersects with a list of builders', function () {
        return knex.table('intersect_test')
          .select('*')
          .where('test_col_1', '=', 1)
          .intersect(
            knex.table('intersect_test').select('*').where('test_col_2', 2),
            knex.table('intersect_test').select('*').where('test_col_3', 1)
          )
          .then(function (result) {
            expect(result.length).to.equal(2);
            expect(result.map((r) => r.id)).to.have.members([1, 5]);
          });
      });

      it('handles intersects with a raw query', function () {
        return knex.table('intersect_test')
          .select('*')
          .where('test_col_1', '=', 2)
          .intersect(
            knex.raw('select * from ?? where ?? = ?', [
              'intersect_test',
              'test_col_2',
              3,
            ])
          )
          .then(function (result) {
            expect(result.length).to.equal(2);
            expect(result.map((r) => r.id)).to.have.members([2, 3]);
          });
      });

      it('handles intersects with an array raw queries', function () {
        return knex.table('intersect_test')
          .select('*')
          .where('test_col_1', '=', 1)
          .intersect([
            knex.raw('select * from ?? where ?? = ?', [
              'intersect_test',
              'test_col_2',
              2,
            ]),
            knex.raw('select * from ?? where ?? = ?', [
              'intersect_test',
              'test_col_3',
              1,
            ]),
          ])
          .then(function (result) {
            expect(result.length).to.equal(2);
            expect(result.map((r) => r.id)).to.have.members([1, 5]);
          });
      });

      it('handles intersects with a list of raw queries', function () {
        return knex.table('intersect_test')
          .select('*')
          .where('test_col_1', '=', 1)
          .intersect(
            knex.raw('select * from ?? where ?? = ?', [
              'intersect_test',
              'test_col_2',
              2,
            ]),
            knex.raw('select * from ?? where ?? = ?', [
              'intersect_test',
              'test_col_3',
              1,
            ])
          )
          .then(function (result) {
            expect(result.length).to.equal(2);
            expect(result.map((r) => r.id)).to.have.members([1, 5]);
          });
      });
    });
  }
};
