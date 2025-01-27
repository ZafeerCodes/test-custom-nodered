/**
 * 
 * Some Default Yolo Classes to detect object 
 * 
 */

const yolo_classes = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
    'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse',
    'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase',
    'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard',
    'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
    'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant',
    'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven',
    'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];


const classification_classes = [
    "visitor",
    "security",
    "vest",
    "workers",
    "ladies",
    "employee",
];

const retinanet_labels = [
    "face"
]

const tms_model_labels = [
    "GPU Connected",
    "Chocks off",
    "Green vest",
    "Airplane front",
    "Cargo Door open",
    "Black vest",
    "Jet Bridge Disconnected",
    "Jet Bridge Connected",
    "High Loader Connected",
    "High Loader Disconnected",
    "Conveyor Belt Connected",
    "Conveyor Belt Disconnected",
    "Pushback Vehicle Connected",
    "Pushback Vehicle Disconnected",
    "Yellow vest",
    "Blue vest",
    "Red vest",
    "ACU Connected",
    "ACU Disconnected",
    "Tug",
    "Baggage",
    "Wind shield cleaning vehicle",
    "Chocks on",
    "Transporter Disconnected",
    "Catering Vehicle Disconnected",
    "Fueling Vehicle Disconnected",
    "Container",
    "GPU Disconnected",
    "Ladder",
    "Catering Vehicle Connected",
    "Transporter Connected",
    "Fueling Vehicle Connected",
    "Ladder",
    "Passenger",
    "Others",
    "Baggage Cart",
    "Pilot",
    "Stairs Connected",
    "Stairs Disconnected",
    "Bus",
    "Van",
    "Car",
    "Pickup Truck",
    "Water Truck Connected",
    "Water Truck Disconnected",
    "Airplane Engine",
    "Yellow Line",
    "Parking ROI"
  ]
  
function getPosition(rawClasses, classes) {
    let result = [];
    rawClasses.forEach((el) => {
        if(classes.includes(el)) {
            result.push(el)
        } else {
            result.push(undefined)
        }
    })
    return result;
}


module.exports = { yolo_classes, classification_classes, getPosition, tms_model_labels };

