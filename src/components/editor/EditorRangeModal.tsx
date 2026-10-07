import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  Copy,
  Trash2,
  Scissors,
  ArrowRight,
  ArrowLeftRight,
  Clock,
  Layers,
  Check,
  RotateCcw,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { Note } from '../../types';
import { audioEngine } from '../../lib/audioEngine';

interface EditorRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  currentTime: number;
  duration: number;
  bpm: number;
  isLocked?: boolean;
  isPreset?: boolean;
  onUpdateNotes: (newNotes: Note[]) => void;
  onSelectNotes?: (noteIds: string[]) => void;
  onCopySelected?: () => void;
}

export const EditorRangeModal: React.FC<EditorRangeModalProps> = ({
  isOpen,
  onClose,
  notes,
  currentTime,
  duration,
  bpm,
  isLocked = false,
  isPreset = false,
  onUpdateNotes,
  onSelectNotes,
  onCopySelected,
}) => {
  // Active Tab: 'copy_paste' (Salin, Potong & Tempel) | 'delete' (Hapus Rentang)
  const [activeTab, setActiveTab] = useState<'copy_paste' | 'delete'>('copy_paste');

  // Notification Toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Range Boundary States
  const [startSec, setStartSec] = useState<number>(0);
  const [endSec, setEndSec] = useState<number>(Math.min(15, duration || 60));
  const [pasteSec, setPasteSec] = useState<number>(Math.min(30, duration || 60));

  // Sync range automatically with current playhead whenever opened
  React.useEffect(() => {
    if (isOpen) {
      const cur = Math.max(0, Number(currentTime.toFixed(2)));
      const beatLength = 60 / (bpm || 120);
      const defaultSpan = Number((4 * beatLength).toFixed(2)); // 1 Bar
      const calculatedEnd = Math.min(duration || 300, Number((cur + defaultSpan).toFixed(2)));
      setStartSec(cur);
      setEndSec(calculatedEnd > cur ? calculatedEnd : Number((cur + 2).toFixed(2)));
      setPasteSec(calculatedEnd > cur ? calculatedEnd : Number((cur + 2).toFixed(2)));
    }
  }, [isOpen]);

  // Copy & Paste Options
  const [repeatCount, setRepeatCount] = useState<number>(1);
  const [pasteMode, setPasteMode] = useState<'merge' | 'replace'>('merge');
  const [mirrorLanes, setMirrorLanes] = useState<boolean>(false);

  // Delete Filter (Semua Jalur vs Jalur Tertentu)
  const [laneFilter, setLaneFilter] = useState<'all' | 0 | 1 | 2 | 3>('all');

  const beatSec = 60 / (bpm || 120);
  const stepIntervalDuration = beatSec / 4; // 1/4 Beat interval step

  // Inclusive Range Check: notes on exact boundaries are 100% included
  const isTimeInRange = useCallback((t: number, s: number, e: number) => {
    const minT = Math.min(s, e);
    const maxT = Math.max(s, e);
    return t >= minT - 0.005 && t <= maxT + 0.005;
  }, []);

  // Filter notes in current range [startSec, endSec]
  const notesInRange = useMemo(() => {
    const s = Math.min(startSec, endSec);
    const e = Math.max(startSec, endSec);
    return notes.filter((n) => {
      const inTime = isTimeInRange(n.time, s, e);
      if (!inTime) return false;
      if (laneFilter !== 'all' && n.lane !== laneFilter) return false;
      return true;
    });
  }, [notes, startSec, endSec, isTimeInRange, laneFilter]);

  // Salin (Copy) Notes to Clipboard
  const handleCopyRange = useCallback(() => {
    if (notesInRange.length === 0) {
      showToast(`Tidak ada note pada rentang [${startSec.toFixed(2)}s - ${endSec.toFixed(2)}s] untuk disalin.`, 'error');
      return;
    }
    if (onSelectNotes) onSelectNotes(notesInRange.map((n) => n.id));
    if (onCopySelected) onCopySelected();
    audioEngine.playHitsound('perfect');
    showToast(`📋 ${notesInRange.length} note dalam rentang berhasil disalin ke clipboard!`, 'success');
  }, [endSec, notesInRange, onCopySelected, onSelectNotes, startSec]);

  // Potong (Cut) Notes to Clipboard & Delete from Chart (Berada di Tab Salin & Tempel)
  const handleCutRange = useCallback(() => {
    if (isPreset || isLocked) {
      showToast('Chart sedang terkunci atau preset tidak dapat diubah.', 'error');
      return;
    }

    const s = Math.min(startSec, endSec);
    const e = Math.max(startSec, endSec);

    if (notesInRange.length === 0) {
      showToast(`Tidak ada note pada rentang [${s.toFixed(2)}s - ${e.toFixed(2)}s] untuk dipotong.`, 'error');
      return;
    }

    const countCut = notesInRange.length;
    if (onSelectNotes) onSelectNotes(notesInRange.map((n) => n.id));
    if (onCopySelected) onCopySelected();

    const remaining = notes.filter((n) => {
      const inTime = isTimeInRange(n.time, s, e);
      if (!inTime) return true;
      if (laneFilter !== 'all' && n.lane !== laneFilter) return true;
      return false;
    });

    onUpdateNotes(remaining);
    audioEngine.playHitsound('tap');
    showToast(`✂️ ${countCut} note berhasil dipotong ke clipboard!`, 'success');
  }, [endSec, isLocked, isPreset, isTimeInRange, laneFilter, notes, notesInRange, onCopySelected, onSelectNotes, onUpdateNotes, startSec]);

  // Execute Range Copy & Paste to Point C
  const handleExecuteCopyPaste = useCallback(() => {
    if (isPreset || isLocked) {
      showToast('Chart sedang terkunci atau preset tidak dapat diubah.', 'error');
      return;
    }

    const s = Math.min(startSec, endSec);
    const e = Math.max(startSec, endSec);
    const rangeSpan = e - s;

    if (rangeSpan <= 0.001) {
      showToast('Titik Akhir (B) harus lebih besar daripada Titik Awal (A).', 'error');
      return;
    }

    if (notesInRange.length === 0) {
      showToast(`Tidak ada note pada rentang [${s.toFixed(2)}s - ${e.toFixed(2)}s] untuk ditempel.`, 'error');
      return;
    }

    const newGeneratedNotes: Note[] = [];
    const sourceBaseTime = s;

    for (let r = 0; r < repeatCount; r++) {
      const repeatOffset = pasteSec + r * rangeSpan;

      notesInRange.forEach((n, idx) => {
        const relativeOffset = n.time - sourceBaseTime;
        const targetTime = Number(Math.max(0, repeatOffset + relativeOffset).toFixed(3));
        const targetLane = mirrorLanes ? 3 - n.lane : n.lane;

        newGeneratedNotes.push({
          id: `paste_${Date.now()}_r${r}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          lane: targetLane,
          time: targetTime,
          duration: n.duration,
        });
      });
    }

    let finalNotes: Note[];
    if (pasteMode === 'replace') {
      const totalPasteEnd = pasteSec + repeatCount * rangeSpan;
      finalNotes = notes.filter((n) => !isTimeInRange(n.time, pasteSec, totalPasteEnd));
      finalNotes = [...finalNotes, ...newGeneratedNotes];
    } else {
      // Merge mode
      finalNotes = [...notes, ...newGeneratedNotes];
    }

    finalNotes.sort((a, b) => a.time - b.time);
    onUpdateNotes(finalNotes);
    audioEngine.playHitsound('perfect');

    showToast(
      `✨ Berhasil menempel ${newGeneratedNotes.length} note ke titik C (${pasteSec.toFixed(2)}s)!`,
      'success'
    );
  }, [
    endSec,
    isLocked,
    isPreset,
    isTimeInRange,
    mirrorLanes,
    notes,
    notesInRange,
    onUpdateNotes,
    pasteMode,
    pasteSec,
    repeatCount,
    startSec,
  ]);

  // Execute Duplicate Forward (Duplikat tepat setelah titik B)
  const handleExecuteDuplicate = useCallback(() => {
    if (isPreset || isLocked) {
      showToast('Chart sedang terkunci atau preset tidak dapat diubah.', 'error');
      return;
    }

    const s = Math.min(startSec, endSec);
    const e = Math.max(startSec, endSec);
    const span = e - s;

    if (notesInRange.length === 0 || span <= 0.001) {
      showToast('Tidak ada note dalam rentang untuk diduplikasi.', 'error');
      return;
    }

    const newNotes: Note[] = notesInRange.map((n, idx) => ({
      id: `dup_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      lane: mirrorLanes ? 3 - n.lane : n.lane,
      time: Number((n.time + span).toFixed(3)),
      duration: n.duration,
    }));

    const finalNotes = [...notes, ...newNotes].sort((a, b) => a.time - b.time);
    onUpdateNotes(finalNotes);
    audioEngine.playHitsound('perfect');

    showToast(`✨ Berhasil menduplikasi ${newNotes.length} note tepat setelah titik B (+${span.toFixed(2)}s)!`, 'success');
  }, [endSec, isLocked, isPreset, mirrorLanes, notes, notesInRange, onUpdateNotes, startSec]);

  // Execute Delete Range
  const handleDeleteRange = useCallback(() => {
    if (isPreset || isLocked) {
      showToast('Chart sedang terkunci atau preset tidak dapat diubah.', 'error');
      return;
    }

    const s = Math.min(startSec, endSec);
    const e = Math.max(startSec, endSec);

    if (notesInRange.length === 0) {
      showToast(`Tidak ada note pada rentang [${s.toFixed(2)}s - ${e.toFixed(2)}s] untuk dihapus.`, 'error');
      return;
    }

    const countDeleted = notesInRange.length;
    const remaining = notes.filter((n) => {
      const inTime = isTimeInRange(n.time, s, e);
      if (!inTime) return true;
      if (laneFilter !== 'all' && n.lane !== laneFilter) return true;
      return false; // delete this note
    });

    onUpdateNotes(remaining);
    audioEngine.playHitsound('tap');

    showToast(
      `🗑️ ${countDeleted} note dalam rentang [${s.toFixed(2)}s - ${e.toFixed(2)}s] berhasil dihapus!`,
      'success'
    );
  }, [endSec, isLocked, isPreset, isTimeInRange, laneFilter, notes, notesInRange.length, onUpdateNotes, startSec]);

  if (!isOpen) return null;

  return (
    <div
      id="editor-inline-range-panel"
      className="w-full bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm space-y-3 text-slate-900 ring-1 ring-slate-950/5 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Header: Non-Windowed Docked Bar Above Chart with Live Playhead Indicator */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold shadow-xs">
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span>Alat Rentang Partitur</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold border border-indigo-200">
                {notesInRange.length} Note Terpilih
              </span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500">
              Rentang [A - B] dapat disalin, dipotong, ditempel ke C, atau dihapus dengan melihat posisi playhead langsung di bawah.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Playhead Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-sky-700 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-slate-500">Playhead:</span>
            <span>{currentTime.toFixed(2)}s</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer"
            title="Tutup Bilah Rentang"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation: Tab 1 (Salin, Potong & Tempel) vs Tab 2 (Hapus Rentang) */}
      <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('copy_paste')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'copy_paste'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Salin, Potong & Tempel</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('delete')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'delete'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Hapus Rentang</span>
        </button>
      </div>

      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in ${
            toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="text-slate-500 hover:text-slate-800 text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Quick Span Presets from Playhead */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
        <span className="text-[10.5px] font-bold text-slate-700 whitespace-nowrap pl-1">Set dari Playhead:</span>
        {[
          { label: '+1 Bar', beats: 4 },
          { label: '+2 Bar', beats: 8 },
          { label: '+4 Bar', beats: 16 },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              const s = Number(currentTime.toFixed(2));
              const e = Number((currentTime + p.beats * beatSec).toFixed(2));
              setStartSec(s);
              setEndSec(Math.min(duration || 300, e));
              showToast(`Rentang diatur ${p.label} (${s.toFixed(2)}s - ${e.toFixed(2)}s)`);
            }}
            className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-mono font-bold border border-slate-200 shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            {p.label} (+{Number((p.beats * beatSec).toFixed(1))}s)
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setStartSec(0);
            setEndSec(Number((duration || 120).toFixed(2)));
            showToast('Rentang diatur untuk seluruh durasi lagu.');
          }}
          className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 shadow-xs cursor-pointer active:scale-95 transition-all"
        >
          Seluruh Lagu
        </button>
      </div>

      {/* Point Selectors Grid: Point A, Point B, Point C */}
      <div className={`grid gap-2.5 ${activeTab === 'copy_paste' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        {/* Box A: Titik Awal */}
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>Titik Awal (Point A)</span>
            </span>
            <span className="text-[10px] font-mono text-sky-800 font-bold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
              {startSec.toFixed(2)}s
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.05"
              min="0"
              max={duration || 300}
              value={startSec}
              onChange={(e) => setStartSec(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-20 bg-white border border-slate-300 focus:border-sky-500 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 outline-none shadow-xs"
            />
            <button
              type="button"
              onClick={() => setStartSec(Number(currentTime.toFixed(2)))}
              className="flex-1 py-1 px-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-[10.5px] border border-sky-200 cursor-pointer whitespace-nowrap active:scale-95 transition-all shadow-xs"
              title="Ambil detik dari Playhead saat ini"
            >
              📍 Set Playhead ({currentTime.toFixed(2)}s)
            </button>
          </div>

          <div className="flex items-center gap-1 justify-end pt-0.5">
            <button
              type="button"
              onClick={() => setStartSec(Math.max(0, Number((startSec - stepIntervalDuration).toFixed(2))))}
              className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono cursor-pointer shadow-xs"
            >
              -Beat
            </button>
            <button
              type="button"
              onClick={() => setStartSec(Number((startSec + stepIntervalDuration).toFixed(2)))}
              className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono cursor-pointer shadow-xs"
            >
              +Beat
            </button>
          </div>
        </div>

        {/* Box B: Titik Akhir */}
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>Titik Akhir (Point B)</span>
            </span>
            <span className="text-[10px] font-mono text-sky-800 font-bold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
              {endSec.toFixed(2)}s
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.05"
              min="0"
              max={duration || 300}
              value={endSec}
              onChange={(e) => setEndSec(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-20 bg-white border border-slate-300 focus:border-sky-500 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 outline-none shadow-xs"
            />
            <button
              type="button"
              onClick={() => setEndSec(Number(currentTime.toFixed(2)))}
              className="flex-1 py-1 px-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-[10.5px] border border-sky-200 cursor-pointer whitespace-nowrap active:scale-95 transition-all shadow-xs"
              title="Ambil detik dari Playhead saat ini"
            >
              📍 Set Playhead ({currentTime.toFixed(2)}s)
            </button>
          </div>

          <div className="flex items-center gap-1 justify-end pt-0.5">
            <button
              type="button"
              onClick={() => setEndSec(Math.max(0, Number((endSec - stepIntervalDuration).toFixed(2))))}
              className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono cursor-pointer shadow-xs"
            >
              -Beat
            </button>
            <button
              type="button"
              onClick={() => setEndSec(Number((endSec + stepIntervalDuration).toFixed(2)))}
              className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono cursor-pointer shadow-xs"
            >
              +Beat
            </button>
          </div>
        </div>

        {/* Box C: Titik Tempel (Khusus Tab Salin & Tempel) */}
        {activeTab === 'copy_paste' && (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                <span>Titik Tempel (Point C)</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {pasteSec.toFixed(2)}s
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.05"
                min="0"
                max={duration || 300}
                value={pasteSec}
                onChange={(e) => setPasteSec(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 bg-white border border-slate-300 focus:border-emerald-500 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 outline-none shadow-xs"
              />
              <button
                type="button"
                onClick={() => setPasteSec(Number(currentTime.toFixed(2)))}
                className="flex-1 py-1 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10.5px] border border-emerald-200 cursor-pointer whitespace-nowrap active:scale-95 transition-all shadow-xs"
                title="Ambil detik dari Playhead saat ini"
              >
                📍 Set Playhead ({currentTime.toFixed(2)}s)
              </button>
            </div>

            <div className="flex items-center gap-1 justify-end pt-0.5">
              <button
                type="button"
                onClick={() => setPasteSec(Math.max(0, Number((pasteSec - 1).toFixed(2))))}
                className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono cursor-pointer shadow-xs"
              >
                -1s
              </button>
              <button
                type="button"
                onClick={() => setPasteSec(Number((pasteSec + 1).toFixed(2)))}
                className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono cursor-pointer shadow-xs"
              >
                +1s
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TAB 1 CONTENT: SALIN, POTONG & TEMPEL ACTIONS */}
      {activeTab === 'copy_paste' && (
        <div className="space-y-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Repeat Multiplier */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-700">Ulangi:</span>
              <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200 shadow-xs">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRepeatCount(r)}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold cursor-pointer transition-all ${
                      repeatCount === r
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>

            {/* Paste Mode: Gabung vs Timpa */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-700">Mode:</span>
              <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200 shadow-xs">
                <button
                  type="button"
                  onClick={() => setPasteMode('merge')}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold cursor-pointer transition-all ${
                    pasteMode === 'merge'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gabung
                </button>
                <button
                  type="button"
                  onClick={() => setPasteMode('replace')}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold cursor-pointer transition-all ${
                    pasteMode === 'replace'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Timpa
                </button>
              </div>
            </div>

            {/* Mirror Toggle */}
            <button
              type="button"
              onClick={() => setMirrorLanes(!mirrorLanes)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer border transition-all shadow-xs ${
                mirrorLanes
                  ? 'bg-purple-100 border-purple-300 text-purple-900 font-black'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
              <span>Mirror (0↔3, 1↔2)</span>
            </button>
          </div>

          {/* Core Action Buttons for Salin & Tempel Tab: SALIN, POTONG (CUT), DUPLIKAT, TEMPEL */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
            {/* Tombol Salin */}
            <button
              type="button"
              disabled={notesInRange.length === 0}
              onClick={handleCopyRange}
              className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-sky-800 font-bold text-xs flex items-center gap-1.5 border border-sky-300 cursor-pointer active:scale-95 disabled:opacity-40 shadow-xs"
              title="Salin semua note dalam rentang ke memori"
            >
              <Copy className="w-3.5 h-3.5 text-sky-600" />
              <span>Salin ({notesInRange.length})</span>
            </button>

            {/* Tombol Potong */}
            <button
              type="button"
              disabled={isPreset || isLocked || notesInRange.length === 0}
              onClick={handleCutRange}
              className="py-2 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 border border-amber-300 cursor-pointer active:scale-95 disabled:opacity-40 shadow-xs"
              title="Potong note dalam rentang ke clipboard dan hapus dari chart"
            >
              <Scissors className="w-3.5 h-3.5 text-amber-600" />
              <span>Potong Rentang ({notesInRange.length})</span>
            </button>

            {/* Tombol Duplikat Setelah B */}
            <button
              type="button"
              disabled={isPreset || isLocked || notesInRange.length === 0}
              onClick={handleExecuteDuplicate}
              className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-purple-800 font-bold text-xs flex items-center gap-1.5 border border-purple-300 cursor-pointer active:scale-95 disabled:opacity-40 shadow-xs"
              title="Gandakan susunan note tepat setelah Titik B"
            >
              <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
              <span>Duplikat Setelah B</span>
            </button>

            {/* Tombol Tempel ke Titik C */}
            <button
              type="button"
              disabled={isPreset || isLocked || notesInRange.length === 0 || endSec <= startSec}
              onClick={handleExecuteCopyPaste}
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 disabled:opacity-40"
              title="Tempel rangkaian note ke Titik C"
            >
              <Check className="w-4 h-4" />
              <span>TEMPEL KE C ({notesInRange.length * repeatCount} NOTE)</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2 CONTENT: HAPUS RENTANG */}
      {activeTab === 'delete' && (
        <div className="space-y-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
          {/* Lane Filter Options */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              <span>Filter Jalur Hapus:</span>
            </div>

            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-xs">
              <button
                type="button"
                onClick={() => setLaneFilter('all')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  laneFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              {[0, 1, 2, 3].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLaneFilter(l as any)}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                    laneFilter === l
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  L{l + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isPreset || isLocked || notes.length === 0}
                onClick={() => {
                  const remaining = notes.filter((n) => n.time < startSec);
                  const count = notes.length - remaining.length;
                  onUpdateNotes(remaining);
                  audioEngine.playHitsound('tap');
                  showToast(`🗑️ ${count} note dari titik A ke akhir lagu berhasil dikosongkan.`, 'success');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-rose-600 font-bold text-[11px] border border-slate-200 cursor-pointer disabled:opacity-40 shadow-xs"
              >
                Hapus dari A ke Akhir
              </button>

              <button
                type="button"
                disabled={isPreset || isLocked || notes.length === 0}
                onClick={() => {
                  const remaining = notes.filter((n) => n.time > endSec);
                  const count = notes.length - remaining.length;
                  onUpdateNotes(remaining);
                  audioEngine.playHitsound('tap');
                  showToast(`🗑️ ${count} note dari awal lagu hingga titik B berhasil dikosongkan.`, 'success');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-rose-600 font-bold text-[11px] border border-slate-200 cursor-pointer disabled:opacity-40 shadow-xs"
              >
                Hapus Awal hingga B
              </button>
            </div>

            <button
              type="button"
              disabled={isPreset || isLocked || notesInRange.length === 0}
              onClick={handleDeleteRange}
              className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>HAPUS {notesInRange.length} NOTE DALAM RENTANG</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
