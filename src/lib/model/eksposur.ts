/**
 * Eksposur: berapa orang dan rumah sakit yang berada di dalam suatu zona bahaya.
 * Penduduk dari grid WorldPop 2020 (0,05 derajat), rumah sakit dari OpenStreetMap.
 */

import { jarakKm } from "../geo";
import { mmi } from "./guncangan";

export interface GridPenduduk {
  lon0: number;
  lat0: number;
  dx: number;
  nx: number;
  ny: number;
  /** nilai tersimpan = round(sqrt(penduduk) * skalaAkar) */
  skalaAkar: number;
  v: Uint16Array;
}

export type RumahSakit = [number, number, string];

export function pendudukSel(g: GridPenduduk, indeks: number): number {
  const a = g.v[indeks] / g.skalaAkar;
  return a * a;
}

/** Jalankan `fn(jarakKm, penduduk)` untuk tiap sel berpenduduk dalam radius. */
function tiapSelDalamRadius(g: GridPenduduk, lon: number, lat: number, radiusKm: number, fn: (jarak: number, penduduk: number) => void): void {
  const dLat = radiusKm / 111.195;
  const dLon = radiusKm / (111.195 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const i0 = Math.max(0, Math.floor((lon - dLon - g.lon0) / g.dx));
  const i1 = Math.min(g.nx - 1, Math.ceil((lon + dLon - g.lon0) / g.dx));
  const j0 = Math.max(0, Math.floor((lat - dLat - g.lat0) / g.dx));
  const j1 = Math.min(g.ny - 1, Math.ceil((lat + dLat - g.lat0) / g.dx));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const s = j * g.nx + i;
      if (g.v[s] === 0) continue;
      const d = jarakKm(lon, lat, g.lon0 + i * g.dx, g.lat0 + j * g.dx);
      if (d <= radiusKm) fn(d, pendudukSel(g, s));
    }
}

export function pendudukDalamRadius(g: GridPenduduk, lon: number, lat: number, radiusKm: number): number {
  let total = 0;
  tiapSelDalamRadius(g, lon, lat, radiusKm, (_, p) => {
    total += p;
  });
  return Math.round(total);
}

export interface EksposurMmi {
  /** intensitas dibulatkan (5..10) */
  mmi: number;
  penduduk: number;
}

/** Penduduk per kelas intensitas (MMI V ke atas) untuk gempa skenario. */
export function eksposurGempa(g: GridPenduduk, lon: number, lat: number, mag: number, kedalamanKm: number, radiusLuarKm: number): EksposurMmi[] {
  const kelas = new Map<number, number>();
  tiapSelDalamRadius(g, lon, lat, radiusLuarKm, (d, p) => {
    const m = Math.round(mmi(mag, d, kedalamanKm));
    if (m >= 5) kelas.set(m, (kelas.get(m) ?? 0) + p);
  });
  return [...kelas.entries()].map(([m, p]) => ({ mmi: m, penduduk: Math.round(p) })).sort((a, b) => b.mmi - a.mmi);
}

export interface RsBerjarak {
  nama: string;
  lon: number;
  lat: number;
  jarakKm: number;
}

/** Rumah sakit dalam radius, terdekat dulu. */
export function rsDalamRadius(rs: RumahSakit[], lon: number, lat: number, radiusKm: number): RsBerjarak[] {
  const hasil: RsBerjarak[] = [];
  const dLat = radiusKm / 111.195 + 0.01;
  for (const r of rs) {
    if (Math.abs(r[1] - lat) > dLat) continue;
    const d = jarakKm(lon, lat, r[0], r[1]);
    if (d <= radiusKm) hasil.push({ nama: r[2], lon: r[0], lat: r[1], jarakKm: d });
  }
  return hasil.sort((a, b) => a.jarakKm - b.jarakKm);
}

/** Rumah sakit terdekat yang berada DI LUAR zona bahaya (jarak dari pusat >= radiusAmanKm). */
export function rsAmanTerdekat(rs: RumahSakit[], lon: number, lat: number, radiusAmanKm: number, dari: { lon: number; lat: number }, n = 3): RsBerjarak[] {
  const hasil: RsBerjarak[] = [];
  for (const r of rs) {
    if (jarakKm(lon, lat, r[0], r[1]) < radiusAmanKm) continue;
    hasil.push({ nama: r[2], lon: r[0], lat: r[1], jarakKm: jarakKm(dari.lon, dari.lat, r[0], r[1]) });
  }
  return hasil.sort((a, b) => a.jarakKm - b.jarakKm).slice(0, n);
}

/** "1,2 juta", "340 ribu", "8.400" */
export function formatOrang(n: number, lang: "id" | "en" = "id"): string {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1e6) {
    const v = (n / 1e6).toFixed(n >= 1e7 ? 0 : 1);
    return lang === "id" ? `${v.replace(".", ",")} juta` : `${v}M`;
  }
  if (n >= 1e4) return lang === "id" ? `${Math.round(n / 1e3)} ribu` : `${Math.round(n / 1e3)}K`;
  return Math.round(n).toLocaleString(lang === "id" ? "id-ID" : "en-US");
}
