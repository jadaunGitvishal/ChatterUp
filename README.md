# ChatterUp

A real-time, multi-user chat application built with **Express.js**, **Socket.io**, and **MongoDB**. Users join with a name, chat live with typing indicators and online-user presence, and message history is persisted to the database.

![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Architecture Overview](#architecture-overview)
- [Socket.io Events Reference](#socketio-events-reference)
- [Deployment](#deployment)
- [Production Checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

- 🔐 Simple name-based onboarding with a personalized welcome message
- 💬 Real-time messaging via WebSockets (Socket.io)
- 🗄️ Persistent chat history stored in MongoDB (with in-memory fallback for local dev)
- 👀 Live "connected users" panel with online-status indicators
- ⌨️ Real-time typing indicators
- 🔔 Join/leave notifications broadcast to all connected users
- 🎨 Consistent, color-coded avatars per user
- 📱 Responsive layout — desktop side panel, mobile stacked view

## Tech Stack

| Layer     | Technology            |
| --------- | --------------------- |
| Server    | Node.js, Express.js   |
| Real-time | Socket.io             |
| Database  | MongoDB via Mongoose  |
| Frontend  | HTML, CSS, vanilla JS |
| Config    | dotenv                |

## Project Structure

```
chatterup/
├── config/
│   └── db.config.js       # MongoDB connection logic + in-memory fallback
├── models/
│   └── Message.js         # Mongoose schema for chat messages
├── public/                 # Static front-end served by Express
│   ├── index.html
│   ├── css/style.css
│   └── js/script.js
├── server.js               # App entry point: Express + Socket.io wiring
├── package.json
├── .env.example             # Template for required environment variables
└── README.md
```

## Prerequisites

- **Node.js** v18 or later ([download](https://nodejs.org/))
- **npm** v9 or later (bundled with Node.js)
- A **MongoDB** instance — either:
  - A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (recommended for production), or
  - A local MongoDB server (`mongodb://localhost:27017/chatterup`)
  - _(Optional for local testing — see [Environment Variables](#environment-variables))_

## Getting Started

```bash
# 1. Clone or unzip the project
cd chatterup

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# then edit .env and add your MongoDB connection string

# 4. Start the app
npm start
```

Visit **http://localhost:3000** in your browser. Open it in multiple tabs/browsers to simulate multiple users.

## Environment Variables

Set these in a `.env` file at the project root (never commit this file):

| Variable      | Required | Default | Description                                                                                                                                 |
| ------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI` | No\*     | —       | MongoDB connection string. If omitted, the app falls back to in-memory storage (data is lost on restart) — **not suitable for production**. |
| `PORT`        | No       | `3000`  | Port the HTTP/WebSocket server listens on.                                                                                                  |

\* Required for any real deployment. The in-memory fallback exists only to make local development frictionless.

## Available Scripts

| Command       | Description                                                                           |
| ------------- | ------------------------------------------------------------------------------------- |
| `npm start`   | Runs the server with `node` (production)                                              |
| `npm run dev` | Runs the server with `nodemon` (auto-restarts on file changes, for local development) |

## Architecture Overview

- **HTTP layer**: Express has a single responsibility — serve the static front-end and the `/` route. There is no REST API; all application logic flows over WebSockets.
- **Real-time layer**: Socket.io manages connection lifecycle, user presence (`onlineUsers` map in memory per server instance), typing state, and message broadcast.
- **Persistence layer**: `config/db.config.js` owns the MongoDB connection and exposes `connectDB()` / `isConnected()`. `server.js` calls into it but contains no Mongoose connection logic itself, keeping concerns separated.
- **Data flow for a message**: client emits `chat:message` → server validates + saves via Mongoose → server re-broadcasts to all connected clients via `io.emit`.

## Socket.io Events Reference

**Client → Server**

| Event          | Payload            | Description                           |
| -------------- | ------------------ | ------------------------------------- |
| `user:join`    | `username: string` | Registers the user and joins the chat |
| `chat:message` | `content: string`  | Sends a chat message                  |
| `typing:start` | —                  | User started typing                   |
| `typing:stop`  | —                  | User stopped typing                   |

**Server → Client**

| Event           | Payload                                         | Description                               |
| --------------- | ----------------------------------------------- | ----------------------------------------- |
| `user:welcome`  | `{ username, onlineCount }`                     | Sent to the joining user only             |
| `chat:history`  | `Message[]`                                     | Sent to the joining user only             |
| `chat:message`  | `{ username, content, avatarColor, createdAt }` | Broadcast to all users                    |
| `user:joined`   | `{ username }`                                  | Broadcast when someone joins              |
| `user:left`     | `{ username }`                                  | Broadcast when someone disconnects        |
| `users:update`  | `{ username, avatarColor }[]`                   | Full online-user list, sent on any change |
| `typing:update` | `{ username, typing: boolean }`                 | Broadcast typing state changes            |

## Deployment

ChatterUp is a standard Node.js + WebSocket app and can be deployed to any Node-compatible host.

### General steps (any provider)

1. Provision a MongoDB Atlas cluster (or equivalent) and get the connection string.
2. Set `MONGODB_URI` (and optionally `PORT`) as environment variables on your hosting platform — do not upload a `.env` file.
3. Ensure the platform supports **WebSockets** (Socket.io requires persistent connections, not just short-lived HTTP requests).
4. Set the start command to `npm start`.

### Notes for specific platforms

- **Render / Railway / Fly.io**: WebSockets supported out of the box; set env vars in the dashboard.
- **Heroku**: supported; make sure your dyno type allows WebSocket connections (standard dynos do).
- **Vercel / Netlify (serverless)**: ⚠️ not recommended as-is — these platforms don't support long-lived WebSocket connections natively. Use a container/VM-based host instead, or adapt Socket.io to a serverless-compatible transport.
- **Docker**: a minimal `Dockerfile` would look like:

  ```dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --omit=dev
  COPY . .
  ENV PORT=3000
  EXPOSE 3000
  CMD ["node", "server.js"]
  ```

- If running behind a reverse proxy (Nginx, etc.), make sure it's configured to pass through `Upgrade` and `Connection` headers for WebSocket support.

## Production Checklist

Before going live, consider addressing the following (not implemented in the base version):

- [ ] **Input sanitization**: escape/sanitize message content server-side beyond length limits to prevent stored XSS if messages are ever rendered as HTML elsewhere.
- [ ] **Rate limiting**: throttle `chat:message` and `typing:*` events per socket to prevent spam/abuse.
- [ ] **Authentication**: current onboarding is name-only with no verification; add real auth (sessions/JWT) if identity matters.
- [ ] **Horizontal scaling**: if running multiple server instances, add the [Socket.io Redis adapter](https://socket.io/docs/v4/redis-adapter/) so events broadcast across instances.
- [ ] **HTTPS/WSS**: terminate TLS at your load balancer/proxy in production.
- [ ] **Logging & monitoring**: replace `console.log`/`console.error` with a structured logger (e.g. `pino`, `winston`) and add error tracking (e.g. Sentry).
- [ ] **Process management**: run under a process manager (e.g. `pm2`) or your platform's process supervisor for auto-restarts.
- [ ] **Database indexes**: add an index on `createdAt` in the `Message` collection for faster history queries at scale.
- [ ] **CORS**: if the frontend is ever served from a different origin than the API, configure CORS explicitly on both Express and Socket.io.

## Troubleshooting

| Issue                                | Likely Cause                                                  | Fix                                                       |
| ------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------- |
| Page loads but chat doesn't connect  | WebSocket blocked by proxy/firewall                           | Ensure `Upgrade`/`Connection` headers are passed through  |
| Messages don't persist after restart | No `MONGODB_URI` set                                          | Add a valid connection string to `.env`                   |
| `MongoDB connection failed` in logs  | Invalid URI, IP not whitelisted (Atlas), or wrong credentials | Check Atlas Network Access settings and connection string |
| Port already in use                  | Another process on port 3000                                  | Set `PORT` to a different value in `.env`                 |

## Security Notes

- The `.env` file is excluded from version control by convention — ensure your `.gitignore` includes it before pushing to a repository.
- Never commit real MongoDB credentials; use environment variables in your hosting provider's dashboard for production secrets.
- This app has no authentication layer by default — anyone with the URL can join with any name. Add auth if you need verified identities.

## Roadmap

- Persistent user accounts / authentication
- Message editing and deletion
- File/image sharing in chat
- Multiple chat rooms/channels

## License

MIT — free to use, modify, and distribute.
