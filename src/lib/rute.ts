/**
 * Rute jalan dari server demo OSRM (data OpenStreetMap). Gratis dan tanpa kunci, tapi tanpa jaminan
 * layanan: kalau gagal, pemanggil cukup menampilkan garis lurus dan jaraknya.
 */

import type { Batimetri } from "./model/tsunami";
import { jarakKm } from "./geo";

export interface Rute {
  garis: [number, number][];
  jarakKm: number;
  menit: number;
  /** false = garis lurus karena OSRM tidak menjawab */
  jalan: boolean;
}

const OSRM = "https://router.project-osrm.org/route/v1/driving";

export function urlRute(dari: [number, number], ke: [number, number]): string {
  const f = (p: [number, number]) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  return `${OSRM}/${f(dari)};${f(ke)}?overview=simplified&geometries=geojson`;
}

export function uraiRute(data: unknown): Rute | null {
  const r = (data as { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] })?.routes?.[0];
  if (!r?.geometry?.coordinates?.length) return null;
  return { garis: r.geometry.coordinates, jarakKm: r.distance / 1000, menit: r.duration / 60, jalan: true };
}

export async function cariRute(dari: [number, number], ke: [number, number], ambil: typeof fetch = fetch): Promise<Rute> {
  try {
    const res = await ambil(urlRute(dari, ke), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const rute = uraiRute(await res.json());
    if (rute) return rute;
  } catch {
    /* jatuh ke garis lurus */
  }
  const d = jarakKm(dari[0], dari[1], ke[0], ke[1]);
  return { garis: [dari, ke], jarakKm: d, menit: (d / 30) * 60, jalan: false };
}

/**
 * Titik daratan terdekat yang tingginya >= `tinggiMin` meter, dari grid ETOPO yang sama dengan batimetri.
 * Resolusi grid ~7 km, jadi ini arah umum ke dataran tinggi, bukan titik kumpul resmi.
 */
export function dataranTinggiTerdekat(b: Batimetri, lon: number, lat: number, tinggiMin = 25, cariKm = 40): { lon: number; lat: number; tinggi: number; jarakKm: number } | null {
  const r = Math.ceil(cariKm / (b.dx * 111.195));
  const i0 = Math.round((lon - b.lon0) / b.dx);
  const j0 = Math.round((lat - b.lat0) / b.dx);
  let terbaik: { lon: number; lat: number; tinggi: number; jarakKm: number } | null = null;
  for (let j = Math.max(0, j0 - r); j <= Math.min(b.ny - 1, j0 + r); j++)
    for (let i = Math.max(0, i0 - r); i <= Math.min(b.nx - 1, i0 + r); i++) {
      const z = b.z[j * b.nx + i];
      if (z < tinggiMin) continue;
      const x = b.lon0 + i * b.dx;
      const y = b.lat0 + j * b.dx;
      const d = jarakKm(lon, lat, x, y);
      if (d <= cariKm && (!terbaik || d < terbaik.jarakKm)) terbaik = { lon: x, lat: y, tinggi: z, jarakKm: d };
    }
  return terbaik;
}
