/**
 * Risiko banjir dari prakiraan: akumulasi hujan (kategori BMKG) dan debit sungai GloFAS.
 * Ini saringan cepat ("di mana perlu waspada"), bukan model genangan.
 */

import type { PrakiraanSungai } from "../jenis";

/** 0 aman, 1 waspada, 2 siaga, 3 awas */
export type TingkatRisiko = 0 | 1 | 2 | 3;

/** Ambang hujan (mm): BMKG menyebut >50 mm/hari lebat, >100 sangat lebat, >150 ekstrem. */
export const AMBANG_24_JAM = [50, 100, 150] as const;
export const AMBANG_72_JAM = [100, 200, 300] as const;

export function tingkatHujan(maks24: number, total72: number): TingkatRisiko {
  let t: TingkatRisiko = 0;
  for (let i = 0; i < 3; i++) if (maks24 >= AMBANG_24_JAM[i] || total72 >= AMBANG_72_JAM[i]) t = (i + 1) as TingkatRisiko;
  return t;
}

export interface RisikoHujan {
  /** mm x10 per sel */
  maks24: Float32Array;
  total72: Float32Array;
  tingkat: Uint8Array;
}

/**
 * Dari deret hujan per langkah [langkah][sel] (mm x10) hitung jendela 24 jam terbasah dan total
 * 72 jam per sel, mulai dari langkah `awal`.
 */
export function risikoHujan(hujan: number[][], langkahJam: number, awal = 0): RisikoHujan {
  const nSel = hujan[0]?.length ?? 0;
  const n24 = Math.max(1, Math.round(24 / langkahJam));
  const n72 = Math.round(72 / langkahJam);
  const akhir = Math.min(hujan.length, awal + n72);
  const maks24 = new Float32Array(nSel);
  const total72 = new Float32Array(nSel);
  const tingkat = new Uint8Array(nSel);
  for (let s = 0; s < nSel; s++) {
    let total = 0;
    let jendela = 0;
    let maks = 0;
    for (let t = awal; t < akhir; t++) {
      const v = Math.max(0, hujan[t][s]) / 10;
      total += v;
      jendela += v;
      if (t - awal >= n24) jendela -= Math.max(0, hujan[t - n24][s]) / 10;
      if (jendela > maks) maks = jendela;
    }
    maks24[s] = maks;
    total72[s] = total;
    tingkat[s] = tingkatHujan(maks, total);
  }
  return { maks24, total72, tingkat };
}

export interface StatusSungai {
  tingkat: TingkatRisiko;
  /** debit puncak 7 hari ke depan (m3/s) dan hari ke berapa */
  puncak: number;
  hariPuncak: number;
  /** puncak dibanding persentil 90 klimatologi */
  rasio: number;
}

/** Debit puncak prakiraan dibanding klimatologi: >= p90 waspada, >= p99 siaga, >= 1,5 x p99 awas. */
export function statusSungai(s: Pick<PrakiraanSungai, "debit" | "p90" | "p99">, hari = 7): StatusSungai {
  let puncak = 0;
  let hariPuncak = 0;
  s.debit.slice(0, hari).forEach((q, i) => {
    if (q > puncak) {
      puncak = q;
      hariPuncak = i;
    }
  });
  let tingkat: TingkatRisiko = 0;
  if (s.p90 > 0 && puncak >= s.p90) tingkat = 1;
  if (s.p99 > 0 && puncak >= s.p99) tingkat = 2;
  if (s.p99 > 0 && puncak >= 1.5 * s.p99) tingkat = 3;
  return { tingkat, puncak, hariPuncak, rasio: s.p90 > 0 ? puncak / s.p90 : 0 };
}

export const NAMA_TINGKAT: Record<TingkatRisiko, { id: string; en: string }> = {
  0: { id: "Aman", en: "Normal" },
  1: { id: "Waspada", en: "Advisory" },
  2: { id: "Siaga", en: "Watch" },
  3: { id: "Awas", en: "Warning" },
};

export const WARNA_TINGKAT: Record<TingkatRisiko, string> = { 0: "#4ade80", 1: "#fde047", 2: "#fb923c", 3: "#ef4444" };
