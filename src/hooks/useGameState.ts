import { useState, useEffect, useCallback } from 'react';
import {
  Song,
  Chart,
  DifficultyLevel,
  GameStats,
  GameSettings,
  HighScore,
  UIStatus,
  ToastMessage,
} from '../types';
import { StorageService } from '../services/storageService';
import { AudioService } from '../services/audioService';
import { audioEngine } from '../lib/audioEngine';
import { PRESET_SONGS, mergeSongsWithPresets } from '../lib/defaultSongs';
import { StorageStatus, FullLibraryBackup, DEFAULT_SETTINGS, saveAudioBlobToDB } from '../lib/indexedDb';
import { authService } from '../services/authService';
import { sanitizeSong, sanitizeChart, parseChartJson } from '../lib/chartSanitizer';

export function useGameState() {
  const [tab, setTab] = useState<'library' | 'editor' | 'game' | 'results'>('library');
  const [status, setStatus] = useState<UIStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [songs, setSongs] = useState<Song[]>(PRESET_SONGS);
  const [audioBuffers, setAudioBuffers] = useState<Record<string, AudioBuffer>>({});
  const [highScores, setHighScores] = useState<Record<string, Record<string, HighScore>>>({});
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);

  // Active game session & draft states
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [activeChart, setActiveChart] = useState<Chart | null>(null);
  const [lastGameStats, setLastGameStats] = useState<GameStats | null>(null);
  const [isTestPlay, setIsTestPlay] = useState<boolean>(false);
  const [testPlayStartTime, setTestPlayStartTime] = useState<number>(0);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen for online/offline browser network status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      addToast('success', 'Koneksi terhubung kembali! Melanjutkan sesi...');
      // Sync cloud data silently in background when network recovers
      StorageService.syncSongsWithCloud()
        .then((synced) => {
          if (synced && synced.length > 0) {
            setSongs(mergeSongsWithPresets(synced));
          }
        })
        .catch((err) => console.warn('[useGameState] Background reconnect sync warning:', err));
    };

    const handleOffline = () => {
      setIsOffline(true);
      addToast('info', 'Jaringan terputus. Mengalihkan ke mode offline...');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  // Auto-save active session state whenever screen, active song, or difficulty updates
  useEffect(() => {
    if (status === 'success' || status === 'empty') {
      StorageService.saveActiveSession({
        tab,
        activeSongId: activeSong?.id,
        activeDifficulty: activeChart?.difficulty,
        isTestPlay,
      });
    }
  }, [tab, activeSong?.id, activeChart?.difficulty, isTestPlay, status]);

  // Initialize Data
  const initializeApp = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);

    try {
      // 1. Request persistent storage from browser asynchronously in background
      StorageService.requestPersistence().catch(() => {});

      // 2. Load Settings with instant fallback
      const savedSettings = await StorageService.loadSettings().catch(() => DEFAULT_SETTINGS);
      setSettings(savedSettings);

      // 3. Load Songs from DB & Cloud Sync (always merged with presets)
      let combinedSongs: Song[] = PRESET_SONGS;
      try {
        const userSongs = await StorageService.syncSongsWithCloud();
        combinedSongs = mergeSongsWithPresets(userSongs);
      } catch (e) {
        console.warn('Sync songs warning, fallback to default presets:', e);
      }
      setSongs(combinedSongs);

      // 4. Quick Load Scores (non-blocking)
      const scoreMap: Record<string, Record<string, HighScore>> = {};
      await Promise.all(
        combinedSongs.map(async (song) => {
          try {
            const scores = await StorageService.getHighScores(song.id);
            scoreMap[song.id] = scores;
          } catch {
            scoreMap[song.id] = {};
          }
        })
      );
      setHighScores(scoreMap);

      // 5. Diagnostics in background
      StorageService.getDiagnostics()
        .then((diag) => setStorageStatus(diag))
        .catch(() => {});

      // 6. Restore last active session (if any)
      const savedSession = StorageService.loadActiveSession();
      if (savedSession && savedSession.tab && savedSession.tab !== 'library') {
        const restoredSong = combinedSongs.find((s) => s.id === savedSession.activeSongId);
        if (restoredSong) {
          const availableDiffs = Object.keys(restoredSong.charts || {});
          const restoredDiff =
            savedSession.activeDifficulty && availableDiffs.includes(savedSession.activeDifficulty)
              ? savedSession.activeDifficulty
              : availableDiffs[0] || 'Medium';
          const restoredChart = restoredSong.charts?.[restoredDiff] || Object.values(restoredSong.charts || {})[0];

          setActiveSong(restoredSong);
          if (restoredChart) {
            setActiveChart(restoredChart);
          }
          setIsTestPlay(Boolean(savedSession.isTestPlay));

          // Restore tab safely (avoid auto-launching game tab on cold start refresh)
          if (savedSession.tab === 'editor' || savedSession.tab === 'results') {
            setTab(savedSession.tab);
          } else {
            setTab('library');
          }
        }
      }

      if (combinedSongs.length === 0) {
        setStatus('empty');
      } else {
        setStatus('success');
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
      // Even on error, fallback to preset songs so the app is always playable
      setSongs(PRESET_SONGS);
      setStatus('success');
    }
  }, [addToast]);

  useEffect(() => {
    initializeApp();

    // Subscribe to auth state changes to synchronize cloud songs & settings upon Google Login / account switch
    const unsubscribeAuth = authService.subscribe((profile) => {
      if (profile.isGoogleLinked && profile.uid !== 'guest_unauthenticated') {
        // 1. Synchronize user settings from Firestore
        StorageService.loadSettings(profile.uid)
          .then((userSettings) => {
            if (userSettings) {
              setSettings(userSettings);
            }
          })
          .catch((err) => console.warn('[useGameState] Settings sync warning:', err));

        // 2. Synchronize user imported songs from Firestore
        StorageService.syncSongsWithCloud(profile.uid)
          .then((syncedSongs) => {
            if (syncedSongs && syncedSongs.length > 0) {
              setSongs((prev) => {
                const songMap = new Map<string, Song>();
                prev.forEach((s) => {
                  if (s && s.id) songMap.set(s.id, s);
                });
                syncedSongs.forEach((s) => {
                  if (s && s.id) {
                    const existing = songMap.get(s.id);
                    if (!existing || (s.updatedAt || 0) >= (existing.updatedAt || 0)) {
                      songMap.set(s.id, s);
                    }
                  }
                });
                return mergeSongsWithPresets(Array.from(songMap.values()));
              });
            }
          })
          .catch((err) => console.warn('[useGameState] Auth cloud sync warning:', err));
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, [initializeApp]);

  // Select Song To Play (Smart Sanitized & Zero-Crash Audio Fallback)
  const selectSongToPlay = async (
    song: Song,
    difficulty: DifficultyLevel,
    customChart?: Chart,
    isTest = false,
    startTime = 0
  ) => {
    try {
      setIsTestPlay(isTest);
      setTestPlayStartTime(startTime);
      const cleanSong = sanitizeSong(song);
      let rawChart = customChart || cleanSong.charts?.[difficulty] || Object.values(cleanSong.charts || {})[0];
      const cleanChart = sanitizeChart(rawChart, cleanSong.id, difficulty, cleanSong.bpm);

      if (cleanSong.youtubeVideoId) {
        if (audioBuffers[cleanSong.id]) {
          audioEngine.setFallbackBuffer(audioBuffers[cleanSong.id]);
        } else {
          try {
            const blob = await StorageService.getAudioBlob(cleanSong.id);
            if (blob) {
              const buf = await AudioService.decodeAudioBlob(blob);
              setAudioBuffers((prev) => ({ ...prev, [cleanSong.id]: buf }));
              audioEngine.setFallbackBuffer(buf);
            }
          } catch {
            // Ignore missing fallback
          }
        }
        try {
          await audioEngine.loadYouTubeTrack(cleanSong.youtubeVideoId);
        } catch (e) {
          console.warn('YouTube track load warning:', e);
        }
      } else {
        let buffer: AudioBuffer | null = null;

        if (!cleanSong.isPreset) {
          try {
            const blob = await StorageService.getAudioBlob(cleanSong.id);
            if (blob && blob.size > 0) {
              buffer = await AudioService.decodeAudioBlob(blob);
              setAudioBuffers((prev) => ({ ...prev, [cleanSong.id]: buffer! }));
            }
          } catch (err) {
            console.warn('Audio lokal tidak dapat didekode, beralih ke audio darurat:', err);
          }

          if (!buffer && audioBuffers[cleanSong.id]) {
            buffer = audioBuffers[cleanSong.id];
          }

          // Smart Synthetic Emergency Audio Resonator:
          // If audio blob was cleared/purged by browser, synthesize synchronized backup audio track on the fly
          // to rescue 100% of charts and notes without crashing!
          if (!buffer) {
            console.info(`[Auto-Doctor] Mengaktifkan audio ritme darurat untuk "${cleanSong.title}" agar gameplay tetap berjalan lancar.`);
            buffer = AudioService.createSynthAudio(cleanSong.bpm || 120, cleanSong.duration || 60, 'synthwave');
            (buffer as any)._isEmergencySynth = true;
            setAudioBuffers((prev) => ({ ...prev, [cleanSong.id]: buffer! }));
            addToast('info', `Audio darurat tersinkronisasi aktif. Semua chart & ketukan terselamatkan!`);
          }
        } else {
          buffer = audioBuffers[cleanSong.id];
          if (!buffer) {
            const style = cleanSong.id.includes('serene') ? 'calm' : cleanSong.id.includes('cyber') ? 'cyber' : 'synthwave';
            buffer = AudioService.createSynthAudio(cleanSong.bpm, cleanSong.duration, style);
            setAudioBuffers((prev) => ({ ...prev, [cleanSong.id]: buffer! }));
          }
        }

        if (buffer) {
          audioEngine.loadBuffer(buffer);
        }
      }

      setActiveSong(cleanSong);
      setActiveChart(cleanChart);
      setTab('game');
    } catch (err: any) {
      console.error('Error saat menyiapkan lagu:', err);
      addToast('error', err.message || 'Gagal menyiapkan lagu.');
    }
  };

  // Select Song To Edit (Smart Sanitized & Safe Preload)
  const selectSongToEdit = async (song: Song, difficulty: DifficultyLevel) => {
    // 1. Immediately stop any playing audio and clear previous active buffer
    audioEngine.stopBGM();
    audioEngine.clearActiveBuffer();

    const cleanSong = sanitizeSong(song);
    let rawChart = cleanSong.charts?.[difficulty] || Object.values(cleanSong.charts || {})[0];
    const cleanChart = sanitizeChart(rawChart, cleanSong.id, difficulty, cleanSong.bpm);

    setActiveSong(cleanSong);
    setActiveChart(cleanChart);

    // 2. Preload buffer specifically for this song so editor plays smoothly
    if (!cleanSong.youtubeVideoId) {
      let buffer: AudioBuffer | null = null;
      if (cleanSong.isPreset) {
        buffer = audioBuffers[cleanSong.id];
        if (!buffer) {
          const style = cleanSong.id.includes('serene')
            ? 'calm'
            : cleanSong.id.includes('cyber')
            ? 'cyber'
            : 'synthwave';
          buffer = AudioService.createSynthAudio(cleanSong.bpm, cleanSong.duration, style);
          setAudioBuffers((prev) => ({ ...prev, [cleanSong.id]: buffer! }));
        }
      } else {
        try {
          const blob = await StorageService.getAudioBlob(cleanSong.id);
          if (blob && blob.size > 0) {
            buffer = await AudioService.decodeAudioBlob(blob);
            setAudioBuffers((prev) => ({ ...prev, [cleanSong.id]: buffer! }));
          }
        } catch (err) {
          console.warn('Gagal mendekode audio untuk editor:', err);
        }

        if (!buffer && audioBuffers[cleanSong.id]) {
          buffer = audioBuffers[cleanSong.id];
        }

        // Emergency fallback audio for editor
        if (!buffer) {
          buffer = AudioService.createSynthAudio(cleanSong.bpm || 120, cleanSong.duration || 60, 'synthwave');
          setAudioBuffers((prev) => ({ ...prev, [cleanSong.id]: buffer! }));
        }
      }

      if (buffer) {
        audioEngine.loadBuffer(buffer);
      }
    } else {
      try {
        await audioEngine.loadYouTubeTrack(cleanSong.youtubeVideoId);
      } catch (e) {
        console.warn('Gagal memuat track YouTube editor:', e);
      }
    }

    setTab('editor');
  };

  // Smart Audio Re-Link / Repair: Replace or restore audio file while preserving 100% of custom charts and notes
  const handleRelinkSongAudio = async (songId: string, audioFile: File) => {
    try {
      const song = songs.find((s) => s.id === songId);
      if (!song) {
        addToast('error', 'Lagu tidak ditemukan.');
        return;
      }

      const rawBuffer = await audioFile.arrayBuffer();
      const blob = new Blob([rawBuffer], { type: audioFile.type || 'audio/mpeg' });
      const decodedBuffer = await AudioService.decodeAudioBlob(blob);

      // 1. Immediately update in-memory audio buffer for immediate gameplay
      setAudioBuffers((prev) => ({ ...prev, [songId]: decodedBuffer }));

      // 2. Persist audio blob locally
      await saveAudioBlobToDB(songId, blob).catch((e) => {
        console.warn('Audio blob IDB warning:', e);
      });

      // 3. Update song duration while preserving 100% of custom charts and notes
      const cleanSong: Song = sanitizeSong({
        ...song,
        duration: Math.max(10, Math.round(decodedBuffer.duration)),
        updatedAt: Date.now(),
      });

      await StorageService.saveSong(cleanSong, blob).catch((e) => {
        console.warn('StorageService saveSong warning:', e);
      });

      setSongs((prev) => prev.map((s) => (s.id === songId ? cleanSong : s)));
      if (activeSong?.id === songId) {
        setActiveSong(cleanSong);
      }

      addToast('success', `Audio berhasil dihubungkan! Semua chart & ketukan "${song.title}" tetap aman utuh.`);
    } catch (err: any) {
      console.error('Gagal menghubungkan audio baru:', err);
      addToast('error', err.message || 'Gagal memproses file audio.');
    }
  };

  // Import Chart JSON into an existing song
  const handleImportChartJson = async (songId: string, jsonString: string) => {
    try {
      const targetSong = songs.find((s) => s.id === songId);
      if (!targetSong) {
        addToast('error', 'Lagu target tidak ditemukan.');
        return;
      }

      const parsedChart = parseChartJson(jsonString, songId);
      if (!parsedChart) {
        addToast('error', 'Format file JSON chart tidak valid.');
        return;
      }

      const updatedCharts = {
        ...targetSong.charts,
        [parsedChart.difficulty]: parsedChart,
      };

      const updatedSong: Song = {
        ...targetSong,
        charts: updatedCharts,
        updatedAt: Date.now(),
      };

      await StorageService.saveSong(updatedSong);
      setSongs((prev) => prev.map((s) => (s.id === songId ? updatedSong : s)));
      if (activeSong?.id === songId) {
        setActiveSong(updatedSong);
        setActiveChart(parsedChart);
      }

      addToast('success', `Chart "${parsedChart.difficulty}" (${parsedChart.notes.length} note) berhasil diimpor!`);
    } catch (err: any) {
      console.error('Gagal mengimpor chart JSON:', err);
      addToast('error', 'Gagal mengimpor file chart JSON.');
    }
  };

  // Import New Song
  const handleImportSong = async (newSong: Song, audioData?: Blob | AudioBuffer) => {
    try {
      let decodedBuffer: AudioBuffer | null = null;
      const currentProfile = authService.getCurrentProfile();
      if (currentProfile.isGoogleLinked && currentProfile.uid !== 'guest_unauthenticated') {
        newSong.userId = currentProfile.uid;
      }

      if (audioData instanceof AudioBuffer) {
        await StorageService.saveSong(newSong);
        decodedBuffer = audioData;
        setAudioBuffers((prev) => ({ ...prev, [newSong.id]: audioData }));
      } else if (audioData instanceof Blob) {
        await StorageService.saveSong(newSong, audioData);
        try {
          decodedBuffer = await AudioService.decodeAudioBlob(audioData);
          setAudioBuffers((prev) => ({ ...prev, [newSong.id]: decodedBuffer! }));
        } catch (err) {
          console.warn('Gagal mendekode audioBlob impor, mengaktifkan audio synth:', err);
          decodedBuffer = AudioService.createSynthAudio(newSong.bpm || 120, newSong.duration || 60, 'synthwave');
          setAudioBuffers((prev) => ({ ...prev, [newSong.id]: decodedBuffer! }));
        }
      } else {
        await StorageService.saveSong(newSong);
      }

      // Merge and ensure presets are preserved
      setSongs((prev) => {
        const filtered = prev.filter((s) => s.id !== newSong.id);
        return mergeSongsWithPresets([...filtered, newSong]);
      });

      setActiveSong(newSong);
      setActiveChart(newSong.charts.Medium || Object.values(newSong.charts)[0]);
      setStatus('success');
      addToast('success', `Lagu "${newSong.title}" berhasil diimpor dan disimpan secara permanen!`);
      setTab('library');

      // Refresh storage diagnostics
      StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
    } catch (err: any) {
      addToast('error', err.message || 'Gagal mengimpor lagu.');
    }
  };

  // Delete Song
  const handleDeleteSong = async (songId: string) => {
    try {
      const songToDelete = songs.find((s) => s.id === songId);
      audioEngine.stopBGM();
      audioEngine.destroyYouTubePlayer();

      await StorageService.deleteSong(songId);
      setSongs((prev) => prev.filter((s) => s.id !== songId));
      setAudioBuffers((prev) => {
        const next = { ...prev };
        delete next[songId];
        return next;
      });

      if (activeSong?.id === songId) {
        setActiveSong(null);
        setActiveChart(null);
      }

      if (songs.length - 1 === 0) {
        setStatus('empty');
      }

      addToast('info', `Lagu "${songToDelete?.title || 'Lagu'}" berhasil dihapus dari perpustakaan.`);
      StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
    } catch (err: any) {
      addToast('error', err.message || 'Gagal menghapus lagu.');
    }
  };

  // Reset Preset Song to Default
  const handleResetPreset = async (presetId: string) => {
    try {
      const resetSong = await StorageService.resetPresetSong(presetId);
      if (resetSong) {
        setSongs((prev) => prev.map((s) => (s.id === presetId ? resetSong : s)));
        if (activeSong?.id === presetId) {
          setActiveSong(resetSong);
        }
        addToast('success', `Lagu preset "${resetSong.title}" berhasil dikembalikan ke versi bawaan.`);
        StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
      }
    } catch (err: any) {
      addToast('error', 'Gagal mengatur ulang lagu preset.');
    }
  };

  // Finish Game Session & Calculate Grade / Highscore
  const handleFinishGame = async (stats: GameStats) => {
    setLastGameStats(stats);
    setTab('results');

    if (activeSong && activeChart) {
      // Calculate Grade
      let grade: 'S+' | 'S' | 'A' | 'B' | 'C' | 'F' = 'F';
      if (stats.accuracy >= 98 && stats.missCount === 0) grade = 'S+';
      else if (stats.accuracy >= 95) grade = 'S';
      else if (stats.accuracy >= 88) grade = 'A';
      else if (stats.accuracy >= 78) grade = 'B';
      else if (stats.accuracy >= 65) grade = 'C';

      const currentProfile = authService.getCurrentProfile();

      const highScoreObj: HighScore = {
        songId: activeSong.id,
        difficulty: activeChart.difficulty,
        score: stats.score,
        maxCombo: stats.maxCombo,
        accuracy: Number(stats.accuracy.toFixed(1)),
        grade,
        timestamp: Date.now(),
        userId: currentProfile.uid,
        username: currentProfile.username,
      };

      await StorageService.saveScore(highScoreObj);

      // Add EXP and games completed to active user profile
      await authService.addGameResults(stats.score, stats.maxCombo, stats.accuracy);

      // Refresh High Scores in state
      const scores = await StorageService.getHighScores(activeSong.id);
      setHighScores((prev) => ({ ...prev, [activeSong.id]: scores }));

      addToast('success', `Permainan selesai! Grade: ${grade} (${stats.score.toLocaleString()} Pts) • EXP didapatkan!`);
      StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
    }
  };

  // Save Chart Changes for ANY song (preset or custom)
  const handleSaveChart = async (
    songId: string,
    difficulty: DifficultyLevel,
    updatedChart: Chart
  ) => {
    try {
      const currentSong = songs.find((s) => s.id === songId);
      if (!currentSong) throw new Error('Lagu tidak ditemukan.');

      const updatedSong: Song = {
        ...currentSong,
        bpm: updatedChart.bpm || currentSong.bpm,
        charts: {
          ...currentSong.charts,
          [difficulty]: updatedChart,
        },
      };

      setSongs((prevSongs) =>
        prevSongs.map((s) => (s.id === songId ? updatedSong : s))
      );

      if (activeSong?.id === songId) {
        setActiveSong(updatedSong);
      }
      if (activeChart?.songId === songId && activeChart.difficulty === difficulty) {
        setActiveChart(updatedChart);
      }

      // Save to Multi-Tier Storage (IndexedDB, CacheStorage, and per-track LocalStorage redundancy)
      await StorageService.saveTrack(songId, difficulty, updatedChart);
      await StorageService.saveSong(updatedSong);

      addToast('success', `Track difficulty "${difficulty}" (${updatedChart.notes.length} notes) tersimpan permanen!`);
      StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
    } catch (err: any) {
      addToast('error', err.message || 'Gagal menyimpan chart.');
    }
  };

  // Add Difficulty to Song
  const handleAddDifficulty = async (songId: string, newDiffName: string) => {
    try {
      const cleanName = newDiffName.trim();
      if (!cleanName) return;

      const currentSong = songs.find((s) => s.id === songId);
      if (!currentSong) throw new Error('Lagu tidak ditemukan.');
      if (currentSong.charts[cleanName]) {
        throw new Error(`Difficulty "${cleanName}" sudah ada.`);
      }

      const existingCharts = Object.values(currentSong.charts) as Chart[];
      const templateChart: Chart | undefined = existingCharts[0];

      const newChart: Chart = {
        id: `chart_${songId}_${cleanName.toLowerCase()}_${Date.now()}`,
        songId,
        difficulty: cleanName,
        bpm: currentSong.bpm,
        offset: templateChart?.offset || 0,
        notes: templateChart ? JSON.parse(JSON.stringify(templateChart.notes)) : [],
        creator: 'Custom Difficulty',
        createdAt: Date.now(),
      };

      const updatedSong: Song = {
        ...currentSong,
        charts: {
          ...currentSong.charts,
          [cleanName]: newChart,
        },
      };

      setSongs((prevSongs) =>
        prevSongs.map((s) => (s.id === songId ? updatedSong : s))
      );

      if (activeSong?.id === songId) {
        setActiveSong(updatedSong);
      }

      await StorageService.saveSong(updatedSong);

      addToast('success', `Difficulty "${cleanName}" berhasil ditambahkan & disimpan!`);
      StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
    } catch (err: any) {
      addToast('error', err.message || 'Gagal menambahkan difficulty.');
    }
  };

  // Rename Difficulty in Song
  const handleRenameDifficulty = async (
    songId: string,
    oldDiffName: string,
    newDiffName: string
  ) => {
    try {
      const cleanNew = newDiffName.trim();
      if (!cleanNew || oldDiffName === cleanNew) return;

      const currentSong = songs.find((s) => s.id === songId);
      if (!currentSong) throw new Error('Lagu tidak ditemukan.');
      if (currentSong.charts[cleanNew]) {
        throw new Error(`Difficulty "${cleanNew}" sudah ada.`);
      }

      const oldChart = currentSong.charts[oldDiffName];
      if (!oldChart) return;

      const updatedCharts = { ...currentSong.charts };
      delete updatedCharts[oldDiffName];
      updatedCharts[cleanNew] = {
        ...oldChart,
        difficulty: cleanNew,
      };

      const updatedSong: Song = {
        ...currentSong,
        charts: updatedCharts,
      };

      setSongs((prevSongs) =>
        prevSongs.map((s) => (s.id === songId ? updatedSong : s))
      );

      if (activeSong?.id === songId) {
        setActiveSong(updatedSong);
      }

      await StorageService.saveSong(updatedSong);

      addToast('success', `Difficulty diubah dari "${oldDiffName}" menjadi "${cleanNew}".`);
      StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
    } catch (err: any) {
      addToast('error', err.message || 'Gagal mengubah nama difficulty.');
    }
  };

  // Delete Difficulty from Song
  const handleDeleteDifficulty = async (songId: string, diffName: string) => {
    try {
      const currentSong = songs.find((s) => s.id === songId);
      if (!currentSong) throw new Error('Lagu tidak ditemukan.');

      const keys = Object.keys(currentSong.charts);
      if (keys.length <= 1) {
        throw new Error('Lagu harus memiliki minimal 1 difficulty.');
      }

      const updatedCharts = { ...currentSong.charts };
      delete updatedCharts[diffName];

      const updatedSong: Song = {
        ...currentSong,
        charts: updatedCharts,
      };

      setSongs((prevSongs) =>
        prevSongs.map((s) => (s.id === songId ? updatedSong : s))
      );

      if (activeSong?.id === songId) {
        setActiveSong(updatedSong);
      }

      await StorageService.saveSong(updatedSong);

      addToast('info', `Difficulty "${diffName}" berhasil dihapus.`);
      StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
    } catch (err: any) {
      addToast('error', err.message || 'Gagal menghapus difficulty.');
    }
  };

  // Reorder Difficulties in Song
  const handleReorderDifficulties = async (songId: string, newOrder: string[]) => {
    try {
      const currentSong = songs.find((s) => s.id === songId);
      if (!currentSong) throw new Error('Lagu tidak ditemukan.');

      const newCharts: Record<string, Chart> = {};
      for (const diffKey of newOrder) {
        if (currentSong.charts[diffKey]) {
          newCharts[diffKey] = currentSong.charts[diffKey];
        }
      }
      for (const diffKey of Object.keys(currentSong.charts)) {
        if (!newCharts[diffKey]) {
          newCharts[diffKey] = currentSong.charts[diffKey];
        }
      }

      const updatedSong: Song = {
        ...currentSong,
        charts: newCharts,
        updatedAt: Date.now(),
      };

      setSongs((prevSongs) =>
        prevSongs.map((s) => (s.id === songId ? updatedSong : s))
      );

      if (activeSong?.id === songId) {
        setActiveSong(updatedSong);
      }

      await StorageService.saveSong(updatedSong);
      addToast('success', 'Urutan difficulty berhasil diperbarui!');
      StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
    } catch (err: any) {
      addToast('error', err.message || 'Gagal mengubah urutan difficulty.');
    }
  };

  // Duplicate Difficulty in Song
  const handleDuplicateDifficulty = async (
    songId: string,
    sourceDiffName: string,
    newDiffName: string
  ) => {
    try {
      const cleanNew = newDiffName.trim();
      if (!cleanNew) return;

      const currentSong = songs.find((s) => s.id === songId);
      if (!currentSong) throw new Error('Lagu tidak ditemukan.');
      if (currentSong.charts[cleanNew]) {
        throw new Error(`Difficulty "${cleanNew}" sudah ada.`);
      }

      const sourceChart = currentSong.charts[sourceDiffName];
      if (!sourceChart) throw new Error(`Difficulty "${sourceDiffName}" tidak ditemukan.`);

      const clonedChart: Chart = {
        ...JSON.parse(JSON.stringify(sourceChart)),
        id: `chart_${songId}_${cleanNew.toLowerCase()}_${Date.now()}`,
        difficulty: cleanNew,
        createdAt: Date.now(),
      };

      const updatedSong: Song = {
        ...currentSong,
        charts: {
          ...currentSong.charts,
          [cleanNew]: clonedChart,
        },
        updatedAt: Date.now(),
      };

      setSongs((prevSongs) =>
        prevSongs.map((s) => (s.id === songId ? updatedSong : s))
      );

      if (activeSong?.id === songId) {
        setActiveSong(updatedSong);
      }

      await StorageService.saveSong(updatedSong);
      addToast('success', `Difficulty "${sourceDiffName}" berhasil diduplikasi menjadi "${cleanNew}"!`);
      StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
    } catch (err: any) {
      addToast('error', err.message || 'Gagal menduplikasi difficulty.');
    }
  };

  // Duplicate Entire Song
  const handleDuplicateSong = async (songId: string) => {
    try {
      const sourceSong = songs.find((s) => s.id === songId);
      if (!sourceSong) throw new Error('Lagu tidak ditemukan.');

      const newSongId = `song_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newTitle = `${sourceSong.title} (Copy)`;

      // Clone charts
      const clonedCharts: Record<string, Chart> = {};
      Object.entries(sourceSong.charts).forEach(([diffName, chart]) => {
        clonedCharts[diffName] = {
          ...JSON.parse(JSON.stringify(chart)),
          id: `chart_${newSongId}_${diffName}`,
          songId: newSongId,
          createdAt: Date.now(),
        };
      });

      const currentProfile = authService.getCurrentProfile();

      const duplicatedSong: Song = {
        ...sourceSong,
        id: newSongId,
        title: newTitle,
        isPreset: false, // Duplicated song is user's custom copy
        userId:
          currentProfile.isGoogleLinked && currentProfile.uid !== 'guest_unauthenticated'
            ? currentProfile.uid
            : sourceSong.userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        charts: clonedCharts,
      };

      // Retrieve audio blob if local audio
      let audioBlob: Blob | undefined;
      if (!sourceSong.isPreset && !sourceSong.youtubeVideoId) {
        const sourceBlob = await StorageService.getAudioBlob(sourceSong.id);
        if (sourceBlob) {
          audioBlob = sourceBlob;
        }
      }

      // If audioBuffer is already loaded in state, copy buffer for instant playback
      if (audioBuffers[sourceSong.id]) {
        setAudioBuffers((prev) => ({ ...prev, [newSongId]: audioBuffers[sourceSong.id] }));
      } else if (sourceSong.isPreset) {
        const style = sourceSong.id.includes('serene')
          ? 'calm'
          : sourceSong.id.includes('cyber')
          ? 'cyber'
          : 'synthwave';
        const synth = AudioService.createSynthAudio(sourceSong.bpm || 120, sourceSong.duration || 35, style);
        setAudioBuffers((prev) => ({ ...prev, [newSongId]: synth }));
      }

      await StorageService.saveSong(duplicatedSong, audioBlob);

      setSongs((prev) => mergeSongsWithPresets([...prev, duplicatedSong]));

      addToast('success', `Lagu "${sourceSong.title}" berhasil diduplikasi menjadi "${newTitle}"!`);
      StorageService.getDiagnostics().then(setStorageStatus).catch(() => {});
    } catch (err: any) {
      addToast('error', err.message || 'Gagal menduplikasi lagu.');
    }
  };

  // Update Game Settings
  const handleUpdateSettings = async (newSettings: GameSettings) => {
    try {
      await StorageService.saveSettings(newSettings);
      setSettings(newSettings);
      addToast('success', 'Pengaturan berhasil diperbarui!');
    } catch (err: any) {
      addToast('error', 'Gagal memperbarui pengaturan.');
    }
  };

  // Export Full Library Backup File
  const handleExportBackup = async () => {
    try {
      const backup = await StorageService.exportBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BeatPulse_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('success', 'File cadangan (.json) berhasil diunduh!');
    } catch (err: any) {
      addToast('error', 'Gagal mengekspor data cadangan.');
    }
  };

  // Import Full Library Backup File
  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: FullLibraryBackup = JSON.parse(text);
      const result = await StorageService.importBackup(parsed);
      await initializeApp();
      addToast('success', `Berhasil memulihkan ${result.importedSongsCount} lagu dari cadangan!`);
    } catch (err: any) {
      addToast('error', err.message || 'Gagal memulihkan file cadangan.');
    }
  };

  // Enable Persistent Storage
  const handleRequestPersistence = async () => {
    const granted = await StorageService.requestPersistence();
    const diag = await StorageService.getDiagnostics();
    setStorageStatus(diag);
    if (granted || diag.isPersisted) {
      addToast('success', 'Penyimpanan permanen berhasil diaktifkan!');
    } else {
      addToast('info', 'Status penyimpanan diperbarui.');
    }
  };

  return {
    tab,
    setTab,
    status,
    errorMessage,
    initializeApp,
    songs,
    audioBuffers,
    highScores,
    settings,
    storageStatus,
    activeSong,
    activeChart,
    lastGameStats,
    toasts,
    addToast,
    dismissToast,
    selectSongToPlay,
    selectSongToEdit,
    handleRelinkSongAudio,
    handleImportChartJson,
    handleImportSong,
    handleDeleteSong,
    handleResetPreset,
    handleFinishGame,
    handleSaveChart,
    handleAddDifficulty,
    handleRenameDifficulty,
    handleDeleteDifficulty,
    handleReorderDifficulties,
    handleDuplicateDifficulty,
    handleDuplicateSong,
    handleUpdateSettings,
    handleExportBackup,
    handleImportBackup,
    handleRequestPersistence,
    isTestPlay,
    testPlayStartTime,
    setIsTestPlay,
    setActiveSong,
    setActiveChart,
    isOffline,
    setIsOffline,
  };
}

