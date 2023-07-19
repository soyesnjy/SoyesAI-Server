// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();
const { errHandler } = require("../controller/index");
const { nextErrHandler, errMessageHandler } = errHandler;

// cur 라우터
// next('route') 실행 시 다음 라우터로 건너 뛴다.
router.get(
  "/:flag",
  nextErrHandler((req, res, next) => {
    if (req.params.flag === "cur") {
      // cur인 경우
      res.status(200).json("Route");
    } else if (req.params.flag === "next") {
      // next인 경우
      next("route");
    } else {
      // 그 외
      throw new Error("Error!!!"); // 에러 발생 후 catch 문으로 이동
    }
  })
);

// next 라우터
router.get("/:flag", function fail(req, res) {
  res.status(200).json("Next Route");
});

// 오류 처리 함수. 에러 발생 시 호출
router.use(errMessageHandler);

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
