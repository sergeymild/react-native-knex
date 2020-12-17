import ClientSQLite3 from './sqlite3';

export default class ClientReactNativeSqliteStorage extends ClientSQLite3 {
  acquireConnection() {
    return new Promise(resolve => {
      if (this._connection) return resolve(this._connection)
      this._connection = this.driver.openDatabase({name: this.config.connection.filename})
      resolve(this._connection)
    })
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
        this.logger.debug("_query", obj)
        let results = [];
        for (let i = 0, l = response.rows.length; i < l; i++) {
          results[i] = response.rows.item(i);
        }
        obj.context = {
          lastID: response.insertId,
          changes: response.rowsAffected
        }
        obj.response = results
        return obj;
      });
  }

}
