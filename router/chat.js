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

// 로그인 관련 정보 저장
const login_ids = {}; // { clientId : socketId }
const rooms = {}; // { roomId : 방장id }

// 소켓 연결 이벤트. 연결 발생 시 콜백 실행
io.on("connection", (socket) => {
  console.log("연결 완료");
  // login 이벤트
  socket.on("login", (data) => {
    // 현재 접속한 클라이언트의 id와 해당 소켓의 id를 저장
    login_ids[data.id] = socket.id;
    socket.login_id = data.id;
  }); 
  // logout 이벤트
  socket.on("logout", (data) => {
    // 현재 접속한 클라이언트의 id에 해당하는 socketId를 삭제
    delete login_ids[data.id];
    console.log(login_ids);
  });

  socket.on("createRoom", (data) => {
    console.log('createRoom', data); // data = { roomId, leaderId }
    const { roomId, leaderId } = data;
    if (!leaderId) {
      console.log("Login 해주세요");
    }
    // 방을 만든 적이 없는 경우
    else if (!Ojbect.values(rooms).find((id) => id === leaderId)) {
      socket.join(roomId); // 방 생성
      rooms[roomId] = leaderId;

      io.emit("room", rooms);
    } else console.log("이미 방을 만든 사람입니다");
  });

  socket.on("deleteRoom", (data) => {
    console.log('deleteRoom', data); // data = { roomId, leaderId }
    const { roomId, leaderId } = data;

    // 방장인 경우
    if (rooms[roomId] === leaderId) {
      socket.leave(roomId); // 방 떠나기
      delete rooms[roomId]; // 방 삭제

      io.to(data.roomId).leaveAll;
      io.emit("leaveRoom", data);
      io.emit("room", rooms);
    } else console.log("방장이 아니라 삭제 불가");
  });

  // 채팅방 참가 
  socket.on("joinRoom", (data) => {
    console.log('joinRoom', data); // data = { roomId }
    const { roomId } = data;

    socket.join(roomId);
    socket.emit("joinRoom", data);
  });

  socket.on("leaveRoom", (data) => {
    console.log('leaveRoom', data);

    const { roomId } = data;

    socket.leave(roomId);
    socket.emit("leaveRoom", data);
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

  socket.on("groupMsg", (data) => {
    // 그룹 메세지 전송
    console.log('groupMsg', data); // data = { roomId, nickname, date, msg}
    io.to(data.roomId).emit("groupMsg", data);
  });
});

// 소켓 서버 실행. (app.js의 app과 다른 서버이므로 따로 실행해야한다)
server.listen(port, () => {
  console.log(`Socket server listening on port ${port}`);
});

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
