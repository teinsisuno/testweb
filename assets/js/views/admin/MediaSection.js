/* Admin — Slideshow (gambar & video) */
import { Api, uploadFile } from '../../lib/api.js';
import { state, toast, refreshMedia } from '../../store.js';
import { fmtBytes } from '../../lib/util.js';

export default {
    name: 'MediaSection',
    props: { settings: Object },

    data() {
        return {
            busy: false,
            uploadPct: 0,
            dragOver: false,
            urlInput: '',
            urlType: 'image',
            queue: [],
        };
    },

    computed: {
        cfg() { return this.settings.slideshow || (this.settings.slideshow = {}); },
        media() { return state.media || []; },
    },

    methods: {
        async refresh() { await refreshMedia(); },

        async onFiles(files) {
            const list = [...(files || [])];
            if (!list.length) return;
            this.busy = true;
            for (let i = 0; i < list.length; i++) {
                const f = list[i];
                const isVideo = /^video\//.test(f.type);
                try {
                    await uploadFile(f, { title: f.name.replace(/\.[^.]+$/, ''), duration: cfg_interval(this.cfg), type: isVideo ? 'video' : 'image' },
                        p => { this.uploadPct = Math.round(((i + p) / list.length) * 100); });
                    toast(`Berhasil mengunggah ${f.name}`, 'ok', 2500);
                } catch (e) {
                    toast(`Gagal mengunggah ${f.name}: ${e.message}`, 'err', 5000);
                }
            }
            this.uploadPct = 0;
            this.busy = false;
            await refreshMedia();
        },

        onPick(e) { this.onFiles(e.target.files); e.target.value = ''; },
        onDrop(e) { this.dragOver = false; this.onFiles(e.dataTransfer?.files); },

        async addUrl() {
            const src = this.urlInput.trim();
            if (!src) return;
            try {
                await Api.mediaAddUrl({ src, type: this.urlType, title: src.split('/').pop() || 'Media', duration: cfg_interval(this.cfg) });
                this.urlInput = '';
                await refreshMedia();
                toast('Media ditambahkan.', 'ok');
            } catch (e) { toast(e.message || 'Gagal menambah media.', 'err'); }
        },

        async update(m) {
            try {
                const res = await Api.mediaUpdate({ id: m.id, title: m.title, duration: Number(m.duration), active: Number(m.active) ? 1 : 0 });
                if (res.media) state.media = res.media;
            } catch (e) { toast(e.message || 'Gagal memperbarui.', 'err'); }
        },

        async remove(m) {
            if (!confirm(`Hapus media “${m.title || m.src}”?`)) return;
            try {
                const res = await Api.mediaDelete(m.id);
                if (res.media) state.media = res.media;
                toast('Media dihapus.', 'ok');
            } catch (e) { toast(e.message || 'Gagal menghapus.', 'err'); }
        },

        async move(index, dir) {
            const arr = this.media.slice();
            const j = index + dir;
            if (j < 0 || j >= arr.length) return;
            [arr[index], arr[j]] = [arr[j], arr[index]];
            state.media = arr;
            try { await Api.mediaReorder(arr.map(m => m.id)); } catch { /* diam */ }
        },

        fmtBytes,
    },

    mounted() { this.refresh(); },

    template: `
<div>
    <h2>Slideshow</h2>
    <p class="page-sub">Gambar dan video latar yang ditampilkan bergantian di layar masjid.</p>

    <div class="card">
        <h3>Pengaturan Slideshow</h3>
        <div class="grid cols-4">
            <div class="field">
                <label>Status</label>
                <label class="switch"><input type="checkbox" v-model="cfg.enabled" /><span class="track"></span><span>Aktifkan slideshow</span></label>
            </div>
            <div class="field">
                <label>Durasi per gambar (detik)</label>
                <input class="input" type="number" min="3" v-model.number="cfg.interval" />
            </div>
            <div class="field">
                <label>Transisi</label>
                <select class="input" v-model="cfg.transition">
                    <option value="fade">Fade (pudar)</option>
                    <option value="slide">Geser</option>
                    <option value="zoom">Zoom perlahan</option>
                </select>
            </div>
            <div class="field">
                <label>Peredupan Latar ({{ cfg.dim }}%)</label>
                <input class="input" type="range" min="0" max="80" v-model.number="cfg.dim" />
            </div>
            <div class="field">
                <label>Urutan</label>
                <label class="switch"><input type="checkbox" v-model="cfg.shuffle" /><span class="track"></span><span>Acak</span></label>
            </div>
        </div>
    </div>

    <div class="card">
        <h3>Tambah Media</h3>
        <div class="drop" :class="{over: dragOver}"
             @dragover.prevent="dragOver = true" @dragleave.prevent="dragOver = false" @drop.prevent="onDrop"
             @click="$refs.file.click()">
            <div style="font-size:1.6rem">⬆</div>
            <div><b>Klik atau seret berkas</b> ke sini</div>
            <div class="muted small">Gambar: JPG, PNG, WEBP, GIF · Video: MP4, WEBM (maks 256 MB)</div>
            <input ref="file" type="file" multiple accept="image/*,video/*" class="hidden" @change="onPick" />
        </div>
        <div v-if="busy" class="progress" style="margin-top:.6rem"><i :style="{width: uploadPct + '%'}"></i></div>

        <div class="row" style="margin-top:.8rem">
            <select class="input" v-model="urlType" style="max-width:140px">
                <option value="image">Gambar</option>
                <option value="video">Video</option>
            </select>
            <input class="input" v-model="urlInput" placeholder="https://… atau assets/img/bg-1.jpg" style="flex:1" @keyup.enter="addUrl" />
            <button class="btn" @click="addUrl">Tambah dari URL</button>
        </div>
    </div>

    <div class="card">
        <div class="row between">
            <h3 style="margin:0">Daftar Media ({{ media.length }})</h3>
            <button class="btn btn-sm btn-ghost" @click="refresh">⟳ Muat ulang</button>
        </div>
        <table class="tbl">
            <thead><tr><th>Pratinjau</th><th>Judul</th><th>Jenis</th><th>Durasi</th><th>Aktif</th><th>Aksi</th></tr></thead>
            <tbody>
                <tr v-for="(m,i) in media" :key="m.id">
                    <td>
                        <img v-if="m.type !== 'video'" class="thumb" :src="m.src" alt="" />
                        <video v-else class="thumb" :src="m.src" muted preload="metadata"></video>
                    </td>
                    <td><input class="input" style="padding:.3rem .5rem" v-model="m.title" @change="update(m)" /></td>
                    <td><span class="badge" :class="m.type==='video' ? 'info' : 'on'">{{ m.type === 'video' ? 'Video' : 'Gambar' }}</span></td>
                    <td style="max-width:110px"><input class="input" style="padding:.3rem .5rem" type="number" min="3" v-model.number="m.duration" @change="update(m)" /></td>
                    <td>
                        <label class="switch">
                            <input type="checkbox" :checked="Number(m.active)!==0" @change="m.active = $event.target.checked ? 1 : 0; update(m)" />
                            <span class="track"></span>
                        </label>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-ghost" @click="move(i,-1)" title="Naik">↑</button>
                        <button class="btn btn-sm btn-ghost" @click="move(i,1)" title="Turun">↓</button>
                        <button class="btn btn-sm btn-danger" @click="remove(m)">Hapus</button>
                    </td>
                </tr>
                <tr v-if="!media.length"><td colspan="6" class="muted">Belum ada media. Tambahkan gambar atau video di atas.</td></tr>
            </tbody>
        </table>
    </div>
</div>
`,
};

function cfg_interval(cfg) { return Number(cfg?.interval || 15); }
