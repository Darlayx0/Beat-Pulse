# Koreksi regresi UI editor — 13 Oktober 2026

Pengguna melaporkan UI mentahan setelah deployment `15573e6`, terutama pada
Pergeseran & Playhead dan editor utama. Tes fungsi sebelumnya tidak cukup
untuk menilai konsistensi visual. Pemeriksaan screenshot membuktikan form
polos, menu slot dan inspector tanpa styling yang memadai, serta toolbar
mobile dengan label terpotong.

## Perubahan

- Pergeseran & Playhead: panel form, preview sebelum/sesudah, pilihan delta
  aktif, panel alignment dan feedback Undo mengikuti gaya aplikasi.
- Editor utama: alat dalam grid mobile, seluruh subdivisi terlihat tanpa
  scroll tersembunyi, icon Rentang mengikuti warna tombol, inspector dan
  navigasinya konsisten dengan panel lain.
- More Hub: kelompok menu dengan kartu dan status chart aktif.
- Difficulty: styling input dan aksi pada menu slot.
- BPM/offset dan audio: input, status, metadata dan area drop distyling.
- Generator: panel eksekusi ditumpuk pada mobile agar deskripsi tidak terjepit.

Perubahan ini mempertahankan kontrak timing, validasi shift, Undo, dan data
chart. Tidak ada perubahan pada sinkronisasi GitHub atau migrasi data.

## Bukti verifikasi

- 23 tes unit, TypeScript dan build produksi lulus.
- Runner browser utama: 8 viewport × 8 modul, 14 kelompok fungsi, tanpa
  page error atau overflow halaman.
- Runner tambahan: 6 kelompok fungsi lulus, termasuk erase/Undo, clear/Undo,
  keyboard, reduced motion dan teks 200%.
- Pemeriksaan khusus pada 320, 390 dan 1280px: label alat tidak terpotong,
  grid tidak overflow, inspector/menu slot/playhead dapat diakses dan teks
  200% tidak menimbulkan overflow halaman.
- Screenshot terbaru di `docs/screenshots/`, termasuk
  `editor-inspector-polished-390.png`, `editor-slot-menu-polished-390.png`
  dan `editor-shift-playhead-polished-390.png`, diperiksa secara visual.

Satu eksekusi tes tambahan terganggu reload Vite ketika runner lain menulis
laporan JSON. Log server mengonfirmasi reload tersebut. Menjalankan kedua
runner berurutan menyelesaikan gangguan tanpa perubahan logika aplikasi.
Pemeriksaan screenshot khusus awal juga membutuhkan selector menu slot yang
hanya menunjuk menu terbuka; selector diperbaiki dan pemeriksaan lulus.

Verifikasi memakai Edge/Chromium dan fixture editor aktual, bukan perangkat
iPhone/Safari fisik. Koreksi ini mencakup editor dan delapan modulnya; tidak
mengklaim semua halaman aplikasi sudah lolos penilaian visual pengguna.
