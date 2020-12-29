/*eslint no-var:0, indent:0, max-len:0 */
'use strict';

const { expect } = require('chai');
const SQLite3_Client = require('../../../lib/dialects/sqlite3/sqlite3');

// use driverName as key
const clients = {
  sqlite3: new SQLite3_Client({ client: 'sqlite3' }),
};

const useNullAsDefaultConfig = { useNullAsDefault: true };
// use driverName as key
const clientsWithNullAsDefault = {
  sqlite3: new SQLite3_Client(
    Object.assign({ client: 'sqlite3' }, useNullAsDefaultConfig)
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
      { client: 'sqlite3' },
      { ...customLoggerConfig, ...useNullAsDefaultConfig }
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
      verifySqlResult(key, { sql: checkValue }, sqlAndBindings);
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
    expect(checkValue).to.equal(sqlString);
  });
}

describe('Custom identifier wrapping', () => {
  const customWrapperConfig = {
    wrapIdentifier: (value, clientImpl, context) => {
      let suffix = '_wrapper_was_here';
      if (context && context.fancy) {
        suffix = '_fancy_wrapper_was_here';
      }
      return clientImpl(value + suffix);
    },
  };

  // use driverName as key
  const clientsWithCustomIdentifierWrapper = {
    sqlite3: new SQLite3_Client(
      Object.assign({ client: 'sqlite3' }, customWrapperConfig)
    ),
  };

});

