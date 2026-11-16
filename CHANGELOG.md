# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/), versi mengikuti [SemVer](https://semver.org/lang/id/).

## [1.1.0] - 2026-11-16

### Diubah

- Angin, hujan, kabut PM2.5, dan asap pindah ke satu kanvas efek yang digambar ulang tiap frame dari koordinat
  geografis: gak ada lagi lapisan yang hilang waktu peta digeser atau di-zoom, dan tepinya memudar membulat, bukan
  terpotong kotak.
- Hujan sekarang rintik yang jatuh di tempat prakiraannya, PM2.5 kabut yang hanyut bersama angin; medan suhu dan
  FWI dibuat lebih tipis supaya yang menonjol hanya yang menyimpang. Kota-kota utama menampilkan angkanya.
- Ikon baru digambar sendiri: palang untuk rumah sakit, glif per jenis bencana untuk kejadian BNPB dan laporan
  warga, gelombang untuk sungai, segitiga berasap untuk gunung api.
- Sesar dan megathrust: 17 potongan zona subduksi dirangkai jadi 6 garis bergigi yang mengalir; klik garisnya dan
  garis itu sendiri yang menyala. Jejak GEM yang kembar dengan megathrust dibuang.
- Peta bahaya InaRISK jadi satu gambar per jenis dengan palet sendiri, muncul dan hilang dengan memudar. Pilihan
  jenisnya jadi tombol, lengkap dengan legenda rendah-sedang-tinggi.
- Sesar & megathrust ikut nyala sejak awal.
- Gerak partikel dihitung dari waktu, bukan jumlah frame: lajunya sama di layar 30, 60, maupun 120 Hz, dan jumlah
  partikel turun sendiri kalau perangkatnya keteteran.
- Gempa historis baru bisa diklik setelah peta didekati (zoom 5 ke atas), supaya ketukan di tempat kosong gak nyasar.

### Ditambahkan

- Tooltip saat kursor di atas objek peta, riak di gempa 24 jam terakhir, bidikan berdenyut di objek terpilih.
- Tahap `inarisk` di `scripts/bangun_data.py`.

### Diperbaiki

- Rumah sakit cuma tampil di Sumatra dan Jawa bagian barat (jawaban Overpass terpotong): sekarang 3.567 rumah sakit
  se-Indonesia dari ekspor HOT.
- Partikel angin dibersihkan lalu ditabur ulang tiap kali peta bergerak, termasuk waktu tombol "Kembali ke
  Indonesia" ditekan.

### Dihapus

- Proxy ubin `/api/inarisk`.

## [1.0.0] - 2026-11-15

Rilis pertama.

### Ditambahkan

- Globe MapLibre dengan 19 lapisan: titik panas FIRMS, gempa BMKG + USGS, gunung api PVMBG, kejadian BNPB, laporan
  warga PetaBencana, peringatan dini cuaca BMKG, angin (partikel), hujan, suhu, PM2.5, citra harian GIBS, risiko
  karhutla (FWI), arah asap, risiko banjir, debit sungai, sesar & megathrust, peta bahaya InaRISK, kepadatan penduduk,
  rumah sakit.
- War Room: SITREP harian otomatis dengan tingkat ancaman per bahaya dan briefing sinematik.
- Skenario guncangan: cincin MMI, penduduk terpapar per kelas intensitas, rumah sakit, rute.
- Simulasi tsunami: waktu tempuh di batimetri ETOPO 2022, waktu tiba per kota pesisir, rute ke dataran tinggi,
  11 skenario siap pakai.
- Putar ulang karhutla 2019 (1 Juli - 30 November) dengan citra satelit harian.
- Lini masa prakiraan 72 jam dan 8 hari; snapshot dibangun GitHub Actions tiap 6 jam.
- Pencarian kota, gunung api, provinsi, dan sungai; dua bahasa (ID/EN); tautan yang menyimpan tampilan.
- 117 tes unit dan tes browser di 360, 390, 412, dan 1440 px.
