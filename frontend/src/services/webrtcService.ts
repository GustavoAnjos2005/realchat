import type { Socket } from 'socket.io-client';

export interface CallData {
  from: string;
  to: string;
  signal: any;
  type: 'audio' | 'video';
}

export interface CallUser {
  id: string;
  name: string;
  profileImage?: string;
}

// Configuração da URL do Socket baseada no ambiente
const getSocketURL = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:3000'
      : `${window.location.protocol}//${window.location.host}`;
  }
  return 'http://localhost:3000';
};

export class WebRTCService {
  private socket: Socket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteVideoRef: HTMLVideoElement | null = null;
  private localVideoRef: HTMLVideoElement | null = null;
  private isInitiator: boolean = false;
  private isCallInProgress: boolean = false;
  private lastCallAttempt: number = 0;
  private readonly CALL_COOLDOWN = 2000; // Reduzido para 2 segundos
  private pendingIceCandidates: RTCIceCandidate[] = [];
  private isMuted: boolean = false;
  private isVideoDisabled: boolean = false;
  
  // Event callbacks
  public onIncomingCall: ((data: CallData & { caller: CallUser }) => void) | null = null;
  public onCallAccepted: (() => void) | null = null;
  public onCallRejected: (() => void) | null = null;
  public onCallEnded: (() => void) | null = null;
  public onPeerConnected: (() => void) | null = null;
  public onPeerDisconnected: (() => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }

