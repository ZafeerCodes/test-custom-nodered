const { initializeInfluxDBClient } = require("../configs/influxV2");

module.exports = function (RED) {
  "use strict";
  const VERSION_20 = "2.0";
  function influxDatabaseConfigs(n) {
    RED.nodes.createNode(this, n);
    const node = this;
    node.name = n.name;
    node.url = n.url;
    node.bucket = n.bucket || "";
    node.org = n.org || "";
    node.token = n.token;
    node.connectionTimeout = n.connectionTimeout;
    node.rejectUnauthorized = n.rejectUnauthorized;
    node.influxdbVersion = n.influxdbVersion || VERSION_20;

    // if (node.influxdbVersion === VERSION_20) {
    //   node.client = initializeInfluxDBClient(n, node.credentials);
    // }
  }

  RED.nodes.registerType("influxDatabaseConfigs", influxDatabaseConfigs, {
    credentials: {
      token: { type: "password" },
    },
  });
};
