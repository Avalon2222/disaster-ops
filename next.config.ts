import type { NextConfig } from "next";
import { headerKeamanan } from "./src/lib/keamanan";

const nextConfig: NextConfig = {
  agentRules: false,
  // route API membaca batas provinsi, gunung api, dan ibu kota kabupaten dari public/data
  outputFileTracingIncludes: {
    "/api/hotspot": ["./public/data/provinsi.geojson"],
    "/api/gunung": ["./public/data/gunung.json"],
    "/api/bencana": ["./public/data/kota.json"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: headerKeamanan(process.env.NODE_ENV !== "production"),
      },
      {
        source: "/maplibre/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
