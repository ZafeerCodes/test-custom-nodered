module.exports = function (RED) {
  "use strict";
  function influxBucketCreationConfigs(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.bucketName = n.bucketName;
    this.retention = n.retention;
  }

  RED.nodes.registerType(
    "influxBucketCreationConfigs",
    influxBucketCreationConfigs
  );
};
