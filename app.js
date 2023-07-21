// app은 기본 express() 인스턴스 생성.
const express = require("express");
const app = express();
const port = 4000;

// 서버와 동일한 url을 브라우저에 입력하면 src 폴더 내부의 html 파일 실행.
const path = require("path");
app.use(express.static(path.join(__dirname, "src")));

// cookie-parser 추가.
const cookieParser = require("cookie-parser");
app.use(cookieParser());

// cors에러 처리. default는 모든 origin에 대해 허용 -> { origin:'*' } 파라미터 생략 가능.
const cors = require("cors");
app.use(
  cors({
    origin: ["http://127.0.0.1:5500", "http://localhost:4000"],
    methods: ["GET", "POST", "OPTION", "PUT", "PATCH"],
    credentials: true,
  })
);

// BodyParser 추가. post, put 요청의 req.body 구문 해석 기능 제공.
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.send({ text: "Hello World!" });
});

// 라우팅 모듈을 가져와 app.use() 시킬 수 있다
// path 경로 라우팅
const pathRouter = require("./router/path");
app.use("/path", pathRouter);

// error 경로 라우팅
const errorRouter = require("./router/error");
app.use("/error", errorRouter);

// login 경로 라우팅
const loginRouter = require("./router/login");
app.use("/login", loginRouter);

// 채팅 웹소켓 서버 라우팅
const chatRouter = require("./router/chat");
app.use(chatRouter);

// 에러 처리는 일반적인 미들웨어 함수와 동일하게 적용 가능하다.
const { errController } = require("./controller/index");
app.use(errController.logErrors);
app.use(errController.clientErrorHandler);
app.use(errController.univErrorHandler);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
