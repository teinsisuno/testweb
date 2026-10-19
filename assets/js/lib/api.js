/* Klien REST API + cache offline */
import { cacheGet, cacheSet } from './db.js';

export const API_BASE = 'api/';

export function qs(params = {}) {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, v);
    const s = u.toString();
    return s ? '?' + s : '';
}

async function request(path, { method = 'GET', body, timeout = 20000, raw = false } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
        const opts = { method, signal: ctrl.signal, headers: {}, credentials: 'same-origin', cache: 'no-store' };
        if (body instanceof FormData) {
            opts.body = body;
        } else if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const res = await fetch(API_BASE + path, opts);
        if (raw) return res;
        let data = null;
        try { data = await res.json(); } catch { data = { ok: false, message: 'Respons tidak valid' }; }
        if (!res.ok && data && data.ok !== false) data.ok = false;
        if (!res.ok) {
            const e = new Error(data?.message || `HTTP ${res.status}`);
            e.status = res.status; e.code = data?.error; e.data = data;
            throw e;
        }
        return data;
    } finally {
        clearTimeout(t);
    }
}

/** GET dengan cache IndexedDB (stale-while-revalidate). */
export async function apiGet(path, params = {}, { cacheKey, ttl = 0, timeout } = {}) {
    const url = path + qs(params);
    const key = cacheKey || ('api:' + url);
    try {
        const data = await request(url, { timeout });
        if (data && data.ok !== false) await cacheSet(key, data, ttl);
        return { ...data, _offline: false };
    } catch (err) {
        const cached = await cacheGet(key);
        if (cached) return { ...cached, _offline: true, _stale: true };
        throw err;
    }
}

export async function apiPost(path, body, params = {}, { timeout } = {}) {
    return request(path + qs(params), { method: 'POST', body, timeout });
}

