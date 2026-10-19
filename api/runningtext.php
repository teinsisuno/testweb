<?php
/**
 * Running text: daftar, tambah, ubah, hapus, urut.
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? 'list';

function list_rt(): array
{
    return db()->query("SELECT * FROM running_text ORDER BY sort_order ASC, id ASC")->fetchAll();
}

if ($method === 'GET') {
    if ($action === 'list') ok(['items' => list_rt()]);
    fail('Aksi tidak dikenal.', 404, 'unknown_action');
}

require_auth();
$body = json_body();

switch ($action) {
    case 'add': {
        $text = trim((string)($body['text'] ?? ''));
        if ($text === '') fail('Teks tidak boleh kosong.');
        $sort = (int)db()->query("SELECT COALESCE(MAX(sort_order),-1)+1 FROM running_text")->fetchColumn();
        db()->prepare("INSERT INTO running_text(text,active,sort_order,created_at) VALUES(?,?,?,?)")
            ->execute([$text, (int)($body['active'] ?? 1), $sort, date('c')]);
        ok(['items' => list_rt()]);
    }
    case 'update': {
        $id = (int)($body['id'] ?? 0);
        $fields = []; $params = [];
        foreach (['text' => 's', 'active' => 'i', 'sort_order' => 'i'] as $k => $t) {
            if (array_key_exists($k, $body)) { $fields[] = "$k = ?"; $params[] = $body[$k]; }
        }
        if (!$fields) fail('Tidak ada data untuk diubah.');
        $params[] = $id;
        db()->prepare("UPDATE running_text SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        ok(['items' => list_rt()]);
    }
    case 'delete': {
        db()->prepare("DELETE FROM running_text WHERE id=?")->execute([(int)($body['id'] ?? 0)]);
        ok(['items' => list_rt()]);
    }
    case 'reorder': {
        $order = $body['order'] ?? [];
        if (!is_array($order)) fail('Format urutan tidak valid.');
        $st = db()->prepare("UPDATE running_text SET sort_order=? WHERE id=?");
        foreach (array_values($order) as $i => $id) $st->execute([$i, (int)$id]);
        ok(['items' => list_rt()]);
    }
    default:
        fail('Aksi tidak dikenal.', 404, 'unknown_action');
}
