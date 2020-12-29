'use strict';

const { expect } = require('chai');

const _ = require('lodash');
const {Knex, SQLite3Client} = require('../../knex');
const sqlite3 = require('sqlite3')

module.exports = function (config) {
  describe('Connection configuration provider', function () {
    let configWorkingCopy;
    let providerInvocationCount;
    let connectionConfigWorkingCopy;

    this.beforeEach(() => {
      configWorkingCopy = _.cloneDeep(config);
      configWorkingCopy.pool.min = 1;
      configWorkingCopy.pool.max = 2;
      providerInvocationCount = 0;
      connectionConfigWorkingCopy = configWorkingCopy.connection;
    });

    it('is not used when configuration is static', async function () {
      return runTwoConcurrentTransactions(0);
    });

    it('can return a promise for a config object, which is reused when not given given an expiry checker', async () => {
      configWorkingCopy.connection = () => {
        ++providerInvocationCount;
        return Promise.resolve(connectionConfigWorkingCopy);
      };
      return runTwoConcurrentTransactions(1);
    });

    it('can return a config object, which is reused when not given given an expiry checker', async () => {
      configWorkingCopy.connection = () => {
        ++providerInvocationCount;
        return connectionConfigWorkingCopy;
      };
      return runTwoConcurrentTransactions(1);
    });

    it('reuses the same resolved config when not yet expired', async () => {
      configWorkingCopy.connection = () => {
        ++providerInvocationCount;
        return Object.assign(connectionConfigWorkingCopy, {
          expirationChecker: () => false,
        });
      };
      return runTwoConcurrentTransactions(1);
    });

    it('replaces the resolved config when expired', async () => {
      configWorkingCopy.connection = () => {
        ++providerInvocationCount;
        return Object.assign(connectionConfigWorkingCopy, {
          expirationChecker: () => true,
        });
      };
      return runTwoConcurrentTransactions(2);
    });

    async function runTwoConcurrentTransactions(expectedInvocationCount) {
      const knex = new Knex(new SQLite3Client(configWorkingCopy, sqlite3));
      await knex.transaction(async (trx) => {
        await knex.transaction(async (trx2) => {});
      });
      await knex.destroy();
      expect(providerInvocationCount).equals(expectedInvocationCount);
    }
  });
};
