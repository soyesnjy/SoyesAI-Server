// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { errController } = require("../controller/index");
const { openAIController } = require("../controller/index");

const {
  postOpenAIChattingNew,
  postOpenAIEmotionAnalyze,
  postOpenAIEmotionTestResultConsulting,
} = openAIController;

router.get("/", (req, res) => {
  res.send("Welcome to the Coding Nexus API");
});

router.post("/message", postOpenAIChattingNew);
router.post("/emotion", postOpenAIEmotionAnalyze);
router.post("/consulting", postOpenAIEmotionTestResultConsulting);

// 에러 메세지 처리
router.use(errController.errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
