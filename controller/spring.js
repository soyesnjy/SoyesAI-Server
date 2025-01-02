// stream 데이터 처리
// MySQL 접근
const mysql = require("mysql");
const { dbconfig_ai } = require("../DB/database");

// 결과보고서 관련
// const stream = require("stream");
// const puppeteer = require("puppeteer");
// const ejs = require("ejs");
// const path = require("path");
// const { PDFDocument } = require("pdf-lib");
// const nodemailer = require("nodemailer");

// Redis 연결
// const redisStore = require("../DB/redisClient");

// AI DB 연결
const connection_AI = mysql.createConnection(dbconfig_ai);
connection_AI.connect();

// const OpenAI = require("openai");
// const openai = new OpenAI({
//   apiKey: process.env.API_TOKEN,
// });

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

      // 2. INSERT || UPDATE : 타입별 query, value 삽입
      switch (parseType) {
        case "first":
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

      console.log(
        `[늘봄]엘라 기분 훈련 Start Data Load API 호출 - pUid: ${pUid}`
      );
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
        `[늘봄]불안 훈련 저장 API /openAI/training_mood_ella/save Path 호출 - pUid: ${pUid}`
      );
      console.log(parseData);

      // No Required Anxiety Data => return
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

      parsepUid = pUid;
      let duple_query, duple_value;

      const table = Ella_Training_Table_Info["Anxiety"].table;

      // 1. SELECT User Table Data
      const select_query = `SELECT * FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      const select_data = await fetchUserData(connection_AI, select_query);

      // console.log(select_data[0]);

      // 타입별 query, value 삽입
      switch (parseType) {
        case "first":
          if (select_data.length > 0) {
            // 이미 존재하는 경우 (UPDATE)
            duple_query = `
            UPDATE ${table} 
            SET
            anxiety_situation_first = ?,
            anxiety_physical_first = ?,
            anxiety_thought_first = ?,
            anxiety_rating_first = ?,
            anxiety_worrys_first = ?,
            anxiety_name = ?
            WHERE anxiety_idx = ?`;

            duple_value = [
              anxiety_situation,
              anxiety_physical,
              anxiety_thought,
              anxiety_rating,
              JSON.stringify(anxiety_worrys),
              anxiety_name, // 1회기
              select_data[0].anxiety_idx,
            ];
          } else {
            // 존재하지 않는 경우 (INSERT)
            duple_query = `
            INSERT INTO ${table} 
            (uid,
            anxiety_round_idx,
            anxiety_situation_first,
            anxiety_physical_first,
            anxiety_thought_first,
            anxiety_rating_first,
            anxiety_worrys_first,
            anxiety_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

            duple_value = [
              parsepUid,
              -1,
              anxiety_situation,
              anxiety_physical,
              anxiety_thought,
              anxiety_rating,
              JSON.stringify(anxiety_worrys), // 1 ~ 3회기
              anxiety_name, // 1회기
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
              console.log("Anxiety First Insert Success!");
              return res
                .status(200)
                .json({ message: "Anxiety First Data Save Success!" });
            }
          );
          break;
        case "second":
          if (select_data.length > 0) {
            // 이미 존재하는 경우 (UPDATE)
            duple_query = `
            UPDATE ${table}
            SET
            anxiety_situation_second = ?,
            anxiety_physical_second = ?,
            anxiety_thought_second = ?,
            anxiety_rating_second = ?,
            anxiety_worrys_second = ?
            WHERE anxiety_idx = ?`;

            duple_value = [
              anxiety_situation,
              anxiety_physical,
              anxiety_thought,
              anxiety_rating,
              JSON.stringify(anxiety_worrys), // 1 ~ 3회기
              select_data[0].anxiety_idx,
            ];
          } else {
            // 존재하지 않는 경우 (INSERT)
            duple_query = `
            INSERT INTO ${table}
            (uid,
            anxiety_round_idx,
            anxiety_situation_second,
            anxiety_physical_second,
            anxiety_thought_second,
            anxiety_rating_second,
            anxiety_worrys_second)
            VALUES (?, ?, ?, ?, ?, ?, ?);`;

            duple_value = [
              parsepUid,
              -1,
              anxiety_situation,
              anxiety_physical,
              anxiety_thought,
              anxiety_rating,
              JSON.stringify(anxiety_worrys), // 1 ~ 3회기
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
              console.log("Anxiety Second Insert Success!");
              return res
                .status(200)
                .json({ message: "Anxiety Second Data Save Success!" });
            }
          );
          break;
        case "third":
          if (select_data.length > 0) {
            // 이미 존재하는 경우 (UPDATE)
            duple_query = `
            UPDATE ${table}
            SET
            anxiety_situation_third = ?,
            anxiety_physical_third = ?,
            anxiety_thought_third = ?,
            anxiety_rating_third = ?,
            anxiety_worrys_third = ?
            WHERE anxiety_idx = ?`;

            duple_value = [
              anxiety_situation,
              anxiety_physical,
              anxiety_thought,
              anxiety_rating,
              JSON.stringify(anxiety_worrys), // 1 ~ 3회기
              select_data[0].anxiety_idx,
            ];
          } else {
            // 존재하지 않는 경우 (INSERT)
            duple_query = `
            INSERT INTO ${table}
            (uid,
            anxiety_round_idx,
            anxiety_situation_third,
            anxiety_physical_third,
            anxiety_thought_third,
            anxiety_rating_third,
            anxiety_worrys_third)
            VALUES (?, ?, ?, ?, ?, ?, ?);`;

            duple_value = [
              parsepUid,
              -1,
              anxiety_situation,
              anxiety_physical,
              anxiety_thought,
              anxiety_rating,
              JSON.stringify(anxiety_worrys), // 1 ~ 3회기
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
              console.log("Anxiety Third Insert Success!");
              return res
                .status(200)
                .json({ message: "Anxiety Third Data Save Success!" });
            }
          );
          break;
        case "fourth":
          if (select_data.length > 0) {
            // 이미 존재하는 경우 (UPDATE)
            duple_query = `
            UPDATE ${table}
            SET
            anxiety_situation_fourth = ?,
            anxiety_physical_fourth = ?,
            anxiety_thought_fourth = ?,
            anxiety_rating_fourth = ?,
            anxiety_cognitive_score = ?
            WHERE anxiety_idx = ?`;

            duple_value = [
              anxiety_situation,
              anxiety_physical,
              anxiety_thought,
              anxiety_rating,
              anxiety_cognitive_score, // 4회기
              select_data[0].anxiety_idx,
            ];
          } else {
            // 존재하지 않는 경우 (INSERT)
            duple_query = `
            INSERT INTO ${table}
            (uid,
            anxiety_round_idx,
            anxiety_situation_fourth,
            anxiety_physical_fourth,
            anxiety_thought_fourth,
            anxiety_rating_fourth,
            anxiety_cognitive_score)
            VALUES (?, ?, ?, ?, ?, ?, ?);`;

            duple_value = [
              parsepUid,
              -1,
              anxiety_situation,
              anxiety_physical,
              anxiety_thought,
              anxiety_rating,
              anxiety_cognitive_score, // 4회기
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
              console.log("Anxiety Fourth Insert Success!");
              return res
                .status(200)
                .json({ message: "Anxiety Fourth Data Save Success!" });
            }
          );
          break;
        case "fifth":
          if (select_data.length > 0) {
            // 이미 존재하는 경우 (UPDATE)
            duple_query = `
            UPDATE ${table}
            SET
            anxiety_situation_fifth = ?,
            anxiety_physical_fifth = ?,
            anxiety_thought_fifth = ?,
            anxiety_rating_fifth = ?,
            anxiety_challenge_steps = ?,
            anxiety_challenge_score = ?
            WHERE anxiety_idx = ?`;

            duple_value = [
              anxiety_situation,
              anxiety_physical,
              anxiety_thought,
              anxiety_rating,
              anxiety_challenge_steps, // 5회기
              anxiety_challenge_score.join("/"), // 5회기
              select_data[0].anxiety_idx,
            ];
          } else {
            // 존재하지 않는 경우 (INSERT)
            duple_query = `
            INSERT INTO ${table}
            (uid,
            anxiety_round_idx,
            anxiety_situation_fifth,
            anxiety_physical_fifth,
            anxiety_thought_fifth,
            anxiety_rating_fifth,
            anxiety_challenge_steps,
            anxiety_challenge_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

            duple_value = [
              parsepUid,
              -1,
              anxiety_situation,
              anxiety_physical,
              anxiety_thought,
              anxiety_rating,
              anxiety_challenge_steps, // 5회기
              anxiety_challenge_score.join("/"), // 5회기
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
              console.log("Anxiety Fifth Insert Success!");
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
    let parseData,
      parsepUid,
      anxiety_name = "쿵쾅이"; // Parsing 변수

    try {
      // json 파싱
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid } = parseData;

      console.log(`[늘봄]불안 훈련 Start Data Load API 호출 - pUid: ${pUid}`);
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

      // Table User 조회
      const select_query = `SELECT * FROM ${table} WHERE uid = '${parsepUid}' ORDER BY created_at DESC LIMIT 1;`;
      const select_data = await fetchUserData(connection_AI, select_query);

      if (select_data.length && select_data[0]?.anxiety_name)
        anxiety_name = select_data[0].anxiety_name;

      return res.status(200).json({
        anxiety_name,
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

const springEllaEmotionController = {
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
};

module.exports = {
  springEllaMoodController,
  springEllaAnxietyController,
  springEllaEmotionController,
};
