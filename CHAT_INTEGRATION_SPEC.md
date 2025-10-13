# Chat Integration Specification
## vimm-chat API - External Component Integration Guide

**Purpose**: Reference document for implementing chat functionality in external components of the VIMM framework.
**Target Use**: AI-assisted implementation in separate repositories that need chat features.
**Note**: Source files referenced below DO NOT exist in consuming repositories - this spec provides all necessary implementation details.

---

## System Overview

Chat system supporting real-time messaging via Socket.IO and REST API for management operations.

**Architecture**: REST API + WebSocket (Socket.IO) for real-time communication

**Core Dependencies Required in External Repos**:
```json
{
  "socket.io-client": "^4.7.3",
  "jsonwebtoken": "^9.0.2"
}
```

**Authentication**: Uses JWT tokens from vimm-core authentication system (see AUTH_INTEGRATION_SPEC.md)

---

## API Base URL Pattern

Chat API endpoints: `{CHAT_API_BASE}/api/chat/*`
WebSocket connection: `{CHAT_API_BASE}` (Socket.IO endpoint)

Default: `http://localhost:3001` or production URL as configured.

---

## Authentication Requirements

### Authenticated Endpoints
Require JWT token from vimm-core authentication in `Authorization` header:
- POST `/api/chat/messages/:hiveAccount` - Send message
- DELETE `/api/chat/messages/:hiveAccount/:messageId` - Delete message
- PUT `/api/chat/config/:hiveAccount` - Update chat config
- POST `/api/chat/moderators/:hiveAccount` - Add moderator
- DELETE `/api/chat/moderators/:hiveAccount/:username` - Remove moderator
- POST `/api/chat/ban/:hiveAccount` - Ban user
- DELETE `/api/chat/ban/:hiveAccount/:username` - Unban user
- GET `/api/chat/bans/:hiveAccount` - List banned users
- POST `/api/chat/timeout/:hiveAccount` - Timeout user
- POST `/api/chat/clear/:hiveAccount` - Clear chat

### Public Endpoints
No authentication required:
- GET `/api/chat/messages/:hiveAccount` - Get messages
- GET `/api/chat/config/:hiveAccount` - Get chat config

**Header Format for Authenticated Requests**:
```
Authorization: Bearer {jwt-token-from-vimm-core}
Content-Type: application/json
```

---

## REST API Endpoints

### 1. Get Chat Messages

**Endpoint**: `GET /api/chat/messages/:hiveAccount`

**Authentication**: Optional (public endpoint)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username

**Query Parameters**:
- `limit` (number, optional) - Number of messages to return (default: 50, max: 100)
- `before` (ISO timestamp, optional) - Get messages before this timestamp
- `after` (ISO timestamp, optional) - Get messages after this timestamp

**Response** (200):
```json
[
  {
    "id": "uuid",
    "username": "chatuser",
    "message": "Hello world!",
    "timestamp": "2023-01-01T12:00:00.000Z",
    "isModerator": false,
    "createdAt": "2023-01-01T12:00:00.000Z"
  }
]
```

**Example Usage**:
```javascript
async function getChatMessages(chatApiBase, hiveAccount, limit = 50) {
  const response = await fetch(
    `${chatApiBase}/api/chat/messages/${hiveAccount}?limit=${limit}`
  );
  return await response.json();
}
```

---

### 2. Send Chat Message

**Endpoint**: `POST /api/chat/messages/:hiveAccount`

**Authentication**: Required

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username

**Request Body**:
```json
{
  "message": "Your chat message here"
}
```

**Validation**:
- Message cannot be empty or whitespace only
- Maximum length: 500 characters
- User must not be banned from the channel

