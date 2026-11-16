import { describe, expect, it } from "vitest";
import { bacaJson, karhutlaMentah, kota, meta, provinsi, rumahSakit } from "./bantu";
import { cariEntitas, normal, skor, type Entitas } from "@/lib/cari";
import { arahDerajat, cariPoligon, cariPoligonDekat, formatKoordinat, jarakKm, lingkaran, mataAngin, titikTujuan } from "@/lib/geo";
import { semuaKunci, terjemah } from "@/lib/i18n";
import { headerKeamanan, kebijakanKonten, SUMBER_LUAR } from "@/lib/keamanan";
import { defLapisan, ID_LAPISAN, JENIS_INARISK, LAPISAN, LAPISAN_AWAL, LAPISAN_MEDAN, medanAktif, modeWaktu, toggleLapisan, type IdLapisan } from "@/lib/lapisan";
import { fiturGempa, fiturHotspot, fiturPeringatan, fiturSungai, pusatPoligon } from "@/lib/peta/fitur";
import { latDariMercY, mercY, sudutGrid, ukuranKanvas } from "@/lib/peta/medan";
import { LAYER_INTERAKTIF, LAYER_LAPISAN, urlCitra, urlInarisk } from "@/lib/peta/pasang";
import { gradienLegenda, kunciJenisBencana, posisiLegenda, SKALA, warnaSkala, type Rgba } from "@/lib/peta/warna";
import { TONGGAK_2019 } from "@/lib/skenario";
import { uraiKarhutla, type GempaHistoris, type GunungStatis } from "@/lib/statis";
import { susunHash, tampilanAwal, uraiHash } from "@/lib/urlState";
import { durasi, formatHariWib, formatTanggalIso, formatWib, tambahHari, tanggalWib, umur } from "@/lib/waktu";

describe("geo", () => {
  it("jarak dan arah", () => {
    expect(jarakKm(106.83, -6.18, 112.75, -7.25)).toBeCloseTo(664, -1); // Jakarta - Surabaya
    expect(jarakKm(100, 0, 100, 0)).toBe(0);
    expect(arahDerajat(100, 0, 101, 0)).toBeCloseTo(90);
    expect(arahDerajat(100, 0, 100, -1)).toBeCloseTo(180);
    expect(mataAngin(0)).toBe("utara");
    expect(mataAngin(225)).toBe("barat daya");
    expect(mataAngin(-45, "en")).toBe("northwest");
    expect(mataAngin(359)).toBe("utara");
  });

  it("titik tujuan dan lingkaran geodesik", () => {
    const [lon, lat] = titikTujuan(110, 0, 90, 111.195);
    expect(lon).toBeCloseTo(111, 2);
    expect(lat).toBeCloseTo(0, 5);
    const ring = lingkaran(110, -7, 50, 36);
    expect(ring).toHaveLength(37);
    for (const [x, y] of ring) expect(jarakKm(110, -7, x, y)).toBeCloseTo(50, 3);
    expect(formatKoordinat(107.62, -6.83)).toBe("6.83° LS, 107.62° BT");
    expect(formatKoordinat(95.3, 5.55)).toBe("5.55° LU, 95.30° BT");
    expect(formatKoordinat(NaN, 1)).toBe("-");
  });

  it("titik dalam provinsi (batas asli)", () => {
    const p = provinsi();
    expect(p).toHaveLength(38);
    const nama = (lon: number, lat: number) => p[cariPoligon(lon, lat, p)]?.nama;
    expect(nama(101.45, 0.51)).toBe("Riau");
    expect(nama(113.92, -2.21)).toBe("Kalimantan Tengah");
    expect(nama(110.37, -7.8)).toMatch(/Yogyakarta/);
    expect(nama(138.94, -4.1)).toMatch(/Papua/);
    expect(cariPoligon(112, -5.5, p)).toBe(-1); // Laut Jawa
    expect(cariPoligon(103.82, 1.35, p)).toBe(-1); // Singapura
    // sedikit di lepas pantai masih dicocokkan ke provinsi terdekat
    expect(cariPoligonDekat(112, -5.5, p)).toBe(-1);
    const pesisir = cariPoligonDekat(100.32, -0.96, p, 0.08);
    expect(p[pesisir].nama).toBe("Sumatera Barat");
  });
});

