import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, setPersistence, browserLocalPersistence, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, getDocs, query, collection, limit, getDoc } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

export const firebaseConfig = firebaseConfigJson;
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();

export const saveUser = async (user: User, companyCode?: string) => {
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      // Check if this is the very first user
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
      const isFirstUser = usersSnap.empty;

      const data: any = {
        email: user.email,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
        role: isFirstUser ? 'admin' : 'user',
        isProfileComplete: false,
      };
      if (user.displayName) data.name = user.displayName; // Save as 'name' for profile form
      if (user.photoURL) data.photoURL = user.photoURL;
      if (companyCode) data.companyCode = companyCode;

      await setDoc(userDocRef, data, { merge: true });
    } else {
      const updateData: any = { lastLoginAt: Date.now() };
      if (companyCode) {
        updateData.companyCode = companyCode;
      }
      await setDoc(userDocRef, updateData, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'users');
  }
};

export const signInWithGoogle = async (companyCode?: string) => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      await saveUser(result.user, companyCode);
    }
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
      console.log('사용자가 로그인을 취소했습니다.');
      throw error;
    }
    
    if (error.code === 'auth/unauthorized-domain') {
      console.error('인가되지 않은 도메인입니다.', error);
      throw error;
    }
    
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
    throw error;
  }
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
