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
  // KakaoPayReady
  postKakaoPayReady: async (req, res) => {
    console.log("KakaoPayReady API 호출");
    const { readyData } = req.body;
    let parseInput;
    try {
      // 파싱. Client JSON 데이터
      if (typeof readyData === "string") {
        parseInput = JSON.parse(readyData);
      } else parseInput = readyData;

      // console.log(parseInput);

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
      console.error(err);
      res.status(500).json({ message: "Server Error - 500" });
    }
  },
  // ReviewData CREATE
  postReviewDataCreate: (req, res) => {
    console.log("ReviewData CREATE API 호출");
    const { ReviewData } = req.body;
    let parseReviewData, parsepUid;
    try {
      // 파싱. Client JSON 데이터
      if (typeof ReviewData === "string") {
        parseReviewData = JSON.parse(ReviewData);
      } else parseReviewData = ReviewData;

      const { pUid, profile_img_url, content } = parseReviewData;
      parsepUid = pUid;

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
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server Error - 500" });
    }
  },
  // ReviewData UPDATE
  postReviewDataUpdate: (req, res) => {
    console.log("ReviewData UPDATE API 호출");
    const { ReviewData } = req.body;
    let parseReviewData, parseEnteyID, parseContent;
    try {
      // 파싱. Client JSON 데이터
      if (typeof ReviewData === "string") {
        parseReviewData = JSON.parse(ReviewData);
      } else parseReviewData = ReviewData;

      const { content, entry_id } = parseReviewData;
      parseEnteyID = entry_id;
      parseContent = content;

      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      // Review 테이블 및 속성 명시
      const review_table = Review_Table_Info.table;
      const review_attribute = Review_Table_Info.attribute;
      const review_pKey = "entry_id";

      // Query 명시. (Review 존재 확인용 Select Query)
      const review_select_query = `SELECT ${review_pKey} FROM ${review_table} WHERE ${review_pKey} = ${parseEnteyID}`;

      // Select Query
      connection_AI.query(review_select_query, [], (err, data) => {
        if (err) {
          console.log("Review_Log DB Select Fail!");
          console.log("Err sqlMessage: " + err.sqlMessage);
        } else {
          // entry_id에 해당되는 Review가 있을 경우
          if (data[0]) {
            // Review 갱신용 Update Query
            const review_update_query = `UPDATE ${review_table} SET ${review_attribute.attr2} = ? WHERE ${review_pKey} = ?`;
            const review_update_value = [parseContent, parseEnteyID];
            // Update Query
            connection_AI.query(
              review_update_query,
              review_update_value,
              (err) => {
                if (err) {
                  console.log("Review_Log DB Update Fail!");
                  console.log("Err sqlMessage: " + err.sqlMessage);
                } else {
                  console.log("Review_Log DB Update Success!");
                  res
                    .status(200)
                    .json({ message: "Review_Log DB Update Success!" });
                }
              }
            );
          }
          // entry_id에 해당되는 Review가 없을 경우
          else {
            console.log("Review_Log DB Non Review!");
            res.status(400).json({ message: "Review_Log DB Non Review!" });
          }
        }
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server Error - 500" });
    }
  },
  // ReviewData DELETE
  deleteReviewDataDelete: (req, res) => {
    console.log("ReviewData DELETE API 호출");
    const { id } = req.params;

    try {
      const review_table = Review_Table_Info.table;
      const delete_query = `DELETE FROM ${review_table} WHERE entry_id = ?`;

      connection_AI.query(delete_query, [id], (err) => {
        if (err) {
          console.log("Review_Log DB Delete Fail!");
          console.log("Err sqlMessage: " + err.sqlMessage);
          res.json({ message: "Err sqlMessage: " + err.sqlMessage });
        } else {
          console.log("Review_Log DB Delete Success!");
          res.status(200).json({ message: "Review_Log DB Delete Success!" });
        }
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server Error - 500" });
    }
  },
};

module.exports = {
  kakaoPayController,
};
