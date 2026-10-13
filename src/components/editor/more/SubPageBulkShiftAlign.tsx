import React, { useMemo, useState } from 'react';
import { ArrowRight, ArrowRightLeft, Crosshair, RotateCcw } from 'lucide-react';
import { Note } from '../../../types';
import { previewShift, shiftNotesSafely, snapStepSeconds } from '../../../lib/editorTiming';
import { SubPageChartSync } from './SubPageChartSync';

interface SubPageBulkShiftAlignProps {
  notes: Note[]; currentTime: number; bpm: number; isLocked: boolean; isPreset: boolean;
  onUpdateNotes: (notes: Note[]) => void; onUndo?: () => void; onClose: () => void;
  offset: number; audioDuration: number; onUpdateOffset: (offset: number) => void;
  canUndo?: boolean; onAudition?: (time: number) => void;
  audioStatus?: string; legacyOffset?: number; onConvertLegacyOffset?: () => void;
}
export const SubPageBulkShiftAlign: React.FC<SubPageBulkShiftAlignProps> = ({ notes, currentTime, bpm, isLocked, isPreset, onUpdateNotes, onUndo, offset, audioDuration, onUpdateOffset, canUndo, onAudition, audioStatus, legacyOffset, onConvertLegacyOffset }) => {
  const [mode, setMode] = useState<'sync' | 'edit'>('sync');
  const [unit, setUnit] = useState<'ms' | 'sec' | 'beat'>('ms');
  const [value, setValue] = useState('-100');
  const [lane, setLane] = useState<number | 'all'>('all');
  const [message, setMessage] = useState('');
  const [canUndoShift, setCanUndoShift] = useState(false);
  const matches = (n: Note) => lane === 'all' || n.lane === lane;
  const delta = value.trim() ? Number(value) * (unit === 'ms' ? 0.001 : unit === 'beat' ? snapStepSeconds(bpm, 1) : 1) : NaN;
  const preview = useMemo(() => previewShift(notes, delta, n => lane === 'all' || n.lane === lane), [notes, delta, lane]);
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
  const aligned = useMemo(() => mode === 'edit' ? previewShift(notes, currentTime - preview.first, n => lane === 'all' || n.lane === lane) : null, [mode, notes, currentTime, preview.first, lane]);
  return <div className="editor-shift-page max-w-3xl mx-auto space-y-5">
    <section className="editor-shift-form space-y-3">
      <h3 className="font-bold">Offset audio</h3>
      <p className="text-sm text-slate-600">Nilai positif memutar audio lebih awal; negatif lebih lambat.</p>
      <label className="block text-sm">Offset (ms)<input aria-label="Offset milidetik" type="number" step="1" value={Math.round(offset * 1000)} disabled={locked} className="editor-number-field w-full block font-mono" onChange={e => {if (e.target.value.trim() && Number.isFinite(Number(e.target.value))) onUpdateOffset(Number(e.target.value) / 1000);}} /></label>
      <div className="grid grid-cols-5 gap-2">{[-50,-10,0,10,50].map(ms => <button key={ms} disabled={locked} className="editor-secondary-button text-xs" onClick={() => onUpdateOffset(ms === 0 ? 0 : offset + ms / 1000)}>{ms === 0 ? 'Reset' : `${ms > 0 ? '+' : ''}${ms} ms`}</button>)}</div>
      {legacyOffset !== undefined && <details><summary>Konversi offset chart lama</summary><p className="text-sm py-2">Nilai {legacyOffset} dibaca sebagai detik. Konversi hanya jika data lama memakai milidetik; cadangan lokal dibuat terlebih dahulu.</p><button disabled={locked} className="editor-secondary-button" onClick={onConvertLegacyOffset}>Cadangkan & konversi offset lama dari ms</button></details>}
    </section>
    <details className="editor-advanced-panel"><summary>Pengaturan timing lanjutan</summary><div className="space-y-4 pt-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Mode pergeseran">
      <button className="editor-secondary-button" aria-pressed={mode === 'sync'} onClick={() => setMode('sync')}>Sinkronisasi lagu</button>
      <button className="editor-secondary-button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>Edit waktu note</button>
    </div>
    {mode === 'sync' ? <SubPageChartSync notes={notes} offset={offset} currentTime={currentTime} audioDuration={audioDuration} audioStatus={audioStatus} locked={locked} onUpdateOffset={onUpdateOffset} onUndo={onUndo} canUndo={canUndo} onAudition={onAudition} /> : <>
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600"><ArrowRightLeft className="h-5 w-5" /></span><div><h3 className="font-bold text-slate-900">Geser waktu note</h3><p className="text-xs text-slate-500">Jarak dan pola chart tetap terjaga</p></div></div>
    <p className="text-sm text-slate-600">Mode editing mengubah timestamp note. Nilai positif membuat note lebih lambat; negatif lebih cepat. Untuk menyelaraskan seluruh chart dengan lagu, gunakan mode Sinkronisasi lagu.</p>
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
      <button className="editor-secondary-button w-full" disabled={locked || !aligned?.valid} onClick={() => apply(currentTime - preview.first)}>Selaraskan ke playhead</button>
    </section>
    <div role="status" aria-live="polite" className={message ? 'editor-shift-preview text-sm text-slate-700' : ''}>{message}{canUndoShift && onUndo && <button className="editor-secondary-button mt-3 flex items-center justify-center gap-2" onClick={() => {onUndo();setCanUndoShift(false);setMessage('Pergeseran dibatalkan.');}}><RotateCcw className="w-4 h-4" />Undo</button>}</div>
    </>}
    </div></details>
  </div>;
};
