const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

async function connectDB(dbName = env.dbName) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUrl, { dbName });
  logger.info(`MongoDB connected (${dbName})`);
  return mongoose.connection;
}

module.exports = { connectDB };
