const { iou } = require("./helpers");

async function process_output_yolo_face(
  outputs,
  img_width_ratio,
  img_height_ratio
) {

  
  
  const rawBoxes = outputs["boxes"].cpuData;
  const rawScores = outputs["scores"].cpuData;

  const boxesConverted = Array.from(rawBoxes);
  const scoresConverted = Array.from(rawScores);

  const numBoxes = 8400; 
  let boxes = [];

  for (let i = 0; i < numBoxes; i++) {
    const startIndex = i * 4;
    const score = scoresConverted[i];
    if (score > 0.2) {
      const box = boxesConverted.slice(startIndex, startIndex + 4); // Extract box coordinates

      let x1 = box[0] * img_width_ratio - 130;
      let y1 = box[1] * img_height_ratio - 130;
      let x2 = (box[0] + (box[2])) * img_width_ratio;
      let y2 = (box[1] + (box[3])) * img_height_ratio;

      boxes.push([x1, y1, x2, y2, "face", score]);  // No labels, only bounding boxes with scores
    }
  }
  
  boxes = boxes.sort((box1, box2) => box2[4] - box1[4]); // Sort by score
  const final_boxes = [];
  

  while (boxes.length > 0) {
    final_boxes.push(boxes[0]);
    boxes = boxes.filter((box) => iou(boxes[0], box) < 0.7); // Apply NMS based on IOU
  }
  
  const labels = Array(final_boxes.length).fill("label");

  return [final_boxes , labels]; // Return only bounding boxes and their corresponding scores
}



module.exports = {
  process_output_yolo_face,
};
