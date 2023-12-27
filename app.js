// app은 기본 express() 인스턴스 생성.
const express = require("express");
const session = require("express-session");

const app = express();
const PORT = 4000;

// 서버와 동일한 url을 브라우저에 입력하면 src 폴더 내부의 html 파일 실행.
const path = require("path");
app.use(express.static(path.join(__dirname, "src")));

// cors에러 처리. default는 모든 origin에 대해 허용 -> { origin:'*' } 파라미터 생략 가능.
const cors = require("cors");
app.use(
  cors({
    origin: [
      "http://d1rq5xi9hzhyrc.cloudfront.net",
      "http://127.0.0.1:64274",
      "http://localhost:4000",
      "http://localhost:3000",
      "http://soyes.chatbot.s3-website.ap-northeast-2.amazonaws.com",
      "http://soyes.toy.com.s3-website.ap-northeast-2.amazonaws.com",
    ],
    methods: ["GET", "POST", "OPTION"],
    credentials: true,
  })
);

// BodyParser 추가. post, put 요청의 req.body 구문 해석 기능 제공.
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// cookie-parser 추가.
const cookieParser = require("cookie-parser");
app.use(cookieParser("@earthworm"));

// 세션 설정 - Cross-Site 설정 불가능. (secure 이슈)
app.use(
  session({
    secret: "@earthworm",
    resave: false,
    saveUninitialized: true,
    cookie: {
      sameSite: "strict",
      // sameSite: "none",
      // secure: true,
      httpOnly: true,
    },
  })
);
// 1. Cross-Site 접근을 허용하기 위해선 { sameSite: "none", secure: true } 설정이 필요.
// 2. express-session 미들웨어는 { secure: true }일 경우 https 에서만 작동함.
// 3. 도메인이 localhost일 경우도 예외없이 https에서만 작동함.
// 4. 현재 서버와 클라이언트 모두 http에서 작동함으로 { secure: true }를 설정할 수 없음.
// 5. 그렇기에 1번의 Cross-Site 접근을 허용할 수 없고 { sameSite: "strict" }으로 적용할 수 밖에 없음.
// 6. { sameSite: "strict" }일 경우 Same-Site 접근만 가능.
// 7. 현재 설정을 적용하여 localhost 도메인에서만 session이 작동함.

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

// signup 경로 라우팅
const signupRouter = require("./router/signup");
app.use("/signup", signupRouter);

// 채팅 웹소켓 서버 라우팅
const chatRouter = require("./router/chat");
app.use(chatRouter);

// 유니티 채팅 웹소켓 서버 라우팅
const unityChatRouter = require("./router/unityChat");
app.use(unityChatRouter);

// 유니티 채팅 웹소켓 서버 라우팅2
const unityChatRouter2 = require("./router/unityChat2");
app.use(unityChatRouter2);

// 유니티 채팅 웹소켓 서버 라우팅3
const unityChatRouter3 = require("./router/unityChat3");
app.use(unityChatRouter3);

// 유니티 채팅 웹소켓 서버 라우팅4
const unityChatRouter4 = require("./router/unityChat4");
app.use(unityChatRouter4);

// 유니티 채팅 웹소켓 서버 라우팅5
const unityChatRouter5 = require("./router/unityChat5");
app.use(unityChatRouter5);

// test 경로 라우팅
const testRouter = require("./router/test");
app.use("/test", testRouter);

// agoraToken 경로 라우팅
const agoraTokenRouter = require("./router/agoraToken");
app.use("/agoraToken", agoraTokenRouter);

// openAI 경로 라우팅
const openAIRouter = require("./router/openAI");
app.use("/openAI", openAIRouter);

// 에러 처리는 일반적인 미들웨어 함수와 동일하게 적용 가능하다.
// const { errController } = require("./controller/index");
// app.use(errController.logErrors);
// app.use(errController.clientErrorHandler);
// app.use(errController.univErrorHandler);

// app.listen(PORT, () => console.log(`🚀 HTTP Server is starting on ${PORT}`));

const https = require("https");
const fs = require("fs");
let server;
// https 보안 파일이 있을 경우
if (fs.existsSync("./key.pem") && fs.existsSync("./cert.pem")) {
  const privateKey = fs.readFileSync(__dirname + "/key.pem", "utf8");
  const certificate = fs.readFileSync(__dirname + "/cert.pem", "utf8");
  const credentials = {
    key: privateKey,
    cert: certificate,
  };

  server = https.createServer(credentials, app);
  server.listen(PORT, () =>
    console.log(`🚀 HTTPS Server is starting on ${PORT}`)
  );
}
// https 보안 파일이 없을 경우
else {
  app.listen(PORT, () => console.log(`🚀 HTTP Server is starting on ${PORT}`));
}
