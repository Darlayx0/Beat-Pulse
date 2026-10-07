import type { Song } from '../types';
import { cloudSongData, planCloudReconciliation, type CloudSong } from '../lib/chartSyncPolicy';
import { getAllSongsFromDB, saveSongToDB, deleteSongFromDB } from '../lib/indexedDb';

const KEY = 'BEATPULSE_GITHUB_SYNC_V1';
const MARKER = 'beatpulse-sync.json';
type Connection = { token: string; uid: string; login: string; gistId: string };
type Gist = { id: string; owner: { id: number }; public: boolean; files: Record<string, { content?: string; truncated?: boolean }> };
let connection: Connection | undefined;
try { connection = JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || 'null') || undefined; } catch { /* no connection */ }
export const getGithubConnection = () => connection;
export const githubQueueKey = (uid: string) => `${KEY}_QUEUE_${uid}`;
let running: Promise<Song[]> | undefined;

async function api<T>(token: string, path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    method, cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(response.status === 401 ? 'Token GitHub tidak valid atau kedaluwarsa.'
    : response.status === 403 ? 'Periksa izin gist pada token atau batas API GitHub.' : `GitHub gagal (${response.status}).`);
  return response.json();
}

export async function connectGithub(token: string, remember: boolean, localUid?: string) {
  const user = await api<{ id: number; login: string }>(token, '/user');
  let gist: Gist | undefined;
  for (let page = 1; ; page++) {
    const list = await api<Gist[]>(token, `/gists?per_page=100&page=${page}`);
    gist = list.find(item => !item.public && item.owner.id === user.id && item.files[MARKER]);
    if (gist || list.length < 100) break;
  }
  if (!gist) gist = await api<Gist>(token, '/gists', 'POST', {
    description: 'Beat Pulse chart sync v1', public: false,
    files: { [MARKER]: { content: JSON.stringify({ app: 'beatpulse', version: 1 }) } },
  });
  const next = { token, uid: `github:${user.id}`, login: user.login, gistId: gist.id };
  // Explicit connection imports only guest songs and the currently signed-in library.
  for (const song of await getAllSongsFromDB()) {
    if (!song.userId || song.userId === localUid) await saveSongToDB({ ...song, userId: next.uid });
  }
  (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(next));
  (remember ? sessionStorage : localStorage).removeItem(KEY);
  connection = next;
  window.dispatchEvent(new Event('beatpulse-sync-provider'));
}

export function disconnectGithub() {
  connection = undefined;
  localStorage.removeItem(KEY); sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event('beatpulse-sync-provider'));
}

function readQueue(uid: string): Record<string, CloudSong> {
  return JSON.parse(localStorage.getItem(githubQueueKey(uid)) || '{}');
}
export function hasPendingGithubChanges() {
  return !!connection && Object.keys(readQueue(connection.uid)).length > 0;
}
export function queueGithubSong(song: CloudSong) {
  const current = connection;
  if (!current || song.userId !== current.uid) return;
  const queue = readQueue(current.uid);
  queue[song.id] = cloudSongData(song);
  localStorage.setItem(githubQueueKey(current.uid), JSON.stringify(queue));
}

export async function syncGithubSongs(): Promise<Song[]> {
  if (running) { await running; return syncGithubSongs(); }
  const current = connection;
  if (!current) throw new Error('Hubungkan akun GitHub terlebih dahulu.');
  const isCurrent = () => connection === current;
  const task = async () => {
    const gist = await api<Gist>(current.token, `/gists/${current.gistId}`);
    if (gist.public || `github:${gist.owner.id}` !== current.uid) throw new Error('Gist bukan milik akun sinkronisasi ini.');
    const remote: CloudSong[] = [];
    for (const [name, file] of Object.entries(gist.files)) {
      if (!name.startsWith('song-')) continue;
      if (file.truncated || !file.content) throw new Error('Chart terlalu besar untuk Gist. Ekspor chart sebagai cadangan.');
      const song = JSON.parse(file.content) as CloudSong;
      if (typeof song.id !== 'string' || song.userId !== current.uid || (!song.deleted && !song.charts)) throw new Error('Format chart cloud tidak valid.');
      remote.push(song);
    }
    if (!isCurrent()) return [];
    const queue = readQueue(current.uid);
    // Pending deletions participate in reconciliation, so offline deletes cannot resurrect.
    const effective = new Map(remote.map(song => [song.id, song]));
    for (const song of Object.values(queue)) {
      if ((song.updatedAt || 0) >= (effective.get(song.id)?.updatedAt || 0)) effective.set(song.id, song);
    }
    const plan = planCloudReconciliation(await getAllSongsFromDB(), [...effective.values()], current.uid);
    const writes = new Map(plan.upload.map(song => [song.id, song]));
    for (const song of Object.values(queue)) {
      if (effective.get(song.id) === song) writes.set(song.id, song);
    }
    if (!isCurrent()) return [];
    if (writes.size) {
      await api(current.token, `/gists/${current.gistId}`, 'PATCH', { files: Object.fromEntries(
        [...writes.values()].map(song => [`song-${encodeURIComponent(song.id)}.json`, { content: JSON.stringify(cloudSongData(song)) }])) });
    }
    if (!isCurrent()) return [];
    const latestQueue = readQueue(current.uid);
    for (const [id, item] of Object.entries(queue)) {
      if (JSON.stringify(latestQueue[id]) === JSON.stringify(item)) delete latestQueue[id];
    }
    localStorage.setItem(githubQueueKey(current.uid), JSON.stringify(latestQueue));
    for (const id of plan.remove) {
      if (!isCurrent()) return [];
      if (!latestQueue[id]) await deleteSongFromDB(id);
    }
    for (const song of plan.save) {
      if (!isCurrent()) return [];
      if (!latestQueue[song.id]) await saveSongToDB(song);
    }
    return (await getAllSongsFromDB()).filter(song => !song.userId || song.userId === current.uid);
  };
  running = task();
  try { return await running; } finally { running = undefined; }
}
