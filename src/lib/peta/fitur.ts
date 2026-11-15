/** Mengubah data live menjadi fitur GeoJSON untuk source peta, dan jenis objek yang bisa dipilih. */

import type { DataHotspot, Gempa, GunungApi, KejadianBnpb, LaporanWarga, Peringatan, PrakiraanSungai, TitikPanas } from "../jenis";
import { statusSungai, type StatusSungai } from "../model/banjir";
import type { RumahSakit } from "../model/eksposur";
import type { GempaHistoris } from "../statis";
import { titik } from "./pasang";
import { kunciJenisBencana, WARNA_JENIS_BENCANA } from "./warna";

type Fitur = GeoJSON.Feature;

/** Objek yang sedang dipilih di peta (isi panel detail). */
export type Pilihan =
  | { jenis: "hotspot"; id: string; lon: number; lat: number; data: TitikPanas; provinsi: string; satelit: string }
  | { jenis: "gempa"; id: string; lon: number; lat: number; data: Gempa }
  | { jenis: "gunung"; id: string; lon: number; lat: number; data: GunungApi }
  | { jenis: "bencana"; id: string; lon: number; lat: number; data: KejadianBnpb }
  | { jenis: "laporan"; id: string; lon: number; lat: number; data: LaporanWarga }
  | { jenis: "peringatan"; id: string; lon: number; lat: number; data: Peringatan }
  | { jenis: "sungai"; id: string; lon: number; lat: number; data: PrakiraanSungai; status: StatusSungai }
  | { jenis: "historis"; id: string; lon: number; lat: number; data: GempaHistoris }
  | { jenis: "rs"; id: string; lon: number; lat: number; nama: string }
  | { jenis: "sesar"; id: string; lon: number; lat: number; nama: string; gerak: string; laju: number | null; megathrust: boolean }
  | { jenis: "titik"; id: string; lon: number; lat: number };

export function fiturHotspot(d: DataHotspot, sekarang: number): Fitur[] {
  const menitKini = sekarang / 60_000;
  return d.titik.map((t, i) => titik(t[0], t[1], { id: `hs-${i}`, frp: t[2], umur: Math.max(0, (menitKini - t[4]) / 60) }));
}

export function fiturGempa(gempa: Gempa[], sekarang: number): Fitur[] {
  return gempa.map((g) => titik(g.lon, g.lat, { id: g.id, mag: g.mag, dalam: g.dalam, umur: Math.max(0, (sekarang - g.waktu) / 3600_000), tsunami: Boolean(g.tsunami) }));
}

export function fiturGunung(gunung: GunungApi[]): Fitur[] {
  return gunung.map((g) => titik(g.lon, g.lat, { id: `ga-${g.nama}`, nama: g.nama, level: g.level }));
}

export function fiturBencana(b: KejadianBnpb[]): Fitur[] {
  return b.map((x) => titik(x.lon, x.lat, { id: x.id, warna: WARNA_JENIS_BENCANA[kunciJenisBencana(x.jenis)], label: x.jenis }));
}

export function fiturLaporan(l: LaporanWarga[]): Fitur[] {
  return l.map((x) => titik(x.lon, x.lat, { id: x.id, warna: WARNA_JENIS_BENCANA[kunciJenisBencana(x.jenis)] }));
}

export function fiturPeringatan(p: Peringatan[]): Fitur[] {
  return p.map((x) => ({
    type: "Feature",
    properties: { id: x.id },
    geometry: x.poligon.length === 1 ? { type: "Polygon", coordinates: [x.poligon[0]] } : { type: "MultiPolygon", coordinates: x.poligon.map((r) => [r]) },
  }));
}

export function fiturSungai(s: PrakiraanSungai[]): Fitur[] {
  return s.map((x) => titik(x.lon, x.lat, { id: `sg-${x.nama}`, nama: x.nama, tingkat: statusSungai(x).tingkat }));
}

export function fiturHistoris(h: GempaHistoris[]): Fitur[] {
  return h.map((x, i) => titik(x[0], x[1], { id: `hi-${i}`, mag: x[3] }));
}

export function fiturRs(rs: RumahSakit[]): Fitur[] {
  return rs.map((x, i) => titik(x[0], x[1], { id: `rs-${i}`, nama: x[2] }));
}

/** Pusat kasar sebuah poligon peringatan (rata-rata titik ring pertama), untuk menaruh sorotan. */
export function pusatPoligon(ring: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [lon, lat] of ring) {
    x += lon;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}
