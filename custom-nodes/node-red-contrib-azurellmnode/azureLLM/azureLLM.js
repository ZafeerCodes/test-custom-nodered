const { spawn } = require('child_process');
const WebSocketServerClass = require("web-socket-server");
require("dotenv").config();
const path = require("path");

module.exports = function (RED) {
  function AzureLLMNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    const pyScript = path.join(__dirname, "scripts", "main.py");
    var scriptProcess = null;

    const msgQueue = [];
    let processingFrame = false;
    let processCache = {};
    let connectedNodes = config.wires?.[0] || [];

    const nodeStatus = {
      idle: () => node.status({ fill: "gray", shape: "dot", text: "Idle" }),
      initializing: () => node.status({ fill: "yellow", shape: "dot", text: "Initializing..." }),
      creatingSearchIndex: () => node.status({ fill: "yellow", shape: "dot", text: "Creating Search Index..." }),
      successSearchIndex: () => node.status({ fill: "blue", shape: "dot", text: "Search Index Created" }),
      processingDocument: () => node.status({ fill: "yellow", shape: "dot", text: "Processing Document..." }),
      processedDocument: () => node.status({ fill: "blue", shape: "dot", text: "Processed Document" }),
      indexingDocument: () => node.status({ fill: "yellow", shape: "dot", text: "Indexing Document..." }),
      successIndexing: () => node.status({ fill: "blue", shape: "dot", text: "Indexing Successful" }),
      successProcessed: () => node.status({ fill: "green", shape: "dot", text: "Processing Successful" }),
      completeProcessing: () => node.status({ fill: "green", shape: "dot", text: "Processing Complete" }),
      ready: () => node.status({ fill: "green", shape: "dot", text: "Ready" }),
      success: (successMsg) => node.status({ fill: "green", shape: "dot", text: successMsg || "Success" }),
      error: (errorMsg) => node.status({ fill: "red", shape: "dot", text: errorMsg || "Error Occurred" }),
    };

    nodeStatus.idle();


    const wss = new WebSocketServerClass("chat view", {
      port: process.env.RED_WS_PORT || 1861,
      path: `/websocket`
    });

    wss.on("message_received", async (message) => {
      let eventName = message?.event;
      let payload = message?.payload;

      let isValidClient = connectedNodes.includes(eventName?.split("_")?.[1]);

      if (isValidClient) {
        try {
          await triggerPrompt(payload.message, (response) => {
            message.reply({
              response: response,
              originalMessage: payload.message
            });
          });

        } catch (error) {
          console.error("Error processing message:", error);
          message.reply({
            error: "Failed to process message",
            originalMessage: payload.message
          });
        }
      }
    });

    wss.on('client_connected', (data) => {
      console.log(`Client connected: ${data.clientId}`);
    });

    node.on("input", function (msg, send, done) {
      nodeStatus.initializing();
      msgQueue.push({ msg, send, done });
      processNextInQueue();
    });

    function processNextInQueue() {
      if (msgQueue.length > 0 && !processingFrame) {
        processingFrame = true;
        const queueItem = msgQueue.shift();
        processMsg(queueItem.msg, queueItem.send, queueItem.done);
      }
    }


    async function processMsg(msg, send, done) {
      const filePath = msg?.files?.[0] || msg.filePath;

      if (!filePath) {
        node.warn("No file path received.");
        processingFrame = false;
        done();
        processNextInQueue();
        return;
      }

      let scriptParameters = {
        filePath: filePath
      };

      const finalScriptParams = [];
      if (scriptParameters) {
        try {
          const params = scriptParameters;
          Object.entries(params).forEach(([key, value]) => {
            finalScriptParams.push(`--${key}=${value}`);
          });
        } catch (error) {
          node.error("Failed to parse parameters: " + error.message);
        }
      }

      if (!processCache[pyScript]) {
        scriptProcess = spawn("python3", [pyScript, ...finalScriptParams]);
        processCache[pyScript] = scriptProcess;

        let buffer = '';

        scriptProcess.stdout.on("data", function (data) {
          buffer += data.toString();
          while (true) {
            try {
              const jsonStartIndex = buffer.indexOf('{');
              const jsonEndIndex = buffer.indexOf('}', jsonStartIndex);
              if (jsonStartIndex === -1 || jsonEndIndex === -1) break;
              const jsonStr = buffer.slice(jsonStartIndex, jsonEndIndex + 1);
              const jsonData = JSON.parse(jsonStr);
              processOutput(JSON.stringify(jsonData), () => { });
              buffer = buffer.slice(jsonEndIndex + 1);
            } catch (error) {
              break;
            }
          }
        });

        scriptProcess.stderr.on("data", (data) => {
          const errorMsg = data.toString().trim();
          nodeStatus.error(errorMsg.slice(0, 50));
        });

        scriptProcess.on("error", (error) => {
          node.error(`Failed to start subprocess: ${error}`);
        });


        scriptProcess.on("close", (code) => {
          node.log(`Child process exited with code ${code}`);
        });
      }
    }

    async function triggerPrompt(prompt, callback) {
      if (!scriptProcess || scriptProcess.stdin.destroyed) {
        node.warn("Child process not running or stdin stream is closed.");
        callback(null);
        return;
      }

      const dataToSend = {
        prompt: prompt,
      };

      scriptProcess.stdin.write(JSON.stringify(dataToSend) + "\n", (err) => {
        if (err) {
          node.error(`Error writing to stdin: ${err}`);
          callback(null);
          return;
        }
      });

      scriptProcess.stdout.once('data', function (data) {
        data = data.toString().trim();
        processOutput(data, (output) => { callback(output) });
      });
    }

    function isValidJSONObject(response) {
      try {
        const parsed = JSON.parse(response);
        return typeof parsed === 'object' && parsed !== null;
      } catch (error) {
        return false;
      }
    }

    function processOutput(output, callback) {
      try {
        const parsedJson = JSON.parse(output);
        let status = parsedJson?.status ?? "";
        if (status && status === "initializing") {
          nodeStatus.initializing();
        } else if (status && status === "creating_search_index") {
          nodeStatus.creatingSearchIndex();
        } else if (status && status === "search_index_created") {
          nodeStatus.successSearchIndex();
        } else if (status && status === "processing_document") {
          nodeStatus.processingDocument();
        } else if (status && status === "document_processed") {
          nodeStatus.processedDocument();
        } else if (status && status === "indexing_document") {
          nodeStatus.indexingDocument();
        } else if (status && status === "document_indexed") {
          nodeStatus.successIndexing();
        } else if (status && status === "document_processing_complete") {
          nodeStatus.completeProcessing();
          setTimeout(() => {
            nodeStatus.ready();
          }, 1000)
        } else {
          nodeStatus.ready();
        }
        if (status && status === "model_response") {
          callback(parsedJson?.response)
        }
      } catch (error) {
        node.error('Error processing input message:', error);
      }
    }

    node.on("close", function (done) {
      try {
        const clientCount = wss.clients.size;
        node.log(`Closing WebSocket server. Active clients: ${clientCount}`);
        wss.close();

        if (scriptProcess) {
          scriptProcess.stdin.end();
          scriptProcess.stdin.destroy();
          scriptProcess.stdout.destroy();
          scriptProcess.stderr.destroy();
          scriptProcess.kill("SIGTERM");
        }

        // if (processCache[pyScript]) {
        //   processCache[pyScript].release();
        //   delete processCache[pyScript];
        // }
        nodeStatus.idle();
        done();
      } catch (error) {
        console.log('Error during cleanup:', error);
        done();
      }
    });
  }
  RED.nodes.registerType("azure llm", AzureLLMNode);
};

