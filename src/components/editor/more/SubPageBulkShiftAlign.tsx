import React, { useState } from 'react';
import {
  ArrowRightLeft,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { Note } from '../../../types';
import { audioEngine } from '../../../lib/audioEngine';

interface SubPageBulkShiftAlignProps {
  notes: Note[];
  currentTime: number;
  bpm: number;
  isLocked: boolean;
  isPreset: boolean;
  onUpdateNotes: (notes: Note[]) => void;
  onClose: () => void;
}

export const SubPageBulkShiftAlign: React.FC<SubPageBulkShiftAlignProps> = ({
  notes,
  currentTime,
  bpm,
  isLocked,
  isPreset,
  onUpdateNotes,
}) => {
  const [shiftUnit, setShiftUnit] = useState<'ms' | 'sec' | 'beat'>('ms');
  const [customVal, setCustomVal] = useState<number>(100);
  const [targetLane, setTargetLane] = useState<number | 'all'>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const notesCount = notes.length;
  const firstNoteTime = notesCount > 0 ? Math.min(...notes.map((n) => n.time)) : 0;
  const lastNoteTime = notesCount > 0 ? Math.max(...notes.map((n) => n.time + (n.duration || 0))) : 0;

  const secondsPerBeat = 60 / (bpm || 120);

  const handleShiftBySeconds = (shiftSec: number) => {
    if (isLocked || isPreset || notesCount === 0) return;
    if (Math.abs(shiftSec) < 0.0001) return;

    const updated = notes.map((n) => {
      if (targetLane !== 'all' && n.lane !== targetLane) {
        return n;
      }
      return {
        ...n,
        time: Number(Math.max(0, n.time + shiftSec).toFixed(3)),
      };
    });

    onUpdateNotes(updated);
    audioEngine.playHitsound('perfect');
    const direction = shiftSec > 0 ? 'memajukan (+)' : 'memundurkan (-)';
    const displayMs = Math.round(Math.abs(shiftSec) * 1000);
    setFeedback({
      type: 'success',
      message: `Berhasil ${direction} note sebesar ${displayMs} ms (${Math.abs(shiftSec).toFixed(3)} detik)!`,
    });
  };

  const handleExecuteCustomShift = (direction: 1 | -1) => {
    let deltaSec = 0;
    if (shiftUnit === 'ms') {
      deltaSec = (customVal / 1000) * direction;
    } else if (shiftUnit === 'sec') {
      deltaSec = customVal * direction;
    } else if (shiftUnit === 'beat') {
      deltaSec = customVal * secondsPerBeat * direction;
    }
    handleShiftBySeconds(deltaSec);
  };

  const handleAlignFirstNoteToPlayhead = () => {
    if (isLocked || isPreset || notesCount === 0) return;
    const deltaSec = currentTime - firstNoteTime;
    if (Math.abs(deltaSec) < 0.001) {
      setFeedback({
        type: 'info',
        message: 'Note pertama sudah berada persis di posisi playhead saat ini!',
      });
      return;
    }
    handleShiftBySeconds(deltaSec);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-sm font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Info Status Note */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 block font-medium">Total Note</span>
          <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">
            {notesCount} note
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 block font-medium">Note Pertama</span>
          <span className="text-xl font-bold text-indigo-600 font-mono mt-0.5 block">
            {firstNoteTime.toFixed(3)}s
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 block font-medium">Note Terakhir</span>
          <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">
            {lastNoteTime.toFixed(3)}s
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 block font-medium">Posisi Playhead</span>
          <span className="text-xl font-bold text-emerald-600 font-mono mt-0.5 block">
            {currentTime.toFixed(3)}s
          </span>
        </div>
      </div>

      {/* Bagian 1: Penyelarasan Note Pertama ke Playhead */}
      <section className="space-y-4 pb-6 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Penyelarasan Note Pertama ke Posisi Playhead</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Menyelaraskan waktu kemunculan note paling pertama persis di posisi jarum putar (playhead) saat ini ({currentTime.toFixed(3)}s).
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900">
              Pergeseran Relatif: {currentTime >= firstNoteTime ? '+' : ''}{(currentTime - firstNoteTime).toFixed(3)} detik ({Math.round((currentTime - firstNoteTime) * 1000)} ms)
            </div>
            <p className="text-xs text-slate-500">
              Semua {notesCount} note akan otomatis bergeser bersamaan dengan rasio interval ritme yang tetap presisi.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAlignFirstNoteToPlayhead}
            disabled={isLocked || notesCount === 0}
            className="h-11 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MapPin className="w-4 h-4" />
            <span>Ratakan ke Playhead Sekarang</span>
          </button>
        </div>
      </section>

      {/* Bagian 2: Pergeseran Massal Presisi */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-sky-600" />
              <span>Pergeseran Massal Posisi Note Presisi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Geser maju atau mundur posisi waktu kumpulan note berdasarkan nilai milidetik, detik, atau beat.
            </p>
          </div>
        </div>

        {/* Filter Jalur / Scope */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-bold">Cakupan Jalur:</span>
          {(['all', 0, 1, 2, 3] as const).map((l) => (
            <button
              key={String(l)}
              type="button"
              onClick={() => setTargetLane(l)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                targetLane === l
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs'
              }`}
            >
              {l === 'all' ? 'Semua Jalur (4 Lane)' : `Hanya Jalur ${Number(l) + 1}`}
            </button>
          ))}
        </div>

        {/* Satuan & Nilai Pergeseran Kustom */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-bold mr-1">Satuan:</span>
              <button
                type="button"
                onClick={() => {
                  setShiftUnit('ms');
                  setCustomVal(100);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  shiftUnit === 'ms' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Milidetik (ms)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShiftUnit('sec');
                  setCustomVal(0.5);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  shiftUnit === 'sec' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Detik (s)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShiftUnit('beat');
                  setCustomVal(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  shiftUnit === 'beat' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Ketukan (Beat)
              </button>
            </div>

            {/* Input Nilai */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={shiftUnit === 'ms' ? 10 : 0.1}
                value={customVal}
                onChange={(e) => setCustomVal(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-24 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-mono text-slate-900 text-right outline-none focus:border-sky-500"
              />
              <span className="text-xs text-slate-500 font-bold">
                {shiftUnit === 'ms' ? 'ms' : shiftUnit === 'sec' ? 'detik' : 'beat'}
              </span>
            </div>
          </div>

          {/* Tombol Eksekusi Mundur / Maju */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleExecuteCustomShift(-1)}
              disabled={isLocked || notesCount === 0 || customVal <= 0}
              className="flex-1 h-11 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-700 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200 shadow-xs disabled:opacity-50"
            >
              <span>◀ Memundurkan Note (-{customVal} {shiftUnit})</span>
            </button>
            <button
              type="button"
              onClick={() => handleExecuteCustomShift(1)}
              disabled={isLocked || notesCount === 0 || customVal <= 0}
              className="flex-1 h-11 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <span>Memajukan Note (+{customVal} {shiftUnit}) ▶</span>
            </button>
          </div>

          {/* Presets Cepat */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-2 font-medium">Preset Geser Cepat:</span>
            {[-100, -50, -10, 10, 50, 100].map((ms) => (
              <button
                key={ms}
                type="button"
                onClick={() => handleShiftBySeconds(ms / 1000)}
                disabled={isLocked || notesCount === 0}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-mono text-xs font-bold transition-all cursor-pointer disabled:opacity-40 border border-slate-200 shadow-xs"
              >
                {ms > 0 ? `+${ms}ms` : `${ms}ms`}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
