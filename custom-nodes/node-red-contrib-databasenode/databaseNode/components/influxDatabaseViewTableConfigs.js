module.exports = function (RED) {
  "use strict";
  function influxDatabaseViewTableConfigs(n) {
    RED.nodes.createNode(this, n);
    var node = this;
  }

  RED.nodes.registerType(
    "influxDatabaseViewTableConfigs",
    influxDatabaseViewTableConfigs
  );
};
