import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface EditorTransportProps {
  currentTime: number;
  duration: number;
  bpm: number;
  offset: number;
  isPlaying: boolean;
  playbackSpeed?: number;
  zoomScale: number;
  snapDivision: number;
  enableHitsounds?: boolean;
  enableMetronome?: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onStepPlayhead: (direction: -1 | 1) => void;
  onJumpToPrevNote: () => void;
  onJumpToNextNote: () => void;
  onChangePlaybackSpeed?: (speed: number) => void;
  onChangeZoom: (delta: number) => void;
  onResetZoom: () => void;
  onToggleHitsounds?: () => void;
  onToggleMetronome?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  historyIndex?: number;
  historyLength?: number;
  isLocked?: boolean;
  isPreset?: boolean;
  canvasHeightMode?: 'normal' | 'large';
  onToggleCanvasHeightMode?: () => void;
}

export const EditorTransport: React.FC<EditorTransportProps> = ({
  currentTime,
  duration,
  bpm,
  offset,
  isPlaying,
  zoomScale,
  snapDivision,
  onTogglePlay,
  onSeek,
  onStepPlayhead,
  onJumpToPrevNote,
  onJumpToNextNote,
  onChangeZoom,
  onResetZoom,
  onUndo,
  onRedo,
  historyIndex = 0,
  historyLength = 1,
  isLocked = false,
  isPreset = false,
  canvasHeightMode = 'normal',
  onToggleCanvasHeightMode,
}) => {
  // Format MM:SS.ms (e.g., 01:23.450)
  const formatTimecode = (seconds: number) => {
    const s = Math.max(0, isNaN(seconds) || !isFinite(seconds) ? 0 : seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Calculate Bar & Beat position
  const beatSec = 60 / (bpm || 120);
  const safeTime = isNaN(currentTime) || !isFinite(currentTime) ? 0 : currentTime;
  const totalBeats = Math.max(0, safeTime / beatSec);
  const currentBar = Math.floor(totalBeats / 4) + 1;
  const currentBeatInBar = (totalBeats % 4) + 1;

  const undoAvailable = historyIndex > 0;
  const redoAvailable = historyIndex < historyLength - 1;
  const safeDuration = Math.max(0.1, isNaN(duration) || !isFinite(duration) ? 60 : duration);
  const progressPercent = Math.min(100, Math.max(0, (safeTime / safeDuration) * 100));

  return (
    <div
      id="editor-transport-chassis"
      className="relative bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 text-slate-900 shadow-sm ring-1 ring-slate-950/5 space-y-2"
    >
      {/* =========================================================================
          1. TOP DECK: SEBARIS (TIMECODE DIGITAL LED DI KIRI & PELACAK BIRAMA DI KANAN)
      ========================================================================= */}
      <div className="space-y-1.5">
        {/* Single Balanced Row: Timecode (Left) & Bar/Beat Coordinates + Snap (Right) */}
        <div className="flex items-center justify-between gap-2">
          {/* Left Corner: Studio LED Digital Clock Timecode Kristal Kontras Tinggi */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 shadow-xs font-mono text-xs tabular-nums">
            <span className="font-black text-indigo-700 tracking-wider">
              {formatTimecode(safeTime)}
            </span>
            <span className="text-slate-400 font-bold">/</span>
            <span className="text-slate-600 text-xs font-bold tracking-wider">
              {formatTimecode(safeDuration)}
            </span>
          </div>

          {/* Right Corner: Pelacak Koordinat Birama & Ketukan */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-indigo-700 font-mono text-xs font-bold shadow-xs whitespace-nowrap tabular-nums">
              <span className="tracking-wide">BAR {currentBar}</span>
              <span className="text-indigo-400 font-black">•</span>
              <span className="tracking-wide">BEAT {currentBeatInBar.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SCRUBBER LINIMASA INTERAKTIF REALTIME DENGAN TITIK POIN BESAR
        ========================================================================= */}
        <div className="relative flex items-center group py-1.5 cursor-pointer touch-none">
          {/* Background Track */}
          <div className="w-full h-2.5 sm:h-3 bg-slate-100 rounded-full border border-slate-200 overflow-hidden shadow-xs relative pointer-events-none">
            {/* Real-time Progress Bar Fill (Instantaneous 60fps tracking without CSS delay) */}
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-600 relative rounded-full will-change-transform"
              style={{ width: `${progressPercent}%` }}
            >
              {/* Luminous Glow Edge */}
              <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/60 blur-[1px]" />
            </div>
          </div>

          {/* Titik Poin Besar Posisi Terakhir Progress (Glow Playhead Pin Knob) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-20 will-change-transform"
            style={{ left: `${progressPercent}%` }}
          >
            <div className="relative flex items-center justify-center">
              {/* Outer soft glowing aura */}
              <div
                className={`absolute w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-500/20 blur-xs ${
                  isPlaying ? 'animate-pulse opacity-100' : 'opacity-70'
                }`}
              />
              {/* Large Indicator Knob Point */}
              <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-white border-2 border-indigo-600 shadow-md ring-2 ring-indigo-300/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-600" />
              </div>
            </div>
          </div>

          {/* Interactive Range Input for Realtime Scrubbing and Dragging */}
          <input
            id="timeline-audio-scrubber-slider"
            type="range"
            min={0}
            max={safeDuration}
            step={0.001}
            value={safeTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Seek linimasa audio"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30 appearance-none bg-transparent m-0 p-0"
          />
        </div>
      </div>

      {/* =========================================================================
          2. MASTER TRANSPORT PLAYBACK CONTROLS (PUSAT PEMUTARAN SIMETRIS)
      ========================================================================= */}
      <div className="flex items-center justify-center gap-2 sm:gap-2.5 py-0.5">
        {/* 1. Jump to Previous Note (Jauh: Lompat Antar Note) */}
        <button
          type="button"
          onClick={onJumpToPrevNote}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-700 hover:text-sky-900 border border-sky-200 transition-all flex items-center justify-center cursor-pointer shadow-xs"
          title="Lompat Jauh: Ke Note Sebelumnya (Pintas: Q)"
        >
          <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600" />
        </button>

        {/* 2. Step Backward Snap Beat (Sedikit: Mundur Sesuai Garis Nada Terpilih) */}
        <button
          type="button"
          onClick={() => onStepPlayhead(-1)}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all flex items-center justify-center cursor-pointer shadow-xs"
          title="Mundur Sesuai Garis Jarak Nada (Pintas: Panah Kiri)"
        >
          <ChevronLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-700" />
        </button>

        {/* 3. HERO CENTERPIECE: MASTER PLAY / PAUSE BUTTON */}
        <button
          type="button"
          onClick={onTogglePlay}
          className={`px-6 sm:px-8 py-2 min-h-[38px] sm:min-h-[40px] rounded-xl font-black text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer ${
            isPlaying
              ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-400/25 ring-2 ring-amber-400/50'
              : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/25 ring-1 ring-indigo-400/30'
          }`}
          title="Putar / Jeda Audio (Spasi)"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              <span>JEDA</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />
              <span>PUTAR</span>
            </>
          )}
        </button>

        {/* 4. Step Forward Snap Beat (Sedikit: Maju Sesuai Garis Nada Terpilih) */}
        <button
          type="button"
          onClick={() => onStepPlayhead(1)}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all flex items-center justify-center cursor-pointer shadow-xs"
          title="Maju Sesuai Garis Jarak Nada (Pintas: Panah Kanan)"
        >
          <ChevronRight className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-700" />
        </button>

        {/* 5. Jump to Next Note (Jauh: Lompat Antar Note) */}
        <button
          type="button"
          onClick={onJumpToNextNote}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-700 hover:text-sky-900 border border-sky-200 transition-all flex items-center justify-center cursor-pointer shadow-xs"
          title="Lompat Jauh: Ke Note Berikutnya (Pintas: W)"
        >
          <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600" />
        </button>
      </div>

      {/* =========================================================================
          3. ALAT BILAH BAWAH: 1 BARIS BERSIH & RESPONSIF
      ========================================================================= */}
      <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-slate-200 py-0.5 overflow-x-auto no-scrollbar">
        {/* BAGIAN KIRI: ULANGI DARI AWAL */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onSeek(0)}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs text-xs font-bold whitespace-nowrap"
            title="Ulangi dari Awal Lagu 00:00 (Home)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-700" />
            <span className="hidden sm:inline text-[11px]">Ulangi</span>
          </button>
        </div>

        {/* BAGIAN TENGAH: RIWAYAT UNDO & REDO DENGAN INDIKATOR STATUS JELAS */}
        {onUndo && onRedo && (
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200 shadow-xs flex-shrink-0">
            <button
              type="button"
              disabled={!undoAvailable || isPreset || isLocked}
              onClick={onUndo}
              className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                undoAvailable && !isPreset && !isLocked
                  ? 'bg-white hover:bg-slate-50 active:scale-95 text-amber-800 border border-amber-300 shadow-xs'
                  : 'text-slate-400 cursor-not-allowed opacity-30'
              }`}
              title="Undo (Ctrl+Z) - Urungkan perubahan terakhir"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Undo</span>
              {undoAvailable && (
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                  {historyIndex}
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={!redoAvailable || isPreset || isLocked}
              onClick={onRedo}
              className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                redoAvailable && !isPreset && !isLocked
                  ? 'bg-white hover:bg-slate-50 active:scale-95 text-sky-800 border border-sky-300 shadow-xs'
                  : 'text-slate-400 cursor-not-allowed opacity-30'
              }`}
              title="Redo (Ctrl+Y / Ctrl+Shift+Z) - Ulangi perubahan"
            >
              <span className="hidden sm:inline text-[11px]">Redo</span>
              <Redo2 className="w-3.5 h-3.5" />
              {redoAvailable && (
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-200 font-bold">
                  {historyLength - 1 - historyIndex}
                </span>
              )}
            </button>
          </div>
        )}

        {/* BAGIAN KANAN: KANVAS HEIGHT & ZOOM LINIMASA */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Canvas Height Mode Toggle */}
          {onToggleCanvasHeightMode && (
            <button
              type="button"
              onClick={onToggleCanvasHeightMode}
              className="h-8 sm:h-9 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold text-xs cursor-pointer border border-slate-200 transition-colors shadow-xs whitespace-nowrap"
              title="Ubah Ukuran Tinggi Canvas Editor"
            >
              {canvasHeightMode === 'normal' ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline text-[11px]">Perbesar</span>
                </>
              ) : (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline text-[11px]">Normal</span>
                </>
              )}
            </button>
          )}

          {/* Timeline Zoom Stepper */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-0.5 border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => onChangeZoom(-15)}
              className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 active:scale-95 cursor-pointer transition-colors"
              title="Perkecil Zoom Linimasa (-15px)"
            >
              <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={onResetZoom}
              className="px-2 py-1 rounded-lg font-mono font-bold text-[10px] sm:text-[11px] text-indigo-700 hover:text-indigo-900 cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap"
              title="Reset Zoom Linimasa (90px/detik)"
            >
              {zoomScale}px/s
            </button>
            <button
              type="button"
              onClick={() => onChangeZoom(15)}
              className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 active:scale-95 cursor-pointer transition-colors"
              title="Perbesar Zoom Linimasa (+15px)"
            >
              <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
