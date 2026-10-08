# Task Plan — Peningkatan UI/UX Main Menu BeatPulse

Tanggal: 8 Oktober 2026.
Status: implementasi, validasi rilis, dan deployment GitHub Pages selesai. Hasil aktual dicatat di `MAIN_MENU_UI_UX_IMPLEMENTATION.md`.

## Tujuan dan arah desain

Membuat main menu yang profesional, bersih, elegan, dinamis, terstruktur, harmonis, dan responsif, dengan identitas yang sesuai BeatPulse: game ritme dengan pustaka musik pribadi dan kemampuan membuat chart. Pengalaman utama harus langsung terbaca: **temukan lagu → pilih tingkat kesulitan → mulai main**. Impor musik dan editor mendukung alur tersebut.

Arah visual awal: **Rhythm Studio**. Pertahankan fondasi terang yang sudah ada, gunakan slate untuk teks dan permukaan, indigo sebagai aksen utama, serta motif pulse/waveform yang halus. Energi musik hadir melalui identitas, artwork, dan respons interaksi; ruang kosong dan hierarki menjaga kenyamanan. Arah ini perlu diperiksa lewat wireframe dan preview lokal sebelum dianggap final.

## Ruang lingkup

- Header/navigation, identitas aplikasi, akses impor, pengaturan, dan status sinkronisasi.
- Halaman pustaka: heading, pencarian, filter sumber, pengurutan, kartu lagu, dan status hasil.
- Detail lagu sebagai bagian dari alur main menu: preview, difficulty, rekor, tombol main, editor, dan pengelolaan lagu/chart.
- Loading, pustaka kosong, pencarian tanpa hasil, error, audio belum tersedia, dan offline.
- Konsistensi tampilan serta aksesibilitas dialog yang dibuka dari menu. Perombakan isi seluruh pengaturan dan editor merupakan pekerjaan terpisah.

Gameplay, penilaian, audio engine, struktur penyimpanan, dan kebijakan sinkronisasi tetap menjadi dependensi yang harus dilindungi ketika UI diimplementasikan. Fitur baru seperti rekomendasi, favorit, atau riwayat bermain tidak menjadi syarat rencana ini.

## Temuan awal dari kode

Audit awal berbasis sumber; tampilan di browser belum diverifikasi.

| Temuan | Implikasi untuk rencana |
| --- | --- |
| `Navbar.tsx` dan toolbar `SongLibrary.tsx` sama-sama menampilkan tombol impor dengan penekanan kuat. | Tentukan satu lokasi utama sesuai konteks dan kurangi kompetisi visual. |
| `SongLibrary.tsx` menampung daftar, detail, preview, pengelolaan difficulty, dan banyak dialog dalam satu komponen. | Pisahkan tanggung jawab secara bertahap agar perubahan visual mudah dirawat. |
| Detail menampilkan preview/video, pengelolaan, serta alat cadangan sebelum tombol main. | Naikkan prioritas pilihan difficulty dan CTA main; kelompokkan alat lanjutan. |
| Sebagian label menggunakan ukuran 9–11 px; beberapa kontrol hanya setinggi 38–40 px. | Perbaiki keterbacaan dan ukuran target sentuh. |
| Logo dan kartu memakai elemen klik non-button; beberapa kontrol menghapus outline. | Audit semantik keyboard, fokus, dan nama aksesibel. |
| Filter berbentuk chips yang bergulir; grid saat ini berubah dari 1 menjadi 2 dan 3 kolom. | Validasi kepadatan, judul panjang, serta interaksi pada layar sempit dan landscape. |
| `ChartSyncStatus.tsx` menampilkan status dan form koneksi di bawah header. | Buat status ringkas dan akses rincian yang jelas tanpa menghilangkan error penting. |
| Seleksi teks dan context menu dibatasi secara global di CSS dan `App.tsx`. | Evaluasi pembatasan pada menu; pertahankan kebutuhan khusus kontrol gameplay. |
| Ada perubahan lokal yang sedang berjalan pada layanan sinkronisasi, tipe data, dan komponen status. | Saat implementasi, baca ulang kondisi terbaru dan hindari menimpa pekerjaan tersebut. |

