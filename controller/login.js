// Redis 연결
const redisStore = require("../DB/redisClient");

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
const moment = require("moment-timezone");

// JWT 관련
const { sign, verify } = require("jsonwebtoken");
// JWT 토큰 생성
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
  };
  let result = {
    accessToken: sign(payload, process.env.ACCESS_SECRET, {
      expiresIn: "1d", // 1일간 유효한 토큰을 발행합니다.
    }),
    refreshToken: sign(payload, process.env.REFRESH_SECRET, {
      expiresIn: "7d", // 일주일간 유효한 토큰을 발행합니다.
    }),
  };

  return result;
};
// JWT 토큰 검증
const verifyToken = (type, token) => {
  let secretKey, decoded;
  // access, refresh에 따라 비밀키 선택
  switch (type) {
    case "access":
      secretKey = process.env.ACCESS_SECRET;
      break;
    case "refresh":
      secretKey = process.env.REFRESH_SECRET;
      break;
    default:
      return null;
  }

  try {
    // 토큰을 비밀키로 복호화
    decoded = verify(token, secretKey);
  } catch (err) {
    // 토큰 만료 에러
    if (err.name === "TokenExpiredError") {
      console.log(`JWT Error: Token has expired`);
      return "expired";
    }

    console.log(`JWT Error: ${err.message}`);
    return null;
  }
  return decoded;
};

const { OAuth2Client } = require("google-auth-library");
// google OAuth2Client 설정 (App 전용)
const oAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.APP_REDIRECT_URL_GOOGLE
);
// google OAuth2Client 설정 (WebGL 전용)
const oAuth2ClientWebGL = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.WEBGL_REDIRECT_URL_GOOGLE
);

const { google } = require("googleapis");

// kakao OAuth 관련
const axios = require("axios");

// Database Table Info
const {
  User_Table_Info,
  Plan_Table_Info,
  Subscription_Table_Info,
} = require("../DB/database_table_info");

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

const user_ai_select = async (user_table, user_attribute, parsepUid) => {
  const select_query = `SELECT * FROM ${user_table} WHERE ${user_attribute.pKey}='${parsepUid}'`;
  const select_data = await fetchUserData(connection_AI, select_query);

  return select_data;
};

