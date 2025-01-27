const { queryDb } = require("../../configs/postgreSql");

async function insert(dbName, table, data) {
  const columns = Object.keys(data).join(', ');
  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
  return queryDb(dbName, query, values);
}

module.exports = insert;
