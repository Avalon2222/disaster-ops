/**
 * Prakiraan dari Open-Meteo (gratis, tanpa kunci): cuaca, kualitas udara (CAMS), dan debit sungai (GloFAS).
 * Berkas ini hanya menyusun URL dan mengubah jawaban API jadi deret di grid; pengambilannya dilakukan
 * scripts/bangun_cuaca.ts lewat GitHub Actions, supaya jatah API tidak habis oleh pengunjung.
 */

import type { DefGrid, HarianDarat, MedanCuaca, PrakiraanSungai } from "../jenis";
import { deretFwi, type CuacaHarian } from "../model/fwi";
import { titikGrid } from "../model/grid";

/** Grid medan atmosfer: 90-147 BT, 15 LS - 10,5 LU, tiap 1,5 derajat (39 x 18 = 702 titik). */
export const GRID_MEDAN: DefGrid = { lon0: 90, lat0: -15, dx: 1.5, dy: 1.5, nx: 39, ny: 18 };
/** Grid darat untuk FWI dan hujan harian: 95-141 BT, 11 LS - 6 LU, tiap 1 derajat (47 x 18). Hanya sel dekat daratan yang diambil. */
export const GRID_DARAT: DefGrid = { lon0: 95, lat0: -11, dx: 1, dy: 1, nx: 47, ny: 18 };

export const LANGKAH_JAM = 3;
export const JUMLAH_LANGKAH = 25; // 0..72 jam
export const HARI_LALU = 30; // pemanasan FWI
export const HARI_DEPAN = 8;

const API_CUACA = "https://api.open-meteo.com/v1/forecast";
const API_UDARA = "https://air-quality-api.open-meteo.com/v1/air-quality";
const API_BANJIR = "https://flood-api.open-meteo.com/v1/flood";

export interface Titik {
  lon: number;
  lat: number;
}

function koordinat(titik: Titik[]): string {
  return `latitude=${titik.map((t) => t.lat.toFixed(2)).join(",")}&longitude=${titik.map((t) => t.lon.toFixed(2)).join(",")}`;
}

export function urlPerJam(titik: Titik[]): string {
  return `${API_CUACA}?${koordinat(titik)}&hourly=wind_speed_10m,wind_direction_10m,wind_speed_850hPa,wind_direction_850hPa,temperature_2m,precipitation&forecast_days=4&wind_speed_unit=ms&timezone=GMT`;
}

export function urlUdara(titik: Titik[]): string {
  return `${API_UDARA}?${koordinat(titik)}&hourly=pm2_5&forecast_days=4&timezone=GMT`;
}

export function urlHarian(titik: Titik[]): string {
  return `${API_CUACA}?${koordinat(titik)}&daily=temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_mean,precipitation_sum&past_days=${HARI_LALU}&forecast_days=${HARI_DEPAN}&wind_speed_unit=kmh&timezone=Asia%2FJakarta`;
}

export function urlSungai(titik: Titik[]): string {
  return `${API_BANJIR}?${koordinat(titik)}&daily=river_discharge&forecast_days=${HARI_DEPAN}`;
}

/** Arah angin meteorologi (dari mana angin datang) -> komponen u (ke timur) dan v (ke utara). */
export function komponenAngin(kecepatan: number, arahDari: number): [number, number] {
  const r = (arahDari * Math.PI) / 180;
  return [-kecepatan * Math.sin(r), -kecepatan * Math.cos(r)];
}

export interface JawabanPerJam {
  hourly: {
    time: string[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    wind_speed_850hPa?: (number | null)[];
    wind_direction_850hPa?: (number | null)[];
    temperature_2m?: (number | null)[];
    precipitation?: (number | null)[];
    pm2_5?: (number | null)[];
  };
}

/** Awal langkah 3-jam yang sedang berjalan (ms UTC). */
export function awalLangkah(sekarang: number): number {
  const langkah = LANGKAH_JAM * 3600_000;
  return Math.floor(sekarang / langkah) * langkah;
}

function bulat(v: number | null | undefined, kali = 1): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v * kali) : 0;
}

/**
 * Jawaban per-jam (satu per titik grid, urutannya sama dengan titikGrid) -> medan per 3 jam.
 * Hujan dijumlahkan per langkah; besaran lain diambil di awal langkah.
 */
