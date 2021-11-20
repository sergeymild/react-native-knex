const ClientSQLite3 = require('./sqlite3')

module.exports = class ClientReactNativeSqliteStorage extends ClientSQLite3 {
  async acquireConnection() {
    if (this._connection) return this._connection
    //const driver = await require('react-native-sqlite-storage')
    this._connection = this.driver.openDatabase({name: this.config.name})
    return this._connection
  }

  destroyConnection(db) {
    db.close().catch((err) => {
      this.emit('error', err);
    });
  }

  _query(connection, obj) {
    if (!connection) return Promise.reject(new Error('No connection provided.'));

    this.logQuery(obj)

    return connection.executeSql(obj.sql, obj.bindings)
      .then((response) => {
        obj.context = {
          lastID: response.insertId,
          changes: response.rowsAffected
        }
        obj.response = response.rows
        return obj;
      })
  }

}
