// Code added here will be run once
// whenever the node is started.
//---------context----------
flow.set("THRESHOLD", flow.get("THRESHOLD") || 4000);
flow.set("shutterAreas", flow.get("shutterAreas") || {});
flow.set("shuttersChecked", flow.get("shuttersChecked") || {});
flow.set("allShuttersOpenCache", flow.get("allShuttersOpenCache") || false);

//----------main script----------
let THRESHOLD = flow.get("THRESHOLD");

let shutterAreas = flow.get("shutterAreas");

let shuttersChecked = flow.get("shuttersChecked");

let isProcessed = false;

Object.keys(shutterAreas).forEach((key) => {
  shuttersChecked[key] = false;
  flow.set("shuttersChecked", shuttersChecked);
});

msg.detectedObjects.forEach((detectedObject) => {
  let roi_key = detectedObject.roiName;
  if (!shutterAreas[roi_key]) {
    shutterAreas[roi_key] = {
      isOpen: false,
      lastDetected: msg.timestamp,
    };
  } else {
    shutterAreas[roi_key].lastDetected = msg.timestamp;
    shutterAreas[roi_key].isOpen = false;
  }
  shuttersChecked[roi_key] = true;
  flow.set("shutterAreas", shutterAreas);
  flow.set("shuttersChecked", shuttersChecked);
});

Object.keys(shuttersChecked).forEach((key) => {
  if (shuttersChecked[key] === false) {
    let lastDetected = new Date(shutterAreas[key].lastDetected).getTime();
    let timeDiff = new Date().getTime() - lastDetected;
    console.log(timeDiff, "timeDiff");
    if (timeDiff > THRESHOLD) {
      shutterAreas[key].isOpen = true;
      flow.set("shutterAreas", shutterAreas);
    }
  }
});

console.log(shutterAreas, "sa");
let allShuttersOpen = Object.values(shutterAreas).every(
  (shutter) => shutter.isOpen
);

let allShuttersOpenCache = flow.get("allShuttersOpenCache");

if (allShuttersOpen != flow.get("allShuttersOpenCache")) {
  if (allShuttersOpen) {
    console.log("Store Open");
    isProcessed = true;
    flow.set("allShuttersOpenCache", allShuttersOpen);
    //Change current function / multi language node id
    return { node: "5caa0a7ffce71f74", isOpen: true, timestamp: msg.timestamp };
  } else {
    console.log("Store Close");
    isProcessed = true;
    flow.set("allShuttersOpenCache", allShuttersOpen);
    //Change current function / multi language node id
    return {
      node: "5caa0a7ffce71f74",
      isOpen: false,
      timestamp: msg.timestamp,
    };
  }
}
