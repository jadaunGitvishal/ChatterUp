const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || '';

// Shared in-memory store used as a fallback when no MongoDB URI is
// configured, so the app still works for local testing without a DB.
const memoryMessages = [];
let dbConnected = false;

async function connectDB() {
  if (!MONGODB_URI) {
    console.log('No MONGODB_URI set — using in-memory storage (messages will reset on restart).');
    return false;
  }
  try {
    await mongoose.connect(MONGODB_URI);
    dbConnected = true;
    console.log('Connected to MongoDB.');
    return true;
  } catch (err) {
    console.error('MongoDB connection failed, falling back to in-memory storage:', err.message);
    return false;
  }
}

function isConnected() {
  return dbConnected;
}

module.exports = {
  connectDB,
  isConnected,
  memoryMessages
};
