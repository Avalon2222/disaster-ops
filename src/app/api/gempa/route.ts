/** Gempa 7 hari terakhir: BMKG InaTEWS (real-time, dirasakan, peringatan tsunami) + USGS, sudah digabung. */

import type { DataGempa } from "@/lib/jenis";
import { cache, galat } from "@/lib/server/statis";
import { ambilGempa } from "@/lib/sumber/gempa";

const UMUR_MS = 45_000;
let simpanan: DataGempa | null = null;

export async function GET() {
  if (simpanan && Date.now() - simpanan.diperbarui < UMUR_MS) return Response.json(simpanan, { headers: cache(60, 300) });
  try {
    simpanan = await ambilGempa(7);
    return Response.json(simpanan, { headers: cache(60, 300) });
  } catch (e) {
    if (simpanan) return Response.json(simpanan, { headers: cache(30, 120) });
    return galat("gempa", e);
  }
}
