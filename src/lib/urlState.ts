/**
 * Status tampilan di URL hash agar bisa dibagikan:
 *   #v=lat/lon/zoom/bearing/pitch&l=hotspot,gempa&lang=en&sat=1&2d=1&alat=tsunami
 */

import type { Lang } from "./i18n";
import { ID_LAPISAN, type IdLapisan } from "./lapisan";

export interface Tampilan {
  lat: number;
  lon: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export type AlatUrl = "warroom" | "gempa" | "tsunami" | "replay";
const ALAT: AlatUrl[] = ["warroom", "gempa", "tsunami", "replay"];

export interface StatusUrl {
  tampilan?: Tampilan;
  lapisan?: IdLapisan[];
  lang?: Lang;
  sat?: boolean;
  datar?: boolean;
  alat?: AlatUrl;
}

export const TAMPILAN_AWAL: Tampilan = { lat: -2.5, lon: 118, zoom: 3.9, bearing: 0, pitch: 0 };

/**
 * Tampilan awal yang pas dengan layar: Indonesia (95-141 BT) selebar layar.
 * Di desktop tetap zoom 3,9; di HP zoom diturunkan supaya Sabang sampai Merauke kelihatan semua.
 */
export function tampilanAwal(lebar: number = typeof window === "undefined" ? 1440 : window.innerWidth): Tampilan {
  const zoomPas = Math.log2((lebar * 0.96 * 360) / 48 / 512);
  return { ...TAMPILAN_AWAL, zoom: Math.min(TAMPILAN_AWAL.zoom, Math.round(zoomPas * 100) / 100) };
}

export function uraiHash(hash: string): StatusUrl {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const s: StatusUrl = {};
  const v = p.get("v");
  if (v) {
    const [lat, lon, zoom, bearing, pitch] = v.split("/").map(Number);
    if ([lat, lon, zoom].every((x) => Number.isFinite(x)) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180 && zoom >= 0 && zoom <= 20) {
      s.tampilan = { lat, lon, zoom, bearing: bearing || 0, pitch: Math.min(70, Math.max(0, pitch || 0)) };
    }
  }
  const l = p.get("l");
  if (l !== null) s.lapisan = l.split(",").filter((x): x is IdLapisan => (ID_LAPISAN as string[]).includes(x));
  const lang = p.get("lang");
  if (lang === "en" || lang === "id") s.lang = lang;
  if (p.get("sat") === "1") s.sat = true;
  if (p.get("2d") === "1") s.datar = true;
  const alat = p.get("alat");
  if (alat && (ALAT as string[]).includes(alat)) s.alat = alat as AlatUrl;
  return s;
}

export function bacaUrl(): StatusUrl {
  if (typeof window === "undefined") return {};
  return uraiHash(window.location.hash);
}

export function susunHash(s: { tampilan: Tampilan; lapisan: IdLapisan[]; lang: Lang; sat: boolean; datar: boolean; alat?: AlatUrl | null }): string {
  const p = new URLSearchParams();
  const t = s.tampilan;
  p.set("v", [t.lat.toFixed(3), t.lon.toFixed(3), t.zoom.toFixed(2), Math.round(t.bearing), Math.round(t.pitch)].join("/"));
  p.set("l", s.lapisan.join(","));
  if (s.lang !== "id") p.set("lang", s.lang);
  if (s.sat) p.set("sat", "1");
  if (s.datar) p.set("2d", "1");
  if (s.alat) p.set("alat", s.alat);
  return "#" + p.toString().replace(/%2F/g, "/").replace(/%2C/g, ",");
}

export function tulisUrl(s: Parameters<typeof susunHash>[0]): void {
  if (typeof window === "undefined") return;
  const baru = susunHash(s);
  if (window.location.hash !== baru) window.history.replaceState(null, "", baru);
}
