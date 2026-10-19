/* Uji offline-first: muat online, matikan jaringan, muat ulang, pastikan masih jalan */
const PORT = process.env.CDP_PORT || 9222;
const BASE = process.argv[2] || 'http://127.0.0.1:8099/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    let list;
    for (let i = 0; i < 40; i++) {
        try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) break; } catch {}
        await sleep(400);
    }
    const page = list.find(t => t.type === 'page') || list[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0; const pending = new Map(); const errors = [];
    const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    await new Promise(r => { ws.onopen = r; });
    ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

    console.log('1) Muat online…');
    await send('Page.navigate', { url: BASE + 'index.html' });
    await sleep(8000);

    const sw = await send('Runtime.evaluate', {
        expression: `navigator.serviceWorker.getRegistrations().then(r=>JSON.stringify({count:r.length, scope:r[0]?.scope, active: !!r[0]?.active}))`,
        returnByValue: true, awaitPromise: true,
    });
    console.log('   service worker:', sw.result?.result?.value);

    const caches0 = await send('Runtime.evaluate', {
        expression: `caches.keys().then(k=>caches.open(k.find(x=>x.includes('shell'))).then(c=>c.keys()).then(ks=>JSON.stringify({cacheKeys:k, entries:ks.length})))`,
        returnByValue: true, awaitPromise: true,
    });
    console.log('   cache:', caches0.result?.result?.value);

    console.log('2) Matikan jaringan & muat ulang…');
    await send('Network.emulateNetworkConditions', {
        offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    });
    await send('Page.reload', { ignoreCache: true });
    await sleep(9000);

    const res = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
            clock: (document.querySelector('.clock')||{}).textContent || null,
            mosque: (document.querySelector('.mosque-name')||{}).textContent || null,
            prayers: document.querySelectorAll('.prayer').length,
            imsak: (document.querySelector('.prayer .p-time')||{}).textContent || null,
            offlineBadge: !!document.querySelector('.offline-badge'),
            holiday: (document.querySelector('.pill-holiday')||{}).textContent || null,
            ticker: (document.querySelector('.ticker .track')||{}).textContent?.slice(0,40) || null,
        })`,
        returnByValue: true,
    });
    console.log('   DOM offline:', res.result?.result?.value);
    console.log('   error konsol:', errors.length ? errors.join(' | ') : '(bersih)');
    ws.close();
    process.exit(0);
}
main();
