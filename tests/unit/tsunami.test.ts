import { describe, expect, it } from "vitest";
import { batimetri, kota } from "./bantu";
import { jarakKm } from "@/lib/geo";
import { radiusPatahanKm } from "@/lib/model/guncangan";
import { hitungTsunami, radiusSumberKm } from "@/lib/model/skenarioTsunami";
import { berpotensiTsunami, dekatLaut, kecepatanKmMenit, selBatimetri, tinggiAbe, waktuTempuh, waktuTiba, type Batimetri } from "@/lib/model/tsunami";
import { dataranTinggiTerdekat, uraiRute, urlRute } from "@/lib/rute";
import { PRASET_GEMPA, PRASET_TSUNAMI } from "@/lib/skenario";

/** Laut datar sedalam `dalam` meter di sekitar khatulistiwa, dengan dinding daratan opsional. */
function lautDatar(dalam: number, dinding?: (i: number, j: number) => boolean): Batimetri {
  const nx = 201;
  const ny = 201;
  const z = new Int16Array(nx * ny).fill(-dalam);
  if (dinding) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (dinding(i, j)) z[j * nx + i] = 50;
  return { lon0: 100, lat0: -5, dx: 0.05, nx, ny, z };
}

describe("waktu tempuh tsunami", () => {
  it("kecepatan gelombang panjang: 4.000 m ~ 713 km/jam", () => {
    expect(kecepatanKmMenit(4000) * 60).toBeCloseTo(713, 0);
    // perairan sangat dangkal dibatasi ke 10 m
    expect(kecepatanKmMenit(1)).toBe(kecepatanKmMenit(10));
  });

  it("di laut datar, waktu = jarak / kecepatan ke segala arah (galat < 6 %)", () => {
    const b = lautDatar(4000);
    const sumber = { lon: 105, lat: 0, radiusKm: 1 };
    const h = waktuTempuh(b, sumber, 600);
    expect(h.selSumber).toBeGreaterThan(0);
    for (const [lon, lat] of [
      [108, 0],
      [105, 3],
      [107.5, 2.5],
      [102, -1.2],
      [106.3, 3.9],
    ]) {
      const harap = jarakKm(105, 0, lon, lat) / kecepatanKmMenit(4000);
      const dapat = h.menit[selBatimetri(b, lon, lat)];
      expect(Math.abs(dapat - harap) / harap, `(${lon}, ${lat})`).toBeLessThan(0.06);
    }
  });

  it("laut dangkal lebih lambat", () => {
    const dalam = waktuTempuh(lautDatar(4000), { lon: 105, lat: 0, radiusKm: 1 }, 2000);
    const dangkal = waktuTempuh(lautDatar(50), { lon: 105, lat: 0, radiusKm: 1 }, 2000);
    const s = selBatimetri(lautDatar(50), 107, 0);
    expect(dangkal.menit[s]).toBeGreaterThan(dalam.menit[s] * 5);
  });

  it("gelombang memutari daratan dan tidak pernah menembusnya", () => {
    // dinding utara-selatan dengan celah di selatan
    const b = lautDatar(2000, (i, j) => i === 120 && j > 40);
    const h = waktuTempuh(b, { lon: 105, lat: 0, radiusKm: 1 }, 2000);
    const dibalik = selBatimetri(b, 107, 2);
    const lurus = jarakKm(105, 0, 107, 2) / kecepatanKmMenit(2000);
    expect(h.menit[dibalik]).toBeGreaterThan(lurus * 1.5);
    expect(Number.isFinite(h.menit[dibalik])).toBe(true);
    for (let j = 41; j < 201; j++) expect(h.menit[j * 201 + 120]).toBe(Infinity);
  });

  it("batas waktu dihormati dan sumber di darat tidak membangkitkan apa-apa", () => {
    const b = lautDatar(1000);
    const h = waktuTempuh(b, { lon: 105, lat: 0, radiusKm: 1 }, 30);
    expect(h.maksMenit).toBeLessThanOrEqual(30);
    expect(h.menit[selBatimetri(b, 109.9, 4.9)]).toBe(Infinity);
    const darat = waktuTempuh(lautDatar(1000, () => true), { lon: 105, lat: 0, radiusKm: 30 });
    expect(darat.selSumber).toBe(0);
    expect(darat.maksMenit).toBe(0);
  });
});

