// stream 데이터 처리
const stream = require("stream");
// MySQL 접근
const mysql = require("mysql");
const { dbconfig_ai } = require("../DB/database");

// 결과보고서 관련
const puppeteer = require("puppeteer");
const ejs = require("ejs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

// Redis 연결
const redisStore = require("../DB/redisClient");

// AI DB 연결
const connection_AI = mysql.createConnection(dbconfig_ai);
connection_AI.connect();

const axios = require("axios");

const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.API_TOKEN,
});

const nodemailer = require("nodemailer");
// 구글 권한 관련
const { google } = require("googleapis");

// GCP IAM 서비스 계정 인증
const serviceAccount = {
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  project_id: process.env.GOOGLE_PROJECT_ID,
};

const auth_youtube = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ["https://www.googleapis.com/auth/youtube.force-ssl"],
});

const auth_google_drive = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const youtube = google.youtube({
  version: "v3",
  auth: auth_youtube,
});

const drive = google.drive({ version: "v3", auth: auth_google_drive });

// google drive 파일 전체 조회 메서드
async function listFiles() {
  try {
    const res = await drive.files.list({
      pageSize: 10,
      fields: "nextPageToken, files(id, name)",
    });

    const files = res.data.files;
    if (files.length) {
      console.log("Files:");
      files.map((file) => {
        console.log(`${file.name} (${file.id})`);
      });
    } else {
      console.log("No files found.");
    }
  } catch (error) {
    console.error(`An error occurred: ${error}`);
  }
}
// listFiles();

// google drive 파일 전체 삭제 메서드
async function deleteAllFiles() {
  try {
    // 파일 목록 가져오기
    const res = await drive.files.list({
      pageSize: 1000, // 한 번에 최대 1000개의 파일 가져오기
      fields: "files(id, name)",
    });

    const files = res.data.files;
    if (files.length === 0) {
      console.log("No files found.");
      return;
    }

    // 파일 삭제
    for (const file of files) {
      try {
        await drive.files.delete({ fileId: file.id });
        console.log(`Deleted file: ${file.name} (${file.id})`);
      } catch (error) {
        console.error(
          `Failed to delete file: ${file.name} (${file.id})`,
          error.message
        );
      }
    }

    console.log("All files deleted successfully.");
  } catch (error) {
    console.error("An error occurred while deleting files:", error.message);
  }
}
// deleteAllFiles();

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

// 숫자 확인용 함수
function isNum(val) {
  return !isNaN(val);
}

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
  ebt_Analysis,
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
  ebt_analysis_prompt,
  ebt_analysis_prompt_v2,
  ebt_analysis_prompt_v3,
  ebt_analysis_prompt_v4,
  ebt_analysis_prompt_v5,
  ebt_analysis_prompt_v6,
  ebt_analysis_prompt_v8,
  ebt_analysis_prompt_v9,
  pt_analysis_prompt,
  test_prompt_20240402,
  persona_prompt_lala_v2,
  persona_prompt_lala_v3,
  persona_prompt_lala_v4,
  persona_prompt_lala_v5,
  persona_prompt_lala_v6,
  solution_matching_persona_prompt,
  persona_prompt_pupu_v2,
  persona_prompt_pupu_v4,
  persona_prompt_pupu_v5,
  persona_prompt_pupu_v6,
  persona_prompt_pupu_v7,
  persona_prompt_maru,
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

const {
  cognitive_prompt,
  diary_prompt,
  balance_prompt,
} = require("../DB/solution_prompt");

// Database Table Info
const {
  User_Table_Info,
  EBT_Table_Info,
  PT_Table_Info,
  Consult_Table_Info,
  Ella_Training_Table_Info,
  North_Table_Info,
} = require("../DB/database_table_info");

// New EBT Result Select Method

const select_soyesAI_EbtResult_v2 = async (keyValue, contentKey, parsepUid) => {
  try {
    // New EBT Table
    const table = EBT_Table_Info["All"].table;
    const { pKey, cKey, status, created_at, analysis, score } =
      EBT_Table_Info["All"].attribute;

    // 조건부 Select Query
    const select_query = keyValue
      ? `SELECT * FROM ${table} WHERE (${pKey} ='${keyValue}' AND ${status}='1')` // keyValue 값으로 조회하는 경우
      : `SELECT * FROM ${table} WHERE (${cKey} ='${parsepUid}' AND ${status}='1') ORDER BY ${created_at} DESC LIMIT 1`; // 가장 최근 검사 결과를 조회하는 경우

    // const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${parsepUid}'`; // Select Query
    const ebt_data = await fetchUserData(connection_AI, select_query);
    // console.log(ebt_data[0]);

    // 검사를 진행하지 않은 경우
    if (!ebt_data[0]) return [];

    // tScore 계산 + 검사 결과
    const resultArr = EBT__reportClassArr.map((type) => {
      const { average, standard, danger_score, caution_score } =
        EBT_Table_Info[type];
      // 검사 스코어 합 + T점수 계산
      const scoreSum = ebt_data[0][score[type]]
        .split("/")
        .reduce((acc, cur) => Number(acc) + Number(cur));
      const tScore = (((scoreSum - average) / standard) * 10 + 50).toFixed(2);
      // 검사 결과
      const result =
        danger_score <= scoreSum
          ? "경고"
          : caution_score <= scoreSum
          ? "주의"
          : "양호";

      return {
        ebt_class: type,
        testStatus: true,
        scoreSum,
        tScore: Number(tScore),
        result,
        content: contentKey ? ebt_data[0][analysis[type]] : "",
      };
    });

    // console.log(resultArr);

    return resultArr;
  } catch (err) {
    console.log(err);
    return "Error";
  }
};

