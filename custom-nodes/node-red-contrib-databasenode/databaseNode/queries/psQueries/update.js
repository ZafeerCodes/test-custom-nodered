const { queryDb } = require("../../configs/postgreSql");

async function update(dbName, table, id, data) {
  const setClause = Object.keys(data).map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = [...Object.values(data), id];
  const query = `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`;
  return queryDb(dbName, query, values);
}

module.exports = update;
