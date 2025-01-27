const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { hexToHue } = require("./helpers/hexToHue");
const PythonIntegrationHelper = require("python-integration-helper");

module.exports = function (RED) {
  function HeatmapDetectionNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    const params = {
      position: config?.position,
      opacity: parseFloat(config?.opacity),
      radius: parseInt(config?.radius, 10),
      kernel_size: parseInt(config?.kernelSize, 10),
      top_hue: parseInt(hexToHue(config?.highDensityColor), 10),
      low_hue: parseInt(hexToHue(config?.lowDensityColor), 10),
      classes: Number(config.classes)
    };

    const pythonHelper = new PythonIntegrationHelper(node);

    let scriptPath = path.join(
      __dirname,
      "heatmapDetectionPythonResources/heatmapDetectionNodeScript.py"
    );

    pythonHelper.initialize(scriptPath, params);

    pythonHelper.on('output', (output) => {
      const bufferString = "data:image/jpeg;base64, " + output.toString();
      const base64Data = bufferString.replace(/^data:image\/\w+;base64,/, "");
      const annotatedBuffer = Buffer.from(base64Data, "base64");

      node.send({
        annotatedBuffer: annotatedBuffer,
      });
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

  RED.nodes.registerType("heatmap generation", HeatmapDetectionNode);
};
