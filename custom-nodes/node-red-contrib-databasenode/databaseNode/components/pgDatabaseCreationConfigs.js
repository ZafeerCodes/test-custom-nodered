module.exports = function (RED) {
  "use strict";
  function pgDatabaseCreationConfigs(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.database = n.database;
  }

  RED.nodes.registerType(
    "pgDatabaseCreationConfigs",
    pgDatabaseCreationConfigs,
    {
      credentials: {
        username: { type: "text" },
        password: { type: "password" },
      },
    }
  );
};
