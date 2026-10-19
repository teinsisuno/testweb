/* Admin — Jadwal Sholat: metode, koreksi, tampilan waktu */
import { Api } from '../../lib/api.js';
import { toast } from '../../store.js';
import { METHODS, computeTimes } from '../../lib/prayer.js';
import { KEYS } from '../../lib/schedule.js';
import { defaultSettings } from '../../lib/defaults.js';
import { hmToSec, secToHM } from '../../lib/util.js';

const PRIMARY = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];

export default {
    name: 'ScheduleSection',
    props: { settings: Object, now: Date },

    data() {
        return {
            methods: METHODS,
            keys: KEYS,
            primary: PRIMARY,
            apiTimes: null,
            apiSource: '',
            loadingApi: false,
            showAddFajar: true,
        };
    },

    computed: {
        calc() { return this.settings.calc || (this.settings.calc = {}); },
        offsets() { return this.settings.offsets || (this.settings.offsets = {}); },
        labels() { return this.settings.labels || (this.settings.labels = {}); },
        visible() { return this.settings.visible || (this.settings.visible = []); },
        loc() { return this.settings.location || {}; },

        effectiveList() {
            const base = this.apiTimes || this.calcTimes();
            const ihtiyat = base.source === 'kemenag' ? 0 : Number(this.calc.ihtiyat || 0);
            return this.keys.map(k => {
                let sec = hmToSec(base[k]);
                if (sec === null) return { key: k, raw: '--:--', final: '--:--' };
                if (ihtiyat) sec += (['syuruq', 'dhuha'].includes(k) ? -1 : 1) * ihtiyat * 60;
                const raw = secToHM(sec);
                const final = secToHM(sec + Number(this.offsets[k] || 0) * 60);
                return { key: k, raw, final, label: this.labels[k] || k, on: this.visible.includes(k) };
            });
        },
    },

    methods: {
        calcTimes() {
            const t = computeTimes(new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate()),
                this.loc.lat ?? -6.2, this.loc.lng ?? 106.8, this.loc.timezone || 'Asia/Jakarta', {
                fajrAngle: this.calc.fajrAngle ?? 20,
                ishaAngle: this.calc.ishaAngle ?? 18,
                asrFactor: this.calc.asrFactor ?? 1,
                imsakMinutes: this.calc.imsakMinutes ?? 10,
                dhuhaAngle: this.calc.dhuhaAngle ?? 7,
                elevation: this.loc.elevasi || 0,
            });
            t.fajar = t.subuh;
            return { ...t, source: 'calc' };
        },

        applyMethod() {
            const m = METHODS[this.calc.method];
            if (!m || this.calc.method === 'custom') return;
            this.calc.fajrAngle = m.fajr;
            this.calc.ishaAngle = m.isha;
            if (m.ishaInterval) this.calc.ishaAngle = 18;
            this.calc.asrFactor = this.calc.asrFactor || 1;
        },

        async loadApi() {
            if (!this.loc.kotaId) { toast('Pilih kota di menu Masjid & Lokasi.', 'err'); return; }
            this.loadingApi = true;
            try {
                const res = await Api.jadwal(this.loc.kotaId, this.now.getFullYear(), this.now.getMonth() + 1, this.now.getDate());
                const j = res?.data?.jadwal || res?.data;
                this.apiTimes = {
                    imsak: j.imsak, fajar: j.subuh, subuh: j.subuh, syuruq: j.terbit, dhuha: j.dhuha,
                    dzuhur: j.dzuhur, ashar: j.ashar, maghrib: j.maghrib, isya: j.isya,
                    source: 'kemenag',
                };
                this.apiSource = `${res?.data?.lokasi || this.loc.kotaName} — ${j.tanggal || ''}`;
                toast('Jadwal dari API Kemenag dimuat.', 'ok');
            } catch (e) {
                toast(e.message || 'Gagal memuat jadwal API.', 'err');
            } finally { this.loadingApi = false; }
        },

        toggleVisible(k, on) {
            const i = this.visible.indexOf(k);
            if (on && i < 0) this.visible.push(k);
            if (!on && i >= 0) this.visible.splice(i, 1);
        },

        resetOffsets() {
            this.settings.offsets = { imsak: 0, fajar: 0, subuh: 0, syuruq: 0, dhuha: 0, dzuhur: 0, ashar: 0, maghrib: 0, isya: 0 };
            toast('Koreksi waktu direset.', 'info');
        },
        resetLabels() {
            this.settings.labels = { ...defaultSettings().labels };
            toast('Nama waktu dikembalikan ke bawaan.', 'info');
        },
        moveVisible(k, dir) {
            const i = this.visible.indexOf(k);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= this.visible.length) return;
            const a = this.visible.slice();
            [a[i], a[j]] = [a[j], a[i]];
            this.settings.visible = a;
        },
    },

    mounted() { this.loadApi(); },

    template: `
<div>
    <h2>Jadwal Sholat</h2>
    <p class="page-sub">Sumber waktu, metode perhitungan, koreksi menit, dan urutan tampilan.</p>

    <div class="card">
        <h3>Sumber &amp; Metode</h3>
        <div class="grid cols-3">
            <div class="field">
                <label>Metode Perhitungan</label>
                <select class="input" v-model="calc.method" @change="applyMethod">
                    <option v-for="(m,id) in methods" :key="id" :value="id">{{ m.label }}</option>
                </select>
            </div>
            <div class="field">
                <label>Sudut Subuh (°)</label>
                <input class="input" type="number" step="0.1" v-model.number="calc.fajrAngle" :disabled="calc.method!=='custom'" />
            </div>
            <div class="field">
                <label>Sudut Isya (°)</label>
                <input class="input" type="number" step="0.1" v-model.number="calc.ishaAngle" :disabled="calc.method!=='custom'" />
            </div>
            <div class="field">
                <label>Imsak: Subuh − (menit)</label>
                <input class="input" type="number" v-model.number="calc.imsakMinutes" />
            </div>
            <div class="field">
                <label>Ketinggian Dhuha (°)</label>
                <input class="input" type="number" step="0.5" v-model.number="calc.dhuhaAngle" />
            </div>
            <div class="field">
                <label>Mazhab Ashar</label>
                <select class="input" v-model.number="calc.asrFactor">
                    <option :value="1">Standar (Syafi'i, Maliki, Hambali)</option>
                    <option :value="2">Hanafi</option>
                </select>
            </div>
            <div class="field">
                <label>Ihtiyat / Kehati-hatian (menit)</label>
                <input class="input" type="number" v-model.number="calc.ihtiyat" />
                <span class="muted small">Diterapkan hanya pada perhitungan offline.</span>
            </div>
            <div class="field">
                <label>Koreksi Tanggal Hijriah (hari)</label>
                <input class="input" type="number" v-model.number="calc.hijriOffset" />
            </div>
        </div>
    </div>

    <div class="card">
        <div class="row between">
            <h3 style="margin:0">Perbandingan &amp; Koreksi Waktu</h3>
            <div class="row">
                <button class="btn btn-sm" @click="loadApi" :disabled="loadingApi">{{ loadingApi ? '…' : 'Muat dari API Kemenag' }}</button>
                <button class="btn btn-sm btn-ghost" @click="resetOffsets">Reset Koreksi</button>
                <button class="btn btn-sm btn-ghost" @click="resetLabels">Reset Nama</button>
            </div>
        </div>
        <p class="card-sub" v-if="apiSource">Data API: {{ apiSource }}</p>
        <table class="tbl">
            <thead>
                <tr>
                    <th>Tampil</th><th>Waktu</th><th>Nama Label</th>
                    <th>Sumber</th><th>Koreksi (menit)</th><th>Hasil Akhir</th><th>Urutan</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(it, idx) in effectiveList" :key="it.key">
                    <td>
                        <label class="switch">
                            <input type="checkbox" :checked="it.on" @change="toggleVisible(it.key, $event.target.checked)" />
                            <span class="track"></span>
                        </label>
                    </td>
                    <td class="mono">{{ it.key }}</td>
                    <td><input class="input" style="padding:.3rem .5rem" v-model="labels[it.key]" /></td>
                    <td class="muted small">{{ apiTimes ? 'Kemenag' : 'Hitung offline' }}</td>
                    <td style="max-width:120px">
                        <input class="input" style="padding:.3rem .5rem" type="number" v-model.number="offsets[it.key]" />
                    </td>
                    <td><b class="mono">{{ it.final }}</b></td>
                    <td>
                        <button class="btn btn-sm btn-ghost" @click="moveVisible(it.key,-1)" title="Naik">↑</button>
                        <button class="btn btn-sm btn-ghost" @click="moveVisible(it.key,1)" title="Turun">↓</button>
                    </td>
                </tr>
            </tbody>
        </table>
        <div class="hint-box" style="margin-top:.7rem">
            Urutan tampilan di layar: <b>{{ visible.join(' → ') || '(kosong)' }}</b>.
            “Fajar” adalah alias Subuh yang dapat digeser sendiri bila ingin ditampilkan terpisah.
        </div>
    </div>
</div>
`,
};
