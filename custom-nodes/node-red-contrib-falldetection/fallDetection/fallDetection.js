const { spawn } = require("child_process");
const path = require("path");
const { isImageBuffer } = require("./helpers/helpers");

module.exports = function (RED) {
  function fallDetection(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    const py_script = path.join(__dirname, "python/main.py");
    let childProcess = null;
    let processingFrame = false;
    const queue = [];
    let completeData = "";

    childProcess = spawn("python3", [py_script]);

    childProcess.on("error", (error) => {
      node.error(`Failed to start subprocess: ${error}`);
    });

    childProcess.stderr.on("data", (data) => {
      node.error(`Python Error: ${data.toString()}`);
    });

    childProcess.on("close", (code) => {
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

    function processMsg({ msg, send, done }) {
      const buffer = msg.frameBuffer;

      if (!buffer) {
        node.warn("No frame buffer received.");
        processingFrame = false;
        done();
        processNextInQueue();
        return;
      }

      if (!childProcess || childProcess.stdin.destroyed) {
        node.warn("Child process not running or stdin stream is closed.");
        processingFrame = false;
        done();
        processNextInQueue();
        return;
      }

      childProcess.stdin.write(buffer.toString("base64") + "\n", (err) => {
        if (err) {
          node.error(`Error writing to stdin: ${err}`);
          processingFrame = false;
          done(err);
          processNextInQueue();
        }
      });
    }

    childProcess.stdout.on("data", function (data) {
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
        const base64Data = output.replace(/^data:image\/\w+;base64,/, "");
        const annotatedBuffer = Buffer.from(base64Data, "base64");
        if (annotatedBuffer.length > 0) {
          if(isImageBuffer(annotatedBuffer)) {
            node.send({ annotatedBuffer });
          }
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
      if (childProcess) {
        childProcess.stdin.end();
        childProcess.stdin.destroy();
        childProcess.stdout.destroy();
        childProcess.stderr.destroy();
        childProcess.kill("SIGTERM");
      }
      done();
    });
  }

  RED.nodes.registerType("fall detection", fallDetection);
};
