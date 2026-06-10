import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, logout, saveUser, db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (companyCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isAdmin: false,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Derive admin strictly from firestore profile instead of just email
  const isAdmin = userProfile?.role === 'admin' || user?.email === 'info@nextin.ai.kr';

  useEffect(() => {
    let unsubscribeProfile: () => void;

    import('firebase/auth').then(({ getRedirectResult }) => {
      getRedirectResult(auth).catch((err) => {
        console.error("Redirect login error:", err);
      });
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const storedCompanyCode = window.sessionStorage.getItem('pendingCompanyCode');
          if (storedCompanyCode) {
            await saveUser(currentUser, storedCompanyCode);
            window.sessionStorage.removeItem('pendingCompanyCode');
          } else {
            await saveUser(currentUser);
          }
          unsubscribeProfile = onSnapshot(doc(db, 'users', currentUser.uid), (docInfo) => {
            if (docInfo.exists()) {
              setUserProfile(docInfo.data());
            }
            setLoading(false); // only finish loading after profile is fetched
          });
        } catch (err) {
          console.error("Failed to map user profile:", err);
          setLoading(false);
        }
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signIn = async (companyCode?: string) => {
    await signInWithGoogle(companyCode);
  };

  const signOutUser = async () => {
    await logout();
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, isAdmin: !!isAdmin, loading, signIn, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};
