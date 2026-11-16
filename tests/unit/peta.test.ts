import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bacaJson, cuaca, kota, rumahSakit } from "./bantu";
import { JENIS_INARISK } from "@/lib/lapisan";
import { pudarTepi } from "@/lib/peta/efek";
import { fiturBencana, fiturLaporan, type Pilihan } from "@/lib/peta/fitur";
import { GLIF, KUNCI_BENCANA } from "@/lib/peta/ikon";
import { kaburkan, pikselMedan } from "@/lib/peta/medan";
import paletInarisk from "@/lib/peta/palet_inarisk.json";
import { gradienInarisk, KOTAK_INARISK, LAYER_ARUS, LAYER_INTERAKTIF, LAYER_LAPISAN, LAYER_PUDAR, SUDUT_INARISK, urlInarisk, warnaInarisk } from "@/lib/peta/pasang";
import { hujanTerbasah, labelMedan, ringkasPilihan } from "@/lib/peta/ringkas";
import { SKALA, WARNA_JENIS_BENCANA } from "@/lib/peta/warna";

const GRID = { lon0: 90, lat0: -15, dx: 1.5, dy: 1.5, nx: 39, ny: 18 };

describe("tepi medan", () => {
  it("penuh di tengah, nol di tepi, dan turun mulus di antaranya", () => {
    expect(pudarTepi(GRID, 118.5, -2.25)).toBe(1);
    expect(pudarTepi(GRID, 90, -2.25)).toBe(0);
    expect(pudarTepi(GRID, 147, 10.5)).toBe(0);
    let lalu = 1;
    for (let lon = 118.5; lon <= 147; lon += 0.5) {
      const p = pudarTepi(GRID, lon, -2.25);
      expect(p).toBeLessThanOrEqual(lalu + 1e-9);
      lalu = p;
    }
  });

  it("sudutnya membulat: pojok kotak sudah nol padahal sisi di jarak yang sama belum", () => {
    // 85% jalan ke tepi: di sumbu masih terlihat, di diagonal sudah hilang
    const hx = 28.5 * 0.85;
    const hy = 12.75 * 0.85;
    expect(pudarTepi(GRID, 118.5 + hx, -2.25)).toBeGreaterThan(0.3);
    expect(pudarTepi(GRID, 118.5 + hx, -2.25 + hy)).toBe(0);
  });

  it("medan bisa memudar lebih awal daripada partikel", () => {
    expect(pudarTepi(GRID, 138, -2.25, 0.45)).toBeLessThan(pudarTepi(GRID, 138, -2.25));
  });
});

