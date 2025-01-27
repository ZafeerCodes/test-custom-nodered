const { initializePostgreSQLDBClient, connectToPostgreDatabase, handleDatabaseClose } = require("../configs/postgreSql");

module.exports = function (RED) {
	"use strict";
  function postgreDatabaseConfigs(n) {
    RED.nodes.createNode(this, n);
    const node = this;
    node.name = n.name;
    node.hostname = n.host;
    node.port = n.port;
    node.database = n.database;
    node.ssl = n.ssl;
    node.applicationName = n.applicationName;
    node.max = n.max;
    node.idle = n.idle;
    node.credentials.username = n.username;
    node.credentials.password = n.password;
    node.table = n.table;
    node.protocol = n.protocol;
    node.pgType = n.pgType;
    node.timeout = n.connectionTimeout;

    // node.client = initializePostgreSQLDBClient(node, node.credentials);

    // if (node.client) {
    //   connectToPostgreDatabase(node.client, node);
    // }

    node.on("close", (done) => {
      handleDatabaseClose(node.client, node, done);
    });
  }

  RED.nodes.registerType("postgreDatabaseConfigs", postgreDatabaseConfigs, {
    credentials: {
      username: { type: "text" },
      password: { type: "password" },
    },
  });
};
