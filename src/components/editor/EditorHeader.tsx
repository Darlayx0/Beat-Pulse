import React, { useState } from 'react';
import {
  ArrowLeft,
  Play,
  Save,
  Check,
  Music,
  MapPin,
  RotateCcw,
  Sparkles,
  MoreHorizontal,
  Lock,
  Unlock,
} from 'lucide-react';
import { Song, DifficultyLevel } from '../../types';

interface EditorHeaderProps {
  songs: Song[];
  selectedSongId: string;
  selectedDifficulty: DifficultyLevel;
  bpm: number;
  notesCount: number;
  currentTime?: number;
  isDirty: boolean;
  saveSuccess: boolean;
  saveMode?: 'auto' | 'manual';
  isLocked?: boolean;
  onToggleLock?: () => void;
  onSelectSong: (songId: string) => void;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
  onSave: () => void;
  onTestPlay: (startFrom?: 'beginning' | 'playhead') => void;
  onBackToLibrary?: () => void;
  onOpenMoreHub?: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  songs,
  selectedSongId,
  selectedDifficulty,
  currentTime = 0,
  isDirty,
  saveSuccess,
  saveMode = 'auto',
  isLocked = false,
  onToggleLock,
  onSelectSong,
  onSelectDifficulty,
  onSave,
  onTestPlay,
  onBackToLibrary,
  onOpenMoreHub,
}) => {
  const [showTestMenu, setShowTestMenu] = useState(false);
  const song = songs.find((s) => s.id === selectedSongId) || songs[0];

  const formatTimecode = (seconds: number) => {
    const s = Math.max(0, seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const difficultyColors: Record<DifficultyLevel, { bg: string; text: string; border: string }> = {
    Easy: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
    },
    Medium: {
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      border: 'border-sky-200',
    },
    Hard: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
    },
    Expert: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
    },
  };

  const currentDiffTheme = difficultyColors[selectedDifficulty] || difficultyColors.Medium;

  return (
    <header
      id="editor-floating-header"
      className="w-full bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 text-slate-900 shadow-sm ring-1 ring-slate-950/5 relative z-30 transition-all"
    >
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {/* 1. Left: Back Button (Icon-Only) */}
        <div className="flex items-center gap-2 shrink-0">
          {onBackToLibrary && (
            <button
              id="editor-btn-back"
              type="button"
              onClick={onBackToLibrary}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all flex items-center justify-center cursor-pointer shadow-xs"
              title="Kembali ke Daftar Lagu"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
            </button>
          )}
        </div>

        {/* 2. Center: Song Title & Difficulty Selector */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0 max-w-2xl mx-auto">
          {/* Song Selector with Enlarged Title */}
          <div className="relative flex-1 min-w-0">
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-1.5 min-h-[44px] w-full transition-colors shadow-xs">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm"
                style={{ backgroundColor: song?.coverColor || '#4f46e5' }}
              >
                <Music className="w-4 h-4" />
              </div>
              <select
                id="editor-select-song"
                value={selectedSongId}
                onChange={(e) => onSelectSong(e.target.value)}
                aria-label="Pilih lagu untuk diedit"
                className="w-full bg-transparent text-slate-900 font-black text-sm sm:text-base md:text-lg tracking-tight outline-none cursor-pointer truncate py-0.5"
              >
                {songs.map((s) => (
                  <option key={s.id} value={s.id} className="bg-white text-slate-900 font-bold text-sm">
                    {s.title} — {s.artist}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Difficulty Selector */}
          <div className="shrink-0">
            <select
              id="editor-select-difficulty"
              value={selectedDifficulty}
              onChange={(e) => onSelectDifficulty(e.target.value as DifficultyLevel)}
              aria-label="Pilih tingkat kesulitan chart"
              className={`font-black px-3.5 py-1.5 min-h-[44px] rounded-2xl text-xs sm:text-sm border outline-none cursor-pointer transition-all shadow-xs ${currentDiffTheme.bg} ${currentDiffTheme.text} ${currentDiffTheme.border}`}
            >
              {song && song.charts ? (
                Object.keys(song.charts).map((diff) => (
                  <option key={diff} value={diff} className="bg-white text-slate-900 font-medium">
                    {diff}
                  </option>
                ))
              ) : (
                <>
                  <option value="Easy" className="bg-white text-slate-900">Easy</option>
                  <option value="Medium" className="bg-white text-slate-900">Medium</option>
                  <option value="Hard" className="bg-white text-slate-900">Hard</option>
                  <option value="Expert" className="bg-white text-slate-900">Expert</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* 3. Right: Lock, Save (Manual mode only) & Test Play Menu */}
        <div className="flex items-center justify-end gap-2 shrink-0 relative">
          {/* Lock / Unlock Toggle Button */}
          {onToggleLock && (
            <button
              id="editor-btn-lock"
              type="button"
              onClick={onToggleLock}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-xs cursor-pointer border ${
                isLocked
                  ? 'bg-rose-600 text-white border-rose-500 ring-2 ring-rose-400/40 shadow-rose-600/30'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
              }`}
              title={isLocked ? 'Chart Terkunci (Klik untuk membuka)' : 'Kunci Chart (Cegah perubahan tidak sengaja)'}
            >
              {isLocked ? <Lock className="w-4 h-4 text-white" /> : <Unlock className="w-4 h-4" />}
            </button>
          )}

          {/* Save Button (Disembunyikan jika konfigurasi disetel ke auto save) */}
          {!song?.isPreset && saveMode !== 'auto' && (
            <button
              id="editor-btn-save"
              type="button"
              onClick={onSave}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-xs cursor-pointer border ${
                saveSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-600/30'
                  : isDirty
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black border-amber-400 shadow-amber-500/30 ring-2 ring-amber-400/40 animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
              }`}
              title={saveSuccess ? 'Tersimpan Permanen (Multi-Tier)' : isDirty ? 'Simpan Track Chart (Ctrl+S)' : 'Track Tersimpan Permanen'}
            >
              {saveSuccess ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Save className={`w-4 h-4 ${isDirty ? 'text-slate-950' : 'text-white'}`} />
              )}
            </button>
          )}

          {/* Test Play (Test Main) Button */}
          <div className="relative">
            <button
              id="editor-btn-test-play"
              type="button"
              onClick={() => setShowTestMenu((prev) => !prev)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 transition-all cursor-pointer ring-1 ring-emerald-400/30 shrink-0 border border-emerald-400/30"
              title="Pilih Opsi Test Main (Dari Awal atau Dari Playhead)"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>

            {/* Test Play Popover Menu (2 Options) */}
            {showTestMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowTestMenu(false)}
                />
                <div className="absolute right-0 top-13 z-50 w-72 p-2 bg-white/98 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-xl ring-1 ring-slate-950/5 space-y-1.5 animate-in fade-in zoom-in-95">
                  <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11.5px] font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Mode Uji Coba Gameplay</span>
                    </span>
                    <span className="text-[10px] font-mono text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                      {selectedDifficulty}
                    </span>
                  </div>

                  {/* Option 1: Mulai dari Awal Lagu */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowTestMenu(false);
                      onTestPlay('beginning');
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 transition-all flex items-center gap-2.5 cursor-pointer group active:scale-95"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                        Mulai dari Awal Lagu
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        00:00.00 • Uji coba seluruh lagu
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Mulai dari Playhead */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowTestMenu(false);
                      onTestPlay('playhead');
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 transition-all flex items-center gap-2.5 cursor-pointer group active:scale-95"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-violet-700">
                        Mulai dari Playhead
                      </div>
                      <div className="text-[10px] font-mono text-emerald-700 font-bold">
                        {formatTimecode(currentTime)} • Lanjut dari posisi ini
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* More Button (Fitur Lanjutan & Konfigurasi Studio Hub) */}
          {onOpenMoreHub && (
            <button
              id="editor-btn-more-hub"
              type="button"
              onClick={onOpenMoreHub}
              className="h-10 sm:h-11 px-3 sm:px-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 hover:text-slate-950 border border-slate-200 hover:border-indigo-300 flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
              title="Buka Fitur Lanjutan & Konfigurasi Studio (More)"
            >
              <MoreHorizontal className="w-5 h-5 text-indigo-600" />
              <span className="text-xs font-bold hidden sm:inline">More</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

