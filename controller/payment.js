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
        expirationDate: select_data[0].subscription_expiration_date,
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

      const { pUid, type, receipt, coupon_number, coupon_id } = parseData;

      console.log(`유저 이용권 만료일 갱신 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No Required => return
      if (!pUid) {
        console.log(`No Required input value - 400 - pUid: ${pUid}`);
        return res
          .status(400)
          .json({ message: "No Required input value - 400" });
      }

      // 결제 관련 변수 중 하나만 온 경우 => return (올거면 두 개 다와야 함)
      if (Boolean(type) !== Boolean(receipt)) {
        console.log(
          `Only one of the payment-related variables was entered - pUid: ${pUid}`
        );
        return res.status(400).json({
          message: "Only one of the payment-related variables was entered",
        });
      }

      // 쿠폰 관련 변수 중 하나만 온 경우 => return (올거면 두 개 다와야 함)
      if (Boolean(coupon_number) !== Boolean(coupon_id)) {
        console.log(
          `Only one of the coupon-related variables was entered - pUid: ${pUid}`
        );
        return res.status(400).json({
          message: "Only one of the coupon-related variables was entered",
        });
      }

      // No type matching => return
      if (type && typeRegex.test(String(type))) {
        console.log(`Type is not matching [day, month, year] - pUid: ${pUid}`);
        return res.status(400).json({
          message: "Type is not matching [day, month, year]",
        });
      }

      parsepUid = pUid;

      const table = Subscription_Table_Info["Subscription"].table; // 유저 이용권 테이블
      const coupon_table = Subscription_Table_Info["Coupon"].table; // 쿠폰 테이블
      const log_table = Subscription_Table_Info["Log"].table; // 유저 이용권 로그 테이블

      let coupon_select_data;

      // 해당 쿠폰 유효성 검증 및 사용 이력 조회
      if (coupon_id && coupon_number) {
        // 쿠폰 유효성 검증
        const select_query = `SELECT
        *
        FROM ${coupon_table}
        WHERE coupon_id='${coupon_id}'`;

        coupon_select_data = await fetchUserData(connection_AI, select_query);

        if (
          !coupon_select_data.length || // 없는 쿠폰
          coupon_select_data[0]?.coupon_number !== coupon_number // 쿠폰 번호와 일치하지 않음
        ) {
          console.log(`Not Vaildation Coupon - pUid: ${pUid}`);
          return res.status(400).json({
            message: "유효한 쿠폰이 아닙니다 (Not Vaildation Coupon)",
          });
        }

        // 쿠폰 타입이 subscription 인데 결제 관련 데이터가 들어온 경우
        if (
          coupon_select_data[0]?.coupon_type === "subscription" &&
          (type || receipt)
        ) {
          console.log(`Not Vaildation Coupon - pUid: ${pUid}`);
          return res.status(400).json({
            message:
              "유효한 결제 방식이 아닙니다 (There are input values that are not required when using a subscription coupon)",
          });
        }

        // 사용 이력 조회
        const log_select_query = `SELECT
        subscription_log_id,
        subscription_log_coupon_number
        FROM ${log_table}
        WHERE uid='${pUid}'
        AND subscription_log_coupon_number='${coupon_number}'`;

        const log_select_data = await fetchUserData(
          connection_AI,
          log_select_query
        );

        // 사용 이력이 있는 경우
        if (log_select_data.length) {
          console.log(`Already Used Coupon - pUid: ${pUid}`);
          return res.status(203).json({
            message: "이미 사용된 쿠폰입니다 (Already Used Coupon)",
          });
        }
      }

      // 유저 이용권 테이블 SELECT
      const select_query = `SELECT * FROM ${table} WHERE uid='${parsepUid}'`;
      const select_data = await fetchUserData(connection_AI, select_query);

      // 이용권 만료일 확인
      let sub_select_data = select_data;

      const today = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
      const subscription_period =
        coupon_select_data &&
        coupon_select_data[0]?.coupon_type === "subscription"
          ? coupon_select_data[0]?.coupon_subscription_period
          : typeMap[type]; // 갱신 기간 (1, 30, 365, [coupon_subscription_period])

      // 기존 만료일 체크 및 만료일 갱신
      let expirationDate_value = sub_select_data[0]
        ?.subscription_expiration_date
        ? new Date(sub_select_data[0]?.subscription_expiration_date) <
          new Date(today)
          ? addDays(subscription_period)
              .toISOString()
              .slice(0, 19)
              .replace("T", " ")
          : addDays(
              subscription_period,
              sub_select_data[0]?.subscription_expiration_date
            )
              .toISOString()
              .slice(0, 19)
              .replace("T", " ")
        : addDays(subscription_period)
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");

      // DB에 Row가 없을 경우 INSERT, 있으면 지정한 속성만 UPDATE
      const duple_query = `INSERT INTO ${table} 
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
            "이용권 구매 성공! (User Subscription Expiration Date Update Success!)",
          expirationDate: expirationDate_value,
        });
      } catch (err) {
        console.error("Error executing query:", err);
        return res.status(500).json({
          message: `Server Error: ${err.sqlMessage}`,
        });
      }

      // Log Table Insert
      // 첫 번째 쿼리: 구매 로그 삽입
      const log_insert_query_purchase = `
      INSERT INTO ${log_table} (
        uid,
        subscription_log_type,
        subscription_log_purchase_type,
        subscription_log_payment_receipt
      ) VALUES (?, ?, ?, ?)`;

      const log_insert_value_purchase = [
        parsepUid,
        "purchase",
        type,
        JSON.stringify(receipt), // 결제 영수증 JSON 데이터
      ];

      // 두 번째 쿼리: 쿠폰 로그 삽입 (couponNumber가 존재할 때만)
      const log_insert_query_coupon = `
      INSERT INTO ${log_table} (
        uid,
        subscription_log_type,
        subscription_log_coupon_number,
        subscription_log_coupon_id
      ) VALUES (?, ?, ?, ?)`;

      const log_insert_value_coupon = [
        parsepUid,
        "coupon",
        coupon_number,
        coupon_id,
      ];

      try {
        // 구매 로그 삽입
        if (type && receipt) {
          await queryAsync(
            connection_AI,
            log_insert_query_purchase,
            log_insert_value_purchase
          );
          console.log(
            `Subscription Log Insert Success (Purchase)! - pUid: ${parsepUid}`
          );
        }

        // 쿠폰 로그 삽입
        if (coupon_id && coupon_number) {
          await queryAsync(
            connection_AI,
            log_insert_query_coupon,
            log_insert_value_coupon
          );
          console.log(
            `Subscription Log Insert Success (Coupon)! - pUid: ${parsepUid}`
          );
        }
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
  // 쿠폰 유효성 검증. User Coupon validation
  postUserCouponValidation: async (req, res) => {
    const { data } = req.body;
    let parseData, parsepUid;
    const couponTypeRegex = /^(?!sale$|subscription$).*/;
    try {
      // 파싱. Client JSON 데이터
      if (typeof data === "string") {
        parseData = JSON.parse(data);
      } else parseData = data;

      const { pUid, couponType, couponNumber } = parseData;

      console.log(`쿠폰 유효성 검증 API 호출 - pUid: ${pUid}`);
      console.log(parseData);

      // No Required => return
      if (!pUid || !couponType || !couponNumber) {
        console.log(`No Required input value - 400 - pUid: ${pUid}`);
        return res
          .status(400)
          .json({ message: "No Required input value - 400" });
      }

      // No type matching => return
      if (couponTypeRegex.test(String(couponType))) {
        console.log(
          `Type is not matching [sale, subscription] - pUid: ${pUid}`
        );
        return res.status(400).json({
          message: "Type is not matching [sale, subscription]",
        });
      }

      parsepUid = pUid;

      // 1. SELECT (발급 쿠폰 확인)
      const table = Subscription_Table_Info["Coupon"].table;

      const select_query = `SELECT 
      coupon_id,
      coupon_number,
      coupon_type,
      coupon_discount_rate,
      coupon_subscription_period
      FROM ${table} 
      WHERE coupon_number='${couponNumber}'
      AND coupon_type='${couponType}'`;

      const select_data = await fetchUserData(connection_AI, select_query);

      // DB에 존재하지 않는 쿠폰
      if (!select_data.length) {
        console.log(`This coupon does not exist - pUid: ${pUid}`);
        return res.status(400).json({
          message: "존재하지 않는 쿠폰입니다 (This coupon does not exist)",
        });
      }

      // 존재하는 쿠폰일 경우
      const {
        coupon_id,
        coupon_number,
        coupon_type,
        coupon_discount_rate,
        coupon_subscription_period,
      } = select_data[0];

      const log_table = Subscription_Table_Info["Log"].table;

      // 사용 이력 체크
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

      if (log_select_data.length) {
        console.log(`Already Used Coupon - pUid: ${pUid}`);
        return res.status(203).json({
          message: "이미 사용된 쿠폰입니다 (Already Used Coupon)",
        });
      }

      // if (coupon_type === "subscription") {
      //   // 이용권 만료일 확인
      //   const sub_table = Subscription_Table_Info["Subscription"].table;

      //   const sub_select_query = `SELECT * FROM ${sub_table} WHERE uid='${parsepUid}'`;
      //   const sub_select_data = await fetchUserData(
      //     connection_AI,
      //     sub_select_query
      //   );

      //   const today = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
      //   // expirationDate 지났는지 여부 확인
      //   let expirationDate_value = sub_select_data[0]
      //     ?.subscription_expiration_date
      //     ? new Date(sub_select_data[0]?.subscription_expiration_date) <
      //       new Date(today)
      //       ? addDays(coupon_subscription_period)
      //           .toISOString()
      //           .slice(0, 19)
      //           .replace("T", " ")
      //       : addDays(
      //           coupon_subscription_period,
      //           sub_select_data[0]?.subscription_expiration_date
      //         )
      //           .toISOString()
      //           .slice(0, 19)
      //           .replace("T", " ")
      //     : addDays(coupon_subscription_period)
      //         .toISOString()
      //         .slice(0, 19)
      //         .replace("T", " ");

      //   // DB에 Row가 없을 경우 INSERT, 있으면 지정한 속성만 UPDATE
      //   const duple_query = `INSERT INTO ${sub_table}
      //   (uid,
      //   subscription_expiration_date,
      //   subscription_status)
      //   VALUES (?, ?, ?)
      //   ON DUPLICATE KEY UPDATE
      //   subscription_expiration_date = VALUES(subscription_expiration_date),
      //   subscription_status = VALUES(subscription_status);`;

      //   const duple_value = [parsepUid, expirationDate_value, "active"];

      //   try {
      //     await queryAsync(connection_AI, duple_query, duple_value);
      //     console.log(
      //       `User Subscription Expiration Date Update Success! - pUid: ${parsepUid}`
      //     );
      //     res.status(200).json({
      //       message:
      //         "이용권 쿠폰 사용에 성공했습니다! (User Coupon validation Success)",
      //       expirationDate: expirationDate_value,
      //     });
      //   } catch (err) {
      //     console.error("Error executing query:", err);
      //     return res.status(500).json({
      //       message: `Server Error: ${err.sqlMessage}`,
      //     });
      //   }
      //   // Log Insert 처리
      //   if (true) {
      //     const log_insert_query = `INSERT INTO ${log_table} (
      //     uid,
      //     subscription_log_type,
      //     subscription_log_coupon_number,
      //     subscription_log_coupon_id
      //     ) VALUES (?, ?, ?, ?)`;
      //     // console.log(plan_log_insert_query);
      //     const log_insert_value = [
      //       parsepUid,
      //       "coupon",
      //       couponNumber,
      //       coupon_id,
      //     ];
      //     // console.log(plan_log_insert_value);
      //     try {
      //       await queryAsync(connection_AI, log_insert_query, log_insert_value);
      //       console.log(`Subscription Log Insert Success! - pUid: ${pUid}`);
      //       return;
      //     } catch (err) {
      //       console.error("Error executing query:", err);
      //       return res.status(500).json({
      //         message: `Server Error: ${err.sqlMessage}`,
      //       });
      //     }
      //   }
      // }

      // 이용권인 경우
      if (coupon_type === "subscription") {
        console.log(
          `이용권 쿠폰 유효성 검증에 성공했습니다! (User Coupon Validation Success) - pUid: ${pUid}`
        );
        res.status(200).json({
          message:
            "이용권 쿠폰 유효성 검증에 성공했습니다! (User Coupon validation Success)",
          data: {
            coupon_id,
            coupon_number,
            coupon_subscription_period, // 이용권 기간
          },
        });
      }
      // 할인권인 경우
      else {
        console.log(
          `할인권 쿠폰 유효성 검증에 성공했습니다! (User Coupon validation Success) - pUid: ${pUid}`
        );
        res.status(200).json({
          message:
            "할인권 쿠폰 유효성 검증에 성공했습니다! (User Coupon validation Success)",
          data: {
            coupon_id,
            coupon_number,
            coupon_discount_rate, // 할인율
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
  PaymentController,
};
