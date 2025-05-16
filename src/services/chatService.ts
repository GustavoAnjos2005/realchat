import { PrismaClient } from '@prisma/client';
import { HfInference } from '@huggingface/inference';
import { createClient } from 'redis';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.error('Erro Redis:', err));
redisClient.on('connect', () => console.log('Conectado ao Redis'));

// Conecta ao Redis
redisClient.connect().catch(console.error);

// Inicializa o cliente do Hugging Face
// Você pode gerar um token gratuito em https://huggingface.co/settings/tokens
const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);

export class ChatService {
    private readonly AI_USER_ID = 'ai-assistant';
    private readonly AI_USER_NAME = 'AI Assistant';
    private readonly AI_USER_EMAIL = 'ai@assistant.com';
    private readonly MESSAGES_PER_PAGE = 50;

    constructor() {
        // Garante que o usuário AI existe assim que o serviço é inicializado
        this.ensureAIUser().catch(error => {
            console.error('Erro ao inicializar usuário AI:', error);
        });
    }

    private async ensureAIUser() {
        try {
            console.log('Verificando se usuário AI existe...');
            const aiUser = await prisma.user.findUnique({
                where: { id: this.AI_USER_ID }
            });

            if (!aiUser) {
                console.log('Usuário AI não encontrado, criando...');
                await prisma.user.create({
                    data: {
                        id: this.AI_USER_ID,
                        name: this.AI_USER_NAME,
                        email: this.AI_USER_EMAIL,
                        password: 'ai-user-no-login',
                        isOnline: true
                    }
                });
                console.log('Usuário AI criado com sucesso');
            } else {
                console.log('Usuário AI já existe');
            }
        } catch (error) {
            console.error('Erro ao garantir usuário AI:', error);
            throw error;
        }
    }

    async saveMessage(senderId: string, receiverId: string, content: string) {
        try {
            if (!senderId) {
                throw new Error('ID do remetente é obrigatório');
            }

            logger.info('Salvando mensagem', { senderId, receiverId });
            
            const message = await prisma.message.create({
                data: {
                    content,
                    sender: {
                        connect: { id: senderId }
                    },
                    receiver: {
                        connect: { id: receiverId }
                    },
                    isAIMessage: senderId === this.AI_USER_ID
                },
                include: {
                    sender: true,
                    receiver: true
                }
            });

            logger.info('Mensagem salva com sucesso', { messageId: message.id });
            return message;
        } catch (error) {
            logger.error('Erro ao salvar mensagem:', error);
            throw new Error('Não foi possível salvar a mensagem');
        }
    }

    async getMessages(userId1: string, userId2: string, page = 1) {
        try {
            const skip = (page - 1) * this.MESSAGES_PER_PAGE;
            const messages = await prisma.message.findMany({
                where: {
                    OR: [
                        { senderId: userId1, receiverId: userId2 },
                        { senderId: userId2, receiverId: userId1 }
                    ]
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: this.MESSAGES_PER_PAGE,
            });

            const totalCount = await prisma.message.count({
                where: {
                    OR: [
                        { senderId: userId1, receiverId: userId2 },
                        { senderId: userId2, receiverId: userId1 }
                    ]
                }
            });

            return {
                messages: messages.reverse(),
                hasMore: totalCount > skip + messages.length,
                totalPages: Math.ceil(totalCount / this.MESSAGES_PER_PAGE)
            };
        } catch (error) {
            console.error('Erro ao buscar mensagens:', error);
            throw new Error('Erro ao buscar mensagens');
        }
    }

    async generateAIResponse(message: string) {
        try {
            // Sistema simples de respostas baseado em palavras-chave
            const lowercaseMessage = message.toLowerCase();
            
            if (lowercaseMessage.includes('olá') || lowercaseMessage.includes('oi')) {
                return 'Olá! Como posso ajudar você hoje?';
            }
            
            if (lowercaseMessage.includes('como vai') || lowercaseMessage.includes('tudo bem')) {
                return 'Estou bem, obrigado por perguntar! Como posso ser útil?';
            }
            
            if (lowercaseMessage.includes('ajuda') || lowercaseMessage.includes('pode me ajudar')) {
                return 'Claro! Estou aqui para ajudar. O que você precisa?';
            }
            
            if (lowercaseMessage.includes('tchau') || lowercaseMessage.includes('até mais')) {
                return 'Até mais! Tenha um ótimo dia!';
            }
            
            if (lowercaseMessage.includes('obrigado') || lowercaseMessage.includes('valeu')) {
                return 'Por nada! Fico feliz em ajudar!';
            }

            // Resposta padrão para outras mensagens
            const respostasGenericas = [
                'Me desculpe, não entendi bem. Pode reformular sua pergunta?',
                'Hmm, interessante. Pode me dar mais detalhes sobre isso?',
                'Como posso te ajudar melhor com isso?',
                'Gostaria de saber mais sobre sua dúvida.',
                'Me conte mais sobre o que você precisa.'
            ];

            // Seleciona uma resposta aleatória
            const indiceAleatorio = Math.floor(Math.random() * respostasGenericas.length);
            return respostasGenericas[indiceAleatorio];

        } catch (error) {
            console.error('Erro ao gerar resposta:', error);
            return 'Desculpe, ocorreu um erro ao processar sua mensagem.';
        }
    }

    // Métodos auxiliares
    async setUserOnlineStatus(userId: string, isOnline: boolean) {
        try {
            // Primeiro verifica se o usuário existe
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                console.error(`Usuário não encontrado (ID: ${userId})`);
                return;
            }

            // Atualiza o status no Redis
            await redisClient.set(`user:${userId}:online`, isOnline.toString());
            
            // Atualiza o status no banco de dados
            await prisma.user.update({
                where: { id: userId },
                data: { isOnline }
            });

            console.log(`Status online atualizado para ${userId}: ${isOnline}`);
        } catch (error) {
            console.error('Erro ao atualizar status online:', error);
            throw error;
        }
    }

    async getUserOnlineStatus(userId: string) {
        const status = await redisClient.get(`user:${userId}:online`);
        return status === 'true';
    }

    async getOnlineUsers() {
        return await prisma.user.findMany({
            where: { isOnline: true },
            select: { id: true, name: true, email: true }
        });
    }

    getAIUserId() {
        return this.AI_USER_ID;
    }
}