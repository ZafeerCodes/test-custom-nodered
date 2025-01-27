module.exports = function (RED) {
  "use strict";
  function pgDatabaseTableCreationConfigs(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.tableName = n.tableName;
  }

  RED.nodes.registerType(
    "pgDatabaseTableCreationConfigs",
    pgDatabaseTableCreationConfigs,
    {
      credentials: {
        username: { type: "text" },
        password: { type: "password" },
      },
    }
  );
};
