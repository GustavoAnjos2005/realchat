import type { Socket as ClientSocket } from 'socket.io-client';

export interface User {
    id: string;
    name: string;
    email: string;
    isOnline: boolean;
}

export interface Message {
    id: string;
    content: string;
    senderId: string;
    receiverId: string;
    isAIMessage: boolean;
    createdAt: string;
}

export type ChatSocket = typeof ClientSocket;