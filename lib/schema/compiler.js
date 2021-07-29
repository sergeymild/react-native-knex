const { pushQuery, pushAdditional, unshiftQuery } = require('./helpers')

// The "SchemaCompiler" takes all of the query statements which have been
// gathered in the "SchemaBuilder" and turns them into an array of
// properly formatted / bound query strings.

module.exports = class SchemaCompiler {
  dropTablePrefix = 'drop table '

  constructor(client, builder) {
    this.builder = builder;
    this._commonBuilder = this.builder;
    this.client = client;
    this.schema = builder._schema;
    this.formatter = client.formatter(builder);
    this.sequence = [];
  }

  pushQuery = (query) => pushQuery(query)
  pushAdditional = (fn) => pushAdditional(fn)
  unshiftQuery = (query) => unshiftQuery(query)
  createTable = (tableName, fn) => buildTable('create')(tableName, fn)
  createTableIfNotExists = (tableName, fn) => buildTable('createIfNot')(tableName, fn)
  alterTable = (tableName, fn) => buildTable('alter')(tableName, fn)

  dropTable = (tableName) => {
    this.pushQuery(
        this.dropTablePrefix +
        this.formatter.wrap(prefixedTableName(this.schema, tableName))
    );
  }

  dropTableIfExists = (tableName) => {
    this.pushQuery(
        this.dropTablePrefix +
        'if exists ' +
        this.formatter.wrap(prefixedTableName(this.schema, tableName))
    );
  }

  raw = (sql, bindings) => {
    this.sequence.push(this.client.raw(sql, bindings).toSQL());
  }

  toSQL = () => {
    const sequence = this.builder._sequence;
    for (let i = 0, l = sequence.length; i < l; i++) {
      const query = sequence[i];
      this[query.method].apply(this, query.args);
    }
    return this.sequence;
  }

  createSchema = () => {
    throwOnlyPGError('createSchema');
  }
  createSchemaIfNotExists = () => {
    throwOnlyPGError('createSchemaIfNotExists');
  }
  dropSchema = () => {
    throwOnlyPGError('dropSchema');
  }
  dropSchemaIfExists = () => {
    throwOnlyPGError('dropSchemaIfExists');
  }
}

function throwOnlyPGError(operationName) {
  throw new Error(
    `${operationName} is not supported for this dialect (only PostgreSQL supports it currently).`
  );
}

function buildTable(type) {
  return function (tableName, fn) {
    const builder = this.client.tableBuilder(type, tableName, fn);

    builder.setSchema(this.schema);
    const sql = builder.toSQL();

    for (let i = 0, l = sql.length; i < l; i++) {
      this.sequence.push(sql[i]);
    }
  };
}

function prefixedTableName(prefix, table) {
  return prefix ? `${prefix}.${table}` : table;
}
