// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { errController } = require("../controller/index");
// const { openAIController } = require("../controller/index");
const {
  openAIController,
  openAIController_Regercy, // 레거시 코드
} = require("../controller/openAI");

const { loginController } = require("../controller/login");

const {
  postOpenAIEmotionAnalyze,
  postOpenAIPsychologicalAnalysis,
  postOpenAIConsultingPupu,
  postOpenAIConsultingUbi,
  postOpenAIConsultingLala,
  postOpenAIConsultingSoyes,
  postOpenAIMypageCalendarData,
  postClovaVoiceTTS,
  postOpenAIPernalTestAnalysis,
  getClearCookies,
  postOpenAIConsultingLogSave,
} = openAIController;

// 토큰 유효성 검사 미들웨어
const { vaildateTokenConsulting, vaildatePlan } = loginController;

router.get("/", (req, res) => {
  res.send("Welcome to the GPT API");
});
// 쿠키 삭제
router.get("/clear_cookies", getClearCookies);
// 감정 분석
router.post("/emotion", postOpenAIEmotionAnalyze);
// 공감친구 모델 - 푸푸
router.post(
  "/consulting_emotion_pupu",
  vaildateTokenConsulting,
  vaildatePlan,
  postOpenAIConsultingPupu
);
// 공부친구 모델 - 우비
router.post("/consulting_emotion_ubi", postOpenAIConsultingUbi);
// 정서멘토 모델 - 라라
router.post("/consulting_emotion_lala", postOpenAIConsultingLala);
// 전문상담사 모델 - 소예
router.post("/consulting_emotion_soyes", postOpenAIConsultingSoyes);
// 상담 내역 저장
router.post("/consulting_emotion_log", postOpenAIConsultingLogSave);

// EBT 결과 분석
router.post("/analysis", postOpenAIPsychologicalAnalysis);
// PT 결과 분석
router.post("/analysis_pt", postOpenAIPernalTestAnalysis);

// 달력 데이터 반환
router.post("/calendar", postOpenAIMypageCalendarData);
// Clova Voice Data 반환
router.post("/tts", postClovaVoiceTTS);

// 에러 메세지 처리
router.use(errController.errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
