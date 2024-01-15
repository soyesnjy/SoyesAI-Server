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

const errController = {
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
  // controller 콜백함수를 받아 try,catch 문으로 next(err)를 실행하는 함수를 반환하는 메서드
  nextErrHandler: (controller) => (req, res, next) => {
    try {
      controller(req, res, next);
    } catch (err) {
      next(err); // 모든 라우터를 건너뛰고 오류 처리 함수로 이동
    }
  },
  // 에러 메세지 반환 메서드
  errMessageHandler: (err, req, res, next) => {
    res.status(400).json(err.message); // 발생된 에러 메세지 반환
  },
};

// MySQL 접근
const mysql = require("mysql");
const { dbconfig } = require("../DB/database");
const connection = mysql.createConnection(dbconfig);
connection.connect();
// connection.end(); // 언제쓰지?
const { users } = require("../DB/database");

const { generateToken, verifyToken } = require("../controller/tokenFnc");
const loginController = {
  // 쿠키 유효성 검사
  vaildateCookies: (req, res, next) => {
    const { login } = req.cookies;
    if (login) {
      if (req.cookies.login === "true") {
        res.json("Cookie Login Success");
      }
    } else next();
  },
  // 쿠키 로그인
  CookieLoginHandler: (req, res) => {
    const { id, pwd } = req.body;

    if (users.find((user) => user.id === id && user.pwd === pwd)) {
      // 로그인 성공 시 쿠키 관련 설정 추가. 도메인은 자동으로 현재 서버와 동일하게 적용.
      res.cookie("login", "true", {
        maxAge: 100000, // 쿠키 유효기간
        path: "/", // 서버 라우팅 시 세부 경로
        httpOnly: true, // JS의 쿠키 접근 가능 여부 결정
        secure: true, // sameSite를 none으로 설정하려면 필수
        sameSite: "none", // none으로 설정해야 cross-site 처리가 가능.
      });
      res.json("Login Success");
    } else {
      res.json("Login Fail");
    }
  },
  // 쿠키 로그아웃
  CookieLogoutHandler: (req, res) => {
    res.clearCookie("login", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.json("Cookie LogOut Success");
  },
  // 세션 유효성 검사
  vaildateSession: (req, res, next) => {
    if (req.session.sessionId) {
      res.json("Session Login Success");
    } else next();
  },
  // 세션 로그인
  sessionLoginHandler: (req, res) => {
    const { id, pwd } = req.body;

    if (users.find((user) => user.id === id && user.pwd === pwd)) {
      // 로그인 성공 시 세션 아이디 추가
      req.session.sessionId = id;
      req.session.cookie.maxAge = 10000;
      req.session.save(() => {
        res.json("Login Success");
      });
    } else {
      res.json("Login Fail");
    }
  },
  // 세션 로그아웃
  sessionLogoutHandler: (req, res) => {
    req.session.destroy();
    res.json("Session LogOut Success");
  },
  // 토큰 유효성 검사
  vaildateToken: (req, res, next) => {
    const accessToken = req.session.accessToken;
    const refreshToken = req.cookies.refreshToken;
    // accessToken이 있는 경우
    if (accessToken) {
      const decoded = verifyToken("access", accessToken);
      if (users.find((user) => user.id === decoded.id)) {
        res.json("AccessToken Login Success");
      }
      // refreshToken만 있는 경우
    } else if (refreshToken) {
      const decoded = verifyToken("refresh", refreshToken);
      if (users.find((user) => user.id === decoded.id)) {
        // accessToken 생성 후 세션에 저장
        req.session.accessToken = generateToken({
          id: decoded.id,
          email: `${decoded.id}@naver.com`,
        }).accessToken;
        res.json("RefreshToken Login Success");
      }
    } else next();
  },
  // 토큰 로그인
  tokenLoginHandler: (req, res) => {
    const { id, pwd } = req.body;
    console.log(id, pwd);
    // MySQL DB 연동
    connection.query(
      `SELECT * FROM teacher WHERE (teacher_uid = '${id}' AND teacher_pwd = '${pwd}')`,
      (error, rows, fields) => {
        if (error) console.log(error);
        // rows : 배열 형식으로 저장된 행 데이터
        // fields: 열(속성) 데이터

        // rows는 테이블의 데이터를 배열 형식 저장
        // 즉, 배열 메서드를 통해 접근 가능
        // 아래는 테이블 데이터의 member_name에 접근
        // console.log(rows.filter((el) => el.member_id === id)[0].member_phone);

        if (rows.length) {
          // 토큰을 활용한 쿠키, 세션
          // const token = generateToken({ id, email: `${id}@naver.com` });
          // // accessToken 세션에 추가
          // req.session.accessToken = token.accessToken;
          // // refreshToken 쿠키에 추가
          // res.cookie("refreshToken", token.refreshToken, {
          //   path: "/", // 서버 라우팅 시 세부 경로
          //   httpOnly: true, // JS의 쿠키 접근 가능 여부 결정
          //   secure: true, // sameSite를 none으로 설정하려면 필수
          //   sameSite: "none", // none으로 설정해야 cross-site 처리가 `가능.
          // });
          // req.session.save(() => {
          //   res.json("Login Success");
          // });
          res.json({ data: "Login Success" });
        } else res.json({ data: "Login fail" });
      }
    );

    // DB없이 서버 내장 데이터 사용
    // if (users.find((el) => el.id === id && el.pwd === pwd)) {
    //   res.json("Login Success");
    // } else res.json("Login Fail");
  },
  // 토큰 로그아웃
  tokenLogoutHandler: (req, res) => {
    // // 세션 삭제
    // req.session.destroy();

    // // 쿠키 삭제
    // res.clearCookie("refreshToken", {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "none",
    // });

    res.json("Token LogOut Success");
  },
  // 유저 정보 전달. 모든 학생 정보 출력
  getUserHandler: (req, res) => {
    connection.query(`SELECT * FROM user`, (error, rows, fields) => {
      if (error) console.log(error);

      if (rows.length) {
        const data = rows.map((row) => {
          const { user_name, user_number } = row;
          return { user_name, user_number };
        });
        // 오름차순 정렬
        data.sort((a, b) => {
          if (a.user_name < b.user_name) return -1;
          else if (a.user_name > b.user_name) return 1;
          else return 0;
        });

        res.json({ data });
      } else res.json("NonUser");
    });
  },
  // 조건부 선생 정보 전달
  postUsersHandler: (req, res) => {
    const { vrNum } = req.body;
    console.log("postTeacher Request => vrNum: " + vrNum);
    connection.query(
      `select * from teacher 
      inner join user on teacher.vr_number = user.user_vr_number 
      where teacher.vr_number = '${vrNum}'`,
      (error, rows, fields) => {
        if (error) console.log(error);

        if (rows.length) {
          const data = rows.map((row) => {
            const { user_number, user_name } = row;
            return { user_number, user_name };
          });

          res.json({ data });
        } else res.json("NonUser");
      }
    );
  },
  // 조건부 유저 정보 전달
  postUserHandler: (req, res) => {
    const { user_number } = req.body;
    console.log("postUser Request => user_number: " + user_number);

    connection.query(
      `select * from user where user.user_number = '${user_number}'`,
      (error, rows, fields) => {
        if (error) console.log(error);

        if (rows.length) {
          const data = rows.map((row) => {
            const { user_age } = row;
            return { user_age };
          });

          res.json({ data });
        } else res.json("NonUser");
      }
    );
  },
  // 조건부 선생 정보 전달 (vr_number)
  postTeacherHandler: (req, res) => {
    const { teacher_uid } = req.body;
    console.log("postTeacher Request => teacher_uid: " + teacher_uid);

    connection.query(
      `select * from teacher where teacher.teacher_uid = '${teacher_uid}'`,
      (error, rows, fields) => {
        if (error) console.log(error);

        if (rows.length) {
          const data = rows.map((row) => {
            const { vr_number } = row;
            return { vr_number };
          });
          res.json({ data });
        } else res.json("NonUser");
      }
    );
  },
};

const signupController = {
  dupleCheckHandler: (req, res) => {
    const { id, vrNum, type } = req.body;

    // MySQL DB 연동
    if (type === "id") {
      connection.query(
        `SELECT * FROM teacher WHERE (teacher_uid = '${id}')`,
        (error, rows, fields) => {
          if (error) console.log(error);
          if (rows.length) {
            res.json({ data: "Fail" });
          } else res.json({ data: "Success" });
        }
      );
    } else {
      connection.query(
        `SELECT * FROM teacher WHERE (vr_number = '${vrNum}')`,
        (error, rows, fields) => {
          if (error) console.log(error);
          if (rows.length) {
            res.json({ data: "Fail" });
          } else res.json({ data: "Success" });
        }
      );
    }
  },
  signupHandler: (req, res) => {
    const { id, pwd, name, age, email, vrNum } = req.body;
    // 서버측 2중 보안
    if (!id || !pwd || !vrNum) res.json({ data: "Fail" });
    // MySQL DB 연동
    connection.query(
      `INSERT INTO teacher VALUES ('${vrNum}', '${id}', '${pwd}')`,
      (error) => {
        if (error) {
          console.log(error);
          res.json({ data: "Fail" });
        } else res.json({ data: "Success" });
      }
    );
  },
};

// 검사 관련 핸들러
const emotinalBehaviorController = {
  putEmotinalResultHandler: (req, res) => {
    const {
      uid,
      gradeType,
      levelResult,
      typeSchoolMaladjustment,
      typePeerRelationshipProblems,
      typeFamilyRelations,
      typeOverallMood,
      typeAnxious,
      typeDepressed,
      typePhysicalSymptoms,
      typeAttention,
      typeHyperactivity,
      typeAngerAggression,
      typeSelfAwareness,
    } = req.body;
    // 해당 uid의 검사 결과가 있는지 확인
    connection.query(
      `select * from emotinalBehavior where uid = '${uid}'`,
      (error, rows, fields) => {
        if (error) console.log(error);
        // 결과가 있는 경우 Update
        if (rows.length) {
          const updateData = {
            gradeType,
            lastDate: new Date().toISOString().slice(0, 19).replace("T", " "),
            levelResult,
            typeSchoolMaladjustment,
            typePeerRelationshipProblems,
            typeFamilyRelations,
            typeOverallMood,
            typeAnxious,
            typeDepressed,
            typePhysicalSymptoms,
            typeAttention,
            typeHyperactivity,
            typeAngerAggression,
            typeSelfAwareness,
          };
          const keys = Object.keys(updateData);

          connection.query(
            `UPDATE emotinalBehavior SET ${keys
              .map((key) => {
                return `${key}='${updateData[key]}'`;
              })
              .join(", ")} WHERE uid='${uid}'`,
            (error) => {
              if (error) console.log(error);
              else res.json({ data: "Success" });
            }
          );
        }
        // 결과가 없는 경우 Insert
        else {
          const insertData = [
            uid,
            gradeType,
            new Date().toISOString().slice(0, 19).replace("T", " "),
            levelResult,
            typeSchoolMaladjustment,
            typePeerRelationshipProblems,
            typeFamilyRelations,
            typeOverallMood,
            typeAnxious,
            typeDepressed,
            typePhysicalSymptoms,
            typeAttention,
            typeHyperactivity,
            typeAngerAggression,
            typeSelfAwareness,
          ];
          connection.query(
            `INSERT INTO emotinalBehavior VALUES (${insertData
              .map((value) => `'${value}'`)
              .join(", ")})`,
            (error) => {
              if (error) console.log(error);
              else res.json({ data: "Success" });
            }
          );
        }
      }
    );
  },
  postEmotinalResultHandler: (req, res) => {
    const { uid } = req.body;

    connection.query(
      `select * from emotinalBehavior where uid = '${uid}'`,
      (error, rows, fields) => {
        if (error) console.log(error);

        if (rows.length) {
          const data = rows.map((row) => row);
          res.json({ data });
        } else res.json("NonUser");
      }
    );
  },
};

const personalityController = {
  putPersonalResultHandler: (req, res) => {
    const {
      uid,
      gradeType,
      tendencyCP,
      tendencyER,
      tendencyOF,
      tendencySI,
      indexSI,
      indexCP,
      indexER,
      indexOF,
    } = req.body;

    // 해당 uid의 검사 결과가 있는지 확인
    connection.query(
      `select * from personality where uid = '${uid}'`,
      (error, rows, fields) => {
        if (error) console.log(error);
        // 결과가 있는 경우 Update
        if (rows.length) {
          const updateData = {
            uid,
            gradeType,
            tendencyCP,
            tendencyER,
            tendencyOF,
            tendencySI,
            lastDate: new Date().toISOString().slice(0, 19).replace("T", " "),
            indexSI,
            indexCP,
            indexER,
            indexOF,
          };
          const keys = Object.keys(updateData);

          connection.query(
            `UPDATE personality SET ${keys
              .map((key) => {
                return `${key}='${updateData[key]}'`;
              })
              .join(", ")} WHERE uid='${uid}'`,
            (error) => {
              if (error) console.log(error);
              else res.json({ data: "Success" });
            }
          );
        }
        // 결과가 없는 경우 Insert
        else {
          const insertData = [
            uid,
            gradeType,
            tendencyCP,
            tendencyER,
            tendencyOF,
            tendencySI,
            new Date().toISOString().slice(0, 19).replace("T", " "),
            indexSI,
            indexCP,
            indexER,
            indexOF,
          ];
          connection.query(
            `INSERT INTO personality VALUES (${insertData
              .map((value) => `'${value}'`)
              .join(", ")})`,
            (error) => {
              if (error) console.log(error);
              else res.json({ data: "Success" });
            }
          );
        }
      }
    );
  },
  postPersonalResultHandler: (req, res) => {
    const { uid } = req.body;

    connection.query(
      `select * from personality where uid = '${uid}'`,
      (error, rows, fields) => {
        if (error) console.log(error);

        if (rows.length) {
          const data = rows.map((row) => row);
          // 유형 합치기
          const tendencyType =
            data[0].tendencySI +
            data[0].tendencyOF +
            data[0].tendencyCP +
            data[0].tendencyER;

          // 합친 유형 삽입
          data[0].tendencyType = tendencyType;

          res.json({ data });
        } else res.json("NonUser");
      }
    );
  },
};

const careerController = {
  putCareerResultHandler: (req, res) => {
    const {
      uid,
      gradeType,
      interest1st,
      interest2nd,
      interest3rd,
      lastDate,
      typeA,
      typeC,
      typeE,
      typeI,
      typeR,
      typeS,
    } = req.body;

    // 해당 uid의 검사 결과가 있는지 확인
    connection.query(
      `select * from career where uid = '${uid}'`,
      (error, rows, fields) => {
        if (error) console.log(error);
        // 결과가 있는 경우 Update
        if (rows.length) {
          const updateData = {
            uid,
            gradeType,
            interest1st,
            interest2nd,
            interest3rd,
            lastDate: new Date().toISOString().slice(0, 19).replace("T", " "),
            typeA,
            typeC,
            typeE,
            typeI,
            typeR,
            typeS,
          };
          const keys = Object.keys(updateData);

          connection.query(
            `UPDATE career SET ${keys
              .map((key) => {
                return `${key}='${updateData[key]}'`;
              })
              .join(", ")} WHERE uid='${uid}'`,
            (error) => {
              if (error) console.log(error);
              else res.json({ data: "Success" });
            }
          );
        }
        // 결과가 없는 경우 Insert
        else {
          const insertData = [
            uid,
            gradeType,
            interest1st,
            interest2nd,
            interest3rd,
            new Date().toISOString().slice(0, 19).replace("T", " "),
            typeA,
            typeC,
            typeE,
            typeI,
            typeR,
            typeS,
          ];
          connection.query(
            `INSERT INTO career VALUES (${insertData
              .map((value) => `'${value}'`)
              .join(", ")})`,
            (error) => {
              if (error) console.log(error);
              else res.json({ data: "Success" });
            }
          );
        }
      }
    );
  },
  postCareerResultHandler: (req, res) => {
    const { uid } = req.body;

    connection.query(
      `select * from career where uid = '${uid}'`,
      (error, rows, fields) => {
        if (error) console.log(error);

        if (rows.length) {
          const data = rows.map((row) => row);
          res.json({ data });
        } else res.json("NonUser");
      }
    );
  },
};

// agora token 관련 핸들러
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

const agoraTokenController = {
  agoraTokenHandler: (req, res) => {
    const { uid, channelName } = req.body;
    // 고정 상담방 채널명
    const chNameArr = ["Room1", "Room2", "Room3", "Room4", "Room5"];

    console.log("uid: " + uid);
    console.log("channelName: " + channelName);

    // channelName은 5개 고정. 없는 채널명이 들어올 경우 non channel 반환
    if (chNameArr.indexOf(channelName) === -1)
      return res.status(500).json({ error: "Non Channel_Name" });

    connection.query(
      `SELECT * FROM consulting_channel WHERE channelName = '${channelName}'`,
      (error, rows, fields) => {
        if (error) {
          console.log(error);
          return res.status(400).json({ error: "channel is required" });
        }
        // 채널에 맞는 토큰이 있고 만료시간이 지나지 않은 경우
        if (
          rows[0].token &&
          Math.floor(Date.now() / 1000) < rows[0].expireTime
        ) {
          return res.json({ token: rows[0].token });
        }
        // 채널에 맞는 토큰이 없거나 만료시간이 지난 경우
        else {
          // 토큰 생성 후 DB에 저장하고 토큰 값 반환
          const APP_ID = "c7389fb8096e4187b4e7abef5cb9e6e2";
          const APP_CERTIFICATE = "b0f0e0a1646b415ca1eaaa7625800c63";

          const role = RtcRole.PUBLISHER;
          let expireTime = 3600 * 23;

          res.header("Access-Control-Allow-Origin", "*");
          res.header(
            "Cache-Control",
            "private",
            "no-cache",
            "no-store",
            "must-revalidate"
          );
          res.header("Pragma", "no-cache");
          res.header("Expires", "-1");

          // 채널 이름이 없으면 return. 즉, 서버 개발자가 DB에 채널 이름을 따로 넣어주아야함
          if (!channelName)
            return res.status(500).json({ error: "channel is required" });

          expireTime = parseInt(expireTime, 10);
          const currentTime = Math.floor(Date.now() / 1000);
          const privllegeExpireTime = currentTime + expireTime;

          const token = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            uid,
            role,
            privllegeExpireTime
          );
          console.log("ExpireTime: " + privllegeExpireTime);
          console.log("token: " + token);
          // DB에 삽입
          connection.query(
            `UPDATE consulting_channel SET token = '${token}', expireTime = '${privllegeExpireTime}' WHERE channelName = '${channelName}'`,
            (error) => {
              if (error) {
                console.log(error);
                return res.json({ data: "Fail" });
              } else return res.json({ token });
            }
          );
        }
      }
    );
  },
};

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.API_TOKEN,
});

