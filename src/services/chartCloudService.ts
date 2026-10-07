import { collection, doc, getDocsFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { Song } from '../types';
import { getAllSongsFromDB, saveSongToDB, deleteSongFromDB } from '../lib/indexedDb';
import { mergeSongsWithPresets } from '../lib/defaultSongs';

import { cloudSongData, visibleToAccount, planCloudReconciliation, CloudSong } from '../lib/chartSyncPolicy';
export { cloudSongData, visibleToAccount } from '../lib/chartSyncPolicy';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error';
let syncStatus: SyncStatus = 'local';
const statusListeners = new Set<() => void>();
export const getSyncStatus = () => syncStatus;
export function subscribeSyncStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => { statusListeners.delete(listener); };
}
function setSyncStatus(status: SyncStatus) {
  if (syncStatus === status) return;
  syncStatus = status;
  statusListeners.forEach(listener => listener());
}

function songsCollection(uid: string) {
  if (!db) throw new Error('Firebase belum tersedia.');
  return collection(db, 'users', uid, 'songs');
}

function reportError(error: unknown) {
  setSyncStatus(navigator.onLine ? 'error' : 'offline');
  console.warn('[Chart sync]', error);
  window.dispatchEvent(new CustomEvent('beatpulse-sync-error'));
}

export function publishSong(song: Song): void {
  const uid = auth?.currentUser?.uid;
  if (!uid || !visibleToAccount(song, uid)) return;
  const data = cloudSongData({ ...song, userId: uid });
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
  // Firestore's persistent cache queues offline writes and retries on reconnect.
  void setDoc(doc(songsCollection(uid), encodeURIComponent(song.id)), data)
    .catch(error => { if (auth?.currentUser?.uid === uid) reportError(error); });
}

export function publishDeletion(songId: string): void {
  const uid = auth?.currentUser?.uid;
  if (!uid) return;
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
  void setDoc(doc(songsCollection(uid), encodeURIComponent(songId)), {
    id: songId, userId: uid, deleted: true, updatedAt: Date.now(),
  }).catch(error => { if (auth?.currentUser?.uid === uid) reportError(error); });
}

async function reconcile(uid: string, remote: CloudSong[], upload: boolean): Promise<Song[]> {
  const local = await getAllSongsFromDB();
  if (auth?.currentUser?.uid !== uid) return mergeSongsWithPresets(local.filter(s => visibleToAccount(s, auth?.currentUser?.uid)));
  const plan = planCloudReconciliation(local, remote, uid);
  for (const id of plan.remove) {
    if (auth?.currentUser?.uid !== uid) break;
    await deleteSongFromDB(id);
  }
  for (const song of plan.save) {
    if (auth?.currentUser?.uid !== uid) break;
    await saveSongToDB(song);
  }
  if (upload && auth?.currentUser?.uid === uid) plan.upload.forEach(publishSong);
  return mergeSongsWithPresets(plan.songs);
}

export async function syncCloudSongs(): Promise<Song[]> {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) {
    setSyncStatus('local');
    return mergeSongsWithPresets((await getAllSongsFromDB()).filter(s => visibleToAccount(s, uid)));
  }
  if (!navigator.onLine) {
    setSyncStatus('offline');
    return mergeSongsWithPresets((await getAllSongsFromDB()).filter(s => visibleToAccount(s, uid)));
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const snapshot = await Promise.race([
      getDocsFromServer(songsCollection(uid)),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Cloud sync timed out')), 8000); }),
    ]);
    return await reconcile(uid, snapshot.docs.map(d => d.data() as CloudSong), true);
  } catch (error) {
    if (auth?.currentUser?.uid === uid) reportError(error);
    return mergeSongsWithPresets((await getAllSongsFromDB()).filter(s => visibleToAccount(s, uid)));
  } finally {
    clearTimeout(timeout);
  }
}

export function watchCloudSongs(onSongs: (songs: Song[]) => void): () => void {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) { setSyncStatus('local'); return () => {}; }
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
  let stopped = false;
  let pending = Promise.resolve();
  const unsubscribe = onSnapshot(songsCollection(uid), { includeMetadataChanges: true }, snapshot => {
    if (stopped || auth?.currentUser?.uid !== uid) return;
    setSyncStatus(snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites
      ? (navigator.onLine ? 'syncing' : 'offline') : 'synced');
    if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) return;
    pending = pending.then(async () => {
      if (stopped || auth?.currentUser?.uid !== uid) return;
      const songs = await reconcile(uid, snapshot.docs.map(d => d.data() as CloudSong), true);
      if (!stopped && auth?.currentUser?.uid === uid) onSongs(songs);
    }).catch(reportError);
  }, error => { if (!stopped && auth?.currentUser?.uid === uid) reportError(error); });
  return () => { stopped = true; unsubscribe(); };
}