## Struktur pengalaman yang dituju

**Pustaka**

1. Header ringkas: identitas BeatPulse, status/akses sinkronisasi, pengaturan/profil.
2. Heading pendek dengan jumlah lagu dan akses utama tambah/impor musik.
3. Toolbar: pencarian judul/artis, filter Semua/Preset/Lokal/YouTube, pengurutan sederhana.
4. Daftar kartu konsisten: identitas lagu, artis, sumber, durasi/BPM, ringkasan difficulty dan rekor jika tersedia.
5. Empty/error state dengan tindakan pemulihan yang sesuai.

**Detail lagu**

1. Kembali ke pustaka dengan pencarian, filter, dan posisi scroll tetap terjaga.
2. Identitas lagu dan metadata penting.
3. Pilihan difficulty, ringkasan chart/rekor yang dipilih, dan tombol **Mulai main** yang paling menonjol.
4. Preview audio/video sebagai kontrol sekunder; autoplay tidak diperlukan.
5. Akses **Edit chart** dan menu **Kelola lagu** untuk duplikasi, pengelolaan difficulty, impor/ekspor chart, serta hapus.
6. Jika audio belum tersedia, tampilkan alasan dan **Hubungkan audio** di dekat area main. Ketersediaan dinilai melalui alur audio yang sebenarnya, bukan hanya keberadaan buffer di memori.

Pada desktop, detail dapat memakai dua kolom untuk identitas/preview dan panel bermain. Pada ponsel, gunakan susunan satu kolom dengan panel aksi yang mudah dicapai. Sticky CTA digunakan hanya bila preview membuktikan tidak menutupi konten, keyboard virtual, dialog, atau safe area.

## Task dan urutan pengerjaan

### T01 — Audit visual dan baseline (P0)

- [ ] Jalankan aplikasi lokal dan dokumentasikan tampilan pustaka, detail, serta dialog utama.
- [ ] Periksa alur lagu preset, lokal, YouTube, serta lagu dengan audio belum tersedia.
- [ ] Catat masalah hierarki, kepadatan, overflow, fokus, dan konflik header/banner/overlay.
- [ ] Verifikasi sumber data yang tersedia; gunakan data nyata untuk jumlah lagu, rekor, dan status.
- [ ] Catat kondisi awal lint/build dan perubahan lokal yang relevan sebelum implementasi.

Hasil: daftar masalah terprioritas dan screenshot baseline. Selesai ketika keputusan layout didukung tampilan aktual.

### T02 — Arsitektur informasi dan wireframe (P0; setelah T01)

- [ ] Buat wireframe pustaka dan detail untuk mobile, tablet, dan desktop.
- [ ] Tetapkan hierarki primary/secondary/tertiary action; pilih satu CTA impor utama per tampilan.
- [ ] Kelompokkan alat lanjutan ke menu pengelolaan dengan label yang mudah ditemukan.
- [ ] Tetapkan perilaku kembali, state filter, posisi scroll, pembukaan dialog, dan fokus setelah dialog ditutup.
- [ ] Pilih pengurutan dengan data yang tersedia, misalnya judul dan tanggal ditambahkan, dengan fallback untuk metadata kosong.

Hasil: layout dan kontrak interaksi. Selesai ketika alur main terlihat jelas tanpa membaca petunjuk panjang.

### T03 — Fondasi visual yang konsisten (P0; setelah T02)

