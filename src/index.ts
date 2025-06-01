import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import logger from './utils/logger';

const app = express();

// Configuração de CORS para produção
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  process.env.FRONTEND_URL || '',
  'https://realchat-seven.vercel.app' // Adicione sua URL do Vercel aqui
].filter(Boolean);

// Middlewares
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servindo arquivos estáticos (ajustado para Vercel)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Rota de teste simples
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Servidor funcionando!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'chat-api' });
});

// Middleware para capturar rotas não encontradas
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

// Apenas para desenvolvimento local
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Servidor rodando na porta ${PORT}`);
  });
}

// Para produção no Vercel, exportar o app
export default app;


