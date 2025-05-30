import React, { useRef, useState } from 'react';
import { Upload, X, File, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-toastify';

interface FileUploadProps {
  onFileSelect: (file: File, type: 'image' | 'document') => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function FileUpload({ onFileSelect, onClose, isOpen }: FileUploadProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tamanho (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 10MB permitido.');
        return;
      }

      // Validar tipo de arquivo
      if (type === 'image') {
        if (!file.type.startsWith('image/')) {
          toast.error('Apenas arquivos de imagem são permitidos.');
          return;
        }
      }

      onFileSelect(file, type);
      onClose();
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      const type = file.type.startsWith('image/') ? 'image' : 'document';
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 10MB permitido.');
        return;
      }
      
      onFileSelect(file, type);
      onClose();
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Enviar Arquivo</h3>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Fechar"
            aria-label="Fechar modal de envio de arquivo"
          >
            <X size={18} className="sm:w-5 sm:h-5 text-gray-500" />
          </button>
        </div>

        {/* Área de drag and drop */}
        <div
          className={`border-2 border-dashed rounded-lg sm:rounded-xl p-6 sm:p-8 text-center transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload size={36} className="sm:w-12 sm:h-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 px-2">
            Arraste e solte um arquivo aqui ou clique nos botões abaixo
          </p>
          <p className="text-xs sm:text-sm text-gray-500">Máximo 10MB</p>
        </div>

        {/* Botões de seleção */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6">
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center justify-center space-x-2 py-2.5 sm:py-3 px-3 sm:px-4 bg-blue-500 text-white rounded-lg sm:rounded-xl hover:bg-blue-600 transition-colors text-sm sm:text-base"
          >
            <ImageIcon size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span>Imagem</span>
          </button>
          
          <button
            onClick={() => documentInputRef.current?.click()}
            className="flex items-center justify-center space-x-2 py-2.5 sm:py-3 px-3 sm:px-4 bg-green-500 text-white rounded-lg sm:rounded-xl hover:bg-green-600 transition-colors text-sm sm:text-base"
          >
            <File size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span>Documento</span>
          </button>
        </div>

        {/* Inputs ocultos */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e, 'image')}
          className="hidden"
          aria-label="Selecionar arquivo de imagem"
          title="Selecionar arquivo de imagem"
        />
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.zip,.rar"
          onChange={(e) => handleFileChange(e, 'document')}
          className="hidden"
          aria-label="Selecionar documento"
          title="Selecionar documento"
        />
      </div>
    </div>
  );
}