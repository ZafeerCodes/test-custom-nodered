const path = require('path');
const PythonIntegrationHelper = require("python-integration-helper");

module.exports = function (RED) {
    function FaceDetection(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // Initialize Python helper with parameters
        const pythonHelper = new PythonIntegrationHelper(node);
        const scriptPath = path.join(__dirname, "faceDetectionNode.py");

        // Convert model selection to detector type
        let modelType = 'yolo';
        if (config.model === 'mtcnn') {
            modelType = 'mtcnn';
        } else if (config.model === 'retinaface') {
            modelType = 'retinaface';
        }

        // Prepare parameters
        const params = {
            model: modelType,
            boundingBoxColor: config.boundingBoxColor || '#00FF00',
            threshold: parseFloat(config.threshold || 0.5)
        };

        pythonHelper.initialize(scriptPath, params);

        // Context variables
        let currentDone = null;

        // Handle Python script output
        pythonHelper.on('output', (output) => {
            try {
                const [base64Image, boxesStr] = output.toString().split(' @ ');
                
                // Convert base64 to buffer
                const bufferString = "data:image/jpeg;base64, " + base64Image;
                const base64Data = bufferString.replace(/^data:image\/\w+;base64,/, "");
                const annotatedBuffer = Buffer.from(base64Data, "base64");

                // Parse coordinates
                let coordinates = [];
                if (boxesStr) {
                    coordinates = JSON.parse(boxesStr.replace(/\(/g, '[').replace(/\)/g, ']'));
                }

                node.send({
                    annotatedBuffer: annotatedBuffer,
                    coordinates: coordinates
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

            currentDone = done;

            // Send frame to Python script
            const base64Image = msg.frameBuffer.toString('base64');
            pythonHelper.enqueue(base64Image);
        });

        // Cleanup on node close
        node.on("close", async function (done) {
            currentDone = null;
            await pythonHelper.shutdown();
            done();
        });
    }

    RED.nodes.registerType("face-detection", FaceDetection);
};