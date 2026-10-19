/* Admin — Akun & Pengguna */
import { Api } from '../../lib/api.js';
import { state, toast, checkAuth, bootstrap } from '../../store.js';

export default {
    name: 'AccountSection',
    props: { settings: Object },

    data() {
        return {
            profile: { username: '', name: '', password: '' },
            pass: { oldPassword: '', newPassword: '', confirm: '' },
            newUser: { username: '', name: '', password: '', role: 'operator' },
            users: [],
            busy: false,
        };
    },

    computed: {
        me() { return state.auth?.user || {}; },
        defaultPassword() { return !!state.auth?.defaultPassword; },
    },

    methods: {
        async loadUsers() {
            try {
                const res = await Api.listUsers();
                this.users = res.users || [];
            } catch { this.users = []; }
        },
        async saveProfile() {
            if (!this.profile.password) { toast('Masukkan kata sandi Anda untuk konfirmasi.', 'err'); return; }
            this.busy = true;
            try {
                const res = await Api.changeProfile(this.profile.username, this.profile.name, this.profile.password);
                state.auth.user = res.user;
                this.profile.password = '';
                await bootstrap({ force: true });
                toast('Profil diperbarui.', 'ok');
                await this.loadUsers();
            } catch (e) { toast(e.message || 'Gagal memperbarui profil.', 'err'); }
            finally { this.busy = false; }
        },
        async changePassword() {
            if (this.pass.newPassword.length < 6) { toast('Kata sandi baru minimal 6 karakter.', 'err'); return; }
            if (this.pass.newPassword !== this.pass.confirm) { toast('Konfirmasi kata sandi tidak sama.', 'err'); return; }
            this.busy = true;
            try {
                await Api.changePassword(this.pass.oldPassword, this.pass.newPassword);
                this.pass = { oldPassword: '', newPassword: '', confirm: '' };
                await checkAuth();
                toast('Kata sandi diubah.', 'ok');
            } catch (e) { toast(e.message || 'Gagal mengubah kata sandi.', 'err'); }
            finally { this.busy = false; }
        },
        async addUser() {
            this.busy = true;
            try {
                await Api.addUser(this.newUser);
                this.newUser = { username: '', name: '', password: '', role: 'operator' };
                await this.loadUsers();
                toast('Pengguna ditambahkan.', 'ok');
            } catch (e) { toast(e.message || 'Gagal menambah pengguna.', 'err'); }
            finally { this.busy = false; }
        },
        async removeUser(u) {
            if (!confirm(`Hapus pengguna “${u.username}”?`)) return;
            try {
                await Api.deleteUser(u.id);
                await this.loadUsers();
                toast('Pengguna dihapus.', 'ok');
            } catch (e) { toast(e.message || 'Gagal menghapus.', 'err'); }
        },
    },

    mounted() {
        this.profile.username = this.me.username || '';
        this.profile.name = this.me.name || '';
        this.loadUsers();
    },

    template: `
<div>
    <h2>Akun &amp; Pengguna</h2>
    <p class="page-sub">Kelola akun administrator yang dapat mengubah pengaturan.</p>

    <div v-if="defaultPassword" class="warn-box" style="margin-bottom:1rem">
        Anda masih memakai kata sandi bawaan <b>admin123</b>. Demi keamanan, segera ubah pada formulir di bawah.
    </div>

    <div class="grid cols-2">
        <div class="card">
            <h3>Profil</h3>
            <div class="field"><label>Nama Pengguna</label><input class="input" v-model="profile.username" /></div>
            <div class="field"><label>Nama Tampilan</label><input class="input" v-model="profile.name" /></div>
            <div class="field"><label>Kata Sandi (konfirmasi)</label><input class="input" type="password" v-model="profile.password" /></div>
            <button class="btn btn-primary" @click="saveProfile" :disabled="busy">Simpan Profil</button>
        </div>

        <div class="card">
            <h3>Ubah Kata Sandi</h3>
            <div class="field"><label>Kata Sandi Lama</label><input class="input" type="password" v-model="pass.oldPassword" /></div>
            <div class="field"><label>Kata Sandi Baru</label><input class="input" type="password" v-model="pass.newPassword" /></div>
            <div class="field"><label>Konfirmasi Kata Sandi Baru</label><input class="input" type="password" v-model="pass.confirm" /></div>
            <button class="btn btn-primary" @click="changePassword" :disabled="busy">Ubah Kata Sandi</button>
        </div>
    </div>

    <div class="card">
        <h3>Daftar Pengguna</h3>
        <table class="tbl">
            <thead><tr><th>Nama Pengguna</th><th>Nama</th><th>Peran</th><th>Dibuat</th><th>Aksi</th></tr></thead>
            <tbody>
                <tr v-for="u in users" :key="u.id">
                    <td><b>{{ u.username }}</b> <span v-if="u.username === me.username" class="badge info">Anda</span></td>
                    <td>{{ u.name }}</td>
                    <td><span class="badge">{{ u.role }}</span></td>
                    <td class="muted small">{{ u.created_at }}</td>
                    <td><button class="btn btn-sm btn-danger" @click="removeUser(u)" :disabled="u.username === me.username">Hapus</button></td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="card">
        <h3>Tambah Pengguna</h3>
        <div class="grid cols-4">
            <div class="field"><label>Nama Pengguna</label><input class="input" v-model="newUser.username" /></div>
            <div class="field"><label>Nama</label><input class="input" v-model="newUser.name" /></div>
            <div class="field"><label>Kata Sandi</label><input class="input" type="password" v-model="newUser.password" /></div>
            <div class="field">
                <label>Peran</label>
                <select class="input" v-model="newUser.role"><option value="operator">Operator</option><option value="admin">Admin</option></select>
            </div>
        </div>
        <button class="btn btn-primary" @click="addUser" :disabled="busy">Tambah Pengguna</button>
    </div>
</div>
`,
};
