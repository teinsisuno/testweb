/* =================================================================
   Store global (reactive) — pengaturan, media, running text,
   hari besar, auth, dan status koneksi.
   ================================================================= */
import { reactive, computed } from '../vendor/vue.esm-browser.prod.js';
import { Api } from './lib/api.js';
import { defaultSettings } from './lib/defaults.js';
import { deepMerge, deepClone } from './lib/util.js';
import { nextHolidays, toHijri, hijriLabel, DEFAULT_HOLIDAYS } from './lib/hijri.js';

const LS_SETTINGS = 'jjs:settings';
const LS_PENDING = 'jjs:pending-settings';
const LS_BOOT = 'jjs:bootstrap';

export const state = reactive({
    ready: false,
    loading: true,
    settings: defaultSettings(),
    media: [],
    runningText: [],
    holidays: [],
    holidaysUpcoming: [],
    hijriToday: null,
    auth: { authenticated: false, user: null, defaultPassword: false, requireLogin: false },
    authChecked: false,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSync: null,
    fromCache: false,
    syncError: null,
    pendingSettings: false,
    toasts: [],
    serverInfo: null,
});

export const isLoggedIn = computed(() => !!state.auth.authenticated);
export const mosqueName = computed(() => state.settings?.mosque?.name || 'Masjid');
export const activeMedia = computed(() => (state.media || []).filter(m => Number(m.active) !== 0));
export const rtText = computed(() => {
    const sep = state.settings?.runningText?.separator ?? '  •  ';
    const items = (state.runningText || []).filter(t => Number(t.active) !== 0).map(t => String(t.text || '').trim()).filter(Boolean);
    return items.join(sep);
});

let toastId = 0;
export function toast(message, type = 'info', timeout = 4200) {
    const id = ++toastId;
    state.toasts.push({ id, message, type });
    setTimeout(() => {
        const i = state.toasts.findIndex(t => t.id === id);
        if (i >= 0) state.toasts.splice(i, 1);
    }, timeout);
    return id;
}

