/* =================================================================
   Layanan jadwal sholat:
   - sumber utama: API Kemenag (via server, di-cache ke IndexedDB)
   - cadangan: perhitungan offline (lib/prayer.js)
   ================================================================= */
import { Api } from './api.js';
import { idbGet, idbSet } from './db.js';
import { computeTimes } from './prayer.js';
import { hmToSec, secToHM, ymd, startOfDay, tzOffsetHours } from './util.js';

/** Urutan tampilan baku */
export const KEYS = ['imsak', 'fajar', 'subuh', 'syuruq', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'];

/** Sholat wajib yang memicu adzan/iqomah */
export const PRIMARY = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];

/** Waktu yang hanya informatif (tanpa adzan) */
export const INFO_ONLY = ['imsak', 'fajar', 'syuruq', 'dhuha'];

const MONTH_MS = 2592000000;
const memMonths = new Map();   // `${kotaId}:${y}-${m}` -> { 'YYYY-MM-DD': times }
const memDays = new Map();     // `${kotaId}:${ymd}` -> times

function monthKey(kotaId, y, m) { return `${kotaId}:${y}-${String(m).padStart(2, '0')}`; }

function normalizeApiRow(row) {
    return {
        imsak: row.imsak || null,
        fajar: row.fajar || row.subuh || null,
        subuh: row.subuh || null,
        syuruq: row.syuruq || row.terbit || null,
        terbit: row.terbit || row.syuruq || null,
        dhuha: row.dhuha || null,
        dzuhur: row.dzuhur || null,
        ashar: row.ashar || null,
        maghrib: row.maghrib || null,
        isya: row.isya || null,
        source: 'kemenag',
    };
}

/** Muat satu bulan dari API (atau cache) lalu simpan ke IndexedDB. */
export async function loadMonth(kotaId, year, month, { force = false } = {}) {
    const mk = monthKey(kotaId, year, month);
    if (!force && memMonths.has(mk)) return memMonths.get(mk);

    const cacheKey = `prayer:${mk}`;
    if (!force) {
        const cached = await idbGet(cacheKey);
        if (cached && cached.map && cached.year === year && cached.month === month) {
            memMonths.set(mk, cached.map);
            return cached.map;
        }
    }

    try {
        const res = await Api.jadwalBulan(kotaId, year, month);
        const rows = res?.data?.jadwal || [];
        if (rows.length) {
            const map = {};
            for (const r of rows) map[r.date] = normalizeApiRow(r);
            memMonths.set(mk, map);
            await idbSet(cacheKey, { map, year, month, kotaId, ts: Date.now() });
            return map;
        }
    } catch { /* offline / gagal */ }
    return null;
}

/** Ambil jadwal satu hari (API bila ada, jika tidak dihitung offline). */
export async function getDayTimes(date, settings, { allowNetwork = true } = {}) {
    const loc = settings.location || {};
    const calcCfg = settings.calc || {};
    const y = date.getFullYear(), m = date.getMonth() + 1;
    const key = ymd(date);

    let times = null;
    let source = 'calc';

    if (loc.mode === 'kota' && loc.kotaId) {
        const mk = `${loc.kotaId}:${key}`;
        if (memDays.has(mk)) times = memDays.get(mk);
        if (!times) {
            let map = memMonths.get(monthKey(loc.kotaId, y, m));
            if (!map) map = await idbGet(`prayer:${monthKey(loc.kotaId, y, m)}`).then(v => v?.map || null);
            if (map) memMonths.set(monthKey(loc.kotaId, y, m), map);
            if (map && map[key]) times = map[key];
            if (!times && allowNetwork) {
                const fresh = await loadMonth(loc.kotaId, y, m, { force: true });
                if (fresh && fresh[key]) times = fresh[key];
            }
        }
        if (times) { memDays.set(mk, times); source = 'kemenag'; }
    }

    if (!times) {
        const t = computeTimes(date, loc.lat ?? -6.2, loc.lng ?? 106.8, loc.timezone || 'Asia/Jakarta', {
            fajrAngle: calcCfg.fajrAngle ?? 20,
            ishaAngle: calcCfg.ishaAngle ?? 18,
            asrFactor: calcCfg.asrFactor ?? 1,
            imsakMinutes: calcCfg.imsakMinutes ?? 10,
            dhuhaAngle: calcCfg.dhuhaAngle ?? 7,
            elevation: loc.elevasi || 0,
            tzOffset: tzOffsetHours(loc.timezone || 'Asia/Jakarta', new Date()),
        });
        times = { ...t, source: 'calc' };
        // Fajar = Subuh (dapat disesuaikan lewat offset)
        times.fajar = times.subuh;
    }

    return applyAdjustments(times, settings, source);
}

/** Terapkan ihtiyat (hanya untuk hasil hitung) & koreksi per-waktu. */
export function applyAdjustments(times, settings, source) {
    const calcCfg = settings.calc || {};
    const offsets = settings.offsets || {};
    const out = { ...times, source: source || times.source || 'calc' };
    const isCalc = out.source !== 'kemenag';
    const ihtiyat = isCalc ? Number(calcCfg.ihtiyat ?? 2) : 0;

    for (const k of KEYS) {
        let sec = hmToSec(out[k] ?? out.subuh);
        if (sec === null) { out[k] = null; continue; }
        if (ihtiyat) {
            if (k === 'syuruq' || k === 'terbit' || k === 'dhuha') sec -= ihtiyat * 60;
            else sec += ihtiyat * 60;
        }
        sec += Number(offsets[k] || 0) * 60;
        out[k] = secToHM(sec);
    }
    if (!out.fajar) out.fajar = out.subuh;
    if (!out.dhuha && out.syuruq) out.dhuha = secToHM(hmToSec(out.syuruq) + 15 * 60);
    return out;
}

