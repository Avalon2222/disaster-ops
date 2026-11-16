import { expect, test, type Page } from "@playwright/test";
import { bukaKonsol, melebar, sempit, tekanAlat, tombolLapisan, tombolTerpotong } from "./bantu";

interface PetaUji {
  jumpTo(o: { center: [number, number]; zoom: number }): void;
  easeTo(o: { center: [number, number]; zoom?: number; duration: number }): void;
  project(c: [number, number]): { x: number; y: number };
  getStyle(): { layers: { id: string }[] };
  getLayer(id: string): unknown;
  getLayoutProperty(id: string, nama: string): unknown;
  getPaintProperty(id: string, nama: string): unknown;
  getFilter(id: string): unknown;
  hasImage(id: string): boolean;
  isMoving(): boolean;
  queryRenderedFeatures(kotak: [[number, number], [number, number]], o: { layers: string[] }): unknown[];
}

// Tes di berkas ini menunggu animasi di peta WebGL yang dirender CPU (SwiftShader), jadi diberi waktu lebih longgar.
// Yang diuji perilaku peta, bukan tata letak, jadi cukup di ponsel terkecil dan desktop.
test.setTimeout(180_000);
test.skip(({ viewport }) => [390, 412].includes(viewport?.width ?? 0), "perilaku peta diuji di 360 dan 1440 px");

/** Jumlah piksel berisi di kanvas efek (angin, hujan, kabut). */
async function pikselEfek(page: Page): Promise<number> {
  return page.evaluate(() => {
    const k = document.querySelector<HTMLCanvasElement>('canvas[data-testid="kanvas-efek"]');
    const ctx = k?.getContext("2d");
    if (!k || !ctx) return -1;
    const d = ctx.getImageData(0, 0, k.width, k.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++;
    return n;
  });
}

/** Keadaan semua layer peta: mana yang terlihat dan seberapa pekat rasternya. */
async function keadaanLayer(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const m = (window as unknown as { __dops: PetaUji }).__dops;
    const sendiri = /^(hotspot|gempa|gunung|bencana|laporan|peringatan|asap|sungai|historis|sesar|megathrust|rs|medan|inarisk|citra|replay|tsunami)/;
    return m
      .getStyle()
      .layers.filter((l) => sendiri.test(l.id))
      .map((l) => `${l.id}:${m.getLayoutProperty(l.id, "visibility") ?? "visible"}:${l.id in { "medan-darat": 1, "medan-atas": 1, "inarisk-raster": 1, "citra-raster": 1 } ? m.getPaintProperty(l.id, "raster-opacity") : ""}`);
  });
}

async function tungguDiam(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dops: PetaUji }).__dops.isMoving()), { timeout: 60_000 }).toBe(false);
}

test("lapisan awal: yang paling ramai langsung nyala, sisanya mati", async ({ page }) => {
  await bukaKonsol(page);
  for (const id of ["hotspot", "gempa", "gunung", "bencana", "peringatan", "angin", "sesar"]) await expect(tombolLapisan(page, id), id).toHaveAttribute("aria-pressed", "true");
  for (const id of ["laporan", "hujan", "suhu", "udara", "fwi", "asap", "banjir", "inarisk", "penduduk", "rs"]) await expect(tombolLapisan(page, id), id).toHaveAttribute("aria-pressed", "false");
  // ikon buatan sendiri sudah terdaftar di peta
  const ikon = await page.evaluate(() => {
    const m = (window as unknown as { __dops: PetaUji }).__dops;
    return ["rs", "gigi", "gunung-3", "sungai-2", "bencana-banjir", "laporan-banjir"].filter((i) => !m.hasImage(i));
  });
  expect(ikon).toEqual([]);
  // partikel angin benar-benar tergambar
  await expect.poll(() => pikselEfek(page), { timeout: 60_000 }).toBeGreaterThan(150);
});

