import { Song, Chart, HighScore, GameSettings } from '../types';
import { normalizeTrackSnapshot } from './trackSnapshot';

const DB_NAME = 'BeatPulseDB';
const DB_VERSION = 3;

const STORES = {
  SONGS: 'songs',
  AUDIO_BLOBS: 'audio_blobs',
  HIGH_SCORES: 'high_scores',
  SETTINGS: 'settings',
};

const LOCAL_STORAGE_SNAPSHOT_KEY = 'BEATPULSE_SNAPSHOT_V2';
const LOCAL_STORAGE_SETTINGS_KEY = 'BEATPULSE_SETTINGS_V2';
export const LOCAL_STORAGE_TRACK_PREFIX = 'BEATPULSE_TRACK_';
export const AUDIO_CACHE_NAME = 'beatpulse-audio-cache-v1';
export const AUDIO_CACHE_PREFIX = 'https://beatpulse.local/audio/';

export const DEFAULT_SETTINGS: GameSettings = {
  keyBindings: {
    lane0: 'KeyD',
    lane1: 'KeyF',
    lane2: 'KeyJ',
    lane3: 'KeyK',
  },
  scrollSpeed: 2.2,
  audioOffsetMs: 0,
  bgmVolume: 0.8,
  sfxVolume: 0.9,
  noteSkin: 'cyber',
  showTimingBar: true,
  autoPlay: false,
  touchControlMode: 'thumb',
  hapticFeedback: true,
};

export function sanitizeSettings(input: any): GameSettings {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const scrollSpeed = typeof input.scrollSpeed === 'number' && !isNaN(input.scrollSpeed) && input.scrollSpeed >= 0.5 && input.scrollSpeed <= 5.0
    ? input.scrollSpeed
    : DEFAULT_SETTINGS.scrollSpeed;

  const audioOffsetMs = typeof input.audioOffsetMs === 'number' && !isNaN(input.audioOffsetMs)
    ? Math.max(-1000, Math.min(1000, input.audioOffsetMs))
    : DEFAULT_SETTINGS.audioOffsetMs;

  const bgmVolume = typeof input.bgmVolume === 'number' && !isNaN(input.bgmVolume)
    ? Math.max(0, Math.min(1, input.bgmVolume))
    : DEFAULT_SETTINGS.bgmVolume;

  const sfxVolume = typeof input.sfxVolume === 'number' && !isNaN(input.sfxVolume)
    ? Math.max(0, Math.min(1, input.sfxVolume))
    : DEFAULT_SETTINGS.sfxVolume;

  const keyBindings = {
    lane0: input.keyBindings?.lane0 || DEFAULT_SETTINGS.keyBindings.lane0,
    lane1: input.keyBindings?.lane1 || DEFAULT_SETTINGS.keyBindings.lane1,
    lane2: input.keyBindings?.lane2 || DEFAULT_SETTINGS.keyBindings.lane2,
    lane3: input.keyBindings?.lane3 || DEFAULT_SETTINGS.keyBindings.lane3,
  };

  const validSkins = ['cyber', 'neon', 'minimal', 'retro'];
  const noteSkin = validSkins.includes(input.noteSkin) ? input.noteSkin : DEFAULT_SETTINGS.noteSkin;
  const touchControlMode = input.touchControlMode === 'direct' ? 'direct' : 'thumb';

  return {
    keyBindings,
    scrollSpeed,
    audioOffsetMs,
    bgmVolume,
    sfxVolume,
    noteSkin,
    showTimingBar: input.showTimingBar !== undefined ? Boolean(input.showTimingBar) : DEFAULT_SETTINGS.showTimingBar,
    autoPlay: Boolean(input.autoPlay),
    touchControlMode,
    hapticFeedback: input.hapticFeedback !== undefined ? Boolean(input.hapticFeedback) : DEFAULT_SETTINGS.hapticFeedback,
  };
}

export interface StorageStatus {
  isPersisted: boolean;
  persistedSupported: boolean;
  usageBytes: number;
  quotaBytes: number;
  songsCount: number;
  customChartsCount: number;
  scoresCount: number;
}

