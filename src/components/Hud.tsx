"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Search, HelpCircle, Maximize2, Minimize2, Share2, Globe2, Map as MapIcon, Satellite, Languages, LocateFixed, Siren, Activity, Waves, History, MoreVertical } from "lucide-react";
import Logo from "./Logo";
import { terjemah, type Kunci, type Lang } from "@/lib/i18n";
import { NAMA_TINGKAT, type TingkatRisiko } from "@/lib/model/banjir";

export type Alat = "warroom" | "gempa" | "tsunami" | "replay";

interface Props {
  lang: Lang;
  online: boolean;
  tingkat: TingkatRisiko | null;
  hitung: { hotspot: number | null; gempa: number | null; gunung: number | null; peringatan: number | null };
  sat: boolean;
  datar: boolean;
  alat: Alat | null;
  onToggleSat: () => void;
  onToggleDatar: () => void;
  onToggleLang: () => void;
  onCari: () => void;
  onBantuan: () => void;
  onBagikan: () => void;
  onFullscreen: () => void;
  onReset: () => void;
  onAlat: (a: Alat) => void;
}

interface Tombol {
  kunci: string;
  Ikon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  judul: string;
  aksi: () => void;
  aktif?: boolean;
  /** tampil langsung di header HP (sisanya masuk menu titik tiga) */
  hp?: boolean;
  nilai?: string;
}

function dua(n: number) {
  return n.toString().padStart(2, "0");
}

export function Jam({ lang }: { lang: Lang }) {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!t) return <div className="h-7 w-[150px]" />;
  const wib = new Date(t.getTime() + 7 * 3600_000);
  return (
    <div className="flex items-baseline gap-3">
      <div className="text-[22px] leading-none tracking-[0.12em] text-gold tabular-nums">
        {dua(wib.getUTCHours())}:{dua(wib.getUTCMinutes())}:{dua(wib.getUTCSeconds())}
        <span className="ml-1 text-[11px] text-muted">{terjemah(lang, "wib")}</span>
      </div>
      <div className="hidden text-[11px] text-muted tabular-nums 2xl:block">
        {dua(t.getUTCHours())}:{dua(t.getUTCMinutes())} UTC
      </div>
    </div>
  );
}

function Angka({ label, nilai, warna }: { label: string; nilai: number | null; warna?: string }) {
  return (
    <div>
      <div className="label-kecil whitespace-nowrap">{label}</div>
      <div className="text-[13px] tabular-nums" style={{ color: warna ?? "var(--text)" }}>
        {nilai == null ? "–" : nilai.toLocaleString("en-US")}
      </div>
    </div>
  );
}

