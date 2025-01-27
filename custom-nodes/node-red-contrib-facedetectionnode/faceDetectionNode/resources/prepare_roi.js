const { checkCircle } = require("./check_circle");
const { checkPolygon } = require("./check_polygon");
const { checkRectangle } = require("./check_rectangle");

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

module.exports = {
  prepareObjectWithinRois,
};
