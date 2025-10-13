const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const BannedUser = sequelize.define('BannedUser', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  hiveAccount: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The Hive account of the channel owner'
  },
  bannedUsername: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The username that is banned'
  },
  bannedBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The moderator who issued the ban'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason for the ban'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the ban expires (null = permanent)'
  },
  isPermanent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is a permanent ban'
  }
}, {
  tableName: 'banned_users',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['hiveAccount', 'bannedUsername']
    }
  ]
});

module.exports = BannedUser;