// 1. Storage Persistence Request & Status Engine
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      const isGranted = await navigator.storage.persist();
      console.log('IndexedDB persistent storage requested. Granted:', isGranted);
      return isGranted;
    }
    return false;
  } catch (err) {
    console.warn('Storage persistence request warning:', err);
    return false;
  }
}

export async function checkIsStoragePersisted(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      return await navigator.storage.persisted();
    }
    return false;
  } catch {
    return false;
  }
}

export async function getStorageDiagnostics(): Promise<StorageStatus> {
  let isPersisted = false;
  let persistedSupported = false;
  let usageBytes = 0;
  let quotaBytes = 0;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    if (navigator.storage.persisted) {
      persistedSupported = true;
      try {
        isPersisted = await navigator.storage.persisted();
      } catch {
        isPersisted = false;
      }
    }
    if (navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        usageBytes = est.usage || 0;
        quotaBytes = est.quota || 0;
      } catch {
        // Ignore estimate failure
      }
    }
  }

  let songsCount = 0;
  let customChartsCount = 0;
  let scoresCount = 0;

  try {
    const allSongs = await getAllSongsFromDB();
    songsCount = allSongs.length;
    customChartsCount = allSongs.reduce((acc, s) => acc + Object.keys(s.charts || {}).length, 0);

    const db = await openDB();
    scoresCount = await new Promise<number>((res) => {
      try {
        const tx = db.transaction([STORES.HIGH_SCORES], 'readonly');
        const countReq = tx.objectStore(STORES.HIGH_SCORES).count();
        countReq.onsuccess = () => res(countReq.result);
        countReq.onerror = () => res(0);
      } catch {
        res(0);
      }
    });
  } catch {
    // Fallback to local snapshot counts
    const snapshot = getLocalMetadataSnapshot();
    songsCount = snapshot.songs.length;
    scoresCount = Object.keys(snapshot.highScores).length;
  }

  return {
    isPersisted,
    persistedSupported,
    usageBytes,
    quotaBytes,
    songsCount,
    customChartsCount,
    scoresCount,
  };
}

// 2. Open IndexedDB with Multi-store Schema & Timeout Resilience
let cachedDbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (cachedDbInstance) {
    try {
      // Verify connection is open and contains all required stores
      if (
        cachedDbInstance.name &&
        cachedDbInstance.objectStoreNames.contains(STORES.SONGS) &&
        cachedDbInstance.objectStoreNames.contains(STORES.AUDIO_BLOBS) &&
        cachedDbInstance.objectStoreNames.contains(STORES.HIGH_SCORES) &&
        cachedDbInstance.objectStoreNames.contains(STORES.SETTINGS)
      ) {
        return Promise.resolve(cachedDbInstance);
      }
    } catch {
      cachedDbInstance = null;
    }
  }

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak didukung pada peramban ini.'));
      return;
    }

    let isSettled = false;
    const timeout = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        reject(new Error('IndexedDB open timeout: Mengalihkan ke fallback storage.'));
      }
    }, 4000);

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.SONGS)) {
          db.createObjectStore(STORES.SONGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.AUDIO_BLOBS)) {
          db.createObjectStore(STORES.AUDIO_BLOBS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.HIGH_SCORES)) {
          const scoreStore = db.createObjectStore(STORES.HIGH_SCORES, { keyPath: ['songId', 'difficulty'] });
          scoreStore.createIndex('songId', 'songId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          cachedDbInstance = request.result;
          cachedDbInstance.onversionchange = () => {
            cachedDbInstance?.close();
            cachedDbInstance = null;
          };
          // Auto-trigger storage persistence in the background
          requestPersistentStorage().catch(() => {});
          resolve(request.result);
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB blocked by other connections. Closing stale instances...');
        if (cachedDbInstance) {
          cachedDbInstance.close();
          cachedDbInstance = null;
        }
      };

      request.onerror = () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          cachedDbInstance = null;
          reject(request.error || new Error('Gagal membuka database IndexedDB'));
        }
      };
    } catch (err) {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeout);
        cachedDbInstance = null;
        reject(err);
      }
    }
  });
}

