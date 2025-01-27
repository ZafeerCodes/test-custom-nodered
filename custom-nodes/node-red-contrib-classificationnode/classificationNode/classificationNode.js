const path = require('path');
const { draw_bounding_boxes } = require('./resources/draw-boundig-boxes');
const PythonIntegrationHelper = require("python-integration-helper");

module.exports = function (RED) {
    function classificationNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        const params = {
            name: config?.name,
            labelColor: config?.labelColor,
            boundingBoxColor: config?.boundingBoxColor,
            threshold: config?.threshold
        };

        const pythonHelper = new PythonIntegrationHelper(node);
        const scriptPath = path.join(__dirname, "FER/FER_image.py");
        pythonHelper.initialize(scriptPath, params);
        
        let bufferReceived = null;
        let currentSend = null;
        let currentDone = null; // assigning it out side call baks tyo later assign it to a callback

        pythonHelper.on('output', (output) => {
            try {
                console.log(output.toString());
                
                const bufferString = "data:image/jpeg;base64, " + output.toString();
                const base64Data = bufferString.replace(/^data:image\/\w+;base64,/, "");
                const annotatedBuffer = Buffer.from(base64Data, "base64");
          
                node.send({
                  annotatedBuffer: annotatedBuffer,
                });
                if (currentDone) currentDone();
            } catch (error) {
                node.error(`Error processing output: ${error}`);
                if (currentDone) currentDone(error);
            }
        });

        // Handle incoming messages
        node.on("input", function (msg, send, done) {
            if (!msg.frameBuffer) {
                node.warn("No frame buffer received");
                done();
                return;
            }

            if (!msg.boxes || !Array.isArray(msg.boxes)) {
                node.warn("No valid boxes array received");
                done();
                return;
            }

            // Store the current context
            bufferReceived = msg.frameBuffer;
            currentSend = send;
            currentDone = done;

            const coordinates = msg.boxes.filter(coordinateData => {
                const object = coordinateData[4];
                return object === "face";
            });

            const dataToSend = {
                image: bufferReceived.toString('base64'),
                coordinates: coordinates
            };
            
            const jsonData = JSON.stringify(dataToSend);
            pythonHelper.enqueue(jsonData);
        });

        // Cleanup on node close
        node.on("close", async function (done) {
            // Clear the context
            bufferReceived = null;
            currentSend = null;
            currentDone = null;
            
            await pythonHelper.shutdown();
            done();
        });
    }

    RED.nodes.registerType("classification", classificationNode);
};