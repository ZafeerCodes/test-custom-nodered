const WebSocketServerClass = require("web-socket-server");
require("dotenv").config();

module.exports = function (RED) {

  function OutputNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    try {
      const wss = new WebSocketServerClass("outputNode", {
        port: process.env.RED_WS_PORT || 1861,
        path: `/websocket`
      });
      node.on("input", function (msg) {
        try {
          node.context().set("outputMsgObj", msg);
          const event = `node_${node.id}`;
          const broadcastResult = wss.broadcast(event, msg);
          node.send({
            ...msg,
            broadcastResult,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          node.error('Error processing input message:', error);
        }
      });

      node.on("close", function (done) {
        try {
          node.context().set("outputMsgObj", null);
          const stats = wss.getServerStats();
          if (stats.clientCount > 0) {
            const clients = wss.getConnectedClients();
            clients.forEach(client => {
              wss.closeConnection(client.clientId, 1000, "Node shutting down");
            });
          }
          // wss.close();
          done();
        } catch (error) {
          console.log('Error during cleanup:', error);
          done();
        }
      });

    } catch (error) {
      console.log('Error initializing WebSocket node:', error);
    }

    RED.httpAdmin.get(`/api/outputnode/data/${node.id}`, function (req, res) {
      try {
        const outputMsgObj = node.context().get("outputMsgObj");
        if (outputMsgObj) {
          res
            .status(200)
            .send({ message: "data fetched!", data: outputMsgObj });
        } else {
          res.status(404).send({ message: "data not found!" });
        }
      } catch (err) {
        node.error("Error fetching data: " + err.message);
        res.status(500).send({ message: "server error!" });
      }
    });
  }

  RED.nodes.registerType("output", OutputNode);
};
