const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

module.exports = function (RED) {
  function CrownCountingNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    let py_script = path.join(__dirname, "resources/crown-counting-script.py");
    let child = null;
    let processingFrame = false;
    const queue = [];
    let completeData = "";

    const params = {
      name: config?.name || "crowd counting",
      model: config?.model || "SFANET",
      fontSize: parseInt(config?.fontSize, 10) || 12,
      fontColor: config?.fontColor || "#FFFFFF",
      fontScale: parseFloat(config?.fontScale) || 2,
      fontThickness: parseInt(config?.fontThickness, 10) || 2,
    };

    console.log(params);
    
    const paramArray = Object.entries(params).flatMap(
      ([key, value]) => [`--${key}`, value]
    );
   
    child = spawn("python3", [py_script, ...paramArray], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    

    child.on("error", (error) => {
      node.log(`Failed to start subprocess: ${error}`);
    });

    child.stderr.on("data", (data) => {
      node.log(`Python Error: ${data}`);
    });

    child.on("close", (code) => {
      node.log(`Child process exited with code ${code}`);
    });

    function processNextInQueue() {
      if (queue.length > 0 && !processingFrame) {
        processingFrame = true;
        processMsg(queue.shift());
      }
    }

    node.on("input", function (msg, send, done) {
      queue.push({ msg, send, done });
      processNextInQueue();
    });

    function convertCoordsToRect(coords) {
      const [topLeft, bottomRight] = coords;
      return [
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y,
      ];
    }
    function processMsg({ msg, send, done }) {
      const buffer = msg.frameBuffer;
      const rois = msg.rois || [];

      if (!buffer) {
        node.log("No frame buffer received.");
        processingFrame = false;
        done();
        processNextInQueue();
        return;
      }

      if (!child) {
        node.log("Child process not running.");
        processingFrame = false;
        done();
        processNextInQueue();
        return;
      }

   
      let roiCords;
      if (rois?.length > 0) {
        roiCords = Buffer.from(
          JSON.stringify(convertCoordsToRect(rois?.[0]?.coords))
        ).toString("base64");
      } else {
        roiCords = "";
      }
      console.log(roiCords, "roiCords")

      // Send the image buffer to the Python script via stdin
      child.stdin.write(
        buffer.toString("base64") + "\n" + roiCords + "\n",
        (err) => {
          if (err) {
            node.log(`Error writing to stdin: ${err}`);
            processingFrame = false;
            done(err);
            processNextInQueue();
          }
        }
      );
    }

    child.stdout.on("data", function (data) {
      completeData += data.toString();

      // Check for the delimiter (in this case, '\n') to know if you have complete data
      if (completeData.endsWith("\n")) {

        completeData = completeData.slice(0, -1);

        processOutput(completeData, () => {});
        completeData = ""; 
      }
    });

    function processOutput(output, done) {
      const bufferString = "data:image/jpeg;base64, " + output.toString();

      const base64Data = bufferString.replace(/^data:image\/\w+;base64,/, "");

      const annotatedBuffer = Buffer.from(base64Data, "base64");

      node.send({
        annotatedBuffer: annotatedBuffer,
      });
      processingFrame = false;
      done();
      processNextInQueue();
    }

    node.on("close", function (done) {
      if (child) {
        child.stdin.end();
        // child.kill();
      }
      done();
    });
  }

  RED.nodes.registerType("crowd counting", CrownCountingNode);
};
