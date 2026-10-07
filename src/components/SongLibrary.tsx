import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Edit3,
  Trash2,
  Trophy,
  Clock,
  Activity,
  Music,
  Plus,
  Search,
  Edit2,
  X,
  Volume2,
  Pause,
  ArrowLeft,
  Youtube,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Copy,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  ChevronUp,
  ChevronDown,
  Upload,
  Download,
  FileCode,
  RefreshCw,
} from 'lucide-react';
import { Song, DifficultyLevel, HighScore } from '../types';
import { audioEngine } from '../lib/audioEngine';
import { StorageService } from '../services/storageService';
import { AudioService } from '../services/audioService';
import { exportChartAsJson } from '../lib/chartSanitizer';

interface SongLibraryProps {
  songs: Song[];
  audioBuffers?: Record<string, AudioBuffer>;
  highScores: Record<string, Record<string, HighScore>>;
  onSelectSongToPlay: (song: Song, difficulty: DifficultyLevel) => void;
  onSelectSongToEdit: (song: Song, difficulty: DifficultyLevel) => void;
  onDeleteSong: (songId: string) => void;
  onOpenImportModal: () => void;
  onAddDifficulty?: (songId: string, diffName: string) => void;
  onRenameDifficulty?: (songId: string, oldDiff: string, newDiff: string) => void;
  onDeleteDifficulty?: (songId: string, diffName: string) => void;
  onReorderDifficulties?: (songId: string, newOrder: string[]) => void;
  onDuplicateDifficulty?: (songId: string, sourceDiffName: string, newDiffName: string) => void;
  onDuplicateSong?: (songId: string) => void;
  onRelinkAudio?: (songId: string, file: File) => void;
  onImportChartJson?: (songId: string, jsonString: string) => void;
}

