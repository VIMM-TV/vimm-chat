const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { initializeDb } = require('./db/models');
const { chatMessages, authenticatedUsers, getMessagesForAccount } = require('./storage');

// Import models to ensure they're registered
const ChatMessage = require('./db/models/chatMessage');
const ChatConfig = require('./db/models/chatConfig');
const BannedUser = require('./db/models/bannedUser');

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

// Pass Socket.IO instance to chat routes after initialization
chatRoutes.setSocketIO(io);
console.log('Socket.IO instance passed to chat routes');


// Frontend Routes
app.get('/chat/:hiveAccount', (req, res) => {
  const { hiveAccount } = req.params;
  res.render('chat', { hiveAccount });
});

// JWT Secret (should match the one in chat routes)
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Socket.io handling for real-time chat
io.on('connection', socket => {
  console.log('New client connected');
  
  let userToken = null;
  let userData = null;
  
  // Join a specific chat room based on the channel
  socket.on('join-room', (data) => {
    console.log('=== JOIN-ROOM EVENT RECEIVED ===');
    console.log('Raw data:', data);
    console.log('Data type:', typeof data);
    console.log('Is object:', typeof data === 'object');
    console.log('Has room:', 'room' in data);
    console.log('Has token:', 'token' in data);
    
    const { room, token } = data;
    
    console.log('Room value:', room);
    console.log('Token exists:', !!token);
    if (token) {
      console.log('Token preview:', token.substring(0, 20) + '...');
    }
    
    if (!room) {
      console.error('No room specified in join-room event!');
      socket.emit('error', { error: 'Room name is required' });
      return;
    }
    
    // Verify token if provided
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userToken = token;
        userData = decoded; // Store the decoded JWT data directly
        socket.join(room);
        console.log(`✅ Authenticated user ${decoded.hiveAccount} joined room: ${room}`);
        console.log(`📊 Room ${room} now has ${io.sockets.adapter.rooms.get(room)?.size || 0} clients`);
        
        // Send success confirmation to client
        socket.emit('room-joined', { 
          room, 
          authenticated: true,
          username: decoded.hiveAccount 
        });
      } catch (error) {
        console.log('Token verification failed for room join:', error.message);
        console.log('Error name:', error.name);
        socket.emit('auth-error', { 
          error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
          message: error.message 
        });
        return;
      }
    } else {
      socket.join(room);
      console.log(`✅ Client joined room: ${room} (no auth)`);
      console.log(`📊 Room ${room} now has ${io.sockets.adapter.rooms.get(room)?.size || 0} clients`);
      
      // Send success confirmation to client (unauthenticated)
      socket.emit('room-joined', { 
        room, 
        authenticated: false 
      });
    }
  });
  
  // Handle chat messages
  socket.on('chat-message', (data) => {
    const { room, message, token } = data;
    
    // Verify authentication
    if (!token) {
      socket.emit('error', { error: 'Authentication required' });
      return;
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Extract hiveAccount from room name (format: chat-{hiveAccount})
      const hiveAccount = room.replace('chat-', '');
      
      // Create new message object
      const newMessage = {
        id: Date.now().toString(),
        username: decoded.hiveAccount,
        message: message.trim(),
        timestamp: new Date().toISOString(),
        hiveAccount,
        verified: true
      };
      
      // Store message in memory
      const messages = getMessagesForAccount(hiveAccount);
      messages.push(newMessage);
      
      // Keep only last 100 messages
      if (messages.length > 100) {
        messages.splice(0, messages.length - 100);
      }
      
      // Broadcast to all in the room
      io.to(room).emit('chat-message', {
        username: decoded.hiveAccount,
        message: message.trim(),
        timestamp: new Date(),
        hiveAccount
      });
      
      console.log(`Message from ${decoded.hiveAccount} in ${hiveAccount}: ${message}`);
      
    } catch (error) {
      console.log('Authentication failed for message:', error.message);
      socket.emit('error', { 
        error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Authentication failed',
        message: error.message 
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Initialize Database
initializeDb().then(() => {
  console.log('Database connected');
  
  // Start HTTP server
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`HTTP Server running on port ${port}`);
    console.log(`WebSocket enabled for Socket.IO connections`);
  });
}).catch(err => {
  console.error('Database connection failed:', err);
});

module.exports = { app, server, io };