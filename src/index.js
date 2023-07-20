"use strict";
const END_POINT = "http://localhost:4000";

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
  console.log(id, pwd);
  fetch(`http://localhost:4000/login`, {
    method: "POST",
    // content-type을 명시하지 않으면 json 파일인지 인식하지 못함
    headers: {
      "Content-Type": "application/json",
    },
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

// 소켓 연결
const socket = io(END_POINT);

// 소켓 서버 메시지 receive
socket.on("msg", (data) => {
  const { nickname, msg, time } = data;
  const wrapper = document.querySelector(".wrapper");
  const $chatting = document.createElement("div");
  // 다른 사용자의 메시지일 경우 색상 변경
  const myName = document.querySelector("#nickname").value;
  if (nickname !== myName) $chatting.style.color = "red";

  $chatting.innerText = `${nickname}: ${msg} (${time})`;
  wrapper.appendChild($chatting);
});

// 소켓 서버 메시지 send
const msgHandler = () => {
  const msg = document.querySelector("#chat").value;
  if (msg) {
    const nickname = document.querySelector("#nickname").value;
    const date = new Date();
    const time = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    socket.emit("msg", {
      nickname,
      msg,
      time,
    });
    document.querySelector("#chat").value = "";
  }
};