const openAIController = {
  postOpenAIChattingNew: async (req, res) => {
    const { messageArr } = req.body;
    //console.log(req.body);
    //console.log(messageArr);
    //console.log(typeof messageArr);

    let parseMessageArr;

    // messageArr가 문자열일 경우 json 파싱
    if (typeof messageArr === "string") {
      parseMessageArr = JSON.parse(messageArr);
    } else parseMessageArr = [...messageArr];

    try {
      const response = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              // "Your name is Soye. Soye targets Korean-speaking children, providing support and guidance tailored to their language and culture. Soye is a simple way of using informal language when communicating with children in lower grades of elementary school. Soye will communicate with children in a way that understands and empathizes with the everyday problems and emotions they experience. All answers to children's questions will be in Korean, and a language that children can easily understand and communicate will be used. Your answer must be limited to 50 characters. Soye will not call itself a robot or artificial intelligence, but will act as another friend of the user.",
              "너의 이름은 소예. 소예는 한국어를 사용하는 아동을 대상으로 하면서, 그들의 언어와 문화에 맞춘 지원과 지도를 제공합니다. 소예는 간단한 방식으로, 초등학교 저학년 아동들과 소통할 때 반말을 사용합니다. 소예는 아이들이 경험하는 일상적인 문제와 감정에 대해 이해하고 공감하는 방식으로 소통할 것입니다. 아이들의 질문에 대한 답변은 모두 한국어로 이루어지고, 아이들이 쉽게 이해하고 소통할 수 있는 언어를 사용할 것입니다. 답변은 반드시 50글자 이내로 합니다. 소예는 스스로를 로봇이나 인공지능이라 칭하지 않고 사용자의 또 다른 친구로서 행동할 것입니다.",
          },
          {
            role: "system",
            content: "이모티콘은 절대로 사용하지마",
          },
          ...parseMessageArr,
        ],
        model: "gpt-4-1106-preview", // gpt-4-1106-preview, gpt-3.5-turbo-1106, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });
      // gpt-4-1106-preview 모델은 OpenAI 유료고객(Plus 결제 회원) 대상으로 사용 권한 지급
      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      res.json(message);
    } catch (err) {
      console.error(err.error);
      res.json(err);
    }
  },
  postOpenAIEmotionAnalyze: async (req, res) => {
    const { messageArr } = req.body;
    //console.log(messageArr);
    //console.log(typeof messageArr);

    let parseMessageArr;

    // messageArr가 문자열일 경우 json 파싱
    if (typeof messageArr === "string") {
      parseMessageArr = JSON.parse(messageArr);
    } else parseMessageArr = [...messageArr];

    try {
      const response = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "너는 감정 판별사야. 앞으로 입력되는 유저 메세지를 긍정/부정/중립 3가지 상태 중 하나로 판단해줘. 대답은 반드시 긍정,부정,중립 3개 중 하나로만 해줘.",
          },
          ...parseMessageArr,
        ],
        model: "gpt-3.5-turbo-1106",
      });

      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      res.send(message);
    } catch (err) {
      // console.error(err.error);
      res.send(err);
    }
  },
  postOpenAIEmotionTestResultConsulting: async (req, res) => {
    const { messageArr, testResult } = req.body;
    // console.log("anxiety_depression");
    //console.log(typeof messageArr);
    let parseMessageArr, parseTestResult;

    // messageArr가 문자열일 경우 json 파싱
    if (typeof messageArr === "string") {
      parseMessageArr = JSON.parse(messageArr);
    } else parseMessageArr = [...messageArr];

    if (typeof testResult === "string") {
      parseTestResult = JSON.parse(messageArr);
    } else if (!testResult) {
      parseTestResult = {
        anxiety_depression: 99,
        withdrawal_depression: 50,
        physical_symptoms: 60,
        social_immaturity: 20,
        thinking_problem: 16,
        attention_problem: 28,
        violation_rules: 87,
        attack_action: 21,
        other_problem: 64,
        internalizing_problems: 15,
        externalizing_problems: 25,
      };
    } else parseTestResult = testResult;

    // console.log(JSON.stringify(parseTestResult));

    try {
      const response = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `
            너의 이름은 소예. 소예는 아동 심리 상담사입니다. 소예는 한국어를 사용하는 아동을 대상으로 하면서, 그들의 언어와 문화에 맞춘 지원과 지도를 제공합니다. 소예는 간단한 방식으로, 초등학교 저학년 아동들과 소통할 때 반말을 사용합니다. 아이들의 질문에 대한 답변은 모두 한국어로 이루어지고, 아이들이 쉽게 이해하고 소통할 수 있는 언어를 사용할 것입니다. 답변은 반드시 100글자 이내로 합니다.
            지금부터 심리 검사 척도에대해 설명할거야.
            
            anxiety_depression: 아동기에 흔히 보일 수 있는 우울증과 불안장애를 반영하며, 자신감이 낮고 지나치게 걱정이 많다거나 불안 및 공포를 느끼는 정도를 측정합니다.
            withdrawal_depression: 이 영역에서 문제를 보이는 아동은 수줍음이 많고 혼자 있기를 좋아하며, 말을 하지 않으려 하고 소극적인 태도를 보이는 경우가 많습니다.
            physical_symptoms: 특정한 의학적 원인 없이 두통, 복통, 구토 등과 같은 신체증상들을 호소하는 정도를 반영합니다.
            social_immaturity: 제 나이에 비해 어리게 행동하거나 너무 어른들에게 의지하고 매달리는 성향으로 미성숙하고 비사교적인 측면을 반영합니다.
            thinking_problem: 어떤 특정한 행동이나 생각을 지나치게 반복하는 것과 같은 강박적인 사고와 행동, 환청이나 환시와 같이 실제로는 존재하지 않는 현상을 보거나 소리를 듣는 등의 비현실적이고기이한 사고 및 행동들과 관련이 있는데, 점수가 높을 경우 실제로 어떤 어려움이 반영된것인지 심화평가를 할 필요가 있습니다.
            attention_problem: 산만하고 어떤 일에 오래 주의를 기울이지 못하며, 가만히 앉아있지 못하고 지나치게 많이 움직이는 아동은 주의력 문제의 가능성을 의심해볼 만합니다.
            violation_rules: 거짓말을 한다거나 가출, 도벽 등 아동 및 청소년기에 보일 수 있는 행동일탈의 정도를 측정하는 척도입니다.
            attack_action: 말다툼을 한다거나 남을 괴롭히고 못살게 구는 등 공격적인 성향과 싸움, 반항행동을 평가하는 영역입니다.
            other_problem: 위에 제시된 요인 외에 아동 및 청소년기에 나타날 수 있는 기타 다양한 부적응 행동들을포함합니다.
            internalizing_problems: 불안/우울, 위축/우울, 신체증상 등 세가지 영역의 문제행동 점수의 합입니다. 소극적이고사회적으로 위축되어 있으며, 감정을 과잉통제하는 경향을 보일 수 있습니다.
            externalizing_problems: 규칙위반과 공격행동 두 가지 영역의 문제행동 점수의 합입니다. 타인에게 피해를 주거나공격적인 행동을 보일 수 있고, 행동통제가 어려울 수도 있습니다.
            
            아래는 위 척도에 대한 입력값이야. 0점에서 100점 사이의 값을 가지고 점수가 높을수록 위험군에 속해.
            ${JSON.stringify(parseTestResult)}
            입력받은 척도에 대한 점수를 바탕으로 해당 아동의 심리 상담에 반영해줘
            `,
          },
          ...parseMessageArr,
        ],
        model: "gpt-4-1106-preview", // gpt-4-1106-preview, gpt-3.5-turbo-1106, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      res.send(message);
    } catch (err) {
      // console.error(err.error);
      res.send(err);
    }
  },
};

