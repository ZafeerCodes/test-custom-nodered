const { queryDb } = require("../../configs/postgreSql");

async function deleteById(dbName, table, id) {
  const query = `DELETE FROM ${table} WHERE id = $1 RETURNING *`;
  return queryDb(dbName, query, [id]);
}

module.exports = deleteById;
