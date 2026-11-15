import { describe, expect, it } from "vitest";
import { fetchPalsu, provinsi } from "./bantu";
import { ambilJson, hurufJudul, kunciWilayah, parseBnpb, parsePetaBencana } from "@/lib/sumber/bencana";
import { ambilHotspot, kelasYakin, KOTAK_INDONESIA, parseCsvFirms, ringkasPerProvinsi, SENSOR, urlApi, urlCsv } from "@/lib/sumber/firms";
import { ambilGempa, gabungGempa, gempaSama, parseBmkgCap, parseBmkgQl, parseUsgs, urlUsgs, waktuBmkg } from "@/lib/sumber/gempa";
import { ambilMagma, gabungLevel, kunciNama, parseMagma } from "@/lib/sumber/magma";
import { ambilPeringatan, parseCap, ringCap, tautanCap } from "@/lib/sumber/peringatan";

const prov = provinsi();

const CSV_VIIRS = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
0.5321,101.4472,345.1,0.39,0.36,2026-11-14,0612,N20,n,2.0NRT,295.5,12.34,D
-2.2101,113.9202,367,0.4,0.37,2026-11-14,0614,N20,h,2.0NRT,300.1,88.8,D
-2.3000,113.9500,330.2,0.4,0.37,2026-11-14,1814,N20,l,2.0NRT,290.1,1.2,N
-9.5000,135.0000,367,0.4,0.37,2026-11-14,0550,N20,h,2.0NRT,300.1,40,D
24.7570,141.3234,331.4,0.42,0.37,2026-11-13,0342,N20,n,2.0NRT,295.5,2.79,D
bukan,baris,yang,benar
`;
const CSV_MODIS = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight
-0.0300,109.3400,320.5,1,1,2026-11-14,315,Terra,85,6.1NRT,295.2,25.5,D
-3.3200,114.5900,310.5,1,1,2026-11-14,0615,Aqua,12,6.1NRT,293.2,5.5,D
`;

