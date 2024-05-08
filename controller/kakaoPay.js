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

const User_Table_Info = {
  table: "soyes_ai_User",
  attribute: {
    pKey: "uid",
    attr1: "Email",
    attr2: "passWard",
    attr3: "name",
    attr4: "phoneNumber",
    attr5: "oauth_type",
    attr6: "creation_date",
    attr7: "lastLogin_date",
  },
};

const Review_Table_Info = {
  table: "soyes_ai_User_Review_Log",
  attribute: {
    cKey: "uid",
    attr1: "profile_img_url",
    attr2: "content",
  },
};

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
      // console.log(parsepUid);

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

      console.log(response.data);
      if (response.status === 200)
        res.status(200).json({ message: "KakaoPay Approve Success!" });

      // TODO DB 관련 처리는 추후 테이블 설계 완료 후 진행될 예정
      /*
      const review_table = Review_Table_Info.table;
      const review_attribute = Review_Table_Info.attribute;

      // Consult_Log DB 저장
      const review_insert_query = `INSERT INTO ${review_table} (${Object.values(
        review_attribute
      ).join(", ")}) VALUES (${Object.values(review_attribute)
        .map((el) => "?")
        .join(", ")})`;
      // console.log(consult_insert_query);

      const review_insert_value = [parsepUid, profile_img_url, content];
      // console.log(consult_insert_value);

      connection_AI.query(review_insert_query, review_insert_value, (err) => {
        if (err) {
          console.log("Review_Log DB Save Fail!");
          console.log("Err sqlMessage: " + err.sqlMessage);
          res.json({ message: "Err sqlMessage: " + err.sqlMessage });
        } else {
          console.log("Review_Log DB Save Success!");
          res.status(200).json({ message: "Review_Log DB Save Success!" });
        }
      });
      */
    } catch (err) {
      console.log(err.response.data);
      res.status(500).json({ message: "Server Error - 500" });
    }
  },
};

module.exports = {
  kakaoPayController,
};
