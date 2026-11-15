/**
 * Kejadian bencana: rekap mingguan BNPB (ArcGIS gis.bnpb.go.id) dan laporan warga PetaBencana.id.
 */

import type { KejadianBnpb, LaporanWarga } from "../jenis";
import { UA_PERAMBAN } from "./gempa";

export const URL_BNPB =
  "https://gis.bnpb.go.id/server/rest/services/Kejadian_Bencana_Mingguan/MapServer/25/query?where=1%3D1&outFields=*&returnGeometry=false&f=json";
export const URL_PETABENCANA = "https://data.petabencana.id/reports?timeperiod=604800&geoformat=geojson";

/** "Kab. Aceh Barat Daya" / "KOTA BIMA" -> "acehbaratdaya" / "bima" */
export function kunciWilayah(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/^(kabupaten|kab\.?|kota adm\.?|kota administrasi|kota)\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

export interface TitikWilayah {
  lon: number;
  lat: number;
}

interface AtributBnpb {
  dt?: number;
  kabupaten?: string;
  kategori_bencana?: string;
  jumlah_kejadian?: number;
  meninggal?: number;
  hilang?: number;
  luka_sakit?: number;
  mengungsi?: number;
  rumah_rusak?: number;
  rumah_terendam?: number;
  kronologis?: string;
  id?: string;
  objectid?: number;
}

/** Rekap BNPB -> kejadian per kabupaten; lokasi dari ibu kota kabupaten karena poligonnya berat. */
export function parseBnpb(data: unknown, wilayah: Map<string, TitikWilayah>): KejadianBnpb[] {
  const fitur = (data as { features?: { attributes: AtributBnpb }[] })?.features ?? [];
  const hasil: KejadianBnpb[] = [];
  for (const f of fitur) {
    const a = f.attributes ?? {};
    const kab = (a.kabupaten ?? "").trim();
    const titik = wilayah.get(kunciWilayah(kab));
    if (!kab || !titik || typeof a.dt !== "number") continue;
    hasil.push({
      id: `bnpb-${a.id ?? a.objectid ?? `${kab}-${a.dt}`}`,
      waktu: a.dt,
      kabupaten: kab,
      jenis: (a.kategori_bencana ?? "").trim(),
      kejadian: a.jumlah_kejadian ?? 1,
      meninggal: a.meninggal ?? 0,
      hilang: a.hilang ?? 0,
      luka: a.luka_sakit ?? 0,
      mengungsi: a.mengungsi ?? 0,
      rumahRusak: a.rumah_rusak ?? 0,
      rumahTerendam: a.rumah_terendam ?? 0,
      kronologi: (a.kronologis ?? "").replace(/\s+/g, " ").trim().slice(0, 600),
      lon: titik.lon,
      lat: titik.lat,
    });
  }
  return hasil.sort((x, y) => y.waktu - x.waktu);
}

interface FiturLaporan {
  geometry: { coordinates: number[] };
  properties: {
    pkey: string;
    created_at: string;
    disaster_type?: string;
    report_data?: { flood_depth?: number } | null;
    text?: string | null;
    title?: string | null;
    image_url?: string | null;
    tags?: { city?: string | null } | null;
  };
}

/** Rapikan "ACEH BARAT DAYA" jadi "Aceh Barat Daya". */
export function hurufJudul(teks: string): string {
  return teks.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

export function parsePetaBencana(data: unknown): LaporanWarga[] {
  const fitur = (data as { result?: { features?: FiturLaporan[] } })?.result?.features ?? [];
  const hasil: LaporanWarga[] = [];
  for (const f of fitur) {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    const waktu = Date.parse(f.properties?.created_at ?? "");
    if (![lon, lat, waktu].every(Number.isFinite)) continue;
    const dalam = f.properties.report_data?.flood_depth;
    const gambar = f.properties.image_url;
    hasil.push({
      id: `pb-${f.properties.pkey}`,
      waktu,
      lon: Math.round(lon * 1e4) / 1e4,
      lat: Math.round(lat * 1e4) / 1e4,
      jenis: f.properties.disaster_type ?? "flood",
      ...(typeof dalam === "number" ? { kedalaman: dalam } : {}),
      teks: (f.properties.text ?? f.properties.title ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
      ...(gambar && /^https:\/\/images\.petabencana\.id\//.test(gambar) ? { gambar } : {}),
      kota: hurufJudul(f.properties.tags?.city ?? ""),
    });
  }
  return hasil.sort((a, b) => b.waktu - a.waktu);
}

export async function ambilJson(url: string, ambil: typeof fetch = fetch, batasMs = 15_000): Promise<unknown> {
  const res = await ambil(url, { headers: { "User-Agent": UA_PERAMBAN, Accept: "application/json" }, signal: AbortSignal.timeout(batasMs), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).host}`);
  return res.json();
}
