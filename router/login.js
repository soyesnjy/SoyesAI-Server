// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { loginController } = require("../controller/index");
const {
  vaildateCookies,
  CookieLoginHandler,
  CookieLogoutHandler,
  vaildateSession,
  sessionLoginHandler,
  sessionLogoutHandler,
} = loginController;

// post 요청 처리. body 데이터 처리.
router.post("/", vaildateSession, sessionLoginHandler);

// get + /logout 요청 처리. login 쿠키 및 세션을 삭제시킨다.
router.get("/logout", sessionLogoutHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
