/* =================================================================
   Panel admin — kerangka + navigasi + simpan
   ================================================================= */
import { state, saveSettings, resetSettings, logout, toast, bootstrap } from '../store.js';
import { navigate } from '../main.js';
import { audio } from '../lib/audio.js';

import LocationSection from './admin/LocationSection.js';
import ScheduleSection from './admin/ScheduleSection.js';
import IqomahSection from './admin/IqomahSection.js';
import DisplaySection from './admin/DisplaySection.js';
import MediaSection from './admin/MediaSection.js';
import TickerSection from './admin/TickerSection.js';
import AudioSection from './admin/AudioSection.js';
import HolidaySection from './admin/HolidaySection.js';
import AccountSection from './admin/AccountSection.js';
import SystemSection from './admin/SystemSection.js';

const TABS = [
    { group: 'Utama' },
    { id: 'masjid',   label: 'Masjid & Lokasi', icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5' },
    { id: 'jadwal',   label: 'Jadwal Sholat',   icon: 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
    { id: 'iqomah',   label: 'Iqomah & Hening', icon: 'M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z' },
    { group: 'Tampilan' },
    { id: 'tampilan', label: 'Tema & Layout',   icon: 'M4 4h16v16H4zM4 9h16M9 9v11' },
    { id: 'slideshow',label: 'Slideshow',       icon: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6' },
    { id: 'teks',     label: 'Running Text',    icon: 'M4 6h16M4 12h16M4 18h10' },
    { id: 'audio',    label: 'Audio & Adzan',   icon: 'M11 5 6 9H3v6h3l5 4V5zM16 9a4 4 0 0 1 0 6' },
    { group: 'Konten' },
    { id: 'hari',     label: 'Hari Besar Islam',icon: 'M12 3a9 9 0 1 0 9 9c0-1-.2-2-.5-2.9A7 7 0 0 1 12 3z' },
    { id: 'akun',     label: 'Akun & Pengguna', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.9' },
    { id: 'sistem',   label: 'Sistem & Data',   icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9' },
];

export default {
    name: 'Admin',
    components: { LocationSection, ScheduleSection, IqomahSection, DisplaySection, MediaSection, TickerSection, AudioSection, HolidaySection, AccountSection, SystemSection },

    data() {
        return {
            tab: (location.hash.split('/')[2]) || 'masjid',
            draft: jsonClone(state.settings),
            saving: false,
            dirty: false,
            resetting: false,
            tabs: TABS,
            now: new Date(),
        };
    },

    computed: {
        user() { return state.auth?.user || {}; },
        online() { return state.online; },
        pending() { return state.pendingSettings; },
        activeComponent() {
            const map = {
                masjid: 'LocationSection',
                jadwal: 'ScheduleSection',
                iqomah: 'IqomahSection',
                tampilan: 'DisplaySection',
                slideshow: 'MediaSection',
                teks: 'TickerSection',
                audio: 'AudioSection',
                hari: 'HolidaySection',
                akun: 'AccountSection',
                sistem: 'SystemSection',
            };
            return map[this.tab] || 'LocationSection';
        },
        settingsRef() { return state.settings; },
    },

    watch: {
        tab(v) { history.replaceState(null, '', '#/admin/' + v); },
    },

    methods: {
        markDirty() { this.dirty = true; },

        async save() {
            if (this.saving) return;
            this.saving = true;
            const ok = await saveSettings(jsonClone(this.draft), { silent: true });
            this.saving = false;
            if (ok) {
                this.dirty = false;
                this.draft = jsonClone(state.settings);
                toast('Pengaturan tersimpan.', 'ok');
            } else {
                this.dirty = false;
                toast('Disimpan lokal, akan disinkron saat online.', 'err');
            }
        },

        async discard() {
            this.draft = jsonClone(state.settings);
            this.dirty = false;
            toast('Perubahan dibatalkan.', 'info', 1800);
        },

        async doReset() {
            if (!confirm('Kembalikan SEMUA pengaturan ke bawaan? Tindakan ini tidak dapat dibatalkan.')) return;
            this.resetting = true;
            await resetSettings();
            this.draft = jsonClone(state.settings);
            this.dirty = false;
            this.resetting = false;
        },

        async doLogout() {
            await logout();
            navigate('/login');
            toast('Anda telah keluar.', 'info');
        },

        preview() { window.open('index.html', '_blank'); },
        goDisplay() { navigate('/'); },

        async refreshData() {
            await bootstrap({ force: true });
            this.draft = jsonClone(state.settings);
            this.dirty = false;
            toast('Data dimuat ulang dari server.', 'ok');
        },
    },

    mounted() {
        if (!state.auth?.authenticated) { navigate('/login'); return; }
        this._t = setInterval(() => { this.now = new Date(); }, 1000);
        // Tandai ada perubahan dengan membandingkan draft vs pengaturan tersimpan
        this._unwatch = this.$watch(
            () => JSON.stringify(this.draft),
            (v) => { this.dirty = v !== JSON.stringify(state.settings); },
        );
        this._unwatchSettings = this.$watch(
            () => JSON.stringify(state.settings),
            () => { if (!this.dirty) this.draft = jsonClone(state.settings); },
        );
    },
    beforeUnmount() {
        clearInterval(this._t);
        this._unwatch?.();
        this._unwatchSettings?.();
    },

    template: `
<div class="admin">
    <div class="admin-top">
        <div class="brand">
            <img src="assets/img/icon-192.png" alt="logo" />
            <span>Jam Jadwal Sholat</span>
            <span class="badge" :class="online ? 'on' : 'off'">{{ online ? 'Online' : 'Offline' }}</span>
            <span v-if="pending" class="badge info">Perubahan tertunda</span>
        </div>
        <div class="spacer"></div>
        <div class="who hidden-sm">
            {{ now.toLocaleTimeString('id-ID') }} · {{ user.name || user.username }}
        </div>
        <button class="btn btn-sm btn-ghost" @click="refreshData" title="Muat ulang data">⟳</button>
        <button class="btn btn-sm btn-ghost" @click="preview">Pratinjau</button>
        <button class="btn btn-sm" @click="goDisplay">Tampilan</button>
        <button class="btn btn-sm btn-danger" @click="doLogout">Keluar</button>
    </div>

    <div class="admin-body">
        <nav class="admin-nav">
            <template v-for="(t, i) in tabs" :key="i">
                <div v-if="t.group" class="navgroup">{{ t.group }}</div>
                <button v-else :class="{ active: tab === t.id }" @click="tab = t.id">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7">
                        <path :d="t.icon" />
                    </svg>
                    <span class="lbl">{{ t.label }}</span>
                </button>
            </template>
        </nav>

        <main class="admin-main">
            <component :is="activeComponent" :settings="draft" :now="now" :dirty="dirty" />
            <div style="height:5rem"></div>
        </main>
    </div>

    <div v-if="dirty || saving" style="position:fixed;left:0;right:0;bottom:0;z-index:50;background:#0f1520;border-top:1px solid rgba(255,255,255,.12);padding:.7rem 1rem;display:flex;align-items:center;gap:.7rem">
        <span class="small muted">Ada perubahan yang belum disimpan.</span>
        <div class="spacer" style="flex:1"></div>
        <button class="btn btn-sm btn-ghost" @click="discard" :disabled="saving">Urungkan</button>
        <button class="btn btn-sm btn-primary" @click="save" :disabled="saving">
            {{ saving ? 'Menyimpan…' : 'Simpan Perubahan' }}
        </button>
    </div>

    <div class="toasts" v-if="false"></div>
</div>
`,
};

function jsonClone(o) { try { return JSON.parse(JSON.stringify(o)); } catch { return o; } }
export { jsonClone };
