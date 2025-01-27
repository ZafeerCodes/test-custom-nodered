const { queryDb } = require("../../configs/postgreSql");

async function getById(dbName, table, id) {
  const query = `SELECT * FROM ${table} WHERE id = $1`;
  return queryDb(dbName, query, [id]);
}

module.exports = getById;
