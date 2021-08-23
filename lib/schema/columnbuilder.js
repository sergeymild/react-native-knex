// The chainable interface off the original "column" method.
class ColumnBuilder {
  constructor(client, tableBuilder, type, args) {
    this.client = client;
    this._method = 'add';
    this._single = {};
    this._modifiers = {};
    this._statements = [];
    this._type = type;
    this._args = args;
    this._tableBuilder = tableBuilder;
  }

  defaultTo = (value) => {
    this._modifiers['defaultTo'] = [value];
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

  collate = (...args) => {
    this._modifiers['collate'] = args;
    return this
  }

  notNull = () => this.nullable(false);
  notNullable = () => this.nullable(false);

  index = (...args) => {
    if (this._type.indexOf('increments') !== -1) return this;
    this._tableBuilder['index'].apply(this._tableBuilder, [this._args[0]].concat(args));
    return this;
  }

  primary = (...args) => {
    if (this._type.indexOf('increments') !== -1) return this;
    this._tableBuilder['primary'].apply(this._tableBuilder, [this._args[0]].concat(args));
    return this;
  }

  unique = (...args) => {
    if (this._type.indexOf('increments') !== -1) return this;
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

module.exports = ColumnBuilder;
