/* eslint no-console:0 */

const { isFunction } = require('./util/is')

class Logger {
  constructor(config = {}) {
    const {
      log: {
        debug,
        warn,
        error,
        deprecate,
      } = {},
    } = config;
    this._debug = debug || console.log;
    this._warn = warn || console.warn;
    this._error = error || console.error;
    this._deprecate = deprecate || console.warn;
  }

  _log(message, userFn) {
    if (userFn != null && !isFunction(userFn)) {
      throw new TypeError('Extensions to knex logger must be functions!');
    }

    if (isFunction(userFn)) {
      userFn(message);
    }
  }

  debug(message) {
    this._log(message, this._debug);
  }

  warn(message) {
    this._log(message, this._warn);
  }

  error(message) {
    this._log(message, this._error);
  }

  deprecate(method, alternative) {
    const message = `${method} is deprecated, please use ${alternative}`;

    this._log(message, this._deprecate);
  }
}

module.exports = Logger;
