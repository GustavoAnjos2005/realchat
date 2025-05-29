import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContextType';
import type { AuthContextType } from './AuthContextType';
import type { User } from '../types/chat';
import api from '../services/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (!token || !storedUser) {
          setIsLoading(false);
          return;
        }

        // Por enquanto, vamos apenas verificar se o token existe e carregar o usuário
        // TODO: Adicionar validação com servidor quando o endpoint estiver funcionando
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('Usuário autenticado carregado:', parsedUser);
          setUser(parsedUser);
        } catch (error) {
          console.error('Erro ao fazer parse do usuário, removendo dados de autenticação');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', {
        email,
        password
      });

      const { token, user: userData } = response.data;
      
      // Garantir que o usuário tenha todos os campos necessários
      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        isOnline: true,
        profileImage: userData.profileImage || undefined,
        themeColor: userData.themeColor || 'blue',
        backgroundColor: userData.backgroundColor || undefined,
        backgroundImage: userData.backgroundImage || undefined
      };

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      throw error;
    }
  };

  const updateUserProfile = async (data: Partial<User>) => {
    try {
      const response = await api.patch('/api/auth/update', data);
      const updatedUser = response.data.user;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    setUser,
    isLoading,
    logout,
    login,
    isAuthenticated: !!user,
    updateUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}