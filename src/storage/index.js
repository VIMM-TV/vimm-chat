// Shared storage for chat messages and authenticated users
const chatMessages = new Map();
const authenticatedUsers = new Map();

function getMessagesForAccount(hiveAccount) {
    if (!chatMessages.has(hiveAccount)) {
        chatMessages.set(hiveAccount, []);
    }
    return chatMessages.get(hiveAccount);
}

module.exports = {
    chatMessages,
    authenticatedUsers,
    getMessagesForAccount
};