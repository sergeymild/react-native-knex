// SQLite3: Column Builder & Compiler
// -------
const SchemaCompiler = require('../../../schema/compiler')

// Schema Compiler
// -------

module.exports = class SchemaCompiler_SQLite3 extends SchemaCompiler {
  constructor(client, builder) {
    super(client, builder)
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
    this.pushQuery(
        `alter table ${this.formatter.wrap(from)} rename to ${this.formatter.wrap(
            to
        )}`
    );
  };
}
