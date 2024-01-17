const users = [
  {
    id: "njy95",
    pwd: "qwer1234",
  },
  {
    id: "njy96",
    pwd: "qwer1234",
  },
  {
    id: "njy97",
    pwd: "qwer1234",
  },
];

const dbconfig = {
  host: "soyesdb.cbxvnkrdwevn.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "soyesdeveloper1!",
  database: "soyesdb",
};

const dbconfig_ai = {
  host: "soyesdb.cbxvnkrdwevn.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "soyesdeveloper1!",
  database: "soyesAI",
};

module.exports = {
  users,
  dbconfig,
  dbconfig_ai,
};
