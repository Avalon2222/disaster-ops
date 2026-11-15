import { describe, expect, it } from "vitest";
import { cuaca, provinsi } from "./bantu";
import type { DefGrid, TitikPanas } from "@/lib/jenis";
import { anginDi, gugusApi, kotaTerpapar, lintasanAsap, type MedanAngin } from "@/lib/model/asap";
import { risikoHujan, statusSungai, tingkatHujan } from "@/lib/model/banjir";
import { campur, sampel, selTerdekat, titikGrid } from "@/lib/model/grid";
import { prakiraanPerProvinsi, provinsiPerSel } from "@/lib/model/prakiraan";
import { awalLangkah, GRID_DARAT, GRID_MEDAN, JUMLAH_LANGKAH, komponenAngin, susunHarian, susunMedan, susunSungai, titikMedan, urlHarian, urlPerJam, urlSungai, urlUdara, type JawabanHarian, type JawabanPerJam } from "@/lib/sumber/openmeteo";

const G: DefGrid = { lon0: 100, lat0: -2, dx: 1, dy: 1, nx: 3, ny: 2 };

describe("grid", () => {
  it("titik pusat sel: baris dari selatan, kolom dari barat", () => {
    const t = titikGrid(G);
    expect(t).toHaveLength(6);
    expect(t[0]).toEqual({ lon: 100, lat: -2 });
    expect(t[2]).toEqual({ lon: 102, lat: -2 });
    expect(t[3]).toEqual({ lon: 100, lat: -1 });
  });

  it("interpolasi bilinear", () => {
    const data = [0, 10, 20, 100, 110, 120];
    expect(sampel(G, data, 100, -2)).toBe(0);
    expect(sampel(G, data, 100.5, -2)).toBe(5);
    expect(sampel(G, data, 101, -1.5)).toBe(60);
    expect(sampel(G, data, 102, -1)).toBe(120);
    expect(sampel(G, data, 99.7, -2)).toBe(0); // setengah sel di luar pusat masih dijepit
    expect(sampel(G, data, 98, -2)).toBeNaN();
    expect(sampel(G, data, 101, 0.6)).toBeNaN();
  });

  it("sel kosong dilewati, bobotnya pindah ke tetangga", () => {
    const data = [-1, 10, 20, -1, 10, 20];
    expect(sampel(G, data, 100.5, -1.5, -1)).toBe(10);
    expect(sampel(G, [-1, -1, 5, -1, -1, 5], 100.4, -1.5, -1)).toBeNaN();
  });

  it("sel terdekat dan campuran dua langkah", () => {
    expect(selTerdekat(G, 101.4, -1.4)).toBe(4);
    expect(selTerdekat(G, 105, 0)).toBe(-1);
    expect(Array.from(campur([0, 10], [10, 30], 0.25))).toEqual([2.5, 15]);
  });
});

