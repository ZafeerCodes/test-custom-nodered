const { iou } = require("./helpers");
const { tms_model_labels, getPosition } = require("../../resources/yolo_classes.js");

async function process_output_tms_45(
  output,
  img_width,
  img_height,
  labels,
  threshold
) {
  let boxes = [];

  for (let index = 0; index < 8400; index++) {
    const [label_id, prob] = [...Array(80).keys()]
      .map((col) => [col, output[8400 * (col + 4) + index]])
      .reduce((accum, item) => (item[1] > accum[1] ? item : accum), [0, 0]);

    if (prob < threshold) {
      continue;
    }

    const label =
      labels.length > 0 ? getPosition(tms_model_labels, labels)?.[label_id] : tms_model_labels[label_id];

    const xc = output[index];
    const yc = output[8400 + index];
    const w = output[2 * 8400 + index];
    const h = output[3 * 8400 + index];
    const x1 = ((xc - w / 2) / 640) * img_width;
    const y1 = ((yc - h / 2) / 640) * img_height;
    const x2 = ((xc + w / 2) / 640) * img_width;
    const y2 = ((yc + h / 2) / 640) * img_height;

    if (label) {
      boxes.push([x1, y1, x2, y2, label, prob]);
    }
  }

  boxes = boxes.sort((box1, box2) => box2[5] - box1[5]);
  const final_boxes = [];
  const final_labels = [];

  while (boxes.length > 0) {
    final_boxes.push(boxes[0]);
    final_labels.push(boxes[0][4]);
    boxes = boxes.filter((box) => iou(boxes[0], box) < 0.7);
  }

  return [final_boxes, final_labels];
}




module.exports = {
  process_output_tms_45,
};
