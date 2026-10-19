/* =================================================================
   Service Worker — offline-first
   - App shell di-precache
   - API: network-first, fallback cache
   - Aset: stale-while-revalidate
   ================================================================= */
const VERSION = 'jjs-v2.1.0';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const API_CACHE = `${VERSION}-api`;

const SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './assets/css/app.css',
    './assets/vendor/vue.esm-browser.prod.js',
    './assets/js/main.js',
    './assets/js/store.js',
    './assets/js/lib/util.js',
    './assets/js/lib/db.js',
    './assets/js/lib/api.js',
    './assets/js/lib/audio.js',
    './assets/js/lib/hijri.js',
    './assets/js/lib/prayer.js',
    './assets/js/lib/schedule.js',
    './assets/js/lib/defaults.js',
    './assets/js/views/Display.js',
    './assets/js/views/Login.js',
    './assets/js/views/Admin.js',
    './assets/js/views/admin/LocationSection.js',
    './assets/js/views/admin/ScheduleSection.js',
    './assets/js/views/admin/IqomahSection.js',
    './assets/js/views/admin/DisplaySection.js',
    './assets/js/views/admin/MediaSection.js',
    './assets/js/views/admin/TickerSection.js',
    './assets/js/views/admin/AudioSection.js',
    './assets/js/views/admin/HolidaySection.js',
    './assets/js/views/admin/AccountSection.js',
    './assets/js/views/admin/SystemSection.js',
    './assets/img/icon-192.png',
    './assets/img/icon-512.png',
    './assets/img/icon-maskable-512.png',
    './assets/img/apple-touch-icon.png',
    './assets/img/favicon.png',
    './assets/img/bg-1.jpg',
    './assets/img/bg-2.jpg',
    './assets/img/bg-3.jpg',
    './assets/img/bg-4.jpg',
    './assets/img/bg-5.jpg',
    './assets/audio/beep.wav',
    './assets/audio/notify.wav',
    './assets/audio/adzan.wav',
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL);
        await Promise.all(SHELL_ASSETS.map(async (url) => {
            try { await cache.add(new Request(url, { cache: 'reload' })); } catch { /* lewati berkas yang gagal */ }
        }));
        self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') self.skipWaiting();
    if (event.data === 'clearCache') {
        event.waitUntil((async () => {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
            const clients = await self.clients.matchAll();
            clients.forEach(c => c.postMessage('cacheCleared'));
        })());
    }
});

function isApi(url) {
    return url.pathname.includes('/api/') || url.searchParams.get('action');
}
function isUpload(url) {
    return url.pathname.includes('/uploads/');
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Permintaan lintas asal: biarkan jaringan (server memproksi API eksternal)
    if (url.origin !== self.location.origin) return;

    // Navigasi: network-first, fallback shell
    if (req.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const fresh = await fetch(req);
                const cache = await caches.open(SHELL);
                cache.put('./index.html', fresh.clone());
                return fresh;
            } catch {
                const cache = await caches.open(SHELL);
                return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
            }
        })());
        return;
    }

    // API: network-first, fallback cache
    if (isApi(url)) {
        event.respondWith((async () => {
            const cache = await caches.open(API_CACHE);
            try {
                const fresh = await fetch(req);
                if (fresh && fresh.ok) cache.put(req, fresh.clone());
                return fresh;
            } catch {
                const cached = await cache.match(req);
                if (cached) {
                    const headers = new Headers(cached.headers);
                    headers.set('X-From-SW-Cache', '1');
                    return new Response(await cached.blob(), { status: 200, headers });
                }
                return new Response(JSON.stringify({ ok: false, offline: true, message: 'Tidak ada koneksi dan tidak ada cache.' }), {
                    status: 503, headers: { 'Content-Type': 'application/json' },
                });
            }
        })());
        return;
    }

    // Aset & unggahan: stale-while-revalidate
    event.respondWith((async () => {
        const cache = await caches.open(isUpload(url) ? RUNTIME : SHELL);
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
            if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
            return res;
        }).catch(() => null);
        if (cached) { network.catch(() => {}); return cached; }
        const fresh = await network;
        if (fresh) return fresh;
        const runtime = await caches.open(RUNTIME);
        const any = await runtime.match(req);
        return any || new Response('', { status: 504, statusText: 'Offline' });
    })());
});
