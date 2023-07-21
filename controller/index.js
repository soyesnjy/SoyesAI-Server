const pathController = {
  default: (req, res) => {
    res.send("path1 default access");
  },
  first: (req, res) => {
    res.send("path1 first access");
  },
  second: (req, res) => {
    res.send("path1 second access");
  },
  // parameter 사용법
  params: (req, res) => {
    const p = req.params;
    // { key(:변수명): value(요청 입력값) }
    res.send(p);
  },
  // query 사용법
  query: (req, res) => {
    const q = req.query;
    // { key:value, key2:value2 }
    res.send(q);
  },
  post: (req, res) => {
    const b = req.body;
    res.send(b);
  },
  // 동물 울음소리 반환 메서드
  sound: (req, res) => {
    const { name } = req.params;
    // name 값에 따라 반환값 분기
    switch (name) {
      case "cat": {
        res.json({ sound: "야옹" });
        break;
      }
      case "dog": {
        res.json({ sound: "멍멍" });
        break;
      }
      default:
        res.json({ sound: "동물이 아닙니다" });
    }
  },
};

const errController = {
  logErrors: (err, req, res, next) => {
    console.error(err.stack);
    // next(err)은 오류 처리 핸들러를 제외한 나머지 모든 핸들러를 건너뛴다.
    // 단, next('route')는 예외.
    next(err);
  },
  clientErrorHandler: (err, req, res, next) => {
    // req.xhr: 요청이 ajax 호출로 시작되었다면 true를 반환.
    if (req.xhr) {
      res.status(500).send({ error: "Something failed!" });
    } else {
      next(err);
    }
  },
  univErrorHandler: (err, req, res, next) => {
    res.status(500);
    res.render("error", { error: err });
  },
  // controller 콜백함수를 받아 try,catch 문으로 next(err)를 실행하는 함수를 반환하는 메서드
  nextErrHandler: (controller) => (req, res, next) => {
    try {
      controller(req, res, next);
    } catch (err) {
      next(err); // 모든 라우터를 건너뛰고 오류 처리 함수로 이동
    }
  },
  // 에러 메세지 반환 메서드
  errMessageHandler: (err, req, res, next) => {
    res.status(400).json(err.message); // 발생된 에러 메세지 반환
  },
};

const session = require("express-session");
const { users } = require("../DB/database");
const loginController = {
  loginHandler: (method) => (req, res) => {
    const { id, pwd } = method === "get" ? req.query : req.body;

    if (users.find((user) => user.id === id && user.pwd === pwd)) {
      // 로그인 성공 시 쿠키 관련 설정 추가. 도메인은 자동으로 현재 서버와 동일하게 적용.
      res.cookie("login", "true", {
        maxAge: 100000, // 쿠키 유효기간
        path: "/", // 서버 라우팅 시 세부 경로
        httpOnly: true, // JS의 쿠키 접근 가능 여부 결정
        secure: true, // sameSite를 none으로 설정하려면 필수
        sameSite: "none", // none으로 설정해야 cross-site 처리가 가능.
      });
      res.json("Login Success");
    } else {
      res.json("Login Fail");
    }
  },

  logoutHandler: (req, res) => {
    res.clearCookie("login", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.json("LogOut Success");
  },

  sessionLoginHandler: (req, res) => {
    const { id, pwd } = req.body;

    if (users.find((user) => user.id === id && user.pwd === pwd)) {
      // 로그인 성공 시 세션 아이디 추가
      req.session.sessionId = id;
      req.session.cookie.maxAge = 10000;
      req.session.save(() => {
        console.log(req.session.sessionId);
        res.json("Login Success");
      });
    } else {
      res.json("Login Fail");
    }
  },
  // 쿠키 유효성 검사
  vaildateCookies: (req, res, next) => {
    const { cookies } = req;

    if ("login" in cookies) {
      if (cookies.login === "true") {
        // 쿠키가 있는 동안
        res.json("Cookie Login Success");
      }
    } else next();
  },
  // 세션 유효성 검사
  vaildateSession: (req, res, next) => {
    console.log(req.session.sessionId);
    if (req.session.sessionId) {
      // 세션이 있는 동안
      res.json("Session Login Success");
    } else next();
  },

  sessionLogoutHandler: (req, res) => {
    req.session.destroy();
    console.log(session);
    res.json("LogOut Success");
  },
};

module.exports = {
  pathController,
  errController,
  loginController,
};
