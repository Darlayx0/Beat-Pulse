import React, { useState } from 'react';
import { ArrowRight, ArrowRightLeft, Crosshair, RotateCcw } from 'lucide-react';
import { Note } from '../../../types';
import { previewShift, shiftNotesSafely, snapStepSeconds } from '../../../lib/editorTiming';

interface SubPageBulkShiftAlignProps {
  notes: Note[]; currentTime: number; bpm: number; isLocked: boolean; isPreset: boolean;
  onUpdateNotes: (notes: Note[]) => void; onUndo?: () => void; onClose: () => void;
}
export const SubPageBulkShiftAlign: React.FC<SubPageBulkShiftAlignProps> = ({ notes, currentTime, bpm, isLocked, isPreset, onUpdateNotes, onUndo }) => {
  const [unit, setUnit] = useState<'ms' | 'sec' | 'beat'>('ms');
  const [value, setValue] = useState('-100');
  const [lane, setLane] = useState<number | 'all'>('all');
  const [message, setMessage] = useState('');
  const [canUndoShift, setCanUndoShift] = useState(false);
  const matches = (n: Note) => lane === 'all' || n.lane === lane;
  const delta = value.trim() ? Number(value) * (unit === 'ms' ? 0.001 : unit === 'beat' ? snapStepSeconds(bpm, 1) : 1) : NaN;
  const preview = previewShift(notes, delta, matches);
  const locked = isLocked || isPreset;
  const apply = (seconds: number) => {
    if (locked) return;
    const result = shiftNotesSafely(notes, seconds, matches);
    if (!result.valid) { setMessage(result.error || 'Operasi ditolak.'); return; }
    if (seconds === 0) return;
    onUpdateNotes(result.notes);
    setCanUndoShift(true);
    setMessage(`${result.count} note digeser ${seconds >= 0 ? '+' : ''}${seconds.toFixed(3)}s. Jarak antar-note dipertahankan.`);
  };
  const aligned = previewShift(notes, currentTime - preview.first, matches);
  return <div className="editor-shift-page max-w-3xl mx-auto space-y-5">
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600"><ArrowRightLeft className="h-5 w-5" /></span><div><h3 className="font-bold text-slate-900">Geser waktu note</h3><p className="text-xs text-slate-500">Jarak dan pola chart tetap terjaga</p></div></div>
    <p className="text-sm text-slate-600">Pilih cakupan, masukkan delta bertanda, lalu periksa hasil sebelum menerapkan. Satu aksi dapat dibatalkan dengan satu Undo.</p>
    <div className="editor-shift-form grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label className="text-sm font-medium">Cakupan lane<select aria-label="Cakupan lane" className="block w-full border rounded-lg p-2" value={lane} onChange={e => setLane(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
        <option value="all">Semua lane</option>{[0,1,2,3].map(l => <option key={l} value={l}>Lane {l + 1}</option>)}</select></label>
      <label className="text-sm font-medium">Satuan<select aria-label="Satuan shift" className="block w-full border rounded-lg p-2" value={unit} onChange={e => setUnit(e.target.value as typeof unit)}><option value="ms">Milidetik</option><option value="sec">Detik</option><option value="beat">Beat</option></select></label>
      <label className="text-sm font-medium">Delta (+ / -)<input aria-label="Delta shift" className="block w-full border rounded-lg p-2 font-mono" type="number" step="any" value={value} onChange={e => setValue(e.target.value)} /></label>
    </div>
    <section className={`editor-shift-preview space-y-2 text-sm ${preview.error ? 'editor-shift-invalid' : ''}`} aria-label="Preview shift">
      <h3 className="font-bold">Preview · {preview.count} note terpengaruh</h3>
      <div className="flex items-center gap-3"><div className="flex-1 min-w-0"><p className="text-xs text-slate-500 mb-1">Sebelum</p><p className="font-mono text-xs">{preview.first.toFixed(3)}s – {preview.last.toFixed(3)}s</p></div><ArrowRight className="w-4 h-4 shrink-0 text-indigo-400" /><div className="flex-1 min-w-0"><p className="text-xs text-slate-500 mb-1">Sesudah</p><p className="font-mono text-xs font-semibold text-indigo-700">{Number.isFinite(delta) ? `${preview.nextFirst.toFixed(3)}s – ${preview.nextLast.toFixed(3)}s` : 'Isi delta yang valid'}</p></div></div>
      {preview.error && <p className="text-rose-800" role="status">{preview.error}</p>}
    </section>
    <button className="w-full sm:w-auto px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40" disabled={locked || !preview.valid || delta === 0} onClick={() => apply(delta)}>Terapkan pergeseran</button>
    <div><p className="text-xs font-medium text-slate-500 mb-2">Pilih delta cepat</p><div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{[-100,-50,-10,10,50,100].map(ms => <button key={ms} aria-pressed={unit === 'ms' && delta === ms / 1000} className="editor-secondary-button font-mono text-xs" onClick={() => {setUnit('ms');setValue(String(ms));}}>{ms > 0 ? '+' : ''}{ms}ms</button>)}</div></div>
    <section className="editor-shift-form space-y-3"><h3 className="font-bold flex items-center gap-2"><Crosshair className="w-4 h-4 text-sky-600" />Selaraskan ke playhead</h3>
      <p className="text-sm">Cakupan aktif: {preview.count} note · delta {(currentTime - preview.first).toFixed(3)}s → {currentTime.toFixed(3)}s.</p>
      <button className="editor-secondary-button w-full" disabled={locked || !aligned.valid} onClick={() => apply(currentTime - preview.first)}>Selaraskan ke playhead</button>
    </section>
    <div role="status" aria-live="polite" className={message ? 'editor-shift-preview text-sm text-slate-700' : ''}>{message}{canUndoShift && onUndo && <button className="editor-secondary-button mt-3 flex items-center justify-center gap-2" onClick={() => {onUndo();setCanUndoShift(false);setMessage('Pergeseran dibatalkan.');}}><RotateCcw className="w-4 h-4" />Undo</button>}</div>
  </div>;
};
