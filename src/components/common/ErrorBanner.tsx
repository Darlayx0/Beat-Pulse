import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  title = 'Terjadi Kesalahan',
  message,
  onRetry,
}) => {
  return (
    <div className="bg-rose-950/50 border border-rose-800/80 rounded-2xl p-4 sm:p-6 text-rose-200 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-rose-900/60 rounded-xl text-rose-400 flex-shrink-0 mt-0.5 sm:mt-0">
          <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div>
          <h3 className="font-bold text-sm sm:text-base text-rose-100">{title}</h3>
          <p className="text-xs sm:text-sm text-rose-300/90 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-all flex-shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Coba Lagi</span>
        </button>
      )}
    </div>
  );
};
