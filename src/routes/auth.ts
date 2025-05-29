import express, { RequestHandler } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

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

const updateProfile: RequestHandler = async (req, res, next) => {
    try {
        await authController.updateProfile(req, res);
    } catch (error) {
        next(error);
    }
};

const uploadProfileImage: RequestHandler = async (req, res, next) => {
    try {
        await authController.uploadProfileImage(req, res);
    } catch (error) {
        next(error);
    }
};

const validate: RequestHandler = async (req, res, next) => {
    try {
        await authController.validate(req, res);
    } catch (error) {
        next(error);
    }
};

// Rotas públicas
router.post('/register', register);
router.post('/login', login);

// Rotas protegidas
router.use(authMiddleware as RequestHandler);
router.get('/validate', validate);
router.patch('/update', updateProfile);
router.post('/upload-profile-image', uploadProfileImage);

export default router;