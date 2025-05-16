import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { AuthService } from '../services/authService';
import rateLimit from 'express-rate-limit';

declare module 'express-serve-static-core' {
    interface Request {
        user?: {
            userId: string;
        };
    }
}

const authService = new AuthService();

// Rate limiting configuration
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limite de 100 requisições por IP
    message: 'Muitas requisições deste IP, por favor tente novamente após 15 minutos'
});

// Rate limiting específico para autenticação
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5, // limite de 5 tentativas por IP
    message: 'Muitas tentativas de login, por favor tente novamente após 1 hora'
});

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'Token não fornecido' });
        }

        const decoded = await authService.validateToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido' });
    }
};

export const authMiddlewareSocket = async (
    socket: Socket,
    next: (err?: ExtendedError | undefined) => void
) => {
    try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
            return next(new Error('Token não fornecido'));
        }

        const decoded = await authService.validateToken(token);
        socket.data.user = decoded;
        next();
    } catch (error) {
        next(new Error('Token inválido'));
    }
};