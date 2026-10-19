/* Admin — Masjid & Lokasi */
import { Api, uploadFile } from '../../lib/api.js';
import { toast, bootstrap } from '../../store.js';
import { TIMEZONES } from '../../lib/defaults.js';
import { computeTimes, qiblaBearing, qiblaDistance } from '../../lib/prayer.js';
import { getDayTimes, prefetch } from '../../lib/schedule.js';

export default {
    name: 'LocationSection',
    props: { settings: Object, now: Date },

    data() {
        return {
            mode: this.settings.location?.mode || 'kota',
            q: '',
            results: [],
            searching: false,
            locating: false,
            uploading: false,
            uploadPct: 0,
            preview: null,
            kiblat: null,
            syncing: false,
            syncPct: 0,
            timezones: TIMEZONES,
        };
    },

    computed: {
        loc() { return this.settings.location || (this.settings.location = {}); },
        mosque() { return this.settings.mosque || (this.settings.mosque = {}); },
        modeLabel() {
            return { kota: 'Kota (API Kemenag)', geo: 'Geolokasi perangkat', manual: 'Koordinat manual' }[this.mode] || '';
        },
        previewList() {
            const order = ['imsak', 'subuh', 'syuruq', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'];
            const p = this.preview || {};
            return order.map(k => ({ k, label: (this.settings.labels && this.settings.labels[k]) || k, v: p[k] }));
        },
    },

    watch: {
        mode(v) { this.loc.mode = v; this.refreshPreview(); },
        'loc.lat'() { this.refreshPreview(); },
        'loc.lng'() { this.refreshPreview(); },
        'loc.timezone'() { this.refreshPreview(); },
    },

    methods: {
        async searchKota() {
            const q = this.q.trim();
            if (!q) return;
            this.searching = true;
            try {
                const res = await Api.kotaCari(q);
                this.results = res.data || [];
                if (!this.results.length) toast('Kota tidak ditemukan.', 'info');
            } catch (e) {
                toast(e.message || 'Gagal mencari kota (offline?)', 'err');
            } finally { this.searching = false; }
        },

        pickKota(k) {
            this.loc.mode = 'kota';
            this.mode = 'kota';
            this.loc.kotaId = String(k.id);
            this.loc.kotaName = k.lokasi;
            this.loc.provinsi = k.daerah || '';
            this.results = [];
            this.q = k.lokasi;
            toast(`Kota dipilih: ${k.lokasi}`, 'ok');
            this.refreshPreview();
        },

        async detectLocation() {
            if (!navigator.geolocation) { toast('Perangkat tidak mendukung geolokasi.', 'err'); return; }
            this.locating = true;
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude, longitude } = pos.coords;
                this.loc.lat = +latitude.toFixed(6);
                this.loc.lng = +longitude.toFixed(6);
                if (pos.coords.altitude) this.loc.elevasi = Math.round(pos.coords.altitude);
                try {
                    const g = await Api.geocode(latitude, longitude);
                    if (g.elevasi !== null && g.elevasi !== undefined) this.loc.elevasi = g.elevasi;
                    if (g.kotaId) {
                        this.loc.kotaId = String(g.kotaId);
                        this.loc.kotaName = g.kotaName || this.loc.kotaName;
                        this.loc.provinsi = g.provinsi || '';
                        this.loc.mode = 'kota';
                        this.mode = 'kota';
                        toast(`Lokasi terdeteksi: ${g.kotaName}`, 'ok');
                    } else {
                        this.loc.mode = 'geo';
                        this.mode = 'geo';
                        toast('Lokasi terdeteksi, memakai perhitungan koordinat.', 'info');
                    }
                    if (g.timezone) this.loc.timezone = g.timezone;
                    if (g.alamat && !/^\s*$/.test(g.alamat) && !this.mosque.address) this.mosque.address = '';
                    this.loc.alamat = g.alamat || '';
                } catch {
                    this.loc.mode = 'geo';
                    this.mode = 'geo';
                    toast('Koordinat disimpan (geocoding offline).', 'info');
                }
                this.refreshPreview();
                this.locating = false;
            }, (err) => {
                this.locating = false;
                toast('Gagal mengambil lokasi: ' + (err.message || 'izin ditolak'), 'err');
            }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
        },

        async uploadLogo(file) {
            if (!file) return;
            this.uploading = true; this.uploadPct = 0;
            try {
                const res = await uploadFile(file, { kind: 'logo', title: 'logo' }, p => { this.uploadPct = Math.round(p * 100); });
                this.mosque.logo = res.src;
                toast('Logo diunggah.', 'ok');
            } catch (e) { toast(e.message || 'Gagal mengunggah logo.', 'err'); }
            finally { this.uploading = false; this.uploadPct = 0; }
        },

        onLogoPick(e) { const f = e.target.files?.[0]; if (f) this.uploadLogo(f); },

        async refreshPreview() {
            try {
                const dummy = { ...this.settings };
                const t = await getDayTimes(new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate()), dummy);
                this.preview = t;
            } catch { this.preview = null; }
            try {
                this.kiblat = { bearing: qiblaBearing(this.loc.lat, this.loc.lng), distance: qiblaDistance(this.loc.lat, this.loc.lng) };
            } catch { this.kiblat = null; }
        },

        async doSync() {
            if (!this.loc.kotaId) { toast('Pilih kota terlebih dahulu.', 'err'); return; }
            this.syncing = true; this.syncPct = 0;
            try {
                const r = await prefetch(this.loc.kotaId, 3, (p) => { this.syncPct = Math.round(p * 100); });
                toast(`Jadwal 3 bulan tersimpan untuk offline (${r.ok} bulan).`, 'ok');
            } catch (e) { toast(e.message || 'Gagal sinkronisasi.', 'err'); }
            finally { this.syncing = false; this.syncPct = 0; }
        },
    },

    mounted() { this.refreshPreview(); },

    template: `
<div>
    <h2>Masjid &amp; Lokasi</h2>
    <p class="page-sub">Identitas masjid dan sumber jadwal sholat.</p>

    <div class="card">
        <h3>Identitas Masjid</h3>
        <div class="grid cols-2">
            <div class="field">
                <label>Nama Masjid</label>
                <input class="input" v-model="mosque.name" placeholder="Masjid Az Zamzam" />
            </div>
            <div class="field">
                <label>Logo (opsional)</label>
                <div class="row">
                    <img v-if="mosque.logo" :src="mosque.logo" style="width:48px;height:48px;object-fit:cover;border-radius:.5rem;background:#1b2536" />
                    <input type="file" accept="image/*" @change="onLogoPick" />
                    <button v-if="mosque.logo" class="btn btn-sm btn-ghost" @click="mosque.logo=''">Hapus</button>
                </div>
                <div v-if="uploading" class="progress" style="margin-top:.4rem"><i :style="{width: uploadPct + '%'}"></i></div>
            </div>
        </div>
        <div class="field">
            <label>Alamat</label>
            <input class="input" v-model="mosque.address" placeholder="Jl. Cisaranten Kulon No. 18, Arcamanik, Bandung" />
        </div>
    </div>

    <div class="card">
        <h3>Sumber Jadwal Sholat</h3>
        <div class="tabs">
            <button :class="{active: mode==='kota'}" @click="mode='kota'">Kota (API Kemenag)</button>
            <button :class="{active: mode==='geo'}" @click="mode='geo'">Geolokasi</button>
            <button :class="{active: mode==='manual'}" @click="mode='manual'">Koordinat Manual</button>
        </div>

        <div v-if="mode==='kota'">
            <div class="field picker">
                <label>Cari Kota/Kabupaten</label>
                <div class="row">
                    <input class="input" v-model="q" placeholder="cth. bandung" @keyup.enter="searchKota" style="flex:1" />
                    <button class="btn" @click="searchKota" :disabled="searching">{{ searching ? '…' : 'Cari' }}</button>
                </div>
                <div class="list" v-if="results.length">
                    <button v-for="k in results" :key="k.id" @click="pickKota(k)">
                        {{ k.lokasi }} <span class="muted small">· {{ k.daerah || '' }}</span>
                    </button>
                </div>
            </div>
            <div class="kv"><span>Kota terpilih</span><b>{{ loc.kotaName || '—' }} (ID {{ loc.kotaId || '—' }})</b></div>
        </div>

        <div v-if="mode!=='kota'" class="grid cols-2">
            <div class="field"><label>Lintang (Latitude)</label><input class="input" type="number" step="0.000001" v-model.number="loc.lat" /></div>
            <div class="field"><label>Bujur (Longitude)</label><input class="input" type="number" step="0.000001" v-model.number="loc.lng" /></div>
        </div>

        <div class="grid cols-3">
            <div class="field">
                <label>Zona Waktu</label>
                <select class="input" v-model="loc.timezone">
                    <option v-for="t in timezones" :key="t.id" :value="t.id">{{ t.label }}</option>
                </select>
            </div>
            <div class="field">
                <label>Ketinggian (m dpl)</label>
                <input class="input" type="number" v-model.number="loc.elevasi" />
                <span class="muted small">Memengaruhi waktu Syuruq &amp; Maghrib pada perhitungan offline.</span>
            </div>
            <div class="field">
                <label>&nbsp;</label>
                <button class="btn btn-block" @click="detectLocation" :disabled="locating">
                    {{ locating ? 'Mendeteksi…' : '📍 Deteksi Lokasi Saya' }}
                </button>
            </div>
        </div>

        <div class="row" style="margin-top:.6rem">
            <button class="btn btn-sm" @click="doSync" :disabled="syncing || !loc.kotaId">
                {{ syncing ? 'Menyinkron…' : '⤓ Simpan jadwal 3 bulan untuk offline' }}
            </button>
            <div v-if="syncing" class="progress" style="flex:1;min-width:120px"><i :style="{width: syncPct + '%'}"></i></div>
            <span class="muted small" v-else>Jadwal akan tetap tersedia walau internet mati.</span>
        </div>
        <p class="muted small" style="margin-top:.6rem" v-if="loc.alamat">Alamat terdeteksi: {{ loc.alamat }}</p>
    </div>

    <div class="card">
        <h3>Pratinjau Perhitungan Hari Ini</h3>
        <div class="grid cols-4">
            <div class="kv" v-for="it in previewList" :key="it.k">
                <span>{{ it.label }}</span><b class="mono">{{ it.v || '--:--' }}</b>
            </div>
        </div>
        <div class="hint-box" style="margin-top:.7rem">
            Sumber: <b>{{ preview?.source === 'kemenag' ? 'API Kemenag RI' : 'Perhitungan offline' }}</b>
            <span v-if="kiblat"> · Arah kiblat: <b>{{ kiblat.bearing.toFixed(1) }}°</b> dari Utara · {{ kiblat.distance.toFixed(0) }} km ke Ka'bah</span>
        </div>
    </div>
</div>
`,
};
