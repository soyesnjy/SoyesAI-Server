const express = require("express");
const router = express.Router();

const WebSocket = require("ws");
const port = 4002;

const wss = new WebSocket.Server({ port });

wss.on("connection", function connection(ws) {
  console.log("Unity 연결 완료");

  ws.on("message", (data) => {
    ws.send(data.toString());
  });
});

wss.on("listening", () => {
  console.log(`Unity Socket server listening on port ${port}`);
});

module.exports = router;
