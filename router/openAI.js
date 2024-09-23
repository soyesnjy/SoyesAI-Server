// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { errController } = require("../controller/index");
// const { openAIController } = require("../controller/index");
const {
  openAIController,
  ellaMoodController,
  ellaFriendController,
  ellaAnxietyController,
  NorthController,
  // openAIController_Regercy, // 레거시 코드
} = require("../controller/openAI");

const { loginController } = require("../controller/login");

const {
  postOpenAIEmotionAnalyze,
  postOpenAIPsychologicalAnalysis,
  postOpenAIConsultingPupu,
  postOpenAIConsultingUbi,
  postOpenAIConsultingSoyes,
  postOpenAIConsultingMaru,
  postOpenAIMypageCalendarData,
  postClovaVoiceTTS,
  postOpenAIPernalTestAnalysis,
  getClearCookies,
  postOpenAIConsultingLogSave,
  postOpenAIConsultingLogLoad,
  postOpenAIUserEBTResultData,
  getYoutubeContent,
  postOpenAIConsultSolutionData,
  postOpenAIGoogleDriveUpload,
  postOpenAIMypageData,
} = openAIController;

const {
  postOpenAIEllaMoodTraning,
  postOpenAIMoodDataSave,
  postOpenAIMoodDataLoad,
  postOpenAIMoodTrainingDataLoad,
} = ellaMoodController;

const {
  postOpenAIEllaFriendTraning,
  postOpenAIFriendDataSave,
  postOpenAIFriendTrainingDataLoad,
} = ellaFriendController;

const {
  postOpenAIEllaAnxietyTraning,
  postOpenAIAnxietyDataSave,
  postOpenAIAnxietyDataLoad,
  postOpenAIAnxietyTrainingDataLoad,
} = ellaAnxietyController;

const { postOpenAIConsultingNorthSave, postOpenAIConsultingNorthLoad } =
  NorthController;

// 토큰 유효성 검사 미들웨어
const { vaildateTokenConsulting, vaildatePlan } = loginController;

router.get("/", (req, res) => {
  res.send("Welcome to the GPT API");
});
// 감정 분석
router.post("/emotion", postOpenAIEmotionAnalyze);

// EBT 결과 분석
router.post(
  "/analysis",
  vaildateTokenConsulting,
  postOpenAIPsychologicalAnalysis
);
// PT 결과 분석
router.post(
  "/analysis_pt",
  vaildateTokenConsulting,
  postOpenAIPernalTestAnalysis
);

// 공감친구 모델 - 푸푸
router.post(
  "/consulting_emotion_pupu",
  vaildateTokenConsulting,
  // vaildatePlan,
  postOpenAIConsultingPupu
);
// 공부친구 모델 - 우비
router.post(
  "/consulting_emotion_ubi",
  vaildateTokenConsulting,
  postOpenAIConsultingUbi
);

// 전문상담사 모델 - 소예
router.post(
  "/consulting_emotion_soyes",
  vaildateTokenConsulting,
  postOpenAIConsultingSoyes
);

// 게임친구 모델 - 마루
router.post(
  "/consulting_emotion_maru",
  vaildateTokenConsulting,
  postOpenAIConsultingMaru
);

// 북극이 데이터 Save
router.post(
  "/north_save",
  vaildateTokenConsulting,
  postOpenAIConsultingNorthSave
);

// 북극이 데이터 Load
router.post(
  "/north_load",
  // vaildateTokenConsulting,
  postOpenAIConsultingNorthLoad
);

// 상담 내역 Save
router.post(
  "/consulting_emotion_log",
  vaildateTokenConsulting,
  postOpenAIConsultingLogSave
);

// 상담 내역 Load
router.post(
  "/consulting_emotion_log_load",
  vaildateTokenConsulting,
  postOpenAIConsultingLogLoad
);

// 기분훈련 모델 - 엘라
router.post(
  "/training_mood_ella",
  vaildateTokenConsulting,
  postOpenAIEllaMoodTraning
);
// 기분훈련 데이터 Save
router.post(
  "/training_mood_ella/save",
  vaildateTokenConsulting,
  postOpenAIMoodDataSave
);
// 기분훈련 시작 데이터 Load
router.post(
  "/training_mood_ella/load",
  vaildateTokenConsulting,
  postOpenAIMoodDataLoad
);
// 기분훈련 보고서 데이터 Load
router.post(
  "/training_mood_ella/load/training",
  vaildateTokenConsulting,
  postOpenAIMoodTrainingDataLoad
);

// 또래관계 훈련 모델 - 엘라
router.post(
  "/training_friend_ella",
  vaildateTokenConsulting,
  postOpenAIEllaFriendTraning
);
// 또래관계 훈련 데이터 Save
router.post(
  "/training_friend_ella/save",
  vaildateTokenConsulting,
  postOpenAIFriendDataSave
);
// 또래관계 훈련 보고서 데이터 Load
router.post(
  "/training_friend_ella/load/training",
  vaildateTokenConsulting,
  postOpenAIFriendTrainingDataLoad
);

// 불안훈련 모델 - 엘라
router.post(
  "/training_anxiety_ella",
  vaildateTokenConsulting,
  postOpenAIEllaAnxietyTraning
);
// 불안훈련 데이터 Save
router.post(
  "/training_anxiety_ella/save",
  // vaildateTokenConsulting,
  postOpenAIAnxietyDataSave
);
// 불안훈련 시작 데이터 Load
router.post(
  "/training_anxiety_ella/load",
  // vaildateTokenConsulting,
  postOpenAIAnxietyDataLoad
);

// 달력 데이터 반환
router.post("/calendar", vaildateTokenConsulting, postOpenAIMypageCalendarData);
// 마이페이지 데이터 반환
router.post("/mypage", vaildateTokenConsulting, postOpenAIMypageData);
// User EBT 결과(11종) 데이터 반환
router.post("/ebtresult", vaildateTokenConsulting, postOpenAIUserEBTResultData);

// 상담 solution 반환
router.post(
  "/solution",
  vaildateTokenConsulting,
  postOpenAIConsultSolutionData
);

// Clova Voice Data 반환
router.post("/tts", postClovaVoiceTTS);
// Youtube Video 반환
router.get("/youtube/:id", getYoutubeContent);
// 쿠키 삭제
router.get("/clear_cookies", getClearCookies);
// 이미지 업로드 (Google Drive)
router.post("/upload", postOpenAIGoogleDriveUpload);

// 에러 메세지 처리
router.use(errController.errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
