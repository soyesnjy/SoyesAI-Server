// MySQL 접근
const mysql = require("mysql");
const { dbconfig, dbconfig_ai } = require("../DB/database");
// Tips DB 연결
const connection = mysql.createConnection(dbconfig);
connection.connect();
// AI DB 연결
const connection_AI = mysql.createConnection(dbconfig_ai);
connection_AI.connect();

// kakaopay 관련
const axios = require("axios");
const moment = require("moment-timezone");
// Database Table Info
const { Plan_Table_Info } = require("../DB/database_table_info");

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
// n일 이후의 날짜를 반환하는 메서드
function addDays(
  days,
  date = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss")
) {
  const result = new Date(date);
  result.setHours(result.getHours() + 9);
  result.setDate(result.getDate() + days);
  return result;
}

const kakaoPayController = {
  // KakaoPay Ready
  postKakaoPayReady: async (req, res) => {
    console.log("KakaoPay Ready API 호출");
    const { readyData } = req.body;
    let parseInput;
    try {
      // 파싱. Client JSON 데이터
      if (typeof readyData === "string") {
        parseInput = JSON.parse(readyData);
      } else parseInput = readyData;

      // console.log(parseInput);
      // console.log(process.env.KAKAO_PAY_SERCET_KEY);

      const response = await axios.post(
        `https://open-api.kakaopay.com/online/v1/payment/ready`,
        parseInput,
        {
          headers: {
            Authorization: `SECRET_KEY ${process.env.KAKAO_PAY_SERCET_KEY}`,
            "Content-Type": "application/json",
          },
          // withCredentials: true,
        }
      );
      // console.log(response.data);
      return res.json({ data: response.data });
    } catch (err) {
      console.error(err.response.data);
      res.status(500).json({ message: "Server Error - 500" });
    }
  },
  // KakaoPay Approve
  postKakaoPayApprove: async (req, res) => {
    console.log("KakaoPay Approve API 호출");
    const { approveData } = req.body;
    let parseInput, parsepUid;
    try {
      // 파싱. Client JSON 데이터
      if (typeof approveData === "string") {
        parseInput = JSON.parse(approveData);
      } else parseInput = approveData;

      parsepUid = parseInput.partner_user_id;
      // console.log(parseInput);

      const response = await axios.post(
        `https://open-api.kakaopay.com/online/v1/payment/approve`,
        parseInput,
        {
          headers: {
            Authorization: `SECRET_KEY ${process.env.KAKAO_PAY_SERCET_KEY}`,
            "Content-Type": "application/json",
          },
          // withCredentials: true,
        }
      );

      // console.log(response.data);
      const { tid, partner_order_id, payment_method_type, amount } =
        response.data;

      if (response.status === 200) {
        console.log("KakaoPay Approve Success!");
        res.status(200).json({ message: "KakaoPay Approve Success!" });

        // TODO DB 관련 처리
        const plan_info_table = Plan_Table_Info["Info"].table;
        const plan_info_attribute = Plan_Table_Info["Info"].attribute;

        const plan_info_select_query = `SELECT * FROM ${plan_info_table} WHERE ${plan_info_attribute.pKey}=${partner_order_id}`;
        const plan_info_select_data = await fetchUserData(
          connection_AI,
          plan_info_select_query
        );

        // console.log(plan_info_select_data[0]);

        const { plan_period } = plan_info_select_data[0];

        /* Plan DB 처리 */
        // 1. SELECT TEST (row가 있는지 없는지 검사)
        const plan_table = Plan_Table_Info["Plan"].table;
        const plan_attribute = Plan_Table_Info["Plan"].attribute;

        const plan_select_query = `SELECT * FROM ${plan_table} WHERE ${plan_attribute.pKey}='${parsepUid}'`;
        const plan_select_data = await fetchUserData(
          connection_AI,
          plan_select_query
        );

        // 2. UPDATE TEST (row값이 있는 경우 실행)
        if (plan_select_data[0]) {
          const { expirationDate } = plan_select_data[0];
          const today = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
          let update_expirationDate_value = "";

          // expirationDate 지났는지 여부 확인
          if (new Date(expirationDate) < new Date(today))
            update_expirationDate_value = addDays(plan_period)
              .toISOString()
              .slice(0, 19)
              .replace("T", " ");
          else
            update_expirationDate_value = addDays(plan_period, expirationDate)
              .toISOString()
              .slice(0, 19)
              .replace("T", " ");

          console.log(
            "update_expirationDate_value: " + update_expirationDate_value
          );

          const update_query = `UPDATE ${plan_table} SET ${Object.values(
            plan_attribute
          )
            .filter((el) => el !== "uid")
            .map((el) => `${el} = ?`)
            .join(", ")} WHERE ${plan_attribute.pKey} = ?`;
          // console.log(update_query);

          const update_value = [
            update_expirationDate_value,
            "Active", // Active, Expired
            parsepUid,
          ];
          // console.log(update_value);

          connection_AI.query(
            update_query,
            update_value,
            (error, rows, fields) => {
              if (error) console.log(error);
              else console.log("User Plan DB UPDATE Success!");
            }
          );
        }
        // 3. INSERT TEST (row값이 없는 경우 실행)
        else {
          let insert_expirationDate_value = addDays(plan_period)
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");
          console.log(
            "insert_expirationDate_value: " + insert_expirationDate_value
          );

          const insert_query = `INSERT INTO ${plan_table} (${Object.values(
            plan_attribute
          ).join(", ")}) VALUES (${Object.values(plan_attribute)
            .map(() => "?")
            .join(", ")})`;
          // console.log(insert_query);

          const insert_value = [
            parsepUid,
            insert_expirationDate_value,
            "Active",
          ];
          // console.log(insert_value);

          connection_AI.query(
            insert_query,
            insert_value,
            (error, rows, fields) => {
              if (error) console.log(error);
              else console.log("User Plan DB INSERT Success!");
            }
          );
        }

        // Plan_Log Insert 처리
        const plan_log_table = Plan_Table_Info["Log"].table;
        const plan_log_attribute = Plan_Table_Info["Log"].attribute;

        // Consult_Log DB 저장
        const plan_log_insert_query = `INSERT INTO ${plan_log_table} (${Object.values(
          plan_log_attribute
        ).join(", ")}) VALUES (${Object.values(plan_log_attribute)
          .map((el) => "?")
          .join(", ")})`;
        // console.log(plan_log_insert_query);

        const plan_log_insert_value = [
          parsepUid,
          Number(partner_order_id),
          `kakao-${payment_method_type}`,
          tid,
          amount.total,
          amount.tax_free,
        ];
        // console.log(plan_log_insert_value);

        connection_AI.query(
          plan_log_insert_query,
          plan_log_insert_value,
          (err) => {
            if (err) console.log("Err sqlMessage: " + err.sqlMessage);
            else console.log("Plan_Log DB Insert Success!");
          }
        );
      }
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server Error - 500" });
    }
  },
};

module.exports = {
  kakaoPayController,
};
