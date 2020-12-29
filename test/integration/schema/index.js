'use strict';

const { expect } = require('chai');

const _ = require('lodash');
const { isString, isObject } = require('../../../lib/util/is');

const wrapIdentifier = (value, wrap) => {
  return wrap(value ? value.toUpperCase() : value);
};

function mapObject(obj) {
  return _.transform(
    obj,
    (result, value, key) => {
      result[key.toUpperCase()] = value;
    },
    {}
  );
}

const postProcessResponse = (response) => {
  if (Array.isArray(response)) {
    return response.map(mapObject);
  } else {
    if (isObject(response)) {
      return mapObject(response);
    }
    return response;
  }
};

module.exports = (knex) => {
  describe('Schema', () => {
    describe('errors for unsupported dialects', () => {
      it('throws an error if client does not support createSchema', async function () {
        let error;
        try {
          await knex.schema.createSchema('test');
        } catch (e) {
          error = e;
        }
        expect(error.message).to.equal(
          'createSchema is not supported for this dialect (only PostgreSQL supports it currently).'
        );
      });

      it('throws an error if client does not support createSchemaIfNotExists', async function () {

        let error;
        try {
          await knex.schema.createSchemaIfNotExists('test');
        } catch (e) {
          error = e;
        }
        expect(error.message).to.equal(
          'createSchemaIfNotExists is not supported for this dialect (only PostgreSQL supports it currently).'
        );
      });

      it('throws an error if client does not support dropSchema', async function () {
        let error;
        try {
          await knex.schema.dropSchema('test');
        } catch (e) {
          error = e;
        }
        expect(error.message).to.equal(
          'dropSchema is not supported for this dialect (only PostgreSQL supports it currently).'
        );
      });

      it('throws an error if client does not support dropSchemaIfExists', async function () {

        let error;
        try {
          await knex.schema.dropSchemaIfExists('test');
        } catch (e) {
          error = e;
        }
        expect(error.message).to.equal(
          'dropSchemaIfExists is not supported for this dialect (only PostgreSQL supports it currently).'
        );
      });
    });

    describe('dropTable', () => {
      it('has a dropTableIfExists method', function () {
        this.timeout(process.env.KNEX_TEST_TIMEOUT || 30000);
        return Promise.all([
          knex.schema
            .dropTableIfExists('test_foreign_table_two')
            .testSql((tester) => {
              tester(
                ['sqlite3'],
                ['drop table if exists `test_foreign_table_two`']
              );
            }),
          knex.schema
            .dropTableIfExists('test_table_one')
            .dropTableIfExists('catch_test')
            .dropTableIfExists('test_table_two')
            .dropTableIfExists('test_table_three')
            .dropTableIfExists('test_table_four')
            .dropTableIfExists('datatype_test')
            .dropTableIfExists('composite_key_test')
            .dropTableIfExists('charset_collate_test')
            .dropTableIfExists('accounts')
            .dropTableIfExists('migration_test_1')
            .dropTableIfExists('migration_test_2')
            .dropTableIfExists('migration_test_2_1')
            .dropTableIfExists('test_default_table')
            .dropTableIfExists('test_default_table2')
            .dropTableIfExists('test_default_table3')
            .dropTableIfExists('knex_migrations')
            .dropTableIfExists('knex_migrations_lock')
            .dropTableIfExists('bool_test')
            .dropTableIfExists('10_test_table')
            .dropTableIfExists('rename_column_foreign_test')
            .dropTableIfExists('rename_column_test')
            .dropTableIfExists('renamecoltest')
            .dropTableIfExists('should_not_be_run')
            .dropTableIfExists('invalid_inTable_param_test')
            .dropTableIfExists('primarytest')
            .dropTableIfExists('increments_columns_1_test')
            .dropTableIfExists('increments_columns_2_test'),
        ]);
      });
    });

    describe('createTable', () => {
      it('Callback function must be supplied', () => {
        expect(() => {
          knex.schema.createTable('callback_must_be_supplied').toString();
        }).to.throw(TypeError);
        expect(() => {
          knex.schema
            .createTable('callback_must_be_supplied', () => {})
            .toString();
        }).to.not.throw(TypeError);
      });

      it('is possible to chain .catch', () =>
        knex.schema
          .createTable('catch_test', (t) => {
            t.increments();
          })
          .catch((e) => {
            throw e;
          }));

      it('accepts the table name, and a "container" function', () =>
        knex.schema
          .createTable('test_table_one', (table) => {
            table.comment('A table comment.');
            table.bigIncrements('id');
            table.string('first_name').index();
            table.string('last_name');
            table.string('email').unique().nullable();
            table.integer('logins').defaultTo(1).index().comment();
            table.float('balance').defaultTo(0);
            table.text('about').comment('A comment.');
            table.timestamps();
          })
          .testSql((tester) => {
            tester('sqlite3', [
              "create table `test_table_one` (`id` integer not null primary key autoincrement, `first_name` varchar(255), `last_name` varchar(255), `email` varchar(255) null, `logins` integer default '1', `balance` float default '0', `about` text, `created_at` datetime, `updated_at` datetime)",
              'create index `test_table_one_first_name_index` on `test_table_one` (`first_name`)',
              'create unique index `test_table_one_email_unique` on `test_table_one` (`email`)',
              'create index `test_table_one_logins_index` on `test_table_one` (`logins`)',
            ]);
          }));

      it('handles numeric length correctly', () =>
        knex.schema
          .createTable('test_table_numerics', (table) => {
            table.integer('integer_column', 5);
            table.tinyint('tinyint_column', 5);
            table.smallint('smallint_column', 5);
            table.mediumint('mediumint_column', 5);
            table.bigint('bigint_column', 5);
          })
          .testSql((tester) => {
            tester('sqlite3', [
              'create table `test_table_numerics` (`integer_column` integer, `tinyint_column` tinyint, `smallint_column` integer, `mediumint_column` integer, `bigint_column` bigint)',
            ]);
          })
          .then(() => knex.schema.dropTable('test_table_numerics')));

      it('supports the enum and uuid columns', () => {

        return knex.schema
          .createTable('datatype_test', (table) => {
            table.enum('enum_value', ['a', 'b', 'c']);
            table.uuid('uuid').notNull();
          })
          .testSql((tester) => {
            tester('sqlite3', [
              "create table `datatype_test` (`enum_value` text check (`enum_value` in ('a', 'b', 'c')), `uuid` char(36) not null)",
            ]);
          });
      });

      it('allows for setting foreign keys on schema creation', () =>
        knex.schema
          .createTable('test_foreign_table_two', (table) => {
            table.increments();
            table
              .integer('fkey_two')
              .unsigned()
              .references('id')
              .inTable('test_table_two');
            table
              .integer('fkey_three')
              .unsigned()
              .references('id')
              .inTable('test_table_two')
              .withKeyName('fk_fkey_three');
            table.integer('fkey_four').unsigned();
            table
              .foreign('fkey_four', 'fk_fkey_four')
              .references('test_table_two.id');
          })
          .testSql((tester) => {
            tester('sqlite3', [
              'create table `test_foreign_table_two` (`id` integer not null primary key autoincrement, `fkey_two` integer, `fkey_three` integer, `fkey_four` integer, ' +
                'foreign key(`fkey_two`) references `test_table_two`(`id`), ' +
                'constraint `fk_fkey_three` foreign key(`fkey_three`) references `test_table_two`(`id`), ' +
                'constraint `fk_fkey_four` foreign key(`fkey_four`) references `test_table_two`(`id`))',
            ]);
          }));

      it('rejects setting foreign key where tableName is not typeof === string', () => {
        const builder = knex.schema.createTable(
          'invalid_inTable_param_test',
          (table) => {
            const createInvalidUndefinedInTableSchema = () => {
              table.increments('id').references('id').inTable();
            };
            const createInvalidObjectInTableSchema = () => {
              table
                .integer('another_id')
                .references('id')
                .inTable({ tableName: 'this_should_fail' });
            };
            expect(createInvalidUndefinedInTableSchema).to.throw(TypeError);
            expect(createInvalidObjectInTableSchema).to.throw(TypeError);

            table
              .integer('yet_another_id')
              .references('id')
              .inTable({ tableName: 'this_should_fail_too' });
          }
        );

        expect(() => builder.toSQL()).to.throw(TypeError);
      });

      it('allows for composite keys', () =>
        knex.schema
          .createTable('composite_key_test', (table) => {
            table.integer('column_a');
            table.integer('column_b');
            table.text('details');
            table.integer('status');
            table.unique(['column_a', 'column_b']);
          })
          .testSql((tester) => {
            tester('sqlite3', [
              'create table `composite_key_test` (`column_a` integer, `column_b` integer, `details` text, `status` tinyint)',
              'create unique index `composite_key_test_column_a_column_b_unique` on `composite_key_test` (`column_a`, `column_b`)',
            ]);
          })
          .then(() =>
            knex.table('composite_key_test').insert([
              {
                column_a: 1,
                column_b: 1,
                details: 'One, One, One',
                status: 1,
              },
              {
                column_a: 1,
                column_b: 2,
                details: 'One, Two, Zero',
                status: 0,
              },
              {
                column_a: 1,
                column_b: 3,
                details: 'One, Three, Zero',
                status: 0,
              },
            ])
          ));

      it('is possible to set the table collation with table.charset and table.collate', () =>
        knex.schema
          .createTable('charset_collate_test', (table) => {
            table.increments();
            table.integer('account_id');
            table.text('details');
            table.tinyint('status');
          })
          .testSql((tester) => {
            tester('sqlite3', [
              'create table `charset_collate_test` (`id` integer not null primary key autoincrement, `account_id` integer, `details` text, `status` tinyint)',
            ]);
          }));

      it('sets booleans & defaults correctly', () =>
        knex.schema
          .createTable('bool_test', (table) => {
            table.bool('one');
            table.bool('two').defaultTo(false);
            table.bool('three').defaultTo(true);
            table.bool('four').defaultTo('true');
            table.bool('five').defaultTo('false');
          })
          .testSql((tester) => {
            tester('sqlite3', [
              "create table `bool_test` (`one` boolean, `two` boolean default '0', `three` boolean default '1', `four` boolean default '1', `five` boolean default '0')",
            ]);
          })
          .then(() => knex.insert({ one: false }).into('bool_test')));

      it('accepts table names starting with numeric values', () =>
        knex.schema
          .createTable('10_test_table', (table) => {
            table.bigIncrements('id');
            table.string('first_name').index();
            table.string('last_name');
            table.string('email').unique().nullable();
            table.integer('logins').defaultTo(1).index().comment();
          })
          .testSql((tester) => {
            tester('sqlite3', [
              "create table `10_test_table` (`id` integer not null primary key autoincrement, `first_name` varchar(255), `last_name` varchar(255), `email` varchar(255) null, `logins` integer default '1')",
              'create index `10_test_table_first_name_index` on `10_test_table` (`first_name`)',
              'create unique index `10_test_table_email_unique` on `10_test_table` (`email`)',
              'create index `10_test_table_logins_index` on `10_test_table` (`logins`)',
            ]);
          }));
    });

    describe('table', () => {
      it('Callback function must be supplied', () => {
        expect(() => {
          knex.schema.createTable('callback_must_be_supplied').toString();
        }).to.throw(TypeError);
        expect(() => {
          knex.schema
            .createTable('callback_must_be_supplied', () => {})
            .toString();
        }).to.not.throw(TypeError);
      });

      it('allows adding a field', () =>
        knex.schema.table('test_table_two', (t) => {
          t.json('json_data', true);
        }));

      it('allows adding multiple columns at once', function () {
        return knex.schema
          .table('test_table_two', (t) => {
            t.string('one');
            t.string('two');
            t.string('three');
          })
          .then(() =>
            knex.schema.table('test_table_two', (t) => {
              t.dropColumn('one');
              t.dropColumn('two');
              t.dropColumn('three');
            })
          );
      });

      it('handles creating numeric columns with specified length correctly', () =>
        knex.schema
          .createTable('test_table_numerics2', (table) => {
            table.integer('integer_column', 5);
            table.tinyint('tinyint_column', 5);
            table.smallint('smallint_column', 5);
            table.mediumint('mediumint_column', 5);
            table.bigint('bigint_column', 5);
          })
          .then(() => knex.schema.dropTable('test_table_numerics2')));

      it('allows adding a field with custom collation after another field', () =>
        knex.schema
          .table('test_table_two', (t) => {
            t.string('ref_column').after('json_data');
          })
          .then(() =>
            knex.schema.table('test_table_two', (t) => {
              t.string('after_column').after('ref_column').collate('utf8_bin');
            })
          )
          .then(() =>
            knex.schema.table('test_table_two', (t) => {
              t.dropColumn('ref_column');
              t.dropColumn('after_column');
            })
          ));

      it('allows adding a field with custom collation first', () =>
        knex.schema
          .table('test_table_two', (t) => {
            t.string('first_column').first().collate('utf8_bin');
          })
          .then(() =>
            knex.schema.table('test_table_two', (t) => {
              t.dropColumn('first_column');
            })
          ));

      it('allows changing a field', () =>
        knex.schema.table('test_table_one', (t) => {
          t.string('phone').nullable();
        }));

      it('allows dropping a unique index', () =>
        knex.schema.table('composite_key_test', (t) => {
          t.dropUnique(['column_a', 'column_b']);
        }));

      it('allows dropping a index', () =>
        knex.schema.table('test_table_one', (t) => {
          t.dropIndex('first_name');
        }));
    });

    describe('hasTable', () => {
      it('checks whether a table exists', () =>
        knex.schema.hasTable('test_table_two').then((resp) => {
          expect(resp).to.equal(true);
        }));

      it('should be false if a table does not exists', () =>
        knex.schema.hasTable('this_table_is_fake').then((resp) => {
          expect(resp).to.equal(false);
        }));

      it('should be false whether a parameter is not specified', () =>
        knex.schema.hasTable('').then((resp) => {
          expect(resp).to.equal(false);
        }));
    });

    describe('renameTable', () => {
      it('renames the table from one to another', () =>
        knex.schema.renameTable('test_table_one', 'accounts'));
    });

    describe('dropTable', () => {
      it('should drop a table', () =>
        knex.schema.dropTable('test_table_three').then(() => {
          // Drop this here so we don't have foreign key constraints...
          return knex.schema.dropTable('test_foreign_table_two');
        }));
    });

    describe('hasColumn', () => {
      describe('without processors', () => {
        it('checks whether a column exists, resolving with a boolean', () =>
          knex.schema.hasColumn('accounts', 'first_name').then((exists) => {
            expect(exists).to.equal(true);
          }));

        describe('sqlite only', () => {
          if (
            !knex ||
            !knex.client ||
            !/sqlite3/i.test(knex.client.driverName)
          ) {
            return Promise.resolve();
          }

          it('checks whether a column exists without being case sensitive, resolving with a boolean', async () => {
            const exists = await knex.schema.hasColumn(
              'accounts',
              'FIRST_NAME'
            );

            expect(exists).to.equal(true);
          });
        });
      });

      describe('using processorss', () => {
        describe('sqlite only', () => {
          beforeEach(() => {
            knex.client.config.postProcessResponse = postProcessResponse;
            knex.client.config.wrapIdentifier = wrapIdentifier;
          });

          afterEach(() => {
            knex.client.config.postProcessResponse = null;
            knex.client.config.wrapIdentifier = null;
          });

          it('checks whether a column exists, resolving with a boolean', () =>
            knex.schema.hasColumn('accounts', 'firstName').then((exists) => {
              expect(exists).to.equal(false);
            }));
        });
      });
    });

    describe('renameColumn', () => {
      describe('without mappers', () => {
        before(async () => {
          await knex.schema
            .createTable('rename_column_test', (tbl) => {
              tbl.increments('id_test').unsigned().primary();
              tbl
                .integer('parent_id_test')
                .unsigned()
                .references('id_test')
                .inTable('rename_column_test');
            })
            .createTable('rename_column_foreign_test', (tbl) => {
              tbl.increments('id').unsigned().primary();
              tbl
                .integer('foreign_id_test')
                .unsigned()
                .references('id_test')
                .inTable('rename_column_test');
            })
            .createTable('rename_col_test', (tbl) => {
              tbl.integer('colnameint').defaultTo(1);
              tbl.string('colnamestring').defaultTo('knex').notNullable();
            });
        });

        after(async () => {
          await knex.schema
            .dropTable('rename_column_foreign_test')
            .dropTable('rename_column_test')
            .dropTable('rename_col_test');
        });

        it('renames the column', async () => {
          await knex.schema.table('rename_column_test', (tbl) =>
            tbl.renameColumn('id_test', 'id')
          );
          const exists = await knex.schema.hasColumn(
            'rename_column_test',
            'id'
          );
          expect(exists).to.equal(true);
        });

        it('successfully renames a column referenced in a foreign key', () =>
          knex.schema.table('rename_column_test', (tbl) => {
            tbl.renameColumn('parent_id_test', 'parent_id');
          }));

        it('successfully renames a column referenced by another table', () =>
          knex.schema.table('rename_column_test', (tbl) => {
            tbl.renameColumn('id', 'id_new');
          }));

        it('#933 - .renameColumn should not drop null or default value', () => {
          const tableName = 'rename_col_test';
          return knex.transaction((tr) => {
            const getColInfo = () => tr.table(tableName).columnInfo();
            return getColInfo()
              .then((colInfo) => {
                expect(String(colInfo.colnameint.defaultValue)).to.contain('1');
                // Using contain because of different response per dialect.
                // IE mysql 'knex', postgres 'knex::character varying'
                expect(colInfo.colnamestring.defaultValue).to.contain('knex');
                expect(colInfo.colnamestring.nullable).to.equal(false);
                return tr.schema.table(tableName, (table) => {
                  table.renameColumn('colnameint', 'colnameintchanged');
                  table.renameColumn('colnamestring', 'colnamestringchanged');
                });
              })
              .then(getColInfo)
              .then((columnInfo) => {
                expect(
                  String(columnInfo.colnameintchanged.defaultValue)
                ).to.contain('1');
                expect(columnInfo.colnamestringchanged.defaultValue).to.contain(
                  'knex'
                );
                expect(columnInfo.colnamestringchanged.nullable).to.equal(
                  false
                );
              });
          });
        });
      });

      if (knex.client.driverName === 'sqlite3') {
        describe('using wrapIdentifier and postProcessResponse', () => {
          const tableName = 'processor_test';

          beforeEach(() => {
            knex.client.config.postProcessResponse = postProcessResponse;
            knex.client.config.wrapIdentifier = wrapIdentifier;

            return knex.schema
              .createTable(tableName, (tbl) => {
                tbl.integer('field_foo');
                tbl.integer('other_field');
              })
              .then(() => {
                // Data is necessary to "force" the sqlite3 dialect to actually
                // attempt to copy data to the temp table, triggering errors
                // if columns were not correctly copied/created/dropped.
                return knex
                  .insert({
                    field_foo: 1,
                    other_field: 1,
                  })
                  .into(tableName);
              });
          });

          afterEach(() => {
            knex.client.config.postProcessResponse = null;
            knex.client.config.wrapIdentifier = null;

            return knex.schema.dropTable(tableName);
          });

          for (const from of ['field_foo', 'FIELD_FOO']) {
            for (const to of ['field_bar', 'FIELD_BAR']) {
              it(`renames the column from '${from}' to '${to}'`, () =>
                knex.schema
                  .table(tableName, (tbl) =>
                    tbl.renameColumn('field_foo', 'field_bar')
                  )
                  .then(() => knex.schema.hasColumn(tableName, 'field_bar'))
                  .then((exists) => {
                    expect(exists).to.equal(true);
                  }));
            }
          }
        });
      }
    });

    describe('dropColumn', () => {
      if (knex.client.driverName === 'sqlite3') {
        describe('using wrapIdentifier and postProcessResponse', () => {
          const tableName = 'processor_drop_column_test';

          beforeEach(() => {
            knex.client.config.postProcessResponse = postProcessResponse;
            knex.client.config.wrapIdentifier = wrapIdentifier;

            return knex.schema
              .createTable(tableName, (tbl) => {
                tbl.integer('other_field');
                tbl.integer('field_foo');
              })
              .then(() => {
                // Data is necessary to "force" the sqlite3 dialect to actually
                // attempt to copy data to the temp table, triggering errors
                // if columns were not correctly copied/created/dropped.
                return knex
                  .insert({
                    field_foo: 1,
                    other_field: 1,
                  })
                  .into(tableName);
              });
          });

          afterEach(() => {
            knex.client.config.postProcessResponse = null;
            knex.client.config.wrapIdentifier = null;

            return knex.schema.dropTable(tableName);
          });

          for (const columnName of ['field_foo', 'FIELD_FOO']) {
            it(`drops the column when spelled '${columnName}'`, () =>
              knex.schema
                .table(tableName, (tbl) => tbl.dropColumn(columnName))
                .then(() => knex.schema.hasColumn(tableName, 'field_foo'))
                .then((exists) => {
                  expect(exists).to.equal(false);
                }));
          }
        });

        context('when table is created using raw create table', () => {
          beforeEach(async () => {
            await knex.schema.raw(`create table TEST(
              "i0" integer,
              'i1' integer,
              [i2] integer,
              \`i3\` integer,
              i4 integer,
              I5 integer,
              unique(i4, i5),
              constraint i0 primary key([i3], "i4"),
              unique([i2]),
              foreign key (i1) references bar ("i3")
            )`);
          });

          afterEach(() => knex.schema.dropTable('TEST'));

          const getCreateTableExpr = async () =>
            (
              await knex.schema.raw(
                'select name, sql from sqlite_master where type = "table" and name = "TEST"'
              )
            )[0].sql;

          const dropCol = (colName) =>
            knex.schema.alterTable('TEST', (tbl) => tbl.dropColumn(colName));

          const hasCol = (colName) => knex.schema.hasColumn('TEST', colName);

          it('drops the column', async () => {
            await dropCol('i0');
            expect(await hasCol('i0')).to.equal(false);
            // Constraint i0 should be unaffected:
            expect(await getCreateTableExpr()).to.equal(
              "CREATE TABLE TEST('i1' integer, [i2] integer, `i3` integer, i4 " +
                'integer, I5 integer, unique(i4, i5), constraint i0 primary ' +
                'key([i3], "i4"), unique([i2]), foreign key (i1) references bar ' +
                '("i3") )'
            );
            await dropCol('i1');
            expect(await hasCol('i1')).to.equal(false);
            // Foreign key on i1 should also be dropped:
            expect(await getCreateTableExpr()).to.equal(
              'CREATE TABLE TEST([i2] integer, `i3` integer, i4 integer, I5 integer, ' +
                'unique(i4, i5), constraint i0 primary key([i3], "i4"), unique([i2]))'
            );
            await dropCol('i2');
            expect(await hasCol('i2')).to.equal(false);
            expect(await getCreateTableExpr()).to.equal(
              'CREATE TABLE TEST(`i3` integer, i4 integer, I5 integer, ' +
                'unique(i4, i5), constraint i0 primary key([i3], "i4"))'
            );
            await dropCol('i3');
            expect(await hasCol('i3')).to.equal(false);
            expect(await getCreateTableExpr()).to.equal(
              'CREATE TABLE TEST(i4 integer, I5 integer, unique(i4, i5))'
            );
            await dropCol('i4');
            expect(await hasCol('i4')).to.equal(false);
            expect(await getCreateTableExpr()).to.equal(
              'CREATE TABLE TEST(I5 integer)'
            );
            let lastColDeletionError;
            await knex.schema
              .alterTable('TEST', (tbl) => tbl.dropColumn('i5'))
              .catch((e) => {
                lastColDeletionError = e;
              });
            expect(lastColDeletionError.message).to.eql(
              'Unable to drop last column from table'
            );
          });
        });
      }
    });

    describe('invalid field', () => {
      describe('sqlite3 only', () => {
        const tableName = 'invalid_field_test_sqlite3';
        const fieldName = 'field_foo';
        if (!knex || !knex.client || !/sqlite3/i.test(knex.client.driverName)) {
          return Promise.resolve();
        }

        before(() =>
          knex.schema.createTable(tableName, (tbl) => {
            tbl.integer(fieldName);
          })
        );

        after(() => knex.schema.dropTable(tableName));

        it('should return empty resultset when referencing an existent column', () =>
          knex.table(tableName)
            .select()
            .where(fieldName, 'something')
            .then((rows) => {
              expect(rows.length).to.equal(0);
            }));

        it('should throw when referencing a non-existent column', () =>
          knex.table(tableName)
            .select()
            .where(fieldName + 'foo', 'something')
            .then(() => {
              throw new Error('should have failed');
            })
            .catch((err) => {
              expect(err.code).to.equal('SQLITE_ERROR');
            }));
      });
    });
    it('supports named primary keys', async () => {
      const constraintName = 'pk-test';
      const tableName = 'namedpk';
      const expectedRes = [
        {
          type: 'table',
          name: tableName,
          tbl_name: tableName,
          sql:
            'CREATE TABLE `' +
            tableName +
            '` (`test` varchar(255), `test2` varchar(255), constraint `' +
            constraintName +
            '` primary key (`test`))',
        },
      ];

      await knex.transaction((tr) =>
        tr.schema
          .dropTableIfExists(tableName)
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test').primary(constraintName);
              table.string('test2');
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              //For SQLite inspect metadata to make sure the constraint exists
              return tr
                .select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'table',
                  name: tableName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Constraint "' + constraintName + '" not correctly created.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(tableName, (table) => {
                // For everything else just drop the constraint by name to check existence
                table.dropPrimary(constraintName);
              });
            }
          })
          .then(() => tr.schema.dropTableIfExists(tableName))
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test');
              table.string('test2');
              table.primary('test', constraintName);
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              //For SQLite inspect metadata to make sure the constraint exists
              return tr
                .select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'table',
                  name: tableName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Constraint "' + constraintName + '" not correctly created.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(tableName, (table) => {
                // For everything else just drop the constraint by name to check existence
                table.dropPrimary(constraintName);
              });
            }
          })
          .then(() => tr.schema.dropTableIfExists(tableName))
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test');
              table.string('test2');
              table.primary(['test', 'test2'], constraintName);
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              //For SQLite inspect metadata to make sure the constraint exists
              const expectedRes = [
                {
                  type: 'table',
                  name: tableName,
                  tbl_name: tableName,
                  sql:
                    'CREATE TABLE `' +
                    tableName +
                    '` (`test` varchar(255), `test2` varchar(255), constraint `' +
                    constraintName +
                    '` primary key (`test`, `test2`))',
                },
              ];
              return tr
                .select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'table',
                  name: tableName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Constraint "' + constraintName + '" not correctly created.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(tableName, (table) => {
                // For everything else just drop the constraint by name to check existence
                table.dropPrimary(constraintName);
              });
            }
          })
          .then(() => tr.schema.dropTableIfExists(tableName))
      );
    });

    it('supports named unique keys', () => {
      const singleUniqueName = 'uk-single';
      const multiUniqueName = 'uk-multi';
      const tableName = 'nameduk';
      return knex.transaction((tr) =>
        tr.schema
          .dropTableIfExists(tableName)
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test').unique(singleUniqueName);
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              //For SQLite inspect metadata to make sure the constraint exists
              const expectedRes = [
                {
                  type: 'index',
                  name: singleUniqueName,
                  tbl_name: tableName,
                  sql:
                    'CREATE UNIQUE INDEX `' +
                    singleUniqueName +
                    '` on `' +
                    tableName +
                    '` (`test`)',
                },
              ];
              return tr
                .select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'index',
                  tbl_name: tableName,
                  name: singleUniqueName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Constraint "' +
                      singleUniqueName +
                      '" not correctly created.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(tableName, (table) => {
                // For everything else just drop the constraint by name to check existence
                table.dropUnique('test', singleUniqueName);
              });
            }
          })
          .then(() => tr.schema.dropTableIfExists(tableName))
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test');
              table.string('test2');
            })
          )
          .then(() =>
            tr.schema.table(tableName, (table) => {
              table.unique('test', singleUniqueName);
              table.unique(['test', 'test2'], multiUniqueName);
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              //For SQLite inspect metadata to make sure the constraint exists
              const expectedRes = [
                {
                  type: 'index',
                  name: singleUniqueName,
                  tbl_name: tableName,
                  sql:
                    'CREATE UNIQUE INDEX `' +
                    singleUniqueName +
                    '` on `' +
                    tableName +
                    '` (`test`)',
                },
                {
                  type: 'index',
                  name: multiUniqueName,
                  tbl_name: tableName,
                  sql:
                    'CREATE UNIQUE INDEX `' +
                    multiUniqueName +
                    '` on `' +
                    tableName +
                    '` (`test`, `test2`)',
                },
              ];
              return tr
                .select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'index',
                  tbl_name: tableName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Either "' +
                      singleUniqueName +
                      '" or "' +
                      multiUniqueName +
                      '" is missing.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(tableName, (table) => {
                // For everything else just drop the constraint by name to check existence
                table.dropUnique('test', singleUniqueName);
                table.dropUnique(['test', 'test2'], multiUniqueName);
              });
            }
          })
          .then(() => tr.schema.dropTableIfExists(tableName))
      );
    });

    it('supports named foreign keys', () => {
      const userTableName = 'nfk_user';
      const groupTableName = 'nfk_group';
      const joinTableName = 'nfk_user_group';
      const userConstraint = ['fk', joinTableName, userTableName].join('-');
      const groupConstraint = ['fk', joinTableName, groupTableName].join('-');
      return knex.transaction((tr) =>
        tr.schema
          .dropTableIfExists(joinTableName)
          .then(() => tr.schema.dropTableIfExists(userTableName))
          .then(() => tr.schema.dropTableIfExists(groupTableName))
          .then(() =>
            tr.schema.createTable(userTableName, (table) => {
              table.uuid('id').primary();
              table.string('name').unique();
            })
          )
          .then(() =>
            tr.schema.createTable(groupTableName, (table) => {
              table.uuid('id').primary();
              table.string('name').unique();
            })
          )
          .then(() =>
            tr.schema.createTable(joinTableName, (table) => {
              table
                .uuid('user')
                .references('id')
                .inTable(userTableName)
                .withKeyName(['fk', joinTableName, userTableName].join('-'));
              table.uuid('group');
              table.primary(['user', 'group']);
              table
                .foreign(
                  'group',
                  ['fk', joinTableName, groupTableName].join('-')
                )
                .references('id')
                .inTable(groupTableName);
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              const expectedRes = [
                {
                  type: 'table',
                  name: joinTableName,
                  tbl_name: joinTableName,
                  sql:
                    'CREATE TABLE `' +
                    joinTableName +
                    '` (`user` char(36), `group` char(36), constraint `' +
                    userConstraint +
                    '` foreign key(`user`) references `' +
                    userTableName +
                    '`(`id`), constraint `' +
                    groupConstraint +
                    '` foreign key(`group`) references `' +
                    groupTableName +
                    '`(`id`), primary key (`user`, `group`))',
                },
              ];
              tr.select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'table',
                  name: joinTableName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Named foreign key not correctly created.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(joinTableName, (table) => {
                table.dropForeign('user', userConstraint);
                table.dropForeign('group', groupConstraint);
              });
            }
          })
          .then(() =>
            tr.schema
              .dropTableIfExists(userTableName)
              .then(() => tr.schema.dropTableIfExists(groupTableName))
              .then(() => tr.schema.dropTableIfExists(joinTableName))
          )
      );
    });
  });
};
