/**
 * Kamus antarmuka dua bahasa (ID/EN). Bahasa aktif disimpan di URL (#lang=en) dan localStorage.
 *
 * Glosarium (supaya mode Indonesia gak campur aduk):
 * - Label konsol = English di kedua bahasa: nama fitur (Search, War Room, Briefing, Help, Fullscreen),
 *   label kecil huruf kapital (LAYERS, TIMELINE, kelompok lapisan), status (LIVE, ONLINE), mode (MAP/SAT, 3D/2D).
 *   Kunci seperti ini ditulis lewat `konsol("...")`.
 * - Selain itu ikut bahasa aktif: tombol aksi, tooltip, isi penjelasan, nama lapisan, baris detail, catatan.
 * - Istilah kebencanaan resmi tetap Indonesia di kedua bahasa kalau itu nama status (Waspada, Siaga, Awas).
 * - Semua teks yang tampil di layar lewat kamus ini (atau objek {id, en} di data lapisan/skenario),
 *   bukan `lang === "id" ? ... : ...` di komponen.
 */

/** Label konsol: teksnya sama di mode ID dan EN. */
function konsol(teks: string): { id: string; en: string } {
  return { id: teks, en: teks };
}

export type Lang = "id" | "en";

const KAMUS = {
  // umum
  tagline: { id: "Saat bumi berguncang dan langit terbakar, ruangan ini tetap terjaga.", en: "When the ground shakes and the sky burns, this is the room that stays awake." },
  close: { id: "Tutup", en: "Close" },
  source: { id: "Sumber", en: "Source" },
  sources: konsol("Sources"),
  open_source: { id: "Buka sumber", en: "Open source" },
  layers: konsol("Layers"),
  layers_collapse: { id: "Ciutkan daftar lapisan", en: "Collapse layer list" },
  layers_expand: { id: "Buka daftar lapisan", en: "Expand layer list" },
  status: konsol("Status"),
  status_hint: { id: "Buka War Room untuk rinciannya", en: "Open the War Room for details" },
  online: konsol("ONLINE"),
  offline: konsol("OFFLINE"),
  wib: konsol("WIB"),
  search: konsol("Search"),
  search_hint: { id: "Cari kota, gunung api, provinsi, sungai...", en: "Find a city, volcano, province, river..." },
  search_empty: { id: "Mulai mengetik untuk mencari tempat", en: "Start typing to find a place" },
  no_result: { id: "Tidak ada hasil", en: "No results" },
  help: konsol("Help"),
  help_title: { id: "Cara pakai Disaster Ops", en: "How to use Disaster Ops" },
  shortcuts: konsol("Keyboard shortcuts"),
  fullscreen: konsol("Fullscreen"),
  share: { id: "Salin tautan tampilan ini", en: "Copy link to this view" },
  link_copied: { id: "Tautan disalin", en: "Link copied" },
  copied: { id: "Briefing disalin", en: "Briefing copied" },
  copy_failed: { id: "Gagal menyalin", en: "Could not copy" },
  reset_view: { id: "Kembali ke Indonesia", en: "Reset to Indonesia" },
  menu_more: { id: "Menu lainnya", en: "More" },
  menu_projection: { id: "Proyeksi peta", en: "Map projection" },
  menu_basemap: { id: "Peta dasar", en: "Basemap" },
  menu_lang: { id: "Ganti bahasa", en: "Switch language" },
  globe_mode: konsol("3D"),
  flat_mode: konsol("2D"),
  map_mode: konsol("MAP"),
  sat_mode: konsol("SAT"),
  lang_toggle: { id: "EN", en: "ID" },
  map_label: { id: "Peta bencana Indonesia", en: "Indonesia disaster map" },
  map_offline: { id: "Peta dasar tidak bisa dimuat. Periksa koneksi lalu muat ulang halaman.", en: "The basemap could not load. Check your connection and reload." },
  load_failed: { id: "Data gagal dimuat. Coba lagi sebentar lagi.", en: "Data failed to load. Try again shortly." },
  source_down: { id: "sumber tidak menjawab", en: "source not responding" },
  no_data: { id: "Belum ada data", en: "No data yet" },
  unknown: { id: "Tidak diketahui", en: "Unknown" },
  play: { id: "Putar", en: "Play" },
  pause: { id: "Jeda", en: "Pause" },
  stop: { id: "Berhenti", en: "Stop" },
  restart: { id: "Ulang dari awal", en: "Restart" },
  now: { id: "sekarang", en: "now" },
  today: { id: "hari ini", en: "today" },
  hours_short: { id: "jam", en: "h" },
  from: { id: "dari", en: "from" },
  year_unit: { id: "tahun", en: "yr" },

  // boot (selalu English)
  boot_1: konsol("Linking NASA FIRMS fire feed"),
  boot_2: konsol("Syncing BMKG + USGS seismic network"),
  boot_3: konsol("Loading wind field and 8-day outlook"),
  boot_4: konsol("War room ready"),
  boot_skip: konsol("Skip"),

  // HUD
  count_hotspot: konsol("Hotspots 24h"),
  count_quake: konsol("Quakes 24h"),
  count_volcano: konsol("Volcano ≥ Siaga"),
  count_warning: konsol("Warnings"),
  warroom: konsol("War Room"),
  tool_quake: { id: "Skenario guncangan", en: "Shaking scenario" },
  tool_tsunami: { id: "Simulasi tsunami", en: "Tsunami simulation" },
  tool_replay: { id: "Putar ulang karhutla 2019", en: "Replay the 2019 fires" },
  ticker: { id: "Kejadian terbaru", en: "Latest events" },
  ticker_hotspots: { id: "titik panas dalam 24 jam", en: "hotspots in 24 hours" },

  // kelompok lapisan
  group_live: konsol("Live"),
  group_atmo: konsol("Atmosphere"),
  group_forecast: konsol("Forecast"),
  group_hazard: konsol("Hazard & exposure"),

  // lini masa
  timeline_hours: konsol("Timeline · 72 h"),
  timeline_days: konsol("Outlook · 8 days"),
  hotspot_range: { id: "Rentang titik panas", en: "Hotspot window" },
  range_24h: { id: "24 jam", en: "24 h" },
  range_7d: { id: "7 hari", en: "7 days" },
  inarisk_pick: { id: "Jenis peta bahaya InaRISK", en: "InaRISK hazard type" },
  forecast_made: { id: "prakiraan dibuat", en: "forecast built" },

  // panel detail: jenis objek
  kind_hotspot: { id: "Titik panas", en: "Fire hotspot" },
  kind_quake: { id: "Gempa", en: "Earthquake" },
  kind_volcano: { id: "Gunung api", en: "Volcano" },
  kind_report: { id: "Laporan warga", en: "Citizen report" },
  kind_river: { id: "Sungai", en: "River" },
  kind_historic: { id: "Gempa historis", en: "Historical earthquake" },
  kind_fault: { id: "Sesar aktif", en: "Active fault" },
  kind_megathrust: { id: "Zona subduksi (megathrust)", en: "Subduction zone (megathrust)" },
  kind_hospital: { id: "Rumah sakit", en: "Hospital" },
  kind_point: { id: "Titik di peta", en: "Map point" },

  // panel detail: baris
  coordinates: { id: "Koordinat", en: "Coordinates" },
  detected: { id: "Terdeteksi", en: "Detected" },
  time: { id: "Waktu", en: "Time" },
  frp: { id: "Daya pancar api (FRP)", en: "Fire radiative power" },
  confidence: { id: "Keyakinan", en: "Confidence" },
  conf_low: { id: "Rendah", en: "Low" },
  conf_nominal: { id: "Sedang", en: "Nominal" },
  conf_high: { id: "Tinggi", en: "High" },
  satellite: { id: "Satelit", en: "Satellite" },
  magnitude: { id: "Magnitudo", en: "Magnitude" },
  depth: { id: "Kedalaman", en: "Depth" },
  felt: { id: "Dirasakan (MMI)", en: "Felt (MMI)" },
  bmkg_note: { id: "Keterangan BMKG", en: "BMKG note" },
  shakemap_alt: { id: "Peta guncangan dari BMKG", en: "Shakemap from BMKG" },
  tsunami_flag: { id: "BMKG menyatakan gempa ini berpotensi tsunami", en: "BMKG flagged this earthquake as tsunamigenic" },
  alert_level: { id: "Tingkat aktivitas", en: "Alert level" },
  province: { id: "Provinsi", en: "Province" },
  elevation: { id: "Ketinggian", en: "Elevation" },
  magma_report: { id: "Laporan MAGMA terbaru", en: "Latest MAGMA report" },
  incidents: { id: "Jumlah kejadian", en: "Incidents" },
  dead_missing: { id: "Meninggal / hilang", en: "Dead / missing" },
  injured: { id: "Luka atau sakit", en: "Injured or ill" },
  displaced: { id: "Mengungsi", en: "Displaced" },
  houses: { id: "Rumah rusak / terendam", en: "Houses damaged / flooded" },
  flood_depth: { id: "Tinggi genangan", en: "Flood depth" },
  report_photo_alt: { id: "Foto kiriman warga", en: "Photo sent by a resident" },
  valid: { id: "Berlaku", en: "Valid" },
  open_infographic: { id: "Infografis BMKG", en: "BMKG infographic" },
  peak_7d: { id: "Debit puncak 7 hari", en: "7-day peak discharge" },
  clim_p50_p90_p99: { id: "Median / P90 / P99 (m³/s)", en: "Median / P90 / P99 (m³/s)" },
  discharge_chart: { id: "Prakiraan debit harian dibanding ambang P90 dan P99", en: "Daily discharge forecast against the P90 and P99 thresholds" },
  place: { id: "Lokasi", en: "Location" },
  year: { id: "Tahun", en: "Year" },
  slip_type: { id: "Jenis gerak", en: "Slip type" },
  slip_rate: { id: "Laju geser", en: "Slip rate" },
  pop_within: { id: "Penduduk dalam {n} km", en: "People within {n} km" },
  hosp_within: { id: "Rumah sakit dalam {n} km", en: "Hospitals within {n} km" },
  hosp_nearest: { id: "Rumah sakit terdekat", en: "Nearest hospital" },
  forecast_here: { id: "Prakiraan di titik ini", en: "Forecast at this point" },
  forecast_missing: { id: "Snapshot prakiraan belum tersedia.", en: "Forecast snapshot not available yet." },
  point_outside: { id: "Titik ini di luar cakupan prakiraan.", en: "This point is outside the forecast area." },
  wind: { id: "Angin", en: "Wind" },
  temperature: { id: "Suhu", en: "Temperature" },
  rain_24h: { id: "Hujan 24 jam ke depan", en: "Rain, next 24 h" },
  fwi_8day: { id: "Cuaca api (FWI) 8 hari", en: "Fire weather (FWI), 8 days" },
  fwi_low: { id: "rendah", en: "low" },
  fwi_moderate: { id: "sedang", en: "moderate" },
  fwi_high: { id: "tinggi", en: "high" },
  fwi_extreme: { id: "ekstrem", en: "extreme" },

  // panel detail: catatan jujur
  note_hotspot: { id: "Titik panas = anomali suhu yang dilihat satelit, belum tentu kebakaran lahan. Satu kebakaran besar bisa muncul sebagai banyak titik.", en: "A hotspot is a thermal anomaly seen from orbit, not a confirmed wildfire. One large fire can show up as many points." },
  note_volcano: { id: "Level dari MAGMA Indonesia (PVMBG). Radius bahaya resmi ada di laporan MAGMA; angka penduduk di sini hanya gambaran.", en: "Level from MAGMA Indonesia (PVMBG). Official danger radii are in the MAGMA report; the population figure here is indicative." },
  note_bnpb: { id: "Rekap mingguan BNPB per kabupaten/kota. Titik ditaruh di ibu kota kabupaten, bukan lokasi persis kejadian.", en: "BNPB weekly recap per regency. The marker sits on the regency capital, not the exact site." },
  note_report: { id: "Laporan warga lewat PetaBencana.id. Belum tentu sudah diverifikasi petugas.", en: "Crowdsourced via PetaBencana.id. Not necessarily verified by officials." },
  note_river: { id: "Debit dari model GloFAS (sel ~5 km), bukan pos duga air. Ambang = persentil klimatologi 1991-2020 di sel yang sama.", en: "Discharge from the GloFAS model (~5 km cells), not a gauge. Thresholds are 1991-2020 climatology percentiles for the same cell." },
  note_historic: { id: "Katalog USGS M6+ sejak 1900. Tempat gempa besar pernah terjadi adalah tempat gempa besar bisa terjadi lagi.", en: "USGS catalog, M6+ since 1900. Where large earthquakes happened, they can happen again." },
  note_fault: { id: "Garis sesar dari GEM Global Active Faults, zona subduksi dari Bird (2003). Letaknya pendekatan skala regional.", en: "Fault traces from GEM Global Active Faults, subduction zones from Bird (2003). Positions are regional-scale approximations." },
  note_hospital: { id: "Dari OpenStreetMap, belum lengkap dan belum tentu mutakhir.", en: "From OpenStreetMap; incomplete and not necessarily current." },

  // alat: gempa
  tool_quake_label: konsol("What if · shaking"),
  quake_intro: { id: "Gempa tidak bisa diprediksi. Yang bisa dihitung: kalau gempa sebesar ini terjadi di sini, seberapa kuat guncangannya dan berapa orang yang merasakannya.", en: "Earthquakes cannot be predicted. What can be computed: if a quake this size struck here, how strong the shaking would be and how many people would feel it." },
  click_map_epicenter: { id: "Klik peta untuk menaruh episenter, atau pilih sesar di atas.", en: "Click the map to place an epicenter, or pick a fault above." },
  epicenter: { id: "Episenter", en: "Epicenter" },
  max_intensity: { id: "Intensitas terkuat", en: "Peak intensity" },
  rupture_size: { id: "Panjang patahan", en: "Rupture length" },
  exposed_vi: { id: "Penduduk di MMI VI ke atas", en: "People at MMI VI or above" },
  hospitals_vii: { id: "Rumah sakit di zona MMI VII+", en: "Hospitals inside the MMI VII+ zone" },
  what_it_feels: { id: "Rasanya", en: "What it feels like" },
  people: { id: "Penduduk", en: "People" },
  safe_hospitals: { id: "Rumah sakit terdekat di luar zona rusak", en: "Nearest hospitals outside the damage zone" },
  route_to: { id: "Cari rute dari episenter ke rumah sakit ini", en: "Route from the epicenter to this hospital" },
  route_road: { id: "Rute jalan", en: "Road route" },
  route_straight: { id: "Garis lurus (server rute tidak menjawab)", en: "Straight line (routing server did not answer)" },
  pick_again: { id: "Pilih titik lain", en: "Pick another point" },
  open_shake: { id: "Skenario guncangan", en: "Shaking scenario" },
  replay_shake: { id: "Ulangi guncangannya", en: "Replay the shaking" },
  open_tsunami: { id: "Simulasi tsunami", en: "Tsunami simulation" },
  what_if_m7: { id: "Kalau M7 di sini?", en: "What if M7 here?" },
  what_if_m85: { id: "Kalau M8,5 di sini?", en: "What if M8.5 here?" },
  note_quake: { id: "Intensitas dari persamaan Allen dkk. (2012) dengan sumber berbentuk cakram; tanah lunak bisa menaikkan 1-2 tingkat MMI. Penduduk dari WorldPop 2020. Ini skenario, bukan prediksi.", en: "Intensity from Allen et al. (2012) with a disc-shaped source; soft soil can add 1-2 MMI levels. Population from WorldPop 2020. A scenario, not a prediction." },

  // alat: tsunami
  tool_tsunami_label: konsol("What if · tsunami"),
  tsunami_intro: { id: "Berapa menit sampai gelombang pertama tiba? Dihitung dari kedalaman laut: makin dalam, makin cepat.", en: "How many minutes until the first wave arrives? Computed from ocean depth: the deeper the water, the faster the wave." },
  scenario_pick: konsol("Scenario"),
  scenario_custom: { id: "Titik pilihan sendiri", en: "Custom point" },
  scenario_real: { id: "Pernah terjadi", en: "Happened" },
  scenario_hypo: { id: "Hipotetis", en: "Hypothetical" },
  click_map_source: { id: "Klik laut di peta untuk menaruh sumber gempa, atau pilih skenario.", en: "Click the sea to place the earthquake source, or pick a scenario." },
  source_size: { id: "Lebar daerah sumber", en: "Source width" },
  cities_under_1h: { id: "Kota pesisir terjangkau < 1 jam", en: "Coastal cities reached in < 1 h" },
  tsunami_on_land: { id: "Sumbernya di darat dan tidak menyentuh laut: tidak ada tsunami untuk dihitung.", en: "The source is on land and does not reach the sea: no tsunami to compute." },
  tsunami_unlikely: { id: "Gempa sekecil atau sedalam ini jarang membangkitkan tsunami. Waktu tempuh tetap ditampilkan sebagai gambaran.", en: "A quake this small or this deep rarely generates a tsunami. Travel times are shown for reference." },
  since_quake: { id: "Sejak gempa", en: "Since the quake" },
  coastal_city: { id: "Kota pesisir", en: "Coastal city" },
  arrival: { id: "Tiba", en: "Arrival" },
  est_height: { id: "Tinggi", en: "Height" },
  tap_city_route: { id: "Klik kota untuk rute ke dataran tinggi terdekat.", en: "Click a city for a route to the nearest high ground." },
  route_high_ground: { id: "Cari rute ke dataran tinggi", en: "Route to high ground" },
  to_high_ground: { id: "ke dataran ≥ {n} m", en: "to ground ≥ {n} m" },
  note_tsunami: { id: "Waktu tempuh dari batimetri ETOPO 2022 (sel ~7 km), kecepatan gelombang √(g·h). Tinggi gelombang hanya perkiraan kasar (Abe 1995); bentuk teluk bisa melipatgandakannya. Kalau guncangan kuat atau lama di pantai: jangan tunggu sirene, langsung ke tempat tinggi.", en: "Travel times from ETOPO 2022 bathymetry (~7 km cells), wave speed √(g·h). Wave heights are a rough estimate (Abe 1995); bays can multiply them. If shaking at the coast is strong or long: do not wait for the siren, go to high ground." },

  // war room
  sitrep_label: konsol("SITREP"),
  briefing: konsol("Briefing"),
  briefing_start: { id: "Putar briefing", en: "Play briefing" },
  copy_md: { id: "Salin", en: "Copy" },
  download_md: { id: "Unduh .md", en: "Download .md" },
  fly_there: { id: "Lihat di peta", en: "Show on map" },
  sources_down: { id: "{n} sumber sedang tidak menjawab", en: "{n} sources not responding" },
  sitrep_note: { id: "Briefing ini disusun otomatis dari data publik tiap kali halaman dibuka, tanpa model bahasa. Bukan pengganti peringatan resmi BMKG, PVMBG, atau BNPB.", en: "This briefing is assembled automatically from public data on every visit, with no language model. Not a substitute for official BMKG, PVMBG or BNPB warnings." },

  // putar ulang
  replay_label: konsol("Replay · Karhutla 2019"),
  replay_date: { id: "Tanggal putar ulang", en: "Replay date" },
  hotspots_that_day: { id: "titik panas hari itu", en: "hotspots that day" },
  cumulative: { id: "sejak 1 Juli", en: "since 1 July" },
  replay_imagery: { id: "Citra asap", en: "Smoke imagery" },
  replay_imagery_hint: { id: "Tampilkan citra satelit hari itu (dimuat saat pemutar dijeda)", en: "Show that day's satellite image (loads when paused)" },
  replay_note: { id: "74 ribu deteksi MODIS (Terra/Aqua), keyakinan ≥ 30%. Titik memudar setelah 3 hari.", en: "74 thousand MODIS detections (Terra/Aqua), confidence ≥ 30%. Points fade after 3 days." },

  // bantuan
  help_search: { id: "Cari tempat", en: "Find a place" },
  help_warroom: { id: "War Room: briefing harian", en: "War Room: daily briefing" },
  help_quake: { id: "Skenario guncangan gempa", en: "Earthquake shaking scenario" },
  help_tsunami: { id: "Simulasi tsunami", en: "Tsunami simulation" },
  help_replay: { id: "Putar ulang karhutla 2019", en: "Replay the 2019 fires" },
  help_play: { id: "Putar / jeda lini masa", en: "Play / pause the timeline" },
  help_step: { id: "Mundur / maju satu langkah", en: "Step back / forward" },
  help_sat: { id: "Peta gelap ↔ citra satelit", en: "Dark map ↔ satellite imagery" },
  help_flat: { id: "Globe 3D ↔ datar 2D", en: "3D globe ↔ flat 2D" },
  help_lang: { id: "Bahasa Indonesia ↔ English", en: "Bahasa Indonesia ↔ English" },
  help_fullscreen: { id: "Layar penuh", en: "Fullscreen" },
  help_reset: { id: "Kembali ke Indonesia", en: "Reset to Indonesia" },
  help_esc: { id: "Tutup panel", en: "Close panel" },
  help_honesty: konsol("Read this first"),
  honest_1: { id: "Semua dari data publik dan diperbarui otomatis: titik panas tiap 10 menit, gempa tiap menit, prakiraan tiap 6 jam.", en: "Everything comes from public data and refreshes on its own: hotspots every 10 minutes, earthquakes every minute, forecasts every 6 hours." },
  honest_2: { id: "Gempa tidak diprediksi. Yang ada: zona bahaya, riwayat gempa besar, dan skenario \"kalau terjadi di sini\".", en: "Earthquakes are not predicted. What you get: hazard zones, the record of large quakes, and \"what if it happened here\" scenarios." },
  honest_3: { id: "Risiko karhutla memakai Fire Weather Index dari prakiraan cuaca; risiko banjir dari akumulasi hujan dan debit sungai GloFAS. Keduanya saringan kasar di grid ~100 km, bukan peringatan per desa.", en: "Fire danger uses the Fire Weather Index from weather forecasts; flood risk uses rain totals and GloFAS river discharge. Both are coarse screens on a ~100 km grid, not village-level warnings." },
  honest_4: { id: "Simulasi tsunami menghitung waktu tiba, bukan tinggi genangan. Angka tinggi gelombang hanya orde besaran.", en: "The tsunami tool computes arrival time, not inundation. Wave heights are order-of-magnitude only." },
  honest_5: { id: "Klik tempat kosong di peta untuk prakiraan titik itu, klik objek untuk rinciannya.", en: "Click empty map for a point forecast, click any object for its details." },
  help_code: { id: "Kode dan catatan sumber data:", en: "Code and data notes:" },
  help_emergency: { id: "Keadaan darurat? Ikuti BMKG, PVMBG, BNPB, dan BPBD setempat. Nomor darurat: 112. Situs ini alat pantau dan belajar, bukan sistem peringatan dini.", en: "In an emergency, follow BMKG, PVMBG, BNPB and your local BPBD. Emergency number: 112. This site is for monitoring and learning, not an early-warning system." },
} satisfies Record<string, { id: string; en: string }>;

export type Kunci = keyof typeof KAMUS;

export function terjemah(lang: Lang, kunci: Kunci): string {
  return KAMUS[kunci][lang];
}

/** Semua kunci kamus (dipakai tes untuk memastikan dua bahasa terisi). */
export function semuaKunci(): Kunci[] {
  return Object.keys(KAMUS) as Kunci[];
}