describe("NASA FIRMS", () => {
  it("mengurai CSV VIIRS: buang keyakinan rendah, laut, dan luar Indonesia", () => {
    const t = parseCsvFirms(CSV_VIIRS, 0, prov);
    expect(t).toHaveLength(2);
    const [riau, kalteng] = t;
    expect(prov[riau[5]].nama).toBe("Riau");
    expect(prov[kalteng[5]].nama).toBe("Kalimantan Tengah");
    expect(riau[2]).toBe(12.3);
    expect(riau[3]).toBe(1);
    expect(kalteng[3]).toBe(2);
    expect(riau[4] * 60_000).toBe(Date.parse("2026-11-14T06:12:00Z"));
    expect(riau[6]).toBe(0);
  });

  it("tanpa batas provinsi, titik di laut ikut (dipakai kalau berkas provinsi gagal dibaca)", () => {
    expect(parseCsvFirms(CSV_VIIRS, 1)).toHaveLength(3);
    expect(parseCsvFirms(CSV_VIIRS, 1).every((t) => t[5] === -1 && t[6] === 1)).toBe(true);
  });

  it("mengurai CSV MODIS: keyakinan dalam persen, jam tiga digit", () => {
    const t = parseCsvFirms(CSV_MODIS, 2, prov);
    expect(t).toHaveLength(1);
    expect(t[0][3]).toBe(2);
    expect(t[0][4] * 60_000).toBe(Date.parse("2026-11-14T03:15:00Z"));
    expect(prov[t[0][5]].nama).toBe("Kalimantan Barat");
  });

  it("CSV tanpa kolom wajib menghasilkan daftar kosong", () => {
    expect(parseCsvFirms("a,b,c\n1,2,3", 0)).toEqual([]);
    expect(parseCsvFirms("", 0)).toEqual([]);
  });

  it("kelas keyakinan", () => {
    expect(["l", "n", "h", "low", "nominal", "high", "10", "45", "80", "?"].map(kelasYakin)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2, 1]);
  });

  it("URL: berkas terbuka tanpa kunci, area API dengan kunci", () => {
    expect(urlCsv(SENSOR[0], 24)).toBe("https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv");
    expect(urlCsv(SENSOR[2], 168)).toContain("MODIS_C6_1_SouthEast_Asia_7d.csv");
    const k = KOTAK_INDONESIA;
    expect(urlApi(SENSOR[1], "KUNCI", 7)).toBe(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/KUNCI/VIIRS_NOAA21_NRT/${k.lonMin},${k.latMin},${k.lonMax},${k.latMax}/7`);
  });

  it("ambilHotspot: satu sensor gagal tidak menggagalkan semuanya, titik basi dibuang", async () => {
    const kini = new Date();
    const tgl = kini.toISOString().slice(0, 10);
    const csv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
0.5321,101.4472,345.1,0.39,0.36,${tgl},0000,N20,n,2.0NRT,295.5,12.34,D
0.6000,101.5000,345.1,0.39,0.36,2020-01-01,0000,N20,n,2.0NRT,295.5,12.34,D
`;
    const d = await ambilHotspot({ jam: 24, provinsi: prov, ambil: fetchPalsu({ "noaa-20": csv, "noaa-21": 500, modis: "<html>error</html>" }) });
    expect(d.sumber).toBe("csv");
    expect(d.titik).toHaveLength(1);
    expect(d.provinsi).toHaveLength(38);
    expect(d.satelit).toEqual(["N20", "N21", "MODIS"]);
    await expect(ambilHotspot({ jam: 24, ambil: fetchPalsu({}) })).rejects.toThrow();
    const api = await ambilHotspot({ jam: 168, kunci: "K", provinsi: prov, ambil: fetchPalsu({ "/api/area/csv/K/": csv }) });
    expect(api.sumber).toBe("api");
    expect(api.jam).toBe(168);
  });

  it("ringkas per provinsi: terbanyak dulu", () => {
    const r = ringkasPerProvinsi({
      provinsi: ["A", "B"],
      titik: [
        [0, 0, 10, 1, 100, 0, 0],
        [0, 0, 5.4, 1, 100, 1, 0],
        [0, 0, 7, 1, 100, 1, 0],
        [0, 0, 7, 1, 50, 1, 0],
        [0, 0, 7, 1, 100, -1, 0],
      ],
    }, 90);
    expect(r).toEqual([
      { provinsi: "B", jumlah: 2, frp: 12 },
      { provinsi: "A", jumlah: 1, frp: 10 },
    ]);
  });
});

const QL = {
  features: [
    { geometry: { coordinates: ["138.200500", "-4.668233", 1] }, properties: { id: "bmg2026wiyt", time: "2026-11-14 23:22:26.962436", mag: "4.066007", depth: "10.000000", place: "West Papua, Indonesia" } },
    { geometry: { coordinates: ["x", "y"] }, properties: { id: "rusak", time: "kapan", mag: "?", depth: "", place: "" } },
  ],
};
const CAP_DIRASAKAN = `<?xml version="1.0"?><alert><info>
 <event>Gempabumi</event><date>15-11-26</date><time>04:24:20 WIB</time>
 <point><coordinates>120.49,-8.10</coordinates></point><magnitude>4.5</magnitude><depth>2 Km</depth>
 <area>Pusat gempa berada di laut 56 km utara Ruteng, Manggarai</area><eventid>20261115042420</eventid>
 <potential>Gempa ini dirasakan untuk diteruskan pada masyarakat</potential>
 <shakemap>20261115042420.mmi.jpg</shakemap><felt>II Manggarai</felt></info>
 <info><date>rusak</date><time>rusak</time><magnitude>x</magnitude></info></alert>`;
const CAP_TSUNAMI = `<alert><info><date>15-08-26</date><time>04:58:24 WITA</time><point><coordinates>121.39,-8.41</coordinates></point>
 <magnitude>7.7</magnitude><depth>15 Km</depth><area>30 km TimurLaut MBAY-NAGEKEO-NTT</area><eventid>20260815073130</eventid>
 <potential>Potensi TSUNAMI untuk diteruskan pada masyarakat</potential></info>
 <info><date>10-08-26</date><time>01:00:00 WIB</time><point><coordinates>100,-2</coordinates></point><magnitude>6.9</magnitude><depth>30 Km</depth>
 <area>Mentawai</area><eventid>2</eventid><potential>Tidak berpotensi tsunami</potential></info></alert>`;
