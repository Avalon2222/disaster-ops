/**
 * Canadian Forest Fire Weather Index (FWI) System, Van Wagner & Pickett (1985).
 *
 * Dasar dari Fire Danger Rating System yang dipakai BMKG untuk Indonesia. Masukannya cuaca siang hari:
 * suhu (C), kelembapan relatif (%), angin 10 m (km/jam), dan hujan 24 jam (mm). Tiga kode kelembapan
 * bahan bakar (FFMC, DMC, DC) membawa "ingatan" dari hari ke hari, jadi indeksnya harus dihitung
 * berurutan dari deret harian, bukan dari satu hari saja.
 */

export interface CuacaHarian {
  suhu: number;
  rh: number;
  /** km/jam */
  angin: number;
  /** mm / 24 jam */
  hujan: number;
}

export interface KodeFwi {
  ffmc: number;
  dmc: number;
  dc: number;
}

export interface HasilFwi extends KodeFwi {
  isi: number;
  bui: number;
  fwi: number;
}

/** Nilai awal baku saat tidak ada riwayat (Van Wagner 1987). */
export const KODE_AWAL: KodeFwi = { ffmc: 85, dmc: 6, dc: 15 };

// faktor panjang hari DMC per bulan, menurut lintang (cffdrs)
const LE_UTARA = [6.5, 7.5, 9.0, 12.8, 13.9, 13.9, 12.4, 10.9, 9.4, 8.0, 7.0, 6.0];
const LE_SUBTROPIS_UTARA = [7.9, 8.4, 8.9, 9.5, 9.9, 10.2, 10.1, 9.7, 9.1, 8.6, 8.1, 7.8];
const LE_SUBTROPIS_SELATAN = [10.1, 9.6, 9.1, 8.5, 8.1, 7.8, 7.9, 8.3, 8.9, 9.4, 9.9, 10.2];
const LE_SELATAN = [11.5, 10.5, 9.2, 7.9, 6.8, 6.2, 6.5, 7.4, 8.7, 10.0, 11.2, 11.8];
// faktor panjang hari DC
const LF_UTARA = [-1.6, -1.6, -1.6, 0.9, 3.8, 5.8, 6.4, 5.0, 2.4, 0.4, -1.6, -1.6];
const LF_SELATAN = [6.4, 5.0, 2.4, 0.4, -1.6, -1.6, -1.6, -1.6, -1.6, 0.9, 3.8, 5.8];

/** Faktor panjang hari DMC; di khatulistiwa (10 LS - 10 LU) tetap 9 sepanjang tahun. */
export function faktorDmc(bulan: number, lintang: number): number {
  const m = bulan - 1;
  if (lintang > 30) return LE_UTARA[m];
  if (lintang > 10) return LE_SUBTROPIS_UTARA[m];
  if (lintang >= -10) return 9;
  if (lintang >= -30) return LE_SUBTROPIS_SELATAN[m];
  return LE_SELATAN[m];
}

/** Faktor panjang hari DC; di tropis (20 LS - 20 LU) tetap 1,4. */
export function faktorDc(bulan: number, lintang: number): number {
  const m = bulan - 1;
  if (lintang > 20) return LF_UTARA[m];
  if (lintang >= -20) return 1.4;
  return LF_SELATAN[m];
}

/** Fine Fuel Moisture Code: serasah halus di permukaan, bereaksi dalam hitungan jam. */
export function ffmc(kemarin: number, c: CuacaHarian): number {
  const H = Math.min(100, Math.max(0, c.rh));
  const T = c.suhu;
  const W = Math.max(0, c.angin);
  let mo = (147.2 * (101 - kemarin)) / (59.5 + kemarin);
  if (c.hujan > 0.5) {
    const rf = c.hujan - 0.5;
    let mr = mo + 42.5 * rf * Math.exp(-100 / (251 - mo)) * (1 - Math.exp(-6.93 / rf));
    if (mo > 150) mr += 0.0015 * (mo - 150) ** 2 * Math.sqrt(rf);
    mo = Math.min(250, mr);
  }
  const ed = 0.942 * H ** 0.679 + 11 * Math.exp((H - 100) / 10) + 0.18 * (21.1 - T) * (1 - Math.exp(-0.115 * H));
  let m = mo;
  if (mo > ed) {
    const ko = 0.424 * (1 - (H / 100) ** 1.7) + 0.0694 * Math.sqrt(W) * (1 - (H / 100) ** 8);
    const kd = ko * 0.581 * Math.exp(0.0365 * T);
    m = ed + (mo - ed) * 10 ** -kd;
  } else {
    const ew = 0.618 * H ** 0.753 + 10 * Math.exp((H - 100) / 10) + 0.18 * (21.1 - T) * (1 - Math.exp(-0.115 * H));
    if (mo < ew) {
      const k1 = 0.424 * (1 - ((100 - H) / 100) ** 1.7) + 0.0694 * Math.sqrt(W) * (1 - ((100 - H) / 100) ** 8);
      const kw = k1 * 0.581 * Math.exp(0.0365 * T);
      m = ew - (ew - mo) * 10 ** -kw;
    }
  }
  return Math.min(101, Math.max(0, (59.5 * (250 - m)) / (147.2 + m)));
}

