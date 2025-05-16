import express, { RequestHandler } from 'express';
import { AuthController } from '../controllers/authController';
import { authLimiter } from '../middlewares/authMiddleware';

const router = express.Router();
const authController = new AuthController();

// Convertendo os métodos para RequestHandler
const register: RequestHandler = async (req, res, next) => {
    try {
        await authController.register(req, res);
    } catch (error) {
        next(error);
    }
};

const login: RequestHandler = async (req, res, next) => {
    try {
        await authController.login(req, res);
    } catch (error) {
        next(error);
    }
};

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

export default router;