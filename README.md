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

### API Routes
* GET /api/chat/messages/:hiveAccount - Get chat history for a specific channel
* POST /api/chat/messages/:hiveAccount - Post a new message to a channel
* GET /api/chat/config/:hiveAccount - Get chat configuration for a specific channel

## Development Status

This project is currently in early development. We are actively working on the core chat functionality and integration with other VIMM ecosystem components.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/VIMM-TV/vimm-chat/issues)

---

Powered by the Hive blockchain. Built by VIMM.
