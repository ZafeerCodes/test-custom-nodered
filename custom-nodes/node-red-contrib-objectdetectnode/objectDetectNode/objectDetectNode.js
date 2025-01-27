module.exports = function (RED) {
  const dotenv = require("dotenv");
  const path = require("path");
  const { exec } = require("child_process");

  dotenv.config({
    path: path.resolve(__dirname, "../.env"),
  });

  function objectDetectNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    let childProcess = null;
    let frameQueue = [];
    let isProcessing = false;
    let isClosed = false;

    const processQueue = (msg) => {
      return new Promise((resolve, reject) => {
        const imagePath =
          msg?.config?.imagePath || msg?.imagePath || "/app/image.jpg";

        let currentAppDir = imagePath.split("/")?.slice(0, -2)?.join("/") ?? "";
        let currentImgDir = imagePath.split("/").splice(-2, 2).join("/") ?? "";
        let outputImgDir = `${process.env.PERCEPTO_LOCAL_NGINX_URL}/percepto/content/rtsp/output/result_0.jpg`;

        const cmd = `docker run --rm -v ${currentAppDir}/:/app/ muzairmw/yolo-object-detection python /app/yolo_script.py /app/${currentImgDir}`;

        childProcess = exec(cmd, (error, stdout, stderr) => {
          if (error) {
            node.error(`Docker error: ${error.message}`, msg);
            return reject(error);
          }

          let capturedObject = stdout || stderr;

          node.send({
            ...msg,
            objectDetails: capturedObject?.split("\n")?.[1] ?? "",
            imageUrl: outputImgDir ?? "",
          });

          resolve();
        });
      });
    };

    const processNextQueue = async () => {
      if (isProcessing || frameQueue.length === 0 || isClosed) {
        return;
      }

      isProcessing = true;

      while (frameQueue.length > 0 && !isClosed) {
        const msg = frameQueue.shift();

        try {
          await processQueue(msg);
        } catch (err) {
          console.log("Error in object detection: " + err.message, msg);
        }

        if (frameQueue.length > 0 && !isClosed) {
          continue;
        } else {
          isProcessing = false;
          break;
        }
      }
    };

    this.on("input", function (msg) {
      if (!isClosed) {
        frameQueue.push(msg);
        if (!isProcessing) {
          processNextQueue();
        }
      }
    });

  
    node.on("close", function (done) {
      isClosed = true;
      if (isProcessing) {
        const interval = setInterval(() => {
          if (!isProcessing) {
            clearInterval(interval);
            if (childProcess && !childProcess.killed) {
              childProcess.kill();
            }
            done(); 
          }
        }, 500);
      } else {
        if (childProcess && !childProcess.killed) {
          childProcess.kill();
        }
        done();
      }
    });
    
  }

  RED.nodes.registerType("objects(legacy)", objectDetectNode);
};
