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
