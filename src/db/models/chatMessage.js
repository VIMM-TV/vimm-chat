const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  hiveAccount: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The Hive account of the streamer'
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Username of the message sender'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isModerator: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'chat_messages',
  timestamps: true
});

module.exports = ChatMessage;