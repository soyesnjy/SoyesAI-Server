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
const { dbconfig, dbconfig_ai } = require("../DB/database");
// Tips DB 연결
const connection = mysql.createConnection(dbconfig);
connection.connect();
// AI DB 연결
const connection_AI = mysql.createConnection(dbconfig_ai);
connection_AI.connect();
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

const nodemailer = require("nodemailer");
// 성격 검사 결과
const {
  persnal_short, // 성격검사 짧은 결과
  persnal_long, // 성격검사 양육 코칭 결과
  behavioral_rating_scale, // 정서행동검사 척도
  behavioral_rating_standard, // 정성행동검사 기준
} = require("../DB/psy_test");

const openAIController = {
  // 자율 상담 AI
  postOpenAIChattingNew: async (req, res) => {
    const { messageArr } = req.body;
    console.log("자율 상담 API /message Path 호출");
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
        model: "gpt-3.5-turbo-1106", // gpt-4-1106-preview, gpt-3.5-turbo-1106, gpt-3.5-turbo-instruct, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
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
  // 감정 분석 AI
  postOpenAIEmotionAnalyze: async (req, res) => {
    const { messageArr } = req.body;
    console.log("감정 분석 API /emotion Path 호출");
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
  // 테스트 결과 기반 상담 AI. 정서행동 검사
  postOpenAIEmotionTestResultConsulting: async (req, res) => {
    const { messageArr } = req.body;
    // console.log("anxiety_depression");
    console.log("정서행동 검사 반영 상담 API /consulting_emotion Path 호출");
    console.log(messageArr);

    let parseMessageArr,
      parseTestResult = {};

    // messageArr가 문자열일 경우 json 파싱
    if (typeof messageArr === "string") {
      parseMessageArr = JSON.parse(messageArr);
    } else parseMessageArr = [...messageArr];

    parseTestResult.emotional_behavior = {
      adjust_school: 0,
      peer_relationship: 7,
      family_relationship: 7,
      overall_mood: 7,
      unrest: 7,
      depressed: 7,
      physical_symptoms: 7,
      focus: 7,
      hyperactivity: 7,
      aggression: 7,
      self_awareness: 7,
    };

    // console.log(JSON.stringify(parseTestResult.emotional_behavior));

    try {
      const response = await openai.chat.completions.create({
        messages: [
          // // Base Prompt
          {
            role: "system",
            content: `
            - assistant는 '푸푸'라는 이름을 가진 9살 남자 초등학생입니다.
            - assistant는 나의 가장 친한 친구로서 행동해야 합니다.
            - assistant는 호기심이 많고 새로운 것들을 배우는 것을 좋아하지만, 때로는 짧은 집중력과 제한된 지식 범위를 가지고 있습니다.
            - assistant는 간단한 언어와 명확한 설명을 사용하여, 세상을 이해하고자 하는 어린 아이의 시각을 반영해야 합니다.
            - assistant는 MBTI 성격유형 중 'F' 성향을 가지고 있습니다.
            - user의 이름은 '노지용'입니다.
            - user는 당신에게 고민 상담을 받고싶어합니다.
            - assistant는 user의 성격을 이미 알고 있습니다. 유저의 성격을 반영하여 대화를 진행해주세요.
            - assistant의 답변은 반드시 2문장 이내로 생성되어야 합니다.
            - assistant는 반드시 반말을 사용해야하며 친절한 말투를 사용해주세요.
            - 모든 대화는 이 연령대 아이의 관점과 지식 수준에 맞춰져야 하며, 안전하고 교육적인 내용에 초점을 맞춰야 합니다.
            `,
          },
          // 정서행동결과 반영 Prompt
          {
            role: "system",
            content: `
            다음에 오는 문단은 아동의 정서행동검사의 척도에 대한 설명입니다.
            '''
            ${behavioral_rating_scale}
            '''
            다음에 오는 문단은 아동의 정서행동검사 척도에 대한 기준입니다.
            score 값에 따라 위험/주의/경고 3가지 기준으로 나뉘어집니다.
            '''
            ${behavioral_rating_standard}
            '''
            다음에 오는 문단은 아동의 정서행동검사 결과입니다.
            객체의 각 변수값을 score에 대입합니다.
            '''
            ${JSON.stringify(parseTestResult.emotional_behavior)}
            '''
            해당 결과를 반영하여 답변을 생성해주세요.
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
  // 테스트 결과 메일 전송 API
  postOpenAIPsychologicalAnalysis: async (req, res) => {
    const { EBTData, type, uid } = req.body;
    console.log("테스트 결과 메일 전송 API /analysis Path 호출");
    console.log(EBTData);

    let data,
      parsingType,
      pUid,
      yourMailAddr = "";

    // uid, type 전처리. 없는 경우 디폴트값 할당
    pUid = uid ? uid : "njy95";
    parsingType = type ? type : "default";

    // 테스트 타입 객체. 추후 검사를 늘림에 따라 추가 될 예정
    const testType = {
      school: "학교",
      friendship: "교우관계",
      default: "학교",
    };

    // 메일 관련 세팅 시작

    /*
    // mysql query 메서드 동기식 작동 + DB 데이터 가져오기
    let yourMailAddr = "";

    // Promise 생성 메서드
    function queryAsync(connection, query, parameters) {
      return new Promise((resolve, reject) => {
        connection.query(query, parameters, (error, results, fields) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
          }
        });
      });
    }

    // 프로미스 resolve 반환값 사용. (User Data return)
    async function fetchUserData(connection, query) {
      try {
        let results = await queryAsync(connection, query, []);
        // console.log(results[0]);
        yourMailAddr = results[0].email; // Select email
      } catch (error) {
        console.error(error);
      }
    }

    const user_table = "soyes_ai_User";
    const user_attr = {
      pKey: "uid",
      attr1: "email"
    }

    const select_query = `SELECT * FROM ${user_table} WHERE ${user_attr.pKey}='${pUid}'`;
    await fetchUserData(connection_AI, select_query);
    console.log("받는사람: " + yourMailAddr);
    */

    yourMailAddr = "soyesnjy@gmail.com"; // dummy email. 받는사람

    // 보내는 사람 계정 로그인
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
    // 메일 관련 세팅 끝

    // 파싱. Client JSON 데이터
    if (typeof EBTData === "string") {
      data = JSON.parse(EBTData);
    } else data = EBTData;

    // 파싱 후 값 대입
    let parseMessageArr = [...data];

    try {
      // AI 분석
      const response = await openai.chat.completions.create({
        messages: [
          // Base Prompt
          {
            role: "system",
            content: `너의 이름은 소예.
              소예는 아동 심리 분석가입니다.
              소예는 주어진 문답을 분석하여 유저의 심리 상태를 파악합니다.
              소예는 주어진 문답으로만 심리 분석을 진행해야합니다.
              소예는 다른 정보에 대한 필요성을 어필해선 안됩니다.
              소예는 심리 전문가스러운 말투를 사용합니다.
              `,
          },
          ...parseMessageArr,
          {
            role: "user",
            content: `앞선 대화를 기반으로 ${testType[parsingType]}에 대한 아동의 심리 상태를 분석해줘. 분석이 끝나면 문제에 대한 해결 방안을 제시해줘`,
          },
        ],
        model: "gpt-3.5-turbo-1106", // gpt-4-1106-preview, gpt-3.5-turbo-1106, gpt-3.5-turbo-instruct(Regercy), ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });
      // gpt-3.5-turbo-instruct 모델은 최신 문법이 아닌 레거시 문법으로 작성해야 사용 가능
      // gpt-4-1106-preview 모델은 OpenAI 유료고객(Plus 결제 회원) 대상으로 사용 권한 지급

      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      // AI 분석 내용 보기좋게 정리
      const analyzeMsg = message.message.split(". ").join(".\n");

      // 메일 제목 및 내용 + 보내는사람 + 받는사람
      const mailOptions = {
        from: myMailAddr,
        to: yourMailAddr,
        subject: "정서행동 검사 AI 상담 분석 결과입니다",
        text: `
안녕하세요? 소예키즈 AI 상담사입니다.
귀하의 상담 내용에 대한 AI 분석 결과를 안내드립니다.

${analyzeMsg}

이상입니다. 감사합니다!
        `,
        // attachments : 'logo.png' // 이미지 첨부 속성
      };

      /* 잠시 봉인
      // 메일 전송 (비동기)
      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log("Mail Send Fail!");
          res.json("Mail Send Fail!");
        } else {
          console.log("Mail Send Success!");
          console.log(info.envelope);
        }
      });
      */

      // client 전송
      res.json({ message: mailOptions.text });

      // 메일 내역 DB 저장
      const table = "soyes_ai_Analysis";
      const attribute = { pKey: "uid", attr1: "chat", attr2: "date" };
      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      /*
      // 1. SELECT TEST (row가 있는지 없는지 검사)
      const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${pUid}'`;
      connection_AI.query(select_query, (error, rows, fields) => {
        if (error) console.log(error);
        else {
          // row 값 콘솔에 찍어보기
          console.log(rows[0][attribute.pKey]);
          console.log(JSON.parse(rows[0][attribute.attr1])); // json parsing 필수
          console.log(rows[0][attribute.attr2]);
        }
      });
      */

      // 2. UPDATE TEST (row값이 있는 경우 실행)
      const update_query = `UPDATE ${table} SET ${attribute.attr1} = ?, ${attribute.attr2} = ? WHERE ${attribute.pKey} = ?`;
      const update_value = [
        JSON.stringify({ ...mailOptions, date }),
        date,
        pUid,
      ];

      // 분석 기록 DB 저장
      connection_AI.query(update_query, update_value, (error, rows, fields) => {
        if (error) console.log(error);
        else console.log("AI Analysis Data DB Save Success!");
      });

      /*
      // 3. INSERT TEST (row값이 없는 경우 실행)
      const insert_query = `INSERT INTO ${table} (${attribute.pKey}, ${attribute.attr1}, ${attribute.attr2}) VALUES (?, ?, ?)`;
      const insert_value = [
        pUid,
        JSON.stringify({ ...mailOptions, date }),
        date,
      ];

      connection_AI.query(insert_query, insert_value, (error, rows, fields) => {
        if (error) console.log(error);
        else console.log("INSERT Success");
      });
      */

      // res.json(message);
    } catch (err) {
      console.error(err.error);
      res.json("Fail!");
    }
  },
  // 테스트 결과 기반 상담 AI. 성격 검사
  postOpenAIPersnalTestResultConsulting: async (req, res) => {
    const { messageArr, testResult } = req.body;
    console.log("성격 검사 반영 API /consulting_persnal Path 호출");

    let parseMessageArr,
      parseTestResult = {};
    // console.log(messageArr);

    // messageArr가 문자열일 경우 json 파싱
    if (typeof messageArr === "string") {
      parseMessageArr = JSON.parse(messageArr);
    } else parseMessageArr = [...messageArr];

    if (typeof testResult === "string") {
      parseTestResult = JSON.parse(messageArr);
    } else if (!testResult) {
      // default 검사 결과
      parseTestResult.persnal = "IFPE";
    } else parseTestResult.persnal = testResult;

    // console.log(persnal_short[parseTestResult.persnal]);

    try {
      const response = await openai.chat.completions.create({
        temperature: 1,
        messages: [
          {
            role: "system",
            content: `
            아래 지시 사항대로 행동해줘
            '''
            - assistant는 '푸푸'라는 이름을 가진 9살 남자 초등학생입니다.
            - assistant는 나의 가장 친한 친구로서 행동해야 합니다.
            - assistant는 호기심이 많고 새로운 것들을 배우는 것을 좋아하지만, 때로는 짧은 집중력과 제한된 지식 범위를 가지고 있습니다.
            - assistant는 간단한 언어와 명확한 설명을 사용하여, 세상을 이해하고자 하는 어린 아이의 시각을 반영해야 합니다.
            - assistant는 MBTI 성격유형 중 'F' 성향을 가지고 있습니다.
            - user의 이름은 '노지용'입니다.
            - user는 당신에게 고민 상담을 받고싶어합니다.
            - assistant의 답변은 반드시 2문장 이내로 생성되어야 합니다.
            - assistant는 반드시 반말을 사용해야하며 친절한 말투를 사용해주세요.
            - 모든 대화는 이 연령대 아이의 관점과 지식 수준에 맞춰져야 하며, 안전하고 교육적인 내용에 초점을 맞춰야 합니다.
            '''
            `,
          },
          // 성격검사결과 반영 Prompt
          {
            role: "system",
            content: `
            user의 성격은 ${persnal_short[parseTestResult.persnal]}
            assistant는 user의 성격을 이미 알고 있습니다. 유저의 성격을 반영하여 대화를 진행해주세요.
            다음 문단은 user의 성격검사 결과에 따른 전문가의 양육 코칭 소견입니다. 
            '''
            ${persnal_long[parseTestResult.persnal]}
            '''
            해당 소견을 참조하여 답변을 생성해주세요.
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

    // 메일 제목 및 내용 + 보내는/받는사람
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