**Success Response** (201):
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "id": "uuid",
    "username": "sender-username",
    "message": "Your chat message here",
    "timestamp": "2023-01-01T12:00:00.000Z",
    "isModerator": false
  }
}
```

**Error Responses**:
- 400: Empty message or exceeds 500 characters
- 401: Not authenticated
- 403: User is banned from chat
- 500: Server error

**Example Usage**:
```javascript
async function sendChatMessage(chatApiBase, hiveAccount, message, authToken) {
  const response = await fetch(
    `${chatApiBase}/api/chat/messages/${hiveAccount}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
}
```

---

### 3. Delete Chat Message

**Endpoint**: `DELETE /api/chat/messages/:hiveAccount/:messageId`

**Authentication**: Required (Moderator only)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username
- `messageId` (uuid) - The ID of the message to delete

**Authorization**: User must be a moderator or channel owner

**Success Response** (200):
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not a moderator
- 404: Message not found
- 500: Server error

**Example Usage**:
```javascript
async function deleteMessage(chatApiBase, hiveAccount, messageId, authToken) {
  const response = await fetch(
    `${chatApiBase}/api/chat/messages/${hiveAccount}/${messageId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
}
```

---

### 4. Get Chat Configuration

**Endpoint**: `GET /api/chat/config/:hiveAccount`

**Authentication**: Not required (public endpoint)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username

**Response** (200):
```json
{
  "hiveAccount": "streamer",
  "slowMode": false,
  "slowModeInterval": 3,
  "emoteOnly": false,
  "subscribersOnly": false,
  "followersOnly": false,
  "followersOnlyDuration": 0,
  "moderators": ["mod1", "mod2"]
}
```

**Field Descriptions**:
- `slowMode` (boolean) - Limit message frequency
- `slowModeInterval` (number) - Seconds between messages when slow mode active
- `emoteOnly` (boolean) - Only allow emotes in chat
- `subscribersOnly` (boolean) - Only subscribers can chat
- `followersOnly` (boolean) - Only followers can chat
- `followersOnlyDuration` (number) - Minimum follow duration in minutes (0 = any follower)
- `moderators` (array) - List of moderator usernames

**Example Usage**:
```javascript
async function getChatConfig(chatApiBase, hiveAccount) {
  const response = await fetch(
    `${chatApiBase}/api/chat/config/${hiveAccount}`
  );
  return await response.json();
}
```

---

### 5. Update Chat Configuration

**Endpoint**: `PUT /api/chat/config/:hiveAccount`

**Authentication**: Required (Channel owner only)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username

**Authorization**: User must be the channel owner

**Request Body** (all fields optional):
```json
{
  "slowMode": true,
  "slowModeInterval": 5,
  "emoteOnly": false,
  "subscribersOnly": false,
  "followersOnly": true,
  "followersOnlyDuration": 10,
  "moderators": ["mod1", "mod2", "mod3"]
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Chat configuration updated successfully",
  "config": {
    "hiveAccount": "streamer",
    "slowMode": true,
    "slowModeInterval": 5,
    "emoteOnly": false,
    "subscribersOnly": false,
    "followersOnly": true,
    "followersOnlyDuration": 10,
    "moderators": ["mod1", "mod2", "mod3"]
  }
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not the channel owner
- 500: Server error

**Example Usage**:
```javascript
async function updateChatConfig(chatApiBase, hiveAccount, config, authToken) {
  const response = await fetch(
    `${chatApiBase}/api/chat/config/${hiveAccount}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
}
```

---

### 6. Add Moderator

**Endpoint**: `POST /api/chat/moderators/:hiveAccount`

**Authentication**: Required (Channel owner only)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username

**Request Body**:
```json
{
  "username": "newmoderator"
}
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "newmoderator added as moderator",
  "moderators": ["mod1", "mod2", "newmoderator"]
}
```

**Error Responses**:
- 400: Username not provided
- 401: Not authenticated
- 403: Not the channel owner
- 409: User is already a moderator
- 500: Server error

---

### 7. Remove Moderator

**Endpoint**: `DELETE /api/chat/moderators/:hiveAccount/:username`

**Authentication**: Required (Channel owner only)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username
- `username` (string) - The moderator username to remove

**Success Response** (200):
```json
{
  "success": true,
  "message": "username removed as moderator",
  "moderators": ["mod1", "mod2"]
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not the channel owner
- 404: Moderator not found
- 500: Server error

---

### 8. Ban User

**Endpoint**: `POST /api/chat/ban/:hiveAccount`

**Authentication**: Required (Moderator only)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username

**Request Body**:
```json
{
  "username": "usertban",
  "reason": "Spam", 
  "duration": null
}
```

**Field Descriptions**:
- `username` (string, required) - Username to ban
- `reason` (string, optional) - Reason for ban
- `duration` (number, optional) - Ban duration in seconds (null = permanent)

**Authorization Rules**:
- Moderators can ban regular users
- Only channel owner can ban other moderators
- Cannot ban the channel owner

**Success Response** (201):
```json
{
  "success": true,
  "message": "usertban has been banned",
  "ban": {
    "id": "uuid",
    "bannedUsername": "usertban",
    "bannedBy": "moderator",
    "reason": "Spam",
    "expiresAt": null,
    "isPermanent": true
  }
}
```

**Error Responses**:
- 400: Username not provided or trying to ban channel owner
- 401: Not authenticated
- 403: Not a moderator, or trying to ban another moderator
- 409: User is already banned
- 500: Server error

**Example Usage**:
```javascript
async function banUser(chatApiBase, hiveAccount, username, reason, duration, authToken) {
  const response = await fetch(
    `${chatApiBase}/api/chat/ban/${hiveAccount}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, reason, duration })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
}
```

---

### 9. Unban User

**Endpoint**: `DELETE /api/chat/ban/:hiveAccount/:username`

**Authentication**: Required (Moderator only)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username
- `username` (string) - The username to unban

**Success Response** (200):
```json
{
  "success": true,
  "message": "username has been unbanned"
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not a moderator
- 404: User is not banned
- 500: Server error

---

### 10. Get Banned Users

**Endpoint**: `GET /api/chat/bans/:hiveAccount`

**Authentication**: Required (Moderator only)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username

**Success Response** (200):
```json
{
  "success": true,
  "bans": [
    {
      "id": "uuid",
      "bannedUsername": "user1",
      "bannedBy": "moderator",
      "reason": "Spam",
      "expiresAt": null,
      "isPermanent": true,
      "createdAt": "2023-01-01T12:00:00.000Z"
    },
    {
      "id": "uuid",
      "bannedUsername": "user2",
      "bannedBy": "moderator",
      "reason": "Inappropriate behavior",
      "expiresAt": "2023-01-02T12:00:00.000Z",
      "isPermanent": false,
      "createdAt": "2023-01-01T12:00:00.000Z"
    }
  ]
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not a moderator
- 500: Server error

---

### 11. Timeout User

**Endpoint**: `POST /api/chat/timeout/:hiveAccount`

**Authentication**: Required (Moderator only)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username

**Request Body**:
```json
{
  "username": "usertotimeout",
  "duration": 600,
  "reason": "Calm down"
}
```

**Field Descriptions**:
- `username` (string, required) - Username to timeout
- `duration` (number, optional) - Timeout duration in seconds (default: 600)
- `reason` (string, optional) - Reason for timeout

**Note**: Timeout is a temporary ban. Same authorization rules as ban apply.

**Success Response** (201):
```json
{
  "success": true,
  "message": "username has been timed out for 600 seconds",
  "timeout": {
    "id": "uuid",
    "username": "usertotimeout",
    "duration": 600,
    "expiresAt": "2023-01-01T12:10:00.000Z",
    "reason": "Calm down"
  }
}
```

**Error Responses**:
- 400: Username not provided or trying to timeout channel owner
- 401: Not authenticated
- 403: Not a moderator, or trying to timeout another moderator
- 409: User is already banned or timed out
- 500: Server error

---

### 12. Clear Chat

**Endpoint**: `POST /api/chat/clear/:hiveAccount`

**Authentication**: Required (Moderator only)

**Path Parameters**:
- `hiveAccount` (string) - The channel owner's Hive username

**Description**: Marks all messages as deleted (soft delete)

**Success Response** (200):
```json
{
  "success": true,
  "message": "Chat has been cleared"
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Not a moderator
- 500: Server error

---

## WebSocket (Socket.IO) Integration

### Connection Setup

**Connection URL**: Same as base URL (Socket.IO auto-detects)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling']
});
```

**CORS**: Socket.IO server has CORS enabled for configured origins

---

### Socket.IO Events

#### Client → Server Events

##### 1. Join Room
**Event**: `join-room`

**Payload**:
```javascript
socket.emit('join-room', 'chat-streamer');
```

**Format**: `chat-{hiveAccount}`

**Description**: Join a specific channel's chat room to receive messages

---

##### 2. Send Message (via Socket)
**Event**: `chat-message`

**Payload**:
```javascript
socket.emit('chat-message', {
  room: 'chat-streamer',
  username: 'myusername',
  message: 'Hello everyone!',
  hiveAccount: 'streamer'
});
```

**Note**: This broadcasts the message in real-time. For persistence, also use REST API POST endpoint.

---

#### Server → Client Events

##### 1. Receive Message
**Event**: `chat-message`

**Payload**:
```javascript
socket.on('chat-message', (data) => {
  console.log(data);
  // {
  //   username: 'sender',
  //   message: 'Hello!',
  //   timestamp: '2023-01-01T12:00:00.000Z',
  //   hiveAccount: 'streamer'
  // }
});
```

**Description**: Receive real-time chat messages from other users in the room

---

### Complete Socket.IO Integration Example

```javascript
import io from 'socket.io-client';