// 3. LocalStorage Redundant Mirror Snapshot
interface LocalMetadataSnapshot {
  timestamp: number;
  songs: Song[];
  highScores: Record<string, HighScore[]>;
}

function getLocalMetadataSnapshot(): LocalMetadataSnapshot {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SNAPSHOT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Gagal membaca snapshot localStorage:', e);
  }
  return { timestamp: Date.now(), songs: [], highScores: {} };
}

function updateLocalMetadataSnapshot(songs: Song[]) {
  try {
    const current = getLocalMetadataSnapshot();
    const cleanSongs = songs.map((s) => {
      const copy = { ...s };
      delete copy.audioBlob;
      return copy;
    });

    // 1. Save Full Snapshot
    try {
      localStorage.setItem(
        LOCAL_STORAGE_SNAPSHOT_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          songs: cleanSongs,
          highScores: current.highScores || {},
        })
      );
    } catch (quotaErr) {
      console.warn('Full snapshot exceeds quota, falling back to granular song storage:', quotaErr);
    }

    // 2. Save Granular Individual Song Keys for Bulletproof Persistence
    cleanSongs.forEach((song) => {
      try {
        localStorage.setItem(`BEATPULSE_SONG_${song.id}`, JSON.stringify(song));
      } catch (err) {
        console.warn(`Granular song backup warning for ${song.id}:`, err);
      }
    });
  } catch (e) {
    console.warn('Gagal memperbarui snapshot localStorage:', e);
  }
}

function updateLocalHighScoreSnapshot(highScore: HighScore) {
  try {
    const current = getLocalMetadataSnapshot();
    const songScores = current.highScores[highScore.songId] || [];
    const filtered = songScores.filter((s) => s.difficulty !== highScore.difficulty);
    filtered.push(highScore);

    current.highScores[highScore.songId] = filtered;
    current.timestamp = Date.now();
    localStorage.setItem(LOCAL_STORAGE_SNAPSHOT_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('Gagal memperbarui skor di snapshot localStorage:', e);
  }
}

// 4. CacheStorage Binary Audio API (Redundant High-Resilience Layer)
export async function saveAudioToCache(songId: string, blob: Blob): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const url = `${AUDIO_CACHE_PREFIX}${encodeURIComponent(songId)}`;
    const response = new Response(blob, {
      headers: {
        'Content-Type': blob.type || 'audio/mpeg',
        'Content-Length': blob.size.toString(),
        'X-BeatPulse-Song-Id': songId,
      },
    });
    await cache.put(url, response);
    return true;
  } catch (err) {
    console.warn(`[saveAudioToCache] CacheStorage put warning for ${songId}:`, err);
    return false;
  }
}

export async function getAudioFromCache(songId: string): Promise<Blob | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const url = `${AUDIO_CACHE_PREFIX}${encodeURIComponent(songId)}`;
    const response = await cache.match(url);
    if (response) {
      const blob = await response.blob();
      if (blob && blob.size > 0) {
        return blob;
      }
    }
  } catch (err) {
    console.warn(`[getAudioFromCache] CacheStorage match warning for ${songId}:`, err);
  }
  return null;
}

export async function deleteAudioFromCache(songId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const url = `${AUDIO_CACHE_PREFIX}${encodeURIComponent(songId)}`;
    return await cache.delete(url);
  } catch {
    return false;
  }
}

