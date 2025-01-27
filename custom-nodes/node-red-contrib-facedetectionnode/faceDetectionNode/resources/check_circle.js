function checkCircle({ rois = [], detectedObjects = [], ...rest }) {
  let objectFound = [];

  if (detectedObjects?.length) {
    detectedObjects?.map((detectedObject) => {
      for (let i = 0; i < rois?.length; i++) {
        if (isPointInCircle(detectedObject?.centroid, rois?.[i]?.coords)) {
          objectFound.push({ ...detectedObject });
        }
      }
    });
  }
  return objectFound;
}

function isPointInCircle(point, circle) {
  let dx = point.x - circle?.[0].x;
  let dy = point.y - circle?.[0].y;
  return dx * dx + dy * dy <= circle?.[1].radius * circle?.[1].radius;
}

module.exports = { checkCircle };
