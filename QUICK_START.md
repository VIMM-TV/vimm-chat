# Quick Start Guide - Chat API

## For Developers Integrating Chat

### 1. Prerequisites
- JWT token from vimm-core authentication
- Chat API base URL (default: `http://localhost:3001`)

### 2. Install Dependencies
```bash
npm install socket.io-client
```

### 3. Basic Integration (JavaScript)

```javascript
import io from 'socket.io-client';

// Configuration
const CHAT_API_BASE = 'http://localhost:3001';
const HIVE_ACCOUNT = 'streamer';
const AUTH_TOKEN = 'your-jwt-token-from-vimm-core';

// Connect to Socket.IO
const socket = io(CHAT_API_BASE);
const room = `chat-${HIVE_ACCOUNT}`;

socket.on('connect', () => {
  console.log('Connected to chat');
  socket.emit('join-room', room);
});

// Listen for messages
socket.on('chat-message', (data) => {
  console.log(`${data.username}: ${data.message}`);
});

// Load chat history
async function loadHistory() {
  const response = await fetch(
    `${CHAT_API_BASE}/api/chat/messages/${HIVE_ACCOUNT}?limit=50`
  );
  const messages = await response.json();
  return messages;
}

// Send a message
async function sendMessage(message) {
  const response = await fetch(
    `${CHAT_API_BASE}/api/chat/messages/${HIVE_ACCOUNT}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to send message');
  }
  
  const result = await response.json();
  
  // Broadcast via Socket.IO
  socket.emit('chat-message', {
    room,
    username: result.data.username,
    message: result.data.message,
    hiveAccount: HIVE_ACCOUNT
  });
  
  return result;
}

// Initialize
await loadHistory();
```

### 4. React Component Example

```jsx
import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

function Chat({ hiveAccount, authToken }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef();
  
  useEffect(() => {
    // Load history
    fetch(`http://localhost:3001/api/chat/messages/${hiveAccount}`)
      .then(r => r.json())
      .then(setMessages);
    
    // Connect socket
    socketRef.current = io('http://localhost:3001');
    socketRef.current.emit('join-room', `chat-${hiveAccount}`);
    socketRef.current.on('chat-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    
    return () => socketRef.current.disconnect();
  }, [hiveAccount]);
  
  const send = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const res = await fetch(
      `http://localhost:3001/api/chat/messages/${hiveAccount}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: input })
      }
    );
    
    const result = await res.json();
    socketRef.current.emit('chat-message', {
      room: `chat-${hiveAccount}`,
      username: result.data.username,
      message: result.data.message,
      hiveAccount
    });
    
    setInput('');
  };
  
  return (
    <div>
      <div style={{ height: 400, overflow: 'auto' }}>
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.username}:</strong> {m.message}
          </div>
        ))}
      </div>
      <form onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### 5. Moderator Actions

```javascript
// Ban a user (permanent)
async function banUser(username, reason) {
  const response = await fetch(
    `${CHAT_API_BASE}/api/chat/ban/${HIVE_ACCOUNT}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        reason,
        duration: null  // null = permanent
      })
    }
  );
  return await response.json();
}

// Timeout a user (600 seconds)
async function timeoutUser(username, reason) {
  const response = await fetch(
    `${CHAT_API_BASE}/api/chat/timeout/${HIVE_ACCOUNT}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        duration: 600,
        reason
      })
    }
  );
  return await response.json();
}

// Delete a message
async function deleteMessage(messageId) {
  const response = await fetch(
    `${CHAT_API_BASE}/api/chat/messages/${HIVE_ACCOUNT}/${messageId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    }
  );
  return await response.json();
}

// Clear all chat
async function clearChat() {
  const response = await fetch(
    `${CHAT_API_BASE}/api/chat/clear/${HIVE_ACCOUNT}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    }
  );
  return await response.json();
}
```

### 6. Channel Owner Actions

```javascript
// Update chat configuration
async function updateConfig(config) {
  const response = await fetch(
    `${CHAT_API_BASE}/api/chat/config/${HIVE_ACCOUNT}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    }
  );
  return await response.json();
}

// Example: Enable slow mode
await updateConfig({
  slowMode: true,
  slowModeInterval: 5  // 5 seconds between messages
});

// Add a moderator
async function addModerator(username) {
  const response = await fetch(
    `${CHAT_API_BASE}/api/chat/moderators/${HIVE_ACCOUNT}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    }
  );
  return await response.json();
}
```

### 7. Environment Setup

Create `.env` file:
```env
# Must match vimm-core JWT_SECRET
JWT_SECRET=your-secret-key

# Chat server port
PORT=3001

# Database (use sqlite for development)
DB_DIALECT=sqlite
SQLITE_PATH=./vimm-chat.sqlite

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

### 8. Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Missing/invalid JWT token | Get new token from vimm-core |
| 403 Forbidden | Insufficient permissions | User must be moderator/owner |
| 404 Not Found | Resource doesn't exist | Check IDs and usernames |
| 409 Conflict | Resource already exists | User already banned/moderator |

### 9. Testing Checklist

- [ ] Can connect to Socket.IO
- [ ] Can join room successfully
- [ ] Receives real-time messages
- [ ] Can load chat history
- [ ] Can send messages (with auth)
- [ ] Can delete messages (as moderator)
- [ ] Can ban/timeout users (as moderator)
- [ ] Can update config (as owner)
- [ ] Handles disconnections gracefully
- [ ] Handles authentication errors

## Full Documentation

See `CHAT_INTEGRATION_SPEC.md` for complete API reference with all endpoints, parameters, and response formats.

## Support

- **API Issues**: Check `CHAT_INTEGRATION_SPEC.md`
- **Authentication Issues**: Check `AUTH_INTEGRATION_SPEC.md`
- **GitHub Issues**: https://github.com/VIMM-TV/vimm-chat/issues
