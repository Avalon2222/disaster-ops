/**
 * Pemuat data statis di public/data. Tiap berkas diambil paling banyak sekali per kunjungan dan hanya
 * saat dibutuhkan: batimetri (655 KB) baru diunduh waktu simulasi tsunami dibuka, dan seterusnya.
 */

import { siapkanPoligon, type PoligonBerkotak } from "./geo";
import type { GridPenduduk, RumahSakit } from "./model/eksposur";
import type { Batimetri } from "./model/tsunami";

export interface Kota {
  nama: string;
  lat: number;
  lon: number;
  provinsi: string;
  kab?: string;
  /** 1 = kota utama (daftar kurasi), 0 = ibu kota kabupaten */
  utama: number;
}

export interface GunungStatis {
  nama: string;
  lat: number;
  lon: number;
  elevasi: number;
  provinsi: string;
}

/** [lon, lat, kedalaman km, magnitudo, tahun, tempat] */
export type GempaHistoris = [number, number, number, number, number, string];

export interface MetaGrid {
  batimetri: { lon0: number; lat0: number; dx: number; nx: number; ny: number };
  populasi: { lon0: number; lat0: number; dx: number; nx: number; ny: number; skala_akar: number; total: number };
  karhutla2019: { mulai: string; hari: number; jumlah: number; per_hari: number[]; frp_hari: number[] };
}

export interface Karhutla2019 {
  meta: MetaGrid["karhutla2019"];
  /** per titik, sudah urut menurut hari */
  lon: Float32Array;
  lat: Float32Array;
  hari: Uint8Array;
  frp: Float32Array;
  /** indeks titik pertama tiap hari (panjang hari + 1) */
  awalHari: Uint32Array;
}

async function json<T>(nama: string): Promise<T> {
  const res = await fetch(`/data/${nama}`);
  if (!res.ok) throw new Error(`${nama}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// Berkas biner sengaja berakhiran .dat: Chromium menjawab fetch ke berkas .bin dengan 204 kosong di beberapa konfigurasi.
async function biner(nama: string): Promise<ArrayBuffer> {
  const res = await fetch(`/data/${nama}`);
  if (!res.ok) throw new Error(`${nama}: HTTP ${res.status}`);
  const isi = await res.arrayBuffer();
  if (isi.byteLength === 0) throw new Error(`${nama}: kosong`);
  return isi;
}

/** Bungkus pemuat supaya hasilnya dipakai ulang; kalau gagal boleh dicoba lagi. */
function sekali<T>(fn: () => Promise<T>): () => Promise<T> {
  let janji: Promise<T> | null = null;
  return () => {
    janji ??= fn().catch((e) => {
      janji = null;
      throw e;
    });
    return janji;
  };
}

export const muatKota = sekali(() => json<Kota[]>("kota.json"));
export const muatGunungStatis = sekali(() => json<GunungStatis[]>("gunung.json"));
export const muatRs = sekali(() => json<RumahSakit[]>("rs.json"));
export const muatHistoris = sekali(() => json<GempaHistoris[]>("gempa_historis.json"));
export const muatMeta = sekali(() => json<MetaGrid>("grid.json"));

export const muatProvinsi = sekali(async (): Promise<PoligonBerkotak[]> => {
  const g = await json<{ features: { properties: { provinsi: string }; geometry: { type: string; coordinates: unknown } }[] }>("provinsi.geojson");
  return g.features.map((f) => siapkanPoligon(f.properties.provinsi, f.geometry));
});

export const muatPenduduk = sekali(async (): Promise<GridPenduduk> => {
  const [meta, isi] = await Promise.all([muatMeta(), biner("populasi.dat")]);
  const p = meta.populasi;
  return { lon0: p.lon0, lat0: p.lat0, dx: p.dx, nx: p.nx, ny: p.ny, skalaAkar: p.skala_akar, v: new Uint16Array(isi) };
});

export const muatBatimetri = sekali(async (): Promise<Batimetri> => {
  const [meta, isi] = await Promise.all([muatMeta(), biner("batimetri.dat")]);
  return { ...meta.batimetri, z: new Int16Array(isi) };
});

/** Urai karhutla2019.dat: 6 byte per titik (lon*100, lat*100 Int16; hari Uint8; FRP log Uint8). */
export function uraiKarhutla(isi: ArrayBuffer, meta: MetaGrid["karhutla2019"]): Karhutla2019 {
  const n = Math.floor(isi.byteLength / 6);
  const dv = new DataView(isi);
  const lon = new Float32Array(n);
  const lat = new Float32Array(n);
  const hari = new Uint8Array(n);
  const frp = new Float32Array(n);
  const awalHari = new Uint32Array(meta.hari + 1).fill(n);
  let terakhir = -1;
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    lon[i] = dv.getInt16(o, true) / 100;
    lat[i] = dv.getInt16(o + 2, true) / 100;
    hari[i] = dv.getUint8(o + 4);
    frp[i] = Math.expm1(dv.getUint8(o + 5) / 32);
    for (let h = terakhir + 1; h <= hari[i] && h <= meta.hari; h++) awalHari[h] = i;
    terakhir = Math.max(terakhir, hari[i]);
  }
  return { meta, lon, lat, hari, frp, awalHari };
}

export const muatKarhutla2019 = sekali(async (): Promise<Karhutla2019> => {
  const [meta, isi] = await Promise.all([muatMeta(), biner("karhutla2019.dat")]);
  return uraiKarhutla(isi, meta.karhutla2019);
});
