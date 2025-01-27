const { queryDb, closeAllPools } = require("../../configs/postgreSql");

async function getDataFromDatabases() {
  try {
    const results = await queryDb('postgresql', 'SELECT * FROM percepto WHERE id = $1', [1]);
    console.log('Result from postgreSQL:', results);


  } catch (err) {
    console.error('Error querying databases:', err);
  } finally {
    await closeAllPools();
  }
}



const dbQueries = {
    getAll: async (dbName, table) => queryDb(dbName, `SELECT * FROM ${table}`),
    
    getById: async (dbName, table, id) => queryDb(dbName, `SELECT * FROM ${table} WHERE id = $1`, [id]),
    
    insert: async (dbName, table, data) => {
      const columns = Object.keys(data).join(', ');
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
      return queryDb(dbName, query, values);
    },
  
    update: async (dbName, table, id, data) => {
      const setClause = Object.keys(data).map((col, i) => `${col} = $${i + 1}`).join(', ');
      const values = [...Object.values(data), id];
      const query = `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`;
      return queryDb(dbName, query, values);
    },
  
    patch: async (dbName, table, id, data) => dbQueries.update(dbName, table, id, data), // Reuses update for partial updates
    
    deleteById: async (dbName, table, id) => queryDb(dbName, `DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]),
  };

getDataFromDatabases();
