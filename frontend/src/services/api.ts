import axios from 'axios';

const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://realchat-production.up.railway.app';

export const api = axios.create({
  baseURL: API_BASE_URL,
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
  const baseURL = API_BASE_URL;
  return `${baseURL}${profileImage}`;
};

export default api;