describe("tsunami di batimetri asli (ETOPO 2022)", () => {
  const b = batimetri();
  const daftarKota = kota();

  it("grid memuat laut dalam dan daratan tinggi", () => {
    expect(b.z.length).toBe(b.nx * b.ny);
    let min = 0;
    let maks = 0;
    for (const v of b.z) {
      if (v < min) min = v;
      if (v > maks) maks = v;
    }
    expect(min).toBeLessThan(-7000);
    expect(maks).toBeGreaterThan(3000);
    expect(b.z[selBatimetri(b, 110, -10.5)]).toBeLessThan(-3000); // Palung Jawa
    expect(b.z[selBatimetri(b, 113.9, -2.2)]).toBeGreaterThan(0); // Palangka Raya
  });

  it("megathrust Mentawai: Padang kena dalam belasan sampai puluhan menit", () => {
    const p = PRASET_TSUNAMI.find((x) => x.id === "siberut")!;
    const h = hitungTsunami(b, daftarKota, p);
    const padang = h.kota.find((k) => k.nama === "Padang")!;
    expect(padang.menit).toBeGreaterThan(3);
    expect(padang.menit).toBeLessThan(45);
    expect(padang.tinggi).toBeGreaterThan(3);
    // kota di pantai utara Jawa jauh lebih lambat atau tidak terjangkau
    const jakarta = h.kota.find((k) => k.nama === "Jakarta");
    if (jakarta) expect(jakarta.menit).toBeGreaterThan(padang.menit + 60);
    // daftar urut dari yang tercepat
    for (let i = 1; i < h.kota.length; i++) expect(h.kota[i].menit).toBeGreaterThanOrEqual(h.kota[i - 1].menit);
  });

  it("Aceh 2004: Banda Aceh dalam ~10-50 menit, sesuai catatan sejarah", () => {
    const p = PRASET_TSUNAMI.find((x) => x.id === "aceh2004")!;
    const h = waktuTempuh(b, { lon: p.lon, lat: p.lat, radiusKm: radiusPatahanKm(p.mag) }, 360);
    const t = waktuTiba(b, h.menit, 95.32, 5.55);
    expect(t).toBeGreaterThan(5);
    expect(t).toBeLessThan(50);
  });

  it("semua praset tsunami bersumber di laut dan sah", () => {
    for (const p of PRASET_TSUNAMI) {
      const h = waktuTempuh(b, { lon: p.lon, lat: p.lat, radiusKm: radiusSumberKm(p.mag) }, 60);
      expect(h.selSumber, p.id).toBeGreaterThan(0);
      expect(p.mag, p.id).toBeGreaterThanOrEqual(7.5);
      expect(p.nama.id && p.nama.en && p.catatan.id && p.catatan.en, p.id).toBeTruthy();
    }
    expect(new Set(PRASET_TSUNAMI.map((p) => p.id)).size).toBe(PRASET_TSUNAMI.length);
  });

  it("praset guncangan ada di daratan Indonesia", () => {
    for (const p of PRASET_GEMPA) expect(b.z[selBatimetri(b, p.lon, p.lat)], p.id).toBeGreaterThan(0);
  });

  it("kota pedalaman bukan kota pesisir", () => {
    expect(dekatLaut(b, 100.35, -0.95)).toBe(true); // Padang
    expect(dekatLaut(b, 113.92, -2.21)).toBe(false); // Palangka Raya
    expect(dekatLaut(b, 110.37, -7.8)).toBe(false); // Yogyakarta, 27 km dari pantai
    expect(dekatLaut(b, 106.83, -6.18)).toBe(true); // Jakarta
    expect(dekatLaut(b, 119.87, -0.9)).toBe(true); // Palu
  });

  it("dataran tinggi terdekat dari Padang ada dalam 40 km", () => {
    const t = dataranTinggiTerdekat(b, 100.35, -0.95)!;
    expect(t.tinggi).toBeGreaterThanOrEqual(25);
    expect(t.jarakKm).toBeLessThan(40);
    expect(dataranTinggiTerdekat(b, 100, -9, 25, 30)).toBeNull();
  });
});

describe("rumus bantu", () => {
  it("tinggi Abe: turun dengan jarak, dibatasi tinggi dekat-sumber", () => {
    expect(tinggiAbe(8.5, 100)).toBeGreaterThan(tinggiAbe(8.5, 1000));
    expect(tinggiAbe(9.1, 10)).toBeCloseTo(10 ** (0.5 * 9.1 - 3.3), 5);
    expect(tinggiAbe(7.5, 100)).toBeCloseTo(0.89, 1);
  });

  it("potensi tsunami: besar, dangkal, dan menyentuh laut", () => {
    expect(berpotensiTsunami(7.8, 20, 100)).toBe(true);
    expect(berpotensiTsunami(6.0, 20, 100)).toBe(false);
    expect(berpotensiTsunami(7.8, 150, 100)).toBe(false);
    expect(berpotensiTsunami(7.8, 20, 0)).toBe(false);
  });

  it("rute OSRM: URL dan pengurai", () => {
    expect(urlRute([100.35, -0.95], [100.5, -0.9])).toBe("https://router.project-osrm.org/route/v1/driving/100.35000,-0.95000;100.50000,-0.90000?overview=simplified&geometries=geojson");
    const r = uraiRute({ routes: [{ distance: 12_400, duration: 1500, geometry: { coordinates: [[100.35, -0.95], [100.5, -0.9]] } }] })!;
    expect(r.jarakKm).toBeCloseTo(12.4);
    expect(r.menit).toBe(25);
    expect(r.jalan).toBe(true);
    expect(uraiRute({ code: "NoRoute" })).toBeNull();
    expect(uraiRute(null)).toBeNull();
  });
});
