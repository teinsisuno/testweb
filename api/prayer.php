<?php
/**
 * Proxy + cache jadwal sholat Kemenag (api.myquran.com) ke SQLite,
 * geocoding, arah kiblat, dan sinkronisasi rentang tanggal untuk offline.
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'jadwal';
$API = 'https://api.myquran.com/v2/sholat';

function norm_kota(string $s): string
{
    $s = strtoupper($s);
    $s = str_replace(['KAB.', 'KABUPATEN', 'KOTA', 'ADM.', 'ADMINISTRASI'], '', $s);
    $s = preg_replace('/[^A-Z0-9 ]/', ' ', $s);
    return trim(preg_replace('/\s+/', ' ', $s));
}

/** Simpan satu baris jadwal ke SQLite */
function cache_save(string $kotaId, array $row, string $source = 'kemenag'): void
{
    $date = $row['date'] ?? null;
    if (!$date) return;
    $st = db()->prepare("INSERT INTO prayer_cache
        (kota_id,date,imsak,fajar,subuh,terbit,dhuha,dzuhur,ashar,maghrib,isya,source,fetched_at)
        VALUES (:kota,:date,:imsak,:fajar,:subuh,:terbit,:dhuha,:dzuhur,:ashar,:maghrib,:isya,:src,:now)
        ON CONFLICT(kota_id,date) DO UPDATE SET
          imsak=excluded.imsak, subuh=excluded.subuh, terbit=excluded.terbit, dhuha=excluded.dhuha,
          dzuhur=excluded.dzuhur, ashar=excluded.ashar, maghrib=excluded.maghrib, isya=excluded.isya,
          source=excluded.source, fetched_at=excluded.fetched_at");
    $st->execute([
        ':kota' => $kotaId, ':date' => $date,
        ':imsak' => $row['imsak'] ?? null, ':fajar' => $row['fajar'] ?? null, ':subuh' => $row['subuh'] ?? null,
        ':terbit' => $row['terbit'] ?? null, ':dhuha' => $row['dhuha'] ?? null, ':dzuhur' => $row['dzuhur'] ?? null,
        ':ashar' => $row['ashar'] ?? null, ':maghrib' => $row['maghrib'] ?? null, ':isya' => $row['isya'] ?? null,
        ':src' => $source, ':now' => date('c'),
    ]);
}

function rows_from_sqlite(string $kotaId, string $from, string $to): array
{
    $st = db()->prepare("SELECT * FROM prayer_cache WHERE kota_id=? AND date BETWEEN ? AND ? ORDER BY date");
    $st->execute([$kotaId, $from, $to]);
    return $st->fetchAll();
}

switch ($action) {

    case 'kota': {
        $q = trim((string)($_GET['q'] ?? ''));
        if ($q === '') fail('Kata kunci kota diperlukan.');
        $raw = http_get("$API/kota/cari/" . rawurlencode($q), 2592000, 'kota_cari_' . md5(strtolower($q)));
        if (!$raw) fail('Tidak dapat memuat data kota.', 502, 'upstream');
        ok(['data' => $raw['data'] ?? []]);
    }

    case 'kota_all': {
        $raw = http_get("$API/kota/semua", 2592000, 'kota_all');
        if (!$raw) {
            $rows = db()->query("SELECT DISTINCT kota_id AS id FROM prayer_cache ORDER BY kota_id")->fetchAll();
            ok(['data' => $rows, 'offline' => true]);
        }
        ok(['data' => $raw['data'] ?? [], 'count' => count($raw['data'] ?? [])]);
    }

    case 'jadwal': {
        $id = preg_replace('/\D/', '', (string)($_GET['id'] ?? ''));
        $y  = (int)($_GET['y'] ?? date('Y'));
        $m  = (int)($_GET['m'] ?? date('n'));
        $d  = (int)($_GET['d'] ?? date('j'));
        if ($id === '') fail('ID kota diperlukan.');
        $date = sprintf('%04d-%02d-%02d', $y, $m, $d);
        $key  = "jadwal_{$id}_{$y}_" . str_pad((string)$m, 2, '0', STR_PAD_LEFT) . '_' . str_pad((string)$d, 2, '0', STR_PAD_LEFT);
        $raw  = http_get("$API/jadwal/$id/$y/$m/$d", 259200, $key);
        if ($raw && !empty($raw['data'])) {
            $row = $raw['data']['jadwal'] ?? $raw['data'];
            cache_save($id, $row);
            ok(['data' => $raw['data']]);
        }
        $rows = rows_from_sqlite($id, $date, $date);
        if ($rows) { ok(['data' => $rows[0], 'offline' => true]); }
        fail('Jadwal tidak tersedia.', 502, 'upstream');
    }

    case 'jadwal_bulan': {
        $id = preg_replace('/\D/', '', (string)($_GET['id'] ?? ''));
        $y  = (int)($_GET['y'] ?? date('Y'));
        $m  = (int)($_GET['m'] ?? date('n'));
        if ($id === '') fail('ID kota diperlukan.');
        $key = "jadwal_bulan_{$id}_{$y}_" . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
        $raw = http_get("$API/jadwal/$id/$y/$m", 2592000, $key);
        if ($raw && !empty($raw['data']['jadwal'])) {
            foreach ($raw['data']['jadwal'] as $row) cache_save($id, $row);
            ok(['data' => $raw['data']]);
        }
        $from = sprintf('%04d-%02d-01', $y, $m);
        $to   = date('Y-m-t', strtotime($from));
        $rows = rows_from_sqlite($id, $from, $to);
        if ($rows) ok(['data' => ['id' => $id, 'jadwal' => $rows], 'offline' => true]);
        fail('Jadwal bulanan tidak tersedia.', 502, 'upstream');
    }

    /** Sinkronisasi beberapa bulan sekaligus (default bulan ini + 2 bulan berikutnya) */
    case 'sync': {
        $id  = preg_replace('/\D/', '', (string)($_GET['id'] ?? ''));
        $n   = max(1, min(12, (int)($_GET['months'] ?? 3)));
        if ($id === '') fail('ID kota diperlukan.');
        $hasil = ['tersimpan' => 0, 'bulan' => [], 'gagal' => []];
        $base = strtotime(date('Y-m-01'));
        for ($i = 0; $i < $n; $i++) {
            $y = (int)date('Y', strtotime("+$i month", $base));
            $m = (int)date('n', strtotime("+$i month", $base));
            $key = "jadwal_bulan_{$id}_{$y}_" . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
            $raw = http_get("$API/jadwal/$id/$y/$m", 2592000, $key);
            if ($raw && !empty($raw['data']['jadwal'])) {
                foreach ($raw['data']['jadwal'] as $row) { cache_save($id, $row); $hasil['tersimpan']++; }
                $hasil['bulan'][] = sprintf('%04d-%02d', $y, $m);
            } else {
                $hasil['gagal'][] = sprintf('%04d-%02d', $y, $m);
            }
        }
        log_event('info', "Sinkronisasi jadwal kota $id", $hasil);
        ok(['hasil' => $hasil]);
    }

    /** Ambil cache tersimpan untuk rentang (untuk mode offline klien) */
    case 'range': {
        $id   = preg_replace('/\D/', '', (string)($_GET['id'] ?? ''));
        $from = (string)($_GET['from'] ?? date('Y-m-d'));
        $to   = (string)($_GET['to'] ?? date('Y-m-d', strtotime('+30 days')));
        if ($id === '') fail('ID kota diperlukan.');
        ok(['data' => rows_from_sqlite($id, $from, $to)]);
    }

    case 'geocode': {
        $lat = (float)($_GET['lat'] ?? 0);
        $lng = (float)($_GET['lng'] ?? 0);
        if ($lat === 0.0 && $lng === 0.0) fail('Koordinat tidak valid.');

        $raw = http_get(
            'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&addressdetails=1&accept-language=id&lat=' . $lat . '&lon=' . $lng,
            2592000,
            'geo_' . round($lat, 3) . '_' . round($lng, 3),
            ['User-Agent: JamSholatPWA/1.0 (masjid display)']
        );

        $alamat = ''; $kandidat = []; $state = '';
        if ($raw && isset($raw['address'])) {
            $a = $raw['address'];
            $alamat = (string)($raw['display_name'] ?? '');
            $state = (string)($a['state'] ?? '');
            foreach (['city', 'town', 'municipality', 'county', 'village', 'suburb', 'state_district', 'state'] as $k) {
                if (!empty($a[$k])) $kandidat[] = (string)$a[$k];
            }
        }

        $kotaId = null; $kotaName = null; $prov = null; $score = 0;
        $all = http_get("$API/kota/semua", 2592000, 'kota_all');
        if ($all && !empty($all['data'])) {
            foreach ($all['data'] as $kota) {
                $lokasi = (string)$kota['lokasi'];
                $nk = norm_kota($lokasi);
                $isKota = (bool)preg_match('/^KOTA\b/', strtoupper($lokasi));
                foreach ($kandidat as $i => $kand) {
                    $nc = norm_kota($kand);
                    if ($nc === '') continue;
                    $s = 0;
                    if ($nk === $nc) $s = 100;
                    elseif ($nk !== '' && (str_contains($nk, $nc) || str_contains($nc, $nk))) $s = 70;
                    $s += max(0, 20 - $i * 3);
                    // Prioritaskan "KOTA" bila kandidat menyebut kota
                    if ($isKota && stripos($kand, 'kota') !== false) $s += 15;
                    if (!$isKota && preg_match('/\b(kab|kabupaten)\b/i', $kand)) $s += 15;
                    if ($s > $score) { $score = $s; $kotaId = (string)$kota['id']; $kotaName = $lokasi; }
                }
            }
            foreach ($all['data'] as $kota) {
                if ((string)$kota['id'] === $kotaId) { $prov = (string)($kota['daerah'] ?? ''); break; }
            }
        }
        if (($prov === null || $prov === '') && $state !== '') $prov = strtoupper($state);

        if ($lng <= 114.5)      $tz = 'Asia/Jakarta';
        elseif ($lng <= 127.5)  $tz = 'Asia/Makassar';
        else                    $tz = 'Asia/Jayapura';

        // Ketinggian tempat (m dpl) — memengaruhi syuruq & maghrib pada mode offline
        $elevasi = null;
        $el = http_get(
            'https://api.open-meteo.com/v1/elevation?latitude=' . $lat . '&longitude=' . $lng,
            2592000,
            'elev_' . round($lat, 3) . '_' . round($lng, 3)
        );
        if ($el && isset($el['elevation'][0])) $elevasi = (int)round((float)$el['elevation'][0]);

        ok([
            'lat' => $lat, 'lng' => $lng, 'alamat' => $alamat, 'kandidat' => $kandidat,
            'kotaId' => $kotaId, 'kotaName' => $kotaName, 'provinsi' => $prov, 'timezone' => $tz,
            'elevasi' => $elevasi,
        ]);
    }

    case 'kiblat': {
        $lat = (float)($_GET['lat'] ?? 0);
        $lng = (float)($_GET['lng'] ?? 0);
        $kLat = 21.4224779; $kLng = 39.8251832;
        $phi1 = deg2rad($lat); $phi2 = deg2rad($kLat); $dLng = deg2rad($kLng - $lng);
        $y = sin($dLng);
        $x = cos($phi1) * tan($phi2) - sin($phi1) * cos($dLng);
        $brg = fmod(rad2deg(atan2($y, $x)) + 360, 360);
        $dist = 6371 * acos(max(-1, min(1, sin($phi1) * sin($phi2) + cos($phi1) * cos($phi2) * cos($dLng))));
        ok(['bearing' => round($brg, 2), 'distanceKm' => round($dist, 1)]);
    }

    default:
        fail('Aksi tidak dikenal.', 404, 'unknown_action');
}
