/* Tangkapan layar via CDP */
const PORT = process.env.CDP_PORT || 9222;
const URL_TARGET = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const OUT = process.argv[3] || '/tmp/shot.png';
const W = Number(process.argv[4] || 1920);
const H = Number(process.argv[5] || 1080);
const WAIT = Number(process.argv[6] || 6000);
const fs = require('fs');

async function main() {
    let list;
    for (let i = 0; i < 40; i++) {
        try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) break; } catch {}
        await new Promise(r => setTimeout(r, 400));
    }
    const page = list.find(t => t.type === 'page') || list[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0; const pending = new Map();
    const send = (method, params = {}) => new Promise((res) => {
        const myId = ++id; pending.set(myId, res);
        ws.send(JSON.stringify({ id: myId, method, params }));
    });
    await new Promise(r => { ws.onopen = r; });
    ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: URL_TARGET });
    await new Promise(r => setTimeout(r, WAIT));
    const PRE = process.argv[7];
    if (PRE) {
        const pr = await send('Runtime.evaluate', { expression: PRE, returnByValue: true, awaitPromise: true });
        console.log('pre-script:', JSON.stringify(pr.result?.result?.value ?? pr.result?.value ?? null).slice(0, 300));
        await new Promise(r => setTimeout(r, 3500));
    }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    if (r.result && r.result.data) {
        fs.writeFileSync(OUT, Buffer.from(r.result.data, 'base64'));
        console.log('saved ' + OUT);
    } else {
        console.log('gagal', JSON.stringify(r).slice(0, 300));
    }
    ws.close();
    process.exit(0);
}
main();
