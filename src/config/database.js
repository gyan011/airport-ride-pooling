const mongoose = require('mongoose');
const Redis = require('ioredis');
const config = require('./config');
const logger = require('../utils/logger');

let redisCache;
let redisPubSub;
let redisLock;

// =======================
// MongoDB
// =======================
const connectMongoDB = async () => {
  const options = {
    maxPoolSize: 100,
    minPoolSize: 10,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  await mongoose.connect(config.MONGODB_URI, options);
  logger.info('MongoDB connected successfully');

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });
};

// =======================
// Redis
// =======================
const createRedisClient = () => {
  const client = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    lazyConnect: true, // IMPORTANT
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('error', (err) => {
    logger.error('Redis client error:', err);
  });

  return client;
};

const connectRedis = async () => {
  redisCache = createRedisClient();
  redisPubSub = createRedisClient();
  redisLock = createRedisClient();

  await redisCache.connect();
  await redisPubSub.connect();
  await redisLock.connect();

  logger.info('Redis connected successfully');
};

module.exports = {
  connectMongoDB,
  connectRedis,
  get redisCache() { return redisCache; },
  get redisPubSub() { return redisPubSub; },
  get redisLock() { return redisLock; }
};