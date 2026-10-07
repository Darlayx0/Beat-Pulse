import React, { useState, useRef } from 'react';
import {
  Music,
  Upload,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  RefreshCw,
  Clock,
  Radio,
} from 'lucide-react';
import { Song } from '../../../types';
import { audioEngine } from '../../../lib/audioEngine';
import { AudioService } from '../../../services/audioService';

interface SubPageAudioTrackProps {
  songs: Song[];
  selectedSongId: string;
  song: Song;
  audioBuffer: AudioBuffer | null;
  duration: number;
  onSelectSong: (songId: string) => void;
  onRelinkSongAudio?: (songId: string, audioFile: File) => Promise<void>;
  onClose: () => void;
}

export const SubPageAudioTrack: React.FC<SubPageAudioTrackProps> = ({
  songs,
  selectedSongId,
  song,
  audioBuffer,
  duration,
  onSelectSong,
  onRelinkSongAudio,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewPlaying, setPreviewPlaying] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) {
      setFeedback({
        type: 'error',
        message: 'Format berkas tidak didukung. Harap pilih berkas audio (MP3, WAV, OGG, atau M4A).',
      });
      return;
    }

    if (!onRelinkSongAudio) {
      setFeedback({
        type: 'error',
        message: 'Fungsi rekoneksi audio tidak tersedia pada sesi ini.',
      });
      return;
    }

    setIsProcessing(true);
    setFeedback({
      type: 'info',
      message: `Sedang memproses dan mendekode audio "${file.name}"...`,
    });

    try {
      await onRelinkSongAudio(song.id, file);
      setFeedback({
        type: 'success',
        message: `Audio "${file.name}" berhasil dihubungkan! Semua chart, bpm, dan note tetap aman utuh.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Gagal menghubungkan berkas audio baru.',
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTogglePreview = () => {
    if (previewPlaying) {
      AudioService.pauseBGM();
      setPreviewPlaying(false);
    } else {
      if (audioBuffer) {
        AudioService.loadBuffer(audioBuffer);
      }
      AudioService.playBGM(0);
      setPreviewPlaying(true);
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

      {/* Bagian 1: Status Audio Aktif */}
      <section className="space-y-3 pb-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Music className="w-4 h-4 text-indigo-600" />
              <span>Status Audio Trek Aktif</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Informasi buffer memori dan decoding audio untuk lagu terpilih saat ini.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTogglePreview}
            disabled={!audioBuffer && !song.audioUrl}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              previewPlaying
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-xs'
            }`}
          >
            {previewPlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Pratinjau</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Tes Audio</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 block">Judul Trek</span>
            <span className="text-sm font-bold text-slate-900 truncate block mt-0.5">
              {song.title}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 block">Artis</span>
            <span className="text-sm font-bold text-slate-900 truncate block mt-0.5">
              {song.artist}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 block">Durasi Audio</span>
            <span className="text-sm font-bold text-indigo-600 block mt-0.5 font-mono">
              {formatTime(duration)} ({duration.toFixed(1)}s)
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 block">Status Buffer</span>
            <span className="text-sm font-bold block mt-0.5 flex items-center gap-1.5">
              {audioBuffer ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-700">Siap ({audioBuffer.sampleRate}Hz)</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-amber-700">Streaming / Web</span>
                </>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Bagian 2: Hubungkan Ulang Berkas Audio */}
      <section className="space-y-3 pb-6 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-sky-600" />
            <span>Hubungkan Ulang / Ganti Berkas Audio</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Unggah berkas audio lokal baru untuk memperbarui trek lagu ini. Semua chart, bpm, dan ketukan yang sudah dibuat akan dipertahankan sepenuhnya.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleAudioFileChange}
        />

        <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 transition-colors bg-white text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
            <Upload className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800">
              Pilih berkas audio baru (.mp3, .wav, .ogg, .m4a)
            </p>
            <p className="text-xs text-slate-500">
              Koneksi instan dengan decoding otomatis ke penyimpanan lokal browser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isProcessing ? 'Mendekode Audio...' : 'Pilih Berkas Audio Lokal'}
          </button>
        </div>
      </section>

      {/* Bagian 3: Ganti Trek Lagu Lain */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-violet-600" />
            <span>Pilih Trek Lagu Lain di Editor</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Alihkan sesi pengeditan ke lagu lain yang tersimpan di perpustakaan BeatPulse.
          </p>
        </div>

        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {songs.map((s) => {
            const isCurrent = s.id === selectedSongId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSong(s.id)}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs ${
                  isCurrent
                    ? 'bg-indigo-50/90 border-indigo-300 ring-1 ring-indigo-300'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                    style={{ backgroundColor: s.coverColor || '#4f46e5' }}
                  >
                    <Music className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-bold truncate ${isCurrent ? 'text-indigo-950' : 'text-slate-900'}`}>
                      {s.title}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {s.artist} • {s.bpm} BPM
                    </div>
                  </div>
                </div>

                {isCurrent && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                    Aktif
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
