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

  pushQuery = (query) => {
    if (!query) return;
    if (typeof query === 'string') query = { sql: query };
    if (!query.bindings) query.bindings = this.formatter.bindings;
    this.sequence.push(query);
    this.formatter = this.client.formatter(this._commonBuilder);
  }
  pushAdditional = (fn, ...args) => {
    const child = new SchemaCompiler(this.client, this.builder)
    fn.call(child, ...args);
    this.sequence.additional = (this.sequence.additional || []).concat(child.sequence);
  }
  unshiftQuery = (query) => {
    if (!query) return;
    if (isString(query)) query = { sql: query };
    if (!query.bindings) query.bindings = this.formatter.bindings;
    this.sequence.unshift(query);
    this.formatter = this.client.formatter(this._commonBuilder);
  }
  createTable = (tableName, fn) => {
    const builder = this.client.tableBuilder('create', tableName, fn);
    builder.setSchema(this.schema);
    const sql = builder.toSQL();
    for (let i = 0, l = sql.length; i < l; i++) this.sequence.push(sql[i]);
  }
  createTableIfNotExists = (tableName, fn) => {
    const builder = this.client.tableBuilder('createIfNot', tableName, fn);
    builder.setSchema(this.schema);
    const sql = builder.toSQL();
    for (let i = 0, l = sql.length; i < l; i++) this.sequence.push(sql[i]);
  }
  alterTable = (tableName, fn) => {
    const builder = this.client.tableBuilder('alter', tableName, fn);
    builder.setSchema(this.schema);
    const sql = builder.toSQL();
    for (let i = 0, l = sql.length; i < l; i++) this.sequence.push(sql[i]);
  }

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

  // Compile the query to determine if a table exists.
  hasTable = (tableName) => {
    const sql =
        `select * from sqlite_master ` +
        `where type = 'table' and name = ${this.formatter.parameter(tableName)}`;
    this.pushQuery({ sql, output: (resp) => resp.length > 0 });
  };

  // Compile the query to determine if a column exists.
  hasColumn = (tableName, column) => {
    this.pushQuery({
      sql: `PRAGMA table_info(${this.formatter.wrap(tableName)})`,
      output(resp) {
        return resp.find((col) => (
            this.client.wrapIdentifier(col.name.toLowerCase()) ===
            this.client.wrapIdentifier(column.toLowerCase())
        )) !== undefined;
      },
    });
  };

  // Compile a rename table command.
  renameTable = (from, to) => {
    this.pushQuery(`alter table ${this.formatter.wrap(from)} rename to ${this.formatter.wrap(to)}`);
  };

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
}

function throwOnlyPGError(operationName) {
  throw new Error(
    `${operationName} is not supported for this dialect (only PostgreSQL supports it currently).`
  );
}

function prefixedTableName(prefix, table) {
  return prefix ? `${prefix}.${table}` : table;
}