describe("waktu", () => {
  const T = Date.parse("2026-11-15T01:30:00Z");
  it("format WIB", () => {
    expect(formatWib(T)).toBe("15 Nov 08.30 WIB");
    expect(formatWib(T, "en")).toBe("15 Nov 08:30 WIB");
    expect(formatWib(T, "id", false)).toBe("08.30 WIB");
    expect(formatWib(Date.parse("2026-08-31T18:05:00Z"))).toBe("1 Sep 01.05 WIB");
    expect(formatWib(NaN)).toBe("-");
    expect(formatHariWib(T)).toBe("Min 15 Nov");
    expect(formatHariWib(T, "en")).toBe("Sun 15 Nov");
    expect(tanggalWib(Date.parse("2026-11-14T18:00:00Z"))).toBe("2026-11-15");
    expect(formatTanggalIso("2019-09-21")).toBe("21 Sep 2019");
    expect(formatTanggalIso("2019-08-05", "en")).toBe("5 Aug 2019");
    expect(tambahHari("2019-09-30", 1)).toBe("2019-10-01");
    expect(tambahHari("2019-07-01", 152)).toBe("2019-11-30");
  });

  it("umur dan durasi", () => {
    expect(umur(T - 20_000, T)).toBe("baru saja");
    expect(umur(T - 12 * 60_000, T)).toBe("12 mnt lalu");
    expect(umur(T - 3 * 3600_000, T, "en")).toBe("3 h ago");
    expect(umur(T - 5 * 86_400_000, T)).toBe("5 hari lalu");
    expect(umur(T + 60_000, T)).toBe("baru saja");
    expect(durasi(9)).toBe("9 mnt");
    expect(durasi(85)).toBe("1 j 25 mnt");
    expect(durasi(189, "en")).toBe("3 h 09 min");
    expect(durasi(Infinity)).toBe("-");
  });
});

describe("kamus ID/EN", () => {
  it("semua kunci terisi di dua bahasa", () => {
    for (const k of semuaKunci()) {
      for (const lang of ["id", "en"] as const) {
        const teks = terjemah(lang, k);
        expect(teks, `${k}.${lang}`).toBeTruthy();
        expect(teks.trim(), `${k}.${lang}`).toBe(teks);
      }
    }
    expect(semuaKunci().length).toBeGreaterThan(150);
  });

  it("label konsol sama di dua bahasa, isi penjelasan berbeda", () => {
    for (const k of ["layers", "search", "warroom", "help", "group_live"] as const) expect(terjemah("id", k)).toBe(terjemah("en", k));
    for (const k of ["tagline", "close", "tool_tsunami", "note_quake", "honest_2"] as const) expect(terjemah("id", k)).not.toBe(terjemah("en", k));
  });

  it("nama dan deskripsi lapisan, tonggak 2019: dua bahasa", () => {
    for (const l of LAPISAN) expect(l.nama.id && l.nama.en && l.deskripsi.id && l.deskripsi.en, l.id).toBeTruthy();
    for (const t of TONGGAK_2019) expect(t.id && t.en && /^2019-\d\d-\d\d$/.test(t.tanggal), t.tanggal).toBeTruthy();
    expect([...TONGGAK_2019].sort((a, b) => a.tanggal.localeCompare(b.tanggal))).toEqual(TONGGAK_2019);
  });
});

