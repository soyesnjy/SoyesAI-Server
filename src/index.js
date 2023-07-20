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
