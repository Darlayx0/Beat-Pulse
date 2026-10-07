import React, { useState } from 'react';
import {
  Volume2,
  Bell,
  Sliders,
  CheckCircle2,
  Play,
  VolumeX,
} from 'lucide-react';
import { audioEngine } from '../../../lib/audioEngine';

interface SubPageSoundEffectsProps {
  enableHitsounds: boolean;
  enableMetronome: boolean;
  onToggleHitsounds: () => void;
  onToggleMetronome: () => void;
  onClose: () => void;
}

export const SubPageSoundEffects: React.FC<SubPageSoundEffectsProps> = ({
  enableHitsounds,
  enableMetronome,
  onToggleHitsounds,
  onToggleMetronome,
}) => {
  const [hitsoundVol, setHitsoundVol] = useState<number>(() => {
    return Math.round(audioEngine.getSFXVolume() * 100);
  });
  const [metronomeVol, setMetronomeVol] = useState<number>(80);

  const handleHitsoundVolumeChange = (volPercent: number) => {
    setHitsoundVol(volPercent);
    audioEngine.setVolumes(audioEngine.getBGMVolume(), volPercent / 100);
  };

  const handleTestHitsound = (type: 'tap' | 'hold' | 'perfect' | 'holdEnd') => {
    audioEngine.playHitsound(type);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Bagian 1: Pengaturan Hitsound Nada */}
      <section className="space-y-4 pb-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <span>Efek Suara Ketukan (Hitsound)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bunyi respon instan saat note tersentuh playhead atau diketuk pada pad.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleHitsounds}
            className={`h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              enableHitsounds
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs'
            }`}
          >
            {enableHitsounds ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{enableHitsounds ? 'Hitsound Aktif' : 'Hitsound Nonaktif'}</span>
          </button>
        </div>

        {/* Volume Slider */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Volume Suara Hitsound</span>
            <span className="text-xs font-mono font-bold text-indigo-600">{hitsoundVol}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={hitsoundVol}
            onChange={(e) => handleHitsoundVolumeChange(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />

          {/* Test Hitsound Buttons */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500 mr-2 font-medium">Tes Dengar:</span>
            {(['tap', 'hold', 'perfect', 'holdEnd'] as const).map((hType) => (
              <button
                key={hType}
                type="button"
                onClick={() => handleTestHitsound(hType)}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border border-slate-200 shadow-xs"
              >
                <Play className="w-3 h-3 fill-current text-indigo-600" />
                <span className="capitalize">{hType === 'holdEnd' ? 'Hold End' : hType}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Bagian 2: Pengaturan Metronom */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>Bunyi Metronom Studio</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik ritmis otomatis setiap ketukan (beat) untuk membantu penyelarasan tempo linimasa.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleMetronome}
            className={`h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              enableMetronome
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs'
            }`}
          >
            {enableMetronome ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{enableMetronome ? 'Metronom Aktif' : 'Metronom Nonaktif'}</span>
          </button>
        </div>

        {/* Volume Metronom */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Volume Metronom</span>
            <span className="text-xs font-mono font-bold text-emerald-600">{metronomeVol}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={metronomeVol}
            onChange={(e) => setMetronomeVol(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />

          <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
            <button
              type="button"
              onClick={() => audioEngine.playHitsound('tap')}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border border-slate-200 shadow-xs"
            >
              <Play className="w-3 h-3 fill-current text-emerald-600" />
              <span>Tes Bunyi Tik Metronom</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
