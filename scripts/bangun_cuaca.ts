/**
 * Membangun snapshot prakiraan (cuaca.json) dari Open-Meteo: medan angin/suhu/hujan/PM2.5 per 3 jam,
 * FWI dan hujan harian di sel darat, dan debit sungai GloFAS.
 *
 *   npm run cuaca                       # tulis ke public/data/cuaca.json (cadangan lokal)
 *   npx tsx scripts/bangun_cuaca.ts --keluar keluar/cuaca.json
 *
 * Dijalankan GitHub Actions tiap 6 jam lalu disimpan ke cabang `data`. Permintaan dipecah dan diberi
 * jeda supaya tetap di bawah batas laju Open-Meteo (600 panggilan per menit, tiap titik dihitung satu).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cariPoligonDekat, siapkanPoligon } from "../src/lib/geo";
import type { SnapshotCuaca } from "../src/lib/jenis";
import { titikGrid } from "../src/lib/model/grid";
import {
  GRID_DARAT,
  susunHarian,
  susunMedan,
  susunSungai,
  titikMedan,
  urlHarian,
  urlPerJam,
  urlSungai,
  urlUdara,
  type JawabanHarian,
  type JawabanPerJam,
  type JawabanSungai,
  type Titik,
  type TitikSungai,
} from "../src/lib/sumber/openmeteo";
import { tanggalWib } from "../src/lib/waktu";

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ambil<T>(url: string): Promise<T[]> {
  for (let percobaan = 0; percobaan < 6; percobaan++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "disaster-ops/1.0 (+https://github.com/Avalon2222/disaster-ops)" }, signal: AbortSignal.timeout(120_000) });
      if (res.status === 429) throw new Error("429 batas laju");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as T | T[];
      return Array.isArray(data) ? data : [data];
    } catch (e) {
      console.warn(`  ulang ${percobaan + 1}: ${e instanceof Error ? e.message : e}`);
      // batas laju Open-Meteo dihitung per menit: tunggu sedikit lebih lama tiap kali
      await tidur(65_000 + percobaan * 20_000);
    }
  }
  throw new Error(`Gagal mengambil ${new URL(url).host}`);
}

/** Ambil per potongan `ukuran` titik dengan jeda, lalu gabungkan sesuai urutan titik. */
async function ambilBertahap<T>(titik: Titik[], buatUrl: (t: Titik[]) => string, ukuran: number, jedaMs: number, label: string): Promise<T[]> {
  const hasil: T[] = [];
  for (let i = 0; i < titik.length; i += ukuran) {
    if (i > 0) await tidur(jedaMs);
    const potongan = titik.slice(i, i + ukuran);
    const jawaban = await ambil<T>(buatUrl(potongan));
    if (jawaban.length !== potongan.length) throw new Error(`${label}: minta ${potongan.length} titik, dapat ${jawaban.length}`);
    hasil.push(...jawaban);
    console.log(`  ${label}: ${hasil.length}/${titik.length}`);
  }
  return hasil;
}

function bacaSungai(): TitikSungai[] {
  const [kepala, ...baris] = readFileSync("data/sungai.csv", "utf8").trim().split(/\r?\n/);
  const kol = kepala.split(",");
  return baris.map((b) => {
    const s = b.split(",");
    const r = Object.fromEntries(kol.map((k, i) => [k, s[i]]));
    return { nama: r.nama, lokasi: r.lokasi, lat: Number(r.lat), lon: Number(r.lon), p50: Number(r.p50), p90: Number(r.p90), p99: Number(r.p99) };
  });
}

/** Sel GRID_DARAT yang pusatnya di darat atau dekat pantai (dalam 0,45 derajat). */
function selDarat(): number[] {
  const geo = JSON.parse(readFileSync("public/data/provinsi.geojson", "utf8")) as { features: { properties: { provinsi: string }; geometry: { type: string; coordinates: unknown } }[] };
  const provinsi = geo.features.map((f) => siapkanPoligon(f.properties.provinsi, f.geometry));
  const sel: number[] = [];
  titikGrid(GRID_DARAT).forEach((t, i) => {
    if (cariPoligonDekat(t.lon, t.lat, provinsi, 0.45) >= 0) sel.push(i);
  });
  return sel;
}

async function main() {
  const argumen = process.argv.slice(2);
  const iKeluar = argumen.indexOf("--keluar");
  const keluar = iKeluar >= 0 ? argumen[iKeluar + 1] : "public/data/cuaca.json";
  const sekarang = Date.now();

  const medan = titikMedan();
  console.log(`[medan] ${medan.length} titik`);
  const perJam = await ambilBertahap<JawabanPerJam>(medan, urlPerJam, 120, 17_000, "cuaca per jam");
  await tidur(17_000);
  // kualitas udara tidak wajib: kalau API-nya menolak, snapshot tetap terbit dengan PM2.5 kosong
  const udara = await ambilBertahap<JawabanPerJam>(medan, urlUdara, 120, 17_000, "PM2.5").catch((e) => {
    console.warn(`  PM2.5 dilewati: ${e instanceof Error ? e.message : e}`);
    return [] as JawabanPerJam[];
  });

  const sel = selDarat();
  const semuaDarat = titikGrid(GRID_DARAT);
  console.log(`[harian] ${sel.length} sel darat`);
  await tidur(20_000);
  // deret 38 hari dihitung ~2,7 panggilan per titik, jadi potongannya lebih kecil dan jedanya lebih panjang
  const harian = await ambilBertahap<JawabanHarian>(sel.map((i) => semuaDarat[i]), urlHarian, 100, 32_000, "harian");

  const titikSungai = bacaSungai();
  console.log(`[sungai] ${titikSungai.length} titik`);
  await tidur(10_000);
  // debit sungai juga tidak wajib
  const sungai = await ambil<JawabanSungai>(urlSungai(titikSungai)).catch((e) => {
    console.warn(`  sungai dilewati: ${e instanceof Error ? e.message : e}`);
    return [] as JawabanSungai[];
  });

  const snapshot: SnapshotCuaca = {
    dibuat: sekarang,
    medan: susunMedan(perJam, udara, sekarang),
    harian: susunHarian(harian, sel, tanggalWib(sekarang)),
    sungai: sungai.length === titikSungai.length ? susunSungai(sungai, titikSungai) : [],
  };
  mkdirSync(dirname(keluar), { recursive: true });
  const isi = JSON.stringify(snapshot);
  writeFileSync(keluar, isi);
  console.log(`-> ${keluar} (${(isi.length / 1024).toFixed(0)} KB), ${snapshot.harian.hari.length} hari, ${snapshot.medan.u10.length} langkah`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
