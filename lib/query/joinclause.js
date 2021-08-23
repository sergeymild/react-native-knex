// JoinClause
// -------

// The "JoinClause" is an object holding any necessary info about a join,
// including the type, and any associated tables & columns being joined.
function JoinClause(table, type, schema) {
  this.schema = schema;
  this.table = table;
  this.joinType = type;
  this.and = this;
  this.clauses = [];
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
        data = { type: 'onRaw', value: first, bool };
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

Object.assign(JoinClause.prototype, {
  grouping: 'join',

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

    if (data) {
      this.clauses.push(data);
    }

    return this;
  },

  // Adds a "using" clause to the current join.
  using(column) {
    return this.clauses.push({ type: 'onUsing', column, bool: this._bool() });
  },

  // Adds an "or on" clause to the current join object.
  orOn(first, operator, second) {
    return this._bool('or').on.apply(this, arguments);
  },

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
  },

  orOnVal() {
    return this._bool('or').onVal(...arguments);
  },

  // Explicitly set the type of join, useful within a function when creating a grouped join.
  type(type) {
    this.joinType = type;
    return this;
  },

  _bool(bool) {
    if (arguments.length === 1) {
      this._boolFlag = bool;
      return this;
    }
    const ret = this._boolFlag || 'and';
    this._boolFlag = 'and';
    return ret;
  },
});

Object.defineProperty(JoinClause.prototype, 'or', {
  get() {
    return this._bool('or');
  },
});

module.exports = JoinClause;