const USGS = {
  features: [
    { id: "us7000abcd", geometry: { coordinates: [138.21, -4.48, 66] }, properties: { mag: 3.9, place: "West Papua", time: Date.parse("2026-11-14T23:22:29Z"), url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd", tsunami: 0 } },
    { id: "us7000efgh", geometry: { coordinates: [126.5, 2.1, 35.4] }, properties: { mag: 5.14, place: "Molucca Sea", time: Date.parse("2026-11-13T10:00:00Z"), url: "https://earthquake.usgs.gov/x", tsunami: 1 } },
    { id: "tanpa-mag", geometry: { coordinates: [120, 0, 10] }, properties: { mag: null, place: null, time: 1, url: "" } },
  ],
};

describe("gempa BMKG + USGS", () => {
  it("feed real-time BMKG: waktu UTC, angka dibulatkan, baris rusak dilewati", () => {
    const g = parseBmkgQl(QL);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ id: "bmkg-bmg2026wiyt", sumber: "BMKG", lon: 138.201, lat: -4.668, dalam: 10, mag: 4.1 });
    expect(g[0].waktu).toBe(Date.parse("2026-11-14T23:22:26.962Z"));
    expect(parseBmkgQl(null)).toEqual([]);
  });

  it("waktu BMKG: WIB, WITA, WIT ke UTC", () => {
    expect(waktuBmkg("15-11-26", "04:24:20 WIB")).toBe(Date.parse("2026-11-14T21:24:20Z"));
    expect(waktuBmkg("15-11-26", "04:24:20 WITA")).toBe(Date.parse("2026-11-14T20:24:20Z"));
    expect(waktuBmkg("15-11-26", "04:24:20 WIT")).toBe(Date.parse("2026-11-14T19:24:20Z"));
    expect(waktuBmkg("15-11-26", "04:24:20 UTC")).toBe(Date.parse("2026-11-15T04:24:20Z"));
    expect(waktuBmkg("rusak", "rusak")).toBeNaN();
  });

  it("gempa dirasakan: MMI, shakemap, kedalaman", () => {
    const g = parseBmkgCap(CAP_DIRASAKAN, "dirasakan");
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ id: "bmkg-f20261115042420", lon: 120.49, lat: -8.1, mag: 4.5, dalam: 2, dirasakan: "II Manggarai" });
    expect(g[0].shakemap).toBe("https://bmkg-content-inatews.storage.googleapis.com/20261115042420.mmi.jpg");
    expect(g[0].tsunami).toBeUndefined();
  });

  it("peringatan tsunami hanya ditandai kalau BMKG menyatakan berpotensi", () => {
    const g = parseBmkgCap(CAP_TSUNAMI, "tsunami");
    expect(g.map((x) => Boolean(x.tsunami))).toEqual([true, false]);
    expect(g[0].waktu).toBe(Date.parse("2026-08-14T20:58:24Z"));
  });

  it("USGS: tanpa magnitudo dilewati, bendera tsunami dibawa", () => {
    const g = parseUsgs(USGS);
    expect(g).toHaveLength(2);
    expect(g[1]).toMatchObject({ id: "usgs-us7000efgh", sumber: "USGS", mag: 5.1, dalam: 35, tsunami: true });
    expect(g[0].tsunami).toBeUndefined();
    expect(urlUsgs(7)).toContain("minmagnitude=2.5");
  });

  it("gabung: catatan BMKG dan USGS untuk gempa yang sama jadi satu, BMKG menang", () => {
    const bmkg = parseBmkgQl(QL);
    const usgs = parseUsgs(USGS);
    expect(gempaSama(bmkg[0], usgs[0])).toBe(true);
    expect(gempaSama(bmkg[0], usgs[1])).toBe(false);
    const g = gabungGempa([], bmkg, usgs);
    expect(g).toHaveLength(2);
    const papua = g.find((x) => x.id === "bmkg-bmg2026wiyt")!;
    expect(papua.sumber).toBe("BMKG");
    expect(papua.url).toContain("us7000abcd");
    // urut dari yang terbaru
    expect(g[0].waktu).toBeGreaterThan(g[1].waktu);
  });

  it("ambilGempa: jalan walau BMKG mati; gagal total kalau semua mati", async () => {
    const baru = { features: [{ id: "a", geometry: { coordinates: [120, -2, 10] }, properties: { mag: 5, place: "X", time: Date.now() - 3600_000, url: "u" } }, { id: "luar", geometry: { coordinates: [166, -11, 10] }, properties: { mag: 6.2, place: "Santa Cruz", time: Date.now() - 7200_000, url: "u" } }] };
    const d = await ambilGempa(7, fetchPalsu({ "earthquake.usgs.gov": JSON.stringify(baru), "bmkg-content": 503 }));
    expect(d.sumber).toEqual(["USGS"]);
    // gempa di luar kawasan dibuang
    expect(d.gempa.map((g) => g.id)).toEqual(["usgs-a"]);
    await expect(ambilGempa(7, fetchPalsu({}))).rejects.toThrow();
  });
});

