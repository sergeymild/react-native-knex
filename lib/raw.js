// Raw
// -------
const {getUndefinedIndices, containsUndefined} = require('./helpers')
const EventEmitter = require('./EventEmitter')

const isPlainObject = require('lodash.isplainobject')
const saveAsyncStack = require('./util/save-async-stack')
const {nanoid} = require('./util/nanoid')
const {isNumber, isObject} = require('./util/is')
const isEmpty = require("lodash.isempty");

class Raw extends EventEmitter {
    constructor(client) {
        super()
        this.client = client;

        this.sql = '';
        this.bindings = [];

        // Todo: Deprecate
        this._wrappedBefore = undefined;
        this._wrappedAfter = undefined;
        if (client && client.config) {
            this._debug = client.config.debug;
            saveAsyncStack(this, 4);
        }
    }

    set(sql, bindings) {
        this.sql = sql;
        this.bindings =
            (isObject(bindings) && !bindings.toSQL) || bindings === undefined
                ? bindings
                : [bindings];

        return this;
    }

    timeout(ms, {cancel} = {}) {
        if (isNumber(ms) && ms > 0) {
            this._timeout = ms;
            if (cancel) {
                this.client.assertCanCancelQuery();
                this._cancelOnTimeout = true;
            }
        }
        return this;
    }

    // Wraps the current sql with `before` and `after`.
    wrap(before, after) {
        this._wrappedBefore = before;
        this._wrappedAfter = after;
        return this;
    }

    toQuery = (tz) => {
        let data = this.toSQL(this._method, tz);
        if (!Array.isArray(data)) data = [data];
        if (!data.length) {
            return '';
        }
        return data
            .map((statement) => this.client._formatQuery(statement.sql, statement.bindings, tz))
            .reduce((a, c) => a.concat(a.endsWith(';') ? '\n' : ';\n', c));
    }

    // Calls `toString` on the Knex object.
    toString() {
        return this.toQuery();
    }

    // Returns the raw sql for the query.
    toSQL() {
        let obj;
        const formatter = this.client.formatter(this);

        if (Array.isArray(this.bindings)) {
            obj = replaceRawArrBindings(this, formatter);
        } else if (this.bindings && isPlainObject(this.bindings)) {
            obj = replaceKeyBindings(this, formatter);
        } else {
            obj = {
                method: 'raw',
                sql: this.sql,
                bindings: this.bindings === undefined ? [] : [this.bindings],
            };
        }

        if (this._wrappedBefore) {
            obj.sql = this._wrappedBefore + obj.sql;
        }
        if (this._wrappedAfter) {
            obj.sql = obj.sql + this._wrappedAfter;
        }

        if (this._timeout) {
            obj.timeout = this._timeout;
            if (this._cancelOnTimeout) {
                obj.cancelOnTimeout = this._cancelOnTimeout;
            }
        }

        obj.bindings = obj.bindings || [];
        if (containsUndefined(obj.bindings)) {
            const undefinedBindingIndices = getUndefinedIndices(
                this.bindings
            );
            throw new Error(
                `Undefined binding(s) detected for keys [${undefinedBindingIndices}] when compiling RAW query: ${obj.sql}`
            );
        }

        obj.__knexQueryUid = nanoid();

        return obj;
    }

    then = (resolve, reject) => {
        let result = this.client.runner(this).run();
        return result.then.call(result, resolve, reject);
    }

    catch = (onReject) => {
        return this.then().catch(onReject);
    }

    finally = (onFinally) => {
        return this.then().finally(onFinally);
    }

    connection = (connection) => {
        this._connection = connection;
        return this;
    };

    debug = (enabled) => {
        this._debug = enabled ?? true;
        return this;
    }

    transacting = (transaction) => {
        if (transaction && transaction.client) {
            if (!transaction.client.transacting) {
                transaction.client.logger.warn(
                    `Invalid transaction value: ${transaction.client}`
                );
            } else {
                this.client = transaction.client;
            }
        }
        if (isEmpty(transaction)) {
            this.client.logger.error(
                'Invalid value on transacting call, potential bug'
            );
            throw Error(
                'Invalid transacting value (null, undefined or empty object)'
            );
        }
        return this;
    }
}

function replaceRawArrBindings(raw, formatter) {
    const expectedBindings = raw.bindings.length;
    const values = raw.bindings;
    let index = 0;

    const sql = raw.sql.replace(/\\?\?\??/g, function (match) {
        if (match === '\\?') {
            return match;
        }

        const value = values[index++];

        if (match === '??') {
            return formatter.columnize(value);
        }
        return formatter.parameter(value);
    });

    if (expectedBindings !== index) {
        throw new Error(`Expected ${expectedBindings} bindings, saw ${index}`);
    }

    return {
        method: 'raw',
        sql,
        bindings: formatter.bindings,
    };
}

function replaceKeyBindings(raw, formatter) {
    const values = raw.bindings;
    const regex = /\\?(:(\w+):(?=::)|:(\w+):(?!:)|:(\w+))/g;

    const sql = raw.sql.replace(regex, function (match, p1, p2, p3, p4) {
        if (match !== p1) {
            return p1;
        }

        const part = p2 || p3 || p4;
        const key = match.trim();
        const isIdentifier = key[key.length - 1] === ':';
        const value = values[part];

        if (value === undefined) {
            if (Object.prototype.hasOwnProperty.call(values, part)) {
                formatter.bindings.push(value);
            }

            return match;
        }

        if (isIdentifier) {
            return match.replace(p1, formatter.columnize(value));
        }

        return match.replace(p1, formatter.parameter(value));
    });

    return {
        method: 'raw',
        sql,
        bindings: formatter.bindings,
    };
}

module.exports = Raw;
