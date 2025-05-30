import axios from 'axios';

// Configuração da URL base baseada no ambiente
const getBaseURL = () => {
    if (typeof window !== 'undefined') {
        // No browser, usar URL relativa para produção ou localhost para desenvolvimento
        return window.location.hostname === 'localhost' 
            ? 'http://localhost:3000'
            : `${window.location.protocol}//${window.location.host}`;
    }
    return 'http://localhost:3000';
};

const api = axios.create({
    baseURL: getBaseURL(),
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true
});

// Interceptor para adicionar o token em todas as requisições
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Função utilitária para construir URLs de imagens de perfil
export const getProfileImageUrl = (profileImage?: string) => {
    if (!profileImage) return '/default-avatar.svg';
    if (profileImage.startsWith('http')) return profileImage;
    const baseURL = getBaseURL();
    return `${baseURL}${profileImage}`;
};

export default api;