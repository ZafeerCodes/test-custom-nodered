const { getPosition, classification_classes } = require("../../resources/yolo_classes");
const { iou } = require("./helpers");

async function process_output_retinanet(
  outputs,
  img_width_ratio,
  img_height_ratio,
) {

  console.log(outputs);
  const result =  Object.keys(outputs).map((output) => {

    if(output === "495") {
    const rawboxes = outputs[output].cpuData;

    const boxesConverted =  Array.from(rawboxes);


    const numBoxes = 8400; 
    let boxes = [];

    for (let i = 0; i < numBoxes; i++) {
      const startIndex = i * 4;
 
        const box = boxesConverted.slice(startIndex, startIndex + 4);
      
  
        let x1 = box[0] * img_width_ratio - 130;
        let y1 = box[1] * img_height_ratio - 130;
        let x2 = (box[0] + box[2]) * img_width_ratio;
        let y2 = (box[1] + box[3]) * img_height_ratio;
        boxes.push([x1, y1, x2, y2, "face", 0.7]);
  
    }
    boxes = boxes.sort((box1, box2) => box2[5] - box1[5]);
    const final_boxes = [];
  
    while (boxes.length > 0) {
      final_boxes.push(boxes[0]);
      boxes = boxes.filter((box) => iou(boxes[0], box) < 0.7);
    }
    return [...final_boxes];
  
  }
  });
  console.log(result.filter(el => el && el.length > 0), "result")
  return result.filter(el => el && el.length > 0);

}


module.exports = {
  process_output_retinanet,
};
