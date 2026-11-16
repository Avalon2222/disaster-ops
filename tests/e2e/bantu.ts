import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Kumpulkan pelanggaran CSP selama halaman dipakai. */
export function pantauCsp(page: Page): string[] {
  const pelanggaran: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) pelanggaran.push(m.text());
  });
  return pelanggaran;
}

const PNG_KOSONG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

/** Snapshot prakiraan yang ikut di-deploy, digeser supaya "sekarang" selalu ada di dalam deretnya. */
function cuacaSegar(): string {
  const c = JSON.parse(readFileSync(join(process.cwd(), "public", "data", "cuaca.json"), "utf8"));
  const kini = Date.now();
  const langkah = c.medan.langkahJam * 3600_000;
  c.dibuat = kini - 3600_000;
  c.medan.mulai = Math.floor(kini / langkah) * langkah;
  const hariIni = new Date(kini + 7 * 3600_000);
  c.harian.hari = c.harian.hari.map((_: string, i: number) => new Date(hariIni.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  return JSON.stringify(c);
}

/** Data live tetap: dua gunung Siaga (status nasional SIAGA), satu gempa M5,6, 40 titik panas, satu peringatan. */
export function dataPalsu() {
  const kini = Date.now();
  const menit = Math.round(kini / 60_000);
  const titik = Array.from({ length: 40 }, (_, i) => [113.6 + (i % 8) * 0.05, -2.4 + Math.floor(i / 8) * 0.05, 8 + i, i % 3 === 0 ? 2 : 1, menit - 90 - i, i < 30 ? 0 : 1, i % 3]);
  return {
    hotspot: { diperbarui: kini, sumber: "csv", jam: 24, satelit: ["N20", "N21", "MODIS"], provinsi: ["Kalimantan Tengah", "Riau"], titik },
    gempa: {
      diperbarui: kini,
      sumber: ["BMKG", "USGS"],
      gempa: [
        { id: "bmkg-f1", sumber: "BMKG", waktu: kini - 2 * 3600_000, lon: 120.49, lat: -8.1, dalam: 12, mag: 5.6, tempat: "56 km utara Ruteng, Manggarai", dirasakan: "IV Ruteng, III Labuan Bajo", potensi: "Tidak berpotensi tsunami" },
        { id: "bmkg-q2", sumber: "BMKG", waktu: kini - 9 * 3600_000, lon: 138.2, lat: -4.67, dalam: 10, mag: 4.1, tempat: "West Papua, Indonesia" },
        { id: "usgs-3", sumber: "USGS", waktu: kini - 4 * 86_400_000, lon: 126.5, lat: 2.1, dalam: 35, mag: 6.3, tempat: "Molucca Sea", url: "https://earthquake.usgs.gov/earthquakes/eventpage/x" },
      ],
    },
    gunung: {
      diperbarui: kini,
      live: true,
      gunung: [
        { nama: "Merapi", lat: -7.54, lon: 110.446, elevasi: 2910, provinsi: "DI Yogyakarta", level: 3, url: "https://magma.esdm.go.id/v1/gunung-api/laporan/1" },
        { nama: "Semeru", lat: -8.108, lon: 112.922, elevasi: 3657, provinsi: "Jawa Timur", level: 3 },
        { nama: "Slamet", lat: -7.242, lon: 109.208, elevasi: 3428, provinsi: "Jawa Tengah", level: 2 },
        { nama: "Agung", lat: -8.343, lon: 115.508, elevasi: 3031, provinsi: "Bali", level: 1 },
      ],
    },
    bencana: {
      diperbarui: kini,
      sumber: ["BNPB", "PetaBencana.id"],
      bnpb: [{ id: "bnpb-1", waktu: kini - 86_400_000, kabupaten: "Blora", jenis: "Cuaca ekstrem", kejadian: 2, meninggal: 0, hilang: 0, luka: 1, mengungsi: 45, rumahRusak: 12, rumahTerendam: 0, kronologi: "Hujan lebat disertai angin kencang.", lon: 111.42, lat: -6.97 }],
      laporan: [{ id: "pb-1", waktu: kini - 3 * 3600_000, lon: 96.8354, lat: 3.7887, jenis: "flood", kedalaman: 90, teks: "Banjir kembali menggenangi gampong.", kota: "Aceh Barat Daya" }],
    },
    peringatan: {
      diperbarui: kini,
      peringatan: [
        {
          id: "cap-1",
          judul: "Hujan Lebat disertai Petir di Lampung",
          kejadian: "Hujan Lebat dan Petir",
          wilayah: "Lampung",
          deskripsi: "Hujan lebat disertai petir di sebagian wilayah Lampung.",
          mulai: kini - 1800_000,
          berakhir: kini + 2 * 3600_000,
          tingkat: "Moderate",
          poligon: [[[104.6, -5.9], [105.2, -5.9], [105.2, -5.3], [104.6, -5.3], [104.6, -5.9]]],
        },
      ],
    },
  };
}

/** Ganti semua sumber live dengan data tetap. Ubin peta dasar tetap diambil dari jaringan. */
export async function pasangDataPalsu(page: Page) {
  const d = dataPalsu();
  await page.route("**/api/hotspot**", (r) => r.fulfill({ json: d.hotspot }));
  await page.route("**/api/gempa", (r) => r.fulfill({ json: d.gempa }));
  await page.route("**/api/gunung", (r) => r.fulfill({ json: d.gunung }));
  await page.route("**/api/bencana", (r) => r.fulfill({ json: d.bencana }));
  await page.route("**/api/peringatan", (r) => r.fulfill({ json: d.peringatan }));
  const cuaca = cuacaSegar();
  await page.route("https://raw.githubusercontent.com/**", (r) => r.fulfill({ contentType: "application/json", body: cuaca, headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://router.project-osrm.org/**", (r) =>
    r.fulfill({ json: { code: "Ok", routes: [{ distance: 8400, duration: 900, geometry: { type: "LineString", coordinates: [[100.35, -0.95], [100.4, -0.93], [100.44, -0.9]] } }] }, headers: { "access-control-allow-origin": "*" } }),
  );
  await page.route("https://gibs.earthdata.nasa.gov/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_KOSONG, headers: { "access-control-allow-origin": "*" } }));
}

export function sempit(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 640;
}

/** Buka konsol dengan data tetap, lewati layar boot, tunggu peta siap. */
export async function bukaKonsol(page: Page, jalur = "/") {
  await pasangDataPalsu(page);
  await page.goto(jalur);
  // layar boot bisa selesai sendiri sebelum sempat diklik, jadi kliknya boleh gagal
  const lewati = page.getByRole("button", { name: /Skip/ });
  await lewati.click({ timeout: 4000 }).catch(() => undefined);
  await expect(lewati).toHaveCount(0);
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByTestId("konsol")).toHaveAttribute("data-siap", "1", { timeout: 60_000 });
}

/** Tekan tombol alat di header; di ponsel sebagian tombol ada di menu titik tiga. */
export async function tekanAlat(page: Page, nama: string) {
  const langsung = page.getByRole("banner").getByRole("button", { name: nama, exact: true });
  if (await langsung.first().isVisible()) {
    await langsung.first().click();
    return;
  }
  await page.getByTestId("menu-header").click();
  await page.getByRole("menuitem", { name: nama, exact: true }).click();
}

/** Nyalakan/matikan lapisan lewat rel (desktop) atau chip (ponsel). */
export function tombolLapisan(page: Page, id: string) {
  return page.locator(`[data-lapisan="${id}"]:visible`).first();
}

/** Tombol yang terlihat tapi keluar dari layar (terpotong) dihitung gagal. */
export async function tombolTerpotong(page: Page, pemilih: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const lebar = document.documentElement.clientWidth;
    const tinggi = document.documentElement.clientHeight;
    const hasil: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const k = el.getBoundingClientRect();
      if (k.width === 0 || k.height === 0) continue;
      if (k.left < -0.5 || k.top < -0.5 || k.right > lebar + 0.5 || k.bottom > tinggi + 0.5) hasil.push(`${el.getAttribute("aria-label") ?? el.title ?? el.textContent} @ ${Math.round(k.left)}..${Math.round(k.right)}`);
    }
    return hasil;
  }, pemilih);
}

/** Tombol tanpa nama yang bisa dibaca pembaca layar. */
export async function tombolTanpaNama(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hasil: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("button, [role=button], a[href]"))) {
      const nama = (el.getAttribute("aria-label") ?? "").trim() || (el.textContent ?? "").trim();
      if (!nama) hasil.push(el.outerHTML.slice(0, 160));
    }
    return hasil;
  });
}

/** Halaman tidak boleh melebar ke samping. */
export async function melebar(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