// 5. Store & Retrieve Songs with Multi-tier Resilience
export async function saveSongToDB(song: Song, audioBlob?: Blob): Promise<void> {
  // Trigger browser persistent storage request
  requestPersistentStorage().catch(() => {});

  // 1. Prepare sanitized, cloneable metadata
  let cleanSong: Song;
  try {
    cleanSong = JSON.parse(JSON.stringify(normalizeTrackSnapshot(song)));
    delete cleanSong.audioBlob;
  } catch {
    cleanSong = normalizeTrackSnapshot(song);
    delete cleanSong.audioBlob;
  }

  // 2. Granular Per-Track LocalStorage Backup (Zero Track Loss)
  // Remove deleted difficulties so stale backups cannot resurrect them on another device.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(LOCAL_STORAGE_TRACK_PREFIX)) continue;
      const track = JSON.parse(localStorage.getItem(key) || 'null');
      if (track?.songId === cleanSong.id && !Object.hasOwn(cleanSong.charts || {}, track.difficulty)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('Track cleanup warning:', error);
  }
  if (cleanSong.charts && typeof cleanSong.charts === 'object') {
    for (const [diff, chart] of Object.entries(cleanSong.charts)) {
      if (chart && typeof chart === 'object') {
        try {
          localStorage.setItem(`${LOCAL_STORAGE_TRACK_PREFIX}${cleanSong.id}_${diff}`, JSON.stringify(chart));
        } catch (trackErr) {
          console.warn(`Granular track backup warning for ${cleanSong.id}:${diff}:`, trackErr);
        }
      }
    }
  }

  // 3. Primary Fast Redundancy: Save entire song to LocalStorage
  try {
    localStorage.setItem(`BEATPULSE_SONG_${song.id}`, JSON.stringify(cleanSong));
    const currentSnapshot = getLocalMetadataSnapshot();
    const existingIndex = currentSnapshot.songs.findIndex((s) => s.id === cleanSong.id);
    if (existingIndex >= 0) {
      currentSnapshot.songs[existingIndex] = cleanSong;
    } else {
      currentSnapshot.songs.push(cleanSong);
    }
    currentSnapshot.timestamp = Date.now();
    localStorage.setItem(LOCAL_STORAGE_SNAPSHOT_KEY, JSON.stringify(currentSnapshot));
  } catch (lsErr) {
    console.warn('LocalStorage redundancy warning for song metadata:', lsErr);
  }

  // 4. Save audio blob to both IndexedDB and CacheStorage if provided
  if (audioBlob && audioBlob instanceof Blob) {
    await saveAudioBlobToDB(song.id, audioBlob);
  }

  // 5. Durable Storage: Save to IndexedDB SONGS store
  try {
    const db = await openDB();
    if (db.objectStoreNames.contains(STORES.SONGS)) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction([STORES.SONGS], 'readwrite');
          const songStore = tx.objectStore(STORES.SONGS);
          const req = songStore.put(cleanSong);
          req.onerror = () => reject(req.error || new Error('Gagal menulis data lagu'));
          tx.oncomplete = () => resolve();
          tx.onerror = () => {
            cachedDbInstance = null;
            reject(tx.error || new Error('Transaksi lagu IndexedDB gagal'));
          };
          tx.onabort = () => {
            cachedDbInstance = null;
            reject(new Error('Transaksi lagu IndexedDB dibatalkan'));
          };
        } catch (txErr) {
          cachedDbInstance = null;
          reject(txErr);
        }
      });
    }
  } catch (idbErr) {
    cachedDbInstance = null;
    console.warn(`[saveSongToDB] IndexedDB save warning (metadata aman di LocalStorage):`, idbErr);
  }
}

// Dedicated function to save a single track / difficulty chart with atomic commit
export async function saveTrackToDB(songId: string, difficulty: string, chart: Chart): Promise<void> {
  requestPersistentStorage().catch(() => {});

  // 1. Immediately store to per-track LocalStorage key
  try {
    localStorage.setItem(`${LOCAL_STORAGE_TRACK_PREFIX}${songId}_${difficulty}`, JSON.stringify(chart));
  } catch (err) {
    console.warn(`[saveTrackToDB] localStorage track error for ${songId}:${difficulty}:`, err);
  }

  // 2. Fetch active song and update its chart record in IndexedDB and snapshot
  try {
    const songs = await getAllSongsFromDB();
    const song = songs.find((s) => s.id === songId);
    if (song) {
      if (!song.charts) song.charts = {};
      song.charts[difficulty] = chart;
      song.updatedAt = Date.now();
      await saveSongToDB(song);
    }
  } catch (err) {
    console.warn(`[saveTrackToDB] Failed to update full song for track:`, err);
  }
}

