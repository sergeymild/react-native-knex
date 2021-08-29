

let idCounter = 0
function uniqueId(prefix) {
  const id = ++idCounter;
  return `${prefix}${id}`
}

function last(array) {
  const length = array ? array.length : 0;
  return length ? array[length - 1] : undefined;
}

module.exports = {
  uniqueId,
  last
}