const loginController = {
  // JWT 토큰 유효성 검사
  vaildateToken: (req, res, next) => {
    const accessToken = req.session.accessToken;
    const refreshToken = req.cookies.refreshToken;
    // accessToken이 있는 경우
    if (accessToken) {
      const decoded = verifyToken("access", accessToken);
      // 토큰 만료
      if (decoded === "expired")
        return res.status(401).json({ message: "Token has expired" });

      if (users.find((user) => user.id === decoded.id)) {
        res.json({ message: "AccessToken Login Success" });
      }
      // refreshToken만 있는 경우
    } else if (refreshToken) {
      const decoded = verifyToken("refresh", refreshToken);
      // 토큰 만료
      if (decoded === "expired")
        return res.status(401).json({ message: "Token has expired" });

      if (users.find((user) => user.id === decoded.id)) {
        // accessToken 생성 후 세션에 저장
        req.session.accessToken = generateToken({
          id: decoded.id,
          // email: `${decoded.id}@naver.com`,
        }).accessToken;
        res.json({ message: "RefreshToken Login Success" });
      }
    } else next();
  },
  // JWT 토큰 로그인
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
          // req.session.refreshToken = token.refreshToken;

          res.json({ data: "Login Success" });
        } else res.json({ data: "Login fail" });
      }
    );

    // DB없이 서버 내장 데이터 사용
    // if (users.find((el) => el.id === id && el.pwd === pwd)) {
    //   res.json("Login Success");
    // } else res.json("Login Fail");
  },
  // JWT 토큰 로그아웃
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
  // AI RefreshToken 인증
  postAIRefreshTokenCertHandler: async (req, res) => {
    const { data } = req.body;
    // console.log(data);
    let parseLoginData;
    try {
      // 입력값 파싱
      if (typeof data === "string") {
        parseLoginData = JSON.parse(data);
      } else parseLoginData = data;

      const { refreshToken } = parseLoginData;
      // const sessionId = req.sessionID;

      // Non refreshToken
      if (!refreshToken) {
        return res
          .status(400)
          .json({ message: "Non refreshToken Value - 400 Bad Request" });
      }

      // let parsepUid = pUid;
      let parseRefreshToken = refreshToken;

      // refreshToken 복호화
      const decoded = verifyToken("refresh", parseRefreshToken);

      // 토큰 만료
      if (decoded === "expired")
        return res.status(401).json({
          // message: "Token has expired - 401 UNAUTHORIZED",
          message: "로그인 세션이 만료되었습니다. 재로그인 바랍니다!",
        });

      console.log(`RefreshToken 인증 API 호출 - pUid: ${decoded.id}`);

      const user_table = User_Table_Info.table;
      const user_attribute = User_Table_Info.attribute;

      // 1. SELECT (row가 있는지 없는지 검사)
      // User 계정 DB SELECT Method. uid를 입력값으로 받음
      const ebt_data = await user_ai_select(
        user_table,
        user_attribute,
        decoded.id
      );

      // DB 회원 정보 조회
      if (!ebt_data[0]) {
        console.log("Non User - 401 UNAUTHORIZED");
        return res.status(401).json({
          message: "Non User - 401 UNAUTHORIZED",
        });
      }

      // 유효하지 않은 refreshToken 양식일 경우
      if (!decoded) {
        console.log("Invalid token format - 401 UNAUTHORIZED");
        return res.status(401).json({
          // message: "Invalid token format - 401 UNAUTHORIZED",
          message: "유효하지 않은 인증 방식입니다. 재로그인 바랍니다.",
        });
      }

      // decoded 값이 있는 경우
      if (decoded.id) {
        // JWT Token 재발급 후 세션 저장
        const token = generateToken({
          id: decoded.id,
          // email: decoded.email,
        });

        // Session 내부에 accessToken 저장
        // req.session.accessToken = token.accessToken;

        // cookie refreshToken 갱신
        res.cookie("refreshToken", token.refreshToken, {
          maxAge: 7 * 24 * 60 * 60 * 1000, // 쿠키 갱신 (7일)
          httpOnly: true,
          sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
          secure: process.env.DEV_OPS !== "local",
        });

        console.log(`User RefreshToken Update Success! - pUid: ${decoded.id}`);

        // Redis에서 기존 세션 ID 확인
        // redisStore.get(`user_session:${decoded.id}`, (err, oldSessionId) => {
        //   if (oldSessionId) {
        //     // 기존 세션 무효화
        //     redisStore.destroy(`user_session:${decoded.id}`, (err, reply) => {
        //       // console.log("Previous session invalidated");
        //     });
        //   }

        //   // 새 세션 ID를 사용자 ID와 연결
        //   redisStore.set(
        //     `user_session:${decoded.id}`,
        //     sessionId,
        //     (err, reply) => {
        //       // 로그인 처리 로직
        //       // console.log(`SessionID Update - ${sessionId}`);
        //     }
        //   );
        // });

        // User Table 로그인 날짜 갱신
        const dateObj = new Date();
        const year = dateObj.getFullYear();
        const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
        const day = ("0" + dateObj.getDate()).slice(-2);
        const date = `${year}-${month}-${day}`;

        const table = User_Table_Info.table;
        const attribute = User_Table_Info.attribute;

        const update_query = `UPDATE ${table} SET ${attribute.attr7} = ? WHERE ${attribute.pKey} = ?`;
        // console.log(update_query);

        const update_value = [date, decoded.id];
        // console.log(update_value);

        connection_AI.query(
          update_query,
          update_value,
          (error, rows, fields) => {
            if (error) {
              console.log(error.sqlMessage);
              return res.status(404).json({ message: error.sqlMessage });
            }
            // console.log("User Last Login Log Update Success!");
          }
        );

        // 이용권 만료일 확인
        const sub_table = Subscription_Table_Info["Subscription"].table;

        const sub_select_query = `SELECT 
        subscription_expiration_date
        FROM ${sub_table}
        WHERE uid='${decoded.id}'`;
        const sub_select_data = await fetchUserData(
          connection_AI,
          sub_select_query
        );

        // 토큰 인증
        return res.status(200).json({
          message: `User RefreshToken Certification Success! - pUid: ${decoded.id}`,
          pUid: decoded.id,
          refreshToken: token.refreshToken,
          expirationDate: sub_select_data.length
            ? sub_select_data[0]?.subscription_expiration_date
            : "",
        });
      }
      // 만료된 RefreshToken 복호화 ID와 입력 ID가 다를 경우
      else {
        console.log(
          "Uid Does Not Match RefreshToekn Decoding Payload ID - 401 UNAUTHORIZED"
        );
        // client 전송
        res.status(401).json({
          message:
            "Uid Does Not Match RefreshToekn Decoding Payload ID - 401 UNAUTHORIZED",
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server Error - 500 Bad Gateway" });
    }
  },
  // (SoyesAI Mobile) Google OAuth URL 발급
  oauthUrlHandler: (req, res) => {
    console.log("Google OAuth URL 발급 API 호출");
    try {
      const SCOPES = [
        "https://www.googleapis.com/auth/userinfo.profile", // 기본 프로필
        // "https://www.googleapis.com/auth/userinfo.email", // 이메일 권한 잠금
      ];

      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline", // 필요한 경우
        scope: SCOPES,
      });

      // console.log(authUrl);
      res.status(200).json({ url: authUrl });
    } catch (err) {
      console.error(err);
      res.status(500).json({ url: "Non" });
    }
  },
  // (SoyesAI Mobile) Google OAuth Redirect Url
  oauthGoogleRedirectUrlHandler: async (req, res) => {
    const query = req.query;
    const { code } = query;
    console.log("Google OAuth AccessToken 발급 API 호출");
    const sessionId = req.sessionID;
    let parseUid = "",
      parseEmail = "";
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

          const { id } = response.data;

          const table = User_Table_Info.table;
          const attribute = User_Table_Info.attribute;
          // 오늘 날짜 변환
          const dateObj = new Date();
          const year = dateObj.getFullYear();
          const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
          const day = ("0" + dateObj.getDate()).slice(-2);
          const date = `${year}-${month}-${day}`;

          // DB 계정 생성
          // 1. SELECT USER (row가 있는지 없는지 검사)
          const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${response.data.id}'`;
          const ebt_data = await fetchUserData(connection_AI, select_query);

          // 2. INSERT USER (row값이 없는 경우 실행)
          if (!ebt_data[0]) {
            parseUid = id;
            // parseEmail = email;
            const insert_query = `INSERT INTO ${table} (${Object.values(
              attribute
            ).join(", ")}) VALUES (${Object.values(attribute)
              .map((el) => "?")
              .join(", ")})`;
            // console.log(insert_query);

            const insert_value = [
              id,
              null,
              null,
              null,
              null,
              "google",
              date,
              date,
            ];
            // console.log(insert_value);

            // 계정 생성 쿼리 임시 주석
            connection_AI.query(
              insert_query,
              insert_value,
              (error, rows, fields) => {
                if (error) console.log(error);
                else console.log("OAuth User Row DB INSERT Success!");
              }
            );
          }
          // 3. UPDATE USER (row값이 있는 경우 실행)
          else {
            parseUid = ebt_data[0].uid;
            parseEmail = ebt_data[0].Email;
            // Update LastLoginDate
            const update_query = `UPDATE ${table} SET ${Object.values(attribute)
              .filter((el) => el === "lastLogin_date")
              .map((el) => {
                return `${el} = ?`;
              })
              .join(", ")} WHERE ${attribute.pKey} = ?`;
            // console.log(update_query);

            const update_value = [date, id];
            // console.log(update_value);

            connection_AI.query(
              update_query,
              update_value,
              (error, rows, fields) => {
                if (error) console.log(error);
                else console.log("Google OAuth User Data UPDATE Success!");
              }
            );
          }

          // JWT Token 발급 후 세션 저장
          const token = generateToken({
            id: parseUid,
            // email: parseEmail,
          });

          // Session 내부에 accessToken 저장
          // req.session.accessToken = token.accessToken;
          // browser Cookie에 refreshToken 저장
          // res.cookie("refreshToken", token.refreshToken, {
          //   maxAge: 7 * 24 * 60 * 60 * 1000,
          //   httpOnly: true,
          //   sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
          //   secure: process.env.DEV_OPS !== "local",
          // });

          // Redis에서 기존 세션 ID 확인
          // redisStore.get(`user_session:${parseUid}`, (err, oldSessionId) => {
          //   if (oldSessionId) {
          //     // 기존 세션 무효화
          //     redisStore.destroy(`user_session:${parseUid}`, (err, reply) => {
          //       console.log("Previous session invalidated");
          //     });
          //   }
          //   // 새 세션 ID를 사용자 ID와 연결
          //   redisStore.set(
          //     `user_session:${parseUid}`,
          //     sessionId,
          //     (err, reply) => {
          //       // 로그인 처리 로직
          //       console.log(`[${parseUid}] SessionID Update - ${sessionId}`);
          //     }
          //   );
          // });

          // res.json({ data: response.data });

          // ejs 파일을 활용한 서버 html 렌더링 후 클라이언트 전송
          res.render("userInfo", {
            data: JSON.stringify({
              data: response.data,
              refreshToken: token.refreshToken,
            }),
          });
        });
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ data: "Server Error!" });
    }
  },
  // (SoyesAI Mobile) Kakao OAuth URL 발급
  oauthKakaoUrlHandler: (req, res) => {
    console.log("Kakao OAuth URL 발급 API 호출");
    try {
      const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${
        process.env.KAKAO_REST_API_KEY
      }&redirect_uri=${process.env.APP_REDIRECT_URL}&state=${Math.random()
        .toString(36)
        .substring(7)}`;
      return res.status(200).json({ url: kakaoAuthUrl });
    } catch (err) {
      console.error(err);
      res.json({ url: "Server Error" });
    }
  },
  // (SoyesAI Mobile) Kakao OAuth Redirect Url
  oauthKakaoRedirectUrlHandler: async (req, res) => {
    const query = req.query;
    const { code } = query;
    console.log("Kakao OAuth Redirect Url API 호출");
    // console.log(code);
    const sessionId = req.sessionID;
    let parseUid = "",
      parseEmail = "";

    try {
      if (!code) return res.status(200).json({ text: "code가 없음!" });
      // POST 요청으로 액세스 토큰 요청
      const tokenResponse = await axios.post(
        "https://kauth.kakao.com/oauth/token",
        null,
        {
          params: {
            grant_type: "authorization_code",
            client_id: process.env.KAKAO_REST_API_KEY, // 카카오 개발자 콘솔에서 발급받은 REST API 키
            redirect_uri: `${process.env.APP_REDIRECT_URL}`, // 카카오 개발자 콘솔에 등록한 리디렉션 URI
            code: code, // 클라이언트로부터 받은 권한 코드
          },
          headers: {
            "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
          },
        }
      );

      // console.log(tokenResponse);

      const response = await axios.get("https://kapi.kakao.com/v2/user/me", {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`,
          "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
        },
      });

      // 성공적으로 사용자 정보를 받아옴
      // console.log(response.data);

      // DB 계정 생성 파트
      const { id } = response.data;
      // const { email } = response.data.kakao_account;

      const table = User_Table_Info.table;
      const attribute = User_Table_Info.attribute;
      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      // DB 계정 생성

      // 1. SELECT USER (row가 있는지 없는지 검사)
      const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${response.data.id}'`;
      const ebt_data = await fetchUserData(connection_AI, select_query);

      // console.log(ebt_data);

      // 2. INSERT USER (row값이 없는 경우 실행)
      if (!ebt_data[0]) {
        parseUid = id;

        const insert_query = `INSERT INTO ${table} (${Object.values(
          attribute
        ).join(", ")}) VALUES (${Object.values(attribute)
          .map((el) => "?")
          .join(", ")})`;
        // console.log(insert_query);

        const insert_value = [id, null, null, null, null, "kakao", date, date];
        // console.log(insert_value);

        // 계정 생성 쿼리 임시 주석
        connection_AI.query(
          insert_query,
          insert_value,
          (error, rows, fields) => {
            if (error)
              console.log(
                "Kakao OAuth User Row DB INSERT: " + error.sqlMessage
              );
            else console.log("Kakao OAuth User Row DB INSERT Success!");
          }
        );
      } else {
        parseUid = ebt_data[0].uid;
        parseEmail = ebt_data[0].Email;
        // Update LastLoginDate
        const update_query = `UPDATE ${table} SET ${Object.values(attribute)
          .filter((el) => el === "lastLogin_date")
          .map((el) => {
            return `${el} = ?`;
          })
          .join(", ")} WHERE ${attribute.pKey} = ?`;
        // console.log(update_query);

        const update_value = [date, id];
        // console.log(update_value);

        connection_AI.query(
          update_query,
          update_value,
          (error, rows, fields) => {
            if (error)
              console.log(
                "KaKao OAuth User Data UPDATE Fail: " + error.sqlMessage
              );
            else console.log("KaKao OAuth User Data UPDATE Success!");
          }
        );
      }

      // JWT Token 발급 후 세션 저장
      const token = generateToken({
        id: parseUid,
        // email: parseEmail,
      });

      // Session 내부에 accessToken 저장
      // req.session.accessToken = token.accessToken;
      // browser Cookie에 refreshToken 저장
      // res.cookie("refreshToken", token.refreshToken, {
      //   maxAge: 24 * 60 * 60 * 1000,
      //   httpOnly: true,
      //   sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
      //   secure: process.env.DEV_OPS !== "local",
      // });

      // Redis에서 기존 세션 ID 확인
      // redisStore.get(`user_session:${parseUid}`, (err, oldSessionId) => {
      //   if (oldSessionId) {
      //     // 기존 세션 무효화
      //     redisStore.destroy(`user_session:${parseUid}`, (err, reply) => {
      //       console.log("Previous session invalidated");
      //     });
      //   }
      //   // 새 세션 ID를 사용자 ID와 연결
      //   redisStore.set(`user_session:${parseUid}`, sessionId, (err, reply) => {
      //     // 로그인 처리 로직
      //     console.log(`[${parseUid}] SessionID Update - ${sessionId}`);
      //   });
      // });

      // 클라이언트에 사용자 정보 응답
      // res.json({ data: response.data });

      // ejs 파일을 활용한 서버 html 렌더링 후 클라이언트 전송

      // render
      res.render("userInfo", {
        data: JSON.stringify({
          data: response.data,
          refreshToken: token.refreshToken,
        }),
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ data: "Server Error!" });
    }
  },
  // (SoyesAI Mobile) AI 애플 로그인
  postAIAppleLoginHandler: async (req, res) => {
    const { data } = req.body;
    let parseLoginData;
    let parsepUid = "";

    try {
      // 입력값 파싱
      if (typeof data === "string") {
        parseLoginData = JSON.parse(data);
      } else parseLoginData = data;

      const { id } = parseLoginData;
      const sessionId = req.sessionID;

      // pUid 없을 경우
      if (!id) {
        console.log("Non pUid Value - 400 Bad Request");
        return res
          .status(400)
          .json({ message: "Non pUid Value - 400 Bad Request" });
      }

      parsepUid = id;
      // let parsePassWard = passWord;

      console.log(`Apple Login API 호출 - pUid: ${parsepUid}`);

      /* User DB 조회 */
      // User Table && attribut 명시
      const user_table = User_Table_Info.table;
      const user_attribute = User_Table_Info.attribute;

      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      // 1. SELECT TEST (row가 있는지 없는지 검사)
      // User 계정 DB SELECT Method. uid를 입력값으로 받음
      const ebt_data = await user_ai_select(
        user_table,
        user_attribute,
        parsepUid
      );

      // 2. INSERT User 계정이 없는 경우
      if (!ebt_data[0]) {
        const insert_query = `INSERT INTO ${user_table} (${Object.values(
          user_attribute
        ).join(", ")}) VALUES (${Object.values(user_attribute)
          .map((el) => "?")
          .join(", ")})`;
        // console.log(insert_query);

        const insert_value = [
          parsepUid,
          null,
          null,
          null,
          null,
          "apple",
          date,
          date,
        ];
        // console.log(insert_value);

        // 계정 생성 쿼리 임시 주석
        connection_AI.query(
          insert_query,
          insert_value,
          (error, rows, fields) => {
            if (error)
              console.log(
                "Apple OAuth User Row DB INSERT: " + error.sqlMessage
              );
            else console.log("Apple OAuth User Row DB INSERT Success!");
          }
        );
      }

      // 3. UPDATE User 계정이 있는 경우
      else {
        // 최종 로그인 날짜 갱신
        const update_query = `UPDATE ${user_table} SET ${Object.values(
          user_attribute
        )
          .filter((el) => el === "lastLogin_date")
          .map((el) => {
            return `${el} = ?`;
          })
          .join(", ")} WHERE ${user_attribute.pKey} = ?`;
        // console.log(update_query);

        const update_value = [date, parsepUid];
        // console.log(update_value);

        connection_AI.query(
          update_query,
          update_value,
          (error, rows, fields) => {
            if (error)
              console.log(
                "Apple OAuth User Row DB UPDATE: " + error.sqlMessage
              );
            else console.log("Apple OAuth User Row DB UPDATE Success!");
          }
        );
      }

      // JWT Token 발급 후 세션 저장
      const token = generateToken({
        id: parsepUid,
        // email: ebt_data[0].Email,
      });

      // Session 내부에 accessToken 저장
      // req.session.accessToken = token.accessToken;

      // browser Cookie에 refreshToken 저장
      res.cookie("refreshToken", token.refreshToken, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
        secure: process.env.DEV_OPS !== "local",
      });

      // const expire = String(dateObj.setHours(dateObj.getHours() + 1));

      // Redis에서 기존 세션 ID 확인
      // redisStore.get(`user_session:${parsepUid}`, (err, oldSessionId) => {
      //   if (oldSessionId) {
      //     // 기존 세션 무효화
      //     redisStore.destroy(`user_session:${parsepUid}`, (err, reply) => {
      //       // console.log("Previous session invalidated");
      //     });
      //   }
      //   // 새 세션 ID를 사용자 ID와 연결
      //   redisStore.set(`user_session:${parsepUid}`, sessionId, (err, reply) => {
      //     // 로그인 처리 로직
      //     // console.log(`[${parsepUid}] SessionID Update - ${sessionId}`);
      //   });
      // });

      // client 전송
      return res.status(200).json({
        pUid: parsepUid,
        message: "User Apple Login Success! - 200 OK",
        refreshToken: token.refreshToken,
        // expire,
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Server Error - 500 Bad Gateway" });
    }
  },
  // (SoyesAI Mobile) AI Guest 로그인
  postAIGuestLoginHandler: async (req, res) => {
    const query = req.query;
    const { tag } = query;
    try {
      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const hours = ("0" + dateObj.getHours()).slice(-2);
      const minutes = ("0" + dateObj.getMinutes()).slice(-2);
      const seconds = ("0" + dateObj.getSeconds()).slice(-2);
      const milliseconds = ("00" + dateObj.getMilliseconds()).slice(-3);
      const date = `${year}-${month}-${day}`;
      const guestDate = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;

      // 2024.10.29 tag 쿼리 추가 - VR 유저 식별 처리
      let parsepUid = `${tag ? "VR_" : ""}guest${guestDate}`;
      const sessionId = req.sessionID;
      console.log(`Guest Login API 호출! - pUid: ${parsepUid}`);

      const table = User_Table_Info.table;
      const attribute = User_Table_Info.attribute;

      // DB에 Row가 없을 경우 INSERT, 있으면 지정한 속성만 UPDATE
      const insert_query = `INSERT INTO ${table} (${attribute.pKey}, ${attribute.attr1}, ${attribute.attr5}, ${attribute.attr6}, ${attribute.attr7}) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE
      ${attribute.attr7} = VALUES(${attribute.attr7});`;
      // console.log(insert_query);

      const insert_value = [
        parsepUid, // uid
        `${parsepUid}@google.com`, // email
        "guest", // oauth_type
        date, // creation_date
        date, // lastLogin_date
      ];
      // console.log(insert_value);

      connection_AI.query(insert_query, insert_value, (error, rows, fields) => {
        if (error) {
          console.log(error.sqlMessage);
          return res.status(404).json({ message: error.sqlMessage });
        }
        // Guest JWT 생성
        const token = generateToken({
          id: parsepUid,
          // email: `${parsepUid}@google.com`,
        });

        // Server Session accessToken 저장
        // req.session.accessToken = token.accessToken;
        // Client Cookie refreshToken 저장
        res.cookie("refreshToken", token.refreshToken, {
          maxAge: 24 * 60 * 60 * 1000, // 쿠키 유효기간 1일로 설정
          httpOnly: true,
          sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
          secure: process.env.DEV_OPS !== "local",
        });

        // 중복 로그인 제한 처리 - Redis에서 기존 세션 ID 확인
        redisStore.get(`user_session:${parsepUid}`, (err, oldSessionId) => {
          if (oldSessionId) {
            // 기존 세션 무효화
            redisStore.destroy(`user_session:${parsepUid}`, (err, reply) => {
              // console.log("Previous session invalidated");
            });
          }
          // 새 세션 ID를 사용자 ID와 연결
          redisStore.set(
            `user_session:${parsepUid}`,
            sessionId,
            (err, reply) => {
              // 로그인 처리 로직
              // console.log(`[${parsepUid}] SessionID Update - ${sessionId}`);
            }
          );
        });

        // client 전송
        return res.status(200).json({
          pUid: parsepUid,
          message: "User Login Success! - 200 OK",
          refreshToken: token.refreshToken,
          // expire,
        });
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Server Error - 500 Bad Gateway" });
    }
  },
  // AI Guest RefreshToken 재발급 + 로그인
  postAIGuestReLoginHandler: async (req, res) => {
    const { data } = req.body;
    // console.log(data);
    let parseLoginData;
    try {
      // 입력값 파싱
      if (typeof data === "string") {
        parseLoginData = JSON.parse(data);
      } else parseLoginData = data;

      const { pUid, refreshToken } = parseLoginData;
      const sessionId = req.sessionID;

      // Non refreshToken
      if (!refreshToken) {
        return res
          .status(400)
          .json({ message: "Non refreshToken Value - 400 Bad Request" });
      }

      // let parsepUid = pUid;
      let parseRefreshToken = refreshToken;

      // refreshToken 복호화
      const decoded = verifyToken("refresh", parseRefreshToken);

      // 토큰 만료
      if (decoded === "expired")
        return res.status(401).json({
          message: "Token has expired - 401 UNAUTHORIZED",
        });

      console.log(`RefreshToken 인증 API 호출 - pUid: ${decoded.id}`);

      const user_table = User_Table_Info.table;
      const user_attribute = User_Table_Info.attribute;

      // 1. SELECT (row가 있는지 없는지 검사)
      // User 계정 DB SELECT Method. uid를 입력값으로 받음
      const ebt_data = await user_ai_select(
        user_table,
        user_attribute,
        decoded.id
      );

      // DB 회원 정보 조회
      if (!ebt_data[0]) {
        console.log("Non User - 401 UNAUTHORIZED");
        return res.status(401).json({
          message: "Non User - 401 UNAUTHORIZED",
        });
      }

      // 유효하지 않은 refreshToken 양식일 경우
      if (!decoded) {
        console.log("Invalid token format - 401 UNAUTHORIZED");
        return res.status(401).json({
          message: "Invalid token format - 401 UNAUTHORIZED",
        });
      }

      // decoded 값이 있는 경우
      if (decoded.id) {
        // JWT Token 재발급 후 세션 저장
        // const token = generateToken({
        //   id: decoded.id,
        //   email: decoded.email,
        // });

        // Session 내부에 accessToken 저장
        // req.session.accessToken = token.accessToken;

        // cookie refreshToken 갱신
        res.cookie("refreshToken", refreshToken, {
          maxAge: 24 * 60 * 60 * 1000, // 세션 토큰값 갱신
          httpOnly: true,
          sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
          secure: process.env.DEV_OPS !== "local",
        });

        console.log(`User RefreshToken Update Success! - pUid: ${decoded.id}`);

        // Redis에서 기존 세션 ID 확인
        redisStore.get(`user_session:${decoded.id}`, (err, oldSessionId) => {
          if (oldSessionId) {
            // 기존 세션 무효화
            redisStore.destroy(`user_session:${decoded.id}`, (err, reply) => {
              // console.log("Previous session invalidated");
            });
          }

          // 새 세션 ID를 사용자 ID와 연결
          redisStore.set(
            `user_session:${decoded.id}`,
            sessionId,
            (err, reply) => {
              // 로그인 처리 로직
              // console.log(`SessionID Update - ${sessionId}`);
            }
          );
        });

        // User Table 로그인 날짜 갱신
        const dateObj = new Date();
        const year = dateObj.getFullYear();
        const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
        const day = ("0" + dateObj.getDate()).slice(-2);
        const date = `${year}-${month}-${day}`;

        const table = User_Table_Info.table;
        const attribute = User_Table_Info.attribute;

        const update_query = `UPDATE ${table} SET ${attribute.attr7} = ? WHERE ${attribute.pKey} = ?`;
        // console.log(update_query);

        const update_value = [date, decoded.id];
        // console.log(update_value);

        connection_AI.query(
          update_query,
          update_value,
          (error, rows, fields) => {
            if (error) {
              console.log(error.sqlMessage);
              return res.status(404).json({ message: error.sqlMessage });
            }
            // console.log("User Last Login Log Update Success!");
          }
        );

        // 토큰 인증
        return res.status(200).json({
          message: `User RefreshToken Certification Success! - pUid: ${decoded.id}`,
          pUid: decoded.id,
        });
      }
      // 만료된 RefreshToken 복호화 ID와 입력 ID가 다를 경우
      else {
        console.log(
          "Uid Does Not Match RefreshToekn Decoding Payload ID - 401 UNAUTHORIZED"
        );
        // client 전송
        res.status(401).json({
          message:
            "Uid Does Not Match RefreshToekn Decoding Payload ID - 401 UNAUTHORIZED",
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server Error - 500 Bad Gateway" });
    }
  },
  // (구) AI Kakao OAuth 로그인
  postSocialAppLoginHandler: async (req, res) => {
    const { data, code } = req.body;
    console.log("Kakao OAuth App Login API 호출");
    // 현재 카카오 소셜 로그인은 사업자등록을 해두지 않았기에 닉네임 + KakaoEmail 정보만 가져올 수 있습니다.
    const sessionId = req.sessionID;
    let parseData, parsepUid;
    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, Email, type, name, phoneNumber } = parseData;

      if (!pUid) {
        console.log("Non pUid input value - 404");
        return res.status(404).json({ message: "Non pUid input value - 404" });
      }
      if (!type) {
        console.log("Non type input value - 404");
        return res.status(404).json({ message: "Non type input value - 404" });
      }

      parsepUid = pUid;

      // 유저 테이블
      const user_table = User_Table_Info.table;
      const user_attribute = User_Table_Info.attribute;
      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      // DB 관련 처리
      // 1. SELECT USER (row가 있는지 없는지 검사)
      const select_query = `SELECT * FROM ${user_table} WHERE ${user_attribute.pKey}='${parsepUid}'`;
      const select_data = await fetchUserData(connection_AI, select_query);

      // User 계정이 있는 경우 (row값이 있는 경우 실행)
      if (select_data[0]) {
        // 최종 로그인 날짜 갱신
        const update_query = `UPDATE ${user_table} SET ${Object.values(
          user_attribute
        )
          .filter((el) => el === "lastLogin_date")
          .map((el) => {
            return `${el} = ?`;
          })
          .join(", ")} WHERE ${user_attribute.pKey} = ?`;
        // console.log(update_query);

        const update_value = [date, parsepUid];
        // console.log(update_value);

        connection_AI.query(
          update_query,
          update_value,
          (error, rows, fields) => {
            if (error)
              console.log("User Login Date UPDATE Fail: " + error.sqlMessage);
            else console.log("User Login Date UPDATE Success!");
          }
        );

        // JWT Token 발급 후 세션 저장
        const token = generateToken({
          id: select_data[0].uid,
          // email: select_data[0].Email,
        });

        // Session 내부에 accessToken 저장
        req.session.accessToken = token.accessToken;
        // browser Cookie에 refreshToken 저장
        res.cookie("refreshToken", token.refreshToken, {
          maxAge: 3600000,
          httpOnly: true,
          sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
          secure: process.env.DEV_OPS !== "local",
        });

        // 토큰 만료일 (1시간)
        const expire = String(dateObj.setHours(dateObj.getHours() + 1));

        // Redis에서 기존 세션 ID 확인
        redisStore.get(`user_session:${parsepUid}`, (err, oldSessionId) => {
          if (oldSessionId) {
            // 기존 세션 무효화
            redisStore.destroy(`user_session:${parsepUid}`, (err, reply) => {
              console.log("Previous session invalidated");
            });
          }
          // 새 세션 ID를 사용자 ID와 연결
          redisStore.set(
            `user_session:${parsepUid}`,
            sessionId,
            (err, reply) => {
              // 로그인 처리 로직
              console.log(`[${parsepUid}] SessionID Update - ${sessionId}`);
            }
          );
        });

        console.log(`User Login Success! - 200 OK (pUid: ${parsepUid})`);
        // client 전송
        return res.status(200).json({
          message: "User Social Login Success! - 200 OK",
          refreshToken: token.refreshToken,
          expire,
        });
      }
      // User 계정이 없는 경우 (row값이 없는 경우 실행)
      else {
        console.log(`Non User - 404 Not Found (pUid: ${parsepUid})`);
        return res.status(404).json({ message: "Non User - 404 Not Found" });
      }
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ data: "Server Error!" });
    }
  },
  // AI 로그아웃 - 인증 삭제
  getAILogoutHandler: async (req, res) => {
    console.log("AI Logout API 호출");
    // console.log(req.cookies);
    const refreshToken = req.cookies.refreshToken;
    try {
      // refreshToken 있을 경우 - Redis Sid 삭제
      // refreshToken이 없는 상태에선 반드시 로그인을 해야함.
      // 로그인 시 자동으로 Redis SessionID는 갱신되므로 refreshToken이 있는 경우에만 Redis SessionID를 삭제한다.
      if (refreshToken) {
        const decoded = verifyToken("refresh", refreshToken);
        // refreshToken이 만료되지 않은 경우
        if (decoded !== "expired") {
          // Redis SessionID 삭제
          redisStore.get(`user_session:${decoded.id}`, (err, oldSessionId) => {
            if (err) {
              console.error("Error fetching old session ID:", err);
              return; // 에러 발생 시 추가 처리 중지
            }
            if (oldSessionId) {
              console.log("oldSessionId Destroy");
              // 기존 세션 무효화
              redisStore.destroy(`user_session:${decoded.id}`, (err) => {
                if (err) {
                  console.error(err);
                  return;
                }
                console.log("RedisStore Session ID Delete Success!");
              });
            }
          });
        }
      }

      // 세션 삭제
      req.session.destroy((err) => {
        if (err) console.error("세션 삭제 중 에러 발생", err);
      });
      // 쿠키 삭제
      res.clearCookie("connect.sid", {
        sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
        secure: process.env.DEV_OPS !== "local",
      });
      res.clearCookie("refreshToken", {
        sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
        secure: process.env.DEV_OPS !== "local",
      });
      res.status(200).json({ message: "Logout Success! - 200 OK" });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server Error - 500 Bad Gateway" });
    }
  },
  // (SoyesAI Mobile) AI 회원탈퇴
  deleteAIUserDeleteHandler: async (req, res) => {
    console.log("AI 회원탈퇴 API 호출");
    const { data } = req.body;
    console.log(data);
    let parseData;
    try {
      // 입력값 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      // data 없을 경우
      if (!parseData) {
        console.log("Non data Input Value - 400 Bad Request");
        return res
          .status(400)
          .json({ message: "Non data Input Value - 400 Bad Request" });
      }

      const { pUid } = parseData;

      // pUid 없을 경우
      if (!pUid) {
        console.log("Non pUid Input Value - 400 Bad Request");
        return res
          .status(400)
          .json({ message: "Non pUid Input Value - 400 Bad Request" });
      }

      let parsepUid = pUid;

      console.log(`User Delete API 호출 - pUid: ${parsepUid}`);

      /* User DB 조회 */
      // User Table && attribut 명시
      const user_table = User_Table_Info.table;
      const user_attribute = User_Table_Info.attribute;

      // 1. SELECT (row가 있는지 없는지 검사)
      // User 계정 DB SELECT Method. uid를 입력값으로 받음
      const ebt_data = await user_ai_select(
        user_table,
        user_attribute,
        parsepUid
      );

      console.log(ebt_data[0]);

      // User 계정이 있는 경우 (row값이 있는 경우 실행)
      if (ebt_data[0]) {
        // 회원 삭제 쿼리
        const delete_query = `DELETE FROM ${user_table} WHERE ${user_attribute.pKey} = ?`;

        connection_AI.query(delete_query, [parsepUid], (err) => {
          if (err) {
            console.log(err);
            return res.status(400).json({ message: err.sqlMessage });
          }
          console.log("User DB Delete Success!");
          return res.status(200).json({ message: "User DB Delete Success!" });
        });
      }
      // User 계정이 없는 경우 (row값이 없는 경우 실행)
      else {
        console.log(`Non User - 400 Not Found (pUid: ${parsepUid})`);
        return res.status(400).json({ message: "Non User - 400 Not Found" });
      }
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Server Error - 500 Bad Gateway" });
    }
  },
  // (WebGL) Kakao OAuth URL 발급
  oauthWebGLKakaoUrlHandler: (req, res) => {
    console.log("WebGL Kakao OAuth URL 발급 API 호출");
    try {
      const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${
        process.env.KAKAO_REST_API_KEY
      }&redirect_uri=${process.env.WEBGL_REDIRECT_URL}&state=${Math.random()
        .toString(36)
        .substring(7)}`;
      return res.status(200).json({ url: kakaoAuthUrl });
    } catch (err) {
      console.error(err);
      res.json({ url: "Server Error" });
    }
  },
  // (WebGL) Kakao OAuth Redirect Url
  oauthWebGLKakaoRedirectUrlHandler: async (req, res) => {
    const query = req.query;
    const { code } = query;
    console.log("WebGL Kakao OAuth Redirect Url API 호출");
    // console.log(code);
    let parseUid = "";

    try {
      if (!code) return res.status(200).json({ text: "code가 없음!" });
      // POST 요청으로 액세스 토큰 요청
      const tokenResponse = await axios.post(
        "https://kauth.kakao.com/oauth/token",
        null,
        {
          params: {
            grant_type: "authorization_code",
            client_id: process.env.KAKAO_REST_API_KEY, // 카카오 개발자 콘솔에서 발급받은 REST API 키
            redirect_uri: `${process.env.WEBGL_REDIRECT_URL}`, // 카카오 개발자 콘솔에 등록한 리디렉션 URI
            code: code, // 클라이언트로부터 받은 권한 코드
          },
          headers: {
            "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
          },
        }
      );

      // console.log(tokenResponse);

      const response = await axios.get("https://kapi.kakao.com/v2/user/me", {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`,
          "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
        },
      });

      // DB 계정 생성 파트
      const { id } = response.data;
      // const { email } = response.data.kakao_account;

      const table = User_Table_Info.table;
      const attribute = User_Table_Info.attribute;
      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      // DB 계정 생성

      // 1. SELECT USER (row가 있는지 없는지 검사)
      const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${response.data.id}'`;
      const ebt_data = await fetchUserData(connection_AI, select_query);

      // console.log(ebt_data);

      // 2. INSERT USER (row값이 없는 경우 실행)
      if (!ebt_data[0]) {
        parseUid = id;

        const insert_query = `INSERT INTO ${table} (${Object.values(
          attribute
        ).join(", ")}) VALUES (${Object.values(attribute)
          .map((el) => "?")
          .join(", ")})`;
        // console.log(insert_query);

        const insert_value = [id, null, null, null, null, "kakao", date, date];
        // console.log(insert_value);

        // 계정 생성 쿼리 임시 주석
        connection_AI.query(
          insert_query,
          insert_value,
          (error, rows, fields) => {
            if (error)
              console.log(
                "Kakao OAuth User Row DB INSERT: " + error.sqlMessage
              );
            else console.log("Kakao OAuth User Row DB INSERT Success!");
          }
        );
      } else {
        parseUid = ebt_data[0].uid;
        parseEmail = ebt_data[0].Email;
        // Update LastLoginDate
        const update_query = `UPDATE ${table} SET ${Object.values(attribute)
          .filter((el) => el === "lastLogin_date")
          .map((el) => {
            return `${el} = ?`;
          })
          .join(", ")} WHERE ${attribute.pKey} = ?`;
        // console.log(update_query);

        const update_value = [date, id];
        // console.log(update_value);

        connection_AI.query(
          update_query,
          update_value,
          (error, rows, fields) => {
            if (error)
              console.log(
                "KaKao OAuth User Data UPDATE Fail: " + error.sqlMessage
              );
            else console.log("KaKao OAuth User Data UPDATE Success!");
          }
        );
      }

      // JWT Token 발급 후 세션 저장
      const token = generateToken({
        id: parseUid,
        // email: parseEmail,
      });

      // View Template Render
      res.render("userInfoWebGL", {
        data: JSON.stringify({
          data: response.data,
          refreshToken: token.refreshToken,
        }),
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ data: "Server Error!" });
    }
  },
  // (WebGL) Google OAuth URL 발급
  oauthWebGLUrlHandler: (req, res) => {
    console.log("WebGL Google OAuth URL 발급 API 호출");
    try {
      const SCOPES = [
        "https://www.googleapis.com/auth/userinfo.profile", // 기본 프로필
        // "https://www.googleapis.com/auth/userinfo.email", // 이메일 권한 잠금
      ];

      const authUrl = oAuth2ClientWebGL.generateAuthUrl({
        access_type: "offline", // 필요한 경우
        scope: SCOPES,
      });

      // console.log(authUrl);
      res.status(200).json({ url: authUrl });
    } catch (err) {
      console.error(err);
      res.status(500).json({ url: "Non" });
    }
  },
  // (WebGL) Google OAuth Redirect Url
  oauthWebGLGoogleRedirectUrlHandler: async (req, res) => {
    console.log("WebGL Google OAuth AccessToken 발급 API 호출");
    const query = req.query;
    const { code } = query;
    let parseUid = "";

    try {
      oAuth2ClientWebGL.getToken(code, (err, token) => {
        if (err) return console.error("Error retrieving access token", err);
        oAuth2ClientWebGL.setCredentials(token);

        // 액세스 토큰을 사용하여 API를 호출할 수 있습니다.
        const oauth2 = google.oauth2({
          auth: oAuth2ClientWebGL,
          version: "v2",
        });

        // 유저 정보 GET
        oauth2.userinfo.get(async (err, response) => {
          if (err) return console.error(err);
          // console.log(response.data);

          const { id } = response.data;

          const table = User_Table_Info.table;
          const attribute = User_Table_Info.attribute;
          // 오늘 날짜 변환
          const dateObj = new Date();
          const year = dateObj.getFullYear();
          const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
          const day = ("0" + dateObj.getDate()).slice(-2);
          const date = `${year}-${month}-${day}`;

          // DB 계정 생성
          // 1. SELECT USER (row가 있는지 없는지 검사)
          const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${response.data.id}'`;
          const ebt_data = await fetchUserData(connection_AI, select_query);

          // 2. INSERT USER (row값이 없는 경우 실행)
          if (!ebt_data[0]) {
            parseUid = id;
            // parseEmail = email;
            const insert_query = `INSERT INTO ${table} (${Object.values(
              attribute
            ).join(", ")}) VALUES (${Object.values(attribute)
              .map((el) => "?")
              .join(", ")})`;
            // console.log(insert_query);

            const insert_value = [
              id,
              null,
              null,
              null,
              null,
              "google",
              date,
              date,
            ];
            // console.log(insert_value);

            // 계정 생성 쿼리 임시 주석
            connection_AI.query(
              insert_query,
              insert_value,
              (error, rows, fields) => {
                if (error) console.log(error);
                else console.log("WebGL OAuth User Row DB INSERT Success!");
              }
            );
          }
          // 3. UPDATE USER (row값이 있는 경우 실행)
          else {
            parseUid = ebt_data[0].uid;
            parseEmail = ebt_data[0].Email;
            // Update LastLoginDate
            const update_query = `UPDATE ${table} SET ${Object.values(attribute)
              .filter((el) => el === "lastLogin_date")
              .map((el) => {
                return `${el} = ?`;
              })
              .join(", ")} WHERE ${attribute.pKey} = ?`;
            // console.log(update_query);

            const update_value = [date, id];
            // console.log(update_value);

            connection_AI.query(
              update_query,
              update_value,
              (error, rows, fields) => {
                if (error) console.log(error);
                else
                  console.log("WebGL Google OAuth User Data UPDATE Success!");
              }
            );
          }

          // JWT Token 발급 후 세션 저장
          const token = generateToken({
            id: parseUid,
            // email: parseEmail,
          });

          // View Template Render
          res.render("userInfoWebGL", {
            data: JSON.stringify({
              data: response.data,
              refreshToken: token.refreshToken,
            }),
          });
        });
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ data: "Server Error!" });
    }
  },
  // [늘봄] 로그인
  postSpringLoginHandler: async (req, res) => {
    const { data } = req.body;
    let parseLoginData, parsepUid;
    try {
      // 입력값 파싱
      if (typeof data === "string") {
        parseLoginData = JSON.parse(data);
      } else parseLoginData = data;

      const { userName, userGender, userSchool, userGrade, userClass } =
        parseLoginData;

      // No Required Login Data => return
      if (!userName || !userGender || !userSchool || !userGrade || !userClass) {
        console.log(
          "Spring Login Err: No Required Login Data input value - 400"
        );
        return res
          .status(400)
          .json({ message: "No Required Login Data input value - 400" });
      }

      parsepUid = `${userSchool}_${userGrade}_${userClass}_${userGender}_${userName}`;
      console.log(`[늘봄] Login API 호출! - pUid: ${parsepUid}`);

      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      const table = User_Table_Info.table;

      // DB에 Row가 없을 경우 INSERT, 있으면 지정한 속성만 UPDATE
      const duple_query = `
        INSERT INTO ${table}
        (uid, oauth_type, creation_date, lastLogin_date)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        lastLogin_date = VALUES(lastLogin_date);`;
      // console.log(insert_query);

      const duple_value = [parsepUid, "spring", date, date];
      // console.log(insert_value);

      connection_AI.query(
        duple_query,
        duple_value,
        (error, results, fields) => {
          if (error) {
            console.log(error.sqlMessage);
            return res.status(400).json({ message: error.sqlMessage });
          }
          // JWT 생성
          const token = generateToken({
            id: parsepUid,
          });

          // Client Cookie refreshToken 저장
          res.cookie("refreshToken", token.refreshToken, {
            maxAge: 24 * 60 * 60 * 1000, // 쿠키 유효기간 1일로 설정
            httpOnly: true,
            sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
            secure: process.env.DEV_OPS !== "local",
          });

          // client 전송
          return res.status(200).json({
            message: "User Login Success! - 200 OK",
            pUid: parsepUid,
            refreshToken: token.refreshToken,
          });
        }
      );
    } catch (err) {
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
      });
    }
  },
  // (Middle Ware) SoyesAI JWT 토큰 유효성 검사
  vaildateTokenConsulting: async (req, res, next) => {
    const { data } = req.body;
    // console.log(data);
    // Session data 조회
    const accessToken = req.session.accessToken;
    const refreshToken = req.cookies.refreshToken;
    const sessionId = req.sessionID;

    // console.log(refreshToken);

    // User Table && attribut 명시
    const user_table = User_Table_Info.table;
    const user_attribute = User_Table_Info.attribute;

    let parseData;
    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid } = parseData;

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }

      console.log(`RefreshToken Vaild Check Middle Ware - pUid:${pUid}`);

      // #기능 잠금# accessToken이 있는 경우 - accessToken은 세션에 저장된 값이기 때문에 비교적 간단한 검사 진행
      if (false) {
        console.log("AccessToken Check!");
        // accessToken Decoding
        const decoded = verifyToken("access", accessToken);
        // 토큰 만료
        if (decoded === "expired") {
          // 만료된 토큰 데이터 삭제
          req.session.destroy((err) => {
            if (err) console.error("세션 삭제 중 에러 발생", err);
          });
          res.clearCookie("refreshToken", {
            sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
            secure: process.env.DEV_OPS !== "local",
          });
          return res.status(401).json({ message: "Token has expired - 401" });
        }
        if (decoded.id) {
          // Redis 중복 로그인 확인
          redisStore.get(`user_session:${decoded.id}`, (err, prevSid) => {
            // Redis 저장된 sid가 있는 경우
            if (prevSid) {
              // 현재 Sid와 Redis Sid가 다른 경우 - 중복 로그인
              if (prevSid !== sessionId) {
                console.log(
                  `Duplicated Session 401 Unauthorized - ${decoded.id}`
                );
                return res
                  .status(401)
                  .json({ message: "Duplicated Session - 401 Unauthorized" });
              }
              // Sid 일치 - 유효성 검증 통과
              console.log(`AccessToken 유효성 검증 통과! - ${decoded.id}`);
              next();
            }
            // Redis에 저장된 Sid가 없는 경우 - 첫 로그인 OR Redis 자동 삭제
            else {
              console.log("Redis Store prevSid 값이 없음");
              // Redis Sid를 현재 Sid로 갱신
              redisStore.set(
                `user_session:${decoded.id}`,
                sessionId,
                (err, reply) => {
                  // 로그인 처리 로직
                  console.log(`AccessToken SessionID Update - ${sessionId}`);
                }
              );
              next();
            }
          });
        }
        // AccessToken에 id 값이 없는 경우 - 유효한(서버 발급) 토큰이 아닌 경우
        else {
          console.log(`Invaild AccessToken`);
          return res.status(400).json({ message: "Invaild AccessToken - 400" });
        }
      }
      // refreshToken만 있는 경우 - User Table 조회
      else if (refreshToken) {
        console.log(`RefreshToken Check! - ${refreshToken}`);
        // refreshToken 복호화
        const decoded = verifyToken("refresh", refreshToken);
        // 토큰 만료
        if (decoded === "expired") {
          console.log(`RefreshToken Expired! - pUid:${pUid}`);
          // 만료된 토큰 데이터 삭제
          req.session.destroy((err) => {
            if (err) console.error("세션 삭제 중 에러 발생", err);
          });
          // refreshToken 쿠키 삭제
          res.clearCookie("refreshToken", {
            sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
            secure: process.env.DEV_OPS !== "local",
          });
          return res.status(401).json({
            message:
              "로그인 세션이 만료되었습니다. 로그아웃 후 재로그인 바랍니다! (Token has expired)",
          });
        }
        // 입력 pUid와 토큰 해석 id와 일치하지 않는 경우
        if (pUid !== decoded.id) {
          console.log(
            `Input Payload pUid Not Match RefreshToken Decoded pUid - pUid:${pUid}`
          );
          return res.status(401).json({
            message:
              "로그인 세션이 만료되었습니다. 로그아웃 후 재로그인 바랍니다! (pUid Not Match RefreshToken Decoded ID)",
          });
        }
        // User Table 조회
        const select_data = await user_ai_select(
          user_table,
          user_attribute,
          decoded.id
        );
        // User가 존재할 경우
        if (select_data[0]) {
          // Token 재발행 후 세션에 저장
          // req.session.accessToken = generateToken({
          //   id: ebt_data[0].uid,
          //   email: ebt_data[0].Email,
          // }).accessToken;

          // Redis SessionID Update
          redisStore.set(
            `user_session:${decoded.id}`,
            sessionId,
            (err, reply) => {
              // 로그인 처리 로직
              // console.log(`refreshToken SessionID Update - ${sessionId}`);
            }
          );
          console.log(`RefreshToken 유효성 검증 통과! - ${decoded.id}`);
          next();
        }
        // User가 없는 경우 - 해킹 시도
        else {
          console.log(`RefreshToken Non User! 400 - ${decoded.id}`);
          return res
            .status(400)
            .json({ message: "존재하지 않는 회원입니다.(Non User)" });
        }
      }
      // Token 미발급 상태 - 로그인 권장
      else {
        console.log("Non RefreshToken Cookie! - 401");
        return res.status(401).json({
          message:
            "로그인 세션이 만료되었습니다. 로그아웃 후 재로그인 바랍니다! (Non RefreshToken Cookie)",
        });
      }
    } catch (err) {
      console.log(err.message);
      res.status(500).json({ message: "Server Error - 500" });
    }
  },
  // (Middle Ware) Plan 유효성 검사 - 서비스 이용
  vaildatePlan: async (req, res, next) => {
    const accessToken = req.session.accessToken;
    const refreshToken = req.cookies.refreshToken;

    const user_plan_table = Plan_Table_Info["Plan"].table;
    const user_plan_attribute = Plan_Table_Info["Plan"].attribute;

    let parseUid = "",
      decoded;
    try {
      // 0. Token 값을 통한 uid 조회
      if (accessToken) decoded = verifyToken("access", accessToken);
      else if (refreshToken) decoded = verifyToken("refresh", refreshToken);
      else
        return res.status(401).json({ message: "Login Session Expire! - 401" });

      // 토큰 만료
      if (decoded === "expired")
        return res.status(401).json({ message: "Token has expired - 401" });

      parseUid = decoded.id;
      const today = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");

      // 1. User Redis expiry 조회
      let userExpiryDate = await redisStore.get(
        `user:expiry:${parseUid}`,
        (err, data) => data
      );
      // console.log("userExpiryDate: " + userExpiryDate);

      // 2. User Redis expiry 값이 있는 경우 - 오늘 날짜와 expiry 값 비교
      if (userExpiryDate) {
        // 2-1. 만료되지 않은 경우 - next();
        if (new Date(userExpiryDate) >= new Date(today)) {
          console.log(`Plan 유효성 검증 통과! - ${parseUid}`);
          next();
        }
        // 2-2. 만료된 경우 - 접근 제한 (만료된 유저)
        else {
          console.log(`Expired User 401 - ${parseUid}`);
          return res.status(401).json({ message: "Expired User - 401" });
        }
      }
      // 3. User Redis expiry 값이 없는 경우
      else {
        // 3-0. User_Plan 테이블에 해당 유저가 있는지 조회
        const user_plan_data = await user_ai_select(
          user_plan_table,
          user_plan_attribute,
          parseUid
        );
        // console.log(user_plan_data[0]);
        // 3-1. User Plan이 있는 경우 - Redis expiry 데이터 갱신 후 만료 여부 판단
        if (user_plan_data[0]) {
          const { expirationDate } = user_plan_data[0];
          // Redis expiry 데이터 갱신
          await redisStore.set(
            `user:expiry:${parseUid}`,
            expirationDate,
            (err, reply) => {
              console.log(`User Plan Redis Update - ${parseUid}`);
            }
          );
          // 만료 여부 판단
          if (new Date(expirationDate) >= new Date(today)) {
            console.log(`Plan 유효성 검증 통과! - ${parseUid}`);
            next();
          } else {
            console.log(`Expired User 401 - ${parseUid}`);
            return res.status(401).json({ message: "Expired User - 401" });
          }
        }
        // 3-2. User Plan이 없는 경우 - 접근 제한 (미결제 유저)
        else {
          console.log(`Unpaid User 401 - ${parseUid}`);
          return res.status(401).json({ message: "Unpaid User - 401" });
        }
      }
    } catch (err) {
      console.log(err.message);
      res.status(500).json({ message: "Server Error - 500" });
    }
  },
  // (Middle Ware) SoyesAI 유저 이용 권한 유효성 검사
  vaildateUserSubscriptionAuth: async (req, res, next) => {
    const { data } = req.body;
    // const accessToken = req.session.accessToken;
    // const refreshToken = req.cookies.refreshToken;
    const subscription_auth = req.session.subscription_auth;
    // console.log(subscription_auth);
    // 세션에 이용권한 존재
    if (subscription_auth) {
      console.log("세션 이용권한 패스");
      next();
      return;
    }

    let parsepUid = "",
      parseData;
    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid } = parseData;

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }

      parsepUid = pUid;
      const today = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");

      const sub_table = Subscription_Table_Info["Subscription"].table;
      const sub_select_query = `SELECT
      subscription_expiration_date,
      subscription_status
      FROM ${sub_table}
      WHERE uid='${parsepUid}'`;

      const sub_select_data = await fetchUserData(
        connection_AI,
        sub_select_query
      );
      // console.log(sub_select_data[0]);

      // 이용권한 체크
      if (sub_select_data.length) {
        const { subscription_expiration_date, subscription_status } =
          sub_select_data[0];
        // 이용 권한 존재
        if (new Date(subscription_expiration_date) >= new Date(today)) {
          if (!req.session.subscription_auth)
            req.session.subscription_auth = true;
          next();
          return;
        }
        // 이용권 만료
        else {
          console.log(
            `이용 권한이 만료된 회원입니다 (Expired User) - ${parsepUid}`
          );
          // 이용권 상태 갱신
          if (subscription_status === "active") {
            const update_query = `UPDATE ${sub_table} SET
            subscription_status = ?
            WHERE uid = ?`;

            const update_value = ["expired", parsepUid];

            try {
              await queryAsync(connection_AI, update_query, update_value);
              console.log(
                `User Subscription Status Update Success! - pUid: ${parsepUid}`
              );
            } catch (err) {
              console.error("Error executing query:", err);
              return res.status(500).json({
                message: `Server Error: ${err.sqlMessage}`,
              });
            }
          }

          return res
            .status(406)
            .json({ message: "이용 권한이 만료된 회원입니다 (Expired User)" });
        }
      }
      // 미결제 유저
      else {
        console.log(`이용 권한이 없는 회원입니다 (Unpaid User) - ${parsepUid}`);
        return res
          .status(406)
          .json({ message: "이용 권한이 없는 회원입니다 (Unpaid User)" });
      }
    } catch (err) {
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
      });
    }
  },
};

module.exports = {
  loginController,
};
