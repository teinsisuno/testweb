<?php
/**
 * Sistem: informasi, log, bersihkan cache, unduh basis data.
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'info';

if ($action === 'db_download') {
    require_auth();
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="app-' . date('Ymd-His') . '.sqlite"');
    readfile(DB_FILE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && $action === 'info') {
    $user = current_user();
    $cacheDir = DATA_DIR . '/cache';
    $cacheFiles = is_dir($cacheDir) ? glob($cacheDir . '/*.json') ?: [] : [];
    $cacheSize = 0;
    foreach ($cacheFiles as $f) $cacheSize += (int)@filesize($f);
    $uploadFiles = glob(UPLOAD_DIR . '/*') ?: [];
    $uploadSize = 0;
    foreach ($uploadFiles as $f) $uploadSize += (int)@filesize($f);

    ok([
        'appVersion'   => APP_VERSION,
        'phpVersion'   => PHP_VERSION,
        'sqliteVersion'=> db()->query('SELECT sqlite_version()')->fetchColumn(),
        'dbSize'       => is_file(DB_FILE) ? filesize(DB_FILE) : 0,
        'cacheFiles'   => count($cacheFiles),
        'cacheSize'    => $cacheSize,
        'uploadFiles'  => count($uploadFiles),
        'uploadSize'   => $uploadSize,
        'serverTime'   => date('c'),
        'timezone'     => date_default_timezone_get(),
        'baseUrl'      => base_url(),
        'stats'        => [
            'users'        => (int)db()->query("SELECT COUNT(*) FROM users")->fetchColumn(),
            'media'        => (int)db()->query("SELECT COUNT(*) FROM media")->fetchColumn(),
            'runningText'  => (int)db()->query("SELECT COUNT(*) FROM running_text")->fetchColumn(),
            'holidays'     => (int)db()->query("SELECT COUNT(*) FROM holidays")->fetchColumn(),
            'prayerCache'  => (int)db()->query("SELECT COUNT(*) FROM prayer_cache")->fetchColumn(),
        ],
        'authenticated' => (bool)$user,
    ]);
}

require_auth();
$body = json_body();

switch ($action) {
    case 'logs': {
        $limit = max(1, min(500, (int)($_GET['limit'] ?? 200)));
        $rows = db()->query("SELECT * FROM logs ORDER BY id DESC LIMIT $limit")->fetchAll();
        ok(['logs' => $rows]);
    }
    case 'clear_logs': {
        db()->exec("DELETE FROM logs");
        ok();
    }
    case 'clear_cache': {
        $n = 0;
        foreach (glob(DATA_DIR . '/cache/*.json') ?: [] as $f) { @unlink($f); $n++; }
        ok(['message' => "$n berkas cache dihapus."]);
    }
    case 'clear_prayer_cache': {
        db()->exec("DELETE FROM prayer_cache");
        ok(['message' => 'Cache jadwal sholat dihapus.']);
    }
    case 'optimize': {
        db()->exec("VACUUM");
        ok(['message' => 'Basis data dioptimalkan.']);
    }
    case 'test_upstream': {
        $r = http_get('https://api.myquran.com/v2/sholat/kota/cari/bandung', 0, 'test_' . time());
        ok(['reachable' => (bool)$r]);
    }
    default:
        fail('Aksi tidak dikenal.', 404, 'unknown_action');
}
