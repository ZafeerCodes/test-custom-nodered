module.exports = function (RED) {
  "use strict";
  function pgDatabaseViewTableConfigs(n) {
    RED.nodes.createNode(this, n);
    var node = this;
  }

  RED.nodes.registerType(
    "pgDatabaseViewTableConfigs",
    pgDatabaseViewTableConfigs
  );
};
