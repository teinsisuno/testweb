/* Utilitas umum */

export const pad = (n, l = 2) => String(n).padStart(l, '0');

/** Format detik -> "HH:MM:SS" atau "MM:SS" */
export function fmtDur(totalSeconds, withHours = true) {
    let s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    if (withHours && h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    if (withHours) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}

export function fmtClock(date, format = 24, withSeconds = false) {
    let h = date.getHours();
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    let ampm = '';
    if (Number(format) === 12) {
        ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
    }
    const hh = pad(h);
    return { hh, mm: m, ss: s, ampm, text: withSeconds ? `${hh}:${m}:${s}` : `${hh}:${m}` };
}

/** "HH:MM" -> detik sejak tengah malam */
export function hmToSec(hm) {
    if (!hm || typeof hm !== 'string') return null;
    const m = hm.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60;
}

/** detik -> "HH:MM" */
export function secToHM(sec) {
    let s = Math.round(sec);
    s = ((s % 86400) + 86400) % 86400;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${pad(h)}:${pad(m)}`;
}

export function ymd(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseYmd(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(date, n) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
}

export function startOfDay(date) {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    return d;
}

export function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

export function deepMerge(base, patch) {
    if (Array.isArray(patch)) return patch.slice();
    if (typeof patch !== 'object' || patch === null) return patch;
    const out = (typeof base === 'object' && base !== null && !Array.isArray(base)) ? { ...base } : {};
    for (const [k, v] of Object.entries(patch)) {
        out[k] = (typeof v === 'object' && v !== null && !Array.isArray(v) && typeof out[k] === 'object' && out[k] !== null)
            ? deepMerge(out[k], v) : (Array.isArray(v) ? v.slice() : v);
    }
    return out;
}

export function deepClone(o) { return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)); }

export function debounce(fn, ms = 300) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtBytes(n) {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

/** Offset jam zona waktu tertentu pada tanggal tertentu (mendukung DST). */
export function tzOffsetHours(timeZone, date = new Date()) {
    try {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: timeZone || undefined, hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        const map = {};
        for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
        let hour = parseInt(map.hour, 10);
        if (hour === 24) hour = 0;
        const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, hour, +map.minute, +map.second);
        return Math.round((asUTC - date.getTime()) / 900000) / 4;
    } catch {
        return -date.getTimezoneOffset() / 60;
    }
}

/** Waktu "sekarang" menurut zona waktu tertentu sebagai objek Date-like. */
export function nowInZone(timeZone) {
    if (!timeZone) return new Date();
    try {
        const dtf = new Intl.DateTimeFormat('en-CA', {
            timeZone, hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        const map = {};
        for (const p of dtf.formatToParts(new Date())) map[p.type] = p.value;
        let hour = parseInt(map.hour, 10); if (hour === 24) hour = 0;
        return new Date(+map.year, +map.month - 1, +map.day, hour, +map.minute, +map.second);
    } catch {
        return new Date();
    }
}

export function pickLang() {
    return (navigator.language || 'id').slice(0, 2);
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
