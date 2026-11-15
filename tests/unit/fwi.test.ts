import { describe, expect, it } from "vitest";
import { bui, dc, deretFwi, dmc, faktorDc, faktorDmc, ffmc, fwi, isi, kelasFwi, KODE_AWAL, langkahFwi } from "@/lib/model/fwi";

/** Data uji baku Van Wagner & Pickett (1985), sama dengan yang dipakai paket cffdrs: April, lintang 46 LU. */
const HARI = [
  { suhu: 17, rh: 42, angin: 25, hujan: 0 },
  { suhu: 20, rh: 21, angin: 25, hujan: 2.4 },
  { suhu: 8.5, rh: 40, angin: 17, hujan: 0 },
  { suhu: 6.5, rh: 25, angin: 6, hujan: 0 },
  { suhu: 13, rh: 34, angin: 24, hujan: 0 },
];
const ACUAN = [
  { ffmc: 87.7, dmc: 8.5, dc: 19.0, isi: 10.9, bui: 8.5, fwi: 10.1 },
  { ffmc: 86.2, dmc: 10.4, dc: 23.6, isi: 8.8, bui: 10.4, fwi: 9.3 },
  { ffmc: 87.0, dmc: 11.8, dc: 26.1, isi: 6.5, bui: 11.8, fwi: 7.6 },
  { ffmc: 88.8, dmc: 13.2, dc: 28.2, isi: 4.9, bui: 13.2, fwi: 6.2 },
  { ffmc: 89.1, dmc: 15.4, dc: 31.5, isi: 12.6, bui: 15.4, fwi: 14.8 },
];

describe("FWI Kanada", () => {
  it("cocok dengan data uji baku Van Wagner hari demi hari", () => {
    const hasil = deretFwi(HARI, [4, 4, 4, 4, 4], 46);
    hasil.forEach((h, i) => {
      for (const k of ["ffmc", "dmc", "dc", "isi", "bui", "fwi"] as const) expect(h[k], `hari ${i + 1} ${k}`).toBeCloseTo(ACUAN[i][k], 0);
    });
    // hari pertama sampai 4 angka di belakang koma
    expect(hasil[0].ffmc).toBeCloseTo(87.69298, 4);
    expect(hasil[0].dmc).toBeCloseTo(8.545051, 4);
    expect(hasil[0].dc).toBeCloseTo(19.014, 3);
    expect(hasil[0].isi).toBeCloseTo(10.853661, 4);
    expect(hasil[0].fwi).toBeCloseTo(10.096371, 4);
  });

  it("hujan menurunkan semua kode kelembapan", () => {
    const kering = langkahFwi({ ffmc: 90, dmc: 40, dc: 300 }, { suhu: 32, rh: 45, angin: 10, hujan: 0 }, 9, -2);
    const basah = langkahFwi({ ffmc: 90, dmc: 40, dc: 300 }, { suhu: 32, rh: 45, angin: 10, hujan: 30 }, 9, -2);
    expect(basah.ffmc).toBeLessThan(kering.ffmc);
    expect(basah.dmc).toBeLessThan(kering.dmc);
    expect(basah.dc).toBeLessThan(kering.dc);
    expect(basah.fwi).toBeLessThan(kering.fwi);
  });

  it("kemarau panjang tanpa hujan menaikkan indeks terus-menerus", () => {
    const hari = Array.from({ length: 30 }, () => ({ suhu: 33, rh: 40, angin: 12, hujan: 0 }));
    const d = deretFwi(hari, hari.map(() => 9), -1);
    expect(d[29].dc).toBeGreaterThan(d[10].dc);
    expect(d[29].bui).toBeGreaterThan(d[10].bui);
    expect(d[29].fwi).toBeGreaterThan(d[0].fwi);
    expect(kelasFwi(d[29].fwi)).toBe(3);
  });

  it("angin kencang mempercepat penyebaran", () => {
    expect(isi(90, 30)).toBeGreaterThan(isi(90, 5) * 2);
  });

  it("hari tanpa data memakai kode kemarin", () => {
    const d = deretFwi([HARI[0], { suhu: NaN, rh: NaN, angin: NaN, hujan: NaN }, HARI[2]], [4, 4, 4], 46);
    expect(d[1].ffmc).toBe(d[0].ffmc);
    expect(d[1].dc).toBe(d[0].dc);
    expect(Number.isFinite(d[2].fwi)).toBe(true);
  });

  it("nilai tetap dalam rentang yang sah di cuaca ekstrem", () => {
    for (const c of [
      { suhu: 40, rh: 5, angin: 60, hujan: 0 },
      { suhu: 18, rh: 100, angin: 0, hujan: 200 },
      { suhu: -5, rh: 80, angin: 3, hujan: 0 },
    ]) {
      const h = langkahFwi(KODE_AWAL, c, 7, -3);
      expect(h.ffmc).toBeGreaterThanOrEqual(0);
      expect(h.ffmc).toBeLessThanOrEqual(101);
      expect(h.dmc).toBeGreaterThanOrEqual(0);
      expect(h.dc).toBeGreaterThanOrEqual(0);
      expect(h.fwi).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(h.fwi)).toBe(true);
    }
    expect(bui(0, 0)).toBe(0);
    expect(fwi(0, 0)).toBe(0);
    expect(ffmc(85, { suhu: 30, rh: 150, angin: -4, hujan: 0 })).toBeGreaterThan(0);
    expect(dmc(6, { suhu: -20, rh: 50, angin: 0, hujan: 0 }, 1, 0)).toBeCloseTo(6, 5);
    expect(dc(15, { suhu: -20, rh: 50, angin: 0, hujan: 0 }, 1, 0)).toBeGreaterThanOrEqual(15);
  });

  it("faktor panjang hari: khatulistiwa tetap, lintang tinggi musiman", () => {
    expect(faktorDmc(1, 0)).toBe(9);
    expect(faktorDmc(7, -8)).toBe(9);
    expect(faktorDmc(6, 46)).toBe(13.9);
    expect(faktorDmc(12, -35)).toBe(11.8);
    expect(faktorDc(3, -5)).toBe(1.4);
    expect(faktorDc(1, 46)).toBe(-1.6);
    expect(faktorDc(1, -30)).toBe(6.4);
  });

  it("kelas bahaya FDRS: batas 1, 6, 13", () => {
    expect([0, 0.9, 1, 5.9, 6, 12.9, 13, 40].map(kelasFwi)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(kelasFwi(NaN)).toBe(0);
  });
});