test("angin dan hujan tidak hilang waktu peta digeser atau di-zoom", async ({ page }) => {
  await bukaKonsol(page);
  const hujan = tombolLapisan(page, "hujan");
  await hujan.scrollIntoViewIfNeeded();
  await hujan.click();
  await expect.poll(() => pikselEfek(page), { timeout: 60_000 }).toBeGreaterThan(150);

  // di tengah gerakan (peta masih bergerak) kanvas efek tetap berisi: dihitung dari dalam halaman pada event "move"
  const selagiGerak = await page.evaluate(
    () =>
      new Promise<number[]>((selesai) => {
        const m = (window as unknown as { __dops: PetaUji & { on(e: string, f: () => void): void; off(e: string, f: () => void): void } }).__dops;
        const k = document.querySelector<HTMLCanvasElement>('canvas[data-testid="kanvas-efek"]')!;
        const hasil: number[] = [];
        let ke = 0;
        const hitung = () => {
          // event "move" pertama datang sebelum kanvas efek sempat menggambar posisi baru; mulai dari yang kedua,
          // isi kanvas adalah gambar frame sebelumnya, yaitu frame yang dibuat selagi peta bergerak
          if (++ke < 2 || hasil.length >= 6) return;
          const d = k.getContext("2d")!.getImageData(0, 0, k.width, k.height).data;
          let n = 0;
          for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++;
          hasil.push(n);
        };
        m.on("move", hitung);
        m.on("moveend", function akhir() {
          m.off("move", hitung);
          m.off("moveend", akhir);
          setTimeout(() => selesai(hasil), 200);
        });
        m.easeTo({ center: [112, -5], zoom: 5, duration: 2500, essential: true } as never);
      }),
  );
  expect(selagiGerak.length).toBeGreaterThan(0);
  expect(Math.min(...selagiGerak)).toBeGreaterThan(80);
  expect(await pikselEfek(page)).toBeGreaterThan(80);

  if (!sempit(page)) {
    // seret dengan mouse: periksa selagi tombol masih ditekan
    const kotak = (await page.locator("canvas.maplibregl-canvas").boundingBox())!;
    const cx = kotak.x + kotak.width * 0.6;
    const cy = kotak.y + kotak.height * 0.45;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 140, cy + 60, { steps: 10 });
    expect(await pikselEfek(page)).toBeGreaterThan(80);
    await page.mouse.up();
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(250);
    expect(await pikselEfek(page)).toBeGreaterThan(80);
  }
  await tungguDiam(page);
  // layer medan hujan tetap pekat setelah semua gerakan itu
  expect(await page.evaluate(() => (window as unknown as { __dops: PetaUji }).__dops.getPaintProperty("medan-atas", "raster-opacity"))).toBeGreaterThan(0.5);
});

test("kembali ke Indonesia tidak menyalakan atau mematikan lapisan apa pun", async ({ page }) => {
  await bukaKonsol(page);
  // ubah dari keadaan awal: matikan gunung, nyalakan rumah sakit dan kualitas udara
  for (const id of ["gunung", "rs", "udara"]) {
    const t = tombolLapisan(page, id);
    await t.scrollIntoViewIfNeeded();
    await t.click();
  }
  await expect(tombolLapisan(page, "gunung")).toHaveAttribute("aria-pressed", "false");
  await expect(tombolLapisan(page, "rs")).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => (window as unknown as { __dops: PetaUji }).__dops.jumpTo({ center: [106.8, -6.2], zoom: 8.5 }));
  await page.waitForTimeout(600);
  const semuaId = ["hotspot", "gempa", "gunung", "bencana", "laporan", "peringatan", "angin", "hujan", "suhu", "udara", "citra", "fwi", "asap", "banjir", "sungai", "sesar", "inarisk", "penduduk", "rs"];
  const tombol = async () => Promise.all(semuaId.map(async (id) => `${id}:${await tombolLapisan(page, id).getAttribute("aria-pressed")}`));
  const sebelumTombol = await tombol();
  const sebelumLayer = await keadaanLayer(page);

  await tekanAlat(page, "Kembali ke Indonesia");
  await page.waitForTimeout(300);
  await tungguDiam(page);
  await page.waitForTimeout(600);

  expect(await tombol()).toEqual(sebelumTombol);
  expect(await keadaanLayer(page)).toEqual(sebelumLayer);
  const zoom = await page.evaluate(() => (window as unknown as { __dops: { getZoom(): number } }).__dops.getZoom());
  expect(zoom).toBeLessThan(6);
  await expect.poll(() => pikselEfek(page), { timeout: 60_000 }).toBeGreaterThan(80);
});

