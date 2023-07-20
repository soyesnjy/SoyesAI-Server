const express = require("express");
const http = require("http");

const router = express.Router();
const server = http.createServer(router);
const socketIO = require("socket.io");
const port = 4001;
const io = socketIO(server, {
  // 소켓 cors 처리
  cors: {
    // path를 제외한 host만 적어야 함.
    origin: "http://127.0.0.1:5500",
  },
});

io.on("connection", (socket) => {
  console.log("연결 완료");

  socket.on("msg", (data) => {
    io.emit("msg", data);
  });
});

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
