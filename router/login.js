// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { errController } = require("../controller/index");
const { loginController } = require("../controller/index");
const {
  // 쿠키
  vaildateCookies,
  CookieLoginHandler,
  CookieLogoutHandler,
  // 세션
  vaildateSession,
  sessionLoginHandler,
  sessionLogoutHandler,
  // 토큰
  vaildateToken,
  tokenLoginHandler,
  tokenLogoutHandler,
  // 유저 정보
  getUserHandler,
  postUsersHandler,
  postUserHandler,
  postTeacherHandler,
} = loginController;

// 쿠키
// router.post("/", vaildateCookies, CookieLoginHandler);
// router.get("/logout", CookieLogoutHandler);

// 세션
// router.post("/", vaildateSession, sessionLoginHandler);
// router.get("/logout", sessionLogoutHandler);

// 토큰
router.post("/", tokenLoginHandler);
router.get("/logout", tokenLogoutHandler);

// 유저 정보 반환
router.get("/getUser", getUserHandler);
// 조건부 선생 정보 반환
router.post("/postUsers", postUsersHandler);
// 조건부 유저 정보 반환
router.post("/postUser", postUserHandler);
// 조건부 선생 정보 반환
router.post("/postTeacher", postTeacherHandler);

// 에러 메세지 처리
router.use(errController.errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
