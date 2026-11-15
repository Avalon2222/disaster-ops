"use client";

import { useEffect, useRef, useState } from "react";
import type { DataBencana, DataGempa, DataGunung, DataHotspot, DataPeringatan, SnapshotCuaca } from "@/lib/jenis";
import { URL_DATA } from "@/lib/situs";

export type KunciSumber = "hotspot" | "gempa" | "gunung" | "bencana" | "peringatan" | "cuaca";

export interface DataLive {
  hotspot: DataHotspot | null;
  gempa: DataGempa | null;
  gunung: DataGunung | null;
  bencana: DataBencana | null;
  peringatan: DataPeringatan | null;
  cuaca: SnapshotCuaca | null;
  /** sumber yang permintaan terakhirnya gagal */
  galat: Set<KunciSumber>;
}

/** selang penyegaran per sumber (ms) */
const SELANG: Record<Exclude<KunciSumber, "cuaca">, number> = {
  gempa: 60_000,
  peringatan: 5 * 60_000,
  hotspot: 10 * 60_000,
  bencana: 15 * 60_000,
  gunung: 30 * 60_000,
};

/** Snapshot yang lebih tua dari ini tidak lagi memuat "sekarang" di deret 72 jamnya. */
export const UMUR_MAKS_CUACA = 60 * 3600_000;

async function ambil<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Snapshot prakiraan: yang terbaru di antara cabang `data` (ditulis GitHub Actions) dan salinan yang
 * ikut di-deploy. Salinan lokal jadi cadangan kalau GitHub tidak terjangkau.
 */
export async function ambilCuaca(): Promise<SnapshotCuaca | null> {
  const hasil = await Promise.allSettled([ambil<SnapshotCuaca>(`${URL_DATA}/cuaca.json`), ambil<SnapshotCuaca>("/data/cuaca.json")]);
  let terbaik: SnapshotCuaca | null = null;
  for (const h of hasil) if (h.status === "fulfilled" && h.value?.medan && (!terbaik || h.value.dibuat > terbaik.dibuat)) terbaik = h.value;
  return terbaik;
}

/** Semua data live, disegarkan berkala selama tab terlihat. `rentang` = jendela titik panas (jam). */
export function useData(rentang: 24 | 168): DataLive {
  const [data, setData] = useState<DataLive>({ hotspot: null, gempa: null, gunung: null, bencana: null, peringatan: null, cuaca: null, galat: new Set() });
  const rentangRef = useRef(rentang);

  useEffect(() => {
    rentangRef.current = rentang;
  }, [rentang]);

  useEffect(() => {
    let hidup = true;
    const tandai = (kunci: KunciSumber, gagal: boolean) =>
      setData((d) => {
        if (d.galat.has(kunci) === gagal) return d;
        const galat = new Set(d.galat);
        if (gagal) galat.add(kunci);
        else galat.delete(kunci);
        return { ...d, galat };
      });
    const muat = async (kunci: Exclude<KunciSumber, "cuaca">) => {
      try {
        const url = kunci === "hotspot" ? `/api/hotspot?jam=${rentangRef.current}` : `/api/${kunci}`;
        const hasil = await ambil<unknown>(url);
        if (!hidup) return;
        setData((d) => ({ ...d, [kunci]: hasil }));
        tandai(kunci, false);
      } catch {
        if (hidup) tandai(kunci, true);
      }
    };
    const muatCuaca = async () => {
      const c = await ambilCuaca().catch(() => null);
      if (!hidup) return;
      if (c) setData((d) => ({ ...d, cuaca: c }));
      tandai("cuaca", !c);
    };

    const kunciSemua = Object.keys(SELANG) as Exclude<KunciSumber, "cuaca">[];
    for (const k of kunciSemua) void muat(k);
    void muatCuaca();
    const pewaktu = kunciSemua.map((k) =>
      setInterval(() => {
        if (!document.hidden) void muat(k);
      }, SELANG[k]),
    );
    pewaktu.push(
      setInterval(() => {
        if (!document.hidden) void muatCuaca();
      }, 60 * 60_000),
    );
    // tab kembali terlihat setelah lama tersembunyi: gempa disegarkan langsung
    const tampil = () => {
      if (!document.hidden) void muat("gempa");
    };
    document.addEventListener("visibilitychange", tampil);
    return () => {
      hidup = false;
      for (const p of pewaktu) clearInterval(p);
      document.removeEventListener("visibilitychange", tampil);
    };
  }, []);

  // ganti rentang titik panas: ambil ulang
  const pertama = useRef(true);
  useEffect(() => {
    if (pertama.current) {
      pertama.current = false;
      return;
    }
    let hidup = true;
    ambil<DataHotspot>(`/api/hotspot?jam=${rentang}`)
      .then((h) => hidup && setData((d) => ({ ...d, hotspot: h })))
      .catch(() => undefined);
    return () => {
      hidup = false;
    };
  }, [rentang]);

  return data;
}
