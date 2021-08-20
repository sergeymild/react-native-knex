// Column Compiler
// Used for designating column definitions
// during the table "create" / "alter" statements.
// -------
const Raw = require('../raw')
const groupBy = require('lodash.groupby')
const first = require('lodash.first')
const has = require('lodash.has')
const tail = require('lodash.tail')
const { isObject } = require('../util/is')
const { escapeBinding } = require('../query/string')

module.exports = class ColumnCompiler {
  _defaultMap = {
    columnName: function () {
      if (!this.isIncrements) {
        throw new Error(
            `You did not specify a column name for the ${this.type} column.`
        );
      }
      return 'id';
    },
  };

  // TYPES
  increments = 'integer not null primary key autoincrement'
  text = 'text'
  binary = 'blob';
  bool = 'integer';
  date = 'date';
  datetime = 'datetime';
  timestamp = 'datetime';
  json = 'json';
  real = 'real'
  time = 'time';
  integer = 'integer';
  uuid = 'char(36)';
  modifiers = ['nullable', 'defaultTo'];
  specifictype = (type) => type
  varchar = (length) => `varchar(${this._num(length, 255)})`;
  enu = (allowed) => {
    return `text check (${this.formatter.wrap(this.args[0])} in ('${allowed.join(
        "', '"
    )}'))`;
  };


  // Modifiers
  // -------

  nullable = (nullable) => nullable === false ? 'not null' : 'null';
  notNullable = () => this.nullable(false);
  defaultTo = (value) => {
    if (value === void 0) {
      return '';
    } else if (value === null) {
      value = 'null';
    } else if (value instanceof Raw) {
      value = value.toQuery();
    } else if (this.type === 'bool') {
      if (value === 'false') value = 0;
      value = `'${value ? 1 : 0}'`;
    } else if (
        (this.type === 'json') &&
        isObject(value)
    ) {
      value = `'${JSON.stringify(value)}'`;
    } else {
      value = escapeBinding(value.toString());
    }
    return `default ${value}`;
  };
  _num = (val, fallback) => {
    if (val === undefined || val === null) return fallback;
    const number = parseInt(val, 10);
    return isNaN(number) ? fallback : number;
  }

  constructor(client, tableCompiler, columnBuilder) {
    this.client = client;
    this.tableCompiler = tableCompiler;
    this.columnBuilder = columnBuilder;
    this._commonBuilder = this.columnBuilder;
    this.args = columnBuilder._args;
    this.type = columnBuilder._type.toLowerCase();
    this.grouped = groupBy(columnBuilder._statements, 'grouping');
    this.modified = columnBuilder._modifiers;
    this.isIncrements = this.type.indexOf('increments') !== -1;
    this.formatter = client.formatter(columnBuilder);
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
    const child = new ColumnCompiler(this.client, this.tableCompiler, this.columnBuilder)
    fn.call(child, ...args);
    this.sequence.additional = (this.sequence.additional || []).concat(child.sequence);
  }
  unshiftQuery = (query) => {
    if (!query) return;
    if (typeof query === 'string') query = { sql: query };
    if (!query.bindings) query.bindings = this.formatter.bindings;
    this.sequence.unshift(query);
    this.formatter = this.client.formatter(this._commonBuilder);
  }

  defaults = (label) => {
    if (Object.prototype.hasOwnProperty.call(this._defaultMap, label)) {
      return this._defaultMap[label].bind(this)();
    } else {
      throw new Error(
          `There is no default for the specified identifier ${label}`
      );
    }
  };

  // Compiles a column.
  compileColumn = () => {
    return (
        this.formatter.wrap(this.getColumnName()) +
        ' ' +
        this.getColumnType() +
        this.getModifiers()
    );
  };

  // Assumes the autoincrementing key is named `id` if not otherwise specified.
  getColumnName = () => {
    const value = first(this.args);
    return value || this.defaults('columnName');
  };

  getColumnType = () => {
    const type = this[this.type];
    return typeof type === 'function' ? type.apply(this, tail(this.args)) : type;
  };

  getModifiers = () => {
    const modifiers = [];

    for (let i = 0, l = this.modifiers.length; i < l; i++) {
      const modifier = this.modifiers[i];

      //Cannot allow 'nullable' modifiers on increments types
      if (this.isIncrements) continue
      if (!has(this.modified, modifier)) continue
      const val = this[modifier].apply(this, this.modified[modifier]);
      if (val) modifiers.push(val);
    }
    return modifiers.length > 0 ? ` ${modifiers.join(' ')}` : '';
  };

  // To convert to sql, we first go through and build the
  // column as it would be in the insert statement
  toSQL = () => {
    this.pushQuery(this.compileColumn());
    if (this.sequence.additional) {
      this.sequence = this.sequence.concat(this.sequence.additional);
    }
    return this.sequence;
  };
}
