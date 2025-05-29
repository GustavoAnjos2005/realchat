import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const authService = new AuthService();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
        try {
            const { email, password, name } = req.body;

            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res.status(400).json({ message: 'Email já cadastrado' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name
                }
            });

            const token = jwt.sign({ userId: user.id }, JWT_SECRET);

            const { password: _, ...userWithoutPassword } = user;
            res.status(201).json({ user: userWithoutPassword, token });
        } catch (error) {
            console.error('Erro ao registrar:', error);
            res.status(500).json({ message: 'Erro ao criar conta' });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.status(401).json({ message: 'Email ou senha incorretos' });
            }

            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ message: 'Email ou senha incorretos' });
            }

            const token = jwt.sign({ userId: user.id }, JWT_SECRET);

            const { password: _, ...userWithoutPassword } = user;
            res.json({ user: userWithoutPassword, token });
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            res.status(500).json({ message: 'Erro ao fazer login' });
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