describe("gambar medan", () => {
  it("kabur menyebarkan satu piksel tanpa mengubah jumlahnya", () => {
    const lebar = 21;
    const tinggi = 21;
    const d = new Float32Array(lebar * tinggi * 4);
    d[(10 * lebar + 10) * 4 + 3] = 1;
    kaburkan(d, lebar, tinggi, 3);
    let jumlah = 0;
    for (let i = 3; i < d.length; i += 4) jumlah += d[i];
    expect(jumlah).toBeCloseTo(1, 4);
    expect(d[(10 * lebar + 10) * 4 + 3]).toBeLessThan(0.1);
    expect(d[(10 * lebar + 13) * 4 + 3]).toBeGreaterThan(0);
    // simetris kiri-kanan dan atas-bawah
    expect(d[(10 * lebar + 7) * 4 + 3]).toBeCloseTo(d[(10 * lebar + 13) * 4 + 3], 6);
    expect(d[(7 * lebar + 10) * 4 + 3]).toBeCloseTo(d[(13 * lebar + 10) * 4 + 3], 6);
  });

  it("medan cuaca: tepi gambar transparan, tidak ada batas kotak", () => {
    const c = cuaca();
    const m = c.medan;
    const { piksel, lebar, tinggi } = pikselMedan({ grid: m.grid, nilai: m.suhu[0], skala: SKALA.suhu, pengali: 0.1, perSel: 6, kabur: 4, pudar: true });
    const alfa = (x: number, y: number) => piksel[(y * lebar + x) * 4 + 3];
    for (let x = 0; x < lebar; x += 7) {
      expect(alfa(x, 0)).toBe(0);
      expect(alfa(x, tinggi - 1)).toBe(0);
    }
    for (let y = 0; y < tinggi; y += 5) {
      expect(alfa(0, y)).toBe(0);
      expect(alfa(lebar - 1, y)).toBe(0);
    }
    // suhu ada di mana-mana, jadi tengahnya berwarna
    expect(alfa(lebar >> 1, tinggi >> 1)).toBeGreaterThan(20);
  });

  it("medan darat: laut (nilai kosong) tetap transparan", () => {
    const c = cuaca();
    const h = c.harian;
    const { piksel, lebar, tinggi } = pikselMedan({ grid: h.grid, nilai: h.fwi[0], skala: SKALA.fwi, pengali: 0.1, kosong: -1, perSel: 6 });
    let kosong = 0;
    let isi = 0;
    for (let i = 3; i < lebar * tinggi * 4; i += 4) {
      if (piksel[i] === 0) kosong++;
      else isi++;
    }
    expect(isi).toBeGreaterThan(lebar * tinggi * 0.05);
    expect(kosong).toBeGreaterThan(lebar * tinggi * 0.4);
  });
});

describe("label dan tooltip", () => {
  it("angka prakiraan hanya di kota utama dan sesuai lapisannya", () => {
    const c = cuaca();
    const k = kota();
    expect(labelMedan(null, c, 0, 0, k)).toEqual([]);
    expect(labelMedan("suhu", null, 0, 0, k)).toEqual([]);
    expect(labelMedan("inarisk", c, 0, 0, k)).toEqual([]);
    const suhu = labelMedan("suhu", c, 0, 0, k);
    expect(suhu.length).toBeGreaterThan(60);
    expect(suhu.length).toBeLessThanOrEqual(k.filter((x) => x.utama === 1).length);
    for (const f of suhu) expect(String(f.properties!.teks)).toMatch(/^-?\d+°$/);
    for (const f of labelMedan("udara", c, 0, 0, k)) expect(String(f.properties!.teks)).toMatch(/^PM \d+$/);
    for (const f of labelMedan("hujan", c, 4, 0, k)) expect(String(f.properties!.teks)).toMatch(/^\d+(\.\d)? mm$/);
    for (const f of labelMedan("fwi", c, 0, 1, k)) expect(String(f.properties!.teks)).toMatch(/^FWI \d+(\.\d)?$/);
    for (const f of labelMedan("banjir", c, 0, 0, k)) expect(Number(String(f.properties!.teks).split(" ")[0])).toBeGreaterThanOrEqual(10);
  });

  it("hujan terbasah = maksimum jendela tiga hari, laut tetap -1", () => {
    const c = cuaca();
    const h = c.harian;
    const basah = hujanTerbasah(c, 0);
    for (let s = 0; s < basah.length; s += 13) {
      const harap = Math.max(h.hujan[0][s], h.hujan[1][s], h.hujan[2][s], -1);
      expect(basah[s]).toBe(harap);
    }
    // jendela di ujung deret tidak melewati batas
    expect(hujanTerbasah(c, h.hujan.length - 1).length).toBe(basah.length);
  });

  it("ringkasan satu baris untuk tiap jenis objek", () => {
    const kini = Date.UTC(2026, 10, 16, 12);
    const gempa = { jenis: "gempa", data: { id: "g1", mag: 5.4, tempat: "Laut Banda", dalam: 12, waktu: kini - 3600_000, lon: 129, lat: -6 } } as unknown as Pilihan;
    expect(ringkasPilihan(gempa, "id", kini)).toBe("M5.4 · Laut Banda · 12 km · 1 jam lalu");
    const rs = { jenis: "rs", id: "rs-1", lon: 110, lat: -7, nama: "" } as Pilihan;
    expect(ringkasPilihan(rs, "id", kini)).toBe("Rumah sakit");
    expect(ringkasPilihan(rs, "en", kini)).toBe("Hospital");
    const mega = { jenis: "sesar", megathrust: true, idFitur: 3, nama: "", gerak: "Subduction", laju: null, lon: 100, lat: -3 } as unknown as Pilihan;
    expect(ringkasPilihan(mega, "id", kini)).toContain("megathrust");
    const sesar = { jenis: "sesar", megathrust: false, idFitur: 9, nama: "Sesar Lembang", gerak: "Sinistral", laju: 3, lon: 107.6, lat: -6.8 } as unknown as Pilihan;
    expect(ringkasPilihan(sesar, "en", kini)).toBe("Fault · Sesar Lembang · Sinistral");
  });
});

