/* eslint no-console:0 */

const isPlainObject = require('lodash.isplainobject')
const isTypedArray = require('lodash.istypedarray')
const { isFunction } = require('./util/is')

// Check if the first argument is an array, otherwise uses all arguments as an
// array.

function normalizeArr() {
  const args = new Array(arguments.length);
  for (let i = 0; i < args.length; i++) {
    args[i] = arguments[i];
  }
  if (Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

function containsUndefined(mixed) {
  let argContainsUndefined = false;

  if (isTypedArray(mixed)) return false;

  if (mixed && isFunction(mixed.toSQL)) {
    //Any QueryBuilder or Raw will automatically be validated during compile.
    return argContainsUndefined;
  }

  if (Array.isArray(mixed)) {
    for (let i = 0; i < mixed.length; i++) {
      if (argContainsUndefined) break;
      argContainsUndefined = containsUndefined(mixed[i]);
    }
  } else if (isPlainObject(mixed)) {
    Object.keys(mixed).forEach((key) => {
      if (!argContainsUndefined) {
        argContainsUndefined = containsUndefined(mixed[key]);
      }
    });
  } else {
    argContainsUndefined = mixed === undefined;
  }

  return argContainsUndefined;
}

function getUndefinedIndices(mixed) {
  const indices = [];

  if (Array.isArray(mixed)) {
    mixed.forEach((item, index) => {
      if (containsUndefined(item)) {
        indices.push(index);
      }
    });
  } else if (isPlainObject(mixed)) {
    Object.keys(mixed).forEach((key) => {
      if (containsUndefined(mixed[key])) {
        indices.push(key);
      }
    });
  } else {
    indices.push(0);
  }

  return indices;
}

module.exports = {
  containsUndefined,
  normalizeArr,
  getUndefinedIndices,
};
