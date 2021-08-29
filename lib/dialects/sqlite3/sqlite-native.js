const ClientSQLite3 = require('./sqlite3')

module.exports = class ClientReactNativeSqliteStorage extends ClientSQLite3 {
  async acquireConnection() {
    if (this._connection) return this._connection
    this._connection = this.driver.openDatabase({name: this.config.connection})
    return this._connection
  }

  destroyConnection(db) {
    db.close().catch((err) => {
      this.emit('error', err);
    });
  }

  _query(connection, obj) {
    if (!connection) return Promise.reject(new Error('No connection provided.'));
    return connection.executeSql(obj.sql, obj.bindings)
      .then((response) => {
        let results = [];
        const r = Array.isArray(response) ? response[0] : response
        for (let i = 0, l = r.rows.length; i < l; i++) {
          results[i] = r.rows.item(i);
        }
        obj.context = {
          lastID: r.insertId,
          changes: r.rowsAffected
        }
        obj.response = results
        return obj;
      })
  }

}
