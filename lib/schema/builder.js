const EventEmitter = require('../EventEmitter')
const toArray = require('lodash.toarray')
const saveAsyncStack = require('../util/save-async-stack')
const inte = require('../interface')

// Constructor for the builder instance, typically called from
// `knex.builder`, accepting the current `knex` instance,
// and pulling out the `client` and `grammar` from the current
// knex instance.

class SchemaBuilder extends EventEmitter {
  constructor(client) {
    super()
    this.client = client;
    this._sequence = [];

    if (client.config) {
      this._debug = client.config.debug;
      saveAsyncStack(this, 4);
    }
  }

  withSchema = function (schemaName) {
    this._schema = schemaName;
    return this;
  }

  toString = function () {
    return this.toQuery();
  }

  toSQL = function () {
    return this.client.schemaCompiler(this).toSQL();
  };
}


// Each of the schema builder methods just add to the
// "_sequence" array for consistency.
[
  'createTable',
  'createTableIfNotExists',
  'createSchema',
  'createSchemaIfNotExists',
  'dropSchema',
  'dropSchemaIfExists',
  'createExtension',
  'createExtensionIfNotExists',
  'dropExtension',
  'dropExtensionIfExists',
  'table',
  'alterTable',
  'hasTable',
  'hasColumn',
  'dropTable',
  'renameTable',
  'dropTableIfExists',
  'raw',
].forEach(function (method) {
  SchemaBuilder.prototype[method] = function () {
    if (method === 'table') method = 'alterTable';
    this._sequence.push({ method, args: toArray(arguments) });
    return this;
  };
});




inte(SchemaBuilder);

module.exports = SchemaBuilder;
