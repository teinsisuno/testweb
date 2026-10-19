/* Admin — Hari Besar Islam */
import { Api } from '../../lib/api.js';
import { state, toast, refreshHolidays, recomputeHijri } from '../../store.js';
import { HIJRI_MONTHS, nextHolidays, toHijri, hijriLabel, tanggalId } from '../../lib/hijri.js';

export default {
    name: 'HolidaySection',
    props: { settings: Object, now: Date },

    data() {
        return {
            months: HIJRI_MONTHS,
            draft: { name: '', hijri_month: 1, hijri_day: 1, gregorian_date: '', description: '', active: 1 },
            busy: false,
        };
    },

    computed: {
        items() { return state.holidays || []; },
        hijriToday() {
            const off = Number(this.settings.calc?.hijriOffset || 0);
            return hijriLabel(toHijri(new Date(this.now), off), true);
        },
        upcoming() {
            const off = Number(this.settings.calc?.hijriOffset || 0);
            return nextHolidays(this.items, new Date(this.now), 400, 10, off);
        },
    },

    methods: {
        async add() {
            if (!this.draft.name.trim()) { toast('Nama hari besar wajib diisi.', 'err'); return; }
            this.busy = true;
            try {
                const res = await Api.holAdd({ ...this.draft });
                state.holidays = res.items || [];
                this.draft = { name: '', hijri_month: 1, hijri_day: 1, gregorian_date: '', description: '', active: 1 };
                recomputeHijri(new Date(this.now));
                toast('Hari besar ditambahkan.', 'ok');
            } catch (e) { toast(e.message || 'Gagal menambah.', 'err'); }
            finally { this.busy = false; }
        },
        async update(it) {
            try {
                const res = await Api.holUpdate({
                    id: it.id, name: it.name, hijri_month: Number(it.hijri_month) || 0, hijri_day: Number(it.hijri_day) || 0,
                    gregorian_date: it.gregorian_date || '', description: it.description || '', active: Number(it.active) ? 1 : 0,
                });
                state.holidays = res.items || [];
                recomputeHijri(new Date(this.now));
            } catch (e) { toast(e.message || 'Gagal menyimpan.', 'err'); }
        },
        async remove(it) {
            if (!confirm(`Hapus “${it.name}”?`)) return;
            try {
                const res = await Api.holDelete(it.id);
                state.holidays = res.items || [];
                recomputeHijri(new Date(this.now));
                toast('Hari besar dihapus.', 'ok');
            } catch (e) { toast(e.message || 'Gagal menghapus.', 'err'); }
        },
        async reset() {
            if (!confirm('Kembalikan daftar hari besar ke bawaan?')) return;
            try {
                const res = await Api.holReset();
                state.holidays = res.items || [];
                recomputeHijri(new Date(this.now));
                toast('Daftar hari besar direset.', 'ok');
            } catch (e) { toast(e.message || 'Gagal mereset.', 'err'); }
        },
        async refresh() { await refreshHolidays(); },
        countdownText(h) { return h.isToday ? 'Hari ini' : `${h.daysLeft} hari lagi`; },
    },

    mounted() { this.refresh(); },

    template: `
<div>
    <h2>Hari Besar Islam</h2>
    <p class="page-sub">Hitung mundur hari besar terdekat selalu ditampilkan di layar. Tanggal Hijriah dikonversi otomatis.</p>

    <div class="card">
        <h3>Hari Besar Terdekat</h3>
        <p class="card-sub">Hari ini: <b>{{ hijriToday }}</b> · {{ new Date(now).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) }}</p>
        <table class="tbl">
            <thead><tr><th>Nama</th><th>Tanggal Masehi</th><th>Tanggal Hijriah</th><th>Sisa</th></tr></thead>
            <tbody>
                <tr v-for="h in upcoming" :key="h.id + h.date">
                    <td><b>{{ h.name }}</b></td>
                    <td>{{ h.dateLabel }}</td>
                    <td class="muted">{{ h.hijriLabel }}</td>
                    <td><span class="badge" :class="h.isToday ? 'on' : ''">{{ countdownText(h) }}</span></td>
                </tr>
                <tr v-if="!upcoming.length"><td colspan="4" class="muted">Tidak ada data. Tambahkan hari besar di bawah.</td></tr>
            </tbody>
        </table>
    </div>

    <div class="card">
        <h3>Tambah Hari Besar</h3>
        <div class="grid cols-2">
            <div class="field"><label>Nama</label><input class="input" v-model="draft.name" placeholder="cth. Maulid Nabi Muhammad SAW" /></div>
            <div class="field"><label>Keterangan</label><input class="input" v-model="draft.description" placeholder="opsional" /></div>
            <div class="field">
                <label>Bulan Hijriah</label>
                <select class="input" v-model.number="draft.hijri_month">
                    <option v-for="(m,i) in months" :key="i" :value="i+1">{{ i+1 }}. {{ m }}</option>
                </select>
            </div>
            <div class="field"><label>Tanggal Hijriah</label><input class="input" type="number" min="1" max="30" v-model.number="draft.hijri_day" /></div>
            <div class="field">
                <label>Tanggal Masehi Tetap (opsional)</label>
                <input class="input" type="date" v-model="draft.gregorian_date" />
                <span class="muted small">Isi bila ingin tanggal pasti (mis. SKB Kemenag).</span>
            </div>
        </div>
        <button class="btn btn-primary" @click="add" :disabled="busy">Tambah</button>
    </div>

    <div class="card">
        <div class="row between">
            <h3 style="margin:0">Daftar Hari Besar ({{ items.length }})</h3>
            <div class="row">
                <button class="btn btn-sm btn-ghost" @click="refresh">⟳ Muat ulang</button>
                <button class="btn btn-sm btn-ghost" @click="reset">Reset Bawaan</button>
            </div>
        </div>
        <table class="tbl">
            <thead><tr><th>Aktif</th><th>Nama</th><th>Hijriah</th><th>Masehi Tetap</th><th>Keterangan</th><th>Aksi</th></tr></thead>
            <tbody>
                <tr v-for="it in items" :key="it.id">
                    <td>
                        <label class="switch">
                            <input type="checkbox" :checked="Number(it.active)!==0" @change="it.active = $event.target.checked ? 1 : 0; update(it)" />
                            <span class="track"></span>
                        </label>
                    </td>
                    <td><input class="input" style="padding:.3rem .5rem" v-model="it.name" @change="update(it)" /></td>
                    <td style="white-space:nowrap">
                        <input class="input" style="padding:.3rem .5rem;width:70px;display:inline-block" type="number" min="0" max="12" v-model.number="it.hijri_month" @change="update(it)" />
                        /
                        <input class="input" style="padding:.3rem .5rem;width:70px;display:inline-block" type="number" min="0" max="30" v-model.number="it.hijri_day" @change="update(it)" />
                    </td>
                    <td><input class="input" style="padding:.3rem .5rem" type="date" v-model="it.gregorian_date" @change="update(it)" /></td>
                    <td><input class="input" style="padding:.3rem .5rem" v-model="it.description" @change="update(it)" /></td>
                    <td><button class="btn btn-sm btn-danger" @click="remove(it)">Hapus</button></td>
                </tr>
            </tbody>
        </table>
        <p class="muted small" style="margin-top:.6rem">Konversi Hijriah memakai kalender Umm al-Qura (bisa selisih ±1 hari dengan penetapan pemerintah). Gunakan kolom <b>Tanggal Masehi Tetap</b> untuk tanggal resmi.</p>
    </div>
</div>
`,
};
