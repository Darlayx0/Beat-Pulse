import React, { useMemo, useState } from 'react';
import type { Note } from '../../../types';
import { analyzeSyncAnchors, previewChartAlignment, type SyncAnchor } from '../../../lib/chartAlignment';
import { chartToAudioTime } from '../../../lib/editorTiming';

interface Props {
  notes: Note[]; offset: number; currentTime: number; audioDuration: number; locked: boolean;
  audioStatus?: string;
  onUpdateOffset: (offset: number) => void; onUndo?: () => void; canUndo?: boolean;
  onAudition?: (time: number) => void;
}

export function SubPageChartSync({ notes, offset, currentTime, audioDuration, locked, audioStatus, onUpdateOffset, onUndo, canUndo, onAudition }: Props) {
  const [value, setValue] = useState('0');
  const [noteId, setNoteId] = useState('');
  const [audioTarget, setAudioTarget] = useState('');
  const [anchors, setAnchors] = useState<SyncAnchor[]>([]);
  const [message, setMessage] = useState('');
  const audioReady = audioStatus === 'Audio lokal siap' || audioStatus === 'Audio preset siap' || audioStatus === 'YouTube streaming';
  const chosen = useMemo(() => notes.find(n => n.id === noteId) || notes[0], [notes, noteId]);
  const noteOptions = useMemo(() => notes.map((n, i) => <option key={n.id} value={n.id}>#{i + 1} · lane {n.lane + 1} · {n.time.toFixed(3)} s</option>), [notes]);
  // A reference becomes obsolete if its note was deleted or moved by another edit.
  const activeAnchors = useMemo(() => anchors.filter(a => notes.some(n => n.id === a.noteId && n.time === a.chartTime)), [anchors, notes]);
  const analysis = useMemo(() => analyzeSyncAnchors(activeAnchors, offset), [activeAnchors, offset]);
  const delta = value.trim() ? Number(value) / 1000 : NaN;
  const preview = useMemo(() => previewChartAlignment(notes, offset, delta, audioDuration), [notes, offset, delta, audioDuration]);
  const suggested = useMemo(() => analysis && previewChartAlignment(notes, offset, analysis.delta, audioDuration), [notes, offset, analysis, audioDuration]);
  const target = audioTarget.trim() ? Number(audioTarget) : NaN;
  const validTarget = chosen && Number.isFinite(target) && target >= 0 && (!audioDuration || target <= audioDuration);
  const apply = () => {
    if (locked || !preview.valid || delta === 0) return;
    onUpdateOffset(preview.nextOffset);
    setValue('0');
    setMessage(`Sinkronisasi diterapkan: ${delta >= 0 ? '+' : ''}${(delta * 1000).toFixed(3)} ms. Data note dan durasi hold tetap utuh.`);
  };
  return <div className="space-y-5">
    <div><h3 className="font-bold text-slate-900">Sinkronisasi chart dengan lagu</h3><p className="text-sm text-slate-600 mt-2">Seluruh chart digeser melalui offset. +100 ms membuat note 100 ms lebih lambat; −100 ms lebih cepat. Pola dan durasi hold tetap sama.</p></div>
    {!audioReady && <p role="status" className="editor-shift-preview text-sm">Audio lagu belum siap. Hubungkan audio asli melalui Track & Relink Audio untuk memeriksa hasil dengan pendengaran. Preview angka tetap tersedia; audio synth fallback tidak bisa memverifikasi sinkronisasi lagu.</p>}
    <section className="editor-shift-form space-y-3">
      <label className="block text-sm font-medium">Geser chart (ms)<input aria-label="Geser chart milidetik" type="number" step="1" value={value} disabled={locked} onChange={e => setValue(e.target.value)} className="editor-number-field block w-full mt-2 font-mono" /></label>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{[-100,-10,-1,1,10,100].map(ms => <button key={ms} disabled={locked} className="editor-secondary-button font-mono text-xs" onClick={() => setValue(String((Number.isFinite(delta) ? delta * 1000 : 0) + ms))}>{ms > 0 ? '+' : ''}{ms} ms</button>)}</div>
    </section>
    <section aria-label="Preview sinkronisasi" className={`editor-shift-preview space-y-2 text-sm ${preview.error ? 'editor-shift-invalid' : ''}`}>
      <h3 className="font-bold">Preview posisi pada audio · {preview.count} note</h3>
      {notes.length > 0 && Number.isFinite(delta) && <><p className="font-mono text-xs break-words">Sebelum: {preview.first.toFixed(3)}–{preview.last.toFixed(3)} s</p><p className="font-mono text-xs break-words">Sesudah: {preview.nextFirst.toFixed(3)}–{preview.nextLast.toFixed(3)} s</p></>}
      <p>Offset tersimpan: {(offset * 1000).toFixed(3)} ms → {Number.isFinite(delta) ? (preview.nextOffset * 1000).toFixed(3) : '—'} ms.</p>
      <p className="text-xs text-slate-600">Format chart memakai waktu audio = waktu note − offset, sehingga tanda offset tersimpan berlawanan dengan tanda pergeseran.</p>
      {preview.error && <p className="text-rose-800" role="status">{preview.error}</p>}
      {!audioDuration && <p>Durasi audio belum tersedia; batas akhir belum bisa diverifikasi.</p>}
    </section>
    <button className="editor-secondary-button w-full" disabled={locked || !preview.valid || delta === 0} onClick={apply}>Terapkan sinkronisasi</button>
    <section className="editor-shift-form space-y-3">
      <h3 className="font-bold">Titik acuan note dan audio</h3>
      <p className="text-sm text-slate-600">Pasangkan note dengan kejadian musik yang dituju. Gunakan sedikitnya 3 acuan di awal, tengah, dan akhir; rentang minimum 10 detik untuk pemeriksaan drift. Ambang diagnosis 20 ms.</p>
      <label className="block text-sm">Note acuan<select aria-label="Note acuan" className="editor-number-field block w-full mt-2" value={chosen?.id || ''} onChange={e => {setNoteId(e.target.value);setAudioTarget('');}}>{noteOptions}</select></label>
      <label className="block text-sm">Waktu kejadian pada audio (detik)<input aria-label="Waktu audio acuan" className="editor-number-field block w-full mt-2 font-mono" type="number" step="0.001" value={audioTarget} onChange={e => setAudioTarget(e.target.value)} /></label>
      <button className="editor-secondary-button w-full" disabled={!audioReady || chartToAudioTime(currentTime, offset) < 0} onClick={() => setAudioTarget(String(chartToAudioTime(currentTime, offset)))}>Gunakan waktu audio playhead</button>
      <button className="editor-secondary-button w-full" disabled={!validTarget || activeAnchors.length >= 12 && !activeAnchors.some(a => a.noteId === chosen?.id)} onClick={() => {
        if (!validTarget || !chosen) return;
        setAnchors([...activeAnchors.filter(a => a.noteId !== chosen.id), { noteId: chosen.id, chartTime: chosen.time, audioTime: target }]);
      }}>Tambahkan / perbarui acuan</button>
      {activeAnchors.map((a, i) => <div key={a.noteId} className="border-t pt-3 space-y-2 text-xs">
        <p className="font-mono break-words">Note {a.chartTime.toFixed(3)} s → audio {a.audioTime.toFixed(3)} s</p>
        <p>Selisih sekarang: {((a.audioTime - chartToAudioTime(a.chartTime, offset)) * 1000).toFixed(3)} ms · sisa setelah saran: {((analysis?.residuals[i] || 0) * 1000).toFixed(3)} ms</p>
        <button className="editor-secondary-button w-full" aria-label={`Hapus acuan ${i + 1}`} onClick={() => setAnchors(activeAnchors.filter(x => x.noteId !== a.noteId))}>Hapus acuan</button>
      </div>)}
      {analysis && <div role="status" className="editor-shift-preview space-y-2 text-sm">
        <p>{analysis.kind === 'drift' ? `Terdeteksi drift: perubahan selisih sekitar ${((analysis.scale - 1) * analysis.span * 1000).toFixed(1)} ms sepanjang acuan. Offset tunggal tidak cukup; periksa tempo atau skala waktu chart.`
          : analysis.kind === 'inconsistent' ? 'Acuan tidak konsisten dengan satu offset. Periksa pasangan acuan atau timing per bagian.'
          : analysis.kind === 'insufficient' ? 'Saran offset sementara. Jumlah atau rentang acuan belum cukup untuk menilai drift.'
          : 'Acuan mendukung koreksi offset tetap.'}</p>
        <p>Saran pergeseran: {(analysis.delta * 1000).toFixed(3)} ms.</p>
        {analysis.kind === 'offset' && analysis.residuals.some(r => Math.abs(r) > 0.02) && <p className="text-amber-800">Ada acuan dengan sisa selisih di atas 20 ms. Periksa acuan tersebut sebelum menerapkan saran.</p>}
        {suggested?.error && <p className="text-rose-800">{suggested.error}</p>}
        <button className="editor-secondary-button w-full" disabled={locked || !analysis.canApply || !suggested?.valid} onClick={() => setValue(String(analysis.delta * 1000))}>Gunakan saran pada preview</button>
      </div>}
      <p className="text-xs text-slate-500">Acuan hanya berlaku selama panel ini dibuka. Saran belum mengubah chart. Kalibrasi perangkat diatur terpisah.</p>
    </section>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <button className="editor-secondary-button" disabled={!audioReady || !onAudition || !chosen} onClick={() => chosen && onAudition?.(Math.max(0, chosen.time - 2))}>Dengarkan timing tersimpan</button>
      <button className="editor-secondary-button" disabled={locked || !canUndo || !onUndo} onClick={() => {onUndo?.();setValue('0');setMessage('Langkah terakhir dibatalkan, termasuk perubahan timing.');}}>Undo timing / editing terakhir</button>
    </div>
    <p role="status" aria-live="polite" className="text-sm text-slate-700">{message}</p>
  </div>;
}
