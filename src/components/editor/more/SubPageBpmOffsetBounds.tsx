import React, { useState } from 'react';
import {
  Activity,
  Clock,
  Sliders,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Volume2,
} from 'lucide-react';
import { Song, Note } from '../../../types';
import { detectBpmAndPeaks } from '../../../lib/beatDetector';
import { audioEngine } from '../../../lib/audioEngine';

interface SubPageBpmOffsetBoundsProps {
  song: Song;
  bpm: number;
  offset: number;
  duration: number;
  audioBuffer: AudioBuffer | null;
  notes: Note[];
  isLocked: boolean;
  onUpdateBpm: (bpm: number) => void;
  onUpdateOffset: (offset: number) => void;
  onUpdateDuration: (duration: number) => void;
  onClose: () => void;
}

export const SubPageBpmOffsetBounds: React.FC<SubPageBpmOffsetBoundsProps> = ({
  song,
  bpm,
  offset,
  duration,
  audioBuffer,
  isLocked,
  onUpdateBpm,
  onUpdateOffset,
  onUpdateDuration,
}) => {
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleTap = () => {
    const now = performance.now();
    audioEngine.playHitsound('tap');
    const newTimes = [...tapTimes.filter((t) => now - t < 3000), now];
    setTapTimes(newTimes);

    if (newTimes.length > 2) {
      const intervals: number[] = [];
      for (let i = 1; i < newTimes.length; i++) {
        intervals.push(newTimes[i] - newTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round((60000 / avgInterval) * 10) / 10;
      setTapBpm(calculatedBpm);
    }
  };

  const handleApplyTapBpm = () => {
    if (tapBpm && tapBpm >= 40 && tapBpm <= 400) {
      onUpdateBpm(tapBpm);
      setFeedback({ type: 'success', message: `BPM berhasil disetel ke ${tapBpm} berdasarkan Tap Tempo!` });
    }
  };

  const handleDetectBpm = async () => {
    if (!audioBuffer) {
      setFeedback({ type: 'error', message: 'AudioBuffer belum dimuat. Tidak dapat menjalankan analisis audio.' });
      return;
    }
    setIsDetecting(true);
    try {
      const result = await detectBpmAndPeaks(audioBuffer);
      if (result && result.bpm > 0) {
        onUpdateBpm(result.bpm);
        if (result.offset !== undefined) {
          onUpdateOffset(Math.round(result.offset * 1000));
        }
        setFeedback({
          type: 'success',
          message: `Analisis AI berhasil! Terdeteksi BPM: ${result.bpm}, Offset: ${Math.round((result.offset || 0) * 1000)}ms.`,
        });
      } else {
        setFeedback({ type: 'error', message: 'Tidak dapat mendeteksi ketukan ritme audio secara akurat.' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Gagal menganalisis audio.' });
    } finally {
      setIsDetecting(false);
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
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
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

      {/* Bagian 1: Kalibrasi BPM */}
      <section className="space-y-4 pb-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-600" />
              <span>Kalibrasi Tempo (BPM)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tentukan kecepatan ketukan dasar lagu untuk mengatur grid snapping dan ritme timeline.
            </p>
          </div>
          {audioBuffer && (
            <button
              type="button"
              onClick={handleDetectBpm}
              disabled={isDetecting || isLocked}
              className="h-8 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isDetecting ? 'Menganalisis...' : 'Deteksi AI'}</span>
            </button>
          )}
        </div>

        {/* Input BPM Utama & Stepper */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div>
            <span className="text-xs text-slate-500 block">Tempo Aktif</span>
            <div className="text-3xl font-black text-slate-900 font-mono flex items-baseline gap-1 mt-0.5">
              <span>{bpm.toFixed(1)}</span>
              <span className="text-xs text-slate-500 font-sans font-bold">BPM</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateBpm(Math.max(20, Number((bpm - 1).toFixed(1))))}
              disabled={isLocked}
              className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold text-sm flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-xs"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => onUpdateBpm(Math.max(20, Number((bpm - 0.1).toFixed(1))))}
              disabled={isLocked}
              className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold text-sm flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-xs"
            >
              -0.1
            </button>
            <button
              type="button"
              onClick={() => onUpdateBpm(Math.min(400, Number((bpm + 0.1).toFixed(1))))}
              disabled={isLocked}
              className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold text-sm flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-xs"
            >
              +0.1
            </button>
            <button
              type="button"
              onClick={() => onUpdateBpm(Math.min(400, Number((bpm + 1).toFixed(1))))}
              disabled={isLocked}
              className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold text-sm flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-xs"
            >
              +1
            </button>
          </div>
        </div>

        {/* Tap Tempo Area */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-800">Tap Tempo Manual</span>
            <p className="text-xs text-slate-500">
              Ketuk tombol ini secara teratur mengikuti irama lagu untuk menghitung BPM secara otomatis.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {tapBpm && (
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Hasil Ketukan:</span>
                <span className="text-base font-black text-rose-600 font-mono">{tapBpm} BPM</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleTap}
              className="h-11 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shadow-sm"
            >
              TAP TEMPO
            </button>
            {tapBpm && (
              <button
                type="button"
                onClick={handleApplyTapBpm}
                disabled={isLocked}
                className="h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
              >
                Terapkan
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Bagian 2: Kalibrasi Offset Lagu */}
      <section className="space-y-4 pb-6 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-600" />
            <span>Kalibrasi Offset Audio (Milidetik)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Geser titik awal ketukan pertama (beat 1) agar sinkron persis dengan audio lagu.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div>
            <span className="text-xs text-slate-500 block">Offset Saat Ini</span>
            <div className="text-3xl font-black text-sky-600 font-mono flex items-baseline gap-1 mt-0.5">
              <span>{offset > 0 ? `+${offset}` : offset}</span>
              <span className="text-xs text-slate-500 font-sans font-bold">ms</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              ({(offset / 1000).toFixed(3)} detik)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateOffset(offset - 50)}
              disabled={isLocked}
              className="px-2.5 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold text-xs flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-xs"
            >
              -50ms
            </button>
            <button
              type="button"
              onClick={() => onUpdateOffset(offset - 10)}
              disabled={isLocked}
              className="px-2.5 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold text-xs flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-xs"
            >
              -10ms
            </button>
            <button
              type="button"
              onClick={() => onUpdateOffset(0)}
              disabled={isLocked}
              className="px-3 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 font-bold text-xs flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-xs"
            >
              Reset 0
            </button>
            <button
              type="button"
              onClick={() => onUpdateOffset(offset + 10)}
              disabled={isLocked}
              className="px-2.5 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold text-xs flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-xs"
            >
              +10ms
            </button>
            <button
              type="button"
              onClick={() => onUpdateOffset(offset + 50)}
              disabled={isLocked}
              className="px-2.5 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold text-xs flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-xs"
            >
              +50ms
            </button>
          </div>
        </div>
      </section>

      {/* Bagian 3: Batas Akhir Lagu & Durasi */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Batas Akhir Lagu & Durasi Timeline</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur batas total durasi linimasa lagu untuk mencegah chart bergulir melebihi akhir lagu.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div>
            <span className="text-xs text-slate-500 block">Durasi Efektif</span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
              {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}.{Math.floor((duration % 1) * 10)}
              <span className="text-xs text-slate-500 font-sans font-bold ml-1.5">
                ({duration.toFixed(1)} detik)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {audioBuffer && (
              <button
                type="button"
                onClick={() => {
                  onUpdateDuration(Number(audioBuffer.duration.toFixed(1)));
                  setFeedback({ type: 'success', message: `Durasi diselaraskan dengan panjang file audio (${audioBuffer.duration.toFixed(1)}s)!` });
                }}
                className="h-10 px-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Samakan dengan Audio ({audioBuffer.duration.toFixed(1)}s)
              </button>
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onUpdateDuration(Math.max(10, Number((duration - 5).toFixed(1))))}
                className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs cursor-pointer shadow-xs"
              >
                -5s
              </button>
              <button
                type="button"
                onClick={() => onUpdateDuration(Math.min(900, Number((duration + 5).toFixed(1))))}
                className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs cursor-pointer shadow-xs"
              >
                +5s
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
