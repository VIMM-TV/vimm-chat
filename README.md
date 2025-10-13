# VIMM Chat

Chat server for the VIMM framework. This component provides real-time chat functionality that can be embedded in the main VIMM frontend or used standalone.

## Features
* Real-time chat using Socket.IO
* Embeddable chat interface for the VIMM frontend
* Standalone chat page for direct access
* Chat history persistence
* Support for channel-specific chat configuration
* Integration with VIMM Core API for stream verification

## Requirements
* Node.js 14+
* PostgreSQL for production (SQLite supported for development/testing)

## Installation
1. Clone the repository:
   ```
   git clone https://github.com/VIMM-TV/vimm-chat.git
   cd vimm-chat
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Create a .env file based on .env.example:
   ```
   cp .env.example .env
   ```
   Edit .env to match your environment
4. Start the server:
   ```
   npm start
   ```

## Development
For development with hot reloading:
```
npm run dev
```

## Testing
Run tests with:
```
npm test
```

## Usage

### Accessing the Chat
The chat interface can be accessed directly at:
```
http://<domain>:<port>/chat/<channel_hive_username>
```

### Embedding in VIMM Frontend
The chat can be embedded in the VIMM frontend using an iframe:
```html
<iframe src="http://<domain>:<port>/chat/<channel_hive_username>" width="100%" height="600px" frameborder="0"></iframe>
```

Alternatively, use the REST API + Socket.IO for custom integrations. See `CHAT_INTEGRATION_SPEC.md` for complete documentation.

### API Overview

#### Public Endpoints (No Authentication Required)
* `GET /api/chat/messages/:hiveAccount` - Get chat message history
* `GET /api/chat/config/:hiveAccount` - Get chat configuration

#### Authenticated Endpoints (JWT Required)
* `POST /api/chat/messages/:hiveAccount` - Send a chat message
* `DELETE /api/chat/messages/:hiveAccount/:messageId` - Delete a message (moderator)
* `PUT /api/chat/config/:hiveAccount` - Update chat configuration (owner)
* `POST /api/chat/moderators/:hiveAccount` - Add moderator (owner)
* `DELETE /api/chat/moderators/:hiveAccount/:username` - Remove moderator (owner)
* `POST /api/chat/ban/:hiveAccount` - Ban a user (moderator)
* `DELETE /api/chat/ban/:hiveAccount/:username` - Unban a user (moderator)
* `GET /api/chat/bans/:hiveAccount` - List banned users (moderator)
* `POST /api/chat/timeout/:hiveAccount` - Timeout a user (moderator)
* `POST /api/chat/clear/:hiveAccount` - Clear all chat messages (moderator)

**Authentication**: Uses JWT tokens from vimm-core authentication. Include token in `Authorization: Bearer <token>` header.

**Full Documentation**: See `CHAT_INTEGRATION_SPEC.md` for complete API documentation, examples, and integration patterns.

## Development Status

This project is currently in early development. We are actively working on the core chat functionality and integration with other VIMM ecosystem components.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/VIMM-TV/vimm-chat/issues)

---

Powered by the Hive blockchain. Built by VIMM.
