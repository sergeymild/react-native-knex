const chunk = require('lodash.chunk')
const flatten = require('lodash.flatten')
const delay = require('./delay')
const { isNumber } = require('./is')
const OnConflictBuilder = require("../query/OnConflictBuilder");

module.exports = class BatchInsert {
  _batch = []
  _chunkSize = 100
  _single = {}
  constructor(client, tableName) {
    this.client = client
    this.tableName = tableName
  }

  items(items) {
    this._batch = items
    return this
  }

  chunkSize(size) {
    this._chunkSize = size
    return this
  }

  transacting(tr) {
    this.tr = tr
    return this
  }

  onConflict(columns) {
    if (typeof columns === 'string') {
      columns = [columns];
    }
    return new OnConflictBuilder(this, columns || true);
  }

  // Create a new instance of the `Runner`, passing in the current object.
  async run() {
    let transaction
    if (this.tr) transaction = (cb) => cb(this.tr)
    else transaction = (cb) => this.client.transaction(cb)

    if (!isNumber(this._chunkSize) || this._chunkSize < 1) {
      throw new TypeError(`Invalid chunkSize: ${this._chunkSize}`);
    }

    if (!Array.isArray(this._batch)) {
      throw new TypeError(`Invalid batch: Expected array, got ${typeof this._batch}`);
    }

    const chunks = chunk(this._batch, this._chunkSize);

    //Next tick to ensure wrapper functions are called if needed
    await delay(1);
    return transaction(async (tr) => {
      const chunksResults = [];
      for (const items of chunks) {
        let query = tr.table(this.tableName).insert(items)
        if (this._single.onConflict) {
          const conflictBuilder = query.onConflict(this._single.onConflict)
          if (this._single.ignore) query = conflictBuilder.ignore()
          if (this._single.merge) query = conflictBuilder.merge(this._single.merge)
        }
        chunksResults.push(await query);
      }
      return flatten(chunksResults);
    });
  };

  then = (resolve, reject) => {
    let result = this.run();
    return result.then.call(result, resolve, reject);
  }

  finally = (onFinally) => this.then().finally(onFinally);
  catch = (onReject) => this.then().catch(onReject);
}
