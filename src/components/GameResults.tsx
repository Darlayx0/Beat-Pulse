import React, { useState, useEffect } from 'react';
import { Trophy, RotateCcw, Music, Edit3, Award, Sparkles, CheckCircle, BarChart2, User, Zap } from 'lucide-react';
import { Song, Chart, GameStats, UserProfile } from '../types';
import { authService } from '../services/authService';

interface GameResultsProps {
  song: Song;
  chart: Chart;
  stats: GameStats;
  onRetry: () => void;
  onBackToLibrary: () => void;
  onEditChart: () => void;
}

export const GameResults: React.FC<GameResultsProps> = ({
  song,
  chart,
  stats,
  onRetry,
  onBackToLibrary,
  onEditChart,
}) => {
  const [profile, setProfile] = useState<UserProfile>(authService.getCurrentProfile());

  useEffect(() => {
    setProfile(authService.getCurrentProfile());
  }, []);

  // Calculate Grade
  let grade: 'S+' | 'S' | 'A' | 'B' | 'C' | 'F' = 'F';
  if (stats.accuracy >= 98 && stats.missCount === 0) grade = 'S+';
  else if (stats.accuracy >= 95) grade = 'S';
  else if (stats.accuracy >= 90) grade = 'A';
  else if (stats.accuracy >= 80) grade = 'B';
  else if (stats.accuracy >= 70) grade = 'C';

  const expGained = Math.round((stats.score / 1000) * (stats.accuracy / 100));

  const getGradeStyle = (g: string) => {
    switch (g) {
      case 'S+':
        return 'from-amber-300 via-yellow-400 to-amber-600 text-slate-950 shadow-amber-500/30';
      case 'S':
        return 'from-purple-400 via-indigo-500 to-indigo-700 text-white shadow-indigo-500/30';
      case 'A':
        return 'from-cyan-400 via-blue-500 to-blue-700 text-white shadow-cyan-500/30';
      case 'B':
        return 'from-emerald-400 via-teal-500 to-teal-700 text-white shadow-teal-500/30';
      case 'C':
        return 'from-orange-400 via-amber-500 to-amber-700 text-white shadow-amber-500/30';
      default:
        return 'from-rose-500 via-red-600 to-slate-800 text-white shadow-rose-500/30';
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-8">
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6 sm:space-y-8 relative overflow-hidden text-slate-900">
        {/* Glow Header Background */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Title & Song Info */}
        <div className="text-center space-y-1.5 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-mono uppercase font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Hasil Permainan ({chart.difficulty})</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{song.title}</h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">{song.artist}</p>
        </div>

        {/* Player Profile Result Strip */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={profile.avatarUrl}
                alt={profile.username}
                className="w-10 h-10 rounded-xl object-cover bg-slate-900 ring-2 ring-indigo-500/30"
              />
              <div className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-indigo-600 text-white font-mono text-[8px] font-black rounded">
                Lv.{profile.level}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900">{profile.username}</span>
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.2 rounded-md">
                  {profile.title}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Penyimpanan profil: <span className="text-emerald-600 font-semibold">Firestore Optimized</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold font-mono">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>+{expGained} EXP</span>
          </div>
        </div>

        {/* Big Grade Badge & Main Score */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4 border-y border-slate-200/80">
          {/* Grade Badge */}
          <div
            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br ${getGradeStyle(
              grade
            )} font-black text-5xl sm:text-6xl flex items-center justify-center shadow-xl tracking-tighter border border-white/20 scale-105`}
          >
            {grade}
          </div>

          <div className="space-y-2.5 text-center sm:text-left">
            <div>
              <p className="text-[10px] uppercase font-mono text-slate-500 font-bold">Total Skor</p>
              <p className="text-3xl sm:text-4xl font-black font-mono text-slate-900 tracking-wider">
                {stats.score.toLocaleString()}
              </p>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-5 font-mono text-xs sm:text-sm">
              <div>
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Akurasi</p>
                <p className="font-bold text-indigo-600">{(stats?.accuracy ?? 0).toFixed(2)}%</p>
              </div>
              <div className="w-px h-7 bg-slate-200" />
              <div>
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Max Combo</p>
                <p className="font-bold text-indigo-600">{stats?.maxCombo ?? 0}x</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-[10px] font-mono uppercase text-amber-600 font-bold">PERFECT</p>
            <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 mt-0.5">
              {stats?.perfectCount ?? 0}
            </p>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-[10px] font-mono uppercase text-cyan-600 font-bold">GREAT</p>
            <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 mt-0.5">
              {stats?.greatCount ?? 0}
            </p>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-[10px] font-mono uppercase text-emerald-600 font-bold">GOOD</p>
            <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 mt-0.5">
              {stats?.goodCount ?? 0}
            </p>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-[10px] font-mono uppercase text-rose-600 font-bold">MISS</p>
            <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 mt-0.5">
              {stats?.missCount ?? 0}
            </p>
          </div>
        </div>

        {/* Timing Offset Histogram Visualizer */}
        {Array.isArray(stats?.timingOffsets) && stats.timingOffsets.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono text-slate-600 gap-1">
              <span className="flex items-center gap-1.5 font-semibold">
                <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
                Distribusi Ketukan (Hit Timing)
              </span>
              <span>Rata-rata: {(stats.timingOffsets.reduce((a, b) => a + b, 0) / (stats.timingOffsets.length || 1)).toFixed(1)}ms</span>
            </div>

            <div className="h-14 flex items-end justify-center gap-1 pt-1">
              {Array.from({ length: 15 }).map((_, i) => {
                const binStart = -75 + i * 10;
                const binEnd = binStart + 10;
                const count = stats.timingOffsets.filter((o) => o >= binStart && o < binEnd).length;
                const maxBinCount = Math.max(1, ...Array.from({ length: 15 }).map((_, idx) => {
                  const bS = -75 + idx * 10;
                  return stats.timingOffsets.filter((o) => o >= bS && o < bS + 10).length;
                }));
                const heightPercent = (count / maxBinCount) * 100;
                const isCenter = i === 7;

                return (
                  <div
                    key={i}
                    className="flex-1 max-w-[12px] bg-slate-200 rounded-t overflow-hidden relative group"
                    title={`${binStart}ms to ${binEnd}ms: ${count} hits`}
                  >
                    <div
                      className={`w-full transition-all ${
                        isCenter ? 'bg-indigo-600' : Math.abs(i - 7) <= 2 ? 'bg-indigo-400' : 'bg-slate-400'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            onClick={onRetry}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Main Lagi</span>
          </button>

          <button
            onClick={onEditChart}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 font-semibold text-xs border border-indigo-200 flex items-center justify-center gap-2 transition-all"
          >
            <Edit3 className="w-4 h-4 text-indigo-600" />
            <span>Edit Chart Lagu</span>
          </button>

          <button
            onClick={onBackToLibrary}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center justify-center gap-2 transition-all"
          >
            <Music className="w-4 h-4" />
            <span>Pilih Lagu Lain</span>
          </button>
        </div>
      </div>
    </div>
  );
};


