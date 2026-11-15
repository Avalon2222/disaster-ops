/**
 * Simulasi waktu tempuh tsunami.
 *
 * Di laut dalam, tsunami adalah gelombang panjang: kecepatannya hanya bergantung pada kedalaman,
 * c = sqrt(g * h). Jadi waktu tiba bisa dihitung dari peta kedalaman saja, dengan mencari lintasan
 * tercepat dari sumber ke tiap sel laut (Dijkstra di atas grid batimetri, 16 arah).
 * Ini cara yang sama dengan peta "tsunami travel time" NOAA; tinggi gelombangnya TIDAK disimulasikan.
 */

import { jarakKm } from "../geo";

export interface Batimetri {
  lon0: number;
  lat0: number;
  dx: number;
  nx: number;
  ny: number;
  /** meter; negatif = laut */
  z: Int16Array;
}

const G = 9.81;
/** Kedalaman minimum yang dipakai untuk kecepatan (m): di perairan sangat dangkal rumus gelombang panjang terlalu lambat. */
const DALAM_MIN = 10;
const KM_PER_DERAJAT = 111.195;

/** Kecepatan gelombang (km/menit) di kedalaman `h` meter. */
export function kecepatanKmMenit(h: number): number {
  return (Math.sqrt(G * Math.max(DALAM_MIN, h)) * 60) / 1000;
}

/** Tumpukan biner minimum untuk (waktu, sel). */
class Tumpukan {
  private kunci: Float32Array;
  private isi: Int32Array;
  n = 0;
  constructor(kapasitas: number) {
    this.kunci = new Float32Array(kapasitas);
    this.isi = new Int32Array(kapasitas);
  }
  dorong(k: number, v: number) {
    if (this.n === this.kunci.length) {
      const k2 = new Float32Array(this.n * 2);
      k2.set(this.kunci);
      this.kunci = k2;
      const v2 = new Int32Array(this.n * 2);
      v2.set(this.isi);
      this.isi = v2;
    }
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.kunci[p] <= k) break;
      this.kunci[i] = this.kunci[p];
      this.isi[i] = this.isi[p];
      i = p;
    }
    this.kunci[i] = k;
    this.isi[i] = v;
  }
  /** kunci terkecil; nilainya ada di `terakhir` */
  terakhir = 0;
  tarik(): number {
    const k0 = this.kunci[0];
    this.terakhir = this.isi[0];
    const k = this.kunci[--this.n];
    const v = this.isi[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.n) break;
      if (c + 1 < this.n && this.kunci[c + 1] < this.kunci[c]) c++;
      if (this.kunci[c] >= k) break;
      this.kunci[i] = this.kunci[c];
      this.isi[i] = this.isi[c];
      i = c;
    }
    this.kunci[i] = k;
    this.isi[i] = v;
    return k0;
  }
}

// 8 tetangga + 8 langkah kuda: arah rambat jadi lebih bulat daripada 8 arah saja
const ARAH: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1],
  [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2],
];

export interface SumberTsunami {
  lon: number;
  lat: number;
  /** jari-jari daerah sumber (km): semua sel laut di dalamnya mulai dari menit 0 */
  radiusKm: number;
}

export interface HasilTsunami {
  /** menit sampai gelombang pertama tiba; Infinity = daratan / tak terjangkau */
  menit: Float32Array;
  /** jumlah sel laut di daerah sumber; 0 berarti sumbernya di darat dan tidak ada tsunami */
  selSumber: number;
  maksMenit: number;
}

export function selBatimetri(b: Batimetri, lon: number, lat: number): number {
  const i = Math.round((lon - b.lon0) / b.dx);
  const j = Math.round((lat - b.lat0) / b.dx);
  if (i < 0 || j < 0 || i >= b.nx || j >= b.ny) return -1;
  return j * b.nx + i;
}

