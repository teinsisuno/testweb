/* Admin — Audio & Adzan */
import { toast } from '../../store.js';
import { audio } from '../../lib/audio.js';
import { uploadFile } from '../../lib/api.js';

export default {
    name: 'AudioSection',
    props: { settings: Object },

    data() { return { uploading: null, pct: 0 }; },

    computed: {
        audioCfg() { return this.settings.audio || (this.settings.audio = {}); },
        adzanCfg() { return this.settings.adzan || (this.settings.adzan = {}); },
    },

    methods: {
        async test(url) {
            await audio.unlock();
            audio.setVolume(Number(this.audioCfg.volume || 0.85));
            const ok = await audio.play(url, { maxDuration: 12 });
            toast(ok ? 'Memutar contoh audio…' : 'Tidak dapat memutar audio. Periksa berkas.', ok ? 'ok' : 'err');
        },
        async beep() {
            await audio.unlock();
            audio.setVolume(Number(this.audioCfg.volume || 0.85));
            await audio.beep(this.audioCfg.beepUrl);
        },
        async upload(field, file) {
            if (!file) return;
            this.uploading = field; this.pct = 0;
            try {
                const res = await uploadFile(file, { kind: 'logo', title: field }, p => { this.pct = Math.round(p * 100); });
                this.audioCfg[field] = res.src;
                toast('Audio diunggah.', 'ok');
            } catch (e) { toast(e.message || 'Gagal mengunggah audio.', 'err'); }
            finally { this.uploading = null; this.pct = 0; }
        },
        onPick(field, e) { const f = e.target.files?.[0]; if (f) this.upload(field, f); e.target.value = ''; },
    },

    template: `
<div>
    <h2>Audio &amp; Adzan</h2>
    <p class="page-sub">Berkas suara adzan, penanda iqomah, dan notifikasi pra-adzan.</p>

    <div class="card">
        <h3>Utama</h3>
        <div class="grid cols-3">
            <div class="field">
                <label>Volume ({{ Math.round((audioCfg.volume||0)*100) }}%)</label>
                <input class="input" type="range" min="0" max="1" step="0.05" v-model.number="audioCfg.volume" />
            </div>
            <div class="field">
                <label>Status</label>
                <label class="switch"><input type="checkbox" v-model="audioCfg.adzanEnabled" /><span class="track"></span><span>Putar adzan otomatis</span></label>
                <label class="switch"><input type="checkbox" v-model="audioCfg.beepEnabled" /><span class="track"></span><span>Bunyikan penanda iqomah</span></label>
            </div>
            <div class="field">
                <label>Uji Coba</label>
                <div class="row">
                    <button class="btn btn-sm" @click="test(audioCfg.adzanUrl)">▶ Adzan</button>
                    <button class="btn btn-sm" @click="beep">▶ Beep</button>
                    <button class="btn btn-sm" @click="test(audioCfg.notifyUrl)">▶ Notifikasi</button>
                </div>
            </div>
        </div>
        <div class="warn-box" style="margin-top:.6rem">
            Browser memblokir suara sebelum ada interaksi pengguna. Klik sekali pada layar tampilan agar audio aktif.
        </div>
    </div>

    <div class="card">
        <h3>Berkas Audio</h3>
        <div class="grid cols-3">
            <div class="field" v-for="f in [
                    { key:'adzanUrl', label:'Adzan' },
                    { key:'beepUrl', label:'Beep Iqomah' },
                    { key:'notifyUrl', label:'Notifikasi Pra-Adzan' }]" :key="f.key">
                <label>{{ f.label }}</label>
                <input class="input" v-model="audioCfg[f.key]" placeholder="assets/audio/…" />
                <div class="row" style="margin-top:.3rem">
                    <input type="file" accept="audio/*" @change="onPick(f.key, $event)" />
                    <button class="btn btn-sm btn-ghost" @click="test(audioCfg[f.key])">Uji</button>
                </div>
                <div v-if="uploading === f.key" class="progress" style="margin-top:.3rem"><i :style="{width: pct + '%'}"></i></div>
            </div>
        </div>
    </div>
</div>
`,
};
