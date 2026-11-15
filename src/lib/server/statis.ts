/** Data statis yang dibutuhkan route API (batas provinsi, gunung api, ibu kota kabupaten), dibaca sekali per instance. */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { siapkanPoligon, type PoligonBerkotak } from "../geo";
import type { GunungApi } from "../jenis";
import { kunciWilayah, type TitikWilayah } from "../sumber/bencana";

const FOLDER = join(process.cwd(), "public", "data");

async function baca<T>(nama: string): Promise<T> {
  return JSON.parse(await readFile(join(FOLDER, nama), "utf8")) as T;
}

let janjiProvinsi: Promise<PoligonBerkotak[]> | null = null;

export function muatProvinsi(): Promise<PoligonBerkotak[]> {
  janjiProvinsi ??= baca<{ features: { properties: { provinsi: string }; geometry: { type: string; coordinates: unknown } }[] }>("provinsi.geojson").then((g) =>
    g.features.map((f) => siapkanPoligon(f.properties.provinsi, f.geometry)),
  );
  return janjiProvinsi;
}

let janjiGunung: Promise<Omit<GunungApi, "level" | "url">[]> | null = null;

export function muatGunung(): Promise<Omit<GunungApi, "level" | "url">[]> {
  janjiGunung ??= baca("gunung.json");
  return janjiGunung;
}

interface Kota {
  nama: string;
  lat: number;
  lon: number;
  kab?: string;
}

let janjiWilayah: Promise<Map<string, TitikWilayah>> | null = null;

/** Peta nama kabupaten/kota -> koordinat ibu kotanya, untuk menaruh rekap BNPB di peta. */
export function muatWilayah(): Promise<Map<string, TitikWilayah>> {
  janjiWilayah ??= baca<Kota[]>("kota.json").then((kota) => {
    const peta = new Map<string, TitikWilayah>();
    for (const k of kota) {
      const titik = { lon: k.lon, lat: k.lat };
      // nama kabupaten menang atas nama kota biasa; kota utama (Jakarta, Bima, ...) mengisi yang belum ada
      if (k.kab) peta.set(kunciWilayah(k.kab), titik);
      const kunci = kunciWilayah(k.nama);
      if (!peta.has(kunci)) peta.set(kunci, titik);
    }
    return peta;
  });
  return janjiWilayah;
}

/** Jawaban galat seragam: browser cukup tahu kodenya, rinciannya ada di log server. */
export function galat(nama: string, e: unknown, status = 502): Response {
  console.error(`[${nama}]`, e instanceof Error ? e.message : e);
  return Response.json({ galat: "upstream" }, { status, headers: { "Cache-Control": "no-store" } });
}

export function cache(detik: number, basi: number): { "Cache-Control": string } {
  return { "Cache-Control": `public, max-age=${Math.min(60, detik)}, s-maxage=${detik}, stale-while-revalidate=${basi}` };
}
