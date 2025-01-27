function checkPolygon({ rois = [], detectedObjects = [], ...rest }) {
  let objectFound = [];

  if (detectedObjects?.length) {
    detectedObjects?.map((detectedObject) => {
      for (let i = 0; i < rois?.length; i++) {
        if (isPointInPolygon(detectedObject?.centroid, rois?.[i]?.coords)) {
          objectFound.push({ ...detectedObject });
        }
      }
    });
  }
  return objectFound;
}

function isPointInPolygon(point, polygon) {
  let x = point.x,
    y = point.y;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].x,
      yi = polygon[i].y;
    let xj = polygon[j].x,
      yj = polygon[j].y;

    let intersect =
      yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

module.exports = { checkPolygon };