class ChatClient {
  constructor(chatApiBase, hiveAccount) {
    this.chatApiBase = chatApiBase;
    this.hiveAccount = hiveAccount;
    this.room = `chat-${hiveAccount}`;
    this.socket = null;
    this.messageHandlers = [];
  }

  connect() {
    this.socket = io(this.chatApiBase, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Connected to chat server');
      this.socket.emit('join-room', this.room);
    });

    this.socket.on('chat-message', (data) => {
      this.messageHandlers.forEach(handler => handler(data));
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  sendMessage(username, message) {
    if (!this.socket) {
      throw new Error('Not connected to chat server');
    }

    this.socket.emit('chat-message', {
      room: this.room,
      username,
      message,
      hiveAccount: this.hiveAccount
    });
  }
}

// Usage
const chat = new ChatClient('http://localhost:3001', 'streamer');
chat.connect();

chat.onMessage((data) => {
  console.log(`${data.username}: ${data.message}`);
});

chat.sendMessage('myusername', 'Hello chat!');
```

---

## Complete Integration Example

### Full Chat Component

```javascript
import io from 'socket.io-client';

class VimmChatIntegration {
  constructor(chatApiBase, hiveAccount, authToken = null) {
    this.chatApiBase = chatApiBase;
    this.hiveAccount = hiveAccount;
    this.authToken = authToken;
    this.socket = null;
    this.room = `chat-${hiveAccount}`;
  }

  // Initialize connection
  async init() {
    await this.loadMessages();
    await this.loadConfig();
    this.connectSocket();
  }

  // Load chat history via REST API
  async loadMessages(limit = 50) {
    const response = await fetch(
      `${this.chatApiBase}/api/chat/messages/${this.hiveAccount}?limit=${limit}`
    );
    return await response.json();
  }

  // Load chat configuration
  async loadConfig() {
    const response = await fetch(
      `${this.chatApiBase}/api/chat/config/${this.hiveAccount}`
    );
    return await response.json();
  }

  // Connect to Socket.IO for real-time updates
  connectSocket() {
    this.socket = io(this.chatApiBase);

    this.socket.on('connect', () => {
      console.log('Connected to chat');
      this.socket.emit('join-room', this.room);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat');
    });
  }

  // Listen for messages
  onMessage(callback) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.on('chat-message', callback);
  }

  // Send message (requires auth)
  async sendMessage(message) {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    // Send via REST API for persistence
    const response = await fetch(
      `${this.chatApiBase}/api/chat/messages/${this.hiveAccount}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const result = await response.json();

    // Also broadcast via Socket.IO for real-time delivery
    this.socket.emit('chat-message', {
      room: this.room,
      username: result.data.username,
      message: result.data.message,
      hiveAccount: this.hiveAccount
    });

    return result;
  }

  // Delete message (moderator only)
  async deleteMessage(messageId) {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `${this.chatApiBase}/api/chat/messages/${this.hiveAccount}/${messageId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return await response.json();
  }

  // Ban user (moderator only)
  async banUser(username, reason = null, duration = null) {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `${this.chatApiBase}/api/chat/ban/${this.hiveAccount}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, reason, duration })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return await response.json();
  }

  // Timeout user (moderator only)
  async timeoutUser(username, duration = 600, reason = null) {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `${this.chatApiBase}/api/chat/timeout/${this.hiveAccount}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, duration, reason })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return await response.json();
  }

  // Update chat config (owner only)
  async updateConfig(config) {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `${this.chatApiBase}/api/chat/config/${this.hiveAccount}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return await response.json();
  }

  // Clear chat (moderator only)
  async clearChat() {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `${this.chatApiBase}/api/chat/clear/${this.hiveAccount}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return await response.json();
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Usage Example
const chat = new VimmChatIntegration(
  'http://localhost:3001',
  'streamer',
  'your-jwt-token-here'
);

// Initialize
await chat.init();

// Listen for messages
chat.onMessage((message) => {
  console.log(`${message.username}: ${message.message}`);
});

// Send a message
await chat.sendMessage('Hello everyone!');

// Moderator actions
await chat.timeoutUser('spammer', 600, 'Spam');
await chat.deleteMessage('message-uuid');
await chat.clearChat();

// Update config (owner only)
await chat.updateConfig({
  slowMode: true,
  slowModeInterval: 5
});
```

---

## React Component Example

```jsx
import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

function ChatComponent({ hiveAccount, authToken, chatApiBase }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [config, setConfig] = useState(null);
  const socketRef = useRef(null);
  const room = `chat-${hiveAccount}`;

  useEffect(() => {
    // Load initial messages
    loadMessages();
    loadConfig();

    // Connect to Socket.IO
    socketRef.current = io(chatApiBase);

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-room', room);
    });

    socketRef.current.on('chat-message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [hiveAccount, chatApiBase]);

  const loadMessages = async () => {
    try {
      const response = await fetch(
        `${chatApiBase}/api/chat/messages/${hiveAccount}?limit=50`
      );
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await fetch(
        `${chatApiBase}/api/chat/config/${hiveAccount}`
      );
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !authToken) return;

    try {
      const response = await fetch(
        `${chatApiBase}/api/chat/messages/${hiveAccount}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: inputMessage })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const result = await response.json();

      // Broadcast via Socket.IO
      socketRef.current.emit('chat-message', {
        room,
        username: result.data.username,
        message: result.data.message,
        hiveAccount
      });

      setInputMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error.message);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="message">
            <span className="username">{msg.username}:</span>
            <span className="message-text">{msg.message}</span>
          </div>
        ))}
      </div>
      
      {authToken ? (
        <form onSubmit={sendMessage} className="chat-input">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
          />
          <button type="submit">Send</button>
        </form>
      ) : (
        <div className="auth-required">
          Please log in to chat
        </div>
      )}
    </div>
  );
}

export default ChatComponent;
```

---

## Moderator Permissions

### Permission Levels

1. **Regular User**
   - Can send messages (if not banned)
   - Can view messages and config

2. **Moderator**
   - All regular user permissions
   - Delete messages
   - Ban/unban regular users
   - Timeout users
   - Clear chat
   - View banned users list

3. **Channel Owner**
   - All moderator permissions
   - Update chat configuration
   - Add/remove moderators
   - Ban/unban moderators
   - Cannot be banned or timed out

### Checking Permissions

Permissions are checked server-side. The JWT token contains the user's Hive account, which is used to determine:
1. If user is the channel owner (username matches `hiveAccount`)
2. If user is in the moderators list (stored in ChatConfig)

**No client-side permission checking needed** - server will return 403 Forbidden if unauthorized.

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error type",
  "message": "Human-readable error message"
}
```

### Common Error Types

- **400 Bad Request**: Invalid input, missing required fields
- **401 Unauthorized**: No auth token provided or token invalid
- **403 Forbidden**: Token valid but insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Resource already exists (e.g., already banned)
- **500 Internal Server Error**: Server-side issue

### Error Handling Pattern

```javascript
async function chatApiCall(url, options) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      switch (response.status) {
        case 401:
        case 403:
          // Re-authenticate user
          throw new Error('Authentication required');
        case 404:
          throw new Error(error.message || 'Not found');
        case 409:
          throw new Error(error.message || 'Conflict');
        default:
          throw new Error(error.message || 'Request failed');
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('Chat API error:', error);
    throw error;
  }
}
```

---

## Security Considerations

1. **Authentication**:
   - Use JWT tokens from vimm-core authentication
   - Tokens expire after 7 days
   - Always send tokens in Authorization header
   - Never expose tokens in URLs or client-side storage without encryption

2. **Message Validation**:
   - Maximum message length: 500 characters
   - Server-side validation prevents XSS
   - Messages are stored with timestamps for audit

3. **Rate Limiting**:
   - Slow mode can limit message frequency
   - Configure via chat config endpoint

4. **Moderation**:
   - Hierarchical permission system
   - Channel owner has ultimate control
   - Ban history is preserved

5. **WebSocket Security**:
   - CORS configured on server
   - Room-based isolation (users only receive messages from joined rooms)

---

## Testing Chat Integration

### Manual Test Sequence

1. **Public Endpoints** (no auth):
   ```bash
   # Get messages
   curl http://localhost:3001/api/chat/messages/streamer
   
   # Get config
   curl http://localhost:3001/api/chat/config/streamer
   ```

2. **Send Message** (requires auth):
   ```bash
   curl -X POST http://localhost:3001/api/chat/messages/streamer \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"message":"Hello chat!"}'
   ```

3. **Socket.IO Connection**:
   - Open browser console on a page with Socket.IO client
   - Connect to `http://localhost:3001`
   - Emit `join-room` with room name
   - Listen for `chat-message` events

4. **Moderator Actions** (requires mod auth):
   ```bash
   # Ban user
   curl -X POST http://localhost:3001/api/chat/ban/streamer \
     -H "Authorization: Bearer MOD_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"username":"spammer","reason":"Spam","duration":null}'
   
   # Delete message
   curl -X DELETE http://localhost:3001/api/chat/messages/streamer/MESSAGE_UUID \
     -H "Authorization: Bearer MOD_JWT_TOKEN"
   ```

---

## Environment Variables

Required in external component:

```env
VIMM_CHAT_API_BASE=http://localhost:3001
JWT_SECRET=your-jwt-secret-matching-vimm-core
```

Optional:
```env
SOCKET_IO_RECONNECTION_DELAY=1000
CHAT_MESSAGE_MAX_LENGTH=500
```

---

## Database Schema Reference

For understanding data structures (external components don't access DB directly):

### ChatMessage
```javascript
{
  id: UUID,
  hiveAccount: String,      // Channel owner
  username: String,          // Message sender
  message: Text,
  timestamp: Date,
  isDeleted: Boolean,
  isModerator: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### ChatConfig
```javascript
{
  id: UUID,
  hiveAccount: String,       // Channel owner (unique)
  slowMode: Boolean,
  slowModeInterval: Integer,
  emoteOnly: Boolean,
  subscribersOnly: Boolean,
  followersOnly: Boolean,
  followersOnlyDuration: Integer,
  moderators: JSON Array,
  createdAt: Date,
  updatedAt: Date
}
```

### BannedUser
```javascript
{
  id: UUID,
  hiveAccount: String,       // Channel owner
  bannedUsername: String,
  bannedBy: String,          // Moderator who banned
  reason: Text,
  expiresAt: Date,           // null = permanent
  isPermanent: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Implementation Checklist

When integrating in new component:

- [ ] Install dependencies: `socket.io-client`, optionally `jsonwebtoken`
- [ ] Configure chat API base URL (environment variable)
- [ ] Implement REST API wrapper functions
- [ ] Initialize Socket.IO connection
- [ ] Implement join-room functionality
- [ ] Listen for chat-message events
- [ ] Implement send message (REST + Socket.IO)
- [ ] Handle authentication (use vimm-core JWT tokens)
- [ ] Implement error handling for all API calls
- [ ] Add UI for chat messages display
- [ ] Add UI for message input (authenticated users only)
- [ ] Implement moderator controls (if applicable)
- [ ] Test real-time message delivery
- [ ] Test with and without authentication
- [ ] Test moderator permissions
- [ ] Verify CORS configuration for production
- [ ] Handle socket disconnections and reconnections

---

## API Surface Summary

### Public Endpoints (No Auth)
- `GET /api/chat/messages/:hiveAccount` - Get messages
- `GET /api/chat/config/:hiveAccount` - Get chat config

### User Endpoints (Auth Required)
- `POST /api/chat/messages/:hiveAccount` - Send message

### Moderator Endpoints (Auth + Moderator Required)
- `DELETE /api/chat/messages/:hiveAccount/:messageId` - Delete message
- `POST /api/chat/ban/:hiveAccount` - Ban user
- `DELETE /api/chat/ban/:hiveAccount/:username` - Unban user
- `GET /api/chat/bans/:hiveAccount` - List banned users
- `POST /api/chat/timeout/:hiveAccount` - Timeout user
- `POST /api/chat/clear/:hiveAccount` - Clear chat

### Owner Endpoints (Auth + Owner Required)
- `PUT /api/chat/config/:hiveAccount` - Update config
- `POST /api/chat/moderators/:hiveAccount` - Add moderator
- `DELETE /api/chat/moderators/:hiveAccount/:username` - Remove moderator

### Socket.IO Events
- **Client → Server**: `join-room`, `chat-message`
- **Server → Client**: `chat-message`, `connect`, `disconnect`

---

## Quick Reference: Request Headers

**Authenticated Request**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Public Request**:
```
Content-Type: application/json
```

---

## Integration with vimm-core

The chat system is designed to work seamlessly with vimm-core authentication:

1. **Get JWT token** from vimm-core authentication (see AUTH_INTEGRATION_SPEC.md)
2. **Pass token** to chat API in Authorization header
3. **Token payload** contains `hiveAccount` field used for permission checks
4. **Same JWT_SECRET** must be configured in both vimm-core and vimm-chat

**Example flow**:
```javascript
// 1. Authenticate with vimm-core
const auth = new VimmAuth('http://localhost:8080');
await auth.login('username');
const token = auth.token;

// 2. Use token with chat
const chat = new VimmChatIntegration(
  'http://localhost:3001',
  'streamer',
  token
);
await chat.init();
await chat.sendMessage('Hello!');
```

---

## Troubleshooting

### Socket.IO Not Connecting
- Check CORS configuration
- Verify base URL is correct
- Check browser console for connection errors
- Try both websocket and polling transports

### Messages Not Persisting
- Ensure REST API POST is called, not just Socket.IO emit
- Check database connection
- Verify authentication token is valid

### 403 Forbidden on Moderator Actions
- Verify user is added to moderators list
- Check JWT token contains correct hiveAccount
- Ensure JWT_SECRET matches between vimm-core and vimm-chat

### Real-time Messages Not Received
- Verify `join-room` was called with correct room name
- Check socket connection status
- Ensure listening for `chat-message` event

---

**End of Specification**

This document contains all necessary information to implement chat features against vimm-chat APIs without access to vimm-chat source code. All referenced patterns, endpoints, and data structures are production-ready and currently implemented in vimm-chat v0.1.0.
