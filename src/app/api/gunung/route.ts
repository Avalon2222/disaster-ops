/**
 * Tingkat aktivitas gunung api (MAGMA Indonesia / PVMBG) digabung dengan koordinat.
 * Kalau MAGMA tidak terjangkau, gunungnya tetap dikirim dengan level 0 (tidak diketahui) dan live=false.
 */

import type { DataGunung } from "@/lib/jenis";
import { cache, muatGunung } from "@/lib/server/statis";
import { ambilMagma, gabungLevel } from "@/lib/sumber/magma";

const UMUR_MS = 20 * 60_000;
let simpanan: DataGunung | null = null;

export async function GET() {
  if (simpanan?.live && Date.now() - simpanan.diperbarui < UMUR_MS) return Response.json(simpanan, { headers: cache(1800, 21600) });
  const statis = await muatGunung();
  try {
    simpanan = { diperbarui: Date.now(), live: true, gunung: gabungLevel(statis, await ambilMagma()) };
    return Response.json(simpanan, { headers: cache(1800, 21600) });
  } catch (e) {
    console.error("[gunung]", e instanceof Error ? e.message : e);
    if (simpanan?.live) return Response.json(simpanan, { headers: cache(300, 3600) });
    const kosong: DataGunung = { diperbarui: Date.now(), live: false, gunung: gabungLevel(statis, null) };
    return Response.json(kosong, { headers: cache(120, 600) });
  }
}
