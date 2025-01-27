module.exports = function (RED) {
  function FlowControlNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    function handleFlowControl(msg) {
      const { nodeId, action } = msg;

      if (!action) {
        node.error("Action not specified");
        return;
      }

      if (action === "start") {
        node.status({ fill: "green", shape: "ring", text: "Started" });
        node.send({ ...msg, payload: `Node ${nodeId} started` });
      } else if (action === "stop") {
        node.status({ fill: "red", shape: "ring", text: "Stopped" });
        node.send({ ...msg, payload: `Node ${nodeId} stopped` });
      } else {
        node.error(`Invalid action: ${action}. Expected "start" or "stop".`);
      }
    }

    let flag = true;
    this.on("input", function (msg) {
      // var flowId = node?.z;
      handleFlowControl({
        nodeId: node?.id,
        action: flag ? "start" : "stop",
      });
      flag = !flag;
    });

    this.on("close", function (done) {
      handleFlowControl({
        nodeId: node?.id,
        action: "stop",
      });
      done();
    });
  }
  RED.nodes.registerType("flow control", FlowControlNode);
};
