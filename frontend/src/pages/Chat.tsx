import React, { useState, useEffect, useRef } from 'react';
import socketIOClient from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { getProfileImageUrl } from '../services/api';
import UserSettings from '../components/UserSettings';
import FileUpload from '../components/FileUpload';
import EmojiSelector from '../components/EmojiSelector';
import CallModal from '../components/CallModal';
import { WebRTCService, type CallData, type CallUser } from '../services/webrtcService';
import type { Message, User } from '../types/chat';
import { toast } from 'react-toastify';
import { MessageCircle, Settings, LogOut, Send, ChevronDown, Search, Phone, Video, Smile, Paperclip, Download, FileText } from 'lucide-react';
import './Chat.css';
import { getSocketUrl } from '../services/webrtcService';

export default function Chat() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // State para upload de arquivo e emojis
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
  const [isEmojiSelectorOpen, setIsEmojiSelectorOpen] = useState(false);
  const [emojiSelectorPosition, setEmojiSelectorPosition] = useState({ x: 0, y: 0 });
  
  // State para chamadas WebRTC
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState<(CallData & { caller: CallUser }) | null>(null);
  const [callUser, setCallUser] = useState<User | null>(null);

  // Estado para mobile sidebar
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const socketRef = useRef<ReturnType<typeof socketIOClient> | null>(null);
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastMessageId = useRef<string>('');

  // Socket connection and event handlers
  useEffect(() => {
    console.log('=== DEBUG CHAT COMPONENT ===');
    console.log('1. Usuário do contexto:', user);
    console.log('2. Token no localStorage:', localStorage.getItem('token'));
    console.log('3. Usuário no localStorage:', localStorage.getItem('user'));

    const token = localStorage.getItem('token');
    if (!token) return undefined;

    console.log('Iniciando conexão socket...');
    socketRef.current = socketIOClient(getSocketUrl(), {
      auth: { token }
    });

    socketRef.current.on('connect', () => {
      console.log('Conectado ao servidor socket');
      
      // Inicializar serviço WebRTC
      if (socketRef.current) {
        webrtcServiceRef.current = new WebRTCService(socketRef.current);
        setupWebRTCCallbacks();
      }
      
      // Solicitar lista de usuários online
      console.log('Solicitando usuários online...');
      socketRef.current?.emit('getOnlineUsers');
      
      // Adicionar timeout para detectar se o servidor não responde
      setTimeout(() => {
        console.log('⚠️ TIMEOUT: Servidor não respondeu em 5 segundos');
        console.log('Verificando se há resposta do evento onlineUsers...');
      }, 5000);
    });

    socketRef.current.on('onlineUsers', (users: User[]) => {
      console.log('=== EVENTO ONLINE USERS RECEBIDO ===');
      console.log('Usuários online recebidos:', users);
      console.log('Tipo dos dados recebidos:', typeof users, Array.isArray(users));
      console.log('Quantidade de usuários:', users?.length);
      
      if (!Array.isArray(users)) {
        console.error('ERRO: Dados recebidos não são um array:', users);
        return;
      }
      
      // Adicionar o assistente IA à lista de usuários online
      const aiAssistant: User = {
        id: 'ai-assistant',
        name: 'Assistente IA',
        email: 'ai@assistant.com',
        profileImage: undefined,
        themeColor: '9333ea',
        backgroundImage: undefined,
        isOnline: true
      };
      
      const filteredUsers = users.filter(u => u.id !== user.id);
      const allUsers = [aiAssistant, ...filteredUsers];
      console.log('=== PROCESSAMENTO DOS USUÁRIOS ===');
      console.log('Usuários filtrados (sem o atual):', filteredUsers.length);
      console.log('Total de usuários (com IA):', allUsers.length);
      console.log('Lista final de usuários:', allUsers.map(u => ({ id: u.id, name: u.name, isOnline: u.isOnline })));
      setOnlineUsers(allUsers);
      console.log('Estado atualizado com sucesso!');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Erro de conexão socket:', error);
      toast.error('Erro ao conectar com o servidor');
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket desconectado:', reason);
    });

    // Eventos de usuários online/offline
    socketRef.current.on('userOnline', ({ userId }: { userId: string }) => {
      console.log('Usuário ficou online:', userId);
      socketRef.current?.emit('getOnlineUsers');
    });

    socketRef.current.on('userOffline', ({ userId }: { userId: string }) => {
      console.log('Usuário ficou offline:', userId);
      socketRef.current?.emit('getOnlineUsers');
    });

    // Eventos de mensagens
    socketRef.current.on('message', (message: Message) => {
      setMessages(prev => [...prev, message]);
      if (message.id !== lastMessageId.current) {
        lastMessageId.current = message.id;
        scrollToBottom();
      }
    });

    return () => {
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.endCall();
      }
      socketRef.current?.disconnect();
    };
  }, [user.id]);

  // useEffect separado para eventos de typing
  useEffect(() => {
    if (!socketRef.current) return undefined;

    const handleUserTyping = ({ userId, isTyping: typing }: { userId: string; isTyping: boolean }) => {
      if (selectedUser?.id === userId) {
        setIsTyping(typing);
      }
    };

    socketRef.current.on('userTyping', handleUserTyping);

    return () => {
      socketRef.current?.off('userTyping', handleUserTyping);
    };
  }, [selectedUser?.id]);

  // Configurar callbacks do WebRTC
  const setupWebRTCCallbacks = () => {
    if (!webrtcServiceRef.current) return;

    webrtcServiceRef.current.onIncomingCall = (callData: CallData & { caller: CallUser }) => {
      console.log('Chamada recebida:', callData);
      setIncomingCallData(callData);
      setCallUser({
        id: callData.caller.id,
        name: callData.caller.name,
        email: '',
        profileImage: callData.caller.profileImage,
        themeColor: '3b82f6', // cor padrão azul
        isOnline: true
      });
      setCallType(callData.type);
      setIsIncomingCall(true);
      setIsCallModalOpen(true);
      
      // Tocar som de chamada (opcional)
      toast.info(`Chamada ${callData.type === 'video' ? 'de vídeo' : 'de áudio'} recebida de ${callData.caller.name}`);
    };

    webrtcServiceRef.current.onCallRejected = () => {
      toast.info('Chamada recusada');
      setIsCallModalOpen(false);
      setIncomingCallData(null);
      setCallUser(null);
    };

    webrtcServiceRef.current.onCallEnded = () => {
      toast.info('Chamada encerrada');
      setIsCallModalOpen(false);
      setIncomingCallData(null);
      setCallUser(null);
    };

    webrtcServiceRef.current.onError = (error: string) => {
      toast.error(error);
      setIsCallModalOpen(false);
      setIncomingCallData(null);
      setCallUser(null);
    };
  };

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Apply theme classes when user changes
  useEffect(() => {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer && user) {
      // Apply background color
      if (user.backgroundColor) {
        chatContainer.className = chatContainer.className
          .split(' ')
          .filter(cls => !cls.startsWith('bg-'))
          .join(' ');
        chatContainer.classList.add(`bg-${user.backgroundColor}`);
      }
      
      // Apply theme color
      if (user.themeColor) {
        chatContainer.className = chatContainer.className
          .split(' ')
          .filter(cls => !cls.startsWith('theme-'))
          .join(' ');
        chatContainer.classList.add(`theme-${user.themeColor}`);
      }
    }
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const selectUser = async (targetUser: User) => {
    setSelectedUser(targetUser);
    setMessages([]);
    setCurrentPage(1);
    setHasMoreMessages(false);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/chat/messages/${targetUser.id}?page=1&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setHasMoreMessages(data.hasMore || false);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast.error('Erro ao carregar mensagens');
    }
  };

  const loadMoreMessages = async () => {
    if (!selectedUser || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/chat/messages/${selectedUser.id}?page=${currentPage + 1}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...(data.messages || []), ...prev]);
        setCurrentPage(prev => prev + 1);
        setHasMoreMessages(data.hasMore || false);
      }
    } catch (error) {
      console.error('Erro ao carregar mais mensagens:', error);
      toast.error('Erro ao carregar mais mensagens');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || !selectedUser || !socketRef.current || !user || isSending) {
      if (!selectedUser) toast.warning('Selecione um usuário para enviar mensagem');
      if (!messageContent.trim()) toast.warning('Digite uma mensagem');
      return;
    }

    try {
      const content = messageContent.trim();
      setMessageContent('');
      setIsSending(true);

      const textarea = document.querySelector('.message-textarea');
      if (textarea) {
        (textarea as HTMLTextAreaElement).style.height = 'auto';
      }

      socketRef.current.emit('sendMessage', {
        receiverId: selectedUser.id,
        content: content
      }, (error: any) => {
        if (error) {
          toast.error('Erro ao enviar mensagem: ' + error.message);
          setMessageContent(content);
        }
        setIsSending(false);
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem. Tente novamente.');
      setIsSending(false);
    }
  };

  const handleTyping = () => {
    if (!selectedUser || !socketRef.current) return;
    
    socketRef.current.emit('typing', { receiverId: selectedUser.id, isTyping: true });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { receiverId: selectedUser.id, isTyping: false });
    }, 1000);
  };

  const handleFileSelect = async (file: File, type: 'image' | 'document') => {
    if (!selectedUser) {
      toast.error('Selecione um usuário para enviar o arquivo');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('receiverId', selectedUser.id);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/chat/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        
        // Emitir via socket para atualização em tempo real
        if (socketRef.current) {
          socketRef.current.emit('fileUploaded', {
            receiverId: selectedUser.id,
            fileName: result.data.fileName,
            fileUrl: result.data.fileUrl,
            fileType: result.data.fileType,
            fileSize: result.data.fileSize
          });
        }
        
        toast.success(`${type === 'image' ? 'Imagem' : 'Arquivo'} enviado com sucesso!`);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erro ao enviar arquivo');
      }
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Erro ao enviar arquivo');
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageContent(prev => prev + emoji);
    setIsEmojiSelectorOpen(false);
  };

  const handleEmojiButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
      // Para mobile, posicionar no centro da tela
      setEmojiSelectorPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
    } else {
      // Para desktop, posicionar relativo ao botão
      setEmojiSelectorPosition({
        x: rect.left + rect.width / 2,
        y: window.innerHeight - rect.top
      });
    }
    setIsEmojiSelectorOpen(!isEmojiSelectorOpen);
  };

  // Funções de chamadas
  const handleAudioCall = () => {
    if (!selectedUser) {
      toast.error('Selecione um usuário para fazer a chamada');
      return;
    }
    if (selectedUser.id === 'ai-assistant') {
      toast.error('Não é possível fazer chamadas para o assistente IA');
      return;
    }
    setCallUser(selectedUser);
    setCallType('audio');
    setIsIncomingCall(false);
    setIncomingCallData(null);
    setIsCallModalOpen(true);
  };

  const handleVideoCall = () => {
    if (!selectedUser) {
      toast.error('Selecione um usuário para fazer a videochamada');
      return;
    }
    if (selectedUser.id === 'ai-assistant') {
      toast.error('Não é possível fazer chamadas para o assistente IA');
      return;
    }
    setCallUser(selectedUser);
    setCallType('video');
    setIsIncomingCall(false);
    setIncomingCallData(null);
    setIsCallModalOpen(true);
  };

  const handleCallModalClose = () => {
    setIsCallModalOpen(false);
    setIncomingCallData(null);
    setCallUser(null);
    setIsIncomingCall(false);
  };

  const renderFileMessage = (message: Message) => {
    if (!message.fileUrl) return null;

    const isImage = message.fileType === 'image';
    const fileUrl = `http://localhost:3000${message.fileUrl}`;

    return (
      <div className="mt-2">
        {isImage ? (
          <div className="relative">
            <img
              src={fileUrl}
              alt={message.fileName || 'Imagem'}
              className="max-w-xs rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(fileUrl, '_blank')}
            />
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              {message.fileName}
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3 p-3 bg-white/20 rounded-lg border border-white/10">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{message.fileName}</p>
              <p className="text-xs text-white/70">
                {message.fileSize ? `${(message.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Documento'}
              </p>
            </div>
            <button
              onClick={() => window.open(fileUrl, '_blank')}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              title="Baixar arquivo"
            >
              <Download size={16} className="text-white" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const filteredUsers = onlineUsers.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAvatarContent = (targetUser: User) => {
    if (targetUser.id === 'ai-assistant') {
      return <MessageCircle size={18} className="text-white" />;
    }
    return targetUser.name.charAt(0).toUpperCase();
  };

  const getAvatarBg = (targetUser: User) => {
    if (targetUser.id === 'ai-assistant') return 'bg-gradient-to-br from-purple-500 to-purple-600';
    const colors = [
      'bg-gradient-to-br from-blue-500 to-blue-600',
      'bg-gradient-to-br from-green-500 to-green-600', 
      'bg-gradient-to-br from-pink-500 to-pink-600',
      'bg-gradient-to-br from-yellow-500 to-yellow-600',
      'bg-gradient-to-br from-red-500 to-red-600',
      'bg-gradient-to-br from-indigo-500 to-indigo-600',
      'bg-gradient-to-br from-teal-500 to-teal-600'
    ];
    const index = targetUser.id.length % colors.length;
    return colors[index];
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
  };

  return (
    <div className={`chat-container h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex overflow-hidden ${user.backgroundColor ? `bg-${user.backgroundColor}` : ''} ${user.themeColor ? `theme-${user.themeColor}` : ''}`}>
      {/* Mobile Header - apenas visível em dispositivos móveis */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Abrir menu"
          >
            <MessageCircle size={20} className="text-gray-600" />
          </button>
          
          {selectedUser && (
            <div className="flex items-center space-x-3 flex-1 ml-4">
              <div className="relative">
                {selectedUser.profileImage ? (
                  <img
                    src={getProfileImageUrl(selectedUser.profileImage)}
                    alt={selectedUser.name}
                    className="w-8 h-8 rounded-full object-cover shadow-md"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-8 h-8 rounded-full ${getAvatarBg(selectedUser)} flex items-center justify-center text-white text-sm font-medium shadow-md ${selectedUser.profileImage ? 'hidden' : ''}`}>
                  {getAvatarContent(selectedUser)}
                </div>
                {selectedUser.isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border border-white"></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-gray-900 text-sm truncate">{selectedUser.name}</h3>
                <p className="text-xs text-gray-500">
                  {selectedUser.isOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          )}
          
          {selectedUser && selectedUser.id !== 'ai-assistant' && (
            <div className="flex items-center space-x-1">
              <button 
                onClick={handleAudioCall}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                aria-label="Ligar"
              >
                <Phone size={16} className="text-gray-600" />
              </button>
              <button 
                onClick={handleVideoCall}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                aria-label="Videochamada"
              >
                <Video size={16} className="text-gray-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-80 bg-white/80 backdrop-blur-xl border-r border-white/20 flex flex-col shadow-xl
        lg:relative lg:translate-x-0 lg:w-80
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:block
        max-w-[85vw] sm:max-w-sm
      `}>
        {/* Mobile close button */}
        <div className="lg:hidden flex justify-end p-4">
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>

        {/* Header do usuário */}
        <div className="p-4 lg:p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 lg:space-x-3 min-w-0">
              <div className="relative flex-shrink-0">
                {user.profileImage ? (
                  <img
                    src={getProfileImageUrl(user.profileImage)}
                    alt={user.name}
                    className="w-10 h-10 lg:w-12 lg:h-12 rounded-full object-cover shadow-lg border-2 border-white/20"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-semibold text-sm lg:text-lg shadow-lg ${user.profileImage ? 'hidden' : ''}`}>
                  {user.name.charAt(0)}
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 lg:w-4 lg:h-4 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm lg:text-lg truncate">{user.name}</h3>
                <p className="text-white/80 text-xs lg:text-sm">Online agora</p>
              </div>
            </div>
            <div className="flex space-x-1 lg:space-x-2">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 lg:p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 hover:scale-105"
                aria-label="Abrir configurações"
                title="Configurações"
              >
                <Settings size={16} className="lg:w-[18px] lg:h-[18px]" />
              </button>
              <button 
                onClick={logout}
                className="p-1.5 lg:p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 hover:scale-105"
                aria-label="Sair da conta"
                title="Sair"
              >
                <LogOut size={16} className="lg:w-[18px] lg:h-[18px]" />
              </button>
            </div>
          </div>
        </div>

        {/* Barra de pesquisa */}
        <div className="p-3 lg:p-4">
          <div className="relative">
            <Search size={16} className="lg:w-[18px] lg:h-[18px] absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 lg:pl-10 pr-4 py-2.5 lg:py-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200 text-sm"
            />
          </div>
        </div>

        {/* Lista de contatos */}
        <div className="flex-1 overflow-y-auto px-2">
          <div className="space-y-1">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-6 lg:py-8">
                <div className="text-gray-500 text-sm">
                  {onlineUsers.length === 0 ? (
                    <>
                      <div className="animate-pulse">
                        <div className="w-6 h-6 lg:w-8 lg:h-8 bg-gray-300 rounded-full mx-auto mb-2"></div>
                        <div className="h-3 lg:h-4 bg-gray-300 rounded w-20 lg:w-24 mx-auto"></div>
                      </div>
                      <p className="mt-2">Carregando usuários...</p>
                    </>
                  ) : (
                    <p>Nenhum usuário encontrado</p>
                  )}
                </div>
              </div>
            ) : (
              filteredUsers.map(contact => (
                <div
                  key={contact.id}
                  className={`p-3 lg:p-4 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] group relative ${
                    selectedUser?.id === contact.id 
                      ? 'bg-gradient-to-r from-blue-50 to-purple-50 shadow-md border border-blue-100' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    selectUser(contact);
                    setIsMobileSidebarOpen(false); // Fechar sidebar no mobile após seleção
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative flex-shrink-0">
                      {contact.profileImage ? (
                        <img
                          src={getProfileImageUrl(contact.profileImage)}
                          alt={contact.name}
                          className="w-10 h-10 lg:w-12 lg:h-12 rounded-full object-cover shadow-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full ${getAvatarBg(contact)} flex items-center justify-center text-white font-semibold shadow-lg text-sm lg:text-base ${contact.profileImage ? 'hidden' : ''}`}>
                        {getAvatarContent(contact)}
                      </div>
                      {contact.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 lg:w-4 lg:h-4 bg-green-400 rounded-full border-2 border-white shadow-sm animate-pulse"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-gray-900 truncate text-sm lg:text-base">{contact.name}</h4>
                      </div>
                      <div className="flex items-center justify-between mt-1 lg:mt-2">
                        <div className="flex items-center">
                          <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full mr-2 ${contact.isOnline ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                          <span className="text-xs text-gray-600">{contact.isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Área principal do chat */}
      <div className="flex-1 flex flex-col bg-white/50 backdrop-blur-sm mt-16 lg:mt-0">
        {selectedUser ? (
          <>
            {/* Header do chat - escondido no mobile */}
            <div className="hidden lg:flex h-20 px-6 bg-white/80 backdrop-blur-xl border-b border-white/20 items-center justify-between shadow-sm">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {selectedUser.profileImage ? (
                    <img
                      src={getProfileImageUrl(selectedUser.profileImage)}
                      alt={selectedUser.name}
                      className="w-12 h-12 rounded-full object-cover shadow-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-12 h-12 rounded-full ${getAvatarBg(selectedUser)} flex items-center justify-center text-white font-semibold shadow-lg ${selectedUser.profileImage ? 'hidden' : ''}`}>
                    {getAvatarContent(selectedUser)}
                  </div>
                  {selectedUser.isOnline && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{selectedUser.name}</h3>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${selectedUser.isOnline ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                    <span className="text-sm text-gray-600">
                      {selectedUser.isOnline ? 'Online agora' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {selectedUser.id !== 'ai-assistant' && (
                  <>
                    <button 
                      onClick={handleAudioCall}
                      className="p-3 rounded-full bg-gray-50 hover:bg-gray-100 transition-all duration-200 hover:scale-105"
                      aria-label="Ligar"
                      title="Fazer chamada"
                    >
                      <Phone size={18} className="text-gray-600" />
                    </button>
                    <button 
                      onClick={handleVideoCall}
                      className="p-3 rounded-full bg-gray-50 hover:bg-gray-100 transition-all duration-200 hover:scale-105"
                      aria-label="Videochamada"
                      title="Fazer videochamada"
                    >
                      <Video size={18} className="text-gray-600" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Área de mensagens */}
            <div className="flex-1 overflow-y-auto px-3 lg:px-6 py-3 lg:py-4 space-y-3 lg:space-y-4 bg-gradient-to-b from-transparent to-blue-50/30">
              {hasMoreMessages && (
                <div className="flex justify-center">
                  <button
                    onClick={loadMoreMessages}
                    disabled={isLoadingMore}
                    className="bg-white/80 backdrop-blur-sm px-3 lg:px-4 py-2 rounded-full shadow-sm border border-white/20 text-xs lg:text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1 disabled:opacity-50 transition-all duration-200 hover:scale-105"
                  >
                    <ChevronDown size={14} className="lg:w-4 lg:h-4" />
                    <span>{isLoadingMore ? 'Carregando...' : 'Carregar mensagens anteriores'}</span>
                  </button>
                </div>
              )}

              {/* Data separator */}
              <div className="flex items-center justify-center py-3 lg:py-4">
                <div className="bg-white/80 backdrop-blur-sm px-3 lg:px-4 py-1.5 lg:py-2 rounded-full shadow-sm border border-white/20">
                  <span className="text-xs lg:text-sm text-gray-600 font-medium">Hoje</span>
                </div>
              </div>

              {messages && messages.length > 0 ? (
                messages.map((msg, index) => (
                  <div 
                    key={msg.id} 
                    className={`flex items-end space-x-1.5 lg:space-x-2 animate-fadeInUp message-delay-${index % 10} ${
                      msg.senderId === user.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.senderId !== user.id && (
                      <div className="flex-shrink-0">
                        {selectedUser?.profileImage ? (
                          <img
                            src={getProfileImageUrl(selectedUser.profileImage)}
                            alt={selectedUser.name}
                            className="w-6 h-6 lg:w-8 lg:h-8 rounded-full object-cover shadow-md"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full ${getAvatarBg(selectedUser!)} flex items-center justify-center text-white text-xs lg:text-sm font-medium shadow-md ${selectedUser?.profileImage ? 'hidden' : ''}`}>
                          {getAvatarContent(selectedUser!)}
                        </div>
                      </div>
                    )}
                    
                    <div className={`max-w-[75%] lg:max-w-xs xl:max-w-md px-3 lg:px-4 py-2.5 lg:py-3 rounded-2xl shadow-lg backdrop-blur-sm transform transition-all duration-200 hover:scale-[1.02] ${
                      msg.senderId === user.id 
                        ? 'message-bubble-sent rounded-br-md' 
                        : msg.isAIMessage 
                          ? 'message-bubble-ai rounded-bl-md' 
                          : 'message-bubble-received rounded-bl-md border border-white/20'
                    }`}>
                      {msg.isAIMessage && (
                        <div className="text-xs font-medium text-purple-100 mb-1 flex items-center">
                          <MessageCircle size={10} className="lg:w-3 lg:h-3 mr-1" />
                          Assistente IA
                        </div>
                      )}
                      <p className="text-xs lg:text-sm leading-relaxed break-words">{msg.content}</p>
                      
                      {/* Render file if present */}
                      {renderFileMessage(msg)}
                      
                      <div className="flex justify-end mt-1.5 lg:mt-2">
                        <span className={`text-xs ${
                          msg.senderId === user.id || msg.isAIMessage ? 'text-white/70' : 'text-gray-500'
                        }`}>
                          
                        </span>
                      </div>
                    </div>

                    {msg.senderId === user.id && (
                      <div className="flex-shrink-0">
                        {user.profileImage ? (
                          <img
                            src={getProfileImageUrl(user.profileImage)}
                            alt={user.name}
                            className="w-6 h-6 lg:w-8 lg:h-8 rounded-full object-cover shadow-md"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs lg:text-sm font-medium shadow-md ${user.profileImage ? 'hidden' : ''}`}>
                          {user.name.charAt(0)}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-6 lg:p-8">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 lg:mb-6 shadow-xl">
                      <MessageCircle size={24} className="lg:w-8 lg:h-8 text-white" />
                    </div>
                    <h3 className="text-lg lg:text-2xl font-bold text-gray-900 mb-2">Início da conversa</h3>
                    <p className="text-sm lg:text-base text-gray-600">Nenhuma mensagem ainda</p>
                  </div>
                </div>
              )}

              {isTyping && (
                <div className="flex items-end space-x-1.5 lg:space-x-2 animate-fadeInUp">
                  <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full ${getAvatarBg(selectedUser)} flex items-center justify-center text-white text-xs lg:text-sm font-medium shadow-md`}>
                    {getAvatarContent(selectedUser)}
                  </div>
                  <div className="bg-white/90 backdrop-blur-sm rounded-2xl rounded-bl-md px-3 lg:px-4 py-2.5 lg:py-3 shadow-lg border border-white/20">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-gray-400 rounded-full typing-dot-delay-1 animate-bounce"></div>
                      <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-gray-400 rounded-full typing-dot-delay-2 animate-bounce"></div>
                      <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-gray-400 rounded-full typing-dot-delay-3 animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Form de envio */}
            <div className="p-3 lg:p-6 bg-white/80 backdrop-blur-xl border-t border-white/20">
              <div className="flex items-end space-x-2 lg:space-x-4">
                <div className="flex space-x-1 lg:space-x-2">
                  <button 
                    type="button"
                    onClick={() => setIsFileUploadOpen(true)}
                    className="p-2 lg:p-3 rounded-full bg-gray-50 hover:bg-gray-100 transition-all duration-200 hover:scale-105"
                    aria-label="Anexar arquivo"
                    title="Anexar arquivo"
                  >
                    <Paperclip size={16} className="lg:w-[18px] lg:h-[18px] text-gray-600" />
                  </button>
                </div>
                
                <div className="flex-1 relative">
                  <textarea
                    value={messageContent}
                    onChange={(e) => {
                      setMessageContent(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={handleTextareaKeyDown}
                    onInput={handleTextareaInput}
                    placeholder="Digite sua mensagem..."
                    rows={1}
                    className="message-textarea w-full px-3 lg:px-4 py-2.5 lg:py-3 pr-10 lg:pr-12 bg-gray-50 rounded-2xl border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200 resize-none text-sm"
                    disabled={isSending}
                  />
                  <button 
                    type="button"
                    onClick={handleEmojiButtonClick}
                    className="absolute right-2 lg:right-3 top-1/2 transform -translate-y-1/2 p-1.5 lg:p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                    aria-label="Adicionar emoji"
                    title="Adicionar emoji"
                  >
                    <Smile size={14} className="lg:w-4 lg:h-4 text-gray-400" />
                  </button>
                </div>
                
                <button 
                  onClick={handleSendMessage}
                  disabled={!messageContent.trim() || isSending}
                  className="send-button p-2.5 lg:p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Enviar mensagem"
                  title="Enviar mensagem"
                >
                  {isSending ? (
                    <div className="w-4 h-4 lg:w-[18px] lg:h-[18px] border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send size={16} className="lg:w-[18px] lg:h-[18px]" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 lg:mb-6 shadow-xl">
                <MessageCircle size={24} className="lg:w-8 lg:h-8 text-white" />
              </div>
              <h3 className="text-lg lg:text-2xl font-bold text-gray-900 mb-2">Bem-vindo ao Chat</h3>
              <p className="text-sm lg:text-base text-gray-600">Selecione uma conversa para começar a conversar</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de configurações */}
      {isSettingsOpen && (
        <UserSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}

      {/* Modal de upload de arquivo */}
      <FileUpload
        isOpen={isFileUploadOpen}
        onClose={() => setIsFileUploadOpen(false)}
        onFileSelect={handleFileSelect}
      />

      {/* Seletor de emojis */}
      <EmojiSelector
        isOpen={isEmojiSelectorOpen}
        onClose={() => setIsEmojiSelectorOpen(false)}
        onEmojiSelect={handleEmojiSelect}
        position={emojiSelectorPosition}
      />

      {/* Modal de chamadas */}
      {isCallModalOpen && callUser && (
        <CallModal
          isOpen={isCallModalOpen}
          onClose={handleCallModalClose}
          user={callUser}
          isVideoCall={callType === 'video'}
          isIncoming={isIncomingCall}
          webrtcService={webrtcServiceRef.current}
          callData={incomingCallData}
          onAccept={() => {
            toast.success(`Chamada ${callType === 'video' ? 'de vídeo' : 'de áudio'} aceita!`);
          }}
          onDecline={() => {
            toast.info('Chamada recusada');
          }}
        />
      )}
    </div>
  );
}