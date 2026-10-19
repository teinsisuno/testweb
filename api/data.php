<?php
/**
 * Endpoint agregat: satu panggilan mengembalikan semua data yang
 * dibutuhkan SPA (agar mudah di-cache offline).
 */
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/hijri.php';

$action = $_GET['action'] ?? 'bootstrap';

switch ($action) {
    case 'bootstrap': {
        $settings = get_settings();
        $off = (int)($settings['calc']['hijriOffset'] ?? 0);
        $h = to_hijri(new DateTime('today'), $off);
        $months = hijri_months();
        $u = current_user();

        ok([
            'settings'     => $settings,
            'media'        => db()->query("SELECT * FROM media ORDER BY sort_order, id")->fetchAll(),
            'runningText'  => db()->query("SELECT * FROM running_text ORDER BY sort_order, id")->fetchAll(),
            'holidays'     => list_holidays(),
            'holidaysUpcoming' => upcoming_holidays(400, 10),
            'hijriToday'   => [
                'hijri' => $h,
                'label' => $h['d'] . ' ' . ($months[$h['m']] ?? '') . ' ' . $h['y'] . ' H',
            ],
            'user'         => $u,
            'authenticated'=> (bool)$u,
            'serverTime'   => date('c'),
            'timezone'     => date_default_timezone_get(),
            'baseUrl'      => base_url(),
            'appVersion'   => APP_VERSION,
        ]);
    }

    case 'ping':
        ok(['time' => date('c'), 'appVersion' => APP_VERSION]);

    default:
        fail('Aksi tidak dikenal.', 404, 'unknown_action');
}
