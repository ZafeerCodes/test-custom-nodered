const { spawn } = require("child_process");
const path = require("path");
const { isImageBuffer } = require("./helpers/checkValidBuffer");
const {
  getClassesIndex,
  objectDetectionClasses,
  shutterClasses,
  smokeDirtyfloorClasses,
} = require("./helpers/objectDetectionClasses");
const processTimeTrackingLogics = require("./helpers/timeTrackingLogic");

function getScript(type) {
  switch (type) {
    case "yolov11x.pt":
      return "object_detection.py";
    case "smoke-and-dirtyfloor.pt":
      return "smoke_and_dirtyfloor_detection.py";
    default:
      return "object_detection.py";
  }
}

function getParameters(model, params) {
  const configMap = {
    "yolov11x.pt": {
      modelPath: params?.modelPath,
      objects: getClassesIndex(objectDetectionClasses, params?.objects),
      threshold: params?.threshold,
      boundingBoxColor: params?.boundingBoxColor,
      fontSize: params?.fontSize,
      labelColor: params?.labelColor,
      isTrackingEnabled: params?.isTrackingEnabled,
      labels: objectDetectionClasses,
    },
    "tms.pt": {
      modelPath: params?.modelPath,
      objects: getClassesIndex(objectDetectionClasses, params?.objects),
      threshold: params?.threshold,
      boundingBoxColor: params?.boundingBoxColor,
      fontSize: params?.fontSize,
      labelColor: params?.labelColor,
      isTrackingEnabled: params?.isTrackingEnabled,
    },
    "shutter-detector.pt": {
      modelPath: params?.modelPath,
      objects: getClassesIndex(shutterClasses, params?.objects),
      threshold: params?.threshold,
      boundingBoxColor: params?.boundingBoxColor,
      fontSize: params?.fontSize,
      labelColor: params?.labelColor,
      isTrackingEnabled: params?.isTrackingEnabled,
      labels: shutterClasses,
    },
    "smoke-and-dirtyfloor.pt": {
      modelPath: params?.modelPath,
      objects: getClassesIndex(smokeDirtyfloorClasses, params?.objects),
      threshold: params?.threshold,
      boundingBoxColor: params?.boundingBoxColor,
      fontSize: params?.fontSize,
      labelColor: params?.labelColor,
      isTrackingEnabled: params?.isTrackingEnabled,
      labels: smokeDirtyfloorClasses,
    },
  };

  return configMap[model] || configMap["yolov11x.pt"];
}
module.exports = function (RED) {
  function ObjectCountNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    console.log(config, "config");

    let scriptProcess = null;
    let processingFrame = false;
    const msgQueue = [];
    let timeTrackingObjectCache = {};
    let completeData = "";

    let modelPath = "";
    const modelInput = config?.model || "yolov11x.pt";
    const modelType = config?.modelType;
    const isTrackingEnabled = config?.isTrackingEnabled || false;

    const objects = config?.multiselectObjects?.trim()
      ? config?.multiselectObjects?.split(",")?.map((el) => el.trim())
      : [];
    const classes = config?.multiselectClasses?.trim()
      ? config?.multiselectClasses?.split(",")?.map((el) => el.trim())
      : [];
    const tmsLabels = config?.multiselectLabels?.trim()
      ? config?.multiselectLabels?.split(",")?.map((el) => el.trim())
      : [];
    const customLabels = config?.modelLabels?.trim()
      ? config?.modelLabels?.split(",")?.map((el) => el.trim())
      : [];

    const threshold = config?.threshold || 0.25;
    const boundingBoxColor = config?.boundingBoxColor;
    const labelColor = config?.labelColor;
    const fontSize = config?.fontSize;

    const scriptName = getScript(modelInput || "yolov11x.pt");
    const py_script = path.join(__dirname, "scripts", scriptName);

    if (!modelPath.includes(modelInput)) {
      modelPath = config?.modelFilePath;
      if (modelType === "Baseer Models") {
        modelPath = path.join(__dirname, `models/${modelInput}`);
      }
    }

    let modelParameters = getParameters(modelInput, {
      modelPath: modelPath,
      objects: objects,
      threshold: threshold,
      boundingBoxColor: boundingBoxColor,
      fontSize: fontSize,
      labelColor: labelColor,
      isTrackingEnabled: isTrackingEnabled,
      classes: classes,
      tmsLabels: tmsLabels,
      customLabels: customLabels,
    });

    const finalModelParams = [];
    if (modelParameters) {
      try {
        const params = modelParameters;
        Object.entries(params).forEach(([key, value]) => {
          finalModelParams.push(`--${key}=${value}`);
        });
      } catch (error) {
        node.error("Failed to parse parameters: " + error.message);
      }
    }
    scriptProcess = spawn("python3", [py_script, ...finalModelParams]);

    scriptProcess.on("error", (error) => {
      node.error(`Failed to start subprocess: ${error}`);
    });

    scriptProcess.stderr.on("data", (data) => {
      // node.error(`Python Error: ${data.toString()}`);
    });

    scriptProcess.on("close", (code) => {
      node.log(`Child process exited with code ${code}`);
    });

    function processNextInQueue() {
      if (msgQueue.length > 0 && !processingFrame) {
        processingFrame = true;
        processMsg(msgQueue.shift());
      }
    }

    node.on("input", function (msg, send, done) {
      msgQueue.push({ msg, send, done });
      processNextInQueue();
    });

    function processMsg({ msg, send, done }) {
      const buffer = msg.frameBuffer;

      if (!buffer) {
        node.warn("No frame buffer received.");
        processingFrame = false;
        done();
        processNextInQueue();
        return;
      }

      if (!scriptProcess || scriptProcess.stdin.destroyed) {
        node.warn("Child process not running or stdin stream is closed.");
        processingFrame = false;
        done();
        processNextInQueue();
        return;
      }

      const dataToSend = {
        image: buffer.toString("base64"),
        rois: msg?.rois || [],
        msg: msg || {},
      };

      scriptProcess.stdin.write(JSON.stringify(dataToSend) + "\n", (err) => {
        if (err) {
          node.error(`Error writing to stdin: ${err}`);
          processingFrame = false;
          done(err);
          processNextInQueue();
        }
      });
    }

    scriptProcess.stdout.on("data", function (data) {
      completeData += data.toString();
      while (completeData.includes("\n")) {
        const newlineIndex = completeData.indexOf("\n");
        const fullOutput = completeData.slice(0, newlineIndex).trim();
        completeData = completeData.slice(newlineIndex + 1);
        processOutput(fullOutput, () => {});
      }
    });

    function processOutput(output, done) {
      try {
        const parsedJson = JSON.parse(output);
        const base64Data = parsedJson?.base64image?.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        const annotatedBuffer = base64Data
          ? Buffer.from(base64Data, "base64")
          : null;
        if (
          annotatedBuffer &&
          annotatedBuffer.length > 0 &&
          isImageBuffer(annotatedBuffer)
        ) {
          const rawBoxes = Object.keys(
            parsedJson?.bounding_boxes || {}
          ).flatMap((key) =>
            parsedJson.bounding_boxes[key].map((bbox) => [
              bbox.x1,
              bbox.y1,
              bbox.x2,
              bbox.y2,
              bbox.label,
              bbox.confidence,
              bbox.tracking_id,
            ])
          );
          const rawLabels = Object.keys(parsedJson?.labels || {}).flatMap(
            (key) => parsedJson.labels[key].map((label) => label)
          );

          node.send({
            node: node?.id || "_id",
            inputFrame: parsedJson?.msg?.frameBuffer,
            outputFrame: annotatedBuffer,
            timestamp: new Date().getTime(),
            detectedObjects:
              rawBoxes.length > 0
                ? rawBoxes.flatMap(
                    ([x1, y1, x2, y2, label, confidence, tracking_id]) => {
                      let trackedObjects = processTimeTrackingLogics(
                        timeTrackingObjectCache,
                        parsedJson?.bounding_boxes,
                        3000,
                        tracking_id
                      );
                      return (
                        trackedObjects?.map((detection) => {
                          let coreObj = detection?.object;
                          return {
                            id: coreObj?.tracking_id || null,
                            boundingBox: {
                              x1: coreObj?.x1,
                              y1: coreObj?.y1,
                              x2: coreObj?.x2,
                              y2: coreObj?.y2,
                            },
                            label: coreObj?.label,
                            confidence: coreObj?.confidence,
                            roiName: detection?.roiName || "",
                            entryTime: detection?.entryTime || null,
                            exitTime: detection?.exitTime || null,
                            duration: detection?.duration || null,
                          };
                        }) || []
                      );
                    }
                  )
                : Object.keys(timeTrackingObjectCache).length > 0
                ? Object.keys(timeTrackingObjectCache).flatMap(
                    (tracking_id) => {
                      let trackedObjects = processTimeTrackingLogics(
                        timeTrackingObjectCache,
                        parsedJson?.bounding_boxes,
                        3000,
                        null
                      );

                      return (
                        trackedObjects?.map((detection) => {
                          let coreObj = detection?.object;
                          return {
                            id: coreObj?.tracking_id || null,
                            boundingBox: {
                              x1: coreObj?.x1,
                              y1: coreObj?.y1,
                              x2: coreObj?.x2,
                              y2: coreObj?.y2,
                            },
                            label: coreObj?.label,
                            confidence: coreObj?.confidence,
                            roiName: detection?.roiName || "",
                            entryTime: detection?.entryTime || null,
                            exitTime: detection?.exitTime || null,
                            duration: detection?.duration || null,
                          };
                        }) || []
                      );
                    }
                  )
                : [],
          });
        } else {
          console.log(output.toString("utf-8"));
        }
        processingFrame = false;
        done();
        processNextInQueue();
      } catch (error) {
        node.error(`Error processing output: ${error}`);
        processingFrame = false;
        done(error);
        processNextInQueue();
      }
    }

    node.on("close", function (done) {
      timeTrackingObjectCache = {};
      if (scriptProcess) {
        scriptProcess.stdin.end();
        scriptProcess.stdin.destroy();
        scriptProcess.stdout.destroy();
        scriptProcess.stderr.destroy();
        scriptProcess.kill("SIGTERM");
      }
      done();
    });
  }

  RED.nodes.registerType("object detection v2 beta", ObjectCountNode);
};
