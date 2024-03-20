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

// google OAuth2Client 설정
const { OAuth2Client } = require("google-auth-library");
const oAuth2Client = new OAuth2Client(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);
const { google } = require("googleapis");

const User_Table_Info = {
  table: "soyes_ai_User",
  attribute: {
    pKey: "uid",
    attr1: "Email",
    attr2: "passWard",
    attr3: "name",
    attr4: "phoneNumber",
  },
};

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
    // console.log(id, pwd);
    if (users.find((user) => user.id === id && user.pwd === pwd)) {
      // 로그인 성공 시 세션 아이디 추가
      req.session.sessionId = id;
      req.session.cookie.maxAge = 10000;
      req.session.save(() => {
        res.json({ data: "Login Success" });
      });
    } else {
      res.json({ data: "Login Fail" });
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
  // OAuth URL 발급
  oauthUrlHandler: (req, res) => {
    const { oauthType } = req.body;
    console.log(oauthType);

    // SCOPE 설정. 유저 정보를 어디까지 가져올지 결정
    const scopeMap = {
      google: [
        "https://www.googleapis.com/auth/userinfo.profile", // 기본 프로필
        "https://www.googleapis.com/auth/userinfo.email", // 이메일
      ],

      // 다른 플랫폼의 OAuth 추가 대비
      kakao: ["https://www.kakaoapis.com/auth/userinfo.profile"],
      default: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
    };

    try {
      if (!oauthType) {
        res.json({ data: "" });
        return;
      }
      const SCOPES = [...scopeMap[oauthType]];

      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline", // 필요한 경우
        scope: SCOPES,
      });
      res.json({ data: authUrl });
    } catch (err) {
      console.error(err);
      res.json({ data: "Non " });
    }
  },
  // OAuth AccessToken 발급
  oauthAccessTokenHandler: async (req, res) => {
    const { code } = req.body;
    // console.log(code);

    try {
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error("Error retrieving access token", err);
        oAuth2Client.setCredentials(token);

        // 액세스 토큰을 사용하여 API를 호출할 수 있습니다.
        const oauth2 = google.oauth2({
          auth: oAuth2Client,
          version: "v2",
        });

        // 유저 정보 GET
        oauth2.userinfo.get(async (err, response) => {
          if (err) return console.error(err);
          // console.log(response.data);

          const { id, email, name } = response.data;

          const table = User_Table_Info.table;
          const attribute = User_Table_Info.attribute;
          // 오늘 날짜 변환
          const dateObj = new Date();
          const year = dateObj.getFullYear();
          const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
          const day = ("0" + dateObj.getDate()).slice(-2);
          const date = `${year}-${month}-${day}`;

          // DB 계정 생성 코드 추가 예정
          // 동기식 DB 접근 함수 1. Promise 생성 함수
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
              return results;
            } catch (error) {
              console.error(error);
            }
          }

          // 1. SELECT USER (row가 있는지 없는지 검사)
          const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${response.data.id}'`;
          const ebt_data = await fetchUserData(connection_AI, select_query);

          // 2. INSERT USER (row값이 없는 경우 실행)
          if (!ebt_data[0]) {
            const insert_query = `INSERT INTO ${table} (${Object.values(
              attribute
            ).join(", ")}) VALUES (${Object.values(attribute)
              .map((el) => "?")
              .join(", ")})`;
            // console.log(insert_query);

            const insert_value = [id, email, "", name, ""];
            // console.log(insert_value);

            // 계정 생성 쿼리 임시 주석
            // connection_AI.query(
            //   insert_query,
            //   insert_value,
            //   (error, rows, fields) => {
            //     if (error) console.log(error);
            //     else console.log("OAuth User Row DB INSERT Success!");
            //   }
            // );
          }

          res.json({ data: response.data });
        });
      });
    } catch (err) {
      console.error(err);
      res.json({ data: "Fail" });
    }
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
// 심리 검사 관련
const {
  persnal_short, // 성격검사 짧은 결과
  persnal_long, // 성격검사 양육 코칭 결과
  ebt_School_Result,
  ebt_Friend_Result,
  ebt_Family_Result,
  ebt_Mood_Result,
  ebt_Unrest_Result,
  ebt_Sad_Result,
  ebt_Health_Result,
  ebt_Attention_Result,
  ebt_Movement_Result,
  ebt_Angry_Result,
  ebt_Self_Result,
} = require("../DB/psy_test");

const {
  base_pupu,
  base_soyes,
  base_lala,
  base_pupu_v2,
} = require("../DB/base_prompt");

// 프롬프트 관련
const {
  persona_prompt_pupu,
  persona_prompt_lala,
  persona_prompt_ubi,
  persona_prompt_soyes,
  adler_prompt,
  gestalt_prompt,
  info_prompt,
  prevChat_prompt,
  solution_prompt,
  solution_prompt2,
  psyResult_prompt,
  common_prompt,
  sentence_division_prompt,
  completions_emotion_prompt,
  test_prompt_20240304,
  test_prompt_20240304_v2,
  test_prompt_20240305_v1,
  no_req_prompt,
  persnal_result_prompt,
} = require("../DB/test_prompt");

// 인지행동 검사 관련
const {
  cb_test_friend,
  cb_test_family,
  cb_test_school,
  cb_test_remain,
} = require("../DB/cognitive_behavior_test");

// 텍스트 감지 관련
const {
  test_result_ment,
  cb_solution_ment,
} = require("../DB/detect_ment_Array");

const select_soyes_AI_Ebt_Table = async (
  user_table,
  user_attr,
  ebt_Question,
  parsepUid
) => {
  // 동기식 DB 접근 함수 1. Promise 생성 함수
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
      return results;
    } catch (error) {
      console.error(error);
    }
  }
  try {
    // console.log(user_table);
    const select_query = `SELECT * FROM ${user_table} WHERE ${user_attr.pKey}='${parsepUid}'`; // Select Query
    const ebt_school_data = await fetchUserData(connection_AI, select_query);
    // console.log(ebt_school_data[0]);
    // ebt_school_data[0]
    //   ? console.log(`${parsepUid} 계정은 존재합니다`)
    //   : console.log(`${parsepUid} 계정은 없습니다`);
    // delete ebt_school_data[0].uid; // uid 속성 삭제
    // Attribute의 값이 2인 요소의 배열 필터링. select 값이 없으면

    const problem_attr_arr = ebt_school_data[0]
      ? Object.keys(ebt_school_data[0])
      : [];

    const problem_attr_nameArr = problem_attr_arr.filter(
      // 속성명이 question을 가지고있고, 해당 속성의 값이 2인 경우 filtering
      (el) => el.includes("question") && ebt_school_data[0][el] === 2
    );
    // console.log(problem_attr_nameArr);

    // 문답 개수에 따른 시나리오 문답 투척
    // Attribute의 값이 2인 요소가 없는 경우
    return problem_attr_nameArr.length === 0
      ? { testResult: "", ebt_school_data }
      : {
          testResult: problem_attr_nameArr
            .map((el) => ebt_Question[el])
            .join("\n"),
          ebt_school_data,
        };
  } catch (err) {
    console.log(err);
    return { testResult: "", ebt_school_data: {} };
  }
};

