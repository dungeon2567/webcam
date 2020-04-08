'use strict';

const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');
const path = require('path');
const app = express();
const server = createServer(app);
const cuid = require('cuid');

const wss = new WebSocket.Server({
    server
});

const broadcasting = new Set();

const connections = new Map();

function sendTo(id, message) {
    let ws = connections.get(id);

    if (ws) {
        ws.send(JSON.stringify(message));
    }
}

wss.on('connection', function connection(ws) {
    ws.id = cuid();

    console.log(`${ws.id} connected`);

    ws.sendToAll = function (message) {
        for (const conn of connections.values()) {
            if (conn != ws) {
                conn.send(JSON.stringify(message));
            }
        }
    }

    connections.set(ws.id, ws);

    for (const conn of broadcasting) {
        if (conn != ws) {
            conn.send(JSON.stringify({ t: "watcher.add", id: ws.id }));
        }
    }

    ws.on('message', function incoming(data) {
        const m = JSON.parse(data);

        switch (m.t) {
            case "broadcast.start":
                broadcasting.add(ws);

                for (const conn of connections.values()) {
                    if (conn != ws) {
                        ws.send(JSON.stringify({ t: "watcher.add", id: conn.id }));
                    }
                }

                console.log(`${ws.id} started broadcasting`);
                break;
            case "broadcast.del":
                ws.sendToAll({ t: "watcher.stop", id: ws.id });
                break;
            case "offer":
                console.log(`offer from ${ws.id} to ${m.id}`);
                sendTo(m.id, { t: "offer", id: ws.id, message: m.message });
                break;
            case "answer":
                console.log(`answer from ${ws.id} to ${m.id}`);
                sendTo(m.id, { t: "answer", id: ws.id, message: m.message });
                break;
            case "candidate":
                console.log(`candidate from ${ws.id} to ${m.id}`);
                sendTo(m.id, { t: "candidate", id: ws.id, message: m.message });
                break;
        }
    });

    ws.on('disconnect', function disconnect() {
        ws.sendToAll({ t: "watch.stop", id: ws.id });

        connections.delete(ws.id);

        broadcasting.delete(ws);
    });
});

app.use(express.static(path.join(__dirname, 'public')))

server.listen(8080, function () {
    console.log('Listening on http://localhost:8080');
});