  private isSocketReady(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('incoming-call', (data: CallData & { caller: CallUser }) => {
      console.log('📞 Chamada recebida:', data);
      // Limpar qualquer chamada anterior antes de processar a nova
      if (this.peerConnection) {
        this.cleanup();
      }
      this.onIncomingCall?.(data);
    });

    this.socket.on('call-accepted', async (data: { signal: any }) => {
      console.log('✅ Chamada aceita, processando sinal:', data);
      if (this.peerConnection && data.signal) {
        try {
          if (data.signal.type === 'answer') {
            console.log('📋 Processando answer do aceite da chamada');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
            console.log('✅ Answer processado com sucesso');
            
            // Processar ICE candidates pendentes
            await this.processPendingIceCandidates();
          } else if (data.signal.candidate) {
            console.log('🧊 Processando ICE candidate do aceite');
            await this.addIceCandidate(data.signal);
          }
        } catch (error) {
          console.error('❌ Erro ao processar sinal aceito:', error);
          this.onError?.(`Erro ao processar resposta da chamada: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      }
      this.onCallAccepted?.();
    });

    this.socket.on('call-rejected', () => {
      console.log('❌ Chamada rejeitada');
      this.cleanup();
      this.onCallRejected?.();
    });

    this.socket.on('call-ended', () => {
      console.log('📴 Chamada encerrada pelo servidor');
      this.cleanup();
      this.onCallEnded?.();
    });

    this.socket.on('ice-candidate', async (candidate: any) => {
      console.log('🧊 ICE candidate recebido:', candidate);
      await this.addIceCandidate(candidate);
    });

    this.socket.on('call-error', (error: { message: string }) => {
      console.error('❌ Erro na chamada recebido do servidor:', error);
      this.onError?.(error.message);
      this.cleanup();
    });
  }

  private async addIceCandidate(candidate: any) {
    if (!this.peerConnection) {
      console.warn('⚠️ Tentativa de adicionar ICE candidate sem peer connection');
      return;
    }

    try {
      const iceCandidate = new RTCIceCandidate(candidate);
      
      if (this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(iceCandidate);
        console.log('✅ ICE candidate adicionado com sucesso');
      } else {
        console.log('⏳ ICE candidate adicionado à lista de pendentes');
        this.pendingIceCandidates.push(iceCandidate);
      }
    } catch (error) {
      console.error('❌ Erro ao adicionar ICE candidate:', error);
    }
  }

  private async processPendingIceCandidates() {
    if (this.pendingIceCandidates.length === 0) return;

    console.log(`📋 Processando ${this.pendingIceCandidates.length} ICE candidates pendentes`);
    
    for (const candidate of this.pendingIceCandidates) {
      try {
        if (this.peerConnection) {
          await this.peerConnection.addIceCandidate(candidate);
        }
      } catch (error) {
        console.error('❌ Erro ao processar ICE candidate pendente:', error);
      }
    }
    
    this.pendingIceCandidates = [];
    console.log('✅ ICE candidates pendentes processados');
  }

  async initiateCall(userId: string, type: 'audio' | 'video'): Promise<void> {
    try {
      // Verificar cooldown
      const now = Date.now();
      if (now - this.lastCallAttempt < this.CALL_COOLDOWN) {
        console.warn('⏱️ Tentativa de chamada muito frequente, aguarde...');
        return;
      }
      this.lastCallAttempt = now;

      // Verificar se já há uma chamada em progresso
      if (this.isCallInProgress) {
        console.warn('⚠️ Já há uma chamada em progresso');
        return;
      }

      console.log('🚀 === INICIANDO CHAMADA ===');
      console.log('👤 UserId:', userId, '📹 Tipo:', type);
      
      // Verificações básicas
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('WebRTC não está disponível neste navegador');
      }

      if (!window.RTCPeerConnection) {
        throw new Error('RTCPeerConnection não está disponível neste navegador');
      }
      
      if (!this.isSocketReady()) {
        throw new Error('Socket não está conectado');
      }
      
      // Limpar estado anterior
      this.cleanup();
      this.isCallInProgress = true;
      this.isInitiator = true;
      
      // Obter mídia local
      console.log('🎥 Obtendo mídia local...');
      this.localStream = await this.getLocalMedia(type);
      console.log('✅ Mídia local obtida:', this.localStream.getTracks().map(t => t.kind));
      
      // Criar peer connection
      console.log('🔗 Criando RTCPeerConnection...');
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      });

      // Configurar listeners
      this.setupPeerConnectionListeners(userId);
      
      // Adicionar tracks
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          console.log(`➕ Adicionando track: ${track.kind}`);
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Atribuir stream local usando o novo método
      this.assignLocalStream();

      // Criar offer
      console.log('📋 Criando offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video'
      });

      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Offer criado e definido como descrição local');

      // Enviar offer
      this.socket!.emit('call-user', {
        to: userId,
        signal: offer,
        type
      });
      console.log('📤 Offer enviado com sucesso');

    } catch (error) {
      console.error('❌ === ERRO AO INICIAR CHAMADA ===');
      console.error('Erro:', error);
      
      this.isCallInProgress = false;
      this.onError?.(`Erro ao iniciar chamada: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      this.cleanup();
    }
  }

  async acceptCall(callData: CallData): Promise<void> {
    try {
      console.log('✅ Aceitando chamada de:', callData.from);
      
      if (!this.isSocketReady()) {
        throw new Error('Socket não está conectado');
      }
      
      // Limpar estado anterior
      this.cleanup();
      this.isInitiator = false;
      this.isCallInProgress = true;
      
      // Obter mídia local
      console.log('🎥 Obtendo mídia local para aceitar chamada...');
      this.localStream = await this.getLocalMedia(callData.type);
      console.log('✅ Mídia local obtida para aceitar:', this.localStream.getTracks().map(t => t.kind));
      
      // Criar peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      });

      // Configurar listeners
      this.setupPeerConnectionListeners(callData.from);
      
      // Adicionar tracks
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          console.log(`➕ Adicionando track para aceitar: ${track.kind}`);
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Atribuir stream local usando o novo método
      this.assignLocalStream();

      // Processar offer recebido
      if (callData.signal?.type === 'offer') {
        console.log('📋 Processando offer recebido...');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(callData.signal));
        
        // Processar ICE candidates pendentes
        await this.processPendingIceCandidates();
        
        // Criar answer
        console.log('📋 Criando answer...');
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        // Enviar answer
        this.socket!.emit('accept-call', {
          to: callData.from,
          signal: answer
        });
        console.log('📤 Answer enviado com sucesso');
      }

    } catch (error) {
      console.error('❌ Erro ao aceitar chamada:', error);
      this.onError?.(`Erro ao aceitar chamada: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      this.rejectCall(callData.from);
    }
  }

  private setupPeerConnectionListeners(remoteUserId: string): void {
    if (!this.peerConnection) return;

    // ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.isSocketReady()) {
        console.log('🧊 Enviando ICE candidate');
        
        const candidateData = {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid
        };

        if (this.isInitiator) {
          this.socket!.emit('call-user', {
            to: remoteUserId,
            signal: candidateData,
            type: 'ice-candidate'
          });
        } else {
          this.socket!.emit('ice-candidate', {
            to: remoteUserId,
            candidate: candidateData
          });
        }
      }
    };

    // Stream remoto recebido
    this.peerConnection.ontrack = (event) => {
      console.log('📺 Stream remoto recebido:', event.streams);
      if (event.streams?.[0]) {
        if (this.remoteVideoRef) {
          this.remoteVideoRef.srcObject = event.streams[0];
          this.remoteVideoRef.play().catch(console.warn);
        }
        this.onPeerConnected?.();
      }
    };

    // Estado da conexão
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔗 Estado da conexão peer:', state);
      
      if (state === 'connected') {
        console.log('✅ Peer conectado com sucesso');
      } else if (state === 'disconnected' || state === 'failed') {
        console.log('❌ Peer desconectado');
        this.onPeerDisconnected?.();
      }
    };

    // ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('🧊 Estado ICE:', state);
      
      if (state === 'failed') {
        this.onError?.('Falha na conexão ICE - problemas de rede');
        this.endCall();
      }
    };
  }

  rejectCall(userId: string): void {
    console.log('❌ Rejeitando chamada de:', userId);
    
    if (this.isSocketReady()) {
      this.socket!.emit('reject-call', { to: userId });
    }
    
    this.cleanup();
  }

  endCall(): void {
    console.log('📴 Encerrando chamada');
    
    if (this.isSocketReady()) {
      this.socket!.emit('end-call');
    }
    
    this.cleanup();
  }

  private cleanup(): void {
    console.log('🧹 Limpando estado da chamada');
    
    // Parar stream local
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`⏹️ Track ${track.kind} parado`);
      });
      this.localStream = null;
    }

    // Fechar peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Limpar referências de vídeo
    if (this.localVideoRef) {
      this.localVideoRef.srcObject = null;
    }
    if (this.remoteVideoRef) {
      this.remoteVideoRef.srcObject = null;
    }

    // Reset do estado
    this.isInitiator = false;
    this.isCallInProgress = false;
    this.pendingIceCandidates = [];
  }

  async getLocalMedia(type: 'audio' | 'video'): Promise<MediaStream> {
    console.log(`🎥 Solicitando mídia: ${type}`);
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log(`📱 Dispositivos - Audio: ${audioDevices.length}, Video: ${videoDevices.length}`);
      
      if (audioDevices.length === 0) {
        throw new Error('Nenhum dispositivo de áudio encontrado');
      }

      // Para videochamadas, primeiro tentar com vídeo, depois fallback para áudio
      if (type === 'video' && videoDevices.length > 0) {
        // Configurações para vídeo (com fallbacks)
        const videoConstraintOptions: MediaStreamConstraints[] = [
          {
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: { 
              width: { ideal: 640 }, 
              height: { ideal: 480 }, 
              frameRate: { ideal: 30 },
              facingMode: 'user'
            }
          },
          {
            audio: { echoCancellation: true },
            video: { 
              width: { ideal: 320 }, 
              height: { ideal: 240 },
              facingMode: 'user'
            }
          },
          {
            audio: true,
            video: { facingMode: 'user' }
          },
          {
            audio: true,
            video: true
          }
        ];

        // Tentar cada configuração de vídeo
        for (let i = 0; i < videoConstraintOptions.length; i++) {
          const constraints = videoConstraintOptions[i];
          console.log(`🔄 Tentativa de VÍDEO ${i + 1}:`, constraints);
          
          try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const hasVideo = stream.getVideoTracks().length > 0;
            const hasAudio = stream.getAudioTracks().length > 0;
            
            console.log(`✅ Stream de VÍDEO obtido - Video: ${hasVideo}, Audio: ${hasAudio}`);
            
            if (hasVideo && hasAudio) {
              console.log('🎉 Stream completo com áudio e vídeo obtido com sucesso!');
              return stream;
            } else if (hasAudio) {
              console.warn('⚠️ Obtido apenas áudio, continuando tentativas...');
              stream.getTracks().forEach(track => track.stop());
            }
            
          } catch (error) {
            console.warn(`❌ Tentativa de VÍDEO ${i + 1} falhou:`, error);
            
            // Se o erro for relacionado à câmera, logar mais detalhes
            if (error instanceof Error) {
              if (error.name === 'NotReadableError') {
                console.warn('📷 Câmera pode estar sendo usada por outro aplicativo');
              } else if (error.name === 'NotAllowedError') {
                console.warn('🚫 Permissão de câmera negada');
              } else if (error.name === 'NotFoundError') {
                console.warn('📷 Câmera não encontrada');
              }
            }
          }
        }

        console.log('⚠️ Não foi possível obter vídeo, tentando apenas áudio...');
      }

      // Fallback para áudio apenas (sempre tentar)
      const audioConstraintOptions: MediaStreamConstraints[] = [
        {
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        },
        {
          audio: { echoCancellation: true },
          video: false
        },
        {
          audio: true,
          video: false
        }
      ];

      for (let i = 0; i < audioConstraintOptions.length; i++) {
        const constraints = audioConstraintOptions[i];
        console.log(`🔄 Tentativa de ÁUDIO ${i + 1}:`, constraints);
        
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          const hasAudio = stream.getAudioTracks().length > 0;
          
          console.log(`✅ Stream de ÁUDIO obtido - Audio: ${hasAudio}`);
          
          if (hasAudio) {
            if (type === 'video') {
              console.warn('⚠️ Videochamada iniciada apenas com áudio (câmera indisponível)');
            }
            return stream;
          }
          
        } catch (error) {
          console.warn(`❌ Tentativa de ÁUDIO ${i + 1} falhou:`, error);
          
          if (i === audioConstraintOptions.length - 1) {
            throw error;
          }
        }
      }
      
      throw new Error('Não foi possível obter áudio nem vídeo');
      
    } catch (error) {
      console.error('❌ Erro ao obter mídia:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Permissão negada para câmera/microfone. Clique no ícone na barra de endereços e permita o acesso.');
        } else if (error.name === 'NotFoundError') {
          throw new Error('Câmera ou microfone não encontrados.');
        } else if (error.name === 'NotReadableError') {
          throw new Error('Câmera está sendo usada por outro aplicativo. Feche outros programas que possam estar usando a câmera.');
        } else if (error.name === 'OverconstrainedError') {
          throw new Error('Configurações de câmera não suportadas pelo dispositivo.');
        }
      }
      
      throw error;
    }
  }

  setLocalVideoRef(videoElement: HTMLVideoElement): void {
    console.log('🎥 === CONFIGURANDO VÍDEO DO PRÓPRIO USUÁRIO (LOCAL) ===');
    console.log(`📱 Este elemento mostrará SEU próprio vídeo`);
    console.log(`📱 Elemento recebido:`, videoElement);
    console.log(`📱 ID/classe do elemento:`, videoElement.id, videoElement.className);
    
    this.localVideoRef = videoElement;
    
    // Configurar propriedades do elemento
    videoElement.muted = true; // IMPORTANTE: mutar o vídeo local para evitar feedback de áudio
    videoElement.playsInline = true;
    videoElement.autoplay = true;
    
    // Atribuir stream se disponível
    this.assignLocalStream();
  }

  setRemoteVideoRef(videoElement: HTMLVideoElement): void {
    console.log('📺 === CONFIGURANDO VÍDEO DO OUTRO USUÁRIO (REMOTO) ===');
    console.log(`📺 Este elemento mostrará o vídeo do OUTRO usuário`);
    console.log(`📺 Elemento recebido:`, videoElement);
    console.log(`📺 ID/classe do elemento:`, videoElement.id, videoElement.className);
    
    this.remoteVideoRef = videoElement;
    
    // Configurar propriedades do elemento
    videoElement.playsInline = true;
    videoElement.autoplay = true;
    
    // O stream remoto será atribuído quando recebido via ontrack
    console.log('✅ Vídeo REMOTO configurado - stream será recebido via WebRTC');
  }

  private assignLocalStream(): void {
    if (this.localVideoRef && this.localStream) {
      console.log('🔄 === ATRIBUINDO SEU PRÓPRIO VÍDEO ===');
      console.log(`📊 Seu stream tem ${this.localStream.getTracks().length} tracks:`, this.localStream.getTracks().map(t => `${t.kind}: enabled=${t.enabled}`));
      
      // Verificar se o stream já está atribuído corretamente
      if (this.localVideoRef.srcObject === this.localStream) {
        console.log('✅ Seu vídeo já está sendo exibido corretamente');
        return;
      }
      
      try {
        this.localVideoRef.srcObject = this.localStream;
        
        // Aguardar o elemento estar pronto e reproduzir
        this.localVideoRef.onloadedmetadata = () => {
          console.log('✅ Seu vídeo está pronto para exibição');
          this.localVideoRef?.play().catch(error => {
            console.warn('⚠️ Erro ao reproduzir seu vídeo:', error);
          });
        };
        
        console.log('✅ Seu vídeo foi atribuído ao elemento correto');
        
        // Verificação adicional após um pequeno delay
        setTimeout(() => {
          if (this.localVideoRef && this.localVideoRef.srcObject === this.localStream) {
            console.log('✅ CONFIRMAÇÃO: Seu vídeo continua sendo exibido');
          } else {
            console.error('❌ ERRO: Perdeu a exibição do seu vídeo! Tentando reconectar...');
            this.assignLocalStream(); // Tentar reatribuir
          }
        }, 500);
        
      } catch (error) {
        console.error('❌ Erro ao exibir seu vídeo:', error);
      }
    } else {
      if (!this.localVideoRef) {
        console.log('⚠️ Elemento para seu vídeo ainda não está disponível');
      }
      if (!this.localStream) {
        console.log('⚠️ Seu stream de vídeo ainda não está disponível');
      }
    }
  }

  toggleMute(): boolean {
    console.log('🔇 === ALTERANDO SEU MICROFONE ===');
    
    if (!this.localStream) {
      console.warn('⚠️ Não é possível alterar microfone - stream não disponível');
      return this.isMuted;
    }
    
    const audioTracks = this.localStream.getAudioTracks();
    console.log(`🎤 Tracks de áudio do SEU microfone: ${audioTracks.length}`);
    
    if (audioTracks.length === 0) {
      console.warn('⚠️ Nenhum track de áudio encontrado no seu stream');
      return this.isMuted;
    }
    
    const audioTrack = audioTracks[0];
    console.log(`🎤 Estado atual do SEU microfone ANTES: ${audioTrack.enabled ? 'ATIVADO' : 'MUTADO'}`);
    
    // Alternar o estado do track
    const newEnabledState = !audioTrack.enabled;
    audioTrack.enabled = newEnabledState;
    this.isMuted = !newEnabledState;
    
    console.log(`🎤 Estado do SEU microfone DEPOIS: ${audioTrack.enabled ? 'ATIVADO' : 'MUTADO'}`);
    console.log(`🔇 Resultado: Você está ${this.isMuted ? 'MUTADO' : 'COM ÁUDIO ATIVO'}`);
    
    // Verificar se a mudança foi efetiva
    setTimeout(() => {
      const checkTrack = this.localStream?.getAudioTracks()[0];
      if (checkTrack) {
        const statusCheck = checkTrack.enabled ? 'ATIVADO' : 'MUTADO';
        const expectedStatus = newEnabledState ? 'ATIVADO' : 'MUTADO';
        console.log(`🔍 VERIFICAÇÃO: Seu microfone está ${statusCheck} (esperado: ${expectedStatus})`);
        
        if (checkTrack.enabled !== newEnabledState) {
          console.error('❌ ERRO: Estado do microfone não foi alterado! Tente novamente.');
        }
      }
    }, 100);
    
    return this.isMuted;
  }

  toggleVideo(): boolean {
    console.log('📹 === ALTERANDO SUA CÂMERA ===');
    
    if (!this.localStream) {
      console.warn('⚠️ Não é possível alterar câmera - stream não disponível');
      return this.isVideoDisabled;
    }
    
    const videoTracks = this.localStream.getVideoTracks();
    console.log(`🎥 Tracks de vídeo da SUA câmera: ${videoTracks.length}`);
    
    if (videoTracks.length === 0) {
      console.warn('⚠️ Nenhum track de vídeo encontrado - tentando ativar câmera...');
      this.addVideoToCall();
      return this.isVideoDisabled;
    }
    
    const videoTrack = videoTracks[0];
    console.log(`🎥 Estado atual da SUA câmera ANTES: ${videoTrack.enabled ? 'LIGADA' : 'DESLIGADA'}`);
    
    // Alternar o estado do track
    const newEnabledState = !videoTrack.enabled;
    videoTrack.enabled = newEnabledState;
    this.isVideoDisabled = !newEnabledState;
    
    console.log(`🎥 Estado da SUA câmera DEPOIS: ${videoTrack.enabled ? 'LIGADA' : 'DESLIGADA'}`);
    console.log(`📹 Resultado: Sua câmera está ${this.isVideoDisabled ? 'DESLIGADA' : 'LIGADA'}`);
    
    // Verificar se a mudança foi efetiva
    setTimeout(() => {
      const checkTrack = this.localStream?.getVideoTracks()[0];
      if (checkTrack) {
        const statusCheck = checkTrack.enabled ? 'LIGADA' : 'DESLIGADA';
        const expectedStatus = newEnabledState ? 'LIGADA' : 'DESLIGADA';
        console.log(`🔍 VERIFICAÇÃO: Sua câmera está ${statusCheck} (esperado: ${expectedStatus})`);
        
        if (checkTrack.enabled !== newEnabledState) {
          console.error('❌ ERRO: Estado da câmera não foi alterado! Tente novamente.');
        }
      }
    }, 100);
    
    return this.isVideoDisabled;
  }

  private async addVideoToCall(): Promise<void> {
    console.log('🎥 === ADICIONANDO VÍDEO À CHAMADA ===');
    
    if (!this.peerConnection || !this.localStream) {
      console.error('❌ Não é possível adicionar vídeo: conexão ou stream não disponível');
      return;
    }

    try {
      // Tentar obter apenas vídeo
      console.log('📹 Solicitando acesso à câmera...');
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false // Só queremos vídeo
      });

      const videoTrack = videoStream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error('❌ Nenhum track de vídeo obtido');
        return;
      }

      console.log(`✅ Track de vídeo obtido: ${videoTrack.label}`);

      // Adicionar o track de vídeo ao stream local existente
      this.localStream.addTrack(videoTrack);
      console.log('✅ Track de vídeo adicionado ao localStream');

      // Adicionar o track à PeerConnection
      this.peerConnection.addTrack(videoTrack, this.localStream);
      console.log('✅ Track de vídeo adicionado à PeerConnection');

      // Atualizar o elemento de vídeo local
      this.assignLocalStream();

      // Atualizar estado
      this.isVideoDisabled = false;
      console.log('✅ Vídeo adicionado com sucesso à chamada!');

      // Verificar o novo estado
      setTimeout(() => {
        this.logDetailedState();
      }, 500);

    } catch (error) {
      console.error('❌ Erro ao adicionar vídeo à chamada:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          console.error('🚫 Permissão de câmera negada');
        } else if (error.name === 'NotFoundError') {
          console.error('📷 Câmera não encontrada');
        } else if (error.name === 'NotReadableError') {
          console.error('📷 Câmera está sendo usada por outro aplicativo');
        }
      }
    }
  }

  // Método para obter estado atual de mute
  getCurrentMuteState(): boolean {
    return this.isMuted;
  }

  // Método para obter estado atual de vídeo
  getCurrentVideoState(): boolean {
    return !this.isVideoDisabled;
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }

  private logDetailedState(): void {
    console.log('📊 === ESTADO DETALHADO DO WEBRTC SERVICE ===');
    
    // Estados internos
    console.log(`🔧 Estados internos:`);
    console.log(`   - isMuted: ${this.isMuted}`);
    console.log(`   - isVideoDisabled: ${this.isVideoDisabled}`);
    console.log(`   - isCallInProgress: ${this.isCallInProgress}`);
    console.log(`   - isInitiator: ${this.isInitiator}`);
    
    // LocalStream
    if (this.localStream) {
      console.log(`🎯 LocalStream (${this.localStream.id}):`);
      this.localStream.getTracks().forEach((track, index) => {
        console.log(`   ${index + 1}. ${track.kind} track:`);
        console.log(`      - ID: ${track.id}`);
        console.log(`      - Label: ${track.label}`);
        console.log(`      - Enabled: ${track.enabled}`);
        console.log(`      - ReadyState: ${track.readyState}`);
        console.log(`      - Muted: ${track.muted}`);
      });
    } else {
      console.log(`🎯 LocalStream: não disponível`);
    }
    
    // Elementos de vídeo
    if (this.localVideoRef) {
      console.log(`📱 Elemento LOCAL:`);
      console.log(`   - Tem srcObject: ${!!this.localVideoRef.srcObject}`);
      console.log(`   - É o localStream: ${this.localVideoRef.srcObject === this.localStream}`);
      console.log(`   - Paused: ${this.localVideoRef.paused}`);
      console.log(`   - Muted: ${this.localVideoRef.muted}`);
      console.log(`   - VideoWidth: ${this.localVideoRef.videoWidth}`);
      console.log(`   - VideoHeight: ${this.localVideoRef.videoHeight}`);
    } else {
      console.log(`📱 Elemento LOCAL: não disponível`);
    }
    
    if (this.remoteVideoRef) {
      console.log(`📺 Elemento REMOTO:`);
      console.log(`   - Tem srcObject: ${!!this.remoteVideoRef.srcObject}`);
      console.log(`   - É o localStream: ${this.remoteVideoRef.srcObject === this.localStream}`);
      console.log(`   - Paused: ${this.remoteVideoRef.paused}`);
      console.log(`   - VideoWidth: ${this.remoteVideoRef.videoWidth}`);
      console.log(`   - VideoHeight: ${this.remoteVideoRef.videoHeight}`);
    } else {
      console.log(`📺 Elemento REMOTO: não disponível`);
    }
    
    // PeerConnection
    if (this.peerConnection) {
      console.log(`🔗 PeerConnection:`);
      console.log(`   - ConnectionState: ${this.peerConnection.connectionState}`);
      console.log(`   - IceConnectionState: ${this.peerConnection.iceConnectionState}`);
      console.log(`   - SignalingState: ${this.peerConnection.signalingState}`);
      
      // Senders (tracks enviados)
      const senders = this.peerConnection.getSenders();
      console.log(`   📤 Senders (${senders.length}):`);
      senders.forEach((sender, index) => {
        if (sender.track) {
          console.log(`      ${index + 1}. ${sender.track.kind}: enabled=${sender.track.enabled}, id=${sender.track.id.substring(0, 8)}...`);
        } else {
          console.log(`      ${index + 1}. (sem track)`);
        }
      });
      
      // Receivers (tracks recebidos)
      const receivers = this.peerConnection.getReceivers();
      console.log(`   📥 Receivers (${receivers.length}):`);
      receivers.forEach((receiver, index) => {
        if (receiver.track) {
          console.log(`      ${index + 1}. ${receiver.track.kind}: enabled=${receiver.track.enabled}, id=${receiver.track.id.substring(0, 8)}...`);
        } else {
          console.log(`      ${index + 1}. (sem track)`);
        }
      });
    } else {
      console.log(`🔗 PeerConnection: não disponível`);
    }
    
    console.log('📊 === FIM DO ESTADO DETALHADO ===');
  }
}

export default WebRTCService;