import { Server, Socket } from 'socket.io';
import { ChatService } from '../services/chatService';
import { Message } from '../types/chat';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const chatService = new ChatService();

interface User {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
}

interface OnlineUser {
    id: string;
    name: string;
    email: string;
}

interface SocketUser extends User {
  socketId: string;
}

// Mapa de usuários conectados
const connectedUsers = new Map<string, SocketUser>();
// Mapa de chamadas ativas
const activeCalls = new Map<string, { from: string; to: string; type: 'audio' | 'video' }>();

export default function setupChatSocket(io: Server) {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                logger.error('Token não fornecido na conexão socket');
                return next(new Error('Token não fornecido'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, name: true, email: true, profileImage: true }
            });

            if (!user) {
                logger.error('Usuário não encontrado na autenticação socket');
                return next(new Error('Usuário não encontrado'));
            }

            socket.data.user = user;
            logger.info('Usuário autenticado no socket', { userId: user.id, userName: user.name });
            next();
        } catch (error) {
            logger.error('Erro na autenticação do socket:', error);
            next(new Error('Token inválido'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const user = socket.data.user as User;
        const userId = user.id;
        
        logger.info('Novo usuário conectado via socket', { userId, userName: user.name, socketId: socket.id });
        
        // Armazena a conexão do usuário
        connectedUsers.set(userId, {
          ...user,
          socketId: socket.id
        });
        
        // Atualiza o status online
        chatService.setUserOnlineStatus(userId, true);
        
        // Notifica outros usuários que este usuário está online (apenas uma vez)
        socket.broadcast.emit('userOnline', { userId });

        // Handler para obter lista de usuários online
        socket.on('getOnlineUsers', async () => {
            try {
                console.log('=== SOCKET: getOnlineUsers recebido ===');
                console.log('Usuário solicitante:', { userId, userName: user.name });
                
                const users = await chatService.getOnlineUsers();
                console.log('=== DADOS RETORNADOS PELO CHATSERVICE ===');
                console.log('Número de usuários encontrados:', users.length);
                console.log('Usuários:', users.map(u => ({ id: u.id, name: u.name, isOnline: u.isOnline })));
                
                console.log('=== ENVIANDO RESPOSTA PARA O CLIENTE ===');
                socket.emit('onlineUsers', users);
                console.log('Resposta onlineUsers enviada com sucesso para:', userId);
            } catch (error) {
                console.error('=== ERRO NO getOnlineUsers ===');
                console.error('Erro detalhado:', error);
                console.error('Stack trace:', error instanceof Error ? error.stack : 'Stack não disponível');
                socket.emit('onlineUsers', []);
            }
        });

        socket.on('joinPrivateRoom', (targetUserId: string) => {
            // Remove de todas as salas privadas anteriores
            socket.rooms.forEach(room => {
                if (room !== socket.id && room.includes('-')) {
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
                const { receiverId, content } = data;

                if (receiverId === 'ai-assistant') {
                  // Processar mensagem para o assistente IA
                  const aiResponse = await processAIMessage(content, user);
                  
                  // Salvar mensagem do usuário
                  const userMessage = await prisma.message.create({
                    data: {
                      senderId: user.id,
                      receiverId: 'ai-assistant',
                      content: content,
                      isAIMessage: false
                    }
                  });

                  // Salvar resposta da IA
                  const aiMessage = await prisma.message.create({
                    data: {
                      senderId: 'ai-assistant',
                      receiverId: user.id,
                      content: aiResponse,
                      isAIMessage: true
                    }
                  });

                  // Enviar mensagens de volta
                  socket.emit('message', {
                    id: userMessage.id,
                    senderId: user.id,
                    receiverId: 'ai-assistant',
                    content: content,
                    createdAt: userMessage.createdAt,
                    isAIMessage: false
                  });

                  socket.emit('message', {
                    id: aiMessage.id,
                    senderId: 'ai-assistant',
                    receiverId: user.id,
                    content: aiResponse,
                    createdAt: aiMessage.createdAt,
                    isAIMessage: true
                  });

                  if (callback) callback();
                  return;
                }

                // Processar mensagem normal
                const message = await prisma.message.create({
                  data: {
                    senderId: user.id,
                    receiverId,
                    content
                  }
                });

                const messageData = {
                  id: message.id,
                  senderId: user.id,
                  receiverId,
                  content,
                  createdAt: message.createdAt,
                  isAIMessage: false
                };

                // Enviar para o remetente
                socket.emit('message', messageData);

                // Enviar para o destinatário se estiver online
                const receiver = connectedUsers.get(receiverId);
                if (receiver) {
                  io.to(receiver.socketId).emit('message', messageData);
                }

                if (callback) callback();
            } catch (error) {
                logger.error('Erro ao enviar mensagem:', error);
                if (callback) callback({ message: 'Erro ao enviar mensagem' });
            }
        });

        socket.on('typing', (data: { receiverId: string; isTyping: boolean }) => {
            const receiver = connectedUsers.get(data.receiverId);
            if (receiver) {
                io.to(receiver.socketId).emit('userTyping', {
                    userId: user.id,
                    isTyping: data.isTyping
                });
            }
        });

        // === EVENTOS DE CHAMADAS WEBRTC ===
        
        // Iniciar chamada
        socket.on('call-user', async (data: { to: string; signal: any; type: 'audio' | 'video' | 'ice-candidate' }) => {
          try {
            const { to, signal, type } = data;
            const receiver = connectedUsers.get(to);
            
            if (!receiver) {
              socket.emit('call-error', { message: 'Usuário não está online' });
              return;
            }

            // Se for ICE candidate, apenas encaminhar
            if (type === 'ice-candidate') {
              io.to(receiver.socketId).emit('ice-candidate', signal);
              logger.info(`ICE candidate enviado de ${user.name} para ${receiver.name}`);
              return;
            }

            // Verificar se já existe uma chamada ativa para qualquer um dos usuários
            const existingCall = Array.from(activeCalls.values()).find(
              call => (call.from === user.id || call.to === user.id || 
                       call.from === to || call.to === to)
            );

            if (existingCall) {
              socket.emit('call-error', { message: 'Usuário já está em uma chamada' });
              return;
            }

            // Registrar chamada ativa
            const callId = `${user.id}-${to}-${Date.now()}`;
            activeCalls.set(callId, { from: user.id, to, type: type as 'audio' | 'video' });

            // Enviar chamada para o destinatário
            io.to(receiver.socketId).emit('incoming-call', {
              from: user.id,
              to,
              signal,
              type,
              caller: {
                id: user.id,
                name: user.name,
                profileImage: user.profileImage
              }
            });

            logger.info(`Chamada ${type} iniciada de ${user.name} para ${receiver.name}`);
          } catch (error) {
            logger.error('Erro ao iniciar chamada:', error);
            socket.emit('call-error', { message: 'Erro ao iniciar chamada' });
          }
        });

        // Aceitar chamada
        socket.on('accept-call', (data: { to: string; signal: any }) => {
          try {
            const caller = connectedUsers.get(data.to);
            if (!caller) {
              socket.emit('call-error', { message: 'Usuário que ligou não está mais online' });
              return;
            }

            // Verificar se a chamada ainda existe
            const activeCall = Array.from(activeCalls.values()).find(
              call => call.from === data.to && call.to === user.id
            );

            if (!activeCall) {
              socket.emit('call-error', { message: 'Chamada não encontrada ou já foi encerrada' });
              return;
            }

            // Enviar sinal de aceite para quem ligou
            io.to(caller.socketId).emit('call-accepted', { signal: data.signal });
            logger.info(`Chamada aceita por ${user.name}`);
          } catch (error) {
            logger.error('Erro ao aceitar chamada:', error);
            socket.emit('call-error', { message: 'Erro ao aceitar chamada' });
          }
        });

        // Rejeitar chamada
        socket.on('reject-call', (data: { to: string }) => {
          try {
            const caller = connectedUsers.get(data.to);
            if (caller) {
              io.to(caller.socketId).emit('call-rejected');
              logger.info(`Chamada rejeitada por ${user.name}`);
            }
            
            // Remover chamada ativa
            const callToRemove = Array.from(activeCalls.entries()).find(
              ([_, call]) => (call.from === data.to && call.to === user.id)
            );
            if (callToRemove) {
              activeCalls.delete(callToRemove[0]);
              logger.info(`Chamada removida do servidor: ${callToRemove[0]}`);
            }
          } catch (error) {
            logger.error('Erro ao rejeitar chamada:', error);
          }
        });

        // Encerrar chamada
        socket.on('end-call', (data?: { to?: string }) => {
          try {
            // Encontrar e remover chamadas ativas do usuário
            const callsToRemove = Array.from(activeCalls.entries()).filter(
              ([_, call]) => call.from === user.id || call.to === user.id
            );

            callsToRemove.forEach(([callId, call]) => {
              activeCalls.delete(callId);
              
              // Notificar o outro participante
              const otherUserId = call.from === user.id ? call.to : call.from;
              const otherUser = connectedUsers.get(otherUserId);
              if (otherUser) {
                io.to(otherUser.socketId).emit('call-ended');
              }
              
              logger.info(`Chamada ${callId} encerrada por ${user.name}`);
            });

            // Se foi especificado um usuário específico, também notificar diretamente
            if (data?.to) {
              const targetUser = connectedUsers.get(data.to);
              if (targetUser) {
                io.to(targetUser.socketId).emit('call-ended');
              }
            }

            logger.info(`Todas as chamadas de ${user.name} foram encerradas`);
          } catch (error) {
            logger.error('Erro ao encerrar chamada:', error);
          }
        });

        // Sinalização ICE para WebRTC (listener separado para garantia)
        socket.on('ice-candidate', (data: { to: string; candidate: any }) => {
          try {
            const receiver = connectedUsers.get(data.to);
            if (receiver) {
              io.to(receiver.socketId).emit('ice-candidate', data.candidate);
              logger.info(`ICE candidate direto enviado de ${user.name} para ${receiver.name}`);
            }
          } catch (error) {
            logger.error('Erro ao enviar ICE candidate:', error);
          }
        });

        // Verificar status de chamada
        socket.on('check-call-status', (data: { userId: string }, callback) => {
          try {
            const isInCall = Array.from(activeCalls.values()).some(
              call => call.from === data.userId || call.to === data.userId
            );
            if (callback) callback({ inCall: isInCall });
          } catch (error) {
            logger.error('Erro ao verificar status de chamada:', error);
            if (callback) callback({ inCall: false });
          }
        });

        // === FIM DOS EVENTOS DE CHAMADAS ===

        // Upload de arquivo
        socket.on('fileUploaded', async (data: { 
          receiverId: string; 
          fileName: string; 
          fileUrl: string;
          fileType: string;
          fileSize: number;
        }) => {
          try {
            // Salvar a mensagem com arquivo no banco de dados
            const message = await chatService.createFileMessage({
              senderId: user.id,
              receiverId: data.receiverId,
              fileName: data.fileName,
              fileUrl: data.fileUrl,
              fileType: data.fileType,
              fileSize: data.fileSize
            });

            const messageData = {
              id: message.id,
              senderId: user.id,
              receiverId: data.receiverId,
              content: `📎 ${data.fileName}`,
              fileName: data.fileName,
              fileUrl: data.fileUrl,
              fileType: data.fileType,
              fileSize: data.fileSize,
              createdAt: message.createdAt,
              isAIMessage: false
            };

            // Enviar para o remetente
            socket.emit('message', messageData);

            // Enviar para o destinatário se estiver online
            const receiver = connectedUsers.get(data.receiverId);
            if (receiver) {
              io.to(receiver.socketId).emit('message', messageData);
            }

            logger.info('Arquivo enviado com sucesso', { 
              fileName: data.fileName, 
              from: user.name, 
              to: data.receiverId 
            });

          } catch (error) {
            logger.error('Erro ao processar upload de arquivo:', error);
            socket.emit('fileUploadError', { 
              message: 'Erro ao processar arquivo enviado' 
            });
          }
        });

        socket.on('disconnect', async () => {
          logger.info(`Usuário desconectado: ${user.name} (${socket.id})`);
          
          // Remover usuário da lista de conectados
          connectedUsers.delete(userId);
          
          // Atualizar status offline no banco de dados
          await chatService.setUserOnlineStatus(userId, false);
          
          // Encerrar todas as chamadas ativas do usuário
          const userCalls = Array.from(activeCalls.entries()).filter(
            ([_, call]) => call.from === userId || call.to === userId
          );

          userCalls.forEach(([callId, call]) => {
            activeCalls.delete(callId);
            
            // Notificar o outro participante
            const otherUserId = call.from === userId ? call.to : call.from;
            const otherUser = connectedUsers.get(otherUserId);
            if (otherUser) {
              io.to(otherUser.socketId).emit('call-ended');
            }
          });

          // Notificar outros usuários que este usuário ficou offline
          socket.broadcast.emit('userOffline', { userId });
        });
    });
}

// Função para processar mensagens da IA (mantida da implementação anterior)
async function processAIMessage(userMessage: string, user: User): Promise<string> {
  try {
    // Simular processamento da IA
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const responses = [
      `Olá ${user.name}! Como posso ajudar você hoje?`,
      'Entendi sua mensagem. Vou processar essa informação.',
      'Isso é muito interessante! Conte-me mais sobre isso.',
      'Posso ajudar você com essa questão. Vamos resolver juntos!',
      'Obrigado por compartilhar isso comigo. Que mais você gostaria de saber?'
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  } catch (error) {
    logger.error('Erro ao processar mensagem da IA:', error);
    return 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
  }
}