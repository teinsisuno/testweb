/* =================================================================
   Hijriah & hari besar Islam — berjalan offline.
   Menggunakan kalender Umm al-Qura (Intl) dengan cadangan algoritma
   aritmetika Kuwaiti.
   ================================================================= */
import { pad, addDays, ymd } from './util.js';

export const HIJRI_MONTHS = [
    'Muharram', 'Safar', "Rabi'ul Awal", "Rabi'ul Akhir", 'Jumadil Awal', 'Jumadil Akhir',
    'Rajab', "Sya'ban", 'Ramadhan', 'Syawal', "Dzulqa'dah", 'Dzulhijjah',
];

export const HIJRI_MONTHS_SHORT = [
    'Muh', 'Saf', 'Rab I', 'Rab II', 'Jum I', 'Jum II', 'Raj', "Sya'", 'Ram', 'Syaw', "Qa'd", 'Hij',
];

const HARI_ID = { Sunday: 'Ahad', Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu', Thursday: 'Kamis', Friday: "Jum'at", Saturday: 'Sabtu' };
const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

let _fmt = null;
function hijriFmt() {
    if (_fmt !== null) return _fmt;
    try {
        _fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
            day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC',
        });
        // Uji cepat
        const parts = _fmt.formatToParts(new Date(Date.UTC(2025, 0, 1)));
        const hasYear = parts.some(p => p.type === 'year' && /^\d{4}$/.test(p.value));
        if (!hasYear) _fmt = false;
    } catch {
        _fmt = false;
    }
    return _fmt;
}

/* --- algoritma aritmetika (cadangan) --- */
function gToJD(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function jdToHijri(jdv) {
    let jd = Math.floor(jdv) - 1948440 + 10632;
    const n = Math.floor((jd - 1) / 10631);
    jd = jd - 10631 * n + 354;
    const j = (Math.floor((10985 - jd) / 5316)) * (Math.floor((50 * jd) / 17719)) + (Math.floor(jd / 5670)) * (Math.floor((43 * jd) / 15238));
    jd = jd - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    const m = Math.floor((24 * jd) / 709);
    const d = jd - Math.floor((709 * m) / 24);
    const y = 30 * n + j - 30;
    return { y, m, d };
}

const cache = new Map();

/** Konversi tanggal Masehi -> Hijriah (dengan koreksi hari opsional). */
export function toHijri(date, offsetDays = 0) {
    const key = ymd(date) + ':' + offsetDays;
    if (cache.has(key)) return cache.get(key);

    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays);
    let out;
    const f = hijriFmt();
    if (f) {
        const parts = f.formatToParts(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12)));
        const g = {};
        for (const p of parts) g[p.type] = p.value;
        out = { y: parseInt(g.year, 10), m: parseInt(g.month, 10), d: parseInt(g.day, 10) };
    } else {
        out = jdToHijri(gToJD(d.getFullYear(), d.getMonth() + 1, d.getDate()) + 0.5);
    }
    cache.set(key, out);
    return out;
}

export function hijriLabel(h, withH = true) {
    return `${h.d} ${HIJRI_MONTHS[h.m - 1] || ''} ${h.y}${withH ? ' H' : ''}`;
}

export function hijriIso(h) {
    return `${h.y}-${pad(h.m)}-${pad(h.d)}`;
}

export function tanggalId(date) {
    const hari = HARI_ID[['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()]];
    return `${hari}, ${date.getDate()} ${BULAN_ID[date.getMonth()]} ${date.getFullYear()}`;
}

export function tanggalIdShort(date) {
    return `${date.getDate()} ${BULAN_ID[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}

/**
 * Cari hari besar berikutnya (berulang tahunan secara Hijriah
 * atau bertanggal Masehi tetap).
 * @param {Array} holidays daftar dari API
 * @param {Date} from
 * @param {number} days
 * @param {number} limit
 * @param {number} hijriOffset
 */
export function nextHolidays(holidays = [], from = new Date(), days = 400, limit = 6, hijriOffset = 0) {
    if (!Array.isArray(holidays) || !holidays.length) return [];
    const byHijri = new Map();
    const fixed = new Map();
    for (const h of holidays) {
        if (h.active === 0 || h.active === false) continue;
        const hm = Number(h.hijri_month), hd = Number(h.hijri_day);
        if (hm > 0 && hd > 0) {
            const k = `${hm}-${hd}`;
            if (!byHijri.has(k)) byHijri.set(k, []);
            byHijri.get(k).push(h);
        }
        if (h.gregorian_date) {
            if (!fixed.has(h.gregorian_date)) fixed.set(h.gregorian_date, []);
            fixed.get(h.gregorian_date).push(h);
        }
    }

    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const out = [];
    for (let i = 0; i <= days; i++) {
        const dt = addDays(start, i);
        const key = ymd(dt);
        const h = toHijri(start, i + hijriOffset);
        const hk = `${h.m}-${h.d}`;
        const cands = [...(byHijri.get(hk) || []), ...(fixed.get(key) || [])];
        for (const c of cands) {
            out.push({
                id: c.id,
                name: c.name,
                description: c.description || '',
                date: key,
                hijri: hijriIso(h),
                hijriLabel: hijriLabel(h),
                daysLeft: i,
                isToday: i === 0,
                dateLabel: tanggalId(dt),
            });
            if (out.length >= limit) return out;
        }
    }
    return out;
}

/* ---------------- Hari besar bawaan (bila server belum siap) --------- */
export const DEFAULT_HOLIDAYS = [
    { id: 1, name: 'Tahun Baru Islam (1 Muharram)', hijri_month: 1, hijri_day: 1, description: 'Awal tahun Hijriah', active: 1 },
    { id: 2, name: 'Hari Asyura', hijri_month: 1, hijri_day: 10, description: 'Puasa sunnah Asyura', active: 1 },
    { id: 3, name: 'Maulid Nabi Muhammad SAW', hijri_month: 3, hijri_day: 12, description: 'Kelahiran Rasulullah SAW', active: 1 },
    { id: 4, name: "Isra Mi'raj Nabi Muhammad SAW", hijri_month: 7, hijri_day: 27, description: 'Perjalanan malam Rasulullah SAW', active: 1 },
    { id: 5, name: "Nisfu Sya'ban", hijri_month: 8, hijri_day: 15, description: "Pertengahan bulan Sya'ban", active: 1 },
    { id: 6, name: 'Awal Ramadhan', hijri_month: 9, hijri_day: 1, description: 'Hari pertama puasa Ramadhan', active: 1 },
    { id: 7, name: "Nuzulul Qur'an", hijri_month: 9, hijri_day: 17, description: "Turunnya Al-Qur'an", active: 1 },
    { id: 8, name: 'Lailatul Qadar (perkiraan)', hijri_month: 9, hijri_day: 27, description: 'Malam seribu bulan', active: 1 },
    { id: 9, name: 'Idul Fitri', hijri_month: 10, hijri_day: 1, description: '1 Syawal — Hari Raya Idul Fitri', active: 1 },
    { id: 10, name: 'Hari Arafah', hijri_month: 12, hijri_day: 9, description: 'Puasa sunnah Arafah', active: 1 },
    { id: 11, name: 'Idul Adha', hijri_month: 12, hijri_day: 10, description: '10 Dzulhijjah — Hari Raya Idul Adha', active: 1 },
];

/** Ucapan salam sesuai waktu */
export function greeting(hour) {
    if (hour >= 3 && hour < 10) return 'Selamat pagi';
    if (hour >= 10 && hour < 15) return 'Selamat siang';
    if (hour >= 15 && hour < 18) return 'Selamat sore';
    return 'Selamat malam';
}
