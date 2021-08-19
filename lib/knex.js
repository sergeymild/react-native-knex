const Client = require('./client')

const KnexClass = require('./util/make-knex')
const { KnexTimeoutError } = require('./util/timeout')

// Expose Client on the main Knex namespace.
KnexClass.Client = Client;

KnexClass.KnexTimeoutError = KnexTimeoutError;

/* eslint no-console:0 */

module.exports = KnexClass;
