const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const ChatMessage = require('../../db/models/chatMessage');
const ChatConfig = require('../../db/models/chatConfig');
const BannedUser = require('../../db/models/bannedUser');
const { 
  isModerator, 
  isBanned, 
  banUser, 
  unbanUser, 
  getBannedUsers,
  isChannelOwner
} = require('../utils/moderation');
const { Op } = require('sequelize');

// Get Socket.IO instance (will be set by server.js)
let io = null;
const setSocketIO = (socketIO) => {
  io = socketIO;
  console.log('Socket.IO instance set in chat routes:', !!io);
};
const getSocketIO = () => io;

/**
 * GET /api/chat/messages/:hiveAccount
 * Get chat messages for a channel
 * Public endpoint with optional auth
 */
router.get('/messages/:hiveAccount', optionalAuth, async (req, res) => {
  try {
    const { hiveAccount } = req.params;
    const { limit = 50, before, after } = req.query;

    const whereClause = {
      hiveAccount,
      isDeleted: false
    };

    // Pagination support
    if (before) {
      whereClause.createdAt = { [Op.lt]: new Date(before) };
    }
    if (after) {
      whereClause.createdAt = { [Op.gt]: new Date(after) };
    }

    const messages = await ChatMessage.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: Math.min(parseInt(limit), 100),
      attributes: ['id', 'username', 'message', 'timestamp', 'isModerator', 'createdAt']
    });

    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch messages' 
    });
  }
});

/**
 * POST /api/chat/messages/:hiveAccount
 * Send a chat message
 * Requires authentication
 */
router.post('/messages/:hiveAccount', authenticateToken, async (req, res) => {
  try {
    const { hiveAccount } = req.params;
    const { message } = req.body;
    const username = req.user.hiveAccount;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Message cannot be empty'
      });
    }

    if (message.length > 500) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Message exceeds maximum length of 500 characters'
      });
    }

    // Check if user is banned
    const banned = await isBanned(username, hiveAccount);
    if (banned) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are banned from this chat'
      });
    }

    // Check if user is a moderator
    const moderator = await isModerator(username, hiveAccount);

    // Save message to database
    const chatMessage = await ChatMessage.create({
      hiveAccount,
      username,
      message: message.trim(),
      timestamp: new Date(),
      isModerator: moderator
    });

    // Broadcast message to all Socket.IO clients in the room
    const io = getSocketIO();
    const roomName = `chat-${hiveAccount}`;
    
    console.log('📡 Broadcasting message to Socket.IO clients:', {
      hasIO: !!io,
      room: roomName,
      username: chatMessage.username,
      message: chatMessage.message
    });
    
    if (io) {
      const room = io.sockets.adapter.rooms.get(roomName);
      const clientCount = room ? room.size : 0;
      
      console.log(`📊 Room "${roomName}" has ${clientCount} connected clients`);
      
      if (clientCount === 0) {
        console.warn(`⚠️ WARNING: No clients in room "${roomName}" to receive the broadcast!`);
      }
      
      io.to(roomName).emit('chat-message', {
        id: chatMessage.id,
        username: chatMessage.username,
        message: chatMessage.message,
        timestamp: chatMessage.timestamp,
        isModerator: chatMessage.isModerator,
        hiveAccount: chatMessage.hiveAccount
      });
      
      console.log(`✅ Message broadcast complete to ${clientCount} client(s)`);
    } else {
      console.error('Socket.IO instance not available for broadcasting!');
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        id: chatMessage.id,
        username: chatMessage.username,
        message: chatMessage.message,
        timestamp: chatMessage.timestamp,
        isModerator: chatMessage.isModerator
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to send message' 
    });
  }
});

/**
 * DELETE /api/chat/messages/:hiveAccount/:messageId
 * Delete a chat message
 * Requires authentication and moderator privileges
 */
