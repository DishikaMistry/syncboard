require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const boardsRouter = require('./routes/boards');
const { router: authRouter } = require('./routes/auth');
const commentsRouter = require('./routes/comments');
const teamsRouter = require('./routes/teams');
const { registerBoardHandlers } = require('./sockets/boardHandlers');

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use('/auth', authRouter);
app.use('/boards', boardsRouter);
app.use('/teams', teamsRouter);
app.use('/', commentsRouter);
app.get('/health', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
  registerBoardHandlers(io, socket);
  socket.on('disconnect', () => console.log('client disconnected', socket.id));
});

server.listen(PORT, () => {
  console.log(`SyncBoard server listening on port ${PORT}`);
});
