import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import setupChatSocket from './sockets/chatSocket';
import logger from './utils/logger';

const app = express();
const httpServer = createServer(app);

// Configuração de CORS para produção
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  process.env.FRONTEND_URL || ''
].filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middlewares
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servindo arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Configurar Socket.IO
setupChatSocket(io);
logger.info('Socket.IO configurado com sucesso');

// Rota de teste simples
app.get('/api/test', (req, res) => {
  res.json({ message: 'Servidor funcionando!' });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
});

// Para produção no Vercel, exportar o app
export default app;


