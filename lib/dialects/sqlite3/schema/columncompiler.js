const inherits = require('inherits')
const ColumnCompiler = require('../../../schema/columncompiler')

// Column Compiler
// -------

module.exports = class ColumnCompiler_SQLite3 extends ColumnCompiler {
  modifiers = ['nullable', 'defaultTo'];
  real = 'real'
  timestamp = 'datetime';
  json = 'json';
  enu = (allowed) => {
    return `text check (${this.formatter.wrap(this.args[0])} in ('${allowed.join(
        "', '"
    )}'))`;
  };

  constructor(...args) {
    super(...args)
  }
}