/* --------------------- Endpoint spesifik --------------------- */
export const Api = {
    bootstrap: () => apiGet('data.php', { action: 'bootstrap' }, { cacheKey: 'bootstrap', ttl: 0 }),
    ping: () => apiGet('data.php', { action: 'ping' }, { cacheKey: 'ping', ttl: 30000 }),

    settingsGet: () => apiGet('settings.php', { action: 'get' }, { cacheKey: 'settings', ttl: 0 }),
    settingsSave: (settings) => apiPost('settings.php', { settings }, { action: 'save' }),
    settingsReset: () => apiPost('settings.php', {}, { action: 'reset' }),

    authStatus: () => apiGet('auth.php', { action: 'status' }, { cacheKey: 'auth', ttl: 0 }),
    login: (username, password) => apiPost('auth.php', { username, password }, { action: 'login' }),
    logout: () => apiPost('auth.php', {}, { action: 'logout' }),
    changePassword: (oldPassword, newPassword) => apiPost('auth.php', { oldPassword, newPassword }, { action: 'change_password' }),
    changeProfile: (username, name, password) => apiPost('auth.php', { username, name, password }, { action: 'change_profile' }),
    listUsers: () => apiGet('auth.php', { action: 'list_users' }),
    addUser: (u) => apiPost('auth.php', u, { action: 'add_user' }),
    deleteUser: (id) => apiPost('auth.php', { id }, { action: 'delete_user' }),

    kotaCari: (q) => apiGet('prayer.php', { action: 'kota', q }, { cacheKey: 'kota:' + q.toLowerCase(), ttl: 2592000000 }),
    kotaAll: () => apiGet('prayer.php', { action: 'kota_all' }, { cacheKey: 'kota_all', ttl: 2592000000 }),
    jadwal: (id, y, m, d) => apiGet('prayer.php', { action: 'jadwal', id, y, m, d }, { cacheKey: `jadwal:${id}:${y}-${m}-${d}`, ttl: 86400000 }),
    jadwalBulan: (id, y, m) => apiGet('prayer.php', { action: 'jadwal_bulan', id, y, m }, { cacheKey: `jadwalbulan:${id}:${y}-${m}`, ttl: 2592000000 }),
    jadwalRange: (id, from, to) => apiGet('prayer.php', { action: 'range', id, from, to }, { cacheKey: `jadwalrange:${id}:${from}:${to}`, ttl: 3600000 }),
    sync: (id, months = 3) => apiPost('prayer.php', {}, { action: 'sync', id, months }),
    geocode: (lat, lng) => apiGet('prayer.php', { action: 'geocode', lat, lng }, { cacheKey: `geo:${lat.toFixed(3)}:${lng.toFixed(3)}`, ttl: 2592000000 }),
    kiblat: (lat, lng) => apiGet('prayer.php', { action: 'kiblat', lat, lng }, { cacheKey: `kiblat:${lat}:${lng}` }),

    mediaList: () => apiGet('media.php', { action: 'list' }, { cacheKey: 'media', ttl: 0 }),
    mediaAddUrl: (m) => apiPost('media.php', m, { action: 'add_url' }),
    mediaUpdate: (m) => apiPost('media.php', m, { action: 'update' }),
    mediaDelete: (id) => apiPost('media.php', { id }, { action: 'delete' }),
    mediaReorder: (order) => apiPost('media.php', { order }, { action: 'reorder' }),
    mediaUpload: (formData, onProgress) => new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', API_BASE + 'media.php?action=upload');
        xhr.withCredentials = true;
        xhr.upload.onprogress = e => onProgress && onProgress(e.lengthComputable ? e.loaded / e.total : 0);
        xhr.onload = () => {
            try {
                const d = JSON.parse(xhr.responseText);
                if (d.ok) resolve(d); else reject(new Error(d.message || 'Gagal mengunggah'));
            } catch { reject(new Error('Respons tidak valid')); }
        };
        xhr.onerror = () => reject(new Error('Koneksi gagal'));
        xhr.send(formData);
    }),

    rtList: () => apiGet('runningtext.php', { action: 'list' }, { cacheKey: 'rt', ttl: 0 }),
    rtAdd: (text, active = 1) => apiPost('runningtext.php', { text, active }, { action: 'add' }),
    rtUpdate: (o) => apiPost('runningtext.php', o, { action: 'update' }),
    rtDelete: (id) => apiPost('runningtext.php', { id }, { action: 'delete' }),
    rtReorder: (order) => apiPost('runningtext.php', { order }, { action: 'reorder' }),

    holList: () => apiGet('holidays.php', { action: 'list' }, { cacheKey: 'hol', ttl: 0 }),
    holUpcoming: (limit = 8) => apiGet('holidays.php', { action: 'upcoming', limit }, { cacheKey: 'holup', ttl: 86400000 }),
    holToday: () => apiGet('holidays.php', { action: 'today' }, { cacheKey: 'holtoday', ttl: 3600000 }),
    holAdd: (o) => apiPost('holidays.php', o, { action: 'add' }),
    holUpdate: (o) => apiPost('holidays.php', o, { action: 'update' }),
    holDelete: (id) => apiPost('holidays.php', { id }, { action: 'delete' }),
    holReset: () => apiPost('holidays.php', {}, { action: 'reset' }),

    sysInfo: () => apiGet('system.php', { action: 'info' }, { cacheKey: 'sysinfo', ttl: 0 }),
    sysLogs: (limit = 200) => apiGet('system.php', { action: 'logs', limit }, { cacheKey: 'logs' }),
    sysClearLogs: () => apiPost('system.php', {}, { action: 'clear_logs' }),
    sysClearCache: () => apiPost('system.php', {}, { action: 'clear_cache' }),
    sysClearPrayerCache: () => apiPost('system.php', {}, { action: 'clear_prayer_cache' }),
    sysOptimize: () => apiPost('system.php', {}, { action: 'optimize' }),
    sysTestUpstream: () => apiPost('system.php', {}, { action: 'test_upstream' }),
};

/** Unggah berkas dengan field tambahan; kind='logo' agar tidak masuk daftar media. */
export function uploadFile(file, extra = {}, onProgress) {
    return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', file);
        for (const [k, v] of Object.entries(extra)) fd.append(k, v);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', API_BASE + 'media.php?action=upload');
        xhr.withCredentials = true;
        xhr.upload.onprogress = e => onProgress && onProgress(e.lengthComputable ? e.loaded / e.total : 0);
        xhr.onload = () => {
            try {
                const d = JSON.parse(xhr.responseText);
                if (d.ok) resolve(d); else reject(new Error(d.message || 'Gagal mengunggah'));
            } catch { reject(new Error('Respons tidak valid')); }
        };
        xhr.onerror = () => reject(new Error('Koneksi gagal'));
        xhr.send(fd);
    });
}