/** Waktu tempuh dari daerah sumber ke semua sel laut, dibatasi `batasMenit`. */
export function waktuTempuh(b: Batimetri, sumber: SumberTsunami, batasMenit = 480): HasilTsunami {
  const { nx, ny, z, dx } = b;
  const menit = new Float32Array(nx * ny).fill(Infinity);
  const antre = new Tumpukan(1 << 16);
  let selSumber = 0;

  const rSel = Math.ceil(sumber.radiusKm / (dx * KM_PER_DERAJAT)) + 1;
  const i0 = Math.round((sumber.lon - b.lon0) / dx);
  const j0 = Math.round((sumber.lat - b.lat0) / dx);
  for (let j = Math.max(0, j0 - rSel); j <= Math.min(ny - 1, j0 + rSel); j++)
    for (let i = Math.max(0, i0 - rSel); i <= Math.min(nx - 1, i0 + rSel); i++) {
      const s = j * nx + i;
      if (z[s] >= 0) continue;
      if (jarakKm(sumber.lon, sumber.lat, b.lon0 + i * dx, b.lat0 + j * dx) > Math.max(sumber.radiusKm, dx * KM_PER_DERAJAT * 0.75)) continue;
      menit[s] = 0;
      antre.dorong(0, s);
      selSumber++;
    }

  // panjang langkah (km) per arah, per baris lintang
  const dyKm = dx * KM_PER_DERAJAT;
  let maks = 0;
  while (antre.n > 0) {
    const t = antre.tarik();
    const s = antre.terakhir;
    if (t > menit[s]) continue;
    if (t > maks) maks = t;
    const j = (s / nx) | 0;
    const i = s - j * nx;
    const dxKm = dyKm * Math.cos(((b.lat0 + j * dx) * Math.PI) / 180);
    const cS = kecepatanKmMenit(-z[s]);
    for (let a = 0; a < 16; a++) {
      const di = ARAH[a][0];
      const dj = ARAH[a][1];
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      const n = nj * nx + ni;
      if (z[n] >= 0) continue;
      // langkah kuda harus lewat laut: dua sel yang dilangkahi tidak boleh daratan dua-duanya
      if (a >= 8) {
        const a1 = Math.abs(di) === 2 ? (j * nx + i + di / 2) : ((j + dj / 2) * nx + i);
        const a2 = Math.abs(di) === 2 ? (nj * nx + i + di / 2) : ((j + dj / 2) * nx + ni);
        if (z[a1] >= 0 && z[a2] >= 0) continue;
      }
      const jarak = Math.hypot(di * dxKm, dj * dyKm);
      const tBaru = t + jarak / ((cS + kecepatanKmMenit(-z[n])) / 2);
      if (tBaru < menit[n] && tBaru <= batasMenit) {
        menit[n] = tBaru;
        antre.dorong(tBaru, n);
      }
    }
  }
  return { menit, selSumber, maksMenit: maks };
}

/** Jalankan `fn(indeksSel)` untuk tiap sel laut yang pusatnya dalam `cariKm` dari titik. */
function tiapSelLautDekat(b: Batimetri, lon: number, lat: number, cariKm: number, fn: (sel: number) => void): void {
  const r = Math.max(1, Math.ceil(cariKm / (b.dx * KM_PER_DERAJAT)));
  const i0 = Math.round((lon - b.lon0) / b.dx);
  const j0 = Math.round((lat - b.lat0) / b.dx);
  for (let j = Math.max(0, j0 - r); j <= Math.min(b.ny - 1, j0 + r); j++)
    for (let i = Math.max(0, i0 - r); i <= Math.min(b.nx - 1, i0 + r); i++) {
      const s = j * b.nx + i;
      if (b.z[s] >= 0) continue;
      if (jarakKm(lon, lat, b.lon0 + i * b.dx, b.lat0 + j * b.dx) <= cariKm) fn(s);
    }
}

/** Sebuah kota dianggap pesisir kalau ada sel laut dalam jarak ini (km) dari pusatnya. */
export const JARAK_PESISIR_KM = 14;

/**
 * Waktu tiba di sebuah titik pantai: sel laut tercepat dalam `cariKm` dari titik itu.
 * Infinity kalau tidak ada laut di dekatnya (kota pedalaman) atau gelombang tidak sampai.
 */
export function waktuTiba(b: Batimetri, menit: Float32Array, lon: number, lat: number, cariKm = JARAK_PESISIR_KM): number {
  let terbaik = Infinity;
  tiapSelLautDekat(b, lon, lat, cariKm, (s) => {
    if (menit[s] < terbaik) terbaik = menit[s];
  });
  return terbaik;
}

/** Apakah titik ini dekat laut (ada sel laut dalam `cariKm`)? */
export function dekatLaut(b: Batimetri, lon: number, lat: number, cariKm = JARAK_PESISIR_KM): boolean {
  let ada = false;
  tiapSelLautDekat(b, lon, lat, cariKm, () => {
    ada = true;
  });
  return ada;
}

/**
 * Perkiraan kasar tinggi tsunami di pantai (m) dari magnitudo dan jarak, rumus empiris Abe (1995):
 * log H = Mw - log R - 5,55, dibatasi tinggi dekat-sumber log Hr = 0,5 Mw - 3,3.
 * Hanya orde besaran: bentuk teluk dan dasar laut bisa melipatgandakan angka ini.
 */
export function tinggiAbe(mag: number, jarakKmDariSumber: number): number {
  const dekat = 10 ** (0.5 * mag - 3.3);
  const jauh = 10 ** (mag - Math.log10(Math.max(1, jarakKmDariSumber)) - 5.55);
  return Math.min(dekat, jauh);
}

/** Gempa yang lazim membangkitkan tsunami: dangkal, besar, dan sumbernya menyentuh laut. */
export function berpotensiTsunami(mag: number, kedalamanKm: number, selSumber: number): boolean {
  return mag >= 6.5 && kedalamanKm <= 70 && selSumber > 0;
}
