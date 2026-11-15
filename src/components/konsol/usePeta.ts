"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Map as MapLibre, setWorkerUrl, type MapMouseEvent } from "maplibre-gl";
import { KanvasAngin } from "@/lib/peta/angin";
import { bangunStyle, ID_LAYER_SAT, layerBasemapTersembunyiSaatSat } from "@/lib/peta/mapStyle";
import { LAYER_INTERAKTIF, pasangSemuaLapisan, type KanvasMedan } from "@/lib/peta/pasang";
import type { Tampilan } from "@/lib/urlState";
import { workerPetaSekali } from "@/lib/workerPeta";

/** toleransi klik (px) untuk titik kecil: jari di HP butuh lebih lebar daripada kursor */
export const TOLERANSI_KLIK = { mouse: 6, sentuh: 14 };

export interface PenanganPeta {
  saatKlik(m: MapLibre, e: MapMouseEvent): void;
  saatMoveEnd(m: MapLibre): void;
}

interface Opsi {
  tampilan: Tampilan;
  satAwal: boolean;
  datarAwal: boolean;
  penanganRef: RefObject<PenanganPeta>;
}

/**
 * Membuat peta MapLibre (globe) sekali, memasang semua layer dan kanvas, lalu meneruskan event ke konsol.
 * `map` dan `kanvas` baru terisi setelah style dan layer siap, jadi efek di konsol cukup bergantung padanya.
 */
export function usePeta({ tampilan, satAwal, datarAwal, penanganRef }: Opsi) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibre | null>(null);
  const [online, setOnline] = useState(true);
  const [kanvas, setKanvas] = useState<KanvasMedan | null>(null);
  const anginRef = useRef<KanvasAngin | null>(null);
  const layerSat = useRef<string[]>([]);
  const awal = useRef({ tampilan, satAwal, datarAwal });

  const terapkanSat = useCallback((m: MapLibre, on: boolean) => {
    if (!m.getLayer(ID_LAYER_SAT)) return;
    m.setLayoutProperty(ID_LAYER_SAT, "visibility", on ? "visible" : "none");
    for (const id of layerSat.current) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", on ? "none" : "visible");
  }, []);

  useEffect(() => {
    if (!wadahRef.current) return;
    let dibatalkan = false;
    let peta: MapLibre | null = null;
    (async () => {
      // worker diambil barengan dengan style, jadi tidak menambah waktu tunggu
      const [style, urlWorker] = await Promise.all([bangunStyle().catch(() => null), workerPetaSekali()]);
      if (dibatalkan || !wadahRef.current) return;
      if (!style) {
        setOnline(false);
        return;
      }
      layerSat.current = layerBasemapTersembunyiSaatSat(style);
      setWorkerUrl(urlWorker);
      const t = awal.current.tampilan;
      const m = new MapLibre({
        container: wadahRef.current,
        style,
        center: [t.lon, t.lat],
        zoom: t.zoom,
        bearing: t.bearing,
        pitch: t.pitch,
        attributionControl: { compact: true },
        maxPitch: 70,
        minZoom: 1.5,
        fadeDuration: 150,
        canvasContextAttributes: { antialias: true },
      });
      peta = m;
      // rel lapisan menutupi ~260 px di kiri layar lebar; di HP chip dan pita berita menutupi bagian bawah
      m.setPadding(window.innerWidth >= 640 ? { left: 250, top: 40, right: 0, bottom: 40 } : { top: 40, bottom: 110, left: 0, right: 0 });
      (window as unknown as { __dops?: MapLibre }).__dops = m;
      // sprite OpenFreeMap tidak punya "circle-11" (titik kota); buat sendiri supaya tidak ada warning di console
      m.setMissingStyleImageResolver((id) => {
        if (m.hasImage(id)) return;
        const n = id === "circle-11" ? 11 : 1;
        const data = new Uint8Array(n * n * 4);
        if (n > 1) {
          const c = (n - 1) / 2;
          for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
              const d = Math.hypot(x - c, y - c);
              const i = (y * n + x) * 4;
              data[i] = 0x8b;
              data[i + 1] = 0x95;
              data[i + 2] = 0xa7;
              data[i + 3] = d <= c - 1.5 ? 230 : d <= c ? 120 : 0;
            }
        }
        m.addImage(id, { width: n, height: n, data });
      });
      // cukup menunggu style, bukan semua ubin: lapisan data langsung tampil walau peta dasar masih mengunduh
      m.once("style.load", () => {
        if (dibatalkan) return;
        const buat = () => {
          const k = document.createElement("canvas");
          k.width = 2;
          k.height = 2;
          return k;
        };
        const kanvasBaru = { darat: buat(), atas: buat(), tsunami: buat() };
        pasangSemuaLapisan(m, style, kanvasBaru);
        setKanvas(kanvasBaru);
        if (awal.current.satAwal) terapkanSat(m, true);
        if (awal.current.datarAwal) m.setProjection({ type: "mercator" });
        const induk = wadahRef.current?.parentElement;
        if (induk) anginRef.current = new KanvasAngin(m, induk, window.matchMedia("(max-width: 640px), (pointer: coarse)").matches);
        setMap(m);
      });
      m.on("moveend", () => penanganRef.current.saatMoveEnd(m));
      m.on("click", (e: MapMouseEvent) => penanganRef.current.saatKlik(m, e));
      m.on("mousemove", (e: MapMouseEvent) => {
        const ids = Object.keys(LAYER_INTERAKTIF).filter((id) => m.getLayer(id));
        const r = TOLERANSI_KLIK.mouse;
        const ada =
          m.queryRenderedFeatures(
            [
              [e.point.x - r, e.point.y - r],
              [e.point.x + r, e.point.y + r],
            ],
            { layers: ids },
          ).length > 0;
        m.getCanvas().style.cursor = ada ? "pointer" : "";
      });
      m.on("error", (e) => {
        const pesan = String((e as { error?: { message?: string } }).error?.message ?? "");
        if (/tiles\.openfreemap|fonts/.test(pesan)) setOnline(false);
      });
    })();
    return () => {
      dibatalkan = true;
      anginRef.current?.hancurkan();
      anginRef.current = null;
      peta?.remove();
      setMap(null);
      setKanvas(null);
    };
  }, [penanganRef, terapkanSat]);

  return { wadahRef, map, online, kanvas, anginRef, terapkanSat };
}

/** true di layar sempit (ponsel): panel samping jadi lembar bawah dan menutupi lini masa. */
export function useSempit(): boolean {
  const [sempit, setSempit] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const ubah = () => setSempit(mq.matches);
    ubah();
    mq.addEventListener("change", ubah);
    return () => mq.removeEventListener("change", ubah);
  }, []);
  return sempit;
}
