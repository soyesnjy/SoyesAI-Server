// router이므로 express.Router() 인스턴스 생성
const express = require("express");
const router = express.Router();

// next('route') 실행 시 다음 라우터로 건너 뛴다.
router.get("/:flag", function fail(req, res, next) {
  try {
    // 조건에 따라 현재 라우터를 건너뛸 수 있다.
    if (req.params.flag === "cur") {
      res.status(200).json("Route");
    } else if (req.params.flag === "next") {
      next("route");
    } else {
      throw new Error("Error!!"); // 에러 발생 후 catch 문으로 이동
    }
  } catch (err) {
    next(err); // 모든 라우터를 건너뛰고 오류 처리 함수로 이동
  }
});
// 다음 라우터
router.get("/:flag", function fail(req, res) {
  res.status(200).json("Next Route");
});

// 오류 처리 함수. 에러 발생 시 호출
router.use((err, req, res, next) => {
  res.status(400).json(err.message); // 발생된 에러 메세지 반환
});

// public 모듈화 - require(router/path)을 통해 인스턴스 생성 가능.
module.exports = router;
