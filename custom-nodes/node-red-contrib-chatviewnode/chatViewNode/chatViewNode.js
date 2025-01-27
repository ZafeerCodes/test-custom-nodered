
require("dotenv").config();
module.exports = function (RED) {
  function ChatViewNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.on("input", function (msg, send, done) {
      done();
    });
    node.on("close", function (done) {
      try {
        done();
      } catch (error) {
        done();
      }
    });
  }

  RED.nodes.registerType("chat view", ChatViewNode);
};



