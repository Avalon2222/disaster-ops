/** Teks pendek untuk tooltip (kursor di atas objek) dan angka prakiraan di kota-kota utama. */

import type { SnapshotCuaca } from "../jenis";
import type { IdLapisan } from "../lapisan";
import { NAMA_TINGKAT, WARNA_TINGKAT } from "../model/banjir";
import { kelasFwi } from "../model/fwi";
import { sampel } from "../model/grid";
import { NAMA_LEVEL } from "../sumber/magma";
import { umur } from "../waktu";
import type { Pilihan } from "./fitur";
import { titik } from "./pasang";

const ROMAWI = ["", "I", "II", "III", "IV"];

/** Satu baris ringkas tentang objek di bawah kursor. */
export function ringkasPilihan(p: Pilihan, lang: "id" | "en", sekarang: number): string {
  switch (p.jenis) {
    case "hotspot":
      return `${lang === "id" ? "Titik panas" : "Hotspot"} · ${p.provinsi || "-"} · ${p.data[2].toFixed(0)} MW · ${umur(p.data[4] * 60_000, sekarang, lang)}`;
    case "gempa":
      return `M${p.data.mag.toFixed(1)} · ${p.data.tempat} · ${p.data.dalam} km · ${umur(p.data.waktu, sekarang, lang)}`;
    case "gunung":
      return p.data.level > 0 ? `${p.data.nama} · Level ${ROMAWI[p.data.level]} ${NAMA_LEVEL[p.data.level]}` : p.data.nama;
    case "bencana":
      return `BNPB · ${p.data.jenis} · ${p.data.kabupaten}`;
    case "laporan":
      return `${lang === "id" ? "Laporan warga" : "Citizen report"} · ${p.data.kota || p.data.jenis}${p.data.kedalaman != null ? ` · ${p.data.kedalaman} cm` : ""}`;
    case "peringatan":
      return `BMKG · ${p.data.judul || p.data.wilayah}`;
    case "sungai":
      return `${p.data.nama} · ${NAMA_TINGKAT[p.status.tingkat][lang]} · ${Math.round(p.status.puncak).toLocaleString(lang === "id" ? "id-ID" : "en-US")} m³/s`;
    case "historis":
      return `M${p.data[3].toFixed(1)} · ${p.data[4]} · ${p.data[5] || "-"}`;
    case "rs":
      return p.nama || (lang === "id" ? "Rumah sakit" : "Hospital");
    case "sesar":
      if (p.megathrust) return lang === "id" ? "Zona subduksi (megathrust)" : "Subduction zone (megathrust)";
      return `${lang === "id" ? "Sesar" : "Fault"}${p.nama ? ` · ${p.nama}` : ""}${p.gerak ? ` · ${p.gerak}` : ""}`;
    default:
      return "";
  }
}

/** Hujan harian terbesar dalam jendela 3 hari mulai `hari`, per sel (mm x10; -1 = laut). */
export function hujanTerbasah(cuaca: SnapshotCuaca, hari: number): Float32Array {
  const h = cuaca.harian;
  const n = h.grid.nx * h.grid.ny;
  const maks = new Float32Array(n).fill(-1);
  for (let d = hari; d < Math.min(h.hujan.length, hari + 3); d++) for (let s = 0; s < n; s++) if (h.hujan[d][s] > maks[s]) maks[s] = h.hujan[d][s];
  return maks;
}

interface KotaLabel {
  nama: string;
  lon: number;
  lat: number;
  utama: number;
}

const WARNA_UDARA = (pm: number) => (pm <= 15 ? "#bbf7d0" : pm <= 35 ? "#fde68a" : pm <= 55 ? "#fdba74" : "#fca5a5");
const WARNA_SUHU = (t: number) => (t < 24 ? "#bae6fd" : t < 30 ? "#fef3c7" : t < 33 ? "#fdba74" : "#fca5a5");
const WARNA_HUJAN_HARIAN = (mm: number) => (mm >= 150 ? "#fca5a5" : mm >= 100 ? "#fdba74" : mm >= 50 ? "#fde68a" : "#bae6fd");

/**
 * Angka prakiraan di kota-kota utama untuk lapisan medan yang aktif: "31°", "12 mm", "PM 45", "FWI 8".
 * `urut` kecil = lebih penting (MapLibre menyembunyikan label yang bertabrakan mulai dari yang kurang penting).
 */
export function labelMedan(medan: IdLapisan | null, cuaca: SnapshotCuaca | null, jam: number, hari: number, kota: KotaLabel[]): GeoJSON.Feature[] {
  if (!cuaca || !medan) return [];
  const m = cuaca.medan;
  const i = Math.min(m.u10.length - 1, Math.max(0, jam));
  const basah = medan === "banjir" ? hujanTerbasah(cuaca, hari) : null;
  const fitur: GeoJSON.Feature[] = [];
  for (const k of kota) {
    if (k.utama !== 1) continue;
    let teks = "";
    let warna = "#f8fafc";
    let urut = 0;
    if (medan === "hujan") {
      const mm = sampel(m.grid, m.hujan[i], k.lon, k.lat) / 10;
      if (!(mm >= 0.5)) continue;
      teks = `${mm < 10 ? mm.toFixed(1) : Math.round(mm)} mm`;
      warna = mm >= 10 ? "#fde68a" : "#bae6fd";
      urut = -mm;
    } else if (medan === "suhu") {
      const t = sampel(m.grid, m.suhu[i], k.lon, k.lat) / 10;
      if (Number.isNaN(t)) continue;
      teks = `${Math.round(t)}°`;
      warna = WARNA_SUHU(t);
    } else if (medan === "udara") {
      const pm = sampel(m.grid, m.pm25[i], k.lon, k.lat);
      if (Number.isNaN(pm)) continue;
      teks = `PM ${Math.round(pm)}`;
      warna = WARNA_UDARA(pm);
      urut = -pm;
    } else if (medan === "fwi") {
      const h = cuaca.harian;
      const f = sampel(h.grid, h.fwi[Math.min(h.fwi.length - 1, hari)], k.lon, k.lat, -1) / 10;
      if (Number.isNaN(f)) continue;
      teks = `FWI ${f < 10 ? f.toFixed(1) : Math.round(f)}`;
      warna = WARNA_TINGKAT[kelasFwi(f)];
      urut = -f;
    } else if (medan === "banjir" && basah) {
      const mm = sampel(cuaca.harian.grid, basah, k.lon, k.lat, -1) / 10;
      if (!(mm >= 10)) continue;
      teks = `${Math.round(mm)} mm`;
      warna = WARNA_HUJAN_HARIAN(mm);
      urut = -mm;
    } else continue;
    fitur.push(titik(k.lon, k.lat, { teks, warna, urut }));
  }
  return fitur;
}
