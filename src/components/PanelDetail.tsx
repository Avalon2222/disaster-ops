"use client";

import { useEffect, useState } from "react";
import { Activity, ExternalLink, Waves } from "lucide-react";
import Panel, { Baris, Catatan } from "./Panel";
import { terjemah, type Kunci, type Lang } from "@/lib/i18n";
import type { SnapshotCuaca } from "@/lib/jenis";
import { formatKoordinat, mataAngin } from "@/lib/geo";
import { NAMA_TINGKAT, WARNA_TINGKAT } from "@/lib/model/banjir";
import { formatOrang, pendudukDalamRadius, rsDalamRadius } from "@/lib/model/eksposur";
import { kelasFwi } from "@/lib/model/fwi";
import { sampel } from "@/lib/model/grid";
import type { Pilihan } from "@/lib/peta/fitur";
import { WARNA_LEVEL_GUNUNG } from "@/lib/peta/warna";
import { muatPenduduk, muatRs } from "@/lib/statis";
import { NAMA_LEVEL } from "@/lib/sumber/magma";
import { formatHariWib, formatWib, umur } from "@/lib/waktu";

interface Props {
  lang: Lang;
  pilihan: Pilihan;
  cuaca: SnapshotCuaca | null;
  sekarang: number;
  onTutup: () => void;
  /** buka alat skenario guncangan / tsunami dengan titik dan magnitudo ini */
  onSkenario: (alat: "gempa" | "tsunami", lon: number, lat: number, mag?: number, dalam?: number) => void;
}

const KELAS_FWI: Kunci[] = ["fwi_low", "fwi_moderate", "fwi_high", "fwi_extreme"];
const YAKIN: Kunci[] = ["conf_low", "conf_nominal", "conf_high"];
const SATELIT: Record<string, string> = { N20: "NOAA-20 VIIRS", N21: "NOAA-21 VIIRS", MODIS: "Terra/Aqua MODIS" };

function Tautan({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="sentuh mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-info hover:underline">
      <ExternalLink size={12} /> {children}
    </a>
  );
}

/** Ringkasan sekitar sebuah titik: penduduk dan rumah sakit terdekat (dimuat saat panel dibuka). */
function Sekitar({ lang, lon, lat, radiusKm }: { lang: Lang; lon: number; lat: number; radiusKm: number }) {
  const [isi, setIsi] = useState<{ penduduk: number; rs: number; rsDekat: string | null; untuk: string } | null>(null);
  const kunci = `${lon},${lat},${radiusKm}`;
  useEffect(() => {
    let hidup = true;
    Promise.all([muatPenduduk(), muatRs()])
      .then(([g, rs]) => {
        if (!hidup) return;
        const dekat = rsDalamRadius(rs, lon, lat, Math.max(radiusKm, 50));
        setIsi({ penduduk: pendudukDalamRadius(g, lon, lat, radiusKm), rs: dekat.filter((r) => r.jarakKm <= radiusKm).length, rsDekat: dekat[0] ? `${dekat[0].nama || "RS"} (${dekat[0].jarakKm.toFixed(0)} km)` : null, untuk: kunci });
      })
      .catch(() => undefined);
    return () => {
      hidup = false;
    };
  }, [lon, lat, radiusKm, kunci]);
  const siap = isi?.untuk === kunci ? isi : null;
  return (
    <>
      <Baris label={terjemah(lang, "pop_within").replace("{n}", String(radiusKm))}>{siap ? formatOrang(siap.penduduk, lang) : "…"}</Baris>
      <Baris label={terjemah(lang, "hosp_within").replace("{n}", String(radiusKm))}>{siap ? siap.rs : "…"}</Baris>
      <Baris label={terjemah(lang, "hosp_nearest")}>{siap ? (siap.rsDekat ?? "-") : "…"}</Baris>
    </>
  );
}

