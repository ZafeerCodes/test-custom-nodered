module.exports = function (RED) {
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const ffmpeg = require('fluent-ffmpeg');
    const fs = require('fs');
    const path = require('path');
    const mkdirp = require('mkdirp');

    const dotenv = require("dotenv");
  
    dotenv.config({
      path: path.resolve(__dirname, "../.env"),
    });
  
    function RtspNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var context = this.context();
        var restart = false;

        /**
         * 
         * Image path setup here
         * 
        */

        const imagesDir = path.join(__dirname, 'images');
        mkdirp.sync(imagesDir);

        /**
        * 
        * RTSP url setup here
        * 
       */

        var inputSource = config.rtspUrl;
        var msgObj = {};

        console.log('Input Source:', inputSource);

        if (!inputSource) {
            return;
        }

        /**
         * 
         * Function to be triggered on every frame
         * 
         */
        function testFunction(imagePath) {
            console.log(`New image saved: ${imagePath}`);
            node.send({
                ...msgObj,
                imagePath: imagePath,
                imageUrl: `${process.env.PERCEPTO_LOCAL_NGINX_URL}/percepto/content/rtsp/${imagePath?.split('/').splice(-2, 2).join('/') ?? ""}`,
                topic: "new_image"
            });
        }

        let command;

        /**
        * 
        * Check and get unique path
        * 
        */

        function getUniqueFilename(dir, template) {
            let counter = 1;
            let filename = template.replace('%d', counter);
            while (fs.existsSync(path.join(dir, filename))) {
                counter++;
                filename = template.replace('%d', counter);
            }
            return path.join(dir, filename);
        }


        /**
         * 
         * Main function to serve RTSP 
         * 
        */

        let errorShown = false;
        function startFfmpeg() {
            command = ffmpeg(inputSource)
                .setFfmpegPath(ffmpegPath)
                .outputOptions('-vf', 'fps=1/10')
                // .output(path.join(imagesDir, '%d.jpg')) // Output destination template for images
                .output(getUniqueFilename(imagesDir, '%d.jpg'))
                .on('end', () => {
                    node.send({
                        payload: "Processing ended",
                        topic: "end"
                    });
                })
                .on('error', (err) => {
                    const errStr = err?.toString();
                    if (errStr?.includes("5XX") || errStr?.includes("401")) {
                        if (!errorShown) {
                            node.error('FFmpeg error: ' + errStr);
                            errorShown = true;
                        }
                    } else {
                        
                        restartFfmpeg();
                        errorShown = false; 
                    }
                });

            command.run();
        }


        function restartFfmpeg() {
      
            if (command) {
                command.kill('SIGINT');
            }
            if(restart) {
                console.log('Restarting FFmpeg process...');
                startFfmpeg();
            }
            
        }


        /**
        * 
        * Added debaunce to prevent multiple payload send to the next node due 
        * to multiple deploy of the flow
        * 
       */

        const debounceTimeout = 1000;
        let debounceTimer = null;

        fs.watch(imagesDir, (eventType, filename) => {
            if (eventType === 'rename' && filename) {
                const imagePath = path.join(imagesDir, filename);
                if (fs.existsSync(imagePath)) {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        testFunction(imagePath);
                    }, debounceTimeout);
                }
            }
        });

        /**
         * 
         * event function from Node_RED to check details from editor
         * 
        */

        this.on('input', function (msg) {
            const text = config.rtspUrl || msg.payload.rtspUrl;
            msgObj = msg;

            if (text) {
                inputSource = text;
                if (command) {
                    command.kill('SIGINT');
                }
                restart = true;
                startFfmpeg();
            }
        });

        this.on('close', function () {
            if (command) {
                command.kill('SIGINT');
                restart = false;
                console.log('Node closed and FFmpeg process killed.');
            }
        });
    }

    RED.nodes.registerType("RTSP", RtspNode);
};
