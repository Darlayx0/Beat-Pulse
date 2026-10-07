import React from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

interface NetworkStatusBannerProps {
  isOffline: boolean;
  onRetryConnection?: () => void;
  inline?: boolean;
}

export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({
  isOffline,
  onRetryConnection,
  inline = false,
}) => {
  if (!isOffline) return null;

  if (inline) return (
    <aside className="bp-offline-banner" role="status">
      <WifiOff size={18} aria-hidden="true" />
      <p><strong>Mode offline.</strong> Lagu lokal dan preset tetap tersedia. Sinkronisasi akan dilanjutkan saat koneksi pulih.</p>
      {onRetryConnection && <button type="button" className="bp-button bp-button--secondary" onClick={onRetryConnection}><RefreshCw size={16} /> Periksa</button>}
    </aside>
  );

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-xl animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div className="bg-amber-900/95 text-amber-100 border border-amber-500/50 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0 text-amber-300 animate-pulse">
            <WifiOff className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                Mode Offline / Jaringan Lemah
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            </div>
            <p className="text-xs text-amber-100/90 font-medium line-clamp-2">
              Posisi terakhir & draf editan tersimpan otomatis di perangkat. Sesi akan berlanjut otomatis saat jaringan kembali stabil.
            </p>
          </div>
        </div>

        {onRetryConnection && (
          <button
            onClick={onRetryConnection}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-extrabold text-xs flex items-center gap-1.5 transition-all active:scale-95 flex-shrink-0 cursor-pointer shadow-sm"
            title="Coba Cek Koneksi Ulang"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Periksa</span>
          </button>
        )}
      </div>
    </div>
  );
};
