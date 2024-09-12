// stream 데이터 처리
const stream = require("stream");
// MySQL 접근
const mysql = require("mysql");
const { dbconfig_ai } = require("../DB/database");

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

// User 정서행동 2점문항 반환 (String)
// const select_soyes_AI_Ebt_Table = async (
//   user_table,
//   user_attr,
//   ebt_Question,
//   parsepUid
// ) => {
//   try {
//     // console.log(user_table);
//     const select_query = `SELECT * FROM ${user_table} WHERE ${user_attr.pKey}='${parsepUid}'`; // Select Query
//     const ebt_school_data = await fetchUserData(connection_AI, select_query);
//     // console.log(ebt_school_data[0]);
//     // ebt_school_data[0]
//     //   ? console.log(`${parsepUid} 계정은 존재합니다`)
//     //   : console.log(`${parsepUid} 계정은 없습니다`);
//     // delete ebt_school_data[0].uid; // uid 속성 삭제
//     // Attribute의 값이 2인 요소의 배열 필터링. select 값이 없으면

//     const problem_attr_arr = ebt_school_data[0]
//       ? Object.keys(ebt_school_data[0])
//       : [];

//     const problem_attr_nameArr = problem_attr_arr.filter(
//       // 속성명이 question을 가지고있고, 해당 속성의 값이 2인 경우 filtering
//       (el) => el.includes("question") && ebt_school_data[0][el] === 2
//     );
//     // console.log(problem_attr_nameArr);

//     // 문답 개수에 따른 시나리오 문답 투척
//     // Attribute의 값이 2인 요소가 없는 경우
//     return problem_attr_nameArr.length === 0
//       ? { testResult: "", ebt_school_data }
//       : {
//           testResult: problem_attr_nameArr
//             .map((el) => ebt_Question[el])
//             .join("\n"),
//           ebt_school_data,
//         };
//   } catch (err) {
//     console.log(err);
//     return { testResult: "", ebt_school_data: {} };
//   }
// };

// User 정서행동 결과 반환 - ("NonTesting" / "danger" / "etc" / "Error")
// const select_soyes_AI_Ebt_Result = async (inputTable, parsepUid) => {
//   // 동기식 DB 접근 함수 1. Promise 생성 함수
//   try {
//     const {
//       table, // 조회할 EBT table (11개 Class)
//       attribute, // table Attribute
//       danger_score, // 위험 판단 점수
//       caution_score,
//       average,
//       standard,
//     } = inputTable;

//     const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${parsepUid}'`; // Select Query
//     const ebt_data = await fetchUserData(connection_AI, select_query);
//     // console.log(ebt_data[0]);

//     // 검사를 진행하지 않은 경우
//     if (!ebt_data[0])
//       return {
//         testStatus: false,
//         scoreSum: 99,
//         tScore: 999.99,
//         result: "NonTesting",
//         content: "검사를 진행하지 않았구나!",
//       };

//     // 검사 스코어 합 + T점수 계산
//     const scoreSum = Object.values(ebt_data[0])
//       .filter((el) => typeof el === "number")
//       .reduce((acc, cur) => acc + cur);
//     const tScore = (((scoreSum - average) / standard) * 10 + 50).toFixed(2);
//     // 검사 결과
//     const result =
//       danger_score <= scoreSum
//         ? "경고"
//         : caution_score <= scoreSum
//         ? "주의"
//         : "양호";
//     // danger_score 보다 높으면 "위험", 아니면 "그외" 반환
//     return {
//       testStatus: true,
//       scoreSum,
//       tScore: Number(tScore),
//       result,
//       content: JSON.parse(ebt_data[0].chat).text,
//     };
//   } catch (err) {
//     console.log(err);
//     return "Error";
//   }
// };

// User 정서행동 결과 분석 반환
// const select_soyes_AI_Ebt_Analyis = async (inputTable, parsepUid) => {
//   // 동기식 DB 접근 함수 1. Promise 생성 함수
//   try {
//     const {
//       ebtClass,
//       table, // 조회할 EBT table
//       attribute, // table Attribute
//     } = inputTable;

//     const select_query = `SELECT * FROM ${table} WHERE ${attribute.pKey}='${parsepUid}'`; // Select Query
//     const ebt_data = await fetchUserData(connection_AI, select_query);
//     // console.log(ebt_data[0]);

