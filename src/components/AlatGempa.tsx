"use client";

import { useEffect, useMemo, useState } from "react";
import type { Map as MapLibre } from "maplibre-gl";
import { Crosshair, Route, Waves } from "lucide-react";
import Panel, { Baris, Catatan } from "./Panel";
import { terjemah, type Kunci, type Lang } from "@/lib/i18n";
import { formatKoordinat, lingkaran, titikTujuan } from "@/lib/geo";
import { eksposurGempa, formatOrang, rsAmanTerdekat, rsDalamRadius, type EksposurMmi, type RsBerjarak } from "@/lib/model/eksposur";
import { cincinMmi, mmi, radiusMmi, radiusPatahanKm, romawi, URAIAN_MMI, WARNA_MMI } from "@/lib/model/guncangan";
import { setData } from "@/lib/peta/pasang";
import { cariRute, type Rute } from "@/lib/rute";
import { PRASET_GEMPA } from "@/lib/skenario";
import { muatPenduduk, muatRs } from "@/lib/statis";
import { durasi } from "@/lib/waktu";

export interface SkenarioGempa {
  lon: number;
  lat: number;
  mag: number;
  dalam: number;
}

interface Props {
  lang: Lang;
  map: MapLibre | null;
  skenario: SkenarioGempa | null;
  onUbah: (s: SkenarioGempa | null) => void;
  onTutup: () => void;
  onTsunami: (s: SkenarioGempa) => void;
}

interface Dampak {
  eksposur: EksposurMmi[];
  rsTerdampak: number;
  rsAman: RsBerjarak[];
  untuk: string;
}

export const MAG_AWAL = 7;
export const DALAM_AWAL = 10;

/** Fitur GeoJSON cincin MMI + label + episenter untuk source `skenario`. */
export function fiturSkenario(s: SkenarioGempa): GeoJSON.Feature[] {
  const fitur: GeoJSON.Feature[] = [];
  // dari luar ke dalam supaya cincin terkuat digambar paling atas
  for (const c of [...cincinMmi(s.mag, s.dalam)].reverse()) {
    const warna = WARNA_MMI[c.mmi] ?? "#7dd3fc";
    fitur.push({ type: "Feature", properties: { warna, mmi: c.mmi }, geometry: { type: "Polygon", coordinates: [lingkaran(s.lon, s.lat, c.radiusKm, 96)] } });
    fitur.push({ type: "Feature", properties: { warna, label: `MMI ${romawi(c.mmi)}` }, geometry: { type: "Point", coordinates: titikTujuan(s.lon, s.lat, 35, c.radiusKm) } });
  }
  fitur.push({ type: "Feature", properties: { warna: "#ffffff", label: `✕ M${s.mag.toFixed(1)}` }, geometry: { type: "Point", coordinates: [s.lon, s.lat] } });
  return fitur;
}

