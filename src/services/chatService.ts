import { PrismaClient } from '@prisma/client';
import { HfInference } from '@huggingface/inference';
import { createClient } from 'redis';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Configuração melhorada para Upstash Redis com fallback
let redisClient: any = null;
let redisConnected = false;
let redisInitialized = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

const initializeRedis = async () => {
    if (redisInitialized) return; // Evita múltiplas inicializações
    redisInitialized = true;

    try {
        if (!process.env.REDIS_URL) {
            console.log('⚠️ REDIS_URL não configurada, continuando sem cache Redis');
            return;
        }

        console.log('🔄 Inicializando Redis...');
        redisClient = createClient({
            url: process.env.REDIS_URL,
            socket: {
                reconnectStrategy: false // Desabilita reconexão automática
            }
        });

        redisClient.on('error', (err: Error) => {
            redisConnected = false;
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                console.log(`⚠️ Redis erro (tentativa ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}):`, err.message);
                reconnectAttempts++;
            }
            // Não tenta reconectar automaticamente
        });

        redisClient.on('connect', () => {
            redisConnected = true;
            reconnectAttempts = 0; // Reset counter on successful connection
            console.log('✅ Redis conectado com sucesso');
        });

        redisClient.on('end', () => {
            redisConnected = false;
            console.log('🔌 Redis desconectado');
        });

        // Tentativa única de conexão com timeout
        const connectPromise = redisClient.connect();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout na conexão Redis')), 5000);
        });

        await Promise.race([connectPromise, timeoutPromise]);
        
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.log('⚠️ Redis não disponível, aplicação continuará sem cache:', errorMessage);
        redisClient = null;
        redisConnected = false;
    }
};

// Funções auxiliares para Redis com fallback seguro
const setRedisValue = async (key: string, value: string): Promise<boolean> => {
    if (!redisClient || !redisConnected) return false;
    try {
        await redisClient.set(key, value);
        return true;
    } catch (error: unknown) {
        redisConnected = false; // Marca como desconectado em caso de erro
        return false;
    }
};

const getRedisValue = async (key: string): Promise<string | null> => {
    if (!redisClient || !redisConnected) return null;
    try {
        return await redisClient.get(key);
    } catch (error: unknown) {
        redisConnected = false; // Marca como desconectado em caso de erro
        return null;
    }
};

// Inicializar Redis
initializeRedis();

// Inicializa o cliente do Hugging Face
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
                    senderId,
                    receiverId,
                    isAIMessage: senderId === this.AI_USER_ID
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            profileImage: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            profileImage: true
                        }
                    }
                }
            });

            logger.info('Mensagem salva com sucesso', { messageId: message.id });
            return message;
        } catch (error) {
            logger.error('Erro ao salvar mensagem:', error);
            throw new Error('Não foi possível salvar a mensagem');
        }
    }

    async createFileMessage(data: {
        senderId: string;
        receiverId: string;
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
    }) {
        try {
            logger.info('Salvando mensagem com arquivo', { 
                senderId: data.senderId, 
                receiverId: data.receiverId,
                fileName: data.fileName 
            });
            
            const message = await prisma.message.create({
                data: {
                    content: `📎 ${data.fileName}`,
                    senderId: data.senderId,
                    receiverId: data.receiverId,
                    fileName: data.fileName,
                    fileUrl: data.fileUrl,
                    fileType: data.fileType,
                    fileSize: data.fileSize,
                    isAIMessage: false
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            profileImage: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            profileImage: true
                        }
                    }
                }
            });

            logger.info('Mensagem com arquivo salva com sucesso', { messageId: message.id });
            return message;
        } catch (error) {
            logger.error('Erro ao salvar mensagem com arquivo:', error);
            throw new Error('Não foi possível salvar a mensagem com arquivo');
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
                select: {
                    id: true,
                    content: true,
                    senderId: true,
                    receiverId: true,
                    fileName: true,
                    fileUrl: true,
                    fileType: true,
                    fileSize: true,
                    isAIMessage: true,
                    createdAt: true
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
            // Verifica se o usuário existe primeiro
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                console.error(`Usuário não encontrado (ID: ${userId})`);
                return;
            }

            // Verifica se o status realmente mudou
            if (user.isOnline === isOnline) {
                return; // Não faz nada se o status já está correto
            }

            // Tenta atualizar o status no Redis primeiro
            await setRedisValue(`user:${userId}:online`, isOnline.toString());
            
            // Em seguida, atualiza no banco de dados
            await prisma.user.update({
                where: { id: userId },
                data: { isOnline }
            });

            logger.info(`Status online atualizado para ${userId}: ${isOnline}`);
        } catch (error) {
            logger.error('Erro ao atualizar status online:', error);
            // Não joga erro para não quebrar o fluxo
        }
    }

    async getUserOnlineStatus(userId: string) {
        const status = await getRedisValue(`user:${userId}:online`);
        if (status === null) {
            // Fallback: buscar do banco de dados
            try {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { isOnline: true }
                });
                return user?.isOnline || false;
            } catch (error) {
                return false;
            }
        }
        return status === 'true';
    }

    async getOnlineUsers() {
        try {
            console.log('=== CHATSERVICE: getOnlineUsers chamado ===');
            
            // Retorna todos os usuários EXCETO o usuário IA (que será adicionado no frontend)
            const users = await prisma.user.findMany({
                where: {
                    id: { not: this.AI_USER_ID } // Exclui o usuário IA da lista
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    isOnline: true,
                    profileImage: true,
                    themeColor: true,
                    backgroundColor: true,
                    backgroundImage: true
                }
            });
            
            console.log('=== CHATSERVICE: Usuários encontrados ===');
            console.log('Total de usuários:', users.length);
            console.log('Usuários:', users.map((user: any) => ({ id: user.id, name: user.name, isOnline: user.isOnline })));
            
            return users;
        } catch (error) {
            console.error('=== CHATSERVICE: Erro no getOnlineUsers ===');
            console.error('Erro:', error);
            throw error;
        }
    }

    getAIUserId() {
        return this.AI_USER_ID;
    }
}