export async function getAllSongsFromDB(): Promise<Song[]> {
  const unifiedSongsMap = new Map<string, Song>();

  // 1. Load from IndexedDB
  try {
    const db = await openDB();
    if (db.objectStoreNames.contains(STORES.SONGS)) {
      const songsFromIDB = await new Promise<Song[]>((resolve, reject) => {
        const tx = db.transaction([STORES.SONGS], 'readonly');
        const songStore = tx.objectStore(STORES.SONGS);
        const request = songStore.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      if (songsFromIDB && Array.isArray(songsFromIDB)) {
        songsFromIDB.forEach((s) => {
          if (s && s.id) {
            unifiedSongsMap.set(s.id, s);
          }
        });
      }
    }
  } catch (err) {
    console.warn('Gagal membaca lagu langsung dari IndexedDB:', err);
  }

  // 2. Load from LocalStorage Snapshot
  try {
    const snapshot = getLocalMetadataSnapshot();
    if (snapshot && snapshot.songs && Array.isArray(snapshot.songs)) {
      snapshot.songs.forEach((s) => {
        if (s && s.id) {
          const existing = unifiedSongsMap.get(s.id);
          if (!existing || (s.updatedAt || 0) >= (existing.updatedAt || 0)) {
            unifiedSongsMap.set(s.id, s);
          }
        }
      });
    }
  } catch (snapErr) {
    console.warn('Gagal membaca snapshot lagu localStorage:', snapErr);
  }

  // 3. Load from Granular localStorage Keys (BEATPULSE_SONG_*)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('BEATPULSE_SONG_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsedSong: Song = JSON.parse(raw);
            if (parsedSong && parsedSong.id) {
              const existing = unifiedSongsMap.get(parsedSong.id);
              if (!existing || (parsedSong.updatedAt || 0) >= (existing.updatedAt || 0)) {
                unifiedSongsMap.set(parsedSong.id, parsedSong);
              }
            }
          } catch {
            // Ignore parse error
          }
        }
      }
    }
  } catch (err) {
    console.warn('Granular song recovery warning:', err);
  }

  // 4. Scan Granular Track Keys (BEATPULSE_TRACK_{songId}_{difficulty})
  // Guarantees zero lost tracks even if a song object had outdated charts
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCAL_STORAGE_TRACK_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsedTrack: Chart = JSON.parse(raw);
            if (parsedTrack && parsedTrack.songId && parsedTrack.difficulty) {
              const targetSong = unifiedSongsMap.get(parsedTrack.songId);
              if (targetSong) {
                // Complete snapshots are authoritative: stale track backups cannot undo
                // a cloud edit, rename, or deletion. Legacy incomplete data still recovers.
                if (targetSong.trackSnapshotVersion === 1) continue;
                if (!targetSong.charts) targetSong.charts = {};
                const existingChart = targetSong.charts[parsedTrack.difficulty];
                // Restore track if missing, or if granular track has more notes, or is newer
                if (
                  !existingChart ||
                  (parsedTrack.createdAt && parsedTrack.createdAt > (existingChart.createdAt || 0))
                ) {
                  targetSong.charts[parsedTrack.difficulty] = parsedTrack;
                }
              }
            }
          } catch {
            // Ignore parse error
          }
        }
      }
    }
  } catch (trackRecoveryErr) {
    console.warn('Track recovery warning:', trackRecoveryErr);
  }

  const allSongs = Array.from(unifiedSongsMap.values());

  // 5. Keep both LocalStorage and IndexedDB synchronously updated with full song list & tracks
  if (allSongs.length > 0) {
    updateLocalMetadataSnapshot(allSongs);
    // Background re-seed missing songs into IndexedDB
    openDB()
      .then((db) => {
        if (db.objectStoreNames.contains(STORES.SONGS)) {
          const tx = db.transaction([STORES.SONGS], 'readwrite');
          const store = tx.objectStore(STORES.SONGS);
          allSongs.forEach((s) => {
            const copy = { ...s };
            delete copy.audioBlob;
            store.put(copy);
          });
        }
      })
      .catch(() => {});
  }

  return allSongs;
}

