import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setLogLevel, disableNetwork } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence internal @firebase/firestore backoff/quota console.error spam
try {
  setLogLevel('silent');
} catch {}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const QUOTA_FLAG_KEY = 'holerite_firestore_quota_exceeded_date';
let memoryQuotaExceeded = false;
let networkDisabled = false;

// Clear any stale sessionStorage lock on fresh load so upgrading to the paid plan works immediately upon refresh
try {
  sessionStorage.removeItem(QUOTA_FLAG_KEY);
} catch {}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as any)?.code || '';
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded')
  );
}

export function isFirestoreQuotaExceeded(): boolean {
  return memoryQuotaExceeded;
}

export function markFirestoreQuotaExceeded(error?: unknown): void {
  memoryQuotaExceeded = true;
  if (!networkDisabled) {
    networkDisabled = true;
    disableNetwork(db).catch(() => {});
  }
}

export async function testConnection(): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) {
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'systemConfig', 'connection-test'));
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markFirestoreQuotaExceeded(error);
      return false;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      return false;
    }
    // Connected to server even if doc does not exist
    return true;
  }
}

