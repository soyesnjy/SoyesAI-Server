// MySQL 접근
const mysql = require("mysql");
const { dbconfig, dbconfig_ai } = require("../DB/database");
// Tips DB 연결
const connection = mysql.createConnection(dbconfig);
connection.connect();
// AI DB 연결
const connection_AI = mysql.createConnection(dbconfig_ai);
connection_AI.connect();

const signupController = {
  // VR 중복 체크
  dupleCheckHandler: (req, res) => {
    const { id, vrNum, type } = req.body;

    // MySQL DB 연동
    if (type === "id") {
      connection.query(
        `SELECT * FROM teacher WHERE (teacher_uid = '${id}')`,
        (error, rows, fields) => {
          if (error) console.log(error);
          if (rows.length) {
            res.json({ data: "Fail" });
          } else res.json({ data: "Success" });
        }
      );
    } else {
      connection.query(
        `SELECT * FROM teacher WHERE (vr_number = '${vrNum}')`,
        (error, rows, fields) => {
          if (error) console.log(error);
          if (rows.length) {
            res.json({ data: "Fail" });
          } else res.json({ data: "Success" });
        }
      );
    }
  },
  // VR 회원가입
  signupHandler: (req, res) => {
    const { id, pwd, name, age, email, vrNum } = req.body;
    // 서버측 2중 보안
    if (!id || !pwd || !vrNum) res.json({ data: "Fail" });
    // MySQL DB 연동
    connection.query(
      `INSERT INTO teacher VALUES ('${vrNum}', '${id}', '${pwd}')`,
      (error) => {
        if (error) {
          console.log(error);
          res.json({ data: "Fail" });
        } else res.json({ data: "Success" });
      }
    );
  },
};

module.exports = {
  signupController,
};
