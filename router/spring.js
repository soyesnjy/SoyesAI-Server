// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { errController } = require("../controller/index");

const {
  springEllaMoodController,
  springEllaAnxietyController,
  springEllaEmotionController,
} = require("../controller/spring");

const { loginController } = require("../controller/login");

const { postOpenAIMoodDataSave, postOpenAIMoodDataLoad } =
  springEllaMoodController;

const { postOpenAIAnxietyDataSave, postOpenAIAnxietyDataLoad } =
  springEllaAnxietyController;

const { postOpenAIEmotionDataSave, postOpenAIEmotionDataLoad } =
  springEllaEmotionController;

// 토큰 유효성 검사 미들웨어
const { vaildateTokenConsulting, vaildateUserSubscriptionAuth } =
  loginController;

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

// 불안훈련 데이터 Save
router.post(
  "/training_anxiety_ella/save",
  // vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIAnxietyDataSave
);
// 불안훈련 시작 데이터 Load
router.post(
  "/training_anxiety_ella/load",
  // vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIAnxietyDataLoad
);

// 정서인식 훈련 데이터 Save
router.post(
  "/training_emotion_ella/save",
  // vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIEmotionDataSave
);
// 정서인식 훈련 시작 데이터 Load
router.post(
  "/training_emotion_ella/load",
  // vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIEmotionDataLoad
);

// 에러 메세지 처리
router.use(errController.errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
