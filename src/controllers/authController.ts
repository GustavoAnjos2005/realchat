import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const authService = new AuthService();

// Configuração mais robusta do Prisma
let prisma: PrismaClient;

const initializePrisma = () => {
  if (!prisma) {
    try {
      prisma = new PrismaClient({
        log: ['query', 'error', 'warn'],
        errorFormat: 'pretty',
      });
      console.log('✅ Prisma Client inicializado');
    } catch (error) {
      console.error('❌ Erro ao inicializar Prisma:', error);
      throw error;
    }
  }
  return prisma;
};

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Log das configurações importantes com mais detalhes
console.log('=== CONFIGURAÇÕES DA API ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('JWT_SECRET configurado:', !!process.env.JWT_SECRET);
console.log('DATABASE_URL configurado:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  const provider = dbUrl.startsWith('postgresql://') ? 'PostgreSQL' : 
                   dbUrl.startsWith('mysql://') ? 'MySQL' : 
                   dbUrl.includes('.db') ? 'SQLite' : 'Desconhecido';
  console.log('Tipo do banco:', provider);
}
console.log('===============================');

// Configuração do multer para upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/profiles';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Tipo de arquivo não permitido'));
      return;
    }
    cb(null, true);
  }
}).single('profileImage');

export class AuthController {
    async register(req: Request, res: Response) {
        let client: PrismaClient | null = null;
        
        try {
            console.log('🔄 Iniciando processo de registro...');
            console.log('📦 Dados recebidos:', { 
                email: req.body.email, 
                name: req.body.name,
                hasPassword: !!req.body.password
            });
            
            const { email, password, name } = req.body;

            // Validação básica
            if (!email || !password || !name) {
                console.log('❌ Dados faltando no registro');
                return res.status(400).json({ 
                    message: 'Email, senha e nome são obrigatórios',
                    details: { email: !!email, password: !!password, name: !!name }
                });
            }

            // Validação de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                console.log('❌ Email inválido:', email);
                return res.status(400).json({ message: 'Email inválido' });
            }

            // Validação de senha
            if (password.length < 6) {
                console.log('❌ Senha muito curta');
                return res.status(400).json({ message: 'Senha deve ter pelo menos 6 caracteres' });
            }

            // Inicializar Prisma
            client = initializePrisma();
            
            // Teste de conexão com o banco
            console.log('🔄 Testando conexão com o banco...');
            await client.$connect();
            console.log('✅ Conexão com banco estabelecida');

            // Verificar se o usuário já existe
            console.log('🔄 Verificando se email já existe...');
            const existingUser = await client.user.findUnique({ where: { email } });
            if (existingUser) {
                console.log('❌ Email já existe:', email);
                return res.status(400).json({ message: 'Email já cadastrado' });
            }

            // Hash da senha
            console.log('🔄 Gerando hash da senha...');
            const hashedPassword = await bcrypt.hash(password, 10);

            // Criar usuário
            console.log('🔄 Criando usuário no banco...');
            const user = await client.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    profileImage: true,
                    themeColor: true,
                    backgroundColor: true,
                    backgroundImage: true,
                    isOnline: true,
                    createdAt: true
                }
            });

            console.log('✅ Usuário criado com sucesso:', user.id);

            // Gerar token JWT
            console.log('🔄 Gerando token JWT...');
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

            console.log('✅ Registro concluído com sucesso');
            res.status(201).json({ 
                user, 
                token,
                message: 'Conta criada com sucesso!'
            });

        } catch (error: any) {
            console.error('❌ Erro detalhado ao registrar:', error);
            console.error('📍 Stack completo:', error.stack);
            
            // Tratamento específico de erros do Prisma
            if (error.code === 'P2002') {
                return res.status(400).json({ message: 'Email já cadastrado' });
            }
            
            if (error.code === 'P1001') {
                return res.status(500).json({ message: 'Erro de conexão com o banco de dados' });
            }

            res.status(500).json({ 
                message: 'Erro interno do servidor ao criar conta',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno',
                code: error.code || 'UNKNOWN_ERROR'
            });
        } finally {
            if (client) {
                try {
                    await client.$disconnect();
                    console.log('🔌 Desconectado do banco');
                } catch (error) {
                    console.error('❌ Erro ao desconectar do banco:', error);
                }
            }
        }
    }

    async login(req: Request, res: Response) {
        let client: PrismaClient | null = null;
        
        try {
            console.log('🔄 Iniciando processo de login...');
            console.log('📦 Dados recebidos:', { email: req.body.email });
            
            const { email, password } = req.body;

            // Validação básica
            if (!email || !password) {
                console.log('❌ Dados faltando no login');
                return res.status(400).json({ 
                    message: 'Email e senha são obrigatórios',
                    details: { email: !!email, password: !!password }
                });
            }

            // Inicializar Prisma
            client = initializePrisma();
            
            // Teste de conexão com o banco
            console.log('🔄 Testando conexão com o banco...');
            await client.$connect();
            console.log('✅ Conexão com banco estabelecida para login');

            // Buscar usuário
            console.log('🔄 Buscando usuário...');
            const user = await client.user.findUnique({ where: { email } });
            if (!user) {
                console.log('❌ Usuário não encontrado:', email);
                return res.status(401).json({ message: 'Email ou senha incorretos' });
            }

            // Verificar senha
            console.log('🔄 Verificando senha...');
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                console.log('❌ Senha incorreta para:', email);
                return res.status(401).json({ message: 'Email ou senha incorretos' });
            }

            // Gerar token JWT
            console.log('🔄 Gerando token JWT...');
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

            // Atualizar status online
            await client.user.update({
                where: { id: user.id },
                data: { isOnline: true }
            });

            console.log('✅ Login realizado com sucesso:', user.id);

            const { password: _, ...userWithoutPassword } = user;
            res.json({ 
                user: userWithoutPassword, 
                token,
                message: 'Login realizado com sucesso!'
            });

        } catch (error: any) {
            console.error('❌ Erro detalhado ao fazer login:', error);
            console.error('📍 Stack completo:', error.stack);
            
            // Tratamento específico de erros do Prisma
            if (error.code === 'P1001') {
                return res.status(500).json({ message: 'Erro de conexão com o banco de dados' });
            }

            res.status(500).json({ 
                message: 'Erro interno do servidor ao fazer login',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno',
                code: error.code || 'UNKNOWN_ERROR'
            });
        } finally {
            if (client) {
                try {
                    await client.$disconnect();
                    console.log('🔌 Desconectado do banco');
                } catch (error) {
                    console.error('❌ Erro ao desconectar do banco:', error);
                }
            }
        }
    }

    async validate(req: Request, res: Response) {
        try {
            // O middleware já validou o token, então apenas retornamos sucesso
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ message: 'Token inválido' });
            }

            // Buscar dados atualizados do usuário
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profileImage: true,
                    themeColor: true,
                    backgroundColor: true,
                    backgroundImage: true,
                    isOnline: true
                }
            });

            if (!user) {
                return res.status(401).json({ message: 'Usuário não encontrado' });
            }

            return res.status(200).json({ user });
        } catch (error: any) {
            return res.status(401).json({ message: 'Token inválido' });
        }
    }

    async updateProfile(req: Request, res: Response) {
        try {
            const userId = (req as any).user.userId;
            const { themeColor, backgroundColor, backgroundImage } = req.body;
            const updateData: any = {};

            if (themeColor) updateData.themeColor = themeColor;
            if (backgroundColor) updateData.backgroundColor = backgroundColor;
            if (backgroundImage !== undefined) updateData.backgroundImage = backgroundImage;

            const user = await prisma.user.update({
                where: { id: userId },
                data: updateData
            });

            const { password: _, ...userWithoutPassword } = user;
            res.json({ user: userWithoutPassword });
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            res.status(500).json({ message: 'Erro ao atualizar perfil' });
        }
    }

    async uploadProfileImage(req: Request, res: Response) {
        const userId = (req as any).user.userId; // Corrigido de .user.id para .user.userId

        upload(req, res, async (err) => {
            if (err) {
                console.error('Erro no upload:', err);
                return res.status(400).json({ 
                    message: err.message || 'Erro ao fazer upload da imagem'
                });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'Nenhum arquivo enviado' });
            }

            try {
                // Cria a URL da imagem
                const imageUrl = `/uploads/profiles/${req.file.filename}`;

                // Atualiza o usuário com a nova imagem
                const user = await prisma.user.update({
                    where: { id: userId },
                    data: { profileImage: imageUrl }
                });

                const { password: _, ...userWithoutPassword } = user;
                res.json({ 
                    user: userWithoutPassword,
                    imageUrl 
                });
            } catch (error) {
                console.error('Erro ao salvar imagem:', error);
                // Remove o arquivo se houver erro ao salvar no banco
                fs.unlinkSync(req.file.path);
                res.status(500).json({ message: 'Erro ao salvar imagem' });
            }
        });
    }
}