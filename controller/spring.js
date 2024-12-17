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
// const redisStore = require("../DB/redisClient");

// AI DB 연결
const connection_AI = mysql.createConnection(dbconfig_ai);
connection_AI.connect();

const axios = require("axios");

const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.API_TOKEN,
});

const nodemailer = require("nodemailer");

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

// 프롬프트 관련
const { persona_prompt_lala_v6 } = require("../DB/test_prompt");

// Database Table Info
const {
  // User_Table_Info,
  Ella_Training_Table_Info,
} = require("../DB/database_table_info");

const springEllaMoodController = {
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
        `[늘봄] 엘라 기분 훈련 저장 API /openAI/training_mood_ella/save Path 호출 - pUid: ${pUid}`
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
      let duple_query, duple_value;

      const table = Ella_Training_Table_Info["Mood"].table;

      // 1. SELECT User Mood Table Data
      const select_query = `SELECT mood_idx FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      const select_data = await fetchUserData(connection_AI, select_query);

      // 타입별 query, value 삽입
      switch (parseType) {
        case "first":
          // INSERT || UPDATE
          if (select_data.length > 0) {
            // 이미 존재하는 경우 (UPDATE)
            duple_query = `
            UPDATE ${table}
            SET 
              mood_name = ?,
              mood_score = ?,
              mood_situation_first = ?,
              mood_thought_first = ?,
              mood_solution_first = ?,
              mood_different_thought_first = ?,
              mood_rating_first = ?
            WHERE mood_idx = ?;
          `;
            duple_value = [
              mood_name,
              mood_cognitive_score,
              mood_situation,
              mood_thought,
              mood_solution,
              mood_different_thought,
              mood_rating,
              select_data[0].mood_idx, // 특정 Row만 업데이트
            ];
          } else {
            // 존재하지 않는 경우 (INSERT)
            duple_query = `
            INSERT INTO ${table} 
            (uid,
            mood_avartar,
            mood_round_idx,
            mood_name,
            mood_score, 
            mood_situation_first,
            mood_thought_first,
            mood_solution_first, 
            mood_different_thought_first,
            mood_rating_first)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;
            duple_value = [
              parsepUid,
              "Ella",
              -1,
              mood_name,
              mood_cognitive_score,
              mood_situation,
              mood_thought,
              mood_solution,
              mood_different_thought,
              mood_rating,
            ];
          }

          connection_AI.query(
            duple_query,
            duple_value,
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
          // INSERT || UPDATE
          if (select_data.length > 0) {
            // 이미 존재하는 경우 (UPDATE)
            duple_query = `
            UPDATE ${table}
            SET 
              mood_todo_list = ?,
              mood_situation_second = ?,
              mood_thought_second = ?,
              mood_solution_second = ?,
              mood_different_thought_second = ?,
              mood_rating_second = ?
            WHERE mood_idx = ?;
          `;
            duple_value = [
              JSON.stringify(mood_todo_list),
              mood_situation,
              mood_thought,
              mood_solution,
              mood_different_thought,
              mood_rating,
              select_data[0].mood_idx, // 특정 Row만 업데이트
            ];
          } else {
            // 존재하지 않는 경우 (INSERT)
            duple_query = `
            INSERT INTO ${table} 
            (uid,
            mood_avartar,
            mood_round_idx,
            mood_todo_list,
            mood_situation_second,
            mood_thought_second,
            mood_solution_second,
            mood_different_thought_second,
            mood_rating_second)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;
            duple_value = [
              parsepUid,
              "Ella",
              -1,
              JSON.stringify(mood_todo_list),
              mood_situation,
              mood_thought,
              mood_solution,
              mood_different_thought,
              mood_rating,
            ];
          }

          connection_AI.query(
            duple_query,
            duple_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Mood Second Insert Success!");
              return res
                .status(200)
                .json({ message: "Mood Second Data Save Success!" });
            }
          );
          break;
        case "third":
          if (select_data.length > 0) {
            // 이미 존재하는 경우 (UPDATE)
            duple_query = `
            UPDATE ${table}
            SET 
              mood_talk_list = ?,
              mood_situation_third = ?,
              mood_thought_third = ?,
              mood_solution_third = ?,
              mood_different_thought_third = ?,
              mood_rating_third = ?
            WHERE mood_idx = ?;
          `;
            duple_value = [
              JSON.stringify(mood_talk_list),
              mood_situation,
              mood_thought,
              mood_solution,
              mood_different_thought,
              mood_rating,
              select_data[0].mood_idx, // 특정 Row만 업데이트
            ];
          } else {
            // 존재하지 않는 경우 (INSERT)
            duple_query = `
            INSERT INTO ${table} 
            (uid,
            mood_avartar,
            mood_round_idx,
            mood_talk_list,
            mood_situation_third,
            mood_thought_third,
            mood_solution_third,
            mood_different_thought_third,
            mood_rating_third)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
            duple_value = [
              parsepUid,
              "Ella",
              -1,
              JSON.stringify(mood_talk_list),
              mood_situation,
              mood_thought,
              mood_solution,
              mood_different_thought,
              mood_rating,
            ];
          }

          connection_AI.query(
            duple_query,
            duple_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Mood Third Insert Success!");
              return res
                .status(200)
                .json({ message: "Mood Third Data Save Success!" });
            }
          );
          break;
        case "fourth":
          if (select_data.length > 0) {
            // 이미 존재하는 경우 (UPDATE)
            duple_query = `
            UPDATE ${table}
            SET 
              mood_meditation_feedback = ?,
              mood_situation_fourth = ?,
              mood_thought_fourth = ?,
              mood_solution_fourth = ?,
              mood_different_thought_fourth = ?,
              mood_rating_fourth = ?
            WHERE mood_idx = ?;
          `;
            duple_value = [
              mood_meditation_feedback,
              mood_situation,
              mood_thought,
              mood_solution,
              mood_different_thought,
              mood_rating,
              select_data[0].mood_idx, // 특정 Row만 업데이트
            ];
          } else {
            // 존재하지 않는 경우 (INSERT)
            duple_query = `
            INSERT INTO ${table} 
            (uid,
            mood_avartar,
            mood_round_idx,
            mood_meditation_feedback,
            mood_situation_fourth,
            mood_thought_fourth,
            mood_solution_fourth,
            mood_different_thought_fourth,
            mood_rating_fourth)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
            duple_value = [
              parsepUid,
              "Ella",
              -1,
              mood_meditation_feedback,
              mood_situation,
              mood_thought,
              mood_solution,
              mood_different_thought,
              mood_rating,
            ];
          }

          connection_AI.query(
            duple_query,
            duple_value,
            (error, rows, fields) => {
              if (error) {
                console.log(error);
                return res.status(400).json({ message: error.sqlMessage });
              }
              console.log("Mood Fourth Insert Success!");
              return res
                .status(200)
                .json({ message: "Mood Fourth Data Save Success!" });
            }
          );
          break;
      }
    } catch (err) {
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
      });
    }
  },
  // 기분훈련 시작 데이터 Load API
  postOpenAIMoodDataLoad: async (req, res) => {
    const { data } = req.body;

    let parseData,
      parsepUid,
      mood_name = "까망이"; // Parsing 변수

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid } = parseData;

      console.log(`엘라 기분 훈련 Start Data Load API 호출 - pUid: ${pUid}`);
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

      // Mood Table User 조회
      const select_query = `SELECT mood_name FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      const select_data = await fetchUserData(connection_AI, select_query);

      // mood_name이 있는 경우 갱신
      if (select_data.length && select_data[0]?.mood_name)
        mood_name = select_data[0].mood_name;

      return res.status(200).json({
        mood_name,
      });
    } catch (err) {
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
      });
    }
  },
};

