/** Pembaca data asli di public/data untuk tes unit: modelnya diuji terhadap berkas yang benar-benar di-deploy. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siapkanPoligon, type PoligonBerkotak } from "@/lib/geo";
import type { SnapshotCuaca } from "@/lib/jenis";
import type { GridPenduduk, RumahSakit } from "@/lib/model/eksposur";
import type { Batimetri } from "@/lib/model/tsunami";
import type { Kota, MetaGrid } from "@/lib/statis";

const FOLDER = join(process.cwd(), "public", "data");

export function bacaJson<T>(nama: string): T {
  return JSON.parse(readFileSync(join(FOLDER, nama), "utf8")) as T;
}

function bacaBiner(nama: string): ArrayBuffer {
  const b = readFileSync(join(FOLDER, nama));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

export const meta = () => bacaJson<MetaGrid>("grid.json");

export function batimetri(): Batimetri {
  return { ...meta().batimetri, z: new Int16Array(bacaBiner("batimetri.dat")) };
}

export function penduduk(): GridPenduduk {
  const p = meta().populasi;
  return { lon0: p.lon0, lat0: p.lat0, dx: p.dx, nx: p.nx, ny: p.ny, skalaAkar: p.skala_akar, v: new Uint16Array(bacaBiner("populasi.dat")) };
}

export const rumahSakit = () => bacaJson<RumahSakit[]>("rs.json");
export const kota = () => bacaJson<Kota[]>("kota.json");
export const cuaca = () => bacaJson<SnapshotCuaca>("cuaca.json");
export const karhutlaMentah = () => bacaBiner("karhutla2019.dat");

export function provinsi(): PoligonBerkotak[] {
  const g = bacaJson<{ features: { properties: { provinsi: string }; geometry: { type: string; coordinates: unknown } }[] }>("provinsi.geojson");
  return g.features.map((f) => siapkanPoligon(f.properties.provinsi, f.geometry));
}

/** fetch palsu: memetakan potongan URL ke isi jawaban (string = 200, angka = status galat). */
export function fetchPalsu(peta: Record<string, string | number>): typeof fetch {
  return (async (masukan: RequestInfo | URL) => {
    const url = String(masukan);
    for (const [potongan, isi] of Object.entries(peta)) {
      if (!url.includes(potongan)) continue;
      if (typeof isi === "number") return new Response("galat", { status: isi });
      return new Response(isi, { status: 200 });
    }
    return new Response("tidak ada", { status: 404 });
  }) as typeof fetch;
}
