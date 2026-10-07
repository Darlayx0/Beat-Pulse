import React from 'react';
import { Pause, Play, Heart, Flame } from 'lucide-react';
import { Song, Chart, GameStats } from '../../types';

interface GameplayHUDProps {
  song: Song;
  chart: Chart;
  stats: GameStats;
  isPaused: boolean;
  onTogglePause: () => void;
}

export const GameplayHUD: React.FC<GameplayHUDProps> = ({
  song,
  chart,
  stats,
  isPaused,
  onTogglePause,
}) => {
  return (
    <div className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
      {/* Song info */}
      <div className="min-w-0 flex-1">
        <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">{song.title}</h3>
        <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
          <span>{song.artist}</span>
          <span>•</span>
          <span className="text-cyan-400 font-bold">{chart.difficulty}</span>
        </p>
      </div>

      {/* Stats stats */}
      <div className="flex items-center gap-3 font-mono">
        {/* Score & Combo */}
        <div className="text-right">
          <div className="text-sm sm:text-lg font-black text-cyan-300">
            {stats.score.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-400 font-bold flex items-center justify-end gap-0.5">
            <Flame className="w-3 h-3 fill-amber-400" />
            <span>{stats.currentCombo}x</span>
          </div>
        </div>

        {/* Health bar */}
        <div className="hidden xs:flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-[10px] text-rose-400 font-bold">
            <Heart className="w-3 h-3 fill-rose-500" />
            <span>{Math.round(stats.health)}%</span>
          </div>
          <div className="w-16 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-emerald-400 transition-all duration-200"
              style={{ width: `${Math.max(0, Math.min(100, stats.health))}%` }}
            />
          </div>
        </div>

        {/* Pause button */}
        <button
          onClick={onTogglePause}
          className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl transition-all"
        >
          {isPaused ? <Play className="w-4 h-4 fill-current text-cyan-400" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
