function hexToRgb(hex) {
  hex = hex?.replace(/^#/, "");
  let bigint = parseInt(hex, 16);
  let r = (bigint >> 16) & 255;
  let g = (bigint >> 8) & 255;
  let b = bigint & 255;
  return { r, g, b };
}

function iou(box1, box2) {
  return intersection(box1, box2) / union(box1, box2);
}

function union(box1, box2) {
  const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
  const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
  const box1_area = (box1_x2 - box1_x1) * (box1_y2 - box1_y1);
  const box2_area = (box2_x2 - box2_x1) * (box2_y2 - box2_y1);
  return box1_area + box2_area - intersection(box1, box2);
}

function intersection(box1, box2) {
  const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
  const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
  const x1 = Math.max(box1_x1, box2_x1);
  const y1 = Math.max(box1_y1, box2_y1);
  const x2 = Math.min(box1_x2, box2_x2);
  const y2 = Math.min(box1_y2, box2_y2);
  return (x2 - x1) * (y2 - y1);
}


module.exports = {
  hexToRgb,
  iou, 
  union, 
  intersection,
};