describe("lapisan", () => {
  it("id, tombol, dan kode keyboard unik; tiap lapisan punya layer peta", () => {
    expect(new Set(ID_LAPISAN).size).toBe(LAPISAN.length);
    expect(new Set(LAPISAN.map((l) => l.tombol)).size).toBe(LAPISAN.length);
    expect(new Set(LAPISAN.map((l) => l.kode)).size).toBe(LAPISAN.length);
    for (const id of ID_LAPISAN) expect(LAYER_LAPISAN[id], id).toBeDefined();
    // tombol alat (W, M, T, P, S, D, L, F, R) tidak boleh bentrok dengan tombol lapisan
    for (const l of LAPISAN) expect(["KeyW", "KeyM", "KeyT", "KeyP", "KeyS", "KeyD", "KeyL", "KeyF", "KeyR"]).not.toContain(l.kode);
    for (const jenis of Object.values(LAYER_INTERAKTIF)) expect(typeof jenis).toBe("string");
  });

  it("lapisan medan saling menggantikan, yang lain bebas", () => {
    let a = new Set<IdLapisan>(LAPISAN_AWAL);
    a = toggleLapisan(a, "fwi");
    expect(medanAktif(a)).toBe("fwi");
    a = toggleLapisan(a, "hujan");
    expect(medanAktif(a)).toBe("hujan");
    expect(a.has("fwi")).toBe(false);
    expect(a.has("hotspot")).toBe(true);
    a = toggleLapisan(a, "hujan");
    expect(medanAktif(a)).toBeNull();
    a = toggleLapisan(a, "rs");
    a = toggleLapisan(a, "sungai");
    expect(a.has("rs") && a.has("sungai")).toBe(true);
    // sesar & megathrust ikut nyala sejak awal; mematikannya tidak mengganggu yang lain
    expect(LAPISAN_AWAL).toEqual(["hotspot", "gempa", "gunung", "bencana", "peringatan", "angin", "sesar"]);
    a = toggleLapisan(a, "sesar");
    expect(a.has("sesar")).toBe(false);
    expect(a.has("rs")).toBe(true);
    expect(LAPISAN_MEDAN).toEqual(["hujan", "suhu", "udara", "fwi", "banjir", "inarisk", "penduduk"]);
    expect(defLapisan("fwi").waktu).toBe("hari");
  });

  it("mode lini masa: medan harian menang atas lapisan per jam", () => {
    expect(modeWaktu(new Set<IdLapisan>(["hotspot", "gempa"]))).toBeNull();
    expect(modeWaktu(new Set<IdLapisan>(["angin"]))).toBe("jam");
    expect(modeWaktu(new Set<IdLapisan>(["angin", "fwi"]))).toBe("hari");
    expect(modeWaktu(new Set<IdLapisan>(["banjir"]))).toBe("hari");
    expect(modeWaktu(new Set<IdLapisan>(["penduduk", "asap"]))).toBe("jam");
    expect(modeWaktu(new Set<IdLapisan>(["inarisk"]))).toBeNull();
  });

  it("URL raster: InaRISK gambar statis per jenis, citra GIBS menurut tanggal", () => {
    for (const j of JENIS_INARISK) expect(urlInarisk(j)).toBe(`/data/inarisk/${j}.webp`);
    expect(urlCitra("2019-09-21")).toContain("VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2019-09-21/");
    expect(urlCitra("2026-11-14")).toContain("VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-11-14/");
  });
});

describe("status URL", () => {
  it("bolak-balik hash", () => {
    const s = { tampilan: { lat: -2.5, lon: 118, zoom: 3.9, bearing: 10, pitch: 45 }, lapisan: ["hotspot", "gempa", "fwi"] as IdLapisan[], lang: "en" as const, sat: true, datar: true, alat: "tsunami" as const };
    const hash = susunHash(s);
    expect(hash).toBe("#v=-2.500/118.000/3.90/10/45&l=hotspot,gempa,fwi&lang=en&sat=1&2d=1&alat=tsunami");
    expect(uraiHash(hash)).toEqual(s);
    expect(susunHash({ ...s, lang: "id", sat: false, datar: false, alat: null })).toBe("#v=-2.500/118.000/3.90/10/45&l=hotspot,gempa,fwi");
  });

  it("isi yang tidak sah diabaikan", () => {
    expect(uraiHash("")).toEqual({});
    expect(uraiHash("#v=abc/def/3")).toEqual({});
    expect(uraiHash("#v=95/118/3")).toEqual({});
    expect(uraiHash("#v=-2/118/30")).toEqual({});
    expect(uraiHash("#l=hotspot,jahat,<script>,gempa&lang=fr&alat=hapus")).toEqual({ lapisan: ["hotspot", "gempa"] });
    expect(uraiHash("#l=")).toEqual({ lapisan: [] });
    expect(uraiHash("#v=-2/118/5/0/999").tampilan?.pitch).toBe(70);
  });

  it("tampilan awal mengecil di layar sempit", () => {
    expect(tampilanAwal(1440).zoom).toBe(3.9);
    expect(tampilanAwal(390).zoom).toBeLessThan(3);
    expect(tampilanAwal(390).zoom).toBeGreaterThan(2);
    expect(tampilanAwal(360).zoom).toBeLessThan(tampilanAwal(412).zoom);
  });
});

