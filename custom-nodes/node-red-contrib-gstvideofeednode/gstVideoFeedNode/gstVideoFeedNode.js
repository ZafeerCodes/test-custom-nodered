module.exports = function (RED) {
  function gstVideFeed(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const { spawn, execSync } = require("child_process");
    const fs = require("fs");
    const path = require("path");
    const gstConfigPath = path.join(__dirname, `gstConfigs`);

    let gstProcess = null;
    let isClosing = false;
    let gstProcessError = false;

    node.status({ fill: "brown", shape: "ring", text: "Idle" });

    function sendFrame(msg, buffer) {
      node.send({
        ...msg,
        frameBuffer: buffer,
      });
    }

    function compileGStreamer(executableName, sourceFile) {
      if (!fs.existsSync(`${gstConfigPath}/${executableName}`)) {
        try {
          execSync(
            `gcc -o ${gstConfigPath}/${executableName} ${gstConfigPath}/${sourceFile} $(pkg-config --cflags --libs gstreamer-1.0 gstreamer-plugins-base-1.0)`,
            { stdio: "inherit" }
          );
          console.log(`${executableName} compiled successfully!`);
        } catch (error) {
          node.error(`Error compiling GStreamer: ${error.message}`);
          process.exit(1);
        }
      }
    }

    function serveRtsp(msg, rtspUrl, frameRate) {
      let buffer = Buffer.alloc(0);
      gstProcessError = false;
      node.status({ fill: "blue", shape: "ring", text: "Initializing" });
      compileGStreamer("rtsp_gstreamer", "rtsp_gstreamer.c");

      gstProcess = spawn(`${gstConfigPath}/rtsp_gstreamer`, [
        rtspUrl,
        frameRate,
      ]);

      node.status({ fill: "yellow", shape: "ring", text: "Processing" });

      gstProcess.stdout.on("data", (data) => {
        buffer = Buffer.concat([buffer, data]);
        while (true) {
          const start = buffer.indexOf(Buffer.from([0xff, 0xd8]));
          const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start);

          if (start !== -1 && end !== -1) {
            const jpegData = buffer.slice(start, end + 2);
            buffer = buffer.slice(end + 2);
            sendFrame(msg, jpegData);
          } else {
            break;
          }
        }
      });

      gstProcess.stderr.on("data", (data) => {
        console.error(`Error: ${data}`);
        node.status({ fill: "red", shape: "ring", text: "Error" });
        gstProcessError = true
      });

      gstProcess.on("close", () => {
        gstProcess = null;
        node.status({ fill: "brown", shape: "ring", text: "Idle" });
      });
    }

    function serveVideoFile(msg, selectedFile, repeat, frameRate = 1) {
      let buffer = Buffer.alloc(0);
      node.status({ fill: "blue", shape: "ring", text: "Initializing" });
      compileGStreamer("file_gstreamer", "file_gstreamer.c");
      gstProcessError = false;
      function startGstProcess() {
        gstProcess = spawn(`${gstConfigPath}/file_gstreamer`, [
          selectedFile,
          frameRate,
        ]);

        node.status({ fill: "yellow", shape: "ring", text: "Processing" });

        gstProcess.stdout.on("data", (data) => {
          buffer = Buffer.concat([buffer, data]);
          while (true) {
            const start = buffer.indexOf(Buffer.from([0xff, 0xd8]));
            const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start);

            if (start !== -1 && end !== -1) {
              const jpegData = buffer.slice(start, end + 2);
              buffer = buffer.slice(end + 2);
              sendFrame(msg, jpegData);
            } else {
              break;
            }
          }
        });

        gstProcess.stderr.on("data", (data) => {
          console.error(`Error: ${data}`);
          node.status({ fill: "red", shape: "ring", text: "Error" });
          gstProcessError = true
        });

        gstProcess.on("close", (code) => {
          if (!isClosing && !gstProcessError) {
            node.status({ fill: "green", shape: "dot", text: "Processed" });
          }
          gstProcess = null;
          if (repeat && !isClosing) {
            node.status({ fill: "blue", shape: "ring", text: "Repeating" });

            setTimeout(() => {
              if (!isClosing) {
                startGstProcess();
              }
            }, 1000);
          }
        });
      }

      startGstProcess();
    }

    setTimeout(() => {
      node.emit("input", {});
    }, 1000);

    node.on("input", function (msg) {
      isClosing = false;
      let inputFormat = config.format;
      let videoRepeat = config.videoRepeat;
      let frameRate = config.frameRate;
      let selectedFile = config.selectedFile;
      let rtspUrl = config?.rtspUrl?.trim();

      if (!inputFormat) {
        node.error("Input format is required");
        return;
      }

      if (inputFormat === "rtsp") {
        if (rtspUrl) {
          serveRtsp(msg, rtspUrl, frameRate);
        } else {
          node.error("RTSP URL is required for RTSP format");
        }
      } else if (inputFormat === "videoFile") {
        if (selectedFile) {
          serveVideoFile(msg, selectedFile, videoRepeat, frameRate);
        } else {
          node.error("Video file path is required for Video File format");
        }
      } else {
        node.error("Unknown input format");
      }
    });

    node.on("close", function (done) {
      isClosing = true;
      node.status({ fill: "brown", shape: "ring", text: "Idle" });
      if (gstProcess && typeof gstProcess.kill === "function") {
       
        gstProcess.on("close", () => {
          gstProcess = null;
          node.status({ fill: "brown", shape: "ring", text: "Idle" });
          done();
        });

        gstProcess.on("error", (err) => {
          node.error(`Error closing GStreamer process: ${err.message}`);
          done(err);
        });
        gstProcess.kill("SIGKILL");
        gstProcess = null;
      } else {
        done();
      }
    });
  }

  RED.nodes.registerType("video feed", gstVideFeed);
};
