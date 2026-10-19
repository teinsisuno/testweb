/* Evaluasi ekspresi di halaman via CDP */
const PORT = process.env.CDP_PORT || 9222;
const URL_TARGET = process.argv[2];
const EXPR = process.argv[3];
const WAIT = Number(process.argv[4] || 6000);

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
    await send('Page.navigate', { url: URL_TARGET });
    await new Promise(r => setTimeout(r, WAIT));
    const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true, awaitPromise: true });
    console.log(JSON.stringify(r.result, null, 2));
    ws.close();
    process.exit(0);
}
main();
