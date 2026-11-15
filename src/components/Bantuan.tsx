"use client";

import Panel from "./Panel";
import { terjemah, type Kunci, type Lang } from "@/lib/i18n";
import { LAPISAN } from "@/lib/lapisan";
import { URL_REPO } from "@/lib/situs";

const PINTASAN: [string, Kunci][] = [
  ["Ctrl K  /", "help_search"],
  ["W", "help_warroom"],
  ["M", "help_quake"],
  ["T", "help_tsunami"],
  ["P", "help_replay"],
  ["Space", "help_play"],
  ["[  ]", "help_step"],
  ["S", "help_sat"],
  ["D", "help_flat"],
  ["L", "help_lang"],
  ["F", "help_fullscreen"],
  ["R", "help_reset"],
  ["Esc", "help_esc"],
];

const SUMBER: [string, string][] = [
  ["NASA FIRMS", "https://firms.modaps.eosdis.nasa.gov/"],
  ["BMKG InaTEWS", "https://inatews.bmkg.go.id/"],
  ["USGS", "https://earthquake.usgs.gov/"],
  ["MAGMA Indonesia", "https://magma.esdm.go.id/"],
  ["BNPB", "https://gis.bnpb.go.id/"],
  ["PetaBencana.id", "https://petabencana.id/"],
  ["Open-Meteo", "https://open-meteo.com/"],
  ["NASA GIBS", "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api"],
  ["WorldPop", "https://www.worldpop.org/"],
  ["OpenStreetMap", "https://www.openstreetmap.org/copyright"],
];

export default function Bantuan({ lang, onTutup }: { lang: Lang; onTutup: () => void }) {
  const t = (k: Kunci) => terjemah(lang, k);
  return (
    <Panel lang={lang} modal lebar="sm:w-[720px]" label={t("help")} judul={t("help_title")} onTutup={onTutup} uji="bantuan">
      <div className="grid gap-5 px-4 py-3 sm:grid-cols-2">
        <section>
          <h3 className="label-kecil mb-2">{t("shortcuts")}</h3>
          <dl className="space-y-1.5 text-[12px]">
            {PINTASAN.map(([tombol, kunci]) => (
              <div key={kunci} className="flex items-center justify-between gap-3">
                <dt className="text-text/90">{t(kunci)}</dt>
                <dd className="flex shrink-0 gap-1">
                  {tombol.split("  ").map((k) => (
                    <span key={k} className="kbd">
                      {k}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <h3 className="label-kecil mb-2 mt-4">{t("layers")}</h3>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
            {LAPISAN.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <dt className="truncate text-text/90">{l.nama[lang]}</dt>
                <dd className="kbd">{l.tombol}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="text-[12px] leading-relaxed text-text/90">
          <h3 className="label-kecil mb-2">{t("help_honesty")}</h3>
          <ul className="space-y-2">
            {(["honest_1", "honest_2", "honest_3", "honest_4", "honest_5"] as Kunci[]).map((k) => (
              <li key={k} className="flex gap-2">
                <span className="text-accent">▸</span>
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
          <h3 className="label-kecil mb-2 mt-4">{t("sources")}</h3>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            {SUMBER.map(([nama, url]) => (
              <a key={nama} href={url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
                {nama}
              </a>
            ))}
          </p>
          <p className="mt-4 text-[11px] text-muted">
            {t("help_code")}{" "}
            <a href={URL_REPO} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
              github.com/Avalon2222/disaster-ops
            </a>
          </p>
          <p className="mt-3 border border-bahaya/50 bg-bahaya/10 px-2.5 py-2 text-[11.5px] text-text">{t("help_emergency")}</p>
        </section>
      </div>
    </Panel>
  );
}
