/** Satu skenario tsunami utuh: waktu tempuh dari daerah sumber, lalu waktu tiba dan perkiraan tinggi di tiap kota pesisir. */

import { jarakKm } from "../geo";
import { radiusPatahanKm } from "./guncangan";
import { dekatLaut, tinggiAbe, waktuTempuh, waktuTiba, type Batimetri } from "./tsunami";

export interface SumberGempa {
  lon: number;
  lat: number;
  mag: number;
}

export interface KotaPesisir {
  nama: string;
  lon: number;
  lat: number;
  utama: number;
}

export interface TibaKota {
  nama: string;
  lon: number;
  lat: number;
  menit: number;
  /** perkiraan kasar tinggi gelombang (m), rumus Abe */
  tinggi: number;
  utama: boolean;
}

export interface HitunganTsunami {
  /** menit tiba per sel grid batimetri */
  menit: Float32Array;
  kota: TibaKota[];
  maks: number;
  selSumber: number;
}

/** gelombang diikuti sampai 6 jam: cukup untuk menyeberangi seluruh perairan Indonesia */
export const BATAS_MENIT = 360;

/** Jari-jari daerah sumber (km): separuh panjang patahan, minimal 15 km supaya selalu menyentuh beberapa sel. */
export function radiusSumberKm(mag: number): number {
  return Math.max(15, radiusPatahanKm(mag));
}

/** Hitung waktu tempuh dan daftar kota pesisir yang terjangkau, tercepat dulu. */
export function hitungTsunami(b: Batimetri, kota: KotaPesisir[], s: SumberGempa): HitunganTsunami {
  const radius = radiusSumberKm(s.mag);
  const h = waktuTempuh(b, { lon: s.lon, lat: s.lat, radiusKm: radius }, BATAS_MENIT);
  const tiba: TibaKota[] = [];
  for (const k of kota) {
    if (!dekatLaut(b, k.lon, k.lat)) continue;
    const menit = waktuTiba(b, h.menit, k.lon, k.lat);
    if (!Number.isFinite(menit)) continue;
    const jarak = Math.max(1, jarakKm(s.lon, s.lat, k.lon, k.lat) - radius);
    tiba.push({ nama: k.nama, lon: k.lon, lat: k.lat, menit, tinggi: tinggiAbe(s.mag, jarak), utama: k.utama === 1 });
  }
  tiba.sort((x, y) => x.menit - y.menit);
  return { menit: h.menit, kota: tiba, maks: h.maksMenit, selSumber: h.selSumber };
}
