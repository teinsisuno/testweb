/* Admin — Running text (teks berjalan) */
import { Api } from '../../lib/api.js';
import { state, toast, refreshRunningText } from '../../store.js';

export default {
    name: 'TickerSection',
    props: { settings: Object },

    data() { return { newText: '', busy: false }; },

    computed: {
        cfg() { return this.settings.runningText || (this.settings.runningText = {}); },
        items() { return state.runningText || []; },
        previewStyle() {
            return { background: this.cfg.bg, color: this.cfg.color, padding: '.6rem 1rem', borderRadius: '.5rem', overflow: 'hidden', whiteSpace: 'nowrap' };
        },
        joined() {
            return this.items.filter(t => Number(t.active) !== 0).map(t => t.text).join(this.cfg.separator || '  •  ');
        },
    },

    methods: {
        async add() {
            const t = this.newText.trim();
            if (!t) return;
            this.busy = true;
            try {
                const res = await Api.rtAdd(t, 1);
                state.runningText = res.items || [];
                this.newText = '';
                toast('Teks ditambahkan.', 'ok');
            } catch (e) { toast(e.message || 'Gagal menambah teks.', 'err'); }
            finally { this.busy = false; }
        },
        async update(it) {
            try {
                const res = await Api.rtUpdate({ id: it.id, text: it.text, active: Number(it.active) ? 1 : 0 });
                state.runningText = res.items || [];
            } catch (e) { toast(e.message || 'Gagal menyimpan.', 'err'); }
        },
        async remove(it) {
            if (!confirm('Hapus teks ini?')) return;
            try {
                const res = await Api.rtDelete(it.id);
                state.runningText = res.items || [];
                toast('Teks dihapus.', 'ok');
            } catch (e) { toast(e.message || 'Gagal menghapus.', 'err'); }
        },
        async move(i, dir) {
            const arr = this.items.slice();
            const j = i + dir;
            if (j < 0 || j >= arr.length) return;
            [arr[i], arr[j]] = [arr[j], arr[i]];
            state.runningText = arr;
            try { await Api.rtReorder(arr.map(t => t.id)); } catch { /* diam */ }
        },
        async refresh() { await refreshRunningText(); },
    },

    mounted() { this.refresh(); },

    template: `
<div>
    <h2>Running Text</h2>
    <p class="page-sub">Teks berjalan di bagian paling bawah layar. Beberapa teks akan ditampilkan berurutan.</p>

    <div class="card">
        <h3>Pengaturan Tampilan</h3>
        <div class="grid cols-4">
            <div class="field">
                <label>Status</label>
                <label class="switch"><input type="checkbox" v-model="cfg.enabled" /><span class="track"></span><span>Tampilkan</span></label>
            </div>
            <div class="field"><label>Warna Latar</label><input class="input" type="color" v-model="cfg.bg" /></div>
            <div class="field"><label>Warna Teks</label><input class="input" type="color" v-model="cfg.color" /></div>
            <div class="field">
                <label>Kecepatan ({{ cfg.speed }} px/s)</label>
                <input class="input" type="range" min="20" max="200" v-model.number="cfg.speed" />
            </div>
            <div class="field">
                <label>Pemisah antar teks</label>
                <input class="input" v-model="cfg.separator" />
            </div>
        </div>
        <div style="margin-top:.7rem">
            <div class="muted small" style="margin-bottom:.3rem">Pratinjau:</div>
            <div :style="previewStyle">{{ joined || '(belum ada teks aktif)' }}</div>
        </div>
    </div>

    <div class="card">
        <h3>Tambah Teks</h3>
        <div class="row">
            <input class="input" v-model="newText" placeholder="Tulis pengumuman masjid…" style="flex:1" @keyup.enter="add" />
            <button class="btn btn-primary" @click="add" :disabled="busy">Tambah</button>
        </div>
    </div>

    <div class="card">
        <div class="row between">
            <h3 style="margin:0">Daftar Teks ({{ items.length }})</h3>
            <button class="btn btn-sm btn-ghost" @click="refresh">⟳ Muat ulang</button>
        </div>
        <table class="tbl">
            <thead><tr><th style="width:60px">Aktif</th><th>Teks</th><th style="width:150px">Aksi</th></tr></thead>
            <tbody>
                <tr v-for="(it,i) in items" :key="it.id">
                    <td>
                        <label class="switch">
                            <input type="checkbox" :checked="Number(it.active)!==0" @change="it.active = $event.target.checked ? 1 : 0; update(it)" />
                            <span class="track"></span>
                        </label>
                    </td>
                    <td><textarea class="input" rows="1" v-model="it.text" @change="update(it)"></textarea></td>
                    <td>
                        <button class="btn btn-sm btn-ghost" @click="move(i,-1)">↑</button>
                        <button class="btn btn-sm btn-ghost" @click="move(i,1)">↓</button>
                        <button class="btn btn-sm btn-danger" @click="remove(it)">Hapus</button>
                    </td>
                </tr>
                <tr v-if="!items.length"><td colspan="3" class="muted">Belum ada teks.</td></tr>
            </tbody>
        </table>
    </div>
</div>
`,
};
