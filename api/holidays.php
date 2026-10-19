<?php
/**
 * Hari besar Islam: CRUD + perhitungan hari besar terdekat (Hijriah).
 */
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/hijri.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? 'list';

if ($method === 'GET') {
    switch ($action) {
        case 'list':
            ok(['items' => list_holidays(), 'months' => hijri_months()]);
        case 'upcoming': {
            $days  = max(30, min(1200, (int)($_GET['days'] ?? 400)));
            $limit = max(1, min(40, (int)($_GET['limit'] ?? 8)));
            ok(['items' => upcoming_holidays($days, $limit)]);
        }
        case 'today': {
            $off = (int)(get_settings()['calc']['hijriOffset'] ?? 0);
            $h = to_hijri(new DateTime('today'), $off);
            $months = hijri_months();
            ok([
                'hijri' => $h,
                'label' => $h['d'] . ' ' . ($months[$h['m']] ?? '') . ' ' . $h['y'] . ' H',
                'offset' => $off,
            ]);
        }
        default:
            fail('Aksi tidak dikenal.', 404, 'unknown_action');
    }
}

require_auth();
$body = json_body();

switch ($action) {
    case 'add': {
        $name = trim((string)($body['name'] ?? ''));
        if ($name === '') fail('Nama hari besar wajib diisi.');
        $hm = (int)($body['hijri_month'] ?? 0);
        $hd = (int)($body['hijri_day'] ?? 0);
        db()->prepare("INSERT INTO holidays(name,hijri_month,hijri_day,gregorian_date,description,active) VALUES(?,?,?,?,?,?)")
            ->execute([$name, $hm ?: null, $hd ?: null, $body['gregorian_date'] ?? null, (string)($body['description'] ?? ''), (int)($body['active'] ?? 1)]);
        ok(['items' => list_holidays()]);
    }
    case 'update': {
        $id = (int)($body['id'] ?? 0);
        $fields = []; $params = [];
        foreach (['name' => 's', 'hijri_month' => 'i', 'hijri_day' => 'i', 'gregorian_date' => 's', 'description' => 's', 'active' => 'i'] as $k => $t) {
            if (array_key_exists($k, $body)) { $fields[] = "$k = ?"; $params[] = $body[$k]; }
        }
        if (!$fields) fail('Tidak ada data untuk diubah.');
        $params[] = $id;
        db()->prepare("UPDATE holidays SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        ok(['items' => list_holidays()]);
    }
    case 'delete': {
        db()->prepare("DELETE FROM holidays WHERE id=?")->execute([(int)($body['id'] ?? 0)]);
        ok(['items' => list_holidays()]);
    }
    case 'reset': {
        db()->exec("DELETE FROM holidays");
        seed_holidays();
        ok(['items' => list_holidays()]);
    }
    default:
        fail('Aksi tidak dikenal.', 404, 'unknown_action');
}

function seed_holidays(): void
{
    $st = db()->prepare("INSERT INTO holidays(name,hijri_month,hijri_day,description,active) VALUES(?,?,?,?,1)");
    foreach ([
        ['Tahun Baru Islam (1 Muharram)', 1, 1, 'Awal tahun Hijriah'],
        ['Hari Asyura', 1, 10, 'Puasa sunnah Asyura'],
        ['Maulid Nabi Muhammad SAW', 3, 12, 'Kelahiran Rasulullah SAW'],
        ["Isra Mi'raj Nabi Muhammad SAW", 7, 27, 'Perjalanan malam Rasulullah SAW'],
        ["Nisfu Sya'ban", 8, 15, "Pertengahan bulan Sya'ban"],
        ['Awal Ramadhan', 9, 1, 'Hari pertama puasa Ramadhan'],
        ["Nuzulul Qur'an", 9, 17, 'Turunnya Al-Qur\'an'],
        ['Lailatul Qadar (perkiraan)', 9, 27, 'Malam seribu bulan'],
        ['Idul Fitri', 10, 1, '1 Syawal — Hari Raya Idul Fitri'],
        ['Hari Arafah', 12, 9, 'Puasa sunnah Arafah'],
        ['Idul Adha', 12, 10, '10 Dzulhijjah — Hari Raya Idul Adha'],
    ] as $h) $st->execute($h);
}
