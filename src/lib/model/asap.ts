/**
 * Arah sebaran asap: gugus titik panas dihanyutkan angin lapisan 850 hPa (~1,5 km, tempat asap
 * karhutla biasanya terbawa) dari prakiraan. Hasilnya lintasan maju per jam, bukan konsentrasi asap.
 */

import type { DefGrid, TitikPanas } from "../jenis";
import { jarakKm } from "../geo";
import { sampel } from "./grid";

export interface GugusApi {
  lon: number;
  lat: number;
  jumlah: number;
  frp: number;
  prov: number;
}

/** Kelompokkan titik panas ke sel `ukuran` derajat; pusat gugus = rata-rata berbobot FRP. */
export function gugusApi(titik: TitikPanas[], ukuran = 0.5, sejakMenit = 0): GugusApi[] {
  const peta = new Map<string, { sx: number; sy: number; w: number; jumlah: number; frp: number; prov: Map<number, number> }>();
  for (const t of titik) {
    if (t[4] < sejakMenit) continue;
    const kunci = `${Math.floor(t[0] / ukuran)}:${Math.floor(t[1] / ukuran)}`;
    const g = peta.get(kunci) ?? { sx: 0, sy: 0, w: 0, jumlah: 0, frp: 0, prov: new Map<number, number>() };
    const w = Math.max(0.5, t[2]);
    g.sx += t[0] * w;
    g.sy += t[1] * w;
    g.w += w;
    g.jumlah++;
    g.frp += t[2];
    g.prov.set(t[5], (g.prov.get(t[5]) ?? 0) + 1);
    peta.set(kunci, g);
  }
  return [...peta.values()]
    .map((g) => ({
      lon: g.sx / g.w,
      lat: g.sy / g.w,
      jumlah: g.jumlah,
      frp: Math.round(g.frp),
      prov: [...g.prov.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.frp - a.frp);
}

export interface MedanAngin {
  grid: DefGrid;
  mulai: number;
  langkahJam: number;
  /** [langkah][sel], m/s x10 */
  u: number[][];
  v: number[][];
}

/** Angin (m/s) di titik dan waktu tertentu: bilinear di ruang, linier di waktu. */
export function anginDi(m: MedanAngin, lon: number, lat: number, waktuMs: number): [number, number] {
  const posisi = (waktuMs - m.mulai) / (m.langkahJam * 3600_000);
  const t0 = Math.min(m.u.length - 1, Math.max(0, Math.floor(posisi)));
  const t1 = Math.min(m.u.length - 1, t0 + 1);
  const f = Math.min(1, Math.max(0, posisi - t0));
  const u = sampel(m.grid, m.u[t0], lon, lat) * (1 - f) + sampel(m.grid, m.u[t1], lon, lat) * f;
  const v = sampel(m.grid, m.v[t0], lon, lat) * (1 - f) + sampel(m.grid, m.v[t1], lon, lat) * f;
  return [u / 10, v / 10];
}

/** Lintasan maju per jam: [lon, lat][] sepanjang `jam` jam, berhenti kalau keluar grid. */
export function lintasanAsap(m: MedanAngin, lon: number, lat: number, mulaiMs: number, jam = 48): [number, number][] {
  const jalur: [number, number][] = [[lon, lat]];
  let x = lon;
  let y = lat;
  for (let h = 0; h < jam; h++) {
    const [u, v] = anginDi(m, x, y, mulaiMs + h * 3600_000);
    if (!Number.isFinite(u) || !Number.isFinite(v)) break;
    x += (u * 3.6) / (111.195 * Math.max(0.2, Math.cos((y * Math.PI) / 180)));
    y += (v * 3.6) / 111.195;
    jalur.push([Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
  }
  return jalur;
}

export interface KotaTerpapar {
  nama: string;
  /** jam sejak sekarang saat lintasan paling dekat */
  jam: number;
  jarakKm: number;
  dari: number;
}

/** Kota yang dilewati lintasan asap dalam radius `radiusKm`. `dari` = indeks gugus sumbernya. */
export function kotaTerpapar(lintasan: [number, number][][], kota: { nama: string; lon: number; lat: number }[], radiusKm = 60): KotaTerpapar[] {
  const hasil = new Map<string, KotaTerpapar>();
  lintasan.forEach((jalur, dari) => {
    for (const k of kota) {
      for (let h = 1; h < jalur.length; h++) {
        if (Math.abs(jalur[h][1] - k.lat) > 1 || Math.abs(jalur[h][0] - k.lon) > 1) continue;
        const d = jarakKm(k.lon, k.lat, jalur[h][0], jalur[h][1]);
        if (d > radiusKm) continue;
        const lama = hasil.get(k.nama);
        if (!lama || h < lama.jam) hasil.set(k.nama, { nama: k.nama, jam: h, jarakKm: Math.round(d), dari });
        break;
      }
    }
  });
  return [...hasil.values()].sort((a, b) => a.jam - b.jam);
}
