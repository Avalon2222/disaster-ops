/**
 * Menggambar medan (nilai di grid lon/lat) ke kanvas kecil yang dipakai MapLibre sebagai source `canvas`.
 * MapLibre meregangkan kanvas secara linier di ruang Mercator, jadi baris kanvas dihitung dari
 * koordinat Mercator, bukan lintang: tanpa itu gambar bergeser belasan km di tepi utara/selatan.
 */

import type { CanvasSource, Map as MapLibre } from "maplibre-gl";
import type { DefGrid } from "../jenis";
import { sampel } from "../model/grid";
import { warnaSkala, type Rgba, type Skala } from "./warna";

const RAD = Math.PI / 180;

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

export interface OpsiMedan {
  grid: DefGrid;
  nilai: ArrayLike<number>;
  skala: Skala;
  /** nilai tersimpan dikali ini sebelum diwarnai (mis. 0,1 untuk angka x10) */
  pengali?: number;
  /** nilai yang berarti "tidak ada data" */
  kosong?: number;
  perSel?: number;
  /** ubah nilai sebelum diwarnai (mis. penduduk per sel -> kepadatan) */
  ubah?: (v: number, lat: number) => number;
}

/** Gambar medan ke kanvas dan kembalikan sudut geografisnya. */
export function gambarMedan(kanvas: HTMLCanvasElement, o: OpsiMedan): Sudut {
  const g = o.grid;
  const { lebar, tinggi } = ukuranKanvas(g, o.perSel ?? 8);
  if (kanvas.width !== lebar) kanvas.width = lebar;
  if (kanvas.height !== tinggi) kanvas.height = tinggi;
  const ctx = kanvas.getContext("2d");
  if (!ctx) return sudutGrid(g);
  const gambar = ctx.createImageData(lebar, tinggi);
  const px = gambar.data;
  const yAtas = mercY(g.lat0 + (g.ny - 1) * g.dy);
  const yBawah = mercY(g.lat0);
  const kali = o.pengali ?? 1;
  const kosong = o.kosong ?? NaN;
  const c: Rgba = [0, 0, 0, 0];
  for (let r = 0; r < tinggi; r++) {
    const lat = latDariMercY(yAtas + ((yBawah - yAtas) * r) / (tinggi - 1));
    for (let k = 0; k < lebar; k++) {
      const lon = g.lon0 + ((g.nx - 1) * g.dx * k) / (lebar - 1);
      let v = sampel(g, o.nilai, lon, lat, kosong);
      const i = (r * lebar + k) * 4;
      if (Number.isNaN(v)) {
        px[i + 3] = 0;
        continue;
      }
      v *= kali;
      if (o.ubah) v = o.ubah(v, lat);
      warnaSkala(o.skala, v, c);
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = c[3];
    }
  }
  ctx.putImageData(gambar, 0, 0);
  return sudutGrid(g);
}

/** Kosongkan kanvas (lapisan dimatikan atau datanya belum ada). */
export function kosongkan(kanvas: HTMLCanvasElement): void {
  kanvas.getContext("2d")?.clearRect(0, 0, kanvas.width, kanvas.height);
}

/**
 * Minta MapLibre mengunggah ulang isi kanvas. Source kanvas yang tidak beranimasi hanya dibaca sekali,
 * jadi diputar sebentar lalu dijeda lagi.
 */
export function segarkanKanvas(m: MapLibre, id: string, sudut?: Sudut): void {
  const s = m.getSource(id) as CanvasSource | undefined;
  if (!s) return;
  if (sudut) s.setCoordinates(sudut);
  s.play();
  m.triggerRepaint();
  requestAnimationFrame(() => requestAnimationFrame(() => s.pause()));
}