const springEllaAnxietyController = {
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

      const { messageArr, pUid, code, en } = parseData;

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
      // parseMessageArr = [...messageArr];
      promptArr.push(persona_prompt_lala_v6); // 엘라 페르소나

      // code 매칭 프롬프트 삽입
      switch (code) {
        case "situation":
          parseMessageArr = [...messageArr];
          promptArr.push({
            role: "system",
            content: `user가 불안하다고 말한 상황에 반응한다.`,
          });
          break;
        case "emotion":
          parseMessageArr = [...messageArr];
          promptArr.push({
            role: "system",
            content: `불안할 때 유저가 하는 생각에 초등학생의 눈높이에 맞춰 한 문장으로 유저의 감정을 반영하며 공감한다. 질문은 하지 않는다.`,
          });
          break;
        case "consolation":
          parseMessageArr = [messageArr[messageArr.length - 1]];
          promptArr.push({
            role: "system",
            content: `유저가 불안해하고 걱정하는 내용에 초등학생의 눈높이에 맞춰 한 문장으로 유저의 감정을 반영하며 공감한다. 질문은 하지 않는다.`,
          });
          break;
        case "solution":
          parseMessageArr = [messageArr[messageArr.length - 1]];
          promptArr.push({
            role: "system",
            content: `유저가 불안해하고 걱정하는 상황에 대해 초등학생이 시도해볼 수 있는 해결책을 70자 이내로 한 가지 제시한다. 예) ~해보면 어때?`,
          });
          break;
        case "box_end":
          parseMessageArr = [...messageArr];
          promptArr.push({
            role: "system",
            content: `유저의 마지막 말을 듣고 감정을 반영하며 한 문장으로 공감한다. 이후 이번 상담은 여기서 마치려고 한다고 이야기한 후 종료한다.`,
          });
          break;
        case "challenge_start":
          parseMessageArr = [...messageArr];
          promptArr.push({
            role: "system",
            // 2024.10.11 이전 프롬프트
            // content: `assistant의 이름은 '엘라' 이며 반말을 사용한다.
            // user가 두렵고 떨리지만 도전하고 싶은 목표를 말하면, 엘라는 '이렇게 차근차근 도전해보자'라고 하며 점진적으로 연습할 수 있는 5단계 활동을 300자 이내로 제시하고 '어떤 것 같아?'라는 말로 마친다.
            // 5단계 활동은 초등학생이 할 수 있는 활동이어야 한다.
            // 유저가 새 활동을 추천해달라고 하는 경우, 새로운 5단계 활동을 300자 이내로 제시한다.

            // form
            // '''
            // 1단계: 매일 아침에 가볍게 스트레칭하기.
            // 2단계: 집 앞 공원에서 가벼운 산책해보기.
            // 3단계: 집에서 할 수 있는 줄넘기 도전해보기.
            // 4단계: 친구랑 같이 자전거나 인라인스케이트 타기.
            // 5단계: 가족과 함께 주말마다 등산 가기!
            // '''
            // `,
            // 2024.10.11 프롬프트 교체
            content: `assistant의 이름은 '엘라' 이며 반말을 사용한다.
            user는 직전에 자신이 도전하고 싶은 목표를 이야기했다. 그리고 assistant가 그 목표 행동을 수행할 수 있도록 돕는 점진적인 5단계 활동을 제시했지만, 특정 부분을 보완해달라고 요청했다. 이 모든 내용을 고려해, '이렇게 차근차근 도전해보자'라고 하며 점진적으로 연습할 수 있는 5단계 활동을 300자 이내로 제시하고 '어떤 것 같아?'라는 말로 마친다.
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
          parseMessageArr = [...messageArr];
          promptArr.push({
            role: "system",
            content: `유저가 활동을 언제, 어디에서 실천할지 입력한 경우, 계획을 잘 세웠다고 격려한다. 유저가 활동을 실천할 수 있는 시간이나 장소를 말하지 못한 경우, ‘~는 어떨까?’라는 말로 대안을 제시한다.`,
          });
          break;
        case "challenge_end":
          parseMessageArr = [...messageArr];
          promptArr.push({
            role: "system",
            content: `user 응답에 반응한다. '차근차근 도전해보고 두려운 마음이 어떻게 변하는지 북극이 일기에도 써보자'라고 한다.`,
          });
          break;
      }

      // console.log(promptArr);
      // console.log(parseMessageArr);

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let ellaAnxietyMsg = response.choices[0].message.content;
      // 영어 번역
      if (en) {
        ellaAnxietyMsg = await translateText(ellaAnxietyMsg);
      }

      const message = {
        message: ellaAnxietyMsg,
      };

      return res.status(200).json(message);
    } catch (err) {
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
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
              console.log("Anxiety Second Update Success!");
              return res
                .status(200)
                .json({ message: "Anxiety Second Data Save Success!" });
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
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
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
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
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
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
      });
    }
  },
};

const springEllaEmotionController = {
  // 정서인식 트레이너 - 엘라 (New)
  postOpenAIEllaEmotionTraning: async (req, res) => {
    const { data } = req.body;
    let parseData,
      parseMessageArr = [];
    let promptArr = []; // 삽입 Prompt Array
    // 불안훈련 code 식별값
    // const codeArr = ["emotion"];
    try {
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { messageArr, pUid, en } = parseData;

      console.log(`엘라 정서인식 훈련 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }
      // No type => return
      // if (!code) {
      //   console.log("No code input value - 400");
      //   return res.status(400).json({ message: "No type input value - 400" });
      // }

      // No type => return
      if (!messageArr) {
        console.log("No messageArr input value - 400");
        return res
          .status(400)
          .json({ message: "No messageArr input value - 400" });
      }

      // No Matching codeArr => return
      // if (!codeArr.includes(code)) {
      //   console.log("No matching code value - 400");
      //   return res
      //     .status(400)
      //     .json({ message: "No matching code value - 400" });
      // }

      // pUid default값 설정
      parsepUid = pUid;

      parseMessageArr = [...messageArr];
      // promptArr.push(persona_prompt_lala_v6); // 엘라 페르소나
      promptArr.push({
        role: "system",
        content: `user의 마지막 말에 30자로 공감하고 '오늘은 감정의 역할과 불편한 감정들도 나름대로 쓸모가 있다는 걸 배웠어! 다음 시간에 또 만나'라고 하고 마친다`,
      });

      const response = await openai.chat.completions.create({
        messages: [...promptArr, ...parseMessageArr],
        model: "gpt-4o", // gpt-4-turbo, gpt-4-0125-preview, gpt-3.5-turbo-0125, ft:gpt-3.5-turbo-1106:personal::8fIksWK3
      });

      let ellaEmotionMsg = response.choices[0].message.content;
      // 영어 번역
      if (en) {
        ellaEmotionMsg = await translateText(ellaEmotionMsg);
      }

      const message = {
        message: ellaEmotionMsg,
      };

      return res.status(200).json(message);
    } catch (err) {
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
      });
    }
  },
  // 정서인식 Save API
  postOpenAIEmotionDataSave: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid, parseType; // Parsing 변수
    const typeArr = ["first", "second", "third", "fourth"]; // type 식별자
    const regex = /^(?![1-4]$).+$/;
    const awarenessRegex = /^(?!score-high$|score-middle$|score-low$).*/;

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const {
        // 필수 입력
        pUid,
        type,
        // 1회기
        emotion_face_correct,
        emotion_face_wrong,
        // 2회기
        emotion_body_correct,
        emotion_body_wrong,
        emotion_expression,
        // 3회기
        emotion_role_correct,
        emotion_role_wrong,
        emotion_role_feedback,
        // 4회기
        emotion_self_awareness,
        emotion_score_situation,
        emotion_day_flow,
      } = parseData;

      console.log(
        `정서인식 훈련 저장 API /openAI/training_emotion_ella/save Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // No Required Data => return
      if (!pUid || !type) {
        console.log("No Required Emotion input value - 400");
        return res
          .status(400)
          .json({ message: "No Required Emotion Data input value - 400" });
      }

      // type [1~4] 체크
      if (regex.test(String(type))) {
        console.log(`Type is not matching [1 ~ 4] - pUid: ${pUid}`);
        return res.status(400).json({
          message: "Type is not matching [1 ~ 4]",
        });
      }

      // pUid default값 설정
      parsepUid = pUid;
      parseType = typeArr[type - 1];
      console.log(`parseType : ${parseType}`);

      // 1회기 필수 입력값 체크
      if (
        parseType === "first" &&
        (!emotion_face_correct || !emotion_face_wrong)
      ) {
        console.log(
          `Non input values suitable for the type (first) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "Non input values suitable for the type (first)",
        });
      }

      // 2회기 필수 입력값 체크
      if (
        parseType === "second" &&
        (!emotion_body_correct || !emotion_body_wrong || !emotion_expression)
      ) {
        console.log(
          `Non input values suitable for the type (second) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "Non input values suitable for the type (second)",
        });
      }

      // 3회기 필수 입력값 체크
      if (
        parseType === "third" &&
        (!emotion_role_correct || !emotion_role_wrong || !emotion_role_feedback)
      ) {
        console.log(
          `Non input values suitable for the type (third) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "Non input values suitable for the type (third)",
        });
      }

      // 4회기
      if (parseType === "fourth") {
        // 필수 입력값 체크
        if (
          !emotion_self_awareness ||
          emotion_score_situation < 0 ||
          !emotion_day_flow
        ) {
          console.log(
            `Non input values suitable for the type (fourth) - pUid: ${parsepUid}`
          );
          return res.status(400).json({
            message: "Non input values suitable for the type (fourth)",
          });
        }
        // emotion_self_awareness 단어 체크
        if (awarenessRegex.test(emotion_self_awareness)) {
          console.log(
            `emotion_self_awareness is not matching [score-high, score-middle, score-low] - pUid: ${pUid}`
          );
          return res.status(400).json({
            message:
              "emotion_self_awareness is not matching [score-high, score-middle, score-low]",
          });
        }
      }

      const table = Ella_Training_Table_Info["Emotion"].table;

      let update_query, update_value;

      // 1. SELECT User Emotion Table Data
      const select_query = `SELECT * FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      const select_data = await fetchUserData(connection_AI, select_query);

      // console.log(select_data[0]);

      // emotion_round_idx + parseType 체크. 일치하지 않을 경우 (not match - 400 반환)
      if (
        parseType === "first" &&
        select_data.length &&
        select_data[0]?.emotion_round_idx !== 4
      ) {
        console.log(
          `The type value does not match the current episode (first) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode (first)",
        });
      }

      if (
        parseType === "second" &&
        (!select_data.length || select_data[0]?.emotion_round_idx !== 1)
      ) {
        console.log(
          `The type value does not match the current episode (second) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode (second)",
        });
      }

      if (
        parseType === "third" &&
        (!select_data.length || select_data[0]?.emotion_round_idx !== 2)
      ) {
        console.log(
          `The type value does not match the current episode (third)- pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode (third)",
        });
      }

      if (
        parseType === "fourth" &&
        (!select_data.length || select_data[0]?.emotion_round_idx !== 3)
      ) {
        console.log(
          `The type value does not match the current episode (fourth) - pUid: ${parsepUid}`
        );
        return res.status(400).json({
          message: "The type value does not match the current episode (fourth)",
        });
      }

      // 타입별 query, value 삽입
      switch (parseType) {
        case "first":
          const insert_query = `INSERT INTO ${table} 
          (uid,
          emotion_round_idx,
          emotion_face_correct,
          emotion_face_wrong)
          VALUES (?, ?, ?, ?);`;
          // console.log(insert_query);
          const insert_value = [
            parsepUid,
            1,
            emotion_face_correct.join("/"),
            emotion_face_wrong.join("/"),
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
              console.log(`Emotion First Insert Success! - pUid: ${parsepUid}`);
              return res
                .status(200)
                .json({ message: "Emotion First Data Save Success!" });
            }
          );

          break;
        case "second":
          update_query = `UPDATE ${table} SET
          emotion_round_idx = ?,
          emotion_body_correct = ?,
          emotion_body_wrong = ?,
          emotion_expression = ?
          WHERE emotion_idx = ?`;

          // console.log(update_query);
          update_value = [
            2,
            emotion_body_correct.join("/"),
            emotion_body_wrong.join("/"),
            JSON.stringify(emotion_expression),
            select_data[0].emotion_idx,
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
              console.log(
                `Emotion Second Update Success! - pUid: ${parsepUid}`
              );
              return res
                .status(200)
                .json({ message: "Emotion Second Data Save Success!" });
            }
          );
          break;
        case "third":
          update_query = `UPDATE ${table} SET
          emotion_round_idx = ?,
          emotion_role_correct = ?,
          emotion_role_wrong = ?,
          emotion_role_feedback = ?
          WHERE emotion_idx = ?`;

          // console.log(update_query);
          update_value = [
            3,
            emotion_role_correct.join("/"),
            emotion_role_wrong.join("/"),
            emotion_role_feedback,
            select_data[0].emotion_idx,
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
              console.log(`Emotion Third Update Success! - pUid: ${parsepUid}`);
              return res
                .status(200)
                .json({ message: "Emotion Third Data Save Success!" });
            }
          );
          break;
        case "fourth":
          update_query = `UPDATE ${table} SET
          emotion_round_idx = ?,
          emotion_self_awareness = ?,
          emotion_score_situation = ?,
          emotion_day_flow = ?
          WHERE emotion_idx = ?`;

          // console.log(update_query);
          update_value = [
            4,
            emotion_self_awareness,
            emotion_score_situation,
            emotion_day_flow.join("/"),
            select_data[0].emotion_idx,
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
              console.log(
                `Emotion Fourth Update Success! - pUid: ${parsepUid}`
              );
              return res
                .status(200)
                .json({ message: "Emotion Fourth Data Save Success!" });
            }
          );
          break;
      }
    } catch (err) {
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
      });
    }
  },
  // 정서인식 시작 데이터 Load API
  postOpenAIEmotionDataLoad: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid; // Parsing 변수

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid } = parseData;

      console.log(`정서인식 훈련 Start Data Load API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log("No pUid input value - 400");
        return res.status(400).json({ message: "No pUid input value - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;

      // Table 명시
      const table = Ella_Training_Table_Info["Emotion"].table;

      // Table User 조회
      const select_query = `SELECT emotion_round_idx FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      const select_data = await fetchUserData(connection_AI, select_query);

      // case.1 - Row가 없거나 emotion_round_idx === 4
      if (!select_data.length || select_data[0].emotion_round_idx === 4)
        return res.json({ emotion_round_idx: 0 });
      // case.2 - Row가 있을 경우
      else {
        return res.status(200).json({
          emotion_round_idx: select_data[0].emotion_round_idx,
        });
      }
    } catch (err) {
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
      });
    }
  },
  // 정서인식 보고서 데이터 Load API
  postOpenAIEmotionTrainingDataLoad: async (req, res) => {
    const { data } = req.body;

    let parseData, parsepUid; // Parsing 변수
    const typeArr = [1, 2, 3, 4];
    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, type } = parseData;

      console.log(`정서인식 훈련 보고서 Data Load API 호출 - pUid: ${pUid}`);
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
        console.log("No matching Type value [1 ~ 4] - 400");
        return res
          .status(400)
          .json({ message: "No matching Type value [1 ~ 4] - 400" });
      }

      // pUid default값 설정
      parsepUid = pUid;

      // Table 명시
      const table = Ella_Training_Table_Info["Emotion"].table;

      // Table User 조회
      let select_query;
      let select_data;

      switch (type) {
        case 1:
          select_query = `SELECT
          emotion_round_idx,
          emotion_face_correct,
          emotion_face_wrong
          FROM ${table}
          WHERE uid = '${parsepUid}'
          ORDER BY created_at DESC LIMIT 1;`;

          select_data = await fetchUserData(connection_AI, select_query);

          // 1회기를 실시하지 않은 경우
          if (!select_data.length || select_data[0]?.emotion_round_idx < 1) {
            console.log(
              `Emotion Training Data Load Fail! (First) - pUid: ${parsepUid}`
            );
            return res.status(200).json({
              message: `Emotion Training Data Load Fail! (First)`,
            });
          }

          return res.status(200).json({
            message: "Emotion Training Data Load Success! (First)",
            data: {
              emotion_face_correct: select_data[0]?.emotion_face_correct
                ? select_data[0]?.emotion_face_correct.split("/")
                : [], // Array
              emotion_face_wrong: select_data[0]?.emotion_face_wrong
                ? select_data[0]?.emotion_face_wrong.split("/")
                : [], // Array
            },
          });
        case 2:
          select_query = `SELECT
          emotion_round_idx,
          emotion_body_correct,
          emotion_body_wrong,
          emotion_expression
          FROM ${table}
          WHERE uid = '${parsepUid}'
          ORDER BY created_at DESC LIMIT 1;`;

          select_data = await fetchUserData(connection_AI, select_query);

          // 2회기를 실시하지 않은 경우
          if (!select_data.length || select_data[0]?.emotion_round_idx < 2) {
            console.log(
              `Emotion Training Data Load Fail! (Second) - pUid: ${parsepUid}`
            );
            return res.status(200).json({
              message: `Emotion Training Data Load Fail! (Second)`,
            });
          }

          return res.status(200).json({
            message: "Emotion Training Data Load Success! (Second)",
            data: {
              emotion_body_correct: select_data[0]?.emotion_body_correct
                ? select_data[0]?.emotion_body_correct.split("/")
                : [], // Array
              emotion_body_wrong: select_data[0]?.emotion_body_wrong
                ? select_data[0]?.emotion_body_wrong.split("/")
                : [], // Array
              emotion_expression: JSON.parse(
                select_data[0]?.emotion_expression
              ), // Array[String]
            },
          });
        case 3:
          select_query = `SELECT
          emotion_round_idx,
          emotion_role_correct,
          emotion_role_wrong,
          emotion_role_feedback
          FROM ${table}
          WHERE uid = '${parsepUid}'
          ORDER BY created_at DESC LIMIT 1;`;

          select_data = await fetchUserData(connection_AI, select_query);

          // 3회기를 실시하지 않은 경우
          if (!select_data.length || select_data[0]?.emotion_round_idx < 3) {
            console.log(
              `Emotion Training Data Load Fail! (Third) - pUid: ${parsepUid}`
            );
            return res.status(200).json({
              message: `Emotion Training Data Load Fail! (Third)`,
            });
          }

          return res.status(200).json({
            message: "Emotion Training Data Load Success! (Third)",
            data: {
              emotion_role_correct: select_data[0]?.emotion_role_correct
                ? select_data[0]?.emotion_role_correct.split("/")
                : [], // Array
              emotion_role_wrong: select_data[0]?.emotion_role_wrong
                ? select_data[0]?.emotion_role_wrong.split("/")
                : [], // Array
              emotion_role_feedback: select_data[0]?.emotion_role_feedback, // String
            },
          });
        case 4:
          select_query = `SELECT
          emotion_round_idx,
          emotion_self_awareness,
          emotion_score_situation,
          emotion_day_flow
          FROM ${table}
          WHERE uid = '${parsepUid}'
          ORDER BY created_at DESC LIMIT 1;`;

          select_data = await fetchUserData(connection_AI, select_query);

          // 4회기를 실시하지 않은 경우
          if (!select_data.length || select_data[0]?.emotion_round_idx < 4) {
            console.log(
              `Emotion Training Data Load Fail! (Fourth) - pUid: ${parsepUid}`
            );
            return res.status(200).json({
              message: `Emotion Training Data Load Fail! (Fourth)`,
            });
          }

          return res.status(200).json({
            message: "Emotion Training Data Load Success! (Fourth)",
            data: {
              emotion_self_awareness: select_data[0]?.emotion_self_awareness, // String
              emotion_score_situation: select_data[0]?.emotion_score_situation, // Int
              emotion_day_flow: select_data[0]?.emotion_day_flow
                ? select_data[0]?.emotion_day_flow.split("/")
                : [], // Array
            },
          });
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
  springEllaMoodController,
  springEllaAnxietyController,
  springEllaEmotionController,
};
