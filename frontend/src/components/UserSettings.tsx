import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getProfileImageUrl } from '../services/api';
import { FiX, FiCamera } from 'react-icons/fi';
import './UserSettings.css';

const UserSettings: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { user, updateUserProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const themeColors = [
    { id: 'dc2626', name: 'Vermelho', preview: 'color-preview-dc2626' },
    { id: '2563eb', name: 'Azul', preview: 'color-preview-2563eb' },
    { id: '16a34a', name: 'Verde', preview: 'color-preview-16a34a' },
    { id: '9333ea', name: 'Roxo', preview: 'color-preview-9333ea' },
    { id: 'ea580c', name: 'Laranja', preview: 'color-preview-ea580c' },
    { id: '0d9488', name: 'Teal', preview: 'color-preview-0d9488' },
    { id: 'be185d', name: 'Pink', preview: 'color-preview-be185d' },
    { id: '4f46e5', name: 'Índigo', preview: 'color-preview-4f46e5' },
    { id: 'd97706', name: 'Âmbar', preview: 'color-preview-d97706' },
    { id: '059669', name: 'Esmeralda', preview: 'color-preview-059669' },
    { id: '7c2d12', name: 'Marrom', preview: 'color-preview-7c2d12' },
    { id: '1e293b', name: 'Slate', preview: 'color-preview-1e293b' }
  ];

  const backgroundColors = [
    { id: 'white', name: 'Branco', cssClass: 'bg-white' },
    { id: 'slate-200', name: 'Cinza', cssClass: 'bg-slate-200' },
    { id: 'slate-300', name: 'Cinza Escuro', cssClass: 'bg-slate-300' },
    { id: 'red-200', name: 'Vermelho', cssClass: 'bg-red-200' },
    { id: 'blue-200', name: 'Azul', cssClass: 'bg-blue-200' },
    { id: 'green-200', name: 'Verde', cssClass: 'bg-green-200' },
    { id: 'purple-200', name: 'Roxo', cssClass: 'bg-purple-200' },
    { id: 'yellow-200', name: 'Amarelo', cssClass: 'bg-yellow-200' },
    { id: 'pink-200', name: 'Rosa', cssClass: 'bg-pink-200' },
    { id: 'indigo-200', name: 'Índigo', cssClass: 'bg-indigo-200' },
    { id: 'orange-200', name: 'Laranja', cssClass: 'bg-orange-200' },
    { id: 'teal-200', name: 'Teal', cssClass: 'bg-teal-200' }
  ];

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('profileImage', selectedFile);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/auth/upload-profile-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao fazer upload da imagem');
      }
      
      const data = await response.json();
      // Atualiza o usuário com a nova imagem através do contexto
      if (updateUserProfile) {
        await updateUserProfile({ profileImage: data.user.profileImage });
      }
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      alert('Erro ao fazer upload da imagem. Tente novamente.');
    }
  };

  const handleBackgroundSelect = async (colorId: string) => {
    try {
      if (updateUserProfile) {
        await updateUserProfile({ backgroundColor: colorId });
      }

      // Atualiza a classe do fundo do chat imediatamente
      const chatContainer = document.querySelector('.chat-container');
      if (chatContainer) {
        // Remove todas as classes de fundo existentes
        chatContainer.className = chatContainer.className
          .split(' ')
          .filter(cls => !cls.startsWith('bg-'))
          .join(' ');
        // Adiciona a nova classe de fundo
        chatContainer.classList.add(`bg-${colorId}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar a cor de fundo do chat:', error);
    }
  };

  const handleColorSelect = async (colorId: string) => {
    try {
      if (updateUserProfile) {
        await updateUserProfile({ themeColor: colorId });
      }

      // Atualiza a classe do tema imediatamente
      const chatContainer = document.querySelector('.chat-container');
      if (chatContainer) {
        // Remove todas as classes de tema existentes
        chatContainer.className = chatContainer.className
          .split(' ')
          .filter(cls => !cls.startsWith('theme-'))
          .join(' ');
        // Adiciona a nova classe de tema
        chatContainer.classList.add(`theme-${colorId}`);
      }

      // Também atualiza o body para consistência
      document.body.className = document.body.className
        .split(' ')
        .filter(cls => !cls.startsWith('theme-'))
        .join(' ');
      document.body.classList.add(`theme-${colorId}`);
    } catch (error) {
      console.error('Erro ao atualizar a cor do tema:', error);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b border-gray-200 bg-white sticky top-0 z-10">
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">Configurações</h2>
          <button 
            onClick={onClose} 
            className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors touch-target"
            aria-label="Fechar configurações"
            title="Fechar configurações"
          >
            <FiX size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 md:space-y-8">
          {/* Foto do Perfil */}
          <div>
            <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4 text-gray-900">Foto do Perfil</h3>
            <div className="flex flex-col items-center space-y-3 sm:space-y-4">
              <div className="relative">
                <div 
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden cursor-pointer group shadow-lg" 
                  onClick={handleImageClick}
                >
                  <img
                    src={previewUrl || getProfileImageUrl(user?.profileImage)}
                    alt="Foto do perfil"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('Erro ao carregar imagem:', e);
                      e.currentTarget.src = '/default-avatar.svg';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <FiCamera size={20} className="text-white" />
                  </div>
                </div>
                <button
                  onClick={handleImageClick}
                  className="absolute -bottom-1 -right-1 p-1.5 sm:p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                  title="Alterar foto do perfil"
                  aria-label="Alterar foto do perfil"
                >
                  <FiCamera size={12} className="sm:w-3 sm:h-3" />
                </button>
              </div>
              <span className="text-xs sm:text-sm text-gray-600 text-center">Clique para alterar foto</span>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                aria-label="Upload de foto do perfil"
                title="Selecionar nova foto de perfil"
              />
              
              {selectedFile && (
                <div className="w-full space-y-2 sm:space-y-3">
                  <p className="text-xs sm:text-sm text-gray-600 text-center truncate">{selectedFile.name}</p>
                  <button 
                    onClick={handleUpload} 
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Salvar nova foto
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cor do Tema */}
          <div>
            <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3 text-gray-900">Cor do Tema</h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
              Esta cor será usada nos botões e elementos principais da interface
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
              {themeColors.map((color) => (
                <div key={color.id} className="text-center">
                  <button
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-md transition-all duration-200 hover:scale-110 ${color.preview} ${
                      user?.themeColor === color.id ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    onClick={() => handleColorSelect(color.id)}
                    aria-label={`Selecionar cor ${color.name}`}
                  />
                  <span className="block text-xs mt-1 text-gray-600 truncate">{color.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cor de Fundo do Chat */}
          <div>
            <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3 text-gray-900">Cor de Fundo do Chat</h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
              Escolha uma cor para personalizar o fundo do chat
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
              {backgroundColors.map((color) => (
                <div key={color.id} className="text-center">
                  <button
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg shadow-md transition-all duration-200 hover:scale-110 border border-gray-200 ${color.cssClass} ${
                      user?.backgroundColor === color.id ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    onClick={() => handleBackgroundSelect(color.id)}
                    aria-label={`Selecionar cor de fundo ${color.name}`}
                  />
                  <span className="block text-xs mt-1 text-gray-600 truncate">{color.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;