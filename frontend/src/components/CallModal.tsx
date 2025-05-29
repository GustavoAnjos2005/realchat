import { useState, useEffect, useRef } from 'react';
import { Phone, Video, PhoneOff, Mic, MicOff, Camera, CameraOff, X, Volume2, VolumeX } from 'lucide-react';
import { getProfileImageUrl } from '../services/api';
import { WebRTCService, type CallData } from '../services/webrtcService';
import type { User } from '../types/chat';
import { toast } from 'react-toastify';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  isVideoCall: boolean;
  isIncoming?: boolean;
  webrtcService?: WebRTCService | null;
  callData?: CallData | null;
  onAccept?: () => void;
  onDecline?: () => void;
}

export default function CallModal({ 
  isOpen, 
  onClose, 
  user, 
  isVideoCall, 
  isIncoming = false,
  webrtcService,
  callData,
  onAccept,
  onDecline 
}: CallModalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  const callInitiatedRef = useRef(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsConnected(false);
      setIsConnecting(false);
      setCallDuration(0);
      setConnectionStatus('');
      setHasLocalVideo(false);
      setHasRemoteVideo(false);
      callInitiatedRef.current = false;
      
      if (isIncoming) {
        setConnectionStatus('Chamada recebida');
      } else {
        setConnectionStatus('Iniciando chamada...');
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setCallDuration(0);
      setIsConnected(false);
      setIsConnecting(false);
      callInitiatedRef.current = false;
    }
  }, [isOpen, isIncoming]);

  // Simulated audio level detection
  useEffect(() => {
    if (isConnected && !isMuted) {
      const interval = setInterval(() => {
        setAudioLevel(Math.random() * 100);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setAudioLevel(0);
    }
  }, [isConnected, isMuted]);

  // Call duration timer
  useEffect(() => {
    if (isConnected) {
      intervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isConnected]);

  // WebRTC Service setup
  useEffect(() => {
    if (!webrtcService) return;

    const originalOnPeerConnected = webrtcService.onPeerConnected;
    const originalOnPeerDisconnected = webrtcService.onPeerDisconnected;
    const originalOnCallEnded = webrtcService.onCallEnded;
    const originalOnError = webrtcService.onError;

    webrtcService.onPeerConnected = () => {
      console.log('✅ CallModal: Peer conectado');
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionStatus('Conectado');
      
      // Sincronizar estados com o WebRTCService
      const currentMuteState = webrtcService.getCurrentMuteState();
      const currentVideoState = webrtcService.getCurrentVideoState();
      setIsMuted(currentMuteState);
      setIsVideoEnabled(currentVideoState);
      
      console.log(`🔄 CallModal: Sincronizando estados - muted: ${currentMuteState}, video: ${currentVideoState}`);
      
      toast.success('Chamada conectada!');
      originalOnPeerConnected?.();
    };

    webrtcService.onPeerDisconnected = () => {
      console.log('❌ CallModal: Peer desconectado');
      setIsConnected(false);
      setConnectionStatus('Conexão perdida');
      toast.warning('Conexão perdida');
      originalOnPeerDisconnected?.();
    };

    webrtcService.onCallEnded = () => {
      console.log('📴 CallModal: Chamada encerrada');
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus('Chamada encerrada');
      originalOnCallEnded?.();
      handleEndCall();
    };

    webrtcService.onError = (error: string) => {
      console.error('❌ CallModal: Erro na chamada:', error);
      setConnectionStatus('Erro na chamada');
      setIsConnecting(false);
      toast.error(error);
      originalOnError?.(error);
    };

    // Configurar referências de vídeo com verificação
    const setupVideoRefs = () => {
      if (localVideoRef.current) {
        console.log('📱 CallModal: Configurando referência de vídeo LOCAL');
        webrtcService.setLocalVideoRef(localVideoRef.current);
      }
      if (remoteVideoRef.current) {
        console.log('📺 CallModal: Configurando referência de vídeo REMOTO');
        webrtcService.setRemoteVideoRef(remoteVideoRef.current);
      }
    };

    // Configurar imediatamente e também após um pequeno delay para garantir que os elementos estão prontos
    setupVideoRefs();
    const timeoutId = setTimeout(setupVideoRefs, 100);

    return () => {
      clearTimeout(timeoutId);
      webrtcService.onPeerConnected = originalOnPeerConnected;
      webrtcService.onPeerDisconnected = originalOnPeerDisconnected;
      webrtcService.onCallEnded = originalOnCallEnded;
      webrtcService.onError = originalOnError;
    };
  }, [webrtcService, isOpen]);

  // Auto-initiate call for outgoing calls
  useEffect(() => {
    if (isOpen && !isIncoming && webrtcService && !callInitiatedRef.current && !isConnecting && !isConnected) {
      callInitiatedRef.current = true;
      setIsConnecting(true);
      setConnectionStatus('Conectando...');
      
      console.log('🚀 CallModal: Iniciando chamada automática');
      webrtcService.initiateCall(user.id, isVideoCall ? 'video' : 'audio')
        .catch((error) => {
          console.error('❌ CallModal: Erro ao iniciar chamada:', error);
          setIsConnecting(false);
          setConnectionStatus('Erro ao conectar');
          toast.error('Erro ao iniciar chamada');
        });
    }
  }, [isOpen, isIncoming, webrtcService, user.id, isVideoCall, isConnecting, isConnected]);

  // Monitor video refs for stream changes
  useEffect(() => {
    const localVideo = localVideoRef.current;
    const remoteVideo = remoteVideoRef.current;

    const checkLocalVideo = () => {
      setHasLocalVideo(!!localVideo?.srcObject);
    };

    const checkRemoteVideo = () => {
      setHasRemoteVideo(!!remoteVideo?.srcObject);
    };

    if (localVideo) {
      localVideo.addEventListener('loadedmetadata', checkLocalVideo);
      localVideo.addEventListener('loadstart', checkLocalVideo);
    }

    if (remoteVideo) {
      remoteVideo.addEventListener('loadedmetadata', checkRemoteVideo);
      remoteVideo.addEventListener('loadstart', checkRemoteVideo);
    }

    checkLocalVideo();
    checkRemoteVideo();

    return () => {
      if (localVideo) {
        localVideo.removeEventListener('loadedmetadata', checkLocalVideo);
        localVideo.removeEventListener('loadstart', checkLocalVideo);
      }
      if (remoteVideo) {
        remoteVideo.removeEventListener('loadedmetadata', checkRemoteVideo);
        remoteVideo.removeEventListener('loadstart', checkRemoteVideo);
      }
    };
  }, [isOpen]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAccept = async () => {
    if (!webrtcService || !callData) {
      console.error('❌ CallModal: WebRTC service ou callData não disponível para aceitar');
      return;
    }
    
    try {
      setIsConnecting(true);
      setConnectionStatus('Aceitando chamada...');
      console.log('✅ CallModal: Aceitando chamada...');
      
      await webrtcService.acceptCall(callData);
      onAccept?.();
    } catch (error) {
      console.error('❌ CallModal: Erro ao aceitar chamada:', error);
      setIsConnecting(false);
      setConnectionStatus('Erro ao aceitar');
      toast.error('Erro ao aceitar chamada');
    }
  };

  const handleDecline = () => {
    console.log('❌ CallModal: Rejeitando chamada');
    if (webrtcService && callData) {
      webrtcService.rejectCall(callData.from);
    }
    onDecline?.();
    handleEndCall();
  };

  const handleEndCall = () => {
    console.log('📴 CallModal: Encerrando chamada');
    if (webrtcService) {
      webrtcService.endCall();
    }
    setIsConnected(false);
    setIsConnecting(false);
    setCallDuration(0);
    setConnectionStatus('');
    callInitiatedRef.current = false;
    onClose();
  };

  const toggleMute = () => {
    if (webrtcService) {
      console.log('🔄 CallModal: Tentando alternar mute...');
      console.log('📱 Estado atual antes do toggle - isMuted:', isMuted);
      
      const muted = webrtcService.toggleMute();
      setIsMuted(muted);
      
      console.log(`🔇 CallModal: Estado após toggle - isMuted: ${muted}`);
      console.log('📊 CallModal: Verificação de referências de vídeo:');
      
      if (localVideoRef.current) {
        console.log(`📱 Vídeo LOCAL existe: ${!!localVideoRef.current.srcObject}`);
      }
      if (remoteVideoRef.current) {
        console.log(`📺 Vídeo REMOTO existe: ${!!remoteVideoRef.current.srcObject}`);
      }
      
      toast.info(muted ? 'Microfone mutado' : 'Microfone ativado');
    } else {
      console.error('❌ CallModal: WebRTC service não disponível para toggle mute');
    }
  };

  const toggleVideo = () => {
    if (webrtcService) {
      console.log('🔄 CallModal: Tentando alternar vídeo...');
      console.log('📹 Estado atual antes do toggle - isVideoEnabled:', isVideoEnabled);
      
      const videoDisabled = webrtcService.toggleVideo();
      setIsVideoEnabled(!videoDisabled);
      
      console.log(`📹 CallModal: Estado após toggle - isVideoEnabled: ${!videoDisabled}`);
      console.log('📊 CallModal: Verificação de referências de vídeo:');
      
      if (localVideoRef.current) {
        console.log(`📱 Vídeo LOCAL existe: ${!!localVideoRef.current.srcObject}`);
        console.log(`📱 Vídeo LOCAL visível: ${!videoDisabled ? 'SIM' : 'NÃO'}`);
      }
      if (remoteVideoRef.current) {
        console.log(`📺 Vídeo REMOTO existe: ${!!remoteVideoRef.current.srcObject}`);
      }
      
      toast.info(videoDisabled ? 'Câmera desligada' : 'Câmera ligada');
    } else {
      console.error('❌ CallModal: WebRTC service não disponível para toggle video');
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    toast.info(isSpeakerOn ? 'Alto-falante desligado' : 'Alto-falante ligado');
  };

  const getStatusText = () => {
    if (isIncoming && !isConnected && !isConnecting) {
      return `Chamada ${isVideoCall ? 'de vídeo' : 'de áudio'} recebida`;
    }
    if (isConnecting) {
      return connectionStatus || 'Conectando...';
    }
    if (isConnected) {
      return formatDuration(callDuration);
    }
    return connectionStatus || 'Chamando...';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background overlay */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={handleEndCall} 
      />
      
      {/* Main modal - responsive sizing */}
      <div className={`relative bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden w-full max-w-md mx-auto ${
        isVideoCall ? 'max-h-[85vh]' : 'max-h-[70vh]'
      }`}>
        
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm border-b border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* User avatar */}
              <div className="relative">
                {user.profileImage ? (
                  <img
                    src={getProfileImageUrl(user.profileImage)}
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold ${user.profileImage ? 'hidden' : ''}`}>
                  {user.name.charAt(0)}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-slate-900 ${
                  isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
                }`} />
              </div>

              {/* User info */}
              <div className="min-w-0">
                <h3 className="text-white font-medium text-sm truncate">{user.name}</h3>
                <p className="text-slate-300 text-xs">{getStatusText()}</p>
              </div>
            </div>

            {/* Header controls */}
            <div className="flex items-center space-x-1">
              <div className="flex items-center space-x-1 px-2 py-1 bg-slate-800/60 rounded-full text-xs text-slate-300">
                {isVideoCall ? <Video size={12} /> : <Phone size={12} />}
                <span className="hidden sm:inline">{isVideoCall ? 'Vídeo' : 'Áudio'}</span>
              </div>
              
              <button
                onClick={handleEndCall}
                className="p-1.5 rounded-full bg-slate-800/60 text-slate-300 hover:bg-red-500/60 transition-colors"
                title="Fechar"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Video area */}
        {isVideoCall && (
          <div className="relative bg-slate-900 aspect-[4/3]">
            {/* Remote video */}
            <video
              ref={remoteVideoRef}
              className={`w-full h-full object-cover ${hasRemoteVideo ? 'block' : 'hidden'}`}
              autoPlay
              playsInline
            />
            
            {/* Remote user placeholder */}
            <div className={`absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center ${hasRemoteVideo ? 'hidden' : 'block'}`}>
              <div className="text-center text-white">
                <div className="w-20 h-20 mx-auto mb-3 relative">
                  {user.profileImage ? (
                    <img
                      src={getProfileImageUrl(user.profileImage)}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover shadow-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg ${user.profileImage ? 'hidden' : ''}`}>
                    {user.name.charAt(0)}
                  </div>
                  {/* Animated ring for incoming calls */}
                  {isIncoming && !isConnected && (
                    <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping" />
                  )}
                </div>
                <p className="text-sm font-medium mb-1">{user.name}</p>
                <p className="text-xs text-slate-400">
                  {isConnected ? 'Aguardando vídeo...' : getStatusText()}
                </p>
              </div>
            </div>
            
            {/* Local video (PiP) */}
            <div className="absolute top-2 right-2 w-20 h-16 bg-slate-800 rounded-lg overflow-hidden border border-slate-600/50 shadow-lg">
              <video
                ref={localVideoRef}
                className={`w-full h-full object-cover ${hasLocalVideo && isVideoEnabled ? 'block' : 'hidden'}`}
                autoPlay
                playsInline
                muted
              />
              
              {(!hasLocalVideo || !isVideoEnabled) && (
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                  <CameraOff size={12} className="text-slate-400" />
                </div>
              )}

              {/* Local video status indicators */}
              {isMuted && (
                <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <MicOff size={8} className="text-white" />
                </div>
              )}
            </div>

            {/* Connection status overlay */}
            {isConnecting && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm">{connectionStatus}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audio call area */}
        {!isVideoCall && (
          <div className="py-8 bg-gradient-to-br from-slate-800 to-slate-900">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 relative">
                {user.profileImage ? (
                  <img
                    src={getProfileImageUrl(user.profileImage)}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover shadow-xl"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-xl ${user.profileImage ? 'hidden' : ''}`}>
                  {user.name.charAt(0)}
                </div>
                
                {/* Animated rings for different states */}
                {isIncoming && !isConnected && (
                  <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping" />
                )}
                
                {isConnected && !isMuted && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                    <div className={`w-2 h-2 bg-white rounded-full transition-transform duration-75 ${audioLevel > 50 ? 'scale-125' : 'scale-75'}`} />
                  </div>
                )}

                {isMuted && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                    <MicOff size={12} className="text-white" />
                  </div>
                )}
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1">{user.name}</h3>
              <p className="text-sm text-slate-300 mb-4">{getStatusText()}</p>
              
              {/* Audio visualizer */}
              {isConnected && !isMuted && (
                <div className="flex items-center justify-center space-x-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-0.5 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full transition-all duration-150 ${
                        i === 0 ? 'h-2' : i === 1 ? 'h-3' : i === 2 ? 'h-4' : i === 3 ? 'h-3' : 'h-2'
                      } ${audioLevel > 50 ? 'animate-pulse' : ''}`}
                    />
                  ))}
                </div>
              )}

              {isConnecting && (
                <div className="flex items-center justify-center space-x-1 mb-4">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50 p-4">
          <div className="flex items-center justify-center space-x-3">
            {(isConnected || isConnecting) && (
              <>
                {/* Mute button */}
                <button
                  onClick={toggleMute}
                  disabled={!isConnected}
                  className={`p-3 rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isMuted 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                  title={isMuted ? 'Desmutar' : 'Mutar'}
                >
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                {/* Speaker button (for audio calls) */}
                {!isVideoCall && (
                  <button
                    onClick={toggleSpeaker}
                    disabled={!isConnected}
                    className={`p-3 rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSpeakerOn 
                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                    title={isSpeakerOn ? 'Desligar alto-falante' : 'Ligar alto-falante'}
                  >
                    {isSpeakerOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                )}

                {/* Video toggle (for video calls) */}
                {isVideoCall && (
                  <button
                    onClick={toggleVideo}
                    disabled={!isConnected}
                    className={`p-3 rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                      !isVideoEnabled 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                    title={isVideoEnabled ? 'Desligar câmera' : 'Ligar câmera'}
                  >
                    {isVideoEnabled ? <Camera size={18} /> : <CameraOff size={18} />}
                  </button>
                )}

                {/* End call button */}
                <button
                  onClick={handleEndCall}
                  className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200 hover:scale-105"
                  title="Encerrar chamada"
                >
                  <PhoneOff size={18} />
                </button>
              </>
            )}

            {/* Incoming call controls */}
            {isIncoming && !isConnected && !isConnecting && (
              <>
                <button
                  onClick={handleDecline}
                  className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all duration-200 hover:scale-110"
                  title="Recusar chamada"
                >
                  <PhoneOff size={20} />
                </button>
                <button
                  onClick={handleAccept}
                  className="p-4 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg transition-all duration-200 hover:scale-110"
                  title="Aceitar chamada"
                >
                  {isVideoCall ? <Video size={20} /> : <Phone size={20} />}
                </button>
              </>
            )}

            {/* Outgoing call controls */}
            {!isIncoming && !isConnected && !isConnecting && (
              <button
                onClick={handleEndCall}
                className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200 hover:scale-105"
                title="Cancelar chamada"
              >
                <PhoneOff size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}