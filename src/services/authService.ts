import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export interface AuthResponse {
    token: string;
    user: {
        id: string;
        email: string;
        name: string;
    };
}

export class AuthService {
    async register(email: string, password: string, name: string): Promise<AuthResponse> {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name
            }
        });

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET!,
            { expiresIn: '24h' }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        };
    }

    async login(email: string, password: string): Promise<AuthResponse> {
        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            throw new Error('Senha inválida');
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET!,
            { expiresIn: '24h' }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        };
    }

    async validateToken(token: string) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
            return decoded;
        } catch (error) {
            throw new Error('Token inválido');
        }
    }
}
