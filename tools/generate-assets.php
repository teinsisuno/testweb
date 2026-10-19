<?php
/**
 * Generator aset default: ikon PWA, latar slideshow, dan audio.
 * Jalankan sekali: php tools/generate-assets.php
 */
ini_set('display_errors', '1');
error_reporting(E_ALL);

$root = dirname(__DIR__);
$imgDir = $root . '/assets/img';
$audioDir = $root . '/assets/audio';
@mkdir($imgDir, 0777, true);
@mkdir($audioDir, 0777, true);

/* ------------------------------------------------------------------ */
/* Helper gambar                                                       */
/* ------------------------------------------------------------------ */
function hex2rgb($hex)
{
    $hex = ltrim($hex, '#');
    return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
}
function gd_alloc($im, $hex)
{
    [$r, $g, $b] = hex2rgb($hex);
    return imagecolorallocate($im, $r, $g, $b);
}
/** Gradien vertikal */
function vgradient($im, $w, $h, $c1, $c2)
{
    [$r1, $g1, $b1] = hex2rgb($c1);
    [$r2, $g2, $b2] = hex2rgb($c2);
    for ($y = 0; $y < $h; $y++) {
        $t = $y / max(1, $h - 1);
        $r = (int) round($r1 + ($r2 - $r1) * $t);
        $g = (int) round($g1 + ($g2 - $g1) * $t);
        $b = (int) round($b1 + ($b2 - $b1) * $t);
        $col = imagecolorallocate($im, $r, $g, $b);
        imageline($im, 0, $y, $w, $y, $col);
    }
}
/** Gradien diagonal */
function dgradient($im, $w, $h, $c1, $c2)
{
    [$r1, $g1, $b1] = hex2rgb($c1);
    [$r2, $g2, $b2] = hex2rgb($c2);
    for ($y = 0; $y < $h; $y++) {
        $t = $y / max(1, $h - 1);
        $r = (int) round($r1 + ($r2 - $r1) * $t);
        $g = (int) round($g1 + ($g2 - $g1) * $t);
        $b = (int) round($b1 + ($b2 - $b1) * $t);
        $col = imagecolorallocate($im, $r, $g, $b);
        imageline($im, 0, $y, $w, $y, $col);
    }
}

/**
 * Siluet masjid bergaya: kubah utama, dua kubah kecil, dua menara.
 */
function drawMosque($im, $cx, $baseY, $scale, $color, $alpha = 0)
{
    $w = 900 * $scale;
    $h = 300 * $scale;
    $x0 = $cx - $w / 2;
    $c = imagecolorallocatealpha($im, $color[0], $color[1], $color[2], $alpha);

    // Badan utama
    imagefilledrectangle($im, (int)($x0 + $w * .28), (int)($baseY - $h * .55), (int)($x0 + $w * .72), (int)$baseY, $c);
    // Kubah utama (ellipse)
    imagefilledellipse($im, (int)$cx, (int)($baseY - $h * .55), (int)($w * .46), (int)($h * .70), $c);
    // Kubah kecil kiri & kanan
    imagefilledrectangle($im, (int)($x0 + $w * .14), (int)($baseY - $h * .40), (int)($x0 + $w * .28), (int)$baseY, $c);
    imagefilledrectangle($im, (int)($x0 + $w * .72), (int)($baseY - $h * .40), (int)($x0 + $w * .86), (int)$baseY, $c);
    imagefilledellipse($im, (int)($x0 + $w * .21), (int)($baseY - $h * .40), (int)($w * .15), (int)($h * .34), $c);
    imagefilledellipse($im, (int)($x0 + $w * .79), (int)($baseY - $h * .40), (int)($w * .15), (int)($h * .34), $c);
    // Menara
    foreach ([0.04, 0.96] as $mx) {
        $tx = $x0 + $w * $mx;
        imagefilledrectangle($im, (int)($tx - $w * .018), (int)($baseY - $h * 1.35), (int)($tx + $w * .018), (int)$baseY, $c);
        imagefilledellipse($im, (int)$tx, (int)($baseY - $h * 1.35), (int)($w * .05), (int)($h * .16), $c);
        // puncak
        imagefilledpolygon($im, [
            (int)$tx, (int)($baseY - $h * 1.62),
            (int)($tx - $w * .012), (int)($baseY - $h * 1.42),
            (int)($tx + $w * .012), (int)($baseY - $h * 1.42),
        ], 3, $c);
    }
    // Bulan sabit di kubah utama
    $moonY = (int)($baseY - $h * .95);
    $r = (int)(32 * $scale);
    imagefilledellipse($im, (int)$cx, $moonY, $r * 2, $r * 2, $c);
    imagefilledellipse($im, (int)($cx + $r * .55), $moonY - (int)($r * .12), (int)($r * 1.8), (int)($r * 1.8), imagecolorallocatealpha($im, 0, 0, 0, 127));
}

