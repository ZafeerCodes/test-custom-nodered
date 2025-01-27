const PythonIntegrationHelper = require("python-integration-helper");
const path = require("path");
const { getClassesIndex } = require("./helpers/getClassesIndex");
const { objCountYoloClasses } = require("../resources/objCountYoloClasses");


module.exports = function (RED) {
  function ObjectCountNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    let scriptPath = path.join(__dirname, "resources/object-counting.py");
    const rois = config.rois;
    const pythonHelper = new PythonIntegrationHelper(node);

    let objects = config?.multiselectObjects?.split(",");
    const classes = getClassesIndex(objCountYoloClasses, objects);

    const params = {
      boundingBoxColor: config.boundingBoxColor,
      lines: JSON.stringify(rois),
      lineColor: config.lineColor,
      labelColor: config?.labelColor,
      fontSize: config?.fontSize,
      classes: JSON.stringify(classes),
    };

    pythonHelper.initialize(scriptPath, params);

    node.on("input", function (msg, send, done) {
      if (rois?.length > 0) {
        node.status({ fill: "green", shape: "dot", text: "Configured" });
      } else {
        node.status({ fill: "yellow", shape: "ring", text: "Not configured" });
      }

      // let detectedObjects = msg?.detectedObjects || [];
      // let frameBuffer = msg?.frameBuffer;

      // let lines = rois?.map((roi) => {
      //   let line = {
      //     id: roi.id,
      //     x1: roi.coords[0].x,
      //     y1: roi.coords[0].y,
      //     x2: roi.coords[1].x,
      //     y2: roi.coords[1].y,
      //   };
      //   return line;
      // });

      if (!msg.frameBuffer) {
        node.warn("No frame buffer received");
        done();
        return;
      }

      pythonHelper.enqueue(msg?.frameBuffer?.toString("base64"), send, done);

      node.context().set("roiMsgObj", msg);
    });

    pythonHelper.on("output", function (output) {
      try {
        const [encodedFrame, encodedResults] = output
          .toString()
          .trim()
          .split("@");
        if (encodedFrame && encodedResults) {
          const frameBufferString = "data:image/jpeg;base64, " + encodedFrame;
          const frameBase64Data = frameBufferString.replace(
            /^data:image\/\w+;base64,/,
            ""
          );
          const resultsJSON = Buffer.from(encodedResults, "base64").toString(
            "utf-8"
          );
          const { results } = JSON.parse(resultsJSON);
          console.log(results);
          const annotatedBuffer = Buffer.from(frameBase64Data, "base64");
          if (isImageBuffer(annotatedBuffer)) {
            node.send({ annotatedBuffer, node: node.id || "_id" });
          } else {
            console.log("Invalid frame buffer");
            console.log(output.toString());
          }
        }
      } catch (error) {
        console.error("Error handling Python output:", error.message);
        node.error(error);
      }
    });

    RED.httpAdmin.get(
      `/api/objectcountnode/data/${node.id}`,
      function (req, res) {
        try {
          const roiMsgObj = node.context().get("roiMsgObj");
          if (roiMsgObj) {
            res.status(200).send({ message: "data fetched!", data: roiMsgObj });
          } else {
            res.status(404).send({ message: "data not found!" });
          }
        } catch (err) {
          node.error("Error fetching data: " + err.message);
          res.status(500).send({ message: "server error!" });
        }
      }
    );

    this.on("close", function () {
      node.context().set("roiMsgObj", null);
      node.status({ fill: "brown", shape: "ring", text: "Idle" });
    });
  }

  RED.nodes.registerType("object counting", ObjectCountNode);
};

function isImageBuffer(buffer) {
  const signatures = {
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47],
    "image/gif": [0x47, 0x49, 0x46],
  };

  for (const format in signatures) {
    const signature = signatures[format];
    if (buffer.slice(0, signature.length).equals(Buffer.from(signature))) {
      return true;
    }
  }
  return false;
}