const HTML_MAGMA = `<tr><td rowspan="1"><a href="" class="tx-inverse tx-14 tx-medium d-block">Level IV (Awas)</a></td><td>Tidak ada gunung api Level IV (Awas)</td></tr>
<tr><td rowspan="3"><a href="" class="tx-inverse tx-14 tx-medium d-block">Level III (Siaga)</a></td></tr>
<tr><td>
 Anak Krakatau - Lampung <a href="https://magma.esdm.go.id/v1/gunung-api/laporan/330780?signature=abc&amp;x=1"><i class="fa"></i>Lihat laporan</a><br></td></tr>
<tr><td> Lewotobi Laki-laki - Nusa Tenggara Timur <a href="https://magma.esdm.go.id/v1/gunung-api/laporan/330781">Lihat laporan</a></td></tr>
<tr><td rowspan="2"><a href="" class="tx-inverse tx-14 tx-medium d-block">Level II (Waspada)</a></td></tr>
<tr><td>Semeru - Jawa Timur <a href="https://magma.esdm.go.id/v1/gunung-api/laporan/330782">Lihat laporan</a></td></tr>
<tr><td>Jahat - X <a href="https://situs-lain.example/laporan/1">Lihat laporan</a></td></tr>`;

describe("MAGMA Indonesia", () => {
  it("membaca tabel tingkat aktivitas", () => {
    const l = parseMagma(HTML_MAGMA);
    expect(l).toEqual([
      { nama: "Anak Krakatau", provinsi: "Lampung", level: 3, url: "https://magma.esdm.go.id/v1/gunung-api/laporan/330780?signature=abc&x=1" },
      { nama: "Lewotobi Laki-laki", provinsi: "Nusa Tenggara Timur", level: 3, url: "https://magma.esdm.go.id/v1/gunung-api/laporan/330781" },
      { nama: "Semeru", provinsi: "Jawa Timur", level: 2, url: "https://magma.esdm.go.id/v1/gunung-api/laporan/330782" },
    ]);
    expect(parseMagma("<html>kosong</html>")).toEqual([]);
  });

  it("nama gunung dicocokkan tanpa peduli ejaan", () => {
    expect(kunciNama("Lewotobi Laki-Laki")).toBe(kunciNama("lewotobi laki-laki"));
    expect(kunciNama("Gunung Merapi")).toBe("merapi");
    expect(kunciNama("G. Agung")).toBe("agung");
  });

  it("gabung dengan koordinat: tak disebut = Normal, MAGMA mati = tidak diketahui", () => {
    const statis = [
      { nama: "Semeru", lat: -8.1, lon: 112.9, elevasi: 3676, provinsi: "Jawa Timur" },
      { nama: "Lewotobi Laki-Laki", lat: -8.5, lon: 122.7, elevasi: 1584, provinsi: "NTT" },
      { nama: "Agung", lat: -8.3, lon: 115.5, elevasi: 3031, provinsi: "Bali" },
    ];
    const g = gabungLevel(statis, parseMagma(HTML_MAGMA));
    expect(g.map((x) => x.level)).toEqual([2, 3, 1]);
    expect(g[1].url).toContain("330781");
    expect(g[2].url).toBeUndefined();
    expect(gabungLevel(statis, null).map((x) => x.level)).toEqual([0, 0, 0]);
  });

  it("ambilMagma menolak halaman tanpa tabel", async () => {
    await expect(ambilMagma(fetchPalsu({ "magma.esdm.go.id": "<html>Cloudflare</html>" }))).rejects.toThrow(/tabel/);
    await expect(ambilMagma(fetchPalsu({ "magma.esdm.go.id": 403 }))).rejects.toThrow(/403/);
    expect(await ambilMagma(fetchPalsu({ "magma.esdm.go.id": HTML_MAGMA }))).toHaveLength(3);
  });
});

