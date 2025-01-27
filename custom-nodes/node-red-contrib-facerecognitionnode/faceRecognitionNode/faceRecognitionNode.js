const PythonIntegrationHelper = require("python-integration-helper");
const path = require("path");


module.exports = function (RED) {
function FaceRecognitionNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    const params = {
        dataSet: config?.dataSet || '',
        recognitionThreshold: config?.recognitionThreshold || 0.5,
        detectionThreshold: config?.detectionThreshold || 0.5,
    };

    const pythonHelper = new PythonIntegrationHelper(node);    
    // Initialize Python process
    const scriptName = "faceRecognitionNode.py";
    const scriptPath = path.join(__dirname, scriptName);
    pythonHelper.initialize(scriptPath, params);
    
    // Handle output from Python process
    //recieving base64 string
    //converting to image buffer
    pythonHelper.on('output', (output) => {
        const [imageData, labels] = output.split(" @ ");
        const bufferString = "data:image/jpeg;base64, " + imageData;
        const base64Data = bufferString.replace(/^data:image\/\w+;base64,/, "");
        const annotatedBuffer = Buffer.from(base64Data, "base64");

        node.send({
            annotatedBuffer,
            people: labels,
            timeStamp: Date.now()
        });
    });

    // Handle incoming messages
    node.on("input", function(msg, send, done) {
        if (!msg.frameBuffer) {
            node.warn("No frame buffer received");
            done();
            return;
        }
        pythonHelper.enqueue(msg.frameBuffer.toString("base64"), send, done);
    });

    // Cleanup on node close
    node.on("close", async function(done) {
        await pythonHelper.shutdown();
        done();
    });
}
    RED.nodes.registerType("face-recognition-node", FaceRecognitionNode);
}