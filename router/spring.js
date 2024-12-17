// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { errController } = require("../controller/index");

const {
  ellaMoodController,
  ellaAnxietyController,
  ellaEmotionController,
} = require("../controller/openAI");

const { springEllaMoodController } = require("../controller/spring");

const { loginController } = require("../controller/login");

const {
  postOpenAIEllaMoodTraning,
  // postOpenAIMoodDataSave,
  // postOpenAIMoodDataLoad,
  postOpenAIMoodTrainingDataLoad,
} = ellaMoodController;

const { postOpenAIMoodDataSave, postOpenAIMoodDataLoad } =
  springEllaMoodController;

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

// 토큰 유효성 검사 미들웨어
const { vaildateTokenConsulting, vaildateUserSubscriptionAuth } =
  loginController;

router.get("/", (req, res) => {
  res.send("Welcome to the GPT API");
});

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
  // vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIMoodDataSave
);
// 기분훈련 시작 데이터 Load
router.post(
  "/training_mood_ella/load",
  // vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
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

// 에러 메세지 처리
router.use(errController.errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