export async function getAudioBlobFromDB(songId: string): Promise<Blob | null> {
  let blob: Blob | null = null;

  // 1. Try IndexedDB first
  try {
    const db = await openDB();
    if (db.objectStoreNames.contains(STORES.AUDIO_BLOBS)) {
      blob = await new Promise<Blob | null>((resolve) => {
        try {
          const tx = db.transaction([STORES.AUDIO_BLOBS], 'readonly');
          const audioStore = tx.objectStore(STORES.AUDIO_BLOBS);
          const request = audioStore.get(songId);

          request.onsuccess = () => {
            const res = request.result;
            if (!res) {
              resolve(null);
              return;
            }
            const candidate = res.blob instanceof Blob ? res.blob : res instanceof Blob ? res : null;
            resolve(candidate);
          };
          request.onerror = () => {
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      });
    }
  } catch (err) {
    console.warn(`[getAudioBlobFromDB] IndexedDB get warning untuk ${songId}:`, err);
  }

  // Verify blob readability to prevent "The object can not be found here" if temporary storage was purged
  if (blob && blob instanceof Blob && blob.size > 0) {
    try {
      const slice = blob.slice(0, Math.min(64, blob.size));
      const testBuf = await slice.arrayBuffer();
      if (testBuf && testBuf.byteLength > 0) {
        // Blob is verified readable and intact
        saveAudioToCache(songId, blob).catch(() => {});
        return blob;
      }
    } catch (readErr) {
      console.warn(`[getAudioBlobFromDB] Detached/purged blob in IndexedDB for ${songId}, testing fallback:`, readErr);
      blob = null;
    }
  }

  // 2. Multi-tier Fallback: Read from CacheStorage
  try {
    const cachedBlob = await getAudioFromCache(songId);
    if (cachedBlob && cachedBlob instanceof Blob && cachedBlob.size > 0) {
      try {
        const slice = cachedBlob.slice(0, Math.min(64, cachedBlob.size));
        const testBuf = await slice.arrayBuffer();
        if (testBuf && testBuf.byteLength > 0) {
          // Self-heal: re-seed back into IndexedDB for fast future read
          saveAudioBlobToDB(songId, cachedBlob).catch(() => {});
          return cachedBlob;
        }
      } catch (cacheReadErr) {
        console.warn(`[getAudioBlobFromDB] Detached cachedBlob for ${songId}:`, cacheReadErr);
      }
    }
  } catch (cacheErr) {
    console.warn(`[getAudioBlobFromDB] CacheStorage fallback warning untuk ${songId}:`, cacheErr);
  }

  return null;
}

export async function saveAudioBlobToDB(songId: string, blob: Blob): Promise<void> {
  if (!blob || !(blob instanceof Blob) || blob.size === 0) {
    return;
  }

  // 1. Ensure we store a normalized in-memory binary Blob to avoid detached OS file handles
  let pureBlob: Blob = blob;
  try {
    const ab = await blob.arrayBuffer();
    pureBlob = new Blob([ab], { type: blob.type || 'audio/mpeg' });
  } catch {
    // If arrayBuffer failed, retain original blob
  }

  // 2. Multi-tier Redundancy: Save to CacheStorage
  saveAudioToCache(songId, pureBlob).catch(() => {});

  // 3. Save to IndexedDB
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORES.AUDIO_BLOBS)) {
      console.warn(`[saveAudioBlobToDB] Store ${STORES.AUDIO_BLOBS} tidak ditemukan di IndexedDB.`);
      return;
    }

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORES.AUDIO_BLOBS], 'readwrite');
        const audioStore = tx.objectStore(STORES.AUDIO_BLOBS);
        const req = audioStore.put({ id: songId, blob: pureBlob });

        req.onerror = () => {
          console.warn('[saveAudioBlobToDB] Request error:', req.error);
          resolve();
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.warn('[saveAudioBlobToDB] Transaction error:', tx.error);
          resolve();
        };
        tx.onabort = () => {
          console.warn('[saveAudioBlobToDB] Transaction aborted');
          resolve();
        };
      } catch (err) {
        console.warn('[saveAudioBlobToDB] Transaction execution failed:', err);
        resolve();
      }
    });
  } catch (err) {
    console.warn('[saveAudioBlobToDB] openDB or storage warning:', err);
  }
}

