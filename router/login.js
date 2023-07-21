// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { loginController } = require("../controller/index");
const { loginHandler, logoutHandler } = loginController;
const { users } = require("../DB/database");

// 쿠키 처리 함수 생성
const vaildateCookies = (req, res, next) => {
  const { cookies } = req;

  if ("login" in cookies) {
    if (cookies.login === "true") {
      // 쿠키가 있는 동안
      res.json("Cookie Login Success");
    }
  } else next();
};

// get 요청 처리. query 데이터 처리.
// router.get("/", loginHandler("get"));

// post 요청 처리. body 데이터 처리.
router.post("/", vaildateCookies, loginHandler("post"));

// get /logout 요청 처리. login 쿠키를 삭제시킨다.
router.get("/logout", logoutHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