test("klik garis megathrust: garisnya yang menyala, bukan lingkaran", async ({ page }) => {
  // tes ini memeriksa animasi garis, jadi "kurangi gerakan" dimatikan
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await bukaKonsol(page);
  // cari titik di garis megathrust yang tidak tertutup objek lain, di bagian layar yang bebas panel
  await page.evaluate(() => (window as unknown as { __dops: PetaUji }).__dops.jumpTo({ center: [101, -6.2], zoom: 6 }));
  // beri peta waktu menggambar tampilan baru, supaya tidak ada objek yang baru muncul di antara "cari titik" dan "klik"
  await page.waitForFunction(() => !(window as unknown as { __dops: PetaUji }).__dops.isMoving());
  await page.waitForTimeout(2500);
  const titik = await page.evaluate(async () => {
    const m = (window as unknown as { __dops: PetaUji }).__dops;
    const g = (await (await fetch("/data/sesar.geojson")).json()) as { features: { properties: { jenis: string }; geometry: { coordinates: [number, number][] } }[] };
    const lain = ["gempa-titik", "gunung-ikon", "bencana-ikon", "hotspot-titik", "historis-titik", "peringatan-isi"].filter((l) => m.getLayer(l));
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let coba = 0; coba < 40; coba++) {
      await new Promise((r) => setTimeout(r, 150));
      for (const f of g.features) {
        if (f.properties.jenis !== "megathrust") continue;
        for (const c of f.geometry.coordinates) {
          const p = m.project(c);
          if (p.x < w * 0.42 || p.x > w * 0.8 || p.y < h * 0.3 || p.y > h * 0.58) continue;
          if (m.queryRenderedFeatures([[p.x - 14, p.y - 14], [p.x + 14, p.y + 14]], { layers: lain }).length > 0) continue;
          if (m.queryRenderedFeatures([[p.x - 3, p.y - 3], [p.x + 3, p.y + 3]], { layers: ["sesar-kena"] }).length === 0) continue;
          return [p.x, p.y];
        }
      }
    }
    return null;
  });
  expect(titik).not.toBeNull();
  const kotak = (await page.locator("canvas.maplibregl-canvas").boundingBox())!;
  await page.mouse.click(kotak.x + titik![0], kotak.y + titik![1]);

  await expect(page.getByTestId("panel-detail")).toContainText(/megathrust/i);
  const filter = await page.evaluate(() => JSON.stringify((window as unknown as { __dops: PetaUji }).__dops.getFilter("sesar-sorot")));
  expect(filter).toMatch(/^\["==",\["id"\],\d+\]$/);
  // garis sorotnya ikut dianimasikan (dasharray berubah dari waktu ke waktu)
  const dash = () => page.evaluate(() => JSON.stringify((window as unknown as { __dops: PetaUji }).__dops.getPaintProperty("sesar-sorot-arus", "line-dasharray")));
  const awal = await dash();
  await expect.poll(dash, { timeout: 30_000 }).not.toBe(awal);

  await page.getByTestId("panel-detail").getByRole("button", { name: /Tutup|Close/ }).click();
  await expect(page.getByTestId("panel-detail")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify((window as unknown as { __dops: PetaUji }).__dops.getFilter("sesar-sorot")))).toBe('["==",["id"],-1]');
});

test("peta bahaya InaRISK: memudar masuk setelah gambarnya siap, ganti jenis, memudar keluar", async ({ page }) => {
  const gagal: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/data/inarisk/") && r.status() >= 400) gagal.push(`${r.status()} ${r.url()}`);
  });
  await bukaKonsol(page);
  const opasitas = () => page.evaluate(() => (window as unknown as { __dops: PetaUji }).__dops.getPaintProperty("inarisk-raster", "raster-opacity"));
  expect(await opasitas()).toBe(0);
  const t = tombolLapisan(page, "inarisk");
  await t.scrollIntoViewIfNeeded();
  await t.click();
  const pilih = page.getByTestId("pilih-inarisk");
  await expect(pilih.getByRole("button", { name: "Gempa" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("legenda-inarisk")).toHaveAttribute("data-muat", "0", { timeout: 60_000 });
  expect(await opasitas()).toBeGreaterThan(0.5);
  await expect(page.getByTestId("legenda-inarisk")).toContainText("Rendah");
  await expect(page.getByTestId("legenda-inarisk")).toContainText("Tinggi");

  await pilih.getByRole("button", { name: "Banjir" }).scrollIntoViewIfNeeded();
  await pilih.getByRole("button", { name: "Banjir" }).click();
  await expect(pilih.getByRole("button", { name: "Banjir" })).toHaveAttribute("aria-pressed", "true");
  await expect(pilih.getByRole("button", { name: "Gempa" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("legenda-inarisk")).toHaveAttribute("data-muat", "0", { timeout: 60_000 });
  await expect.poll(opasitas, { timeout: 30_000 }).toBeGreaterThan(0.5);
  expect(await tombolTerpotong(page, "[data-testid=lini-masa] > div > div:last-child button")).toEqual([]);
  expect(await melebar(page)).toBeLessThanOrEqual(0);

  await tombolLapisan(page, "inarisk").click();
  await expect(page.getByTestId("pilih-inarisk")).toHaveCount(0);
  expect(await opasitas()).toBe(0);
  expect(gagal).toEqual([]);
});

test("tooltip muncul di atas objek dan hilang waktu peta digeser", async ({ page }) => {
  test.skip(sempit(page), "tooltip hanya untuk kursor");
  await bukaKonsol(page);
  await page.evaluate(() => (window as unknown as { __dops: PetaUji }).__dops.jumpTo({ center: [111.5, -7.6], zoom: 7 }));
  await page.waitForTimeout(800);
  const p = await page.evaluate(() => {
    const q = (window as unknown as { __dops: PetaUji }).__dops.project([110.446, -7.54]);
    return [q.x, q.y];
  });
  const kotak = (await page.locator("canvas.maplibregl-canvas").boundingBox())!;
  const tip = page.getByTestId("tooltip-peta");
  await expect(tip).toBeHidden();
  await page.mouse.move(kotak.x + p[0] + 30, kotak.y + p[1] - 40);
  await page.mouse.move(kotak.x + p[0], kotak.y + p[1] - 6, { steps: 4 });
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText("Merapi · Level III Siaga");
  await page.evaluate(() => (window as unknown as { __dops: PetaUji }).__dops.easeTo({ center: [112, -7.6], duration: 300 }));
  await expect(tip).toBeHidden();
});
