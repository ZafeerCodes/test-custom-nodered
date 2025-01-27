const { saveBufferToJpegFile } = require("../test/bufferToImage");
const { calculateFTT } = require("./resources/helpers");

module.exports = function (RED) {
  const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
  const ffmpeg = require("fluent-ffmpeg");
  const stream = require("stream");

  function VideoFeedNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    var command = null;
    var outputStream = null;

    node.status({ fill: "brown", shape: "ring", text: "Idle" });

    var frameBuffer = [];
    var intervalId;
    var isClosing = false;

    function storeFrames(buffer) {
      frameBuffer.push(buffer);
    }

    function sendFrame(msg, buffer) {
      node.send({
        ...msg,
        frameBuffer: buffer,
      });
    }

    function clearAllIntervals() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    // Function to serve RTSP stream
    // function serveRtsp(msg, rtspUrl, frameRate = 1, frameTiming = 10) {
    //     let buffer = Buffer.alloc(0);

    //     const outputStream = new stream.PassThrough({ highWaterMark: 1024 * 1024 });

    //     try {
    //         command = ffmpeg(rtspUrl)
    //             .setFfmpegPath(ffmpegPath)
    //             .outputOptions([
    //                 '-f image2pipe',
    //                 '-vcodec mjpeg',
    //                 `-vf fps=${frameRate}/${frameTiming}`,
    //                 "-preset ultrafast",
    //                 "-tune zerolatency",
    //                 "-threads 16",
    //                 '-an'
    //             ])
    //             .on('start', () => {
    //                 console.log('Processing started!');
    //                 node.status({ fill: "blue", shape: "ring", text: "Initializing" });
    //             })
    //             .on('stderr', (stderrLine) => {
    //                 // console.error('FFmpeg stderr:', stderrLine);
    //             })
    //             .on('error', (err, stdout, stderr) => {
    //                 console.error('FFmpeg error:', err.message);
    //             })
    //             .on('end', () => {
    //                 console.log('Processing ended!');
    //                 node.status({ fill: "green", shape: "dot", text: "Processed" });
    //             })
    //             .pipe(outputStream);

    //         outputStream.on('data', (data) => {
    //             node.status({ fill: "yellow", shape: "ring", text: "Processing" });
    //             try {
    //                 buffer = Buffer.concat([buffer, data]);

    //                 while (true) {
    //                     const start = buffer.indexOf(Buffer.from([0xFF, 0xD8]));
    //                     const end = buffer.indexOf(Buffer.from([0xFF, 0xD9]), start);

    //                     if (start !== -1 && end !== -1) {
    //                         const jpegData = buffer.slice(start, end + 2);
    //                         buffer = buffer.slice(end + 2);
    //                         sendFrame(msg, jpegData);
    //                     } else {
    //                         break;
    //                     }
    //                 }
    //             } catch (err) {
    //                 console.error('Error processing buffer:', err);
    //             }
    //         });

    //     } catch (err) {
    //         console.error('Error initializing FFmpeg command:', err);
    //     }
    // }

    function serveRtsp(msg, rtspUrl, frameRate = 1, frameTiming = 1) {
      let buffer = Buffer.alloc(0);
      let lastFrameTime = 0;
      let latestFrame = null;
      let frameInterval = calculateFTT(frameRate, frameTiming);

      outputStream = new stream.PassThrough({ highWaterMark: 1024 * 1024 });

      try {
        command = ffmpeg(rtspUrl)
          .setFfmpegPath(ffmpegPath)
          .outputOptions([
            "-f image2pipe",
            "-vcodec mjpeg",
            `-vf fps=${frameRate}/${frameTiming}`,
            "-preset ultrafast",
            "-tune zerolatency",
            "-threads 16",
            "-an",
          ])
          .on("start", () => {
            console.log("Processing started!");
            node.status({ fill: "blue", shape: "ring", text: "Initializing" });
          })
          .on("stderr", (stderrLine) => {
            // console.error('FFmpeg stderr:', stderrLine);
          })
          .on("error", (err, stdout, stderr) => {
            // console.error('FFmpeg error:', err.message);
          })
          .on("end", () => {
            console.log("Processing ended!");
            node.status({ fill: "green", shape: "dot", text: "Processed" });
          })
          .pipe(outputStream);

        outputStream.on("data", (data) => {
          node.status({ fill: "yellow", shape: "ring", text: "Processing" });
          try {
            buffer = Buffer.concat([buffer, data]);

            while (true) {
              const start = buffer.indexOf(Buffer.from([0xff, 0xd8]));
              const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start);

              if (start !== -1 && end !== -1) {
                const jpegData = buffer.slice(start, end + 2);
                buffer = buffer.slice(end + 2);

                latestFrame = jpegData;

                const currentTime = Date.now();
                if (currentTime - lastFrameTime >= frameInterval) {
                  sendFrame(msg, latestFrame);
                  lastFrameTime = currentTime;
                  latestFrame = null;
                }
              } else {
                break;
              }
            }
          } catch (err) {
            console.error("Error processing buffer:", err);
          }
        });
      } catch (err) {
        console.error("Error initializing FFmpeg command:", err);
      }
    }

    // Function to serve video file
    function serveVideoFile(
      msg,
      selectedFile,
      repeat,
      frameRate = 1,
      frameTiming = 1
    ) {
      let frameInterval = calculateFTT(frameRate, frameTiming);
      let buffer = Buffer.alloc(0);
      outputStream = new stream.PassThrough({ highWaterMark: 1024 * 1024 });

      try {
        command = ffmpeg(selectedFile)
          .setFfmpegPath(ffmpegPath)
          .outputOptions([
            "-f image2pipe",
            "-vcodec mjpeg",
            `-vf fps=${frameRate}/${frameTiming}`,
            "-preset ultrafast",
            "-tune zerolatency",
            "-threads 16",
            "-an",
          ])
          .on("start", () => {
            console.log("Processing started!");
            node.status({ fill: "blue", shape: "ring", text: "Initializing" });
          })
          .on("stderr", (stderrLine) => {
            // console.error('FFmpeg stderr:', stderrLine);
          })
          .on("error", (err) => {
            // console.error('FFmpeg error:', err.message);
            frameBuffer = [];
            clearAllIntervals();
          })
          .on("end", () => {
            console.log("Processing ended!");
            node.status({ fill: "green", shape: "dot", text: "Processed" });
            if (frameBuffer.length > 0) {
              intervalId = setInterval(() => {
                if (isClosing) {
                  clearAllIntervals();
                  return;
                }

                const buffer = frameBuffer.shift();
                sendFrame(msg, buffer);
                if (frameBuffer.length === 0) {
                  clearInterval(intervalId);
                  console.log("Frame ended!");

                  if (repeat && !isClosing) {
                    serveVideoFile(
                      msg,
                      selectedFile,
                      repeat,
                      frameRate,
                      frameTiming
                    );
                  }
                }
              }, frameInterval);
            }
          })
          .pipe(outputStream);

        outputStream.on("data", (data) => {
          node.status({ fill: "yellow", shape: "ring", text: "Processing" });
          try {
            buffer = Buffer.concat([buffer, data]);
            while (true) {
              const start = buffer.indexOf(Buffer.from([0xff, 0xd8]));
              const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start);

              if (start !== -1 && end !== -1) {
                const jpegData = buffer.slice(start, end + 2);
                buffer = buffer.slice(end + 2);
                storeFrames(jpegData);
              } else {
                break;
              }
            }
          } catch (err) {
            console.error("Error processing buffer:", err);
          }
        });
      } catch (err) {
        console.error("Error initializing FFmpeg command:", err);
      }
    }

    setTimeout(() => {
      node.emit("input", {});
    }, 1000);

    this.on("input", function (msg) {
      isClosing = false;
      let inputFormat = config.format;
      let videoRepeat = config.videoRepeat;
      let frameTiming = config.frameTiming;
      let frameRate = config.frameRate;
      let selectedFile = config.selectedFile;
      let rtspUrl = config?.rtspUrl?.trim();
      // if (!rtspUrl || rtspUrl.trim() === "") {
      //   node.error("Rtsp url is required");
      //   return; 
      // }
      // if(!selectedFile || selectedFile === "")  {
      //   node.error("Video file is required");
      //   return; 
      // }

      if (inputFormat === "rtsp") {
        if (rtspUrl) {
          serveRtsp(msg, rtspUrl, frameRate, frameTiming);
        }
      } else if (inputFormat === "videoFile") {
        if (selectedFile) {
          serveVideoFile(
            msg,
            selectedFile,
            videoRepeat,
            frameRate,
            frameTiming
          );
        }
      }
    });

    this.on("close", function () {
      isClosing = true;
      node.status({ fill: "brown", shape: "ring", text: "Idle" });
      try {
        if (command && typeof command.kill === "function") {
          if (
            !command._writableState.finished ||
            !command._readableState.ended
          ) {
            command.kill("SIGKILL");
            command = null;
          } else {
            command.kill("SIGINT");
            command = null;
          }
        }
        if (outputStream) {
          closeReadStream(outputStream);
          outputStream = null;
        }

        frameBuffer = [];
        clearAllIntervals();
        console.log("Node closed and FFmpeg process killed.");
      } catch (err) {
        console.log("Error in closing video feed session: ", err);
      }
    });

    function closeReadStream(stream) {
      if (!stream) return;
      if (stream.close) stream.close();
      else if (stream.destroy) stream.destroy();
    }
  }

  RED.nodes.registerType("video feed(legacy)", VideoFeedNode);
};
