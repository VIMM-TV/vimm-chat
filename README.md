# VIMM Chat

VIMM Chat is a dedicated chat server and implementation designed for real-time stream interaction within the VIMM ecosystem. It provides a scalable, feature-rich chat solution that integrates with Hive authentication and VIMM Core streaming services.

## VIMM Ecosystem

VIMM Chat is part of a larger ecosystem of components:

- [VIMM Core](https://github.com/VIMM-TV/vimm-core) - Core streaming server with multi-protocol support
- **VIMM Chat** (this repository) - Chat server and implementation for real-time stream interaction
- [VIMM Frontend](https://github.com/VIMM-TV/vimm-frontend) - Reference frontend application integrating all VIMM components

## Planned Features

### Core Chat Functionality
- Real-time message delivery
- Room-based chat architecture
- Message history and caching
- User presence detection
- Typing indicators

### Stream Integration
- Automatic room creation based on active streams
- Stream status synchronization
- Broadcaster-specific features
- Moderator tools

### Authentication & Authorization
- Hive blockchain authentication
- Role-based permissions
  - Broadcasters
  - Moderators
  - Viewers
- Integration with VIMM Core authentication

### Moderation Features
- User timeout/ban system
- Message deletion
- Spam protection
- Automated content filtering
- Moderation logs

### WebSocket Integration
- Secure WebSocket connections
- Connection state management
- Automatic reconnection handling
- Event-based message system

## Architecture

```
src/
├── server/            # Chat server implementation
│   ├── rooms/
│   ├── messages/
│   └── presence/
├── auth/              # Authentication and authorization
│   ├── hive/
│   └── roles/
├── moderation/        # Moderation tools and systems
│   ├── filters/
│   ├── actions/
│   └── logs/
├── integration/       # Integration with other VIMM components
│   ├── core/
│   └── frontend/
├── utils/             # Utility functions
└── config/            # Configuration management
```

## Development Status

This project is currently in early development. We are actively working on the core chat functionality and integration with other VIMM ecosystem components.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/VIMM-TV/vimm-chat/issues)

---

Powered by the Hive blockchain. Built by VIMM.
