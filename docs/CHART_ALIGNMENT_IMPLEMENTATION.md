# Sinkronisasi chart dengan audio

Mode utama pada **Pergeseran & Playhead** sekarang adalah **Sinkronisasi lagu**.
Pergeseran global disimpan melalui offset tanpa mengubah timestamp, lane, atau
durasi hold. Mode **Edit waktu note** mempertahankan editing per lane dan perataan
ke playhead yang sudah ada.

## Penyebab dan keputusan

- Fitur lama menulis ulang timestamp dan riwayat hanya menyimpan note. Riwayat
  sekarang menyimpan note, BPM, serta offset; Undo/Redo memulihkan ketiganya.
- Format lama menggunakan `audioTime = chartTime - offset`. Tanda ini tetap
  dipertahankan untuk kompatibilitas simpan, impor, ekspor, dan gameplay.
  Delta kontrol positif berarti note lebih lambat: `nextOffset = offset - delta`.
- Preview numerik menampilkan posisi pada audio, termasuk ujung hold. Koreksi
  sebelum awal audio atau setelah durasi audio yang diketahui ditolak seluruhnya,
  tanpa memotong note. Batas akhir tidak diklaim terverifikasi bila durasi tidak ada.
- Perubahan BPM/offset menghentikan playback; audition dan seek memakai pemetaan
  waktu yang sama dengan editor/gameplay. Audio synth fallback tidak dapat digunakan
  untuk memverifikasi sinkronisasi lagu melalui tombol audition.

## Acuan dan diagnosis

Pengguna memasangkan hingga 12 note dengan waktu kejadian audio. Median selisih
menjadi saran offset; residual setiap pasangan tetap terlihat. Estimasi skala waktu
menggunakan median kemiringan pasangan yang berjarak minimal 10 detik.

Diagnosis drift memerlukan minimal 3 acuan dengan rentang minimal 10 detik. Ambang
diagnosis adalah 20 ms, dengan dukungan minimal 75% acuan terhadap model. Drift
dan timing yang tidak konsisten menonaktifkan saran offset otomatis. Pengguna
masih dapat memasukkan koreksi manual setelah meninjau preview.

Acuan hanya disimpan selama panel sinkronisasi dibuka, dan acuan untuk note yang
dihapus atau dipindahkan tidak lagi dipakai. Belum ada deteksi onset otomatis,
koreksi skala waktu, tempo map baru, atau loop A/B. Tombol dengarkan memainkan
timing yang sudah diterapkan, mulai 2 detik sebelum note acuan; preview angka
belum mengubah playback. Kalibrasi perangkat tetap terpisah.

## Verifikasi dan checkpoint

- `npm test`: 28 tes lulus, termasuk arah offset, note/hold tetap utuh, batas audio,
  roundtrip format, median dengan outlier, diagnosis drift/timing lokal, dan acuan
  yang belum cukup.
- `npm run lint`: TypeScript lulus.
- `npm run build`: build client/server berhasil; Vite mengeluarkan peringatan
  ukuran bundle lebih dari 500 kB.
- `npm run test:alignment:browser`: Edge headless, viewport 390×844. Lulus untuk
  simpan/buka ulang, Undo/Redo, diagnosis acuan, penolakan drift, batas waktu,
  editing lane, overflow, fallback gate, decode WAV, audition, seek, dan pause
  ketika timing berubah. Memerlukan Playwright lokal atau `PLAYWRIGHT_MODULE_PATH`.
- Pemeriksaan pendengaran pada lagu asli dan pengukuran latensi perangkat fisik
  belum dilakukan; tes browser memeriksa perilaku serta clock audio.
- Aturan `.agents/rules/anti-loop.md` sudah tersedia sebelum perubahan. Frontmatter
  sesuai subset YAML string/quoted string, trigger `always_on`, dan sejalan dengan
  `AGENTS.md`. Tidak ada aturan proyek yang ditimpa.
