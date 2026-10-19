/* Admin — Iqomah, Waktu Hening, dan alur adzan */
import { toast } from '../../store.js';

const PRAYERS = [
    { key: 'fajar', label: 'Fajar' },
    { key: 'subuh', label: 'Subuh' },
    { key: 'dzuhur', label: 'Dzuhur' },
    { key: 'ashar', label: 'Ashar' },
    { key: 'maghrib', label: 'Maghrib' },
    { key: 'isya', label: "Isya'" },
];

export default {
    name: 'IqomahSection',
    props: { settings: Object },

    data() { return { prayers: PRAYERS }; },

    computed: {
        iqomah() { return this.settings.iqomah || (this.settings.iqomah = {}); },
        hening() { return this.settings.hening || (this.settings.hening = {}); },
        adzan() { return this.settings.adzan || (this.settings.adzan = {}); },
        audio() { return this.settings.audio || (this.settings.audio = {}); },
        display() { return this.settings.display || (this.settings.display = {}); },

        sampleTimeline() {
            return this.prayers.map(p => {
                const iq = Number(this.iqomah[p.key] || 0);
                const hn = Number(this.hening[p.key] || 0);
                const adz = Math.max(30, Number(this.audio.adzanDuration || 180));
                return {
                    key: p.key, label: p.label,
                    adzanMin: (adz / 60),
                    iqomahAt: iq,
                    heningEnd: iq > 0 ? iq + hn : hn,
                    aktif: iq > 0,
                };
            });
        },
    },

    methods: {
        presets(kind) {
            const val = kind === 'cepat' ? 5 : kind === 'sedang' ? 10 : 15;
            for (const p of this.prayers) if (this.iqomah[p.key] > 0) this.iqomah[p.key] = val;
            toast(`Durasi iqomah diset ${val} menit.`, 'ok');
        },
        resetAll() {
            this.settings.iqomah = { fajar: 10, subuh: 10, dhuha: 0, dzuhur: 10, ashar: 10, maghrib: 7, isya: 10 };
            this.settings.hening = { fajar: 10, subuh: 10, dhuha: 0, dzuhur: 10, ashar: 10, maghrib: 10, isya: 10 };
            toast('Nilai dikembalikan ke bawaan.', 'info');
        },
    },

    template: `
<div>
    <h2>Iqomah &amp; Waktu Hening</h2>
    <p class="page-sub">Atur hitung mundur azan → iqomah dan durasi waktu hening sholat berjamaah.</p>

    <div class="card">
        <div class="row between">
            <h3 style="margin:0">Durasi per Waktu Sholat</h3>
            <div class="row">
                <button class="btn btn-sm btn-ghost" @click="presets('cepat')">Semua 5 mnt</button>
                <button class="btn btn-sm btn-ghost" @click="presets('sedang')">Semua 10 mnt</button>
                <button class="btn btn-sm btn-ghost" @click="presets('lama')">Semua 15 mnt</button>
                <button class="btn btn-sm btn-ghost" @click="resetAll">Reset</button>
            </div>
        </div>
        <table class="tbl">
            <thead><tr><th>Waktu</th><th>Adzan (menit)</th><th>Iqomah (menit setelah adzan)</th><th>Waktu Hening (menit)</th><th>Status</th></tr></thead>
            <tbody>
                <tr v-for="row in sampleTimeline" :key="row.key">
                    <td><b>{{ row.label }}</b></td>
                    <td class="muted">{{ row.adzanMin.toFixed(1) }}</td>
                    <td style="max-width:170px"><input class="input" type="number" min="0" v-model.number="iqomah[row.key]" /></td>
                    <td style="max-width:170px"><input class="input" type="number" min="0" v-model.number="hening[row.key]" /></td>
                    <td>
                        <span class="badge" :class="row.aktif ? 'on' : 'off'">{{ row.aktif ? 'Adzan + Iqomah' : 'Tanpa iqomah' }}</span>
                    </td>
                </tr>
            </tbody>
        </table>
        <div class="hint-box" style="margin-top:.7rem">
            Alur: <b>Adzan</b> ({{ (Number(audio.adzanDuration||180)/60).toFixed(1) }} menit) →
            <b>hitung mundur iqomah</b> → <b>iqomah</b> → <b>waktu hening</b>.
            Isi <b>0</b> pada kolom Iqomah agar waktu tersebut tidak memicu adzan/iqomah.
        </div>
    </div>

    <div class="card">
        <h3>Pengaturan Adzan</h3>
        <div class="grid cols-2">
            <div class="field">
                <label>Durasi pemutaran adzan (detik)</label>
                <input class="input" type="number" v-model.number="audio.adzanDuration" />
                <span class="muted small">Batas maksimal pemutaran berkas adzan.</span>
            </div>
            <div class="field">
                <label>Jeda sebelum adzan (detik)</label>
                <input class="input" type="number" v-model.number="audio.adzanDelay" />
            </div>
            <div class="field">
                <label>Notifikasi pra-adzan (menit sebelum)</label>
                <input class="input" type="number" v-model.number="adzan.preAdzanMin" />
            </div>
            <div class="field">
                <label>Opsi</label>
                <label class="switch"><input type="checkbox" v-model="adzan.preAdzanOn" /><span class="track"></span><span>Bunyikan peringatan pra-adzan</span></label>
                <label class="switch"><input type="checkbox" v-model="adzan.iqomahOn" /><span class="track"></span><span>Bunyikan tanda iqomah</span></label>
            </div>
        </div>
    </div>

    <div class="card">
        <h3>Alur &amp; Layar Iqomah</h3>
        <div class="row" style="gap:1.2rem;flex-wrap:wrap">
            <div class="hint-box" style="flex:1;min-width:220px">
                <b>1. Hitung mundur berikutnya</b><br />
                Kartu terpisah di kanan atas bilah jadwal menampilkan sisa waktu ke sholat berikutnya.
            </div>
            <div class="hint-box" style="flex:1;min-width:220px">
                <b>2. Adzan → Iqomah</b><br />
                Saat masuk waktu sholat, kartu berubah menyala dan menghitung mundur ke iqomah.
            </div>
            <div class="hint-box" style="flex:1;min-width:220px">
                <b>3. Layar hitam</b><br />
                Begitu iqomah dimulai, layar penuh menjadi hitam bertuliskan “Harap tenang sedang ibadah sholat …”.
            </div>
        </div>
        <label class="switch" style="margin-top:.6rem"><input type="checkbox" v-model="display.showSholatScreen" /><span class="track"></span><span>Aktifkan layar hitam penuh saat iqomah</span></label>
        <label class="switch"><input type="checkbox" v-model="audio.adzanEnabled" /><span class="track"></span><span>Putar adzan otomatis pada waktu sholat</span></label>
        <p class="muted small" style="margin-top:.4rem">Kolom <b>Waktu Hening</b> menentukan berapa lama layar hitam ditampilkan setelah iqomah.</p>
    </div>

    <div class="card">
        <h3>Tampilan Overlay Lain</h3>
        <label class="switch"><input type="checkbox" v-model="display.showIqomahOverlay" /><span class="track"></span><span>Tampilkan penanda visual tambahan saat adzan</span></label>
        <label class="switch"><input type="checkbox" v-model="display.showHeningOverlay" /><span class="track"></span><span>Cadangan: tampilkan overlay gelap (bila layar hitam dimatikan)</span></label>
    </div>
</div>
`,
};
