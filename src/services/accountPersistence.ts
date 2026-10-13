import { auth, db } from './firebaseConfig';
import { collection, doc, getDocsFromServer, runTransaction } from 'firebase/firestore';
import { getGithubConnection, syncGithubAccountState } from './githubSyncService';
import { emptyAccountState, mergeAccountState, readAccountState, storeAccountState, sanitizeEditor, writeAccountEntry, type AccountState, type EditorPreferences } from '../lib/accountState';

export const persistenceUid = () => getGithubConnection()?.uid || auth?.currentUser?.uid || 'guest_unauthenticated';
export function loadEditorPreferences(): EditorPreferences {
  const saved = readAccountState(persistenceUid()).entries.editor?.value;
  return sanitizeEditor(saved || { saveMode: localStorage.getItem('BEATPULSE_EDITOR_SAVE_MODE') });
}
export function saveEditorPreferences(preferences: EditorPreferences): void {
  writeAccountEntry(persistenceUid(), 'editor', sanitizeEditor(preferences));
}
let running: Promise<void> | undefined;
export function syncAccountState(): Promise<void> {
  if (running) return running;
  const uid = persistenceUid();
  if (uid === 'guest_unauthenticated' || !navigator.onLine) return Promise.resolve();
  const task = async () => {
    const local = readAccountState(uid);
    let merged: AccountState;
    if (getGithubConnection()) merged = await syncGithubAccountState(local);
    else {
      if (!db) return;
      // Separate entries avoid Firestore's document size limit as game history grows.
      const remote = emptyAccountState(uid);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const snapshot = await Promise.race([getDocsFromServer(collection(db, 'users', uid, 'state')), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Account cloud sync timed out')), 8000); })]);
        for (const item of snapshot.docs) { const data = item.data(); if (data.uid !== uid || data.version !== 1 || typeof data.key !== 'string') throw new Error('Data akun cloud tidak valid.'); remote.entries[data.key] = data.entry; }
      } finally { clearTimeout(timeout); }
      merged = mergeAccountState(local, remote);
      for (const [key, entry] of Object.entries(merged.entries)) {
        if (JSON.stringify(entry) === JSON.stringify(remote.entries[key])) continue;
        if (persistenceUid() !== uid) return;
        const reference = doc(db, 'users', uid, 'state', encodeURIComponent(key));
        const saved = await runTransaction(db, async transaction => {
          const snapshot = await transaction.get(reference);
          const concurrent = emptyAccountState(uid);
          if (snapshot.exists()) concurrent.entries[key] = snapshot.data().entry;
          const one = emptyAccountState(uid); one.entries[key] = entry;
          const result = mergeAccountState(one, concurrent).entries[key];
          transaction.set(reference, { version: 1, uid, key, entry: result });
          return result;
        }, { maxAttempts: 3 });
        merged.entries[key] = saved;
      }
    }
    if (persistenceUid() !== uid) return;
    // Preserve edits made while the cloud request was in flight.
    const latest = mergeAccountState(readAccountState(uid), merged);
    storeAccountState(latest);
    window.dispatchEvent(new CustomEvent('beatpulse-account-restored', { detail: latest }));
  };
  running = task().finally(() => { running = undefined; });
  return running;
}
export function watchAccountPersistence(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let failures = 0;
  let failedVersion = '';
  const sync = async () => {
    if (stopped || !navigator.onLine) return;
    const uid = persistenceUid();
    const version = JSON.stringify(readAccountState(uid));
    if (version !== failedVersion) { failures = 0; failedVersion = version; }
    if (failures >= 3) return;
    try { await syncAccountState(); failures = 0; }
    catch (error) {
      failures++;
      console.warn('[Account persistence]', error);
      window.dispatchEvent(new Event('beatpulse-sync-error'));
    }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { void sync(); }, 1200); };
  const resume = () => { failures = 0; schedule(); };
  const focus = () => { if (document.visibilityState === 'visible') schedule(); };
  window.addEventListener('beatpulse-account-dirty', schedule);
  window.addEventListener('online', resume);
  window.addEventListener('beatpulse-sync-provider', resume);
  document.addEventListener('visibilitychange', focus);
  const interval = setInterval(() => { if (document.visibilityState === 'visible') void sync(); }, 60000);
  schedule();
  return () => { stopped = true; clearTimeout(timer); clearInterval(interval); window.removeEventListener('beatpulse-account-dirty', schedule); window.removeEventListener('online', resume); window.removeEventListener('beatpulse-sync-provider', resume); document.removeEventListener('visibilitychange', focus); };
}
