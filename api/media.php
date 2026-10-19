<?php
/**
 * Media slideshow: daftar, tambah (unggah/URL), ubah, hapus, urut.
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? 'list';

function list_media(): array
{
    return db()->query("SELECT * FROM media ORDER BY sort_order ASC, id ASC")->fetchAll();
}

if ($method === 'GET') {
    switch ($action) {
        case 'list':
            ok(['media' => list_media()]);
        default:
            fail('Aksi tidak dikenal.', 404, 'unknown_action');
    }
}

require_auth();
$body = json_body();

switch ($action) {

    case 'upload': {
        if (empty($_FILES['file'])) fail('Berkas tidak ditemukan.');
        $f = $_FILES['file'];
        if ($f['error'] !== UPLOAD_ERR_OK) fail('Gagal mengunggah berkas (kode ' . $f['error'] . ').');

        $maxBytes = 256 * 1024 * 1024; // 256 MB
        if ($f['size'] > $maxBytes) fail('Ukuran berkas melebihi 256 MB.');

        $mime = 'application/octet-stream';
        if (class_exists('finfo')) {
            $fi = new finfo(FILEINFO_MIME_TYPE);
            $mime = (string)$fi->file($f['tmp_name']);
        }
        $allow = [
            'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif',
            'image/webp' => 'webp', 'image/avif' => 'avif',
            'video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/ogg' => 'ogv',
            'video/quicktime' => 'mov', 'video/x-matroska' => 'mkv',
        ];
        if (!isset($allow[$mime])) fail('Jenis berkas tidak diizinkan (' . $mime . ').');

        $type = str_starts_with($mime, 'video') ? 'video' : 'image';
        if (str_contains($mime, 'svg')) fail('Berkas SVG tidak diizinkan demi keamanan.');
        $ext  = $allow[$mime];
        $name = date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $dest = UPLOAD_DIR . '/' . $name;
        if (!move_uploaded_file($f['tmp_name'], $dest)) fail('Gagal menyimpan berkas.', 500);

        $title = trim((string)($_POST['title'] ?? '')) ?: pathinfo($f['name'], PATHINFO_FILENAME);
        $dur   = (int)($_POST['duration'] ?? 15);
        $sort  = (int)db()->query("SELECT COALESCE(MAX(sort_order),-1)+1 FROM media")->fetchColumn();
        $src   = 'uploads/' . $name;

        // Unggahan yang tidak perlu masuk daftar media (mis. logo masjid)
        if (($_POST['kind'] ?? '') === 'logo') {
            ok(['src' => $src]);
        }

        $st = db()->prepare("INSERT INTO media(type,src,title,duration,sort_order,active,created_at) VALUES(?,?,?,?,?,1,?)");
        $st->execute([$type, $src, $title, $dur, $sort, date('c')]);
        $id = (int)db()->lastInsertId();
        log_event('info', "Media diunggah: $src");
        ok(['media' => ['id' => $id, 'type' => $type, 'src' => $src, 'title' => $title, 'duration' => $dur, 'sort_order' => $sort, 'active' => 1]]);
    }

    case 'add_url': {
        $src  = trim((string)($body['src'] ?? ''));
        $type = in_array($body['type'] ?? 'image', ['image', 'video'], true) ? $body['type'] : 'image';
        if ($src === '') fail('URL/berkas wajib diisi.');
        $title = trim((string)($body['title'] ?? '')) ?: ($type === 'video' ? 'Video' : 'Gambar');
        $dur   = (int)($body['duration'] ?? 15);
        $sort  = (int)db()->query("SELECT COALESCE(MAX(sort_order),-1)+1 FROM media")->fetchColumn();
        db()->prepare("INSERT INTO media(type,src,title,duration,sort_order,active,created_at) VALUES(?,?,?,?,?,1,?)")
            ->execute([$type, $src, $title, $dur, $sort, date('c')]);
        ok(['media' => ['id' => (int)db()->lastInsertId()]]);
    }

    case 'update': {
        $id = (int)($body['id'] ?? 0);
        if ($id <= 0) fail('ID tidak valid.');
        $fields = [];
        $params = [];
        foreach (['title' => 's', 'duration' => 'i', 'active' => 'i', 'sort_order' => 'i', 'type' => 's'] as $k => $t) {
            if (array_key_exists($k, $body)) { $fields[] = "$k = ?"; $params[] = $body[$k]; }
        }
        if (!$fields) fail('Tidak ada data untuk diubah.');
        $params[] = $id;
        db()->prepare("UPDATE media SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        ok(['media' => list_media()]);
    }

    case 'delete': {
        $id = (int)($body['id'] ?? 0);
        $st = db()->prepare("SELECT src FROM media WHERE id=?");
        $st->execute([$id]);
        $src = (string)$st->fetchColumn();
        if ($src !== '' && str_starts_with($src, 'uploads/')) {
            $path = APP_ROOT . '/' . $src;
            if (is_file($path)) @unlink($path);
        }
        db()->prepare("DELETE FROM media WHERE id=?")->execute([$id]);
        ok(['media' => list_media()]);
    }

    case 'reorder': {
        $order = $body['order'] ?? [];
        if (!is_array($order)) fail('Format urutan tidak valid.');
        $st = db()->prepare("UPDATE media SET sort_order=? WHERE id=?");
        foreach (array_values($order) as $i => $id) $st->execute([$i, (int)$id]);
        ok(['media' => list_media()]);
    }

    default:
        fail('Aksi tidak dikenal.', 404, 'unknown_action');
}
