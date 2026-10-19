<?php
/**
 * Pustaka Hijriah & hari besar Islam (kalender Umm al-Qura via intl).
 */
declare(strict_types=1);

function hijri_months(): array
{
    return [
        1 => 'Muharram', 2 => 'Safar', 3 => "Rabi'ul Awal", 4 => "Rabi'ul Akhir",
        5 => 'Jumadil Awal', 6 => 'Jumadil Akhir', 7 => 'Rajab', 8 => "Sya'ban",
        9 => 'Ramadhan', 10 => 'Syawal', 11 => "Dzulqa'dah", 12 => 'Dzulhijjah',
    ];
}

function hijri_fmt(): IntlDateFormatter
{
    static $f = null;
    if ($f === null) {
        $f = new IntlDateFormatter(
            'en_US@calendar=islamic-umalqura',
            IntlDateFormatter::FULL,
            IntlDateFormatter::FULL,
            'UTC',
            IntlDateFormatter::TRADITIONAL,
            'yyyy-MM-dd'
        );
    }
    return $f;
}

function to_hijri(DateTimeInterface $d, int $offsetDays = 0): array
{
    $dd = (new DateTime($d->format('Y-m-d'), new DateTimeZone('UTC')))
        ->modify(($offsetDays >= 0 ? '+' : '') . $offsetDays . ' days');
    [$y, $m, $day] = array_map('intval', explode('-', hijri_fmt()->format($dd)));
    return ['y' => $y, 'm' => $m, 'd' => $day];
}

function tanggal_id(DateTimeInterface $d): string
{
    $hari = ['Sunday' => 'Ahad', 'Monday' => 'Senin', 'Tuesday' => 'Selasa', 'Wednesday' => 'Rabu', 'Thursday' => 'Kamis', 'Friday' => "Jum'at", 'Saturday' => 'Sabtu'];
    $bulan = [1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'];
    return $hari[$d->format('l')] . ', ' . (int)$d->format('j') . ' ' . $bulan[(int)$d->format('n')] . ' ' . $d->format('Y');
}

function list_holidays(): array
{
    return db()->query("SELECT * FROM holidays ORDER BY hijri_month, hijri_day")->fetchAll();
}

/**
 * Hari besar terdekat dari hari ini.
 * Menggabungkan aturan Hijriah berulang + tanggal Gregorian tetap.
 */
function upcoming_holidays(int $days = 400, int $limit = 12): array
{
    $months = hijri_months();
    $rows = db()->query("SELECT * FROM holidays WHERE active=1")->fetchAll();
    if (!$rows) return [];

    $byHijri = [];
    $fixed   = [];
    foreach ($rows as $r) {
        $hm = (int)$r['hijri_month'];
        $hd = (int)$r['hijri_day'];
        if ($hm > 0 && $hd > 0) $byHijri["$hm-$hd"][] = $r;
        if (!empty($r['gregorian_date'])) $fixed[$r['gregorian_date']][] = $r;
    }

    $today = new DateTime('today', new DateTimeZone('UTC'));
    $found = [];

    for ($i = 0; $i <= $days; $i++) {
        $dt  = (clone $today)->modify("+$i days");
        $key = $dt->format('Y-m-d');
        $h   = to_hijri($dt);
        $hk  = $h['m'] . '-' . $h['d'];

        $cands = [];
        if (isset($byHijri[$hk])) $cands = array_merge($cands, $byHijri[$hk]);
        if (isset($fixed[$key]))  $cands = array_merge($cands, $fixed[$key]);

        foreach ($cands as $c) {
            $found[] = [
                'id'          => (int)$c['id'],
                'name'        => $c['name'],
                'description' => $c['description'] ?? '',
                'date'        => $key,
                'hijri'       => sprintf('%04d-%02d-%02d', $h['y'], $h['m'], $h['d']),
                'hijriLabel'  => $h['d'] . ' ' . ($months[$h['m']] ?? '') . ' ' . $h['y'] . ' H',
                'daysLeft'    => $i,
                'isToday'     => $i === 0,
                'dateLabel'   => tanggal_id($dt),
            ];
            if (count($found) >= $limit) return $found;
        }
    }
    return $found;
}
