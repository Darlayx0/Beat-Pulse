import React from 'react';
import { Music, Plus } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Belum Ada Lagu',
  description = 'Pustaka lagu Anda masih kosong. Impor file audio MP3/WAV milik Anda untuk mulai bermain atau membuat chart!',
  actionLabel = 'Impor Lagu Sekarang',
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-slate-900/60 border border-slate-800/80 rounded-3xl my-6 shadow-inner">
      <div className="p-4 bg-slate-800/80 text-cyan-400 rounded-2xl mb-4 border border-slate-700/50 shadow-lg">
        {icon || <Music className="w-10 h-10" />}
      </div>
      <h3 className="text-lg font-bold text-slate-100">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-400 max-w-md mt-1.5 leading-relaxed">
        {description}
      </p>
      {onAction && (
        <button
          onClick={onAction}
          className="mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
