const { spawn } = require('child_process');
const path = require('path');
const { draw_bounding_boxes } = require('./resources/draw-boundig-boxes');

module.exports = function (RED) {
    function EmotionDetectionNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        let FER_image_script = path.join(__dirname, "FER/FER_image.py");
        let child = null;
        let processingFrame = false;
        const queue = [];

        // Spawn the child process once
        child = spawn('python3', [FER_image_script], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        child.on('error', (error) => {
            node.error(`Failed to start subprocess: ${error}`);
        });

        child.stderr.on('data', (data) => {
            node.error(`Python Error: ${data}`);
        });

        child.on('close', (code) => {
            node.log(`Child process exited with code ${code}`);
        });

        function processNextInQueue() {
            if (queue.length > 0 && !processingFrame) {
                processingFrame = true;
                processMsg(queue.shift());
            }
        }

        node.on('input', function (msg, send, done) {
            queue.push({ msg, send, done });
            processNextInQueue();
        });

        function processMsg({ msg, send, done }) {
            const buffer = msg.frameBuffer;

            if (!buffer) {
                node.error('No frame buffer received.');
                processingFrame = false;
                done();
                processNextInQueue();
                return;
            }

            if (!child) {
                node.error('Child process not running.');
                processingFrame = false;
                done();
                processNextInQueue();
                return;
            }

            // Send the image buffer to the Python script via stdin
            child.stdin.write(buffer.toString('base64') + '\n', (err) => {
                if (err) {
                    node.error(`Error writing to stdin: ${err}`);
                    processingFrame = false;
                    done(err);
                    processNextInQueue();
                }
            });

            child.stdout.once('data', function (data) {
                dataHandler(data, buffer, send, done);
            });
        }

        function dataHandler(data, buffer, send, done) {
            const outputData = data.toString();
            processOutput(outputData.trim(), buffer, send, done);
        }

        function processOutput(output, buffer, send, done) {
            try {
                const boxes = JSON.parse(output);
                const detectedObjects = boxes.map(box => ({
                    id: null,
                    centroid: { x: 0, y: 0 },
                    boundingBox: {
                        x1: box[0],
                        y1: box[1],
                        x2: box[2],
                        y2: box[3],
                    },
                    label: box[4],
                    prob: 0.6
                }));

                draw_bounding_boxes(buffer, detectedObjects, "#00FF00", "#00FF00", "25", "800")
                    .then(annotatedBuffer => {
                        send({
                            boxes: boxes,
                            annotatedBuffer: annotatedBuffer,
                        });
                        processingFrame = false;
                        done();
                        processNextInQueue();
                    })
                    .catch(err => {
                        node.error(`Error drawing bounding boxes: ${err}`);
                        processingFrame = false;
                        done(err);
                        processNextInQueue();
                    });
            } catch (error) {
                node.error(`Error processing output: ${error}`);
                processingFrame = false;
                done(error);
                processNextInQueue();
            }
        }

        node.on('close', function (done) {
            if (child) {
                child.stdin.end();
                child.kill();
            }
            done();
        });
    }

    RED.nodes.registerType("emotion-detection", EmotionDetectionNode);
};