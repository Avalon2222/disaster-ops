/**
 * Gempa: BMKG InaTEWS (real-time, gempa dirasakan, peringatan tsunami) digabung dengan USGS.
 * BMKG jadi acuan di wilayah Indonesia; USGS mengisi gempa yang belum/tidak dilaporkan BMKG.
 */

import type { DataGempa, Gempa } from "../jenis";
import { jarakKm } from "../geo";

export const UA_PERAMBAN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const INATEWS = "https://bmkg-content-inatews.storage.googleapis.com";
export const URL_BMKG_QL = `${INATEWS}/gempaQL.json`;
export const URL_BMKG_DIRASAKAN = `${INATEWS}/last30feltevent.xml`;
export const URL_BMKG_TSUNAMI = `${INATEWS}/last30tsunamievent.xml`;
export const MAG_MIN = 2.5;
export const KOTAK_GEMPA = { lonMin: 91, lonMax: 143, latMin: -13, latMax: 9 };

export function urlUsgs(hari: number, magMin = 2.5): string {
  const mulai = new Date(Date.now() - hari * 86_400_000).toISOString().slice(0, 19);
  const k = KOTAK_GEMPA;
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${mulai}&minmagnitude=${magMin}&minlatitude=${k.latMin}&maxlatitude=${k.latMax}&minlongitude=${k.lonMin}&maxlongitude=${k.lonMax}&orderby=time`;
}

interface FiturQl {
  geometry: { coordinates: (string | number)[] };
  properties: { id: string; time: string; mag: string; depth: string; place: string };
}

/** gempaQL.json: daftar real-time BMKG (waktu UTC "2026-11-14 23:22:26.962436"). */
export function parseBmkgQl(data: unknown): Gempa[] {
  const fitur = (data as { features?: FiturQl[] })?.features ?? [];
  const hasil: Gempa[] = [];
  for (const f of fitur) {
    const lon = Number(f.geometry?.coordinates?.[0]);
    const lat = Number(f.geometry?.coordinates?.[1]);
    const mag = Number(f.properties?.mag);
    const waktu = Date.parse(`${String(f.properties?.time ?? "").replace(" ", "T").slice(0, 23)}Z`);
    if (![lon, lat, mag, waktu].every(Number.isFinite)) continue;
    hasil.push({
      id: `bmkg-${f.properties.id}`,
      sumber: "BMKG",
      waktu,
      lon: Math.round(lon * 1000) / 1000,
      lat: Math.round(lat * 1000) / 1000,
      dalam: Math.round(Number(f.properties.depth) || 0),
      mag: Math.round(mag * 10) / 10,
      tempat: f.properties.place ?? "",
    });
  }
  return hasil;
}

function tag(xml: string, nama: string): string {
  const m = xml.match(new RegExp(`<${nama}>([\\s\\S]*?)</${nama}>`));
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

/** "15-11-26" + "04:24:20 WIB" -> ms UTC */
export function waktuBmkg(tanggal: string, jam: string): number {
  const t = tanggal.match(/(\d{2})-(\d{2})-(\d{2})/);
  const j = jam.match(/(\d{2}):(\d{2}):(\d{2})\s*(WIB|WITA|WIT|UTC)?/);
  if (!t || !j) return NaN;
  const geser = j[4] === "WITA" ? 8 : j[4] === "WIT" ? 9 : j[4] === "UTC" ? 0 : 7;
  return Date.UTC(2000 + Number(t[3]), Number(t[2]) - 1, Number(t[1]), Number(j[1]) - geser, Number(j[2]), Number(j[3]));
}

/** last30feltevent.xml / last30tsunamievent.xml: kumpulan <info> ala CAP. */
export function parseBmkgCap(xml: string, jenis: "dirasakan" | "tsunami"): Gempa[] {
  const hasil: Gempa[] = [];
  for (const blok of xml.split("<info>").slice(1)) {
    const koordinat = tag(blok, "coordinates").split(",").map(Number);
    const mag = Number(tag(blok, "magnitude"));
    const waktu = waktuBmkg(tag(blok, "date"), tag(blok, "time"));
    if (koordinat.length < 2 || ![koordinat[0], koordinat[1], mag, waktu].every(Number.isFinite)) continue;
    const idAcara = tag(blok, "eventid");
    const peta = tag(blok, "shakemap");
    const potensi = tag(blok, "potential");
    const g: Gempa = {
      id: `bmkg-${jenis === "tsunami" ? "t" : "f"}${idAcara}`,
      sumber: "BMKG",
      waktu,
      lon: koordinat[0],
      lat: koordinat[1],
      dalam: Math.round(Number(tag(blok, "depth").replace(/[^\d.]/g, "")) || 0),
      mag,
      tempat: tag(blok, "area"),
      potensi,
    };
    const dirasakan = tag(blok, "felt");
    if (dirasakan) g.dirasakan = dirasakan;
    if (peta) g.shakemap = `${INATEWS}/${peta}`;
    if (jenis === "tsunami" && /tsunami/i.test(potensi) && !/tidak berpotensi/i.test(potensi)) g.tsunami = true;
    hasil.push(g);
  }
  return hasil;
}

interface FiturUsgs {
  id: string;
  geometry: { coordinates: number[] };
  properties: { mag: number | null; place: string | null; time: number; url: string; tsunami?: number };
}

export function parseUsgs(data: unknown): Gempa[] {
  const fitur = (data as { features?: FiturUsgs[] })?.features ?? [];
  const hasil: Gempa[] = [];
  for (const f of fitur) {
    const [lon, lat, dalam] = f.geometry?.coordinates ?? [];
    const mag = f.properties?.mag;
    if (typeof mag !== "number" || ![lon, lat, f.properties.time].every(Number.isFinite)) continue;
    hasil.push({
      id: `usgs-${f.id}`,
      sumber: "USGS",
      waktu: f.properties.time,
      lon: Math.round(lon * 1000) / 1000,
      lat: Math.round(lat * 1000) / 1000,
      dalam: Math.round(dalam || 0),
      mag: Math.round(mag * 10) / 10,
      tempat: f.properties.place ?? "",
      url: f.properties.url,
      ...(f.properties.tsunami ? { tsunami: true } : {}),
    });
  }
  return hasil;
}

/** Dua catatan dianggap gempa yang sama kalau selisih waktunya < 2 menit dan jaraknya < 150 km. */
export function gempaSama(a: Gempa, b: Gempa): boolean {
  return Math.abs(a.waktu - b.waktu) < 120_000 && jarakKm(a.lon, a.lat, b.lon, b.lat) < 150;
}

/**
 * Gabungkan sumber. Urutan prioritas: BMKG dirasakan/tsunami (paling kaya: MMI, shakemap),
 * lalu BMKG real-time, lalu USGS. Catatan yang lebih miskin melengkapi yang sudah ada.
 */
export function gabungGempa(kaya: Gempa[], realtime: Gempa[], usgs: Gempa[]): Gempa[] {
  const hasil: Gempa[] = [];
  const tambah = (g: Gempa) => {
    const ada = hasil.find((h) => gempaSama(h, g));
    if (!ada) {
      hasil.push({ ...g });
      return;
    }
    if (!ada.url && g.url) ada.url = g.url;
    if (!ada.dirasakan && g.dirasakan) ada.dirasakan = g.dirasakan;
    if (!ada.shakemap && g.shakemap) ada.shakemap = g.shakemap;
    if (!ada.potensi && g.potensi) ada.potensi = g.potensi;
    if (g.tsunami) ada.tsunami = true;
  };
  for (const g of kaya) tambah(g);
  for (const g of realtime) tambah(g);
  for (const g of usgs) tambah(g);
  return hasil.sort((a, b) => b.waktu - a.waktu);
}

async function teks(url: string, ambil: typeof fetch): Promise<string> {
  const res = await ambil(url, { headers: { "User-Agent": UA_PERAMBAN }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/** Ambil dan gabungkan semua sumber untuk `hari` terakhir; satu sumber gagal tidak menggagalkan semuanya. */
export async function ambilGempa(hari = 7, ambil: typeof fetch = fetch): Promise<DataGempa> {
  const [ql, dirasakan, tsunami, usgs] = await Promise.allSettled([
    teks(URL_BMKG_QL, ambil).then((t) => parseBmkgQl(JSON.parse(t))),
    teks(URL_BMKG_DIRASAKAN, ambil).then((t) => parseBmkgCap(t, "dirasakan")),
    teks(URL_BMKG_TSUNAMI, ambil).then((t) => parseBmkgCap(t, "tsunami")),
    teks(urlUsgs(hari), ambil).then((t) => parseUsgs(JSON.parse(t))),
  ]);
  const sumber: string[] = [];
  if (ql.status === "fulfilled" || dirasakan.status === "fulfilled") sumber.push("BMKG");
  if (usgs.status === "fulfilled") sumber.push("USGS");
  if (sumber.length === 0) throw new Error("BMKG dan USGS tidak terjangkau");
  const batas = Date.now() - hari * 86_400_000;
  const kaya = [...(tsunami.status === "fulfilled" ? tsunami.value : []), ...(dirasakan.status === "fulfilled" ? dirasakan.value : [])].filter((g) => g.waktu >= batas);
  // feed real-time BMKG memuat ratusan gempa mikro per minggu; yang di bawah M2,5 hanya jadi derau di peta
  const realtime = (ql.status === "fulfilled" ? ql.value : []).filter((g) => g.waktu >= batas && g.mag >= MAG_MIN);
  const luar = (usgs.status === "fulfilled" ? usgs.value : []).filter((g) => g.waktu >= batas);
  // BMKG juga mengumumkan gempa besar di luar negeri; konsol ini hanya soal Indonesia dan sekitarnya
  const k = KOTAK_GEMPA;
  const gempa = gabungGempa(kaya, realtime, luar).filter((g) => g.lon >= k.lonMin && g.lon <= k.lonMax && g.lat >= k.latMin && g.lat <= k.latMax);
  return { diperbarui: Date.now(), sumber, gempa };
}
