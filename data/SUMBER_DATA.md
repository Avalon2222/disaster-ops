# Sumber data

Semua data di Disaster Ops berasal dari sumber publik. Berkas ini mencatat dari mana tiap lapisan diambil, lisensinya,
bagaimana diolah, dan batasannya. Kalau ada yang keliru atau usang, itu bug: silakan buka issue.

## Data live (diambil server saat diminta)

| Lapisan | Sumber | Alamat | Lisensi / ketentuan | Diolah di |
|---|---|---|---|---|
| Titik panas | NASA FIRMS, VIIRS NOAA-20 & NOAA-21 (375 m) dan MODIS Terra/Aqua (1 km), near real-time | `firms.modaps.eosdis.nasa.gov/data/active_fire/...SouthEast_Asia_24h.csv` dan `_7d.csv`; dengan `FIRMS_MAP_KEY`: area API | Data NASA bebas dipakai, dengan atribusi ke FIRMS / LANCE | `src/lib/sumber/firms.ts` |
| Gempa | BMKG InaTEWS: daftar real-time, gempa dirasakan, peringatan tsunami | `bmkg-content-inatews.storage.googleapis.com` (`gempaQL.json`, `last30feltevent.xml`, `last30tsunamievent.xml`) | Data BMKG, wajib mencantumkan BMKG sebagai sumber | `src/lib/sumber/gempa.ts` |
| Gempa | USGS FDSN Event, M2,5+ di kotak 91-143 BT, 13 LS - 9 LU | `earthquake.usgs.gov/fdsnws/event/1/query` | Domain publik (USGS) | `src/lib/sumber/gempa.ts` |
| Gunung api | MAGMA Indonesia (PVMBG, Badan Geologi), tabel "Tingkat Aktivitas" | `magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas` | Informasi publik; tidak ada API resmi, jadi halamannya yang dibaca | `src/lib/sumber/magma.ts` |
| Kejadian bencana | BNPB, layanan ArcGIS "Kejadian Bencana Mingguan" | `gis.bnpb.go.id/server/rest/services/Kejadian_Bencana_Mingguan` | Data BNPB, cantumkan sumber | `src/lib/sumber/bencana.ts` |
| Laporan warga | PetaBencana.id (Yayasan Peta Bencana), laporan 7 hari | `data.petabencana.id/reports` | CC BY 4.0 | `src/lib/sumber/bencana.ts` |
| Peringatan dini cuaca | BMKG nowcast, format CAP | `www.bmkg.go.id/alerts/nowcast/id` | Dinyatakan *public domain* di feed-nya | `src/lib/sumber/peringatan.ts` |
| Peta bahaya | InaRISK BNPB (gempa, tsunami, banjir, longsor, karhutla, gunung api) | `gis.bnpb.go.id/server/rest/services/inarisk/...ImageServer` | Data BNPB, cantumkan sumber | `src/app/api/inarisk` |
| Citra harian | NASA GIBS, VIIRS Corrected Reflectance (True Color) | `gibs.earthdata.nasa.gov/wmts/epsg3857/best/` | Bebas dipakai, atribusi NASA GIBS / ESDIS | `src/lib/peta/pasang.ts` |
| Rute jalan | Server demo OSRM di atas OpenStreetMap | `router.project-osrm.org` | Data ODbL; server tanpa jaminan layanan, hanya untuk pemakaian ringan | `src/lib/rute.ts` |
| Peta dasar | OpenFreeMap (OpenMapTiles, OpenStreetMap); mode SAT dari Esri World Imagery | `tiles.openfreemap.org`, `server.arcgisonline.com` | ODbL untuk data OSM; citra © Esri dan pemasoknya | `src/lib/peta/mapStyle.ts` |

Catatan:

- Server BMKG menolak permintaan tanpa User-Agent peramban, jadi route API mengirim User-Agent biasa.
- Server ArcGIS BNPB tidak mengirim header CORS, jadi ubin InaRISK diteruskan lewat `/api/inarisk`.
- Kalau sebuah sumber gagal, route melayani jawaban terakhir yang berhasil; kalau belum pernah berhasil, browser
  menerima `{ "galat": "upstream" }` dan lapisannya ditandai `DOWN`.