- [ ] Definisikan token warna, surface, border, tipografi, spacing, radius, shadow, dan motion.
- [ ] Gunakan ritme spacing berbasis 4/8 px, radius terbatas, serta shadow halus sesuai tingkat elevasi.
- [ ] Targetkan teks isi 14–16 px dan metadata penting minimal 12 px; uji judul serta nama difficulty panjang.
- [ ] Standardisasi button, input, chip, badge, card, menu, dan dialog melalui komponen/pola bersama.
- [ ] Gunakan ikon Lucide secara konsisten; status penting diberi teks, bukan warna atau ikon saja.
- [ ] Tambahkan motif pulse/waveform ringan dengan CSS/SVG dan fallback artwork yang stabil bila cover tidak ada.

Hasil: fondasi desain yang dapat dipakai ulang, tanpa menambahkan aset berat yang tidak dibutuhkan.

### T04 — Header dan pustaka lagu (P0; setelah T03)

- [ ] Rapikan header dan ubah logo menjadi kontrol navigasi yang semantik.
- [ ] Buat status sinkronisasi ringkas dengan rincian/aksi yang dapat dibuka; error tetap mudah ditemukan.
- [ ] Tata heading, search, filter, pengurutan, dan hasil menjadi satu urutan yang jelas.
- [ ] Tambahkan label search, tombol hapus pencarian, jumlah hasil, dan reset filter saat tidak ada hasil.
- [ ] Redesign kartu lagu dengan hierarki judul → artis → metadata → tindakan.
- [ ] Pastikan tombol preview/menu kartu memiliki target sendiri dan tidak membuka detail secara tidak sengaja; hindari interactive element bersarang.
- [ ] Pecah komponen sesuai tanggung jawab, misalnya toolbar, kartu, daftar, detail, dan dialog; pertahankan kontrak callback yang ada.

Hasil: pustaka mudah dipindai, dicari, dan dioperasikan dengan mouse, sentuhan, serta keyboard.

### T05 — Detail dan akses mulai bermain (P0; setelah T04)

- [ ] Tempatkan difficulty dan CTA main pada bagian awal layout; video tidak mendominasi alur bermain.
- [ ] Tampilkan state difficulty terpilih, jumlah note, dan rekor sesuai chart yang aktif.
- [ ] Dukung difficulty kustom berjumlah banyak serta nama panjang tanpa pemotongan informasi penting.
- [ ] Bedakan penekanan tombol main, preview, dan edit chart.
- [ ] Susun alat pengelolaan secara ringkas, termasuk konfirmasi hapus dan batasan preset yang sudah berlaku.
- [ ] Tangani lagu tanpa difficulty, chart kosong, audio belum tersedia, preview gagal, serta perubahan lagu/difficulty saat sinkronisasi masuk.
- [ ] Pertahankan penghentian preview sebelum main/editor serta lifecycle host YouTube global.

Hasil: memilih lagu dan difficulty lalu mulai bermain membutuhkan maksimal tiga aktivasi dari pustaka berisi lagu yang siap dimainkan.

### T06 — Responsivitas, aksesibilitas, dan motion (P0/P1; sepanjang T03–T05)

- [ ] Mulai dari layout mobile; gunakan grid adaptif berdasarkan ruang konten, bukan hanya kategori perangkat.
- [ ] Periksa lebar 320, 360, 390, 430, 768, 1024, 1280, 1440, dan 1920 px; sertakan landscape dengan tinggi sekitar 360 px.
- [ ] Gunakan target sentuh minimal 44 × 44 px untuk kontrol menu dan jarak yang mencegah salah tekan.
- [ ] Cegah scroll horizontal halaman; scrolling lokal seperti chips hanya bila disengaja dan dapat dipahami.
- [ ] Periksa safe area, keyboard virtual, scroll dialog, zoom 200%, serta konten teks panjang.
- [ ] Sediakan focus-visible, nama aksesibel untuk tombol ikon, heading berurutan, dan state pilihan yang diumumkan.
- [ ] Terapkan fokus dialog, Escape, pengembalian fokus, dan pengumuman status yang tidak berulang mengganggu.
- [ ] Targetkan kontras teks normal ≥ 4,5:1 dan kontrol/fokus ≥ 3:1; ukur palet final.
- [ ] Gunakan transisi pendek sekitar 150–220 ms, terutama opacity/transform; hormati prefers-reduced-motion dan hindari animasi dekoratif terus-menerus.
- [ ] Batasi larangan seleksi/context menu ke area yang memerlukannya setelah dampak gameplay diperiksa.