describe("BNPB dan PetaBencana", () => {
  const wilayah = new Map([
    ["blora", { lon: 111.42, lat: -6.97 }],
    ["bima", { lon: 118.73, lat: -8.46 }],
  ]);

  it("nama wilayah dinormalkan", () => {
    expect(kunciWilayah("Kab. Blora")).toBe("blora");
    expect(kunciWilayah("KOTA BIMA")).toBe("bima");
    expect(kunciWilayah("Kabupaten Aceh Barat Daya")).toBe("acehbaratdaya");
    expect(kunciWilayah("Kota Adm. Jakarta Selatan")).toBe("jakartaselatan");
    expect(hurufJudul("ACEH BARAT DAYA")).toBe("Aceh Barat Daya");
    expect(hurufJudul("pangkajene-kepulauan")).toBe("Pangkajene-Kepulauan");
  });

  it("rekap BNPB: lokasi dari ibu kota kabupaten, yang tak dikenal dilewati", () => {
    const b = parseBnpb(
      {
        features: [
          { attributes: { dt: 1794182400000, kabupaten: "Blora", kategori_bencana: "Cuaca ekstrem", jumlah_kejadian: 2, meninggal: 0, mengungsi: 45, kronologis: "  Angin   kencang \n melanda ", id: "abc" } },
          { attributes: { dt: 1794268800000, kabupaten: "Kota Bima", kategori_bencana: "Banjir", rumah_terendam: 120, objectid: 7 } },
          { attributes: { dt: 1794268800000, kabupaten: "Atlantis", kategori_bencana: "Banjir" } },
          { attributes: { kabupaten: "Blora" } },
        ],
      },
      wilayah,
    );
    expect(b).toHaveLength(2);
    expect(b[0]).toMatchObject({ id: "bnpb-7", kabupaten: "Kota Bima", jenis: "Banjir", rumahTerendam: 120, kejadian: 1, lon: 118.73 });
    expect(b[1]).toMatchObject({ id: "bnpb-abc", mengungsi: 45, kronologi: "Angin kencang melanda" });
    expect(parseBnpb({ error: { code: 499 } }, wilayah)).toEqual([]);
  });

  it("laporan warga: kedalaman banjir, foto hanya dari host resmi", () => {
    const l = parsePetaBencana({
      result: {
        features: [
          { geometry: { coordinates: [96.83543, 3.78871] }, properties: { pkey: "400041", created_at: "2026-11-14T22:27:03.680Z", disaster_type: "flood", report_data: { flood_depth: 90 }, text: "Banjir  kembali", image_url: "https://images.petabencana.id/a.jpg", tags: { city: "ACEH BARAT DAYA" } } },
          { geometry: { coordinates: [106.8, -6.2] }, properties: { pkey: "2", created_at: "2026-11-15T01:00:00Z", disaster_type: "fire", report_data: null, text: null, title: "Kebakaran", image_url: "https://jahat.example/x.jpg", tags: null } },
          { geometry: { coordinates: [] }, properties: { pkey: "3", created_at: "kapan" } },
        ],
      },
    });
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ id: "pb-2", jenis: "fire", teks: "Kebakaran", kota: "" });
    expect(l[0].gambar).toBeUndefined();
    expect(l[0].kedalaman).toBeUndefined();
    expect(l[1]).toMatchObject({ id: "pb-400041", kedalaman: 90, kota: "Aceh Barat Daya", teks: "Banjir kembali", gambar: "https://images.petabencana.id/a.jpg" });
  });

  it("ambilJson melempar galat pada status bukan 200", async () => {
    await expect(ambilJson("https://gis.bnpb.go.id/x", fetchPalsu({ "bnpb.go.id": 500 }))).rejects.toThrow("HTTP 500 gis.bnpb.go.id");
    expect(await ambilJson("https://gis.bnpb.go.id/x", fetchPalsu({ "bnpb.go.id": '{"a":1}' }))).toEqual({ a: 1 });
  });
});

