// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { errController } = require("../controller/index");
// const { loginController } = require("../controller/index");
const {
  loginController,
  // loginController_Regercy,
} = require("../controller/login");

const {
  // OAuth 소셜 로그인 (App)
  oauthKakaoUrlHandler,
  oauthKakaoRedirectUrlHandler,
  oauthUrlHandler,
  oauthGoogleRedirectUrlHandler,
  // OAuth 소셜 로그인 (WebGL)
  oauthWebGLKakaoUrlHandler,
  oauthWebGLKakaoRedirectUrlHandler,
  oauthWebGLUrlHandler,
  oauthWebGLGoogleRedirectUrlHandler,
  // AI 일반 로그인
  postAIAppleLoginHandler,
  getAILogoutHandler,
  postAIRefreshTokenCertHandler,
  postSocialAppLoginHandler,
  postAIGuestLoginHandler, // Guest Login API
  deleteAIUserDeleteHandler, // 회원 퇄퇴
} = loginController;

// const {
//   // 쿠키
//   vaildateCookies,
//   CookieLoginHandler,
//   CookieLogoutHandler,
//   // 세션
//   vaildateSession,
//   sessionLoginHandler,
//   sessionLogoutHandler,
//   // 유저 정보
//   getUserHandler,
//   postUsersHandler,
//   postUserHandler,
//   postTeacherHandler,
//   // 소셜 로그인 핸들러
//   oauthGoogleAccessTokenHandler,
//   oauthKakaoAccessTokenHandler,
// } = loginController_Regercy;

// 쿠키
// router.post("/", vaildateCookies, CookieLoginHandler);
// router.get("/logout", CookieLogoutHandler);

// 세션
// router.post("/", vaildateSession, sessionLoginHandler);
// router.get("/logout", sessionLogoutHandler);

// 토큰
// router.post("/", tokenLoginHandler);
// router.get("/logout", tokenLogoutHandler);

// 유저 정보 반환
// router.get("/getUser", getUserHandler);
// 조건부 선생 정보 반환
// router.post("/postUsers", postUsersHandler);
// 조건부 유저 정보 반환
// router.post("/postUser", postUserHandler);
// 조건부 선생 정보 반환
// router.post("/postTeacher");

// AI 일반 로그인

// AI Guest 로그인
router.get("/ai/guest", postAIGuestLoginHandler);
// AI 소셜 로그인
router.post("/ai/social", postSocialAppLoginHandler);
// AI 일반 로그아웃
router.get("/ai/logout", getAILogoutHandler);
// AI 회원 탈퇴
router.post("/ai/secession", deleteAIUserDeleteHandler);

// AI RefreshToken 갱신
router.post("/ai/certificationtoken", postAIRefreshTokenCertHandler);

// Google OAuth_url 발급
router.get("/oauth_url/google", oauthUrlHandler);
// Google OAuth Redirect Url
router.get("/oauth_rediret_url/google", oauthGoogleRedirectUrlHandler);

// Kakao OAuth_url 발급
router.get("/oauth_url/kakao", oauthKakaoUrlHandler);
// Kakao OAuth Redirect Url
router.get("/oauth_rediret_url/kakao", oauthKakaoRedirectUrlHandler);

// WebGL Kakao OAuth_url 발급
router.get("/oauth_url/kakao/webgl", oauthWebGLKakaoUrlHandler);
// WebGL Kakao OAuth Redirect Url
router.get("/oauth_rediret_url/kakao/webgl", oauthWebGLKakaoRedirectUrlHandler);

// WebGL OAuth_url 발급
router.get("/oauth_url/google/webgl", oauthWebGLUrlHandler);
// WebGL OAuth Redirect Url
router.get(
  "/oauth_rediret_url/google/webgl",
  oauthWebGLGoogleRedirectUrlHandler
);

// Apple 계정 로그인
router.post("/ai/apple", postAIAppleLoginHandler);

// (Regercy) Google OAuth Approve
// router.post("/oauth_token/google", oauthGoogleAccessTokenHandler);
// (Regercy) Kakao OAuth Approve
// router.post("/oauth_token/kakao", oauthKakaoAccessTokenHandler);

// 에러 메세지 처리
router.use(errController.errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
