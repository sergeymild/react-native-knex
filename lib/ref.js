const Raw = require('./raw')

class Ref extends Raw {
  constructor(client, ref) {
    super(client);

    this.ref = ref;
    this._schema = null;
    this._alias = null;
  }

  as(alias) {
    this._alias = alias;
    return this;
  }

  toSQL() {
    const string = this._schema ? `${this._schema}.${this.ref}` : this.ref;
    const formatter = this.client.formatter(this);
    const ref = formatter.columnize(string);
    const sql = this._alias ? `${ref} as ${formatter.wrap(this._alias)}` : ref;
    this.set(sql, []);
    return super.toSQL(...arguments);
  }
}

module.exports = Ref;