// User 성격 검사 유형 반환 (String)
const select_soyes_AI_Pt_Table = async (user_table, user_attr, parsepUid) => {
  // 동기식 DB 접근 함수 1. Promise 생성 함수
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
      return results;
    } catch (error) {
      console.error(error);
    }
  }
  try {
    // console.log(user_table);
    const select_query = `SELECT * FROM ${user_table} WHERE ${user_attr.pKey}='${parsepUid}'`; // Select Query
    const ebt_school_data = await fetchUserData(connection_AI, select_query);
    // console.log(ebt_school_data[0]);

    return ebt_school_data[0] ? ebt_school_data[0].persanl_result : "default";
  } catch (err) {
    console.log(err);
    return { testResult: "", ebt_school_data: {} };
  }
};
// Database EBT Table Info
const EBT_Table_Info = {
  School: {
    table: "soyes_ai_Ebt_School",
    attribute: {
      pKey: "uid",
      attr1: "school_question_0",
      attr2: "school_question_1",
      attr3: "school_question_2",
      attr4: "school_question_3",
      attr5: "school_question_4",
      attr6: "school_question_5",
      attr7: "chat",
      attr8: "date",
    },
  },
  Friend: {
    table: "soyes_ai_Ebt_Friend",
    attribute: {
      pKey: "uid",
      attr1: "friend_question_0",
      attr2: "friend_question_1",
      attr3: "friend_question_2",
      attr4: "friend_question_3",
      attr5: "friend_question_4",
      attr6: "friend_question_5",
      attr7: "friend_question_6",
      attr8: "friend_question_7",
      attr9: "chat",
      attr10: "date",
    },
  },
  Family: {
    table: "soyes_ai_Ebt_Family",
    attribute: {
      pKey: "uid",
      attr1: "family_question_0",
      attr2: "family_question_1",
      attr3: "family_question_2",
      attr4: "family_question_3",
      attr5: "family_question_4",
      attr6: "family_question_5",
      attr7: "family_question_6",
      attr8: "chat",
      attr9: "date",
    },
  },
  Mood: {
    table: "soyes_ai_Ebt_Mood",
    attribute: {
      pKey: "uid",
      attr1: "mood_question_0",
      attr2: "mood_question_1",
      attr3: "mood_question_2",
      attr4: "chat",
      attr5: "date",
    },
  },
  Unrest: {
    table: "soyes_ai_Ebt_Unrest",
    attribute: {
      pKey: "uid",
      attr1: "unrest_question_0",
      attr2: "unrest_question_1",
      attr3: "unrest_question_2",
      attr4: "unrest_question_3",
      attr5: "unrest_question_4",
      attr6: "unrest_question_5",
      attr7: "chat",
      attr8: "date",
    },
  },
  Sad: {
    table: "soyes_ai_Ebt_Sad",
    attribute: {
      pKey: "uid",
      attr1: "sad_question_0",
      attr2: "sad_question_1",
      attr3: "sad_question_2",
      attr4: "sad_question_3",
      attr5: "sad_question_4",
      attr6: "sad_question_5",
      attr7: "sad_question_6",
      attr8: "chat",
      attr9: "date",
    },
  },
  Health: {
    table: "soyes_ai_Ebt_Health",
    attribute: {
      pKey: "uid",
      attr1: "health_question_0",
      attr2: "health_question_1",
      attr3: "health_question_2",
      attr4: "health_question_3",
      attr5: "health_question_4",
      attr6: "chat",
      attr7: "date",
    },
  },
  Attention: {
    table: "soyes_ai_Ebt_Attention",
    attribute: {
      pKey: "uid",
      attr1: "attention_question_0",
      attr2: "attention_question_1",
      attr3: "attention_question_2",
      attr4: "attention_question_3",
      attr5: "attention_question_4",
      attr6: "attention_question_5",
      attr7: "attention_question_6",
      attr8: "chat",
      attr9: "date",
    },
  },
  Movement: {
    table: "soyes_ai_Ebt_Movement",
    attribute: {
      pKey: "uid",
      attr1: "movement_question_0",
      attr2: "movement_question_1",
      attr3: "movement_question_2",
      attr4: "movement_question_3",
      attr5: "movement_question_4",
      attr6: "movement_question_5",
      attr7: "movement_question_6",
      attr8: "chat",
      attr9: "date",
    },
  },
  Angry: {
    table: "soyes_ai_Ebt_Angry",
    attribute: {
      pKey: "uid",
      attr1: "angry_question_0",
      attr2: "angry_question_1",
      attr3: "angry_question_2",
      attr4: "angry_question_3",
      attr5: "angry_question_4",
      attr6: "angry_question_5",
      attr7: "chat",
      attr8: "date",
    },
  },
  Self: {
    table: "soyes_ai_Ebt_Self",
    attribute: {
      pKey: "uid",
      attr1: "self_question_0",
      attr2: "self_question_1",
      attr3: "self_question_2",
      attr4: "self_question_3",
      attr5: "self_question_4",
      attr6: "chat",
      attr7: "date",
    },
  },
};

const PT_Table_Info = {
  table: "soyes_ai_PT",
  attribute: {
    pKey: "uid",
    attr1: "persanl_result",
    attr2: "chat",
    attr3: "date",
  },
};
// EBT 반영 Class 정의
const EBT_classArr = [
  "School",
  "Friend",
  "Family",
  "Mood",
  "Unrest",
  "Sad",
  "Health",
  "Attention",
  "Movement",
  "Angry",
  "Self",
];

const EBT_ObjArr = {
  School: { table: "soyes_ai_Ebt_School", result: ebt_School_Result },
  Friend: { table: "soyes_ai_Ebt_Friend", result: ebt_Friend_Result },
  Family: { table: "soyes_ai_Ebt_Family", result: ebt_Family_Result },
  Mood: { table: "soyes_ai_Ebt_Mood", result: ebt_Mood_Result },
  Unrest: { table: "soyes_ai_Ebt_Unrest", result: ebt_Unrest_Result },
  Sad: { table: "soyes_ai_Ebt_Sad", result: ebt_Sad_Result },
  Health: { table: "soyes_ai_Ebt_Health", result: ebt_Health_Result },
  Attention: { table: "soyes_ai_Ebt_Attention", result: ebt_Attention_Result },
  Movement: { table: "soyes_ai_Ebt_Movement", result: ebt_Movement_Result },
  Angry: { table: "soyes_ai_Ebt_Angry", result: ebt_Angry_Result },
  Self: { table: "soyes_ai_Ebt_Self", result: ebt_Self_Result },
};

