import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { Note } from '../../../types';
import { audioEngine } from '../../../lib/audioEngine';

interface SubPageClearNotesProps {
  notes: Note[];
  isLocked: boolean;
  isPreset: boolean;
  onUpdateNotes: (notes: Note[]) => void;
  onClose: () => void;
}

export const SubPageClearNotes: React.FC<SubPageClearNotesProps> = ({
  notes,
  isLocked,
  isPreset,
  onUpdateNotes,
}) => {
  const [confirmText, setConfirmText] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notesCount = notes.length;

  const handleExecuteClear = () => {
    if (isLocked || isPreset) return;
    if (confirmText.trim().toUpperCase() !== 'HAPUS') {
      setFeedback({
        type: 'error',
        message: 'Ketik kata konfirmasi "HAPUS" dengan tepat untuk mengeksekusi.',
      });
      return;
    }

    onUpdateNotes([]);
    audioEngine.playHitsound('perfect');
    setConfirmText('');
    setFeedback({
      type: 'success',
      message: `Semua ${notesCount} note pada slot ini telah dihapus. Aksi ini dapat dibatalkan melalui tombol Undo jika tidak disengaja.`,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-sm font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
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

      <div>
        <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          <span>Pembersihan Partitur (Hapus Semua Note)</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Tindakan destruktif untuk mengosongkan seluruh isi bagan nada pada tingkat kesulitan aktif saat ini.
        </p>
      </div>

      {/* Warning Box */}
      <div className="p-5 rounded-3xl bg-rose-50/80 border border-rose-200 space-y-4 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-900">
              Peringatan Tindakan Berisiko Tinggi
            </h4>
            <p className="text-xs text-rose-800/90 leading-relaxed">
              Anda akan menghapus sebanyak <span className="font-bold font-mono text-rose-950 underline">{notesCount} note</span> dari linimasa. 
              Meskipun aksi ini dapat dibatalkan sementara menggunakan riwayat Undo, penyimpanan permanen akan mengosongkan chart ini.
            </p>
          </div>
        </div>

        {/* Form Konfirmasi Ketik */}
        <div className="pt-2 space-y-3 border-t border-rose-200">
          <label className="text-xs text-slate-700 block font-bold">
            Ketik kata <span className="text-rose-600 font-mono tracking-wider font-extrabold">HAPUS</span> di bawah ini untuk mengonfirmasi:
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              placeholder="Ketik HAPUS..."
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={notesCount === 0 || isLocked}
              className="w-48 bg-white px-3.5 py-2 rounded-xl border border-rose-300 text-sm font-mono text-slate-900 uppercase placeholder:text-slate-400 outline-none focus:border-rose-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleExecuteClear}
              disabled={confirmText.trim().toUpperCase() !== 'HAPUS' || notesCount === 0 || isLocked}
              className="h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Semua ({notesCount} Note)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
