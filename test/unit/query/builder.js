/*eslint no-var:0, indent:0, max-len:0 */
'use strict';

const {expect} = require('chai');
const SQLite3_Client = require('../../../lib/dialects/sqlite3/sqlite3');

// use driverName as key
const clients = {
  sqlite3: new SQLite3_Client({client: 'sqlite3'}),
};

const useNullAsDefaultConfig = {useNullAsDefault: true};
// use driverName as key
const clientsWithNullAsDefault = {
  sqlite3: new SQLite3_Client(
    Object.assign({client: 'sqlite3'}, useNullAsDefaultConfig)
  ),
};

const customLoggerConfig = {
  log: {
    warn: function (message) {
      throw new Error(message);
    },
  },
};
const clientsWithCustomLoggerForTestWarnings = {
  sqlite3: new SQLite3_Client(
    Object.assign(
      {client: 'sqlite3'},
      {...customLoggerConfig, ...useNullAsDefaultConfig}
    )
  ),
};

// note: as a workaround, we are using postgres here, since that's using the default " field wrapping
// otherwise subquery cloning would need to be fixed. See: https://github.com/tgriesser/knex/pull/2063
function qb() {
  return clients.sqlite3.queryBuilder();
}

function raw(sql, bindings) {
  return clients.sqlite3.raw(sql, bindings);
}

function verifySqlResult(dialect, expectedObj, sqlObj) {
  Object.keys(expectedObj).forEach((key) => {
    if (typeof expectedObj[key] === 'function') {
      expectedObj[key](sqlObj[key]);
    } else {
      try {
        expect(sqlObj[key]).to.deep.equal(expectedObj[key]);
      } catch (e) {
        e.stack = dialect + ': ' + e.stack;
        throw e;
      }
    }
    console.log(`      ⍜ ${sqlObj[key]}`)
  });
}

function testsql(chain, valuesToCheck, selectedClients) {
  selectedClients = selectedClients || clients;
  Object.keys(valuesToCheck).forEach((key) => {
    const newChain = chain.clone();
    newChain.client = selectedClients[key];
    const sqlAndBindings = newChain.toSQL();

    const checkValue = valuesToCheck[key];
    if (typeof checkValue === 'string') {
      verifySqlResult(key, {sql: checkValue}, sqlAndBindings);
    } else {
      verifySqlResult(key, checkValue, sqlAndBindings);
    }
  });
}

function testNativeSql(chain, valuesToCheck, selectedClients) {
  selectedClients = selectedClients || clients;
  Object.keys(valuesToCheck).forEach((key) => {
    const newChain = chain.clone();
    newChain.client = selectedClients[key];
    const sqlAndBindings = newChain.toSQL().toNative();
    const checkValue = valuesToCheck[key];
    verifySqlResult(key, checkValue, sqlAndBindings);
  });
}

function testquery(chain, valuesToCheck, selectedClients) {
  selectedClients = selectedClients || clients;
  Object.keys(valuesToCheck).forEach((key) => {
    const newChain = chain.clone();
    newChain.client = selectedClients[key];
    const sqlString = newChain.toQuery();
    const checkValue = valuesToCheck[key];
    console.log(sqlString, checkValue)
    expect(checkValue).to.equal(sqlString);
  });
}

