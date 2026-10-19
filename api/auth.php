<?php
/**
 * Autentikasi (SQLite).
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'status';
$body   = json_body();

switch ($action) {

    case 'status': {
        $u = current_user();
        $st = db()->prepare("SELECT password_hash FROM users WHERE username='admin'");
        $st->execute();
        $h = (string)$st->fetchColumn();
        ok([
            'authenticated'   => (bool)$u,
            'user'            => $u,
            'defaultPassword' => $h !== '' && password_verify('admin123', $h),
            'requireLogin'    => (bool)(get_settings()['display']['requireLogin'] ?? false),
            'appVersion'      => APP_VERSION,
        ]);
    }

    case 'login': {
        $username = trim((string)($body['username'] ?? ''));
        $password = (string)($body['password'] ?? '');
        if ($username === '' || $password === '') fail('Nama pengguna dan kata sandi wajib diisi.');

        $key   = 'login_fail_' . md5(strtolower($username) . ($_SERVER['REMOTE_ADDR'] ?? ''));
        $fails = (int)($_SESSION[$key] ?? 0);
        if ($fails >= 8) fail('Terlalu banyak percobaan gagal. Coba lagi beberapa saat.', 429, 'throttled');

        $st = db()->prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE");
        $st->execute([$username]);
        $row = $st->fetch();

        if (!$row || !password_verify($password, (string)$row['password_hash'])) {
            $_SESSION[$key] = $fails + 1;
            usleep(350000);
            fail('Nama pengguna atau kata sandi salah.', 401, 'invalid_credentials');
        }
        unset($_SESSION[$key]);
        $_SESSION['user'] = ['id' => (int)$row['id'], 'username' => $row['username'], 'name' => $row['name'], 'role' => $row['role']];
        $_SESSION['loginAt'] = time();
        log_event('info', 'Login berhasil: ' . $row['username']);
        ok(['user' => $_SESSION['user']]);
    }

    case 'logout': {
        $u = current_user();
        if ($u) log_event('info', 'Logout: ' . $u['username']);
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', (bool)($p['secure'] ?? false), (bool)($p['httponly'] ?? true));
        }
        session_destroy();
        ok();
    }

    case 'change_password': {
        $u = require_auth();
        $old = (string)($body['oldPassword'] ?? '');
        $new = (string)($body['newPassword'] ?? '');
        if (strlen($new) < 6) fail('Kata sandi baru minimal 6 karakter.');
        $st = db()->prepare("SELECT password_hash FROM users WHERE id = ?");
        $st->execute([$u['id']]);
        $h = (string)$st->fetchColumn();
        if (!password_verify($old, $h)) fail('Kata sandi lama salah.', 401, 'invalid_credentials');
        db()->prepare("UPDATE users SET password_hash=?, updated_at=? WHERE id=?")
            ->execute([password_hash($new, PASSWORD_DEFAULT), date('c'), $u['id']]);
        log_event('info', 'Kata sandi diubah: ' . $u['username']);
        ok(['message' => 'Kata sandi berhasil diubah.']);
    }

    case 'change_profile': {
        $u = require_auth();
        $newName = trim((string)($body['username'] ?? ''));
        $name    = trim((string)($body['name'] ?? ''));
        $pass    = (string)($body['password'] ?? '');
        if (!preg_match('/^[a-zA-Z0-9._-]{3,32}$/', $newName)) fail('Nama pengguna 3-32 karakter (huruf, angka, . _ -).');
        $st = db()->prepare("SELECT password_hash FROM users WHERE id=?");
        $st->execute([$u['id']]);
        if (!password_verify($pass, (string)$st->fetchColumn())) fail('Kata sandi salah.', 401, 'invalid_credentials');

        $dup = db()->prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE AND id<>?");
        $dup->execute([$newName, $u['id']]);
        if ($dup->fetchColumn()) fail('Nama pengguna sudah dipakai.');

        db()->prepare("UPDATE users SET username=?, name=?, updated_at=? WHERE id=?")
            ->execute([$newName, $name !== '' ? $name : $newName, date('c'), $u['id']]);
        $_SESSION['user']['username'] = $newName;
        $_SESSION['user']['name'] = $name !== '' ? $name : $newName;
        ok(['user' => $_SESSION['user'], 'message' => 'Profil diperbarui.']);
    }

    case 'add_user': {
        require_auth();
        $username = trim((string)($body['username'] ?? ''));
        $password = (string)($body['password'] ?? '');
        $name     = trim((string)($body['name'] ?? $username));
        $role     = in_array($body['role'] ?? 'admin', ['admin', 'operator'], true) ? $body['role'] : 'admin';
        if (!preg_match('/^[a-zA-Z0-9._-]{3,32}$/', $username)) fail('Nama pengguna tidak valid.');
        if (strlen($password) < 6) fail('Kata sandi minimal 6 karakter.');
        try {
            db()->prepare("INSERT INTO users(username,name,role,password_hash,created_at) VALUES(?,?,?,?,?)")
                ->execute([$username, $name, $role, password_hash($password, PASSWORD_DEFAULT), date('c')]);
        } catch (PDOException $e) {
            fail('Nama pengguna sudah ada.');
        }
        ok(['message' => 'Pengguna ditambahkan.']);
    }

    case 'delete_user': {
        $me = require_auth();
        $id = (int)($body['id'] ?? 0);
        if ($id === (int)$me['id']) fail('Tidak dapat menghapus akun yang sedang aktif.');
        $c = (int)db()->query("SELECT COUNT(*) FROM users")->fetchColumn();
        if ($c <= 1) fail('Minimal harus ada satu pengguna.');
        db()->prepare("DELETE FROM users WHERE id=?")->execute([$id]);
        ok();
    }

    case 'list_users': {
        require_auth();
        $rows = db()->query("SELECT id,username,name,role,created_at FROM users ORDER BY id")->fetchAll();
        ok(['users' => $rows]);
    }

    default:
        fail('Aksi tidak dikenal.', 404, 'unknown_action');
}
