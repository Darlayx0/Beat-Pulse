# Penyimpanan dan pemulihan Beat Pulse

Lagu, chart, seluruh difficulty (termasuk urutan), dan audio memakai penyimpanan
lokal serta penyedia sinkronisasi yang sudah tersedia. Pengaturan game, preferensi
editor, profil, skor terbaik, dan hasil permainan kini memiliki jurnal per akun
yang tetap tersedia setelah browser ditutup. Akun tamu tetap disimpan lokal.

GitHub menyimpan setiap entri akun dalam Gist sinkronisasi yang sama dengan chart.
Hasil permainan memakai ID unik; penggabungan dua perangkat mempertahankan kedua
hasil tanpa menghitung ulang hasil yang telah diterima. Skor tertinggi menang;
pengaturan memakai entri terbaru dengan pemilihan deterministik saat timestamp
sama. Preferensi editor meliputi alat, durasi hold, snap, zoom, playback speed,
ukuran canvas, hitsound, metronome, dan mode penyimpanan.

Google memakai dokumen terpisah di `users/{uid}/state/{entryId}` agar riwayat
permainan tidak menumpuk dalam satu dokumen Firestore. Publikasikan `firestore.rules`
ke database Firebase yang dikonfigurasi sebelum memakai jalur ini. GitHub Pages
tidak menjalankan server Express atau endpoint `/api`; sinkronisasi akun ini
langsung memakai GitHub/Firestore. Push kode ke GitHub tidak memasang rules Firebase.

Jurnal lokal tidak dihapus setelah unggahan gagal. Sinkronisasi berjalan saat ada
perubahan, koneksi kembali, akun berubah, halaman kembali aktif, atau pemeriksaan
berkala saat halaman terlihat. Setelah tiga kegagalan pada versi jurnal yang sama,
percobaan berhenti sampai perubahan data, akun, atau koneksi memicu kembali.

Backup ZIP berisi manifest versi 1, `library.json`, dan audio biner. SHA-256 setiap
file data diverifikasi sebelum pemulihan. Audio yang tersedia hanya melalui GitHub
diunduh terlebih dahulu; audio yang hilang menghasilkan kegagalan ekspor yang
terlihat. Referensi YouTube/URL eksternal tetap merupakan referensi, sehingga
ketersediaan sumber eksternal tidak dijamin oleh backup. Batas restore ZIP 512 MiB.
JSON cadangan lama tetap didukung. Profil tidak memulihkan autentikasi/token.
Cadangan dengan data akun harus dipulihkan melalui akun asal; cadangan lama tanpa
data akun bisa mengimpor lagu dan skor ke akun aktif. Pemulihan menggabungkan data
dengan jurnal yang ada. Gagal menyimpan ke browser akan dilaporkan; validasi sebelum
penulisan bukan jaminan transaksi atomik lintas seluruh media penyimpanan.

Penyimpanan browser dapat dihapus oleh pengguna. Simpan backup ZIP di luar browser
dan pastikan cloud berhasil tersinkron sebelum pindah perangkat. Riwayat hasil
permainan menambah ukuran jurnal lokal; jika kapasitas browser penuh, lakukan backup
dan periksa kapasitas perangkat sebelum melanjutkan.

Validasi: `npm test`, `npm run lint`, `npm run build`, serta
`node tests/persistenceBrowser.mjs` dengan server Vite pada port 5174 dan Playwright.
