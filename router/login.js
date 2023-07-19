// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { loginController } = require("../controller/index");
const { loginHandler } = loginController;

router.get("/", loginHandler("get"));

router.post("/", loginHandler("post"));

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
