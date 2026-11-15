/**
 * Ubin peta bahaya InaRISK (BNPB). Server ArcGIS BNPB tidak mengirim header CORS, jadi gambarnya
 * diteruskan lewat sini: /api/inarisk/gempa?bbox=<xmin,ymin,xmax,ymax EPSG:3857>
 * Peta bahayanya jarang berubah, jadi hasilnya disimpan CDN sebulan.
 */

import { UA_PERAMBAN } from "@/lib/sumber/gempa";

const LAYANAN: Record<string, string> = {
  gempa: "layer_bahaya_gempabumi",
  tsunami: "layer_bahaya_tsunami",
  banjir: "layer_bahaya_banjir",
  longsor: "layer_bahaya_tanah_longsor",
  karhutla: "layer_bahaya_kebakaran_hutan_dan_lahan",
  gunungapi: "layer_bahaya_letusan_gunungapi",
};

const DASAR = "https://gis.bnpb.go.id/server/rest/services/inarisk";
// piksel transparan 1x1: dikirim kalau BNPB gagal, supaya peta tidak penuh ubin rusak
const KOSONG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

export async function GET(req: Request, { params }: { params: Promise<{ jenis: string }> }) {
  const { jenis } = await params;
  const layanan = LAYANAN[jenis];
  const bbox = new URL(req.url).searchParams.get("bbox") ?? "";
  const angka = bbox.split(",").map(Number);
  if (!layanan || angka.length !== 4 || !angka.every(Number.isFinite)) return Response.json({ galat: "bad_request" }, { status: 400 });
  const aturan = encodeURIComponent(JSON.stringify({ rasterFunction: layanan }));
  const url = `${DASAR}/${layanan}/ImageServer/exportImage?bbox=${angka.join(",")}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&f=image&renderingRule=${aturan}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA_PERAMBAN }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(`InaRISK ${jenis} HTTP ${res.status}`);
    return new Response(await res.arrayBuffer(), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=31536000" },
    });
  } catch (e) {
    console.error("[inarisk]", e instanceof Error ? e.message : e);
    return new Response(KOSONG, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60, s-maxage=300" } });
  }
}
