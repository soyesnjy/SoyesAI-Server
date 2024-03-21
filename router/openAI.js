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
  postOpenAIEmotionTestResultConsultingV5,
  postOpenAIEmotionTestResultConsultingV6,
  postOpenAITestResultConsultingV1,
  postOpenAIMypageCalendarData,
} = openAIController;

router.get("/", (req, res) => {
  res.send("Welcome to the Coding Nexus API");
});

router.post("/message", postOpenAIChattingNew);
router.post("/emotion", postOpenAIEmotionAnalyze);

router.post("/consulting_emotion", postOpenAIEmotionTestResultConsulting);
router.post("/consulting_emotion_v2", postOpenAIEmotionTestResultConsultingV2);

// 공감친구 모델 - 푸푸
router.post(
  "/consulting_emotion_pupu",
  postOpenAIEmotionTestResultConsultingV3
);

// 정서멘토 모델 - 라라
router.post(
  "/consulting_emotion_lala",
  postOpenAIEmotionTestResultConsultingV4
);

// 공부친구 모델 - 우비
router.post("/consulting_emotion_ubi", postOpenAIEmotionTestResultConsultingV5);

// 전문상담사 모델 - 소예
router.post(
  "/consulting_emotion_soyes",
  postOpenAIEmotionTestResultConsultingV6
);

// router.post("/consulting_lala", postOpenAITestResultConsultingV1);
// router.post("/consulting_persnal", postOpenAIPersnalTestResultConsulting);

router.post("/analysis", postOpenAIPsychologicalAnalysis);

router.post("/calendar", postOpenAIMypageCalendarData);

// 에러 메세지 처리
router.use(errController.errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
