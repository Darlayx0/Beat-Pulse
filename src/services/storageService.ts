import { Song, Chart, HighScore, GameSettings } from '../types.ts';
import {
  getAllSongsFromDB,
  saveSongToDB,
  getAudioBlobFromDB,
  deleteSongFromDB,
  saveHighScore,
  getHighScoresForSong,
  saveSettingsToDB,
  getSettingsFromDB,
  DEFAULT_SETTINGS,
  sanitizeSettings,
  requestPersistentStorage,
  checkIsStoragePersisted,
  getStorageDiagnostics,
  exportLibraryBackup,
  importLibraryBackup,
  FullLibraryBackup,
  StorageStatus,
} from '../lib/indexedDb.ts';
import { PRESET_SONGS, mergeSongsWithPresets } from '../lib/defaultSongs.ts';
import { getAuthToken } from './authService.ts';
import { publishSong, publishDeletion, syncCloudSongs, visibleToAccount, getChartAccountId } from './chartCloudService';

export interface ActiveSession {
  tab: 'library' | 'editor' | 'game' | 'results';
  activeSongId?: string;
  activeDifficulty?: string;
  isTestPlay?: boolean;
  timestamp?: number;
}

const ACTIVE_SESSION_KEY = 'BEATPULSE_ACTIVE_SESSION';

export class StorageService {
  static saveActiveSession(session: ActiveSession): void {
    try {
      localStorage.setItem(
        ACTIVE_SESSION_KEY,
        JSON.stringify({ ...session, timestamp: Date.now() })
      );
    } catch {
      // Ignore storage error
    }
  }

