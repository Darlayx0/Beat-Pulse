import { useSyncExternalStore } from 'react';
import { getSyncStatus, subscribeSyncStatus, syncCloudSongs } from '../../services/chartCloudService';

const labels = {
  local: 'Chart lokal · masuk dengan Google untuk sinkronisasi antar perangkat',
  syncing: 'Menyinkronkan chart…',
  synced: 'Chart tersinkron ke akun Google',
  offline: 'Offline · perubahan chart akan dikirim saat koneksi kembali',
  error: 'Chart aman di perangkat ini · sinkronisasi cloud gagal',
};

export function ChartSyncStatus() {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  return <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 text-[11px] bg-slate-50 text-slate-600 border-b border-slate-200" role="status">
    <span>{labels[status]}</span>
    {status === 'error' && <button className="font-semibold text-indigo-600 underline" onClick={() => { void syncCloudSongs(); }}>Coba lagi</button>}
  </div>;
}
