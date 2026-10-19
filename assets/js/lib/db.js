/* IndexedDB sederhana (key-value) untuk mode offline-first */

const DB_NAME = 'jjs-db';
const STORE = 'kv';
let _dbp = null;

function open() {
    if (_dbp) return _dbp;
    _dbp = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(new Error('IndexedDB tidak tersedia'));
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return _dbp;
}

export async function idbGet(key) {
    try {
        const db = await open();
        return await new Promise((res, rej) => {
            const tx = db.transaction(STORE, 'readonly');
            const r = tx.objectStore(STORE).get(key);
            r.onsuccess = () => res(r.result ?? null);
            r.onerror = () => rej(r.error);
        });
    } catch { return null; }
}

export async function idbSet(key, value) {
    try {
        const db = await open();
        return await new Promise((res, rej) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(value, key);
            tx.oncomplete = () => res(true);
            tx.onerror = () => rej(tx.error);
        });
    } catch { return false; }
}

export async function idbDel(key) {
    try {
        const db = await open();
        return await new Promise((res) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(key);
            tx.oncomplete = () => res(true);
        });
    } catch { return false; }
}

export async function idbKeys(prefix = '') {
    try {
        const db = await open();
        return await new Promise((res) => {
            const tx = db.transaction(STORE, 'readonly');
            const r = tx.objectStore(STORE).getAllKeys();
            r.onsuccess = () => res((r.result || []).filter(k => String(k).startsWith(prefix)));
            r.onerror = () => res([]);
        });
    } catch { return []; }
}

export async function idbClear(prefix = '') {
    const keys = await idbKeys(prefix);
    await Promise.all(keys.map(idbDel));
    return keys.length;
}

/* ---- Bantu: simpan/ambil JSON dengan masa berlaku ---- */
export async function cacheSet(key, data, ttlMs = 0) {
    return idbSet(key, { data, ts: Date.now(), exp: ttlMs ? Date.now() + ttlMs : 0 });
}
export async function cacheGet(key) {
    const v = await idbGet(key);
    if (!v || typeof v !== 'object') return null;
    if (v.exp && Date.now() > v.exp) return null;
    return v.data;
}
