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

// Verificação de ambiente e configurações
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = !!process.env.VERCEL;

console.log('=== INFORMAÇÕES DO AMBIENTE ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('É produção:', isProduction);
console.log('É Vercel:', isVercel);
console.log('DATABASE_URL configurado:', !!process.env.DATABASE_URL);
console.log('JWT_SECRET configurado:', !!process.env.JWT_SECRET);
console.log('===============================');

// Configuração de CORS melhorada
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://realchat-xi.vercel.app',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  process.env.FRONTEND_URL || ''
].filter(Boolean);

console.log('Origens permitidas pelo CORS:', allowedOrigins);

// Configuração do Socket.IO apenas se não estiver no Vercel
let io: Server | undefined;
if (!isVercel) {
  const server = createServer(app);
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    },
    allowEIO3: true
  });

  setupChatSocket(io);
  console.log('✅ Socket.IO configurado para desenvolvimento');
}

// Configuração do CORS
app.use(cors({
  origin: function (origin, callback) {
    console.log('🌐 Requisição de origem:', origin);
    
    // Permitir requisições sem origin (aplicativos móveis, Postman, etc.)
    if (!origin) {
      console.log('✅ Permitindo requisição sem origin');
      return callback(null, true);
    }
    
    if (allowedOrigins.some(allowed => origin.includes(allowed.replace('https://', '').replace('http://', '')))) {
      console.log('✅ Origem permitida:', origin);
      callback(null, true);
    } else {
      console.log('❌ Origem bloqueada pelo CORS:', origin);
      console.log('📋 Origens permitidas:', allowedOrigins);
      callback(null, true); // Temporariamente permitir todas as origens para debug
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
  optionsSuccessStatus: 200
}));

// Headers adicionais para CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Temporário para debug
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  
  // Responder a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    console.log('🔄 Respondendo a requisição OPTIONS');
    res.sendStatus(200);
    return;
  }
  next();
});

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de log para debug
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - Origin: ${req.headers.origin} - User-Agent: ${req.headers['user-agent']?.substring(0, 50)}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body keys:', Object.keys(req.body));
  }
  next();
});

// Rota de health check (deve vir antes das outras rotas)
app.get('/api/health', (req, res) => {
  console.log('💓 Health check solicitado');
  res.json({ 
    status: 'ok', 
    service: 'chat-api',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    isVercel: isVercel,
    databaseConfigured: !!process.env.DATABASE_URL,
    jwtConfigured: !!process.env.JWT_SECRET
  });
});

// Rota de teste
app.get('/api/test', (req, res) => {
  console.log('🧪 Rota de teste solicitada');
  res.json({ 
    message: 'Servidor funcionando!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    isVercel: isVercel,
    configs: {
      databaseConnected: !!process.env.DATABASE_URL,
      jwtSecret: !!process.env.JWT_SECRET
    }
  });
});

// Rotas principais
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Servir arquivos estáticos
if (!isVercel) {
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
}

// Middleware para capturar rotas não encontradas da API
app.use('/api/*', (req, res) => {
  console.log('❌ Rota da API não encontrada:', req.path);
  console.log('📋 Rotas disponíveis: /api/health, /api/test, /api/auth/*, /api/chat/*');
  res.status(404).json({ 
    error: 'Endpoint não encontrado',
    path: req.path,
    method: req.method,
    availableRoutes: ['/api/health', '/api/test', '/api/auth/*', '/api/chat/*']
  });
});

// Middleware global de tratamento de erros
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('💥 Erro global capturado:', error.message);
  console.error('📍 Stack:', error.stack);
  console.error('🌐 Request:', { method: req.method, path: req.path, origin: req.headers.origin });
  
  // Se a resposta já foi enviada, passe para o próximo middleware
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({ 
    message: 'Erro interno do servidor',
    error: isProduction ? 'Erro interno' : error.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
});

// Configuração para desenvolvimento local
if (!isVercel && !isProduction) {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    logger.info(`🚀 Servidor rodando na porta ${PORT}`);
    logger.info(`🌐 URL: http://localhost:${PORT}`);
    if (io) {
      logger.info(`🔌 Socket.IO ativo`);
    }
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM recebido, encerrando servidor...');
    server.close(() => {
      console.log('✅ Servidor encerrado');
    });
  });
}

export default app;


