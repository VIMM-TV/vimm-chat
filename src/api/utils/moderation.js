const ChatConfig = require('../../db/models/chatConfig');
const BannedUser = require('../../db/models/bannedUser');
const { Op } = require('sequelize');

/**
 * Check if a user is the channel owner
 */
function isChannelOwner(username, channelHiveAccount) {
  return username.toLowerCase() === channelHiveAccount.toLowerCase();
}

/**
 * Check if a user is a moderator for a channel
 */
async function isModerator(username, channelHiveAccount) {
  if (isChannelOwner(username, channelHiveAccount)) {
    return true;
  }

  try {
    const config = await ChatConfig.findOne({
      where: { hiveAccount: channelHiveAccount }
    });

    if (!config || !config.moderators) {
      return false;
    }

    return config.moderators.some(
      mod => mod.toLowerCase() === username.toLowerCase()
    );
  } catch (error) {
    console.error('Error checking moderator status:', error);
    return false;
  }
}

/**
 * Check if a user is banned from a channel
 */
async function isBanned(username, channelHiveAccount) {
  try {
    const ban = await BannedUser.findOne({
      where: {
        hiveAccount: channelHiveAccount,
        bannedUsername: username,
        [Op.or]: [
          { isPermanent: true },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      }
    });

    return ban !== null;
  } catch (error) {
    console.error('Error checking ban status:', error);
    return false;
  }
}

/**
 * Ban a user from a channel
 */
async function banUser(channelHiveAccount, bannedUsername, bannedBy, reason = null, duration = null) {
  try {
    const expiresAt = duration ? new Date(Date.now() + duration * 1000) : null;
    const isPermanent = duration === null;

    const ban = await BannedUser.create({
      hiveAccount: channelHiveAccount,
      bannedUsername,
      bannedBy,
      reason,
      expiresAt,
      isPermanent
    });

    return ban;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new Error('User is already banned');
    }
    throw error;
  }
}

/**
 * Unban a user from a channel
 */
async function unbanUser(channelHiveAccount, bannedUsername) {
  try {
    const deleted = await BannedUser.destroy({
      where: {
        hiveAccount: channelHiveAccount,
        bannedUsername
      }
    });

    if (deleted === 0) {
      throw new Error('User is not banned');
    }

    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Get all banned users for a channel
 */
async function getBannedUsers(channelHiveAccount) {
  try {
    const bans = await BannedUser.findAll({
      where: {
        hiveAccount: channelHiveAccount,
        [Op.or]: [
          { isPermanent: true },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    return bans;
  } catch (error) {
    console.error('Error getting banned users:', error);
    return [];
  }
}

/**
 * Clean up expired bans
 */
async function cleanExpiredBans() {
  try {
    await BannedUser.destroy({
      where: {
        isPermanent: false,
        expiresAt: { [Op.lt]: new Date() }
      }
    });
  } catch (error) {
    console.error('Error cleaning expired bans:', error);
  }
}

module.exports = {
  isChannelOwner,
  isModerator,
  isBanned,
  banUser,
  unbanUser,
  getBannedUsers,
  cleanExpiredBans
};
