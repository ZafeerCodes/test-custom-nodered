const { Client } = require("pg");
const { mapPayloads } = require("../../helpers/payloadMapping");

function initializePostgreSQLDBClient(config, credentials) {
  const clientConfig = {
    host: config.hostname,
    port: config.port,
    user: credentials.username,
    password: credentials.password,
    database: config.database,
    ssl: config.protocol === "https",
    connectionTimeoutMillis: config.connectionTimeout * 1000,
  };

  return new Client(clientConfig);
}

function connectToPostgreDatabase(client, node) {
  client.connect((err) => {
    if (err) {
      node.error("Failed to connect to PostgreSQL: " + err.message);
    } else {
      node.log("Connected to PostgreSQL database");
    }
  });

  client.on("error", (err) => {
    node.error("Database connection error: " + err.message);
    client.end().catch((closeErr) => {
      node.error("Error closing connection after failure: " + closeErr.message);
    });
  });
}

async function executeInsertQuery(client, tableName, msg, payloadKeys, node) {
  // if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
  //   throw new Error("Invalid table name");
  // }

  let fieldsValues;
  try {
    fieldsValues = await mapPayloads(msg, payloadKeys, msg.node, node);
  } catch (error) {
    node.error(`Error mapping payloads: ${error.message}`);
    return;
  }

  const fields = fieldsValues || {};
  if (fields && Object.keys(fields).length > 0) {
    const columns = Object.keys(fields);
    const placeholders = columns.map((_, idx) => `$${idx + 1}`);
    const values = Object.values(fields);

    const query = `INSERT INTO "${tableName}" (${columns.join(", ")}) VALUES (${placeholders.join(", ")});`;

    try {
      await client.query(query, values);
      node.log(`Inserted data into ${tableName}`);
    } catch (error) {
      node.error(`Failed to insert data into ${tableName}: ${error.message}`);
    }
  } else {
    node.warn("Fields are empty, skipping fields addition");
  }
}


async function processPostgrePayloads(client, msg, tableName, payloadKeys, node, done) {
  try {
    await executeInsertQuery(client, tableName, msg, payloadKeys, node);
    done();
  } catch (error) {
    msg.postgres_error = { errorMessage: error.message };
    console.error("Error writing to PostgreDB:", error);
    done(error);
  }
}

function handleDatabaseClose(client, node, done) {
  client.end().then(() => {
    node.log("Database connection closed");
    done();
  }).catch((err) => {
    node.error("Error closing database connection: " + err.message);
    done();
  });
}

module.exports = {
  initializePostgreSQLDBClient,
  connectToPostgreDatabase,
  processPostgrePayloads,
  handleDatabaseClose,
};
