/**
 * Peringatan dini cuaca BMKG (nowcast). RSS-nya berisi daftar peringatan per provinsi, tiap butir
 * menunjuk ke berkas CAP (Common Alerting Protocol) yang memuat poligon wilayah terdampak.
 */

import type { Peringatan } from "../jenis";
import { UA_PERAMBAN } from "./gempa";

export const URL_RSS_NOWCAST = "https://www.bmkg.go.id/alerts/nowcast/id";
const POLA_TAUTAN_CAP = /^https:\/\/www\.bmkg\.go\.id\/alerts\/nowcast\/id\/[A-Za-z0-9_]+_alert\.xml$/;

function tag(xml: string, nama: string): string {
  const m = xml.match(new RegExp(`<${nama}>([\\s\\S]*?)</${nama}>`));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
}

/** Tautan berkas CAP dari RSS (tautan ke host lain diabaikan). */
export function tautanCap(rss: string): string[] {
  const hasil: string[] = [];
  for (const butir of rss.split("<item>").slice(1)) {
    const tautan = tag(butir, "link");
    if (POLA_TAUTAN_CAP.test(tautan)) hasil.push(tautan);
  }
  return hasil;
}

/** "lat,lon lat,lon ..." (urutan CAP) -> ring [lon, lat][] */
export function ringCap(teks: string): [number, number][] {
  const ring: [number, number][] = [];
  for (const pasangan of teks.trim().split(/\s+/)) {
    const [lat, lon] = pasangan.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) ring.push([lon, lat]);
  }
  return ring;
}

export function parseCap(xml: string): Peringatan | null {
  const id = tag(xml, "identifier");
  const info = xml.split("<info>")[1] ?? "";
  const poligon = [...info.matchAll(/<polygon>([\s\S]*?)<\/polygon>/g)].map((m) => ringCap(m[1])).filter((r) => r.length >= 4);
  const mulai = Date.parse(tag(info, "effective") || tag(xml, "sent"));
  const berakhir = Date.parse(tag(info, "expires"));
  if (!id || poligon.length === 0 || !Number.isFinite(mulai)) return null;
  const infografis = tag(info, "web");
  return {
    id,
    judul: tag(info, "headline"),
    kejadian: tag(info, "event"),
    wilayah: tag(info, "areaDesc"),
    deskripsi: tag(info, "description").replace(/\s+/g, " "),
    mulai,
    berakhir: Number.isFinite(berakhir) ? berakhir : mulai + 3 * 3600_000,
    tingkat: tag(info, "severity"),
    ...(/^https:\/\/nowcasting\.bmkg\.go\.id\//.test(infografis) ? { infografis } : {}),
    poligon,
  };
}

async function teks(url: string, ambil: typeof fetch): Promise<string> {
  const res = await ambil(url, { headers: { "User-Agent": UA_PERAMBAN }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/** Ambil semua peringatan yang masih berlaku (atau baru berakhir < 1 jam). */
export async function ambilPeringatan(ambil: typeof fetch = fetch, sekarang = Date.now()): Promise<Peringatan[]> {
  const rss = await teks(URL_RSS_NOWCAST, ambil);
  const hasil = await Promise.allSettled(tautanCap(rss).slice(0, 40).map((u) => teks(u, ambil).then(parseCap)));
  const daftar: Peringatan[] = [];
  for (const h of hasil) if (h.status === "fulfilled" && h.value && h.value.berakhir > sekarang - 3600_000) daftar.push(h.value);
  return daftar.sort((a, b) => a.mulai - b.mulai);
}
