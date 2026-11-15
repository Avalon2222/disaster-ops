# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/), versi mengikuti [SemVer](https://semver.org/lang/id/).

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
