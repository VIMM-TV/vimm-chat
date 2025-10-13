// Complete chat.js client-side implementation with Hive authentication
document.addEventListener('DOMContentLoaded', () => {
    // Store DOM elements
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessages = document.getElementById('chat-messages');
    const usernameModal = document.getElementById('username-modal');
    const usernameInput = document.getElementById('username-input');
    const startChatButton = document.getElementById('start-chat-button');
    const authButton = document.getElementById('auth-hive-button');

    // Get the hiveAccount from the URL
    const pathParts = window.location.pathname.split('/');
    const hiveAccount = pathParts[pathParts.length - 1];
    
    // Chat parameters
    let authenticatedUser = localStorage.getItem(`vimm-chat-auth-${hiveAccount}`) || null;
    let authToken = localStorage.getItem(`vimm-chat-token-${hiveAccount}`) || null;
    let chatConfig = null;

    // Connect to Socket.io
    const socket = io();
    const chatRoom = `chat-${hiveAccount}`;
    
    // Check if user is already authenticated
    if (authenticatedUser && authToken) {
        verifyAuthToken().then(valid => {
            if (valid) {
                usernameModal.style.display = 'none';
                socket.emit('join-room', { room: chatRoom, token: authToken });
                loadChatHistory();
                loadChatConfig();
            } else {
                clearAuthentication();
            }
        });
    }
    
    // Handle Hive authentication
    authButton.addEventListener('click', async () => {
        try {
            if (!window.hive_keychain) {
                alert('Hive Keychain is not installed. Please install it to authenticate.');
                return;
            }
            
            const username = usernameInput.value.trim();
            if (!username) {
                alert('Please enter your Hive username');
                return;
            }
            
            // Generate a challenge message
            const challenge = `vimm-chat-auth-${Date.now()}-${Math.random()}`;
            
            // Request signature from Hive Keychain
            window.hive_keychain.requestSignBuffer(username, challenge, 'Posting', (response) => {
                if (response.success) {
                    // Send to server for verification
                    authenticateWithServer(username, challenge, response.result);
                } else {
                    alert('Authentication failed: ' + response.message);
                }
            });
            
        } catch (error) {
            console.error('Authentication error:', error);
            alert('Authentication failed. Please try again.');
        }
    });
    
    // Authenticate with server
    async function authenticateWithServer(username, challenge, signature) {
        try {
            const response = await fetch('/api/chat/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    challenge,
                    signature,
                    hiveAccount
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                authenticatedUser = username;
                authToken = result.token;
                
                localStorage.setItem(`vimm-chat-auth-${hiveAccount}`, username);
                localStorage.setItem(`vimm-chat-token-${hiveAccount}`, authToken);
                
                usernameModal.style.display = 'none';
                socket.emit('join-room', { room: chatRoom, token: authToken });
                loadChatHistory();
                loadChatConfig();
            } else {
                alert('Authentication failed: ' + result.error);
            }
        } catch (error) {
            console.error('Server authentication error:', error);
            alert('Authentication failed. Please try again.');
        }
    }
    
    // Verify auth token with server
    async function verifyAuthToken() {
        try {
            const response = await fetch('/api/chat/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ hiveAccount })
            });
            
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    // Clear authentication data
    function clearAuthentication() {
        localStorage.removeItem(`vimm-chat-auth-${hiveAccount}`);
        localStorage.removeItem(`vimm-chat-token-${hiveAccount}`);
        authenticatedUser = null;
        authToken = null;
    }
    
    // Handle chat message submission
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (!message || !authToken) {
            console.log('Message submission blocked:', { message: !!message, authToken: !!authToken });
            return;
        }
        
        console.log('Sending message:', { room: chatRoom, message, hasToken: !!authToken });
        
        // Emit message to server with auth token
        socket.emit('chat-message', {
            room: chatRoom,
            message,
            token: authToken
        });
        
        // Clear input
        messageInput.value = '';
        messageInput.focus();
    });
    
    // Load chat history from API
    async function loadChatHistory() {
        try {
            const response = await fetch(`/api/chat/messages/${hiveAccount}`);
            const messages = await response.json();
            
            // Clear existing messages
            chatMessages.innerHTML = '';
            
            // Add messages to chat
            messages.forEach(msg => {
                addMessageToChat(msg.username, msg.message, new Date(msg.timestamp));
            });
            
            // Scroll to bottom
            scrollToBottom();
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }
    
    // Load chat configuration
    async function loadChatConfig() {
        try {
            const response = await fetch(`/api/chat/config/${hiveAccount}`);
            chatConfig = await response.json();
            
            // Apply chat configuration (slow mode, etc.)
            if (chatConfig.slowMode) {
                // Implement slow mode functionality
                const interval = chatConfig.slowModeInterval || 3;
                messageInput.disabled = false;
                
                chatForm.addEventListener('submit', () => {
                    messageInput.disabled = true;
                    setTimeout(() => {
                        messageInput.disabled = false;
                    }, interval * 1000);
                });
            }
        } catch (error) {
            console.error('Error loading chat config:', error);
        }
    }
    
    // Listen for chat messages from the server
    socket.on('chat-message', (data) => {
        console.log('Received message from server:', data);
        addMessageToChat(data.username, data.message, new Date(data.timestamp));
        scrollToBottom();
    });
    
    // Add connection event listeners for debugging
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
    });
    
    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });

    socket.on('auth-error', (error) => {
        console.error('Authentication error:', error);
        alert('Authentication failed: ' + error.message);
        clearAuthentication();
    });
    
    // Add a message to the chat display
    function addMessageToChat(username, message, timestamp) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        
        const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <span class="timestamp">[${formattedTime}]</span>
            <span class="username">${username}:</span>
            <span class="message-text">${escapeHtml(message)}</span>
        `;
        
        chatMessages.appendChild(messageElement);
    }
    
    // Helper to scroll chat to bottom
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});