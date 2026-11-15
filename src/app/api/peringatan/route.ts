/** Peringatan dini cuaca BMKG (nowcast) yang sedang berlaku, lengkap dengan poligon wilayahnya. */

import type { DataPeringatan } from "@/lib/jenis";
import { cache, galat } from "@/lib/server/statis";
import { ambilPeringatan } from "@/lib/sumber/peringatan";

const UMUR_MS = 4 * 60_000;
let simpanan: DataPeringatan | null = null;

export async function GET() {
  if (simpanan && Date.now() - simpanan.diperbarui < UMUR_MS) return Response.json(simpanan, { headers: cache(300, 900) });
  try {
    simpanan = { diperbarui: Date.now(), peringatan: await ambilPeringatan() };
    return Response.json(simpanan, { headers: cache(300, 900) });
  } catch (e) {
    if (simpanan) return Response.json(simpanan, { headers: cache(60, 300) });
    return galat("peringatan", e);
  }
}
