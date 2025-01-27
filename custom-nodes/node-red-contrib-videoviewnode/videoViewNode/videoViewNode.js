const { generateVideo } = require("./resources/storevideo");

var closed = true;
module.exports = function (RED) {
  function VideoViewNode(config) {
    RED.nodes.createNode(this, config);

    var node = this;
    node.status({ fill: "brown", shape: "ring", text: "Idle" });

    this.on("input", function (msg) {
      closed = true;
      try {
        let buffer = msg?.annotatedBuffer || msg?.frameBuffer;

        if (Buffer.isBuffer(buffer)) {
          generateVideo(buffer);
          node.status({ fill: "yellow", shape: "ring", text: "Generating" });
        } else {
          console.log("Invalid input: Expected a Buffer.");
          node.status({ fill: "red", shape: "ring", text: "Error: Invalid Buffer" });
        }

        node.send(msg);
      } catch (err) {
        console.log("Error in processing frames: " + err.message);
      }
    });

    this.on("close", function () {
      if (closed) {
        generateVideo(null, true);
        node.status({ fill: "brown", shape: "ring", text: "Idle" });
      }
      closed = false;
    });
  }

  RED.nodes.registerType("video view", VideoViewNode);
};
