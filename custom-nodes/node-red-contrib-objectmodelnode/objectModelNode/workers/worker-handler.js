const { parentPort, workerData } = require("worker_threads");
const { draw_bounding_boxes } = require("../resources/draw-boundig-boxes");

(async () => {
  try {
    const { workerFuncName, args = [] } = workerData;

    if (!Array.isArray(args)) {
      throw new Error("Invalid arguments passed to worker");
    }

    let result;

    switch (workerFuncName) {
      /**
       *
       * Bounding Boxes Workers
       *
       */
      case "drawBoundingBoxes":
        result = await draw_bounding_boxes(...args);
        break;

      /**
       *
       * Future function handlers
       *
       */
      // case "otherFunction":
      //   result = await otherFunctions(...args);
      //   break;

      default:
        throw new Error(`Unknown Worker Function: ${workerFuncName}`);
    }

    parentPort.postMessage(result);
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
})();
