import { Server, Socket } from 'socket.io';
import { ChatService } from '../services/chatService';
import { Message } from '../types/chat';
import logger from '../utils/logger';

const chatService = new ChatService();

interface User {
    userId: string;
}

interface OnlineUser {
    id: string;
    name: string;
    email: string;
}

export default function setupChatSocket(io: Server) {
    const connectedUsers = new Map<string, Socket>();
    
    io.on('connection', async (socket: Socket) => {
        const user = socket.data.user as User;
        const userId = user.userId;
        
        logger.info('Novo usuário conectado', { userId, socketId: socket.id });
        
        connectedUsers.set(userId, socket);
        await chatService.setUserOnlineStatus(userId, true);
        socket.broadcast.emit('userOnline', { userId });

        socket.on('joinPrivateRoom', (targetUserId: string) => {
            socket.rooms.forEach(room => {
                if (room !== socket.id) {
                    socket.leave(room);
                }
            });

            const roomId = [userId, targetUserId].sort().join('-');
            socket.join(roomId);
            logger.info('Usuário entrou na sala privada', {
                userId,
                targetUserId,
                roomId
            });
        });

        socket.on('sendMessage', async (data: { receiverId: string; content: string }, callback) => {
            try {
                const user = socket.data.user;
                if (!user || !user.userId) {
                    throw new Error('Usuário não autenticado');
                }

                logger.info('Recebendo mensagem:', { ...data, senderId: user.userId });

                // Salvar a mensagem
                const message = await chatService.saveMessage(
                    user.userId,
                    data.receiverId,
                    data.content
                );

                // Emitir para o remetente
                socket.emit('message', message);

                // Se o destinatário for a IA
                if (data.receiverId === chatService.getAIUserId()) {
                    // Gerar e salvar a resposta da IA
                    const aiResponse = await chatService.generateAIResponse(data.content);
                    const aiMessage = await chatService.saveMessage(
                        chatService.getAIUserId(),
                        user.userId,
                        aiResponse
                    );
                    socket.emit('message', { ...aiMessage, isAIMessage: true });
                } else {
                    // Emitir para o destinatário se estiver online
                    const receiverSocket = connectedUsers.get(data.receiverId);
                    if (receiverSocket) {
                        receiverSocket.emit('message', message);
                    }
                }

                // Confirmar sucesso
                if (callback) callback();
            } catch (error) {
                logger.error('Erro ao processar mensagem:', error);
                if (callback) {
                    callback({ 
                        message: error instanceof Error ? error.message : 'Erro ao enviar mensagem'
                    });
                }
                socket.emit('messageError', { 
                    message: 'Não foi possível enviar a mensagem. Tente novamente.'
                });
            }
        });

        socket.on('typing', async (data: { receiverId: string, isTyping: boolean }) => {
            try {
                const user = socket.data.user;
                if (!user) return;

                io.to(data.receiverId).emit('userTyping', {
                    userId: user.userId,
                    isTyping: data.isTyping
                });

                logger.debug('Status de digitação enviado', {
                    userId: user.userId,
                    receiverId: data.receiverId,
                    isTyping: data.isTyping
                });
            } catch (error) {
                logger.error('Erro ao processar evento de digitação', {
                    error: error instanceof Error ? error.message : 'Erro desconhecido',
                    userId: user.userId
                });
            }
        });

        socket.on('disconnect', async () => {
            connectedUsers.delete(user.userId);
            await chatService.setUserOnlineStatus(user.userId, false);
            socket.broadcast.emit('userOffline', { userId: user.userId });
            logger.info('Usuário desconectado', { userId: user.userId });
        });

        socket.on('fetchMessages', async (userId: string, page: number = 1) => {
            try {
                const user = socket.data.user;
                if (!user) return;

                logger.info('Buscando mensagens', {
                    userId: user.userId,
                    targetUserId: userId,
                    page
                });

                const result = await chatService.getMessages(user.userId, userId, page);
                
                socket.emit('messageHistory', result.messages);
                socket.emit('hasMoreMessages', result.hasMore);

                logger.info('Histórico de mensagens enviado', {
                    userId: user.userId,
                    targetUserId: userId,
                    messageCount: result.messages.length,
                    hasMore: result.hasMore
                });
            } catch (error) {
                logger.error('Erro ao buscar mensagens', {
                    error: error instanceof Error ? error.message : 'Erro desconhecido',
                    userId: user.userId,
                    targetUserId: userId
                });
                socket.emit('messageError', { message: 'Erro ao carregar mensagens' });
            }
        });

        socket.on('getOnlineUsers', async () => {
            try {
                const onlineUsers = await chatService.getOnlineUsers();
                socket.emit('onlineUsers', onlineUsers);
                logger.info('Lista de usuários online enviada', {
                    requestedBy: user.userId,
                    onlineCount: onlineUsers.length
                });
            } catch (error) {
                logger.error('Erro ao buscar usuários online', {
                    error: error instanceof Error ? error.message : 'Erro desconhecido',
                    userId: user.userId
                });
                socket.emit('messageError', { 
                    message: 'Erro ao carregar usuários online'
                });
            }
        });
    });
}