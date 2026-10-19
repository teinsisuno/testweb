<?php
/**
 * Bootstrap aplikasi: helper, koneksi SQLite, skema, dan seed data.
 * Jam Jadwal Sholat — PWA offline-first.
 */
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

date_default_timezone_set('Asia/Jakarta');

define('APP_ROOT', dirname(__DIR__));
define('DATA_DIR', APP_ROOT . '/data');
define('UPLOAD_DIR', APP_ROOT . '/uploads');
define('DB_FILE', DATA_DIR . '/app.sqlite');
define('APP_VERSION', '2.1.0');

foreach ([DATA_DIR, UPLOAD_DIR] as $d) {
    if (!is_dir($d)) @mkdir($d, 0777, true);
}

/* ================================================================= */
/* Base URL (mendukung sub-folder, mis. /testweb/)                   */
/* ================================================================= */
function base_path(): string
{
    $script = $_SERVER['SCRIPT_NAME'] ?? '/index.php';
    $dir = preg_replace('#/api/[^/]*$#', '', $script);
    if ($dir === null) $dir = '';
    return rtrim($dir, '/');
}
function base_url(): string
{
    return base_path() . '/';
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => base_path() !== '' ? base_path() : '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_name('JJS_SESS');
    session_start();
}

/* ================================================================= */
/* JSON helper                                                       */
/* ================================================================= */
function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') return $_POST ?: [];
    $j = json_decode($raw, true);
    return is_array($j) ? $j : [];
}
function fail(string $msg, int $code = 400, string $kode = 'error'): void
{
    json_out(['ok' => false, 'error' => $kode, 'message' => $msg], $code);
}
function ok(array $data = []): void
{
    json_out(array_merge(['ok' => true], $data));
}