describe("pencarian", () => {
  const e: Entitas[] = [
    { jenis: "kota", nama: "Padang", ket: "Sumatera Barat", lon: 100.35, lat: -0.95, zoom: 9, bobot: 3 },
    { jenis: "kota", nama: "Padang Panjang", ket: "", lon: 100.4, lat: -0.47, zoom: 9, bobot: 1 },
    { jenis: "kota", nama: "Padangsidempuan", ket: "", lon: 99.27, lat: 1.38, zoom: 9, bobot: 1 },
    { jenis: "gunung", nama: "Merapi", ket: "DI Yogyakarta", lon: 110.44, lat: -7.54, zoom: 9.5, bobot: 2 },
    { jenis: "provinsi", nama: "Kalimantan Tengah", ket: "", lon: 113.5, lat: -1.5, zoom: 6.2, bobot: 2 },
  ];

  it("skor: persis > awalan > awalan kata > di dalam", () => {
    expect(normal("  Lewotobi Laki-Laki ")).toBe("lewotobi laki laki");
    expect(skor("Padang", "padang")).toBe(3);
    expect(skor("Padang Panjang", "pad")).toBe(2);
    expect(skor("Kalimantan Tengah", "teng")).toBe(1.5);
    expect(skor("Merapi", "rap")).toBe(1);
    expect(skor("Merapi", "xyz")).toBe(0);
    expect(skor("Merapi", "  ")).toBe(0);
  });

  it("hasil: yang persis dulu, lalu bobot", () => {
    expect(cariEntitas(e, "padang").map((x) => x.nama)).toEqual(["Padang", "Padang Panjang", "Padangsidempuan"]);
    expect(cariEntitas(e, "MERAPI")[0].jenis).toBe("gunung");
    expect(cariEntitas(e, "tengah")).toHaveLength(1);
    expect(cariEntitas(e, "")).toEqual([e[0]]);
    expect(cariEntitas(e, "pa", 2)).toHaveLength(2);
  });
});