router.delete('/messages/:hiveAccount/:messageId', authenticateToken, async (req, res) => {
  try {
    const { hiveAccount, messageId } = req.params;
    const username = req.user.hiveAccount;

    // Check if user is a moderator
    const moderator = await isModerator(username, hiveAccount);
    if (!moderator) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only moderators can delete messages'
      });
    }

    const message = await ChatMessage.findOne({
      where: { id: messageId, hiveAccount }
    });

    if (!message) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Message not found'
      });
    }

    await message.update({ isDeleted: true });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to delete message' 
    });
  }
});

/**
 * GET /api/chat/config/:hiveAccount
 * Get chat configuration for a channel
 * Public endpoint
 */
router.get('/config/:hiveAccount', async (req, res) => {
  try {
    const { hiveAccount } = req.params;

    let config = await ChatConfig.findOne({
      where: { hiveAccount }
    });

    // Create default config if none exists
    if (!config) {
      try {
        config = await ChatConfig.create({
          hiveAccount,
          slowMode: false,
          slowModeInterval: 3,
          emoteOnly: false,
          subscribersOnly: false,
          followersOnly: false,
          followersOnlyDuration: 0,
          moderators: []
        });
        console.log(`Created default chat config for ${hiveAccount}`);
      } catch (createError) {
        // If creation fails, try to find it again in case of race condition
        console.error('Error creating chat config:', createError);
        config = await ChatConfig.findOne({
          where: { hiveAccount }
        });
        
        // If still not found, return default values without saving
        if (!config) {
          console.warn(`Unable to create or find config for ${hiveAccount}, returning defaults`);
          return res.json({
            hiveAccount,
            slowMode: false,
            slowModeInterval: 3,
            emoteOnly: false,
            subscribersOnly: false,
            followersOnly: false,
            followersOnlyDuration: 0,
            moderators: []
          });
        }
      }
    }

    res.json({
      hiveAccount: config.hiveAccount,
      slowMode: config.slowMode,
      slowModeInterval: config.slowModeInterval,
      emoteOnly: config.emoteOnly,
      subscribersOnly: config.subscribersOnly,
      followersOnly: config.followersOnly,
      followersOnlyDuration: config.followersOnlyDuration,
      moderators: config.moderators
    });
  } catch (error) {
    console.error('Error fetching chat config:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch chat configuration' 
    });
  }
});

/**
 * PUT /api/chat/config/:hiveAccount
 * Update chat configuration
 * Requires authentication and channel owner privileges
 */
router.put('/config/:hiveAccount', authenticateToken, async (req, res) => {
  try {
    const { hiveAccount } = req.params;
    const username = req.user.hiveAccount;

    // Only channel owner can update config
    if (!isChannelOwner(username, hiveAccount)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the channel owner can update chat configuration'
      });
    }

    const {
      slowMode,
      slowModeInterval,
      emoteOnly,
      subscribersOnly,
      followersOnly,
      followersOnlyDuration,
      moderators
    } = req.body;

    let config = await ChatConfig.findOne({
      where: { hiveAccount }
    });

    if (!config) {
      config = await ChatConfig.create({ hiveAccount });
    }

    // Update only provided fields
    const updates = {};
    if (slowMode !== undefined) updates.slowMode = slowMode;
    if (slowModeInterval !== undefined) updates.slowModeInterval = slowModeInterval;
    if (emoteOnly !== undefined) updates.emoteOnly = emoteOnly;
    if (subscribersOnly !== undefined) updates.subscribersOnly = subscribersOnly;
    if (followersOnly !== undefined) updates.followersOnly = followersOnly;
    if (followersOnlyDuration !== undefined) updates.followersOnlyDuration = followersOnlyDuration;
    if (moderators !== undefined) updates.moderators = moderators;

    await config.update(updates);

    res.json({
      success: true,
      message: 'Chat configuration updated successfully',
      config: {
        hiveAccount: config.hiveAccount,
        slowMode: config.slowMode,
        slowModeInterval: config.slowModeInterval,
        emoteOnly: config.emoteOnly,
        subscribersOnly: config.subscribersOnly,
        followersOnly: config.followersOnly,
        followersOnlyDuration: config.followersOnlyDuration,
        moderators: config.moderators
      }
    });
  } catch (error) {
    console.error('Error updating chat config:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to update chat configuration' 
    });
  }
});

