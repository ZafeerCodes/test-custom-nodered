const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const { PassThrough } = require("stream");
const fs = require("fs");
const path = require("path");

let command = null;
let frameStream = null;
const outputDir = path.join(__dirname, "hls");
var ffmpegInitialized = false;
let isClearingDirectory = false;

function initializeFFmpeg() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  frameStream = new PassThrough();

  command = ffmpeg()
    .setFfmpegPath(ffmpegPath)
    .input(frameStream)
    .inputFormat("mjpeg")
    .outputOptions([
      // "-r 25",
      "-r 14",
      "-c:v libx264",
      "-pix_fmt yuv420p",
      "-hls_time 4",
      "-hls_list_size 20",
      "-hls_flags delete_segments",
      "-start_number 0",
      "-g 80",                
      "-force_key_frames expr:gte(t,n_forced*4)",
      "-preset ultrafast",
      "-tune zerolatency",
      "-threads 16",
      '-an'
    ])
    .output(path.join(outputDir, "playlist.m3u8"))
    .on("start", (cmdLine) => {
      // console.log(`Processing started!`);
    })
    .on("end", () => {
      console.log(`Processing ended!`);
      cleanup();
    })
    .on("error", (err) => {
      console.log(`FFmpeg error: ${err.message}`);
      cleanup();
    });

  command.run();
}

function cleanup() {
  if (command) {
    command.kill("SIGINT");
    command = null;
    ffmpegInitialized = true;
  }
  if (frameStream) {
    frameStream.end();
  }
  clearDirectory(outputDir);
}


function clearDirectory(directory) {
  if (isClearingDirectory) return; 

  isClearingDirectory = true;
  if (fs.existsSync(directory)) {
    fs.rm(directory, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error(`Error removing directory: ${err.message}`);
      } else {
        console.log(`Directory removed successfully.`);
        fs.mkdir(directory, { recursive: true }, (err) => {
          if (err) {
            console.error(`Error creating directory: ${err.message}`);
          } else {
            console.log(`Directory created successfully.`);
            if (ffmpegInitialized) {
              initializeFFmpeg();
              ffmpegInitialized = false;
            }
            frameStream.resume();
          }
        });
      }
      isClearingDirectory = false;
    });
  }
  //  else {
  //   fs.mkdir(directory, { recursive: true }, (err) => {
  //     if (err) {
  //       console.error(`Error creating directory: ${err.message}`);
  //     } else {
  //       console.log(`Directory created successfully.`);
  //       if (ffmpegInitialized) {
  //         initializeFFmpeg();
  //         ffmpegInitialized = false;
  //       }
  //       frameStream.resume();
  //     }
  //     isClearingDirectory = false;
  //   });
  // }
}

function generateVideo(frameBuffer, end) {
  try {
    if (end) {
      console.log("Ending stream and restarting FFmpeg...");
      cleanup();
      return;
    } 
    if (Buffer.isBuffer(frameBuffer)) {
      frameStream.write(frameBuffer);
    } else {
      console.log("Invalid input: Expected a Buffer.");
    }
  } catch (err) {
    console.log(`Error during video generation: ${err.message}`);
  }
}

initializeFFmpeg();

module.exports = { generateVideo };