/** Pola geometri islami samar */
function drawPattern($im, $w, $h, $color, $alpha = 110, $step = 120)
{
    $c = imagecolorallocatealpha($im, $color[0], $color[1], $color[2], $alpha);
    imagesetthickness($im, 2);
    for ($x = -$h; $x < $w + $h; $x += $step) {
        imageline($im, $x, 0, $x + $h, $h, $c);
        imageline($im, $x, $h, $x + $h, 0, $c);
    }
    for ($x = 0; $x < $w + $step; $x += $step) {
        for ($y = 0; $y < $h + $step; $y += $step) {
            $r = (int)($step * .30);
            imageellipse($im, $x, $y, $r * 2, $r * 2, $c);
        }
    }
    imagesetthickness($im, 1);
}

/** Bintang */
function drawStars($im, $w, $h, $count, $color, $alpha = 40)
{
    for ($i = 0; $i < $count; $i++) {
        $a = min(127, $alpha + random_int(-20, 40));
        $c = imagecolorallocatealpha($im, $color[0], $color[1], $color[2], $a);
        $x = random_int(0, $w);
        $y = random_int(0, (int)($h * .6));
        $s = random_int(1, 3);
        imagefilledellipse($im, $x, $y, $s, $s, $c);
    }
}

/* ------------------------------------------------------------------ */
/* 1. Ikon PWA                                                         */
/* ------------------------------------------------------------------ */
function makeIcon($path, $size, $maskable = false)
{
    $im = imagecreatetruecolor($size, $size);
    imagesavealpha($im, true);
    imagealphablending($im, true);
    $pad = $maskable ? (int)($size * 0.18) : 0;
    vgradient($im, $size, $size, '#0b2b26', '#0f5f4a');
    drawPattern($im, $size, $size, [120, 220, 180], 120, (int)($size / 4));
    $cx = (int)($size * .5);
    $baseY = (int)($size * (.80 - $pad / $size));
    drawMosque($im, $cx, $baseY, $size / 1400 * (1 - $pad / $size) * 1.25, [255, 255, 255], 0);
    imagepng($im, $path);
    imagedestroy($im);
    echo "  · $path\n";
}

echo "Membuat ikon...\n";
makeIcon("$imgDir/icon-192.png", 192);
makeIcon("$imgDir/icon-512.png", 512);
makeIcon("$imgDir/icon-maskable-512.png", 512, true);
makeIcon("$imgDir/apple-touch-icon.png", 180);
// favicon
$fav = imagecreatetruecolor(64, 64);
imagesavealpha($fav, true);
vgradient($fav, 64, 64, '#0b2b26', '#0f5f4a');
drawMosque($fav, 32, 54, 0.075, [255, 255, 255], 0);
imagepng($fav, "$imgDir/favicon.png");
imagedestroy($fav);
echo "  · $imgDir/favicon.png\n";

/* ------------------------------------------------------------------ */
/* 2. Latar slideshow                                                  */
/* ------------------------------------------------------------------ */
$backgrounds = [
    ['bg-1.jpg', '#071a2b', '#0d4f6e', '#0a2f45', 1],
    ['bg-2.jpg', '#2b0a2e', '#7b2d5e', '#c94b6c', 2],
    ['bg-3.jpg', '#0d1b0f', '#1f5c3a', '#0e3a24', 1],
    ['bg-4.jpg', '#1a1230', '#3b2a6b', '#6b4fa0', 2],
    ['bg-5.jpg', '#2e1a06', '#8a5a12', '#c98a1e', 2],
];
echo "Membuat latar belakang...\n";
foreach ($backgrounds as [$file, $c1, $c2, $c3, $mode]) {
    $W = 1920;
    $H = 1080;
    $im = imagecreatetruecolor($W, $H);
    dgradient($im, $W, $H, $c1, $c2);
    // lapisan kedua di bagian bawah
    [$r3, $g3, $b3] = hex2rgb($c3);
    for ($y = (int)($H * .45); $y < $H; $y++) {
        $t = ($y - $H * .45) / ($H * .55);
        $col = imagecolorallocatealpha($im, $r3, $g3, $b3, (int)(127 - 90 * $t));
        imageline($im, 0, $y, $W, $y, $col);
    }
    drawStars($im, $W, $H, 220, [255, 255, 255], 55);
    // bulan
    $mx = random_int(1100, 1650);
    $my = random_int(120, 300);
    $mr = random_int(60, 100);
    imagefilledellipse($im, $mx, $my, $mr * 2, $mr * 2, imagecolorallocatealpha($im, 255, 245, 210, 20));
    imagefilledellipse($im, $mx + (int)($mr * .5), $my - (int)($mr * .1), (int)($mr * 1.7), (int)($mr * 1.7), imagecolorallocatealpha($im, 0, 0, 0, 90));
    drawPattern($im, $W, $H, [255, 255, 255], 122, 190);
    // horizon
    imagefilledrectangle($im, 0, (int)($H * .78), $W, $H, imagecolorallocatealpha($im, 0, 0, 0, 70));
    if ($mode === 1) {
        drawMosque($im, 960, (int)($H * .84), 1.35, [12, 20, 26], 30);
    } else {
        // siluet kota
        $c = imagecolorallocatealpha($im, 6, 10, 16, 25);
        $x = 0;
        while ($x < $W) {
            $bw = random_int(60, 170);
            $bh = random_int(60, 260);
            imagefilledrectangle($im, $x, (int)($H * .84) - $bh, $x + $bw, (int)($H * .84), $c);
            $x += $bw + random_int(6, 26);
        }
        drawMosque($im, 700, (int)($H * .86), 1.05, [8, 12, 18], 20);
        drawMosque($im, 1500, (int)($H * .87), 0.75, [8, 12, 18], 30);
    }
    imagejpeg($im, "$imgDir/$file", 88);
    imagedestroy($im);
    echo "  · $imgDir/$file\n";
}

