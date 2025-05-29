import { useRef, useEffect, useState } from 'react';
import EmojiPicker, { type EmojiClickData, Theme, EmojiStyle } from 'emoji-picker-react';
import './EmojiSelector.css';

interface EmojiSelectorProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
  position: { x: number; y: number };
}

export default function EmojiSelector({ onEmojiSelect, onClose, isOpen, position }: EmojiSelectorProps) {
  const selectorRef = useRef<HTMLDivElement>(null);
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  // Detectar se é mobile primeiro
  const isMobile = windowDimensions.width < 768;
  
  // Atualizar dimensões ao redimensionar a janela
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fechar ao clicar fora ou pressionar ESC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Corrigir duplicação de categorias em mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      const fixDuplicateCategories = () => {
        const container = selectorRef.current;
        if (!container) return;
        
        const categoryNavs = container.querySelectorAll('.emoji-picker-react .epr-category-nav');
        
        if (categoryNavs.length > 1) {
          for (let i = 1; i < categoryNavs.length; i++) {
            categoryNavs[i].remove();
          }
        }
      };
      
      const timerId = setTimeout(fixDuplicateCategories, 100);
      return () => clearTimeout(timerId);
    }
  }, [isOpen, isMobile]);

  if (!isOpen) return null;

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    onClose();
  };

  // Dimensões mais compactas para mobile
  const pickerWidth = isMobile ? 260 : 350;
  const pickerHeight = isMobile ? 260 : 400;

  // Calcular posição para desktop
  const calculateDesktopPosition = (): { left: number; bottom: number } => {
    const viewportWidth = windowDimensions.width;
    const viewportHeight = windowDimensions.height;
    
    let left = position.x - (pickerWidth / 2);
    let bottom = position.y + 15;
    
    if (left + pickerWidth > viewportWidth - 16) {
      left = viewportWidth - pickerWidth - 16;
    }
    
    if (left < 16) {
      left = 16;
    }
    
    if (bottom + pickerHeight > viewportHeight - 16) {
      bottom = viewportHeight - position.y + 15;
    }
    
    return { left, bottom };
  };

  const desktopPosition = calculateDesktopPosition();

  return (
    <>
      <div className="emoji-overlay" onClick={onClose} />

      <div
        ref={selectorRef}
        className={`emoji-container ${isMobile ? 'emoji-mobile' : 'emoji-desktop'}`}
        data-desktop-left={desktopPosition.left}
        data-desktop-bottom={desktopPosition.bottom}
        data-picker-width={pickerWidth}
      >
        {isMobile && (
          <div className="emoji-header">
            <span className="emoji-title">Escolha um emoji</span>
            <button 
              onClick={onClose}
              className="emoji-close-btn"
              aria-label="Fechar"
              title="Fechar seletor de emojis"
            >
              ✕
            </button>
          </div>
        )}
        
        <div className="emoji-picker-wrapper">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={pickerWidth}
            height={isMobile ? pickerHeight - 30 : pickerHeight}
            previewConfig={{ showPreview: false }}
            skinTonesDisabled={true}
            searchDisabled={isMobile}
            lazyLoadEmojis={true}
            emojiStyle={EmojiStyle.NATIVE}
            theme={Theme.LIGHT}
          />
        </div>
      </div>
    </>
  );
}