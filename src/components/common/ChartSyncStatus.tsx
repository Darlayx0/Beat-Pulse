import { useState, useSyncExternalStore } from 'react';
import { getSyncStatus, subscribeSyncStatus, syncCloudSongs } from '../../services/chartCloudService';
import { connectGithub, disconnectGithub, getGithubConnection } from '../../services/githubSyncService';
import { auth } from '../../services/firebaseConfig';

const labels = {
  local: 'Chart lokal · hubungkan akun untuk sinkronisasi antar perangkat',
  syncing: 'Menyinkronkan chart…',
  synced: 'Chart tersinkron ke akun Google',
  offline: 'Offline · perubahan chart akan dikirim saat koneksi kembali',
  error: 'Chart aman di perangkat ini · sinkronisasi cloud gagal',
};

export function ChartSyncStatus() {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const github = getGithubConnection();
  const connect = async () => {
    setBusy(true); setError('');
    try {
      await connectGithub(token.trim(), remember, auth?.currentUser?.uid);
      setToken(''); setOpen(false);
      await syncCloudSongs();
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menghubungkan GitHub.'); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 text-[11px] bg-slate-50 text-slate-600 border-b border-slate-200" role="status">
    <span>{github && status === 'synced' ? `Chart tersinkron · GitHub @${github.login}` : labels[status]}</span>
    <button className="font-semibold text-indigo-600 underline" onClick={() => setOpen(!open)}>Sinkronisasi GitHub</button>
    {github && <button className="font-semibold text-indigo-600 underline" onClick={() => { void syncCloudSongs(); }}>Sinkronkan sekarang</button>}
    {status === 'error' && <button className="font-semibold text-indigo-600 underline" onClick={() => { void syncCloudSongs(); }}>Coba lagi</button>}
    {open && <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-3" aria-label="Sinkronisasi GitHub">
      <p className="font-bold text-slate-900">Edit di komputer, coba di ponsel</p>
      <p>Hubungkan akun GitHub yang sama di kedua perangkat. Chart otomatis diperbarui setiap 15 detik, atau tekan Sinkronkan sekarang. Tidak memerlukan Firebase.</p>
      <p>Gunakan lagu YouTube untuk langsung bermain. Audio lokal perlu dihubungkan ulang pada perangkat lain.</p>
      {github ? <>
        <p>Terhubung sebagai <strong>@{github.login}</strong>.</p>
        <button className="font-semibold text-red-600" onClick={() => { disconnectGithub(); setOpen(false); }}>Putuskan akun GitHub</button>
      </> : <form onSubmit={event => { event.preventDefault(); void connect(); }} className="space-y-3">
        <a className="text-indigo-600 underline" href="https://github.com/settings/tokens/new?scopes=gist&description=Beat%20Pulse%20Chart%20Sync" target="_blank" rel="noreferrer">Buat token GitHub (classic), centang izin gist saja</a>
        <label className="block">Token GitHub
          <input type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" required disabled={busy} className="mt-1 w-full rounded-lg border p-2" placeholder="Tempel token di sini" />
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />Ingat di perangkat pribadi ini</label>
        <p className="text-xs">Tanpa opsi ingat, token hanya disimpan selama sesi tab. Gist bersifat secret (tidak terdaftar publik), tetapi siapa pun yang mengetahui tautannya bisa membacanya. Jangan sertakan data rahasia.</p>
        <p className="text-xs">Chart lokal dari akun aktif akan dihubungkan ke akun GitHub ini. Edit satu lagu pada satu perangkat agar perubahan tidak saling menimpa.</p>
        {error && <p className="text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Menghubungkan…' : 'Hubungkan & sinkronkan'}</button>
      </form>}
    </section>}
  </div>;
}
