/** Skenario siap pakai untuk simulasi tsunami dan guncangan. Episenter dan magnitudo dari katalog USGS. */

export interface PrasetTsunami {
  id: string;
  nama: { id: string; en: string };
  catatan: { id: string; en: string };
  lon: number;
  lat: number;
  mag: number;
  dalam: number;
  /** true = kejadian nyata, false = hipotetis */
  nyata: boolean;
}

export const PRASET_TSUNAMI: PrasetTsunami[] = [
  { id: "aceh2004", nyata: true, lon: 95.98, lat: 3.3, mag: 9.1, dalam: 30, nama: { id: "Aceh 2004", en: "Aceh 2004" }, catatan: { id: "26 Des 2004. Gelombang pertama tiba di Banda Aceh sekitar 20-30 menit.", en: "26 Dec 2004. First waves reached Banda Aceh in roughly 20-30 minutes." } },
  { id: "nias2005", nyata: true, lon: 97.11, lat: 2.09, mag: 8.6, dalam: 30, nama: { id: "Nias 2005", en: "Nias 2005" }, catatan: { id: "28 Mar 2005, tiga bulan setelah Aceh.", en: "28 Mar 2005, three months after Aceh." } },
  { id: "pangandaran2006", nyata: true, lon: 107.42, lat: -9.28, mag: 7.7, dalam: 20, nama: { id: "Pangandaran 2006", en: "Pangandaran 2006" }, catatan: { id: "17 Jul 2006. Gempa 'tsunami earthquake': guncangan lemah, gelombang besar.", en: "17 Jul 2006. A 'tsunami earthquake': weak shaking, large waves." } },
  { id: "mentawai2010", nyata: true, lon: 100.08, lat: -3.49, mag: 7.8, dalam: 20, nama: { id: "Mentawai 2010", en: "Mentawai 2010" }, catatan: { id: "25 Okt 2010. Tiba di Pagai Selatan kurang dari 10 menit.", en: "25 Oct 2010. Reached South Pagai in under 10 minutes." } },
  { id: "palu2018", nyata: true, lon: 119.85, lat: -0.26, mag: 7.5, dalam: 20, nama: { id: "Palu 2018", en: "Palu 2018" }, catatan: { id: "28 Sep 2018. Tsunami aslinya dipicu longsor bawah laut di teluk, lebih cepat dari hitungan ini.", en: "28 Sep 2018. The real tsunami came from submarine landslides in the bay, faster than this estimate." } },
  { id: "flores1992", nyata: true, lon: 121.9, lat: -8.48, mag: 7.8, dalam: 28, nama: { id: "Flores 1992", en: "Flores 1992" }, catatan: { id: "12 Des 1992. Maumere dan Pulau Babi luluh lantak.", en: "12 Dec 1992. Maumere and Babi Island devastated." } },
  { id: "banyuwangi1994", nyata: true, lon: 112.84, lat: -10.48, mag: 7.8, dalam: 18, nama: { id: "Banyuwangi 1994", en: "Banyuwangi 1994" }, catatan: { id: "2 Jun 1994, dini hari.", en: "2 Jun 1994, before dawn." } },
  { id: "biak1996", nyata: true, lon: 136.95, lat: -0.89, mag: 8.2, dalam: 33, nama: { id: "Biak 1996", en: "Biak 1996" }, catatan: { id: "17 Feb 1996.", en: "17 Feb 1996." } },
  { id: "sunda", nyata: false, lon: 104.6, lat: -7.3, mag: 8.7, dalam: 20, nama: { id: "Megathrust Selat Sunda", en: "Sunda Strait megathrust" }, catatan: { id: "Hipotetis: segmen yang belum pecah di selatan Selat Sunda.", en: "Hypothetical: the unruptured segment south of the Sunda Strait." } },
  { id: "siberut", nyata: false, lon: 98.6, lat: -1.4, mag: 8.9, dalam: 25, nama: { id: "Megathrust Mentawai-Siberut", en: "Mentawai-Siberut megathrust" }, catatan: { id: "Hipotetis: celah seismik di depan Padang.", en: "Hypothetical: the seismic gap facing Padang." } },
  { id: "jawaselatan", nyata: false, lon: 110.3, lat: -9.3, mag: 8.8, dalam: 20, nama: { id: "Megathrust selatan Jawa", en: "South Java megathrust" }, catatan: { id: "Hipotetis: skenario terburuk untuk pantai selatan Jawa.", en: "Hypothetical: worst case for Java's south coast." } },
];

export interface PrasetGempa {
  id: string;
  nama: string;
  lon: number;
  lat: number;
  mag: number;
  dalam: number;
}

/** Sesar darat dekat kota besar: tempat yang paling sering ditanyakan "kalau di sini gimana?". */
export const PRASET_GEMPA: PrasetGempa[] = [
  { id: "lembang", nama: "Sesar Lembang · Bandung", lon: 107.62, lat: -6.83, mag: 6.8, dalam: 10 },
  { id: "baribis", nama: "Sesar Baribis · Jakarta", lon: 106.95, lat: -6.33, mag: 6.5, dalam: 10 },
  { id: "opak", nama: "Sesar Opak · Yogyakarta", lon: 110.45, lat: -7.96, mag: 6.4, dalam: 12 },
  { id: "kendeng", nama: "Sesar Kendeng · Surabaya", lon: 112.7, lat: -7.25, mag: 6.5, dalam: 10 },
  { id: "semangko", nama: "Sesar Sumatra · Padang Panjang", lon: 100.4, lat: -0.47, mag: 7.0, dalam: 10 },
  { id: "palukoro", nama: "Sesar Palu-Koro · Palu", lon: 119.86, lat: -0.9, mag: 7.4, dalam: 10 },
];

/** Tonggak karhutla 2019 untuk narasi putar ulang (sumber: KLHK, BNPB, Bank Dunia; rincian di data/SUMBER_DATA.md). */
export const TONGGAK_2019: { tanggal: string; id: string; en: string }[] = [
  { tanggal: "2019-07-01", id: "Awal kemarau. El Nino lemah dan Dipole Mode positif mengeringkan Sumatra dan Kalimantan.", en: "Dry season begins. A weak El Nino and a positive Indian Ocean Dipole dry out Sumatra and Kalimantan." },
  { tanggal: "2019-08-05", id: "Titik panas mulai menumpuk di lahan gambut Riau, Jambi, dan Kalimantan Tengah.", en: "Hotspots start to pile up on the peatlands of Riau, Jambi and Central Kalimantan." },
  { tanggal: "2019-09-10", id: "Asap menyeberang ke Malaysia dan Singapura. Ribuan sekolah diliburkan.", en: "Haze crosses into Malaysia and Singapore. Thousands of schools close." },
  { tanggal: "2019-09-21", id: "Langit Muaro Jambi berubah merah di siang hari karena asap pekat.", en: "The midday sky over Muaro Jambi turns red under dense smoke." },
  { tanggal: "2019-09-23", id: "BNPB mencatat lebih dari 900 ribu warga terkena ISPA.", en: "BNPB counts more than 900 thousand people with respiratory infections." },
  { tanggal: "2019-10-25", id: "Hujan mulai turun. Titik panas berangsur padam.", en: "Rains return. Hotspots begin to die down." },
  { tanggal: "2019-11-30", id: "Total 2019: sekitar 1,65 juta hektare terbakar (KLHK), kerugian sekitar US$5,2 miliar (Bank Dunia).", en: "2019 total: about 1.65 million hectares burned (KLHK), losses around US$5.2 billion (World Bank)." },
];