describe("skala warna dan kanvas medan", () => {
  it("warna diinterpolasi antar titik henti, NaN transparan", () => {
    const c: Rgba = [0, 0, 0, 0];
    expect(warnaSkala(SKALA.fwi, 0, c)[3]).toBe(SKALA.fwi.henti[0][4]);
    expect(warnaSkala(SKALA.fwi, 13, c).slice(0, 3)).toEqual([239, 68, 68]);
    expect(warnaSkala(SKALA.fwi, 999, c).slice(0, 3)).toEqual([190, 24, 93]);
    expect(warnaSkala(SKALA.hujan, 0.1, c)[3]).toBe(0);
    expect(warnaSkala(SKALA.hujan, NaN, c)[3]).toBe(0);
    const tengah = warnaSkala(SKALA.suhu, 30, c);
    expect(tengah[0]).toBeGreaterThan(249);
    expect(tengah[1]).toBeGreaterThan(115);
    expect(tengah[1]).toBeLessThan(204);
  });

  it("legenda: gradien CSS dan posisi label di dalam pita", () => {
    for (const s of Object.values(SKALA)) {
      expect(gradienLegenda(s)).toMatch(/^linear-gradient\(90deg, rgba\(/);
      for (const v of s.label) {
        expect(posisiLegenda(s, v)).toBeGreaterThanOrEqual(0);
        expect(posisiLegenda(s, v)).toBeLessThanOrEqual(1);
      }
      for (let i = 1; i < s.henti.length; i++) expect(s.henti[i][0]).toBeGreaterThan(s.henti[i - 1][0]);
    }
  });

  it("jenis bencana BNPB/PetaBencana dipetakan ke kunci warna", () => {
    expect(kunciJenisBencana("Banjir")).toBe("banjir");
    expect(kunciJenisBencana("Tanah longsor")).toBe("longsor");
    expect(kunciJenisBencana("Cuaca ekstrem")).toBe("cuaca");
    expect(kunciJenisBencana("Kebakaran hutan dan lahan")).toBe("karhutla");
    expect(kunciJenisBencana("flood")).toBe("banjir");
    expect(kunciJenisBencana("earthquake")).toBe("gempa");
    expect(kunciJenisBencana("Erupsi gunung api")).toBe("erupsi");
    expect(kunciJenisBencana("Lain-lain")).toBe("lain");
  });

  it("Mercator bolak-balik dan ukuran kanvas mengikuti rasio Mercator", () => {
    for (const lat of [-15, -6.2, 0, 5.5, 12]) expect(latDariMercY(mercY(lat))).toBeCloseTo(lat, 9);
    const g = { lon0: 90, lat0: -15, dx: 1.5, dy: 1.5, nx: 39, ny: 18 };
    const u = ukuranKanvas(g, 10);
    expect(u.lebar).toBe(381);
    // di sekitar khatulistiwa tinggi Mercator sedikit lebih besar daripada rasio derajat
    expect(u.tinggi).toBeGreaterThanOrEqual(Math.round((381 * 25.5) / 57));
    expect(u.tinggi).toBeLessThan(Math.round((381 * 25.5) / 57) + 4);
    expect(sudutGrid(g)).toEqual([[90, 10.5], [147, 10.5], [147, -15], [90, -15]]);
  });
});

describe("fitur peta", () => {
  it("titik panas dan gempa membawa umur dalam jam", () => {
    const kini = Date.parse("2026-11-15T12:00:00Z");
    const h = fiturHotspot({ diperbarui: kini, sumber: "csv", jam: 24, satelit: ["N20"], provinsi: ["Riau"], titik: [[101.4, 0.5, 12.3, 1, kini / 60_000 - 180, 0, 0]] }, kini);
    expect(h[0].properties).toEqual({ id: "hs-0", frp: 12.3, umur: 3 });
    expect(h[0].geometry).toEqual({ type: "Point", coordinates: [101.4, 0.5] });
    const g = fiturGempa([{ id: "x", sumber: "BMKG", waktu: kini - 7200_000, lon: 120, lat: -8, dalam: 10, mag: 5.2, tempat: "" }], kini);
    expect(g[0].properties).toEqual({ id: "x", mag: 5.2, dalam: 10, umur: 2, tsunami: false });
  });

  it("peringatan jadi Polygon atau MultiPolygon; sungai membawa tingkat", () => {
    const ring: [number, number][] = [[100, 0], [101, 0], [101, 1], [100, 0]];
    const p = { id: "a", judul: "", kejadian: "", wilayah: "", deskripsi: "", mulai: 0, berakhir: 1, tingkat: "" };
    const f = fiturPeringatan([{ ...p, poligon: [ring] }, { ...p, id: "b", poligon: [ring, ring] }]);
    expect(f[0].geometry.type).toBe("Polygon");
    expect(f[1].geometry.type).toBe("MultiPolygon");
    expect(pusatPoligon(ring)).toEqual([100.5, 0.25]);
    const s = fiturSungai([{ nama: "Musi", lokasi: "Palembang", lon: 104.8, lat: -2.8, debit: [900], p50: 100, p90: 200, p99: 500 }]);
    expect(s[0].properties).toEqual({ id: "sg-Musi", nama: "Musi", tingkat: 3 });
  });
});

describe("keamanan", () => {
  it("CSP mengizinkan hanya host yang dipakai", () => {
    const csp = kebijakanKonten(false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(kebijakanKonten(true)).toContain("unsafe-eval");
    for (const h of [...SUMBER_LUAR.sambung, ...SUMBER_LUAR.gambar]) {
      expect(h).toMatch(/^https:\/\/[a-z0-9.-]+$/);
      expect(csp).toContain(h);
    }
    const header = Object.fromEntries(headerKeamanan().map((h) => [h.key, h.value]));
    expect(header["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(header["X-Content-Type-Options"]).toBe("nosniff");
    expect(header["Permissions-Policy"]).toContain("camera=()");
  });
});

describe("data statis yang di-deploy", () => {
  it("kota, gunung api, rumah sakit, gempa historis, sesar", () => {
    const k = kota();
    expect(k.length).toBeGreaterThan(400);
    expect(k.filter((x) => x.utama === 1).length).toBeGreaterThan(90);
    for (const wajib of ["Jakarta", "Padang", "Banda Aceh", "Palu", "Jayapura", "Kupang"]) expect(k.some((x) => x.nama === wajib), wajib).toBe(true);
    expect(k.every((x) => x.lon > 94 && x.lon < 142 && x.lat > -11.5 && x.lat < 6.5)).toBe(true);
    // tidak ada dua kota berimpit (Tua Pejat vs Tuapejat)
    expect(k.filter((x) => Math.abs(x.lat + 2.03) < 0.07 && Math.abs(x.lon - 99.59) < 0.07)).toHaveLength(1);

    const g = bacaJson<GunungStatis[]>("gunung.json");
    expect(g.length).toBeGreaterThanOrEqual(69);
    for (const wajib of ["Merapi", "Semeru", "Anak Krakatau", "Agung", "Sinabung"]) expect(g.some((x) => x.nama === wajib), wajib).toBe(true);

    const rs = rumahSakit();
    expect(rs.length).toBeGreaterThan(1000);
    expect(rs.every((r) => r.length === 3 && typeof r[2] === "string")).toBe(true);

    const h = bacaJson<GempaHistoris[]>("gempa_historis.json");
    expect(h.length).toBeGreaterThan(1500);
    expect(h.every((x) => x[3] >= 6)).toBe(true);
    const aceh = h.find((x) => x[4] === 2004 && x[3] >= 9);
    expect(aceh).toBeDefined();
    expect(aceh![0]).toBeCloseTo(95.98, 0);

    const sesar = bacaJson<{ features: { properties: { jenis: string }; geometry: { coordinates: number[][] } }[] }>("sesar.geojson");
    expect(sesar.features.filter((f) => f.properties.jenis === "sesar").length).toBeGreaterThan(120);
    expect(sesar.features.filter((f) => f.properties.jenis === "megathrust").length).toBeGreaterThan(5);
    expect(sesar.features.every((f) => f.geometry.coordinates.length >= 2)).toBe(true);
  });

  it("karhutla 2019: jumlah cocok dengan meta, urut per hari, puncak di September", () => {
    const m = meta().karhutla2019;
    const d = uraiKarhutla(karhutlaMentah(), m);
    expect(d.lon.length).toBe(m.jumlah);
    expect(m.per_hari.reduce((a, b) => a + b, 0)).toBe(m.jumlah);
    expect(m.per_hari).toHaveLength(m.hari);
    for (let i = 1; i < d.hari.length; i++) expect(d.hari[i]).toBeGreaterThanOrEqual(d.hari[i - 1]);
    for (let h = 0; h < m.hari; h++) expect(d.awalHari[h + 1] - d.awalHari[h], `hari ${h}`).toBe(m.per_hari[h]);
    const puncak = m.per_hari.indexOf(Math.max(...m.per_hari));
    expect(tambahHari(m.mulai, puncak)).toMatch(/^2019-09-/);
    expect(tambahHari(m.mulai, m.hari - 1)).toBe("2019-11-30");
    // semua titik di Indonesia, FRP masuk akal
    for (let i = 0; i < d.lon.length; i += 97) {
      expect(d.lon[i]).toBeGreaterThan(94);
      expect(d.lon[i]).toBeLessThan(142);
      expect(d.lat[i]).toBeGreaterThan(-11.5);
      expect(d.lat[i]).toBeLessThan(6.5);
      expect(d.frp[i]).toBeGreaterThanOrEqual(0);
      expect(d.frp[i]).toBeLessThan(5000);
    }
  });
});
