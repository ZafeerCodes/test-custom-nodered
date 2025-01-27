const PythonIntegrationHelper = require("python-integration-helper");
const path = require("path");
const { isImageBuffer } = require("./helpers/checkValidBuffer");

module.exports = function (RED) {
  function ObjectCountNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

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

    const pythonHelper = new PythonIntegrationHelper(node);

    function getScript(type) {
      switch (type) {
        case "yolov8x.pt":
          return "scripts/object_detection.py";
        default:
          return "scripts/object_detection.py";
      }
    };

    // node.on("close", function (done) {
    //   isClosed = true;
    //   frameQueue = [];
    //   let interval = setInterval(() => {
    //     if (activeWorkers === 0) {
    //       clearInterval(interval);

    //       if (modelCache[modelPath]) {
    //         modelCache[modelPath].release();
    //         delete modelCache[modelPath];
    //       }

    //       done();
    //     }
    //   }, 50);
    //   // activeWorkers = 0;
    //   isFrameProcessingEnabled = false;
    // });

    node.on("close", (done) => {
      isClosed = true;
      frameQueue = [];

      const cleanupInterval = setInterval(() => {
        if (activeWorkers === 0) {
          clearInterval(cleanupInterval);
          
          modelCache = {};
          
          // if (pythonHelper) {
          //   pythonHelper.cleanup();
          // }

          done();
        }
      }, 100);
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

    async function processFrame(msg, send, done) {
      try {
        if (isClosed) return;

        const buffer = msg.frameBuffer;
        const modelInput = config?.model || "yolov8x.pt";
        const modelType = config?.modelType;

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

        // const getClassesIndex = getClassesIndex(objCountYoloClasses, objects);

        const params = {
          boundingBoxColor: boundingBoxColor,
          labelColor: config?.labelColor,
          fontSize: config?.fontSize,
          // classes: getClassesIndex,
          isTrackingEnabled: config.isTrackingEnabled || false
        };

        let modelPromise = Promise.resolve();

        if (!modelCache[modelPath]) {
          if (!modelPath.includes(modelInput)) {
            modelPath = config?.modelFilePath;
            if (modelType === "Baseer Models") {
              modelPath = path.join(__dirname, getScript(modelInput));
            }
            console.log(modelPath, "modelPath");
            pythonHelper.initialize(modelPath, params);
            modelCache[modelPath] = modelPath;
          }
        }

        console.log("OUTSIDE")

        pythonHelper.enqueue(buffer?.toString("base64"), send, done)
        return modelPromise
        // return modelPromise
        //   .then(() =>
        //     pythonHelper.enqueue(buffer?.toString("base64"), send, done)
        //   )
        //   .then((output) => {
        //     return output
        //   })
        //   .catch((err) => {
        //     console.log("Error processing frame: ", err.message);
        //   });
      } catch (err) {
        console.log("Error in processFrame: ", err.message);
      }
    }

    pythonHelper.on("output", function (output) {
      try {
        const [encodedFrame] = output.toString().trim().split("@");
        
        if (encodedFrame) {
          const frameBufferString = "data:image/jpeg;base64, " + encodedFrame;
          const frameBase64Data = frameBufferString.replace(
            /^data:image\/\w+;base64,/,
            ""
          );
 
          const annotatedBuffer = Buffer.from(frameBase64Data, "base64");
          if (isImageBuffer(annotatedBuffer)) {
            node.send({ annotatedBuffer: annotatedBuffer, node: node.id || "_id" });
          } else {
            console.log("Invalid frame buffer");
            console.log(output.toString());
          }
        }
      } catch (error) {
        console.error("Error handling Python output:", error.message);
        node.error(error);
      }
    });

  }

  RED.nodes.registerType("object detection(new)", ObjectCountNode);
};

