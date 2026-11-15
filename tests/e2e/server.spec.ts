import { expect, test } from "@playwright/test";

test.describe("server", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, "cukup dijalankan sekali");

  test("header keamanan terpasang di halaman, API, dan data", async ({ request }) => {
    for (const jalur of ["/", "/api/inarisk/x?bbox=1", "/data/kota.json"]) {
      const h = (await request.get(jalur)).headers();
      expect(h["content-security-policy"], jalur).toContain("default-src 'self'");
      expect(h["content-security-policy"], jalur).toContain("frame-ancestors 'self'");
      expect(h["x-frame-options"], jalur).toBe("SAMEORIGIN");
      expect(h["x-content-type-options"], jalur).toBe("nosniff");
      expect(h["referrer-policy"], jalur).toBe("strict-origin-when-cross-origin");
    }
  });

  test("proxy InaRISK menolak permintaan yang tidak sah", async ({ request }) => {
    for (const jalur of ["/api/inarisk/gempa", "/api/inarisk/gempa?bbox=a,b,c,d", "/api/inarisk/rahasia?bbox=1,2,3,4", "/api/inarisk/gempa?bbox=1,2,3"]) {
      const res = await request.get(jalur);
      expect(res.status(), jalur).toBe(400);
      expect(await res.json(), jalur).toEqual({ galat: "bad_request" });
    }
  });

  test("galat API cuma berupa kode", async ({ request }) => {
    for (const jalur of ["/api/hotspot", "/api/gempa", "/api/bencana", "/api/peringatan"]) {
      const res = await request.get(jalur);
      if (res.ok()) continue;
      const badan = (await res.json()) as Record<string, unknown>;
      expect(Object.keys(badan), jalur).toEqual(["galat"]);
      expect(String(badan.galat), jalur).toMatch(/^[a-z_]+$/);
    }
  });

  test("/api/gunung selalu menjawab daftar gunung, walau MAGMA mati", async ({ request }) => {
    const res = await request.get("/api/gunung");
    expect(res.status()).toBe(200);
    const d = (await res.json()) as { live: boolean; gunung: { nama: string; level: number }[] };
    expect(d.gunung.length).toBeGreaterThanOrEqual(69);
    expect(d.gunung.every((g) => g.level >= 0 && g.level <= 4)).toBe(true);
    if (!d.live) expect(d.gunung.every((g) => g.level === 0)).toBe(true);
  });

  test("robots.txt, sitemap.xml, dan h1 ada di HTML server", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    const teksRobots = await robots.text();
    expect(teksRobots).toContain("Allow: /");
    expect(teksRobots).toContain("Sitemap: https://disaster-ops.vercel.app/sitemap.xml");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("<loc>https://disaster-ops.vercel.app</loc>");

    // h1 dan viewport harus ada tanpa JavaScript, karena konsolnya sendiri cuma dirender di browser
    const html = await (await request.get("/")).text();
    expect(html).toMatch(/<h1[^>]*>Disaster Ops/);
    const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? "";
    expect(viewport).toContain("width=device-width");
    expect(viewport).not.toContain("maximum-scale");
  });

  test("berkas biner data dikirim utuh", async ({ request }) => {
    for (const [nama, minimal] of [["batimetri.dat", 600_000], ["populasi.dat", 600_000], ["karhutla2019.dat", 400_000]] as const) {
      const res = await request.get(`/data/${nama}`);
      expect(res.status(), nama).toBe(200);
      expect((await res.body()).byteLength, nama).toBeGreaterThan(minimal);
    }
  });
});