export function susunMedan(cuaca: JawabanPerJam[], udara: JawabanPerJam[], sekarang: number): MedanCuaca {
  const mulai = awalLangkah(sekarang);
  const waktu = cuaca[0].hourly.time.map((t) => Date.parse(`${t}:00Z`));
  const i0 = waktu.indexOf(mulai);
  if (i0 < 0) throw new Error("Deret per-jam tidak memuat jam sekarang");
  const waktuUdara = udara[0]?.hourly.time.map((t) => Date.parse(`${t}:00Z`)) ?? [];
  const j0 = waktuUdara.indexOf(mulai);
  const kosong = () => Array.from({ length: JUMLAH_LANGKAH }, () => new Array<number>(cuaca.length).fill(0));
  const m: MedanCuaca = { grid: GRID_MEDAN, mulai, langkahJam: LANGKAH_JAM, u10: kosong(), v10: kosong(), u850: kosong(), v850: kosong(), suhu: kosong(), hujan: kosong(), pm25: kosong() };
  cuaca.forEach((c, s) => {
    const h = c.hourly;
    for (let t = 0; t < JUMLAH_LANGKAH; t++) {
      const i = Math.min(waktu.length - 1, i0 + t * LANGKAH_JAM);
      const [u10, v10] = komponenAngin(h.wind_speed_10m?.[i] ?? 0, h.wind_direction_10m?.[i] ?? 0);
      const [u850, v850] = komponenAngin(h.wind_speed_850hPa?.[i] ?? 0, h.wind_direction_850hPa?.[i] ?? 0);
      m.u10[t][s] = bulat(u10, 10);
      m.v10[t][s] = bulat(v10, 10);
      m.u850[t][s] = bulat(u850, 10);
      m.v850[t][s] = bulat(v850, 10);
      m.suhu[t][s] = bulat(h.temperature_2m?.[i], 10);
      let hujan = 0;
      for (let k = 0; k < LANGKAH_JAM; k++) hujan += h.precipitation?.[i + k] ?? 0;
      m.hujan[t][s] = bulat(hujan, 10);
      const pm = j0 >= 0 ? udara[s]?.hourly.pm2_5?.[Math.min(waktuUdara.length - 1, j0 + t * LANGKAH_JAM)] : null;
      m.pm25[t][s] = bulat(pm);
    }
  });
  return m;
}

export interface JawabanHarian {
  latitude: number;
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    relative_humidity_2m_min: (number | null)[];
    wind_speed_10m_mean: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

/**
 * Jawaban harian untuk sel darat -> FWI dan hujan harian di GRID_DARAT.
 * `selDarat[k]` = indeks sel grid untuk jawaban ke-k. FWI dihitung berurutan sejak HARI_LALU hari lalu
 * supaya kode kekeringannya sempat "panas"; yang disimpan hanya mulai hari ini.
 */
export function susunHarian(jawaban: JawabanHarian[], selDarat: number[], hariIni: string): HarianDarat {
  const tanggal = jawaban[0].daily.time;
  const i0 = tanggal.indexOf(hariIni);
  if (i0 < 0) throw new Error(`Deret harian tidak memuat ${hariIni}`);
  const hari = tanggal.slice(i0);
  const nSel = GRID_DARAT.nx * GRID_DARAT.ny;
  const fwi = hari.map(() => new Array<number>(nSel).fill(-1));
  const hujan = hari.map(() => new Array<number>(nSel).fill(-1));
  const bulan = tanggal.map((t) => Number(t.slice(5, 7)));
  jawaban.forEach((j, k) => {
    const d = j.daily;
    const cuaca: CuacaHarian[] = tanggal.map((_, i) => ({
      suhu: d.temperature_2m_max[i] ?? NaN,
      rh: d.relative_humidity_2m_min[i] ?? NaN,
      angin: d.wind_speed_10m_mean[i] ?? NaN,
      hujan: d.precipitation_sum[i] ?? NaN,
    }));
    const deret = deretFwi(cuaca, bulan, j.latitude);
    for (let h = 0; h < hari.length; h++) {
      fwi[h][selDarat[k]] = Math.round(deret[i0 + h].fwi * 10);
      hujan[h][selDarat[k]] = bulat(d.precipitation_sum[i0 + h], 10);
    }
  });
  return { grid: GRID_DARAT, hari, fwi, hujan };
}

export interface JawabanSungai {
  daily: { time: string[]; river_discharge: (number | null)[] };
}

export interface TitikSungai {
  nama: string;
  lokasi: string;
  lon: number;
  lat: number;
  p50: number;
  p90: number;
  p99: number;
}

export function susunSungai(jawaban: JawabanSungai[], titik: TitikSungai[]): PrakiraanSungai[] {
  return titik.map((t, i) => ({
    ...t,
    debit: (jawaban[i]?.daily.river_discharge ?? []).map((q) => (typeof q === "number" ? Math.round(q * 10) / 10 : 0)),
  }));
}

/** Titik pusat semua sel GRID_MEDAN. */
export function titikMedan(): Titik[] {
  return titikGrid(GRID_MEDAN);
}