describe('QueryBuilder', () => {
  it('less trivial case of object alias syntax', () => {
    testsql(
      qb()
        .select({
          bar: 'table1.*',
          subq: qb()
            .from('test')
            .select(raw('??', [{ a: 'col1', b: 'col2' }]))
            .limit(1),
        })
        .from({
          table1: 'table',
          table2: 'table',
          subq: qb().from('test').limit(1),
        }),
      {
        sqlite3:
          'select `table1`.* as `bar`, (select `col1` as `a`, `col2` as `b` from `test` limit ?) as `subq` from `table` as `table1`, `table` as `table2`, (select * from `test` limit ?) as `subq`',
      }
    );
  });

  it('where bool', () => {
    testquery(qb().select('*').from('users').where(true), {
      sqlite3: 'select * from `users` where 1 = 1',
    });
  });

  it('multi column where ins', () => {
    testsql(
      qb()
        .select('*')
        .from('users')
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

  it('whereIn with empty array, #477', () => {
    testsql(qb().select('*').from('users').whereIn('id', []), {
      sqlite3: {
        sql: 'select * from `users` where 1 = ?',
        bindings: [0],
      },
    });
  });

  it('whereNotIn with empty array, #477', () => {
    testsql(qb().select('*').from('users').whereNotIn('id', []), {
      sqlite3: {
        sql: 'select * from `users` where 1 = ?',
        bindings: [1],
      },
    });
  });

  it('intersects', () => {
    const chain = qb()
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .intersect(function () {
        this.select('*').from('users').where('id', '=', 2);
      });

    testsql(chain, {
      sqlite3: {
        sql:
          'select * from `users` where `id` = ? intersect select * from `users` where `id` = ?',
        bindings: [1, 2],
      },
    });

    const multipleArgumentsChain = qb()
      .select('*')
      .from('users')
      .where({ id: 1 })
      .intersect(
        function () {
          this.select('*').from('users').where({ id: 2 });
        },
        function () {
          this.select('*').from('users').where({ id: 3 });
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
      .select('*')
      .from('users')
      .where({ id: 1 })
      .intersect([
        function () {
          this.select('*').from('users').where({ id: 2 });
        },
        function () {
          this.select('*').from('users').where({ id: 3 });
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


  it('order by accepts query builder', () => {
    testsql(
      qb()
        .select()
        .from('persons')
        .orderBy(
          qb()
            .select()
            .from('persons as p')
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

  it('offsets only', () => {
    testsql(qb().select('*').from('users').offset(5), {
      sqlite3: {
        sql: 'select * from `users` limit ? offset ?',
        bindings: [-1, 5],
      },
    });
  });


  it('cross join', () => {
    testsql(
      qb().select('*').from('users').crossJoin('contracts').crossJoin('photos'),
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
        .select('*')
        .from('users')
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


  it('multiple inserts', () => {
    testsql(
      qb()
        .from('users')
        .insert([
          { email: 'foo', name: 'taylor' },
          { email: 'bar', name: 'dayle' },
        ]),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`, `name`) select ? as `email`, ? as `name` union all select ? as `email`, ? as `name`',
          bindings: ['foo', 'taylor', 'bar', 'dayle'],
        },
      }
    );
  });

  it('multiple inserts with partly undefined keys client with configuration nullAsDefault: true', () => {
    testquery(
      qb()
        .from('users')
        .insert([{ email: 'foo', name: 'taylor' }, { name: 'dayle' }]),
      {
        sqlite3:
          "insert into `users` (`email`, `name`) select 'foo' as `email`, 'taylor' as `name` union all select NULL as `email`, 'dayle' as `name`",
      },
      clientsWithNullAsDefault
    );
  });

  it('multiple inserts with partly undefined keys throw error with sqlite', () => {
    expect(() => {
      testquery(
        qb()
          .from('users')
          .insert([{ email: 'foo', name: 'taylor' }, { name: 'dayle' }]),
        {
          sqlite3: '',
        }
      );
    }).to.throw(TypeError);
  });

  it('multiple inserts with returning', () => {
    // returning only supported directly by postgres and with workaround with oracle
    // other databases implicitly return the inserted id
    testsql(
      qb()
        .from('users')
        .insert(
          [
            { email: 'foo', name: 'taylor' },
            { email: 'bar', name: 'dayle' },
          ],
          'id'
        ),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`, `name`) select ? as `email`, ? as `name` union all select ? as `email`, ? as `name`',
        },
      }
    );
  });

  it('multiple inserts with multiple returning', () => {
    testsql(
      qb()
        .from('users')
        .insert(
          [
            { email: 'foo', name: 'taylor' },
            { email: 'bar', name: 'dayle' },
          ],
          ['id', 'name']
        ),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`, `name`) select ? as `email`, ? as `name` union all select ? as `email`, ? as `name`',
          bindings: ['foo', 'taylor', 'bar', 'dayle'],
        },
      }
    );
  });

  it('normalizes for missing keys in insert', () => {
    const data = [{ a: 1 }, { b: 2 }, { a: 2, c: 3 }];

    //This is done because sqlite3 does not support valueForUndefined, and can't manipulate testsql to use 'clientsWithUseNullForUndefined'.
    //But we still want to make sure that when `useNullAsDefault` is explicitly defined, that the query still works as expected. (Bindings being undefined)
    //It's reset at the end of the test.
    const previousValuesForUndefinedSqlite3 = clients.sqlite3.valueForUndefined;
    clients.sqlite3.valueForUndefined = null;

    testsql(qb().insert(data).into('table'), {
      sqlite3: {
        sql:
          'insert into `table` (`a`, `b`, `c`) select ? as `a`, ? as `b`, ? as `c` union all select ? as `a`, ? as `b`, ? as `c` union all select ? as `a`, ? as `b`, ? as `c`',
        bindings: [
          1,
          undefined,
          undefined,
          undefined,
          2,
          undefined,
          2,
          undefined,
          3,
        ],
      },
    });
    clients.sqlite3.valueForUndefined = previousValuesForUndefinedSqlite3;
  });

  it('insert with array with empty object and returning', () => {
    testsql(qb().into('users').insert([{}], 'id'), {
      sqlite3: {
        sql: 'insert into `users` default values',
        bindings: [],
      },
    });
  });

  it('insert ignore', () => {
    testsql(
      qb()
        .insert({ email: 'foo' })
        .onConflict('email')
        .ignore()
        .into('users'),
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
        .insert([{ email: 'foo' }, { email: 'bar' }])
        .onConflict('email')
        .ignore()
        .into('users'),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`) select ? as `email` union all select ? as `email` where true on conflict (`email`) do nothing',
          bindings: ['foo', 'bar'],
        },
      }
    );
  });

  it('insert ignore with composite unique keys', () => {
    testsql(
      qb()
        .insert([{ org: 'acme-inc', email: 'foo' }])
        .onConflict(['org', 'email'])
        .ignore()
        .into('users'),
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
        .from('users')
        .insert([
          { email: 'foo', name: 'taylor' },
          { email: 'bar', name: 'dayle' },
        ])
        .onConflict('email')
        .merge({ name: 'overidden' }),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`, `name`) select ? as `email`, ? as `name` union all select ? as `email`, ? as `name` where true on conflict (`email`) do update set `name` = ?',
          bindings: ['foo', 'taylor', 'bar', 'dayle', 'overidden'],
        },
      }
    );
  });

  it('insert merge multiple with implicit updates', () => {
    testsql(
      qb()
        .from('users')
        .insert([
          { email: 'foo', name: 'taylor' },
          { email: 'bar', name: 'dayle' },
        ])
        .onConflict('email')
        .merge(),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`, `name`) select ? as `email`, ? as `name` union all select ? as `email`, ? as `name` where true on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name`',
          bindings: ['foo', 'taylor', 'bar', 'dayle'],
        },
      }
    );
  });

  it('insert merge with where clause', () => {
    testsql(
      qb()
        .from('users')
        .insert({ email: 'foo', name: 'taylor' })
        .onConflict('email')
        .merge()
        .where('email', 'foo2'),
      {
        sqlite3: {
          sql:
            'insert into `users` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name` where `email` = ?',
          bindings: ['foo', 'taylor', 'foo2'],
        },
      }
    );
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

  it('#1228 Named bindings', () => {

    const namedBindings = {
      name: 'users.name',
      thisGuy: 'Bob',
      otherGuy: 'Jay',
    };
    const sqlite3 = clients.sqlite3;

    const sqliteQb = sqlite3
      .queryBuilder()
      .select('*')
      .from('users')
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
        .queryBuilder()
        .insert([{ id: void 0 }])
        .into('users')
        .toString();
    }).to.throw(TypeError);

    expect(() => {
      clientsWithNullAsDefault.sqlite3
        .queryBuilder()
        .insert([{ id: void 0 }])
        .into('users')
        .toString();
    }).to.not.throw(TypeError);
  });

  it("wrapped 'with' clause select", () => {
    testsql(
      qb()
        .with('withClause', function () {
          this.select('foo').from('users');
        })
        .select('*')
        .from('withClause'),
      {
        sqlite3:
          'with `withClause` as (select `foo` from `users`) select * from `withClause`',
      }
    );
  });

  it("wrapped 'with' clause insert", () => {
    testsql(
      qb()
        .with('withClause', function () {
          this.select('foo').from('users');
        })
        .insert(raw('select * from "withClause"'))
        .into('users'),
      {
        sqlite3:
          'with `withClause` as (select `foo` from `users`) insert into `users` select * from "withClause"',
      }
    );
  });

  it("wrapped 'with' clause multiple insert", () => {
    testsql(
      qb()
        .with('withClause', function () {
          this.select('foo').from('users').where({ name: 'bob' });
        })
        .insert([
          { email: 'thisMail', name: 'sam' },
          { email: 'thatMail', name: 'jack' },
        ])
        .into('users'),
      {
        sqlite3: {
          sql:
            'with `withClause` as (select `foo` from `users` where `name` = ?) insert into `users` (`email`, `name`) select ? as `email`, ? as `name` union all select ? as `email`, ? as `name`',
          bindings: ['bob', 'thisMail', 'sam', 'thatMail', 'jack'],
        },
      }
    );
  });

  it("wrapped 'with' clause update", () => {
    testsql(
      qb()
        .with('withClause', function () {
          this.select('foo').from('users');
        })
        .update({ foo: 'updatedFoo' })
        .where('email', '=', 'foo')
        .from('users'),
      {
        sqlite3:
          'with `withClause` as (select `foo` from `users`) update `users` set `foo` = ? where `email` = ?',
      }
    );
  });

  it("wrapped 'with' clause delete", () => {
    testsql(
      qb()
        .with('withClause', function () {
          this.select('email').from('users');
        })
        .del()
        .where('foo', '=', 'updatedFoo')
        .from('users'),
      {
        sqlite3:
          'with `withClause` as (select `email` from `users`) delete from `users` where `foo` = ?',
      }
    );
  });

  it("raw 'with' clause", () => {
    testsql(
      qb()
        .with('withRawClause', raw('select "foo" as "baz" from "users"'))
        .select('*')
        .from('withRawClause'),
      {
        sqlite3:
          'with `withRawClause` as (select "foo" as "baz" from "users") select * from `withRawClause`',
      }
    );
  });

  it("chained wrapped 'with' clause", () => {
    testsql(
      qb()
        .with('firstWithClause', function () {
          this.select('foo').from('users');
        })
        .with('secondWithClause', function () {
          this.select('bar').from('users');
        })
        .select('*')
        .from('secondWithClause'),
      {
        sqlite3:
          'with `firstWithClause` as (select `foo` from `users`), `secondWithClause` as (select `bar` from `users`) select * from `secondWithClause`',
      }
    );
  });

  it("nested 'with' clause", () => {
    testsql(
      qb()
        .with('withClause', function () {
          this.with('withSubClause', function () {
            this.select('foo').as('baz').from('users');
          })
            .select('*')
            .from('withSubClause');
        })
        .select('*')
        .from('withClause'),
      {
        sqlite3:
          'with `withClause` as (with `withSubClause` as ((select `foo` from `users`) as `baz`) select * from `withSubClause`) select * from `withClause`',
      }
    );
  });

  it("nested 'with' clause with bindings", () => {
    testsql(
      qb()
        .with('withClause', function () {
          this.with(
            'withSubClause',
            raw(
              'select "foo" as "baz" from "users" where "baz" > ? and "baz" < ?',
              [1, 20]
            )
          )
            .select('*')
            .from('withSubClause');
        })
        .select('*')
        .from('withClause')
        .where({ id: 10 }),
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
    testNativeSql(qb().from('table').where('isIt', true), {
      sqlite3: {
        sql: 'select * from `table` where `isIt` = ?',
        bindings: [true],
      },
    });
  });

  it("nested and chained wrapped 'with' clause", () => {
    testsql(
      qb()
        .with('firstWithClause', function () {
          this.with('firstWithSubClause', function () {
            this.select('foo').as('foz').from('users');
          })
            .select('*')
            .from('firstWithSubClause');
        })
        .with('secondWithClause', function () {
          this.with('secondWithSubClause', function () {
            this.select('bar').as('baz').from('users');
          })
            .select('*')
            .from('secondWithSubClause');
        })
        .select('*')
        .from('secondWithClause'),
      {
        sqlite3:
          'with `firstWithClause` as (with `firstWithSubClause` as ((select `foo` from `users`) as `foz`) select * from `firstWithSubClause`), `secondWithClause` as (with `secondWithSubClause` as ((select `bar` from `users`) as `baz`) select * from `secondWithSubClause`) select * from `secondWithClause`',
      }
    );
  });

  it("nested and chained wrapped 'withRecursive' clause", () => {
    testsql(
      qb()
        .withRecursive('firstWithClause', function () {
          this.withRecursive('firstWithSubClause', function () {
            this.select('foo').as('foz').from('users');
          })
            .select('*')
            .from('firstWithSubClause');
        })
        .withRecursive('secondWithClause', function () {
          this.withRecursive('secondWithSubClause', function () {
            this.select('bar').as('baz').from('users');
          })
            .select('*')
            .from('secondWithSubClause');
        })
        .select('*')
        .from('secondWithClause'),
      {
        sqlite3:
          'with recursive `firstWithClause` as (with recursive `firstWithSubClause` as ((select `foo` from `users`) as `foz`) select * from `firstWithSubClause`), `secondWithClause` as (with recursive `secondWithSubClause` as ((select `bar` from `users`) as `baz`) select * from `secondWithSubClause`) select * from `secondWithClause`',
      }
    );
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
      Object.assign({ client: 'sqlite3' }, loggerConfigForTestingWarnings)
    );

    expect(() => {
      testsql(
        qb().into('users').insert({ email: 'foo' }).returning('id'),
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
});