/**
 * POST /api/chat/moderators/:hiveAccount
 * Add a moderator to a channel
 * Requires authentication and channel owner privileges
 */
router.post('/moderators/:hiveAccount', authenticateToken, async (req, res) => {
  try {
    const { hiveAccount } = req.params;
    const { username: modUsername } = req.body;
    const username = req.user.hiveAccount;

    if (!isChannelOwner(username, hiveAccount)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the channel owner can add moderators'
      });
    }

    if (!modUsername) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Username is required'
      });
    }

    let config = await ChatConfig.findOne({
      where: { hiveAccount }
    });

    if (!config) {
      config = await ChatConfig.create({ hiveAccount, moderators: [] });
    }

    const moderators = config.moderators || [];
    if (moderators.some(mod => mod.toLowerCase() === modUsername.toLowerCase())) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User is already a moderator'
      });
    }

    moderators.push(modUsername);
    await config.update({ moderators });

    res.status(201).json({
      success: true,
      message: `${modUsername} added as moderator`,
      moderators: config.moderators
    });
  } catch (error) {
    console.error('Error adding moderator:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to add moderator' 
    });
  }
});

/**
 * DELETE /api/chat/moderators/:hiveAccount/:username
 * Remove a moderator from a channel
 * Requires authentication and channel owner privileges
 */
router.delete('/moderators/:hiveAccount/:username', authenticateToken, async (req, res) => {
  try {
    const { hiveAccount, username: modUsername } = req.params;
    const username = req.user.hiveAccount;

    if (!isChannelOwner(username, hiveAccount)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the channel owner can remove moderators'
      });
    }

    const config = await ChatConfig.findOne({
      where: { hiveAccount }
    });

    if (!config || !config.moderators) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Moderator not found'
      });
    }

    const moderators = config.moderators.filter(
      mod => mod.toLowerCase() !== modUsername.toLowerCase()
    );

    if (moderators.length === config.moderators.length) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Moderator not found'
      });
    }

    await config.update({ moderators });

    res.json({
      success: true,
      message: `${modUsername} removed as moderator`,
      moderators: config.moderators
    });
  } catch (error) {
    console.error('Error removing moderator:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to remove moderator' 
    });
  }
});

/**
 * POST /api/chat/ban/:hiveAccount
 * Ban a user from a channel
 * Requires authentication and moderator privileges
 */
router.post('/ban/:hiveAccount', authenticateToken, async (req, res) => {
  try {
    const { hiveAccount } = req.params;
    const { username: bannedUsername, reason, duration } = req.body;
    const username = req.user.hiveAccount;

    // Check if user is a moderator
    const moderator = await isModerator(username, hiveAccount);
    if (!moderator) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only moderators can ban users'
      });
    }

    if (!bannedUsername) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Username is required'
      });
    }

    // Cannot ban the channel owner
    if (isChannelOwner(bannedUsername, hiveAccount)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Cannot ban the channel owner'
      });
    }

    // Cannot ban other moderators (only owner can)
    const isBannedUserMod = await isModerator(bannedUsername, hiveAccount);
    if (isBannedUserMod && !isChannelOwner(username, hiveAccount)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the channel owner can ban moderators'
      });
    }

    const ban = await banUser(hiveAccount, bannedUsername, username, reason, duration);

    res.status(201).json({
      success: true,
      message: `${bannedUsername} has been banned`,
      ban: {
        id: ban.id,
        bannedUsername: ban.bannedUsername,
        bannedBy: ban.bannedBy,
        reason: ban.reason,
        expiresAt: ban.expiresAt,
        isPermanent: ban.isPermanent
      }
    });
  } catch (error) {
    if (error.message === 'User is already banned') {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      });
    }
    console.error('Error banning user:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to ban user' 
    });
  }
});

/**
 * DELETE /api/chat/ban/:hiveAccount/:username
 * Unban a user from a channel
 * Requires authentication and moderator privileges
 */
