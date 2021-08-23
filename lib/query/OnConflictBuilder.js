
module.exports = class OnConflictBuilder {
  constructor(builder, columns) {
    this.builder = builder;
    this._columns = columns;
  }

  // Sets insert query to ignore conflicts
  ignore() {
    this.builder._single.onConflict = this._columns;
    this.builder._single.ignore = true;
    return this.builder;
  }

  // Sets insert query to update on conflict
  merge(updates) {
    this.builder._single.onConflict = this._columns;
    this.builder._single.merge = { updates };
    return this.builder;
  }

  // Prevent
  then() {
    throw new Error(
      'Incomplete onConflict clause. .onConflict() must be diretly followed by either .merge() or .ignore()'
    );
  }
}
