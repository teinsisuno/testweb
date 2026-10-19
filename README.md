# 🕌 Jam Jadwal Sholat — PWA Offline-First

Aplikasi jam & jadwal sholat digital untuk **layar masjid / TV**, dibangun sebagai
**Vue 3 SPA** (tanpa build step) + **REST API PHP** + **SQLite**, dan bekerja
**sepenuhnya offline** setelah dibuka sekali.

Tampilan utama dibuat **pixel-perfect** mengikuti desain `tema2.png`
(layar penuh, jam besar, identitas masjid, tanggal Hijriah, hitung mundur
hari besar, bilah jadwal sholat dengan waktu aktif menyala oranye, dan
running text di bagian paling bawah).

---

## ✨ Fitur

### Jadwal & Waktu
- **Sumber utama:** API Kemenag RI (via `api.myquran.com`) — imsak, subuh, syuruq, dhuha, dzuhur, ashar, maghrib, isya.
- **Fallback offline:** mesin hisab sendiri (algoritma PrayTimes) dengan parameter Kemenag (Fajr 20°, Isya 18°, ihtiyat ±2 menit, imsak = subuh − 10 menit, dhuha 7°, koreksi ketinggian tempat).
- **Pengaturan lokasi 3 mode:** pilih Kota (API Kemenag), **Geolokasi perangkat** (reverse-geocode otomatis + pencocokan kota + elevasi), atau koordinat manual.
- **Koreksi per waktu** (menit) untuk seluruh 9 waktu, plus pengaturan ihtiyat, mazhab Ashar, dan koreksi tanggal Hijriah.
- **Sinkronisasi 3 bulan** jadwal ke cache lokal supaya tetap akurat saat internet mati.
- **Arah kiblat & jarak ke Ka'bah** dihitung otomatis dari koordinat.

### Hitung Mundur & Alur Adzan
- **Kartu hitung mundur terpisah** di sisi kanan, tepat di atas bilah jadwal sholat — tidak lagi menempel pada item jadwal.
- Mesin status 4 fase: **Normal → Adzan → Menuju Iqomah → Layar Sholat**.
  - **Normal** — kartu menampilkan `Jadwal berikutnya · <Nama> · -HH:MM:SS`.
  - **Waktu sholat masuk** — kartu menyala oranye bertanda `ADZAN` dan menghitung mundur **adzan → iqomah**.
  - **Iqomah dimulai** — layar menjadi **hitam penuh** dengan tulisan di tengah
    `Harap tenang sedang ibadah sholat <Nama>` selama durasi *Waktu Hening*.
- Durasi iqomah & waktu hening dapat diatur **per waktu sholat**.
- **Peringatan pra-adzan** (mis. 5 menit sebelum) + notifikasi suara.
- **Mode Muadzin / Mode Senyap** — tombol di layar untuk mengaktifkan/mematikan suara adzan.
- Teks layar sholat dapat diubah (placeholder `{prayer}`) dan sisa waktu opsional.

### Hari Besar Islam
- Selalu menampilkan **hitung mundur hari besar Islam terdekat** (mis. `Maulid Nabi Muhammad SAW -90 Hari`).
- Konversi Hijriah (Umm al-Qura) otomatis + opsi tanggal Masehi tetap (SKB Kemenag).
- 11 hari besar bawaan, dapat ditambah/diubah/dinonaktifkan.

### Tampilan
- **Slideshow gambar & video** dengan durasi per item, transisi (fade/geser/zoom), peredupan, dan acak.
- **Running text** di bagian paling bawah (beberapa teks, kecepatan, warna, pemisah).
- Tema warna (aksen, latar bilah, pudar atas, blur), format jam 12/24, detik, tampilkan/sembunyikan Hijriah & Masehi.
- Urutan & nama setiap waktu sholat dapat diatur.
- Sembunyikan kursor saat menganggur, Wake Lock (layar tetap menyala), mode layar penuh.

### Sistem
- **Login** aman (password hash bcrypt, sesi PHP, proteksi brute-force).
- Beberapa pengguna (admin/operator), ubah profil & kata sandi.
- Penyimpanan **SQLite** untuk pengaturan, media, running text, hari besar, cache jadwal, dan log aktivitas.
- **Offline-first**: Service Worker + IndexedDB + fallback cache server.
- Ekspor/impor pengaturan (JSON), unduh basis data, bersihkan cache, optimalkan DB.
- PWA: dapat dipasang (install) ke perangkat.

