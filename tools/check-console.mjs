/* Pemeriksa konsol via Chrome DevTools Protocol (tanpa dependensi) */
const PORT = process.env.CDP_PORT || 9222;
const URL_TARGET = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const WAIT = Number(process.argv[3] || 9000);

async function main() {
    let list;
    for (let i = 0; i < 40; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
            list = await r.json();
            if (list.length) break;
        } catch { /* belum siap */ }
        await new Promise(r => setTimeout(r, 400));
    }
    if (!list || !list.length) { console.error('Tidak ada target CDP'); process.exit(2); }

    const page = list.find(t => t.type === 'page') || list[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const logs = [];
    let id = 0;
    const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));

    await new Promise((res) => { ws.onopen = res; });

    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
            logs.push({ type: msg.params.type, text: (msg.params.args || []).map(a => a.value ?? a.description ?? a.type).join(' ') });
        }
        if (msg.method === 'Runtime.exceptionThrown') {
            const d = msg.params.exceptionDetails;
            logs.push({ type: 'exception', text: (d.exception?.description || d.text) + ' @' + (d.url || '') + ':' + (d.lineNumber ?? '') });
        }
        if (msg.method === 'Log.entryAdded') {
            logs.push({ type: msg.params.entry.level, text: msg.params.entry.text + ' ' + (msg.params.entry.url || '') });
        }
    };

    send('Runtime.enable');
    send('Log.enable');
    send('Page.enable');
    send('Page.navigate', { url: URL_TARGET });

    await new Promise(r => setTimeout(r, WAIT));

    // Ambil ringkasan DOM
    send('Runtime.evaluate', {
        expression: `JSON.stringify({
            title: document.title,
            appHtmlLen: (document.getElementById('app')||{}).innerHTML?.length || 0,
            splash: !!document.getElementById('boot-splash'),
            clock: (document.querySelector('.clock')||{}).textContent || null,
            mosque: (document.querySelector('.mosque-name')||{}).textContent || null,
            prayers: document.querySelectorAll('.prayer').length,
            ticker: (document.querySelector('.ticker .track')||{}).textContent || null,
            holiday: (document.querySelector('.pill-holiday')||{}).textContent || null,
        })`,
        returnByValue: true,
    });

    const result = await new Promise((res) => {
        const handler = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.id === id) { ws.removeEventListener('message', handler); res(m.result); }
        };
        ws.addEventListener('message', handler);
        setTimeout(() => res(null), 4000);
    });

    console.log('--- KONSOL/ERROR ---');
    if (!logs.length) console.log('(bersih)');
    for (const l of logs) console.log(`[${l.type}] ${l.text}`);
    console.log('--- DOM ---');
    console.log(result?.result?.value || result?.value || JSON.stringify(result));
    ws.close();
    process.exit(0);
}
main();
