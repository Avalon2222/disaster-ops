/**
 * Menggambar medan (nilai di grid lon/lat) jadi gambar yang dipakai MapLibre sebagai source `image`.
 *
 * - MapLibre meregangkan gambar secara linier di ruang Mercator, jadi baris gambar dihitung dari
 *   koordinat Mercator, bukan lintang: tanpa itu gambar bergeser belasan km di tepi utara/selatan.
 * - Grid prakiraan kasar (1-1,5 derajat), jadi hasil interpolasi dihaluskan lagi supaya tidak
 *   kelihatan kotak-kotak, dan tepi grid dipudarkan membulat supaya tidak terpotong tajam.
 */

import type { ImageSource, Map as MapLibre } from "maplibre-gl";
import type { DefGrid } from "../jenis";
import { sampel } from "../model/grid";
import { pudarTepi } from "./efek";
import { warnaSkala, type Rgba, type Skala } from "./warna";

const RAD = Math.PI / 180;
/** PNG transparan 1x1: isi awal source gambar sebelum ada data */
export const GAMBAR_KOSONG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export function mercY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
}

export function latDariMercY(y: number): number {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;
}

export type Sudut = [[number, number], [number, number], [number, number], [number, number]];

/** Sudut gambar: dari pusat sel pertama sampai pusat sel terakhir (nilai diinterpolasi antar pusat sel). */
export function sudutGrid(g: DefGrid): Sudut {
  const lon1 = g.lon0 + (g.nx - 1) * g.dx;
  const lat1 = g.lat0 + (g.ny - 1) * g.dy;
  return [
    [g.lon0, lat1],
    [lon1, lat1],
    [lon1, g.lat0],
    [g.lon0, g.lat0],
  ];
}

/** Ukuran kanvas untuk grid: `perSel` piksel per sel, tinggi mengikuti rasio Mercator. */
export function ukuranKanvas(g: DefGrid, perSel: number): { lebar: number; tinggi: number } {
  const lebar = Math.max(2, Math.round((g.nx - 1) * perSel) + 1);
  const rentangX = (g.nx - 1) * g.dx * RAD;
  const rentangY = mercY(g.lat0 + (g.ny - 1) * g.dy) - mercY(g.lat0);
  return { lebar, tinggi: Math.max(2, Math.round((lebar * rentangY) / rentangX)) };
}

/**
 * Kabur kotak dua arah di tempat (dua kali lewat ~ kabur segitiga). `data` berisi 4 kanal per piksel,
 * warna sudah dikali alfa supaya piksel transparan tidak "membocorkan" warna gelap ke tetangganya.
 */
export function kaburkan(data: Float32Array, lebar: number, tinggi: number, radius: number): void {
  if (radius < 1) return;
  const r = Math.round(radius);
  const sementara = new Float32Array(data.length);
  const lewat = (asal: Float32Array, tujuan: Float32Array, n: number, m: number, langkahN: number, langkahM: number) => {
    // n = panjang garis yang dikaburkan, m = jumlah garis
    for (let j = 0; j < m; j++) {
      for (let c = 0; c < 4; c++) {
        let jumlah = 0;
        const dasar = j * langkahM + c;
        for (let i = -r; i <= r; i++) jumlah += asal[dasar + Math.min(n - 1, Math.max(0, i)) * langkahN];
        for (let i = 0; i < n; i++) {
          tujuan[dasar + i * langkahN] = jumlah / (2 * r + 1);
          jumlah += asal[dasar + Math.min(n - 1, i + r + 1) * langkahN] - asal[dasar + Math.max(0, i - r) * langkahN];
        }
      }
    }
  };
  for (let ulang = 0; ulang < 2; ulang++) {
    lewat(data, sementara, lebar, tinggi, 4, lebar * 4);
    lewat(sementara, data, tinggi, lebar, lebar * 4, 4);
  }
}

