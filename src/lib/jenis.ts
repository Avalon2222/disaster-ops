/** Bentuk data yang dipakai bersama server (route API) dan browser. */

/** Titik panas: [lon, lat, FRP (MW), keyakinan 0..2, waktu (menit sejak epoch), indeks provinsi (-1 = tak dikenal), indeks satelit] */
export type TitikPanas = [number, number, number, number, number, number, number];

export interface DataHotspot {
  diperbarui: number;
  /** "csv" = berkas terbuka FIRMS, "api" = FIRMS area API dengan MAP_KEY */
  sumber: "csv" | "api";
  jam: 24 | 168;
  satelit: string[];
  provinsi: string[];
  titik: TitikPanas[];
}

export interface Gempa {
  id: string;
  sumber: "BMKG" | "USGS";
  waktu: number;
  lon: number;
  lat: number;
  dalam: number;
  mag: number;
  tempat: string;
  /** teks MMI dari BMKG, mis. "III Ruteng, II Labuan Bajo" */
  dirasakan?: string;
  potensi?: string;
  /** gambar shakemap BMKG */
  shakemap?: string;
  tsunami?: boolean;
  url?: string;
}

export interface DataGempa {
  diperbarui: number;
  sumber: string[];
  gempa: Gempa[];
}

export interface GunungApi {
  nama: string;
  lat: number;
  lon: number;
  elevasi: number;
  provinsi: string;
  /** 1 Normal, 2 Waspada, 3 Siaga, 4 Awas, 0 belum diketahui */
  level: number;
  url?: string;
}

export interface DataGunung {
  diperbarui: number;
  /** false kalau MAGMA tidak terjangkau dan level tidak diketahui */
  live: boolean;
  gunung: GunungApi[];
}

export interface KejadianBnpb {
  id: string;
  waktu: number;
  kabupaten: string;
  jenis: string;
  kejadian: number;
  meninggal: number;
  hilang: number;
  luka: number;
  mengungsi: number;
  rumahRusak: number;
  rumahTerendam: number;
  kronologi: string;
  lon: number;
  lat: number;
}

export interface LaporanWarga {
  id: string;
  waktu: number;
  lon: number;
  lat: number;
  /** flood, fire, wind, earthquake, volcano, haze */
  jenis: string;
  kedalaman?: number;
  teks: string;
  gambar?: string;
  kota: string;
}

export interface DataBencana {
  diperbarui: number;
  bnpb: KejadianBnpb[];
  laporan: LaporanWarga[];
  sumber: string[];
}

export interface Peringatan {
  id: string;
  judul: string;
  kejadian: string;
  wilayah: string;
  deskripsi: string;
  mulai: number;
  berakhir: number;
  tingkat: string;
  infografis?: string;
  /** ring luar poligon [lon, lat][] */
  poligon: [number, number][][];
}

export interface DataPeringatan {
  diperbarui: number;
  peringatan: Peringatan[];
}

/** Grid lon/lat teratur: sel (i, j) berpusat di lon0 + i*dx, lat0 + j*dy; j = 0 paling selatan. */
export interface DefGrid {
  lon0: number;
  lat0: number;
  dx: number;
  dy: number;
  nx: number;
  ny: number;
}

/** Medan atmosfer per 3 jam di grid kasar yang menutup darat dan laut. Semua deret: [langkah][sel], angka bulat. */
export interface MedanCuaca {
  grid: DefGrid;
  /** awal deret (ms UTC) dan selang antar langkah (jam) */
  mulai: number;
  langkahJam: number;
  /** angin 10 m dan 850 hPa, m/s x10 */
  u10: number[][];
  v10: number[][];
  u850: number[][];
  v850: number[][];
  /** C x10 */
  suhu: number[][];
  /** mm per langkah x10 */
  hujan: number[][];
  /** ug/m3 */
  pm25: number[][];
}

/** Indeks harian di grid darat. -1 = sel laut (tidak dihitung). */
export interface HarianDarat {
  grid: DefGrid;
  /** tanggal ISO (WIB), hari[0] = hari snapshot dibuat */
  hari: string[];
  /** FWI x10 [hari][sel] */
  fwi: number[][];
  /** hujan harian mm x10 [hari][sel] */
  hujan: number[][];
}

/** Snapshot prakiraan (cabang `data`, cuaca.json), ditulis GitHub Actions tiap 6 jam. */
export interface SnapshotCuaca {
  dibuat: number;
  medan: MedanCuaca;
  harian: HarianDarat;
  sungai: PrakiraanSungai[];
}

export interface PrakiraanSungai {
  nama: string;
  lokasi: string;
  lon: number;
  lat: number;
  /** debit harian m3/s mulai hari ini */
  debit: number[];
  /** median dan persentil 90/99 dari klimatologi GloFAS (m3/s) */
  p50: number;
  p90: number;
  p99: number;
}
