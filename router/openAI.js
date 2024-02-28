// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { errController } = require("../controller/index");
const { openAIController } = require("../controller/index");

const {
  postOpenAIChattingNew,
  postOpenAIEmotionAnalyze,
  postOpenAIEmotionTestResultConsulting,
  postOpenAIPsychologicalAnalysis,
  postOpenAIPersnalTestResultConsulting,
  postOpenAIEmotionTestResultConsultingV2,
  postOpenAIEmotionTestResultConsultingV3,
  postOpenAIEmotionTestResultConsultingV4,
} = openAIController;

router.get("/", (req, res) => {
  res.send("Welcome to the Coding Nexus API");
});

router.post("/message", postOpenAIChattingNew); // postOpenAIChattingNew
router.post("/emotion", postOpenAIEmotionAnalyze);
router.post("/consulting_emotion", postOpenAIEmotionTestResultConsulting);
router.post("/consulting_emotion_v2", postOpenAIEmotionTestResultConsultingV2);
router.post("/consulting_emotion_v3", postOpenAIEmotionTestResultConsultingV3);
router.post("/consulting_emotion_v4", postOpenAIEmotionTestResultConsultingV4);
router.post("/consulting_persnal", postOpenAIPersnalTestResultConsulting);
router.post("/analysis", postOpenAIPsychologicalAnalysis);

// 에러 메세지 처리
router.use(errController.errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
