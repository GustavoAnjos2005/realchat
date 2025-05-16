import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth';
import { authMiddlewareSocket } from './middlewares/authMiddleware';
import setupChatSocket from './sockets/chatSocket';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173'], // Especificando exatamente a origem permitida
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173', // Especificando exatamente a origem permitida
    methods: ['GET', 'POST'],
    credentials: true,
    optionsSuccessStatus: 200 // Para compatibilidade com alguns navegadores
}));

// Rotas
app.use('/api/auth', authRoutes);

// Socket.IO middleware de autenticação
io.use(authMiddlewareSocket);

// Configura socket chat
setupChatSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

