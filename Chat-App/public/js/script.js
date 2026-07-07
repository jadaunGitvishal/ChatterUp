const socket = io();

// ---------- Elements ----------
const joinModal = document.getElementById('join-modal');
const joinInput = document.getElementById('join-name-input');
const joinBtn = document.getElementById('join-btn');
const app = document.getElementById('app');
const welcomeName = document.getElementById('welcome-name');
const messagesEl = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const usersList = document.getElementById('users-list');
const userCount = document.getElementById('user-count');

let myName = '';
let typingTimeout = null;

// ---------- Onboarding ----------
function join() {
  const name = joinInput.value.trim();
  if (!name) return;
  myName = name;
  socket.emit('user:join', name);
  joinModal.classList.add('hidden');
  app.classList.remove('hidden');
  messageInput.focus();
}
joinBtn.addEventListener('click', join);
joinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });

// ---------- Rendering helpers ----------
function initials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage({ username, content, avatarColor, createdAt }) {
  const row = document.createElement('div');
  row.className = 'message-row' + (username === myName ? ' own' : '');

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.style.background = avatarColor || '#4ade80';
  avatar.textContent = initials(username);

  const body = document.createElement('div');
  body.className = 'message-body';

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.innerHTML = `<span class="message-name">${escapeHtml(username)}</span><span>${formatTime(createdAt)}</span>`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;

  body.appendChild(meta);
  body.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(body);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendSystemNote(text) {
  const row = document.createElement('div');
  row.className = 'message-row system';
  row.textContent = text;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Socket events ----------
socket.on('user:welcome', ({ username, onlineCount }) => {
  welcomeName.textContent = username;
  userCount.textContent = onlineCount;
});

socket.on('chat:history', (history) => {
  history.forEach(appendMessage);
});

socket.on('chat:message', (msg) => {
  appendMessage(msg);
});

socket.on('user:joined', ({ username }) => {
  appendSystemNote(`${username} joined the chat`);
});

socket.on('user:left', ({ username }) => {
  appendSystemNote(`${username} left the chat`);
});

socket.on('users:update', (users) => {
  userCount.textContent = users.length;
  usersList.innerHTML = '';
  users.forEach((u) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="status-dot"></span>${escapeHtml(u.username)}`;
    usersList.appendChild(li);
  });
});

socket.on('typing:update', ({ username, typing }) => {
  typingIndicator.textContent = typing ? `${username} typing...` : '';
});

// ---------- Sending messages + typing indicator ----------
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit('chat:message', text);
  messageInput.value = '';
  socket.emit('typing:stop');
});

messageInput.addEventListener('input', () => {
  socket.emit('typing:start');
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('typing:stop'), 1200);
});
