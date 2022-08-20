const {expect} = require('chai');

module.exports = (knex) => {
  describe('Schema', () => {
    describe('customType', () => {
      describe('sqlite3', () => {
        const tblName = 'table_with_custom_varchar1';
        const colName = 'varchar_col1';

        before(async () => {
          await knex.schema.dropTableIfExists(tblName);
          await knex.schema.createTable(tblName, (table) => {
            table.specificType(colName, 'varchar(42)');
          });
        });

        after(async () => {
          await knex.schema.dropTable(tblName);
          return knex.destroy();
        });

        it('Allows to specify custom type params', async () => {
          let res = await knex.schema.raw(`PRAGMA table_info(${tblName})`);
          expect(res.find((c) => c.name === colName).type).to.equal(
            'varchar(42)'
          );
        });
      });
    });
  })
}