export async function deleteSongFromDB(songId: string): Promise<void> {
  // 1. Delete from CacheStorage
  deleteAudioFromCache(songId).catch(() => {});

  // 2. Delete from IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.SONGS, STORES.AUDIO_BLOBS, STORES.HIGH_SCORES], 'readwrite');
      tx.objectStore(STORES.SONGS).delete(songId);
      tx.objectStore(STORES.AUDIO_BLOBS).delete(songId);

      // Clean scores
      const scoreStore = tx.objectStore(STORES.HIGH_SCORES);
      const index = scoreStore.index('songId');
      const request = index.getAllKeys(songId);

      request.onsuccess = () => {
        const keys = request.result;
        keys.forEach((key) => scoreStore.delete(key));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Gagal menghapus lagu'));
    });
  } catch (err) {
    console.warn('IndexedDB delete warning:', err);
  }

  // 3. Remove from localStorage backups (individual song, all tracks, drafts, and playhead)
  try {
    localStorage.removeItem(`BEATPULSE_SONG_${songId}`);
    localStorage.removeItem(`BEATPULSE_EDITOR_TIME_${songId}`);

    const trackPrefix = `${LOCAL_STORAGE_TRACK_PREFIX}${songId}_`;
    const draftPrefix = `BEATPULSE_CHART_DRAFT_${songId}_`;
    
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(trackPrefix) || key.startsWith(draftPrefix))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore
  }

  // 4. Update localStorage mirror snapshot
  try {
    const snapshot = getLocalMetadataSnapshot();
    updateLocalMetadataSnapshot(snapshot.songs.filter(song => song.id !== songId));
    const all = await getAllSongsFromDB();
    updateLocalMetadataSnapshot(all.filter(song => song.id !== songId));
  } catch {
    // Ignore
  }
}

// 5. High Scores with Redundancy
export async function saveHighScore(highScore: HighScore): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.HIGH_SCORES], 'readwrite');
      const store = tx.objectStore(STORES.HIGH_SCORES);

      const getReq = store.get([highScore.songId, highScore.difficulty]);

      getReq.onsuccess = () => {
        const existing: HighScore | undefined = getReq.result;
        if (!existing || highScore.score > existing.score) {
          store.put(highScore);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Gagal menyimpan high score ke IndexedDB:', err);
  }

  // Mirror to LocalStorage
  updateLocalHighScoreSnapshot(highScore);
}

export async function getHighScoresForSong(songId: string): Promise<Record<string, HighScore>> {
  const map: Record<string, HighScore> = {};

  try {
    const db = await openDB();
    const scores = await new Promise<HighScore[]>((resolve, reject) => {
      const tx = db.transaction([STORES.HIGH_SCORES], 'readonly');
      const store = tx.objectStore(STORES.HIGH_SCORES);
      const index = store.index('songId');
      const request = index.getAll(songId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    scores.forEach((s) => {
      map[s.difficulty] = s;
    });
  } catch (err) {
    console.warn(`Gagal mengambil high scores dari IndexedDB untuk ${songId}:`, err);
    // Fallback from localStorage
    const snapshot = getLocalMetadataSnapshot();
    const songScores = snapshot.highScores[songId] || [];
    songScores.forEach((s) => {
      map[s.difficulty] = s;
    });
  }

  return map;
}

// 6. Settings Storage
export async function saveSettingsToDB(settings: GameSettings): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.SETTINGS], 'readwrite');
      const store = tx.objectStore(STORES.SETTINGS);
      store.put({ id: 'user_settings', ...settings });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Gagal menyimpan pengaturan ke IndexedDB:', err);
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Gagal menyimpan pengaturan ke localStorage:', err);
  }
}