---

## 🚀 Pemasangan (XAMPP)

1. Letakkan folder ini di `htdocs` (mis. `D:\xampp\htdocs\testweb`).
2. Pastikan ekstensi PHP berikut aktif (biasanya sudah aktif di XAMPP):
   - `pdo_sqlite`, `curl`, `intl`, `mbstring`, `json`
3. Jalankan **Apache** (dan MySQL tidak diperlukan).
4. Buka `http://localhost/testweb/`

Basis data `data/app.sqlite` beserta data bawaan (admin, media, running text, hari besar)
dibuat otomatis saat pertama kali diakses.

> **Catatan:** buka lewat `http://localhost/...`, bukan `file://`, karena
> Service Worker & PWA memerlukan konteks aman (`localhost` sudah dianggap aman).

### Login bawaan
```
Nama pengguna : admin
Kata sandi    : admin123
```
⚠️ **Segera ubah** di menu **Akun & Pengguna** setelah masuk pertama kali.

Akses panel admin: klik ikon ⚙️ di layar utama, atau buka `#/admin`
(atau tekan tombol **S**).

Untuk menguji tampilan tanpa menunggu waktu asli, tambahkan parameter demo:
`index.html?demo=adzan&p=maghrib`, `?demo=iqomah`, atau `?demo=sholat`.

---

## ⌨️ Pintasan Papan Tombol

| Tombol | Fungsi |
|---|---|
| `F` | Layar penuh (toggle) |
| `S` | Buka/tutup panel pengaturan |
| `Esc` | Kembali ke tampilan utama |

---

## 🗂️ Struktur Berkas

```
testweb/
├── index.html                  # Shell SPA (Vue 3)
├── manifest.webmanifest        # Manifest PWA
├── sw.js                       # Service Worker (offline-first)
├── .htaccess                   # MIME, cache, proteksi folder
├── api/                        # REST API PHP + SQLite
│   ├── config.php              # Bootstrap, DB, skema, helper
│   ├── data.php                # Endpoint agregat (bootstrap SPA)
│   ├── auth.php                # Login, sesi, pengguna
│   ├── settings.php            # Baca/simpan/reset pengaturan
│   ├── prayer.php              # Proxy Kemenag + cache + geocode + kiblat
│   ├── media.php               # CRUD + unggah slideshow
│   ├── runningtext.php         # CRUD running text
│   ├── holidays.php            # CRUD + hari besar terdekat
│   ├── system.php              # Info, log, pemeliharaan
│   └── lib/hijri.php           # Pustaka kalender Hijriah
├── assets/
│   ├── css/app.css             # Seluruh gaya (tampilan + admin)
│   ├── vendor/vue.esm-browser.prod.js
│   ├── js/
│   │   ├── main.js             # Router + inisialisasi
│   │   ├── store.js            # State global reaktif
│   │   ├── lib/                # util, api, db, audio, prayer, hijri, schedule, defaults
│   │   └── views/              # Display, Login, Admin + 10 bagian admin
│   ├── img/                    # Ikon PWA & latar slideshow
│   └── audio/                  # adzan.wav, beep.wav, notify.wav
├── data/                       # SQLite + cache (tidak dapat diakses publik)
├── uploads/                    # Media unggahan (tanpa eksekusi skrip)
└── tools/                      # Skrip bantu pengembangan (tidak publik)
```

---

## 🔌 Ringkasan API

| Endpoint | Keterangan |
|---|---|
| `api/data.php?action=bootstrap` | Seluruh data aplikasi dalam satu panggilan |
| `api/auth.php?action=login\|logout\|status\|...` | Autentikasi & pengguna |
| `api/settings.php?action=get\|save\|reset\|export` | Pengaturan |
| `api/prayer.php?action=jadwal\|jadwal_bulan\|sync\|range` | Jadwal sholat + cache |
| `api/prayer.php?action=kota\|kota_all\|geocode\|kiblat` | Lokasi & kiblat |
| `api/media.php?action=list\|upload\|add_url\|update\|delete\|reorder` | Slideshow |
| `api/runningtext.php?action=list\|add\|update\|delete\|reorder` | Running text |
| `api/holidays.php?action=list\|upcoming\|today\|add\|update\|delete\|reset` | Hari besar |
| `api/system.php?action=info\|logs\|clear_cache\|optimize\|db_download` | Sistem |

