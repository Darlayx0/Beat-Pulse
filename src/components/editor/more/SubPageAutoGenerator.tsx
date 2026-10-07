import React, { useState } from 'react';
import {
  Sparkles,
  Wand2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layers,
  Radio,
} from 'lucide-react';
import { Song, DifficultyLevel, Note } from '../../../types';
import { detectBpmAndPeaks, generateAutoChart } from '../../../lib/beatDetector';
import { audioEngine } from '../../../lib/audioEngine';

interface SubPageAutoGeneratorProps {
  song: Song;
  selectedDifficulty: DifficultyLevel;
  audioBuffer: AudioBuffer | null;
  bpm: number;
  notes: Note[];
  isLocked: boolean;
  isPreset: boolean;
  onUpdateNotes: (notes: Note[]) => void;
  onUpdateBpm: (bpm: number) => void;
  onUpdateOffset: (offset: number) => void;
  onClose: () => void;
}

export const SubPageAutoGenerator: React.FC<SubPageAutoGeneratorProps> = ({
  song,
  selectedDifficulty,
  audioBuffer,
  bpm,
  notes,
  isLocked,
  isPreset,
  onUpdateNotes,
  onUpdateBpm,
  onUpdateOffset,
}) => {
  const [density, setDensity] = useState<DifficultyLevel>(selectedDifficulty);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleRunGenerator = async () => {
    if (isLocked || isPreset) return;
    if (!audioBuffer) {
      setFeedback({
        type: 'error',
        message: 'AudioBuffer belum dimuat. Tidak dapat menganalisis transien audio lagu.',
      });
      return;
    }

    setIsGenerating(true);
    setFeedback({
      type: 'info',
      message: 'Sedang menganalisis transien ritme audio & membangkitkan pola nada otomatis...',
    });

    try {
      const analysis = await detectBpmAndPeaks(audioBuffer);
      if (analysis.bpm && Math.abs(analysis.bpm - bpm) > 5) {
        onUpdateBpm(analysis.bpm);
        if (analysis.offset !== undefined) {
          onUpdateOffset(Math.round(analysis.offset * 1000));
        }
      }

      const chartResult = generateAutoChart(
        'auto_gen',
        audioBuffer.duration,
        analysis,
        density,
        {
          preset: 'balanced',
          includeHolds: true,
        }
      );

      const generatedNotes = chartResult.notes || [];

      if (generatedNotes.length === 0) {
        throw new Error('Tidak ada note yang dapat dihasilkan dari audio ini.');
      }

      if (mode === 'replace') {
        onUpdateNotes(generatedNotes);
        audioEngine.playHitsound('perfect');
        setFeedback({
          type: 'success',
          message: `Berhasil membangkitkan ${generatedNotes.length} note baru tingkat ${density}!`,
        });
      } else {
        // Merge mode: avoid identical timestamps
        const existingTimes = new Set(notes.map((n) => `${n.lane}_${n.time.toFixed(2)}`));
        const nonConflicting = generatedNotes.filter((n) => !existingTimes.has(`${n.lane}_${n.time.toFixed(2)}`));
        const combined = [...notes, ...nonConflicting].sort((a, b) => a.time - b.time);
        onUpdateNotes(combined);
        audioEngine.playHitsound('perfect');
        setFeedback({
          type: 'success',
          message: `Berhasil menggabungkan ${nonConflicting.length} note baru ke dalam partitur!`,
        });
      }
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: e?.message || 'Gagal membangkitkan chart secara otomatis.',
      });
    } finally {
      setIsGenerating(false);
    }
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
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
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
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-violet-600" />
          <span>Generator Nada Otomatis (Auto Chart Engine)</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Memanfaatkan detektor transien audio berbasis frekuensi untuk menyusun partitur ritmis secara instan.
        </p>
      </div>

      {/* Pengaturan Densitas */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
        <span className="text-xs font-bold text-slate-800 block">Pilih Densitas Ketukan:</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(['Easy', 'Medium', 'Hard', 'Expert'] as const).map((diff) => (
            <button
              key={diff}
              type="button"
              onClick={() => setDensity(diff)}
              className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                density === diff
                  ? 'bg-violet-50 border-violet-400 text-violet-900 font-bold ring-1 ring-violet-300 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="text-sm font-bold">{diff}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {diff === 'Easy'
                  ? 'Ritme santai (1/1 beat)'
                  : diff === 'Medium'
                  ? 'Ritme sedang (1/2 beat)'
                  : diff === 'Hard'
                  ? 'Kerapatan tinggi (1/4 beat)'
                  : 'Sangat rapat (1/8 beat)'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mode Penggabungan */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
        <span className="text-xs font-bold text-slate-800 block">Mode Penempatan Partitur:</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('replace')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              mode === 'replace'
                ? 'bg-violet-50/90 border-violet-400 text-slate-900 ring-1 ring-violet-300 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs font-bold text-rose-600">Timpa Partitur Lama (Replace)</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Hapus semua {notes.length} note yang ada saat ini dan gantikan dengan hasil generasi baru.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('merge')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              mode === 'merge'
                ? 'bg-violet-50/90 border-violet-400 text-slate-900 ring-1 ring-violet-300 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs font-bold text-emerald-700">Gabungkan (Merge)</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Pertahankan note yang ada dan tambahkan note baru pada ketukan yang kosong.
            </div>
          </button>
        </div>
      </div>

      {/* Eksekusi Generator */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-4 shadow-xs">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-900 block">
            Analisis AudioBuffer & Ritme
          </span>
          <p className="text-xs text-slate-500">
            {audioBuffer
              ? `Buffer terhubung (${audioBuffer.duration.toFixed(1)}s, ${audioBuffer.sampleRate}Hz). Siap membangkitkan nada.`
              : 'Buffer audio tidak ditemukan. Pastikan audio terhubung dengan baik.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunGenerator}
          disabled={!audioBuffer || isGenerating || isLocked}
          className="h-11 px-6 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Bangkitkan Note Otomatis</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
