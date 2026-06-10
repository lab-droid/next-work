import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, logout, saveUser } from './firebase';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (companyCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.email === 'info@nextin.ai.kr' && user?.emailVerified;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          await saveUser(currentUser);
        } catch (err) {
          console.error("Failed to save user in onAuthStateChanged:", err);
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (companyCode?: string) => {
    await signInWithGoogle(companyCode);
  };

  const signOutUser = async () => {
    await logout();
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin: !!isAdmin, loading, signIn, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};
