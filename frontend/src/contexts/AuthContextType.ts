import { createContext } from 'react';
import type { User } from '../types/chat';

export interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  logout: () => void;
  login: (email: string, password: string) => Promise<void>;
  isAuthenticated: boolean;
  updateUserProfile?: (data: Partial<User>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>(null!);