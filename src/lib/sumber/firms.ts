/**
 * Titik panas NASA FIRMS.
 *
 * Dua jalur:
 * - tanpa kunci: berkas CSV terbuka per kawasan (Asia Tenggara, 24 jam / 7 hari) untuk VIIRS NOAA-20, NOAA-21, dan MODIS
 * - dengan FIRMS_MAP_KEY: area API, langsung dipotong ke kotak Indonesia (unduhan lebih kecil, sensor bisa dipilih)
 * Dua-duanya berformat CSV yang sama, jadi parser-nya satu.
 */

import type { DataHotspot, TitikPanas } from "../jenis";
import { cariPoligonDekat, type PoligonBerkotak } from "../geo";

export const KOTAK_INDONESIA = { lonMin: 94.5, lonMax: 141.5, latMin: -11.5, latMax: 6.5 };

const DASAR = "https://firms.modaps.eosdis.nasa.gov";

export const SENSOR = [
  { kode: "N20", csv: "noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia", api: "VIIRS_NOAA20_NRT" },
  { kode: "N21", csv: "noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia", api: "VIIRS_NOAA21_NRT" },
  { kode: "MODIS", csv: "modis-c6.1/csv/MODIS_C6_1_SouthEast_Asia", api: "MODIS_NRT" },
] as const;

export function urlCsv(sensor: (typeof SENSOR)[number], jam: 24 | 168): string {
  return `${DASAR}/data/active_fire/${sensor.csv}_${jam === 24 ? "24h" : "7d"}.csv`;
}

export function urlApi(sensor: (typeof SENSOR)[number], kunci: string, hari: number): string {
  const k = KOTAK_INDONESIA;
  return `${DASAR}/api/area/csv/${kunci}/${sensor.api}/${k.lonMin},${k.latMin},${k.lonMax},${k.latMax}/${hari}`;
}

/** Keyakinan FIRMS: VIIRS memakai low/nominal/high (l/n/h), MODIS memakai persen. */
export function kelasYakin(nilai: string): 0 | 1 | 2 {
  const v = nilai.trim().toLowerCase();
  if (v === "h" || v === "high") return 2;
  if (v === "n" || v === "nominal") return 1;
  if (v === "l" || v === "low") return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return n >= 80 ? 2 : n >= 30 ? 1 : 0;
}

/**
 * CSV FIRMS -> titik di kotak Indonesia. Titik berkeyakinan rendah dibuang.
 * Kalau `provinsi` diberikan, titik di laut dibuang juga: sensor VIIRS kadang "melihat api" di laut
 * (pantulan matahari, sumur gas), dan itu bukan karhutla.
 */
export function parseCsvFirms(teks: string, indeksSatelit: number, provinsi?: PoligonBerkotak[]): TitikPanas[] {
  const baris = teks.split(/\r?\n/);
  const kepala = (baris[0] ?? "").split(",").map((k) => k.trim());
  const kol = (nama: string) => kepala.indexOf(nama);
  const iLat = kol("latitude");
  const iLon = kol("longitude");
  const iTgl = kol("acq_date");
  const iJam = kol("acq_time");
  const iYakin = kol("confidence");
  const iFrp = kol("frp");
  if (iLat < 0 || iLon < 0 || iTgl < 0 || iJam < 0) return [];
  const k = KOTAK_INDONESIA;
  const hasil: TitikPanas[] = [];
  for (let n = 1; n < baris.length; n++) {
    const b = baris[n];
    if (!b) continue;
    const s = b.split(",");
    const lat = Number(s[iLat]);
    const lon = Number(s[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lon < k.lonMin || lon > k.lonMax || lat < k.latMin || lat > k.latMax) continue;
    const yakin = iYakin >= 0 ? kelasYakin(s[iYakin]) : 1;
    if (yakin === 0) continue;
    const jam = (s[iJam] ?? "").padStart(4, "0");
    const waktu = Date.parse(`${s[iTgl]}T${jam.slice(0, 2)}:${jam.slice(2, 4)}:00Z`);
    if (!Number.isFinite(waktu)) continue;
    let prov = -1;
    if (provinsi) {
      prov = cariPoligonDekat(lon, lat, provinsi, 0.06);
      if (prov < 0) continue;
    }
    const frp = iFrp >= 0 ? Number(s[iFrp]) : 0;
    hasil.push([Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4, Number.isFinite(frp) ? Math.round(frp * 10) / 10 : 0, yakin, Math.round(waktu / 60_000), prov, indeksSatelit]);
  }
  return hasil;
}

export interface OpsiHotspot {
  jam: 24 | 168;
  kunci?: string;
  provinsi?: PoligonBerkotak[];
  ambil?: typeof fetch;
}

/** Ambil semua sensor; sensor yang gagal dilewati selama masih ada satu yang berhasil. */
export async function ambilHotspot({ jam, kunci, provinsi, ambil = fetch }: OpsiHotspot): Promise<DataHotspot> {
  const hasil = await Promise.allSettled(
    SENSOR.map(async (sensor, i) => {
      const url = kunci ? urlApi(sensor, kunci, jam === 24 ? 1 : 7) : urlCsv(sensor, jam);
      const res = await ambil(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
      if (!res.ok) throw new Error(`FIRMS ${sensor.kode} HTTP ${res.status}`);
      const teks = await res.text();
      if (!/^latitude,longitude/.test(teks)) throw new Error(`FIRMS ${sensor.kode}: bukan CSV`);
      return parseCsvFirms(teks, i, provinsi);
    }),
  );
  const titik: TitikPanas[] = [];
  let berhasil = 0;
  for (const h of hasil) {
    if (h.status !== "fulfilled") continue;
    berhasil++;
    for (const t of h.value) titik.push(t);
  }
  if (berhasil === 0) throw new Error("Semua sensor FIRMS gagal");
  const batas = Date.now() / 60_000 - jam * 60 - 180;
  const segar = titik.filter((t) => t[4] >= batas);
  segar.sort((a, b) => b[4] - a[4]);
  return {
    diperbarui: Date.now(),
    sumber: kunci ? "api" : "csv",
    jam,
    satelit: SENSOR.map((s) => s.kode),
    provinsi: provinsi?.map((p) => p.nama) ?? [],
    titik: segar,
  };
}

export interface RingkasProvinsi {
  provinsi: string;
  jumlah: number;
  frp: number;
}

/** Jumlah titik dan total FRP per provinsi, terbanyak dulu. */
export function ringkasPerProvinsi(d: Pick<DataHotspot, "titik" | "provinsi">, sejakMenit = 0): RingkasProvinsi[] {
  const peta = new Map<number, RingkasProvinsi>();
  for (const t of d.titik) {
    if (t[4] < sejakMenit || t[5] < 0) continue;
    const r = peta.get(t[5]) ?? { provinsi: d.provinsi[t[5]] ?? "?", jumlah: 0, frp: 0 };
    r.jumlah++;
    r.frp += t[2];
    peta.set(t[5], r);
  }
  return [...peta.values()].map((r) => ({ ...r, frp: Math.round(r.frp) })).sort((a, b) => b.jumlah - a.jumlah);
}
