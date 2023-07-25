const express = require("express");
const http = require("http");

const router = express.Router();
const server = http.createServer(router);
const socketIO = require("socket.io");
const port = 4001;
const io = socketIO(server, {
  // 소켓 서버 cors 처리. 소켓 서버도 서버이므로 따로 cors 처리를 해야함.
  cors: { origin: "*" },
});
const login_ids = {}; // { clientId : socketId }
// 소켓 연결 이벤트. 연결 발생 시 콜백 실행
io.on("connection", (socket) => {
  console.log("연결 완료");
  // login 이벤트
  socket.on("login", (data) => {
    // 현재 접속한 클라이언트의 id와 해당 소켓의 id를 저장
    login_ids[data.id] = socket.id;
    socket.login_id = data.id;
    console.log(login_ids);
  });
  // logout 이벤트
  socket.on("logout", (data) => {
    // 현재 접속한 클라이언트의 id에 해당하는 socketId를 삭제
    delete login_ids[data.id];
    console.log(login_ids);
  });

  socket.on("msg", (data) => {
    // 소켓에 연결된 모든 client에게 msg 트리거를 발생시키고 data를 전달.
    console.log(data);
    io.emit("msg", data);
  });

  socket.on("privateMsg", (data) => {
    // 1:1 메세지 전송
    const receiverSocketId = login_ids[data.receiverId];
    if (receiverSocketId) {
      socket.emit("privateMsg", data); // 나한테 보내기
      io.to(receiverSocketId).emit("privateMsg", data); // 상대에게 보내기
    } else {
      console.log("Null ReceiverId");
    }
  });

  // socket.on("groupeMsg", (data) => {
  //   // 그룹 메세지 전송
  //   console.log(data);
  // });
});

// 소켓 서버 실행. (app.js의 app과 다른 서버이므로 따로 실행해야한다)
server.listen(port, () => {
  console.log(`Socket server listening on port ${port}`);
});

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
