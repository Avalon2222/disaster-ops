import { describe, expect, it } from "vitest";
import type { DataHotspot, Gempa, GunungApi, TitikPanas } from "@/lib/jenis";
import type { PrakiraanProvinsi } from "@/lib/model/prakiraan";
import { sitrepKeMarkdown, susunSitrep, tingkatGempa, tingkatGunung, tingkatKarhutla, type MasukanSitrep } from "@/lib/model/sitrep";

const KINI = Date.parse("2026-11-15T02:00:00Z");
const MENIT = KINI / 60_000;

function hotspot(jumlah: number): DataHotspot {
  const titik: TitikPanas[] = Array.from({ length: jumlah }, (_, i) => [113.9 + (i % 5) * 0.01, -2.2, 20, 2, MENIT - 60, i % 3 === 0 ? 1 : 0, 0]);
  return { diperbarui: KINI, sumber: "csv", jam: 24, satelit: ["N20"], provinsi: ["Kalimantan Tengah", "Riau"], titik };
}

const gempa = (mag: number, jamLalu: number, lain: Partial<Gempa> = {}): Gempa => ({ id: `g-${mag}-${jamLalu}`, sumber: "BMKG", waktu: KINI - jamLalu * 3600_000, lon: 120, lat: -8, dalam: 10, mag, tempat: "Flores", ...lain });
const gunung = (nama: string, level: number): GunungApi => ({ nama, lat: -7.5, lon: 110.4, elevasi: 2900, provinsi: "Jawa Tengah", level });
const prov = (lain: Partial<PrakiraanProvinsi>): PrakiraanProvinsi => ({ provinsi: "Riau", indeks: 1, fwi: [2, 3], hujan: [5, 5], fwiPuncak: 3, hariFwiPuncak: 1, kelasFwi: 1, tingkatHujan: 0, hujan3Hari: 15, lon: 101, lat: 0.5, ...lain });

const KOSONG: MasukanSitrep = { sekarang: KINI, hotspot: null, gempa: null, gunung: null, bencana: null, peringatan: null, cuaca: null, prakiraan: [], kotaAsap: [] };

describe("tingkat ancaman", () => {
  it("karhutla: 150 waspada, 750 siaga, 3.000 awas; FWI ekstrem menaikkan ke siaga", () => {
    expect([0, 149, 150, 749, 750, 2999, 3000].map((n) => tingkatKarhutla(n, false))).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect(tingkatKarhutla(200, true)).toBe(2);
    expect(tingkatKarhutla(20, true)).toBe(0);
  });

  it("gempa: M5 waspada, M6 siaga, M7 atau tsunami awas", () => {
    expect([4.9, 5, 6, 7].map((m) => tingkatGempa(m, false))).toEqual([0, 1, 2, 3]);
    expect(tingkatGempa(5.5, true)).toBe(3);
  });

  it("gunung api: level PVMBG dikurangi satu", () => {
    expect([0, 1, 2, 3, 4].map(tingkatGunung)).toEqual([0, 0, 1, 2, 3]);
  });
});

