import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Tes browser sungguhan terhadap hasil `npm run build`, di empat lebar layar:
 * ponsel 360, 390, 412 px dan desktop 1440 px. Semua API live diganti data tetap (tests/e2e/bantu.ts),
 * jadi hasilnya tidak bergantung pada kejadian hari ini.
 * Di mesin tanpa Chromium bawaan Playwright: E2E_KANAL=msedge npm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // tiap halaman merender peta WebGL lewat SwiftShader (CPU), jadi jangan terlalu banyak sekaligus
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: "chromium",
    channel: process.env.E2E_KANAL || undefined,
    locale: "id-ID",
    // animasi garis megathrust membuat peta digambar ulang terus; di SwiftShader itu mahal, jadi tes berjalan
    // dengan "kurangi gerakan" (tes yang memeriksa animasinya menyalakannya lagi sendiri)
    reducedMotion: "reduce",
    // peta butuh WebGL; di mesin tanpa GPU pakai SwiftShader
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  projects: [
    { name: "ponsel-360", use: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true } },
    { name: "ponsel-390", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: "ponsel-412", use: { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
