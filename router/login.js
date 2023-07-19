// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { loginController } = require("../controller/index");
const { loginHandler } = loginController;

// get 요청 처리. query 데이터 처리.
router.get("/", loginHandler("get"));
// post 요청 처리. body 데이터 처리.
router.post("/", loginHandler("post"));

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
