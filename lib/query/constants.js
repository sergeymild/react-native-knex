/**
 * internal constants, do not use in application code
 */
const lockMode = {
  forShare: 'forShare',
    forUpdate: 'forUpdate',
}
const waitMode = {
  skipLocked: 'skipLocked',
    noWait: 'noWait',
}

module.exports = {
  lockMode,
  waitMode
}
