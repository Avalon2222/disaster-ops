/** Kejadian bencana: rekap mingguan BNPB per kabupaten + laporan warga PetaBencana.id (7 hari). */

import type { DataBencana } from "@/lib/jenis";
import { cache, galat, muatWilayah } from "@/lib/server/statis";
import { ambilJson, parseBnpb, parsePetaBencana, URL_BNPB, URL_PETABENCANA } from "@/lib/sumber/bencana";

const UMUR_MS = 10 * 60_000;
let simpanan: DataBencana | null = null;

export async function GET() {
  if (simpanan && Date.now() - simpanan.diperbarui < UMUR_MS) return Response.json(simpanan, { headers: cache(900, 3600) });
  const wilayah = await muatWilayah();
  const [bnpb, laporan] = await Promise.allSettled([ambilJson(URL_BNPB, fetch, 20_000).then((d) => parseBnpb(d, wilayah)), ambilJson(URL_PETABENCANA).then(parsePetaBencana)]);
  const sumber: string[] = [];
  if (bnpb.status === "fulfilled") sumber.push("BNPB");
  else console.error("[bencana] BNPB:", bnpb.reason instanceof Error ? bnpb.reason.message : bnpb.reason);
  if (laporan.status === "fulfilled") sumber.push("PetaBencana.id");
  else console.error("[bencana] PetaBencana:", laporan.reason instanceof Error ? laporan.reason.message : laporan.reason);
  if (sumber.length === 0) {
    if (simpanan) return Response.json(simpanan, { headers: cache(120, 600) });
    return galat("bencana", "BNPB dan PetaBencana tidak terjangkau");
  }
  simpanan = {
    diperbarui: Date.now(),
    // sumber yang gagal kali ini memakai data terakhir yang berhasil, kalau ada
    bnpb: bnpb.status === "fulfilled" ? bnpb.value : (simpanan?.bnpb ?? []),
    laporan: laporan.status === "fulfilled" ? laporan.value : (simpanan?.laporan ?? []),
    sumber,
  };
  return Response.json(simpanan, { headers: cache(900, 3600) });
}