---

## 📴 Cara Kerja Offline-First

1. **Service Worker** (`sw.js`) menyimpan seluruh "app shell" (HTML, CSS, Vue, semua modul JS, ikon, audio, latar) ke Cache Storage.
2. **IndexedDB** menyimpan salinan respons API (pengaturan, media, running text, hari besar) dan jadwal sholat per bulan.
3. **Server** juga menyimpan cache di disk dan di tabel `prayer_cache` SQLite, sehingga bila internet bermasalah data lama tetap tersaji.
4. Saat offline:
   - Tampilan memakai jadwal dari cache; bila tanggal belum tercache, jadwal **dihitung sendiri** oleh mesin hisab.
   - Perubahan pengaturan disimpan lokal lalu **disinkronkan otomatis** saat kembali online.

---

## 🖥️ Tips Pemasangan di TV / Android

- Gunakan **Chrome/Edge**, tekan `F` untuk layar penuh, dan aktifkan **kiosk mode**.
- Klik sekali pada layar agar audio adzan diizinkan browser (kebijakan autoplay).
- Pada perangkat Android, gunakan menu **“Tambahkan ke layar utama / Install app”**.
- Agar suara keluar otomatis tanpa interaksi, jalankan browser dengan mode kiosk/`--autoplay-policy=no-user-gesture-required`.

### Batas unggahan media
Default PHP XAMPP = 40 MB. Untuk video besar, ubah `php.ini`:
```ini
upload_max_filesize = 256M
post_max_size = 260M
max_execution_time = 300
```
`.htaccess` sudah menyertakan pengaturan ini bila `mod_php` aktif.

---

## 🔧 Pemecahan Masalah

| Masalah | Solusi |
|---|---|
| Tidak ada suara adzan | Klik layar sekali (kebijakan autoplay), pastikan **Mode Muadzin** aktif, dan volume di menu Audio & Adzan |
| Jadwal tidak sesuai | Cek kota/koordinat di **Masjid & Lokasi**, lalu **Muat dari API Kemenag** di **Jadwal Sholat** |
| Selisih 1–2 menit saat offline | Sesuaikan **Koreksi (menit)** per waktu atau **Ketinggian (m dpl)** |
| Hari besar bergeser 1 hari | Sesuaikan **Koreksi Tanggal Hijriah** atau isi **Tanggal Masehi Tetap** |
| Perubahan tidak muncul | Tekan **Simpan Perubahan** (bilah bawah), lalu segarkan pratinjau |
| Halaman 500 | Pastikan `pdo_sqlite` & `intl` aktif; hapus `data/app.sqlite` untuk membangun ulang |
| Layar hitam tidak muncul | Isi kolom **Waktu Hening** (mis. 10 menit) pada menu **Iqomah & Hening**, dan pastikan **Layar Waktu Sholat** aktif di **Tema & Layout** |
| Ingin ulang total | Hapus `data/app.sqlite`, muat ulang halaman (kembali ke pengaturan bawaan) |

---

## 🧪 Perkakas Pengembangan (`tools/`)

- `generate-assets.php` — membuat ulang ikon, latar slideshow, dan berkas audio.
  ```bash
  php tools/generate-assets.php
  ```
- `check-console.mjs`, `shot-cdp.cjs`, `shot-admin.cjs`, `eval-cdp.mjs` —
  pemeriksaan konsol & tangkapan layar via Chrome DevTools Protocol (untuk uji otomatis).

Folder `tools/` ditolak dari akses web melalui `.htaccess`.

---

## 📄 Lisensi & Kredit

- Algoritma perhitungan waktu sholat berdasarkan **PrayTimes.org**.
- Data jadwal dari **API MyQuran / Kemenag RI**.
- Geocoding oleh **OpenStreetMap Nominatim**; elevasi oleh **Open-Meteo**.
- Kalender Hijriah memakai **Umm al-Qura** melalui `Intl`.