/** Prakiraan di satu titik, dibaca dari snapshot. */
function PrakiraanTitik({ lang, lon, lat, cuaca, sekarang }: { lang: Lang; lon: number; lat: number; cuaca: SnapshotCuaca; sekarang: number }) {
  const t = (k: Kunci) => terjemah(lang, k);
  const m = cuaca.medan;
  const i = Math.min(m.u10.length - 1, Math.max(0, Math.round((sekarang - m.mulai) / (m.langkahJam * 3600_000))));
  const u = sampel(m.grid, m.u10[i], lon, lat) / 10;
  const v = sampel(m.grid, m.v10[i], lon, lat) / 10;
  const suhu = sampel(m.grid, m.suhu[i], lon, lat) / 10;
  const pm = sampel(m.grid, m.pm25[i], lon, lat);
  let hujan24 = 0;
  for (let k = i; k < Math.min(m.hujan.length, i + 8); k++) hujan24 += Math.max(0, sampel(m.grid, m.hujan[k], lon, lat)) / 10;
  if (Number.isNaN(u)) return <Catatan>{t("point_outside")}</Catatan>;
  const h = cuaca.harian;
  const fwi = h.fwi.map((hari) => sampel(h.grid, hari, lon, lat, -1) / 10);
  const adaFwi = fwi.some((f) => Number.isFinite(f));
  const laju = Math.hypot(u, v);
  const dari = (Math.atan2(-u, -v) * 180) / Math.PI;
  return (
    <>
      <Baris label={t("wind")}>
        {(laju * 3.6).toFixed(0)} km/j {t("from")} {mataAngin(dari, lang)}
      </Baris>
      <Baris label={t("temperature")}>{suhu.toFixed(1)} °C</Baris>
      <Baris label={t("rain_24h")}>{hujan24.toFixed(1)} mm</Baris>
      <Baris label="PM2.5">{Number.isFinite(pm) ? `${pm.toFixed(0)} µg/m³` : "-"}</Baris>
      {adaFwi && (
        <div className="mt-2">
          <div className="label-kecil mb-1">{t("fwi_8day")}</div>
          <div className="flex items-end gap-1" role="img" aria-label={t("fwi_8day")}>
            {fwi.map((f, d) => {
              const k = kelasFwi(f);
              return (
                <div key={d} className="flex flex-1 flex-col items-center gap-0.5" title={`${formatHariWib(Date.parse(`${h.hari[d]}T05:00:00Z`), lang)}: FWI ${Number.isFinite(f) ? f.toFixed(1) : "-"} (${t(KELAS_FWI[k])})`}>
                  <div className="w-full" style={{ height: `${Math.max(3, Math.min(40, (Number.isFinite(f) ? f : 0) * 2.2))}px`, background: WARNA_TINGKAT[k] }} />
                  <span className="text-[8.5px] tabular-nums text-dim">{h.hari[d].slice(8)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default function PanelDetail({ lang, pilihan: p, cuaca, sekarang, onTutup, onSkenario }: Props) {
  const t = (k: Kunci) => terjemah(lang, k);
  const koordinat = <Baris label={t("coordinates")}>{formatKoordinat(p.lon, p.lat)}</Baris>;

  if (p.jenis === "hotspot") {
    const d = p.data;
    return (
      <Panel lang={lang} label={t("kind_hotspot")} warna="#ff5d2e" judul={p.provinsi || t("kind_hotspot")} onTutup={onTutup} uji="panel-detail">
        <div className="px-3 py-2">
          <Baris label={t("detected")}>
            {formatWib(d[4] * 60_000, lang)} · {umur(d[4] * 60_000, sekarang, lang)}
          </Baris>
          <Baris label={t("frp")}>{d[2].toFixed(1)} MW</Baris>
          <Baris label={t("confidence")}>{t(YAKIN[d[3]] ?? "conf_nominal")}</Baris>
          <Baris label={t("satellite")}>{SATELIT[p.satelit] ?? p.satelit}</Baris>
          {koordinat}
          <Sekitar lang={lang} lon={p.lon} lat={p.lat} radiusKm={10} />
          {cuaca && (
            <div className="mt-3">
              <div className="label-kecil mb-1">{t("forecast_here")}</div>
              <PrakiraanTitik lang={lang} lon={p.lon} lat={p.lat} cuaca={cuaca} sekarang={sekarang} />
            </div>
          )}
          <Catatan>{t("note_hotspot")}</Catatan>
        </div>
      </Panel>
    );
  }

  if (p.jenis === "gempa") {
    const g = p.data;
    return (
      <Panel
        lang={lang}
        label={`${t("kind_quake")} · ${g.sumber}`}
        warna="#ffc857"
        judul={`M${g.mag.toFixed(1)} · ${g.tempat}`}
        onTutup={onTutup}
        uji="panel-detail"
        kaki={
          <div className="flex flex-wrap gap-2">
            <button className="tombol-hud" onClick={() => onSkenario("gempa", g.lon, g.lat, Math.max(5, g.mag), Math.max(5, g.dalam))}>
              <Activity size={13} /> {t("open_shake")}
            </button>
            <button className="tombol-hud" onClick={() => onSkenario("tsunami", g.lon, g.lat, Math.max(6.5, g.mag), Math.max(5, g.dalam))}>
              <Waves size={13} /> {t("open_tsunami")}
            </button>
          </div>
        }
      >
        <div className="px-3 py-2">
          {g.tsunami && <div className="mb-2 border border-bahaya bg-bahaya/15 px-2 py-1.5 text-[11.5px] font-semibold text-bahaya">{t("tsunami_flag")}</div>}
          <Baris label={t("time")}>
            {formatWib(g.waktu, lang)} · {umur(g.waktu, sekarang, lang)}
          </Baris>
          <Baris label={t("magnitude")}>M {g.mag.toFixed(1)}</Baris>
          <Baris label={t("depth")}>{g.dalam} km</Baris>
          {koordinat}
          {g.dirasakan && <Baris label={t("felt")}>{g.dirasakan}</Baris>}
          {g.potensi && <Baris label={t("bmkg_note")}>{g.potensi}</Baris>}
          {g.mag >= 5 && <Sekitar lang={lang} lon={p.lon} lat={p.lat} radiusKm={50} />}
          {g.shakemap && (
            // eslint-disable-next-line @next/next/no-img-element -- gambar dari BMKG, ukurannya tidak diketahui sebelumnya
            <img src={g.shakemap} alt={t("shakemap_alt")} loading="lazy" className="mt-2 w-full border border-white/10" />
          )}
          {g.url && <Tautan href={g.url}>{t("open_source")}</Tautan>}
        </div>
      </Panel>
    );
  }

  if (p.jenis === "gunung") {
    const g = p.data;
    return (
      <Panel lang={lang} label={t("kind_volcano")} warna={WARNA_LEVEL_GUNUNG[g.level]} judul={g.nama} onTutup={onTutup} uji="panel-detail">
        <div className="px-3 py-2">
          <Baris label={t("alert_level")}>
            <span style={{ color: WARNA_LEVEL_GUNUNG[g.level] }} className="font-semibold">
              {g.level > 0 ? `Level ${["", "I", "II", "III", "IV"][g.level]} · ${NAMA_LEVEL[g.level]}` : t("unknown")}
            </span>
          </Baris>
          <Baris label={t("province")}>{g.provinsi}</Baris>
          <Baris label={t("elevation")}>{g.elevasi.toLocaleString("id-ID")} m</Baris>
          {koordinat}
          <Sekitar lang={lang} lon={p.lon} lat={p.lat} radiusKm={g.level >= 3 ? 10 : 5} />
          {g.url && <Tautan href={g.url}>{t("magma_report")}</Tautan>}
          <Catatan>{t("note_volcano")}</Catatan>
        </div>
      </Panel>
    );
  }

  if (p.jenis === "bencana") {
    const b = p.data;
    return (
      <Panel lang={lang} label={`BNPB · ${b.jenis}`} warna="#c084fc" judul={b.kabupaten} onTutup={onTutup} uji="panel-detail">
        <div className="px-3 py-2">
          <Baris label={t("time")}>{formatHariWib(b.waktu, lang)}</Baris>
          <Baris label={t("incidents")}>{b.kejadian}</Baris>
          <Baris label={t("dead_missing")}>
            {b.meninggal} / {b.hilang}
          </Baris>
          <Baris label={t("injured")}>{b.luka.toLocaleString("id-ID")}</Baris>
          <Baris label={t("displaced")}>{b.mengungsi.toLocaleString("id-ID")}</Baris>
          <Baris label={t("houses")}>
            {b.rumahRusak.toLocaleString("id-ID")} / {b.rumahTerendam.toLocaleString("id-ID")}
          </Baris>
          {b.kronologi && <p className="mt-2 text-[11.5px] leading-relaxed text-text/90">{b.kronologi}</p>}
          <Catatan>{t("note_bnpb")}</Catatan>
        </div>
      </Panel>
    );
  }

  if (p.jenis === "laporan") {
    const l = p.data;
    return (
      <Panel lang={lang} label={`PetaBencana.id · ${l.jenis}`} warna="#22d3ee" judul={l.kota || t("kind_report")} onTutup={onTutup} uji="panel-detail">
        <div className="px-3 py-2">
          <Baris label={t("time")}>
            {formatWib(l.waktu, lang)} · {umur(l.waktu, sekarang, lang)}
          </Baris>
          {l.kedalaman != null && <Baris label={t("flood_depth")}>{l.kedalaman} cm</Baris>}
          {koordinat}
          {l.teks && <p className="mt-2 text-[11.5px] leading-relaxed text-text/90">{l.teks}</p>}
          {l.gambar && (
            // eslint-disable-next-line @next/next/no-img-element -- foto kiriman warga dari PetaBencana.id
            <img src={l.gambar} alt={t("report_photo_alt")} loading="lazy" className="mt-2 max-h-[220px] w-full border border-white/10 object-cover" />
          )}
          <Catatan>{t("note_report")}</Catatan>
        </div>
      </Panel>
    );
  }

  if (p.jenis === "peringatan") {
    const w = p.data;
    return (
      <Panel lang={lang} label={`BMKG · ${w.kejadian}`} warna="#fbbf24" judul={w.judul || w.wilayah} onTutup={onTutup} uji="panel-detail">
        <div className="px-3 py-2">
          <Baris label={t("valid")}>
            {formatWib(w.mulai, lang)} – {formatWib(w.berakhir, lang, false)}
          </Baris>
          <Baris label={t("province")}>{w.wilayah}</Baris>
          <p className="mt-2 text-[11.5px] leading-relaxed text-text/90">{w.deskripsi}</p>
          {w.infografis && <Tautan href={w.infografis}>{t("open_infographic")}</Tautan>}
        </div>
      </Panel>
    );
  }

  if (p.jenis === "sungai") {
    const s = p.data;
    const maks = Math.max(s.p99 * 1.1, ...s.debit);
    return (
      <Panel lang={lang} label={`${t("kind_river")} · GloFAS`} warna="#2dd4bf" judul={`${s.nama} · ${s.lokasi}`} onTutup={onTutup} uji="panel-detail">
        <div className="px-3 py-2">
          <Baris label={t("status")}>
            <span style={{ color: WARNA_TINGKAT[p.status.tingkat] }} className="font-semibold">
              {NAMA_TINGKAT[p.status.tingkat][lang]}
            </span>
          </Baris>
          <Baris label={t("peak_7d")}>
            {Math.round(p.status.puncak).toLocaleString("id-ID")} m³/s · H+{p.status.hariPuncak}
          </Baris>
          <Baris label={t("clim_p50_p90_p99")}>
            {Math.round(s.p50)} / {Math.round(s.p90)} / {Math.round(s.p99)}
          </Baris>
          <div className="relative mt-3 flex h-[70px] items-end gap-1" role="img" aria-label={t("discharge_chart")}>
            {[s.p90, s.p99].map((ambang, i) => (
              <div key={i} className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${(ambang / maks) * 100}%`, borderColor: i === 0 ? "#fde047" : "#fb923c" }} />
            ))}
            {s.debit.map((q, d) => (
              <div key={d} className="relative flex-1" style={{ height: `${Math.max(3, (q / maks) * 100)}%`, background: q >= s.p99 ? "#fb923c" : q >= s.p90 ? "#fde047" : "#2dd4bf" }} title={`H+${d}: ${Math.round(q)} m³/s`} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-dim">
            <span>{t("today")}</span>
            <span>H+{s.debit.length - 1}</span>
          </div>
          <Catatan>{t("note_river")}</Catatan>
        </div>
      </Panel>
    );
  }

  if (p.jenis === "historis") {
    const h = p.data;
    return (
      <Panel
        lang={lang}
        label={t("kind_historic")}
        warna="#f43f5e"
        judul={`M${h[3].toFixed(1)} · ${h[4]}`}
        onTutup={onTutup}
        uji="panel-detail"
        kaki={
          <div className="flex flex-wrap gap-2">
            <button className="tombol-hud" onClick={() => onSkenario("gempa", h[0], h[1], h[3], Math.max(5, h[2]))}>
              <Activity size={13} /> {t("replay_shake")}
            </button>
            <button className="tombol-hud" onClick={() => onSkenario("tsunami", h[0], h[1], h[3], Math.max(5, h[2]))}>
              <Waves size={13} /> {t("open_tsunami")}
            </button>
          </div>
        }
      >
        <div className="px-3 py-2">
          <Baris label={t("place")}>{h[5] || "-"}</Baris>
          <Baris label={t("year")}>{h[4]}</Baris>
          <Baris label={t("depth")}>{h[2]} km</Baris>
          {koordinat}
          <Catatan>{t("note_historic")}</Catatan>
        </div>
      </Panel>
    );
  }

  if (p.jenis === "sesar") {
    return (
      <Panel
        lang={lang}
        label={p.megathrust ? t("kind_megathrust") : t("kind_fault")}
        warna="#f43f5e"
        judul={p.nama || (p.megathrust ? t("kind_megathrust") : t("kind_fault"))}
        onTutup={onTutup}
        uji="panel-detail"
        kaki={
          <button className="tombol-hud" onClick={() => onSkenario(p.megathrust ? "tsunami" : "gempa", p.lon, p.lat, p.megathrust ? 8.5 : 7, p.megathrust ? 20 : 10)}>
            {p.megathrust ? <Waves size={13} /> : <Activity size={13} />} {t(p.megathrust ? "what_if_m85" : "what_if_m7")}
          </button>
        }
      >
        <div className="px-3 py-2">
          {p.gerak && <Baris label={t("slip_type")}>{p.gerak}</Baris>}
          {p.laju != null && <Baris label={t("slip_rate")}>{p.laju} mm/{t("year_unit")}</Baris>}
          {koordinat}
          <Catatan>{t("note_fault")}</Catatan>
        </div>
      </Panel>
    );
  }

  if (p.jenis === "rs") {
    return (
      <Panel lang={lang} label={t("kind_hospital")} warna="#34d399" judul={p.nama || t("kind_hospital")} onTutup={onTutup} uji="panel-detail">
        <div className="px-3 py-2">
          {koordinat}
          <Sekitar lang={lang} lon={p.lon} lat={p.lat} radiusKm={10} />
          <Catatan>{t("note_hospital")}</Catatan>
        </div>
      </Panel>
    );
  }

  // titik bebas di peta
  return (
    <Panel
      lang={lang}
      label={t("kind_point")}
      warna="#7dd3fc"
      judul={formatKoordinat(p.lon, p.lat)}
      onTutup={onTutup}
      uji="panel-detail"
      kaki={
        <div className="flex flex-wrap gap-2">
          <button className="tombol-hud" onClick={() => onSkenario("gempa", p.lon, p.lat)}>
            <Activity size={13} /> {t("what_if_m7")}
          </button>
          <button className="tombol-hud" onClick={() => onSkenario("tsunami", p.lon, p.lat)}>
            <Waves size={13} /> {t("open_tsunami")}
          </button>
        </div>
      }
    >
      <div className="px-3 py-2">
        {cuaca ? <PrakiraanTitik lang={lang} lon={p.lon} lat={p.lat} cuaca={cuaca} sekarang={sekarang} /> : <Catatan>{t("forecast_missing")}</Catatan>}
        <div className="mt-2">
          <Sekitar lang={lang} lon={p.lon} lat={p.lat} radiusKm={10} />
        </div>
      </div>
    </Panel>
  );
}
