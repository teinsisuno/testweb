/* Masuk lalu tangkap layar panel admin */
const PORT = process.env.CDP_PORT || 9222;
const BASE = process.argv[2] || 'http://127.0.0.1:8099/';
const OUT = process.argv[3] || '/tmp/admin.png';
const HASH = process.argv[4] || '#/admin/masjid';
const W = Number(process.argv[5] || 1600);
const H = Number(process.argv[6] || 1000);
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    let list;
    for (let i = 0; i < 40; i++) {
        try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) break; } catch {}
        await sleep(400);
    }
    const page = list.find(t => t.type === 'page') || list[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0; const pending = new Map(); const logs = [];
    const send = (method, params = {}) => new Promise((res) => {
        const myId = ++id; pending.set(myId, res);
        ws.send(JSON.stringify({ id: myId, method, params }));
    });
    await new Promise(r => { ws.onopen = r; });
    ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('ERR ' + (m.params.args || []).map(a => a.value ?? a.description).join(' '));
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

    await send('Page.navigate', { url: BASE + 'index.html' });
    await sleep(5000);
    const login = await send('Runtime.evaluate', {
        expression: `fetch('api/auth.php?action=login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'admin123'})}).then(r=>r.text())`,
        returnByValue: true, awaitPromise: true,
    });
    console.log('login:', String(login.result?.result?.value || '').slice(0, 120));

    await send('Page.navigate', { url: BASE + 'index.html?shot=' + Date.now() + HASH });
    await sleep(6500);

    const chk = await send('Runtime.evaluate', {
        expression: `JSON.stringify({hash: location.hash, path: window.__jjs?.route?.path, auth: window.__jjs?.state?.auth?.authenticated, root: document.getElementById('app').firstElementChild?.className})`,
        returnByValue: true,
    });
    console.log('state:', chk.result?.result?.value);

    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT, Buffer.from(r.result.data, 'base64'));
    console.log('saved ' + OUT + (logs.length ? '\n' + logs.join('\n') : ''));
    ws.close();
    process.exit(0);
}
main();
