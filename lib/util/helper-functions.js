

function tail(array) {
  const length = array ? array.length : 0;
  if (length === 1) return [array[0]]
  return length ? array.slice(1, length) : [];
}

module.exports = {
  tail
}
