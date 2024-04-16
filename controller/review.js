// MySQL 접근
const mysql = require("mysql");
const { dbconfig, dbconfig_ai } = require("../DB/database");
// Tips DB 연결
const connection = mysql.createConnection(dbconfig);
connection.connect();
// AI DB 연결
const connection_AI = mysql.createConnection(dbconfig_ai);
connection_AI.connect();

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
    attr1: "date",
    attr2: "profile_img_url",
    attr3: "content",
  },
};

const reviewController = {
  // ReviewData READ
  getReviewDataGet: (req, res) => {
    console.log("ReviewData READ API 호출");
    // 클라이언트로부터 페이지 번호 받기 (기본값: 1)
    const page = req.query.page || 1;
    const limit = 10; // 한 페이지에 보여줄 리뷰의 수
    const offset = (page - 1) * limit;

    const review_table = Review_Table_Info.table;
    // const review_attribute = Review_Table_Info.attribute;

    // const select_column = Object.values(review_attribute).join(", ");

    // SQL 쿼리 준비: 최신순으로 리뷰 데이터 가져오기
    const select_query = `SELECT * FROM ${review_table} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const select_values = [limit, offset];
    // 데이터베이스 쿼리 실행
    connection_AI.query(select_query, select_values, (err, data) => {
      if (err) return res.status(500).json({ message: err });

      // 결과 반환
      res.json({
        page,
        limit,
        reviewData: data,
      });
    });
  },
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

      // 오늘 날짜 변환
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
      const day = ("0" + dateObj.getDate()).slice(-2);
      const date = `${year}-${month}-${day}`;

      const review_table = Review_Table_Info.table;
      const review_attribute = Review_Table_Info.attribute;

      // Consult_Log DB 저장
      const review_insert_query = `INSERT INTO ${review_table} (${Object.values(
        review_attribute
      ).join(", ")}) VALUES (${Object.values(review_attribute)
        .map((el) => "?")
        .join(", ")})`;
      // console.log(consult_insert_query);

      const review_insert_value = [parsepUid, date, profile_img_url, content];
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
  reviewController,
};