export async function getSettingsFromDB(): Promise<GameSettings> {
  try {
    const db = await openDB();
    const settings = await new Promise<GameSettings | null>((resolve) => {
      const tx = db.transaction([STORES.SETTINGS], 'readonly');
      const store = tx.objectStore(STORES.SETTINGS);
      const request = store.get('user_settings');

      request.onsuccess = () => {
        if (request.result) {
          const { id, ...s } = request.result;
          resolve(sanitizeSettings(s));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });

    if (settings) {
      return settings;
    }
  } catch {
    // Fallback to localStorage
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (raw) {
      return sanitizeSettings(JSON.parse(raw));
    }
  } catch {
    // Return default
  }

  return { ...DEFAULT_SETTINGS };
}

// Helpers for binary audio serialization in backups
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'audio/mpeg';
  const bstr = atob(parts[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// 7. Full Library Backup & Restore Engine (.json / .beatpulse)
export interface FullLibraryBackup {
  version: number;
  appName: string;
  exportedAt: string;
  settings: GameSettings;
  songs: Song[];
  highScores: Record<string, HighScore[]>;
  audioBlobs?: Record<string, string>; // base64 encoded audio blobs for custom songs
}

export async function exportLibraryBackup(includeAudio: boolean = true): Promise<FullLibraryBackup> {
  const songs = await getAllSongsFromDB();
  const settings = await getSettingsFromDB();
  const db = await openDB();

  const allScores: HighScore[] = await new Promise((resolve) => {
    try {
      const tx = db.transaction([STORES.HIGH_SCORES], 'readonly');
      const req = tx.objectStore(STORES.HIGH_SCORES).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });

  const highScoresMap: Record<string, HighScore[]> = {};
  allScores.forEach((s) => {
    if (!highScoresMap[s.songId]) highScoresMap[s.songId] = [];
    highScoresMap[s.songId].push(s);
  });

  // Export audio blobs as base64 for custom songs
  const audioBlobsMap: Record<string, string> = {};
  if (includeAudio) {
    for (const song of songs) {
      if (!song.isPreset && !song.youtubeVideoId) {
        try {
          const blob = await getAudioBlobFromDB(song.id);
          if (blob && blob.size > 0) {
            audioBlobsMap[song.id] = await blobToBase64(blob);
          }
        } catch (audioErr) {
          console.warn(`Audio export warning for song ${song.id}:`, audioErr);
        }
      }
    }
  }

  return {
    version: DB_VERSION,
    appName: 'BeatPulse Studio',
    exportedAt: new Date().toISOString(),
    settings,
    songs,
    highScores: highScoresMap,
    audioBlobs: audioBlobsMap,
  };
}

export async function importLibraryBackup(backupData: FullLibraryBackup): Promise<{ importedSongsCount: number; importedAudioCount: number }> {
  if (!backupData || !Array.isArray(backupData.songs)) {
    throw new Error('Format file cadangan tidak valid.');
  }

  // 1. Save Settings if provided
  if (backupData.settings) {
    await saveSettingsToDB(backupData.settings);
  }

  // 2. Save Audio Blobs if available (prioritize before songs so songs find audio)
  let importedAudioCount = 0;
  if (backupData.audioBlobs && typeof backupData.audioBlobs === 'object') {
    for (const [songId, dataUrl] of Object.entries(backupData.audioBlobs)) {
      try {
        if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
          const blob = base64ToBlob(dataUrl);
          if (blob && blob.size > 0) {
            await saveAudioBlobToDB(songId, blob);
            importedAudioCount++;
          }
        }
      } catch (err) {
        console.warn(`Audio import restore warning for ${songId}:`, err);
      }
    }
  }

  // 3. Save Songs & All Tracks
  let importedSongsCount = 0;
  for (const song of backupData.songs) {
    if (song && song.id && song.title && song.charts) {
      await saveSongToDB(song);
      importedSongsCount++;
    }
  }

  // 4. Save High Scores
  if (backupData.highScores) {
    for (const [_, scores] of Object.entries(backupData.highScores)) {
      if (Array.isArray(scores)) {
        for (const s of scores) {
          if (s && s.songId && s.score) {
            await saveHighScore(s);
          }
        }
      }
    }
  }

  return { importedSongsCount, importedAudioCount };
}

