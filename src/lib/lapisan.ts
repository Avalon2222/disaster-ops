/**
 * Daftar lapisan peta. Menambah lapisan baru: satu entri di sini, satu pemasang di peta/pasang.ts,
 * dan (kalau perlu) satu ikon di components/RelLapisan.tsx.
 */

export type IdLapisan =
  | "hotspot"
  | "gempa"
  | "gunung"
  | "bencana"
  | "laporan"
  | "peringatan"
  | "angin"
  | "hujan"
  | "suhu"
  | "udara"
  | "citra"
  | "fwi"
  | "asap"
  | "banjir"
  | "sungai"
  | "sesar"
  | "inarisk"
  | "penduduk"
  | "rs";

export type Grup = "live" | "atmosfer" | "prakiraan" | "bahaya";
export const GRUP_URUT: Grup[] = ["live", "atmosfer", "prakiraan", "bahaya"];

export interface DefLapisan {
  id: IdLapisan;
  /** tombol keyboard (posisi fisik keyboard US, dicocokkan lewat event.code) */
  tombol: string;
  kode: string;
  grup: Grup;
  jenis: "live" | "prakiraan" | "statis";
  warna: string;
  nama: { id: string; en: string };
  deskripsi: { id: string; en: string };
  /** nyala saat pertama dibuka */
  awal?: boolean;
  /** lapisan medan (raster penuh layar): hanya satu yang boleh nyala sekaligus */
  medan?: boolean;
  /** memakai lini masa: "jam" = 0-72 jam per 3 jam, "hari" = 8 hari */
  waktu?: "jam" | "hari";
}

export const LAPISAN: DefLapisan[] = [
  { id: "hotspot", tombol: "1", kode: "Digit1", grup: "live", jenis: "live", warna: "#ff5d2e", awal: true, nama: { id: "Titik panas", en: "Fire hotspots" }, deskripsi: { id: "NASA FIRMS, VIIRS + MODIS", en: "NASA FIRMS, VIIRS + MODIS" } },
  { id: "gempa", tombol: "2", kode: "Digit2", grup: "live", jenis: "live", warna: "#ffc857", awal: true, nama: { id: "Gempa", en: "Earthquakes" }, deskripsi: { id: "BMKG + USGS, 7 hari", en: "BMKG + USGS, 7 days" } },
  { id: "gunung", tombol: "3", kode: "Digit3", grup: "live", jenis: "live", warna: "#f87171", awal: true, nama: { id: "Gunung api", en: "Volcanoes" }, deskripsi: { id: "Level aktivitas PVMBG", en: "PVMBG alert levels" } },
  { id: "bencana", tombol: "4", kode: "Digit4", grup: "live", jenis: "live", warna: "#c084fc", awal: true, nama: { id: "Kejadian BNPB", en: "BNPB incidents" }, deskripsi: { id: "Rekap mingguan per kabupaten", en: "Weekly recap by regency" } },
  { id: "laporan", tombol: "5", kode: "Digit5", grup: "live", jenis: "live", warna: "#22d3ee", nama: { id: "Laporan warga", en: "Citizen reports" }, deskripsi: { id: "PetaBencana.id, 7 hari", en: "PetaBencana.id, 7 days" } },
  { id: "peringatan", tombol: "6", kode: "Digit6", grup: "live", jenis: "live", warna: "#fbbf24", awal: true, nama: { id: "Peringatan cuaca", en: "Weather warnings" }, deskripsi: { id: "Nowcast BMKG yang berlaku", en: "Active BMKG nowcasts" } },

  { id: "angin", tombol: "7", kode: "Digit7", grup: "atmosfer", jenis: "prakiraan", warna: "#7dd3fc", awal: true, waktu: "jam", nama: { id: "Angin", en: "Wind" }, deskripsi: { id: "Partikel angin 10 m", en: "10 m wind particles" } },
  { id: "hujan", tombol: "8", kode: "Digit8", grup: "atmosfer", jenis: "prakiraan", warna: "#60a5fa", medan: true, waktu: "jam", nama: { id: "Hujan", en: "Rain" }, deskripsi: { id: "mm per 3 jam", en: "mm per 3 hours" } },
  { id: "suhu", tombol: "9", kode: "Digit9", grup: "atmosfer", jenis: "prakiraan", warna: "#fb923c", medan: true, waktu: "jam", nama: { id: "Suhu", en: "Temperature" }, deskripsi: { id: "Suhu udara 2 m", en: "2 m air temperature" } },
  { id: "udara", tombol: "0", kode: "Digit0", grup: "atmosfer", jenis: "prakiraan", warna: "#a3e635", medan: true, waktu: "jam", nama: { id: "Kualitas udara", en: "Air quality" }, deskripsi: { id: "PM2.5 dari CAMS", en: "PM2.5 from CAMS" } },
  { id: "citra", tombol: "-", kode: "Minus", grup: "atmosfer", jenis: "live", warna: "#e5e7eb", nama: { id: "Citra kemarin", en: "Yesterday from orbit" }, deskripsi: { id: "VIIRS warna asli, NASA GIBS", en: "VIIRS true color, NASA GIBS" } },

  { id: "fwi", tombol: "Q", kode: "KeyQ", grup: "prakiraan", jenis: "prakiraan", warna: "#f97316", medan: true, waktu: "hari", nama: { id: "Risiko karhutla", en: "Fire danger" }, deskripsi: { id: "Fire Weather Index, 8 hari", en: "Fire Weather Index, 8 days" } },
  { id: "asap", tombol: "E", kode: "KeyE", grup: "prakiraan", jenis: "prakiraan", warna: "#d6d3d1", waktu: "jam", nama: { id: "Arah asap", en: "Smoke drift" }, deskripsi: { id: "Lintasan 48 jam dari titik panas", en: "48 h trajectories from fires" } },
  { id: "banjir", tombol: "B", kode: "KeyB", grup: "prakiraan", jenis: "prakiraan", warna: "#38bdf8", medan: true, waktu: "hari", nama: { id: "Risiko banjir", en: "Flood risk" }, deskripsi: { id: "Dari prakiraan hujan 3 hari", en: "From 3-day rain forecast" } },
  { id: "sungai", tombol: "V", kode: "KeyV", grup: "prakiraan", jenis: "prakiraan", warna: "#2dd4bf", nama: { id: "Debit sungai", en: "River discharge" }, deskripsi: { id: "Prakiraan GloFAS, 22 sungai", en: "GloFAS forecast, 22 rivers" } },

  { id: "sesar", tombol: "Z", kode: "KeyZ", grup: "bahaya", jenis: "statis", warna: "#f43f5e", awal: true, nama: { id: "Sesar & megathrust", en: "Faults & megathrust" }, deskripsi: { id: "Plus gempa M6+ sejak 1900", en: "Plus M6+ quakes since 1900" } },
  { id: "inarisk", tombol: "X", kode: "KeyX", grup: "bahaya", jenis: "statis", warna: "#e879f9", medan: true, nama: { id: "Peta bahaya InaRISK", en: "InaRISK hazard maps" }, deskripsi: { id: "BNPB: gempa, tsunami, banjir, ...", en: "BNPB: quake, tsunami, flood, ..." } },
  { id: "penduduk", tombol: "N", kode: "KeyN", grup: "bahaya", jenis: "statis", warna: "#fde68a", medan: true, nama: { id: "Kepadatan penduduk", en: "Population density" }, deskripsi: { id: "WorldPop 2020, sel 5 km", en: "WorldPop 2020, 5 km cells" } },
  { id: "rs", tombol: "H", kode: "KeyH", grup: "bahaya", jenis: "statis", warna: "#34d399", nama: { id: "Rumah sakit", en: "Hospitals" }, deskripsi: { id: "OpenStreetMap", en: "OpenStreetMap" } },
];

