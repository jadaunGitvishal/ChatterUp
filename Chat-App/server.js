require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const Message = require('./models/Message');
const { connectDB, isConnected, memoryMessages } = require('./config/db.config');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ----------------------------------------------------------------
// 1. Serve the front-end (this is the whole "API Structure": the
//    server's only HTTP job is to hand back the chat UI at "/").
// ----------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------------------------------------------------------
// 2. Connect to MongoDB (used to persist chat history). Connection
//    logic lives in config/db.config.js; here we just kick it off.
// ----------------------------------------------------------------
connectDB();

async function saveMessage({ username, content, avatarColor }) {
  if (isConnected()) {
    const msg = await Message.create({ username, content, avatarColor });
    return msg;
  }
  const msg = { username, content, avatarColor, createdAt: new Date() };
  memoryMessages.push(msg);
  return msg;
}

async function getHistory(limit = 50) {
  if (isConnected()) {
    const docs = await Message.find().sort({ createdAt: 1 }).limit(limit).lean();
    return docs;
  }
  return memoryMessages.slice(-limit);
}

// ----------------------------------------------------------------
// 3. Real-time layer (Socket.io)
// ----------------------------------------------------------------
// onlineUsers maps socket.id -> { username, avatarColor }
const onlineUsers = new Map();

function colorForName(name) {
  // Deterministic color per username so each person keeps the same
  // "profile picture" color every time they join (Profile Pictures req.)
  const palette = ['#4ade80', '#60a5fa', '#f472b6', '#facc15', '#a78bfa', '#fb923c', '#34d399'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function broadcastUserList() {
  const users = Array.from(onlineUsers.values());
  io.emit('users:update', users);
}

io.on('connection', (socket) => {
  // --- User onboarding: client sends their chosen name ---
  socket.on('user:join', async (username) => {
    const clean = String(username || '').trim().slice(0, 30) || 'Guest';
    const avatarColor = colorForName(clean);
    onlineUsers.set(socket.id, { username: clean, avatarColor });

    // Send chat history + current online count to the new user only
    const history = await getHistory();
    socket.emit('chat:history', history);
    socket.emit('user:welcome', { username: clean, onlineCount: onlineUsers.size });

    // Notify everyone else a new user joined
    socket.broadcast.emit('user:joined', { username: clean });
    broadcastUserList();
  });

  // --- Typing indicator ---
  socket.on('typing:start', () => {
    const user = onlineUsers.get(socket.id);
    if (user) socket.broadcast.emit('typing:update', { username: user.username, typing: true });
  });
  socket.on('typing:stop', () => {
    const user = onlineUsers.get(socket.id);
    if (user) socket.broadcast.emit('typing:update', { username: user.username, typing: false });
  });

  // --- Broadcasting + storing chat messages ---
  socket.on('chat:message', async (content) => {
    const user = onlineUsers.get(socket.id);
    if (!user || !content || !String(content).trim()) return;
    const text = String(content).trim().slice(0, 1000);
    const saved = await saveMessage({ username: user.username, content: text, avatarColor: user.avatarColor });
    io.emit('chat:message', {
      username: user.username,
      content: text,
      avatarColor: user.avatarColor,
      createdAt: saved.createdAt
    });
  });

  // --- Disconnection ---
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      onlineUsers.delete(socket.id);
      io.emit('user:left', { username: user.username });
      broadcastUserList();
    }
  });
});

server.listen(PORT, () => {
  console.log(`ChatterUp running at http://localhost:${PORT}/`);
});
