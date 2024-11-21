// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { errController } = require("../controller/index");
const { PaymentController } = require("../controller/payment");
const { loginController } = require("../controller/login");

const {
  postUserCouponValidation,
  postUserSubscriptionExpiration,
  postUserSubscriptionExpirationUpdate,
} = PaymentController;

// 토큰 유효성 검사 미들웨어
const { vaildateTokenConsulting } = loginController;

// 남은 이용권 만료일 조회
router.post(
  "/subscription/expired",
  // vaildateTokenConsulting,
  postUserSubscriptionExpiration
);
// 이용권 만료일 갱신 (결제 승인 시 호출)
router.post(
  "/subscription/expired/update",
  // vaildateTokenConsulting,
  postUserSubscriptionExpirationUpdate
);
// 쿠폰 유효성 검증
router.post(
  "/coupon/validation",
  // vaildateTokenConsulting,
  postUserCouponValidation
);

// 에러 메세지 처리
router.use(errController.errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
