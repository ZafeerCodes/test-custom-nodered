const { queryDb } = require("../../configs/postgreSql");

async function getAll(dbName, table) {
  const query = `SELECT * FROM ${table}`;
  return queryDb(dbName, query);
}

module.exports = getAll;
