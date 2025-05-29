import type { Socket as ClientSocket } from 'socket.io-client';

export interface User {
    id: string;
    name: string;
    email: string;
    isOnline: boolean;
    profileImage?: string;
    themeColor?: string;
    backgroundColor?: string;
    backgroundImage?: string;
}

export interface Message {
    id: string;
    content: string;
    senderId: string;
    receiverId: string;
    isAIMessage: boolean;
    fileUrl?: string;
    fileType?: string;
    fileName?: string;
    fileSize?: number;
    createdAt: Date | string;
}

export type ChatSocket = typeof ClientSocket;