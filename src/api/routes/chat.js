const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { verifySignature } = require('@hiveio/dhive');
const { chatMessages, authenticatedUsers, getMessagesForAccount } = require('../../storage');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Get chat history for a specific hive account
router.get('/messages/:hiveAccount', (req, res) => {
    try {
        const { hiveAccount } = req.params;
        const messages = getMessagesForAccount(hiveAccount);
        
        // Return messages sorted by timestamp (oldest first)
        const sortedMessages = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        res.json(sortedMessages);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});

// Authentication route
router.post('/auth', async (req, res) => {
    try {
        const { username, challenge, signature, hiveAccount } = req.body;
        
        if (!username || !challenge || !signature) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Verify the signature against Hive blockchain
        const isValid = await verifyHiveSignature(username, challenge, signature);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid signature' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                username, 
                hiveAccount, 
                timestamp: Date.now() 
            }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        // Store authenticated user
        const authenticatedAt = new Date();
        authenticatedUsers.set(token, {
            username,
            hiveAccount,
            authenticatedAt
        });

        // Schedule cleanup for expired tokens
        setTimeout(() => {
            const userData = authenticatedUsers.get(token);
            if (userData && new Date() - userData.authenticatedAt >= 24 * 60 * 60 * 1000) { // 24 hours
                authenticatedUsers.delete(token);
            }
        }, 24 * 60 * 60 * 1000); // 24 hours
        
        res.json({ success: true, token, username });
        
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Token verification route
router.post('/verify', (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const userData = authenticatedUsers.get(token);
        
        if (!userData) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        res.json({ success: true, user: userData });
        
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Middleware to verify authenticated requests
function requireAuth(req, res, next) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const userData = authenticatedUsers.get(token);
        
        if (!userData) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        req.user = userData;
        req.token = token;
        next();
        
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
}

// Verify Hive signature
async function verifyHiveSignature(username, message, signature) {
    try {
        const dhive = require('@hiveio/dhive');
        const client = new dhive.Client(['https://api.hive.blog']);
        
        // Fetch user account from Hive blockchain
        const account = await client.database.getAccounts([username]);
        if (!account || account.length === 0) {
            console.log('Account not found:', username);
            return false;
        }
        
        // Get the posting public key
        const postingAuth = account[0].posting;
        if (!postingAuth.key_auths || postingAuth.key_auths.length === 0) {
            console.log('No posting keys found for:', username);
            return false;
        }
        
        const publicKey = postingAuth.key_auths[0][0];
        
        // Use dhive's proper signature verification
        try {
            const sig = dhive.Signature.fromString(signature);
            const messageHash = crypto.createHash('sha256').update(message).digest();
            const recoveredKey = sig.recover(messageHash);
            
            return recoveredKey.toString() === publicKey;
        } catch (verifyError) {
            console.error('Signature verification failed:', verifyError);
            return false;
        }
        
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
}

// Save a new chat message
router.post('/messages/:hiveAccount', requireAuth, (req, res) => {
    try {
        const { hiveAccount } = req.params;
        const { message } = req.body;
        const { username } = req.user;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        // Create new message object
        const newMessage = {
            id: Date.now().toString(),
            username,
            message: message.trim(),
            timestamp: new Date().toISOString(),
            hiveAccount,
            verified: true // Mark as verified since user is authenticated
        };
        
        const messages = getMessagesForAccount(hiveAccount);
        messages.push(newMessage);
        
        if (messages.length > 100) {
            messages.splice(0, messages.length - 100);
        }
        
        res.status(201).json({ success: true, message: newMessage });
    } catch (error) {
        console.error('Error saving chat message:', error);
        res.status(500).json({ error: 'Failed to save message' });
    }
});

// Get chat configuration for a specific hive account
router.get('/config/:hiveAccount', (req, res) => {
    try {
        const { hiveAccount } = req.params;
        
        // Default configuration (you can store this in a database)
        const defaultConfig = {
            slowMode: false,
            slowModeInterval: 3,
            maxMessageLength: 500,
            allowedRoles: ['viewer', 'subscriber', 'moderator']
        };
        
        res.json(defaultConfig);
    } catch (error) {
        console.error('Error fetching chat config:', error);
        res.status(500).json({ error: 'Failed to fetch chat configuration' });
    }
});

// Health check route
router.get('/', (req, res) => {
    res.json({ message: 'Chat API is working' });
});

module.exports = router;