describe("ikon dan layer", () => {
  it("tiap jenis bencana punya glif dan warna", () => {
    expect(KUNCI_BENCANA.sort()).toEqual(Object.keys(WARNA_JENIS_BENCANA).sort());
    for (const k of KUNCI_BENCANA) expect(GLIF[k]?.length, k).toBeGreaterThan(0);
    expect(GLIF.palang.length).toBeGreaterThan(0);
    for (const jalur of Object.values(GLIF).flat()) expect(jalur).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/);
  });

  it("fitur kejadian membawa kunci ikon", () => {
    const b = fiturBencana([{ id: "b1", jenis: "Banjir", kabupaten: "Demak", provinsi: "Jawa Tengah", lon: 110.6, lat: -6.9 } as never, { id: "b2", jenis: "Sesuatu yang lain", kabupaten: "X", provinsi: "Y", lon: 100, lat: 0 } as never]);
    expect(b.map((f) => f.properties!.kunci)).toEqual(["banjir", "lain"]);
    expect(b[0].properties!.warna).toBe(WARNA_JENIS_BENCANA.banjir);
    const l = fiturLaporan([{ id: "l1", jenis: "flood", lon: 106.8, lat: -6.2 } as never]);
    expect(l[0].properties).toMatchObject({ id: "l1", kunci: "banjir" });
  });

  it("layer yang dipudarkan dan dianimasikan terdaftar di lapisannya", () => {
    const semua = new Set(Object.values(LAYER_LAPISAN).flat());
    for (const l of Object.keys(LAYER_PUDAR)) expect(semua.has(l), l).toBe(true);
    for (const l of LAYER_ARUS) expect(LAYER_LAPISAN.sesar).toContain(l);
    for (const l of Object.keys(LAYER_INTERAKTIF)) expect(semua.has(l) || l === "replay-titik", l).toBe(true);
    for (const o of Object.values(LAYER_PUDAR)) expect(o > 0.5 && o <= 1).toBe(true);
    // garis sesar disorot lewat layer sendiri, bukan lingkaran
    expect(LAYER_LAPISAN.sesar).toEqual(expect.arrayContaining(["sesar-kena", "sesar-sorot", "megathrust-gigi"]));
    expect(LAYER_LAPISAN.rs).toContain("rs-ikon");
  });
});

