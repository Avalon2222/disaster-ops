/** Ringkasan prakiraan harian per provinsi: FWI tertinggi dan risiko hujan, dari grid darat. */

import type { DefGrid, HarianDarat } from "../jenis";
import { cariPoligonDekat, type PoligonBerkotak } from "../geo";
import { tingkatHujan, type TingkatRisiko } from "./banjir";
import { kelasFwi } from "./fwi";
import { titikGrid } from "./grid";

/** Indeks provinsi untuk tiap sel grid (-1 = laut / luar negeri). */
export function provinsiPerSel(g: DefGrid, provinsi: PoligonBerkotak[], toleransi = 0.45): Int16Array {
  const hasil = new Int16Array(g.nx * g.ny).fill(-1);
  titikGrid(g).forEach((t, i) => {
    hasil[i] = cariPoligonDekat(t.lon, t.lat, provinsi, toleransi);
  });
  return hasil;
}

export interface PrakiraanProvinsi {
  provinsi: string;
  /** indeks provinsi di daftar batas wilayah */
  indeks: number;
  /** FWI tertinggi per hari (di antara sel provinsi itu) */
  fwi: number[];
  /** hujan harian tertinggi per hari (mm) */
  hujan: number[];
  fwiPuncak: number;
  hariFwiPuncak: number;
  kelasFwi: 0 | 1 | 2 | 3;
  /** risiko banjir dari 3 hari terbasah */
  tingkatHujan: TingkatRisiko;
  hujan3Hari: number;
  /** pusat sel dengan FWI puncak, untuk mengarahkan kamera */
  lon: number;
  lat: number;
}

export function prakiraanPerProvinsi(h: HarianDarat, provSel: Int16Array, namaProvinsi: string[]): PrakiraanProvinsi[] {
  const nHari = h.hari.length;
  const peta = new Map<number, PrakiraanProvinsi & { selPuncak: number }>();
  for (let s = 0; s < provSel.length; s++) {
    const p = provSel[s];
    if (p < 0 || h.fwi[0][s] < 0) continue;
    let r = peta.get(p);
    if (!r) {
      r = { provinsi: namaProvinsi[p] ?? "?", indeks: p, fwi: new Array<number>(nHari).fill(0), hujan: new Array<number>(nHari).fill(0), fwiPuncak: 0, hariFwiPuncak: 0, kelasFwi: 0, tingkatHujan: 0, hujan3Hari: 0, lon: 0, lat: 0, selPuncak: s };
      peta.set(p, r);
    }
    let total3 = 0;
    let maks24 = 0;
    for (let d = 0; d < nHari; d++) {
      const f = h.fwi[d][s] / 10;
      const hj = Math.max(0, h.hujan[d][s]) / 10;
      if (f > r.fwi[d]) r.fwi[d] = f;
      if (hj > r.hujan[d]) r.hujan[d] = hj;
      if (f > r.fwiPuncak) {
        r.fwiPuncak = f;
        r.hariFwiPuncak = d;
        r.selPuncak = s;
      }
      if (d < 3) {
        total3 += hj;
        if (hj > maks24) maks24 = hj;
      }
    }
    const t = tingkatHujan(maks24, total3);
    if (t > r.tingkatHujan) r.tingkatHujan = t;
    if (total3 > r.hujan3Hari) r.hujan3Hari = total3;
  }
  const g = h.grid;
  return [...peta.values()].map(({ selPuncak, ...r }) => ({
    ...r,
    kelasFwi: kelasFwi(r.fwiPuncak),
    lon: g.lon0 + (selPuncak % g.nx) * g.dx,
    lat: g.lat0 + Math.floor(selPuncak / g.nx) * g.dy,
  }));
}
