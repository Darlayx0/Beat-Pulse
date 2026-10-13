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
import { getAuthToken, authService } from './authService.ts';
import { downloadGithubAudio } from './githubSyncService';
import { publishSong, publishDeletion, syncCloudSongs, visibleToAccount, getChartAccountId } from './chartCloudService';
import { persistenceUid } from './accountPersistence';
import { accountScores, readAccountState, writeAccountEntry, mergeAccountState, storeAccountState, saveAccountProfile } from '../lib/accountState';

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
    const uid = persistenceUid();
    const accountSettings = readAccountState(uid).entries.settings?.value;
    if (accountSettings) return sanitizeSettings(accountSettings);
    let localSettings: GameSettings = { ...DEFAULT_SETTINGS };
    try {
      if (uid === 'guest_unauthenticated') localSettings = sanitizeSettings(await getSettingsFromDB());
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
      writeAccountEntry(persistenceUid(), 'settings', sanitizeSettings(settings));

      // 2. Save to Cloud SQL per Google Account
      const token = await getAuthToken();
      if (token) {
        try {
        const response = await fetch('/api/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(settings),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) console.warn('Pengaturan tersimpan lokal; backend belum menerima perubahan.');
        } catch (error) { console.warn('Pengaturan tersimpan lokal; backend sedang tidak tersedia.', error); }
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
    const saved = { ...song, userId: owner, updatedAt: Date.now(),
      ...(audioBlob ? { githubAudio: undefined } : {}) };
    await saveSongToDB(saved, audioBlob);
    publishSong(saved);
  }

  static async syncSongsWithCloud(targetUserId?: string): Promise<Song[]> {
    if (targetUserId && targetUserId !== getChartAccountId()) return this.loadSongs();
    return syncCloudSongs();
  }

  static async getAudioBlob(songId: string): Promise<Blob | null> {
    try {
      const local = await getAudioBlobFromDB(songId);
      if (local) return local;
      const song = (await getAllSongsFromDB()).find(s => s.id === songId);
      return song ? await downloadGithubAudio(song) : null;
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
      const uid = persistenceUid();
      const owned = { ...score, userId: uid };
      const key = `score:${encodeURIComponent(score.songId)}:${encodeURIComponent(score.difficulty)}`;
      const previous = readAccountState(uid).entries[key]?.value;
      if (!previous || score.score > previous.score) writeAccountEntry(uid, key, owned);
      // 1. Save to local IndexedDB
      await saveHighScore(score);

      // 2. Persist to Cloud SQL
      const token = await getAuthToken();
      if (token) {
        try {
        const response = await fetch('/api/scores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(score),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) console.warn('Skor tersimpan lokal; backend belum menerima perubahan.');
        } catch (error) { console.warn('Skor tersimpan lokal; backend sedang tidak tersedia.', error); }
      }
    } catch (err) {
      console.error('Gagal menyimpan skor:', err);
      throw new Error('Skor gagal tersimpan. Periksa kapasitas penyimpanan browser.');
    }
  }

  static async getHighScores(songId: string): Promise<Record<string, HighScore>> {
    try {
      const uid = persistenceUid();
      const owned = accountScores(readAccountState(uid), songId);
      const oldScores = await getHighScoresForSong(songId);
      const localScores = Object.fromEntries(Object.entries(oldScores).filter(([, score]) => score.userId === uid || (uid === 'guest_unauthenticated' && !score.userId)));
      for (const score of Object.values(localScores)) {
        if (!owned[score.difficulty] || score.score > owned[score.difficulty].score) {
          writeAccountEntry(uid, `score:${encodeURIComponent(songId)}:${encodeURIComponent(score.difficulty)}`, { ...score, userId: uid });
          owned[score.difficulty] = { ...score, userId: uid };
        }
      }
      if (uid.startsWith('github:')) return owned;
      const token = await getAuthToken();
      if (token) {
        try {
          const response = await fetch(`/api/scores?songId=${encodeURIComponent(songId)}&userOnly=true`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: AbortSignal.timeout(8000),
          });
          if (response.ok) {
            const cloudScores: HighScore[] = await response.json();
            for (const s of cloudScores.filter(score => score.userId === uid)) {
              if (!localScores[s.difficulty] || s.score > localScores[s.difficulty].score) {
                localScores[s.difficulty] = s;
                writeAccountEntry(uid, `score:${encodeURIComponent(songId)}:${encodeURIComponent(s.difficulty)}`, { ...s, userId: uid });
                owned[s.difficulty] = { ...s, userId: uid };
                await saveHighScore(s).catch(() => {});
              }
            }
          }
        } catch {
          // Fallback to localScores
        }
      }
      return { ...localScores, ...owned };
    } catch (err) {
      console.error('Gagal mengambil high scores:', err);
      return {};
    }
  }

  static async exportBackup(): Promise<FullLibraryBackup> {
    const uid = persistenceUid();
    if (!readAccountState(uid).entries.profile) {
      saveAccountProfile(uid, authService.getCurrentProfile());
    }
    const songs = await this.loadSongs();
    for (const song of songs) {
      if (!song.isPreset && !song.youtubeVideoId && song.githubAudio && !await getAudioBlobFromDB(song.id)) {
        if (!await downloadGithubAudio(song)) throw new Error(`Audio ${song.title} belum tersedia untuk dicadangkan.`);
      }
    }
    const backup = await exportLibraryBackup();
    const ids = new Set(songs.map(song => song.id));
    backup.songs = songs;
    backup.audioBlobs = Object.fromEntries(Object.entries(backup.audioBlobs || {}).filter(([id]) => ids.has(id)));
    for (const song of songs) if (!song.isPreset && !song.youtubeVideoId && !backup.audioBlobs?.[song.id] && (!song.audioUrl || /^(blob:|data:)/.test(song.audioUrl))) throw new Error(`Audio ${song.title} belum tersedia untuk dicadangkan.`);
    backup.accountState = readAccountState(uid);
    backup.activeSession = this.loadActiveSession() || undefined;
    backup.settings = await this.loadSettings();
    const legacyScores = backup.highScores;
    backup.highScores = Object.fromEntries(songs.map(song => [song.id, [
      ...(legacyScores[song.id] || []).filter(score => score.userId === uid || (uid === 'guest_unauthenticated' && !score.userId)),
      ...Object.values(accountScores(backup.accountState!, song.id)),
    ]]));
    backup.editorDrafts = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)!;
      if (songs.some(song => key.startsWith(`BEATPULSE_CHART_DRAFT_${song.id}_`) || key.startsWith(`BEATPULSE_OFFSET_BACKUP_${song.id}_`) || key === `BEATPULSE_EDITOR_TIME_${song.id}`)) backup.editorDrafts[key] = localStorage.getItem(key)!;
    }
    return backup;
  }

  static async importBackup(backupData: FullLibraryBackup): Promise<{ importedSongsCount: number }> {
    const uid = persistenceUid();
    if (backupData.accountState && backupData.accountState.uid !== uid) throw new Error('Hubungkan akun asal cadangan sebelum memulihkan progresnya.');
    const result = await importLibraryBackup(backupData);
    if (backupData.accountState) storeAccountState(mergeAccountState(readAccountState(uid), backupData.accountState));
    if (backupData.settings) writeAccountEntry(uid, 'settings', sanitizeSettings(backupData.settings));
    for (const scores of Object.values(backupData.highScores || {})) for (const score of scores) {
      const key = `score:${encodeURIComponent(score.songId)}:${encodeURIComponent(score.difficulty)}`;
      const previous = readAccountState(uid).entries[key]?.value;
      if (!previous || score.score > previous.score) writeAccountEntry(uid, key, { ...score, userId: uid });
    }
    for (const [key, value] of Object.entries(backupData.editorDrafts || {})) localStorage.setItem(key, value);
    if (backupData.activeSession) this.saveActiveSession(backupData.activeSession);
    window.dispatchEvent(new Event('beatpulse-account-dirty'));
    window.dispatchEvent(new CustomEvent('beatpulse-account-restored', { detail: readAccountState(uid) }));
    for (const song of backupData.songs) if (visibleToAccount(song, getChartAccountId())) publishSong(song);
    return result;
  }
}
