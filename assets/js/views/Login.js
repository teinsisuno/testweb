/* Halaman masuk */
import { state, login, toast, bootstrap } from '../store.js';
import { navigate } from '../main.js';

export default {
    name: 'Login',
    data() {
        return {
            username: '',
            password: '',
            showPass: false,
            busy: false,
            error: '',
            capsOn: false,
        };
    },
    computed: {
        s() { return state.settings || {}; },
        mosqueName() { return this.s.mosque?.name || 'Jam Jadwal Sholat'; },
        requireLogin() { return !!this.s.display?.requireLogin; },
        defaultPassword() { return state.auth?.defaultPassword; },
    },
    methods: {
        async submit() {
            if (this.busy) return;
            this.error = '';
            if (!this.username || !this.password) { this.error = 'Isi nama pengguna dan kata sandi.'; return; }
            this.busy = true;
            try {
                await login(this.username.trim(), this.password);
                toast('Berhasil masuk. Selamat datang!', 'ok');
                await bootstrap();
                navigate('/admin');
            } catch (e) {
                this.error = e?.message || 'Gagal masuk.';
                this.password = '';
            } finally {
                this.busy = false;
            }
        },
        goDisplay() { navigate('/'); },
        keyCheck(e) {
            if (typeof e.getModifierState === 'function') this.capsOn = e.getModifierState('CapsLock');
        },
    },
    mounted() {
        if (state.auth?.authenticated) navigate('/admin');
        this.$nextTick(() => this.$refs.user?.focus());
    },
    template: `
<div class="auth-wrap">
    <form class="auth-card" @submit.prevent="submit">
        <img class="logo" src="assets/img/icon-192.png" alt="logo" />
        <h1>{{ mosqueName }}</h1>
        <p class="sub">Masuk untuk mengelola jadwal & tampilan masjid</p>

        <div v-if="defaultPassword" class="warn-box" style="margin-bottom:1rem">
            Kata sandi bawaan masih dipakai (<b>admin / admin123</b>). Segera ubah setelah masuk.
        </div>

        <div class="field">
            <label for="username">Nama Pengguna</label>
            <input id="username" ref="user" class="input" v-model="username" autocomplete="username"
                   placeholder="admin" @keyup="keyCheck" />
        </div>

        <div class="field">
            <label for="password">Kata Sandi</label>
            <div style="position:relative">
                <input id="password" class="input" :type="showPass ? 'text' : 'password'" v-model="password"
                       autocomplete="current-password" placeholder="••••••••" @keyup="keyCheck" />
                <button type="button" class="btn btn-sm" style="position:absolute;right:.35rem;top:50%;transform:translateY(-50%)"
                        @click="showPass = !showPass" tabindex="-1">{{ showPass ? 'Sembunyikan' : 'Lihat' }}</button>
            </div>
            <div v-if="capsOn" class="muted small">Caps Lock aktif</div>
        </div>

        <p class="err-msg">{{ error }}</p>

        <button class="btn btn-primary btn-block" type="submit" :disabled="busy">
            <span v-if="busy">Memproses…</span><span v-else>Masuk</span>
        </button>

        <div class="hint">
            <button type="button" class="btn btn-ghost btn-sm" @click="goDisplay" style="margin-top:.9rem">← Kembali ke tampilan</button>
            <div v-if="defaultPassword" style="margin-top:.7rem">Bawaan: <code>admin</code> / <code>admin123</code></div>
        </div>
    </form>
</div>
`,
};
