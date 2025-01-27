module.exports = function (RED) {
  "use strict";
  function influxMeasurementCreationConfigs(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.measurementName = n.measurementName;
    this.keys = n.keys;
  }

  RED.nodes.registerType(
    "influxMeasurementCreationConfigs",
    influxMeasurementCreationConfigs
  );
};
