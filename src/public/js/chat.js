// Complete chat.js client-side implementation
document.addEventListener('DOMContentLoaded', () => {
    // Store DOM elements
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessages = document.getElementById('chat-messages');
    const usernameModal = document.getElementById('username-modal');
    const usernameInput = document.getElementById('username-input');
    const startChatButton = document.getElementById('start-chat-button');
    
    // Get the hiveAccount from the URL
    const pathParts = window.location.pathname.split('/');
    const hiveAccount = pathParts[pathParts.length - 1];
    
    // Chat parameters
    let username = localStorage.getItem(`vimm-chat-username-${hiveAccount}`) || '';
    let chatConfig = null;

    // Connect to Socket.io
    const socket = io();
    const chatRoom = `chat-${hiveAccount}`;
    
    // Check if username is already set
    if (username) {
        usernameModal.style.display = 'none';
        socket.emit('join-room', chatRoom);
        loadChatHistory();
        loadChatConfig();
    }
    
    // Handle username submit
    startChatButton.addEventListener('click', () => {
        username = usernameInput.value.trim();
        if (username) {
            localStorage.setItem(`vimm-chat-username-${hiveAccount}`, username);
            usernameModal.style.display = 'none';
            socket.emit('join-room', chatRoom);
            loadChatHistory();
            loadChatConfig();
        }
    });
    
    // Handle chat message submission
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        // Emit message to server
        socket.emit('chat-message', {
            room: chatRoom,
            username,
            message,
            hiveAccount
        });
        
        // Save message to database via API
        fetch(`/api/chat/messages/${hiveAccount}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                message
            })
        }).catch(error => console.error('Error saving message:', error));
        
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
        addMessageToChat(data.username, data.message, new Date(data.timestamp));
        scrollToBottom();
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