import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, logout, saveUser, db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  isAdmin: boolean;
  isHQAdmin: boolean;
  loading: boolean;
  signIn: (companyCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isAdmin: false,
  isHQAdmin: false,
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
  const isHQAdmin = user?.email === 'info@nextin.ai.kr';
  const isAdmin = userProfile?.role === 'admin' || isHQAdmin;

  useEffect(() => {
    let unsubscribeProfile: () => void;

    import('firebase/auth').then(({ getRedirectResult }) => {
      getRedirectResult(auth).catch((err) => {
        console.error("Redirect login error:", err);
      });
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setLoading(true);
      }
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
            } else {
              setUserProfile(null);
            }
            setLoading(false); // only finish loading after profile is fetched or determined not to exist
          }, (error: any) => {
            if (error.code === 'permission-denied') {
              // Ignore expected permission-denied errors that occur during the sign-out process
              // when the auth state becomes invalid before the snapshot listener can be fully cleaned up.
            } else {
              console.error("Profile onSnapshot error:", error);
            }
            setUserProfile(null);
            setLoading(false);
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
    <AuthContext.Provider value={{ user, userProfile, isAdmin: !!isAdmin, isHQAdmin: !!isHQAdmin, loading, signIn, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};
