/* Admin — Sistem & Data */
import { Api, API_BASE } from '../../lib/api.js';
import { state, toast, saveSettings, bootstrap } from '../../store.js';
import { fmtBytes } from '../../lib/util.js';
import { idbClear } from '../../lib/db.js';
import { prefetch } from '../../lib/schedule.js';

export default {
    name: 'SystemSection',
    props: { settings: Object },

    data() {
        return { info: null, logs: [], busy: false, importText: '', pwa: null, syncing: false, syncPct: 0, swVersion: '' };
    },

    computed: {
        loc() { return this.settings.location || {}; },
        db() { return state.serverInfo; },
        state() { return state; },
    },

    methods: {
        fmtBytes,
        async load() {
            try { this.info = await Api.sysInfo(); } catch { /* offline */ }
            try { const r = await Api.sysLogs(120); this.logs = r.logs || []; } catch { this.logs = []; }
        },
        async clearLogs() {
            try { await Api.sysClearLogs(); this.logs = []; toast('Log dibersihkan.', 'ok'); } catch (e) { toast(e.message, 'err'); }
        },
        async clearCache() {
            try {
                const r = await Api.sysClearCache();
                await idbClear('api:');
                await idbClear('prayer:');
                toast(r.message || 'Cache dibersihkan.', 'ok');
                await this.load();
            } catch (e) { toast(e.message || 'Gagal membersihkan cache.', 'err'); }
        },
        async clearPrayerCache() {
            if (!confirm('Hapus cache jadwal sholat di server? Jadwal akan diambil ulang saat online.')) return;
            try { const r = await Api.sysClearPrayerCache(); toast(r.message, 'ok'); await this.load(); } catch (e) { toast(e.message, 'err'); }
        },
        async optimize() {
            try { const r = await Api.sysOptimize(); toast(r.message, 'ok'); } catch (e) { toast(e.message, 'err'); }
        },
        async testUpstream() {
            this.busy = true;
            try {
                const r = await Api.sysTestUpstream();
                toast(r.reachable ? 'API Kemenag dapat diakses.' : 'API Kemenag tidak dapat diakses.', r.reachable ? 'ok' : 'err');
            } catch (e) { toast(e.message || 'Gagal menguji.', 'err'); }
            finally { this.busy = false; }
        },
        async exportSettings() {
            const blob = new Blob([JSON.stringify(state.settings, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'pengaturan-jam-sholat.json';
            a.click();
            URL.revokeObjectURL(a.href);
        },
        async importSettings(file) {
            if (!file) return;
            try {
                const text = await file.text();
                const obj = JSON.parse(text);
                await saveSettings(obj, { silent: true });
                this.settings = state.settings;
                toast('Pengaturan berhasil diimpor. Muat ulang halaman.', 'ok', 6000);
            } catch (e) { toast('Berkas tidak valid: ' + e.message, 'err'); }
        },
        onImportPick(e) { this.importSettings(e.target.files?.[0]); e.target.value = ''; },
        async syncNow() {
            if (!this.loc.kotaId) { toast('Pilih kota terlebih dahulu.', 'err'); return; }
            this.syncing = true; this.syncPct = 0;
            try {
                const r = await prefetch(this.loc.kotaId, 3, p => { this.syncPct = Math.round(p * 100); });
                toast(`Selesai: ${r.ok} bulan tersimpan offline.`, 'ok');
                await this.load();
            } catch (e) { toast(e.message || 'Gagal sinkronisasi.', 'err'); }
            finally { this.syncing = false; this.syncPct = 0; }
        },
        async refreshData() {
            await bootstrap({ force: true });
            await this.load();
            toast('Data dimuat ulang.', 'ok');
        },
        async installPwa() {
            const ev = this.pwa;
            if (!ev) { toast('Gunakan menu browser → “Install / Tambahkan ke layar utama”.', 'info', 6000); return; }
            ev.prompt();
            const { outcome } = await ev.userChoice;
            this.pwa = null;
            toast(outcome === 'accepted' ? 'Aplikasi dipasang.' : 'Pemasangan dibatalkan.', outcome === 'accepted' ? 'ok' : 'info');
        },
        async updateSw() {
            if (!('serviceWorker' in navigator)) return;
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) { toast('Service worker belum terdaftar.', 'info'); return; }
            await reg.update();
            toast('Memeriksa pembaruan…', 'info');
            setTimeout(() => location.reload(), 900);
        },
    },

    mounted() {
        this.load();
        window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.pwa = e; });
    },

    template: `
<div>
    <h2>Sistem &amp; Data</h2>
    <p class="page-sub">Informasi server, cadangan pengaturan, dan pemeliharaan aplikasi.</p>

    <div class="grid cols-2">
        <div class="card">
            <h3>Informasi</h3>
            <div class="kv"><span>Aplikasi</span><b>v{{ info?.appVersion || '—' }}</b></div>
            <div class="kv"><span>PHP</span><b>{{ info?.phpVersion || '—' }}</b></div>
            <div class="kv"><span>SQLite</span><b>{{ info?.sqliteVersion || '—' }}</b></div>
            <div class="kv"><span>Zona waktu server</span><b>{{ info?.timezone || '—' }}</b></div>
            <div class="kv"><span>Ukuran basis data</span><b>{{ fmtBytes(info?.dbSize || 0) }}</b></div>
            <div class="kv"><span>Cache API</span><b>{{ info?.cacheFiles || 0 }} berkas · {{ fmtBytes(info?.cacheSize || 0) }}</b></div>
            <div class="kv"><span>Berkas media</span><b>{{ info?.uploadFiles || 0 }} berkas · {{ fmtBytes(info?.uploadSize || 0) }}</b></div>
        </div>

        <div class="card">
            <h3>Statistik</h3>
            <div class="kv"><span>Pengguna</span><b>{{ info?.stats?.users ?? '—' }}</b></div>
            <div class="kv"><span>Media slideshow</span><b>{{ info?.stats?.media ?? '—' }}</b></div>
            <div class="kv"><span>Running text</span><b>{{ info?.stats?.runningText ?? '—' }}</b></div>
            <div class="kv"><span>Hari besar</span><b>{{ info?.stats?.holidays ?? '—' }}</b></div>
            <div class="kv"><span>Baris cache jadwal</span><b>{{ info?.stats?.prayerCache ?? '—' }}</b></div>
            <div class="kv"><span>Status koneksi</span><b>{{ state.online ? 'Online' : 'Offline' }}</b></div>
        </div>
    </div>

    <div class="card">
        <h3>Pemeliharaan</h3>
        <div class="row">
            <button class="btn btn-sm" @click="refreshData">⟳ Muat Ulang Data</button>
            <button class="btn btn-sm" @click="testUpstream" :disabled="busy">Uji Koneksi API Kemenag</button>
            <button class="btn btn-sm" @click="clearCache">Bersihkan Cache</button>
            <button class="btn btn-sm" @click="clearPrayerCache">Bersihkan Cache Jadwal</button>
            <button class="btn btn-sm" @click="optimize">Optimalkan Basis Data</button>
            <button class="btn btn-sm btn-ghost" @click="updateSw">Perbarui Aplikasi</button>
        </div>
        <div class="row" style="margin-top:.7rem">
            <button class="btn btn-sm" @click="syncNow" :disabled="syncing || !loc.kotaId">⤓ Sinkron Jadwal 3 Bulan</button>
            <div v-if="syncing" class="progress" style="flex:1;min-width:120px"><i :style="{width: syncPct + '%'}"></i></div>
        </div>
    </div>

    <div class="grid cols-2">
        <div class="card">
            <h3>Cadangan Pengaturan</h3>
            <div class="row">
                <button class="btn btn-sm" @click="exportSettings">⬇ Ekspor JSON</button>
                <label class="btn btn-sm" style="cursor:pointer">
                    ⬆ Impor JSON
                    <input type="file" accept="application/json" class="hidden" @change="onImportPick" />
                </label>
                <a class="btn btn-sm btn-ghost" :href="'api/settings.php?action=export'" target="_blank">Ekspor dari Server</a>
                <a class="btn btn-sm btn-ghost" :href="'api/system.php?action=db_download'" target="_blank">Unduh Basis Data</a>
            </div>
        </div>
        <div class="card">
            <h3>Aplikasi (PWA)</h3>
            <div class="row">
                <button class="btn btn-sm btn-primary" @click="installPwa">Pasang ke Perangkat</button>
                <span class="muted small">Aplikasi dapat dipasang dan dijalankan sepenuhnya offline.</span>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="row between">
            <h3 style="margin:0">Log Aktivitas</h3>
            <div class="row">
                <button class="btn btn-sm btn-ghost" @click="load">⟳</button>
                <button class="btn btn-sm btn-danger" @click="clearLogs">Bersihkan Log</button>
            </div>
        </div>
        <table class="tbl">
            <thead><tr><th>Waktu</th><th>Level</th><th>Pesan</th></tr></thead>
            <tbody>
                <tr v-for="l in logs" :key="l.id">
                    <td class="muted small mono">{{ l.created_at }}</td>
                    <td><span class="badge" :class="l.level === 'error' ? 'off' : 'info'">{{ l.level }}</span></td>
                    <td>{{ l.message }} <span class="muted small">{{ l.context }}</span></td>
                </tr>
                <tr v-if="!logs.length"><td colspan="3" class="muted">Belum ada log.</td></tr>
            </tbody>
        </table>
    </div>
</div>
`,
};