describe('QueryBuilder', () => {
  it('basic select', () => {
    testsql(qb().table('users').select('*'), {
      sqlite3: 'select * from `users`',
    });
  });

  it('adding selects', () => {
    testsql(
      qb().table('users').select('foo').select('bar').select(['baz', 'boom']),
      {sqlite3: 'select `foo`, `bar`, `baz`, `boom` from `users`'}
    );
  });

  it('basic select distinct', () => {
    testsql(qb().table('users').distinct().select('foo', 'bar'), {
      sqlite3: {
        sql: 'select distinct `foo`, `bar` from `users`',
      },
    });
  });

  it('basic select with alias as property-value pairs', () => {
    testsql(qb().table('users').select({ bar: 'foo' }), {
      sqlite3: 'select `foo` as `bar` from `users`',
    });
  });

  it('basic select with mixed pure column and alias pair', () => {
    testsql(qb().table('users').select('baz', { bar: 'foo' }), {
      sqlite3: 'select `baz`, `foo` as `bar` from `users`',
    });
  });

  it('basic select with array-wrapped alias pair', () => {
    testsql(
      qb().table('users').select(['baz', { bar: 'foo' }]),
      {sqlite3: 'select `baz`, `foo` as `bar` from `users`',}
    );
  });

  it('basic select with mixed pure column and alias pair', () => {
    testsql(qb().table('users').select({ bar: 'foo' }), {
      sqlite3: 'select `foo` as `bar` from `users`',
    });
  });

  it('basic old-style alias', () => {
    testsql(qb().table('users').select('foo as bar'), {
      sqlite3: 'select `foo` as `bar` from `users`',
    });
  });

  it('basic alias trims spaces', () => {
    testsql(qb().table('users').select(' foo   as bar '), {
      sqlite3: 'select `foo` as `bar` from `users`',
    });
  });

  it('allows for case-insensitive alias', () => {
    testsql(qb().table('users').select(' foo   aS bar '), {
      sqlite3: 'select `foo` as `bar` from `users`',
    });
  });

  it('allows alias with dots in the identifier name', () => {
    testsql(qb().table('users').select('foo as bar.baz'), {
      sqlite3: 'select `foo` as `bar.baz` from `users`',
    });
  });

  it('less trivial case of object alias syntax', () => {
    testsql(
      qb()
        .table({
          table1: 'table',
          table2: 'table',
          subq: qb().table('test').limit(1),
        })
        .select({
          bar: 'table1.*',
          subq: qb()
            .table('test')
            .select(raw('??', [{a: 'col1', b: 'col2'}]))
            .limit(1),
        }),
      {
        sqlite3:
          'select `table1`.* as `bar`, (select `col1` as `a`, `col2` as `b` from `test` limit ?) as `subq` from `table` as `table1`, `table` as `table2`, (select * from `test` limit ?) as `subq`',
      }
    );
  });

  it('basic table wrapping', () => {
    testsql(qb().table('public.users').select('*'), {
      sqlite3: 'select * from `public`.`users`',
    });
  });

  it('basic wheres', () => {
    testsql(qb().table('users').select('*').where('id', '=', 1), {
      sqlite3: {
        sql: 'select * from `users` where `id` = ?',
        bindings: [1],
      },
    });

    testquery(qb().table('users').select('*').where('id', '=', 1), {
      sqlite3: 'select * from `users` where `id` = 1',
    });
  });

  it('whereColumn', () => {
    testsql(
      qb().table('users').select('*')
        .whereColumn('users.id', '=', 'users.otherId'),
      {sqlite3: 'select * from `users` where `users`.`id` = `users`.`otherId`'}
    );
  });

  it('where not', () => {
    testsql(qb().table('users').select('*').whereNot('id', '=', 1), {
      sqlite3: {
        sql: 'select * from `users` where not `id` = ?',
        bindings: [1],
      },
    });

    testquery(qb().table('users').select('*').whereNot('id', '=', 1), {
      sqlite3: 'select * from `users` where not `id` = 1',
    });
  });

  it('grouped or where not', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .whereNot(function () {
          this.where('id', '=', 1).orWhereNot('id', '=', 3);
        }),
      {
        sqlite3: {
          sql: 'select * from `users` where not (`id` = ? or not `id` = ?)',
          bindings: [1, 3],
        },
      }
    );

    testquery(
      qb()
        .table('users')
        .select('*')
        .whereNot(function () {
          this.where('id', '=', 1).orWhereNot('id', '=', 3);
        }),
      {sqlite3: 'select * from `users` where not (`id` = 1 or not `id` = 3)',}
    );
  });

  it('grouped or where not alternate', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where(function () {
          this.where('id', '=', 1).orWhereNot('id', '=', 3);
        }),
      {
        sqlite3: {
          sql: 'select * from `users` where (`id` = ? or not `id` = ?)',
          bindings: [1, 3],
        },
      }
    );

    testquery(
      qb()
        .table('users')
        .select('*')
        .where(function () {
          this.where('id', '=', 1).orWhereNot('id', '=', 3);
        }),
      {sqlite3: 'select * from `users` where (`id` = 1 or not `id` = 3)',}
    );
  });

  it('where not object', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .whereNot({ first_name: 'Test', last_name: 'User' }),
      {
        sqlite3: {
          sql: 'select * from `users` where not `first_name` = ? and not `last_name` = ?',
          bindings: ['Test', 'User'],
        },
      }
    );

    testquery(
      qb()
        .table('users')
        .select('*')
        .whereNot({ first_name: 'Test', last_name: 'User' }),
      {sqlite3: "select * from `users` where not `first_name` = 'Test' and not `last_name` = 'User'",}
    );
  });

  it('where bool', () => {
    testquery(qb().table('users').select('*').where(true), {
      sqlite3: 'select * from `users` where 1 = 1',
    });
  });

  it('where betweens', () => {
    testsql(qb().table('users').select('*').whereBetween('id', [1, 2]), {
      sqlite3: {
        sql: 'select * from `users` where `id` between ? and ?',
        bindings: [1, 2],
      },
    });
  });

  it('and where betweens', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('name', '=', 'user1')
        .whereBetween('id', [1, 2]),
      {
        sqlite3: {
          sql: 'select * from `users` where `name` = ? and `id` between ? and ?',
          bindings: ['user1', 1, 2],
        },
      }
    );
  });

  it('and where not betweens', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('name', '=', 'user1')
        .whereNotBetween('id', [1, 2]),
      {
        sqlite3: {
          sql: 'select * from `users` where `name` = ? and `id` not between ? and ?',
          bindings: ['user1', 1, 2],
        },
      }
    );
  });

  it('basic or wheres', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('id', '=', 1)
        .orWhere('email', '=', 'foo'),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or `email` = ?',
          bindings: [1, 'foo'],
        },
      }
    );
  });

  it('chained or wheres', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('id', '=', 1)
        .or.where('email', '=', 'foo'),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or `email` = ?',
          bindings: [1, 'foo'],
        },
      }
    );
  });

  it('raw column wheres', () => {
    testsql(qb().table('users').select('*').where(raw('LOWER("name")'), 'foo'), {
      sqlite3: {
        sql: 'select * from `users` where LOWER("name") = ?',
        bindings: ['foo'],
      },
    });
  });

  it('raw wheres', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where(raw('id = ? or email = ?', [1, 'foo'])),
      {
        sqlite3: {
          sql: 'select * from `users` where id = ? or email = ?',
          bindings: [1, 'foo'],
        },
      }
    );
  });

  it('raw or wheres', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('id', '=', 1)
        .orWhere(raw('email = ?', ['foo'])),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or email = ?',
          bindings: [1, 'foo'],
        },
      }
    );
  });

  it('chained raw or wheres', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('id', '=', 1)
        .or.where(raw('email = ?', ['foo'])),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or email = ?',
          bindings: [1, 'foo'],
        },
      }
    );
  });

  it('basic where ins', () => {
    testsql(qb().table('users').select('*').whereIn('id', [1, 2, 3]), {
      sqlite3: {
        sql: 'select * from `users` where `id` in (?, ?, ?)',
        bindings: [1, 2, 3],
      },
    });
  });

  it('multi column where ins', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .whereIn(
          ['a', 'b'],
          [
            [1, 2],
            [3, 4],
            [5, 6],
          ]
        ),
      {
        sqlite3: {
          sql:
            'select * from `users` where (`a`, `b`) in ( values (?, ?), (?, ?), (?, ?))',
          bindings: [1, 2, 3, 4, 5, 6],
        },
      }
    );
  });

  it('orWhereIn', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('id', '=', 1)
        .orWhereIn('id', [1, 2, 3]),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or `id` in (?, ?, ?)',
          bindings: [1, 1, 2, 3],
        },
      }
    );
  });

  it('basic where not ins', () => {
    testsql(qb().table('users').select('*').whereNotIn('id', [1, 2, 3]), {
      sqlite3: {
        sql: 'select * from `users` where `id` not in (?, ?, ?)',
        bindings: [1, 2, 3],
      },
    });
  });

  it('chained or where not in', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('id', '=', 1)
        .or.not.whereIn('id', [1, 2, 3]),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or `id` not in (?, ?, ?)',
          bindings: [1, 1, 2, 3],
        },
      }
    );
  });

  it('or.whereIn', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('id', '=', 1)
        .or.whereIn('id', [4, 2, 3]),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or `id` in (?, ?, ?)',
          bindings: [1, 4, 2, 3],
        },
      }
    );
  });

  it('chained basic where not ins', () => {
    testsql(qb().table('users').select('*').not.whereIn('id', [1, 2, 3]), {
      sqlite3: {
        sql: 'select * from `users` where `id` not in (?, ?, ?)',
        bindings: [1, 2, 3],
      },
    });
  });

  it('chained or where not in', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('id', '=', 1)
        .or.not.whereIn('id', [1, 2, 3]),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or `id` not in (?, ?, ?)',
          bindings: [1, 1, 2, 3],
        },
      }
    );
  });

  it('whereIn with empty array, #477', () => {
    testsql(qb().table('users').select('*').whereIn('id', []), {
      sqlite3: {
        sql: 'select * from `users` where 1 = ?',
        bindings: [0],
      },
    });
  });

  it('whereNotIn with empty array, #477', () => {
    testsql(qb().table('users').select('*').whereNotIn('id', []), {
      sqlite3: {
        sql: 'select * from `users` where 1 = ?',
        bindings: [1],
      },
    });
  });

  it('should allow a function as the first argument, for a grouped where clause', () => {
    const partial = qb().table('test').where('id', '=', 1);
    testsql(partial, {
      sqlite3: 'select * from `test` where `id` = ?',
    });

    const subWhere = function (sql) {
      expect(this).to.equal(sql);
      this.where({ id: 3 }).orWhere('id', 4);
    };

    testsql(partial.where(subWhere), {
      sqlite3: {
        sql: 'select * from `test` where `id` = ? and (`id` = ? or `id` = ?)',
        bindings: [1, 3, 4],
      },
    });
  });

  it('should accept a function as the "value", for a sub select', () => {
    const chain = qb().where('id', '=', function (qb) {
      expect(this).to.equal(qb);
      this.table('users').select('account_id')
        .where('names.id', '>', 1)
        .orWhere(function () {
          this.where('names.first_name', 'like', 'Tim%').where('names.id', '>', 10);
        });
    });

    testsql(chain, {
      sqlite3: {
        sql: 'select * where `id` = (select `account_id` from `users` where `names`.`id` > ? or (`names`.`first_name` like ? and `names`.`id` > ?))',
        bindings: [1, 'Tim%', 10],
      },
    });

    testquery(chain, {
      sqlite3:
        "select * where `id` = (select `account_id` from `users` where `names`.`id` > 1 or (`names`.`first_name` like 'Tim%' and `names`.`id` > 10))",
    });
  });

  it('should accept a function as the "value", for a sub select when chained', () => {
    const chain = qb().where('id', '=', function (qb) {
      expect(this).to.equal(qb);
      this.table('users').select('account_id')
        .where('names.id', '>', 1)
        .or.where(function () {
        this.where('names.first_name', 'like', 'Tim%').and.where('names.id', '>', 10);
      });
    });

    testsql(chain, {
      sqlite3: {
        sql: 'select * where `id` = (select `account_id` from `users` where `names`.`id` > ? or (`names`.`first_name` like ? and `names`.`id` > ?))',
        bindings: [1, 'Tim%', 10],
      },
    });
  });

  it('should not do whereNull on where("foo", "<>", null) #76', () => {
    testquery(qb().where('foo', '<>', null), {
      sqlite3: 'select * where `foo` <> NULL',
    });
  });

  it('should expand where("foo", "!=") to - where id = "!="', () => {
    testquery(qb().where('foo', '!='), {
      sqlite3: "select * where `foo` = '!='",
    });
  });

  it('unions', () => {
    const chain = qb()
      .table('users')
      .select('*')
      .where('id', '=', 1)
      .union(function () {
        this.table('users').select('*').where('id', '=', 2);
      });
    testsql(chain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union select * from `users` where `id` = ?',
        bindings: [1, 2],
      },
    });

    const multipleArgumentsChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .union(
        function () {
          this.table('users').select('*').where({ id: 2 });
        },
        function () {
          this.table('users').select('*').where({ id: 3 });
        }
      );
    testsql(multipleArgumentsChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union select * from `users` where `id` = ? union select * from `users` where `id` = ?',
        bindings: [1, 2, 3],
      },
    });

    const arrayChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .union([
        function () {
          this.table('users').select('*').where({ id: 2 });
        },
        function () {
          this.table('users').select('*').where({ id: 3 });
        },
      ]);
    testsql(arrayChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union select * from `users` where `id` = ? union select * from `users` where `id` = ?',
        bindings: [1, 2, 3],
      },
    });
  });

  it('wraps unions', () => {
    const wrappedChain = qb()
      .table('users')
      .select('*')
      .where('id', 'in', function () {
        this.table('users')
          .max('id')
          .union(function () {
            this.table('users').min('id');
          }, true);
      });
    testsql(wrappedChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` in (select max(`id`) from `users` union (select min(`id`) from `users`))',
        bindings: [],
      },
    });

    // worthwhile since we're playing games with the 'wrap' specification with arguments
    const multipleArgumentsWrappedChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .union(
        function () {
          this.table('users').select('*').where({ id: 2 });
        },
        function () {
          this.table('users').select('*').where({ id: 3 });
        },
        true
      );
    testsql(multipleArgumentsWrappedChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union (select * from `users` where `id` = ?) union (select * from `users` where `id` = ?)',
        bindings: [1, 2, 3],
      },
    });

    const arrayWrappedChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .union(
        [
          function () {
            this.table('users').select('*').where({ id: 2 });
          },
          function () {
            this.table('users').select('*').where({ id: 3 });
          },
        ],
        true
      );
    testsql(arrayWrappedChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union (select * from `users` where `id` = ?) union (select * from `users` where `id` = ?)',
        bindings: [1, 2, 3],
      },
    });
  });

  it('wraps union alls', () => {
    const wrappedChain = qb()
      .table('users')
      .select('*')
      .where('id', 'in', function () {
        this.table('users')
          .max('id')
          .unionAll(function () {
            this.table('users').min('id');
          }, true);
      });
    testsql(wrappedChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` in (select max(`id`) from `users` union all (select min(`id`) from `users`))',
        bindings: [],
      },
    });

    // worthwhile since we're playing games with the 'wrap' specification with arguments
    const multipleArgumentsWrappedChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .unionAll(
        function () {
          this.table('users').select('*').where({ id: 2 });
        },
        function () {
          this.table('users').select('*').where({ id: 3 });
        },
        true
      );
    testsql(multipleArgumentsWrappedChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union all (select * from `users` where `id` = ?) union all (select * from `users` where `id` = ?)',
        bindings: [1, 2, 3],
      },
    });

    const arrayWrappedChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .unionAll(
        [
          function () {
            this.table('users').select('*').where({ id: 2 });
          },
          function () {
            this.table('users').select('*').where({ id: 3 });
          },
        ],
        true
      );
    testsql(arrayWrappedChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union all (select * from `users` where `id` = ?) union all (select * from `users` where `id` = ?)',
        bindings: [1, 2, 3],
      },
    });
  });

  it('union alls', () => {
    const chain = qb()
      .table('users')
      .select('*')
      .where('id', '=', 1)
      .unionAll(function () {
        this.table('users').select('*').where('id', '=', 2);
      });
    testsql(chain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union all select * from `users` where `id` = ?',
        bindings: [1, 2],
      },
    });

    const multipleArgumentsChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .unionAll(
        function () {
          this.table('users').select('*').where({ id: 2 });
        },
        function () {
          this.table('users').select('*').where({ id: 3 });
        }
      );
    testsql(multipleArgumentsChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union all select * from `users` where `id` = ? union all select * from `users` where `id` = ?',
        bindings: [1, 2, 3],
      },
    });

    const arrayChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .unionAll([
        function () {
          this.table('users').select('*').where({ id: 2 });
        },
        function () {
          this.table('users').select('*').where({ id: 3 });
        },
      ]);
    testsql(arrayChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union all select * from `users` where `id` = ? union all select * from `users` where `id` = ?',
        bindings: [1, 2, 3],
      },
    });
  });

  it('multiple unions', () => {
    const chain = qb()
      .table('users')
      .select('*')
      .where('id', '=', 1)
      .union(qb().table('users').select('*').where('id', '=', 2))
      .union(function () {
        this.table('users').select('*').where('id', '=', 3);
      });
    testsql(chain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union select * from `users` where `id` = ? union select * from `users` where `id` = ?',
        bindings: [1, 2, 3],
      },
    });

    const arrayChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .union([
        qb().table('users').select('*').where({ id: 2 }),
        raw('select * from users where id = ?', [3]),
      ]);
    testsql(arrayChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union select * from `users` where `id` = ? union select * from users where id = ?',
        bindings: [1, 2, 3],
      },
    });

    const multipleArgumentsChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .union(
        qb().table('users').select('*').where({ id: 2 }),
        raw('select * from users where id = ?', [3])
      );
    testsql(multipleArgumentsChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union select * from `users` where `id` = ? union select * from users where id = ?',
        bindings: [1, 2, 3],
      },
    });
  });

  it('multiple union alls', () => {
    const chain = qb()
      .table('users')
      .select('*')
      .where('id', '=', 1)
      .unionAll(qb().table('users').select('*').where('id', '=', 2))
      .unionAll(qb().table('users').select('*').where('id', '=', 3));

    testsql(chain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union all select * from `users` where `id` = ? union all select * from `users` where `id` = ?',
        bindings: [1, 2, 3],
      },
    });

    const arrayChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .unionAll([
        qb().table('users').select('*').where({ id: 2 }),
        raw('select * from users where id = ?', [3]),
      ]);
    testsql(arrayChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union all select * from `users` where `id` = ? union all select * from users where id = ?',
        bindings: [1, 2, 3],
      },
    });

    const multipleArgumentsChain = qb()
      .table('users')
      .select('*')
      .where({ id: 1 })
      .unionAll(
        qb().table('users').select('*').where({ id: 2 }),
        raw('select * from users where id = ?', [3])
      );
    testsql(multipleArgumentsChain, {
      sqlite3: {
        sql: 'select * from `users` where `id` = ? union all select * from `users` where `id` = ? union all select * from users where id = ?',
        bindings: [1, 2, 3],
      },
    });
  });

  it('intersects', () => {
    const chain = qb()
      .table('users')
      .select('*')
      .where('id', '=', 1)
      .intersect(function () {
        this.table('users').select('*').where('id', '=', 2);
      });

    testsql(chain, {
      sqlite3: {
        sql:
          'select * from `users` where `id` = ? intersect select * from `users` where `id` = ?',
        bindings: [1, 2],
      },
    });

    const multipleArgumentsChain = qb()
      .table('users')
      .select('*')
      .where({id: 1})
      .intersect(
        function () {
          this.table('users').select('*').where({id: 2});
        },
        function () {
          this.table('users').select('*').where({id: 3});
        }
      );
    testsql(multipleArgumentsChain, {
      sqlite3: {
        sql:
          'select * from `users` where `id` = ? intersect select * from `users` where `id` = ? intersect select * from `users` where `id` = ?',
        bindings: [1, 2, 3],
      },
    });

    const arrayChain = qb()
      .table('users')
      .select('*')
      .where({id: 1})
      .intersect([
        function () {
          this.table('users').select('*').where({id: 2});
        },
        function () {
          this.table('users').select('*').where({id: 3});
        },
      ]);
    testsql(arrayChain, {
      sqlite3: {
        sql:
          'select * from `users` where `id` = ? intersect select * from `users` where `id` = ? intersect select * from `users` where `id` = ?',
        bindings: [1, 2, 3],
      },
    });
  });

  it('sub select where ins', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .whereIn('id', (qb) => {
          qb.table('users').select('id').where('age', '>', 25).limit(3);
        }),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` in (select `id` from `users` where `age` > ? limit ?)',
          bindings: [25, 3],
        },
      }
    );
  });

  it('sub select multi column where ins', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .whereIn(['id_a', 'id_b'], (qb) => {
          qb.table('users').select('id_a', 'id_b')
            .where('age', '>', 25)
            .limit(3);
        }),
      {
        sqlite3: {
          sql: 'select * from `users` where (`id_a`, `id_b`) in (select `id_a`, `id_b` from `users` where `age` > ? limit ?)',
          bindings: [25, 3],
        },
      }
    );
  });

  it('order by accepts query builder', () => {
    testsql(
      qb()
        .table('persons')
        .select()
        .orderBy(
          qb()
            .table('persons as p')
            .select()
            .whereColumn('persons.id', 'p.id')
            .select('p.id')
        ),
      {
        sqlite3: {
          sql:
            'select * from `persons` order by (select `p`.`id` from `persons` as `p` where `persons`.`id` = `p`.`id`) asc',
          bindings: [],
        },
      }
    );
  });

  it('sub select where not ins', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .whereNotIn('id', (qb) => {
          qb.table('users').select('id').where('age', '>', 25);
        }),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` not in (select `id` from `users` where `age` > ?)',
          bindings: [25],
        },
      }
    );
  });

  it('basic where nulls', () => {
    testsql(qb().table('users').select('*').whereNull('id'), {
      sqlite3: {
        sql: 'select * from `users` where `id` is null',
        bindings: [],
      },
    });
  });

  it('basic or where nulls', () => {
    testsql(
      qb().table('users').select('*').where('id', '=', 1).orWhereNull('id'),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or `id` is null',
          bindings: [1],
        },
      }
    );
  });

  it('basic where not nulls', () => {
    testsql(qb().table('users').select('*').whereNotNull('id'), {
      sqlite3: {
        sql: 'select * from `users` where `id` is not null',
        bindings: [],
      },
    });
  });

  it('basic or where not nulls', () => {
    testsql(
      qb().table('users').select('*').where('id', '>', 1).orWhereNotNull('id'),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` > ? or `id` is not null',
          bindings: [1],
        },
      }
    );
  });

  it('group bys', () => {
    testsql(qb().table('users').select('*').groupBy('id', 'email'), {
      sqlite3: {
        sql: 'select * from `users` group by `id`, `email`',
        bindings: [],
      },
    });
  });

  it('order bys', () => {
    testsql(
      qb().table('users').select('*').orderBy('email').orderBy('age', 'desc'),
      {
        sqlite3: {
          sql: 'select * from `users` order by `email` asc, `age` desc',
          bindings: [],
        },
      }
    );
  });

  it('order by array', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .orderBy(['email', { column: 'age', order: 'desc' }]),
      {
        sqlite3: {
          sql: 'select * from `users` order by `email` asc, `age` desc',
          bindings: [],
        },
      }
    );
  });

  it('order by array without order', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .orderBy([{ column: 'email' }, { column: 'age', order: 'desc' }]),
      {
        sqlite3: {
          sql: 'select * from `users` order by `email` asc, `age` desc',
          bindings: [],
        },
      }
    );
  });

  it('order by accepts query builder', () => {
    testsql(
      qb()
        .table('persons')
        .select()
        .orderBy(
          qb()
            .table('persons as p')
            .select()
            .whereColumn('persons.id', 'p.id')
            .select('p.id')
        ),
      {
        sqlite3: {
          sql: 'select * from `persons` order by (select `p`.`id` from `persons` as `p` where `persons`.`id` = `p`.`id`) asc',
          bindings: [],
        },
      }
    );
  });

  it('raw group bys', () => {
    testsql(qb().table('users').select('*').groupByRaw('id, email'), {
      sqlite3: {
        sql: 'select * from `users` group by id, email',
        bindings: [],
      },
    });
  });

  it('raw order bys with default direction', () => {
    testsql(qb().table('users').select('*').orderBy(raw('col NULLS LAST')), {
      sqlite3: {
        sql: 'select * from `users` order by col NULLS LAST asc',
        bindings: [],
      },
    });
  });

  it('raw order bys with specified direction', () => {
    testsql(
      qb().table('users').select('*').orderBy(raw('col NULLS LAST'), 'desc'),
      {
        sqlite3: {
          sql: 'select * from `users` order by col NULLS LAST desc',
          bindings: [],
        },
      }
    );
  });

  it('orderByRaw', () => {
    testsql(qb().table('users').select('*').orderByRaw('col NULLS LAST DESC'), {
      sqlite3: {
        sql: 'select * from `users` order by col NULLS LAST DESC',
        bindings: [],
      },
    });
  });

  it('orderByRaw second argument is the binding', () => {
    testsql(
      qb().table('users').select('*').orderByRaw('col NULLS LAST ?', 'dEsc'),
      {
        sqlite3: {
          sql: 'select * from `users` order by col NULLS LAST ?',
          bindings: ['dEsc'],
        },
      }
    );
  });

  it('multiple order bys', () => {
    testsql(
      qb().table('users').select('*').orderBy('email').orderBy('age', 'desc'),
      {
        sqlite3: {
          sql: 'select * from `users` order by `email` asc, `age` desc',
          bindings: [],
        },
      }
    );
  });

  it('havings', () => {
    testsql(qb().table('users').select('*').having('email', '>', 1), {
      sqlite3: 'select * from `users` having `email` > ?',
    });
  });

  it('or having', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .having('baz', '>', 5)
        .orHaving('email', '=', 10),
      {sqlite3: 'select * from `users` having `baz` > ? or `email` = ?',}
    );
  });

  it('nested having', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .having(function () {
          this.where('email', '>', 1);
        }),
      {sqlite3: 'select * from `users` having (`email` > ?)',}
    );
  });

  it('nested or havings', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .having(function () {
          this.where('email', '>', 10);
          this.orWhere('email', '=', 7);
        }),
      {sqlite3: 'select * from `users` having (`email` > ? or `email` = ?)',}
    );
  });

  it('grouped having', () => {
    testsql(
      qb().table('users').select('*').groupBy('email').having('email', '>', 1),
      {sqlite3: 'select * from `users` group by `email` having `email` > ?'}
    );
  });

  it('raw havings', () => {
    testsql(qb().table('users').select('*').having(raw('user_foo < user_bar')), {
      sqlite3: 'select * from `users` having user_foo < user_bar',
    });
  });

  it('raw or havings', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .having('baz', '=', 1)
        .orHavingRaw(raw('user_foo < user_bar')),
      {sqlite3: 'select * from `users` having `baz` = ? or user_foo < user_bar'}
    );
  });

  it('having null', () => {
    testsql(qb().table('users').select('*').havingNull('baz'), {
      sqlite3: 'select * from `users` having `baz` is null',
    });
  });

  it('or having null', () => {
    testsql(
      qb().table('users').select('*').havingNull('baz').or.havingNull('foo'),
      {sqlite3: 'select * from `users` having `baz` is null or `foo` is null'}
    );
  });

  it('having not null', () => {
    testsql(qb().table('users').select('*').havingNotNull('baz'), {
      sqlite3: 'select * from `users` having `baz` is not null',
    });
  });

  it('or having not null', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .havingNotNull('baz')
        .or.havingNotNull('foo'),
      {sqlite3: 'select * from `users` having `baz` is not null or `foo` is not null',}
    );
  });

  it('limits', () => {
    testsql(qb().table('users').select('*').limit(10), {
      sqlite3: {
        sql: 'select * from `users` limit ?',
        bindings: [10],
      },
    });
  });

  it('can limit 0', () => {
    testsql(qb().table('users').select('*').limit(0), {
      sqlite3: {
        sql: 'select * from `users` limit ?',
        bindings: [0],
      },
    });
  });

  it('limits and offsets', () => {
    testsql(qb().table('users').select('*').offset(5).limit(10), {
      sqlite3: {
        sql: 'select * from `users` limit ? offset ?',
        bindings: [10, 5],
      },
    });
  });

  it('limits and offsets with raw', () => {
    testsql(qb().table('users').select('*').offset(raw('5')).limit(raw('10')), {
      sqlite3: {
        sql: 'select * from `users` limit ? offset 5',
        bindings: [10],
      },
    });
  });

  it('limits and raw selects', () => {
    testsql(
      qb()
        .table('users')
        .select(raw('name = ? as isJohn', ['john']))
        .limit(1),
      {
        sqlite3: {
          sql: 'select name = ? as isJohn from `users` limit ?',
          bindings: ['john', 1],
        },
      }
    );
  });

  it('first', () => {
    testsql(qb().table('users').first('*'), {
      sqlite3: {
        sql: 'select * from `users` limit ?',
        bindings: [1],
      },
    });
  });

  it('offsets only', () => {
    testsql(qb().table('users').select('*').offset(5), {
      sqlite3: {
        sql: 'select * from `users` limit ? offset ?',
        bindings: [-1, 5],
      },
    });
  });

  it('where shortcut', () => {
    testsql(
      qb().table('users').select('*').where('id', 1).orWhere('name', 'foo'),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or `name` = ?',
          bindings: [1, 'foo'],
        },
      }
    );
  });

  it('nested wheres', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('email', '=', 'foo')
        .orWhere((qb) => {
          qb.where('name', '=', 'bar').where('age', '=', 25);
        }),
      {
        sqlite3: {
          sql: 'select * from `users` where `email` = ? or (`name` = ? and `age` = ?)',
          bindings: ['foo', 'bar', 25],
        },
      }
    );
  });

  it('full sub selects', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .where('email', '=', 'foo')
        .orWhere('id', '=', (qb) => {
          qb.table('users').select(raw('max(id)')).where('email', '=', 'bar');
        }),
      {
        sqlite3: {
          sql: 'select * from `users` where `email` = ? or `id` = (select max(id) from `users` where `email` = ?)',
          bindings: ['foo', 'bar'],
        },
      }
    );
  });

  it('where exists', () => {
    testsql(
      qb()
        .table('orders')
        .select('*')
        .whereExists((qb) => {
          qb.table('products').select('*')
            .where('products.id', '=', raw('"orders"."id"'));
        }),
      {
        sqlite3: {
          sql: 'select * from `orders` where exists (select * from `products` where `products`.`id` = "orders"."id")',
          bindings: [],
        },
      }
    );
  });

  it('where exists with builder', () => {
    testsql(
      qb()
        .table('orders')
        .select('*')
        .whereExists(
          qb().table('products').select('*').whereRaw('products.id = orders.id')
        ),
      {
        sqlite3: {
          sql: 'select * from `orders` where exists (select * from `products` where products.id = orders.id)',
          bindings: [],
        },
      }
    );
  });

  it('where not exists', () => {
    testsql(
      qb()
        .table('orders')
        .select('*')
        .whereNotExists((qb) => {
          qb.table('products').select('*')
            .where('products.id', '=', raw('"orders"."id"'));
        }),
      {
        sqlite3: {
          sql: 'select * from `orders` where not exists (select * from `products` where `products`.`id` = "orders"."id")',
          bindings: [],
        },
      }
    );
  });

  it('or where exists', () => {
    testsql(
      qb()
        .table('orders')
        .select('*')
        .where('id', '=', 1)
        .orWhereExists((qb) => {
          qb.table('products').select('*')
            .where('products.id', '=', raw('"orders"."id"'));
        }),
      {
        sqlite3: {
          sql: 'select * from `orders` where `id` = ? or exists (select * from `products` where `products`.`id` = "orders"."id")',
          bindings: [1],
        },
      }
    );
  });

  it('or where not exists', () => {
    testsql(
      qb()
        .table('orders')
        .select('*')
        .where('id', '=', 1)
        .orWhereNotExists((qb) => {
          qb.table('products').select('*')
            .where('products.id', '=', raw('"orders"."id"'));
        }),
      {
        sqlite3: {
          sql: 'select * from `orders` where `id` = ? or not exists (select * from `products` where `products`.`id` = "orders"."id")',
          bindings: [1],
        },
      }
    );
  });

  it('cross join', () => {
    testsql(
      qb().table('users').select('*').crossJoin('contracts').crossJoin('photos'),
      {
        sqlite3: {
          sql:
            'select * from `users` cross join `contracts` cross join `photos`',
          bindings: [],
        },
      }
    );
  });

  it('cross join on', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .crossJoin('contracts', 'users.contractId', 'contracts.id'),
      {
        sqlite3: {
          sql:
            'select * from `users` cross join `contracts` on `users`.`contractId` = `contracts`.`id`',
          bindings: [],
        },
      }
    );
  });

  it('basic joins', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .join('contacts', 'users.id', '=', 'contacts.id')
        .leftJoin('photos', 'users.id', '=', 'photos.id'),
      {
        sqlite3: {
          sql: 'select * from `users` inner join `contacts` on `users`.`id` = `contacts`.`id` left join `photos` on `users`.`id` = `photos`.`id`',
          bindings: [],
        },
      }
    );
  });

  it('complex join', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .join('contacts', (qb) => {
          qb.on('users.id', '=', 'contacts.id').orOn(
            'users.name',
            '=',
            'contacts.name'
          );
        }),
      {
        sqlite3: {
          sql: 'select * from `users` inner join `contacts` on `users`.`id` = `contacts`.`id` or `users`.`name` = `contacts`.`name`',
          bindings: [],
        },
      }
    );
  });

  it('complex join with nest conditional statements', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .join('contacts', (qb) => {
          qb.on((qb) => {
            qb.on('users.id', '=', 'contacts.id');
            qb.orOn('users.name', '=', 'contacts.name');
          });
        }),
      {
        sqlite3: {
          sql: 'select * from `users` inner join `contacts` on (`users`.`id` = `contacts`.`id` or `users`.`name` = `contacts`.`name`)',
          bindings: [],
        },
      }
    );
  });

  it('complex join with empty in', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .join('contacts', (qb) => {
          qb.on('users.id', '=', 'contacts.id').onIn('users.name', []);
        }),
      {
        sqlite3: {
          sql: 'select * from `users` inner join `contacts` on `users`.`id` = `contacts`.`id` and 1 = 0',
          bindings: [],
        },
      }
    );
  });

  it('joins with raw', () => {
    testsql(
      qb()
        .table('users')
        .select('*')
        .join('contacts', 'users.id', raw(1))
        .leftJoin('photos', 'photos.title', '=', raw('?', ['My Photo'])),
      {
        sqlite3: {
          sql: 'select * from `users` inner join `contacts` on `users`.`id` = 1 left join `photos` on `photos`.`title` = ?',
          bindings: ['My Photo'],
        },
      }
    );
  });

  it('raw expressions in select', () => {
    testsql(qb().table('users').select(raw('substr(foo, 6)')), {
      sqlite3: {
        sql: 'select substr(foo, 6) from `users`',
        bindings: [],
      },
    });
  });

  it('count', () => {
    testsql(qb().table('users').count(), {
      sqlite3: {
        sql: 'select count(*) from `users`',
        bindings: [],
      },
    });
  });

  it('count distinct', () => {
    testsql(qb().table('users').countDistinct(), {
      sqlite3: {
        sql: 'select count(distinct *) from `users`',
        bindings: [],
      },
    });
  });

  it('count with string alias', () => {
    testsql(qb().table('users').count('* as all'), {
      sqlite3: {
        sql: 'select count(*) as `all` from `users`',
        bindings: [],
      },
    });
  });

  it('count with object alias', () => {
    testsql(qb().table('users').count({ all: '*' }), {
      sqlite3: {
        sql: 'select count(*) as `all` from `users`',
        bindings: [],
      },
    });
  });

  it('count distinct with string alias', () => {
    testsql(qb().table('users').countDistinct('* as all'), {
      sqlite3: {
        sql: 'select count(distinct *) as `all` from `users`',
        bindings: [],
      },
    });
  });

  it('multiple inserts', () => {
    testsql(
      qb()
        .table('users')
        .insert([
          {email: 'foo', name: 'taylor'},
          {email: 'bar', name: 'dayle'},
        ]),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`, `name`) values (?, ?), (?, ?)',
          bindings: ['foo', 'taylor', 'bar', 'dayle'],
        },
      }
    );
  });

  it('multiple inserts with partly undefined keys client with configuration nullAsDefault: true', () => {
    testquery(
      qb()
        .table('users')
        .insert([{email: 'foo', name: 'taylor'}, {name: 'dayle'}]),
      {
        sqlite3:
          "insert into `users` (`email`, `name`) values ('foo', 'taylor'), (NULL, 'dayle')",
      },
      clientsWithNullAsDefault
    );
  });

  it('should not update columns undefined values', async () => {
    testsql(
      qb()
        .update({email: 'foo', name: undefined})
        .table('users')
        .where('id', '=', 1),
      {
        sqlite3: {
          sql: 'update `users` set `email` = ? where `id` = ?',
          bindings: ['foo', 1],
        },
      }
    );
  });

  it("should allow for 'null' updates", () => {
    testsql(
      qb().update({ email: null, name: 'bar' }).table('users').where('id', 1),
      {
        sqlite3: {
          sql: 'update `users` set `email` = ?, `name` = ? where `id` = ?',
          bindings: [null, 'bar', 1],
        },
      }
    );
  });

  it('update method respects raw', () => {
    testsql(
      qb()
        .table('users')
        .where('id', '=', 1)
        .update({ email: raw('foo'), name: 'bar' }),
      {
        sqlite3: {
          sql: 'update `users` set `email` = foo, `name` = ? where `id` = ?',
          bindings: ['bar', 1],
        },
      }
    );
  });

  it('increment method', () => {
    testsql(qb().table('users').where('id', '=', 1).increment('balance', 10), {
      sqlite3: {
        sql: 'update `users` set `balance` = `balance` + ? where `id` = ?',
        bindings: [10, 1],
      },
    });
  });

  it('Calling increment multiple times on same column overwrites the previous value', () => {
    testsql(
      qb()
        .table('users')
        .where('id', '=', 1)
        .increment('balance', 10)
        .increment('balance', 20),
      {
        sqlite3: {
          sql: 'update `users` set `balance` = `balance` + ? where `id` = ?',
          bindings: [20, 1],
        },
      }
    );
  });

  it('Calling increment and then decrement will overwrite the previous value', () => {
    testsql(
      qb()
        .table('users')
        .where('id', '=', 1)
        .increment('balance', 10)
        .decrement('balance', 90),
      {
        sqlite3: {
          sql: 'update `users` set `balance` = `balance` - ? where `id` = ?',
          bindings: [90, 1],
        },
      }
    );
  });

  it('Calling decrement multiple times on same column overwrites the previous value', () => {
    testsql(
      qb()
        .table('users')
        .where('id', '=', 1)
        .decrement('balance', 10)
        .decrement('balance', 20),
      {
        sqlite3: {
          sql: 'update `users` set `balance` = `balance` - ? where `id` = ?',
          bindings: [20, 1],
        },
      }
    );
  });

  it('insert method respects raw bindings', () => {
    testsql(
      qb()
        .table('users')
        .insert({ email: raw('CURRENT TIMESTAMP') }),
      {
        sqlite3: {
          sql: 'insert into `users` (`email`) values (CURRENT TIMESTAMP)',
          bindings: [],
        },
      }
    );
  });

  it('normalizes for missing keys in insert', () => {
    const data = [{a: 1}, {b: 2}, {a: 2, c: 3}];

    //This is done because sqlite3 does not support valueForUndefined, and can't manipulate testsql to use 'clientsWithUseNullForUndefined'.
    //But we still want to make sure that when `useNullAsDefault` is explicitly defined, that the query still works as expected. (Bindings being undefined)
    //It's reset at the end of the test.
    const previousValuesForUndefinedSqlite3 = clients.sqlite3.valueForUndefined;
    clients.sqlite3.valueForUndefined = null;

    testsql(qb().table('table').insert(data), {
      sqlite3: {
        sql:
          'insert into `table` (`a`, `b`, `c`) values (?, ?, ?), (?, ?, ?), (?, ?, ?)',
        bindings: [
          1,
          null,
          null,
          null,
          2,
          null,
          2,
          null,
          3,
        ],
      },
    });
    clients.sqlite3.valueForUndefined = previousValuesForUndefinedSqlite3;
  });

  it('insert with array with empty object and returning', () => {
    testsql(qb().table('users').insert([{}], 'id'), {
      sqlite3: {
        sql: 'insert into `users` default values',
        bindings: [],
      },
    });
  });

  it('insert ignore', () => {
    testsql(
      qb()
        .table('users')
        .insert({email: 'foo'})
        .onConflict('email')
        .ignore(),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`) values (?) on conflict (`email`) do nothing',
          bindings: ['foo'],
        },
      }
    );
  });

  it('insert ignore multiple', () => {
    testsql(
      qb()
        .table('users')
        .insert([{email: 'foo'}, {email: 'bar'}])
        .onConflict('email')
        .ignore(),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`) values (?), (?) on conflict (`email`) do nothing',
          bindings: ['foo', 'bar'],
        },
      }
    );
  });

  it('insert ignore with composite unique keys', () => {
    testsql(
      qb()
        .table('users')
        .insert([{org: 'acme-inc', email: 'foo'}])
        .onConflict(['org', 'email'])
        .ignore(),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`, `org`) values (?, ?) on conflict (`org`, `email`) do nothing',
          bindings: ['foo', 'acme-inc'],
        },
      }
    );
  });

  it('insert merge with explicit updates', () => {
    testsql(
      qb()
        .table('users')
        .insert([
          {email: 'foo', name: 'taylor'},
          {email: 'bar', name: 'dayle'},
        ])
        .onConflict('email')
        .merge({name: 'overidden'}),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`, `name`) values (?, ?), (?, ?) on conflict (`email`) do update set `name` = ?',
          bindings: ['foo', 'taylor', 'bar', 'dayle', 'overidden'],
        },
      }
    );
  });

  it('insert merge with where clause', () => {
    testsql(
      qb()
        .table('users')
        .insert({ email: 'foo', name: 'taylor' })
        .onConflict('email')
        .merge()
        .where('email', 'foo2'),
      {
        sqlite3: {
          sql: 'insert into `users` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name` where `email` = ?',
          bindings: ['foo', 'taylor', 'foo2'],
        },
      }
    );
  });

  it('Calling decrement and then increment will overwrite the previous value', () => {
    testsql(
      qb()
        .table('users')
        .where('id', '=', 1)
        .decrement('balance', 10)
        .increment('balance', 90),
      {
        sqlite3: {
          sql: 'update `users` set `balance` = `balance` + ? where `id` = ?',
          bindings: [90, 1],
        },
      }
    );
  });

  it('Can chain increment / decrement with .update in same build-chain', () => {
    testsql(
      qb()
        .table('users')
        .where('id', '=', 1)
        .update({
          email: 'foo@bar.com',
        })
        .increment('balance', 10)
        .decrement('subbalance', 100),
      {
        sqlite3: {
          sql: 'update `users` set `email` = ?, `balance` = `balance` + ?, `subbalance` = `subbalance` - ? where `id` = ?',
          bindings: ['foo@bar.com', 10, 100, 1],
        },
      }
    );
  });

  it('Can chain increment / decrement with .update in same build-chain and ignores increment/decrement if column is also supplied in .update', () => {
    testsql(
      qb()
        .table('users')
        .where('id', '=', 1)
        .update({
          balance: 500,
        })
        .increment('balance', 10)
        .decrement('balance', 100),
      {
        sqlite3: {
          sql: 'update `users` set `balance` = ? where `id` = ?',
          bindings: [500, 1],
        },
      }
    );
  });

  it('Can use object syntax for increment/decrement', () => {
    testsql(
      qb()
        .table('users')
        .where('id', '=', 1)
        .increment({balance: 10, times: 1})
        .decrement({value: 50, subvalue: 30}),
      {
        sqlite3: {
          sql: 'update `users` set `balance` = `balance` + ?, `times` = `times` + ?, `value` = `value` - ?, `subvalue` = `subvalue` - ? where `id` = ?',
          bindings: [10, 1, 50, 30, 1],
        },
      }
    );
  });

  it('increment method with floats', () => {
    testsql(qb().table('users').where('id', '=', 1).increment('balance', 1.23), {
      sqlite3: {
        sql: 'update `users` set `balance` = `balance` + ? where `id` = ?',
        bindings: [1.23, 1],
      },
    });
  });

  it('decrement method', () => {
    testsql(qb().table('users').where('id', '=', 1).decrement('balance', 10), {
      sqlite3: {
        sql: 'update `users` set `balance` = `balance` - ? where `id` = ?',
        bindings: [10, 1],
      },
    });
  });

  it('decrement method with floats', () => {
    testsql(qb().table('users').where('id', '=', 1).decrement('balance', 1.23), {
      sqlite3: {
        sql: 'update `users` set `balance` = `balance` - ? where `id` = ?',
        bindings: [1.23, 1],
      },
    });
  });

  it('delete method', () => {
    testsql(qb().table('users').where('email', '=', 'foo').delete(), {
      sqlite3: {
        sql: 'delete from `users` where `email` = ?',
        bindings: ['foo'],
      },
    });
  });

  it('truncate method', () => {
    testsql(qb().table('users').truncate(), {
      sqlite3: {
        sql: 'delete from `users`',
        bindings: [],
        output: (output) => {
          expect(typeof output).to.equal('function');
        },
      },
    });
  });

  it('wrapping', () => {
    testsql(qb().table('users').select('*'), {
      sqlite3: 'select * from `users`',
    });
  });

  it('order by desc', () => {
    testsql(qb().table('users').select('*').orderBy('email', 'desc'), {
      sqlite3: 'select * from `users` order by `email` desc',
    });
  });

  it('providing null or false as second parameter builds correctly', () => {
    testsql(qb().table('users').select('*').where('foo', null), {
      sqlite3: 'select * from `users` where `foo` is null',
    });
  });

  it('allows insert values of sub-select, #121', () => {
    testsql(
      qb()
        .table('entries')
        .insert({
          secret: 123,
          sequence: qb().table('entries').count('*').where('secret', 123),
        }),
      {
        sqlite3: {
          sql: 'insert into `entries` (`secret`, `sequence`) values (?, (select count(*) from `entries` where `secret` = ?))',
          bindings: [123, 123],
        },
      }
    );
  });

  it('should not break with null call #182', () => {
    testsql(qb().table('test').limit(null).offset(null), {
      sqlite3: {
        sql: 'select * from `test`',
        bindings: [],
      },
    });
  });

  it('should throw warning with null call in limit', function () {
    try {
      testsql(
        qb().table('test').limit(null),
        {
          sqlite3: {
            sql: 'select * from `test`',
            bindings: [],
          },
        },
        clientsWithCustomLoggerForTestWarnings
      );
    } catch (error) {
      expect(error.message).to.equal(
        'A valid integer must be provided to limit'
      );
    }
  });

  it('should do nothing with offset when passing null', () => {
    testsql(qb().table('test').limit(10).offset(null), {
      sqlite3: {
        sql: 'select * from `test` limit ?',
        bindings: [10],
      },
    });
  });

  it('should throw warning with wrong value call in offset', function () {
    try {
      testsql(
        qb().table('test').limit(10)
          .offset('$10'),
        {
          sqlite3: {
            sql: 'select * from `test` limit ?',
            bindings: [10],
          },
        },
        clientsWithCustomLoggerForTestWarnings
      );
    } catch (error) {
      expect(error.message).to.equal(
        'A valid integer must be provided to offset'
      );
    }
  });

  // it('allows passing builder into where clause, #162', () => {
  //   const chain = qb().table('chapter').select('id').where('book', 1);
  //   const page = qb().table('page').select('id').whereIn('chapter_id', chain);
  //   const word = qb().table('word').select('id').whereIn('page_id', page);
  //   const three = chain.delete();
  //   const two = page.delete();
  //   const one = word.delete();
  //
  //   testsql(one, {
  //     sqlite3: {
  //       sql: 'delete from `word` where `page_id` in (select `id` from `page` where `chapter_id` in (select `id` from `chapter` where `book` = ?))',
  //       bindings: [1],
  //     },
  //   });
  //
  //   testsql(two, {
  //     sqlite3: {
  //       sql: 'delete from `page` where `chapter_id` in (select `id` from `chapter` where `book` = ?)',
  //       bindings: [1],
  //     },
  //   });
  //
  //   testsql(three, {
  //     sqlite3: {
  //       sql: 'delete from `chapter` where `book` = ?',
  //       bindings: [1],
  //     },
  //   });
  // });

  it('supports capitalized operators', () => {
    testsql(qb().table('users').select('*').where('name', 'LIKE', '%test%'), {
      sqlite3: {
        sql: 'select * from `users` where `name` like ?',
        bindings: ['%test%'],
      },
    });
  });

  it('throws if you try to use an invalid operator', () => {
    expect(() => {
      qb().select('*').where('id', 'isnt', 1).toString();
    }).to.throw('The operator "isnt" is not permitted');
  });

  it('throws if you try to use an invalid operator in an inserted statement', () => {
    const obj = qb().select('*').where('id', 'isnt', 1);
    expect(() => {
      qb().table('users').select('*').where('id', 'in', obj).toString();
    }).to.throw('The operator "isnt" is not permitted');
  });

  it('#287 - wraps correctly for arrays', () => {
    // arrays only work for postgres
    testsql(
      qb()
        .table('value')
        .select('*')
        .join('table', 'table.array_column[1]', '=', raw('?', 1)),
      {
        sqlite3: {
          sql: 'select * from `value` inner join `table` on `table`.`array_column[1]` = ?',
          bindings: [1],
        },
      }
    );
  });

  it('allows select as syntax', () => {
    testsql(
      qb()
        .table('employee as e')
        .select(
          'e.lastname',
          'e.salary',
          qb()
            .table('employee')
            .select('avg(salary)')
            .whereRaw('dept_no = e.dept_no')
            .as('avg_sal_dept')
        )
        .where('dept_no', '=', 'e.dept_no'),
      {
        sqlite3: {
          sql: 'select `e`.`lastname`, `e`.`salary`, (select `avg(salary)` from `employee` where dept_no = e.dept_no) as `avg_sal_dept` from `employee` as `e` where `dept_no` = ?',
          bindings: ['e.dept_no'],
        },
      }
    );
  });

  it('allows function for subselect column', () => {
    testsql(
      qb()
        .table('employee as e')
        .select('e.lastname', 'e.salary')
        .select(function () {
          this.table('employee').select('avg(salary)')
            .whereRaw('dept_no = e.dept_no')
            .as('avg_sal_dept');
        })
        .where('dept_no', '=', 'e.dept_no'),
      {
        sqlite3: {
          sql: 'select `e`.`lastname`, `e`.`salary`, (select `avg(salary)` from `employee` where dept_no = e.dept_no) as `avg_sal_dept` from `employee` as `e` where `dept_no` = ?',
          bindings: ['e.dept_no'],
        },
      }
    );
  });

  it('allows first as syntax', () => {
    testsql(
      qb()
        .table('employee as e')
        .select(
          'e.lastname',
          'e.salary',
          qb()
            .table('employee')
            .first('salary')
            .whereRaw('dept_no = e.dept_no')
            .orderBy('salary', 'desc')
            .as('top_dept_salary')
        )
        .where('dept_no', '=', 'e.dept_no'),
      {
        sqlite3: {
          sql: 'select `e`.`lastname`, `e`.`salary`, (select `salary` from `employee` where dept_no = e.dept_no order by `salary` desc limit ?) as `top_dept_salary` from `employee` as `e` where `dept_no` = ?',
          bindings: [1, 'e.dept_no'],
        },
      }
    );
  });

  it('should always wrap subquery with parenthesis', () => {
    const subquery = qb().select(raw('?', ['inner raw select']), 'bar');
    testsql(
      qb()
        .table(subquery)
        .select(raw('?', ['outer raw select'])),
      {
        sqlite3: {
          sql: 'select ? from (select ?, `bar`)',
          bindings: ['outer raw select', 'inner raw select'],
        },
      }
    );
  });

  it('correctly orders parameters when selecting from subqueries, #704', () => {
    const subquery = qb()
      .select(raw('? as f', ['inner raw select']))
      .as('g');
    testsql(
      qb()
        .table(subquery)
        .select(raw('?', ['outer raw select']), 'g.f')
        .where('g.secret', 123),
      {
        sqlite3: {
          sql: 'select ?, `g`.`f` from (select ? as f) as `g` where `g`.`secret` = ?',
          bindings: ['outer raw select', 'inner raw select', 123],
        },
      }
    );
  });

  it('escapes queries properly, #737', () => {
    testsql(qb().table('test`').select('id","name', 'id`name'), {
      sqlite3: {
        sql: 'select `id","name`, `id``name` from `test```',
        bindings: [],
      },
    });
  });

  it('Allows for empty where #749', () => {
    testsql(
      qb()
        .table('tbl')
        .select('foo')
        .where(() => {}),
      {sqlite3: 'select `foo` from `tbl`'}
    );
  });

  //TODO fix
  // it('escapes single quotes properly', () => {
  //   testquery(qb().table('users').select('*').where('last_name', "O'Brien"), {
  //     sqlite3: "select * from `users` where `last_name` = 'O\\'Brien'",
  //   });
  // });

  it('allows join without operator and with value 0 #953', () => {
    testsql(qb().table('users').select('*').join('photos', 'photos.id', 0), {
      sqlite3: {
        sql: 'select * from `users` inner join `photos` on `photos`.`id` = 0',
      },
    });
  });

  it('allows join with operator and with value 0 #953', () => {
    testsql(
      qb().table('users').select('*').join('photos', 'photos.id', '>', 0),
      {
        sqlite3: {
          sql: 'select * from `users` inner join `photos` on `photos`.`id` > 0',
        },
      }
    );
  });

  it('where with date object', () => {
    const date = new Date();
    testsql(qb().table('users').select('*').where('birthday', '>=', date), {
      sqlite3: {
        sql: 'select * from `users` where `birthday` >= ?',
        bindings: [date],
      },
    });
  });

  it('raw where with date object', () => {
    const date = new Date();
    testsql(qb().table('users').select('*').whereRaw('birthday >= ?', date), {
      sqlite3: {
        sql: 'select * from `users` where birthday >= ?',
        bindings: [date],
      },
    });
  });

  it('#965 - .raw accepts Array and Non-Array bindings', () => {
    const expected = (fieldName, expectedBindings) => ({
      sqlite3: {
        sql: 'select * from `users` where ' + fieldName + ' = ?',
        bindings: expectedBindings,
      },
    });

    //String
    testsql(
      qb().table('users').select('*').where(raw('username = ?', 'knex')),
      expected('username', ['knex'])
    );
    testsql(
      qb()
        .table('users')
        .select('*')
        .where(raw('username = ?', ['knex'])),
      expected('username', ['knex'])
    );

    //Number
    testsql(
      qb().table('users').select('*').where(raw('isadmin = ?', 0)),
      expected('isadmin', [0])
    );
    testsql(
      qb()
        .table('users')
        .select('*')
        .where(raw('isadmin = ?', [1])),
      expected('isadmin', [1])
    );

    //Date
    const date = new Date(2016, 0, 5, 10, 19, 30, 599);
    const sqlUpdTime = '2016-01-05 10:19:30.599';
    testsql(
      qb().table('users').select('*').where(raw('updtime = ?', date)),
      expected('updtime', [date])
    );
    testsql(
      qb()
        .table('users')
        .select('*')
        .where(raw('updtime = ?', [date])),
      expected('updtime', [date])
    );
    testquery(qb().table('users').select('*').where(raw('updtime = ?', date)), {
      sqlite3: "select * from `users` where updtime = '" + sqlUpdTime + "'",
    });
  });

  it('#1118 orWhere({..}) generates or (and - and - and)', () => {
    testsql(
      qb().table('users').select('*').where('id', '=', 1).orWhere({
        email: 'foo',
        id: 2,
      }),
      {
        sqlite3: {
          sql: 'select * from `users` where `id` = ? or (`email` = ? and `id` = ?)',
          bindings: [1, 'foo', 2],
        },
      }
    );
  });

  it('#1228 Named bindings', () => {

    const namedBindings = {
      name: 'users.name',
      thisGuy: 'Bob',
      otherGuy: 'Jay',
    };
    const sqlite3 = clients.sqlite3;

    const sqliteQb = sqlite3
      .queryBuilder()
      .table('users')
      .select('*')
      .where(
        sqlite3.raw(':name: = :thisGuy or :name: = :otherGuy', namedBindings)
      )
      .toSQL();

    expect(sqliteQb.sql).to.equal(
      'select * from `users` where `users`.`name` = ? or `users`.`name` = ?'
    );
    expect(sqliteQb.bindings).to.deep.equal(['Bob', 'Jay']);
  });

  it('#1268 - valueForUndefined should be in toSQL(QueryCompiler)', () => {

    expect(() => {
      clients.sqlite3
        .table('users')
        .queryBuilder()
        .insert([{ id: void 0 }])
        .toString();
    }).to.throw(TypeError);

    expect(() => {
      clientsWithNullAsDefault.sqlite3
        .queryBuilder()
        .table('users')
        .insert([{ id: void 0 }])
        .toString();
    }).to.not.throw(TypeError);
  });

  it('#1402 - raw should take "not" into consideration in querybuilder', () => {
    testsql(qb().table('testtable').whereNot(raw('is_active')), {
      sqlite3: {
        sql: 'select * from `testtable` where not is_active',
        bindings: [],
      },
    });
  });

  it('Any undefined binding in a RAW query should throw an error', () => {
    const raws = [
      { query: raw('?', [undefined]), undefinedIndices: [0] },
      {
        query: raw(':col = :value', { col: 'test', value: void 0 }),
        undefinedIndices: ['value'],
      },
      { query: raw('? = ?', ['test', void 0]), undefinedIndices: [1] },
      {
        query: raw('? = ?', ['test', { test: void 0 }]),
        undefinedIndices: [1],
      },
      { query: raw('?', [['test', void 0]]), undefinedIndices: [0] },
    ];
    raws.forEach(({ query, undefinedIndices }) => {
      try {
        query.toSQL();
        expect(true).to.equal(
          false,
          'Expected to throw error in compilation about undefined bindings.'
        );
      } catch (error) {
        const expectedErrorMessageContains = `Undefined binding(s) detected for keys [${undefinedIndices.join(
          ', '
        )}] when compiling RAW query:`;
        expect(error.message).to.contain(expectedErrorMessageContains); //This test is not for asserting correct queries
      }
    });
  });

  it("wrapped 'with' clause select", () => {
    testsql(
      qb()
        .table('withClause')
        .with('withClause', function () {
          this.table('users').select('foo');
        })
        .select('*'),
      {
        sqlite3:
          'with `withClause` as (select `foo` from `users`) select * from `withClause`',
      }
    );
  });

  it("wrapped 'with' clause insert", () => {
    testsql(
      qb()
        .table('users')
        .with('withClause', function () {
          this.table('users').select('foo');
        })
        .insert(raw('select * from "withClause"')),
      {
        sqlite3:
          'with `withClause` as (select `foo` from `users`) insert into `users` select * from "withClause"',
      }
    );
  });

  it("wrapped 'with' clause multiple insert", () => {
    testsql(
      qb()
        .table('users')
        .with('withClause', function () {
          this.table('users').select('foo').where({name: 'bob'});
        })
        .insert([
          {email: 'thisMail', name: 'sam'},
          {email: 'thatMail', name: 'jack'},
        ]),
      {
        sqlite3: {
          sql:
            'with `withClause` as (select `foo` from `users` where `name` = ?) insert into `users` (`email`, `name`) values (?, ?), (?, ?)',
          bindings: ['bob', 'thisMail', 'sam', 'thatMail', 'jack'],
        },
      }
    );
  });

  it("wrapped 'with' clause update", () => {
    testsql(
      qb()
        .table('users')
        .with('withClause', function () {
          this.table('users').select('foo');
        })
        .update({foo: 'updatedFoo'})
        .where('email', '=', 'foo'),
      {
        sqlite3:
          'with `withClause` as (select `foo` from `users`) update `users` set `foo` = ? where `email` = ?',
      }
    );
  });

  it("wrapped 'with' clause delete", () => {
    testsql(
      qb()
        .table('users')
        .with('withClause', function () {
          this.table('users').select('email');
        })
        .delete()
        .where('foo', '=', 'updatedFoo'),
      {
        sqlite3:
          'with `withClause` as (select `email` from `users`) delete from `users` where `foo` = ?',
      }
    );
  });

  it("raw 'with' clause", () => {
    testsql(
      qb()
        .table('withRawClause')
        .with('withRawClause', raw('select "foo" as "baz" from "users"'))
        .select('*'),
      {
        sqlite3:
          'with `withRawClause` as (select "foo" as "baz" from "users") select * from `withRawClause`',
      }
    );
  });

  it("chained wrapped 'with' clause", () => {
    testsql(
      qb()
        .table('secondWithClause')
        .with('firstWithClause', function () {
          this.table('users').select('foo');
        })
        .with('secondWithClause', function () {
          this.table('users').select('bar');
        })
        .select('*'),
      {
        sqlite3:
          'with `firstWithClause` as (select `foo` from `users`), `secondWithClause` as (select `bar` from `users`) select * from `secondWithClause`',
      }
    );
  });

  it("nested 'with' clause", () => {
    testsql(
      qb()
        .table('withClause')
        .with('withClause', function () {
          this.table('withSubClause').with('withSubClause', function () {
            this.table('users').select('foo').as('baz');
          })
            .select('*');
        })
        .select('*'),
      {
        sqlite3:
          'with `withClause` as (with `withSubClause` as ((select `foo` from `users`) as `baz`) select * from `withSubClause`) select * from `withClause`',
      }
    );
  });

  it("nested 'with' clause with bindings", () => {
    testsql(
      qb()
        .table('withClause')
        .with('withClause', function () {
          this.table('withSubClause').with(
            'withSubClause',
            raw(
              'select "foo" as "baz" from "users" where "baz" > ? and "baz" < ?',
              [1, 20]
            )
          )
            .select('*');
        })
        .select('*')
        .where({id: 10}),
      {
        sqlite3: {
          sql:
            'with `withClause` as (with `withSubClause` as (select "foo" as "baz" from "users" where "baz" > ? and "baz" < ?) select * from `withSubClause`) select * from `withClause` where `id` = ?',
          bindings: [1, 20, 10],
        },
      }
    );
  });

  it('should return dialect specific sql and bindings with  toSQL().toNative()', () => {
    testNativeSql(qb().table('table').where('isIt', true), {
      sqlite3: {
        sql: 'select * from `table` where `isIt` = ?',
        bindings: [true],
      },
    });
  });

  it("nested and chained wrapped 'with' clause", () => {
    testsql(
      qb()
        .table('secondWithClause')
        .with('firstWithClause', function () {
          this.table('firstWithSubClause').with('firstWithSubClause', function () {
            this.table('users').select('foo').as('foz');
          }).select('*');
        })
        .with('secondWithClause', function () {
          this.table('secondWithSubClause').with('secondWithSubClause', function () {
            this.table('users').select('bar').as('baz');
          }).select('*');
        })
        .select('*'),
      {
        sqlite3:
          'with `firstWithClause` as (with `firstWithSubClause` as ((select `foo` from `users`) as `foz`) select * from `firstWithSubClause`), `secondWithClause` as (with `secondWithSubClause` as ((select `bar` from `users`) as `baz`) select * from `secondWithSubClause`) select * from `secondWithClause`',
      }
    );
  });

  it("nested and chained wrapped 'withRecursive' clause", () => {
    testsql(
      qb()
        .table('secondWithClause')
        .withRecursive('firstWithClause', function () {
          this.table('firstWithSubClause')
            .withRecursive('firstWithSubClause', function () {
              this.table('users').select('foo').as('foz');
            }).select('*')
        })
        .withRecursive('secondWithClause', function () {
          this.table('secondWithSubClause').withRecursive('secondWithSubClause', function () {
            this.table('users').select('bar').as('baz');
          }).select('*')
        })
        .select('*'),
      {
        sqlite3:
          'with recursive `firstWithClause` as (with recursive `firstWithSubClause` as ((select `foo` from `users`) as `foz`) select * from `firstWithSubClause`), `secondWithClause` as (with recursive `secondWithSubClause` as ((select `bar` from `users`) as `baz`) select * from `secondWithSubClause`) select * from `secondWithClause`',
      }
    );
  });

  it('Throws error if .update() results in faulty sql due to no data', () => {
    try {
      qb().table('sometable').update({ foobar: undefined }).toString();
      throw new Error('Should not reach this point');
    } catch (error) {
      expect(error.message).to.equal(
        'Empty .update() call detected! Update data does not contain any values to update. This will result in a faulty query. Table: sometable. Columns: foobar.'
      );
    }
  });

  it('Throws error if .first() is called on update', () => {
    try {
      qb().table('sometable').update({ column: 'value' }).first().toSQL();

      throw new Error('Should not reach this point');
    } catch (error) {
      expect(error.message).to.equal('Cannot chain .first() on "update" query!');
    }
  });

  it('Throws error if .first() is called on insert', () => {
    try {
      qb().table('sometable').insert({ column: 'value' }).first().toSQL();

      throw new Error('Should not reach this point');
    } catch (error) {
      expect(error.message).to.equal('Cannot chain .first() on "insert" query!');
    }
  });

  it('Throws error if .first() is called on delete', () => {
    try {
      qb().table('sometable').delete().first().toSQL();

      throw new Error('Should not reach this point');
    } catch (error) {
      expect(error.message).to.equal('Cannot chain .first() on "del" query!');
    }
  });

  it('Can call knex.select(0)', () => {
    testquery(qb().select(0), {
      sqlite3: 'select 0',
    });
  });

  it('should warn to user when use `.returning()` function in SQLite3', () => {
    const loggerConfigForTestingWarnings = {
      log: {
        warn: (message) => {
          if (
            message ===
            '.returning() is not supported by sqlite3 and will not have any effect.'
          ) {
            throw new Error(message);
          }
        },
      },
    };

    const sqlite3ClientForWarnings = new SQLite3_Client(
      Object.assign({client: 'sqlite3'}, loggerConfigForTestingWarnings)
    );

    expect(() => {
      testsql(
        qb().table('users').insert({email: 'foo'}).returning('id'),
        {
          sqlite3: {
            sql: 'insert into `users` (`email`) values (?)',
            bindings: ['foo'],
          },
        },
        {
          sqlite3: sqlite3ClientForWarnings,
        }
      );
    }).to.throw(Error);
  });

  it('join with onVal andOnVal orOnVal', () => {
    testsql(
      qb()
        .table({ p: 'wp_posts' })
        .select({
          id: 'p.ID',
          status: 'p.post_status',
          name: 'p.post_title',
          // type: 'terms.name',
          price: 'price.meta_value',
          createdAt: 'p.post_date_gmt',
          updatedAt: 'p.post_modified_gmt',
        })
        .leftJoin({ price: 'wp_postmeta' }, function () {
          this.on('p.id', '=', 'price.post_id')
            .onVal(function () {
              this.onVal('price.meta_key', '_regular_price').andOnVal(
                'price_meta_key',
                '_regular_price'
              );
            })
            .orOnVal(function () {
              this.onVal('price_meta.key', '_regular_price');
            });
        }),
      {
        sqlite3: {
          sql: 'select `p`.`ID` as `id`, `p`.`post_status` as `status`, `p`.`post_title` as `name`, `price`.`meta_value` as `price`, `p`.`post_date_gmt` as `createdAt`, `p`.`post_modified_gmt` as `updatedAt` from `wp_posts` as `p` left join `wp_postmeta` as `price` on `p`.`id` = `price`.`post_id` and (`price`.`meta_key` = ? and `price_meta_key` = ?) or (`price_meta`.`key` = ?)',
          bindings: ['_regular_price', '_regular_price', '_regular_price'],
        },
      }
    );

    testsql(
      qb()
        .table({ p: 'wp_posts' })
        .select({
          id: 'p.ID',
          status: 'p.post_status',
          name: 'p.post_title',
          // type: 'terms.name',
          price: 'price.meta_value',
          createdAt: 'p.post_date_gmt',
          updatedAt: 'p.post_modified_gmt',
        })
        .leftJoin({ price: 'wp_postmeta' }, (builder) => {
          builder
            .onVal((q) => {
              q.onVal('price.meta_key', '_regular_price').andOnVal(
                'price_meta_key',
                '_regular_price'
              );
            })
            .orOnVal((q) => {
              q.onVal('price_meta.key', '_regular_price');
            });
        }),
      {
        sqlite3: {
          sql: 'select `p`.`ID` as `id`, `p`.`post_status` as `status`, `p`.`post_title` as `name`, `price`.`meta_value` as `price`, `p`.`post_date_gmt` as `createdAt`, `p`.`post_modified_gmt` as `updatedAt` from `wp_posts` as `p` left join `wp_postmeta` as `price` on (`price`.`meta_key` = ? and `price_meta_key` = ?) or (`price_meta`.`key` = ?)',
          bindings: ['_regular_price', '_regular_price', '_regular_price'],
        },
      }
    );
  });

  it('having between', () => {
    testsql(qb().table('users').select('*').havingBetween('baz', [5, 10]), {
      sqlite3: 'select * from `users` having `baz` between ? and ?',
    });
  });

  // TODO fix
  // it('should include join when deleting', () => {
  //   testsql(
  //     qb()
  //       .table('users')
  //       .delete()
  //       .join('photos', 'photos.id', 'users.id')
  //       .where({ 'user.email': 'mock@test.com' }),
  //     {
  //       sqlite3: {
  //         sql: 'delete `users` from `users` inner join `photos` on `photos`.`id` = `users`.`id` where `user`.`email` = ?',
  //         bindings: ['mock@test.com'],
  //       },
  //     }
  //   );
  // });
});
