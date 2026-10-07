import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Memuat...',
  size = 'md',
}) => {
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 space-y-3 text-center">
      <Loader2 className={`${iconSizes[size]} text-cyan-400 animate-spin`} />
      {message && <p className="text-sm font-medium text-slate-300 animate-pulse">{message}</p>}
    </div>
  );
};
