const express = require("express");
const http = require("http");

const router = express.Router();
const server = http.createServer(router);
const socketIO = require("socket.io");
const port = 4001;
const io = socketIO(server, {
  // 소켓 cors 처리
  cors: { origin: "*" },
});
// 소켓 연결 이벤트. 연결 발생 시 콜백 실행
io.on("connection", (socket) => {
  console.log("연결 완료");
  // msg 이벤트.
  socket.on("msg", (data) => {
    // 소켓에 연결된 모든 client에게 msg 트리거를 발생시키고 data를 전달.
    io.emit("msg", data);
  });
});

// 소켓 서버 실행. (app.js의 app과 다른 서버이므로 따로 실행해야한다)
server.listen(port, () => {
  console.log(`Socket server listening on port ${port}`);
});

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
