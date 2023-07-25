"use strict";
const SERVER_URL = "http://localhost:4000";
const END_POINT = "http://localhost:4001";
// 소켓 연결
const socket = io.connect(END_POINT);
let login_id = "";

const submitHandler = () => {
  const name = document.querySelector("#name").value;
  fetch(`${SERVER_URL}/path/sound/${name}`, {
    headers: {
      "Content-Type": `application/json`,
      "ngrok-skip-browser-warning": "69420",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      document.querySelector("#board").innerHTML = data.sound;
    });
};

const errorHandler = (flag) => {
  fetch(`${SERVER_URL}/error/${flag}`, {
    headers: {
      "Content-Type": `application/json`,
      "ngrok-skip-browser-warning": "69420",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
      document.querySelector("#board2").innerHTML = data;
    });
};

const loginHandler = () => {
  const id = document.querySelector("#id").value;
  const pwd = document.querySelector("#pwd").value;

  fetch(`${SERVER_URL}/login`, {
    method: "POST",
    // content-type을 명시하지 않으면 json 파일인지 인식하지 못함
    headers: {
      "Content-Type": "application/json",
      // Authorization: document.cookies.accessToken,
      "ngrok-skip-browser-warning": "69420",
    },
    // 쿠키 관련 속성
    credentials: "include",
    body: JSON.stringify({
      id,
      pwd,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      document.querySelector("#board3").innerHTML = data;
      if (data === "Login Success") {
        socket.emit("login", { id });
        login_id = id;
      }
    });
};

const logoutHandler = () => {
  fetch(`${SERVER_URL}/login/logout`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "69420",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      document.querySelector("#board3").innerHTML = data;
      socket.emit("logout", { id: login_id });
      login_id = "";
    });
};

// msg 이벤트 등록. 서버의 msg 트리거 발동 시 실행. (receive)
socket.on("msg", (data) => {
  const { nickname, msg, time } = data;
  const wrapper = document.querySelector(".wrapper");
  // div 엘리먼트 생성
  const $chatting = document.createElement("div");
  // 다른 사용자의 메시지일 경우 색상 변경
  const myName = document.querySelector("#nickname").value;
  if (nickname !== myName) $chatting.style.color = "red";

  // div 엘리먼트에 소켓 서버로부터 받은 메시지 입력
  $chatting.innerText = `${nickname}: ${msg} (${time})`;

  // div 엘리먼트를 wrapper의 자식에 추가
  wrapper.appendChild($chatting);
});

socket.on("privateMsg", (data) => {
  const { senderId, nickname, msg, time } = data;
  const wrapper = document.querySelector(".wrapper2");
  const $chatting = document.createElement("div");
  // 다른 사용자의 메시지일 경우 색상 변경
  if (senderId !== login_id) $chatting.style.color = "red";

  // div 엘리먼트에 소켓 서버로부터 받은 메시지 입력
  $chatting.innerText = `${nickname}: ${msg} (${time})`;

  // div 엘리먼트를 wrapper의 자식에 추가
  wrapper.appendChild($chatting);
});

// 메시지 send 핸들러.
const msgHandler = () => {
  const msg = document.querySelector("#chat").value;
  // 채팅 메시지가 있을 경우만 실행
  if (msg) {
    const nickname = document.querySelector("#nickname").value;
    const date = new Date();
    const time = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;

    // 소켓 서버에 msg 트리거 발생 및 데이터 전달.
    socket.emit("msg", {
      id: login_id ? login_id : "default",
      nickname,
      msg,
      time,
    });
    // 채팅 메시지 input 초기화
    document.querySelector("#chat").value = "";
  }
};

// 메시지 send 핸들러.
const msgHandler2 = () => {
  const msg = document.querySelector("#chat2").value;
  // 채팅 메시지가 있을 경우만 실행
  if (msg) {
    const receiverId = document.querySelector("#receiver").value;
    const nickname = document.querySelector("#nickname2").value;
    const date = new Date();
    const time = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;

    // 소켓 서버에 msg 트리거 발생 및 데이터 전달.
    socket.emit("privateMsg", {
      senderId: login_id ? login_id : "default",
      receiverId,
      nickname: login_id ? nickname : "나",
      msg,
      time,
    });
    // 채팅 메시지 input 초기화
    document.querySelector("#chat2").value = "";
  }
};
