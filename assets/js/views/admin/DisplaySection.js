/* Admin — Tema, jam, dan tata letak tampilan */
import { toast, state } from '../../store.js';

export default {
    name: 'DisplaySection',
    props: { settings: Object, now: Date },

    data() {
        return { previewKey: Date.now() };
    },

    computed: {
        theme() { return this.settings.theme || (this.settings.theme = {}); },
        clock() { return this.settings.clock || (this.settings.clock = {}); },
        display() { return this.settings.display || (this.settings.display = {}); },
        hijri() { return this.settings.hijri || (this.settings.hijri = {}); },
        labels() { return this.settings.labels || {}; },
        visible() { return this.settings.visible || []; },
        barItems() { return this.visible.map(k => ({ key: k, label: this.labels[k] || k })); },
        previewUrl() { return `index.html?preview=${this.previewKey}`; },
    },

    methods: {
        refreshPreview() { this.previewKey = Date.now(); },
        setPreset(name) {
            const presets = {
                oranye: { accent: '#ff8a00', accentText: '#ffffff' },
                hijau: { accent: '#0f8a3c', accentText: '#ffffff' },
                biru: { accent: '#2563eb', accentText: '#ffffff' },
                emas: { accent: '#c9a227', accentText: '#ffffff' },
                merah: { accent: '#dc2626', accentText: '#ffffff' },
                gelap: { accent: '#1f2937', accentText: '#ffffff' },
            };
            Object.assign(this.theme, presets[name] || presets.oranye);
            toast('Tema warna diterapkan.', 'ok');
        },
    },

    template: `
<div>
    <h2>Tema &amp; Tata Letak</h2>
    <p class="page-sub">Sesuaikan warna, jam, dan elemen yang tampil di layar masjid.</p>

    <div class="card">
        <h3>Pratinjau Langsung</h3>
        <div class="preview-box">
            <iframe :src="previewUrl" title="pratinjau"></iframe>
        </div>
        <div class="row" style="margin-top:.6rem">
            <button class="btn btn-sm" @click="refreshPreview">⟳ Segarkan Pratinjau</button>
            <span class="muted small">Perubahan tersimpan otomatis terlihat setelah disimpan.</span>
        </div>
    </div>

    <div class="card">
        <h3>Warna</h3>
        <div class="tabs">
            <button @click="setPreset('oranye')">Oranye</button>
            <button @click="setPreset('hijau')">Hijau</button>
            <button @click="setPreset('biru')">Biru</button>
            <button @click="setPreset('emas')">Emas</button>
            <button @click="setPreset('merah')">Merah</button>
            <button @click="setPreset('gelap')">Gelap</button>
        </div>
        <div class="grid cols-4">
            <div class="field"><label>Warna Aksen</label><input class="input" type="color" v-model="theme.accent" /></div>
            <div class="field"><label>Teks Aksen</label><input class="input" type="color" v-model="theme.accentText" /></div>
            <div class="field"><label>Teks Atas</label><input class="input" type="color" v-model="theme.textTop" /></div>
            <div class="field"><label>Latar Bilah Bawah</label><input class="input" v-model="theme.barBg" /></div>
            <div class="field">
                <label>Pudar Putih Atas ({{ theme.topFade }}%)</label>
                <input class="input" type="range" min="0" max="100" v-model.number="theme.topFade" />
            </div>
            <div class="field">
                <label>Blur Bilah Bawah ({{ theme.barBlur }}px)</label>
                <input class="input" type="range" min="0" max="30" v-model.number="theme.barBlur" />
            </div>
        </div>
    </div>

    <div class="card">
        <h3>Jam &amp; Tanggal</h3>
        <div class="grid cols-3">
            <div class="field">
                <label>Format Jam</label>
                <select class="input" v-model.number="clock.format">
                    <option :value="24">24 Jam</option>
                    <option :value="12">12 Jam (AM/PM)</option>
                </select>
            </div>
            <div class="field">
                <label>Detik</label>
                <label class="switch"><input type="checkbox" v-model="clock.showSeconds" /><span class="track"></span><span>Tampilkan detik</span></label>
            </div>
            <div class="field">
                <label>Tanggal</label>
                <label class="switch"><input type="checkbox" v-model="clock.showHijri" /><span class="track"></span><span>Hijriah</span></label>
                <label class="switch"><input type="checkbox" v-model="clock.showGregorian" /><span class="track"></span><span>Masehi</span></label>
            </div>
            <div class="field">
                <label>Hari Besar</label>
                <label class="switch"><input type="checkbox" v-model="hijri.holidaysEnabled" /><span class="track"></span><span>Tampilkan hitung mundur hari besar</span></label>
            </div>
        </div>
    </div>

    <div class="card">
        <h3>Layar Waktu Sholat (Iqomah)</h3>
        <p class="card-sub">Saat iqomah dimulai, seluruh layar menjadi hitam dengan tulisan di tengah sampai waktu hening selesai.</p>
        <div class="grid cols-2">
            <div>
                <label class="switch"><input type="checkbox" v-model="display.showSholatScreen" /><span class="track"></span><span>Tampilkan layar hitam penuh saat iqomah &amp; sholat</span></label>
                <label class="switch"><input type="checkbox" v-model="display.sholatCountdown" /><span class="track"></span><span>Tampilkan sisa waktu (kecil, opsional)</span></label>
            </div>
            <div class="field">
                <label>Teks di tengah layar</label>
                <input class="input" v-model="display.sholatText" placeholder="Harap tenang sedang ibadah sholat {prayer}" />
                <span class="muted small">Gunakan <code>{prayer}</code> untuk nama waktu sholat, mis. <b>Maghrib</b>.</span>
            </div>
        </div>
        <div style="margin-top:.7rem;background:#000;border-radius:.6rem;padding:1.4rem;text-align:center">
            <div style="color:#fff;font-weight:700;font-size:1.15rem">
                {{ (display.sholatText || 'Harap tenang sedang ibadah sholat {prayer}').replace(/\{prayer\}/gi, 'Maghrib') }}
            </div>
        </div>
    </div>

    <div class="card">
        <h3>Elemen Layar</h3>
        <div class="grid cols-2">
            <div>
                <label class="switch"><input type="checkbox" v-model="display.showSettingsButton" /><span class="track"></span><span>Tombol pengaturan (roda gigi)</span></label>
                <label class="switch"><input type="checkbox" v-model="display.hideCursor" /><span class="track"></span><span>Sembunyikan kursor saat menganggur</span></label>
                <label class="switch"><input type="checkbox" v-model="display.wakeLock" /><span class="track"></span><span>Layar tetap menyala (Wake Lock)</span></label>
            </div>
            <div>
                <label class="switch"><input type="checkbox" v-model="display.fullscreenOnStart" /><span class="track"></span><span>Masuk layar penuh otomatis</span></label>
                <label class="switch"><input type="checkbox" v-model="display.requireLogin" /><span class="track"></span><span>Wajib masuk untuk melihat tampilan</span></label>
            </div>
        </div>
        <div class="warn-box" v-if="display.requireLogin" style="margin-top:.6rem">
            Hati-hati: bila diaktifkan, layar masjid akan meminta login setiap kali dibuka.
        </div>
        <p class="muted small" style="margin-top:.6rem">Urutan &amp; nama waktu diatur pada menu <b>Jadwal Sholat</b>. Warna latar slideshow diatur pada menu <b>Slideshow</b>.</p>
    </div>
</div>
`,
};
