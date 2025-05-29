import { Router } from 'express';
import { ChatService } from '../services/chatService';
import { authMiddleware } from '../middlewares/authMiddleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const chatService = new ChatService();

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/chat';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limite
  },
  fileFilter: (req, file, cb) => {
    // Tipos de arquivo permitidos
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'application/zip', 'application/x-rar-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

// Rota simples para testar
router.get('/test', (req, res) => {
  res.json({ message: 'Chat route working' });
});

// Endpoint para carregar mensagens entre dois usuários
router.get('/messages/:receiverId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const receiverId = req.params.receiverId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      res.status(401).json({ message: 'Usuário não autenticado' });
      return;
    }

    const result = await chatService.getMessages(userId, receiverId, page);
    
    res.json({
      messages: result.messages || [],
      hasMore: result.hasMore || false,
      totalPages: result.totalPages || 1,
      currentPage: page
    });
  } catch (error) {
    console.error('Erro ao carregar mensagens:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Endpoint para upload de arquivos
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { receiverId } = req.body;
    const file = req.file;

    if (!userId) {
      res.status(401).json({ message: 'Usuário não autenticado' });
      return;
    }

    if (!file) {
      res.status(400).json({ message: 'Nenhum arquivo enviado' });
      return;
    }

    if (!receiverId) {
      res.status(400).json({ message: 'ID do destinatário não fornecido' });
      return;
    }

    // Determinar tipo de arquivo
    const fileType = file.mimetype.startsWith('image/') ? 'image' : 'document';
    const fileUrl = `/uploads/chat/${file.filename}`;

    // Salvar mensagem com arquivo no banco de dados
    const message = await chatService.createFileMessage({
      senderId: userId,
      receiverId,
      fileName: file.originalname,
      fileUrl,
      fileType,
      fileSize: file.size
    });

    res.json({
      success: true,
      message: 'Arquivo enviado com sucesso',
      data: {
        messageId: message.id,
        fileName: file.originalname,
        fileUrl,
        fileType,
        fileSize: file.size
      }
    });

  } catch (error) {
    console.error('Erro no upload de arquivo:', error);
    
    // Remover arquivo se ocorreu erro
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Erro ao remover arquivo:', unlinkError);
      }
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ message: 'Arquivo muito grande. Máximo 10MB.' });
        return;
      }
    }

    res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

export default router;