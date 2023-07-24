"use strict";
const END_POINT = "http://localhost:4001";

const submitHandler = () => {
  const name = document.querySelector("#name").value;
  fetch(`http://localhost:4000/path/sound/${name}`)
    .then((res) => res.json())
    .then((data) => {
      document.querySelector("#board").innerHTML = data.sound;
    });
};

const errorHandler = (flag) => {
  fetch(`http://localhost:4000/error/${flag}`)
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
      document.querySelector("#board2").innerHTML = data;
    });
};

const loginHandler = () => {
  const id = document.querySelector("#id").value;
  const pwd = document.querySelector("#pwd").value;

  fetch(`http://localhost:4000/login`, {
    method: "POST",
    // content-type을 명시하지 않으면 json 파일인지 인식하지 못함
    headers: {
      "Content-Type": "application/json",
      // Authorization: document.cookies.accessToken,
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
      console.log(data);
      document.querySelector("#board3").innerHTML = data;
    });
};

const logoutHandler = () => {
  fetch(`http://localhost:4000/login/logout`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
      document.querySelector("#board3").innerHTML = data;
    });
};

// 소켓 연결
const socket = io.connect(END_POINT);

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
      nickname,
      msg,
      time,
    });

    // 채팅 메시지 input 초기화
    document.querySelector("#chat").value = "";
  }
};
