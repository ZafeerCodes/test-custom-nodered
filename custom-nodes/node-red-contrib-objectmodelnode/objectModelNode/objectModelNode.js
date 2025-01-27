const { centroidAlgo } = require("./resources/centroid-algo");
const { draw_bounding_boxes } = require("./resources/draw-boundig-boxes");
const { get_count } = require("./resources/person-counting-algo");
const {
  process_output_tms_45,
} = require("./resources/tms-model-output-process");
const {
  process_output_yolov8,
} = require("./resources/yolov8-model-output-process");
const {
  process_output_person_classification,
} = require("./resources/person-classification-output-process");
const { prepareObjectWithinRois } = require("./rois/prepare_roi");
const {
  process_output_custom_model,
} = require("./resources/custom-model-output-process");
const {
  process_output_retinanet,
} = require("./resources/retinanet-model-output-process");
const { process_output_yolo_face } = require("./resources/yolo-face");
const {
  process_output_weapon_v1,
} = require("./resources/weapon-v1-model-output-process");

module.exports = function (RED) {
  function ObjectModelNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    const ort = require("onnxruntime-node");
    const sharp = require("sharp");
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    let modelPath = "";
    let model = null;
    let modelCache = {};
    let frameQueue = [];

    let isFrameProcessingEnabled = false;
    const maxWorkers = os.cpus().length || 16;
    let activeWorkers = 0;
    let isClosed = false;

    async function detect_objects_on_image(
      buf,
      objects,
      threshold,
      classes,
      labels,
      customLabels
    ) {
      let width = 640;
      let height = 640;
      const [input, img_width, img_height] = await prepare_input(
        buf,
        width,
        height
      );
      const output = await run_model(input, width, height);
      if (modelPath.includes("person-classification-v1.onnx")) {
        return process_output_person_classification(
          output,
          img_width / width,
          img_height / height,
          classes
        );
      } else if (modelPath.includes("yolo-v8-m.onnx")) {
        return process_output_yolov8(
          output,
          img_width,
          img_height,
          customLabels,
          threshold
        );
      } else if (modelPath.includes("tms-v1.onnx")) {
        return process_output_tms_45(
          output,
          img_width,
          img_height,
          labels,
          threshold
        );
      } else if (modelPath.includes("retinanet-v1.onnx")) {
        return process_output_retinanet(
          output,
          img_width,
          img_height,
          labels,
          threshold
        );
      } else if (modelPath.includes("yolo-v8-face.onnx")) {
        return process_output_yolo_face(
          output,
          img_width / width,
          img_height / height
        );
      } else if (modelPath.includes("weapon-v1.onnx")) {
        return process_output_weapon_v1(
          output,
          img_width,
          img_height,
          objects,
          threshold
        );
      } else {
        return process_output_custom_model(
          output,
          img_width,
          img_height,
          customLabels
        );
      }
    }

    async function prepare_input(buf, width, height) {
      const img = sharp(buf);
      const md = await img.metadata();
      const [img_width, img_height] = [md.width, md.height];
      const pixels = await img
        .removeAlpha()
        .resize({ width, height, fit: "fill" })
        .raw()
        .toBuffer();
      const red = [],
        green = [],
        blue = [];
      for (let index = 0; index < pixels.length; index += 3) {
        red.push(pixels[index] / 255.0);
        green.push(pixels[index + 1] / 255.0);
        blue.push(pixels[index + 2] / 255.0);
      }
      const input = [...red, ...green, ...blue];
      return [input, img_width, img_height];
    }

    async function run_model(input, width, height) {
      if (modelPath.includes("person-classification-v1.onnx")) {
        input = new ort.Tensor(Float32Array.from(input), [1, 3, width, height]);
        const outputs = await modelCache[modelPath].run({ input: input });
        return outputs;
      } else if (modelPath.includes("yolo-v8-m.onnx")) {
        input = new ort.Tensor(Float32Array.from(input), [1, 3, width, height]);
        const outputs = await modelCache[modelPath].run({ images: input });
        return outputs["output0"].data;
      } else if (modelPath.includes("resnet50_Opset18.onnx")) {
        // Was testing this modelCache[modelPath]
        input = new ort.Tensor(Float32Array.from(input), [1, 3, width, height]);
        const outputs = await modelCache[modelPath].run({ x: input });
        return outputs["495"].data;
      } else if (modelPath.includes("tms-v1.onnx")) {
        input = new ort.Tensor(Float32Array.from(input), [1, 3, width, height]);
        const outputs = await modelCache[modelPath].run({ images: input });
        return outputs["output0"].data;
      } else if (modelPath.includes("retinanet-v1.onnx")) {
        input = new ort.Tensor(Float32Array.from(input), [1, 3, width, height]);
        const outputs = await modelCache[modelPath].run({ "input.1": input });
        return outputs;
      } else if (modelPath.includes("yolo-v8-face.onnx")) {
        input = new ort.Tensor(Float32Array.from(input), [1, 3, width, height]);
        const outputs = await modelCache[modelPath].run({ input: input });
        return outputs;
      } else if (modelPath.includes("weapon-v1.onnx")) {
        input = new ort.Tensor(Float32Array.from(input), [1, 3, width, height]);
        const outputs = await modelCache[modelPath].run({ images: input });
        return outputs["output0"].data;
      } else {
        input = new ort.Tensor(Float32Array.from(input), [1, 3, width, height]);
        const outputs = await modelCache[modelPath].run({ images: input });
        return outputs;
      }
    }

    node.on("close", function (done) {
      isClosed = true;
      frameQueue = [];
      let interval = setInterval(() => {
        if (activeWorkers === 0) {
          clearInterval(interval);

          if (modelCache[modelPath]) {
            modelCache[modelPath].release();
            delete modelCache[modelPath];
          }

          done();
        }
      }, 50);
      // activeWorkers = 0;
      isFrameProcessingEnabled = false;
    });

    this.on("input", function (msg) {
      if (!isClosed) {
        frameQueue.push(msg);
        if (!isFrameProcessingEnabled) {
          processNextFrame();
        }
      }
    });

    async function processNextFrame() {
      if (frameQueue.length === 0 || activeWorkers >= maxWorkers || isClosed) {
        return;
      }
      isFrameProcessingEnabled = true;

      while (frameQueue.length > 0 && activeWorkers < maxWorkers && !isClosed) {
        const msg = frameQueue.shift();
        activeWorkers++;

        processFrame(msg)
          .then((data) => {
            node.send({
              ...data,
              node: node?.id || "_id",
            });
            activeWorkers--;
            if (frameQueue.length > 0 && !isClosed) {
              processNextFrame();
            } else {
              isFrameProcessingEnabled = false;
            }
          })
          .catch((err) => {
            activeWorkers--;
            console.log("Error in object detection: " + err.message);
            processNextFrame();
          });
      }
    }

    async function processFrame(msg) {
      try {
        if (isClosed) return;

        const buffer = msg.frameBuffer;
        const modelInput = config?.model || "yolo-v8-m.onnx";
        const modelType = config?.modelType;

        let modelPromise = Promise.resolve();
        if (!modelCache[modelPath]) {
          if (!modelPath.includes(modelInput)) {
            modelPath = config?.modelFilePath;
            if (modelType === "Baseer Models") {
              modelPath = path.join(__dirname, `models/${modelInput}`);
            }
            modelPromise = ort.InferenceSession.create(modelPath)
              .then((session) => {
                modelCache[modelPath] = session;
              })
              .catch((err) => {
                console.log("Error loading model: ", err.message);
              });
          }
        }

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

        return modelPromise
          .then(() =>
            detect_objects_on_image(
              buffer,
              objects,
              threshold,
              classes,
              tmsLabels,
              customLabels
            )
          )
          .then(([boxes, labels]) => {
            let detectedObjects = [];
            if (config?.isTrackingEnabled) {
              if (config?.trackingAlgo === "centroid-tracking") {
                detectedObjects = centroidAlgo(boxes);
              }
            } else {
              detectedObjects = boxes.map(([x1, y1, x2, y2, label, prob]) => ({
                id: null,
                centroid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
                boundingBox: { x1, y1, x2, y2 },
                label,
                prob,
              }));
            }

            if (msg?.rois && msg?.rois?.length > 0) {
              return prepareObjectWithinRois(msg?.rois, detectedObjects).then(
                (filteredObjects) =>
                  draw_bounding_boxes(
                    buffer,
                    filteredObjects,
                    boundingBoxColor,
                    labelColor,
                    fontSize
                  ).then((annotatedBuffer) => {
                    return {
                      ...msg,
                      boxes,
                      labels,
                      annotatedBuffer,
                      detectedObjects: filteredObjects,
                    };
                  })
              );
            } else {
              return draw_bounding_boxes(
                buffer,
                detectedObjects,
                boundingBoxColor,
                labelColor,
                fontSize
              ).then((annotatedBuffer) => {
                return {
                  ...msg,
                  boxes,
                  labels,
                  annotatedBuffer,
                  detectedObjects,
                };
              });
            }
          })
          .catch((err) => {
            console.log("Error processing frame: ", err.message);
          });
      } catch (err) {
        console.log("Error in processFrame: ", err.message);
      }
    }
  }

  RED.nodes.registerType("object detection", ObjectModelNode);
};