export default function AlatGempa({ lang, map, skenario, onUbah, onTutup, onTsunami }: Props) {
  const t = (k: Kunci) => terjemah(lang, k);
  const [dampak, setDampak] = useState<Dampak | null>(null);
  const [rute, setRute] = useState<{ rute: Rute; ke: string; untuk: string } | null>(null);
  const [mencari, setMencari] = useState(false);
  const kunci = skenario ? `${skenario.lon},${skenario.lat},${skenario.mag},${skenario.dalam}` : "";

  // cincin di peta
  useEffect(() => {
    if (!map) return;
    setData(map, "skenario", skenario ? fiturSkenario(skenario) : []);
    return () => {
      setData(map, "skenario", []);
      setData(map, "rute", []);
    };
  }, [map, skenario]);

  // eksposur penduduk dan rumah sakit (dihitung ulang sedikit tertunda supaya penggeser tetap mulus)
  useEffect(() => {
    if (!skenario) return;
    let hidup = true;
    const id = setTimeout(() => {
      Promise.all([muatPenduduk(), muatRs()])
        .then(([g, rs]) => {
          if (!hidup) return;
          const rLuar = radiusMmi(skenario.mag, skenario.dalam, 4.5);
          const rRusak = radiusMmi(skenario.mag, skenario.dalam, 6.5);
          setDampak({
            eksposur: eksposurGempa(g, skenario.lon, skenario.lat, skenario.mag, skenario.dalam, rLuar),
            rsTerdampak: rRusak > 0 ? rsDalamRadius(rs, skenario.lon, skenario.lat, rRusak).length : 0,
            rsAman: rRusak > 0 ? rsAmanTerdekat(rs, skenario.lon, skenario.lat, rRusak, skenario) : [],
            untuk: kunci,
          });
        })
        .catch(() => undefined);
    }, 120);
    return () => {
      hidup = false;
      clearTimeout(id);
    };
  }, [skenario, kunci]);

  const dampakKini = dampak?.untuk === kunci ? dampak : null;
  const ruteKini = rute?.untuk === kunci ? rute : null;
  useEffect(() => {
    if (map && !ruteKini) setData(map, "rute", []);
  }, [map, ruteKini]);

  const terpapar = useMemo(() => (dampakKini ? dampakKini.eksposur.filter((e) => e.mmi >= 6).reduce((s, e) => s + e.penduduk, 0) : 0), [dampakKini]);
  const mmiPusat = skenario ? mmi(skenario.mag, 0, skenario.dalam) : 0;

  const cari = async (rs: RsBerjarak) => {
    if (!skenario || !map) return;
    setMencari(true);
    const r = await cariRute([skenario.lon, skenario.lat], [rs.lon, rs.lat]);
    setMencari(false);
    setRute({ rute: r, ke: rs.nama || t("kind_hospital"), untuk: kunci });
    setData(map, "rute", [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: r.garis } }]);
  };

  return (
    <Panel lang={lang} label={t("tool_quake_label")} warna="#ffc857" judul={t("tool_quake")} onTutup={onTutup} uji="alat-gempa">
      <div className="px-3 py-2">
        <p className="text-[11.5px] leading-relaxed text-muted">{t("quake_intro")}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRASET_GEMPA.map((p) => (
            <button key={p.id} className="tombol-hud !h-auto min-h-[26px] !normal-case !tracking-normal py-1" onClick={() => {
                onUbah({ lon: p.lon, lat: p.lat, mag: p.mag, dalam: p.dalam });
                map?.flyTo({ center: [p.lon, p.lat], zoom: 7, pitch: 0, bearing: 0, duration: 1800 });
              }}>
              {p.nama}
            </button>
          ))}
        </div>

        {!skenario ? (
          <div className="mt-3 flex items-center gap-2 border border-dashed border-gold/50 px-3 py-3 text-[12px] text-gold" data-testid="petunjuk-klik">
            <Crosshair size={16} className="shrink-0" /> {t("click_map_epicenter")}
          </div>
        ) : (
          <>
            <div className="mt-3 space-y-2.5">
              <label className="block">
                <span className="flex justify-between text-[11px] text-muted">
                  <span>{t("magnitude")}</span>
                  <span className="text-[13px] font-semibold text-gold tabular-nums">M {skenario.mag.toFixed(1)}</span>
                </span>
                <input type="range" className="slider-waktu mt-1.5 block" min={5} max={9.2} step={0.1} value={skenario.mag} onChange={(e) => onUbah({ ...skenario, mag: Number(e.target.value) })} aria-label={t("magnitude")} />
              </label>
              <label className="block">
                <span className="flex justify-between text-[11px] text-muted">
                  <span>{t("depth")}</span>
                  <span className="text-[13px] font-semibold text-gold tabular-nums">{skenario.dalam} km</span>
                </span>
                <input type="range" className="slider-waktu mt-1.5 block" min={5} max={150} step={5} value={skenario.dalam} onChange={(e) => onUbah({ ...skenario, dalam: Number(e.target.value) })} aria-label={t("depth")} />
              </label>
            </div>

            <div className="mt-3">
              <Baris label={t("epicenter")}>{formatKoordinat(skenario.lon, skenario.lat)}</Baris>
              <Baris label={t("max_intensity")}>
                <span className="font-semibold" style={{ color: WARNA_MMI[Math.max(4, Math.round(mmiPusat))] }}>
                  MMI {romawi(mmiPusat)}
                </span>
              </Baris>
              <Baris label={t("rupture_size")}>~{Math.round(radiusPatahanKm(skenario.mag) * 2)} km</Baris>
              <Baris label={t("exposed_vi")}>{dampakKini ? <span className="font-semibold text-text">{formatOrang(terpapar, lang)}</span> : "…"}</Baris>
              <Baris label={t("hospitals_vii")}>{dampakKini ? dampakKini.rsTerdampak : "…"}</Baris>
            </div>

            {dampakKini && dampakKini.eksposur.length > 0 && (
              <table className="mt-3 w-full text-[11.5px]" data-testid="tabel-eksposur">
                <thead>
                  <tr className="label-kecil text-left">
                    <th className="pb-1 font-normal">MMI</th>
                    <th className="pb-1 font-normal">{t("what_it_feels")}</th>
                    <th className="pb-1 text-right font-normal">{t("people")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dampakKini.eksposur.map((e) => (
                    <tr key={e.mmi} className="border-t border-white/5 align-top">
                      <td className="py-1 pr-2 font-semibold" style={{ color: WARNA_MMI[e.mmi] }}>
                        {romawi(e.mmi)}
                      </td>
                      <td className="py-1 pr-2 text-muted">{URAIAN_MMI[e.mmi]?.[lang] ?? ""}</td>
                      <td className="py-1 text-right tabular-nums text-text">{formatOrang(e.penduduk, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {dampakKini && dampakKini.rsAman.length > 0 && (
              <div className="mt-3">
                <div className="label-kecil mb-1">{t("safe_hospitals")}</div>
                {dampakKini.rsAman.map((r, i) => (
                  <button key={i} className="sentuh flex w-full items-center justify-between gap-2 border-t border-white/5 py-1.5 text-left text-[11.5px] hover:bg-white/[0.04]" onClick={() => void cari(r)} disabled={mencari} title={t("route_to")}>
                    <span className="min-w-0 truncate text-text">
                      <Route size={12} className="mr-1.5 inline text-ok" />
                      {r.nama || t("kind_hospital")}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{r.jarakKm.toFixed(0)} km</span>
                  </button>
                ))}
                {ruteKini && (
                  <p className="mt-1.5 text-[11px] text-ok" data-testid="hasil-rute">
                    {ruteKini.rute.jalan ? t("route_road") : t("route_straight")}: {ruteKini.ke}, {ruteKini.rute.jarakKm.toFixed(0)} km{ruteKini.rute.jalan ? `, ~${durasi(ruteKini.rute.menit, lang)}` : ""}
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button className="tombol-hud" onClick={() => onTsunami(skenario)}>
                <Waves size={13} /> {t("open_tsunami")}
              </button>
              <button className="tombol-hud" onClick={() => onUbah(null)}>
                <Crosshair size={13} /> {t("pick_again")}
              </button>
            </div>
          </>
        )}
        <Catatan>{t("note_quake")}</Catatan>
      </div>
    </Panel>
  );
}
