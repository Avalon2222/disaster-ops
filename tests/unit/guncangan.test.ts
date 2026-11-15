import { describe, expect, it } from "vitest";
import { penduduk, rumahSakit } from "./bantu";
import { eksposurGempa, formatOrang, pendudukDalamRadius, rsAmanTerdekat, rsDalamRadius } from "@/lib/model/eksposur";
import { cincinMmi, jarakPatahanKm, luasPatahanKm2, mmi, mmiDariJarak, radiusMmi, radiusPatahanKm, romawi } from "@/lib/model/guncangan";

describe("intensitas guncangan (Allen dkk. 2012)", () => {
  it("melemah dengan jarak, menguat dengan magnitudo", () => {
    const jarak = [0, 20, 50, 100, 200, 400];
    const m7 = jarak.map((r) => mmi(7, r, 10));
    for (let i = 1; i < m7.length; i++) expect(m7[i]).toBeLessThan(m7[i - 1]);
    for (const r of [10, 80, 250]) expect(mmi(7.5, r, 10)).toBeGreaterThan(mmi(6.5, r, 10));
  });

  it("gempa dalam terasa lebih lemah di episenter", () => {
    expect(mmi(6.5, 0, 100)).toBeLessThan(mmi(6.5, 0, 10) - 1);
  });

  it("angka acuan: M7 dangkal ~VII-VIII di pusat, ~V di 100 km", () => {
    expect(mmi(7, 0, 10)).toBeCloseTo(7.57, 1);
    expect(mmi(7, 100, 10)).toBeCloseTo(5.42, 1);
    expect(mmiDariJarak(6, 30)).toBeCloseTo(3.95 + 0.913 * 6 - 1.107 * Math.log(Math.hypot(30, 1 + 0.813 * Math.E)), 6);
  });

  it("selalu di antara I dan X", () => {
    expect(mmi(9.5, 0, 1)).toBeLessThanOrEqual(10);
    expect(mmi(4, 2000, 600)).toBe(1);
    expect(romawi(7.4)).toBe("VII");
    expect(romawi(0)).toBe("I");
    expect(romawi(14)).toBe("X");
  });

  it("ukuran patahan Wells & Coppersmith: M7 puluhan km, M9 ratusan km", () => {
    expect(luasPatahanKm2(7)).toBeCloseTo(759, -1);
    expect(radiusPatahanKm(7)).toBeGreaterThan(10);
    expect(radiusPatahanKm(7)).toBeLessThan(25);
    expect(radiusPatahanKm(9)).toBeGreaterThan(100);
    // di dalam bidang patahan jaraknya tinggal kedalaman
    expect(jarakPatahanKm(8, 10, 20)).toBe(20);
  });

  it("radiusMmi adalah kebalikan mmi()", () => {
    for (const [mag, dalam, batas] of [
      [7, 10, 6],
      [8.5, 25, 7],
      [6, 15, 5],
    ]) {
      const r = radiusMmi(mag, dalam, batas);
      expect(r).toBeGreaterThan(0);
      expect(mmi(mag, r, dalam)).toBeCloseTo(batas, 2);
    }
    expect(radiusMmi(5, 100, 8)).toBe(0);
  });

  it("cincin urut dari yang terkuat dan makin lebar", () => {
    const c = cincinMmi(7.5, 10);
    expect(c.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < c.length; i++) {
      expect(c[i].mmi).toBe(c[i - 1].mmi - 1);
      expect(c[i].radiusKm).toBeGreaterThan(c[i - 1].radiusKm);
    }
  });
});

describe("eksposur penduduk dan rumah sakit (data asli)", () => {
  const g = penduduk();
  const rs = rumahSakit();

  it("grid WorldPop menjumlah ke ~273 juta jiwa", () => {
    let total = 0;
    for (let i = 0; i < g.v.length; i++) total += (g.v[i] / g.skalaAkar) ** 2;
    expect(total / 1e6).toBeGreaterThan(268);
    expect(total / 1e6).toBeLessThan(279);
  });

  it("Jabodetabek padat, laut kosong", () => {
    expect(pendudukDalamRadius(g, 106.83, -6.2, 30)).toBeGreaterThan(15e6);
    expect(pendudukDalamRadius(g, 106.83, -6.2, 30)).toBeLessThan(35e6);
    expect(pendudukDalamRadius(g, 100, -8, 50)).toBe(0);
    expect(pendudukDalamRadius(g, 140.7, -2.53, 20)).toBeGreaterThan(100_000);
  });

  it("skenario Sesar Lembang M6,8: jutaan orang di MMI VI ke atas", () => {
    const e = eksposurGempa(g, 107.62, -6.83, 6.8, 10, radiusMmi(6.8, 10, 4.5));
    const enam = e.filter((x) => x.mmi >= 6).reduce((s, x) => s + x.penduduk, 0);
    expect(enam).toBeGreaterThan(8e6);
    expect(enam).toBeLessThan(60e6);
    // kelas urut dari terkuat
    for (let i = 1; i < e.length; i++) expect(e[i].mmi).toBeLessThan(e[i - 1].mmi);
    expect(e.every((x) => x.mmi >= 5)).toBe(true);
  });

  it("rumah sakit: dalam radius terdekat dulu, yang aman di luar zona", () => {
    const dekat = rsDalamRadius(rs, 106.83, -6.2, 15);
    expect(dekat.length).toBeGreaterThan(20);
    for (let i = 1; i < dekat.length; i++) expect(dekat[i].jarakKm).toBeGreaterThanOrEqual(dekat[i - 1].jarakKm);
    const aman = rsAmanTerdekat(rs, 107.62, -6.83, 45, { lon: 107.62, lat: -6.83 });
    expect(aman).toHaveLength(3);
    for (const r of aman) expect(r.jarakKm).toBeGreaterThanOrEqual(45);
  });

  it("format jumlah orang", () => {
    expect(formatOrang(24_300_000, "id")).toBe("24 juta");
    expect(formatOrang(1_240_000, "id")).toBe("1,2 juta");
    expect(formatOrang(1_240_000, "en")).toBe("1.2M");
    expect(formatOrang(340_400, "id")).toBe("340 ribu");
    expect(formatOrang(8400, "en")).toBe("8,400");
    expect(formatOrang(NaN)).toBe("-");
  });
});
