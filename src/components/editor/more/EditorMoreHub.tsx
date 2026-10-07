import React, { useState } from 'react';
import {
  X,
  ArrowLeft,
  Music,
  Layers,
  Activity,
  ArrowRightLeft,
  Volume2,
  HardDrive,
  Sparkles,
  Trash2,
  ChevronRight,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { EditorMoreHubProps, MoreSubPageId } from './types';
import { SubPageAudioTrack } from './SubPageAudioTrack';
import { SubPageDifficultyJson } from './SubPageDifficultyJson';
import { SubPageBpmOffsetBounds } from './SubPageBpmOffsetBounds';
import { SubPageBulkShiftAlign } from './SubPageBulkShiftAlign';
import { SubPageSoundEffects } from './SubPageSoundEffects';
import { SubPageSaveMethod } from './SubPageSaveMethod';
import { SubPageAutoGenerator } from './SubPageAutoGenerator';
import { SubPageClearNotes } from './SubPageClearNotes';

export const EditorMoreHub: React.FC<EditorMoreHubProps> = ({
  isOpen,
  onClose,
  songs,
  selectedSongId,
  selectedDifficulty,
  bpm,
  offset,
  duration,
  currentTime,
  notes,
  isLocked,
  isPreset,
  audioBuffer,
  enableHitsounds,
  enableMetronome,
  saveMode,
  onSelectSong,
  onSelectDifficulty,
  onUpdateBpm,
  onUpdateOffset,
  onUpdateDuration,
  onUpdateNotes,
  onToggleHitsounds,
  onToggleMetronome,
  onChangeSaveMode,
  onExportJSON,
  onTriggerImportJSON,
  onImportChartJson,
  onRelinkSongAudio,
  onAddDifficulty,
  onRenameDifficulty,
  onDeleteDifficulty,
  onReorderDifficulties,
  onDuplicateDifficulty,
}) => {
  const [activeSubPage, setActiveSubPage] = useState<MoreSubPageId | null>(null);

  if (!isOpen) return null;

  const currentSong = songs.find((s) => s.id === selectedSongId) || songs[0];

  const subPageTitles: Record<MoreSubPageId, { title: string; subtitle: string }> = {
    audio_track: {
      title: 'Ganti Track & Hubungkan Ulang Audio',
      subtitle: 'Pengelolaan berkas audio lokal, rekoneksi audio buffer, dan pemilihan lagu',
    },
    difficulty_json: {
      title: 'Difficulty, Slot Chart, Cadangan & JSON',
      subtitle: 'Pengaturan slot kesulitan, ekspor/impor partitur format JSON, dan cadangan draf',
    },
    bpm_offset_bounds: {
      title: 'Kalibrasi BPM, Offset Lagu, & Batas Akhir',
      subtitle: 'Penyesuaian tempo ritme, pergeseran offset milidetik, dan limit durasi lagu',
    },
    bulk_shift_align: {
      title: 'Pergeseran Massal & Penyelarasan Playhead',
      subtitle: 'Kalkulator geser waktu seluruh note dan perataan note pertama tepat ke jarum playhead',
    },
    sound_effects: {
      title: 'Pengaturan Efek Suara (Audio FX)',
      subtitle: 'Volume suara hitsound ketukan, suara klik metronom, dan tes dengar instan',
    },
    save_method: {
      title: 'Metode Penyimpanan Data',
      subtitle: 'Pilihan antara mode Auto-Save berkala di latar belakang dan mode Manual Save',
    },
    auto_generator: {
      title: 'Generator Nada Otomatis (Auto Chart)',
      subtitle: 'Analisis transien audio frekuensi untuk membangkitkan pola ritmis partitur instan',
    },
    clear_notes: {
      title: 'Pembersihan Partitur (Hapus Semua Note)',
      subtitle: 'Pengosongan seluruh data note pada tingkat kesulitan ini dengan konfirmasi keamanan',
    },
  };

  return (
    <div
      id="editor-more-fullscreen-hub"
      className="fixed inset-0 z-50 bg-slate-50/98 backdrop-blur-2xl text-slate-900 flex flex-col animate-in fade-in duration-150 overflow-hidden"
    >
      {/* 1. Header Bilah Atas */}
      <header className="h-16 px-4 sm:px-6 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          {activeSubPage ? (
            <button
              type="button"
              onClick={() => setActiveSubPage(null)}
              className="h-10 px-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 border border-slate-300 shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Menu Lanjutan</span>
            </button>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 truncate tracking-tight">
              {activeSubPage ? subPageTitles[activeSubPage].title : 'Fitur Lanjutan & Konfigurasi Studio'}
            </h2>
            <p className="text-xs text-slate-500 truncate">
              {activeSubPage
                ? subPageTitles[activeSubPage].subtitle
                : `${currentSong?.title || 'Lagu'} • Difficulty: ${selectedDifficulty} • ${notes.length} Note`}
            </p>
          </div>
        </div>

        {/* Tombol Tutup ke Studio Linimasa */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-2xl bg-white hover:bg-slate-100 active:scale-95 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold shadow-xs"
            title="Tutup halaman dan kembali ke studio"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Tutup ke Studio</span>
          </button>
        </div>
      </header>

      {/* 2. Isi Halaman (Scrollable Content) */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {/* VIEW 1: HUB MENU 8 TOMBOL MEDIATOR UTAMA */}
        {activeSubPage === null && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Pusat Konfigurasi & Utilitas Lanjutan
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Pilih modul spesifik di bawah ini untuk mengatur audio, data partitur, ritme, pergeseran nada, hingga generator otomatis.
              </p>
            </div>

            {/* List 8 Tombol Akses Khusus */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* 1. Ganti Track & Hubungkan Ulang Audio */}
              <button
                type="button"
                onClick={() => setActiveSubPage('audio_track')}
                className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-indigo-300 text-left transition-all group cursor-pointer flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      1. Ganti Track & Hubungkan Ulang Audio
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Ganti lagu editor, tautkan ulang file audio lokal, cek audio buffer
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {audioBuffer ? 'Buffer Siap' : 'Streaming Web'}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </button>

              {/* 2. Difficulty, Slot Chart, Cadangan & JSON */}
              <button
                type="button"
                onClick={() => setActiveSubPage('difficulty_json')}
                className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-emerald-300 text-left transition-all group cursor-pointer flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                      2. Difficulty, Slot Chart, Cadangan & JSON
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Kelola slot Easy/Medium/Hard, ekspor/impor berkas JSON, pulihkan draf
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Slot: {selectedDifficulty} ({notes.length} note)
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0" />
              </button>

              {/* 3. Kalibrasi BPM, Offset Lagu, & Batas Akhir */}
              <button
                type="button"
                onClick={() => setActiveSubPage('bpm_offset_bounds')}
                className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-rose-300 text-left transition-all group cursor-pointer flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                      3. Kalibrasi BPM, Offset Lagu, & Batas Akhir
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Kalibrasi tempo, tap tempo ritmis, offset milidetik, dan limit durasi
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
                        {bpm.toFixed(1)} BPM • {offset}ms
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors shrink-0" />
              </button>

              {/* 4. Pergeseran Massal & Penyelarasan Playhead */}
              <button
                type="button"
                onClick={() => setActiveSubPage('bulk_shift_align')}
                className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-sky-300 text-left transition-all group cursor-pointer flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                      4. Pergeseran Massal & Penyelarasan Playhead
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Geser maju/mundur seluruh note presisi & ratakan note 1 ke playhead
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                        Playhead: {currentTime.toFixed(2)}s
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-sky-600 transition-colors shrink-0" />
              </button>

              {/* 5. Pengaturan Efek Suara */}
              <button
                type="button"
                onClick={() => setActiveSubPage('sound_effects')}
                className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-amber-300 text-left transition-all group cursor-pointer flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                      5. Pengaturan Efek Suara
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Volume hitsound ketukan nada, suara metronom, dan tes dengar
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                        Hitsound: {enableHitsounds ? 'ON' : 'OFF'} • Metronom: {enableMetronome ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
              </button>

              {/* 6. Metode Penyimpanan */}
              <button
                type="button"
                onClick={() => setActiveSubPage('save_method')}
                className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-indigo-300 text-left transition-all group cursor-pointer flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      6. Metode Penyimpanan
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Pilih antara Auto-Save di latar belakang atau Manual Save di header
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        Mode: {saveMode === 'auto' ? 'Auto-Save' : 'Manual'}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </button>

              {/* 7. Generator Nada Otomatis */}
              <button
                type="button"
                onClick={() => setActiveSubPage('auto_generator')}
                className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-violet-300 text-left transition-all group cursor-pointer flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-violet-50 border border-violet-200 text-violet-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-violet-600 transition-colors">
                      7. Generator Nada Otomatis
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Hasilkan partitur ketukan otomatis dari analisis audio frekuensi
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                        AI Beat Detector
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-violet-600 transition-colors shrink-0" />
              </button>

              {/* 8. Hapus Semua Note */}
              <button
                type="button"
                onClick={() => setActiveSubPage('clear_notes')}
                className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-rose-300 text-left transition-all group cursor-pointer flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-rose-600 group-hover:text-rose-700 transition-colors">
                      8. Hapus Semua Note
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Kosongkan seluruh note pada difficulty ini (dengan proteksi konfirmasi)
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
                        {notes.length} note terdaftar
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: SUB-PAGES KHUSUS */}
        {activeSubPage === 'audio_track' && (
          <SubPageAudioTrack
            songs={songs}
            selectedSongId={selectedSongId}
            song={currentSong}
            audioBuffer={audioBuffer}
            duration={duration}
            onSelectSong={onSelectSong}
            onRelinkSongAudio={onRelinkSongAudio}
            onClose={onClose}
          />
        )}

        {activeSubPage === 'difficulty_json' && (
          <SubPageDifficultyJson
            song={currentSong}
            selectedDifficulty={selectedDifficulty}
            bpm={bpm}
            offset={offset}
            notes={notes}
            isLocked={isLocked}
            onSelectDifficulty={onSelectDifficulty}
            onExportJSON={onExportJSON}
            onTriggerImportJSON={onTriggerImportJSON}
            onImportChartJson={onImportChartJson}
            onAddDifficulty={onAddDifficulty}
            onRenameDifficulty={onRenameDifficulty}
            onDeleteDifficulty={onDeleteDifficulty}
            onDuplicateDifficulty={onDuplicateDifficulty}
            onUpdateNotes={onUpdateNotes}
            onClose={onClose}
          />
        )}

        {activeSubPage === 'bpm_offset_bounds' && (
          <SubPageBpmOffsetBounds
            song={currentSong}
            bpm={bpm}
            offset={offset}
            duration={duration}
            audioBuffer={audioBuffer}
            notes={notes}
            isLocked={isLocked}
            onUpdateBpm={onUpdateBpm}
            onUpdateOffset={onUpdateOffset}
            onUpdateDuration={onUpdateDuration}
            onClose={onClose}
          />
        )}

        {activeSubPage === 'bulk_shift_align' && (
          <SubPageBulkShiftAlign
            notes={notes}
            currentTime={currentTime}
            bpm={bpm}
            isLocked={isLocked}
            isPreset={isPreset}
            onUpdateNotes={onUpdateNotes}
            onClose={onClose}
          />
        )}

        {activeSubPage === 'sound_effects' && (
          <SubPageSoundEffects
            enableHitsounds={enableHitsounds}
            enableMetronome={enableMetronome}
            onToggleHitsounds={onToggleHitsounds}
            onToggleMetronome={onToggleMetronome}
            onClose={onClose}
          />
        )}

        {activeSubPage === 'save_method' && (
          <SubPageSaveMethod
            saveMode={saveMode}
            onChangeSaveMode={onChangeSaveMode}
            onClose={onClose}
          />
        )}

        {activeSubPage === 'auto_generator' && (
          <SubPageAutoGenerator
            song={currentSong}
            selectedDifficulty={selectedDifficulty}
            audioBuffer={audioBuffer}
            bpm={bpm}
            notes={notes}
            isLocked={isLocked}
            isPreset={isPreset}
            onUpdateNotes={onUpdateNotes}
            onUpdateBpm={onUpdateBpm}
            onUpdateOffset={onUpdateOffset}
            onClose={onClose}
          />
        )}

        {activeSubPage === 'clear_notes' && (
          <SubPageClearNotes
            notes={notes}
            isLocked={isLocked}
            isPreset={isPreset}
            onUpdateNotes={onUpdateNotes}
            onClose={onClose}
          />
        )}
      </main>
    </div>
  );
};
