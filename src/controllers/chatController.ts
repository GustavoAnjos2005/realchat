import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ChatService } from '../services/chatService';

const prisma = new PrismaClient();
const chatService = new ChatService();

// Configuração do multer para upload de arquivos do chat
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = file.mimetype.startsWith('image/') 
      ? 'uploads/chat/images' 
      : 'uploads/chat/documents';
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadChatFile = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'application/zip', 'application/x-rar-compressed'
    ];
    
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Tipo de arquivo não permitido'));
      return;
    }
    cb(null, true);
  }
}).single('file');

export class ChatController {
  async uploadFile(req: Request, res: Response) {
    const userId = (req as any).user.userId;

    uploadChatFile(req, res, async (err) => {
      if (err) {
        console.error('Erro no upload:', err);
        return res.status(400).json({ 
          message: err.message || 'Erro ao fazer upload do arquivo'
        });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      }

      try {
        const { receiverId } = req.body;
        
        if (!receiverId) {
          // Remove o arquivo se não há destinatário
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: 'ID do destinatário é obrigatório' });
        }

        // Determina o tipo de arquivo
        const isImage = req.file.mimetype.startsWith('image/');
        const fileType = isImage ? 'image' : 'document';
        
        // Cria a URL do arquivo
        const fileUrl = `/uploads/chat/${isImage ? 'images' : 'documents'}/${req.file.filename}`;
        
        // Cria o conteúdo da mensagem
        const content = isImage 
          ? `📷 Imagem: ${req.file.originalname}`
          : `📎 Arquivo: ${req.file.originalname}`;

        // Salva a mensagem com informações do arquivo
        const messageData: any = {
          content,
          senderId: userId,
          receiverId,
          isAIMessage: false
        };

        // Adiciona campos de arquivo se existem
        if (fileUrl) messageData.fileUrl = fileUrl;
        if (fileType) messageData.fileType = fileType;
        if (req.file?.originalname) messageData.fileName = req.file.originalname;
        if (req.file?.size) messageData.fileSize = req.file.size;

        const message = await prisma.message.create({
          data: messageData,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true
              }
            },
            receiver: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true
              }
            }
          }
        });

        res.json({ 
          message,
          fileUrl,
          fileType,
          fileName: req.file.originalname
        });
      } catch (error) {
        console.error('Erro ao salvar arquivo:', error);
        // Remove o arquivo se houver erro ao salvar no banco
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: 'Erro ao salvar arquivo' });
      }
    });
  }

  async getMessages(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { userId: targetUserId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      
      const result = await chatService.getMessages(userId, targetUserId, page);
      
      res.json(result);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      res.status(500).json({ message: 'Erro ao buscar mensagens' });
    }
  }
}