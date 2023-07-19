const pathController = {
  default: (req, res) => {
    res.send("path1 default access");
  },
  first: (req, res) => {
    res.send("path1 first access");
  },
  second: (req, res) => {
    res.send("path1 second access");
  },
  // parameter 사용법
  params: (req, res) => {
    const p = req.params;
    // { key(:변수명): value(요청 입력값) }
    res.send(p);
  },
  // query 사용법
  query: (req, res) => {
    const q = req.query;
    // { key:value, key2:value2 }
    res.send(q);
  },
  post: (req, res) => {
    const b = req.body;
    res.send(b);
  },
  // 동물 울음소리 반환 메서드
  sound: (req, res) => {
    const { name } = req.params;
    // name 값에 따라 반환값 분기
    switch (name) {
      case "cat": {
        res.json({ sound: "야옹" });
        break;
      }
      case "dog": {
        res.json({ sound: "멍멍" });
        break;
      }
      default:
        res.json({ sound: "동물이 아닙니다" });
    }
  },
};

const errHandler = {
  logErrors: (err, req, res, next) => {
    console.error(err.stack);
    // next(err)은 오류 처리 핸들러를 제외한 나머지 모든 핸들러를 건너뛴다.
    // 단, next('route')는 예외.
    next(err);
  },
  clientErrorHandler: (err, req, res, next) => {
    // req.xhr: 요청이 ajax 호출로 시작되었다면 true를 반환.
    if (req.xhr) {
      res.status(500).send({ error: "Something failed!" });
    } else {
      next(err);
    }
  },
  univErrorHandler: (err, req, res, next) => {
    res.status(500);
    res.render("error", { error: err });
  },
};

module.exports = {
  pathController,
  errHandler,
};
