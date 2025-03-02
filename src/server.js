const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const socketIo = require('socket.io');
const { initializeDb } = require('./db/models');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// API Routes
const chatRoutes = require('./api/routes/chat');
app.use('/api/chat', chatRoutes);

// Frontend Routes
app.get('/chat/:hiveAccount', (req, res) => {
  const { hiveAccount } = req.params;
  res.render('chat', { hiveAccount });
});

// Socket.io handling for real-time chat
io.on('connection', socket => {
  console.log('New client connected');
  
  // Join a specific chat room based on the channel
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Client joined room: ${room}`);
  });
  
  // Handle chat messages
  socket.on('chat-message', (data) => {
    // Broadcast to all in the room
    io.to(data.room).emit('chat-message', {
      username: data.username,
      message: data.message,
      timestamp: new Date(),
      hiveAccount: data.hiveAccount
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Initialize Database
initializeDb().then(() => {
  console.log('Database connected');
}).catch(err => {
  console.error('Database connection failed:', err);
});

module.exports = { app, server, io };