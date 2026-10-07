import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider, signInWithPopup, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

// Configuration from provisioned firebase-applet-config.json with env fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || '',
};

const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId || '(default)';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isFirebaseAvailable = false;

try {
  if (firebaseConfig.projectId || firebaseConfig.apiKey) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('[Firebase] setPersistence error:', err);
    });
    // Initialize Firestore with specific database ID if available
    db = firestoreDatabaseId && firestoreDatabaseId !== '(default)'
      ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }, firestoreDatabaseId)
      : initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    isFirebaseAvailable = true;
    console.log('[Firebase] Successfully initialized with project:', firebaseConfig.projectId);
  }
} catch (err) {
  console.warn('[Firebase] Initialization error:', err);
  isFirebaseAvailable = false;
}

export { app, auth, db, isFirebaseAvailable, GoogleAuthProvider, signInWithPopup, signOut };


