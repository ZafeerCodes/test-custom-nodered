const path = require("path");
const PythonIntegrationHelper = require("python-integration-helper");
const { isImageBuffer } = require("./helpers/helpers.js");

module.exports = function (RED) {
  function LprNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    const params = {
      boundingBoxColor: config?.boundingBoxColor,
      labelColor: config?.labelColor,
      fontSize: config?.fontSize,
    };

    const pythonHelper = new PythonIntegrationHelper(node);

    let scriptPath = path.join(__dirname, "resources/python/lpr.py");

    pythonHelper.initialize(scriptPath, params);

    pythonHelper.on("output", (output) => {
      try {
        const [encodedFrame, encodedPlates] = output
          .toString()
          .trim()
          .split("@");

        if (encodedFrame && encodedPlates) {
          const frameBufferString = "data:image/jpeg;base64, " + encodedFrame;
          const frameBase64Data = frameBufferString.replace(
            /^data:image\/\w+;base64,/,
            ""
          );
          const annotatedBuffer = Buffer.from(frameBase64Data, "base64");

          // Decode the plates
          const platesJSON = Buffer.from(encodedPlates, "base64").toString(
            "utf-8"
          );
          const { plates } = JSON.parse(platesJSON); // Parse plates JSON
          console.log(plates, "plates");
          if (isImageBuffer(annotatedBuffer)) {
            node.send({ annotatedBuffer, plates, node: node.id || "_id" });
          } else {
            console.log("Invalid frame buffer");
          }
        } else {
          // console.log("Invalid output format: Missing frame or plates data");
        }
      } catch (error) {
        console.error("Error handling Python output:", error.message);
        node.error(error);
      }
    });

    node.on("input", function (msg, send, done) {
      if (!msg.frameBuffer) {
        node.warn("No frame buffer received");
        done();
        return;
      }
      pythonHelper.enqueue(msg.frameBuffer.toString("base64"), send, done);
    });

    node.on("close", async function (done) {
      await pythonHelper.shutdown();
      done();
    });
  }

  RED.nodes.registerType("lpr", LprNode);
};
