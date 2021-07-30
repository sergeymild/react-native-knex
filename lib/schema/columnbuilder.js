const extend = require('lodash.assignin')
const toArray = require('lodash.toarray')

// Alias a few methods for clarity when processing.
const columnAlias = {
  enum: 'enu',
  boolean: 'bool',
  string: 'varchar',
};

// The chainable interface off the original "column" method.
class ColumnBuilder {
  constructor(client, tableBuilder, type, args) {
    this.client = client;
    this._method = 'add';
    this._single = {};
    this._modifiers = {};
    this._statements = [];
    this._type = columnAlias[type] || type;
    this._args = args;
    this._tableBuilder = tableBuilder;

    // If we're altering the table, extend the object
    // with the available "alter" methods.
    if (tableBuilder._method === 'alter') {
      extend(this, AlterMethods);
    }
  }

  default = (...args) => {
    this._modifiers['default'] = args;
    return this
  }

  defaultTo = (...args) => {
    this._modifiers['defaultTo'] = args;
    return this
  }

  defaultsTo = (...args) => {
    this._modifiers['defaultsTo'] = args;
    return this
  }

  unsigned = (...args) => {
    this._modifiers['unsigned'] = args;
    return this
  }
  nullable = (...args) => {
    this._modifiers['nullable'] = args;
    return this
  }
  first = (...args) => {
    this._modifiers['first'] = args;
    return this
  }
  after = (...args) => {
    this._modifiers['after'] = args;
    return this
  }
  comment = (...args) => {
    this._modifiers['comment'] = args;
    return this
  }
  collate = (...args) => {
    this._modifiers['collate'] = args;
    return this
  }

  notNull = () => this.nullable(false);
  notNullable = () => this.nullable(false);

  index = (...args) => {
    if (this._type.toLowerCase().indexOf('increments') !== -1) return this;
    this._tableBuilder['index'].apply(this._tableBuilder, [this._args[0]].concat(args));
    return this;
  }

  primary = (...args) => {
    if (this._type.toLowerCase().indexOf('increments') !== -1) return this;
    this._tableBuilder['primary'].apply(this._tableBuilder, [this._args[0]].concat(args));
    return this;
  }

  unique = (...args) => {
    if (this._type.toLowerCase().indexOf('increments') !== -1) return this;
    this._tableBuilder['unique'].apply(this._tableBuilder, [this._args[0]].concat(args));
    return this;
  }

  // Specify that the current column "references" a column,
  // which may be tableName.column or just "column"
  references = (value) => {
    return this._tableBuilder.foreign
        .call(this._tableBuilder, this._args[0], undefined, this)
        ._columnBuilder(this)
        .references(value);
  };
}

const AlterMethods = {};

// Specify that the column is to be dropped. This takes precedence
// over all other rules for the column.
AlterMethods.drop = function () {
  this._single.drop = true;

  return this;
};

// Specify the "type" that we're looking to set the
// Knex takes no responsibility for any data-loss that may
// occur when changing data types.
AlterMethods.alterType = function (type) {
  this._statements.push({
    grouping: 'alterType',
    value: type,
  });

  return this;
};

// Set column method to alter (default is add).
AlterMethods.alter = function () {
  this._method = 'alter';

  return this;
};

module.exports = ColumnBuilder;