export const SongLibrary: React.FC<SongLibraryProps> = ({
  songs,
  audioBuffers,
  highScores,
  onSelectSongToPlay,
  onSelectSongToEdit,
  onDeleteSong,
  onOpenImportModal,
  onAddDifficulty,
  onRenameDifficulty,
  onDeleteDifficulty,
  onReorderDifficulties,
  onDuplicateDifficulty,
  onDuplicateSong,
  onRelinkAudio,
  onImportChartJson,
}) => {
  // View mode: 'list' (shows all cards) vs 'detail' (dedicated single song page)
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedSongId, setSelectedSongId] = useState<string>(songs[0]?.id || '');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('Medium');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'preset' | 'local' | 'youtube'>('all');

  // File input refs for audio relinking and chart json importing
  const relinkAudioInputRef = useRef<HTMLInputElement>(null);
  const importChartInputRef = useRef<HTMLInputElement>(null);
  const [songIdToRelink, setSongIdToRelink] = useState<string | null>(null);
  const [songIdToImportChart, setSongIdToImportChart] = useState<string | null>(null);

  // Audio Preview State
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);

  // Modals for Difficulty Management
  const [isAddDiffOpen, setIsAddDiffOpen] = useState(false);
  const [newDiffName, setNewDiffName] = useState('');
  const [isRenameDiffOpen, setIsRenameDiffOpen] = useState(false);
  const [renameDiffName, setRenameDiffName] = useState('');
  const [isDuplicateDiffOpen, setIsDuplicateDiffOpen] = useState(false);
  const [duplicateDiffName, setDuplicateDiffName] = useState('');
  const [isReorderDiffOpen, setIsReorderDiffOpen] = useState(false);
  const [reorderList, setReorderList] = useState<string[]>([]);

  const handleMoveDiffLeft = (diffName: string) => {
    const idx = availableDifficulties.indexOf(diffName);
    if (idx <= 0 || !currentSong) return;
    const newOrder = [...availableDifficulties];
    const temp = newOrder[idx - 1];
    newOrder[idx - 1] = newOrder[idx];
    newOrder[idx] = temp;
    onReorderDifficulties?.(currentSong.id, newOrder);
  };

  const handleMoveDiffRight = (diffName: string) => {
    const idx = availableDifficulties.indexOf(diffName);
    if (idx < 0 || idx >= availableDifficulties.length - 1 || !currentSong) return;
    const newOrder = [...availableDifficulties];
    const temp = newOrder[idx + 1];
    newOrder[idx + 1] = newOrder[idx];
    newOrder[idx] = temp;
    onReorderDifficulties?.(currentSong.id, newOrder);
  };

  // Song Delete & Duplicate Confirmation State
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [songToDuplicate, setSongToDuplicate] = useState<Song | null>(null);

  const currentSong = songs.find((s) => s.id === selectedSongId) || songs[0];
  const availableDifficulties = currentSong ? Object.keys(currentSong.charts) : [];

  // Stop preview audio on unmount
  useEffect(() => {
    return () => {
      audioEngine.stopBGM();
    };
  }, []);

  // Keep selectedDifficulty synced to an existing key
  useEffect(() => {
    if (availableDifficulties.length > 0 && !availableDifficulties.includes(selectedDifficulty)) {
      setSelectedDifficulty(availableDifficulties[0]);
    }
  }, [selectedSongId, availableDifficulties, selectedDifficulty]);

  const togglePreview = async (song: Song) => {
    if (previewSongId === song.id && isPreviewPlaying) {
      audioEngine.stopBGM();
      setPreviewSongId(null);
      setIsPreviewPlaying(false);
    } else {
      audioEngine.stopBGM();
      setPreviewSongId(song.id);
      setIsPreviewPlaying(true);

      let buffer = audioBuffers?.[song.id];

      if (song.isPreset && !buffer) {
        const style = song.id.includes('serene') ? 'calm' : song.id.includes('cyber') ? 'cyber' : 'synthwave';
        buffer = AudioService.createSynthAudio(song.bpm || 120, Math.min(song.duration || 30, 30), style);
      }

      if (!song.isPreset && !song.youtubeVideoId && (!buffer || (buffer as any)._isFallbackSynth)) {
        try {
          const blob = await StorageService.getAudioBlob(song.id);
          if (blob) {
            buffer = await AudioService.decodeAudioBlob(blob);
          }
        } catch (e) {
          console.warn('Gagal memuat audio preview lokal, mengaktifkan audio synth:', e);
        }

        if (!buffer) {
          buffer = AudioService.createSynthAudio(song.bpm || 120, Math.min(song.duration || 30, 30), 'synthwave');
        }
      }

      if (song.youtubeVideoId) {
        if (buffer) {
          audioEngine.setFallbackBuffer(buffer);
        }
        try {
          await audioEngine.loadYouTubeTrack(song.youtubeVideoId);
          audioEngine.playBGM(0);
        } catch (e) {
          console.warn('YouTube preview warning:', e);
          if (buffer) {
            audioEngine.loadBuffer(buffer);
            audioEngine.playBGM(0);
          }
        }
      } else if (buffer) {
        audioEngine.loadBuffer(buffer);
        audioEngine.playBGM(0);
      }
    }
  };

  const handleOpenSongDetail = (songId: string) => {
    setSelectedSongId(songId);
    audioEngine.stopBGM();
    setPreviewSongId(null);
    setIsPreviewPlaying(false);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    audioEngine.stopBGM();
    setPreviewSongId(null);
    setIsPreviewPlaying(false);
    setViewMode('list');
  };

  const filteredSongs = songs.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterType === 'all'
        ? true
        : filterType === 'preset'
        ? s.isPreset
        : filterType === 'youtube'
        ? !!s.youtubeVideoId
        : !s.isPreset && !s.youtubeVideoId;
    return matchesSearch && matchesFilter;
  });

  // Position preset tracks at the bottom of the list
  const sortedFilteredSongs = [...filteredSongs].sort((a, b) => {
    if (a.isPreset && !b.isPreset) return 1;
    if (!a.isPreset && b.isPreset) return -1;
    return 0;
  });

  const songScores = currentSong ? highScores[currentSong.id] || {} : {};
  const currentDiffScore = songScores[selectedDifficulty];

  const getGradeBadgeColor = (grade: string) => {
    switch (grade) {
      case 'S+':
        return 'from-amber-400 to-amber-600 text-slate-950';
      case 'S':
        return 'from-indigo-600 to-indigo-800 text-white';
      case 'A':
        return 'from-blue-600 to-blue-800 text-white';
      case 'B':
        return 'from-emerald-600 to-teal-800 text-white';
      case 'C':
        return 'from-amber-500 to-orange-700 text-white';
      default:
        return 'from-slate-700 to-slate-900 text-white';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-28 md:pb-8 animate-in fade-in duration-200">
      {/* STAGE 1: DAFTAR LAGU (SONG LIST VIEW) */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {/* Main Title & Search / Import Header Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Daftar Lagu BeatPulse</span>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {songs.length} Track
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Klik kartu lagu untuk melihat detail khusus, memainkan game, atau mengedit chart.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari lagu / artist..."
                  className="w-full min-h-[44px] bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl pl-10 pr-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-xs"
                />
              </div>

              {/* Import Button */}
              <button
                onClick={onOpenImportModal}
                className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex-shrink-0"
              >
                <Plus className="w-4 h-4 text-indigo-300" />
                <span>Impor Lagu</span>
              </button>
            </div>
          </div>

          {/* Filter Chips Bar */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {[
              { id: 'all', label: 'Semua Track' },
              { id: 'preset', label: '🎵 Track Preset' },
              { id: 'local', label: '📁 Impor File Lokal' },
              { id: 'youtube', label: '📺 Track YouTube' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setFilterType(filter.id as any)}
                className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  filterType === filter.id
                    ? 'bg-slate-900 text-white border border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Song Cards Responsive Grid Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {sortedFilteredSongs.map((song) => {
              const diffKeys = Object.keys(song.charts);
              const bestScoreForSong = highScores[song.id];
              let highestScoreNum = 0;
              let highestGrade = '';
              if (bestScoreForSong) {
                Object.values(bestScoreForSong).forEach((hs: HighScore) => {
                  if (hs.score > highestScoreNum) {
                    highestScoreNum = hs.score;
                    highestGrade = hs.grade;
                  }
                });
              }

              return (
                <div
                  key={song.id}
                  onClick={() => handleOpenSongDetail(song.id)}
                  className="bg-white border border-slate-200/90 hover:border-indigo-500 rounded-2xl sm:rounded-3xl p-4 shadow-2xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden active:scale-[0.99]"
                >
                  {/* Decorative background accent */}
                  <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-indigo-50/50 to-transparent rounded-full pointer-events-none" />

                  <div>
                    {/* Card Top Row: Cover Icon & Type Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-md flex-shrink-0 group-hover:scale-105 transition-transform relative overflow-hidden">
                        {song.youtubeVideoId ? (
                          <img
                            src={`https://img.youtube.com/vi/${song.youtubeVideoId}/hqdefault.jpg`}
                            alt={song.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              // If image load fails, hide img so background icon shows
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Music className="w-6 h-6 text-indigo-300" />
                        )}
                        {song.youtubeVideoId && (
                          <div className="absolute bottom-0 right-0 p-0.5 bg-rose-600 rounded-tl-md">
                            <Youtube className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        {previewSongId === song.id && isPreviewPlaying && (
                          <div className="absolute inset-0 bg-rose-900/60 backdrop-blur-xs flex items-center justify-center">
                            <Volume2 className="w-5 h-5 text-white animate-bounce" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {song.isPreset ? (
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80">
                            Preset
                          </span>
                        ) : song.youtubeVideoId ? (
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <Youtube className="w-3 h-3" />
                            YouTube
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200">
                            File Lokal
                          </span>
                        )}

                        {highestScoreNum > 0 && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-amber-600" />
                            {highestGrade} ({highestScoreNum.toLocaleString()})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Artist */}
                    <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {song.title}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 line-clamp-1 mt-0.5">
                      {song.artist}
                    </p>

                    {/* Stats pill badges: BPM, Durasi, Difficulty Count */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-3 text-xs font-mono text-slate-600">
                      <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 font-bold">
                        <Activity className="w-3.5 h-3.5 text-indigo-600" />
                        {song.bpm} BPM
                      </span>
                      <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 font-bold">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {Math.floor(song.duration / 60)}:
                        {Math.floor(song.duration % 60)
                          .toString()
                          .padStart(2, '0')}
                      </span>
                      <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200/80 font-bold">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        {diffKeys.length} Difficulty
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom Row */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span className="text-[11px] font-semibold text-slate-500 group-hover:text-indigo-600 transition-colors">
                      Klik untuk buka detail lagu →
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePreview(song);
                      }}
                      className={`p-1.5 rounded-lg transition-all ${
                        previewSongId === song.id && isPreviewPlaying
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title={previewSongId === song.id && isPreviewPlaying ? 'Stop Preview' : 'Play Preview'}
                    >
                      {previewSongId === song.id && isPreviewPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredSongs.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 bg-white rounded-3xl space-y-3">
              <Music className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-800">Tidak ada lagu yang ditemukan</p>
              <p className="text-xs text-slate-500">Coba ubah kata kunci pencarian atau filter kategori di atas</p>
            </div>
          )}
        </div>
      )}

      {/* STAGE 2: HALAMAN KHUSUS LAGU (DEDICATED SONG DETAIL VIEW) */}
      {viewMode === 'detail' && currentSong && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Back Button Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToList}
              className="px-4 py-2.5 min-h-[44px] rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/90 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-600" />
              <span>Kembali ke Daftar Lagu</span>
            </button>

            <span className="text-xs font-mono font-bold text-slate-500">
              Halaman Khusus Lagu
            </span>
          </div>

          {/* Main Song Detail Container */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl text-slate-900 relative overflow-hidden">
            {/* Dedicated Header Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-slate-900 flex items-center justify-center text-white shadow-lg flex-shrink-0 relative overflow-hidden">
                  {currentSong.youtubeVideoId ? (
                    <Youtube className="w-10 h-10 text-rose-500" />
                  ) : (
                    <Music className="w-10 h-10 text-indigo-300" />
                  )}
                  {previewSongId === currentSong.id && isPreviewPlaying && (
                    <div className="absolute inset-0 bg-rose-900/60 backdrop-blur-xs flex items-center justify-center">
                      <Volume2 className="w-8 h-8 text-white animate-bounce" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {currentSong.isPreset ? (
                      <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Preset Track
                      </span>
                    ) : currentSong.youtubeVideoId ? (
                      <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <Youtube className="w-3 h-3" />
                        YouTube Track
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200">
                        Impor Lokal
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">
                    {currentSong.title}
                  </h1>
                  <p className="text-sm sm:text-base text-indigo-600 font-bold truncate mt-0.5">
                    {currentSong.artist}
                  </p>

                  <div className="flex items-center gap-3 mt-3 text-xs font-mono text-slate-700">
                    <span className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                      <Activity className="w-3.5 h-3.5 text-indigo-600" />
                      {currentSong.bpm} BPM
                    </span>
                    <span className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {Math.floor(currentSong.duration / 60)}:
                      {Math.floor(currentSong.duration % 60)
                        .toString()
                        .padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => setSongToDuplicate(currentSong)}
                  className="px-4 py-2.5 min-h-[44px] flex items-center gap-2 text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-2xl border border-indigo-200/80 font-bold text-xs active:scale-95 transition-all shadow-2xs cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>Duplikat Lagu</span>
                </button>

                {!currentSong.isPreset && (
                  <button
                    onClick={() => setSongToDelete(currentSong)}
                    className="px-4 py-2.5 min-h-[44px] flex items-center gap-2 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-2xl border border-rose-200/80 font-bold text-xs active:scale-95 transition-all shadow-2xs cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Lagu</span>
                  </button>
                )}
              </div>
            </div>

            {/* YouTube Video Embed Player or Standard Audio Preview */}
            {currentSong.youtubeVideoId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5 text-rose-600">
                    <Youtube className="w-4 h-4" />
                    <span>Pemutar Video & Audio YouTube</span>
                  </span>
                  {currentSong.youtubeUrl && (
                    <a
                      href={currentSong.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Buka di YouTube</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-slate-200/90 shadow-md bg-slate-900">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${currentSong.youtubeVideoId}?enablejsapi=1&rel=0`}
                    title={currentSong.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              /* Standard Audio Preview Player Box */
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => togglePreview(currentSong)}
                    className={`p-3 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all shadow-xs ${
                      previewSongId === currentSong.id && isPreviewPlaying
                        ? 'bg-rose-600 text-white ring-2 ring-rose-300 animate-pulse'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {previewSongId === currentSong.id && isPreviewPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>
                        {previewSongId === currentSong.id && isPreviewPlaying
                          ? 'Memutar Preview Audio'
                          : 'Dengar Preview Audio'}
                      </span>
                      {previewSongId === currentSong.id && isPreviewPlaying && (
                        <span className="flex items-center gap-0.5">
                          <span className="w-1 h-3 bg-rose-500 rounded-full animate-bounce" />
                          <span className="w-1 h-4 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                          <span className="w-1 h-2 bg-rose-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {previewSongId === currentSong.id && isPreviewPlaying
                        ? 'Klik untuk menghentikan audio preview'
                        : 'Klik untuk memperdengarkan audio cuplikan lagu'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => togglePreview(currentSong)}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 font-bold text-xs shadow-xs transition-all flex-shrink-0"
                >
                  {previewSongId === currentSong.id && isPreviewPlaying ? 'Stop' : 'Play Preview'}
                </button>
              </div>
            )}

            {/* Difficulty Selector Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <span>Pilih Tingkat Kesulitan ({availableDifficulties.length})</span>
                  {currentSong.isPreset && (
                    <span className="text-[10px] normal-case font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                      🔒 Track Preset
                    </span>
                  )}
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {availableDifficulties.map((diff) => {
                  const isDiffSelected = selectedDifficulty === diff;
                  const noteCount = currentSong.charts[diff]?.notes.length || 0;

                  return (
                    <button
                      key={diff}
                      onClick={() => setSelectedDifficulty(diff)}
                      className={`p-3.5 rounded-2xl border transition-all text-left outline-none cursor-pointer flex flex-col justify-between ${
                        isDiffSelected
                          ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-md'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-extrabold truncate">{diff}</div>
                      <div className={`text-[11px] font-mono mt-1 ${isDiffSelected ? 'text-indigo-300' : 'text-slate-500'}`}>
                        {noteCount} Notes
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* High Score Record Card */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-200">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
                    Rekor Tertinggi ({selectedDifficulty})
                  </p>
                  {currentDiffScore ? (
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-xl sm:text-2xl font-mono font-black text-slate-900">
                        {(currentDiffScore?.score ?? 0).toLocaleString()}
                      </span>
                      <span className="text-xs font-mono text-indigo-600 font-bold">
                        {(currentDiffScore?.accuracy ?? 0).toFixed(1)}% ACC
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">
                      Belum ada rekor dimainkan
                    </p>
                  )}
                </div>
              </div>

              {currentDiffScore && (
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getGradeBadgeColor(
                    currentDiffScore.grade
                  )} font-black text-lg flex items-center justify-center shadow-md`}
                >
                  {currentDiffScore.grade}
                </div>
              )}
            </div>

            {/* Chart Salvage, Backup & Audio Relink Action Bar */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Alat Penyelamat & Cadangan Chart:</span>
                </span>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                {!currentSong.isPreset && !currentSong.youtubeVideoId && onRelinkAudio && (
                  <button
                    onClick={() => {
                      setSongIdToRelink(currentSong.id);
                      relinkAudioInputRef.current?.click();
                    }}
                    title="Ganti atau hubungkan ulang file audio (MP3/WAV) tanpa menghapus chart & note Anda"
                    className="px-3 py-2 min-h-[38px] flex items-center gap-1.5 text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-xl border border-indigo-200 font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Hubungkan Ulang Audio (MP3)</span>
                  </button>
                )}

                {currentSong.charts[selectedDifficulty] && (
                  <button
                    onClick={() => {
                      exportChartAsJson(currentSong.charts[selectedDifficulty], currentSong.title);
                    }}
                    title="Unduh cadangan data chart ini ke file .json mandiri"
                    className="px-3 py-2 min-h-[38px] flex items-center gap-1.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ekspor Chart (.json)</span>
                  </button>
                )}

                {onImportChartJson && (
                  <button
                    onClick={() => {
                      setSongIdToImportChart(currentSong.id);
                      importChartInputRef.current?.click();
                    }}
                    title="Impor chart dari file .json ke lagu ini"
                    className="px-3 py-2 min-h-[38px] flex items-center gap-1.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-2xs"
                  >
                    <FileCode className="w-3.5 h-3.5 text-slate-500" />
                    <span>Impor Chart (.json)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Main Gameplay Launch Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={() => {
                  audioEngine.stopBGM();
                  setPreviewSongId(null);
                  setIsPreviewPlaying(false);
                  onSelectSongToPlay(currentSong, selectedDifficulty);
                }}
                className="flex-1 py-4 min-h-[52px] rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black text-sm tracking-wide shadow-xl flex items-center justify-center gap-2.5 transition-all group"
              >
                <Play className="w-5 h-5 fill-current text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Mulai Main ({selectedDifficulty})</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.stopBGM();
                  setPreviewSongId(null);
                  setIsPreviewPlaying(false);
                  onSelectSongToEdit(currentSong, selectedDifficulty);
                }}
                className="px-6 py-4 min-h-[52px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all border border-indigo-500"
              >
                <Edit3 className="w-5 h-5 text-indigo-200" />
                <span>Chart Editor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Difficulty Modal */}
      {isAddDiffOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Tambah Difficulty Baru</h3>
              <button
                onClick={() => setIsAddDiffOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Nama Difficulty</label>
              <input
                type="text"
                value={newDiffName}
                onChange={(e) => setNewDiffName(e.target.value)}
                placeholder="Contoh: Insane, Master, Beginner..."
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddDiffOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (newDiffName.trim() && currentSong) {
                    onAddDifficulty?.(currentSong.id, newDiffName.trim());
                    setSelectedDifficulty(newDiffName.trim());
                    setIsAddDiffOpen(false);
                  }
                }}
                disabled={!newDiffName.trim()}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Difficulty Modal */}
      {isRenameDiffOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Rename Difficulty</h3>
              <button
                onClick={() => setIsRenameDiffOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Nama Baru</label>
              <input
                type="text"
                value={renameDiffName}
                onChange={(e) => setRenameDiffName(e.target.value)}
                placeholder="Nama difficulty..."
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRenameDiffOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (renameDiffName.trim() && currentSong && selectedDifficulty) {
                    const clean = renameDiffName.trim();
                    onRenameDifficulty?.(currentSong.id, selectedDifficulty, clean);
                    setSelectedDifficulty(clean);
                    setIsRenameDiffOpen(false);
                  }
                }}
                disabled={!renameDiffName.trim()}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Difficulty Modal */}
      {isDuplicateDiffOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Duplikat Difficulty</h3>
              <button
                onClick={() => setIsDuplicateDiffOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2">
                Menduplikasi seluruh note, BPM, dan setting dari difficulty <strong>{selectedDifficulty}</strong>.
              </p>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Nama Difficulty Baru</label>
              <input
                type="text"
                value={duplicateDiffName}
                onChange={(e) => setDuplicateDiffName(e.target.value)}
                placeholder="Contoh: Hard 2, Hard (Copy)..."
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsDuplicateDiffOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const clean = duplicateDiffName.trim();
                  if (clean && currentSong && selectedDifficulty) {
                    onDuplicateDifficulty?.(currentSong.id, selectedDifficulty, clean);
                    setSelectedDifficulty(clean);
                    setIsDuplicateDiffOpen(false);
                  }
                }}
                disabled={!duplicateDiffName.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplikat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reorder Difficulty Modal */}
      {isReorderDiffOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Atur Urutan Difficulty</h3>
              <button
                onClick={() => setIsReorderDiffOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Gunakan tombol panah untuk mengubah urutan tingkat kesulitan lagu:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto py-1">
              {reorderList.map((diff, index) => (
                <div
                  key={diff}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between"
                >
                  <span className="text-xs font-bold text-slate-800">{diff}</span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={index === 0}
                      onClick={() => {
                        if (index > 0) {
                          const updated = [...reorderList];
                          const temp = updated[index - 1];
                          updated[index - 1] = updated[index];
                          updated[index] = temp;
                          setReorderList(updated);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700"
                      title="Naikkan Urutan"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      disabled={index === reorderList.length - 1}
                      onClick={() => {
                        if (index < reorderList.length - 1) {
                          const updated = [...reorderList];
                          const temp = updated[index + 1];
                          updated[index + 1] = updated[index];
                          updated[index] = temp;
                          setReorderList(updated);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700"
                      title="Turunkan Urutan"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsReorderDiffOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (currentSong && reorderList.length > 0) {
                    onReorderDifficulties?.(currentSong.id, reorderList);
                    setIsReorderDiffOpen(false);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs"
              >
                Simpan Urutan
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Konfirmasi Peringatan Hapus Lagu */}
      {songToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 text-slate-900">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl border border-rose-200 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black text-slate-900">Konfirmasi Hapus Lagu</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Apakah Anda yakin ingin menghapus lagu ini dari database lokal?
                </p>
              </div>
              <button
                onClick={() => setSongToDelete(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-rose-50/80 border border-rose-200/90 rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 truncate">{songToDelete.title}</span>
                <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md flex-shrink-0">
                  {songToDelete.artist}
                </span>
              </div>
              <p className="text-xs text-rose-900 leading-relaxed font-medium">
                ⚠️ <strong>Peringatan Permanen:</strong> Seluruh data chart difficulty, catatan rekor nilai tinggi, dan file audio dari lagu ini akan dihapus secara permanen dari browser Anda. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setSongToDelete(null)}
                className="px-5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (songToDelete) {
                    onDeleteSong(songToDelete.id);
                    setSongToDelete(null);
                    if (viewMode === 'detail' && currentSong?.id === songToDelete.id) {
                      handleBackToList();
                    }
                  }
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-2 transition-all"
              >
                <Trash2 className="w-4 h-4 text-rose-200" />
                <span>Hapus Lagu Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Duplikat Lagu */}
      {songToDuplicate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600">
                <Copy className="w-5 h-5" />
                <h3 className="text-lg font-black text-slate-900">Konfirmasi Duplikat Lagu</h3>
              </div>
              <button
                onClick={() => setSongToDuplicate(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-indigo-50/80 border border-indigo-200/90 rounded-2xl space-y-1">
              <p className="text-xs font-bold text-indigo-950 truncate">{songToDuplicate.title}</p>
              <p className="text-xs text-indigo-700 font-medium">{songToDuplicate.artist}</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Sistem akan membuat salinan baru dari lagu ini beserta seluruh tingkat kesulitan dan chart-nya. Apakah Anda ingin melanjutkan?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSongToDuplicate(null)}
                className="px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (songToDuplicate) {
                    onDuplicateSong?.(songToDuplicate.id);
                    setSongToDuplicate(null);
                  }
                }}
                className="px-5 py-2.5 min-h-[42px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Ya, Duplikat Lagu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Inputs for Audio Relinking & Chart JSON Importing */}
      <input
        type="file"
        ref={relinkAudioInputRef}
        accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg,audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && songIdToRelink && onRelinkAudio) {
            onRelinkAudio(songIdToRelink, file);
          }
          // Reset input value so same file can be picked again if needed
          e.target.value = '';
          setSongIdToRelink(null);
        }}
      />

      <input
        type="file"
        ref={importChartInputRef}
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file && songIdToImportChart && onImportChartJson) {
            const text = await file.text();
            onImportChartJson(songIdToImportChart, text);
          }
          e.target.value = '';
          setSongIdToImportChart(null);
        }}
      />
    </div>
  );
};