describe("Open-Meteo", () => {
  it("arah angin meteorologi ke komponen u/v", () => {
    const [u1, v1] = komponenAngin(10, 270); // angin barat bertiup KE timur
    expect(u1).toBeCloseTo(10);
    expect(v1).toBeCloseTo(0);
    const [u2, v2] = komponenAngin(5, 0); // angin utara bertiup KE selatan
    expect(u2).toBeCloseTo(0);
    expect(v2).toBeCloseTo(-5);
  });

  it("URL memuat semua titik dan variabel", () => {
    const t = [{ lon: 101.4, lat: 0.5 }, { lon: 113.9, lat: -2.2 }];
    expect(urlPerJam(t)).toContain("latitude=0.50,-2.20&longitude=101.40,113.90");
    expect(urlPerJam(t)).toContain("wind_speed_850hPa");
    expect(urlUdara(t)).toContain("pm2_5");
    expect(urlHarian(t)).toContain("relative_humidity_2m_min");
    expect(urlHarian(t)).toContain("timezone=Asia%2FJakarta");
    expect(urlSungai(t)).toContain("river_discharge");
    expect(titikMedan()).toHaveLength(GRID_MEDAN.nx * GRID_MEDAN.ny);
  });

  it("susunMedan: hujan dijumlah per 3 jam, angin jadi u/v x10", () => {
    const sekarang = Date.parse("2026-11-15T04:20:00Z");
    expect(awalLangkah(sekarang)).toBe(Date.parse("2026-11-15T03:00:00Z"));
    const waktu = Array.from({ length: 96 }, (_, i) => new Date(Date.parse("2026-11-15T00:00:00Z") + i * 3600_000).toISOString().slice(0, 16));
    const satu = (): JawabanPerJam => ({
      hourly: {
        time: waktu,
        wind_speed_10m: waktu.map(() => 10),
        wind_direction_10m: waktu.map(() => 270),
        wind_speed_850hPa: waktu.map(() => 5),
        wind_direction_850hPa: waktu.map(() => 180),
        temperature_2m: waktu.map((_, i) => 25 + i * 0.1),
        precipitation: waktu.map((_, i) => (i === 3 ? 1.5 : i === 4 ? 2 : i === 6 ? 4 : 0)),
      },
    });
    const udara: JawabanPerJam = { hourly: { time: waktu, pm2_5: waktu.map((_, i) => i) } };
    const m = susunMedan([satu(), satu()], [udara, udara], sekarang);
    expect(m.mulai).toBe(Date.parse("2026-11-15T03:00:00Z"));
    expect(m.u10).toHaveLength(JUMLAH_LANGKAH);
    expect(m.u10[0]).toEqual([100, 100]);
    expect(Math.abs(m.v10[0][0])).toBe(0);
    expect(m.v850[0][0]).toBe(50); // angin selatan bertiup ke utara
    expect(m.suhu[0][0]).toBe(253);
    expect(m.hujan[0][0]).toBe(35); // jam 03 + 04 + 05
    expect(m.hujan[1][0]).toBe(40); // jam 06
    expect(m.pm25[0][1]).toBe(3);
    expect(m.pm25[1][1]).toBe(6);
    expect(() => susunMedan([satu()], [udara], Date.parse("2027-01-01T00:00:00Z"))).toThrow();
  });

  it("susunHarian: FWI dihitung dari riwayat, sel laut tetap -1", () => {
    const tanggal = Array.from({ length: 12 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
    const kering: JawabanHarian = { latitude: -2, daily: { time: tanggal, temperature_2m_max: tanggal.map(() => 34), relative_humidity_2m_min: tanggal.map(() => 35), wind_speed_10m_mean: tanggal.map(() => 15), precipitation_sum: tanggal.map(() => 0) } };
    const basah: JawabanHarian = { latitude: -2, daily: { time: tanggal, temperature_2m_max: tanggal.map(() => 28), relative_humidity_2m_min: tanggal.map(() => 85), wind_speed_10m_mean: tanggal.map(() => 5), precipitation_sum: tanggal.map(() => 25) } };
    const h = susunHarian([kering, basah], [10, 11], "2026-09-10");
    expect(h.hari).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
    expect(h.fwi[0]).toHaveLength(GRID_DARAT.nx * GRID_DARAT.ny);
    expect(h.fwi[0][10]).toBeGreaterThan(130); // FWI > 13: ekstrem setelah 10 hari kering
    expect(h.fwi[0][11]).toBeLessThan(10);
    expect(h.fwi[0][0]).toBe(-1);
    expect(h.hujan[0][11]).toBe(250);
    expect(h.hujan[2][10]).toBe(0);
    expect(() => susunHarian([kering], [10], "2027-01-01")).toThrow();
  });

  it("susunSungai menempelkan debit ke titiknya", () => {
    const s = susunSungai([{ daily: { time: ["a", "b"], river_discharge: [120.44, null] } }], [{ nama: "Musi", lokasi: "Palembang", lon: 104.8, lat: -2.8, p50: 100, p90: 200, p99: 300 }]);
    expect(s[0]).toMatchObject({ nama: "Musi", debit: [120.4, 0], p90: 200 });
  });
});

describe("risiko banjir", () => {
  it("ambang hujan BMKG", () => {
    expect(tingkatHujan(10, 20)).toBe(0);
    expect(tingkatHujan(50, 60)).toBe(1);
    expect(tingkatHujan(30, 100)).toBe(1);
    expect(tingkatHujan(100, 120)).toBe(2);
    expect(tingkatHujan(40, 200)).toBe(2);
    expect(tingkatHujan(150, 150)).toBe(3);
    expect(tingkatHujan(0, 300)).toBe(3);
  });

  it("jendela 24 jam terbasah dan total 72 jam dari deret per 3 jam", () => {
    // sel 0: 5 mm tiap langkah selama 30 langkah; sel 1: satu hujan 120 mm di langkah 9
    const hujan = Array.from({ length: 30 }, (_, t) => [50, t === 9 ? 1200 : 0]);
    const r = risikoHujan(hujan, 3);
    expect(r.maks24[0]).toBe(40);
    expect(r.total72[0]).toBe(120);
    expect(r.tingkat[0]).toBe(1);
    expect(r.maks24[1]).toBe(120);
    expect(r.tingkat[1]).toBe(2);
    // mulai setelah hujan lewat
    expect(risikoHujan(hujan, 3, 12).tingkat[1]).toBe(0);
    // deret harian
    const harian = risikoHujan([[400, 0], [700, 0], [300, 1600], [0, 0]], 24);
    expect(harian.maks24[0]).toBe(70);
    expect(harian.total72[0]).toBe(140);
    expect(harian.tingkat[1]).toBe(3);
  });

  it("status sungai dari persentil klimatologi", () => {
    const s = { p90: 100, p99: 200 };
    expect(statusSungai({ ...s, debit: [50, 60, 70] })).toMatchObject({ tingkat: 0, puncak: 70, hariPuncak: 2 });
    expect(statusSungai({ ...s, debit: [50, 120, 70] }).tingkat).toBe(1);
    expect(statusSungai({ ...s, debit: [250, 120, 70] }).tingkat).toBe(2);
    expect(statusSungai({ ...s, debit: [50, 120, 320] })).toMatchObject({ tingkat: 3, rasio: 3.2 });
    // puncak di luar jendela 7 hari tidak dihitung
    expect(statusSungai({ ...s, debit: [1, 1, 1, 1, 1, 1, 1, 500] }).tingkat).toBe(0);
    expect(statusSungai({ p90: 0, p99: 0, debit: [5] }).tingkat).toBe(0);
  });
});

describe("arah asap", () => {
  const timur: MedanAngin = { grid: { lon0: 95, lat0: -10, dx: 5, dy: 5, nx: 10, ny: 5 }, mulai: 0, langkahJam: 3, u: Array.from({ length: 20 }, () => new Array<number>(50).fill(100)), v: Array.from({ length: 20 }, () => new Array<number>(50).fill(0)) };

  it("gugus titik panas: digabung per sel, terkuat dulu", () => {
    const t: TitikPanas[] = [
      [101.1, 0.1, 10, 1, 500, 3, 0],
      [101.2, 0.2, 30, 2, 500, 3, 0],
      [101.3, 0.3, 20, 1, 500, 4, 1],
      [113.9, -2.2, 100, 2, 500, 7, 0],
      [120.0, -3.0, 500, 2, 100, 9, 0],
    ];
    const g = gugusApi(t, 0.5, 200);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ jumlah: 1, frp: 100, prov: 7 });
    expect(g[1]).toMatchObject({ jumlah: 3, frp: 60, prov: 3 });
    // pusat berbobot FRP condong ke titik terkuat
    expect(g[1].lon).toBeGreaterThan(101.2);
    expect(g[1].lon).toBeLessThan(101.25);
  });

  it("angin timur 10 m/s menggeser asap ~3,2 derajat per 10 jam di khatulistiwa", () => {
    expect(anginDi(timur, 110, 0, 5 * 3600_000)).toEqual([10, 0]);
    const jalur = lintasanAsap(timur, 100, 0, 0, 10);
    expect(jalur).toHaveLength(11);
    expect(jalur[10][0]).toBeCloseTo(100 + (10 * 36) / 111.195, 2);
    expect(jalur[10][1]).toBeCloseTo(0, 5);
  });

  it("lintasan berhenti di tepi grid", () => {
    const jalur = lintasanAsap(timur, 139.5, 0, 0, 48);
    expect(jalur.length).toBeLessThan(40);
    // pusat sel terakhir di 140 BT; setengah sel di luarnya masih dihitung, satu langkah berikutnya berhenti
    expect(jalur[jalur.length - 1][0]).toBeLessThan(143);
  });

  it("kota di lintasan tercatat dengan jam paling awal", () => {
    const jalur = lintasanAsap(timur, 100, 0, 0, 48);
    const k = kotaTerpapar([jalur], [
      { nama: "Dekat", lon: 103.2, lat: 0.2 },
      { nama: "Jauh", lon: 103.2, lat: 3 },
      { nama: "Hulu", lon: 97, lat: 0 },
    ]);
    expect(k.map((x) => x.nama)).toEqual(["Dekat"]);
    expect(k[0].jam).toBeGreaterThanOrEqual(8);
    expect(k[0].jam).toBeLessThanOrEqual(10);
    expect(k[0].dari).toBe(0);
  });
});