  static loadActiveSession(): ActiveSession | null {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (raw) {
        return JSON.parse(raw) as ActiveSession;
      }
    } catch {
      // Ignore parse error
    }
    return null;
  }

  static async requestPersistence(): Promise<boolean> {
    return await requestPersistentStorage();
  }

  static async checkPersistence(): Promise<boolean> {
    return await checkIsStoragePersisted();
  }

  static async getDiagnostics(): Promise<StorageStatus> {
    return await getStorageDiagnostics();
  }

  static async loadSettings(targetUserId?: string): Promise<GameSettings> {
    let localSettings: GameSettings = { ...DEFAULT_SETTINGS };
    try {
      localSettings = sanitizeSettings(await getSettingsFromDB());
    } catch (err) {
      console.warn('Gagal memuat pengaturan dari IndexedDB, menggunakan default:', err);
    }

    const token = await getAuthToken();
    if (token) {
      try {
        const response = await fetch('/api/settings', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const cloudSettings = await response.json();
          const merged = sanitizeSettings({ ...DEFAULT_SETTINGS, ...localSettings, ...cloudSettings });
          await saveSettingsToDB(merged).catch(() => {});
          return merged;
        }
      } catch (cloudErr) {
        console.warn('[StorageService] Gagal memuat pengaturan dari Cloud SQL backend:', cloudErr);
      }
    }

    return sanitizeSettings(localSettings);
  }

  static async saveSettings(settings: GameSettings, targetUserId?: string): Promise<void> {
    try {
      // 1. Primary Save to Local IndexedDB
      await saveSettingsToDB(settings);

      // 2. Save to Cloud SQL per Google Account
      const token = await getAuthToken();
      if (token) {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(settings),
        });
      }
    } catch (err) {
      console.error('Gagal menyimpan pengaturan:', err);
      throw new Error('Gagal menyimpan pengaturan.');
    }
  }

  static async loadSongs(): Promise<Song[]> {
    try {
      const dbSongs = await getAllSongsFromDB();
      return mergeSongsWithPresets(dbSongs.filter(s => visibleToAccount(s, getChartAccountId())));
    } catch (err) {
      console.error('Gagal memuat daftar lagu dari IndexedDB:', err);
      return mergeSongsWithPresets([]);
    }
  }

  /** Save locally first; the selected provider queues cloud writes without blocking the editor. */
  static async saveSong(song: Song, audioBlob?: Blob, targetUserId?: string): Promise<void> {
    const uid = getChartAccountId();
    if (song.userId && song.userId !== uid) throw new Error('Lagu ini milik akun lain.');
    const owner = song.userId || uid || '';
    if (targetUserId && targetUserId !== uid) throw new Error('Akun sinkronisasi tidak cocok.');
    const saved = { ...song, userId: owner, updatedAt: Date.now() };
    await saveSongToDB(saved, audioBlob);
    publishSong(saved);
  }

  static async syncSongsWithCloud(targetUserId?: string): Promise<Song[]> {
    if (targetUserId && targetUserId !== getChartAccountId()) return this.loadSongs();
    return syncCloudSongs();
  }

  static async getAudioBlob(songId: string): Promise<Blob | null> {
    try {
      return await getAudioBlobFromDB(songId);
    } catch (err) {
      console.error('Gagal mengambil audio blob dari DB:', err);
      return null;
    }
  }

  /**
   * Saves an individual difficulty track atomically across all storage tiers
   */
  static async saveTrack(songId: string, difficulty: string, chart: Chart): Promise<void> {
    try {
      const song = (await getAllSongsFromDB()).find(s => s.id === songId);
      if (!song) throw new Error('Lagu tidak ditemukan.');
      await this.saveSong({ ...song, charts: {
        ...song.charts, [difficulty]: { ...chart, songId, difficulty },
      } });
    } catch (err) {
      console.error('Gagal menyimpan track chart:', err);
      throw err;
    }
  }

  /**
   * Verifies the storage integrity and multi-layer presence of a song and its tracks
   */
  static async verifySongStorage(songId: string): Promise<{
    hasMetadata: boolean;
    hasAudio: boolean;
    audioSource: 'indexeddb' | 'cache' | 'youtube' | 'preset' | 'none';
    trackCount: number;
    isPersisted: boolean;
  }> {
    const isPersisted = await checkIsStoragePersisted();
    const songs = await getAllSongsFromDB();
    const song = songs.find((s) => s.id === songId);
    if (!song) {
      return { hasMetadata: false, hasAudio: false, audioSource: 'none', trackCount: 0, isPersisted };
    }

    const trackCount = song.charts ? Object.keys(song.charts).length : 0;
    if (song.isPreset) {
      return { hasMetadata: true, hasAudio: true, audioSource: 'preset', trackCount, isPersisted };
    }
    if (song.youtubeVideoId) {
      return { hasMetadata: true, hasAudio: true, audioSource: 'youtube', trackCount, isPersisted };
    }

    const blob = await getAudioBlobFromDB(songId);
    const hasAudio = Boolean(blob && blob.size > 0);
    return {
      hasMetadata: true,
      hasAudio,
      audioSource: hasAudio ? 'indexeddb' : 'none',
      trackCount,
      isPersisted,
    };
  }

  static async deleteSong(songId: string): Promise<void> {
    const song = (await getAllSongsFromDB()).find(s => s.id === songId);
    await deleteSongFromDB(songId);
    if (song && visibleToAccount(song, getChartAccountId())) publishDeletion(songId);
  }

  static async resetPresetSong(presetId: string): Promise<Song | null> {
    const original = PRESET_SONGS.find((p) => p.id === presetId);
    if (!original) return null;
    await deleteSongFromDB(presetId);
    return original;
  }

  static async saveScore(score: HighScore): Promise<void> {
    try {
      // 1. Save to local IndexedDB
      await saveHighScore(score);

      // 2. Persist to Cloud SQL
      const token = await getAuthToken();
      if (token) {
        await fetch('/api/scores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(score),
        });
      }
    } catch (err) {
      console.error('Gagal menyimpan skor:', err);
    }
  }

  static async getHighScores(songId: string): Promise<Record<string, HighScore>> {
    try {
      const localScores = await getHighScoresForSong(songId);
      const token = await getAuthToken();
      if (token) {
        try {
          const response = await fetch(`/api/scores?songId=${encodeURIComponent(songId)}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const cloudScores: HighScore[] = await response.json();
            for (const s of cloudScores) {
              if (!localScores[s.difficulty] || s.score > localScores[s.difficulty].score) {
                localScores[s.difficulty] = s;
                await saveHighScore(s).catch(() => {});
              }
            }
          }
        } catch {
          // Fallback to localScores
        }
      }
      return localScores;
    } catch (err) {
      console.error('Gagal mengambil high scores:', err);
      return {};
    }
  }

  static async exportBackup(): Promise<FullLibraryBackup> {
    return await exportLibraryBackup();
  }

  static async importBackup(backupData: FullLibraryBackup): Promise<{ importedSongsCount: number }> {
    return await importLibraryBackup(backupData);
  }
}
