const update = require('./update');

async function patch(dbName, table, id, data) {
  return update(dbName, table, id, data); 
}

module.exports = patch;
