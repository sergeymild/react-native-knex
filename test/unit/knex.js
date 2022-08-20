
const { inherits } = require('util');
const {Knex, SQLite3Client} = require('../../knex');
const QueryBuilder = require('../../lib/query/builder');
const { expect } = require('chai');
const sqliteConfig = require('../knexfile');
const sqlite3 = require('sqlite3');
const { noop } = require('lodash');

describe('knex', () => {
  describe('supports passing existing connection', () => {
    let connection;
    beforeEach(() => {
      connection = new sqlite3.Database(':memory:');
    });

    afterEach(() => {
      connection.close();
    });

    it('happy path', (done) => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
      knex
        .connection(connection)
        .select(knex.raw('"0" as value'))
        .then((result) => {
          expect(result[0].value).to.equal('0');
          done();
        });
    });
  });


  describe('transaction', () => {
    it('supports direct retrieval of a transaction from provider', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
      const trxProvider = knex.transactionProvider();
      const trxPromise = trxProvider();

      let transaction;
      await trxPromise
          .then((trx) => {
            transaction = trx;
            expect(trx.client.transacting).to.equal(true);
            return knex.transacting(trx).select(knex.raw('1 as result'));
          })
          .then((rows) => {
            expect(rows[0].result).to.equal(1);
            return transaction.commit();
          })
          .then(() => {
            return transaction.executionPromise;
          });

      return knex.destroy();
    });

    it('does not reject rolled back nested transactions by default', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
      const trx = await knex.transaction();
      const nestedTrx = await trx.transaction();
      await nestedTrx.rollback();

      trx.commit();
      return knex.destroy();
    });

    it('supports accessing execution promise from standalone transaction', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));

      const trx = await knex.transaction();
      const executionPromise = trx.executionPromise;
      expect(executionPromise).to.be.ok;

      expect(trx.client.transacting).to.equal(true);
      const rows = await knex.transacting(trx).select(knex.raw('1 as result'));
      expect(rows[0].result).to.equal(1);
      await trx.commit();

      const result = await executionPromise;
      expect(result).to.be.undefined;
      return knex.destroy();
    });

    it('supports accessing execution promise from transaction with a callback', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
      const trxPromise = new Promise((resolve, reject) => {
        knex.transaction((transaction) => {
          resolve(transaction);
        });
      });
      const trx = await trxPromise;
      const executionPromise = trx.executionPromise;
      expect(executionPromise).to.be.ok;

      expect(trx.client.transacting).to.equal(true);
      const rows = await knex.transacting(trx).select(knex.raw('1 as result'));
      expect(rows[0].result).to.equal(1);
      await trx.commit();

      const result = await executionPromise;
      expect(result).to.be.undefined;
      return knex.destroy();
    });

    it('resolves execution promise if there was a manual rollback and transaction is set not to reject', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));

      const trx = await knex.transaction();
      const executionPromise = trx.executionPromise;

      expect(trx.client.transacting).to.equal(true);
      const rows = await knex.transacting(trx).select(knex.raw('1 as result'));
      expect(rows[0].result).to.equal(1);
      await trx.rollback();

      const result = await executionPromise;
      expect(result).to.be.undefined;
      return knex.destroy();
    });

    it('rejects execution promise if there was a manual rollback and transaction is set to reject', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));

      const trx = await knex.transaction(undefined, {
        doNotRejectOnRollback: false,
      });
      const executionPromise = trx.executionPromise;

      expect(trx.client.transacting).to.equal(true);
      const rows = await knex.transacting(trx).select(knex.raw('1 as result'));
      expect(rows[0].result).to.equal(1);
      await trx.rollback();

      let errorWasThrown;
      try {
        await executionPromise;
      } catch (err) {
        errorWasThrown = true;
        expect(err.message).to.equal(
            'Transaction rejected with non-error: undefined'
        );
      }
      expect(errorWasThrown).to.be.true;
      return knex.destroy();
    });

    it('does not reject promise when rolling back a transaction', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
      const trxProvider = knex.transactionProvider();
      const trx = await trxProvider();

      await trx.rollback();
      await trx.executionPromise;
      return knex.destroy();
    });

    it('returns false when calling isCompleted on a transaction that is not complete', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
      const trxProvider = knex.transactionProvider();
      const trx = await trxProvider();

      const completed = trx.isCompleted();
      expect(completed).to.be.false;

      trx.commit();
      return knex.destroy();
    });

    it('returns true when calling isCompleted on a transaction that is committed', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
      const trxProvider = knex.transactionProvider();
      const trx = await trxProvider();

      await trx.commit();

      const completed = trx.isCompleted();
      expect(completed).to.be.true;
      return knex.destroy();
    });

    it('returns true when calling isCompleted on a transaction that is rolled back', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
      const trxProvider = knex.transactionProvider();
      const trx = await trxProvider();

      await trx.rollback();

      const completed = trx.isCompleted();
      expect(completed).to.be.true;
      return knex.destroy();
    });

    it('returns false when calling isCompleted within a transaction handler', async () => {
      const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
      await knex.transaction((trx) => {
        expect(trx.isCompleted()).to.be.false;

        return trx.select(trx.raw('1 as result'));
      });
      return knex.destroy();
    });

  });

  describe('extend query builder', () => {
    let connection;
    beforeEach(() => {
      connection = new sqlite3.Database(':memory:');
    });

    afterEach(() => {
      connection.close();
      delete QueryBuilder.prototype.customSelect;
    });

    context('const trx = knex.transaction(cb)', function () {
      context('and cb returns a Promise', function () {
        if (Promise.prototype.finally) {
          it('returns a Transaction that defines a `finally(..)` method', async function () {
            const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
            const trx = knex.transaction(async (tx) => {});
            try {
              expect(trx.finally).to.be.a('function');
            } finally {
              await trx;
            }
            return knex.destroy();
          });
        } else {
          it('returns a Transaction that does NOT define a `finally(..)` method', async function () {
            const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
            const trx = knex.transaction(async (tx) => {});
            try {
              expect(trx.finally).to.equal(undefined);
            } finally {
              await trx;
            }
            return knex.destroy();
          });
        }
      });
    });

    // TODO: Consider moving these somewhere that tests the
    //       QueryBuilder interface more directly.
    context('qb = knex.select(1)', function () {
      if (Promise.prototype.finally) {
        it('returns a QueryBuilder that defines a `.finally(..)` method', async function () {
          const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
          const p = knex.select(1);
          try {
            expect(p.finally).to.be.a('function');
          } finally {
            await p;
          }
          return knex.destroy();
        });
      } else {
        it('returns a QueryBuilder that does NOT define a `.finally(..)` method', async function () {
          const knex = new Knex(new SQLite3Client(sqliteConfig, sqlite3));
          const p = knex.select(1);
          try {
            expect(p.finally).to.equal(undefined);
          } finally {
            await p;
          }
          return knex.destroy();
        });
      }
    });
  });
});