/** Sinkronisasi beberapa bulan ke depan (untuk pemakaian offline). */
export async function prefetch(kotaId, months = 3, onProgress) {
    const base = new Date();
    const result = { ok: 0, fail: 0, bulan: [] };
    for (let i = 0; i < months; i++) {
        const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
        onProgress?.(i / months, d);
        const map = await loadMonth(kotaId, d.getFullYear(), d.getMonth() + 1, { force: false });
        if (map) { result.ok++; result.bulan.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
        else result.fail++;
    }
    onProgress?.(1, null);
    return result;
}

/* =================================================================
   Status sholat (normal / adzan / iqomah / hening)
   ================================================================= */

/**
 * Bangun linimasa 2 hari (hari ini + besok) untuk pelacakan status.
 * @returns Array<{key,label,timeSec,dateKey,dayOffset,prayer:boolean,adzanSec,iqomahSec,heningSec}>
 */
export function buildTimeline(todayTimes, tomorrowTimes, settings, date = new Date()) {
    const labels = settings.labels || {};
    const visible = settings.visible || KEYS;
    const iqomah = settings.iqomah || {};
    const hening = settings.hening || {};
    const adzanLen = Math.max(30, Number(settings.audio?.adzanDuration ?? 180));

    const ev = [];
    const push = (times, dayOffset, dateKey) => {
        if (!times) return;
        for (const k of KEYS) {
            const sec = hmToSec(times[k]);
            if (sec === null) continue;
            const isPrayer = PRIMARY.includes(k);
            let iqMin = Number(iqomah[k] ?? 0);
            let hnMin = Number(hening[k] ?? 0);
            if (isPrayer && iqMin > 0) {
                const minIq = Math.ceil(adzanLen / 60) + 1;
                if (iqMin < minIq) iqMin = minIq;
            }
            ev.push({
                key: k,
                label: labels[k] || k,
                timeSec: sec + dayOffset * 86400,
                dayOffset,
                dateKey,
                visible: visible.includes(k),
                prayer: isPrayer,
                adzanSec: adzanLen,
                iqomahSec: iqMin * 60,
                heningSec: hnMin * 60,
                hasIqomah: isPrayer && iqMin > 0,
            });
        }
    };
    const dk0 = ymd(date);
    const dk1 = ymd(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
    push(todayTimes, 0, dk0);
    push(tomorrowTimes, 1, dk1);
    return ev.sort((a, b) => a.timeSec - b.timeSec);
}

/**
 * Tentukan fase saat ini.
 *  - normal  : hitung mundur ke jadwal sholat berikutnya
 *  - adzan   : adzan sedang berkumandang, hitung mundur ke iqomah
 *  - iqomah  : menunggu iqomah (masih hitung mundur)
 *  - sholat  : iqomah dimulai — layar hitam penuh sampai waktu hening selesai
 * @param {number} nowSec detik sejak tengah malam (hari ini)
 * @returns {{phase, event, nextEvent, secondsToNext, secondsLeft, iqomahIn}}
 */
export function computeStatus(nowSec, timeline) {
    for (const e of timeline) {
        if (!e.prayer) continue;

        // Sholat tanpa iqomah: hanya jendela adzan
        if (!e.hasIqomah) {
            if (e.visible && nowSec >= e.timeSec && nowSec < e.timeSec + e.adzanSec) {
                const end = e.timeSec + e.adzanSec;
                return { phase: 'adzan', event: e, secondsLeft: end - nowSec, iqomahIn: end - nowSec };
            }
            continue;
        }

        const adzanStart  = e.timeSec;
        const adzanEnd    = e.timeSec + e.adzanSec;
        const iqomahStart = e.timeSec + e.iqomahSec;   // dijamin >= adzanEnd
        const sholatEnd   = iqomahStart + e.heningSec;

        if (nowSec >= adzanStart && nowSec < adzanEnd) {
            return { phase: 'adzan', event: e, secondsLeft: adzanEnd - nowSec, iqomahIn: iqomahStart - nowSec };
        }
        if (nowSec >= adzanEnd && nowSec < iqomahStart) {
            return { phase: 'iqomah', event: e, secondsLeft: iqomahStart - nowSec, iqomahIn: iqomahStart - nowSec };
        }
        if (e.heningSec > 0 && nowSec >= iqomahStart && nowSec < sholatEnd) {
            return { phase: 'sholat', event: e, secondsLeft: sholatEnd - nowSec };
        }
    }

    // Tidak ada fase khusus -> cari waktu berikutnya
    let next = null;
    for (const e of timeline) {
        if (e.timeSec > nowSec && (e.prayer || e.visible)) { next = e; break; }
    }
    if (!next) next = timeline.find(e => e.prayer) || timeline[0] || null;
    return {
        phase: 'normal',
        event: null,
        nextEvent: next,
        secondsToNext: next ? Math.max(0, next.timeSec - nowSec) : 0,
    };
}

/** Event yang sedang/akan disorot di bilah bawah */
export function activeEvent(status, timeline, nowSec) {
    if (status.event) return status.event;
    if (status.nextEvent) return status.nextEvent;
    return timeline.find(e => e.timeSec > nowSec) || timeline[timeline.length - 1] || null;
}

/** Prefetch jadwal dari server (SQLite) */
export async function syncFromServer(kotaId, months = 3) {
    return Api.sync(kotaId, months);
}
