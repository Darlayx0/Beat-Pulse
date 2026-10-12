import type { Song } from '../types';
import { cloudSongData, planCloudReconciliation, type CloudSong } from '../lib/chartSyncPolicy';
import { getAllSongsFromDB, saveSongToDB, deleteSongFromDB, getAudioBlobFromDB, saveAudioBlobToDB } from '../lib/indexedDb';

const KEY = 'BEATPULSE_GITHUB_SYNC_V1';
const MARKER = 'beatpulse-sync.json';
type Connection = { token: string; uid: string; login: string; gistId: string };
type Gist = { id: string; owner: { id: number }; public: boolean; files: Record<string, { content?: string; truncated?: boolean }> };
let connection: Connection | undefined;
try { connection = JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || 'null') || undefined; } catch { /* no connection */ }
export const getGithubConnection = () => connection;
export const githubQueueKey = (uid: string) => `${KEY}_QUEUE_${uid}`;
let running: Promise<Song[]> | undefined;
const AUDIO_REPO = 'beatpulse-library';
export const MAX_GITHUB_AUDIO_BYTES = 90 * 1024 * 1024;
class GithubError extends Error {
  constructor(public status: number) {
    super(status === 401 ? 'Token GitHub tidak valid atau kedaluwarsa.'
      : status === 403 || status === 404 ? 'Periksa izin repo dan gist pada token GitHub untuk sinkronisasi audio.' : `GitHub gagal (${status}).`);
  }
}