const openAIController = {
  // 자율 상담 AI
  postOpenAIChattingNew: async (req, res) => {
    const { messageArr } = req.body;
    console.log("자율 상담 API /message Path 호출");
    let parseMessageArr;

    try {
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      const user_name = "예나";

      // parseMessageArr.push({
      //   role: "user",
      //   content: `문제 해결이 아닌 공감 위주의 답변을 30자 이내로 작성하되, 종종 해결책을 제시해줘`,
      // });

      const response = await openai.chat.completions.create({
        messages: [
          base_pupu,
          {
            role: "system",
            content: `user의 이름은 '${user_name}'입니다`,
          },
          ...parseMessageArr,
        ],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        // temperature: 0.2,
      });
      // gpt-4-turbo 모델은 OpenAI 유료고객(Plus 결제 회원) 대상으로 사용 권한 지급
      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);
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
    console.log(req.body);
    // console.log(typeof messageArr);

    let parseMessageArr;

    try {
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      const response = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "너는 감정 판별사야. 앞으로 입력되는 유저 메세지를 긍정/부정/중립 3가지 상태 중 하나로 판단해줘. 대답은 반드시 긍정,부정,중립 3개 중 하나로만 해줘.",
          },
          ...parseMessageArr,
        ],
        model: "gpt-3.5-turbo-0125",
      });

      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      res.send(message);
    } catch (err) {
      // console.error(err.error);
      res.send(err);
    }
  },
  // 테스트 결과 분석 및 DB 저장 및 메일 전송 API
  postOpenAIPsychologicalAnalysis: async (req, res) => {
    const { EBTData } = req.body; // 클라이언트 한계로 데이터 묶음으로 받기.
    console.log("테스트 결과 분석 및 메일 전송 API /analysis Path 호출");

    let parseEBTdata,
      parseMessageArr,
      parsingScore,
      parsingType,
      parsepUid,
      yourMailAddr = "";

    // 테스트 타입 객체. 추후 검사를 늘림에 따라 추가 될 예정
    const testType = {
      School: "학교생활",
      Friend: "또래관계",
      Family: "가족관계",
      Mood: "전반적 기분",
      Unrest: "불안",
      Sad: "우울",
      Health: "신체증상",
      Attention: "주의 집중",
      Movement: "과잉 행동",
      Angry: "분노",
      Self: "자기인식",
      default: "학교생활",
    };

    try {
      // 파싱. Client JSON 데이터
      if (typeof EBTData === "string") {
        parseEBTdata = JSON.parse(EBTData);
      } else parseEBTdata = EBTData;

      const { messageArr, type, score, pUid } = parseEBTdata;

      console.log(parseEBTdata);

      // uid, type 전처리. 없는 경우 디폴트값 할당
      parsepUid = pUid ? pUid : "njy95";
      parsingType = type ? type : "School";

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
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = messageArr;

      if (typeof score === "string") {
        parsingScore = JSON.parse(score);
      } else parsingScore = score;

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
              답변은 한글 200자 이내로 생성합니다.
              `,
          },
          ...parseMessageArr,
          {
            role: "user",
            content: `앞선 대화를 기반으로 ${testType[parsingType]}에 대한 아동의 심리 상태를 분석해줘. 분석이 끝나면 문제에 대한 해결 방안을 제시해줘`,
          },
        ],
        model: "gpt-4-1106-preview", // gpt-4-1106-preview, gpt-3.5-turbo-1106, gpt-3.5-turbo-instruct(Regercy), ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        temperature: 1,
      });

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

      /* 메일 전송 봉인
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

      /* DB 저장 */
      const table = EBT_Table_Info[type].table;
      const attribute = EBT_Table_Info[type].attribute;
      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      // 동기식 DB 접근 함수 1. Promise 생성 함수
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
          return results;
        } catch (error) {
          console.error(error);
        }
      }

      // 1. SELECT TEST (row가 있는지 없는지 검사)
      const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${parsepUid}'`;
      const ebt_data = await fetchUserData(connection_AI, select_query);

      // 2. UPDATE TEST (row값이 있는 경우 실행)
      if (ebt_data[0]) {
        const update_query = `UPDATE ${table} SET ${Object.values(attribute)
          .filter((el) => el !== "uid")
          .map((el) => {
            return `${el} = ?`;
          })
          .join(", ")} WHERE ${attribute.pKey} = ?`;
        // console.log(update_query);

        const update_value = [
          ...parsingScore,
          JSON.stringify({ ...mailOptions, date }),
          date,
          parsepUid,
        ];

        // console.log(update_value);

        connection_AI.query(
          update_query,
          update_value,
          (error, rows, fields) => {
            if (error) console.log(error);
            else console.log("AI Analysis Data DB UPDATE Success!");
          }
        );
      }
      // 3. INSERT TEST (row값이 없는 경우 실행)
      else {
        const insert_query = `INSERT INTO ${table} (${Object.values(
          attribute
        ).join(", ")}) VALUES (${Object.values(attribute)
          .map((el) => "?")
          .join(", ")})`;
        // console.log(insert_query);

        const insert_value = [
          parsepUid,
          ...parsingScore,
          JSON.stringify({ ...mailOptions, date }),
          date,
        ];
        // console.log(insert_value);

        connection_AI.query(
          insert_query,
          insert_value,
          (error, rows, fields) => {
            if (error) console.log(error);
            else console.log("AI Analysis Data DB INSERT Success!");
          }
        );
      }

      // res.json(message);
    } catch (err) {
      console.error(err);
      res.json({ message: "Server Error" });
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
          base_pupu,
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
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-1106, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      res.send(message);
    } catch (err) {
      // console.error(err.error);
      res.send(err);
    }
  },
  // 테스트 결과 기반 상담 AI. 정서행동 검사 - 학교생활 V1
  postOpenAIEmotionTestResultConsulting: async (req, res) => {
    const { messageArr } = req.body;
    // console.log("anxiety_depression");
    console.log("정서행동 검사 반영 상담 API /consulting_emotion Path 호출");
    // console.log(messageArr);

    let parseMessageArr,
      parseTestResult = {};

    parseTestResult.emotional_behavior = {
      adjust_school: 8,
      peer_relationship: -1,
      family_relationship: -1,
      overall_mood: -1,
      unrest: -1,
      depressed: -1,
      physical_symptoms: 7,
      focus: -1,
      hyperactivity: -1,
      aggression: -1,
      self_awareness: -1,
    };

    // console.log(JSON.stringify(parseTestResult.emotional_behavior));

    try {
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      const response = await openai.chat.completions.create({
        messages: [
          // Base Prompt
          base_pupu,
          // 정서행동결과 반영 Prompt
          // {
          //   role: "user",
          //   content: `
          //   다음에 오는 문단은 아동의 정서행동검사의 척도에 대한 설명입니다.
          //   '''
          //   ${behavioral_rating_scale}
          //   '''
          //   다음에 오는 문단은 아동의 정서행동검사 척도에 대한 기준입니다.
          //   score 값에 따라 위험/주의/경고 3가지 기준으로 나뉘어집니다.
          //   '''
          //   ${behavioral_rating_standard}
          //   '''
          //   다음에 오는 문단은 아동의 정서행동검사 결과입니다.
          //   객체의 각 변수값을 score에 대입합니다. 값이 -1일 경우 무시합니다.
          //   '''
          //   ${JSON.stringify(parseTestResult.emotional_behavior)}
          //   '''
          //   해당 결과를 반영하여 답변을 생성해주세요.
          //   `,
          // },
          ...parseMessageArr,
        ],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-1106, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);
      res.send(message);
    } catch (err) {
      // console.error(err.error);
      res.send(err);
    }
  },
  // 테스트 결과 기반 상담 AI. 정서행동 검사 - 학교생활 V2
  postOpenAIEmotionTestResultConsultingV2: async (req, res) => {
    const { messageArr, pUid } = req.body;
    console.log(
      "정서행동 검사- 학교생활 V2 반영 상담 API /consulting_emotion_v2 Path 호출"
    );
    let parseMessageArr, parsepUid; // Parsing 변수
    let test_prompt_content; // 심리 검사 결과 문장 저장 변수

    try {
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // pUid default값 설정
      parsepUid = pUid ? pUid : "njy95";
      // console.log(parsepUid);

      // 동기식 DB 접근 함수 1. Promise 생성 함수
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
          return results;
        } catch (error) {
          console.error(error);
        }
      }

      const user_table = "soyes_ai_Ebt_School"; // DB Table Name
      const user_attr = {
        pKey: "uid",
        // attr1: "",
      }; // DB Table Attribue

      const select_query = `SELECT * FROM ${user_table} WHERE ${user_attr.pKey}='${parsepUid}'`; // Select Query
      const ebt_school_data = await fetchUserData(connection_AI, select_query);

      // console.log(ebt_school_data[0]);
      delete ebt_school_data[0].uid; // uid 속성 삭제
      // Attribute의 값이 2인 요소의 배열 필터링
      const problem_attr_arr = Object.keys(ebt_school_data[0]);
      const problem_attr_nameArr = problem_attr_arr.filter(
        (el) => el.includes("question") && ebt_school_data[0][el] === 2
      );

      // 문답 개수에 따른 시나리오 문답 투척
      // Attribute의 값이 0인 요소가 없는 경우
      if (problem_attr_nameArr.length === 0) {
        test_prompt_content = "";

        console.log(test_prompt_content);
      } else {
        // 점수가 0인 값들 중 랜덤 문항 도출
        // const random_index = Math.floor(
        //   Math.random() * problem_attr_nameArr.length
        // );
        // // console.log(random_index);
        // const random_question = problem_attr_nameArr[random_index];
        // const selected_question = ebt_Question[random_question];
        // console.log(selected_question);

        test_prompt_content = problem_attr_nameArr
          .map((el) => ebt_School_Result[el])
          .join(" ");

        console.log(test_prompt_content);
      }

      /* 개발자 의도 질문 - N번째 문답에 대한 답변을 개발자가 임의로 지정 */

      // 유저 첫 질문 답변 - 정서행동검사 실시했음을 언급
      if (parseMessageArr.length === 1 && test_prompt_content) {
        parseMessageArr.push({
          role: "user",
          content: `마지막 질문에 대해 답변한 뒤, 내가 정서행동검사를 실시했음을 언급해줘. 해결책은 제시하지 말아줘.`,
        });
      }
      // 유저 네번째 질문 답변 - 정서행동검사 솔루션 제공
      if (parseMessageArr.length === 5 && test_prompt_content) {
        parseMessageArr.push({
          role: "user",
          content: `마지막 질문에 대해 답변한 뒤, 심리 검사 결과에 대한 해결책을 자연스럽게 추천해줘. 해결책을 이미 추천했다면 다른 해결책을 추천해줘.`,
        });
      }

      const response = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `다음에 오는 문단은 user의 정서행동검사 결과입니다.
            '''
            ${test_prompt_content}
            '''
            위 문단에 아무 내용이 없다면 user의 심리 상태는 문제가 없습니다.
            `,
          },
          base_pupu,
          ...parseMessageArr,
        ],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        // temperature: 1.2,
      });
      // gpt-4-turbo 모델은 OpenAI 유료고객(Plus 결제 회원) 대상으로 사용 권한 지급
      // console.log(response.choices[0]);

      const message = { message: response.choices[0].message.content };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);
      res.json(message);
    } catch (err) {
      console.error(err.error);
      res.json(err);
    }
  },
  // 공감친구 모델 - 푸푸
  postOpenAIEmotionTestResultConsultingV3: async (req, res) => {
    const { EBTData } = req.body;
    console.log(EBTData);
    console.log("푸푸 상담 API /consulting_emotion_pupu Path 호출");
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    // let prevChat_flag = true; // 이전 대화 내역 유무
    // console.log(req.session);
    try {
      if (typeof EBTData === "string") {
        parseEBTdata = JSON.parse(EBTData);
      } else parseEBTdata = EBTData;

      const { messageArr, pUid } = parseEBTdata;
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // pUid default값 설정
      parsepUid = pUid ? pUid : "njy95";

      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_pupu); // 페르소나 프롬프트 삽입
      promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

      const lastUserContent =
        parseMessageArr[parseMessageArr.length - 1].content; // 유저 마지막 멘트

      // NO REQ 질문 처리. 10초 이상 질문이 없을 경우 Client 측에서 'NO REQUEST' 메시지를 담은 요청을 보냄. 그에 대한 처리
      if (lastUserContent.includes("NO REQ")) {
        console.log("NO REQUEST 전달");

        parseMessageArr.push(no_req_prompt);
        promptArr.push(sentence_division_prompt);

        const response = await openai.chat.completions.create({
          messages: [...promptArr, ...parseMessageArr],
          model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        });

        res.json({
          message: response.choices[0].message.content,
          emotion: 0,
        });

        return;
      }

      /* 개발자 의도 질문 - N번째 문답에 대한 답변을 개발자가 임의로 지정 */

      // 유저 성격검사 결과 DB에서 가져오기
      const pt_result = await select_soyes_AI_Pt_Table(
        PT_Table_Info.table,
        PT_Table_Info.attribute,
        parsepUid
      );
      // console.log(pt_result);
      promptArr.push(persnal_result_prompt[pt_result]);

      // if (parseMessageArr.length === 1 && prevChat_flag) {
      //   // 이전 대화 프롬프트 삽입
      //   console.log("이전 대화 프롬프트 삽입");
      //   promptArr.push(prevChat_prompt);
      // }

      // if (parseMessageArr.length) {
      //   // 심리 검사 프롬프트 삽입
      //   console.log("심리 검사 프롬프트 삽입");
      //   promptArr.push(psy_testResult_prompt);
      //   promptArr.push(psyResult_prompt);
      //   promptArr.push(solution_prompt);
      // }

      // if (parseMessageArr.length === 17 || parseMessageArr.length === 19) {
      //   // 솔루션 프롬프트 삽입
      //   console.log("솔루션 프롬프트 삽입");
      //   promptArr.push(solution_prompt);
      // }

      // 상시 삽입 프롬프트

      promptArr.push(solution_prompt2); // 음악 명상 + 그림 명상 관련 솔루션 프롬프트
      promptArr.push(common_prompt); // 공통 프롬프트 삽입
      promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let emotion = parseInt(response.choices[0].message.content.slice(-1));
      // console.log(emotion);

      const message = {
        message: response.choices[0].message.content.slice(0, -1),
        emotion,
      };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);
      res.json(message);
    } catch (err) {
      console.error(err);
      res.json({
        message: "Server Error",
        emotion: 0,
      });
    }
  },
  // 정서멘토 모델 - 라라
  postOpenAIEmotionTestResultConsultingV4: async (req, res) => {
    const { EBTData } = req.body;
    console.log(EBTData);
    console.log("라라 상담 API /consulting_emotion_lala Path 호출");
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    // let prevChat_flag = true; // 이전 대화 내역 유무

    // 응답에 헤더를 추가하는 메서드
    // res.header("Test_Header", "Success Header");

    try {
      if (typeof EBTData === "string") {
        parseEBTdata = JSON.parse(EBTData);
      } else parseEBTdata = EBTData;

      const { messageArr, pUid } = parseEBTdata;
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // pUid default값 설정
      parsepUid = pUid ? pUid : "njy95";
      // console.log(parsepUid);

      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_lala); // 페르소나 프롬프트 삽입
      promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

      const lastUserContent =
        parseMessageArr[parseMessageArr.length - 1].content; // 유저 마지막 멘트

      // NO REQ 질문 처리. 10초 이상 질문이 없을 경우 Client 측에서 'NO REQUEST' 메시지를 담은 요청을 보냄. 그에 대한 처리
      if (lastUserContent.includes("NO REQ")) {
        console.log("NO REQUEST 전달");
        parseMessageArr.pop(); // 'NO REQUEST 질문 삭제'
        parseMessageArr.push(no_req_prompt);
        promptArr.push(sentence_division_prompt);

        const response = await openai.chat.completions.create({
          messages: [...promptArr, ...parseMessageArr],
          model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        });

        res.json({
          message: response.choices[0].message.content,
          emotion: 0,
        });

        return;
      }

      /* 프롬프트 삽입 분기 */

      // 심리 검사 결과 프롬프트 상시 삽입
      if (!req.session.psy_testResult_promptArr_last) {
        // 심리 검사 결과 프롬프트 삽입
        console.log("심리 검사 결과 프롬프트 삽입");
        let psy_testResult_promptArr_last = []; // 2점을 획득한 정서행동검사 문항을 저장하는 prompt
        // 해당 계정의 모든 정서행동검사 결과 DB에서 차출
        const psy_testResult_promptArr = EBT_classArr.map(async (ebt_class) => {
          const select_Ebt_Result = await select_soyes_AI_Ebt_Table(
            EBT_ObjArr[ebt_class].table, // Table Name
            {
              pKey: "uid",
            }, // primary Key Name
            EBT_ObjArr[ebt_class].result, // EBT Question 11가지 분야 중 1개 (Table에 따라 결정)
            parsepUid // Uid
          );

          // console.log(select_Ebt_Result);

          const psy_testResult_prompt = {
            role: "system",
            content: `다음에 오는 문단은 user의 ${ebt_class} 관련 심리검사 결과입니다.
    '''
    ${select_Ebt_Result.testResult}
    '''
    위 문단이 비어있다면 ${
      // DB Table의 값 유무에 따라 다른 프롬프트 입력
      !select_Ebt_Result.ebt_school_data[0]
        ? "user는 심리검사를 진행하지 않았습니다."
        : "user의 심리검사 결과는 문제가 없습니다."
    }`,
          };
          // console.log(psy_testResult_prompt);
          return psy_testResult_prompt;
        });
        // map method는 pending 상태의 promise를 반환하므로 Promise.all method를 사용하여 resolve 상태가 되기를 기다려준다.
        await Promise.all(psy_testResult_promptArr).then((prompt) => {
          psy_testResult_promptArr_last = [...prompt]; // resolve 상태로 반환된 prompt 배열을 psy_testResult_promptArr_last 변수에 복사
        });

        // console.log(psy_testResult_promptArr_last);

        promptArr.push(...psy_testResult_promptArr_last);
        promptArr.push(psyResult_prompt);
        // promptArr.push(solution_prompt);

        req.session.psy_testResult_promptArr_last = [
          ...psy_testResult_promptArr_last,
        ];
      } else {
        console.log("세션 저장된 심리 검사 결과 프롬프트 삽입");
        promptArr.push(...req.session.psy_testResult_promptArr_last);
        promptArr.push(psyResult_prompt);
      }

      let testClass = "",
        testClass_cb = "";
      // 검사 결과 분석 관련 멘트 감지
      if (
        !req.session.ebt_class &&
        test_result_ment.some((el) => {
          if (lastUserContent.includes(el)) {
            testClass = el;
            return true;
          } else return false;
        })
      ) {
        console.log(`정서행동검사 결과 - ${testClass} 분석 프롬프트 삽입`);
        // 분야-index 맵핑
        const class_map = {
          학교생활: 0,
          친구관계: 1,
          가족관계: 2,
          전반적기분: 3,
          불안: 4,
          우울: 5,
          신체증상: 6,
          주의집중: 7,
          과잉행동: 8,
          분노: 9,
          자기인식: 10,
        };
        // 감지된 분야 선택
        const random_class = EBT_classArr[class_map[testClass]];

        // 심리 결과 분석 프롬프트
        parseMessageArr.push({
          role: "user",
          content: `마지막 질문에 대해 1문장 이내로 답변한 뒤 (이해하지 못했으면 답변하지마), 
          '너의 심리검사 결과를 봤어!'라고 언급하면서 ${random_class} 관련 심리검사 결과를 분석한 아동의 심리 상태를 5문장 이내로 설명해줘.
          . 혹은 ? 같은 특수문자로 끝나는 각 마디 뒤에는 반드시 줄바꿈(\n)을 추가해줘.
          답변 마지막에는 '검사 결과에 대해 더 궁금한점이 있니?'를 추가해줘.`,
        });
        promptArr.push({
          role: "system",
          content: `이번 문답은 예외적으로 6문장 이내로 답변을 생성합니다.`,
        });
        // 랜덤 1개 분야 세션 추가
        req.session.ebt_class = random_class;
      }
      // 인지행동 세션 데이터가 없고, 인지행동 검사 관련 멘트 감지
      else if (
        !req.session.cb_class &&
        cb_solution_ment.some((el) => {
          if (lastUserContent.includes(el)) {
            testClass_cb = el;
            return true;
          } else return false;
        })
      ) {
        // 고정 답변3 프롬프트 삽입 - 인지행동 치료 문제
        console.log("인지행동 치료 프롬프트 삽입");
        let cb_testArr;

        const cb_class_map = {
          학교인지: cb_test_school,
          가족인지: cb_test_family,
          친구인지: cb_test_friend,
          그외인지: cb_test_remain,
        };

        // 감지된 인지행동 문제 분야 선택
        cb_testArr = cb_class_map[testClass_cb];
        req.session.cb_class = testClass_cb;

        const random_cb_index = Math.floor(Math.random() * cb_testArr.length);
        const random_cb_question = cb_testArr[random_cb_index];
        req.session.cb_question = random_cb_question;

        // console.log(random_cb_question);

        // 인지행동 문제 프롬프트
        parseMessageArr.push({
          role: "user",
          content: `마지막 질문에 대해 1문장 이내로 답변한 뒤 (이해하지 못했으면 답변하지마), 
          이후 '그 전에 우리 상황극 한 번 하자!' 라고 말한 뒤 다음 문단에 오는 인지행동 검사를 문제와 문항으로 나누어 user에게 제시해줘.

          ${random_cb_question.question}

          문항 앞에는 '1) 2) 3) 4)'같이 번호를 붙이고 점수는 제거해줘.
          답변 마지막에 '넌 이 상황에서 어떻게 할거야? 번호로 알려줘!'를 추가해줘.
          `,
        });
        promptArr.push({
          role: "system",
          content: `이번 문답은 예외적으로 8문장 이내로 답변을 생성합니다.`,
        });
      }
      // 인지행동 세션 데이터가 있는 경우
      else if (req.session.cb_class) {
        // 정답을 골랐을 경우
        if (lastUserContent.includes(req.session.cb_question.answer)) {
          console.log("인지행동 검사 정답 선택");
          parseMessageArr.push({
            role: "user",
            content: `'올바른 답을 골랐구나! 대단해!'를 말한 뒤 ${req.session.cb_question.answer}번 문항에 대한 견해를 2문장 이내로 답변해줘.`,
          });

          // 인지행동 관련 데이터 초기화
          delete req.session.cb_class;
          delete req.session.cb_question;
          delete req.session.cb_wrongCnt;
        }
        // 오답을 고를 경우
        else {
          console.log("인지행동 검사 오답 선택");
          // 오답 횟수 카운트
          if (!req.session.cb_wrongCnt) req.session.cb_wrongCnt = 1;
          else req.session.cb_wrongCnt++;

          // 오답 횟수 4회 미만
          if (req.session.cb_wrongCnt < 4) {
            parseMessageArr.push({
              role: "user",
              content: `'user'가 고른 문항에 대한 견해를 2문장 이내로 답변한 뒤, 마지막에는 '그치만 다시 한 번 생각해봐!' 를 추가해줘.
              (만약 문항을 고르지 않았다면 1문장 이내로 문제에 집중해달라고 'user'에게 부탁해줘. 이 때는 '그치만 다시 한 번 생각해봐!'를 추가하지마.)`,
            });
          }
          // 오답 횟수 4회 이상
          else {
            console.log("인지행동 검사 오답 4회 이상 선택 -> 정답 알려주기");
            parseMessageArr.push({
              role: "user",
              content: `'올바른 답은 ${req.session.cb_question.answer}번이였어!' 를 말한 뒤 마지막 ${req.session.cb_question.answer}번 문항에 대한 견해를 2문장 이내로 답변해줘.`,
            });

            // 인지행동 관련 데이터 초기화
            delete req.session.cb_class;
            delete req.session.cb_question;
            delete req.session.cb_wrongCnt;
          }
        }
      }
      // 아무런 분기도 걸리지 않을 경우
      else promptArr.push(sentence_division_prompt);

      /*
      // 답변 횟수 카운트
      if (!req.session.answerCnt || parseMessageArr.length === 1)
        req.session.answerCnt = 1;
      else if (req.session.answerCnt > 9) {
        // 답변 10회 이상 진행 시 세션 파괴
        req.session.destroy();
        res.clearCookie("connect.sid");
      } else req.session.answerCnt++;
      */

      // 상시 삽입 프롬프트
      // promptArr.push(sentence_division_prompt); // 문장 구분 프롬프트 삽입
      promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let emotion = parseInt(response.choices[0].message.content.slice(-1));
      console.log("emotion: " + emotion);

      const message = {
        message: response.choices[0].message.content.slice(0, -1),
        emotion,
      };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);

      // 세션 확인 코드
      // console.log(req.session);

      res.json(message);
    } catch (err) {
      console.error(err);
      res.json({
        message: "Server Error",
        emotion: 0,
      });
    }
  },
  // 공부친구 모델 - 우비
  postOpenAIEmotionTestResultConsultingV5: async (req, res) => {
    const { EBTData } = req.body;
    // console.log(EBTData);
    console.log("우비 상담 API /consulting_emotion_ubi Path 호출");
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    // let prevChat_flag = true; // 이전 대화 내역 유무
    // console.log(messageArr);
    try {
      if (typeof EBTData === "string") {
        parseEBTdata = JSON.parse(EBTData);
      } else parseEBTdata = EBTData;

      const { messageArr, pUid } = parseEBTdata;
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      parsepUid = pUid ? pUid : "njy95";

      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_ubi); // 페르소나 프롬프트 삽입
      promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

      const lastUserContent =
        parseMessageArr[parseMessageArr.length - 1].content; // 유저 마지막 멘트

      // NO REQ 질문 처리. 10초 이상 질문이 없을 경우 Client 측에서 'NO REQUEST' 메시지를 담은 요청을 보냄. 그에 대한 처리
      if (lastUserContent.includes("NO REQ")) {
        console.log("NO REQUEST 전달");

        parseMessageArr.push(no_req_prompt);
        promptArr.push(sentence_division_prompt);

        const response = await openai.chat.completions.create({
          messages: [...promptArr, ...parseMessageArr],
          model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        });

        res.json({
          message: response.choices[0].message.content,
          emotion: 0,
        });

        return;
      }

      // 유저 성격검사 결과 DB에서 가져오기
      const pt_result = await select_soyes_AI_Pt_Table(
        PT_Table_Info.table,
        PT_Table_Info.attribute,
        parsepUid
      );
      // console.log(pt_result);
      promptArr.push(persnal_result_prompt[pt_result]);

      // 상시 삽입 프롬프트
      promptArr.push(solution_prompt); // 학습 관련 솔루션 프롬프트
      promptArr.push(sentence_division_prompt); // 공통 프롬프트 삽입
      promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let emotion = parseInt(response.choices[0].message.content.slice(-1));
      // console.log(emotion);

      const message = {
        message: response.choices[0].message.content.slice(0, -1),
        emotion,
      };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);
      res.json(message);
    } catch (err) {
      console.error(err);
      res.json({
        message: "Server Error",
        emotion: 0,
      });
    }
  },
  // 전문상담사 모델 - 소예
  postOpenAIEmotionTestResultConsultingV6: async (req, res) => {
    const { EBTData } = req.body;
    console.log(EBTData);
    console.log("소예 상담 API /consulting_emotion_soyes Path 호출");
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    // let prevChat_flag = true; // 이전 대화 내역 유무

    // 응답에 헤더를 추가하는 메서드
    // res.header("Test_Header", "Success Header");

    try {
      if (typeof EBTData === "string") {
        parseEBTdata = JSON.parse(EBTData);
      } else parseEBTdata = EBTData;

      const { messageArr, pUid } = parseEBTdata;
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // pUid default값 설정
      parsepUid = pUid ? pUid : "njy95";
      // console.log(parsepUid);

      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_soyes); // 페르소나 프롬프트 삽입
      promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

      const lastUserContent =
        parseMessageArr[parseMessageArr.length - 1].content; // 유저 마지막 멘트

      // NO REQ 질문 처리. 10초 이상 질문이 없을 경우 Client 측에서 'NO REQUEST' 메시지를 담은 요청을 보냄. 그에 대한 처리
      if (lastUserContent.includes("NO REQ")) {
        console.log("NO REQUEST 전달");
        parseMessageArr.pop(); // 'NO REQUEST 질문 삭제'
        parseMessageArr.push(no_req_prompt);
        promptArr.push(sentence_division_prompt);

        const response = await openai.chat.completions.create({
          messages: [...promptArr, ...parseMessageArr],
          model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        });

        res.json({
          message: response.choices[0].message.content,
          emotion: 0,
        });

        return;
      }

      /* 프롬프트 삽입 분기 */

      // 심리 검사 결과 프롬프트 상시 삽입
      if (!req.session.psy_testResult_promptArr_last) {
        // 심리 검사 결과 프롬프트 삽입
        console.log("심리 검사 결과 프롬프트 삽입");
        let psy_testResult_promptArr_last = []; // 2점을 획득한 정서행동검사 문항을 저장하는 prompt
        // 해당 계정의 모든 정서행동검사 결과 DB에서 차출
        const psy_testResult_promptArr = EBT_classArr.map(async (ebt_class) => {
          const select_Ebt_Result = await select_soyes_AI_Ebt_Table(
            EBT_ObjArr[ebt_class].table, // Table Name
            {
              pKey: "uid",
            }, // primary Key Name
            EBT_ObjArr[ebt_class].result, // EBT Question 11가지 분야 중 1개 (Table에 따라 결정)
            parsepUid // Uid
          );

          // console.log(select_Ebt_Result);

          const psy_testResult_prompt = {
            role: "system",
            content: `다음에 오는 문단은 user의 ${ebt_class} 관련 심리검사 결과입니다.
  '''
  ${select_Ebt_Result.testResult}
  '''
  위 문단이 비어있다면 ${
    // DB Table의 값 유무에 따라 다른 프롬프트 입력
    !select_Ebt_Result.ebt_school_data[0]
      ? "user는 심리검사를 진행하지 않았습니다."
      : "user의 심리검사 결과는 문제가 없습니다."
  }`,
          };
          // console.log(psy_testResult_prompt);
          return psy_testResult_prompt;
        });
        // map method는 pending 상태의 promise를 반환하므로 Promise.all method를 사용하여 resolve 상태가 되기를 기다려준다.
        await Promise.all(psy_testResult_promptArr).then((prompt) => {
          psy_testResult_promptArr_last = [...prompt]; // resolve 상태로 반환된 prompt 배열을 psy_testResult_promptArr_last 변수에 복사
        });

        // console.log(psy_testResult_promptArr_last);

        promptArr.push(...psy_testResult_promptArr_last);
        promptArr.push(psyResult_prompt);
        // promptArr.push(solution_prompt);

        req.session.psy_testResult_promptArr_last = [
          ...psy_testResult_promptArr_last,
        ];
      } else {
        console.log("세션 저장된 심리 검사 결과 프롬프트 삽입");
        promptArr.push(...req.session.psy_testResult_promptArr_last);
        promptArr.push(psyResult_prompt);
      }

      // 검사 결과 분석 관련 멘트 감지
      let testClass = ""; // 감지 텍스트 저장 변수
      if (
        !req.session.ebt_class &&
        test_result_ment.some((el) => {
          if (lastUserContent.includes(el)) {
            testClass = el;
            return true;
          } else return false;
        })
      ) {
        console.log(`정서행동검사 결과 - ${testClass} 분석 프롬프트 삽입`);
        // 분야-index 맵핑
        const class_map = {
          학교생활: 0,
          친구관계: 1,
          가족관계: 2,
          전반적기분: 3,
          불안: 4,
          우울: 5,
          신체증상: 6,
          주의집중: 7,
          과잉행동: 8,
          분노: 9,
          자기인식: 10,
        };
        // 감지된 분야 선택
        const random_class = EBT_classArr[class_map[testClass]];

        // 랜덤 1개 분야 세션 추가
        req.session.ebt_class = random_class;

        // 심리 결과 분석 프롬프트
        parseMessageArr.push({
          role: "user",
          content: `마지막 질문에 대해 1문장 이내로 답변한 뒤 (이해하지 못했으면 답변하지마), 
          '너의 심리검사 결과를 봤어!'라고 언급하면서 ${random_class} 관련 심리검사 결과를 분석한 아동의 심리 상태를 5문장 이내로 설명해줘.
          . 혹은 ? 같은 특수문자로 끝나는 각 마디 뒤에는 반드시 줄바꿈(\n)을 추가해줘.
          답변 마지막에는 '검사 결과에 대해 더 궁금한점이 있니?'를 추가해줘.`,
        });
        promptArr.push({
          role: "system",
          content: `이번 문답은 예외적으로 6문장 이내로 답변을 생성합니다.`,
        });
      }
      // 아무런 분기도 걸리지 않을 경우
      else promptArr.push(sentence_division_prompt);

      /*
      // 답변 횟수 카운트
      if (!req.session.answerCnt || parseMessageArr.length === 1)
        req.session.answerCnt = 1;
      else if (req.session.answerCnt > 9) {
        // 답변 10회 이상 진행 시 세션 파괴
        req.session.destroy();
        res.clearCookie("connect.sid");
      } else req.session.answerCnt++;
      */

      // 상시 삽입 프롬프트
      // promptArr.push(sentence_division_prompt); // 문장 구분 프롬프트 삽입
      promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let emotion = parseInt(response.choices[0].message.content.slice(-1));
      console.log("emotion: " + emotion);

      const message = {
        message: response.choices[0].message.content.slice(0, -1),
        emotion,
      };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);

      // 세션 확인 코드
      // console.log(req.session);

      res.json(message);
    } catch (err) {
      console.error(err);
      res.json({
        message: "Server Error",
        emotion: 0,
      });
    }
  },
  // 테스트 결과 기반 상담 AI. 정서행동, 성격검사, 진로검사 - V1 (박사님 프롬프트)
  postOpenAITestResultConsultingV1: async (req, res) => {
    const { EBTData } = req.body;

    console.log("Test 결과 반영 검사- V1 상담 API /consulting_lala Path 호출");
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    // let prevChat_flag = true; // 이전 대화 내역 유무

    // EBT 반영 Class 정의
    // const EBT_classArr = ["School", "Friend", "Family"];
    // const EBT_ObjArr = {
    //   School: { table: "soyes_ai_Ebt_School", result: ebt_School_Result },
    //   Friend: { table: "soyes_ai_Ebt_Friend", result: ebt_Friend_Result },
    //   Family: { table: "soyes_ai_Ebt_Family", result: ebt_Family_Result },
    // };

    try {
      if (typeof EBTData === "string") {
        parseEBTdata = JSON.parse(EBTData);
      } else parseEBTdata = EBTData;

      const { messageArr, pUid } = parseEBTdata;

      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // pUid default값 설정
      parsepUid = pUid ? pUid : "njy95";
      // console.log(parsepUid);

      // 고정 삽입 프롬프트
      // promptArr.push(persona_prompt_lala2); // 페르소나 프롬프트 삽입
      // promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

      // 박사님 프롬프트 삽입
      if (parsepUid.includes("20240304_v2")) {
        console.log("test_prompt_20240304_v2 삽입");
        promptArr.push(test_prompt_20240304_v2);
      } else if (parsepUid.includes("20240305_v1")) {
        console.log("test_prompt_20240305_v1 삽입");
        promptArr.push(test_prompt_20240305_v1);
      } else {
        console.log("test_prompt_20240304 삽입");
        promptArr.push(test_prompt_20240304);
      }

      // let psy_testResult_promptArr_last = []; // 2점을 획득한 정서행동검사 문항을 저장하는 prompt

      // 해당 계정의 모든 정서행동검사 결과 DB에서 차출
      //     const psy_testResult_promptArr = EBT_classArr.map(async (ebt_class) => {
      //       const select_Ebt_School_result = await select_soyes_AI_Ebt_Table(
      //         EBT_ObjArr[ebt_class].table, // Table Name
      //         {
      //           pKey: "uid",
      //         }, // primary Key Name
      //         EBT_ObjArr[ebt_class].result, // EBT Question 11가지 분야 중 1개 (Table에 따라 결정)
      //         parsepUid // Uid
      //       );

      //       // console.log(select_Ebt_School_result);

      //       const psy_testResult_prompt = {
      //         role: "system",
      //         content: `다음에 오는 문단은 user의 ${ebt_class} 관련 심리검사 결과입니다.
      // '''
      // ${select_Ebt_School_result.testResult}
      // '''
      // 위 문단이 비어있다면 ${
      //   // DB Table의 값 유무에 따라 다른 프롬프트 입력
      //   !select_Ebt_School_result.ebt_school_data[0]
      //     ? "user는 심리검사를 진행하지 않았습니다."
      //     : "user의 심리검사 결과는 문제가 없습니다."
      // }`,
      //       };
      //       // console.log(psy_testResult_prompt);
      //       return psy_testResult_prompt;
      //     });

      //     // map method는 pending 상태의 promise를 반환하므로 Promise.all method를 사용하여 resolve 상태가 되기를 기다려준다.
      //     await Promise.all(psy_testResult_promptArr).then((prompt) => {
      //       psy_testResult_promptArr_last = [...prompt]; // resolve 상태로 반환된 prompt 배열을 psy_testResult_promptArr_last 변수에 복사
      //     });

      // console.log(psy_testResult_promptArr_last);

      /* 개발자 의도 질문 - N번째 문답에 대한 답변을 개발자가 임의로 지정 */

      // if (parseMessageArr.length) {
      //   // 심리 검사 결과 프롬프트 삽입
      //   console.log("심리 검사 결과 프롬프트 삽입");
      //   promptArr.push(...psy_testResult_promptArr_last);
      //   promptArr.push(psyResult_prompt);
      //   promptArr.push(solution_prompt);
      // }

      // if (parseMessageArr.length === 1) {
      //   // 고정 답변1 프롬프트 삽입
      //   console.log("고정 답변1 프롬프트 삽입");

      //   const random_class =
      //     EBT_classArr[Math.floor(Math.random() * EBT_classArr.length)];
      //   console.log(random_class);
      //   parseMessageArr.push({
      //     role: "user",
      //     content: `마지막 질문에 대해 1문장 이내로 답변한 뒤 (이해하지 못했으면 답변하지마), '너의 심리검사 결과를 봤어!'라고 언급하면서 ${random_class} 관련 심리검사 결과를 5문장 이내로 설명해줘. 이후 '검사 결과에 대해 더 궁금한점이 있니?'를 추가해줘.`,
      //   });
      //   promptArr.push({
      //     role: "system",
      //     content: `이번 문답은 예외적으로 6문장 이내로 답변을 생성합니다.`,
      //   });
      // }

      // if (parseMessageArr.length === 17 || parseMessageArr.length === 19) {
      //   // 솔루션 프롬프트 삽입
      //   console.log("솔루션 프롬프트 삽입");
      //   promptArr.push(solution_prompt);
      // }

      // 상시 삽입 프롬프트
      // promptArr.push(common_prompt); // 공통 프롬프트 삽입
      promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let emotion = parseInt(response.choices[0].message.content.slice(-1));
      // console.log(emotion);

      const message = {
        message: response.choices[0].message.content.slice(0, -1),
        emotion,
      };
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);
      res.json(message);
    } catch (err) {
      console.error(err);
      res.json({
        message: "Server Error",
        emotion: 0,
      });
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

// jenkins 테스트용 주석

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
