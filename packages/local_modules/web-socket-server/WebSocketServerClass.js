const EventEmitter = require("events");
const WebSocket = require("ws");

class WebSocketServerClass extends EventEmitter {
    static instance = null;
    static wss = null;

    constructor(type, config = {}) {
        if (WebSocketServerClass.instance) {
            return WebSocketServerClass.instance;
        }

        super();
        this.connectionType = type;
        this.config = {
            port: config.port || 1861,
            path: config.path || "/websocket",
            ...config
        };
        this.clients = new Map();
        WebSocketServerClass.instance = this;
        this.initialize();
    }

    initialize() {
        if (WebSocketServerClass.wss) {
            this.wss = WebSocketServerClass.wss;
            this.emit("server_reused", {
                port: this.config.port,
                path: this.config.path
            });
            return;
        }

        this.wss = new WebSocket.Server({
            port: this.config.port,
            path: this.config.path
        });
        WebSocketServerClass.wss = this.wss;

        this.wss.on("connection", this.handleConnection.bind(this));
        this.wss.on("error", (error) => {
            this.emit("server_error", error);
        });

        this.emit("server_started", {
            port: this.config.port,
            path: this.config.path
        });
    }

    static isServerRunning() {
        return WebSocketServerClass.wss !== null;
    }

    static getInstance() {
        return WebSocketServerClass.instance;
    }

    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    handleConnection(ws, req) {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const nodeId = urlParams.get('nodeid');

        if (!nodeId) {
            ws.close();
            console.log('No nodeid provided. Connection closed.');
            return;
        }

        const existingClient = Array.from(this.clients.values()).find(client => client.nodeId === nodeId);

        if (existingClient) {
            console.log(`Connection already exists for nodeId ${nodeId}. Closing the previous connection.`);
            existingClient.ws.close();
            this.clients.delete(existingClient.info.id);
        }

        const clientId = this.generateClientId();

        this.clients.set(clientId, {
            ws,
            nodeId,
            info: {
                id: clientId,
                ip: req.socket.remoteAddress,
                connected: new Date(),
                lastPing: new Date()
            }
        });

        this.sendToClient(clientId, "connection_established", {
            clientId,
            config: this.config
        });

        ws.on("message", (message) => this.handleMessage(clientId, message));
        ws.on("close", () => this.handleDisconnection(clientId));
        ws.on("error", (error) => this.handleClientError(clientId, error));
        ws.on("pong", () => this.handlePong(clientId));

        this.emit("client_connected", {
            clientId,
            ip: req.socket.remoteAddress
        });

        this.setupPingPong(clientId, ws);
    }
    handleMessage(clientId, message) {
        try {
            const data = JSON.parse(message);
            const { event, payload } = data;

            this.emit(`client_event_${event}`, {
                clientId,
                payload,
                reply: (response) => this.sendToClient(clientId, `${event}_response`, response)
            });

            this.emit("message_received", {
                clientId,
                event,
                payload,
                reply: (response) => this.sendToClient(clientId, `${event}_response`, response)
            });
        } catch (error) {
            this.emit("message_error", {
                clientId,
                error,
                message
            });
        }
    }

    handleDisconnection(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            clearInterval(client.pingInterval);
            this.clients.delete(clientId);
            this.emit("client_disconnected", { clientId });
        }
    }

    handleClientError(clientId, error) {
        this.emit("client_error", {
            clientId,
            error
        });
    }

    handlePong(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.info.lastPing = new Date();
        }
    }

    setupPingPong(clientId, ws) {
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
                this.checkClientTimeout(clientId);
            } else {
                clearInterval(pingInterval);
            }
        }, 30000);  // 30 seconds ping interval

        const client = this.clients.get(clientId);
        if (client) {
            client.pingInterval = pingInterval;
        }
    }

    checkClientTimeout(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            const now = new Date();
            const lastPing = client.info.lastPing;
            const timeoutDuration = 90000; // 90 seconds timeout

            if (now - lastPing > timeoutDuration) {
                this.closeConnection(clientId, 1000, "Connection timeout");
            }
        }
    }

    sendToClient(clientId, event, payload) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify({ event, payload }));
                return true;
            } catch (error) {
                this.emit("send_error", {
                    clientId,
                    event,
                    payload,
                    error
                });
                return false;
            }
        }
        return false;
    }

    broadcast(event, payload, excludeClientId = null) {
        let successCount = 0;
        let failureCount = 0;

        this.clients.forEach((client, clientId) => {
            if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
                const success = this.sendToClient(clientId, event, payload);
                if (success) {
                    successCount++;
                } else {
                    failureCount++;
                }
            }
        });

        return {
            success: successCount,
            failed: failureCount,
            total: this.clients.size
        };
    }

    getClientInfo(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return null;

        return {
            ...client.info,
            readyState: client.ws.readyState,
            protocol: client.ws.protocol,
            bufferedAmount: client.ws.bufferedAmount
        };
    }

    getConnectedClients() {
        return Array.from(this.clients.entries()).map(([clientId, client]) => ({
            clientId,
            ...this.getClientInfo(clientId)
        }));
    }

    getServerStats() {
        return {
            clientCount: this.clients.size,
            uptime: this.wss ? process.uptime() : 0,
            port: this.config.port,
            path: this.config.path,
            isRunning: WebSocketServerClass.isServerRunning()
        };
    }

    closeConnection(clientId, code = 1000, reason = "") {
        const client = this.clients.get(clientId);
        if (client) {
            try {
                client.ws.close(code, reason);
                this.handleDisconnection(clientId);
                return true;
            } catch (error) {
                this.emit("close_error", {
                    clientId,
                    error
                });
                return false;
            }
        }
        return false;
    }

    close() {
        this.clients.forEach((client, clientId) => {
            this.closeConnection(clientId, 1000, "Server shutting down");
        });

        if (this.wss) {
            this.wss.close(() => {
                WebSocketServerClass.wss = null;
                WebSocketServerClass.instance = null;
                this.emit("server_closed");
            });
        }
    }
}

module.exports = WebSocketServerClass;