const nodemailer = require("nodemailer");

const mailController = {
  postSendMail: async (req, res) => {
    const { uid } = req.body;

    let yourMailAddr = ""; // 받는 사람 메일주소
    // uid를 사용하여 DB에 접근 후 받는사람 메일 주소를 받아오는 코드 작성 예정
    yourMailAddr = "soyesnjy@gmail.com";

    const myMailAddr = process.env.ADDR_MAIL; // 보내는 사람 메일 주소
    const myMailPwd = process.env.ADDR_PWD; // 구글 계정 2단계 인증 비밀번호

    const transporter = nodemailer.createTransport({
      service: "gmail", // 사용할 이메일 서비스
      // host: "smtp.gmail.com",
      // port: 587,
      // secure: false,
      auth: {
        user: myMailAddr, // 보내는 이메일 주소
        pass: myMailPwd, // 이메일 비밀번호
      },
    });

    const mailOptions = {
      from: myMailAddr,
      to: yourMailAddr,
      subject: "Test Subject",
      text: "제곧내",
    };

    try {
      transporter.sendMail(mailOptions, function (error, info) {
        console.log(`Email sent: to ${yourMailAddr} from ${myMailAddr}`);
        res.json("Mail Send Success!");
      });
    } catch (err) {
      console.error(err.error);
      res.json("Mail Send Fail!");
    }
  },
};

module.exports = {
  pathController,
  errController,
  loginController,
  signupController,
  emotinalBehaviorController,
  personalityController,
  careerController,
  agoraTokenController,
  openAIController,
  mailController,
};
