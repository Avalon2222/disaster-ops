"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { terjemah, type Lang } from "@/lib/i18n";
import { useFokusPanel } from "@/lib/useFokusPanel";

interface Props {
  lang: Lang;
  judul: string;
  /** label kecil di atas judul, mis. jenis objek */
  label?: string;
  warna?: string;
  onTutup: () => void;
  children: ReactNode;
  /** baris tombol di bawah isi */
  kaki?: ReactNode;
  /** modal = dialog di tengah layar dengan latar gelap; bukan modal = panel samping (lembar bawah di HP) */
  modal?: boolean;
  lebar?: string;
  uji?: string;
}

/**
 * Bingkai panel seragam. Di desktop panel samping menempel di kanan; di HP jadi lembar dari bawah
 * supaya peta di atasnya tetap kelihatan.
 */
export default function Panel({ lang, judul, label, warna = "var(--accent)", onTutup, children, kaki, modal = false, lebar = "sm:w-[370px]", uji }: Props) {
  const ref = useFokusPanel<HTMLDivElement>({ jebak: modal, sopan: !modal });
  const kepala = (
    <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2">
      <div className="min-w-0">
        {label && (
          <div className="label-kecil flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: warna }} />
            {label}
          </div>
        )}
        <h2 className="mt-0.5 text-[14px] font-semibold leading-snug text-text">{judul}</h2>
      </div>
      <button className="tombol-ikon !h-8 !w-8 shrink-0" onClick={onTutup} aria-label={terjemah(lang, "close")} title={`${terjemah(lang, "close")} (Esc)`}>
        <X size={15} />
      </button>
    </div>
  );
  if (modal) {
    return (
      <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/60 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onTutup()}>
        <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={judul} data-testid={uji} className={`glass-padat braket lembar-hp muncul flex max-h-[88%] w-full flex-col outline-none ${lebar}`}>
          {kepala}
          <div className="gulir min-h-0 flex-1 overflow-y-auto">{children}</div>
          {kaki && <div className="border-t border-white/10 p-2">{kaki}</div>}
        </div>
      </div>
    );
  }
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={judul}
      data-testid={uji}
      className={`glass-padat braket geser-kanan pointer-events-auto absolute z-30 flex flex-col outline-none max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[58%] max-sm:pb-[env(safe-area-inset-bottom)] sm:right-3 sm:top-[132px] sm:max-h-[calc(100%-250px)] ${lebar}`}
    >
      {kepala}
      <div className="gulir min-h-0 flex-1 overflow-y-auto">{children}</div>
      {kaki && <div className="border-t border-white/10 p-2">{kaki}</div>}
    </div>
  );
}

/** Baris "label: nilai" di dalam panel. */
export function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1.5 text-[12px]">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right text-text">{children}</span>
    </div>
  );
}

/** Catatan kecil soal batas data/model. */
export function Catatan({ children }: { children: ReactNode }) {
  return <p className="mt-2 border-l-2 border-white/15 pl-2 text-[10.5px] leading-relaxed text-muted">{children}</p>;
}