## Prakiraan (dibangun GitHub Actions tiap 6 jam ke cabang `data`)

Semua dari [Open-Meteo](https://open-meteo.com) (CC BY 4.0, gratis untuk pemakaian non-komersial, tanpa kunci).
Skripnya `scripts/bangun_cuaca.ts`, bentuk berkasnya `SnapshotCuaca` di `src/lib/jenis.ts`.

| Isi | Model asal | Grid di sini | Catatan |
|---|---|---|---|
| Angin 10 m dan 850 hPa, suhu 2 m, hujan | Model global/regional pilihan Open-Meteo (ECMWF IFS, GFS, ICON) | 702 titik, 90-147 BT, 15 LS - 10,5 LU, tiap 1,5°; 25 langkah per 3 jam | Nilai titik, bukan rata-rata sel. Hujan dijumlah per 3 jam |
| PM2.5 | CAMS global (ECMWF) | sama | Resolusi asli ~0,4°; asap karhutla sering terlalu rendah di model |
| FWI dan hujan harian | Suhu maksimum, RH minimum, angin rata-rata, hujan harian | 307 sel darat di grid 1° (95-141 BT, 11 LS - 6 LU) | FWI resmi memakai cuaca tengah hari; di sini suhu maks + RH min, jadi cenderung sedikit lebih tinggi. Dihitung dari 30 hari riwayat |
| Debit sungai | GloFAS v4 (Copernicus) lewat Open-Meteo Flood API | 22 titik (`data/sungai.csv`) | Model, bukan pengukuran. Persentil dari deret 1991-2020 sel yang sama |

Titik sungai dicari oleh `scripts/kalibrasi_sungai.py`: dari koordinat kota (`data/sungai_awal.csv`) dicari sel GloFAS
berdebit terbesar di sekitarnya. Kapuas diambil di Sanggau dan Barito di Marabahan karena di muara sel alur utamanya
tidak ketemu; debit Barito tetap terlalu kecil dibanding pengukuran, jadi baca statusnya (dibanding klimatologi sel
itu sendiri), bukan angka mutlaknya.

## Data statis (dibangun `scripts/bangun_data.py`, hasilnya di `public/data`)

| Berkas | Isi | Sumber | Lisensi | Pengolahan |
|---|---|---|---|---|
| `batimetri.dat` | Kedalaman laut dan tinggi daratan, 826 × 406 sel Int16 (meter) | [ETOPO 2022](https://www.ncei.noaa.gov/products/etopo-global-relief-model) 15 detik busur, NOAA NCEI, lewat ERDDAP PIFSC | Domain publik (NOAA) | Diambil tiap 16 sel (4 menit busur, ~7,4 km), 90-145 BT, 15 LS - 12 LU |
| `populasi.dat` | Penduduk per sel 0,05°, 921 × 342 sel Uint16 | [WorldPop](https://www.worldpop.org) 2020, 1 km, UN-adjusted, Indonesia | CC BY 4.0 | 6 × 6 sel dijumlah; disimpan sebagai `round(sqrt(n) × 60)`. Total 273,5 juta sebelum dan sesudah kuantisasi |
| `rs.json` | 1.285 rumah sakit: lon, lat, nama | OpenStreetMap (`amenity=hospital`) lewat Overpass API | ODbL | Titik berimpit dibuang. Belum lengkap: Indonesia punya ~3.000 rumah sakit |
| `sesar.geojson` | 322 sesar aktif | [GEM Global Active Faults](https://github.com/GEMScienceTools/gem-global-active-faults) | CC BY-SA 4.0 | Dipotong ke kotak Indonesia, koordinat 3 desimal |
| `sesar.geojson` | 17 segmen zona subduksi | Bird (2003), PB2002, lewat [fraxen/tectonicplates](https://github.com/fraxen/tectonicplates) | ODC PDDL | Hanya batas bertipe subduksi |
| `gempa_historis.json` | 1.829 gempa M6+ sejak 1900 | Katalog USGS (ComCat) | Domain publik | lon, lat, kedalaman, magnitudo, tahun, tempat |
| `karhutla2019.dat` | 74.025 deteksi api 1 Jul - 30 Nov 2019, 6 byte per titik | NASA FIRMS, arsip MODIS C6.1 per negara | Bebas dipakai, atribusi FIRMS | Hanya tipe 0 (api vegetasi) dengan keyakinan ≥ 30 % |
| `provinsi.geojson` | Batas 38 provinsi (disederhanakan) | [Indonesia GeoJSON & TopoJSON Maps (38 Provinces)](https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces) oleh Deny Herianto | CC BY 4.0 | Koordinat 4 desimal. Dipakai untuk membuang titik panas di laut dan meringkas per provinsi |
| `gunung.json` | 69 gunung api: nama, koordinat, ketinggian | Smithsonian Global Volcanism Program | Bebas dipakai dengan atribusi | Dari `data/gunung_api.csv` |
| `kota.json` | 418 kota: 98 kota utama + ibu kota kabupaten | Kurasi sendiri (`data/kota.csv`) dan Wikipedia/Wikidata (`data/ibukota_kabupaten.csv`) | CC BY-SA untuk bagian Wikipedia | Kota berimpit digabung. Koordinat pusat kota, 2-4 desimal |
| `cuaca.json` | Salinan snapshot prakiraan | Open-Meteo | CC BY 4.0 | Cadangan kalau cabang `data` tidak terjangkau |

## Model dan rumus

| Model | Rujukan |
|---|---|
| Fire Weather Index | Van Wagner, C.E. & Pickett, T.L. (1985). *Equations and FORTRAN program for the Canadian Forest Fire Weather Index System*. Canadian Forestry Service, Forestry Technical Report 33. Faktor panjang hari khatulistiwa mengikuti paket `cffdrs`. Kelas bahaya (1 / 6 / 13) mengikuti FDRS Indonesia-Malaysia |
| Intensitas guncangan | Allen, T.I., Wald, D.J. & Worden, C.B. (2012). Intensity attenuation for active crustal regions. *Journal of Seismology* 16, 409-433 (model jarak ke bidang patahan) |
| Ukuran patahan | Wells, D.L. & Coppersmith, K.J. (1994). New empirical relationships among magnitude, rupture length, rupture width, rupture area, and surface displacement. *BSSA* 84(4), 974-1002 |
| Waktu tempuh tsunami | Kecepatan gelombang panjang √(g·h); lintasan tercepat dengan algoritma Dijkstra di grid batimetri |
| Tinggi tsunami (kasar) | Abe, K. (1995). Estimate of tsunami run-up heights from earthquake magnitudes. Dalam *Tsunami: Progress in Prediction, Disaster Prevention and Warning*, Kluwer |
| Ambang hujan | Kategori BMKG: > 50 mm/hari lebat, > 100 sangat lebat, > 150 ekstrem |

## Tonggak karhutla 2019

Narasi putar ulang (`src/lib/skenario.ts`) memakai angka yang sudah dipublikasikan:

- Luas terbakar 2019 sekitar 1,65 juta hektare: rekapitulasi SiPongi, Kementerian Lingkungan Hidup dan Kehutanan.
- Kerugian sekitar US$5,2 miliar: World Bank (2019), *Indonesia Economic Quarterly: Investing in People*, Desember 2019.
- Lebih dari 900 ribu penderita ISPA: keterangan BNPB, 23 September 2019.
- Langit merah di Muaro Jambi, 21 September 2019: penjelasan BMKG (hamburan Mie oleh partikel asap).

## Penafian

Disaster Ops adalah alat pantau dan belajar, bukan sistem peringatan dini dan bukan produk resmi lembaga mana pun.
Untuk keputusan keselamatan, ikuti BMKG, PVMBG, BNPB, dan BPBD setempat.
