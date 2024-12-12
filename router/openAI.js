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
  ellaFamilyController,
  ellaEmotionController,
  NorthController,
  ubiController,
  reportController,
  googleAIController,
} = require("../controller/openAI");

const { loginController } = require("../controller/login");

const {
  postOpenAIEmotionAnalyze,
  postOpenAIPsychologicalAnalysis,
  postOpenAIConsultingPupu,
  postOpenAIConsultingUbi,
  postOpenAIConsultingSoyes,
  postOpenAIConsultingMaru,
  postOpenAIConsultingCustom,
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
  postOpenAIEllaFamilyTraning,
  postOpenAIFamilyDataSave,
  postOpenAIFamilyDataLoad,
  postOpenAIFamilyTrainingDataLoad,
  postOpenAIFamilyDiaryDataDelete,
} = ellaFamilyController;

const {
  postOpenAIEllaAnxietyTraning,
  postOpenAIAnxietyDataSave,
  postOpenAIAnxietyDataLoad,
  postOpenAIAnxietyTrainingDataLoad,
} = ellaAnxietyController;

const {
  postOpenAIEllaEmotionTraning,
  postOpenAIEmotionDataSave,
  postOpenAIEmotionDataLoad,
  postOpenAIEmotionTrainingDataLoad,
} = ellaEmotionController;

const {
  postOpenAIConsultingNorthSave,
  postOpenAIConsultingNorthLoad,
  postOpenAIConsultingNorthDelete,
} = NorthController;

const {
  postOpenAIUbiMeditationRecomend,
  postOpenAIUbiMeditationRecomendRenewl,
} = ubiController;

const { postReportTest } = reportController;

const { postGoogleAIConsultingPupu } = googleAIController;

// 토큰 유효성 검사 미들웨어
const { vaildateTokenConsulting, vaildateUserSubscriptionAuth } =
  loginController;

router.get("/", (req, res) => {
  res.send("Welcome to the GPT API");
});

// GoogleAI Test
router.post("/googleAI/pupu", postGoogleAIConsultingPupu);

// 감정 분석
router.post("/emotion", postOpenAIEmotionAnalyze);

// EBT 결과 분석
router.post(
  "/analysis",
  vaildateTokenConsulting,
  postOpenAIPsychologicalAnalysis
);

// EBT 결과(11종) 데이터 반환
router.post(
  "/ebtresult",
  vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIUserEBTResultData
);

// PT 결과 Save
router.post(
  "/analysis_pt",
  vaildateTokenConsulting,
  postOpenAIPernalTestAnalysis
);

// 공감친구 모델 - 푸푸
router.post(
  "/consulting_emotion_pupu",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIConsultingPupu
);

// 공감친구 모델 - 푸푸 (테스트용 미들웨어 제거)
router.post(
  "/test/consulting_emotion_pupu",
  // vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIConsultingPupu
);

// 공부친구 모델 - 우비
router.post(
  "/consulting_emotion_ubi",
  vaildateTokenConsulting,
  postOpenAIConsultingUbi
);

// 명상추천 모델 - 우비
router.post(
  "/meditation_recomend_ubi",
  vaildateTokenConsulting,
  postOpenAIUbiMeditationRecomend
);

// 명상추천 모델 - 우비 (renewl)
router.post(
  "/meditation_recomend_ubi/renewl",
  // vaildateTokenConsulting,
  postOpenAIUbiMeditationRecomendRenewl
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

// 커스텀 모델
router.post(
  "/consulting_emotion_custom",
  vaildateTokenConsulting,
  postOpenAIConsultingCustom
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
  vaildateTokenConsulting,
  postOpenAIConsultingNorthLoad
);

// 북극이 데이터 Delete
router.post(
  "/north_delete",
  vaildateTokenConsulting,
  postOpenAIConsultingNorthDelete
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
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIEllaMoodTraning
);
// 기분훈련 데이터 Save
router.post(
  "/training_mood_ella/save",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIMoodDataSave
);
// 기분훈련 시작 데이터 Load
router.post(
  "/training_mood_ella/load",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIMoodDataLoad
);
// 기분훈련 보고서 데이터 Load
router.post(
  "/training_mood_ella/load/training",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIMoodTrainingDataLoad
);

// 불안훈련 모델 - 엘라
router.post(
  "/training_anxiety_ella",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIEllaAnxietyTraning
);
// 불안훈련 데이터 Save
router.post(
  "/training_anxiety_ella/save",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIAnxietyDataSave
);
// 불안훈련 시작 데이터 Load
router.post(
  "/training_anxiety_ella/load",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIAnxietyDataLoad
);
// 불안훈련 보고서 데이터 Load
router.post(
  "/training_anxiety_ella/load/training",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIAnxietyTrainingDataLoad
);

// 또래관계 훈련 모델 - 엘라
router.post(
  "/training_friend_ella",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIEllaFriendTraning
);
// 또래관계 훈련 데이터 Save
router.post(
  "/training_friend_ella/save",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIFriendDataSave
);
// 또래관계 훈련 보고서 데이터 Load
router.post(
  "/training_friend_ella/load/training",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIFriendTrainingDataLoad
);

// 가족관계 훈련 모델 - 엘라
router.post(
  "/training_family_ella",
  vaildateTokenConsulting,
  postOpenAIEllaFamilyTraning
);
// 가족관계 훈련 데이터 Save
router.post(
  "/training_family_ella/save",
  vaildateTokenConsulting,
  postOpenAIFamilyDataSave
);
// 가족관계 사전만들기 데이터 Load
router.post(
  "/training_family_ella/load",
  vaildateTokenConsulting,
  postOpenAIFamilyDataLoad
);
// 가족관계 훈련 보고서 데이터 Load
router.post(
  "/training_family_ella/load/training",
  vaildateTokenConsulting,
  postOpenAIFamilyTrainingDataLoad
);
// 가족관계 사전 데이터 Delete
router.post(
  "/training_family_ella/delete/diary",
  vaildateTokenConsulting,
  postOpenAIFamilyDiaryDataDelete
);

// 정서인식 훈련 모델 - 엘라
router.post(
  "/training_emotion_ella",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIEllaEmotionTraning
);

// 정서인식 훈련 데이터 Save
router.post(
  "/training_emotion_ella/save",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIEmotionDataSave
);

// 정서인식 훈련 시작 데이터 Load
router.post(
  "/training_emotion_ella/load",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIEmotionDataLoad
);

// 정서인식 훈련 보고서 데이터 Load
router.post(
  "/training_emotion_ella/load/training",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIEmotionTrainingDataLoad
);

// 결과보고서 PDF 이메일 발송
router.post(
  "/report",
  vaildateTokenConsulting,
  vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postReportTest
);

// 달력 데이터 반환
router.post("/calendar", vaildateTokenConsulting, postOpenAIMypageCalendarData);
// 마이페이지 데이터 반환
router.post("/mypage", vaildateTokenConsulting, postOpenAIMypageData);

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