const RSS = `<rss><channel><link>https://www.bmkg.go.id/alerts/nowcast/id/rss.xml</link>
<item><title>A</title><link>https://www.bmkg.go.id/alerts/nowcast/id/CLG20261115001_alert.xml</link></item>
<item><title>B</title><link>https://jahat.example/alerts/nowcast/id/X_alert.xml</link></item>
<item><title>C</title><link>https://www.bmkg.go.id/alerts/nowcast/id/CKU20261115001_alert.xml</link></item></channel></rss>`;
const cap = (id: string, berakhir: string) => `<alert><identifier>${id}</identifier><sent>2026-11-15T07:30:00+07:00</sent><info>
<event>Hujan Lebat dan Petir</event><severity>Moderate</severity><effective>2026-11-15T08:00:00+07:00</effective><expires>${berakhir}</expires>
<headline>Hujan Lebat disertai Petir di Lampung</headline><description>Hujan lebat
 disertai petir.</description><web>https://nowcasting.bmkg.go.id/infografis/CLG/2026/11/15/infografis.jpg</web>
<area><areaDesc>Lampung</areaDesc><polygon>-5.937,104.659 -5.902,104.656 -5.879,104.643 -5.937,104.659</polygon></area></info></alert>`;

describe("peringatan dini cuaca BMKG", () => {
  it("tautan CAP hanya dari bmkg.go.id", () => {
    expect(tautanCap(RSS)).toEqual(["https://www.bmkg.go.id/alerts/nowcast/id/CLG20261115001_alert.xml", "https://www.bmkg.go.id/alerts/nowcast/id/CKU20261115001_alert.xml"]);
  });

  it("poligon CAP (lat,lon) dibalik jadi [lon, lat]", () => {
    expect(ringCap("-5.937,104.659 -5.902,104.656  x,y")).toEqual([
      [104.659, -5.937],
      [104.656, -5.902],
    ]);
  });

  it("mengurai satu peringatan", () => {
    const p = parseCap(cap("ID1", "2026-11-15T10:00:00+07:00"))!;
    expect(p).toMatchObject({ id: "ID1", kejadian: "Hujan Lebat dan Petir", wilayah: "Lampung", tingkat: "Moderate", deskripsi: "Hujan lebat disertai petir." });
    expect(p.mulai).toBe(Date.parse("2026-11-15T01:00:00Z"));
    expect(p.berakhir).toBe(Date.parse("2026-11-15T03:00:00Z"));
    expect(p.poligon).toHaveLength(1);
    expect(p.poligon[0][0]).toEqual([104.659, -5.937]);
    expect(p.infografis).toContain("nowcasting.bmkg.go.id");
    expect(parseCap("<alert><identifier>x</identifier></alert>")).toBeNull();
  });

  it("ambilPeringatan: yang sudah lama berakhir dibuang, berkas gagal dilewati", async () => {
    const kini = Date.parse("2026-11-15T02:00:00Z");
    const p = await ambilPeringatan(fetchPalsu({ CLG20261115001: cap("aktif", "2026-11-15T10:00:00+07:00"), CKU20261115001: cap("basi", "2026-11-15T05:00:00+07:00"), "nowcast/id": RSS }), kini);
    expect(p.map((x) => x.id)).toEqual(["aktif"]);
    const sebagian = await ambilPeringatan(fetchPalsu({ CLG20261115001: 500, CKU20261115001: cap("ok", "2026-11-15T12:00:00+07:00"), "nowcast/id": RSS }), kini);
    expect(sebagian.map((x) => x.id)).toEqual(["ok"]);
  });
});
