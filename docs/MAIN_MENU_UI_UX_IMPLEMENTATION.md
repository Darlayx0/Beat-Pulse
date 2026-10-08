# Implementasi Main Menu BeatPulse

Tanggal: 8 Oktober 2026.

Main menu menggunakan arah Rhythm Studio: permukaan terang, aksen indigo, artwork pulse/record berbasis CSS dan SVG, serta hierarki yang mengutamakan pemilihan lagu dan mulai bermain.

## Perubahan

- Header dengan navigasi semantik, akses pengaturan, dan status sinkronisasi ringkas. Rincian sinkronisasi tetap menggunakan komponen serta layanan yang ada.
- Satu CTA impor utama, ringkasan jumlah lagu/chart dari data nyata, search dengan clear, filter sumber dengan jumlah, dan pengurutan koleksi/judul/tanggal/tempo.
- Artwork dengan fallback gambar YouTube, kartu dengan tombol yang dapat diakses keyboard, serta preview terpisah dari navigasi detail.
- Detail responsif: identitas lagu, difficulty kustom, metadata chart, tombol main/edit, dan rekor. Tombol main ditempatkan sebelum rekor.
- Pemeriksaan audio membaca buffer asli, Blob lagu, dan IndexedDB. Chart kosong atau audio yang belum tersedia diberi penjelasan dan tindakan yang sesuai.
- Preview dibatasi hingga 30 detik; permintaan yang sudah dibatalkan tidak memulai playback setelah navigasi.
- Pengelolaan lagu/difficulty berada dalam dialog: tambah, rename, duplikasi, urutan, impor/ekspor JSON, relink audio, serta konfirmasi hapus. Preset tetap hanya dapat dilihat/diekspor/duplikasi.
- Salinan preset menyimpan audio sintetis yang disengaja sebagai WAV sehingga audio tidak hilang setelah reload.
- Dialog native untuk pengelolaan, sinkronisasi, impor, dan pengaturan: fokus berada di modal, Escape menutup, fokus kembali ke pemicu, dan form difficulty menerima fokus awal.
- Token visual, focus-visible, target sentuh minimal 44 px, penanganan reduced motion, serta pembatasan larangan seleksi teks ke gameplay.
- Empty/error/loading/no-results menggunakan pola menu yang sama. Banner offline tidak menutupi header menu.
- Komponen dipisahkan ke `src/components/library/`; kebijakan filter/sort dan pemeriksaan buffer memiliki tes perilaku.

## Validasi yang dijalankan

- TypeScript (`npm run lint`), 11 tes sinkronisasi (`npm run test:sync`), tiga tes kebijakan pustaka, dan build client produksi semuanya lulus pada snapshot rilis terpisah.
- Browser: pencarian dengan spasi/case, no-results/reset, navigasi pustaka/detail, pemilihan difficulty, preview mulai/berhenti, masuk gameplay, keluar sesi, dan masuk/keluar editor.
- Browser: pembukaan dialog impor/pengaturan/sinkronisasi/pengelolaan; Escape dan pengembalian fokus; validasi nama difficulty yang sudah ada.
- Build produksi terpisah juga diperiksa melalui preview lokal untuk pustaka, rincian sinkronisasi, dan detail lagu.
- Sesi lokal terpisah: duplikasi preset, reload, audio tetap siap, serta penambahan difficulty kustom dengan nama panjang. Data uji tidak masuk ke repositori atau situs produksi.
- Pemeriksaan viewport pada rentang 320–1920 px dan landscape pendek; tidak ditemukan overflow horizontal pada layout menu/detail yang diobservasi. Desktop dan tablet menggunakan grid adaptif; ponsel satu kolom.
- Pengukuran kontras pasangan warna teks utama dan permukaan; penyesuaian dilakukan pada subtitle hero, metadata difficulty/rekor, placeholder, dan footer.
- Screenshot pustaka desktop disimpan di `screenshots/main-menu-desktop.jpg`. Screenshot ini berisi preset bawaan, tanpa data akun atau token.

Rilis diverifikasi dari arsip Git index yang hanya berisi perubahan tugas ini. Perubahan lokal sebelumnya pada README, package.json, tipe data, sanitizer, status sinkronisasi, layanan, dan tes audio tidak dimasukkan ke commit UI.

## Batas validasi dan keputusan

- Wireframe terpisah digantikan iterasi implementasi dan review langsung melalui preview lokal; tidak ada artefak wireframe yang diklaim telah dibuat.
- Pemeriksaan responsif menggunakan browser in-app, belum mencakup seluruh perangkat fisik, browser, keyboard virtual, atau pembaca layar.
- Koneksi akun, upload cloud, dan penghapusan data pengguna tidak dilakukan sebagai bagian dari smoke test.
- Build masih memiliki peringatan ukuran bundle besar dari aplikasi yang memuat gameplay, editor, dan integrasi akun. Pemisahan bundle menyeluruh merupakan pekerjaan lanjutan; build tetap berhasil.
- Deployment mengikuti workflow GitHub Pages yang sudah ada: push ke `main`, lint/tes/build, lalu penerbitan ke `gh-pages`.

## Deployment terverifikasi

- Commit kode: `fdb6e7a` — `feat: redesign BeatPulse library and main menu`.
- Workflow [37705354665](https://github.com/Darlayx0/Beat-Pulse/actions/runs/37705354665) berhasil pada seluruh tahap, termasuk deploy ke `gh-pages`.
- [Situs publik BeatPulse](https://darlayx0.github.io/Beat-Pulse/) sudah menampilkan menu baru; navigasi detail dan tombol main diperiksa pada versi online.
- Aset publik `index-CkRonOPh.css` dan `index-BOnclIs1.js` cocok dengan build rilis lokal yang telah diverifikasi.

## Pemeriksaan ulang

```sh
npm ci
npm run lint
npm run test:sync
npm exec -- tsx --test tests/libraryPresentation.test.ts
npm run build:client
```

