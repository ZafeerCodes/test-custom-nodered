function checkRectangle({ rois = [], detectedObjects = [], ...rest }) {
  let objectFound = [];

  if (detectedObjects?.length) {
    detectedObjects?.map((detectedObject) => {
      for (let i = 0; i < rois?.length; i++) {
        const rect = convertCoordsToRect(rois?.[i]?.coords);
        if (isPointInRectangle(detectedObject?.centroid, rect)) {
          objectFound.push({ ...detectedObject });
        }
      }
    });
  }
  return objectFound;
}

function convertCoordsToRect(coords) {
  const [topLeft, bottomRight] = coords;

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

function isPointInRectangle(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

module.exports = { checkRectangle }

