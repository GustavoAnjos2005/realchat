export interface Message {
    id: string;
    content: string;
    senderId: string;
    receiverId: string;
    isAIMessage: boolean;
    createdAt: Date;
}