describe("ringkasan per provinsi (snapshot asli)", () => {
  const c = cuaca();
  const prov = provinsi();

  it("snapshot punya bentuk yang benar", () => {
    const nMedan = c.medan.grid.nx * c.medan.grid.ny;
    for (const k of ["u10", "v10", "u850", "v850", "suhu", "hujan", "pm25"] as const) {
      expect(c.medan[k], k).toHaveLength(JUMLAH_LANGKAH);
      expect(c.medan[k][0], k).toHaveLength(nMedan);
    }
    const nDarat = c.harian.grid.nx * c.harian.grid.ny;
    expect(c.harian.hari.length).toBeGreaterThanOrEqual(7);
    expect(c.harian.fwi).toHaveLength(c.harian.hari.length);
    expect(c.harian.fwi[0]).toHaveLength(nDarat);
    expect(c.harian.fwi[0].filter((v) => v >= 0).length).toBeGreaterThan(250);
    expect(c.sungai.length).toBeGreaterThanOrEqual(20);
    expect(c.sungai.every((s) => s.debit.length >= 7 && s.p99 > s.p90 && s.p90 > s.p50)).toBe(true);
    // suhu tropis yang masuk akal
    const suhu = c.medan.suhu[0].map((v) => v / 10);
    expect(Math.min(...suhu)).toBeGreaterThan(5);
    expect(Math.max(...suhu)).toBeLessThan(42);
  });

  it("semua provinsi besar punya sel dan angka FWI/hujan yang sah", () => {
    const sel = provinsiPerSel(c.harian.grid, prov);
    const p = prakiraanPerProvinsi(c.harian, sel, prov.map((x) => x.nama));
    expect(p.length).toBeGreaterThanOrEqual(30);
    const nama = p.map((x) => x.provinsi);
    for (const wajib of ["Riau", "Kalimantan Tengah", "Papua", "Jawa Timur", "Sulawesi Selatan"]) expect(nama).toContain(wajib);
    for (const x of p) {
      expect(x.fwi).toHaveLength(c.harian.hari.length);
      expect(x.fwiPuncak).toBe(Math.max(...x.fwi));
      expect(x.fwi[x.hariFwiPuncak]).toBe(x.fwiPuncak);
      expect(x.kelasFwi).toBeGreaterThanOrEqual(0);
      expect(x.tingkatHujan).toBeLessThanOrEqual(3);
      expect(x.hujan3Hari).toBeGreaterThanOrEqual(0);
      expect(prov[x.indeks].nama).toBe(x.provinsi);
    }
  });
});