router.delete('/ban/:hiveAccount/:username', authenticateToken, async (req, res) => {
  try {
    const { hiveAccount, username: bannedUsername } = req.params;
    const username = req.user.hiveAccount;

    // Check if user is a moderator
    const moderator = await isModerator(username, hiveAccount);
    if (!moderator) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only moderators can unban users'
      });
    }

    await unbanUser(hiveAccount, bannedUsername);

    res.json({
      success: true,
      message: `${bannedUsername} has been unbanned`
    });
  } catch (error) {
    if (error.message === 'User is not banned') {
      return res.status(404).json({
        error: 'Not found',
        message: error.message
      });
    }
    console.error('Error unbanning user:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to unban user' 
    });
  }
});

/**
 * GET /api/chat/bans/:hiveAccount
 * Get list of banned users for a channel
 * Requires authentication and moderator privileges
 */
router.get('/bans/:hiveAccount', authenticateToken, async (req, res) => {
  try {
    const { hiveAccount } = req.params;
    const username = req.user.hiveAccount;

    // Check if user is a moderator
    const moderator = await isModerator(username, hiveAccount);
    if (!moderator) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only moderators can view banned users'
      });
    }

    const bans = await getBannedUsers(hiveAccount);

    res.json({
      success: true,
      bans: bans.map(ban => ({
        id: ban.id,
        bannedUsername: ban.bannedUsername,
        bannedBy: ban.bannedBy,
        reason: ban.reason,
        expiresAt: ban.expiresAt,
        isPermanent: ban.isPermanent,
        createdAt: ban.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching banned users:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch banned users' 
    });
  }
});

/**
 * POST /api/chat/timeout/:hiveAccount
 * Temporarily ban (timeout) a user
 * Requires authentication and moderator privileges
 */
router.post('/timeout/:hiveAccount', authenticateToken, async (req, res) => {
  try {
    const { hiveAccount } = req.params;
    const { username: timeoutUsername, duration = 600, reason } = req.body;
    const username = req.user.hiveAccount;

    // Check if user is a moderator
    const moderator = await isModerator(username, hiveAccount);
    if (!moderator) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only moderators can timeout users'
      });
    }

    if (!timeoutUsername) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Username is required'
      });
    }

    // Cannot timeout the channel owner
    if (isChannelOwner(timeoutUsername, hiveAccount)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Cannot timeout the channel owner'
      });
    }

    // Cannot timeout other moderators
    const isTimeoutUserMod = await isModerator(timeoutUsername, hiveAccount);
    if (isTimeoutUserMod && !isChannelOwner(username, hiveAccount)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the channel owner can timeout moderators'
      });
    }

    const ban = await banUser(hiveAccount, timeoutUsername, username, reason, duration);

    res.status(201).json({
      success: true,
      message: `${timeoutUsername} has been timed out for ${duration} seconds`,
      timeout: {
        id: ban.id,
        username: ban.bannedUsername,
        duration,
        expiresAt: ban.expiresAt,
        reason: ban.reason
      }
    });
  } catch (error) {
    if (error.message === 'User is already banned') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User is already banned or timed out'
      });
    }
    console.error('Error timing out user:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to timeout user' 
    });
  }
});

/**
 * POST /api/chat/clear/:hiveAccount
 * Clear all chat messages for a channel
 * Requires authentication and moderator privileges
 */
router.post('/clear/:hiveAccount', authenticateToken, async (req, res) => {
  try {
    const { hiveAccount } = req.params;
    const username = req.user.hiveAccount;

    // Check if user is a moderator
    const moderator = await isModerator(username, hiveAccount);
    if (!moderator) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only moderators can clear chat'
      });
    }

    await ChatMessage.update(
      { isDeleted: true },
      { where: { hiveAccount, isDeleted: false } }
    );

    res.json({
      success: true,
      message: 'Chat has been cleared'
    });
  } catch (error) {
    console.error('Error clearing chat:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to clear chat' 
    });
  }
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;
