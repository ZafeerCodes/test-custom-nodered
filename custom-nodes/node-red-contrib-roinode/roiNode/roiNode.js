const { checkCircle } = require("./resources/check_circle");
const { checkPolygon } = require("./resources/check_polygon");
const { checkRectangle } = require("./resources/check_rectangle");

module.exports = function (RED) {
  function RoiNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    const rois = config.rois;

    node.status({ fill: "brown", shape: "ring", text: "Idle" });

    async function prepareObjectWithinRois(rois, detectedObjects) {
      let objectsWithinRoi = [];

      rois.forEach((roi) => {
        if (roi?.type === "rect") {
          objectsWithinRoi.push(
            ...checkRectangle({
              rois: [roi],
              detectedObjects: detectedObjects,
            })
          );
        } else if (roi?.type === "poly") {
          objectsWithinRoi.push(
            ...checkPolygon({
              rois: [roi],
              detectedObjects: detectedObjects,
            })
          );
        } else if (roi?.type === "circle") {
          objectsWithinRoi.push(
            ...checkCircle({
              rois: [roi],
              detectedObjects: detectedObjects,
            })
          );
        }
      });

      return objectsWithinRoi;
    }

    this.on("input", async function (msg) {
      if (rois?.length > 0) {
        node.status({ fill: "green", shape: "dot", text: "Configured" });
      } else {
        node.status({ fill: "yellow", shape: "ring", text: "Not configured" });
      }

      if (msg?.detectedObjects && msg?.detectedObjects?.length > 0) {
        node.send({
          ...msg,
          rois: rois,
          detectedObjects: await prepareObjectWithinRois(
            rois,
            msg?.detectedObjects
          ),
        });
      } else {
        node.send({ ...msg, rois: rois });
      }
      node.context().set("roiMsgObj", msg);
    });

    RED.httpAdmin.get(`/api/roinode/data/${node.id}`, function (req, res) {
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
    });

    this.on("close", function () {
      node.context().set("roiMsgObj", null);
      node.status({ fill: "brown", shape: "ring", text: "Idle" });
    });
  }

  RED.nodes.registerType("ROI", RoiNode);
};