Hasil: pengalaman yang setara pada sentuhan dan keyboard, stabil pada viewport sempit maupun luas. Matriks ini menjadi sampel validasi untuk rentang perangkat, bukan klaim bahwa setiap perangkat telah diuji.

### T07 — State, regresi, dan review akhir (P0; setelah T04–T06)

- [ ] Selaraskan loading/skeleton, empty library, no results, error/retry, offline, dan status sinkronisasi dengan layout final.
- [ ] Pastikan preview tidak dimainkan bersamaan dan tidak berlanjut setelah navigasi.
- [ ] Verifikasi impor, main, edit, duplikasi, pengelolaan difficulty, impor/ekspor chart, relink audio, serta konfirmasi hapus.
- [ ] Periksa toast/banner dan dialog agar tidak menutup CTA atau satu sama lain.
- [ ] Jalankan `npm run lint` dan `npm run build:client`; bedakan kegagalan baru dari baseline.
- [ ] Jalankan `npm run test:sync` bila wiring status/akun/sinkronisasi ikut berubah; jangan memodifikasi layanan hanya untuk memenuhi desain.
- [ ] Tambahkan tes perilaku hanya bila perubahan logika memerlukannya; gunakan pemeriksaan visual untuk perubahan styling.
- [ ] Ambil screenshot akhir pada mobile, tablet, dan desktop; bandingkan baseline dan dokumentasikan hasil serta batasan validasi.

Hasil: UI terverifikasi dan daftar perubahan yang dapat direview.

## Kriteria penerimaan akhir

- [ ] Pengguna dapat mengenali cara memilih lagu, memilih difficulty, dan memulai permainan tanpa tutorial panjang.
- [ ] Satu aksi utama mendominasi tiap konteks; aksi pengelolaan tetap mudah ditemukan.
- [ ] Identitas BeatPulse terbaca sebagai aplikasi musik/game ritme dan konsisten antar pustaka, detail, dan dialog.
- [ ] Layout, ukuran teks, ikon, spacing, border, radius, dan interaksi mengikuti fondasi yang sama.
- [ ] Tidak ada konten/CTA terpotong atau tertutup pada matriks viewport, landscape, dan zoom yang diuji.
- [ ] Keyboard dapat mengakses alur utama dan dialog dengan fokus terlihat; sentuhan tidak bergantung hover.
- [ ] Pencarian/filter dan posisi scroll kembali utuh setelah detail ditutup.
- [ ] Difficulty kustom, judul panjang, data kosong, offline, dan audio tidak tersedia memiliki perilaku yang jelas.
- [ ] Tidak ada regresi baru pada alur audio, gameplay, editor, penyimpanan, dan sinkronisasi yang terkait menu.
- [ ] Pemeriksaan build/lint dan regresi yang relevan dilaporkan dengan hasil sebenarnya.

## Urutan prioritas dan titik review

1. **Fondasi:** T01 → T02 → T03. Review wireframe serta hierarki sebelum membangun komponen.
2. **Pengalaman utama:** T04 → T05, dengan T06 diterapkan selama implementasi. Review preview lokal pustaka dan detail di tiga ukuran layar.
3. **Penyelesaian:** T07 dan kriteria penerimaan. Review bukti validasi serta screenshot final.

P0 adalah syarat pengalaman utama dan stabilitas. P1 mencakup penyempurnaan visual/motion setelah hierarki serta responsivitas berfungsi. Setiap titik review menghasilkan artefak konkret; rencana ini tidak melakukan implementasi, commit, atau deployment.
