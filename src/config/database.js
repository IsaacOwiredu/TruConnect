const mongoose = require('mongoose');
const { isProduction, mongoUri } = require('./env');

mongoose.set('strictQuery', true);
mongoose.set('autoIndex', !isProduction);
mongoose.set('bufferCommands', false);

const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];

function getDatabaseState() {
  return stateNames[mongoose.connection.readyState] || 'unknown';
}

async function connectDatabase(uri = mongoUri) {
  if (!uri) {
    return false;
  }

  // Register models before opening the connection so development index creation is ready.
  require('../models');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
    autoIndex: !isProduction,
  });

  console.info('MongoDB connection established.');
  return true;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection lost.');
});

mongoose.connection.on('error', () => {
  console.error('MongoDB reported a connection error.');
});

module.exports = { connectDatabase, disconnectDatabase, getDatabaseState };