describe("peta bahaya InaRISK", () => {
  it("palet tiap jenis: indeks naik, mulai transparan, makin tinggi makin pekat", () => {
    const palet = paletInarisk as Record<string, number[][]>;
    expect(Object.keys(palet).sort()).toEqual([...JENIS_INARISK].sort());
    for (const j of JENIS_INARISK) {
      const h = palet[j];
      expect(h[0][4], j).toBe(0);
      expect(h[h.length - 1][0], j).toBe(1);
      for (let i = 1; i < h.length; i++) {
        expect(h[i][0]).toBeGreaterThan(h[i - 1][0]);
        expect(h[i][4]).toBeGreaterThanOrEqual(h[i - 1][4]);
      }
      expect(gradienInarisk(j)).toMatch(/^linear-gradient\(90deg, rgba\(/);
      expect(warnaInarisk(j)).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    }
  });

  it("gambar statisnya ada, ukurannya wajar, dan sudutnya menutup Indonesia", () => {
    for (const j of JENIS_INARISK) {
      expect(urlInarisk(j)).toBe(`/data/inarisk/${j}.webp`);
      const jalur = join(process.cwd(), "public", "data", "inarisk", `${j}.webp`);
      expect(existsSync(jalur), j).toBe(true);
      const ukuran = statSync(jalur).size;
      expect(ukuran, j).toBeGreaterThan(20_000);
      expect(ukuran, j).toBeLessThan(1_600_000);
    }
    expect(SUDUT_INARISK[0]).toEqual([KOTAK_INARISK.lonMin, KOTAK_INARISK.latMax]);
    expect(SUDUT_INARISK[2]).toEqual([KOTAK_INARISK.lonMax, KOTAK_INARISK.latMin]);
    expect(KOTAK_INARISK.lonMin).toBeLessThan(95.1);
    expect(KOTAK_INARISK.lonMax).toBeGreaterThan(141);
  });
});

describe("data statis: sesar dan rumah sakit", () => {
  interface FiturSesar {
    properties: { jenis: string; gerak: string };
    geometry: { coordinates: [number, number][] };
  }

  it("megathrust: garis panjang yang sudah dirangkai, tanpa kembaran dari GEM", () => {
    const s = bacaJson<{ features: FiturSesar[] }>("sesar.geojson");
    const mega = s.features.filter((f) => f.properties.jenis === "megathrust");
    expect(mega.length).toBeGreaterThanOrEqual(4);
    expect(mega.length).toBeLessThan(12);
    expect(Math.max(...mega.map((f) => f.geometry.coordinates.length))).toBeGreaterThan(150);
    expect(s.features.filter((f) => f.properties.jenis === "sesar" && /subduction/i.test(f.properties.gerak))).toHaveLength(0);
  });

  it("megathrust Sunda diarahkan supaya gigi menunjuk ke pulau (Nusantara di kiri arah garis)", () => {
    const s = bacaJson<{ features: FiturSesar[] }>("sesar.geojson");
    const sunda = s.features.find((f) => f.properties.jenis === "megathrust" && f.geometry.coordinates.some(([lon, lat]) => Math.abs(lon - 100) < 2 && lat < -2 && lat > -6));
    expect(sunda).toBeDefined();
    const k = sunda!.geometry.coordinates;
    const i = k.findIndex(([lon, lat]) => Math.abs(lon - 100) < 2 && lat < -2 && lat > -6);
    const [x0, y0] = k[Math.max(0, i - 1)];
    const [x1, y1] = k[Math.max(1, i)];
    // perkalian silang arah garis dengan vektor ke Padang (100.35, -0.95): positif = Padang di kiri
    expect((x1 - x0) * (-0.95 - y0) - (y1 - y0) * (100.35 - x0)).toBeGreaterThan(0);
  });

  it("rumah sakit tersebar di semua gugus pulau, bukan cuma barat", () => {
    const rs = rumahSakit();
    expect(rs.length).toBeGreaterThan(2500);
    const diKotak = (x0: number, x1: number, y0: number, y1: number) => rs.filter((r) => r[0] >= x0 && r[0] <= x1 && r[1] >= y0 && r[1] <= y1).length;
    expect(diKotak(95, 106, -6, 6), "Sumatra").toBeGreaterThan(300);
    expect(diKotak(110, 115, -8.8, -6), "Jawa Tengah-Timur").toBeGreaterThan(300);
    expect(diKotak(108, 119, -4.5, 4.5), "Kalimantan").toBeGreaterThan(80);
    expect(diKotak(118.5, 125.5, -6, 2), "Sulawesi").toBeGreaterThan(80);
    expect(diKotak(130, 141.5, -9.5, 0), "Papua").toBeGreaterThan(20);
  });
});
