const express = require('express');
const https = require('https'); // Changed from http to https
const fs = require('fs'); // Add fs to read certificate files
const path = require('path');
const cors = require('cors');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { initializeDb } = require('./db/models');
const { chatMessages, authenticatedUsers, getMessagesForAccount } = require('./storage');

// Initialize Express app
const app = express();

// HTTPS Server configuration
const httpsOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || path.join(__dirname, '../../myserver.key')),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || path.join(__dirname, '../../vimm_webhop_me.pem')),
  // Optional: if you have a certificate chain
  // ca: fs.readFileSync(process.env.SSL_CA_PATH || path.join(__dirname, '../certs/ca-bundle.pem'))
};

const server = https.createServer(httpsOptions, app); // Use https.createServer with options

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

// JWT Secret (should match the one in chat routes)
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Socket.io handling for real-time chat
io.on('connection', socket => {
  console.log('New client connected');
  
  let userToken = null;
  let userData = null;
  
  // Join a specific chat room based on the channel
  socket.on('join-room', (data) => {
    const { room, token } = data;
    
    // Verify token if provided
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const authData = authenticatedUsers.get(token);
        
        if (authData) {
          userToken = token;
          userData = authData;
          socket.join(room);
          console.log(`Authenticated user ${userData.username} joined room: ${room}`);
        } else {
          console.log('Invalid token for room join');
          socket.emit('auth-error', { error: 'Invalid token' });
          return;
        }
      } catch (error) {
        console.log('Token verification failed for room join:', error.message);
        socket.emit('auth-error', { error: 'Invalid token' });
        return;
      }
    } else {
      socket.join(room);
      console.log(`Client joined room: ${room}`);
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
      const authData = authenticatedUsers.get(token);
      
      if (!authData) {
        socket.emit('error', { error: 'Invalid token' });
        return;
      }
      
      // Extract hiveAccount from room name (format: chat-{hiveAccount})
      const hiveAccount = room.replace('chat-', '');
      
      // Create new message object
      const newMessage = {
        id: Date.now().toString(),
        username: authData.username,
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
        username: authData.username,
        message: message.trim(),
        timestamp: new Date(),
        hiveAccount
      });
      
      console.log(`Message from ${authData.username} in ${hiveAccount}: ${message}`);
      
    } catch (error) {
      console.log('Authentication failed for message:', error.message);
      socket.emit('error', { error: 'Authentication failed' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Initialize Database
initializeDb().then(() => {
  console.log('Database connected');
  
  // Start HTTPS server
  const port = process.env.HTTPS_PORT || 443;
  server.listen(port, () => {
    console.log(`HTTPS Server running on port ${port}`);
    console.log(`WSS enabled for Socket.IO connections`);
  });
}).catch(err => {
  console.error('Database connection failed:', err);
});

module.exports = { app, server, io };