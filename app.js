// app은 기본 express() 인스턴스 생성.
const express = require("express");
const app = express();
const port = 3000;

// cors에러 처리.
// default는 모든 origin에 대해 허용 -> { origin:'*' } 파라미터 생략 가능.
const cors = require("cors");
app.use(cors({ origin: "*" }));

// 라우팅 모듈을 가져와 app.use() 시킬 수 있다.
const pathRouter = require("./router/path");
app.use("/path", pathRouter);

app.get("/", (req, res) => {
  // send: json 형식으로 변환 후 전송
  res.send({ text: "Hello World!" });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
