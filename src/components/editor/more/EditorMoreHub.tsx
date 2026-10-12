import React, { useState, useRef, useEffect } from 'react';
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
import { useDialogFocus } from '../../../hooks/useDialogFocus';
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
  onUndo,
  audioStatus,
  legacyOffset,
  onConvertLegacyOffset,
}) => {
  const [activeSubPage, setActiveSubPage] = useState<MoreSubPageId | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, isOpen, () => activeSubPage ? setActiveSubPage(null) : onClose());
  useEffect(() => { if (!isOpen) setActiveSubPage(null); }, [isOpen]);
  useEffect(() => { if (isOpen) dialogRef.current?.querySelector<HTMLButtonElement>('header button')?.focus(); }, [activeSubPage]);
  if (!isOpen) return null;

  const currentSong = songs.find((s) => s.id === selectedSongId) || songs[0];

  const subPageTitles: Record<MoreSubPageId, { title: string; subtitle: string }> = {
    audio_track: {
      title: 'Track & Relink Audio',
      subtitle: 'Pengelolaan berkas audio lokal, rekoneksi audio buffer, dan pemilihan lagu',
    },
    difficulty_json: {
      title: 'Difficulty & JSON',
      subtitle: 'Pengaturan slot kesulitan, ekspor/impor partitur format JSON, dan cadangan draf',
    },
    bpm_offset_bounds: {
      title: 'BPM, Offset & Durasi',
      subtitle: 'Penyesuaian tempo ritme, pergeseran offset milidetik, dan limit durasi lagu',
    },
    bulk_shift_align: {
      title: 'Pergeseran & Playhead',
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
      ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="editor-more-title"
      className="fixed inset-0 z-50 bg-slate-50/98 backdrop-blur-2xl text-slate-900 flex flex-col animate-in fade-in duration-150 overflow-hidden"
    >
      {/* 1. Header Bilah Atas */}
      <header className="min-h-16 py-2 px-3 sm:px-6 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          {activeSubPage ? (
            <button
              type="button"
              aria-label="Kembali ke menu lanjutan"
              onClick={() => setActiveSubPage(null)}
              className="h-11 w-11 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 border border-slate-300 shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />

            </button>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0">
            <h2 id="editor-more-title" className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words">
              {activeSubPage ? subPageTitles[activeSubPage].title : 'Fitur Lanjutan & Konfigurasi Studio'}
            </h2>
            <p className="hidden sm:block text-xs text-slate-500">
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
            aria-label="Tutup konfigurasi studio" onClick={onClose}
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
        {activeSubPage === null && <div className="max-w-3xl mx-auto space-y-5">
          <p className="text-sm text-slate-600">{selectedDifficulty} · {notes.length} note · {bpm.toFixed(1)} BPM · {Math.round(offset * 1000)}ms · {saveMode === 'auto' ? 'Autosave lokal' : 'Simpan manual'}</p>
          {([
            {label:'Audio', items:[{id:'audio_track',icon:Music,title:'Track & Relink Audio',detail:audioStatus || (audioBuffer ? 'Buffer tersedia' : 'Butuh relink')}]},
            {label:'Chart & Data',items:[{id:'difficulty_json',icon:Layers,title:'Difficulty & JSON',detail:`${Object.keys(currentSong.charts).length} slot`},{id:'save_method',icon:HardDrive,title:'Penyimpanan & Draf',detail:saveMode === 'auto' ? 'Autosave' : 'Manual'}]},
            {label:'Ritme',items:[{id:'bpm_offset_bounds',icon:Activity,title:'BPM, Offset & Durasi',detail:`${bpm.toFixed(1)} BPM`},{id:'sound_effects',icon:Volume2,title:'Efek Suara',detail:`Hitsound ${enableHitsounds?'ON':'OFF'}`}]},
            {label:'Editing Massal',items:[{id:'bulk_shift_align',icon:ArrowRightLeft,title:'Pergeseran & Playhead',detail:`${notes.length} note`},{id:'auto_generator',icon:Sparkles,title:'Generator Otomatis',detail:'Analisis audio'},{id:'clear_notes',icon:Trash2,title:'Hapus Semua Note',detail:'Konfirmasi diperlukan'}]}
          ]).map(group=><section key={group.label}><h3 className="text-xs uppercase tracking-wide font-bold text-slate-500 mb-1">{group.label}</h3>
            <div className="divide-y divide-slate-200">{group.items.map(item=><button key={item.id} type="button" className="w-full min-h-16 py-3 flex items-center gap-3 text-left hover:bg-slate-100 rounded-lg" onClick={()=>setActiveSubPage(item.id as MoreSubPageId)}>
              <item.icon className="w-5 h-5 text-indigo-600 shrink-0" /><span className="flex-1 min-w-0"><span className="block text-sm font-semibold">{item.title}</span><span className="text-xs text-slate-600">{item.detail}</span></span><ChevronRight className="w-4 h-4 text-slate-400" />
            </button>)}</div>
          </section>)}
        </div>}

        {/* VIEW 2: SUB-PAGES KHUSUS */}
        {activeSubPage === 'audio_track' && (
          <SubPageAudioTrack
            latestNoteAudioTime={Math.max(0, ...notes.map(n => n.time + (n.duration || 0))) - offset}
            audioStatus={audioStatus}
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
            isLocked={isLocked || isPreset}
            onSelectDifficulty={onSelectDifficulty}
            onExportJSON={onExportJSON}
            onTriggerImportJSON={onTriggerImportJSON}
            onImportChartJson={onImportChartJson}
            onAddDifficulty={onAddDifficulty}
            onReorderDifficulties={onReorderDifficulties}
            onRenameDifficulty={onRenameDifficulty}
            onDeleteDifficulty={onDeleteDifficulty}
            onDuplicateDifficulty={onDuplicateDifficulty}
            onUpdateNotes={onUpdateNotes}
            onClose={onClose}
          />
        )}

        {activeSubPage === 'bpm_offset_bounds' && (
          <SubPageBpmOffsetBounds
            legacyOffset={legacyOffset}
            onConvertLegacyOffset={onConvertLegacyOffset}
            song={currentSong}
            bpm={bpm}
            offset={offset}
            duration={duration}
            audioBuffer={audioBuffer}
            notes={notes}
            isLocked={isLocked || isPreset}
            onUpdateBpm={onUpdateBpm}
            onUpdateOffset={onUpdateOffset}
            onUpdateDuration={onUpdateDuration}
            onClose={onClose}
          />
        )}

        {activeSubPage === 'bulk_shift_align' && (
          <SubPageBulkShiftAlign
            onUndo={onUndo}
            notes={notes}
            currentTime={currentTime}
            bpm={bpm}
            isLocked={isLocked || isPreset}
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
            offset={offset}
            song={currentSong}
            selectedDifficulty={selectedDifficulty}
            audioBuffer={audioBuffer}
            bpm={bpm}
            notes={notes}
            isLocked={isLocked || isPreset}
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
            isLocked={isLocked || isPreset}
            isPreset={isPreset}
            onUpdateNotes={onUpdateNotes}
            onClose={onClose}
          />
        )}
      </main>
    </div>
  );
};
