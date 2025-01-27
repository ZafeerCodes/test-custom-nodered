const { getPosition, classification_classes } = require("../../resources/yolo_classes");
const { iou } = require("./helpers");

async function process_output_person_classification(
  outputs,
  img_width_ratio,
  img_height_ratio,
  classes
) {
  const rawBoxes = outputs["boxes"].cpuData;
  const rawClasses = outputs["classes"].cpuData;
  const rawScores = outputs["scores"].cpuData;

  const boxesConverted = Array.from(rawBoxes);
  const classesConverted = Array.from(rawClasses);
  const scoresConverted = Array.from(rawScores);

  const numBoxes = 8400; 
  let boxes = [];

  for (let i = 0; i < numBoxes; i++) {
    const startIndex = i * 4;
    const score = scoresConverted[i];
    if (score > 0.2) {
      const box = boxesConverted.slice(startIndex, startIndex + 4); // Extract box coordinates
      const classId = classesConverted[i];
      const label =
        classes.length > 0
          ? getPosition(classification_classes, classes)?.[classId]
          : classification_classes[classId];

      let x1 = box[0] * img_width_ratio - 130;
      let y1 = box[1] * img_height_ratio - 130;
      let x2 = (box[0] + box[2]) * img_width_ratio;
      let y2 = (box[1] + box[3]) * img_height_ratio;

      if (label) {
        boxes.push([x1, y1, x2, y2, label, score]);
      }
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
  process_output_person_classification,
};
