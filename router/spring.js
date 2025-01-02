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
const {
  vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth,
  postSpringLoginHandler,
} = loginController;

// Rate Limiting 관련 - IP 단위로 요청 횟수를 감지하는 미들웨어
const rateLimit = require("express-rate-limit");
const loginRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 5분
  max: 5, // 5분 동안 최대 60회 요청 허용
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many requests. Please try again in 5 minutes.",
    });
  },
  standardHeaders: true, // Rate Limit 정보를 헤더에 추가
  legacyHeaders: false, // Rate Limit 정보를 X-RateLimit-* 헤더에 포함하지 않음
});

router.post("/login", loginRateLimiter, postSpringLoginHandler);

// 기분훈련 데이터 Save
router.post(
  "/training_mood_ella/save",
  vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIMoodDataSave
);
// 기분훈련 시작 데이터 Load
router.post(
  "/training_mood_ella/load",
  vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIMoodDataLoad
);

// 불안훈련 데이터 Save
router.post(
  "/training_anxiety_ella/save",
  vaildateTokenConsulting,
  // vaildateUserSubscriptionAuth, // 이용권한 검증 미들웨어
  postOpenAIAnxietyDataSave
);
// 불안훈련 시작 데이터 Load
router.post(
  "/training_anxiety_ella/load",
  vaildateTokenConsulting,
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
