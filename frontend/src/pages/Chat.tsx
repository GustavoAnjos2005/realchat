import { useState, useEffect, useRef } from 'react';
import socketIOClient from 'socket.io-client';
import type { Message, User } from '../types/chat';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function Chat() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const socketRef = useRef<ReturnType<typeof socketIOClient> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!auth?.user) {
      navigate('/login');
      return;
    }

    const token = localStorage.getItem('token');
    socketRef.current = socketIOClient('http://localhost:3000', {
      auth: { token }
    });

    socketRef.current.on('connect', () => {
      console.log('Conectado ao servidor');
      socketRef.current?.emit('getOnlineUsers');
    });

    socketRef.current.on('connect_error', (error: Error) => {
      console.error('Erro de conexão:', error);
      if (error.message === 'Token inválido') {
        auth.logout();
      }
    });

    socketRef.current.on('message', (newMessage: Message) => {
      if (!auth?.user) return;
      
      setMessages(prev => {
        const messageExists = prev.some(msg => msg.id === newMessage.id);
        if (messageExists) return prev;
        
        const newMessages = [...prev, newMessage];
        // Ordenar mensagens por data
        return newMessages.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      
      // Rola para baixo apenas se a mensagem for do usuário atual ou do selecionado
      if (newMessage.senderId === auth.user.id || newMessage.senderId === selectedUser?.id) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    });

    socketRef.current.on('messageError', (error: { message: string }) => {
      setError(error.message);
      toast.error(error.message);
      setTimeout(() => setError(null), 5000);
    });

    socketRef.current.on('onlineUsers', (users: User[]) => {
      if (auth?.user) {
        const otherUsers = users.filter(u => u.id !== auth.user?.id);
        setOnlineUsers(otherUsers);
      }
    });

    socketRef.current.on('userOnline', () => { // Removido o parâmetro não utilizado
      socketRef.current?.emit('getOnlineUsers');
    });

    socketRef.current.on('userOffline', ({ userId }) => {
      setOnlineUsers(prev => prev.filter(user => user.id !== userId));
      
      // Se o usuário selecionado desconectou, limpa a seleção
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
        setMessages([]);
      }
    });

    socketRef.current.on('messageHistory', (result: { messages: Message[], hasMore: boolean }) => {
      setMessages(result.messages);
      setHasMoreMessages(result.hasMore);
      setError(''); // Limpa qualquer erro quando carrega histórico com sucesso
    });

    socketRef.current.on('hasMoreMessages', (hasMore: boolean) => {
      setHasMoreMessages(hasMore);
    });

    socketRef.current.on('userTyping', (data: { userId: string; isTyping: boolean }) => {
      if (selectedUser?.id === data.userId) {
        setIsTyping(data.isTyping);
      }
    });

    // Limpa a conexão quando o componente é desmontado
    return () => {
      socketRef.current?.disconnect();
    };
  }, [auth, navigate, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || !selectedUser || !socketRef.current || !auth?.user) {
      toast.warning('Selecione um usuário e digite uma mensagem');
      return;
    }

    try {
        const content = messageContent.trim();
        setMessageContent('');
        setIsSending(true);
        setError(null);

        // Removo o senderId pois ele será obtido do token no backend
        socketRef.current.emit('sendMessage', {
            receiverId: selectedUser.id,
            content: content
        }, (error: any) => {
            if (error) {
                setError(error.message);
                toast.error('Erro ao enviar mensagem: ' + error.message);
                setMessageContent(content);
            }
        });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        toast.error('Erro ao enviar mensagem. Tente novamente.');
    } finally {
        setIsSending(false);
    }
};

  const selectUser = (user: User) => {
    if (selectedUser?.id === user.id) return; // Evita recarregar se já está selecionado
    
    setSelectedUser(user);
    setMessages([]); // Limpa as mensagens ao trocar de usuário
    setError(''); // Limpa qualquer erro ao trocar de usuário
    setMessageContent(''); // Limpa o campo de mensagem
    socketRef.current?.emit('joinPrivateRoom', user.id);
    socketRef.current?.emit('fetchMessages', user.id);
  };

  const handleTyping = () => {
    if (!selectedUser || !socketRef.current) return;

    socketRef.current.emit('typing', { receiverId: selectedUser.id, isTyping: true });

    // Limpa o timeout anterior se existir
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Define um novo timeout
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { receiverId: selectedUser.id, isTyping: false });
    }, 2000);
  };

  const loadMoreMessages = async () => {
    if (!selectedUser || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      socketRef.current?.emit('fetchMessages', selectedUser.id, currentPage + 1);
      setCurrentPage(prev => prev + 1);
    } catch (error) {
      setError('Erro ao carregar mais mensagens');
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!socketRef.current || !selectedUser || !auth?.user) return;

    // Limpa as mensagens ao trocar de usuário
    setMessages([]);
    
    // Entra na sala privada com o usuário selecionado
    const roomId = [auth.user.id, selectedUser.id].sort().join('-');
    socketRef.current.emit('joinPrivateRoom', selectedUser.id);
    
    // Busca o histórico de mensagens
    socketRef.current.emit('fetchMessages', selectedUser.id);

    console.log('Entrando na sala:', roomId);
  }, [selectedUser, auth?.user]);

  const currentUser = auth?.user;
  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Barra lateral com informações do usuário e lista de usuários */}
      <div className="w-1/4 bg-white border-r flex flex-col">
        {/* Informações do usuário atual */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{currentUser.name}</h3>
              <p className="text-sm text-gray-500">{currentUser.email}</p>
            </div>
            <button
              onClick={() => auth.logout()}
              className="text-red-500 hover:text-red-700"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Lista de usuários online */}
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-xl font-bold mb-4">Usuários Online</h2>
          <div className="space-y-2">
            {onlineUsers.map(user => (
              <div
                key={user.id}
                className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${
                  selectedUser?.id === user.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => selectUser(user)}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                  <span>{user.name}</span>
                </div>
              </div>
            ))}
            {onlineUsers.length === 0 && (
              <p className="text-gray-500 text-center">
                Nenhum usuário online no momento
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Cabeçalho do chat */}
            <div className="bg-white p-4 border-b">
              <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {hasMoreMessages && (
                <div className="flex justify-center">
                  <button
                    onClick={loadMoreMessages}
                    disabled={isLoadingMore}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    {isLoadingMore ? 'Carregando...' : 'Carregar mensagens anteriores'}
                  </button>
                </div>
              )}

              {messages && messages.length > 0 ? (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-4 ${
                      msg.senderId === currentUser.id
                        ? 'flex justify-end'
                        : 'flex justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.senderId === currentUser.id
                          ? 'bg-blue-500 text-white'
                          : msg.isAIMessage
                          ? 'bg-purple-100 border border-purple-300'
                          : 'bg-gray-100'
                      }`}
                    >
                      {msg.isAIMessage && (
                        <div className="flex items-center mb-1 text-purple-600 text-xs font-medium">
                          <span className="mr-1">🤖</span>
                          Assistente IA
                        </div>
                      )}
                      <p className={`${
                        msg.senderId === currentUser.id
                          ? 'text-white'
                          : msg.isAIMessage
                          ? 'text-purple-900'
                          : 'text-gray-800'
                      }`}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-full">
                  <p className="text-gray-500">Nenhuma mensagem ainda</p>
                </div>
              )}
              <div ref={messagesEndRef} />
              
              {isTyping && (
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                </div>
              )}
            </div>

            {/* Area de erro */}
            {error && (
              <div className="p-2 bg-red-50 border-t border-b border-red-200">
                <p className="text-red-600 text-center text-sm">{error}</p>
              </div>
            )}

            {/* Input de mensagem */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={messageContent}
                  onChange={(e) => {
                    setMessageContent(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Digite sua mensagem... (Use /ai para falar com a IA)"
                  className="input-field flex-1"
                />
                <button type="submit" className="button-primary">
                  Enviar
                </button>
              </div>
            </form>

            {isSending && (
              <div className="text-gray-500 text-sm">Enviando mensagem...</div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">
              Selecione um usuário para iniciar uma conversa
            </p>
          </div>
        )}
      </div>
    </div>
  );
}