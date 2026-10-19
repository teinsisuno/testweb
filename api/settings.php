<?php
/**
 * Pengaturan aplikasi (SQLite).
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($method === 'GET' ? 'get' : 'save');

if ($method === 'GET') {
    switch ($action) {
        case 'export':
            header('Content-Type: application/json; charset=utf-8');
            header('Content-Disposition: attachment; filename="pengaturan-jam-sholat.json"');
            echo json_encode(get_settings(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        case 'get':
            ok([
                'settings'   => get_settings(),
                'serverTime' => date('c'),
                'timezone'   => date_default_timezone_get(),
                'baseUrl'    => base_url(),
                'appVersion' => APP_VERSION,
            ]);
        default:
            fail('Aksi tidak dikenal.', 404, 'unknown_action');
    }
}

require_auth();
$body = json_body();

switch ($action) {
    case 'save': {
        $patch = $body['settings'] ?? $body;
        if (!is_array($patch)) fail('Data pengaturan tidak valid.');
        $new = put_settings($patch);
        log_event('info', 'Pengaturan disimpan', ['keys' => array_keys($patch)]);
        ok(['settings' => $new, 'message' => 'Pengaturan tersimpan.']);
    }
    case 'import': {
        $patch = $body['settings'] ?? $body;
        if (!is_array($patch)) fail('Data impor tidak valid.');
        $new = put_settings($patch);
        ok(['settings' => $new, 'message' => 'Pengaturan berhasil diimpor.']);
    }
    case 'reset': {
        db()->exec("DELETE FROM settings WHERE key='app'");
        ok(['settings' => get_settings(), 'message' => 'Pengaturan dikembalikan ke bawaan.']);
    }
    default:
        fail('Aksi tidak dikenal.', 404, 'unknown_action');
}
