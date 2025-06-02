import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import logger from './utils/logger';
import setupChatSocket from './sockets/chatSocket';

const app = express();
const server = createServer(app);

// Configuração de CORS melhorada para desenvolvimento e produção
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  process.env.FRONTEND_URL || '',
  'https://realchat-xi.vercel.app'  // URL específica do seu projeto
].filter(Boolean);

console.log('Origens permitidas pelo CORS:', allowedOrigins);
console.log('DATABASE_URL configurado:', !!process.env.DATABASE_URL);
console.log('JWT_SECRET configurado:', !!process.env.JWT_SECRET);

// Configuração do Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

// Configurar handlers do Socket.IO
setupChatSocket(io);
console.log('✅ Socket.IO configurado com sucesso');

// Configuração detalhada do CORS
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requisições sem origin (aplicativos móveis, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Origem bloqueada pelo CORS:', origin);
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  credentials: true,
  optionsSuccessStatus: 200 // Para suportar navegadores legados
}));

// Headers adicionais para CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  
  // Responder a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servindo arquivos estáticos (ajustado para Vercel)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Middleware de log para todas as requisições
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Rota de teste simples
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Servidor funcionando!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    databaseConnected: !!process.env.DATABASE_URL
  });
});

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'chat-api' });
});

// Middleware para capturar rotas não encontradas
app.use('/api/*', (req, res) => {
  console.log('Rota não encontrada:', req.path);
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

// Middleware global de tratamento de erros
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erro global capturado:', error);
  console.error('Stack:', error.stack);
  
  // Se a resposta já foi enviada, passe para o próximo middleware
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({ 
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Apenas para desenvolvimento local
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    logger.info(`Servidor rodando na porta ${PORT}`);
    logger.info(`Socket.IO ativo em http://localhost:${PORT}`);
  });
}

// Para produção no Vercel, exportar o app
export default app;