/* ================================================================= */
/* Database SQLite                                                   */
/* ================================================================= */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $new = !is_file(DB_FILE);
    $pdo = new PDO('sqlite:' . DB_FILE, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec('PRAGMA foreign_keys = ON');

    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec(<<<SQL
    CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT UNIQUE NOT NULL,
        name          TEXT NOT NULL DEFAULT '',
        role          TEXT NOT NULL DEFAULT 'admin',
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        updated_at    TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        type       TEXT NOT NULL DEFAULT 'image',
        src        TEXT NOT NULL,
        title      TEXT DEFAULT '',
        duration   INTEGER DEFAULT 15,
        sort_order INTEGER DEFAULT 0,
        active     INTEGER DEFAULT 1,
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS running_text (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        text       TEXT NOT NULL,
        active     INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS holidays (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name           TEXT NOT NULL,
        hijri_month    INTEGER,
        hijri_day      INTEGER,
        gregorian_date TEXT,
        description    TEXT DEFAULT '',
        active         INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS prayer_cache (
        kota_id    TEXT NOT NULL,
        date       TEXT NOT NULL,
        imsak      TEXT, fajar TEXT, subuh TEXT, terbit TEXT, dhuha TEXT,
        dzuhur     TEXT, ashar TEXT, maghrib TEXT, isya TEXT,
        source     TEXT DEFAULT 'kemenag',
        fetched_at TEXT,
        PRIMARY KEY (kota_id, date)
    );
    CREATE TABLE IF NOT EXISTS logs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        level      TEXT DEFAULT 'info',
        message    TEXT,
        context    TEXT,
        created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_prayer_date ON prayer_cache(date);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
    SQL);

    $v = $pdo->query("SELECT value FROM meta WHERE key='schema_version'")->fetchColumn();
    if ($v === false) {
        $pdo->prepare("INSERT INTO meta(key,value) VALUES('schema_version','1')")->execute();
        seed_defaults($pdo);
    }
}

function seed_defaults(PDO $pdo): void
{
    // Admin bawaan
    $n = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($n === 0) {
        $st = $pdo->prepare("INSERT INTO users(username,name,role,password_hash,created_at) VALUES(?,?,?,?,?)");
        $st->execute(['admin', 'Administrator', 'admin', password_hash('admin123', PASSWORD_DEFAULT), date('c')]);
    }

    // Media bawaan
    $n = (int)$pdo->query("SELECT COUNT(*) FROM media")->fetchColumn();
    if ($n === 0) {
        $st = $pdo->prepare("INSERT INTO media(type,src,title,duration,sort_order,active,created_at) VALUES('image',?,?,?,?,1,?)");
        $bgs = [
            ['assets/img/bg-1.jpg', 'Malam di Masjid'],
            ['assets/img/bg-2.jpg', 'Senja Kota'],
            ['assets/img/bg-3.jpg', 'Masjid Hijau'],
            ['assets/img/bg-4.jpg', 'Langit Ungu'],
            ['assets/img/bg-5.jpg', 'Cakrawala Emas'],
        ];
        foreach ($bgs as $i => $b) $st->execute([$b[0], $b[1], 15, $i, date('c')]);
    }

    // Running text bawaan
    $n = (int)$pdo->query("SELECT COUNT(*) FROM running_text")->fetchColumn();
    if ($n === 0) {
        $st = $pdo->prepare("INSERT INTO running_text(text,active,sort_order,created_at) VALUES(?,1,?,?)");
        $st->execute(['Selamat datang di Masjid Az Zamzam — Mari jaga kebersihan dan ketertiban masjid. Mohon aktifkan mode senyap saat sholat berjamaah.', 0, date('c')]);
        $st->execute(['"Sesungguhnya sholat itu mencegah dari perbuatan keji dan mungkar." (QS. Al-Ankabut: 45)', 1, date('c')]);
    }

    // Hari besar Islam bawaan
    $n = (int)$pdo->query("SELECT COUNT(*) FROM holidays")->fetchColumn();
    if ($n === 0) {
        $st = $pdo->prepare("INSERT INTO holidays(name,hijri_month,hijri_day,description,active) VALUES(?,?,?,?,1)");
        foreach ([
            ['Tahun Baru Islam (1 Muharram)',        1,  1,  'Awal tahun Hijriah'],
            ['Hari Asyura',                          1,  10, 'Puasa sunnah Asyura'],
            ['Maulid Nabi Muhammad SAW',             3,  12, 'Kelahiran Rasulullah SAW'],
            ['Isra Mi\'raj Nabi Muhammad SAW',       7,  27, 'Perjalanan malam Rasulullah SAW'],
            ['Nisfu Sya\'ban',                       8,  15, 'Pertengahan bulan Sya\'ban'],
            ['Awal Ramadhan',                        9,  1,  'Hari pertama puasa Ramadhan'],
            ['Nuzulul Qur\'an',                      9,  17, 'Turunnya Al-Qur\'an'],
            ['Lailatul Qadar (perkiraan)',           9,  27, 'Malam seribu bulan'],
            ['Idul Fitri',                           10, 1,  '1 Syawal — Hari Raya Idul Fitri'],
            ['Hari Arafah',                          12, 9,  'Puasa sunnah Arafah'],
            ['Idul Adha',                            12, 10, '10 Dzulhijjah — Hari Raya Idul Adha'],
        ] as $h) $st->execute($h);
    }
}

/* ================================================================= */
/* Log                                                               */
/* ================================================================= */
function log_event(string $level, string $message, $context = null): void
{
    try {
        $st = db()->prepare("INSERT INTO logs(level,message,context,created_at) VALUES(?,?,?,?)");
        $st->execute([$level, $message, is_string($context) ? $context : json_encode($context, JSON_UNESCAPED_UNICODE), date('c')]);
        // batasi 2000 baris
        db()->exec("DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 2000)");
    } catch (Throwable $e) {
        error_log('log_event: ' . $e->getMessage());
    }
}

/* ================================================================= */
/* Struktur pengaturan                                               */
/* ================================================================= */
function default_settings(): array
{
    return [
        'version'  => 1,
        'mosque'   => [
            'name'    => 'Masjid Az Zamzam',
            'address' => 'Jl. Cisaranten Kulon No. 18, Arcamanik, Kota Bandung',
            'logo'    => '',
        ],
        'location' => [
            'mode'     => 'kota',
            'kotaId'   => '1219',
            'kotaName' => 'KOTA BANDUNG',
            'provinsi' => 'JAWA BARAT',
            'lat'      => -6.914744,
            'lng'      => 107.609810,
            'timezone' => 'Asia/Jakarta',
            'elevasi'  => 768,
        ],
        'calc'     => [
            'method'      => 'kemenag',
            'fajrAngle'   => 20,
            'ishaAngle'   => 18,
            'imsakMinutes'=> 10,
            'dhuhaAngle'  => 7,
            'asrFactor'   => 1,
            'ihtiyat'     => 2,
            'hijriOffset' => 0,
        ],
        'offsets'  => ['imsak' => 0, 'fajar' => 0, 'subuh' => 0, 'syuruq' => 0, 'dhuha' => 0, 'dzuhur' => 0, 'ashar' => 0, 'maghrib' => 0, 'isya' => 0],
        'visible'  => ['imsak', 'subuh', 'syuruq', 'dzuhur', 'ashar', 'maghrib', 'isya'],
        'labels'   => [
            'imsak' => 'Imsak', 'fajar' => 'Fajar', 'subuh' => 'Shubuh',
            'syuruq' => 'Syuruq', 'dhuha' => 'Dhuha', 'dzuhur' => 'Dzuhur',
            'ashar' => 'Ashar', 'maghrib' => 'Maghrib', 'isya' => "Isya'",
        ],
        'iqomah'   => ['fajar' => 10, 'subuh' => 10, 'dhuha' => 0, 'dzuhur' => 10, 'ashar' => 10, 'maghrib' => 7, 'isya' => 10],
        'hening'   => ['fajar' => 10, 'subuh' => 10, 'dhuha' => 0, 'dzuhur' => 10, 'ashar' => 10, 'maghrib' => 10, 'isya' => 10],
        'audio'    => [
            'adzanEnabled'  => true,
            'beepEnabled'   => true,
            'adzanUrl'      => 'assets/audio/adzan.wav',
            'beepUrl'       => 'assets/audio/beep.wav',
            'notifyUrl'     => 'assets/audio/notify.wav',
            'volume'        => 0.85,
            'adzanDelay'    => 0,
            'adzanDuration' => 180,
        ],
        'slideshow' => [
            'enabled'    => true,
            'interval'   => 15,
            'transition' => 'fade',
            'shuffle'    => false,
            'dim'        => 35,
        ],
        'runningText' => [
            'enabled'  => true,
            'speed'    => 70,
            'bg'       => '#0f8a3c',
            'color'    => '#ffffff',
            'fontSize' => 1.0,
            'separator'=> '  •  ',
        ],
        'theme'    => [
            'accent'     => '#ff8a00',
            'accentText' => '#ffffff',
            'barBg'      => 'rgba(12,16,22,0.62)',
            'barBlur'    => 10,
            'topFade'    => 92,
            'textTop'    => '#0b1220',
            'font'       => 'system',
        ],
        'clock'    => [
            'format'        => 24,
            'showSeconds'   => false,
            'showHijri'     => true,
            'showGregorian' => true,
        ],
        'hijri'    => ['holidaysEnabled' => true, 'showCountdown' => true],
        'display'  => [
            'wakeLock'           => true,
            'hideCursor'         => true,
            'showIqomahOverlay'  => true,
            'showHeningOverlay'  => true,
            'showSettingsButton' => true,
            'fullscreenOnStart'  => false,
            'requireLogin'       => false,
            'showSholatScreen'   => true,
            'sholatText'         => 'Harap tenang sedang ibadah sholat {prayer}',
            'sholatCountdown'    => false,
        ],
        'adzan'    => ['preAdzanMin' => 5, 'preAdzanOn' => true, 'iqomahOn' => true],
        'updatedAt' => null,
    ];
}

function deep_merge(array $base, array $src): array
{
    foreach ($src as $k => $v) {
        if (is_array($v) && isset($base[$k]) && is_array($base[$k]) && !array_is_list($v)) {
            $base[$k] = deep_merge($base[$k], $v);
        } else {
            $base[$k] = $v;
        }
    }
    return $base;
}

function get_settings(): array
{
    $st = db()->prepare("SELECT value FROM settings WHERE key='app'");
    $st->execute();
    $raw = $st->fetchColumn();
    $saved = $raw ? json_decode((string)$raw, true) : [];
    if (!is_array($saved)) $saved = [];
    return deep_merge(default_settings(), $saved);
}

function put_settings(array $patch): array
{
    $new = deep_merge(get_settings(), $patch);
    $new['updatedAt'] = date('c');
    $st = db()->prepare("INSERT INTO settings(key,value,updated_at) VALUES('app',?,?)
                         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at");
    $st->execute([json_encode($new, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), date('c')]);
    return $new;
}

/* ================================================================= */
/* Autentikasi                                                       */
/* ================================================================= */
function current_user(): ?array
{
    $u = $_SESSION['user'] ?? null;
    return is_array($u) ? $u : null;
}
function require_auth(): array
{
    $u = current_user();
    if (!$u) fail('Sesi berakhir. Silakan masuk kembali.', 401, 'unauthorized');
    return $u;
}

/* ================================================================= */
/* HTTP GET dengan cache disk (offline-first)                        */
/* ================================================================= */
function http_get(string $url, int $ttl = 0, string $cacheKey = '', array $headers = []): ?array
{
    $cacheDir = DATA_DIR . '/cache';
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0777, true);
    if ($cacheKey === '') $cacheKey = md5($url);
    $cacheFile = $cacheDir . '/' . preg_replace('/[^a-zA-Z0-9._-]/', '', $cacheKey) . '.json';

    if ($ttl > 0 && is_file($cacheFile) && (time() - filemtime($cacheFile)) < $ttl) {
        $c = json_decode((string)@file_get_contents($cacheFile), true);
        if (is_array($c)) return $c;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER     => array_merge(['Accept: application/json', 'User-Agent: JamSholatPWA/1.0'], $headers),
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($body === false || $code >= 400) {
        if (is_file($cacheFile)) {
            $c = json_decode((string)@file_get_contents($cacheFile), true);
            if (is_array($c)) return $c;
        }
        if ($err) error_log("http_get gagal: $url — $err");
        return null;
    }
    $j = json_decode((string)$body, true);
    if (!is_array($j)) return null;
    @file_put_contents($cacheFile, json_encode($j), LOCK_EX);
    return $j;
}

/* ================================================================= */
/* Booting                                                           */
/* ================================================================= */
db();
