const WebSocketServerClass = require("web-socket-server");

try {
    const wss = new WebSocketServerClass("outputNode", {
        port: 1861,
        path: `/websocket`
    });

    wss.on('server_started', (info) => {
        console.log({ fill: "green", shape: "dot", text: `Server running on port ${info.port}` });
    });

    wss.on('server_reused', (info) => {
        console.log({ fill: "green", shape: "dot", text: `Reused server on port ${info.port}` });
    });

    wss.on('client_connected', ({ clientId, ip }) => {
        console.log(`New client connected: ${clientId} from ${ip}`);
        console.log({ fill: "green", shape: "dot", text: `Connected clients: ${wss.getConnectedClients().length}` });
    });

    wss.on('client_disconnected', ({ clientId }) => {
        console.log(`Client disconnected: ${clientId}`);
        console.log({ fill: "green", shape: "dot", text: `Connected clients: ${wss.getConnectedClients().length}` });
    });

    wss.on('message_received', ({ clientId, event, payload }) => {
        console.log(`Received ${event} from ${clientId}: ${JSON.stringify(payload)}`);
    });

    wss.on('client_event_chat', ({ clientId, payload, reply }) => {
        console.log(`Chat message from ${clientId}: ${JSON.stringify(payload)}`);

        reply({ status: 'received', timestamp: new Date().toISOString() });
        const broadcastResult = wss.broadcast('chat', payload, clientId);
        console.log(`Broadcast results: ${JSON.stringify(broadcastResult)}`);

        console.log({
            payload: payload,
            clientId: clientId,
            type: 'chat',
            timestamp: new Date().toISOString()
        });
    });

    wss.on('server_error', (error) => {
        console.log('WebSocket server error:', error);
        console.log({ fill: "red", shape: "ring", text: "Server error" });
    });

    wss.on('client_error', ({ clientId, error }) => {
        console.log(`Error from client ${clientId}:`, error);
    });

    wss.on('send_error', ({ clientId, event, error }) => {
        console.log(`Error sending ${event} to client ${clientId}:`, error);
    });

    node.on("input", function (msg) {
        try {

            const event = `node_${node.id}`;
            const payload = msg;

            const broadcastResult = wss.broadcast(event, payload);

            console.log({
                ...msg,
                broadcastResult,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.log('Error processing input message:', error);
            console.log({ fill: "red", shape: "ring", text: "Send error" });
        }
    });

    node.on("close", function (done) {
        try {
            node.context().set("outputMsgObj", null);
            const stats = wss.getServerStats();
            if (stats.clientCount > 0) {
                const clients = wss.getConnectedClients();
                clients.forEach(client => {
                    wss.closeConnection(client.clientId, 1000, "Node shutting down");
                });
            }

            done();
        } catch (error) {
            console.log('Error during cleanup:', error);
            done();
        }
    });

} catch (error) {
    console.log('Error initializing WebSocket node:', error);
    console.log({ fill: "red", shape: "ring", text: "Initialization error" });
}

