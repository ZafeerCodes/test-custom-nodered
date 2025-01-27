const { Client } = require("pg");

/**
 * List all non-template databases.
 * @param {Object} dbConfigs - Database connection configurations.
 * @returns {Promise<string[]>} - A promise that resolves to an array of database names.
 */
async function listDatabases(dbConfigs) {
  const client = new Client({
    user: dbConfigs.username,
    host: dbConfigs.host,
    password: dbConfigs.password,
    port: dbConfigs.port,
    database: 'postgres' 
  });

  try {
    await client.connect();
    const res = await client.query(
      "SELECT datname FROM pg_database WHERE datistemplate = false"
    );

    const databases = res.rows.map((row) => row.datname);
    console.log("Databases:", databases);

    return databases;
  } catch (error) {
    console.error("Error listing databases:", error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Create a new database.
 * @param {Object} dbConfigs - Database connection configurations.
 * @param {string} dbName - The name of the database to create.
 */
async function createDatabasePs(dbConfigs, dbName) {
  const client = new Client({
    user: dbConfigs.username,
    host: dbConfigs.host,
    password: dbConfigs.password,
    port: dbConfigs.port,
    database: 'postgres' 
  });

  try {
    await client.connect();
    const query = `CREATE DATABASE "${dbName}"`; 
    await client.query(query);
    console.log(`Database "${dbName}" created successfully.`);
  } catch (err) {
    console.error(`Error creating database "${dbName}":`, err.stack);
    throw err;
  } finally {
    await client.end();
  }
}

module.exports = { listDatabases, createDatabasePs };