const select_soyesAI_Consult_Log = async (keyValue, parsepUid, count = 1) => {
  try {
    // New EBT Table
    const table = Consult_Table_Info["Log"].table;
    const { pKey, cKey, created_at } = Consult_Table_Info["Log"].attribute;

    // 조건부 Select Query
    const select_query = keyValue
      ? `SELECT * FROM ${table} WHERE (${pKey} ='${keyValue}')` // keyValue 값으로 조회하는 경우
      : `SELECT * FROM ${table} WHERE (${cKey} ='${parsepUid}') ORDER BY ${created_at} DESC LIMIT ${count}`; // 가장 최근 검사 결과를 조회하는 경우

    // const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${parsepUid}'`; // Select Query
    const ebt_data = await fetchUserData(connection_AI, select_query);
    // console.log(ebt_data[0]);

    // 검사를 진행하지 않은 경우
    if (!ebt_data[0]) return [];

    //console.log(ebt_data[0].consult_log);
    const resultArr = JSON.parse(ebt_data[0].consult_log);

    // console.log(resultArr);

    return resultArr;
  } catch (err) {
    console.log(err);
    return "Error";
  }
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

// EBT 반영 Class 정의
const EBT__reportClassArr = [
  "School",
  "Friend",
  "Family",
  "Self",
  "Unrest",
  "Sad",
  "Health",
  "Attention",
  "Movement",
  "Mood",
  "Angry",
];

// AI API
const openAIController = {
  // 감정 분석 AI
  postOpenAIEmotionAnalyze: async (req, res) => {
    const { data } = req.body;
    console.log("감정 분석 API /emotion Path 호출");
    // console.log(req.body);
    // console.log(typeof messageArr);

    let parseData, parseMessageArr;

    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { messageArr } = parseData;

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
  // EBT 결과 분석 및 DB 저장 및 메일 전송 API
  postOpenAIPsychologicalAnalysis: async (req, res) => {
    const { data } = req.body; // 클라이언트 한계로 데이터 묶음으로 받기.

    let parseData,
      parseMessageArr,
      parsingScore,
      parsingType,
      parsepUid,
      yourMailAddr = "",
      myMailAddr = "",
      myMailPwd = "";

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
      Persnal: "성격검사",
      default: "학교생활",
    };

    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;
      // console.log(parseData);

      const { messageArr, type, score, pUid } = parseData;
      console.log(
        `EBT 테스트 결과 분석 및 메일 전송 API /analysis Path 호출 - pUid:${pUid}`
      );
      console.log(parseData);

      // No type => return
      if (!type) {
        console.log("No type input value - 404");
        return res.status(404).json({ message: "No type input value - 404" });
      }
      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }
      // No messageArr => return
      if (!messageArr) {
        console.log("No messageArr input value - 404");
        return res
          .status(404)
          .json({ message: "No messageArr input value - 404" });
      }
      // No score => return
      if (!score) {
        console.log("No score input value - 404");
        return res.status(404).json({ message: "No score input value - 404" });
      }

      // 파싱. Client JSON 데이터
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = messageArr;

      if (typeof score === "string") {
        parsingScore = JSON.parse(score);
      } else parsingScore = score;

      parsingType = type;
      parsepUid = pUid;

      // T점수 계산
      const scoreSum = parsingScore.reduce((acc, cur) => acc + cur);
      const aver = EBT_Table_Info[parsingType].average;
      const stand = EBT_Table_Info[parsingType].standard;
      const tScore = (((scoreSum - aver) / stand) * 10 + 50).toFixed(2);
      // 검사 결과
      const result =
        EBT_Table_Info[parsingType].danger_score <= scoreSum
          ? "경고"
          : EBT_Table_Info[parsingType].caution_score <= scoreSum
          ? "주의"
          : "양호";
      console.log("tScore: " + tScore);
      console.log("result: " + result);
      const analysisPrompt = [];
      const userPrompt = [];

      // 정서행동 검사 분석가 페르소나 v8 - 2024.09.30 ~
      analysisPrompt.push(ebt_analysis_prompt_v9);
      // 분야별 결과 해석 프롬프트
      analysisPrompt.push(ebt_Analysis[parsingType]);
      // 결과 해석 요청 프롬프트
      const ebt_class = testType[parsingType];
      userPrompt.push({
        role: "user",
        content: `
        user의 ${ebt_class} 심리 검사 결과는 '${result}'에 해당한다.
        user의 T점수는 ${tScore}점이다.
        다음 문단은 user의 ${ebt_class} 심리 검사 문항에 대한 응답이다.
        '''
        ${parseMessageArr.map((el) => el.content).join("\n")}
        '''
        위 응답을 기반으로 user의 ${ebt_class}에 대해 해석하라.
        `,
      });

      /*
      const user_table = "soyes_ai_User";
      const user_attr = {
        pKey: "uid",
        attr1: "email",
      };

      const select_query = `SELECT * FROM ${user_table} WHERE ${user_attr.pKey}='${pUid}'`;
      await fetchUserData(connection_AI, select_query);
      console.log("받는사람: " + yourMailAddr);

      yourMailAddr = "soyesnjy@gmail.com"; // dummy email. 받는사람
      
      // 보내는 사람 계정 로그인
      myMailAddr = process.env.ADDR_MAIL; // 보내는 사람 메일 주소
      myMailPwd = process.env.ADDR_PWD; // 구글 계정 2단계 인증 비밀번호

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
      */

      // AI 분석
      const response = await openai.chat.completions.create({
        messages: [...analysisPrompt, ...userPrompt],
        model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-4-1106-preview, gpt-3.5-turbo-1106, gpt-3.5-turbo-instruct(Regercy), ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        temperature: 1,
      });

      const message = { message: response.choices[0].message.content };
      // AI 분석 내용 보기좋게 정리
      const analyzeMsg = message.message.split(". ").join(".\n");
      // client 전송
      res.json({ message: analyzeMsg, result });

      // 메일 제목 및 내용 + 보내는사람 + 받는사람
      const mailOptions = {
        from: myMailAddr,
        to: yourMailAddr,
        subject: "정서행동 검사 AI 상담 분석 결과입니다",
        text: `${analyzeMsg}`,
        // attachments : 'logo.png' // 이미지 첨부 속성
      };

      // 메일 전송 (비동기)
      /* 메일 전송 봉인
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

      // 검사 결과가 갱신 되었기에 정서 결과 세션 삭제
      delete req.session.psy_testResult_promptArr_last;

      /* 2024-08-20 - new DB 저장 */
      if (true) {
        const table = EBT_Table_Info["All"].table;
        const { pKey, cKey, analysis, score, status, created_at } =
          EBT_Table_Info["All"].attribute;

        // soyes_ai_Ebt Table 삽입
        // 1. SELECT TEST (row가 있는지 없는지 검사)
        const select_query = `SELECT ${pKey}, ${status} FROM ${table} WHERE uid ='${parsepUid}' ORDER BY ${created_at} DESC LIMIT 1`;
        const ebt_data = await fetchUserData(connection_AI, select_query);

        // console.log(ebt_data[0]);

        // 2. UPDATE TEST
        if (ebt_data[0] && !ebt_data[0][status]) {
          const update_query = `UPDATE ${table} SET ${analysis[type]}=?, ${score[type]}=?, ${status}=? WHERE ${pKey} = ?`;
          // console.log(update_query);

          const update_value = [
            analyzeMsg, // AI 분석 결과
            parsingScore.join("/"), // Score Array String
            type === "Self" ? 1 : 0, // type === Self 일 경우 row 완성 표시
            ebt_data[0].ebt_id, // pKey 값
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
        // 3. INSERT TEST
        else {
          const insert_query = `INSERT INTO ${table} (${cKey}, ${analysis[type]}, ${score[type]}) VALUES (?, ?, ?)`;
          // console.log(insert_query);

          const insert_value = [parsepUid, analyzeMsg, parsingScore.join("/")];
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
      }

      /* EBT Data DB 저장 */
      // if (parsingType) {
      //   /* DB 저장 */
      //   const table = EBT_Table_Info[parsingType].table;
      //   const attribute = EBT_Table_Info[parsingType].attribute;
      //   // 오늘 날짜 변환
      //   const dateObj = new Date();
      //   const year = dateObj.getFullYear();
      //   const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      //   const day = ("0" + dateObj.getDate()).slice(-2);
      //   const date = `${year}-${month}-${day}`;

      //   // soyes_ai_Ebt Table 삽입
      //   // 1. SELECT TEST (row가 있는지 없는지 검사)
      //   const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${parsepUid}'`;
      //   const ebt_data = await fetchUserData(connection_AI, select_query);

      //   // 2. UPDATE TEST (row값이 있는 경우 실행)
      //   if (ebt_data[0]) {
      //     const update_query = `UPDATE ${table} SET ${Object.values(attribute)
      //       .filter((el) => el !== "uid")
      //       .map((el) => {
      //         return `${el} = ?`;
      //       })
      //       .join(", ")} WHERE ${attribute.pKey} = ?`;
      //     // console.log(update_query);

      //     const update_value = [
      //       ...parsingScore,
      //       JSON.stringify({ ...mailOptions, date }),
      //       date,
      //       parsepUid,
      //     ];

      //     // console.log(update_value);

      //     connection_AI.query(
      //       update_query,
      //       update_value,
      //       (err, rows, fields) => {
      //         if (err) {
      //           console.log("AI Analysis Data DB UPDATE Fail!");
      //           console.log("Err sqlMessage: " + err.sqlMessage);
      //         } else console.log("AI Analysis Data DB UPDATE Success!");
      //       }
      //     );
      //   }
      //   // 3. INSERT TEST (row값이 없는 경우 실행)
      //   else {
      //     const insert_query = `INSERT INTO ${table} (${Object.values(
      //       attribute
      //     ).join(", ")}) VALUES (${Object.values(attribute)
      //       .map((el) => "?")
      //       .join(", ")})`;
      //     // console.log(insert_query);

      //     const insert_value = [
      //       parsepUid,
      //       ...parsingScore,
      //       JSON.stringify({ ...mailOptions, date }),
      //       date,
      //     ];
      //     // console.log(insert_value);

      //     connection_AI.query(
      //       insert_query,
      //       insert_value,
      //       (err, rows, fields) => {
      //         if (err) {
      //           console.log("AI Analysis Data DB INSERT Fail!");
      //           console.log("Err sqlMessage: " + err.sqlMessage);
      //         } else console.log("AI Analysis Data DB INSERT Success!");
      //       }
      //     );
      //   }

      //   // soyes_ai_Ebt_Log Table 삽입
      //   const table_log = EBT_Table_Info["Log"].table; // 해당 table은 soyes_ai_User table과 외래키로 연결된 상태
      //   const attribute_log = EBT_Table_Info["Log"].attribute;

      //   const log_insert_query = `INSERT INTO ${table_log} (${Object.values(
      //     attribute_log
      //   ).join(", ")}) VALUES (${Object.values(attribute_log)
      //     .map((el) => "?")
      //     .join(", ")})`;
      //   // console.log(insert_query);

      //   const log_insert_value = [
      //     parsepUid,
      //     date,
      //     JSON.stringify({ ...mailOptions, date }),
      //     type,
      //   ];
      //   // console.log(insert_value);

      //   connection_AI.query(log_insert_query, log_insert_value, (err) => {
      //     if (err) {
      //       console.log("AI Analysis Data LOG DB INSERT Fail!");
      //       console.log("Err sqlMessage: " + err.sqlMessage);
      //     } else console.log("AI Analysis Data LOG DB INSERT Success!");
      //   });
      // }
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server Error - 500 Bad Gateway" });
    }
  },
  // PT 결과 분석 및 DB 저장 및 메일 전송 API
  postOpenAIPernalTestAnalysis: async (req, res) => {
    const { data } = req.body; // 클라이언트 한계로 데이터 묶음으로 받기.

    let parseData,
      parsePTResult,
      yourMailAddr = "";
    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { resultText, pUid } = parseData;
      console.log(
        `PT 테스트 결과 분석 및 메일 전송 API /analysis_pt Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // No type => return
      if (!resultText) {
        console.log("No resultText input value - 400");
        return res
          .status(400)
          .json({ message: "No resultText input value - 400" });
      }
      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }

      parsepUid = pUid;
      parsePTResult = resultText;

      // const analysisPrompt = [];
      // const userPrompt = [];

      // 성격 검사용 프롬프트 구분
      // analysisPrompt.push(pt_analysis_prompt);
      // userPrompt.push({
      //   role: "user",
      //   content: `다음 문단은 아동의 성격검사 결과야.
      //     '''
      //     아동의 성격 검사 유형은 ${parsePTResult}입니다.
      //     ${parsePTResult} 유형은 ${persnal_short[parsePTResult]}
      //     '''
      //     아동의 성격검사 결과를 바탕으로 아동의 성격을 장점과 단점으로 나눠서 분석해줘. 분석이 끝나면 단점에 대한 해결 방안을 제시해줘
      //     `,
      // });

      /*
      const user_table = "soyes_ai_User";
      const user_attr = {
        pKey: "uid",
        attr1: "email",
      };

      const select_query = `SELECT * FROM ${user_table} WHERE ${user_attr.pKey}='${pUid}'`;
      await fetchUserData(connection_AI, select_query);
      console.log("받는사람: " + yourMailAddr);

      yourMailAddr = "soyesnjy@gmail.com"; // dummy email. 받는사람
      
      // 보내는 사람 계정 로그인
      myMailAddr = process.env.ADDR_MAIL; // 보내는 사람 메일 주소
      myMailPwd = process.env.ADDR_PWD; // 구글 계정 2단계 인증 비밀번호

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
      
      yourMailAddr = "soyesnjy@gmail.com"; // dummy email. 받는사람
      */

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

      // AI 분석
      // const response = await openai.chat.completions.create({
      //   messages: [...analysisPrompt, ...userPrompt],
      //   model: "gpt-4o", // gpt-4-turbo, gpt-4-1106-preview, gpt-3.5-turbo-1106, gpt-3.5-turbo-instruct(Regercy), ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      //   temperature: 1,
      // });

      // const message = { message: response.choices[0].message.content };
      // AI 분석 내용 보기좋게 정리
      // const analyzeMsg = message.message.split(". ").join(".\n");
      const message = { message: "" };
      const analyzeMsg = message;
      // 메일 제목 및 내용 + 보내는사람 + 받는사람
      const mailOptions = {
        from: myMailAddr,
        to: yourMailAddr,
        subject: "성격 검사 AI 상담 분석 결과입니다",
        text: `${analyzeMsg}`,
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
      // res.status(200).json({ message: "PT Test DB Insert Success!" });

      // /* PT Data DB 저장 */
      // const pt_table = PT_Table_Info["Main"].table;
      // const pt_attribute = PT_Table_Info["Main"].attribute;

      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      // // soyes_ai_Pt Table 삽입
      // // 1. SELECT TEST (row가 있는지 없는지 검사)
      // const select_query = `SELECT * FROM ${pt_table} WHERE ${pt_attribute.pKey}='${parsepUid}'`;
      // const ebt_data = await fetchUserData(connection_AI, select_query);

      // // 2. UPDATE TEST (row값이 있는 경우 실행)
      // if (ebt_data[0]) {
      //   const update_query = `UPDATE ${pt_table} SET ${Object.values(
      //     pt_attribute
      //   )
      //     .filter((el) => el !== "uid")
      //     .map((el) => {
      //       return `${el} = ?`;
      //     })
      //     .join(", ")} WHERE ${pt_attribute.pKey} = ?`;
      //   // console.log(update_query);

      //   const update_value = [
      //     date,
      //     parsePTResult,
      //     JSON.stringify({ ...mailOptions, date }),
      //     parsepUid,
      //   ];

      //   // console.log(update_value);

      //   connection_AI.query(
      //     update_query,
      //     update_value,
      //     (error, rows, fields) => {
      //       if (error) console.log(error);
      //       else console.log("PT TEST Analysis Data DB UPDATE Success!");
      //     }
      //   );
      // }
      // // 3. INSERT TEST (row값이 없는 경우 실행)
      // else {
      //   const pt_insert_query = `INSERT INTO ${pt_table} (${Object.values(
      //     pt_attribute
      //   ).join(", ")}) VALUES (${Object.values(pt_attribute)
      //     .map((el) => "?")
      //     .join(", ")})`;
      //   // console.log(insert_query);

      //   const pt_insert_value = [
      //     parsepUid,
      //     date,
      //     resultText,
      //     JSON.stringify({ ...mailOptions, date }),
      //   ];

      //   connection_AI.query(
      //     pt_insert_query,
      //     pt_insert_value,
      //     (error, rows, fields) => {
      //       if (error) console.log(error);
      //       else console.log("PT TEST Analysis Data DB INSERT Success!");
      //     }
      //   );
      // }

      /* PT_Log DB 저장 */
      if (true) {
        const pt_log_table = PT_Table_Info["Log"].table;
        const pt_log_attribute = PT_Table_Info["Log"].attribute;
        // PT_Log DB 저장
        const pt_insert_query = `INSERT INTO ${pt_log_table} (${Object.values(
          pt_log_attribute
        ).join(", ")}) VALUES (${Object.values(pt_log_attribute)
          .map((el) => "?")
          .join(", ")})`;
        // console.log(insert_query);

        const pt_insert_value = [
          parsepUid,
          date,
          resultText,
          JSON.stringify({ ...mailOptions, date }),
        ];
        // console.log(insert_value);

        connection_AI.query(pt_insert_query, pt_insert_value, (err) => {
          if (err) {
            console.log("PT Analysis Data DB Save Fail!");
            console.log("Err sqlMessage: " + err.sqlMessage);
            res
              .status(400)
              .json({ message: "Err sqlMessage: " + err.sqlMessage });
          } else {
            console.log("AI Analysis Data LOG DB INSERT Success!");
            res.status(200).json({ message: "PT Test DB Insert Success!" });
          }
        });
      }
    } catch (err) {
      console.log(err);
      res.json({ message: "Server Error - 500 Bad Gateway" });
    }
  },
  // PT 결과 저장 API (GPT 분석 없이 성격검사 결과를 저장만 하는 API)
  postOpenAIPernalTestSave: async (req, res) => {
    const { data } = req.body; // 클라이언트 한계로 데이터 묶음으로 받기.

    let parseData, parsePTResult;
    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { resultText, pUid } = parseData;
      console.log(`PT 테스트 결과 저장 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No type => return
      if (!resultText) {
        console.log("No resultText input value - 404");
        return res
          .status(404)
          .json({ message: "No resultText input value - 404" });
      }
      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }

      parsepUid = pUid;
      parsePTResult = resultText;

      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      /* PT_Log DB 저장 */
      const pt_log_table = PT_Table_Info["Log"].table;
      const pt_log_attribute = PT_Table_Info["Log"].attribute;
      // PT_Log DB 저장
      const pt_insert_query = `INSERT INTO ${pt_log_table} (${Object.values(
        pt_log_attribute
      ).join(", ")}) VALUES (${Object.values(pt_log_attribute)
        .map((el) => "?")
        .join(", ")})`;
      // console.log(insert_query);

      const pt_insert_value = [
        parsepUid,
        date,
        resultText,
        JSON.stringify({ ...mailOptions, date }),
      ];
      // console.log(insert_value);

      connection_AI.query(pt_insert_query, pt_insert_value, (err) => {
        if (err) {
          console.log("PT Analysis Data DB Save Fail!");
          console.log("Err sqlMessage: " + err.sqlMessage);
        }
        console.log("AI Analysis Data LOG DB INSERT Success!");
        // client 전송
        return res
          .status(200)
          .json({ message: "AI Analysis Data LOG DB INSERT Success!" });
      });
    } catch (err) {
      console.log(err);
      res.json({ message: "Server Error - 500 Bad Gateway" });
    }
  },
  // 공감친구 모델 - 푸푸
  postOpenAIConsultingPupu: async (req, res) => {
    const { data } = req.body;
    let parseData, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    // let prevChat_flag = true; // 이전 대화 내역 유무
    // console.log(`accessAuth: ${req.session.accessAuth}`);
    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { messageArr, pUid } = parseData;
      console.log(
        `푸푸 상담 API /consulting_emotion_pupu Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }

      parsepUid = pUid;

      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_pupu_v7); // 2024.10.10 ~
      // promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

      // const lastUserContent =
      //   parseMessageArr[parseMessageArr.length - 1].content; // 유저 마지막 멘트

      // // NO REQ 질문 처리. 10초 이상 질문이 없을 경우 Client 측에서 'NO REQUEST' 메시지를 담은 요청을 보냄. 그에 대한 처리
      // if (lastUserContent.includes("NO REQ")) {
      //   console.log("NO REQUEST 전달");

      //   parseMessageArr.push(no_req_prompt);
      //   promptArr.push(sentence_division_prompt);

      //   const response = await openai.chat.completions.create({
      //     messages: [...promptArr, ...parseMessageArr],
      //     model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      //   });

      //   res.json({
      //     message: response.choices[0].message.content,
      //     emotion: 0,
      //   });

      //   return;
      // }

      // // 유저 성격검사 결과 DB에서 가져오기
      // const pt_result = await select_soyes_AI_Pt_Table(
      //   PT_Table_Info["Main"].table,
      //   PT_Table_Info["Main"].attribute,
      //   parsepUid
      // );
      // console.log(`성격검사 결과: ${pt_result}`);
      // // promptArr.push(persnal_result_prompt[pt_result]);
      // promptArr.push({
      //   role: "system",
      //   content: `다음 문단은 'user'의 성격검사 결과입니다.
      //   '''
      //   ${
      //     pt_result !== "default"
      //       ? `'user'는 성격검사 결과 ${pt_result} 유형에 해당됩니다. ${pt_result} 유형은 ${persnal_short["IFPE"]}`
      //       : "user는 성격검사를 진행하지 않았습니다."
      //   }
      //   '''
      //   'assistant'는 'user'의 성격 유형을 알고있습니다.
      //   `,
      // });

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

      // promptArr.push(solution_prompt2); // 음악 명상 + 그림 명상 관련 솔루션 프롬프트
      // promptArr.push(common_prompt); // 공통 프롬프트 삽입
      // promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      /* Regercy
      // 심리팀 Test Prompt. {role: user} 상태로 삽입
      parseMessageArr.unshift(test_prompt_20240402);
    
      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4-0125-preview", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let emotion = "0";
      const message = {
        message: response.choices[0].message.content,
        emotion,
      };
      */

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4o", // gpt-4o, gpt-4-turbo, gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      // let emotion = parseInt(response.choices[0].message.content.slice(-1));

      const message = {
        message: response.choices[0].message.content,
        emotion: 1,
      };

      // Log 출력
      // console.log([
      //   ...parseMessageArr,
      //   { role: "assistant", content: message.message },
      // ]);

      // Client 반환
      res.status(200).json(message);
    } catch (err) {
      console.error(err);
      res.json({
        message: "Server Error",
        emotion: 0,
      });
    }
  },
  // 공부친구 모델 - 우비
  postOpenAIConsultingUbi: async (req, res) => {
    const { data } = req.body;
    // console.log(data);
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    // let prevChat_flag = true; // 이전 대화 내역 유무
    // console.log(messageArr);
    try {
      if (typeof data === "string") {
        parseEBTdata = JSON.parse(data);
      } else parseEBTdata = data;

      const { messageArr, pUid } = parseEBTdata;
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }

      parsepUid = pUid;
      console.log(
        `우비 상담 API /consulting_emotion_ubi Path 호출 - pUid: ${parsepUid}`
      );
      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_ubi); // 페르소나 프롬프트 삽입
      // promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

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
      // const pt_result = await select_soyes_AI_Pt_Table(
      //   PT_Table_Info["Main"].table,
      //   PT_Table_Info["Main"].attribute,
      //   parsepUid
      // );
      // // console.log(pt_result);
      // promptArr.push({
      //   role: "system",
      //   content: `다음 문단은 'user'의 성격검사 결과입니다.
      //   '''
      //   ${
      //     pt_result !== "default"
      //       ? `'user'는 성격검사 결과 ${pt_result} 유형에 해당됩니다. ${pt_result} 유형은 ${persnal_short["IFPE"]}`
      //       : "user는 성격검사를 진행하지 않았습니다."
      //   }
      //   '''
      //   'assistant'는 'user'의 성격 유형을 알고있습니다.
      //   `,
      // });

      // 상시 삽입 프롬프트
      promptArr.push(solution_prompt); // 학습 관련 솔루션 프롬프트
      promptArr.push(sentence_division_prompt); // 공통 프롬프트 삽입
      promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4o", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
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
      res.status(200).json(message);
    } catch (err) {
      console.error(err);
      res.json({
        message: "Server Error",
        emotion: 0,
      });
    }
  },
  // 전문상담사 모델 - 소예
  postOpenAIConsultingSoyes: async (req, res) => {
    const { data } = req.body;
    // console.log(EBTData);
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    // let prevChat_flag = true; // 이전 대화 내역 유무

    // 응답에 헤더를 추가하는 메서드
    // res.header("Test_Header", "Success Header");

    try {
      if (typeof data === "string") {
        parseEBTdata = JSON.parse(data);
      } else parseEBTdata = data;

      const { messageArr, pUid } = parseEBTdata;
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }

      parsepUid = pUid;
      console.log(
        `소예 상담 API /consulting_emotion_soyes Path 호출 - pUid: ${parsepUid}`
      );
      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_soyes); // 페르소나 프롬프트 삽입
      // promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

      const lastUserContent =
        parseMessageArr[parseMessageArr.length - 1].content; // 유저 마지막 멘트

      /* 프롬프트 삽입 분기 */

      // 심리 검사 결과 프롬프트 상시 삽입
      //     if (!req.session.psy_testResult_promptArr_last) {
      //       // 심리 검사 결과 프롬프트 삽입
      //       console.log("심리 검사 결과 프롬프트 삽입");
      //       let psy_testResult_promptArr_last = []; // 2점을 획득한 정서행동검사 문항을 저장하는 prompt
      //       // 해당 계정의 모든 정서행동검사 결과 DB에서 차출
      //       const psy_testResult_promptArr = EBT_classArr.map(async (ebt_class) => {
      //         const select_Ebt_Result = await select_soyes_AI_Ebt_Table(
      //           EBT_Table_Info[ebt_class].table, // Table Name
      //           EBT_Table_Info[ebt_class].attribute,
      //           EBT_Table_Info[ebt_class].result, // EBT Question 11가지 분야 중 1개 (Table에 따라 결정)
      //           parsepUid // Uid
      //         );

      //         // console.log(select_Ebt_Result);

      //         const psy_testResult_prompt = {
      //           role: "system",
      //           content: `다음에 오는 문단은 user의 ${ebt_class} 관련 심리검사 결과입니다.
      // '''
      // ${select_Ebt_Result.testResult}
      // '''
      // 위 문단이 비어있다면 ${
      //   // DB Table의 값 유무에 따라 다른 프롬프트 입력
      //   !select_Ebt_Result.ebt_school_data[0]
      //     ? "user는 심리검사를 진행하지 않았습니다."
      //     : "user의 심리검사 결과는 문제가 없습니다."
      // }`,
      //         };
      //         // console.log(psy_testResult_prompt);
      //         return psy_testResult_prompt;
      //       });
      //       // map method는 pending 상태의 promise를 반환하므로 Promise.all method를 사용하여 resolve 상태가 되기를 기다려준다.
      //       await Promise.all(psy_testResult_promptArr).then((prompt) => {
      //         psy_testResult_promptArr_last = [...prompt]; // resolve 상태로 반환된 prompt 배열을 psy_testResult_promptArr_last 변수에 복사
      //       });

      //       // console.log(psy_testResult_promptArr_last);

      //       promptArr.push(...psy_testResult_promptArr_last);
      //       promptArr.push(psyResult_prompt);
      //       // promptArr.push(solution_prompt);

      //       req.session.psy_testResult_promptArr_last = [
      //         ...psy_testResult_promptArr_last,
      //       ];
      //     } else {
      //       console.log("세션 저장된 심리 검사 결과 프롬프트 삽입");
      //       promptArr.push(...req.session.psy_testResult_promptArr_last);
      //       promptArr.push(psyResult_prompt);
      //     }

      // 검사 결과 분석 관련 멘트 감지
      let testClass = ""; // 감지 텍스트 저장 변수
      if (
        !req.session.ebt_class &&
        test_result_ment.some((el) => {
          if (lastUserContent.includes(el.text)) {
            testClass = el.class;
            return true;
          } else return false;
        })
      ) {
        console.log(`정서행동검사 결과 - ${testClass} 분석 프롬프트 삽입`);
        // 감지된 분야 선택
        // const random_class = EBT_classArr[class_map[testClass]];
        const random_class = testClass;

        // 심리 결과 분석 프롬프트
        parseMessageArr.push({
          role: "user",
          content: `마지막 질문에 대해 1문장 이내로 답변한 뒤 (이해하지 못했으면 답변하지마), 
          '너의 심리검사 결과를 봤어!'라고 언급하면서 ${random_class} 관련 심리검사 결과를 분석한 아동의 심리 상태를 5문장 이내로 설명해줘.
          만약 심리 검사 결과를 진행하지 않았다면, 잘 모르겠다고 답변해줘.
          . 혹은 ? 같은 특수문자로 끝나는 각 마디 뒤에는 반드시 줄바꿈(\n)을 추가해줘.
          검사 결과가 있다면 답변 마지막에는 '검사 결과에 대해 더 궁금한점이 있니?'를 추가해줘.`,
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
        model: "gpt-4o", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
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

      res.status(200).json(message);
    } catch (err) {
      console.error(err);
      res.json({
        message: "Server Error",
        emotion: 0,
      });
    }
  },
  // 게임친구 모델 - 마루
  postOpenAIConsultingMaru: async (req, res) => {
    const { data } = req.body;
    // console.log(data);

    let parseData, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array

    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { messageArr, pUid, game } = parseData;
      console.log(
        `마루 게임 API /consulting_emotion_maru Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.json({ message: "No pUid input value - 400" });
      }

      if (!game) {
        console.log("No game input value - 400");
        return res.json({ message: "No game input value - 400" });
      }

      parsepUid = pUid;

      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_maru); // 페르소나 프롬프트 삽입
      // promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

      if (game === "remarks") {
        promptArr.push({
          role: "system",
          content: `assistant는 user와 끝말잇기 게임을 진행한다. 단어는 2 ~ 5글자 사이의 명사만으로 생성한다.
'륨', '릇'과 같은 한방단어로 인해 assistant가 패배할 경우 assistant는 패배를 인정하고 재시작 여부를 user에게 묻는다.`,
        });
      } else if (game === "balance") {
        promptArr.push({
          role: "system",
          content: `assistant는 user와 밸런스 게임을 진행한다. 문제는 1문제씩 총 10회 질문한다.
assistant는 user의 응답에 반응하지 않고 반드시 밸런스게임 문제만 출제한다.
게임이 종료되면 assistant가 밸런스 게임에서 선택한 단어 10개를 보여주고 user와의 매칭률을 계산해서 %로 알려준다.
`,
        });
      }

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4o", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        temperature: 0.7,
      });

      const message = {
        message: response.choices[0].message.content,
      };
      // console.log([
      //   ...parseMessageArr,
      //   { role: "assistant", content: message.message },
      // ]);
      return res.status(200).json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
        // emotion: 0,
      });
    }
  },
  // 달력 관련 데이터 반환 (Date 단위)
  postOpenAIMypageCalendarData: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid, parseDate; // Parsing 변수
    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, date } = parseData;
      console.log(
        `달력 데이터 반환 API /openAI/calendar Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }
      // pUid default값 설정
      parsepUid = pUid;
      parseDate = date;

      // DB 조회 => User Table + User EBT Table JOIN 후 관련 데이터 전달
      // const user_table = User_Table_Info.table;
      const ebt_log_table = EBT_Table_Info["Log"].table;
      const ebt_log_attribute = EBT_Table_Info["Log"].attribute;
      const pt_log_table = PT_Table_Info["Log"].table;
      const pt_log_attribute = PT_Table_Info["Log"].attribute;
      const consult_log_table = Consult_Table_Info["Log"].table;
      const consult_log_attribute = Consult_Table_Info["Log"].attribute;

      // 1. SELECT USER JOIN EBT_Log
      const select_ebt_join_query = `SELECT ${ebt_log_table}.${ebt_log_attribute.attr2}, ${ebt_log_table}.${ebt_log_attribute.attr3} FROM ${ebt_log_table} WHERE uid = '${parsepUid}' AND created_at LIKE '${parseDate}%';`;

      const ebt_join_data = await fetchUserData(
        connection_AI,
        select_ebt_join_query
      );
      // console.log(ebt_join_data);

      // 2. SELECT USER PT_Log
      const select_pt_join_query = `SELECT ${pt_log_table}.${pt_log_attribute.attr2}, ${pt_log_table}.${pt_log_attribute.attr3} FROM ${pt_log_table} WHERE uid = '${parsepUid}' AND created_at LIKE '${parseDate}%';`;

      const pt_join_data = await fetchUserData(
        connection_AI,
        select_pt_join_query
      );

      // 3. SELECT USER Consult_Log
      const select_consult_join_query = `SELECT * FROM ${consult_log_table} WHERE uid = '${parsepUid}' AND created_at LIKE '${parseDate}%';`;

      const consult_join_data = await fetchUserData(
        connection_AI,
        select_consult_join_query
      );

      console.log(consult_join_data);

      // 프론트 데이터값 참조
      // const userInfoArr = [
      //   {
      //     title: '성격검사',
      //     type: 'pt_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      //   {
      //     title: '정서행동검사',
      //     type: 'ebt_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      //   {
      //     title: '심리상담',
      //     type: 'consult_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      //   {
      //     title: '콘텐츠',
      //     type: 'content_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      //   {
      //     title: '엘라상담',
      //     type: 'ella_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      //   {
      //     title: '명상',
      //     type: 'meditation_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      // ];

      res.status(200).json({
        ebt_data: ebt_join_data.map((el) => {
          return { ...el, ebt_analysis: JSON.parse(el.ebt_analysis).text };
        }),
        pt_data: pt_join_data.map((el) => {
          return { ...el, pt_analysis: JSON.parse(el.pt_analysis).text };
        }),
        // 값을 파싱해서 사용해야함!
        consult_data: consult_join_data.map((el) => {
          return { ...el };
        }),
      });
    } catch (err) {
      console.error(err);
      res.json({
        data: "Server Error",
      });
    }
  },
  // 마이페이지 데이터 반환 API
  postOpenAIMypageData: async (req, res) => {
    const { data } = req.body;
    console.log(data);
    let parseData, parsepUid; // Parsing 변수

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid } = parseData;
      console.log(
        `마이페이지 데이터 반환 API /openAI/mypage Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.json({ message: "No pUid input value - 400" });
      }
      // pUid default값 설정
      parsepUid = pUid;
      // parseDate = date;

      // EBT Table Key
      const ebt_log_table = EBT_Table_Info["All"].table;
      const ebt_log_attribute = EBT_Table_Info["All"].attribute;
      const { pKey, status, created_at, updated_at } = ebt_log_attribute;

      // PT Table Key
      const pt_log_table = PT_Table_Info["Log"].table;
      const pt_log_attribute = PT_Table_Info["Log"].attribute;

      // Consult Table Key
      const consult_log_table = Consult_Table_Info["Log"].table;
      // const consult_log_attribute = Consult_Table_Info["Log"].attribute;

      // Consult Table Key
      const north_table = North_Table_Info.table;
      // const north_attribute = North_Table_Info.attribute;

      // 1. SELECT USER JOIN EBT_Log
      const select_ebt_join_query = `SELECT ${pKey}, ${updated_at} FROM ${ebt_log_table} WHERE uid = '${parsepUid}' AND ${status} = '1' ORDER BY ${created_at} DESC LIMIT 5;`;
      const ebt_join_data = await fetchUserData(
        connection_AI,
        select_ebt_join_query
      );
      // console.log(ebt_join_data);

      // 2. SELECT USER PT_Log
      const select_pt_join_query = `SELECT ${pt_log_attribute.attr2}, created_at FROM ${pt_log_table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 5;`;
      const pt_join_data = await fetchUserData(
        connection_AI,
        select_pt_join_query
      );

      // 3. SELECT USER Consult_Log
      const select_consult_join_query = `SELECT * FROM ${consult_log_table} WHERE uid = '${parsepUid}' AND avarta_name = 'pupu' ORDER BY created_at DESC LIMIT 5;`;
      const consult_join_data = await fetchUserData(
        connection_AI,
        select_consult_join_query
      );

      // 4. SELECT User North Data (일일 모니터링)
      const select_north_join_query = `SELECT JSON_OBJECT(
    'mood_data', IFNULL((SELECT JSON_ARRAYAGG(north_mental_data)
                  FROM (SELECT north_mental_data
                        FROM ${north_table}
                        WHERE uid = '${parsepUid}' AND north_diary_tag = 'mood'
                        ORDER BY created_at DESC
                        LIMIT 5) AS mood), JSON_ARRAY()),
    'friend_data', IFNULL((SELECT JSON_ARRAYAGG(north_mental_data)
                    FROM (SELECT north_mental_data
                          FROM ${north_table}
                          WHERE uid = '${parsepUid}' AND north_diary_tag = 'friend'
                          ORDER BY created_at DESC
                          LIMIT 5) AS friend), JSON_ARRAY()),
    'family_data', IFNULL((SELECT JSON_ARRAYAGG(north_mental_data)
                    FROM (SELECT north_mental_data
                          FROM ${north_table}
                          WHERE uid = '${parsepUid}' AND north_diary_tag = 'family'
                          ORDER BY created_at DESC
                          LIMIT 5) AS family), JSON_ARRAY()),
    'school_data', IFNULL((SELECT JSON_ARRAYAGG(north_mental_data)
                    FROM (SELECT north_mental_data
                          FROM ${north_table}
                          WHERE uid = '${parsepUid}' AND north_diary_tag = 'school'
                          ORDER BY created_at DESC
                          LIMIT 5) AS school), JSON_ARRAY())
) AS result;
`;
      const north_join_data = await fetchUserData(
        connection_AI,
        select_north_join_query
      );

      // console.log(consult_join_data);

      // 프론트 데이터값 참조
      // const userInfoArr = [
      //   {
      //     title: '성격검사',
      //     type: 'pt_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      //   {
      //     title: '정서행동검사',
      //     type: 'ebt_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      //   {
      //     title: '심리상담',
      //     type: 'consult_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      //   {
      //     title: '콘텐츠',
      //     type: 'content_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      //   {
      //     title: '엘라상담',
      //     type: 'ella_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      //   {
      //     title: '명상',
      //     type: 'meditation_data',
      //     iconSrc: '/src/Content_IMG/Icon_IMG/Icon_요가명상.png',
      //     playIconSrc: '/src/Content_IMG/Frame_재생버튼.png',
      //   },
      // ];

      // console.log(pt_join_data);

      function convertToKoreanDate(utcString) {
        // 입력된 UTC 시간을 Date 객체로 변환
        const date = new Date(utcString);

        // 한국 시간대(KST, UTC+9)로 변환
        const options = {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "numeric",
          day: "numeric",
        };

        // 한국 시간대로 변환된 날짜를 받아옴 (시간 정보는 제외)
        const koreanDateString = date.toLocaleDateString("ko-KR", options);

        // 'YYYY. M. D.' 형식을 'YYYY년 M월 D일' 형식으로 변환
        const formattedDate = koreanDateString
          .replace(".", "년")
          .replace(".", "월")
          .replace(".", "일")
          .trim();

        return formattedDate;
      }

      return res.status(200).json({
        message: "MyPage Data Access Success! - 200 OK",
        ebt_data: ebt_join_data
          .sort(
            (a, b) => new Date(a.ebt_updated_at) - new Date(b.ebt_updated_at)
          )
          .map((el) => {
            return {
              id: el.ebt_id,
              date: convertToKoreanDate(el.ebt_updated_at),
            };
          }),
        pt_data: pt_join_data
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .map((el) => {
            return {
              result: el.persanl_result,
              date: convertToKoreanDate(el.created_at),
            };
          }),
        pupu_data: consult_join_data
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .map((el) => {
            return {
              id: el.entry_id,
              date: convertToKoreanDate(el.created_at),
            };
          }),
        north_data: JSON.parse(north_join_data[0].result),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // Clova Voice API 사용
  postClovaVoiceTTS: async (req, res) => {
    console.log("ClovaVoiceTTS API /openAI/tts Path 호출");
    const api_url = "https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts";
    try {
      const response = await axios.post(api_url, req.body, {
        responseType: "arraybuffer", // Clova 음성 데이터를 arraybuffer로 받음
        headers: {
          "X-NCP-APIGW-API-KEY-ID": process.env.CLOVA_CLIENT_ID,
          "X-NCP-APIGW-API-KEY": process.env.CLOVA_CLIENT_SECRET,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      // console.log(response.data);
      // 음성 데이터를 클라이언트로 전송
      res.writeHead(200, {
        "Content-Type": "audio/mp3",
        "Content-Length": response.data.length,
      });

      // JSON 형식이 아니기에 res.json 사용 X
      res.end(response.data);
    } catch (error) {
      console.error(error.message);
      res.status(500).end("Internal Server Error");
    }
  },
  // 상담 로그 Save API
  postOpenAIConsultingLogSave: async (req, res) => {
    const { data } = req.body; // 클라이언트 한계로 데이터 묶음으로 받기.
    let parseData, parsepUid;
    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { messageArr, avartar, pUid } = parseData;
      console.log(
        `상담 로그 저장 API /consulting_emotion_log Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("Non pUid input value - 400");
        return res.status(400).json({ message: "Non pUid input value - 400" });
      }
      parsepUid = pUid;
      // 문답 5회 미만일 경우 return
      if (messageArr.length <= 8) {
        console.log(`messageArr Not enough length - pUid: ${parsepUid}`);
        return res
          .status(201)
          .json({ message: "messageArr Not enough length" });
      }

      const analysisPrompt = [];
      const userPrompt = [];

      // 푸푸 페르소나 프롬프트 삽입
      analysisPrompt.push({
        role: "system",
        content: `user가 상담을 종료하면 다음 형식으로 분석을 제공한다.
1) 상담 키워드를 3가지로 요약한다.
2) 유저가 사용한 감정 단어를 파악한다.
3) 사용된 전체 감정 단어 중 상세한 감정 단어의 비율만 '정서 인식(명확한 감정 단어를 사용한 비율) **%'의 형식으로 제시한다.`,
      });

      // 상담 분석 명령 프롬프트 삽입
      userPrompt.push({
        role: "user",
        content: `상담이 종료되었어. 상담 내용을 100자 이내로 분석해줘`,
      });

      // AI 분석
      const response = await openai.chat.completions.create({
        messages: [...analysisPrompt, ...messageArr, ...userPrompt],
        model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-4-1106-preview, gpt-3.5-turbo-1106, gpt-3.5-turbo-instruct(Regercy), ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      const message = { message: response.choices[0].message.content };
      // AI 분석 내용 보기좋게 정리
      const analyzeMsg = message.message.split(". ").join(".\n");

      messageArr.push({ role: "user", content: analyzeMsg });

      // console.log(analyzeMsg);

      /* Consult_Log DB 저장 */
      if (true) {
        const consult_log_table = Consult_Table_Info["Log"].table;
        const consult_log_attribute = Consult_Table_Info["Log"].attribute;

        // Consult_Log DB 저장
        const consult_insert_query = `INSERT INTO ${consult_log_table} (${consult_log_attribute.cKey}, ${consult_log_attribute.attr1}, ${consult_log_attribute.attr2}) VALUES (?, ?, ?)`;
        // console.log(consult_insert_query);

        const consult_insert_value = [
          parsepUid,
          avartar,
          JSON.stringify(messageArr),
        ];
        // console.log(consult_insert_value);

        connection_AI.query(
          consult_insert_query,
          consult_insert_value,
          (err) => {
            if (err) {
              console.log("Err sqlMessage: " + err.sqlMessage);
            } else {
              console.log(`Consulting_Log DB Save Success! - ${parsepUid}`);
              res
                .status(200)
                .json({ message: "Consulting_Log DB Save Success!" });
            }
          }
        );
      }
    } catch (err) {
      console.log(err);
      res
        .status(500)
        .json({ message: "Consulting_Log DB Save Fail!" + err.message });
    }
  },
  // 상담 로그 Load API
  postOpenAIConsultingLogLoad: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid;

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, pKeyValue } = parseData;
      console.log(
        `상담 로그 Load API /openAI/consulting_emotion_log_load Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);
      // contentKey: AI 분석 결과 반환 트리거
      // keyValue: Consult_Log Table Row Primary Key. 마이페이지 결과보기 버튼에 할당 후 전달받을 예정

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }
      // pUid default값 설정
      parsepUid = pUid;

      const resultArr = await select_soyesAI_Consult_Log(pKeyValue, parsepUid);

      // 정서행동검사 완료 데이터가 없을 경우
      if (!resultArr.length) {
        return res.status(200).json({
          message: "User Non Have EBT Result",
          data: [],
        });
      }

      // console.log(resultArr);

      return res.status(200).json({
        message: "User Consult Data Return Success!",
        data: resultArr,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // ClearCookies API
  getClearCookies: (req, res, next) => {
    console.log("ClearCookies API /openAI/clear_cookies Path 호출");
    try {
      res.clearCookie("connect.sid", { path: "/" });
      console.log("ClearCookies Success!");
      // res.json({
      //   data: "Clear Cookies Success!",
      // });
      next();
    } catch (err) {
      console.log(err);
      // res.json({
      //   data: "Clear Cookies Fail!",
      // });
    }
  },
  // User 정서행동 검사 11종 결과 반환
  postOpenAIUserEBTResultData: async (req, res) => {
    const { data } = req.body;
    console.log(data);
    let parseData, parsepUid;

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, contentKey, pKeyValue } = parseData;
      // contentKey: AI 분석 결과 반환 트리거
      // keyValue: EBT Table Row Primary Key. 마이페이지 결과보기 버튼에 할당 후 전달받을 예정
      console.log(
        `User 정서행동 검사 결과 반환 API /openAI/ebtresult Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);
      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }
      // pUid default값 설정
      parsepUid = pUid;

      const resultArr = await select_soyesAI_EbtResult_v2(
        pKeyValue,
        contentKey,
        parsepUid
      );

      // 정서행동검사 완료 데이터가 없을 경우
      if (!resultArr.length) {
        return res.status(200).json({
          message: "User Non Have EBT Result",
          data: [],
        });
      }

      // console.log(resultArr);

      return res.status(200).json({
        message: "User EBT Result Return Success!",
        data: resultArr.sort((a, b) => b.tScore - a.tScore),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // getYoutubeContent API
  getYoutubeContent: async (req, res) => {
    // 영상 식별 번호 파라미터
    const videoId = req.params.id;
    try {
      // 식별 번호 없는 요청 처리
      if (!videoId) return res.status(404).send("Video Number not Input");
      // 영상 리스트 가져오기
      const response = await youtube.videos.list({
        id: videoId,
        part: "snippet,player",
      });
      // 영상 O
      if (response.data.items && response.data.items.length > 0) {
        const videoData = response.data.items[0];
        return res.status(200).json(videoData);
      }
      // 영상 X
      else {
        return res.status(404).send("Video not found");
      }
    } catch (error) {
      console.error("Error fetching video data:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  // 상담 Solution 반환 API
  postOpenAIConsultSolutionData: async (req, res) => {
    const { data } = req.body;
    let parseEBTdata, parseMessageArr, parsepUid, parseType;
    let promptArr = []; // 삽입 Prompt Array
    let userPrompt = []; // 삽입 User Prompt Array

    try {
      // json 파싱
      if (typeof data === "string") {
        parseEBTdata = JSON.parse(data);
      } else parseEBTdata = data;

      const { pUid, messageArr, type, avarta } = parseEBTdata;
      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }

      if (!type) {
        console.log("No type input value - 404");
        return res.status(404).json({ message: "No type input value - 404" });
      }

      parsepUid = pUid;
      parseType = type;
      console.log(
        `User 상담 Solution 반환 API /openAI/solution Path 호출 - pUid: ${parsepUid}`
      );

      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // # TODO 솔루션 매칭
      promptArr.push(solution_matching_persona_prompt); // 솔루션 페르소나
      userPrompt.push({
        role: "user",
        content: `대화 내용을 기반으로 적절한 컨텐츠를 1단어로 추천해줘`,
      });

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr, ...userPrompt],
        model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      /* 
      학업/성적: [cognitive, diary, meditation],
      대인관계: [cognitive, diary, balance, emotion, interpersonal],
      가족관계: [cognitive, diary, balance, interpersonal],
      기분/불안: [cognitive, diary, balance, meditation, emotion],
      신체 증상: [cognitive, diary, meditation, emotion],
      자기이해: [cognitive, diary],
      */

      const solution = response.choices[0].message.content;
      const message = {
        solution,
        solutionIndex: (Math.floor(Math.random() * 700) % 7) + 1, // default Index [1 ~ 7]
      };

      // #### 솔루션 임시 meditation 고정값 ####
      console.log(message.solutionIndex);
      message.solution = "meditation";

      //console.log(message);
      switch (message.solution) {
        case "meditation":
          req.session.solution = {
            solutionClass: "meditation",
            // prompt: cognitive_prompt[parseType],
          };
          break;
        case "cognitive":
          req.session.solution = {
            solutionClass: "cognitive",
            prompt: cognitive_prompt[parseType],
          };
          break;
        case "diary":
          req.session.solution = {
            solutionClass: "diary",
            prompt: diary_prompt,
          };
          break;
        case "balance":
          req.session.solution = {
            solutionClass: "balance",
            prompt: balance_prompt,
          };
          break;
        case "emotion":
          // req.session.solution = {
          //   solutionClass: "emotion",
          //   prompt: emotion_prompt,
          // };
          break;
        case "interpersonal":
          // req.session.solution = {
          //   solutionClass: "interpersonal",
          //   prompt: interpersonal_prompt,
          // };
          break;
        default:
          break;
      }
      // Default Solution - 추후 삭제 예정
      return res.status(200).json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // Google Drive 파일 업로드 API
  postOpenAIGoogleDriveUpload: async (req, res) => {
    try {
      const { name, mimeType, data, pUid } = req.body;
      console.log(`Google Drive 파일 업로드 API 호출 - Uid:${pUid}`);

      const bufferStream = new stream.PassThrough();
      bufferStream.end(Buffer.from(data, "base64"));

      const fileMetadata = {
        name,
      };

      const media = {
        mimeType,
        body: bufferStream,
      };

      // 파일 업로드
      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, webViewLink, webContentLink",
      });

      // 파일을 Public으로 설정
      await drive.permissions.create({
        fileId: file.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // soyesnjy@gmail.com 계정에게 파일 공유 설정 (writer 권한)
      await drive.permissions.create({
        fileId: file.data.id,
        requestBody: {
          role: "writer",
          type: "user",
          emailAddress: "soyesnjy@gmail.com",
        },
        // transferOwnership: true, // role:'owner' 일 경우
      });

      // Public URL을 가져오기 위해 파일 정보를 다시 가져옴
      const updatedFile = await drive.files.get({
        fileId: file.data.id,
        fields: "id, webViewLink, webContentLink",
      });

      // 이미지 URL 생성
      const imageUrl = `https://drive.google.com/uc?export=view&id=${file.data.id}`;

      console.log("File uploaded and shared successfully");
      res.send({
        message: "File uploaded and shared successfully",
        webViewLink: updatedFile.data.webViewLink,
        webContentLink: updatedFile.data.webContentLink,
        imageUrl: imageUrl,
      });
    } catch (error) {
      console.log(error);
      res.status(500).send(error.message);
    }
  },
};

const ellaMoodController = {
  // 기분훈련 트레이너 - 엘라 (New)
  postOpenAIEllaMoodTraning: async (req, res) => {
    const { data } = req.body;
    let parseData,
      parseMessageArr = [],
      parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array

    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const {
        messageArr,
        pUid,
        code,
        mood_situation,
        mood_thought,
        mood_todo_list,
        mood_talk_list,
      } = parseData;

      console.log(`엘라 훈련 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }
      // No type => return
      if (!code) {
        console.log("No code input value - 400");
        return res.status(400).json({ message: "No type input value - 400" });
      }
      // No type => return
      if (!messageArr) {
        console.log("No messageArr input value - 400");
        return res
          .status(400)
          .json({ message: "No messageArr input value - 400" });
      }

      // code - situation 관련 필수값 예외처리
      if (code === "situation" && !mood_situation) {
        console.log("No Required input value - 400");
        return res.status(400).json({
          message: `No Required input value: code:${code}, mood_situation:${mood_situation} - 400`,
        });
      }
      // code - thought 관련 필수값 예외처리
      if (code === "thought" && !mood_thought) {
        console.log("No Required input value - 400");
        return res.status(400).json({
          message: `No Required input value: code:${code}, mood_thought:${mood_thought} - 400`,
        });
      }
      // code - listing 관련 필수값 예외처리
      if (code === "listing" && !mood_todo_list) {
        console.log("No Required input value - 400");
        return res.status(400).json({
          message: `No Required input value: code:${code}, mood_todo_list:${mood_todo_list} - 400`,
        });
      }
      // code - talking 관련 필수값 예외처리
      if (code === "talking" && !mood_talk_list) {
        console.log("No Required input value - 400");
        return res.status(400).json({
          message: `No Required input value: code:${code}, mood_talk_list:${mood_talk_list} - 400`,
        });
      }

      // pUid default값 설정
      parsepUid = pUid;

      promptArr.push(persona_prompt_lala_v5); // 엘라 페르소나

      // code 매칭 프롬프트 삽입
      switch (code) {
        case "emotion":
          promptArr.push({
            role: "system",
            content: `유저가 마지막으로 한 말에 공감하되, 절대 질문으로 문장을 끝내지 않는다.`,
          });
          parseMessageArr = [...messageArr];
          break;
        case "situation":
          promptArr.push({
            role: "system",
            content: `아래 문장에 기초하여 유저에게 상황을 바꿀 방법을 생각해보게 한다.
            '''
            ${mood_situation}
            '''
            예시: '~할 때 ~를 만난다고 했어. 이 상황을 바꿀 방법이 있을까?'
            `,
          });
          parseMessageArr = [...messageArr];
          break;
        case "solution":
          promptArr.push({
            role: "system",
            content: `user가 잘 말하면 격려해준다. user가 말하지 않은 해결 방법을 하나 말해준다. 초등학교 6학년이 할 수 있는 방법이어야 한다.
            예시: '~해보면 어떨까?'
            `,
          });
          parseMessageArr = [...messageArr];
          break;
        case "thought":
          promptArr.push({
            role: "system",
            // 2024.10.07 이전 프롬프트
            // content: `아래 문장에 기초해서 다른 관점을 생각해보도록 한다.
            // '''
            // ${mood_thought}
            // '''
            // 예시: '그건 정말 그래. 그런데 다르게도 생각해볼 수 있을까?'`,
            // 2024.10.07 프롬프트 변경
            content:
              "슬플 때 유저가 하는 생각에 초등학생의 눈높이에 맞춰 한 문장으로 유저의 감정을 반영하며 공감한다. 질문은 하지 않는다.",
          });
          // parseMessageArr = [...messageArr];
          break;
        case "another":
          promptArr.push({
            role: "system",
            content: `User응답에 반응한 뒤 상황을 다른 관점으로는 어떻게 볼 수 있는지를 한 가지 제시한다. 
            "~해보는 것도 좋을 것 같아" `,
          });
          parseMessageArr = [...messageArr];
          break;
        case "listing":
          promptArr.push({
            role: "system",
            content: `아래 3개의 문장은 유저가 작성한 Todo List이다. 
보기좋게 다듬어서 목록 형식으로 나열한다. 
Todo List가 아니라고 판단되면 제외한다.
'''
1. ${mood_todo_list[0]}
2. ${mood_todo_list[1]}
3. ${mood_todo_list[2]}
'''
반드시 목록 형식으로 작성되어야 한다.`,
          });

          break;
        case "talking":
          promptArr.push({
            role: "system",
            content: `아래 3개의 문장은 유저가 mood_name에게 하고싶은 말이다.
보기좋게 다듬어서 목록 형식으로 나열한다.
'''
1. ${mood_talk_list[0]}
2. ${mood_talk_list[1]}
3. ${mood_talk_list[2]}
'''
반드시 목록 형식으로 작성되어야 한다.`,
          });
          break;
      }

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      const message = {
        message: response.choices[0].message.content,
      };

      return res.status(200).json(message);
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Server Error - 500 Bad Gateway" + err.message,
      });
    }
  },
  // 기분훈련 저장 API
  postOpenAIMoodDataSave: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid, parseType; // Parsing 변수
    const typeArr = ["first", "second", "third", "fourth"]; // type 식별자
    const regex = /^(?![1-4]$).+$/;
    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const {
        pUid,
        type, // 2024.09.05: String -> Int 변경
        mood_situation,
        mood_thought,
        mood_solution,
        mood_different_thought,
        mood_rating,
        mood_name,
        mood_cognitive_score,
        mood_todo_list,
        mood_talk_list,
        mood_meditation_feedback,
      } = parseData;

      console.log(
        `기분 훈련 저장 API /openAI/training_mood_ella/save Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // No Required Mood Data => return
      if (
        !pUid ||
        !type ||
        !mood_situation ||
        !mood_thought ||
        !mood_solution ||
        !mood_different_thought ||
        !mood_rating
      ) {
        console.log("No type input value - 400");
        return res
          .status(400)
          .json({ message: "No Required Mood Data input value - 400" });
      }

      if (regex.test(String(type))) {
        console.log(`type is not matching [1 ~ 4] - pUid: ${parsepUid}`);
        return res.status(400).json({
          message: "type is not matching [1 ~ 4]",
        });
      }

      parseType = typeArr[type - 1];
      console.log(`parseType : ${parseType}`);

      // 타입별 필수 입력값 체크
      if (parseType === "first" && (!mood_name || !mood_cognitive_score)) {
        console.log(
          `There are no input values suitable for the type (first) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "There are no input values suitable for the type",
        });
      }
      if (parseType === "second" && !mood_todo_list) {
        console.log(
          `There are no input values suitable for the type (second) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "There are no input values suitable for the type",
        });
      }
      if (parseType === "third" && !mood_talk_list) {
        console.log(
          `There are no input values suitable for the type (third) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "There are no input values suitable for the type",
        });
      }
      if (parseType === "fourth" && !mood_meditation_feedback) {
        console.log(
          `There are no input values suitable for the type (fourth) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "There are no input values suitable for the type",
        });
      }

      // pUid default값 설정
      parsepUid = pUid;

      const table = Ella_Training_Table_Info["Mood"].table;
      // const attribute = Ella_Training_Table_Info["Mood"].attribute;

      let update_query, update_value;

      // 1. SELECT User Mood Table Data
      const select_query = `SELECT * FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      const select_data = await fetchUserData(connection_AI, select_query);

      // console.log(select_data[0]);

      // 기분 훈련 데이터가 있을 경우, mood_round_idx가 4가 아닐 경우 Not Matching 에러
      if (
        parseType === "first" &&
        select_data.length &&
        select_data[0].mood_round_idx !== 4
      ) {
        console.log(
          `The type value does not match the current episode (first) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode",
        });
      }

      // 기분 훈련 데이터가 있을 경우, mood_round_idx가 4가 아닐 경우 Not Matching 에러
      if (
        parseType === "second" &&
        select_data.length &&
        select_data[0].mood_round_idx !== 1
      ) {
        console.log(
          `The type value does not match the current episode (second) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode",
        });
      }

      // 기분 훈련 데이터가 있을 경우, mood_round_idx가 4가 아닐 경우 Not Matching 에러
      if (
        parseType === "third" &&
        select_data.length &&
        select_data[0].mood_round_idx !== 2
      ) {
        console.log(
          `The type value does not match the current episode (third)- pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode",
        });
      }

      // 기분 훈련 데이터가 있을 경우, mood_round_idx가 4가 아닐 경우 Not Matching 에러
      if (
        parseType === "fourth" &&
        select_data.length &&
        select_data[0].mood_round_idx !== 3
      ) {
        console.log(
          `The type value does not match the current episode (fourth) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode",
        });
      }

      // 타입별 query, value 삽입
      switch (parseType) {
        case "first":
          const insert_query = `INSERT INTO ${table} 
          (uid,
          mood_round_idx,
          mood_name,
          mood_score,
          mood_avartar,
          mood_situation_first,
          mood_thought_first,
          mood_solution_first,
          mood_different_thought_first,
          mood_rating_first)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
          // console.log(insert_query);
          const insert_value = [
            parsepUid,
            1,
            mood_name,
            mood_cognitive_score,
            "Ella",
            mood_situation,
            mood_thought,
            mood_solution,
            mood_different_thought,
            mood_rating,
          ];
          // console.log(insert_value);

          connection_AI.query(
            insert_query,
            insert_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Mood First Insert Success!");
              return res
                .status(200)
                .json({ message: "Mood First Data Save Success!" });
            }
          );

          break;
        case "second":
          update_query = `UPDATE ${table} SET 
          mood_round_idx = ?,
          mood_todo_list = ?,
          mood_situation_second = ?,
          mood_thought_second = ?,
          mood_solution_second = ?,
          mood_different_thought_second = ?,
          mood_rating_second = ?
          WHERE mood_idx = ?`;

          // console.log(update_query);
          update_value = [
            2,
            JSON.stringify(mood_todo_list),
            mood_situation,
            mood_thought,
            mood_solution,
            mood_different_thought,
            mood_rating,
            select_data[0].mood_idx,
          ];
          // console.log(update_value);
          connection_AI.query(
            update_query,
            update_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Mood Second Update Success!");
              return res
                .status(200)
                .json({ message: "Mood Second Data Save Success!" });
            }
          );
          break;
        case "third":
          update_query = `UPDATE ${table} SET 
          mood_round_idx = ?,
          mood_talk_list = ?,
          mood_situation_third = ?,
          mood_thought_third = ?,
          mood_solution_third = ?,
          mood_different_thought_third = ?,
          mood_rating_third = ?
          WHERE mood_idx = ?`;
          // console.log(update_query);
          update_value = [
            3,
            JSON.stringify(mood_talk_list),
            mood_situation,
            mood_thought,
            mood_solution,
            mood_different_thought,
            mood_rating,
            select_data[0].mood_idx,
          ];
          // console.log(update_value);
          connection_AI.query(
            update_query,
            update_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Mood Third Update Success!");
              return res
                .status(200)
                .json({ message: "Mood Third Data Save Success!" });
            }
          );
          break;
        case "fourth":
          update_query = `UPDATE ${table} SET
          mood_round_idx = ?,
          mood_meditation_feedback = ?,
          mood_situation_fourth = ?,
          mood_thought_fourth = ?,
          mood_solution_fourth = ?,
          mood_different_thought_fourth = ?,
          mood_rating_fourth = ?
          WHERE mood_idx = ?`;
          // console.log(update_query);
          update_value = [
            4,
            mood_meditation_feedback,
            mood_situation,
            mood_thought,
            mood_solution,
            mood_different_thought,
            mood_rating,
            select_data[0].mood_idx,
          ];
          // console.log(update_value);
          connection_AI.query(
            update_query,
            update_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Mood Fourth Update Success!");
              return res
                .status(200)
                .json({ message: "Mood Fourth Data Save Success!" });
            }
          );
          break;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // 기분훈련 시작 데이터 Load API
  postOpenAIMoodDataLoad: async (req, res) => {
    const { data } = req.body;

    let parseData, parsepUid; // Parsing 변수

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid } = parseData;

      console.log(`기분 훈련 Start Data Load API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;

      // Mood Table 명시
      const table = Ella_Training_Table_Info["Mood"].table;
      const attribute = Ella_Training_Table_Info["Mood"].attribute;
      // Mood Table User 조회
      const select_query = `SELECT * FROM ${table} WHERE ${attribute.fKey} = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      const select_data = await fetchUserData(connection_AI, select_query);
      // case.1 - Row가 없거나 mood_round_idx값이 4일 경우: 기분관리 프로그램을 시작하는 인원. { mood_round_idx: 0, mood_name: "" } 반환
      if (!select_data[0] || select_data[0].mood_round_idx === 4)
        return res.json({ mood_round_idx: 0, mood_name: "" });
      // case.2 - Row가 있을 경우: 기분관리 프로그램을 진행했던 인원. { mood_round_idx: data.mood_round_idx, mood_name: data.mood_name } 반환
      else {
        return res.status(200).json({
          mood_round_idx: select_data[0].mood_round_idx,
          mood_name: select_data[0].mood_name,
        });
      }

      // dummy data (임시)
      // return res.json({ mood_round_idx: 0, mood_name: "" });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // 기분훈련 보고서 데이터 Load API
  postOpenAIMoodTrainingDataLoad: async (req, res) => {
    const { data } = req.body;

    let parseData, parsepUid; // Parsing 변수
    const typeArr = [1, 2, 3, 4];
    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, type } = parseData;

      console.log(`기분 훈련 보고서 Data Load API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }

      // No type => return
      if (!type) {
        console.log("No type input value - 400");
        return res.status(400).json({ message: "No type input value - 400" });
      }

      // No Matching Type Value => return
      if (!typeArr.includes(type)) {
        console.log("No matching Type value - 400");
        return res
          .status(400)
          .json({ message: "No matching Type value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;

      // Mood Table 명시
      const table = Ella_Training_Table_Info["Mood"].table;

      // Mood Table User 조회
      let select_query;
      let select_data;

      switch (type) {
        case 1:
          select_query = `SELECT mood_name, mood_situation_first, mood_thought_first, mood_solution_first, mood_different_thought_first, mood_score FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.mood_score)
            return res
              .status(200)
              .json({ message: "Non Mood Training First Data" });

          return res.status(200).json({
            message: "Mood Training First Data Load Success!",
            data: {
              mood_name: select_data[0]?.mood_name,
              mood_situation: select_data[0]?.mood_situation_first,
              mood_thought: select_data[0]?.mood_thought_first,
              mood_solution: select_data[0]?.mood_solution_first,
              mood_different_thought:
                select_data[0]?.mood_different_thought_first,
              mood_cognitive_score: select_data[0]?.mood_score,
            },
          });
        case 2:
          select_query = `SELECT mood_name, mood_situation_second, mood_thought_second, mood_solution_second, mood_different_thought_second, mood_todo_list FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.mood_todo_list)
            return res
              .status(200)
              .json({ message: "Non Mood Training Second Data" });

          return res.status(200).json({
            message: "Mood Training Second Data Load Success!",
            data: {
              mood_name: select_data[0]?.mood_name,
              mood_situation: select_data[0]?.mood_situation_second,
              mood_thought: select_data[0]?.mood_thought_second,
              mood_solution: select_data[0]?.mood_solution_second,
              mood_different_thought:
                select_data[0]?.mood_different_thought_second,
              mood_todo_list: JSON.parse(select_data[0]?.mood_todo_list),
            },
          });
        case 3:
          select_query = `SELECT mood_name, mood_situation_third, mood_thought_third, mood_solution_third, mood_different_thought_third, mood_talk_list FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.mood_talk_list)
            return res
              .status(200)
              .json({ message: "Non Mood Training Third Data" });

          return res.status(200).json({
            message: "Mood Training Third Data Load Success!",
            data: {
              mood_name: select_data[0]?.mood_name,
              mood_situation: select_data[0]?.mood_situation_third,
              mood_thought: select_data[0]?.mood_thought_third,
              mood_solution: select_data[0]?.mood_solution_third,
              mood_different_thought:
                select_data[0]?.mood_different_thought_third,
              mood_talk_list: JSON.parse(select_data[0]?.mood_talk_list),
            },
          });
        case 4:
          select_query = `SELECT mood_name, mood_situation_fourth, mood_thought_fourth, mood_solution_fourth, mood_different_thought_fourth, mood_meditation_feedback FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.mood_meditation_feedback)
            return res
              .status(200)
              .json({ message: "Non Mood Training Fourth Data" });

          return res.status(200).json({
            message: "Mood Training Fourth Data Load Success!",
            data: {
              mood_name: select_data[0]?.mood_name,
              mood_situation: select_data[0]?.mood_situation_fourth,
              mood_thought: select_data[0]?.mood_thought_fourth,
              mood_solution: select_data[0]?.mood_solution_fourth,
              mood_different_thought:
                select_data[0]?.mood_different_thought_fourth,
              mood_meditation_feedback:
                select_data[0]?.mood_meditation_feedback,
            },
          });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
};

const ellaFriendController = {
  // 또래관계 훈련 - 엘라
  postOpenAIEllaFriendTraning: async (req, res) => {
    const { data } = req.body;
    let parseData,
      parseMessageArr = [],
      parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    let temperature = 1;
    const codeArr = [
      "friend_new_consult",
      "friend_new_analysis",
      "friend_group_analysis_first",
      "friend_group_analysis_second",
      "friend_group_analysis_third",
      "friend_conflict_consult",
      "friend_conflict_analysis",
    ];
    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { messageArr, pUid, code } = parseData;

      console.log(`엘라 또래관계 훈련 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }
      // No type => return
      if (!code) {
        console.log("No code input value - 400");
        return res.status(400).json({ message: "No type input value - 400" });
      }
      // No messageArr => return
      if (!messageArr) {
        console.log("No messageArr input value - 400");
        return res
          .status(400)
          .json({ message: "No messageArr input value - 400" });
      }

      // No Matching code Value => return
      if (!codeArr.includes(code)) {
        console.log("No matching code value - 400");
        return res
          .status(400)
          .json({ message: "No matching code value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;
      parseMessageArr = [...messageArr];

      // promptArr.push(persona_prompt_lala_v6); // 엘라 페르소나

      // code 매칭 프롬프트 삽입
      switch (code) {
        case "friend_new_consult":
          promptArr.push(persona_prompt_lala_v6);
          promptArr.push({
            role: "system",
            // 2024.10.08 이전 프롬프트
            // content: `대화 3번까지: user가 자신을 소개하지 않으면 먼저 자기 이름을 말하고 user 이름을 묻는다. 이름을 묻고 난 뒤에는 user에게 관심을 보이며 질문을 하나 한다.
            // 4번째 대화부터: user의 말에 단답형으로 말하고 질문하지 않는다. user가 자신과 공통 관심사가 있는 경우에는 자기개방을 하며 관심을 표현한다. 관심을 보일 때는 ‘대단하다’, ‘나도 하고 싶어’, ‘그거 뭐야’, ‘정말?’ 같은 말을 종종 사용한다. user가 자신을 칭찬하면 user에 대해서도 질문한다. user가 엘라가 좋아하는 것을 비난하거나, 욕을 하거나, 단답형으로 말하면 '아, 그래', '알겠어', '그렇게 말하면 불편해' 등으로 짧게 말한다. 반대로 엘라의 말에 user가 불편해하거나 어색해하면 사과하고 분위기를 돌린다.`,
            // 2024.10.08 프롬프트 교체
            content: `assistant의 이름은 '엘라' 초등학교 4학년이며 user와 처음 만나서 서먹하며 user가 질문하는 경우 외에는 모두 단답형으로 답한다. 엘라는 떡볶이를 좋아하고 더 매운 맛을 먹어보고 싶어한다. 딱히 좋아하는 운동은 없다. 처음에 '안녕'이라고 인사한다. 이후 user가 자신을 소개하지 않으면 먼저 자기 이름을 말하고 user 이름을 묻는다. user가 자신과 공통 관심사가 있는 경우에는 자기 개방을 한다. uesr가 엘라에게 질문하는 경우에만 user에게 질문한다. user가 엘라가 좋아하는 것을 비난하거나, 욕을 하거나, 단답형으로 말하면 '아, 그래', '알겠어', '그렇게 말하면 불편해' 등으로 짧게 말한다. 반대로 엘라의 말에 user가 불편해하거나 어색해하면 사과한다.`,
          });
          break;
        case "friend_new_analysis":
          promptArr.push({
            role: "system",
            content: `각 단계의 분석을 수행하고 4단계 내용을 user에게 출력하라.
1단계: 기준 1, 2에 해당하는 user 반응은 1점, 기준 3-6에 해당하는 user 반응은 2점으로 변환하여 채점한다. assistant의 반응은 분석에서 제외한다.  1단계 점수는 user에게 표시하지 않는다. 
기준
1. 친구에게 먼저 이름을 물어봤어요
2. 처음 만난 친구에게 자신이 누구인지 소개했어요
3. 친구와 함께 대화할 수 있는 질문을 했어요
4. 친구의 답변에 나도 내 이야기를 해서 대화를 이어나가요
5. 친구의 좋은 점을 알아보고 칭찬했어요.
6. 엘라와 공통점을 찾았어요.

2단계: “user”의 말 중에 좋은 반응이 있는지 여부를 분석하라. 좋은 반응 내용은 다음과 같다. assistant의 반응은 분석에서 제외한다.  2단계 분석은 user에게 표시하지 않는다. 
친구에게 먼저 이름을 물어봤어요
처음 만난 친구에게 자신이 누구인지 소개했어요
친구와 함께 대화할 수 있는 질문을 했어요
친구의 답변에 나도 내 이야기를 해서 대화를 이어나가요
친구의 좋은 점을 알아보고 칭찬했어요.
엘라와 공통점을 찾았어요.

3단계: “user”의 말 중에 더 나은 반응이 가능한 문장을 하나 고르라. assistant의 반응은 분석에서 제외한다.  3단계 분석 내용은 user에게 표시하지 않는다.

4단계: 다음 형식으로 유저에게 출력한다.
1) 1단계 점수에 맞는 멘트만 출력한다. 점수는 출력하지 않는다. 8점 이상 "새로운 친구와 잘 대화했어. 실제 친구와도 이렇게 대화해 봐" 5~7점 "대화를 이어가려고 노력했어. 계속 연습해보자" 4점 이하 "새로운 친구와 대화를 이어가기 어려웠던 걸까? 계속 연습해보자"라고 한다.
2) '이런 반응들은 좋았어'라고 하며 1단계에서 관찰된 좋은 반응 내용과 user의 실제 응답을 알려준다. 좋은 반응이 여러 개 관찰되면 여러 개 다 알려준다.
3)  2단계에서 고른 "user"의 말과 대안 반응`,
          });
          temperature = 0.7; // 고정된 형식 답변 유도를 위한 수치 조정
          break;
        case "friend_group_analysis_first":
          promptArr.push({
            role: "system",
            content: `assistant는 반말과 초등학교 6학년 수준에 맞는 어휘를 사용한다. assistant는 user의 반응을 분석하고 대안을 제시하는 역할을 한다.
아이들이 몇 명씩 모여 놀이터에서 놀고 있다. user는 자신이 이때 어떻게 할지 얘기할 것이다. user 가 반응하면 아이들 사이에 잘 섞일 수 있게 다가가는지 2문장으로 평가하라. 다가가지 않거나, 친구들을 불쾌하게 할 수 있는 내용 외에는 유저의 반응을 격려한다. 같이 놀아도 되냐고 물어보는 것도 좋지만 친구를 도와주거나, 친구가 하고 있는 놀이에 관심을 보이거나, 친구의 놀이를 보고 재밌겠다고 말하거나 친구를 칭찬하는 것 등의 반응이 친구들의 놀이 흐름을 끊지 않고 자연스럽게 어울릴 수 있는 방법이라고 알려준다. 이름을 부르면서 다가간다고 하는 경우 이때 반가움을 표현하면 더 좋다고 알려준다.`,
          });
          break;
        case "friend_group_analysis_second":
          promptArr.push({
            role: "system",
            content: `assistant는 반말과 초등학교 6학년 수준에 맞는 어휘를 사용한다. assistant는 user의 반응을 분석하고 대안을 제시하는 역할을 한다.
아이들이 쉬는 시간에 3-4명씩 모여 떠들거나 놀고 있다. user는 자신이 이때 어떻게 할지 얘기할 것이다. user 가 반응하면 아이들의 이목을 집중시키지 않고 자연스럽게 대화에 참여할 수 있는 반응을 하는지 2문장으로 평가하라. 직접적으로 같이 얘기해도 되는지 물어보는 경우, 괜찮은 반응이지만 친구들의 이야기 흐름을 끊을 수도 있음을 알려준다. 어떤 이야기를 하고 있는지 관찰한 뒤 재미있는 부분에서 같이 웃으며 살며시 끼어들거나, 다른 아이 말에 비슷한 경험이 있다고 말하며 공감을 표현하거나, 다른 아이 말에 질문을 하며 관심을 표현하는 등, 다른 반응 예시를 하나 들어준다.`,
          });
          break;
        case "friend_group_analysis_third":
          promptArr.push({
            role: "system",
            content: `assistant는 반말과 초등학교 6학년 수준에 맞는 어휘를 사용한다. assistant는 user의 반응을 분석하고 대안을 제시하는 역할을 한다.
아이들이 모여 보드게임을 하고 있다. user는 자신이 이때 어떻게 할지 얘기할 것이다. user 가 반응하면 아이들의 게임을 방해하지 않으면서 자연스럽게 참여할 수 있을지를 2문장으로 평가한다. 아이들이 게임을 하고 있는 중에 하고 싶다고 말하기보다 끝나기를 기다렸다가 다음 순서에 ‘재밌겠다. 나랑 한 번 해볼래?’라고 하거나, 협동이 필요한 게임에서 도움이 될 만한 행동을 하거나, 친구들의 게임을 즐겁게 지켜보는 것이 좋은 반응이다. 하지만 귓속말로 특정한 사람에게만 힌트를 주는 것과 같은 행동은 갈등을 일으킬 수 있다. 이를 참고하여 유저의 반응과 다른 예시를 하나 들어준다.`,
          });
          break;
        case "friend_conflict_consult":
          promptArr.push({
            role: "system",
            // 2024.10.08 이전 프롬프트
            // content: `user의 응답 내용을 기초로 대화 상대방 역할을 맡아 대화를 시작한다. User가 대화 종료를 누르기 전까지 대화를 지속한다.`,
            // 2024.10.08 프롬프트 교체
            content: `엘라는 명시된 A, B, C를 참고하여 user와 역할극을 진행한다.
'''
A: user가 지정한 또래친구.
B: user가 지정한 A와 대화하는 상황.
C: user가 지정한 user를 힘들게하는 말과 행동.
'''
엘라의 역할: A는 user를 힘들게 하는 말과 행동(C)을 하며 대화를 이어간다.
B와 C를 참고해 일관적으로 반응해야 한다. 사과나, 공감하는 말은 하면 안 된다.
한 번에 60자 이내로 말한다.`,
          });
          break;
        case "friend_conflict_analysis":
          promptArr.push({
            role: "system",
            // 2024.10.08 프롬프트 교체
            content: `user가 대화 종료를 누르면 user의 반응 중 한 문장을 친구에게 보다 나은 반응으로 수정하고 근거를 70자 이내로 설명한다.
보다 나은 반응은 자신을 존중하거나, 자신이 원하는 결과를 얻거나, 타인과 원만한 관계를 맺는데 도움이 되는 반응이어야한다.`,
          });
          break;
      }

      // console.log(temperature);

      const response = await openai.chat.completions.create({
        messages: [...parseMessageArr, ...promptArr],
        model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
        temperature,
      });

      const message = {
        message: response.choices[0].message.content,
      };

      return res.status(200).json(message);
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Server Error - 500 Bad Gateway" + err.message,
      });
    }
  },
  // 또래관계 훈련 저장 API
  postOpenAIFriendDataSave: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid; // Parsing 변수
    // type 식별자 friend_new, friend_group, friend_test, friend_conflict
    const typeArr = [
      "friend_new",
      "friend_group",
      "friend_test",
      "friend_conflict",
    ];
    const resultArr = ["FTH", "FSH", "LTH", "LSH", "FTL", "FSL", "LTL", "LSL"];
    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, type, result, messageArr } = parseData;
      console.log(
        `또래관계 훈련 저장 API /openAI/training_friend_ella/save Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // No Required Mood Data => return
      if (!pUid || !type) {
        console.log("No Required input value - 400");
        return res
          .status(400)
          .json({ message: "No Required Mood Data input value - 400" });
      }

      // No Matching Type Value => return
      if (!typeArr.includes(type)) {
        console.log("No matching Type value - 400");
        return res
          .status(400)
          .json({ message: "No matching Type value - 400" });
      }

      parsepUid = pUid;

      // friend_test 필수 입력값 체크
      if (type === "friend_test") {
        // No result Value => return
        if (!result) {
          console.log(
            `There are no input values suitable for the type - pUid: ${parsepUid}`
          );
          return res.status(400).json({
            message: "There are no input values suitable for the type",
          });
        }
        // No Matching Result Value => return
        else if (!resultArr.includes(result)) {
          console.log("No matching Result value - 400");
          return res
            .status(400)
            .json({ message: "No matching Result value - 400" });
        }
      }
      // 그 외 타입 필수 입력값 체크
      if (
        (type === "friend_new" ||
          type === "friend_group" ||
          type === "friend_conflict") &&
        !messageArr
      ) {
        console.log(
          `There are no input values suitable for the type - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "There are no input values suitable for the type",
        });
      }

      const table = Ella_Training_Table_Info["Friend"].table;
      // const attribute = Ella_Training_Table_Info["Friend"].attribute;

      let insert_query, insert_value;

      // console.log(select_data[0]);

      // 타입별 query, value 삽입
      switch (type) {
        case "friend_test":
          insert_query = `INSERT INTO ${table} (uid, friend_type, friend_result) VALUES (?, ?, ?);`;
          // console.log(insert_query);
          insert_value = [parsepUid, type, result];
          // console.log(insert_value);

          connection_AI.query(
            insert_query,
            insert_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Friend Data Insert Success!");
              return res
                .status(200)
                .json({ message: "Friend Data Save Success!" });
            }
          );

          break;
        default:
          insert_query = `INSERT INTO ${table} (uid, friend_type, friend_consult_log) VALUES (?, ?, ?);`;
          // console.log(insert_query);
          insert_value = [parsepUid, type, JSON.stringify(messageArr)];
          // console.log(insert_value);

          connection_AI.query(
            insert_query,
            insert_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Friend Data Insert Success!");
              return res
                .status(200)
                .json({ message: "Friend Data Save Success!" });
            }
          );
          break;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // 또래관계 보고서 데이터 Load API
  postOpenAIFriendTrainingDataLoad: async (req, res) => {
    const { data } = req.body;

    let parseData, parsepUid; // Parsing 변수
    const typeArr = [
      "friend_new",
      "friend_group",
      "friend_test",
      "friend_conflict",
    ];
    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, type } = parseData;

      console.log(`또래관계 보고서 Data Load API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }

      // No type => return
      if (!type) {
        console.log("No type input value - 400");
        return res.status(400).json({ message: "No type input value - 400" });
      }

      // No Matching Type Value => return
      if (!typeArr.includes(type)) {
        console.log("No matching Type value - 400");
        return res
          .status(400)
          .json({ message: "No matching Type value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;

      // Mood Table 명시
      const table = Ella_Training_Table_Info["Friend"].table;

      // Mood Table User 조회
      let select_query;
      let select_data;

      switch (type) {
        case "friend_test":
          select_query = `SELECT friend_result FROM ${table} WHERE uid = '${parsepUid}' AND friend_type = 'friend_test' ORDER BY created_at DESC LIMIT 1;`;
          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.friend_result)
            return res.status(200).json({ message: "Non Friend Test Data" });

          return res.status(200).json({
            message: "Friend Training Test Data Load Success!",
            data: {
              friend_result: select_data[0].friend_result,
            },
          });
        case "friend_new":
          select_query = `SELECT friend_consult_log FROM ${table} WHERE uid = '${parsepUid}' AND friend_type = 'friend_new' ORDER BY created_at DESC LIMIT 1;`;
          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.friend_consult_log)
            return res.status(200).json({ message: "Non Friend New Data" });

          return res.status(200).json({
            message: "Friend Training New Data Load Success!",
            data: {
              friend_consult_log: JSON.parse(select_data[0].friend_consult_log),
            },
          });
        case "friend_group":
          select_query = `SELECT friend_consult_log FROM ${table} WHERE uid = '${parsepUid}' AND friend_type = 'friend_group' ORDER BY created_at DESC LIMIT 1;`;
          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.friend_consult_log)
            return res.status(200).json({ message: "Non Friend Group Data" });

          return res.status(200).json({
            message: "Friend Training Group Data Load Success!",
            data: {
              friend_consult_log: JSON.parse(select_data[0].friend_consult_log),
            },
          });
        case "friend_conflict":
          select_query = `SELECT friend_consult_log FROM ${table} WHERE uid = '${parsepUid}' AND friend_type = 'friend_conflict' ORDER BY created_at DESC LIMIT 1;`;
          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.friend_consult_log)
            return res
              .status(200)
              .json({ message: "Non Friend Conflict Data" });

          return res.status(200).json({
            message: "Friend Training Conflict Data Load Success!",
            data: {
              friend_consult_log: JSON.parse(select_data[0].friend_consult_log),
            },
          });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
};

const ellaAnxietyController = {
  // 불안훈련 트레이너 - 엘라 (New)
  postOpenAIEllaAnxietyTraning: async (req, res) => {
    const { data } = req.body;
    let parseData,
      parseMessageArr = [],
      parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    // 불안훈련 code 식별값
    const codeArr = [
      "situation",
      "emotion",
      "consolation",
      "solution",
      "box_end",
      "challenge_start",
      "challenge_recommend",
      "challenge_end",
    ];
    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { messageArr, pUid, code } = parseData;

      console.log(`엘라 불안 훈련 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }
      // No type => return
      if (!code) {
        console.log("No code input value - 400");
        return res.status(400).json({ message: "No type input value - 400" });
      }
      // No type => return
      if (!messageArr) {
        console.log("No messageArr input value - 400");
        return res
          .status(400)
          .json({ message: "No messageArr input value - 400" });
      }
      // No Matching codeArr => return
      if (!codeArr.includes(code)) {
        console.log("No matching code value - 400");
        return res
          .status(400)
          .json({ message: "No matching code value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;
      parseMessageArr = [...messageArr];
      promptArr.push(persona_prompt_lala_v6); // 엘라 페르소나

      // code 매칭 프롬프트 삽입
      switch (code) {
        case "situation":
          promptArr.push({
            role: "system",
            content: `user가 불안하다고 말한 상황에 반응한다.`,
          });
          break;
        case "emotion":
          promptArr.push({
            role: "system",
            content: `유저가 마지막으로 한 말에 1문장으로 공감한다.`,
          });
          break;
        case "consolation":
          promptArr.push({
            role: "system",
            content: `유저가 불안해하고 걱정하는 내용에 초등학생의 눈높이에 맞춰 한 문장으로 유저의 감정을 반영하며 공감한다. 질문은 하지 않는다.`,
          });
          break;
        case "solution":
          promptArr.push({
            role: "system",
            content: `유저가 불안해하고 걱정하는 상황에 대해 초등학생이 시도해볼 수 있는 해결책을 70자 이내로 한 가지 제시한다. 예) ~해보면 어때?`,
          });
          break;
        case "box_end":
          promptArr.push({
            role: "system",
            content: `유저의 마지막 말을 듣고 감정을 반영하며 한 문장으로 공감한다. 이후 이번 상담은 여기서 마치려고 한다고 이야기한 후 종료한다.`,
          });
          break;
        case "challenge_start":
          promptArr.push({
            role: "system",
            content: `assistant의 이름은 '엘라' 이며 반말을 사용한다.
            user가 두렵고 떨리지만 도전하고 싶은 목표를 말하면, 엘라는 '이렇게 차근차근 도전해보자'라고 하며 점진적으로 연습할 수 있는 5단계 활동을 300자 이내로 제시하고 '어떤 것 같아?'라는 말로 마친다.
            5단계 활동은 초등학생이 할 수 있는 활동이어야 한다. 
            유저가 새 활동을 추천해달라고 하는 경우, 새로운 5단계 활동을 300자 이내로 제시한다.
            
            form
            '''
            1단계: 매일 아침에 가볍게 스트레칭하기.
            2단계: 집 앞 공원에서 가벼운 산책해보기.
            3단계: 집에서 할 수 있는 줄넘기 도전해보기.
            4단계: 친구랑 같이 자전거나 인라인스케이트 타기.
            5단계: 가족과 함께 주말마다 등산 가기!
            '''
            `,
          });
          break;
        case "challenge_recommend":
          promptArr.push({
            role: "system",
            content: `유저가 활동을 언제, 어디에서 실천할지 입력한 경우, 계획을 잘 세웠다고 격려한다. 유저가 활동을 실천할 수 있는 시간이나 장소를 말하지 못한 경우, ‘~는 어떨까?’라는 말로 대안을 제시한다.`,
          });
          break;
        case "challenge_end":
          promptArr.push({
            role: "system",
            content: `user 응답에 반응한다. '차근차근 도전해보고 두려운 마음이 어떻게 변하는지 북극이 일기에도 써보자'라고 한다.`,
          });
          break;
      }

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      const message = {
        message: response.choices[0].message.content,
      };

      return res.status(200).json(message);
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Server Error - 500 Bad Gateway" + err.message,
      });
    }
  },
  // 불안훈련 저장 API
  postOpenAIAnxietyDataSave: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid, parseType; // Parsing 변수
    const typeArr = ["first", "second", "third", "fourth", "fifth"]; // type 식별자
    const regex = /^(?![1-5]$).+$/;

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const {
        // 필수 입력
        pUid,
        type,
        anxiety_situation,
        anxiety_physical,
        anxiety_thought,
        anxiety_rating,
        // 조건부 입력
        anxiety_name, // 1회기
        anxiety_worrys, // 1~3회기
        anxiety_cognitive_score, // 4회기
        anxiety_challenge_steps, // 5회기
        anxiety_challenge_score, // 5회기
      } = parseData;

      console.log(
        `불안 훈련 저장 API /openAI/training_mood_ella/save Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // No Required Mood Data => return
      if (
        !pUid ||
        !type ||
        !anxiety_situation ||
        !anxiety_physical ||
        !anxiety_thought ||
        !anxiety_rating
      ) {
        console.log("No type input value - 400");
        return res
          .status(400)
          .json({ message: "No Required Anxiety Data input value - 400" });
      }

      // type [1~5] 체크
      if (regex.test(String(type))) {
        console.log(`Type is not matching [1 ~ 5] - pUid: ${parsepUid}`);
        return res.status(400).json({
          message: "Type is not matching [1 ~ 5]",
        });
      }

      parseType = typeArr[type - 1];
      console.log(`parseType : ${parseType}`);

      // 타입별 필수 입력값 체크
      if (parseType === "first" && !anxiety_name) {
        console.log(
          `There are no input values suitable for the type (first) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "There are no input values suitable for the type",
        });
      }

      if (
        (parseType === "first" ||
          parseType === "second" ||
          parseType === "third") &&
        !anxiety_worrys
      ) {
        console.log(
          `There are no input values suitable for the type (anxiety_worrys) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "There are no input values suitable for the type",
        });
      }
      if (parseType === "fourth" && !anxiety_cognitive_score) {
        console.log(
          `There are no input values suitable for the type (fourth) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "There are no input values suitable for the type",
        });
      }
      if (
        parseType === "fifth" &&
        (!anxiety_challenge_steps ||
          !anxiety_challenge_score ||
          anxiety_challenge_score?.length !== 5)
      ) {
        console.log(
          `There are no input values suitable for the type (fifth) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "There are no input values suitable for the type",
        });
      }

      // pUid default값 설정
      parsepUid = pUid;

      const table = Ella_Training_Table_Info["Anxiety"].table;
      // const attribute = Ella_Training_Table_Info["Mood"].attribute;

      let update_query, update_value;

      // 1. SELECT User Mood Table Data
      const select_query = `SELECT * FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      const select_data = await fetchUserData(connection_AI, select_query);

      // console.log(select_data[0]);

      // 기분 훈련 데이터가 있을 경우, mood_round_idx가 4가 아닐 경우 Not Matching 에러
      if (
        parseType === "first" &&
        select_data.length &&
        select_data[0].anxiety_round_idx !== 5
      ) {
        console.log(
          `The type value does not match the current episode (first) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode",
        });
      }

      // 기분 훈련 데이터가 있을 경우, mood_round_idx가 4가 아닐 경우 Not Matching 에러
      if (
        parseType === "second" &&
        select_data.length &&
        select_data[0].anxiety_round_idx !== 1
      ) {
        console.log(
          `The type value does not match the current episode (second) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode",
        });
      }

      // 기분 훈련 데이터가 있을 경우, mood_round_idx가 4가 아닐 경우 Not Matching 에러
      if (
        parseType === "third" &&
        select_data.length &&
        select_data[0].anxiety_round_idx !== 2
      ) {
        console.log(
          `The type value does not match the current episode (third)- pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode",
        });
      }

      // 기분 훈련 데이터가 있을 경우, mood_round_idx가 4가 아닐 경우 Not Matching 에러
      if (
        parseType === "fourth" &&
        select_data.length &&
        select_data[0].anxiety_round_idx !== 3
      ) {
        console.log(
          `The type value does not match the current episode (fourth) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode",
        });
      }

      // 기분 훈련 데이터가 있을 경우, mood_round_idx가 5가 아닐 경우 Not Matching 에러
      if (
        parseType === "fifth" &&
        select_data.length &&
        select_data[0].anxiety_round_idx !== 4
      ) {
        console.log(
          `The type value does not match the current episode (fifth) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode",
        });
      }

      // 타입별 query, value 삽입
      switch (parseType) {
        case "first":
          const insert_query = `INSERT INTO ${table} 
          (uid,
          anxiety_round_idx,
          anxiety_name,
          anxiety_situation_first,
          anxiety_physical_first,
          anxiety_thought_first,
          anxiety_worrys_first,
          anxiety_rating_first)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
          // console.log(insert_query);
          const insert_value = [
            parsepUid,
            1,
            anxiety_name,
            anxiety_situation,
            anxiety_physical,
            anxiety_thought,
            JSON.stringify(anxiety_worrys),
            anxiety_rating,
          ];
          // console.log(insert_value);

          connection_AI.query(
            insert_query,
            insert_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Anxiety First Insert Success!");
              return res
                .status(200)
                .json({ message: "Anxiety First Data Save Success!" });
            }
          );

          break;
        case "second":
          update_query = `UPDATE ${table} SET
          anxiety_round_idx = ?,
          anxiety_situation_second = ?,
          anxiety_physical_second = ?,
          anxiety_thought_second = ?,
          anxiety_worrys_second = ?,
          anxiety_rating_second = ?
          WHERE anxiety_idx = ?`;

          // console.log(update_query);
          update_value = [
            2,
            anxiety_situation,
            anxiety_physical,
            anxiety_thought,
            JSON.stringify(anxiety_worrys),
            anxiety_rating,
            select_data[0].anxiety_idx,
          ];
          // console.log(update_value);
          connection_AI.query(
            update_query,
            update_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Mood Second Update Success!");
              return res
                .status(200)
                .json({ message: "Mood Second Data Save Success!" });
            }
          );
          break;
        case "third":
          update_query = `UPDATE ${table} SET
          anxiety_round_idx = ?,
          anxiety_situation_third = ?,
          anxiety_physical_third = ?,
          anxiety_thought_third = ?,
          anxiety_worrys_third = ?,
          anxiety_rating_third = ?
          WHERE anxiety_idx = ?`;

          // console.log(update_query);
          update_value = [
            3,
            anxiety_situation,
            anxiety_physical,
            anxiety_thought,
            JSON.stringify(anxiety_worrys),
            anxiety_rating,
            select_data[0].anxiety_idx,
          ];
          // console.log(update_value);
          connection_AI.query(
            update_query,
            update_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Anxiety Third Update Success!");
              return res
                .status(200)
                .json({ message: "Anxiety Third Data Save Success!" });
            }
          );
          break;
        case "fourth":
          update_query = `UPDATE ${table} SET
          anxiety_round_idx = ?,
          anxiety_cognitive_score = ?,
          anxiety_situation_fourth = ?,
          anxiety_physical_fourth = ?,
          anxiety_thought_fourth = ?,
          anxiety_rating_fourth = ?
          WHERE anxiety_idx = ?`;
          // console.log(update_query);
          update_value = [
            4,
            anxiety_cognitive_score,
            anxiety_situation,
            anxiety_physical,
            anxiety_thought,
            anxiety_rating,
            select_data[0].anxiety_idx,
          ];
          // console.log(update_value);
          connection_AI.query(
            update_query,
            update_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Anxiety Fourth Update Success!");
              return res
                .status(200)
                .json({ message: "Anxiety Fourth Data Save Success!" });
            }
          );
          break;
        case "fifth":
          update_query = `UPDATE ${table} SET
          anxiety_round_idx = ?,
          anxiety_challenge_steps = ?,
          anxiety_challenge_score = ?,
          anxiety_situation_fifth = ?,
          anxiety_physical_fifth = ?,
          anxiety_thought_fifth = ?,
          anxiety_rating_fifth = ?
          WHERE anxiety_idx = ?`;

          // console.log(update_query);
          update_value = [
            5,
            anxiety_challenge_steps,
            anxiety_challenge_score.join("/"),
            anxiety_situation,
            anxiety_physical,
            anxiety_thought,
            anxiety_rating,
            select_data[0].anxiety_idx,
          ];
          // console.log(update_value);
          connection_AI.query(
            update_query,
            update_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Anxiety Fifth Update Success!");
              return res
                .status(200)
                .json({ message: "Anxiety Fifth Data Save Success!" });
            }
          );
          break;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // 불안훈련 시작 데이터 Load API
  postOpenAIAnxietyDataLoad: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid; // Parsing 변수

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid } = parseData;

      console.log(`불안 훈련 Start Data Load API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;

      // Table 명시
      const table = Ella_Training_Table_Info["Anxiety"].table;
      // const attribute = Ella_Training_Table_Info["Anxiety"].attribute;

      // Table User 조회
      const select_query = `SELECT * FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      const select_data = await fetchUserData(connection_AI, select_query);
      // case.1 - Row가 없거나 anxiety_round_idx값이 5일 경우
      if (!select_data[0] || select_data[0].anxiety_round_idx === 5)
        return res.json({ anxiety_round_idx: 0, anxiety_name: "" });
      // case.2 - Row가 있을 경우
      else {
        return res.status(200).json({
          anxiety_round_idx: select_data[0].anxiety_round_idx,
          anxiety_name: select_data[0].anxiety_name,
        });
      }

      // dummy data (임시)
      // return res.json({ mood_round_idx: 0, mood_name: "" });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // 불안훈련 보고서 데이터 Load API
  postOpenAIAnxietyTrainingDataLoad: async (req, res) => {
    const { data } = req.body;

    let parseData, parsepUid; // Parsing 변수
    const typeArr = [1, 2, 3, 4, 5];
    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, type } = parseData;

      console.log(`불안 훈련 보고서 Data Load API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }

      // No type => return
      if (!type) {
        console.log("No type input value - 400");
        return res.status(400).json({ message: "No type input value - 400" });
      }

      // No Matching Type Value => return
      if (!typeArr.includes(type)) {
        console.log("No matching Type value - 400");
        return res
          .status(400)
          .json({ message: "No matching Type value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;

      // Table 명시
      const table = Ella_Training_Table_Info["Anxiety"].table;

      // Table User 조회
      let select_query;
      let select_data;

      switch (type) {
        case 1:
          select_query = `SELECT 
          anxiety_name,
          anxiety_situation_first,
          anxiety_physical_first,
          anxiety_thought_first,
          anxiety_worrys_first
          FROM ${table}
          WHERE uid = '${parsepUid}'
          ORDER BY created_at DESC LIMIT 1;`;

          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.anxiety_situation_first)
            return res
              .status(200)
              .json({ message: "Non Anxiety Training First Data" });

          return res.status(200).json({
            message: "Anxiety Training First Data Load Success!",
            data: {
              anxiety_name: select_data[0]?.anxiety_name,
              anxiety_situation: select_data[0]?.anxiety_situation_first,
              anxiety_physical: select_data[0]?.anxiety_physical_first,
              anxiety_thought: select_data[0]?.anxiety_thought_first,
              anxiety_worrys: JSON.parse(select_data[0]?.anxiety_worrys_first),
            },
          });
        case 2:
          select_query = `SELECT 
          anxiety_name,
          anxiety_situation_second,
          anxiety_physical_second,
          anxiety_thought_second,
          anxiety_worrys_second
          FROM ${table}
          WHERE uid = '${parsepUid}'
          ORDER BY created_at DESC LIMIT 1;`;

          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.anxiety_situation_second)
            return res
              .status(200)
              .json({ message: "Non Anxiety Training Second Data" });

          return res.status(200).json({
            message: "Anxiety Training Second Data Load Success!",
            data: {
              anxiety_name: select_data[0]?.anxiety_name,
              anxiety_situation: select_data[0]?.anxiety_situation_second,
              anxiety_physical: select_data[0]?.anxiety_physical_second,
              anxiety_thought: select_data[0]?.anxiety_thought_second,
              anxiety_worrys: JSON.parse(select_data[0]?.anxiety_worrys_second),
            },
          });
        case 3:
          select_query = `SELECT 
          anxiety_name,
          anxiety_situation_third,
          anxiety_physical_third,
          anxiety_thought_third,
          anxiety_worrys_third
          FROM ${table}
          WHERE uid = '${parsepUid}'
          ORDER BY created_at DESC LIMIT 1;`;

          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.anxiety_situation_third)
            return res
              .status(200)
              .json({ message: "Non Anxiety Training Third Data" });

          return res.status(200).json({
            message: "Anxiety Training Third Data Load Success!",
            data: {
              anxiety_name: select_data[0]?.anxiety_name,
              anxiety_situation: select_data[0]?.anxiety_situation_third,
              anxiety_physical: select_data[0]?.anxiety_physical_third,
              anxiety_thought: select_data[0]?.anxiety_thought_third,
              anxiety_worrys: JSON.parse(select_data[0]?.anxiety_worrys_third),
            },
          });
        case 4:
          select_query = `SELECT 
          anxiety_name,
          anxiety_situation_fourth,
          anxiety_physical_fourth,
          anxiety_thought_fourth,
          anxiety_cognitive_score
          FROM ${table}
          WHERE uid = '${parsepUid}'
          ORDER BY created_at DESC LIMIT 1;`;

          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.anxiety_situation_fourth)
            return res
              .status(200)
              .json({ message: "Non Anxiety Training fourth Data" });

          return res.status(200).json({
            message: "Anxiety Training fourth Data Load Success!",
            data: {
              anxiety_name: select_data[0]?.anxiety_name,
              anxiety_situation: select_data[0]?.anxiety_situation_fourth,
              anxiety_physical: select_data[0]?.anxiety_physical_fourth,
              anxiety_thought: select_data[0]?.anxiety_thought_fourth,
              anxiety_cognitive_score: select_data[0]?.anxiety_cognitive_score,
            },
          });
        case 5:
          select_query = `SELECT 
          anxiety_name,
          anxiety_situation_fifth,
          anxiety_physical_fifth,
          anxiety_thought_fifth,
          anxiety_challenge_steps,
          anxiety_challenge_score
          FROM ${table}
          WHERE uid = '${parsepUid}'
          ORDER BY created_at DESC LIMIT 1;`;

          select_data = await fetchUserData(connection_AI, select_query);

          // 회기를 실시하지 않은 경우
          if (!select_data[0]?.anxiety_situation_fifth)
            return res
              .status(200)
              .json({ message: "Non Anxiety Training Fifth Data" });

          return res.status(200).json({
            message: "Anxiety Training Fifth Data Load Success!",
            data: {
              anxiety_name: select_data[0]?.anxiety_name,
              anxiety_situation: select_data[0]?.anxiety_situation_fifth,
              anxiety_physical: select_data[0]?.anxiety_physical_fifth,
              anxiety_thought: select_data[0]?.anxiety_thought_fifth,
              anxiety_challenge_steps: select_data[0]?.anxiety_challenge_steps,
              anxiety_challenge_score: select_data[0]?.anxiety_challenge_score
                .split("/")
                .map((el) => Number(el)),
            },
          });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
};

const NorthController = {
  // 일기친구 모델 - 북극이 Save API
  postOpenAIConsultingNorthSave: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid, parseMentalData; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array

    const tagArr = ["mood", "friend", "family", "school"];
    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { content, pUid, tag } = parseData;

      console.log(
        `북극이 일기 Save API /consulting_emotion_north Path 호출 - pUid: ${parsepUid}`
      );
      console.log(parseData);

      // No pUid => return
      if (!pUid || !content || !tag) {
        console.log("No Required input value - 400");
        return res
          .status(400)
          .json({ message: "No Required input value - 400" });
      }
      // tag 값이 지정된 값이 아닐 경우
      if (!tagArr.includes(tag)) {
        console.log("The specified tag value was not entered.- 400");
        return res
          .status(400)
          .json({ message: "The specified tag value was not entered.- 400" });
      }

      parsepUid = pUid;

      // 고정 삽입 프롬프트 - 유저 작성 일기 인지
      promptArr.push({
        role: "system",
        content: `다음에 오는 문장은 유저가 오늘 작성한 일기야.
        '''
        ${content}
        '''`,
      });

      // tag 매칭 프롬프트 삽입
      switch (tag) {
        case "mood":
          promptArr.push({
            role: "user",
            content: `일기를 분석하고 아래의 기준에 맞춰 유저의 기분에 대한 점수를 반환해줘.
            '''
            좋음: 2
            보통: 1
            나쁨: 0
            '''
            판단하기 힘들 경우 '보통'으로 판단하고 1을 반환해줘.
            반드시 정수값만 반환해야 해.`,
          });
          break;
        case "friend":
          promptArr.push({
            role: "user",
            content: `일기를 분석하고 아래의 기준에 맞춰 유저의 또래관계에 대한 점수를 반환해줘.
            '''
            좋음: 2
            보통: 1
            나쁨: 0
            '''
            판단하기 힘들 경우 '보통'으로 판단하고 1을 반환해줘.
            반드시 정수값만 반환해야 해.`,
          });
          break;
        case "family":
          promptArr.push({
            role: "user",
            content: `일기를 분석하고 아래의 기준에 맞춰 유저의 가족관계에 대한 점수를 반환해줘.
            '''
            좋음: 2
            보통: 1
            나쁨: 0
            '''
            판단하기 힘들 경우 '보통'으로 판단하고 1을 반환해줘.
            반드시 정수값만 반환해야 해.`,
          });
          break;
        case "school":
          promptArr.push({
            role: "user",
            content: `일기를 분석하고 아래의 기준에 맞춰 유저의 학교생활에 대한 점수를 반환해줘.
            '''
            좋음: 2
            보통: 1
            나쁨: 0
            '''
            판단하기 힘들 경우 '보통'으로 판단하고 1을 반환해줘.
            반드시 정수값만 반환해야 해.`,
          });
          break;
        case "study":
          promptArr.push({
            role: "user",
            content: `일기를 분석하고 아래의 기준에 맞춰 유저의 학업 성취도에 대한 점수를 반환해줘.
            '''
            좋음: 2
            보통: 1
            나쁨: 0
            '''
            판단하기 힘들 경우 '보통'으로 판단하고 1을 반환해줘.
            반드시 정수값만 반환해야 해.`,
          });
          break;
      }

      const response = await openai.chat.completions.create({
        messages: [...promptArr],
        model: "gpt-4o", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      // MentalData 정의
      parseMentalData = isNum(response.choices[0].message.content)
        ? Number(response.choices[0].message.content)
        : 1;

      // DB Insert
      const table = North_Table_Info.table;

      // 1. SELECT User Mood Table Data
      // const select_query = `SELECT * FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      // const select_data = await fetchUserData(connection_AI, select_query);

      if (true) {
        const insert_query = `INSERT INTO ${table} (uid, north_diary_content, north_diary_tag, north_mental_data) VALUES (?, ?, ?, ?);`;
        // console.log(insert_query);
        const insert_value = [parsepUid, content, tag, parseMentalData];
        // console.log(insert_value);

        connection_AI.query(
          insert_query,
          insert_value,
          (error, rows, fields) => {
            if (error) {
              console.log(error);
              return res.status(400).json({ message: error.sqlMessage });
            }
            console.log(`North Insert Success! - ${parsepUid}`);
            return res
              .status(200)
              .json({ message: "North Diary Save Success!" });
          }
        );
      }

      // return res.status(200).json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
        // emotion: 0,
      });
    }
  },
  // 일기친구 모델 - 북극이 Load API
  postOpenAIConsultingNorthLoad: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid; // Parsing 변수

    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid } = parseData;
      console.log(`북극이 일기 Load API /north_load Path 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No Required input value - 400");
        return res
          .status(400)
          .json({ message: "No Required input value - 400" });
      }

      parsepUid = pUid;

      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();

      // DB Select
      const table = North_Table_Info.table;

      // 1. SELECT User Mood Table Data
      const select_query = `SELECT
      north_id AS id,
      north_diary_content AS content,
      north_diary_tag AS tag,
      DATE_FORMAT(created_at, '%Y년 %m월 %d일') AS date
      FROM ${table}
      WHERE uid = '${parsepUid}'
      AND created_at LIKE '%${year}%'
      ORDER BY created_at ASC;`;
      const select_data = await fetchUserData(connection_AI, select_query);

      return res
        .status(200)
        .json({ message: "North Diary Load Success!", data: select_data });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
        // emotion: 0,
      });
    }
  },
  // 일기친구 모델 - 북극이 일기 Delete API
  postOpenAIConsultingNorthDelete: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid; // Parsing 변수

    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, id } = parseData;
      console.log(
        `북극이 일기 Delete API /north_delete Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }

      // No pUid => return
      if (!id) {
        console.log("No id input value - 400");
        return res.status(400).json({ message: "No id input value - 400" });
      }

      parsepUid = pUid;

      // Delete Qurty
      const table = North_Table_Info.table;
      const delete_query = `DELETE FROM ${table} WHERE north_id = ?`;

      // Delete 수행
      connection_AI.query(delete_query, [id], (err, results) => {
        if (err) {
          console.log(err);
          return res.status(400).json({ message: err.sqlMessage });
        }

        // 삭제된 행이 있는지 확인
        if (results.affectedRows > 0) {
          console.log("North Diary Delete Success!");
          return res
            .status(200)
            .json({ message: "North Diary Delete Success!" });
        } else {
          console.log("No rows deleted, possibly due to non-existing id.");
          return res
            .status(400)
            .json({ message: "No rows deleted, ID not found." });
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
};

const ubiController = {
  // 우비 명상추천 친구
  postOpenAIUbiMeditationRecomend: async (req, res) => {
    const { data } = req.body;
    let parseData; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    const typeArr = ["banner", "ubi"];
    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, type, maxArr } = parseData;

      // maxArr = [음악 최대, 그림 최대, 요가 최대]

      console.log(`우비 명상추천 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }
      // No type => return
      if (!type) {
        console.log("No code input value - 400");
        return res.status(400).json({ message: "No type input value - 400" });
      }

      // No type => return
      if (!maxArr) {
        console.log("No maxArr input value - 400");
        return res.status(400).json({ message: "No maxArr input value - 400" });
      }

      // No Matching code Value => return
      if (!typeArr.includes(type)) {
        console.log("No matching type value - 400");
        return res
          .status(400)
          .json({ message: "No matching type value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;

      // promptArr.push(persona_prompt_lala_v6); // 엘라 페르소나

      // type 매칭 프롬프트 삽입
      // switch (type) {
      //   case "banner":
      //     promptArr.push({
      //       role: "system",
      //       content: ``,
      //     });
      //     break;
      //   case "ubi":
      //     promptArr.push({
      //       role: "system",
      //       content: ``,
      //     });
      //     temperature = 0.7; // 고정된 형식 답변 유도를 위한 수치 조정
      //     break;
      // }

      // console.log(temperature);

      // const response = await openai.chat.completions.create({
      //   messages: [...promptArr],
      //   model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      //   temperature: 0.7,
      // });

      // const message = {
      //   message: response.choices[0].message.content,
      // };

      const tagObj = { draw: 1, yoga: 2 };
      // const tagObj = { music: 0, draw: 1, yoga: 2 };
      const vTagArr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

      const arrCreate = (num) => {
        const result = [];
        for (let i = 0; i < num; i++) result.push(i);
        return result;
      };

      const tag =
        Object.keys(tagObj)[
          Math.floor(Math.random() * Object.keys(tagObj).length)
        ];

      const tag2 =
        Object.keys(tagObj)[
          Math.floor(Math.random() * Object.keys(tagObj).length)
        ];

      const tag3 =
        Object.keys(tagObj)[
          Math.floor(Math.random() * Object.keys(tagObj).length)
        ];

      const message = {
        data: [
          {
            tag,
            Video_Tag:
              tag === "music"
                ? vTagArr[Math.floor(Math.random() * vTagArr.length)]
                : 0,
            index: tag === "music" ? [] : arrCreate(maxArr[tagObj[tag]]),
          },
          {
            tag: tag2,
            Video_Tag:
              tag2 === "music"
                ? vTagArr[Math.floor(Math.random() * vTagArr.length)]
                : 0,
            index: tag2 === "music" ? [] : arrCreate(maxArr[tagObj[tag2]]),
          },
          {
            tag: tag3,
            Video_Tag:
              tag3 === "music"
                ? vTagArr[Math.floor(Math.random() * vTagArr.length)]
                : 0,
            index: tag3 === "music" ? [] : arrCreate(maxArr[tagObj[tag3]]),
          },
        ],
      };

      return res.status(200).json(message);
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Server Error - 500 Bad Gateway" + err.message,
      });
    }
  },
};

const reportController = {
  postReportTest_ejs1: async (req, res) => {
    console.log("Test Report API 호출!");
    try {
      // const { scores, interpretations, recipientEmail } = req.body;

      const templatePath = path.join(__dirname, "..", "src", "reportTest2.ejs");
      const htmlContent = await ejs.renderFile(templatePath, {
        reportDate: "2024-09-06",
        name: "노지용",
        age: "51",
        gender: "남",
      });

      // const browser = await puppeteer.launch();
      const browser = await puppeteer.launch({
        headless: true, // 백그라운드 모드로 실행
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // 샌드박스 모드 비활성화
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({ format: "A4" });
      await browser.close();

      let myMailAddr = process.env.ADDR_MAIL; // 보내는 사람 메일 주소
      let myMailPwd = process.env.ADDR_PWD; // 구글 계정 2단계 인증 비밀번호

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: myMailAddr,
          pass: myMailPwd,
        },
      });

      const mailOptions = {
        from: "soyesnjy@gmail.com",
        to: "soyesnjy@gmail.com",
        subject: "Your Psychology Test Results",
        text: "Please find attached your psychology test results.",
        attachments: [
          {
            filename: "Soyes_Report_Test.pdf",
            content: pdfBuffer,
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "PDF sent successfully to " });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ message: "Failed to process the request" });
    }
  },
  postReportTest_a: async (req, res) => {
    console.log("Test Report API 호출!");
    try {
      // 데이터 설정
      const dataValue = {
        reportDate: "2024-09-06",
        name: "노지용",
        age: "51",
        gender: "남",
      };

      const dataValue2 = {
        moodData: [1, 1, 1, 1, 1],
        friendData: [2, 2, 2, 2, 2],
        familyData: [3, 3, 3, 3, 3],
        schoolData: [4, 4, 4, 4, 4],
      };

      const dataValue3 = {
        ebtTscores: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80],
        schoolAnalysis: "학교생활 분석 내용",
        friendAnalysis: "친구관계 분석 내용",
        familyAnalysis: "가족관계 분석 내용",
      };

      // HTML 파일 경로 설정
      const templatePath = path.join(
        __dirname,
        "..",
        "src",
        "report_final",
        "2.html"
      );

      // HTML 파일 읽기
      const htmlContent = await new Promise((resolve, reject) => {
        fs.readFile(templatePath, "utf8", (err, data) => {
          if (err) {
            return reject(err);
          }

          // 보고서 1페이지 데이터 처리
          // let renderedHtml = data
          //   .replace("{{reportDate}}", dataValue.reportDate)
          //   .replace("{{name}}", dataValue.name)
          //   .replace("{{age}}", dataValue.age)
          //   .replace("{{gender}}", dataValue.gender);

          // 보고서 2페이지 데이터 처리
          let renderedHtml = data
            .replace("{{moodData}}", JSON.stringify(dataValue2.moodData))
            .replace("{{friendData}}", JSON.stringify(dataValue2.friendData))
            .replace("{{familyData}}", JSON.stringify(dataValue2.familyData))
            .replace("{{schoolData}}", JSON.stringify(dataValue2.schoolData));

          // 보고서 3페이지 데이터 처리
          // let renderedHtml = data
          //   .replace(
          //     "{{ebtTscores}}",
          //     JSON.stringify(JSON.stringify(dataValue3.ebtTscores))
          //   )
          //   .replace(
          //     "{{schoolAnalysis}}",
          //     JSON.stringify(dataValue3.schoolAnalysis)
          //   )
          //   .replace(
          //     "{{friendAnalysis}}",
          //     JSON.stringify(dataValue3.friendAnalysis)
          //   )
          //   .replace(
          //     "{{familyAnalysis}}",
          //     JSON.stringify(dataValue3.familyAnalysis)
          //   );

          resolve(renderedHtml);
        });
      });

      // Puppeteer 브라우저 실행
      const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      // HTML을 페이지에 설정하고 스타일 로드 대기
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      // PDF 생성
      const pdfBuffer = await page.pdf({ format: "A4" });

      // await browser.close();

      // 이메일 전송 설정
      let myMailAddr = process.env.ADDR_MAIL; // 보내는 사람 메일 주소
      let myMailPwd = process.env.ADDR_PWD; // 구글 계정 2단계 인증 비밀번호

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: myMailAddr,
          pass: myMailPwd,
        },
      });

      const mailOptions = {
        from: "soyesnjy@gmail.com",
        to: "soyesnjy@gmail.com",
        subject: "Your Psychology Test Results",
        text: "Please find attached your psychology test results.",
        attachments: [
          {
            filename: "Soyes_Report_Test.pdf",
            content: pdfBuffer,
          },
        ],
      };

      // await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "PDF sent successfully" });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ message: "Failed to process the request" });
    }
  },
  postReportTest_b: async (req, res) => {
    try {
      // 데이터 설정
      const dataValue = {
        reportDate: "2024-09-06",
        name: "노지용",
        age: "51",
        gender: "남",
        moodData: [1, 2, 3, 4, 5],
        friendData: [1, 2, 3, 4, 5],
        familyData: [1, 2, 3, 4, 5],
        schoolData: [1, 2, 3, 4, 5],
      };

      // HTML 파일 경로 설정
      const templateFileName = "2.html";
      const templateUrl = `http://localhost:${PORT}/${templateFileName}`;

      // Puppeteer 브라우저 실행
      const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      // 3. HTML 파일을 URL로 로드하여 렌더링
      await page.goto(templateUrl, { waitUntil: "networkidle0" });

      // 4. 데이터 삽입을 위한 JavaScript 코드 실행
      await page.evaluate((dataValue) => {
        // document.body.innerHTML = document.body.innerHTML;
        // .replace("{{reportDate}}", dataValue.reportDate)
        // .replace("{{name}}", dataValue.name)
        // .replace("{{age}}", dataValue.age)
        // .replace("{{gender}}", dataValue.gender)

        initializeMoodChart(dataValue.moodData);
        initializeFriendChart(dataValue.friendData);
        initializeFamilyChart(dataValue.familyData);
        initializeSchoolChart(dataValue.schoolData);
      }, dataValue);

      // 5. PDF 생성
      const pdfBuffer = await page.pdf({ format: "A4" });

      // await browser.close();

      // 이메일 전송 설정
      let myMailAddr = process.env.ADDR_MAIL; // 보내는 사람 메일 주소
      let myMailPwd = process.env.ADDR_PWD; // 구글 계정 2단계 인증 비밀번호

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: myMailAddr,
          pass: myMailPwd,
        },
      });

      const mailOptions = {
        from: "soyesnjy@gmail.com",
        to: "soyesnjy@gmail.com",
        subject: "Your Psychology Test Results",
        text: "Please find attached your psychology test results.",
        attachments: [
          {
            filename: "Soyes_Report_Test.pdf",
            content: pdfBuffer,
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      return res.status(200).json({ message: "PDF sent successfully" });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ message: "Failed to process the request" });
    }
  },
  postReportTest_c: async (req, res) => {
    console.log("Test Report API 호출!");
    const { data } = req.body;
    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, email } = parseData;
      console.log(`결과보고서 발송 API /report Path 호출 - pUid: ${pUid}`);
      console.log(parseData);

      //

      const templatePath = path.join(
        __dirname,
        "..",
        "src",
        "report_final",
        "2.ejs"
      );

      const htmlContent = await ejs.renderFile(templatePath, {
        reportDate: "2024-09-06",
        name: "노지용",
        age: "51",
        gender: "남",
        moodData: JSON.stringify([1, 2, 3, 4, 5]),
        friendData: JSON.stringify([1, 2, 3, 4, 5]),
        familyData: JSON.stringify([1, 2, 3, 4, 5]),
        schoolData: JSON.stringify([1, 2, 3, 4, 5]),
      });

      const browser = await puppeteer.launch({
        headless: false, // 백그라운드 모드로 실행
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // 샌드박스 모드 비활성화
      });

      const page = await browser.newPage();

      // await page.emulateMediaType("screen");

      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      // 차트나 동적 콘텐츠가 완전히 렌더링될 시간을 확보
      // await new Promise((resolve) => setTimeout(resolve, 1000));

      const pdfBuffer = await page.pdf({ format: "A4" });
      // await browser.close();

      let myMailAddr = process.env.ADDR_MAIL; // 보내는 사람 메일 주소
      let myMailPwd = process.env.ADDR_PWD; // 구글 계정 2단계 인증 비밀번호

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: myMailAddr,
          pass: myMailPwd,
        },
      });

      const mailOptions = {
        from: "soyesnjy@gmail.com",
        to: "soyesnjy@gmail.com",
        subject: "Your Psychology Test Results",
        text: "Please find attached your psychology test results.",
        attachments: [
          {
            filename: "Soyes_Report_Test.pdf",
            content: pdfBuffer,
          },
        ],
      };

      // await transporter.sendMail(mailOptions);

      return res.status(200).json({ message: "PDF sent successfully to " });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ message: "Failed to process the request" });
    }
  },
  postReportTest: async (req, res) => {
    const { data } = req.body;
    const pdfBuffers = []; // 각 PDF의 버퍼를 저장할 배열
    let parsepUid, parseName, parseEmail, parseAge, parseGender;
    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, name, email, age, gender } = parseData;
      console.log(`결과보고서 발송 API /report Path 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid || !name || !email || !age || !gender) {
        console.log("No Required input value - 400");
        return res
          .status(400)
          .json({ message: "No Required input value - 400" });
      }

      parsepUid = pUid;
      parseName = name;
      parseEmail = email;
      parseAge = age;
      parseGender = gender;

      const ebtResultMap = {
        양호: "img_result_1.png",
        주의: "img_result_2.png",
        경고: "img_result_3.png",
        default: "img_result_2.png",
      };
      const ptResultMap = {
        E: "아동은 이성형보다는 감정형에 가깝습니다. 감정형은 감수성이 풍부하고 감정이 드러나기 쉬운 특질을 말합니다. 감정형은 뜨거움과 열정을 상징하는 불에 비유할 수 있습니다.",
        R: "아동은 감정형보다 이성형에 가깝습니다. 이성형은 감정보다는 이성적 판단이 앞서고 침착한 특질을 말합니다. 이성형은 차가움과 침착함을 상징하는 물에 비유할 수 있습니다.",
        C: "아동은 신중형보다는 용기형에 가깝습니다. 용기형은 위험이나 처벌이 예상되는 상황에서도 낙천적으로 생각하고 위축되지 않는 용기를 보이는 특질을 말합니다. 용기형은 과감한 용기를 상징하는 칼에 비유할 수 있습니다.",
        P: "아동은 용기형보다 신중형에 가깝습니다. 신중형은 위험과 실패를 대비하여 행동을 미리 조심할 줄 아는 신중한 특질을 말합니다. 신중형은 자기보호와 신중성을 상징하는 방패에 비유할 수 있습니다.",
        F: "아동은 개방형보다 안정형에 가깝습니다. 안정형은 익숙하고 예측이 되는 대상이나 환경을 선호하고 안정을 추구하는 특질을 말합니다. 안정형은 익숙하고 편안한 집에 비유할 수 있습니다.",
        O: "아동은 안정형보다는 개방형에 가깝습니다. 개방형은 새로운 자극에 마음이 열려 있고 모험을 즐기는 특질을 말합니다. 개방형은 새로운 자극이 많아 모험을 펼칠 수 있는 들판에 비유할 수 있습니다.",
        I: "아동은 관계형보다 독립형에 가깝습니다. 독립형은 독립적으로 활동하는 것을 선호하는 특질을 말합니다. 독립형은 독립적인 생활을 추구하는 고양이에 비유할 수 있습니다.",
        S: "아동은 독립형보다는 관계형에 가깝습니다. 관계형은 다른 사람들과 어울리며 관계 맺는 것을 좋아하는 특질을 말합니다. 관계형은 사람을 좋아하는 강아지에 비유할 수 있습니다.",
        default: "성격 검사 미실시",
      };
      const friendMap = {
        FTH: {
          category: "좋은 친구형",
          ment: "배려심 있고 협동을 잘 하며 사람들과 어울리기 좋아하는 유형이에요. 친구 이야기를 잘 들어주고, 기쁘거나 슬픈 일에 공감을 잘 해요. 내 의견을 고집하기보다 어디에나 잘 어울리고, 대부분의 아이들과 잘 지낼 수 있어요. 다른 아이들에게 편안하고 좋은 친구가 되어줄 수 있어요.",
        },
        FSH: {
          category: "은근한 개인주의자형",
          ment: "혼자 있을 때 편하지만 드러내지 않고 남들에게 잘 맞춰주는 유형이에요. 친구들의 제안을 잘 따르고 큰 불만 없이 아이들과 무리를 지어 잘 지낼 수 있어요. 하지만 다른 사람의 감정에 둔하고, 다정하기보다는 무뚝뚝한 편이고, 혼자 있어도 불편하지 않아요.",
        },
        LTH: {
          category: "인싸 리더형",
          ment: "리더십있고 친구들에게 인기 있는 유형이에요. 내가 좋아하는 놀이를 하고, 내가 원하는 방식으로 상황을 이끌어가는 것을 좋아해요. 동시에 친구들의 감정도 잘 알아차리고 함께 어울리는 것을 좋아해서, 친구들의 관심을 끌고 동의를 잘 얻어내는 편이에요.",
        },
        LSH: {
          category: "단호한 개인주의자형",
          ment: "독립적이고 자기 주장이 분명하며 필요할 때는 소통 능력을 발휘하는 유형이에요. 나에게 좋고 싫은 것, 옳고 그르다고 생각하는 것이 분명해요. 하지만 다른 사람의 기분을 상하게 하거나, 친구와 다투지 않고 내 의견을 전달할 줄 알아요. 다정다감하기보다는 단호한 면이 있어요.",
        },
        FTL: {
          category: "좋은데 힘들어형",
          ment: "친구를 좋아하고 잘 맞춰주지만 속으로 힘들어하는 유형이에요. 내 의견을 주장하기보다 친구들의 의견을 따르는 편이에요. 친구 마음을 배려하고 다른 사람과 함께 있는 걸 좋아해요. 하지만 갈등이 생겼을 때 어떻게 해결해야하는지, 내 마음을 어떻게 표현해야하는지 잘 몰라 힘들어할 수 있어요.",
        },
        FSL: {
          category: "조용한 친구형",
          ment: "조용히 혼자 있는 것이 편하고  관계에 어려움을 느끼는 유형이에요. 갈등을 만들기보다는 상황에 따르며 원만히 지내고 싶어해요. 하지만 친구들의 마음을 이해하거나, 지금 어떤 상황이 벌어지고 있는지 빨리 알아차리지 못할 수 있어요. 큰 다툼은 없지만 속으로 친구관계를 힘들어할 수 있어요.",
        },
        LTL: {
          category: "좌충우돌형",
          ment: "친구를 좋아하고 이끌고 싶어하지만 소통 능력이 부족해 어려움을 느끼는 유형이에요. 내 의견을 잘 말하고, 아니라고 생각될 때는 참지 않는 편이에요. 친구들과 어울리는 걸 좋아하고, 다양하게 내 감정을 표현하기도 해요. 하지만 친구들이 내 의견을 잘 따르지 않거나, 종종 갈등이 생겨 힘들어할 수 있어요.",
        },
        LSL: {
          category: "마이웨이형",
          ment: "자기주장이 분명하고 내 영역을 지키고 싶으나 소통이 어려운 유형이에요. 내 생각이 분명하고 그걸 남들에게 잘 표현해요. 하지만 다른 사람의 감정을 이해하는데 서투르고 친구들과 같은 관심사를 공유하기보다 나만의 남다른 취향이 있어요. 갈등이 생겼을 때 어떻게 해결해야하는지 모르고 서로 오해가 깊어질 수 있어요.",
        },
        default: {
          category: "유형검사",
          ment: "미실시",
        },
      };

      // PDF 결합 함수
      async function mergePDFs(pdfBuffers) {
        const mergedPdf = await PDFDocument.create();

        for (const buffer of pdfBuffers) {
          const pdf = await PDFDocument.load(buffer);

          // 페이지를 복사하고 병합
          const copiedPages = await mergedPdf.copyPages(
            pdf,
            pdf.getPageIndices()
          );
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();
        return mergedPdfBytes;
      }

      // DB Data Select
      let selectData = {
        report_url: process.env.REPORT_URL,
      };

      // Page 1 Data
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      // Page 2 Data
      const north_table = North_Table_Info.table;
      const select_north_join_query = `SELECT JSON_OBJECT(
  'mood_data', IFNULL((SELECT JSON_ARRAYAGG(north_mental_data)
                FROM (SELECT north_mental_data
                      FROM ${north_table}
                      WHERE uid = '${parsepUid}' AND north_diary_tag = 'mood'
                      ORDER BY created_at DESC
                      LIMIT 5) AS mood), JSON_ARRAY()),
  'friend_data', IFNULL((SELECT JSON_ARRAYAGG(north_mental_data)
                  FROM (SELECT north_mental_data
                        FROM ${north_table}
                        WHERE uid = '${parsepUid}' AND north_diary_tag = 'friend'
                        ORDER BY created_at DESC
                        LIMIT 5) AS friend), JSON_ARRAY()),
  'family_data', IFNULL((SELECT JSON_ARRAYAGG(north_mental_data)
                  FROM (SELECT north_mental_data
                        FROM ${north_table}
                        WHERE uid = '${parsepUid}' AND north_diary_tag = 'family'
                        ORDER BY created_at DESC
                        LIMIT 5) AS family), JSON_ARRAY()),
  'school_data', IFNULL((SELECT JSON_ARRAYAGG(north_mental_data)
                  FROM (SELECT north_mental_data
                        FROM ${north_table}
                        WHERE uid = '${parsepUid}' AND north_diary_tag = 'school'
                        ORDER BY created_at DESC
                        LIMIT 5) AS school), JSON_ARRAY())
) AS result;
`;
      const north_join_data = await fetchUserData(
        connection_AI,
        select_north_join_query
      );
      const page2_data = JSON.parse(north_join_data[0].result);

      // Page 3,4 Data
      const page3_data = await select_soyesAI_EbtResult_v2("", true, parsepUid);
      // console.log(page3_data);

      // Page 5,6 Data
      const pt_log_table = PT_Table_Info["Log"].table;
      const select_pt_query = `SELECT 
      persanl_result FROM ${pt_log_table} 
      WHERE uid = '${parsepUid}' 
      ORDER BY created_at DESC LIMIT 1;`;

      const pt_data = await fetchUserData(connection_AI, select_pt_query);
      const page5_data = pt_data[0];

      // Page 7 Data
      const mood_table = Ella_Training_Table_Info["Mood"].table;
      const anxiety_table = Ella_Training_Table_Info["Anxiety"].table;

      const mood_select_query = `SELECT 
      mood_rating_first,
      mood_rating_second,
      mood_rating_third,
      mood_rating_fourth
      FROM ${mood_table} WHERE uid = '${parsepUid}' 
      ORDER BY created_at DESC LIMIT 1;`;

      const mood_select_data = await fetchUserData(
        connection_AI,
        mood_select_query
      );
      const page7_mood_data = mood_select_data[0]
        ? Object.values(mood_select_data[0]).filter((el) => el)
        : [];

      const anxiety_select_query = `SELECT 
      anxiety_rating_first,
      anxiety_rating_second,
      anxiety_rating_third,
      anxiety_rating_fourth,
      anxiety_rating_fifth
      FROM ${anxiety_table} WHERE uid = '${parsepUid}' 
      ORDER BY created_at DESC LIMIT 1;`;

      const anxiety_select_data = await fetchUserData(
        connection_AI,
        anxiety_select_query
      );
      const page7_anxiety_data = anxiety_select_data[0]
        ? Object.values(anxiety_select_data[0]).filter((el) => el)
        : [];

      // Page 8 Data
      const friend_table = Ella_Training_Table_Info["Friend"].table;
      const friend_select_query = `SELECT 
      friend_result 
      FROM ${friend_table} 
      WHERE uid = '${parsepUid}' AND friend_type = 'friend_test' 
      ORDER BY created_at DESC LIMIT 1;`;

      const friend_select_data = await fetchUserData(
        connection_AI,
        friend_select_query
      );
      const page8_friend_data = friend_select_data[0]?.friend_result;

      // Page 9 Data
      const pupu_table = Consult_Table_Info["Log"].table;
      const pupu_select_query = `SELECT consult_log FROM ${pupu_table} WHERE uid ='${parsepUid}' ORDER BY created_at DESC LIMIT 3`; // 가장 최근 검사 결과를 조회하는 경우

      const pupu_select_data = await fetchUserData(
        connection_AI,
        pupu_select_query
      );

      const page9_pupu_data = pupu_select_data
        .map((el) => JSON.parse(el.consult_log))
        .map((el) => (el.length > 0 ? el[el.length - 1].content : ""));

      // Select Data 갱신
      selectData = {
        ...selectData,
        // page 1
        reportDate: date,
        name: parseName,
        age: parseAge,
        gender: parseGender,
        // page 2
        moodData: JSON.stringify(page2_data.mood_data.map((el) => el + 1)),
        friendData: JSON.stringify(page2_data.friend_data.map((el) => el + 1)),
        familyData: JSON.stringify(page2_data.family_data.map((el) => el + 1)),
        schoolData: JSON.stringify(page2_data.school_data.map((el) => el + 1)),
        // page 3
        ebt_school: page3_data[0]?.content?.slice(0, 135),
        ebt_school_result: ebtResultMap[page3_data[0]?.result || "default"],
        ebt_friend: page3_data[1]?.content?.slice(0, 135),
        ebt_friend_result: ebtResultMap[page3_data[1]?.result || "default"],
        ebt_family: page3_data[2]?.content?.slice(0, 135),
        ebt_family_result: ebtResultMap[page3_data[2]?.result || "default"],
        ebt_tScores: JSON.stringify(
          page3_data.length > 0
            ? page3_data.map((el) => el.tScore || 50)
            : [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
        ),
        // page 4
        ebt_self: page3_data[3]?.content?.slice(0, 127),
        ebt_self_result: ebtResultMap[page3_data[3]?.result || "default"],
        ebt_unrest: page3_data[4]?.content?.slice(0, 127),
        ebt_unrest_result: ebtResultMap[page3_data[4]?.result || "default"],
        ebt_sad: page3_data[5]?.content?.slice(0, 127),
        ebt_sad_result: ebtResultMap[page3_data[5]?.result || "default"],
        ebt_health: page3_data[6]?.content?.slice(0, 127),
        ebt_health_result: ebtResultMap[page3_data[6]?.result || "default"],
        ebt_attention: page3_data[7]?.content?.slice(0, 127),
        ebt_attention_result: ebtResultMap[page3_data[7]?.result || "default"],
        ebt_movement: page3_data[8]?.content?.slice(0, 127),
        ebt_movement_result: ebtResultMap[page3_data[8]?.result || "default"],
        ebt_mood: page3_data[9]?.content?.slice(0, 127),
        ebt_mood_result: ebtResultMap[page3_data[9]?.result || "default"],
        ebt_angry: page3_data[10]?.content?.slice(0, 127),
        ebt_angry_result: ebtResultMap[page3_data[10]?.result || "default"],
        // page 5
        persnalResult: page5_data?.persanl_result || "pt_default",
        result_first: page5_data?.persanl_result[0] || "pt_detail_default",
        result_second: page5_data?.persanl_result[1] || "pt_detail_default",
        result_third: page5_data?.persanl_result[2] || "pt_detail_default",
        result_fourth: page5_data?.persanl_result[3] || "pt_detail_default",
        // page 6
        result_first_ment:
          ptResultMap[page5_data?.persanl_result[0] || "default"],
        result_second_ment:
          ptResultMap[page5_data?.persanl_result[1] || "default"],
        result_third_ment:
          ptResultMap[page5_data?.persanl_result[2] || "default"],
        result_fourth_ment:
          ptResultMap[page5_data?.persanl_result[3] || "default"],
        // page 7
        mood_scores: JSON.stringify(page7_mood_data),
        anxiety_scores: JSON.stringify(page7_anxiety_data),
        // page 8
        friend_result: friendMap[page8_friend_data || "default"]?.category,
        friend_result_img: page8_friend_data || "default",
        friend_result_ment: friendMap[page8_friend_data || "default"]?.ment,
        // page 9
        pupu_analysis_1: page9_pupu_data[0]?.slice(0, 170),
        pupu_analysis_2: page9_pupu_data[1]?.slice(0, 170),
        pupu_analysis_3: page9_pupu_data[2]?.slice(0, 170),
      };

      // 변환할 EJS 파일들의 경로를 배열로 설정
      const ejsFiles = [
        "1.ejs",
        "2.ejs",
        "3.ejs",
        "4.ejs",
        "5.ejs",
        "6.ejs",
        "7.ejs",
        "8.ejs",
        "9.ejs",
      ];

      // Puppeteer 브라우저 실행
      const browser = await puppeteer.launch({
        headless: true, // 백그라운드 모드로 실행
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--fontconfig"], // 샌드박스 모드 비활성화
      });

      for (const file of ejsFiles) {
        const templatePath = path.join(
          __dirname,
          "..",
          "src",
          "report_final",
          file
        );
        const htmlContent = await ejs.renderFile(templatePath, selectData);

        const page = await browser.newPage();

        await page.emulateMediaType("screen"); // 화면 스타일 적용

        // 원하는 뷰포트 크기 설정
        // await page.setViewport({
        //   width: 909, // 너비 909px
        //   height: 1286, // 높이 1286px
        // });

        await page.setContent(htmlContent, { waitUntil: "networkidle0" });

        // 개별 PDF 생성
        const pdfBuffer = await page.pdf({
          width: "909px",
          height: "1286px",
          printBackground: true,
        });

        pdfBuffers.push(pdfBuffer);
      }

      const mergedPdfBuffer = await mergePDFs(pdfBuffers);

      await browser.close();

      // 이메일 전송 설정
      let myMailAddr = process.env.ADDR_MAIL; // 보내는 사람 메일 주소
      let myMailPwd = process.env.ADDR_PWD; // 구글 계정 2단계 인증 비밀번호

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: myMailAddr,
          pass: myMailPwd,
        },
      });

      const mailOptions = {
        from: "soyesnjy@gmail.com",
        to: parseEmail,
        subject: "SoyeAI 결과보고서",
        text: "SoyeAI 결과보고서 입니다.",
        attachments: [
          {
            filename: "Soyes_Report_Test.pdf",
            content: mergedPdfBuffer,
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      return res.status(200).json({ message: "PDF sent successfully" });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ message: `Error processing request: ${error}` });
    }
  },
};

// console.log("jenkins 테스트용 주석22");

module.exports = {
  openAIController,
  ellaMoodController,
  ellaFriendController,
  ellaAnxietyController,
  NorthController,
  ubiController,
  reportController,
};
