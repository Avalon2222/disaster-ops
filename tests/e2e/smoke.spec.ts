import { expect, test } from "@playwright/test";
import { bukaKonsol, melebar, pantauCsp, sempit, tekanAlat, tombolLapisan, tombolTanpaNama, tombolTerpotong } from "./bantu";

test("konsol terbuka, header rapi, tidak ada yang terpotong", async ({ page }) => {
  const csp = pantauCsp(page);
  await bukaKonsol(page);

  const header = page.getByRole("banner");
  await expect(header.getByText("DISASTER OPS")).toBeVisible();
  expect(await tombolTerpotong(page, "header button")).toEqual([]);

  if (sempit(page)) {
    // layar sempit: Search dan War Room tetap di header, sisanya di menu titik tiga
    await expect(header.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(header.getByRole("button", { name: "War Room" })).toBeVisible();
    await page.getByTestId("menu-header").click();
    const daftar = page.getByRole("menu");
    for (const nama of ["Simulasi tsunami", "Skenario guncangan", "Putar ulang karhutla 2019", "Help", "Fullscreen", "Ganti bahasa"]) await expect(daftar.getByRole("menuitem", { name: nama })).toBeVisible();
    expect(await tombolTerpotong(page, "header button")).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(daftar).toHaveCount(0);
  } else {
    await expect(page.getByTestId("menu-header")).toBeHidden();
    for (const nama of ["Search", "War Room", "Skenario guncangan", "Simulasi tsunami", "Putar ulang karhutla 2019", "Help", "Fullscreen"]) await expect(header.getByRole("button", { name: nama, exact: true })).toBeVisible();
    // hitungan live di tengah header
    await expect(page.getByTestId("hitungan")).toContainText("40");
  }

  expect(await melebar(page)).toBeLessThanOrEqual(0);
  expect(await tombolTanpaNama(page)).toEqual([]);
  expect(csp).toEqual([]);
});

test("peta, data statis, dan status nasional termuat tanpa melanggar CSP", async ({ page }) => {
  const csp = pantauCsp(page);
  const gagal: string[] = [];
  page.on("response", (r) => {
    const u = new URL(r.url());
    if ((u.pathname.startsWith("/data/") || u.pathname.startsWith("/maplibre/")) && r.status() >= 400) gagal.push(`${r.status()} ${u.pathname}`);
  });
  await bukaKonsol(page);
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
  // dua gunung Level III di data uji = status nasional SIAGA
  await expect(page.getByTestId("status-nasional")).toHaveText(/Siaga/i);
  // pita berita memuat gempa terbesar
  await expect(page.getByRole("marquee")).toContainText("M5.6");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  expect(gagal).toEqual([]);
  expect(csp).toEqual([]);
});

test("War Room: SITREP jadi dialog modal, briefing bisa diputar dan dihentikan", async ({ page }) => {
  await bukaKonsol(page);
  await tekanAlat(page, "War Room");
  const dialog = page.getByRole("dialog", { name: "War Room" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await expect(page.getByTestId("tingkat-nasional")).toHaveText("SIAGA");
  for (const bagian of ["Karhutla & asap", "Gempa & tsunami", "Gunung api", "Banjir & cuaca"]) await expect(dialog.getByRole("region", { name: bagian })).toBeVisible();
  await expect(dialog).toContainText("40 titik panas dalam 24 jam");
  await expect(dialog).toContainText("Merapi (DI Yogyakarta) berstatus Siaga");
  await expect(dialog).toContainText("Terbesar 24 jam: M5.6");
  await expect(dialog).toContainText("1 peringatan dini cuaca BMKG berlaku: Lampung");
  expect(await melebar(page)).toBeLessThanOrEqual(0);

  await page.getByTestId("mulai-briefing").click();
  const narasi = page.getByTestId("narasi-briefing");
  await expect(narasi).toBeVisible();
  await expect(narasi).toContainText(/Briefing · 1\//);
  await expect(dialog).toHaveCount(0);
  await narasi.getByRole("button", { name: /Berhenti/ }).click();
  await expect(narasi).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("simulasi tsunami: pilih skenario, waktu tiba kota pesisir muncul, rute ke dataran tinggi", async ({ page }) => {
  await bukaKonsol(page);
  await tekanAlat(page, "Simulasi tsunami");
  const panel = page.getByTestId("alat-tsunami");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("petunjuk-klik")).toBeVisible();
  await panel.getByTestId("praset-tsunami").selectOption("siberut");
  const tabel = panel.getByTestId("tabel-tiba");
  await expect(tabel).toBeVisible({ timeout: 20_000 });
  const padang = tabel.getByRole("row", { name: /^Padang / });
  await expect(padang).toBeVisible();
  await expect(padang).toContainText("mnt");
  expect(await tabel.getByRole("row").count()).toBeGreaterThan(8);
  await padang.click();
  await expect(panel.getByTestId("hasil-rute")).toContainText("Padang");
  await expect(panel.getByTestId("hasil-rute")).toContainText("8.4 km");
  expect(await melebar(page)).toBeLessThanOrEqual(0);
  await panel.getByRole("button", { name: "Tutup" }).click();
  await expect(panel).toHaveCount(0);
});

test("skenario guncangan: Sesar Lembang menghasilkan tabel penduduk per MMI", async ({ page }) => {
  await bukaKonsol(page);
  await tekanAlat(page, "Skenario guncangan");
  const panel = page.getByTestId("alat-gempa");
  await expect(panel.getByTestId("petunjuk-klik")).toBeVisible();
  await panel.getByRole("button", { name: /Sesar Lembang/ }).click();
  await expect(panel).toContainText("M 6.8");
  const tabel = panel.getByTestId("tabel-eksposur");
  await expect(tabel).toBeVisible({ timeout: 20_000 });
  await expect(tabel.getByRole("row", { name: /^VII / })).toContainText("juta");
  await expect(panel).toContainText("Penduduk di MMI VI ke atas");
  // menggeser magnitudo mengubah hasil
  const geser = panel.getByRole("slider", { name: "Magnitudo" });
  await geser.focus();
  for (let i = 0; i < 8; i++) await geser.press("ArrowRight");
  await expect(panel).toContainText("M 7.6");
  await expect(tabel.getByRole("row", { name: /^VIII / })).toBeVisible();
  expect(await melebar(page)).toBeLessThanOrEqual(0);
});

test("putar ulang karhutla 2019: tanggal berjalan, bisa dijeda dan digeser", async ({ page }) => {
  await bukaKonsol(page);
  await tekanAlat(page, "Putar ulang karhutla 2019");
  const kotak = page.getByTestId("replay");
  await expect(kotak).toBeVisible();
  const tanggal = kotak.getByTestId("tanggal-replay");
  await expect(tanggal).toHaveText(/2019/);
  await expect(kotak.getByRole("slider")).toBeVisible({ timeout: 20_000 });
  const awal = await tanggal.textContent();
  await expect(tanggal).not.toHaveText(awal ?? "", { timeout: 5000 });
  await kotak.getByRole("button", { name: "Jeda", exact: true }).click();
  await kotak.getByRole("slider").fill("82");
  await expect(tanggal).toHaveText("21 Sep 2019");
  await expect(kotak).toContainText("Muaro Jambi");
  expect(await tombolTerpotong(page, "[data-testid=replay] button")).toEqual([]);
  expect(await melebar(page)).toBeLessThanOrEqual(0);
  await kotak.getByRole("button", { name: "Tutup" }).click();
  await expect(kotak).toHaveCount(0);
});

test("lapisan prakiraan: FWI menyalakan legenda dan lini masa harian, lapisan medan saling menggantikan", async ({ page }) => {
  await bukaKonsol(page);
  const fwi = tombolLapisan(page, "fwi");
  await fwi.scrollIntoViewIfNeeded();
  await fwi.click();
  await expect(fwi).toHaveAttribute("aria-pressed", "true");
  const liniMasa = page.getByTestId("lini-masa");
  await expect(liniMasa.getByTestId("legenda")).toContainText("FWI");
  await expect(liniMasa.getByTestId("waktu-lini-masa")).toContainText("hari ini");
  await liniMasa.getByRole("slider").fill("3");
  await expect(liniMasa.getByTestId("waktu-lini-masa")).toContainText("H+3");

  const hujan = tombolLapisan(page, "hujan");
  await hujan.scrollIntoViewIfNeeded();
  await hujan.click();
  await expect(hujan).toHaveAttribute("aria-pressed", "true");
  await expect(tombolLapisan(page, "fwi")).toHaveAttribute("aria-pressed", "false");
  await expect(liniMasa.getByTestId("waktu-lini-masa")).toContainText("sekarang");
  await expect(liniMasa.getByTestId("legenda")).toContainText("mm/3 jam");
  expect(await tombolTerpotong(page, "[data-testid=lini-masa] button")).toEqual([]);
  expect(await melebar(page)).toBeLessThanOrEqual(0);
});

test("klik peta kosong membuka prakiraan titik, Esc menutup", async ({ page }) => {
  await bukaKonsol(page);
  const ukuran = page.viewportSize()!;
  // tengah layar = laut/daratan Indonesia tengah, jauh dari data uji
  await page.mouse.click(ukuran.width * 0.62, ukuran.height * 0.42);
  const panel = page.getByTestId("panel-detail");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Titik di peta");
  await expect(panel).toContainText(/Angin|di luar cakupan/);
  await expect(panel.getByRole("button", { name: "Kalau M7 di sini?" })).toBeVisible();
  expect(await melebar(page)).toBeLessThanOrEqual(0);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("pencarian: ketik nama kota, Enter menutup palet", async ({ page }) => {
  await bukaKonsol(page);
  await tekanAlat(page, "Search");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox").fill("padang");
  await expect(dialog.getByRole("option").first()).toContainText("Padang");
  await dialog.getByRole("searchbox").fill("merapi");
  await expect(dialog.getByRole("option").first()).toContainText("Merapi");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
});

test("bantuan jadi dialog, fokus pindah ke panel, Esc menutup", async ({ page }) => {
  await bukaKonsol(page);
  await tekanAlat(page, "Help");
  const dialog = page.getByRole("dialog", { name: /Cara pakai/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await expect(dialog).toContainText("Gempa tidak diprediksi");
  await expect(dialog).toContainText("112");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("ganti bahasa: label ikut berubah dan tersimpan di URL", async ({ page }) => {
  await bukaKonsol(page);
  if (sempit(page)) {
    await page.getByTestId("menu-header").click();
    await page.getByRole("menuitem", { name: "Ganti bahasa" }).click();
  } else {
    await page.getByRole("banner").getByRole("button", { name: "Ganti bahasa" }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(tombolLapisan(page, "hotspot")).toContainText("Fire hotspots");
  await expect.poll(() => page.url()).toContain("lang=en");
  await tekanAlat(page, "Tsunami simulation");
  await expect(page.getByTestId("alat-tsunami")).toContainText("How many minutes until the first wave arrives?");
});

test("tautan bersama memulihkan lapisan dan alat", async ({ page }) => {
  await bukaKonsol(page, "/#v=-0.900/100.300/6.00/0/0&l=gempa,sesar&alat=gempa");
  await expect(page.getByTestId("alat-gempa")).toBeVisible();
  await page.getByTestId("alat-gempa").getByRole("button", { name: "Tutup" }).click();
  await expect(tombolLapisan(page, "sesar")).toHaveAttribute("aria-pressed", "true");
  await expect(tombolLapisan(page, "hotspot")).toHaveAttribute("aria-pressed", "false");
});