export interface OpsiMedan {
  grid: DefGrid;
  nilai: ArrayLike<number>;
  skala: Skala;
  /** nilai tersimpan dikali ini sebelum diwarnai (mis. 0,1 untuk angka x10) */
  pengali?: number;
  /** nilai yang berarti "tidak ada data" */
  kosong?: number;
  perSel?: number;
  /** radius kabur dalam piksel kanvas (0 = tajam) */
  kabur?: number;
  /** pudarkan tepi grid membulat (untuk medan yang menutup darat dan laut) */
  pudar?: boolean;
  /** ubah nilai sebelum diwarnai (mis. penduduk per sel -> kepadatan) */
  ubah?: (v: number, lat: number) => number;
}

/** Hitung piksel RGBA (0..255, belum dikali alfa) medan pada kanvas berukuran lebar x tinggi. */
export function pikselMedan(o: OpsiMedan): { piksel: Uint8ClampedArray; lebar: number; tinggi: number } {
  const g = o.grid;
  const { lebar, tinggi } = ukuranKanvas(g, o.perSel ?? 8);
  const f = new Float32Array(lebar * tinggi * 4);
  const yAtas = mercY(g.lat0 + (g.ny - 1) * g.dy);
  const yBawah = mercY(g.lat0);
  const kali = o.pengali ?? 1;
  const kosong = o.kosong ?? NaN;
  const c: Rgba = [0, 0, 0, 0];
  const lintang = new Float32Array(tinggi);
  for (let r = 0; r < tinggi; r++) {
    const lat = latDariMercY(yAtas + ((yBawah - yAtas) * r) / (tinggi - 1));
    lintang[r] = lat;
    for (let k = 0; k < lebar; k++) {
      const lon = g.lon0 + ((g.nx - 1) * g.dx * k) / (lebar - 1);
      let v = sampel(g, o.nilai, lon, lat, kosong);
      if (Number.isNaN(v)) continue;
      v *= kali;
      if (o.ubah) v = o.ubah(v, lat);
      warnaSkala(o.skala, v, c);
      const a = c[3] / 255;
      const i = (r * lebar + k) * 4;
      f[i] = c[0] * a;
      f[i + 1] = c[1] * a;
      f[i + 2] = c[2] * a;
      f[i + 3] = a;
    }
  }
  if (o.kabur) kaburkan(f, lebar, tinggi, o.kabur);
  const piksel = new Uint8ClampedArray(lebar * tinggi * 4);
  for (let r = 0; r < tinggi; r++)
    for (let k = 0; k < lebar; k++) {
      const i = (r * lebar + k) * 4;
      let a = f[i + 3];
      if (a <= 0.003) continue;
      piksel[i] = f[i] / a;
      piksel[i + 1] = f[i + 1] / a;
      piksel[i + 2] = f[i + 2] / a;
      // medan memudar lebih awal daripada partikel, supaya batasnya tidak terbaca sebagai bentuk
      if (o.pudar) a *= pudarTepi(g, g.lon0 + ((g.nx - 1) * g.dx * k) / (lebar - 1), lintang[r], 0.45);
      piksel[i + 3] = a * 255;
    }
  return { piksel, lebar, tinggi };
}

/** Gambar medan ke kanvas dan kembalikan sudut geografisnya. */
export function gambarMedan(kanvas: HTMLCanvasElement, o: OpsiMedan): Sudut {
  const { piksel, lebar, tinggi } = pikselMedan(o);
  if (kanvas.width !== lebar) kanvas.width = lebar;
  if (kanvas.height !== tinggi) kanvas.height = tinggi;
  const ctx = kanvas.getContext("2d");
  if (ctx) {
    const gambar = ctx.createImageData(lebar, tinggi);
    gambar.data.set(piksel);
    ctx.putImageData(gambar, 0, 0);
  }
  return sudutGrid(o.grid);
}

/** Pasang isi kanvas (atau URL gambar) ke source `image` di peta. */
export function pasangGambar(m: MapLibre, id: string, sumber: HTMLCanvasElement | string, sudut: Sudut): void {
  const s = m.getSource(id) as ImageSource | undefined;
  if (!s) return;
  s.updateImage({ url: typeof sumber === "string" ? sumber : sumber.toDataURL("image/png"), coordinates: sudut });
}
