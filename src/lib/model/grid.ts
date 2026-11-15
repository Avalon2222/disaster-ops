/** Grid lon/lat teratur: indeks sel, titik pusat, dan interpolasi bilinear. */

import type { DefGrid } from "../jenis";

export function jumlahSel(g: DefGrid): number {
  return g.nx * g.ny;
}

/** Pusat tiap sel, urut baris dari selatan (j = 0) lalu kolom dari barat. */
export function titikGrid(g: DefGrid): { lon: number; lat: number }[] {
  const titik: { lon: number; lat: number }[] = [];
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) titik.push({ lon: g.lon0 + i * g.dx, lat: g.lat0 + j * g.dy });
  return titik;
}

/** Indeks sel terdekat, atau -1 kalau titiknya di luar grid. */
export function selTerdekat(g: DefGrid, lon: number, lat: number): number {
  const i = Math.round((lon - g.lon0) / g.dx);
  const j = Math.round((lat - g.lat0) / g.dy);
  if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) return -1;
  return j * g.nx + i;
}

/**
 * Nilai di (lon, lat) dengan interpolasi bilinear. Sel bernilai `kosong` dilewati (bobotnya dibagi ke
 * tetangga yang ada isinya); NaN kalau di luar grid atau semua tetangganya kosong.
 */
export function sampel(g: DefGrid, data: ArrayLike<number>, lon: number, lat: number, kosong = NaN): number {
  const x = (lon - g.lon0) / g.dx;
  const y = (lat - g.lat0) / g.dy;
  if (x < -0.5 || y < -0.5 || x > g.nx - 0.5 || y > g.ny - 0.5) return NaN;
  const xi = Math.min(g.nx - 1, Math.max(0, x));
  const yi = Math.min(g.ny - 1, Math.max(0, y));
  const i0 = Math.min(g.nx - 2, Math.floor(xi));
  const j0 = Math.min(g.ny - 2, Math.floor(yi));
  const fx = xi - i0;
  const fy = yi - j0;
  let jumlah = 0;
  let bobot = 0;
  for (let dj = 0; dj < 2; dj++)
    for (let di = 0; di < 2; di++) {
      const v = data[(j0 + dj) * g.nx + i0 + di];
      if (v === kosong || Number.isNaN(v)) continue;
      const w = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy);
      jumlah += v * w;
      bobot += w;
    }
  return bobot > 1e-6 ? jumlah / bobot : NaN;
}

/** Campuran linier dua langkah waktu: a*(1-f) + b*f, per sel. */
export function campur(a: ArrayLike<number>, b: ArrayLike<number>, f: number, keluar?: Float32Array): Float32Array {
  const n = a.length;
  const hasil = keluar ?? new Float32Array(n);
  for (let i = 0; i < n; i++) hasil[i] = a[i] * (1 - f) + b[i] * f;
  return hasil;
}
