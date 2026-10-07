# 🎵 Beat Pulse Rhythm Game

[![Deploy Beat Pulse to GitHub Pages](https://github.com/Darlayx0/Beat-Pulse/actions/workflows/deploy.yml/badge.svg)](https://github.com/Darlayx0/Beat-Pulse/actions/workflows/deploy.yml)

Sebuah game ritme modern berbasis Web Audio API dan React dengan fitur import musik lokal, sinkronisasi audio YouTube, deteksi ketukan otomatis (auto-beat), akurasi hit timing presisi, serta chart editor bawaan yang interaktif.

---

## 🚀 Live Demo & Deployment

Aplikasi dapat dikunjungi secara langsung melalui:

- **GitHub Pages**: [https://darlayx0.github.io/Beat-Pulse/](https://darlayx0.github.io/Beat-Pulse/)
- **Vercel / Netlify / Custom Domain**: Siap di-deploy langsung dari repositori ini.

---

### Cara Mengaktifkan GitHub Pages (1x Setup di GitHub)

Agar GitHub Pages dapat mempublikasikan situs secara otomatis:

1. Buka repositori di GitHub: [https://github.com/Darlayx0/Beat-Pulse](https://github.com/Darlayx0/Beat-Pulse)
2. Klik tab **Settings** di bagian atas menu repositori.
3. Di bilah samping kiri, pilih menu **Pages**.
4. Di bagian **Build and deployment** -> **Source**, ubah dari *"Deploy from a branch"* menjadi **"GitHub Actions"**.
5. Selesai! Workflow `.github/workflows/deploy.yml` akan otomatis terpicu dan mempublikasikan game ke:
   👉 **https://darlayx0.github.io/Beat-Pulse/**

---

## ✨ Fitur Utama

### Sinkronisasi chart antar perangkat

Masuk dengan akun Google yang sama di kedua perangkat. Simpan chart (atau aktifkan simpan otomatis), tunggu indikator **Chart tersinkron ke akun Google**, lalu buka lagu dari pustaka pada perangkat lain. Perubahan pustaka diterima otomatis melalui Firestore, tanpa backend server sehingga kompatibel dengan GitHub Pages.

- Chart, metadata lagu, dan tautan YouTube mengikuti akun Firebase yang benar-benar sedang login. Data akun lain tidak ditampilkan atau diunggah ulang.
- Perubahan offline disimpan lokal dan antrean Firestore dikirim setelah koneksi pulih. Aplikasi tetap dapat dibuka tanpa menunggu cloud.
- File MP3/WAV lokal tetap tersimpan pada perangkat asal. Pada perangkat kedua, gunakan **Hubungkan ulang audio** pada lagu yang sudah tersinkron agar chart tetap terjaga.
- Untuk menghindari konflik, edit satu lagu pada satu perangkat dalam satu waktu. Jika kedua perangkat menyimpan lagu yang sama, versi dengan waktu pembaruan terbaru digunakan; perubahan tidak digabung per note.
- Indikator kegagalan cloud tetap terlihat; login saja tidak berarti chart telah tersinkron.

#### Aktivasi Firebase (wajib satu kali sebelum sinkronisasi bisa digunakan)

Proyek bawaan: `fleet-camp-41wkv`, database `ai-studio-beatpulserhythm-5eac49ef-8029-46d1-9451-e343df33195f`. Perubahan rules di GitHub tidak otomatis terpasang di Firebase.

1. Dengan akun pemilik/editor proyek, aktifkan provider **Google** pada Firebase Authentication.
2. Tambahkan `darlayx0.github.io` ke **Authentication → Settings → Authorized domains**.
3. Pada database Firestore yang disebutkan di atas, publikasikan isi `firestore.rules`. Chart pribadi menggunakan path `users/{uid}/songs/{songId}` yang hanya dapat dibaca/ditulis oleh akun tersebut.
4. Alternatif melalui Firebase CLI: `npx firebase-tools deploy --only firestore:rules --project fleet-camp-41wkv --non-interactive` setelah kredensial deploy sudah dikonfigurasi. `firebase.json` memilih database yang benar.

Konfigurasi Firebase Web dapat diganti melalui variabel `VITE_FIREBASE_*` dan `VITE_FIRESTORE_DATABASE_ID` saat build. Untuk GitHub Pages, isi **Settings → Secrets and variables → Actions → Variables**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, dan `VITE_FIRESTORE_DATABASE_ID` (gunakan `(default)` untuk database default). Workflow deploy membaca variabel ini; variabel kosong memakai konfigurasi bawaan. Jika memakai proyek/database lain, sesuaikan juga `firebase.json` sebelum memasang rules. Jangan menyimpan private key/service account dalam kode frontend atau repositori.

Verifikasi lokal tanpa server: `npm run test:sync`, `npm run lint`, `npm run build:client`.

- 🎧 **Web Audio Synthesis & Import Musik**: Mainkan lagu preset bawaan secara instan atau upload file audio lokal (MP3, WAV, OGG, FLAC).
- 📺 **Integrasi YouTube**: Sinkronisasi gameplay langsung dengan audio/video YouTube.
- 🎼 **Custom Chart Editor**: Buat dan edit beatmap ritme kamu sendiri dengan sequencer visual, auto-generator ketukan, BPM detector, dan kustomisasi tingkat kesulitan (Easy, Normal, Hard, Master).
- 🏆 **Sistem Skor & Progression**: Penilaian akurasi ketukan (Perfect, Great, Good, Miss), combo counter, sistem EXP, level pemain, dan leaderboard.
- 💾 **Offline-First Storage**: Data lagu, audio, dan pengaturan tersimpan aman di browser melalui IndexedDB, dengan dukungan sinkronisasi backend Cloud SQL / Firebase.
- 📱 **Mobile & Desktop Responsive**: Dilengkapi kontrol layar sentuh (virtual pad) serta keyboard hotkeys (D, F, J, K) untuk desktop.

---

## 🛠️ Menjalankan Secara Lokal

```bash
# 1. Clone repositori
git clone https://github.com/Darlayx0/Beat-Pulse.git
cd Beat-Pulse

# 2. Install dependensi
npm install

# 3. Jalankan mode pengembangan
npm run dev
```

Buka browser di `http://localhost:3000`.

---

## 📦 Build Produksi

```bash
# Build frontend client
npm run build:client

# Atau build fullstack client & server bundle
npm run build

# Menjalankan server produksi
npm start
```
