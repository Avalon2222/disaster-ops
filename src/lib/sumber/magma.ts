/**
 * Tingkat aktivitas gunung api dari MAGMA Indonesia (PVMBG / Badan Geologi).
 * MAGMA tidak punya API publik, jadi tabel "Tingkat Aktivitas" di halaman web-nya yang dibaca.
 */

import type { GunungApi } from "../jenis";
import { UA_PERAMBAN } from "./gempa";

export const URL_MAGMA = "https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas";

const POLA_LEVEL = /class="tx-inverse[^"]*">\s*Level (I{1,3}|IV) \(([A-Za-z]+)\)\s*<\/a>/;
const POLA_BARIS = /<td>\s*([^<]+?)\s*<a href="(https:\/\/magma\.esdm\.go\.id\/v1\/gunung-api\/laporan\/\d+[^"]*)"/g;
const ANGKA: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };

export const NAMA_LEVEL = ["?", "Normal", "Waspada", "Siaga", "Awas"] as const;

export interface LevelMagma {
  nama: string;
  provinsi: string;
  level: number;
  url: string;
}

/** Tabel MAGMA -> daftar gunung yang levelnya di atas Normal (MAGMA hanya merinci Level II ke atas). */
export function parseMagma(html: string): LevelMagma[] {
  const potongan = html.split(new RegExp(POLA_LEVEL.source, "g"));
  const hasil: LevelMagma[] = [];
  // split dengan dua grup tangkap: [awal, level, status, isi, level, status, isi, ...]
  for (let i = 1; i + 2 < potongan.length; i += 3) {
    const level = ANGKA[potongan[i]] ?? 0;
    for (const m of potongan[i + 2].matchAll(POLA_BARIS)) {
      const teks = m[1].replace(/\s+/g, " ").trim();
      const pisah = teks.lastIndexOf(" - ");
      hasil.push({
        nama: pisah > 0 ? teks.slice(0, pisah).trim() : teks,
        provinsi: pisah > 0 ? teks.slice(pisah + 3).trim() : "",
        level,
        url: m[2].replace(/&amp;/g, "&"),
      });
    }
  }
  return hasil;
}

/** Samakan ejaan nama gunung supaya "Lewotobi Laki-laki" cocok dengan "Lewotobi Laki-Laki". */
export function kunciNama(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/^g(unung|\.)\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

type GunungStatis = Omit<GunungApi, "level" | "url">;

/**
 * Pasangkan level MAGMA dengan koordinat. Gunung yang tidak ada di tabel MAGMA dianggap Level I
 * (Normal) kalau tabelnya berhasil dibaca, atau 0 (tidak diketahui) kalau MAGMA tidak terjangkau.
 */
export function gabungLevel(statis: GunungStatis[], level: LevelMagma[] | null): GunungApi[] {
  const peta = new Map<string, LevelMagma>();
  for (const l of level ?? []) peta.set(kunciNama(l.nama), l);
  return statis.map((g) => {
    const l = peta.get(kunciNama(g.nama));
    return { ...g, level: l ? l.level : level ? 1 : 0, ...(l ? { url: l.url } : {}) };
  });
}

export async function ambilMagma(ambil: typeof fetch = fetch): Promise<LevelMagma[]> {
  const res = await ambil(URL_MAGMA, { headers: { "User-Agent": UA_PERAMBAN, Accept: "text/html" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!res.ok) throw new Error(`MAGMA HTTP ${res.status}`);
  const html = await res.text();
  if (!POLA_LEVEL.test(html)) throw new Error("MAGMA: tabel tingkat aktivitas tidak ditemukan");
  return parseMagma(html);
}