/** Duff Moisture Code: lapisan organik dangkal, bereaksi dalam hitungan hari-minggu. */
export function dmc(kemarin: number, c: CuacaHarian, bulan: number, lintang: number): number {
  const H = Math.min(100, Math.max(0, c.rh));
  const T = Math.max(-1.1, c.suhu);
  let p = kemarin;
  if (c.hujan > 1.5) {
    const re = 0.92 * c.hujan - 1.27;
    const mo = 20 + Math.exp(5.6348 - kemarin / 43.43);
    const b = kemarin <= 33 ? 100 / (0.5 + 0.3 * kemarin) : kemarin <= 65 ? 14 - 1.3 * Math.log(kemarin) : 6.2 * Math.log(kemarin) - 17.2;
    const mr = mo + (1000 * re) / (48.77 + b * re);
    p = Math.max(0, 244.72 - 43.43 * Math.log(mr - 20));
  }
  const k = 1.894 * (T + 1.1) * (100 - H) * faktorDmc(bulan, lintang) * 1e-6;
  return Math.max(0, p + 100 * k);
}

/** Drought Code: lapisan organik dalam (gambut!), bereaksi dalam hitungan bulan. */
export function dc(kemarin: number, c: CuacaHarian, bulan: number, lintang: number): number {
  const T = Math.max(-2.8, c.suhu);
  let d = kemarin;
  if (c.hujan > 2.8) {
    const rd = 0.83 * c.hujan - 1.27;
    const qo = 800 * Math.exp(-kemarin / 400);
    d = Math.max(0, 400 * Math.log(800 / (qo + 3.937 * rd)));
  }
  const v = Math.max(0, 0.36 * (T + 2.8) + faktorDc(bulan, lintang));
  return d + 0.5 * v;
}

/** Initial Spread Index: laju penyebaran awal dari angin dan FFMC. */
export function isi(ffmcKini: number, angin: number): number {
  const m = (147.2 * (101 - ffmcKini)) / (59.5 + ffmcKini);
  const fF = 91.9 * Math.exp(-0.1386 * m) * (1 + m ** 5.31 / 4.93e7);
  return 0.208 * Math.exp(0.05039 * Math.max(0, angin)) * fF;
}

/** Buildup Index: bahan bakar yang tersedia, dari DMC dan DC. */
export function bui(dmcKini: number, dcKini: number): number {
  if (dmcKini <= 0 && dcKini <= 0) return 0;
  const u = dmcKini <= 0.4 * dcKini ? (0.8 * dmcKini * dcKini) / (dmcKini + 0.4 * dcKini) : dmcKini - (1 - (0.8 * dcKini) / (dmcKini + 0.4 * dcKini)) * (0.92 + (0.0114 * dmcKini) ** 1.7);
  return Math.max(0, u);
}

/** Fire Weather Index: intensitas api potensial. */
export function fwi(isiKini: number, buiKini: number): number {
  const fD = buiKini <= 80 ? 0.626 * buiKini ** 0.809 + 2 : 1000 / (25 + 108.64 * Math.exp(-0.023 * buiKini));
  const b = 0.1 * isiKini * fD;
  return b > 1 ? Math.exp(2.72 * (0.434 * Math.log(b)) ** 0.647) : b;
}

/** Satu langkah harian: kode kemarin + cuaca hari ini -> semua komponen hari ini. */
export function langkahFwi(kemarin: KodeFwi, c: CuacaHarian, bulan: number, lintang: number): HasilFwi {
  const f = ffmc(kemarin.ffmc, c);
  const p = dmc(kemarin.dmc, c, bulan, lintang);
  const d = dc(kemarin.dc, c, bulan, lintang);
  const r = isi(f, c.angin);
  const u = bui(p, d);
  return { ffmc: f, dmc: p, dc: d, isi: r, bui: u, fwi: fwi(r, u) };
}

/**
 * Jalankan FWI sepanjang deret harian. `bulan[i]` adalah bulan (1-12) hari ke-i.
 * Hari tanpa data (NaN) memakai kode kemarin apa adanya.
 */
export function deretFwi(cuaca: CuacaHarian[], bulan: number[], lintang: number, awal: KodeFwi = KODE_AWAL): HasilFwi[] {
  const hasil: HasilFwi[] = [];
  let kode: KodeFwi = awal;
  for (let i = 0; i < cuaca.length; i++) {
    const c = cuaca[i];
    if (![c.suhu, c.rh, c.angin, c.hujan].every(Number.isFinite)) {
      const r = isi(kode.ffmc, 0);
      const u = bui(kode.dmc, kode.dc);
      hasil.push({ ...kode, isi: r, bui: u, fwi: fwi(r, u) });
      continue;
    }
    const h = langkahFwi(kode, c, bulan[i], lintang);
    hasil.push(h);
    kode = h;
  }
  return hasil;
}

/** Kelas bahaya FDRS yang dipakai di Indonesia/Malaysia: 0 rendah, 1 sedang, 2 tinggi, 3 ekstrem. */
export const BATAS_FWI = [1, 6, 13] as const;

export function kelasFwi(nilai: number): 0 | 1 | 2 | 3 {
  if (!(nilai >= BATAS_FWI[0])) return 0;
  if (nilai < BATAS_FWI[1]) return 1;
  if (nilai < BATAS_FWI[2]) return 2;
  return 3;
}
