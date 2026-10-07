import { getGithubConnection, queueGithubSong, syncGithubSongs, hasPendingGithubChanges } from './githubSyncService';
import { collection, doc, getDocsFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { Song } from '../types';
import { getAllSongsFromDB, saveSongToDB, deleteSongFromDB } from '../lib/indexedDb';
import { mergeSongsWithPresets } from '../lib/defaultSongs';

import { cloudSongData, visibleToAccount, planCloudReconciliation, CloudSong } from '../lib/chartSyncPolicy';
export { cloudSongData, visibleToAccount } from '../lib/chartSyncPolicy';

export const getChartAccountId = () => getGithubConnection()?.uid || auth?.currentUser?.uid;

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
  const uid = getChartAccountId();
  if (!uid || !visibleToAccount(song, uid)) return;
  const data = cloudSongData({ ...song, userId: uid });
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
  if (getGithubConnection()) {
    queueGithubSong(data);
    scheduleGithubSync();
    return;
  }
  // Firestore's persistent cache queues offline writes and retries on reconnect.
  void setDoc(doc(songsCollection(uid), encodeURIComponent(song.id)), data)
    .catch(error => { if (getChartAccountId() === uid) reportError(error); });
}

export function publishDeletion(songId: string): void {
  const uid = getChartAccountId();
  if (getGithubConnection() && uid) {
    queueGithubSong({ id: songId, userId: uid, deleted: true, updatedAt: Date.now() } as CloudSong);
    scheduleGithubSync();
    return;
  }
  if (!uid) return;
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
  void setDoc(doc(songsCollection(uid), encodeURIComponent(songId)), {
    id: songId, userId: uid, deleted: true, updatedAt: Date.now(),
  }).catch(error => { if (getChartAccountId() === uid) reportError(error); });
}

async function reconcile(uid: string, remote: CloudSong[], upload: boolean): Promise<Song[]> {
  const local = await getAllSongsFromDB();
  if (getChartAccountId() !== uid) return mergeSongsWithPresets(local.filter(s => visibleToAccount(s, auth?.currentUser?.uid)));
  const plan = planCloudReconciliation(local, remote, uid);
  for (const id of plan.remove) {
    if (getChartAccountId() !== uid) break;
    await deleteSongFromDB(id);
  }
  for (const song of plan.save) {
    if (getChartAccountId() !== uid) break;
    await saveSongToDB(song);
  }
  if (upload && getChartAccountId() === uid) plan.upload.forEach(publishSong);
  return mergeSongsWithPresets(plan.songs);
}

export async function syncCloudSongs(): Promise<Song[]> {
  if (getGithubConnection()) {
    const uid = getChartAccountId();
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return mergeSongsWithPresets((await getAllSongsFromDB()).filter(s => visibleToAccount(s, uid)));
    }
    setSyncStatus('syncing');
    try {
      const songs = await syncGithubSongs();
      if (getChartAccountId() !== uid) return [];
      if (hasPendingGithubChanges()) scheduleGithubSync();
      else setSyncStatus('synced');
      const merged = mergeSongsWithPresets(songs);
      window.dispatchEvent(new CustomEvent('beatpulse-github-songs', { detail: merged }));
      return merged;
    } catch (error) {
      if (getChartAccountId() === uid) reportError(error);
      return mergeSongsWithPresets((await getAllSongsFromDB()).filter(s => visibleToAccount(s, getChartAccountId())));
    }
  }
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
    if (getChartAccountId() === uid) reportError(error);
    return mergeSongsWithPresets((await getAllSongsFromDB()).filter(s => visibleToAccount(s, uid)));
  } finally {
    clearTimeout(timeout);
  }
}

export function watchCloudSongs(onSongs: (songs: Song[]) => void): () => void {
  if (getGithubConnection()) {
    const receive = (event: Event) => onSongs((event as CustomEvent<Song[]>).detail);
    const refresh = () => { if (document.visibilityState === 'visible') void syncCloudSongs(); };
    window.addEventListener('beatpulse-github-songs', receive);
    window.addEventListener('online', refresh);
    const timer = setInterval(refresh, 15000);
    refresh();
    return () => { clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('beatpulse-github-songs', receive); };
  }
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) { setSyncStatus('local'); return () => {}; }
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
  let stopped = false;
  let pending = Promise.resolve();
  const unsubscribe = onSnapshot(songsCollection(uid), { includeMetadataChanges: true }, snapshot => {
    if (stopped || getChartAccountId() !== uid) return;
    setSyncStatus(snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites
      ? (navigator.onLine ? 'syncing' : 'offline') : 'synced');
    if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) return;
    pending = pending.then(async () => {
      if (stopped || getChartAccountId() !== uid) return;
      const songs = await reconcile(uid, snapshot.docs.map(d => d.data() as CloudSong), true);
      if (!stopped && getChartAccountId() === uid) onSongs(songs);
    }).catch(reportError);
  }, error => { if (!stopped && getChartAccountId() === uid) reportError(error); });
  return () => { stopped = true; unsubscribe(); };
}

let githubTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleGithubSync() {
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
  clearTimeout(githubTimer);
  githubTimer = setTimeout(() => { void syncCloudSongs(); }, 1200);
}