describe("SITREP", () => {
  it("tanpa data: empat bagian kosong, status aman", () => {
    const s = susunSitrep(KOSONG);
    expect(s.bagian.map((b) => b.kunci)).toEqual(["karhutla", "gempa", "gunung", "hidromet"]);
    expect(s.tingkat).toBe(0);
    expect(s.bagian.every((b) => b.butir.length === 0)).toBe(true);
    expect(s.ringkas.id).toMatch(/tenang/);
  });

  it("hari tenang: ada data tapi semuanya di bawah ambang", () => {
    const s = susunSitrep({ ...KOSONG, hotspot: hotspot(0), gempa: [gempa(3.2, 5)], gunung: [gunung("Slamet", 1)], peringatan: [], prakiraan: [prov({})] });
    expect(s.tingkat).toBe(0);
    expect(s.bagian[0].butir[0].id).toMatch(/Tidak ada titik panas/);
    expect(s.bagian[1].butir.at(-1)!.id).toMatch(/Tidak ada peringatan tsunami/);
    expect(s.bagian[3].butir.map((b) => b.id).join(" ")).toMatch(/Tidak ada peringatan dini cuaca/);
  });

  it("karhutla besar: jumlah, provinsi terbanyak, gugus dengan fokus kamera, kota terpapar asap", () => {
    const s = susunSitrep({ ...KOSONG, hotspot: hotspot(900), prakiraan: [prov({ provinsi: "Kalimantan Tengah", fwiPuncak: 18.2, kelasFwi: 3 })], kotaAsap: [{ nama: "Palangka Raya", jam: 6, jarakKm: 20, dari: 0 }] });
    const b = s.bagian[0];
    expect(b.tingkat).toBe(2);
    expect(b.butir[0].id).toContain("900 titik panas");
    expect(b.butir[0].id).toContain("Kalimantan Tengah (600) dan Riau (300)");
    expect(b.butir[1].fokus).toBeDefined();
    expect(b.butir.map((x) => x.id).join(" ")).toContain("Palangka Raya (+6 jam)");
    expect(b.butir.map((x) => x.en).join(" ")).toContain("FWI 18.2 (extreme)");
    expect(s.tingkat).toBe(2);
    expect(s.ringkas.id).toContain("SIAGA");
    expect(s.ringkas.en).toContain("wildfire");
  });

  it("gempa besar dengan peringatan tsunami: awas", () => {
    const s = susunSitrep({ ...KOSONG, gempa: [gempa(7.4, 1, { tsunami: true, dirasakan: "VI Maumere" }), gempa(5.1, 30), gempa(6.2, 100)] });
    const b = s.bagian[1];
    expect(b.tingkat).toBe(3);
    expect(b.butir[0].id).toContain("1 gempa tercatat dalam 24 jam, 1 di antaranya M5");
    expect(b.butir[1].id).toContain("M7.4");
    expect(b.butir[1].id).toContain("dirasakan VI Maumere");
    expect(b.butir.some((x) => /PERINGATAN TSUNAMI/.test(x.id))).toBe(true);
    expect(s.tingkat).toBe(3);
    expect(s.ringkas.id).toContain("AWAS");
  });

  it("peringatan tsunami lama (lebih dari 6 jam) tidak lagi dianggap aktif", () => {
    const s = susunSitrep({ ...KOSONG, gempa: [gempa(6.8, 30, { tsunami: true })] });
    expect(s.bagian[1].butir.some((x) => /PERINGATAN TSUNAMI/.test(x.id))).toBe(false);
    expect(s.bagian[1].tingkat).toBe(0);
  });

  it("gunung api: hitung per level dan sebut yang Siaga/Awas", () => {
    const s = susunSitrep({ ...KOSONG, gunung: [gunung("Merapi", 3), gunung("Semeru", 3), gunung("Slamet", 2), gunung("Agung", 1)] });
    expect(s.bagian[2].tingkat).toBe(2);
    expect(s.bagian[2].butir[0].id).toBe("0 gunung Level IV (Awas), 2 Level III (Siaga), 1 Level II (Waspada).");
    expect(s.bagian[2].butir).toHaveLength(3);
    expect(s.bagian[2].butir[1].fokus).toMatchObject({ lon: 110.4 });
    // MAGMA mati: level 0 semua
    const mati = susunSitrep({ ...KOSONG, gunung: [gunung("Merapi", 0)] });
    expect(mati.bagian[2].tingkat).toBe(0);
    expect(mati.bagian[2].butir[0].id).toMatch(/tidak terjangkau/);
  });

  it("banjir & cuaca: peringatan BMKG, hujan deras, korban BNPB", () => {
    const s = susunSitrep({
      ...KOSONG,
      peringatan: [
        { id: "a", judul: "Hujan Lebat di Riau", kejadian: "Hujan Lebat", wilayah: "Riau", deskripsi: "", mulai: KINI - 1000, berakhir: KINI + 3600_000, tingkat: "Moderate", poligon: [] },
        { id: "b", judul: "Basi", kejadian: "Hujan", wilayah: "Jambi", deskripsi: "", mulai: KINI - 9e6, berakhir: KINI - 1000, tingkat: "Moderate", poligon: [] },
      ],
      prakiraan: [prov({ provinsi: "Sumatera Barat", tingkatHujan: 2, hujan3Hari: 212 })],
      bencana: {
        diperbarui: KINI,
        sumber: ["BNPB"],
        bnpb: [{ id: "x", waktu: KINI, kabupaten: "Agam", jenis: "Banjir", kejadian: 2, meninggal: 1, hilang: 2, luka: 0, mengungsi: 1500, rumahRusak: 0, rumahTerendam: 0, kronologi: "", lon: 100, lat: 0 }],
        laporan: [{ id: "l", waktu: KINI - 3600_000, lon: 100.4, lat: -0.9, jenis: "flood", kedalaman: 90, teks: "", kota: "Padang" }],
      },
    });
    const b = s.bagian[3];
    expect(b.tingkat).toBe(2);
    const teks = b.butir.map((x) => x.id).join(" | ");
    expect(teks).toContain("1 peringatan dini cuaca BMKG berlaku: Riau");
    expect(teks).toContain("Sumatera Barat (212 mm)");
    expect(teks).toContain("3 meninggal/hilang");
    expect(teks).toContain("1.500 mengungsi");
    expect(teks).toContain("terdalam 90 cm di Padang");
  });

  it("Markdown dua bahasa memuat semua bagian", () => {
    const s = susunSitrep({ ...KOSONG, hotspot: hotspot(200), gempa: [gempa(5.3, 2)], gunung: [gunung("Merapi", 3)], peringatan: [] });
    const id = sitrepKeMarkdown(s, "id", "15 Nov 09.00 WIB");
    const en = sitrepKeMarkdown(s, "en", "15 Nov 09:00 WIB");
    expect(id).toContain("# Disaster Ops SITREP");
    expect(id).toContain("## Karhutla & asap · Waspada");
    expect(id).toContain("## Gunung api · Siaga");
    expect(en).toContain("## Earthquake & tsunami · Advisory");
    expect(en).toContain("Not a substitute for official warnings");
    expect(id).not.toContain("undefined");
    expect(en).not.toContain("undefined");
  });
});