/* ------------------------------------------------------------------ */
/* 3. Audio (WAV)                                                      */
/* ------------------------------------------------------------------ */
/**
 * Tulis file WAV 16-bit mono dari array sample float [-1..1].
 */
function writeWav($path, array $samples, $rate = 44100)
{
    $n = count($samples);
    $data = '';
    foreach ($samples as $s) {
        $v = (int) max(-32768, min(32767, round($s * 32767)));
        $data .= pack('v', $v & 0xFFFF);
    }
    $byteRate = $rate * 2;
    $header = 'RIFF' . pack('V', 36 + strlen($data)) . 'WAVE'
        . 'fmt ' . pack('V', 16) . pack('v', 1) . pack('v', 1)
        . pack('V', $rate) . pack('V', $byteRate) . pack('v', 2) . pack('v', 16)
        . 'data' . pack('V', strlen($data));
    file_put_contents($path, $header . $data);
    echo "  · $path\n";
}

/** Nada dengan amplop ADSR + harmonik, terdengar "lonceng". */
function tone(&$buf, $rate, $start, $dur, $freq, $vol = .5, $harm = 3)
{
    $n = (int)($dur * $rate);
    $s0 = (int)($start * $rate);
    for ($i = 0; $i < $n; $i++) {
        $t = $i / $rate;
        $env = exp(-3.2 * $t / $dur);
        $s = 0.0;
        for ($h = 1; $h <= $harm; $h++) {
            $s += (1 / $h) * sin(2 * M_PI * $freq * $h * $t);
        }
        $idx = $s0 + $i;
        if (!isset($buf[$idx])) $buf[$idx] = 0.0;
        $buf[$idx] += $s * $vol * $env;
    }
}

echo "Membuat audio...\n";
// Beep singkat
$rate = 44100;
$buf = array_fill(0, (int)($rate * 0.9), 0.0);
tone($buf, $rate, 0.00, 0.35, 880, .55, 2);
tone($buf, $rate, 0.30, 0.50, 1320, .45, 3);
writeWav("$audioDir/beep.wav", $buf, $rate);

// Notifikasi (3 nada naik)
$buf = array_fill(0, (int)($rate * 1.6), 0.0);
tone($buf, $rate, 0.00, 0.30, 660, .45, 2);
tone($buf, $rate, 0.22, 0.30, 880, .45, 2);
tone($buf, $rate, 0.44, 0.55, 1174, .50, 3);
writeWav("$audioDir/notify.wav", $buf, $rate);

// Adzan sederhana (melodi panjang, beberapa frasa)
$buf = array_fill(0, (int)($rate * 16.0), 0.0);
$phrases = [
    [0.0,  [523.25, 587.33, 659.25]],
    [2.2,  [587.33, 659.25, 783.99]],
    [4.6,  [523.25, 659.25, 698.46]],
    [7.0,  [587.33, 698.46, 880.00]],
    [9.4,  [523.25, 587.33, 659.25]],
    [11.8, [466.16, 587.33, 698.46]],
];
foreach ($phrases as [$st, $notes]) {
    $t = $st;
    foreach ($notes as $f) {
        tone($buf, $rate, $t, 1.6, $f, .38, 3);
        $t += 0.62;
    }
}
writeWav("$audioDir/adzan.wav", $buf);

echo "\nSelesai. Semua aset berhasil dibuat.\n";
