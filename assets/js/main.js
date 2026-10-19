/* =================================================================
   Titik masuk aplikasi: router hash, penskalaan tampilan, PWA.
   ================================================================= */
import { createApp, reactive, computed, watch, h } from '../vendor/vue.esm-browser.prod.js';
import { state, bootstrap, checkAuth, initConnectivity, toast } from './store.js';
import { audio } from './lib/audio.js';
import Display from './views/Display.js';
import Login from './views/Login.js';
import Admin from './views/Admin.js';

/* --------------------------- Router hash --------------------------- */
export const route = reactive({ path: normalize(location.hash) });
export const router = { Display, Login, Admin };

function normalize(hash) {
    let p = String(hash || '').replace(/^#/, '');
    if (!p.startsWith('/')) p = '/' + p;
    return p.replace(/\/+$/, '') || '/';
}
export function navigate(path, { replace = false } = {}) {
    const target = '#' + normalize(path);
    if (location.hash === target) return;
    if (replace) history.replaceState(null, '', target);
    else location.hash = target;
}
window.addEventListener('hashchange', () => { route.path = normalize(location.hash); });

/* ------------------------ Penskalaan rem --------------------------- */
const isAdminRoute = computed(() => route.path === '/admin' || route.path.startsWith('/admin/'));
const isLoginRoute = computed(() => route.path === '/login');
const isDisplayRoute = computed(() => !isAdminRoute.value && !isLoginRoute.value);

function applyScale() {
    const el = document.documentElement;
    if (!isDisplayRoute.value) { el.style.fontSize = ''; return; }
    const vw = window.innerWidth, vh = window.innerHeight;
    const landscape = vw >= vh;
    let scale = landscape ? Math.min(vw / 1920, vh / 1080) : Math.min(vw / 1080, vh / 1920);
    scale = landscape ? Math.max(0.42, Math.min(1.8, scale)) : Math.max(0.62, Math.min(1.4, scale));
    el.style.fontSize = (16 * scale).toFixed(3) + 'px';
    el.style.setProperty('--tv-scale', String(scale));
}
window.addEventListener('resize', applyScale);
window.addEventListener('orientationchange', () => setTimeout(applyScale, 120));
watch(isDisplayRoute, () => applyScale(), { immediate: true });

/* --------------------------- Aplikasi ------------------------------ */
const App = {
    components: { Display, Login, Admin },
    computed: {
        current() {
            if (!state.authChecked) return null;
            if (isLoginRoute.value) return 'Login';
            if (isAdminRoute.value) return state.auth.authenticated ? 'Admin' : 'Login';
            if (!state.auth.authenticated && state.settings?.display?.requireLogin) return 'Login';
            return 'Display';
        },
        toasts() { return state.toasts; },
    },
    template: `
        <component :is="current" v-if="current" />
        <div v-else class="tv"><div class="ui"></div></div>
        <div class="toasts">
            <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">{{ t.message }}</div>
        </div>
    `,
    watch: {
        current(v) { if (v === 'Display') requestAnimationFrame(applyScale); },
    },
};
createApp(App).mount('#app');

/* --------------------------- Inisialisasi -------------------------- */
async function init() {
    initConnectivity();
    await bootstrap();
    await checkAuth();
    applyScale();

    const splash = document.getElementById('boot-splash');
    if (splash) { splash.classList.add('hide'); setTimeout(() => splash.remove(), 600); }

    const unlock = async () => {
        await audio.unlock();
        audio.setVolume(state.settings?.audio?.volume ?? 0.85);
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    setupWakeLock();

    if (state.settings?.display?.fullscreenOnStart) {
        const goFs = () => { document.documentElement.requestFullscreen?.().catch(() => {}); window.removeEventListener('pointerdown', goFs); };
        window.addEventListener('pointerdown', goFs);
    }
}

/* ------------------------- Wake Lock ------------------------------ */
let wakeLock = null;
function setupWakeLock() {
    if (!('wakeLock' in navigator)) return;
    const request = async () => {
        if (!state.settings?.display?.wakeLock) { try { wakeLock?.release(); } catch { /* */ } wakeLock = null; return; }
        try {
            if (document.visibilityState !== 'visible') return;
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        } catch { /* diabaikan */ }
    };
    document.addEventListener('visibilitychange', request);
    window.addEventListener('pointerdown', request, { once: true });
    request();
}

/* --------------------- Pintasan papan tombol ---------------------- */
window.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    const k = (e.key || '').toLowerCase();
    if (k === 'f') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
        else document.exitFullscreen?.().catch(() => {});
    } else if (k === 's' && !e.ctrlKey && !e.metaKey) {
        navigate(isAdminRoute.value ? '/' : '/admin');
    } else if (k === 'escape' && isAdminRoute.value) {
        navigate('/');
    }
});

/* ------------------------- Service Worker ------------------------- */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* diabaikan */ });
    });
}

window.__jjs = { navigate, route, state, toast };

init();
