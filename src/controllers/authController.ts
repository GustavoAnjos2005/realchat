import { Request, Response } from 'express';
import { AuthService } from '../services/authService';

const authService = new AuthService();

export class AuthController {
    async register(req: Request, res: Response) {
        try {
            const { email, password, name } = req.body;

            if (!email || !password || !name) {
                return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
            }

            const result = await authService.register(email, password, name);
            return res.status(201).json(result);
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ message: 'Email e senha são obrigatórios' });
            }

            const result = await authService.login(email, password);
            return res.status(200).json(result);
        } catch (error: any) {
            return res.status(401).json({ message: error.message });
        }
    }
}