//     // 검사를 진행하지 않은 경우
//     if (!ebt_data[0])
//       return {
//         ebtClass: "NonTesting",
//         analyisResult: "NonTesting",
//       };
//     const analyisResult = JSON.parse(ebt_data[0].chat).text;
//     // console.log("chat: " + chat);

//     return {
//       ebtClass,
//       analyisResult,
//     };
//   } catch (err) {
//     console.log(err);
//     return {
//       analyisResult: "select_soyes_AI_Ebt_Analyis Error",
//     };
//   }
// };

// User 성격 검사 유형 반환 (String)
// const select_soyes_AI_Pt_Table = async (user_table, user_attr, parsepUid) => {
//   try {
//     // console.log(user_table);
//     const select_query = `SELECT * FROM ${user_table} WHERE ${user_attr.pKey}='${parsepUid}'`; // Select Query
//     const ebt_school_data = await fetchUserData(connection_AI, select_query);
//     // console.log(ebt_school_data[0]);

//     return ebt_school_data[0] ? ebt_school_data[0].persanl_result : "default";
//   } catch (err) {
//     console.log(err);
//     return "default";
//   }
// };

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

    // tScore 계산 + 검사 결과 +
    const resultArr = EBT_classArr.map((type) => {
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

const select_soyesAI_Consult_Log = async (keyValue, parsepUid) => {
  try {
    // New EBT Table
    const table = Consult_Table_Info["Log"].table;
    const { pKey, cKey, created_at } = Consult_Table_Info["Log"].attribute;

    // 조건부 Select Query
    const select_query = keyValue
      ? `SELECT * FROM ${table} WHERE (${pKey} ='${keyValue}')` // keyValue 값으로 조회하는 경우
      : `SELECT * FROM ${table} WHERE (${cKey} ='${parsepUid}') ORDER BY ${created_at} DESC LIMIT 1`; // 가장 최근 검사 결과를 조회하는 경우

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

      // 정서행동 검사 분석가 페르소나 v8 - 0819
      analysisPrompt.push(ebt_analysis_prompt_v8);
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
      promptArr.push(persona_prompt_pupu_v5); // 2024.08.21~
      promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

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
      promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

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
      promptArr.push(persona_prompt_ubi); // 페르소나 프롬프트 삽입
      promptArr.push(info_prompt); // 유저 정보 프롬프트 삽입

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
게임이 종료되면 assistant가 밸런스 게임에서 선택한 단어 10개를 보여주고 user와의 매칭률을 계산해서 %로 알려준다.`,
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
            content: `아래 문장에 기초해서 다른 관점을 생각해보도록 한다.
            '''
            ${mood_thought}
            '''
            예시: '그건 정말 그래. 그런데 다르게도 생각해볼 수 있을까?'`,
          });
          parseMessageArr = [...messageArr];
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
      const attribute = Ella_Training_Table_Info["Mood"].attribute;

      let update_query, update_value;

      // 1. SELECT User Mood Table Data
      const select_query = `SELECT * FROM ${table} WHERE ${attribute.fKey} = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
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
          const insert_query = `INSERT INTO ${table} (uid, mood_round_idx, mood_name, mood_score, mood_avartar, mood_situation_first, mood_thought_first, mood_solution_first, mood_different_thought_first, mood_rating_first) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
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
          update_query = `UPDATE ${table} SET ${attribute.attr1} = ?, ${attribute.attr4} = ?, mood_situation_second = ?, mood_thought_second = ?, mood_solution_second = ?, mood_different_thought_second = ?, mood_rating_second = ? WHERE ${attribute.pKey} = ?`;
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
          update_query = `UPDATE ${table} SET ${attribute.attr1} = ?, ${attribute.attr5} = ?, mood_situation_third = ?, mood_thought_third = ?, mood_solution_third = ?, mood_different_thought_third = ?, mood_rating_third = ? WHERE ${attribute.pKey} = ?`;
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
          update_query = `UPDATE ${table} SET ${attribute.attr1} = ?, ${attribute.attr6} = ?, mood_situation_fourth = ?, mood_thought_fourth = ?, mood_solution_fourth = ?, mood_different_thought_fourth = ?, mood_rating_fourth = ? WHERE ${attribute.pKey} = ?`;
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
            content: `대화 3번까지: user가 자신을 소개하지 않으면 먼저 자기 이름을 말하고 user 이름을 묻는다. 이름을 묻고 난 뒤에는 user에게 관심을 보이며 질문을 하나 한다.
4번째 대화부터: user의 말에 단답형으로 말하고 질문하지 않는다. user가 자신과 공통 관심사가 있는 경우에는 자기개방을 하며 관심을 표현한다. 관심을 보일 때는 ‘대단하다’, ‘나도 하고 싶어’, ‘그거 뭐야’, ‘정말?’ 같은 말을 종종 사용한다. user가 자신을 칭찬하면 user에 대해서도 질문한다. user가 엘라가 좋아하는 것을 비난하거나, 욕을 하거나, 단답형으로 말하면 '아, 그래', '알겠어', '그렇게 말하면 불편해' 등으로 짧게 말한다. 반대로 엘라의 말에 user가 불편해하거나 어색해하면 사과하고 분위기를 돌린다.`,
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
아이들이 몇 명씩 모여 놀이터에서 놀고 있다. user는 자신이 이때 어떻게 할지 얘기할 것이다. user 가 반응하면 아이들 사이에 잘 섞일 수 있게 다가가는지 평가하라.`,
          });
          break;
        case "friend_group_analysis_second":
          promptArr.push({
            role: "system",
            content: `assistant는 반말과 초등학교 6학년 수준에 맞는 어휘를 사용한다. assistant는 user의 반응을 분석하고 대안을 제시하는 역할을 한다.
아이들이 쉬는 시간에 3-4명씩 모여 떠들거나 놀고 있다. user는 자신이 이때 어떻게 할지 얘기할 것이다. user 가 반응하면 아이들의 이목을 집중시키지 않고 자연스럽게 대화에 참여할 수 있는 반응을 하는지 평가하라. 직접적으로 같이 얘기해도 되는지 물어보는 경우, 괜찮은 반응이지만 친구들의 이야기 흐름을 끊을 수도 있음을 알려준다. 어떤 이야기를 하고 있는지 관찰한 뒤 재미있는 부분에서 같이 웃으며 살며시 끼어들거나, 다른 아이 말에 비슷한 경험이 있다고 말하며 공감을 표현하거나, 다른 아이 말에 질문을 하며 관심을 표현하는 등, 다른 반응 예시를 하나 들어준다.`,
          });
          break;
        case "friend_group_analysis_third":
          promptArr.push({
            role: "system",
            content: `assistant는 반말과 초등학교 6학년 수준에 맞는 어휘를 사용한다. assistant는 user의 반응을 분석하고 대안을 제시하는 역할을 한다.
아이들이 모여 보드게임을 하고 있다. user는 자신이 이때 어떻게 할지 얘기할 것이다. user 가 반응하면 아이들의 게임을 방해하지 않으면서 자연스럽게 참여할 수 있을지를 평가한다. 아이들이 게임을 하고 있는 중에 하고 싶다고 말하기보다 끝나기를 기다렸다가 다음 순서에 ‘재밌겠다. 나랑 한 번 해볼래?’라고 하거나, 협동이 필요한 게임에서 도움이 될 만한 행동을 하거나, 친구들의 게임을 즐겁게 지켜보는 것이 좋은 반응이다. 하지만 귓속말로 특정한 사람에게만 힌트를 주는 것과 같은 행동은 갈등을 일으킬 수 있다. 이를 참고하여 유저의 반응과 다른 예시를 하나 들어준다.`,
          });
          break;
        case "friend_conflict_consult":
          promptArr.push({
            role: "system",
            content: `user의 응답 내용을 기초로 대화 상대방 역할을 맡아 대화를 시작한다. User가 대화 종료를 누르기 전까지 대화를 지속한다.`,
          });
          break;
        case "friend_conflict_analysis":
          promptArr.push({
            role: "system",
            content: `user의 반응 중 한 문장을 보다 나은 반응으로 수정하고 근거를 설명한다.`,
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
      console.log(
        `북극이 일기 Load API /north_load Path 호출 - pUid: ${parsepUid}`
      );
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No Required input value - 400");
        return res
          .status(400)
          .json({ message: "No Required input value - 400" });
      }

      parsepUid = pUid;

      // DB Select
      const table = North_Table_Info.table;

      // 1. SELECT User Mood Table Data
      const select_query = `SELECT
      north_diary_content AS content,
      north_diary_tag AS tag,
      DATE_FORMAT(created_at, '%Y년 %m월 %d일') AS date
      FROM ${table}
      WHERE uid = '${parsepUid}'
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
};

// console.log("jenkins 테스트용 주석22");

const openAIController_Regercy = {
  // (Legacy) 자율 상담 AI
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
  // (Legacy) 테스트 결과 기반 상담 AI. 성격 검사
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
  // (Legacy) 테스트 결과 기반 상담 AI. 정서행동 검사 - 학교생활 V1
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
  // (Legacy) 테스트 결과 기반 상담 AI. 정서행동 검사 - 학교생활 V2
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
  // (Legacy) 테스트 결과 기반 상담 AI. 정서행동, 성격검사, 진로검사 - V1 (박사님 프롬프트)
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
  // (Legacy) 정서멘토 모델 - 엘라
  postOpenAIConsultingLala: async (req, res) => {
    const { EBTData } = req.body;
    // console.log(EBTData);
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    let testClass = "",
      testClass_cb = "";
    // let prevChat_flag = true; // 이전 대화 내역 유무

    // 응답에 헤더를 추가하는 메서드
    // res.header("Test_Header", "Success Header");
    // console.log(req.session.accessToken);

    try {
      if (typeof EBTData === "string") {
        parseEBTdata = JSON.parse(EBTData);
      } else parseEBTdata = EBTData;

      const { messageArr, pUid } = parseEBTdata;
      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.json({ message: "No pUid input value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;
      console.log(
        `엘라 상담 API /consulting_emotion_lala Path 호출 - pUid: ${parsepUid}`
      );

      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_lala_v4); // 엘라 페르소나
      promptArr.push(info_prompt); // 유저관련 정보

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

      /* 심리 검사 결과 프롬프트 상시 삽입 */
      // 세션에 psy_testResult_promptArr_last 값이 없는 경우
      if (!req.session.psy_testResult_promptArr_last) {
        console.log("심리 검사 결과 프롬프트 삽입");
        let psy_testResult_promptArr_last = []; // 2점을 획득한 정서행동검사 문항을 저장하는 prompt

        // 해당 계정의 모든 정서행동검사 결과를 DB에서 차출
        const psy_testResult_promptArr = EBT_classArr.map(async (ebt_class) => {
          const select_Ebt_Result = await select_soyes_AI_Ebt_Table(
            EBT_Table_Info[ebt_class].table, // Table Name
            EBT_Table_Info[ebt_class].attribute,
            EBT_Table_Info[ebt_class].result, // EBT Question 11가지 분야 중 1개 (Table에 따라 결정)
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
        // DB 접근 최소화를 위해 세션에 psy_testResult_promptArr_last 값 저장
        req.session.psy_testResult_promptArr_last = [
          ...psy_testResult_promptArr_last,
        ];
      }
      // 세션에 psy_testResult_promptArr_last 값이 있는 경우
      else {
        console.log("세션 저장된 심리 검사 결과 프롬프트 삽입");
        promptArr.push(...req.session.psy_testResult_promptArr_last);
      }

      // 음악 명상 + 그림 명상 관련 솔루션 프롬프트
      promptArr.push(solution_prompt2);

      /* 검사 결과 분석 관련 멘트 감지 */
      if (
        test_result_ment.some((el) => {
          if (lastUserContent.includes(el.text)) {
            testClass = el.class; // 검사 분야 저장
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
        // 검사 분야 세션 추가. 해당 세션동안 검사 결과 분석은 1회만 진행되도록 세션 데이터 설정.
        req.session.ebt_class = random_class;
      }
      /* 인지행동 관련 멘트 감지 */
      // 인지행동 세션 데이터가 없고, 인지행동 검사 관련 멘트 감지
      else if (
        !req.session.cb_class &&
        cb_solution_ment.some((el) => {
          if (lastUserContent.includes(el.text)) {
            testClass_cb = el.class; // 인지 분야 저장
            return true;
          } else return false;
        })
      ) {
        // 고정 답변3 프롬프트 삽입 - 인지행동 치료 문제
        console.log("인지행동 치료 프롬프트 삽입");
        let cb_testArr;

        // 인지행동 문항 맵핑
        const cb_class_map = {
          school: cb_test_school,
          friend: cb_test_family,
          family: cb_test_friend,
          etc: cb_test_remain,
        };

        // 감지된 인지행동 문제 분야 선택
        cb_testArr = cb_class_map[testClass_cb];
        req.session.cb_class = testClass_cb;

        // 랜덤 문항 1개 선택
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
      /* 인지행동 세션 돌입 */
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
      } else promptArr.push(sentence_division_prompt);

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
      promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4-turbo", // gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let emotion = parseInt(response.choices[0].message.content.slice(-1));
      console.log("emotion: " + emotion);

      const message = {
        message: response.choices[0].message.content.slice(0, -1),
        emotion,
      };
      // 대화 내역 로그
      console.log([
        ...parseMessageArr,
        { role: "assistant", content: message.message },
      ]);

      // 세션 확인 코드
      // console.log(req.session);

      res.status(200).json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
        emotion: 0,
      });
    }
  },
  // (Legacy) User 정서행동 검사 결과 반환
  postOpenAIUserEBTResultData: async (req, res) => {
    const { data } = req.body;
    let parseData,
      parsepUid,
      returnArr = [];

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, contentKey } = parseData;
      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }
      // pUid default값 설정
      parsepUid = pUid;
      console.log(
        `User 정서행동 검사 결과 반환 API /openAI/ebtresult Path 호출 - pUid: ${parsepUid}`
      );

      /*
      // EBT DB에서 차출 - Obj
      await Promise.all(
        EBT_classArr.map(async (ebt_class) => {
          // 분야별 값 조회
          const select_Ebt_Result = await select_soyes_AI_Ebt_Result(
            EBT_Table_Info[ebt_class],
            parsepUid // Uid
          );
          returnObj[ebt_class] = { ...select_Ebt_Result };
        })
      );
      // console.log(returnObj);
      */

      // EBT DB에서 차출 - Arr
      const ebtResultArr = EBT_classArr.map(async (ebt_class) => {
        const select_Ebt_Result = await select_soyes_AI_Ebt_Result(
          EBT_Table_Info[ebt_class],
          parsepUid // Uid
        );
        // contentKey 값이 입력되지 않을 경우 analysisResult 속성 삭제
        if (!contentKey) delete select_Ebt_Result.content;
        return { ebt_class, ...select_Ebt_Result };
      });
      // map method는 pending 상태의 promise를 반환하므로 Promise.all method를 사용하여 resolve 상태가 되기를 기다려준다.
      await Promise.all(ebtResultArr).then((result) => {
        returnArr = [...result]; // resolve 상태로 반환된 배열을 returnArr 변수에 복사
      });
      // console.log(returnArr);

      return res.status(200).json({
        message: "User EBT Result Return Success!",
        data: returnArr.sort((a, b) => b.tScore - a.tScore),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error - 500",
      });
    }
  },
  // (Legacy) 정서멘토 모델 - 엘라
  postOpenAIConsultingLala: async (req, res) => {
    const { data } = req.body;
    // console.log(EBTData);
    let parseEBTdata, parseMessageArr, parsepUid; // Parsing 변수
    let promptArr = []; // 삽입 Prompt Array
    let userPrompt = []; // 삽입 User Prompt Array
    // let testClass = "",
    //   testClass_cb = "";

    try {
      if (typeof data === "string") {
        parseEBTdata = JSON.parse(data);
      } else parseEBTdata = data;

      const { messageArr, pUid, type } = parseEBTdata;

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 404");
        return res.status(404).json({ message: "No pUid input value - 404" });
      }
      // No type => return
      if (!type) {
        console.log("No type input value - 404");
        return res.status(404).json({ message: "No type input value - 404" });
      }
      // No type => return
      if (!messageArr) {
        console.log("No messageArr input value - 404");
        return res
          .status(404)
          .json({ message: "No messageArr input value - 404" });
      }

      // messageArr가 문자열일 경우 json 파싱
      if (typeof messageArr === "string") {
        parseMessageArr = JSON.parse(messageArr);
      } else parseMessageArr = [...messageArr];

      // pUid default값 설정
      parsepUid = pUid;
      console.log(
        `엘라 상담 API /consulting_emotion_lala Path 호출 - pUid: ${parsepUid}`
      );

      // 고정 삽입 프롬프트
      promptArr.push(persona_prompt_lala_v5); // 엘라 페르소나
      promptArr.push(info_prompt); // 유저관련 정보

      // 유저 마지막 멘트
      // const lastUserContent =
      //   parseMessageArr[parseMessageArr.length - 1].content;

      // 대화 6회 미만 - 심리 상담 프롬프트 삽입
      if (parseMessageArr.length < 11) {
        console.log("심리 상담 프롬프트 삽입");
        promptArr.push(EBT_Table_Info[type].consult);
      }
      // 대화 6회 - 심리 상담 프롬프트 + 심리 상태 분석 프롬프트 삽입
      else if ((parseMessageArr.length + 1) % 12 === 0) {
        console.log("심리 상담 프롬프트 + 심리 요약 프롬프트 삽입");
        promptArr.push(EBT_Table_Info[type].consult);
        // 비교 분석용 EBT class 맵
        const compareTypeMap = {
          School: ["School", "Attention"], // 학업/성적 상담은 School, Attention 분석과 비교하여 해석.
          Friend: ["Friend", "Movement"],
          Family: ["Family"],
          Mood: ["Mood", "Unrest", "Sad", "Angry"],
          Health: ["Health"],
          Self: ["Self"],
        };

        let resolvedCompareEbtAnalysis; // EBT 분석을 담을 배열

        // compareTypeMap에 맵핑되는 분야의 검사 결과를 DB에서 조회
        const compareEbtAnalysis = await compareTypeMap[type].map(
          async (ebtClass) => {
            return await select_soyes_AI_Ebt_Analyis(
              EBT_Table_Info[ebtClass],
              parsepUid
            );
          }
        );
        // Promise Pending 대기
        await Promise.all(compareEbtAnalysis).then((data) => {
          resolvedCompareEbtAnalysis = [...data]; // resolve 상태로 반환된 prompt 배열을 psy_testResult_promptArr_last 변수에 복사
        });
        // userPrompt 명령 추가
        userPrompt.push({
          role: "user",
          content: `아래는 user의 정서행동검사 결과야.
          '''
          ${resolvedCompareEbtAnalysis.map((data) => {
            const { ebtClass, analyisResult } = data;
            return `
            ${ebtClass}: { ${
              analyisResult === "NonTesting"
                ? `'정서행동검사 - ${analyisResult}'을 실시하지 않았습니다.`
                : analyisResult
            }}
            `;
          })}
          '''
          지금까지 대화를 기반으로 user의 심리 상태를 3문장으로 요약하고, 위 정서행동검사 결과와 비교하여 2문장으로 해석해줘.
            `,
        });
      }
      // 대화 7회 - 더미 데이터 반환 (7회마다)
      else if ((parseMessageArr.length + 1) % 14 === 0) {
        console.log("더미 데이터 반환 (클라이언트의 솔루션 획득 시점)");
        const message = {
          message: "Dummy Message",
          emotion: 0,
        };
        return res.status(200).json(message);
      }
      // 대화 8회 초과 - 심리 솔루션 프롬프트 삽입 || 기본 상담 프롬프트 삽입
      else {
        console.log(
          `심리 솔루션 프롬프트 삽입 - solution:${req.session.solution?.solutionClass}`
        );
        // 유저 마지막 멘트
        const lastUserContent =
          parseMessageArr[parseMessageArr.length - 1].content;
        // console.log(lastUserContent);

        // 컨텐츠 실시 여부 선택 세션 - 9*n회 문답에서 실시
        if (
          lastUserContent.includes("false") ||
          lastUserContent.includes("true")
        ) {
          // 컨텐츠를 실시할 경우
          if (lastUserContent.includes("true")) {
            let message = {
              message: "좋아! 그럼 명상에 집중해보자!",
              emotion: 0,
            };
            // 컨텐츠 종류에 따른 고정 멘트 반환
            switch (req.session?.solution?.solutionClass) {
              // 명상
              case "meditation":
                console.log(`명상 고정 멘트 반환`);
                message.message = "좋아! 그럼 명상에 집중해보자!";
                delete req.session.solution;
                return res.status(200).json(message);
              // 인지행동
              case "cognitive":
                console.log(`인지행동 고정 멘트 반환`);
                message.message = "좋아! 그럼 문제에 집중해보자!";
                delete req.session.solution;
                return res.status(200).json(message);
              // 디폴트(명상)
              default:
                console.log(`디폴트 멘트 반환`);
                message.message = "좋아! 그럼 디폴트에 집중해보자!";
                delete req.session.solution;
                return res.status(200).json(message);
            }
          }
          // 컨텐츠를 안할 경우 - 솔루션 세션 삭제
          else delete req.session.solution;
        }
        // 세션에 솔루션 관련 프롬프트가 있는 경우는 삽입
        if (req.session.solution?.prompt)
          promptArr.push(req.session.solution.prompt);

        // 8회 이후의 답변은 막아두기
        // req.session.solution
        //   ? promptArr.push(req.session.solution.prompt)
        //   : promptArr.push(EBT_Table_Info[type].solution);

        // 솔루션 세션이 아닌 경우 기본 상담 프롬프트 삽입
        promptArr.push(EBT_Table_Info[type].consult);
      }

      /* 
      // 검사 결과 분석 관련 멘트 감지
      if (
        test_result_ment.some((el) => {
          if (lastUserContent.includes(el.text)) {
            testClass = el.class; // 검사 분야 저장
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
        // 검사 분야 세션 추가. 해당 세션동안 검사 결과 분석은 1회만 진행되도록 세션 데이터 설정.
        req.session.ebt_class = random_class;
      }
      // 인지행동 관련 멘트 감지
      // 인지행동 세션 데이터가 없고, 인지행동 검사 관련 멘트 감지
      else if (
        !req.session.cb_class &&
        cb_solution_ment.some((el) => {
          if (lastUserContent.includes(el.text)) {
            testClass_cb = el.class; // 인지 분야 저장
            return true;
          } else return false;
        })
      ) {
        // 고정 답변3 프롬프트 삽입 - 인지행동 치료 문제
        console.log("인지행동 치료 프롬프트 삽입");
        let cb_testArr;

        // 인지행동 문항 맵핑
        const cb_class_map = {
          school: cb_test_school,
          friend: cb_test_family,
          family: cb_test_friend,
          etc: cb_test_remain,
        };

        // 감지된 인지행동 문제 분야 선택
        cb_testArr = cb_class_map[testClass_cb];
        req.session.cb_class = testClass_cb;

        // 랜덤 문항 1개 선택
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
      // 인지행동 세션 돌입
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
      } else promptArr.push(sentence_division_prompt);
      */

      // 상시 삽입 프롬프트
      // promptArr.push(completions_emotion_prompt); // 답변 이모션 넘버 확인 프롬프트 삽입

      // console.log(promptArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr, ...userPrompt],
        model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      // let emotion = parseInt(response.choices[0].message.content.slice(-1));
      // console.log("emotion: " + emotion);

      const message = {
        message: response.choices[0].message.content,
        emotion: 0,
      };
      // 대화 내역 로그
      // console.log([
      //   ...parseMessageArr,
      //   { role: "assistant", content: response.choices[0].message.content },
      //   // response.choices[0].message.content,
      // ]);

      // 엘라 심리 분석 DB 저장
      if (parseMessageArr.length === 11) {
        const table = Consult_Table_Info["Analysis"].table;
        const attribute = Consult_Table_Info["Analysis"].attribute;

        // DB에 Row가 없을 경우 INSERT, 있으면 지정한 속성만 UPDATE
        const duple_query = `INSERT INTO ${table} (${attribute.pKey}, ${attribute.attr1}) VALUES (?, ?) ON DUPLICATE KEY UPDATE
          ${attribute.attr1} = VALUES(${attribute.attr1});`;

        const duple_value = [parsepUid, JSON.stringify(message)];

        connection_AI.query(duple_query, duple_value, (error, rows, fields) => {
          if (error) console.log(error);
          else console.log("Ella Consult Analysis UPDATE Success!");
        });

        // 엘라 유저 분석 내용 Session 저장
        req.session.ella_analysis = message.message;
      }
      return res.status(200).json(message);
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Server Error - 500 Bad Gateway" + err.message,
        emotion: 0,
      });
    }
  },
};

module.exports = {
  openAIController,
  ellaMoodController,
  ellaFriendController,
  NorthController,
  // openAIController_Regercy,
};
