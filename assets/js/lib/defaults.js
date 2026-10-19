/* Nilai pengaturan bawaan (cermin dari api/config.php) */
export function defaultSettings() {
    return {
        version: 1,
        mosque: {
            name: 'Masjid Az Zamzam',
            address: 'Jl. Cisaranten Kulon No. 18, Arcamanik, Kota Bandung',
            logo: '',
        },
        location: {
            mode: 'kota',
            kotaId: '1219',
            kotaName: 'KOTA BANDUNG',
            provinsi: 'JAWA BARAT',
            lat: -6.914744,
            lng: 107.609810,
            timezone: 'Asia/Jakarta',
            elevasi: 768,
        },
        calc: { method: 'kemenag', fajrAngle: 20, ishaAngle: 18, imsakMinutes: 10, dhuhaAngle: 7, asrFactor: 1, ihtiyat: 2, hijriOffset: 0 },
        offsets: { imsak: 0, fajar: 0, subuh: 0, syuruq: 0, dhuha: 0, dzuhur: 0, ashar: 0, maghrib: 0, isya: 0 },
        visible: ['imsak', 'subuh', 'syuruq', 'dzuhur', 'ashar', 'maghrib', 'isya'],
        labels: {
            imsak: 'Imsak', fajar: 'Fajar', subuh: 'Shubuh', syuruq: 'Syuruq', dhuha: 'Dhuha',
            dzuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: "Isya'",
        },
        iqomah: { fajar: 10, subuh: 10, dhuha: 0, dzuhur: 10, ashar: 10, maghrib: 7, isya: 10 },
        hening: { fajar: 10, subuh: 10, dhuha: 0, dzuhur: 10, ashar: 10, maghrib: 10, isya: 10 },
        audio: {
            adzanEnabled: true, beepEnabled: true,
            adzanUrl: 'assets/audio/adzan.wav', beepUrl: 'assets/audio/beep.wav', notifyUrl: 'assets/audio/notify.wav',
            volume: 0.85, adzanDelay: 0, adzanDuration: 180,
        },
        slideshow: { enabled: true, interval: 15, transition: 'fade', shuffle: false, dim: 35 },
        runningText: { enabled: true, speed: 70, bg: '#0f8a3c', color: '#ffffff', fontSize: 1.0, separator: '  •  ' },
        theme: {
            accent: '#ff8a00', accentText: '#ffffff', barBg: 'rgba(12,16,22,0.62)', barBlur: 10,
            topFade: 92, textTop: '#0b1220', font: 'system',
        },
        clock: { format: 24, showSeconds: false, showHijri: true, showGregorian: true },
        hijri: { holidaysEnabled: true, showCountdown: true },
        display: {
            wakeLock: true, hideCursor: true, showIqomahOverlay: true, showHeningOverlay: true,
            showSettingsButton: true, fullscreenOnStart: false, requireLogin: false,
            showSholatScreen: true,
            sholatText: 'Harap tenang sedang ibadah sholat {prayer}',
            sholatCountdown: false,
        },
        adzan: { preAdzanMin: 5, preAdzanOn: true, iqomahOn: true },
        updatedAt: null,
    };
}

export const TIMEZONES = [
    { id: 'Asia/Jakarta', label: 'WIB — Asia/Jakarta (UTC+7)' },
    { id: 'Asia/Makassar', label: 'WITA — Asia/Makassar (UTC+8)' },
    { id: 'Asia/Jayapura', label: 'WIT — Asia/Jayapura (UTC+9)' },
    { id: 'Asia/Pontianak', label: 'WIB — Asia/Pontianak (UTC+7)' },
    { id: 'Asia/Kuala_Lumpur', label: 'Malaysia — Asia/Kuala_Lumpur' },
    { id: 'Asia/Singapore', label: 'Singapura — Asia/Singapore' },
    { id: 'Asia/Riyadh', label: 'Arab Saudi — Asia/Riyadh' },
    { id: 'Asia/Dubai', label: 'Dubai — Asia/Dubai' },
    { id: 'Europe/London', label: 'London — Europe/London' },
    { id: 'UTC', label: 'UTC' },
];