async function request(token: string, path: string, method = 'GET', body?: unknown, raw = false) {
  const response = await fetch(`https://api.github.com${path}`, {
    method, cache: 'no-store', signal: AbortSignal.timeout(120000),
    headers: { Authorization: `Bearer ${token}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github.object+json',
      'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new GithubError(response.status);
  return response;
}

async function ensureAudioRepo(current: Connection) {
  let repo: { private: boolean; owner: { id: number } };
  try { repo = await (await request(current.token, `/repos/${current.login}/${AUDIO_REPO}`)).json(); }
  catch (error) {
    if (!(error instanceof GithubError) || error.status !== 404) throw error;
    repo = await (await request(current.token, '/user/repos', 'POST', {
      name: AUDIO_REPO, private: true, auto_init: true, description: 'Beat Pulse imported audio library',
    })).json();
  }
  if (!repo.private || `github:${repo.owner.id}` !== current.uid) throw new Error('Repositori beatpulse-library harus privat dan milik akun ini.');
}

async function digest(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())),
    byte => byte.toString(16).padStart(2, '0')).join('');
}

async function uploadAudio(current: Connection, song: Song): Promise<Song> {
  if (song.githubAudio || song.youtubeVideoId || song.isPreset) return song;
  const blob = await getAudioBlobFromDB(song.id);
  if (!blob) {
    if (song.audioUrl && !/^(blob:|data:)/i.test(song.audioUrl)) return song;
    throw new Error(`Audio “${song.title}” belum tersedia. Hubungkan ulang audio pada perangkat asal.`);
  }
  if (blob.size > MAX_GITHUB_AUDIO_BYTES) throw new Error(`Audio “${song.title}” melebihi batas unggah aplikasi 90 MiB. Gunakan MP3 yang lebih kecil.`);
  const sha256 = await digest(blob);
  const path = `audio/${sha256}`;
  const endpoint = `/repos/${current.login}/${AUDIO_REPO}/contents/${path}`;
  try { await request(current.token, endpoint); }
  catch (error) {
    if (!(error instanceof GithubError) || error.status !== 404) throw error;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
    try {
      await request(current.token, endpoint, 'PUT', { message: 'Sync Beat Pulse audio', content: btoa(chunks.join('')) });
    } catch (writeError) {
      // Another device can upload identical immutable audio concurrently.
      if (!(writeError instanceof GithubError) || ![409, 422].includes(writeError.status)) throw writeError;
      await request(current.token, endpoint);
    }
  }
  return { ...song, githubAudio: { path, sha256, size: blob.size, mime: blob.type || 'audio/mpeg' } };
}

export async function downloadGithubAudio(song: Song): Promise<Blob | null> {
  const current = connection;
  const audio = song.githubAudio;
  if (!current || song.userId !== current.uid || !audio) return null;
  if (!/^[a-f0-9]{64}$/.test(audio.sha256) || audio.path !== `audio/${audio.sha256}`
    || audio.size <= 0 || audio.size > MAX_GITHUB_AUDIO_BYTES) throw new Error('Referensi audio GitHub tidak valid.');
  const response = await request(current.token, `/repos/${current.login}/${AUDIO_REPO}/contents/${audio.path}`, 'GET', undefined, true);
  const data = await response.blob();
  if (data.size !== audio.size || await digest(data) !== audio.sha256) throw new Error('Audio GitHub tidak lengkap atau rusak. Coba sinkronkan kembali.');
  if (connection !== current) return null;
  const blob = new Blob([data], { type: audio.mime });
  await saveAudioBlobToDB(song.id, blob);
  return blob;
}

async function api<T>(token: string, path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    method, cache: 'no-store', signal: AbortSignal.timeout(120000),
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
  if (running) return running;
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
    const localSongs = await getAllSongsFromDB();
    const plan = planCloudReconciliation(localSongs, [...effective.values()], current.uid);
    const writes = new Map<string, CloudSong>(plan.upload.map(song => [song.id, song]));
    // Upgrade older chart-only libraries even when their timestamps already match.
    for (const song of localSongs.filter(item => item.userId === current.uid)) {
      const cloud = effective.get(song.id);
      if (!cloud || cloud.deleted || cloud.updatedAt !== song.updatedAt) continue;
      if (cloud.githubAudio && (!song.githubAudio || !await getAudioBlobFromDB(song.id))) {
        if (!plan.save.some(item => item.id === song.id)) plan.save.push(cloud);
      } else if (!cloud.githubAudio && !song.githubAudio && !song.youtubeVideoId && !song.isPreset
        && await getAudioBlobFromDB(song.id)) writes.set(song.id, song);
    }
    for (const song of Object.values(queue)) {
      if (effective.get(song.id) === song && (song.updatedAt || 0) >= (writes.get(song.id)?.updatedAt || 0)) {
        writes.set(song.id, song);
      }
    }
    if (!isCurrent()) return [];
    if (writes.size) {
      const audioWrites = [...writes.values()].filter(song => !song.deleted && !song.githubAudio && !song.youtubeVideoId && !song.isPreset);
      if (audioWrites.length) await ensureAudioRepo(current);
      for (const song of audioWrites) {
        if (!isCurrent()) return [];
        writes.set(song.id, await uploadAudio(current, song));
      }
      await api(current.token, `/gists/${current.gistId}`, 'PATCH', { files: Object.fromEntries(
        [...writes.values()].map(song => [`song-${encodeURIComponent(song.id)}.json`, { content: JSON.stringify(cloudSongData(song)) }])) });
    }
    if (!isCurrent()) return [];
    const latestQueue = readQueue(current.uid);
    for (const [id, item] of Object.entries(queue)) {
      if (JSON.stringify(latestQueue[id]) === JSON.stringify(item)) delete latestQueue[id];
    }
    for (const id of plan.remove) {
      if (!isCurrent()) return [];
      if (!latestQueue[id]) await deleteSongFromDB(id);
    }
    for (const song of plan.save) {
      if (!isCurrent()) return [];
      if (!latestQueue[song.id]) {
        const incoming = writes.get(song.id) || song;
        const existing = (await getAllSongsFromDB()).find(item => item.id === song.id);
        if (incoming.githubAudio && (existing?.githubAudio?.sha256 !== incoming.githubAudio.sha256 || !await getAudioBlobFromDB(song.id))) {
          const blob = await downloadGithubAudio(incoming);
          if (!isCurrent()) return [];
          await saveSongToDB(incoming, blob || undefined);
        } else await saveSongToDB(incoming);
      }
    }
    for (const song of writes.values()) {
      if (!isCurrent()) return [];
      if (song.deleted || !song.githubAudio || latestQueue[song.id]) continue;
      const existing = (await getAllSongsFromDB()).find(item => item.id === song.id);
      if (existing && existing.updatedAt === song.updatedAt) await saveSongToDB({ ...existing, githubAudio: song.githubAudio });
    }
    const finalQueue = readQueue(current.uid);
    for (const [id, item] of Object.entries(queue)) {
      if (JSON.stringify(finalQueue[id]) === JSON.stringify(item)) delete finalQueue[id];
    }
    localStorage.setItem(githubQueueKey(current.uid), JSON.stringify(finalQueue));
    return (await getAllSongsFromDB()).filter(song => !song.userId || song.userId === current.uid);
  };
  running = task();
  try { return await running; } finally { running = undefined; }
}
