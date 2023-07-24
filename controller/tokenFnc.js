require("dotenv").config();
const { sign, verify } = require("jsonwebtoken");

module.exports = {
  // 토큰 생성 메서드
  generateToken: (user) => {
    const payload = {
      id: user.id,
      email: user.email,
    };
    let result = {
      accessToken: sign(payload, "process.env.ACCESS_SECRET", {
        expiresIn: "1d", // 1일간 유효한 토큰을 발행합니다.
      }),
      refreshToken: sign(payload, "process.env.REFRESH_SECRET", {
        expiresIn: "7d", // 일주일간 유효한 토큰을 발행합니다.
      }),
    };

    return result;
  },
  verifyToken: (type, token) => {
    let secretKey, decoded;
    switch (type) {
      case "access":
        secretKey = "process.env.ACCESS_SECRET";
        break;
      case "refresh":
        secretKey = "process.env.REFRESH_SECRET";
        break;
      default:
        return null;
    }

    try {
      decoded = verify(token, secretKey);
    } catch (err) {
      console.log(`JWT Error: ${err.message}`);
      return null;
    }
    return decoded;
  },
};
