/**
 * Titik panas NASA FIRMS (VIIRS NOAA-20/21 + MODIS) di daratan Indonesia.
 * ?jam=24 (default) atau ?jam=168 (7 hari). Dengan FIRMS_MAP_KEY memakai area API, tanpa itu berkas CSV terbuka.
 */

import type { DataHotspot } from "@/lib/jenis";
import { cache, galat, muatProvinsi } from "@/lib/server/statis";
import { ambilHotspot } from "@/lib/sumber/firms";

const UMUR_MS = 10 * 60_000;
const simpanan = new Map<number, DataHotspot>();

export async function GET(req: Request) {
  const jam = new URL(req.url).searchParams.get("jam") === "168" ? 168 : 24;
  const ada = simpanan.get(jam);
  if (ada && Date.now() - ada.diperbarui < UMUR_MS) return Response.json(ada, { headers: cache(600, 3600) });
  try {
    const data = await ambilHotspot({ jam, kunci: process.env.FIRMS_MAP_KEY || undefined, provinsi: await muatProvinsi() });
    simpanan.set(jam, data);
    return Response.json(data, { headers: cache(600, 3600) });
  } catch (e) {
    // sumber gagal tapi masih ada data lama: lebih baik basi daripada kosong
    if (ada) return Response.json(ada, { headers: cache(120, 600) });
    return galat("hotspot", e);
  }
}