/* ---------------- Pengaturan lokal ---------------- */
function loadLocalSettings() {
    try {
        const raw = localStorage.getItem(LS_SETTINGS);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}
function persistLocalSettings(s) {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); } catch { /* penuh */ }
}
function loadLocalBootstrap() {
    try {
        const raw = localStorage.getItem(LS_BOOT);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
function persistBootstrap(data) {
    try { localStorage.setItem(LS_BOOT, JSON.stringify(data)); } catch { /* penuh */ }
}

function applyBootstrap(data, fromCache = false) {
    if (!data) return;
    if (data.settings) state.settings = deepMerge(defaultSettings(), data.settings);
    if (Array.isArray(data.media)) state.media = data.media;
    if (Array.isArray(data.runningText)) state.runningText = data.runningText;
    if (Array.isArray(data.holidays)) state.holidays = data.holidays;
    if (Array.isArray(data.holidaysUpcoming)) state.holidaysUpcoming = data.holidaysUpcoming;
    if (data.hijriToday) state.hijriToday = data.hijriToday;
    if (data.auth) state.auth = { ...state.auth, ...data.auth };
    if (data.user !== undefined) { state.auth.user = data.user; state.auth.authenticated = !!data.user; }
    if (data.authenticated !== undefined) state.auth.authenticated = !!data.authenticated;
    if (data.serverInfo) state.serverInfo = data.serverInfo;
    state.fromCache = fromCache;
    if (!fromCache && data.serverTime) state.lastSync = data.serverTime;
}

/** Muat seluruh data aplikasi (dengan cadangan cache bila offline). */
export async function bootstrap({ force = false } = {}) {
    state.loading = true;
    // 1) Muat lokal lebih dulu agar tampilan langsung muncul
    const local = loadLocalSettings();
    if (local) state.settings = deepMerge(defaultSettings(), local);
    const boot = loadLocalBootstrap();
    if (boot) {
        try { applyBootstrap(boot, true); } catch { /* diabaikan */ }
        state.ready = true;
    }

    // 2) Ambil dari server
    try {
        const data = await Api.bootstrap();
        // Gabungkan pengaturan lokal yang belum tersinkron (offline queue)
        if (state.pendingSettings && local) data.settings = deepMerge(data.settings || {}, local);
        applyBootstrap(data, !!data._offline);
        persistLocalSettings(state.settings);
        persistBootstrap({ ...data, _offline: undefined });
        state.syncError = null;

        // Kirim perubahan tertunda bila sudah tersambung
        if (state.pendingSettings && !data._offline) {
            try {
                await Api.settingsSave(state.settings);
                state.pendingSettings = false;
                localStorage.removeItem(LS_PENDING);
                toast('Perubahan lokal tersinkron ke server.', 'ok');
            } catch { /* tetap tertunda */ }
        }
    } catch (err) {
        state.syncError = err?.message || 'Gagal memuat data';
        if (!state.ready) {
            // benar-benar offline & belum ada cache: pakai hari besar bawaan
            state.holidays = DEFAULT_HOLIDAYS;
            state.ready = true;
        }
        recomputeHijri();
    }
    recomputeHijri();
    state.loading = false;
    state.ready = true;
    return state;
}

export function recomputeHijri(date = new Date()) {
    const off = Number(state.settings?.calc?.hijriOffset || 0);
    const h = toHijri(date, off);
    state.hijriToday = { hijri: h, label: hijriLabel(h) };
    const list = state.holidays?.length ? state.holidays : DEFAULT_HOLIDAYS;
    state.holidaysUpcoming = nextHolidays(list, date, 400, 8, off);
}

/** Simpan pengaturan (offline-first). */
export async function saveSettings(patch, { silent = false } = {}) {
    state.settings = deepMerge(state.settings, patch);
    persistLocalSettings(state.settings);
    try {
        const res = await Api.settingsSave(patch);
        if (res?.settings) {
            state.settings = deepMerge(defaultSettings(), res.settings);
            persistLocalSettings(state.settings);
        }
        state.pendingSettings = false;
        localStorage.removeItem(LS_PENDING);
        if (!silent) toast('Pengaturan tersimpan.', 'ok');
        return true;
    } catch (err) {
        state.pendingSettings = true;
        try { localStorage.setItem(LS_PENDING, '1'); } catch { /* diabaikan */ }
        if (!silent) toast('Disimpan lokal — akan disinkron saat online.', 'err');
        return false;
    }
}

export async function resetSettings() {
    try {
        const res = await Api.settingsReset();
        state.settings = deepMerge(defaultSettings(), res?.settings || {});
        persistLocalSettings(state.settings);
        toast('Pengaturan dikembalikan ke bawaan.', 'ok');
        await bootstrap({ force: true });
        return true;
    } catch {
        toast('Gagal mereset pengaturan.', 'err');
        return false;
    }
}

export async function refreshMedia() {
    try {
        const res = await Api.mediaList();
        state.media = res.media || [];
    } catch { /* diam */ }
}
export async function refreshRunningText() {
    try {
        const res = await Api.rtList();
        state.runningText = res.items || [];
    } catch { /* diam */ }
}
export async function refreshHolidays() {
    try {
        const res = await Api.holList();
        state.holidays = res.items || [];
        recomputeHijri();
    } catch { /* diam */ }
}

/* ---------------- Auth ---------------- */
export async function checkAuth() {
    try {
        const res = await Api.authStatus();
        state.auth = {
            authenticated: !!res.authenticated,
            user: res.user || null,
            defaultPassword: !!res.defaultPassword,
            requireLogin: !!res.requireLogin,
        };
    } catch {
        /* tetap gunakan status sebelumnya */
    } finally {
        state.authChecked = true;
    }
    return state.auth;
}

export async function login(username, password) {
    const res = await Api.login(username, password);
    state.auth = { ...state.auth, authenticated: true, user: res.user };
    return res;
}

export async function logout() {
    try { await Api.logout(); } catch { /* diam */ }
    state.auth = { ...state.auth, authenticated: false, user: null };
    try { localStorage.removeItem('jjs:display-unlocked'); } catch { /* diabaikan */ }
}

/* ---------------- Koneksi ---------------- */
export function initConnectivity() {
    const update = () => {
        state.online = navigator.onLine;
        if (state.online && state.pendingSettings) bootstrap({ force: true });
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
}
