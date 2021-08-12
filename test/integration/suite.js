'use strict';

const fs = require('fs')
const { expect } = require('chai');

module.exports = function (knex) {
  const sinon = require('sinon');

  describe('sqlite', function () {
    after(function () {
      fs.unlinkSync('./db.sqlite');
      return knex.destroy();
    });

    // require('./schema')(knex);
    // require('./schema/foreign-keys')(knex);
    // require('./builder/inserts')(knex);
    // require('./builder/selects')(knex);
    // require('./builder/unions')(knex);

    require('./builder/joins')(knex);

    // require('./builder/aggregate')(knex);
    // require('./builder/updates')(knex);
    // require('./builder/transaction')(knex);
    // require('./builder/deletes')(knex);
    // require('./builder/additional')(knex);

    // describe('knex.destroy', function () {
    //   it('should allow destroying the pool with knex.destroy', async function () {
        // const spy = sinon.spy(knex.client.pool, 'destroy');
        // return knex
        //   .destroy()
        //   .then(function () {
        //     expect(spy).to.have.callCount(1);
        //     expect(knex.client.pool).to.equal(undefined);
        //     return knex.destroy();
        //   })
        //   .then(function () {
        //     expect(spy).to.have.callCount(1);
        //   });
      // });
    // });
  });
};
