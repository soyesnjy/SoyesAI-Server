require("dotenv").config();

const redis = require("redis");
const RedisStore = require("connect-redis").default;
const redisClient = redis.createClient({
  url: "redis://soyeskids.co.kr:6379",
});

redisClient.connect().catch(console.error);

let redisStore = new RedisStore({
  client: redisClient,
});

module.exports = redisStore;
