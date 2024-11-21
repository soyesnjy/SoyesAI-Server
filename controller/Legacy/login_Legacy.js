const loginController_Regercy = {
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
  // AI 중복 로그인 검사 (Regercy)
  vaildateDupleLogin: (req, res, next) => {
    try {
      const sessionId = req.sessionID;

      // Redis에서 기존 세션 ID 확인
      redisStore.get(`user_session:${userId}`, (err, oldSessionId) => {
        if (oldSessionId) {
          // 기존 세션 무효화
          redisStore.del(`sess:${oldSessionId}`, (err, reply) => {
            console.log("Previous session invalidated");
          });
        }
      });

      next();
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server Error - 500 Bad Gateway" });
    }
  },
  // AI JWT 토큰 유효성 검사 - 로그인 (Regercy)
  vaildateTokenAI: async (req, res, next) => {
    console.log("AI JWT 토큰 유효성 검사 API 호출 /login/ai");
    const { LoginData } = req.body;
    // Session data 조회
    const accessToken = req.session.accessToken;
    const refreshToken = req.cookies.refreshToken;

    let parseLoginData;
    try {
      // 입력값 파싱
      if (typeof LoginData === "string") {
        parseLoginData = JSON.parse(LoginData);
      } else parseLoginData = LoginData;

      const { pUid } = parseLoginData;

      let parsepUid = pUid;

      // accessToken이 있는 경우
      if (accessToken) {
        // accessToken Decoding
        const decoded = verifyToken("access", accessToken);
        // DB 계정과 입력 id가 같을 경우 인가
        if (decoded.id === parsepUid) {
          console.log("accessToken Login Success!");
          return res.status(200).json({ message: "AccessToken Login Success" });
        }
        // refreshToken만 있는 경우
      } else if (refreshToken) {
        // refreshToken Decoding
        const decoded = verifyToken("refresh", refreshToken);
        if (decoded.id === parsepUid) {
          console.log("refreshToken Login Success!");
          // accessToken 재발행 후 세션에 저장
          req.session.accessToken = generateToken({
            id: decoded.id,
            email: decoded.email,
          }).accessToken;
          return res
            .status(200)
            .json({ message: "RefreshToken Login Success" });
        }
      }
      next();
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server Error - 500" });
    }
  },
  // AI Google OAuth 로그인 - AccessToken 발급
  oauthGoogleAccessTokenHandler: async (req, res) => {
    const { code } = req.body;
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

          const { id, email } = response.data;

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
            parseEmail = email;
            const insert_query = `INSERT INTO ${table} (${Object.values(
              attribute
            ).join(", ")}) VALUES (${Object.values(attribute)
              .map((el) => "?")
              .join(", ")})`;
            // console.log(insert_query);

            const insert_value = [
              id,
              email,
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
            email: parseEmail,
          });

          // Session 내부에 accessToken 저장
          req.session.accessToken = token.accessToken;
          // browser Cookie에 refreshToken 저장
          res.cookie("refreshToken", token.refreshToken, {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
            secure: process.env.DEV_OPS !== "local",
          });

          // Redis에서 기존 세션 ID 확인
          redisStore.get(`user_session:${parseUid}`, (err, oldSessionId) => {
            if (oldSessionId) {
              // 기존 세션 무효화
              redisStore.destroy(`user_session:${parseUid}`, (err, reply) => {
                console.log("Previous session invalidated");
              });
            }
            // 새 세션 ID를 사용자 ID와 연결
            redisStore.set(
              `user_session:${parseUid}`,
              sessionId,
              (err, reply) => {
                // 로그인 처리 로직
                console.log(`[${parseUid}] SessionID Update - ${sessionId}`);
              }
            );
          });

          res.json({ data: response.data });
        });
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ data: "Server Error!" });
    }
  },
  // AI Kakao OAuth 로그인 - AccessToken 발급
  oauthKakaoAccessTokenHandler: async (req, res) => {
    const { data } = req.body;
    console.log("Kakao OAuth AccessToken 발급 API 호출");
    // 현재 카카오 소셜 로그인은 사업자등록을 해두지 않았기에 닉네임 정보만 가져올 수 있습니다.
    const sessionId = req.sessionID;
    let parseUid = "",
      parseEmail = "",
      parseData;

    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { code } = parseData;
      // POST 요청으로 액세스 토큰 요청
      const tokenResponse = await axios.post(
        "https://kauth.kakao.com/oauth/token",
        null,
        {
          params: {
            grant_type: "authorization_code",
            client_id: process.env.KAKAO_REST_API_KEY, // 카카오 개발자 콘솔에서 발급받은 REST API 키
            redirect_uri: `${process.env.REDIRECT_URL}?type=kakao`, // 카카오 개발자 콘솔에 등록한 리디렉션 URI
            code: code, // 클라이언트로부터 받은 권한 코드
          },
          headers: {
            "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
          },
        }
      );

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
      const { email } = response.data.kakao_account;

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
        parseEmail = email;
        const insert_query = `INSERT INTO ${table} (${Object.values(
          attribute
        ).join(", ")}) VALUES (${Object.values(attribute)
          .map((el) => "?")
          .join(", ")})`;
        // console.log(insert_query);

        const insert_value = [id, email, null, null, null, "kakao", date, date];
        // console.log(insert_value);

        // 계정 생성 쿼리 임시 주석
        connection_AI.query(
          insert_query,
          insert_value,
          (error, rows, fields) => {
            if (error) console.log(error);
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
            if (error) console.log(error);
            else console.log("KaKao OAuth User Data UPDATE Success!");
          }
        );
      }

      // JWT Token 발급 후 세션 저장
      const token = generateToken({
        id: parseUid,
        email: parseEmail,
      });

      // Session 내부에 accessToken 저장
      req.session.accessToken = token.accessToken;
      // browser Cookie에 refreshToken 저장
      res.cookie("refreshToken", token.refreshToken, {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: process.env.DEV_OPS === "local" ? "strict" : "none",
        secure: process.env.DEV_OPS !== "local",
      });

      // Redis에서 기존 세션 ID 확인
      redisStore.get(`user_session:${parseUid}`, (err, oldSessionId) => {
        if (oldSessionId) {
          // 기존 세션 무효화
          redisStore.destroy(`user_session:${parseUid}`, (err, reply) => {
            console.log("Previous session invalidated");
          });
        }
        // 새 세션 ID를 사용자 ID와 연결
        redisStore.set(`user_session:${parseUid}`, sessionId, (err, reply) => {
          // 로그인 처리 로직
          console.log(`[${parseUid}] SessionID Update - ${sessionId}`);
        });
      });

      // 클라이언트에 사용자 정보 응답
      res.json({ data: response.data });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ data: "Server Error!" });
    }
  },
};

module.exports = {
  loginController_Regercy,
};
