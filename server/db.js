const mongoose = require('mongoose');
const RoomNight = require('./models/RoomNight');
const User = require('./models/User');

let connectionPromise;
let initializationPromise;
let initializedConnection;

async function connectDatabase(uri) {
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!uri) throw new Error('MONGODB_URI is required to connect to the database');
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    })
      .then(() => mongoose.connection)
      .finally(() => {
        connectionPromise = null;
      });
  }
  await connectionPromise;
  return mongoose.connection;
}

async function initializeDatabase(uri) {
  if (mongoose.connection.readyState === 1 && initializedConnection === mongoose.connection) {
    return mongoose.connection;
  }
  if (!initializationPromise) {
    initializationPromise = connectDatabase(uri)
      .then(async (connection) => {
        await Promise.all([RoomNight.init(), User.init()]);
        initializedConnection = connection;
        return connection;
      })
      .finally(() => {
        initializationPromise = null;
      });
  }
  return initializationPromise;
}

module.exports = { connectDatabase, initializeDatabase };
