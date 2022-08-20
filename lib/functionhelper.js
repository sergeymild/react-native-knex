// FunctionHelper
// -------
class FunctionHelper {
  constructor(client) {
    this.client = client;
  }

  now = (precision) => {
    if (typeof precision === 'number') {
      return this.client.raw(`CURRENT_TIMESTAMP(${precision})`);
    }
    return this.client.raw('CURRENT_TIMESTAMP');
  };
}

module.exports = FunctionHelper;
