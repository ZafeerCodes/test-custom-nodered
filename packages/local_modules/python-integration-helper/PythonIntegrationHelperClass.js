const { spawn } = require("child_process");
const fs = require("fs");
const EventEmitter = require("events");

class PythonIntegrationHelper extends EventEmitter {
    constructor(node, config = {}) {
        super();
        this.node = node;
        this.config = config;
        this.child = null;
        this.processingFrame = false;
        this.queue = [];
        this.completeData = "";
        this.isClosing = false;
        this.hasStartedProcessing = false;
        
        // Bind methods to preserve context
        this.processNextInQueue = this.processNextInQueue.bind(this);
        this.processOutput = this.processOutput.bind(this);
    }

    initialize(scriptPath, params = {}) {
        if (this.child) return; // Don't initialize if already running

        // Verify script exists
        if (!fs.existsSync(scriptPath)) {
            this.node.error("Python script not found: " + scriptPath);
            return;
        }

        const paramArray = Object.entries(params).flatMap(
            ([key, value]) => [`--${key}`, value]
        );

        try {
            this.child = spawn("python3", [scriptPath, ...paramArray], {
                stdio: ["pipe", "pipe", "pipe"]
            });

            this.setupProcessHandlers();
        } catch (error) {
            this.node.error("Failed to start Python process: " + error.message);
        }
    }

    setupProcessHandlers() {
        if (!this.child) return;

        this.child.on("error", (error) => {
            if (!this.isClosing) {
                this.node.error("Python process error: " + error.message);
                this.node.status({fill: "red", shape: "dot", text: "Process error"});
            }
        });

        this.child.stderr.on("data", (data) => {
            if (!this.isClosing) {
                this.node.error("Python stderr: " + data.toString());
                this.node.status({fill: "yellow", shape: "dot", text: "Warning"});
            }
        });

        this.child.stdout.on("data", (data) => {
            this.hasStartedProcessing = true;
            this.completeData += data.toString();
            
            if (this.completeData.endsWith("\n")) {
                const output = this.completeData.slice(0, -1);
                this.processOutput(output);
                this.completeData = "";
            }
        });

        this.child.on("close", (code) => {
            if (!this.isClosing) {
                this.node.log(`Python process exited with code ${code}`);
                this.node.status({fill: "red", shape: "ring", text: "Process ended"});
                this.child = null;
                this.emptyQueue();
                
                if (this.hasStartedProcessing) {
                    this.node.warn("Python process ended unexpectedly. Restarting...");
                    setTimeout(() => this.initialize(this.scriptName, this.params), 5000);
                }
            }
        });

        this.child.stdin.on('error', (error) => {
            if (error.code === 'EPIPE') {
                if (!this.isClosing) {
                    this.node.error("Broken pipe detected");
                    this.cleanupProcess();
                }
            } else {
                this.node.error("Stdin error: " + error.message);
            }
        });

        this.node.status({fill: "green", shape: "dot", text: "Ready"});
    }

    cleanupProcess() {
        if (this.child && !this.child.killed) {
            try {
                this.child.stdin.destroy();
                this.child.stdout.destroy();
                this.child.stderr.destroy();
                this.child.kill('SIGTERM');
            } catch (error) {
                // Ignore errors during cleanup
            }
            this.child = null;
        }
        this.emptyQueue();
    }

    processNextInQueue() {
        if (this.queue.length > 0 && !this.processingFrame && this.child && !this.child.killed) {
            this.processingFrame = true;
            const next = this.queue.shift();
            this.processFrame(next);
        }
    }

    processFrame({ data, send, done }) {
        if (!this.child || this.child.killed) {
            this.node.error("Python process not running");
            this.processingFrame = false;
            done();
            return;
        }

        try {
            if (this.child.stdin.writable) {
                this.child.stdin.write(
                    data + "\n",
                    (err) => {
                        if (err) {
                            if (err.code === 'EPIPE' && !this.isClosing) {
                                this.node.error("Broken pipe while writing frame");
                                this.cleanupProcess();
                            } else {
                                this.node.error("Error writing to stdin: " + err.message);
                            }
                            this.processingFrame = false;
                            done(err);
                        } else {
                            this.node.status({fill: "green", shape: "dot", text: "Processing"});
                        }
                    }
                );
            } else {
                throw new Error("stdin is not writable");
            }
        } catch (error) {
            if (!this.isClosing) {
                this.node.error("Failed to write to process: " + error.message);
            }
            this.processingFrame = false;
            done(error);
        }
    }

    processOutput(output) {
        try {
            this.emit('output', output);//Defined Output by event name output
        } catch (error) {
            if (!this.isClosing) {
                this.node.error("Error processing output: " + error.message);
            }
        } finally {
            this.processingFrame = false;
            if (!this.isClosing) {
                this.node.status({fill: "green", shape: "dot", text: "Ready"});
            }
            this.processNextInQueue();
        }
    }

    emptyQueue() {
        this.queue.forEach(({ done }) => done && done());
        this.queue.length = 0;
        this.processingFrame = false;
    }

    enqueue(data, send, done) {
        if (this.isClosing) {
            done && done(new Error("Node is closing"));
            return;
        }

        this.queue.push({ data, send, done });
        this.processNextInQueue();
    }

    async shutdown() {
        this.isClosing = true;
        this.node.status({});
        this.emptyQueue();

        if (this.child && !this.child.killed) {
            return new Promise((resolve) => {
                const closeTimeout = setTimeout(() => {
                    if (this.child) {
                        try {
                            this.child.kill('SIGKILL');
                        } catch (error) {
                            // Ignore errors during force kill
                        }
                    }
                    this.child = null;
                    resolve();
                }, 3000);

                try {
                    this.child.stdin.destroy();
                    this.child.stdout.destroy();
                    this.child.stderr.destroy();
                    
                    this.child.once("close", () => {
                        clearTimeout(closeTimeout);
                        this.child = null;
                        resolve();
                    });
                    this.child.kill('SIGTERM');
                } catch (error) {
                    clearTimeout(closeTimeout);
                    if (this.child) {
                        try {
                            this.child.kill('SIGKILL');
                        } catch (e) {
                            // Ignore errors during force kill
                        }
                    }
                    this.child = null;
                    resolve();
                }
            });
        }
    }
}

module.exports = PythonIntegrationHelper;