export default function Hud(p: Props) {
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const h = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // menu titik tiga di HP: tutup kalau ketuk di luar atau tekan Esc
  const [menu, setMenu] = useState(false);
  const wadahMenu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const luar = (e: PointerEvent) => {
      if (!wadahMenu.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", luar);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", luar);
      window.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const t = (k: Kunci) => terjemah(p.lang, k);
  const tombol: Tombol[] = [
    { kunci: "reset", Ikon: LocateFixed, label: t("reset_view"), judul: `${t("reset_view")} (R)`, aksi: p.onReset },
    { kunci: "cari", Ikon: Search, label: t("search"), judul: `${t("search")} (Ctrl+K)`, aksi: p.onCari, hp: true },
    { kunci: "warroom", Ikon: Siren, label: t("warroom"), judul: `${t("warroom")} (W)`, aksi: () => p.onAlat("warroom"), aktif: p.alat === "warroom", hp: true },
    { kunci: "gempa", Ikon: Activity, label: t("tool_quake"), judul: `${t("tool_quake")} (M)`, aksi: () => p.onAlat("gempa"), aktif: p.alat === "gempa" },
    { kunci: "tsunami", Ikon: Waves, label: t("tool_tsunami"), judul: `${t("tool_tsunami")} (T)`, aksi: () => p.onAlat("tsunami"), aktif: p.alat === "tsunami" },
    { kunci: "replay", Ikon: History, label: t("tool_replay"), judul: `${t("tool_replay")} (P)`, aksi: () => p.onAlat("replay"), aktif: p.alat === "replay" },
    { kunci: "share", Ikon: Share2, label: t("share"), judul: t("share"), aksi: p.onBagikan },
    { kunci: "fs", Ikon: fs ? Minimize2 : Maximize2, label: t("fullscreen"), judul: `${t("fullscreen")} (F)`, aksi: p.onFullscreen },
    { kunci: "bantuan", Ikon: HelpCircle, label: t("help"), judul: `${t("help")} (?)`, aksi: p.onBantuan },
  ];
  const tombolHp = tombol.filter((a) => a.hp);
  const itemMenu: Tombol[] = [
    { kunci: "proyeksi", Ikon: Globe2, label: t("menu_projection"), judul: "D", aksi: p.onToggleDatar, nilai: p.datar ? t("flat_mode") : t("globe_mode") },
    { kunci: "peta", Ikon: p.sat ? Satellite : MapIcon, label: t("menu_basemap"), judul: "S", aksi: p.onToggleSat, nilai: p.sat ? t("sat_mode") : t("map_mode") },
    { kunci: "bahasa", Ikon: Languages, label: t("menu_lang"), judul: "L", aksi: p.onToggleLang, nilai: t("lang_toggle") },
  ];
  const tingkat = p.tingkat;
  const kelasDenyut = !p.online ? "!bg-warn" : tingkat === 3 ? "awas" : tingkat === 2 ? "siaga" : "";

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2 sm:p-3">
      {/* kiri: identitas + status nasional */}
      <div className="glass braket pointer-events-auto flex min-w-0 items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3">
        <Logo size={30} className="shrink-0 text-accent" />
        <div className="min-w-0 leading-tight">
          <div className="whitespace-nowrap text-[11px] font-semibold tracking-[0.18em] text-text sm:text-[13px] sm:tracking-[0.3em]">DISASTER OPS</div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted">
            <span className={`denyut ${kelasDenyut}`} />
            {tingkat == null ? (
              <span>{p.online ? t("online") : t("offline")}</span>
            ) : (
              <button className={`tingkat-${tingkat} uppercase tracking-[0.18em] hover:underline`} onClick={() => p.onAlat("warroom")} title={t("status_hint")} data-testid="status-nasional">
                {t("status")} {NAMA_TINGKAT[tingkat][p.lang]}
              </button>
            )}
            <span className="hidden whitespace-nowrap text-dim 2xl:inline">· ID-DISASTER-OPS v1</span>
          </div>
        </div>
      </div>

      {/* tengah: jam + hitungan (desktop) */}
      <div className="glass pointer-events-auto hidden items-center gap-5 px-4 py-2 xl:flex" data-testid="hitungan">
        <Jam lang={p.lang} />
        <div className="h-7 w-px bg-white/10" />
        <div className="flex gap-4 text-[11px] uppercase tracking-[0.15em]">
          <Angka label={t("count_hotspot")} nilai={p.hitung.hotspot} warna="#ff8c28" />
          <Angka label={t("count_quake")} nilai={p.hitung.gempa} warna="#ffc857" />
          <Angka label={t("count_volcano")} nilai={p.hitung.gunung} warna="#fb923c" />
          <Angka label={t("count_warning")} nilai={p.hitung.peringatan} warna="#fbbf24" />
        </div>
      </div>

      {/* kanan: alat (desktop & tablet) */}
      <div className="pointer-events-auto hidden flex-col items-end gap-2 sm:flex">
        <div className="glass flex items-center gap-1 p-1">
          <button className={`tombol-hud ${!p.datar ? "aktif" : ""}`} onClick={p.onToggleDatar} title="D" aria-label={`${t("menu_projection")}: ${t("globe_mode")}`} aria-pressed={!p.datar}>
            <Globe2 size={13} /> <span className="hidden lg:inline">{t("globe_mode")}</span>
          </button>
          <button className={`tombol-hud ${p.datar ? "aktif" : ""}`} onClick={p.onToggleDatar} title="D" aria-label={`${t("menu_projection")}: ${t("flat_mode")}`} aria-pressed={p.datar}>
            {t("flat_mode")}
          </button>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button className={`tombol-hud ${!p.sat ? "aktif" : ""}`} onClick={p.onToggleSat} title="S" aria-label={`${t("menu_basemap")}: ${t("map_mode")}`} aria-pressed={!p.sat}>
            <MapIcon size={13} /> <span className="hidden lg:inline">{t("map_mode")}</span>
          </button>
          <button className={`tombol-hud ${p.sat ? "aktif" : ""}`} onClick={p.onToggleSat} title="S" aria-label={`${t("menu_basemap")}: ${t("sat_mode")}`} aria-pressed={p.sat}>
            <Satellite size={13} /> <span className="hidden lg:inline">{t("sat_mode")}</span>
          </button>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button className="tombol-hud" onClick={p.onToggleLang} title="L" aria-label={t("menu_lang")}>
            <Languages size={13} /> {t("lang_toggle")}
          </button>
        </div>
        <div className="glass flex items-center gap-1 p-1" data-testid="alat-header">
          {tombol.map((a) => (
            <button key={a.kunci} className={`tombol-ikon ${a.aktif ? "aktif" : ""}`} onClick={a.aksi} title={a.judul} aria-label={a.label} aria-pressed={a.aktif}>
              <a.Ikon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* kanan: alat (HP) - tombol utama + menu titik tiga supaya tidak keluar layar */}
      <div className="pointer-events-auto relative sm:hidden" ref={wadahMenu}>
        <div className="glass flex items-center gap-1 p-1">
          {tombolHp.map((a) => (
            <button key={a.kunci} className={`tombol-ikon ${a.aktif ? "aktif" : ""}`} onClick={a.aksi} title={a.judul} aria-label={a.label}>
              <a.Ikon size={16} />
            </button>
          ))}
          <button className={`tombol-ikon ${menu ? "aktif" : ""}`} onClick={() => setMenu((m) => !m)} title={t("menu_more")} aria-label={t("menu_more")} aria-haspopup="menu" aria-expanded={menu} data-testid="menu-header">
            <MoreVertical size={16} />
          </button>
        </div>
        {menu && (
          <div role="menu" className="glass-padat braket muncul gulir absolute right-0 top-[calc(100%+6px)] z-40 max-h-[70vh] w-[min(280px,calc(100vw-16px))] overflow-y-auto py-1">
            {[...tombol.filter((a) => !a.hp), ...itemMenu].map((a) => (
              <button
                key={a.kunci}
                role="menuitem"
                className={`flex min-h-[44px] w-full items-center gap-3 px-3 text-left text-[12px] tracking-[0.04em] hover:bg-white/[0.06] ${a.aktif ? "text-accent" : "text-text"}`}
                onClick={() => {
                  setMenu(false);
                  a.aksi();
                }}
                title={a.judul}
                aria-label={a.label}
              >
                <a.Ikon size={16} className="shrink-0 text-muted" />
                <span className="flex-1">{a.label}</span>
                {a.nilai && <span className="text-[10px] uppercase tracking-[0.15em] text-gold">{a.nilai}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
