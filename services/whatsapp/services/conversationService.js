const messageHistory = {};

export function getAllConversations() {
    const conversations = {};
    Object.keys(messageHistory).forEach((phone) => {
        conversations[phone] = {
            phone,
            lastMessage: messageHistory[phone][messageHistory[phone].length - 1]?.content || '',
            lastMessageTime: new Date().toISOString(),
            messageCount: messageHistory[phone].length,
            history: messageHistory[phone],
        };
    });
    return conversations;
}

export function getConversation(phone) {
    const conversation = messageHistory[phone];
    if (!conversation) return null;
    return {
        phone,
        history: conversation,
        messageCount: conversation.length,
    };
}

export function deleteConversation(phone) {
    delete messageHistory[phone];
}

export function deleteAllConversations() {
    Object.keys(messageHistory).forEach((phone) => {
        delete messageHistory[phone];
    });
}

export function getMessageHistory() {
    return messageHistory;
}