export const ID_LAPISAN = LAPISAN.map((l) => l.id);
export const LAPISAN_AWAL: IdLapisan[] = LAPISAN.filter((l) => l.awal).map((l) => l.id);
export const LAPISAN_MEDAN: IdLapisan[] = LAPISAN.filter((l) => l.medan).map((l) => l.id);

export function defLapisan(id: IdLapisan): DefLapisan {
  return LAPISAN.find((l) => l.id === id)!;
}

/** Nyalakan/matikan satu lapisan; lapisan medan saling menggantikan. */
export function toggleLapisan(aktif: Set<IdLapisan>, id: IdLapisan): Set<IdLapisan> {
  const baru = new Set(aktif);
  if (baru.has(id)) {
    baru.delete(id);
    return baru;
  }
  if (defLapisan(id).medan) for (const m of LAPISAN_MEDAN) baru.delete(m);
  baru.add(id);
  return baru;
}

/** Lapisan medan yang sedang nyala (kalau ada). */
export function medanAktif(aktif: Set<IdLapisan>): IdLapisan | null {
  for (const m of LAPISAN_MEDAN) if (aktif.has(m)) return m;
  return null;
}

/** Satuan lini masa yang dipakai kombinasi lapisan aktif: medan harian menang, lalu yang per jam. */
export function modeWaktu(aktif: Set<IdLapisan>): "jam" | "hari" | null {
  const m = medanAktif(aktif);
  if (m && defLapisan(m).waktu === "hari") return "hari";
  for (const l of LAPISAN) if (aktif.has(l.id) && l.waktu === "jam") return "jam";
  return null;
}

export const JENIS_INARISK = ["gempa", "tsunami", "banjir", "longsor", "karhutla", "gunungapi"] as const;
export type JenisInarisk = (typeof JENIS_INARISK)[number];
