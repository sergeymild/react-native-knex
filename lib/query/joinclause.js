// JoinClause
// -------

// The "JoinClause" is an object holding any necessary info about a join,
// including the type, and any associated tables & columns being joined.
class JoinClause {
  grouping = 'join'

  constructor(table, type, schema) {
    this.schema = schema;
    this.table = table;
    this.joinType = type;
    this.and = this;
    this.clauses = [];
  }

  get or() {
    return this._bool('or')
  }

  // Adds an "on" clause to the current join object.
  on(first) {
    if (typeof first === 'object' && typeof first.toSQL !== 'function') {
      const keys = Object.keys(first);
      let i = -1;
      const method = this._bool() === 'or' ? 'orOn' : 'on';
      while (++i < keys.length) {
        this[method](keys[i], first[keys[i]]);
      }
      return this;
    }

    const data = getClauseFromArguments('onBasic', this._bool(), ...arguments);

    if (data) this.clauses.push(data);

    return this;
  }

  onIn(column, values) {
    if (Array.isArray(values) && values.length === 0) return this.on(1, '=', 0);
    this.clauses.push({
      type: 'onIn',
      column,
      value: values,
      not: this._not(),
      bool: this._bool(),
    });
    return this;
  }

  onVal(first) {
    if (typeof first === 'object' && typeof first.toSQL !== 'function') {
      const keys = Object.keys(first);
      let i = -1;
      const method = this._bool() === 'or' ? 'orOnVal' : 'onVal';
      while (++i < keys.length) {
        this[method](keys[i], first[keys[i]]);
      }
      return this;
    }

    const data = getClauseFromArguments('onVal', this._bool(), ...arguments);

    if (data) {
      this.clauses.push(data);
    }

    return this;
  }

  andOnVal() {
    return this.onVal(...arguments);
  }

  orOnVal() {
    return this._bool('or').onVal(...arguments);
  }

  onNotIn(column, values) {
    return this._not(true).onIn(column, values);
  }

  orOnIn(column, values) {
    return this._bool('or').onIn(column, values);
  }

  orOnNotIn(column, values) {
    return this._bool('or')._not(true).onIn(column, values);
  }

  // Adds a "using" clause to the current join.
  using(column) {
    return this.clauses.push({type: 'onUsing', column, bool: this._bool()});
  }

  // Adds an "or on" clause to the current join object.
  orOn(first, operator, second) {
    return this._bool('or').on.apply(this, arguments);
  }

  // Explicitly set the type of join, useful within a function when creating a grouped join.
  type(type) {
    this.joinType = type;
    return this;
  }

  _bool(bool) {
    if (arguments.length === 1) {
      this._boolFlag = bool;
      return this;
    }
    const ret = this._boolFlag || 'and';
    this._boolFlag = 'and';
    return ret;
  }

  _not(val) {
    if (arguments.length === 1) {
      this._notFlag = val;
      return this;
    }
    const ret = this._notFlag;
    this._notFlag = false;
    return ret;
  }
}

function getClauseFromArguments(compilerType, bool, first, operator, second) {
  let data = null;

  if (typeof first === 'function') {
    data = {
      type: 'onWrapped',
      value: first,
      bool: bool,
    };
  } else {
    switch (arguments.length) {
      case 3: {
        data = {type: 'onRaw', value: first, bool};
        break;
      }
      case 4:
        data = {
          type: compilerType,
          column: first,
          operator: '=',
          value: operator,
          bool,
        };
        break;
      default:
        data = {
          type: compilerType,
          column: first,
          operator,
          value: second,
          bool,
        };
    }
  }

  return data;
}

module.exports = JoinClause;
