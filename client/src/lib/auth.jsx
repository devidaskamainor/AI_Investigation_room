import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return (await api('/auth/me')).user;
      } catch (error) {
        if (error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 60000,
  });
  const clearPrivateQueries = () =>
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
  return (
    <AuthContext.Provider
      value={{
        user: query.data,
        loading: query.isPending,
        error: query.error,
        setUser: (user) => {
          clearPrivateQueries();
          queryClient.setQueryData(['me'], user);
        },
        logout: async () => {
          await api('/auth/logout', { method: 'POST' });
          clearPrivateQueries();
          queryClient.setQueryData(['me'], null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
