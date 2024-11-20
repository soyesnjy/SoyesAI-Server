// redis 서버 접속
const redisStore = require("../DB/redisClient");
// MySQL 접근
const mysql = require("mysql");
const { dbconfig_ai } = require("../DB/database");

// AI DB 연결
const connection_AI = mysql.createConnection(dbconfig_ai);
connection_AI.connect();

const moment = require("moment-timezone");

// Database Table Info
const {
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
// n일 이후의 날짜를 반환하는 메서드
const addDays = (days, date = new Date()) => {
  const result = new Date(date);
  result.setHours(result.getHours() + 9);
  result.setDate(result.getDate() + days);
  return result;
};

const PaymentController = {
  // 이용권 만료일 조회. User Subscription Expiration Date Select
  postUserSubscriptionExpiration: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid;
    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid } = parseData;
      console.log(`유저 이용권 만료일 조회 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No pUid => return
      if (!pUid) {
        console.log(`No Required input value - 400 - pUid: ${pUid}`);
        return res
          .status(400)
          .json({ message: "No Required input value - 400" });
      }

      parsepUid = pUid;

      const table = Subscription_Table_Info["Subscription"].table;

      const select_query = `SELECT
      subscription_expiration_date
      FROM ${table}
      WHERE uid='${parsepUid}'`;

      const select_data = await fetchUserData(connection_AI, select_query);

      // console.log(select_data[0].expirationDate);

      // 결제한 적이 없는 유저
      if (!select_data.length) {
        console.log(`Users without payment history - pUid:${parsepUid}`);
        return res.status(200).json({
          message:
            "이용권 만료일이 지난 유저입니다. (Users without payment history)",
        });
      }

      // 이용권 만료일이 지난 유저
      if (!select_data.length) {
        console.log(`Users whose license has expired - pUid:${parsepUid}`);
        return res.status(200).json({
          message:
            "이용권 만료일이 지난 유저입니다. (subscription has expired)",
        });
      }

      // 조회 성공
      console.log(`User Expiration Date Select Success! - pUid:${parsepUid}`);
      return res.status(200).json({
        message: "User Expiration Date Select Success!",
        data: select_data[0].subscription_expiration_date,
      });
    } catch (err) {
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
      });
    }
  },
  // 이용권 만료일 갱신. User Subscription Expiration Date Update
  postUserSubscriptionExpirationUpdate: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid;
    const typeRegex = /^(?!day$|month$|year$).*/;
    const typeMap = {
      day: 1,
      month: 30,
      year: 365,
    };
    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, type } = parseData;

      console.log(`유저 이용권 만료일 갱신 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No Required => return
      if (!pUid || !type) {
        console.log(`No Required input value - 400 - pUid: ${pUid}`);
        return res
          .status(400)
          .json({ message: "No Required input value - 400" });
      }
      // No type matching => return
      if (typeRegex.test(String(type))) {
        console.log(`Type is not matching [day, month, year] - pUid: ${pUid}`);
        return res.status(400).json({
          message: "Type is not matching [day, month, year]",
        });
      }

      parsepUid = pUid;

      // 1. SELECT (쿠폰 row 확인)
      const table = Subscription_Table_Info["Subscription"].table;

      const select_query = `SELECT * FROM ${table} WHERE uid='${parsepUid}'`;
      const select_data = await fetchUserData(connection_AI, select_query);

      // 2. UPDATE TEST (row값이 있는 경우 실행)
      if (select_data[0]) {
        const { subscription_expiration_date } = select_data[0];
        const today = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");

        // expirationDate 지났는지 여부 확인
        let update_expirationDate_value =
          new Date(subscription_expiration_date) < new Date(today)
            ? addDays(typeMap[type]).toISOString().slice(0, 19)
            : addDays(typeMap[type], subscription_expiration_date)
                .toISOString()
                .slice(0, 19);

        // console.log(
        //   "update_expirationDate_value: " + update_expirationDate_value
        // );

        const update_query = `UPDATE ${table} SET 
        subscription_expiration_date = ?,
        subscription_status = ?
        WHERE uid = ?`;
        // console.log(update_query);

        const update_value = [
          update_expirationDate_value,
          "active", // Active, Expired
          parsepUid,
        ];
        // console.log(update_value);

        connection_AI.query(
          update_query,
          update_value,
          async (error, rows, fields) => {
            if (error) console.log(error);
            else {
              // const key = `user:expiry:${parsepUid}`;
              // Redis expiry 갱신
              // await redisStore.set(
              //   `user:expiry:${parsepUid}`,
              //   update_expirationDate_value,
              //   (err, reply) => {
              //     // 로그인 처리 로직
              //     console.log(`User Plan Redis Update - ${parsepUid}`);
              //   }
              // );
              console.log(
                `User Subscription Expiration Date Update Success! - pUid: ${pUid}`
              );
              return res.status(200).json({
                message: "User Subscription Expiration Date Update Success!",
              });
            }
          }
        );
      }
      // 3. INSERT TEST (row값이 없는 경우 실행)
      else {
        let insert_expirationDate_value = addDays(typeMap[type])
          .toISOString()
          .slice(0, 19);

        // console.log(
        //   "insert_expirationDate_value: " + insert_expirationDate_value
        // );

        const insert_query = `INSERT INTO ${table} (
        uid,
        subscription_expiration_date,
        subscription_status
        ) VALUES (?, ?, ?)`;
        // console.log(insert_query);

        const insert_value = [parsepUid, insert_expirationDate_value, "active"];
        // console.log(insert_value);

        connection_AI.query(
          insert_query,
          insert_value,
          async (error, rows, fields) => {
            if (error) console.log(error);
            else {
              // Redis expiry 갱신
              // await redisStore.set(
              //   `user:expiry:${parsepUid}`,
              //   insert_expirationDate_value,
              //   (err, reply) => {
              //     // 로그인 처리 로직
              //     console.log(`User Plan Redis Insert - ${parsepUid}`);
              //   }
              // );
              console.log(
                `User Subscription Expiration Date Insert Success! - pUid: ${pUid}`
              );
              return res.status(200).json({
                message: "User Subscription Expiration Date Insert Success!",
              });
            }
          }
        );
      }

      // Log Insert 처리
      const log_table = Subscription_Table_Info["Log"].table;

      // Log Table 저장
      const log_insert_query = `INSERT INTO ${log_table} (
      uid,
      subscription_log_type,
      subscription_log_purchase_type
      ) VALUES (?, ?, ?)`;
      // console.log(plan_log_insert_query);

      const log_insert_value = [parsepUid, "purchase", type];
      // console.log(plan_log_insert_value);

      connection_AI.query(log_insert_query, log_insert_value, (err) => {
        if (err) console.log("Err sqlMessage: " + err.sqlMessage);
        else console.log(`Subscription Log DB Insert Success! - pUid: ${pUid}`);
      });
    } catch (err) {
      delete err.headers;
      console.error(err);
      return res.status(500).json({
        message: `Server Error : ${err.message}`,
      });
    }
  },
  // 쿠폰 유효성 검증. User Coupon validation
  postUserCouponValidation: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid;
    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, couponNumber } = parseData;

      console.log(`쿠폰 유효성 검증 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No Required => return
      if (!pUid || !couponNumber) {
        console.log(`No Required input value - 400 - pUid: ${pUid}`);
        return res
          .status(400)
          .json({ message: "No Required input value - 400" });
      }

      parsepUid = pUid;

      // 1. SELECT (발급 쿠폰 확인)
      const table = Subscription_Table_Info["Coupon"].table;

      const select_query = `SELECT * FROM ${table} WHERE coupon_number='${couponNumber}'`;
      const select_data = await fetchUserData(connection_AI, select_query);
      // console.log(select_data);

      // DB에 존재하지 않는 쿠폰
      if (!select_data.length) {
        console.log(`This coupon does not exist - pUid: ${pUid}`);
        return res.status(400).json({
          message: "존재하지 않는 쿠폰입니다 (This coupon does not exist)",
        });
      }

      const {
        coupon_id,
        coupon_type,
        coupon_discount_rate,
        coupon_subscription_period,
      } = select_data[0];

      // 해당 쿠폰 사용 이력 조회
      const log_table = Subscription_Table_Info["Log"].table;

      const log_select_query = `SELECT 
      subscription_log_id,
      subscription_log_coupon_number
      FROM ${log_table}
      WHERE uid='${pUid}'
      AND subscription_log_coupon_number='${couponNumber}'`;

      const log_select_data = await fetchUserData(
        connection_AI,
        log_select_query
      );
      // console.log(log_select_data);

      // 사용 이력이 있는 경우
      if (log_select_data.length) {
        console.log(`This is the coupon I used - pUid: ${pUid}`);
        return res.status(400).json({
          message: "이미 사용한 쿠폰입니다 (This is the coupon I used)",
        });
      }

      // 이용권인 경우
      if (coupon_type === "subscription") {
        // 이용권 만료일 확인
        const sub_table = Subscription_Table_Info["Subscription"].table;

        const sub_select_query = `SELECT * FROM ${sub_table} WHERE uid='${parsepUid}'`;
        const sub_select_data = await fetchUserData(
          connection_AI,
          sub_select_query
        );

        const today = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
        // expirationDate 지났는지 여부 확인
        let expirationDate_value = sub_select_data[0]
          ?.subscription_expiration_date
          ? new Date(subscription_expiration_date) < new Date(today)
            ? addDays(coupon_subscription_period).toISOString().slice(0, 19)
            : addDays(coupon_subscription_period, subscription_expiration_date)
                .toISOString()
                .slice(0, 19)
          : addDays(coupon_subscription_period).toISOString().slice(0, 19);

        // DB에 Row가 없을 경우 INSERT, 있으면 지정한 속성만 UPDATE
        const duple_query = `INSERT INTO ${sub_table} 
        (uid,
        subscription_expiration_date,
        subscription_status)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
        subscription_expiration_date = VALUES(subscription_expiration_date),
        subscription_status = VALUES(subscription_status);`;

        const duple_value = [parsepUid, expirationDate_value, "active"];

        try {
          await queryAsync(connection_AI, duple_query, duple_value);
          console.log(
            `User Subscription Expiration Date Update Success! - pUid: ${parsepUid}`
          );
          res.status(200).json({
            message:
              "이용권 쿠폰 사용에 성공했습니다! (User Coupon validation Success)",
          });
        } catch (err) {
          console.error("Error executing query:", err);
          return res.status(500).json({
            message: `Server Error: ${err.sqlMessage}`,
          });
        }

        // connection_AI.query(duple_query, duple_value, (err, rows, fields) => {
        //   if (err) {
        //     console.log(err);
        //     return res.status(500).json({
        //       message: `Server Error : ${err.sqlMessage}`,
        //     });
        //   }
        //   console.log(
        //     `User Subscription Expiration Date Update Success! - pUid: ${pUid}`
        //   );
        // });
      }
      // 할인권인 경우
      else {
        console.log(
          `할인권 쿠폰 사용에 성공했습니다! (User Coupon validation Success) - pUid: ${pUid}`
        );
        res.status(201).json({
          message:
            "할인권 쿠폰 사용에 성공했습니다! (User Coupon validation Success)",
          data: coupon_discount_rate,
        });
      }

      // Log Insert 처리
      const log_insert_query = `INSERT INTO ${log_table} (
        uid,
        subscription_log_type,
        subscription_log_coupon_number,
        subscription_log_coupon_id
        ) VALUES (?, ?, ?, ?)`;
      // console.log(plan_log_insert_query);

      const log_insert_value = [parsepUid, "coupon", couponNumber, coupon_id];
      // console.log(plan_log_insert_value);

      try {
        await queryAsync(connection_AI, log_insert_query, log_insert_value);
        console.log(`Subscription Log Insert Success! - pUid: ${pUid}`);
        return;
      } catch (err) {
        console.error("Error executing query:", err);
        return res.status(500).json({
          message: `Server Error: ${err.sqlMessage}`,
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
  PaymentController,
};
