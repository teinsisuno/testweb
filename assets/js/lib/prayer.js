/* =================================================================
   Perhitungan jadwal sholat offline (algoritma PrayTimes.org)
   Dipakai sebagai cadangan bila API Kemenag tidak tersedia.
   ================================================================= */
import { secToHM, tzOffsetHours } from './util.js';

const DEG = Math.PI / 180;
const dsin = d => Math.sin(d * DEG);
const dcos = d => Math.cos(d * DEG);
const dtan = d => Math.tan(d * DEG);
const dasin = x => Math.asin(x) / DEG;
const dacos = x => Math.acos(x) / DEG;
const dacot = x => Math.atan(1 / x) / DEG;
const datan2 = (y, x) => Math.atan2(y, x) / DEG;
const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };
const fixAngle = a => fix(a, 360);
const fixHour = a => fix(a, 24);

export const METHODS = {
    kemenag: { label: 'Kemenag RI (Fajr 20°, Isya 18°)', fajr: 20, isha: 18, ihtiyat: 2 },
    mwl:     { label: 'Muslim World League (18°, 17°)', fajr: 18, isha: 17, ihtiyat: 0 },
    isna:    { label: 'ISNA (15°, 15°)', fajr: 15, isha: 15, ihtiyat: 0 },
    egypt:   { label: 'Egyptian (19.5°, 17.5°)', fajr: 19.5, isha: 17.5, ihtiyat: 0 },
    makkah:  { label: 'Umm al-Qura (18.5°, 90 mnt)', fajr: 18.5, isha: 0, ishaInterval: 90, ihtiyat: 0 },
    karachi: { label: 'Univ. Karachi (18°, 18°)', fajr: 18, isha: 18, ihtiyat: 0 },
    custom:  { label: 'Kustom', fajr: 20, isha: 18, ihtiyat: 0 },
};

function julianDate(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const RA = datan2(dcos(e) * dsin(L), dcos(L)) / 15;
    const eqt = q / 15 - fixHour(RA);
    const decl = dasin(dsin(e) * dsin(L));
    return { declination: decl, equation: eqt };
}

/**
 * Hitung jadwal sholat.
 * @param {Date} date  tanggal lokal
 * @param {number} lat
 * @param {number} lng
 * @param {string} timeZone  mis. "Asia/Jakarta"
 * @param {object} opts  { fajrAngle, ishaAngle, ishaInterval, asrFactor, imsakAngle, elevation }
 * @returns {{imsak:string,fajar:string,subuh:string,syuruq:string,dhuha:string,dzuhur:string,ashar:string,maghrib:string,isya:string, raw:object}}
 */
export function computeTimes(date, lat, lng, timeZone, opts = {}) {
    const o = {
        fajrAngle: 20,
        ishaAngle: 18,
        ishaInterval: 0,
        asrFactor: 1,
        imsakAngle: 10,
        imsakMinutes: 10,
        dhuhaAngle: 7,
        elevation: 0,
        ...opts,
    };
    const tz = (opts.tzOffset !== undefined && opts.tzOffset !== null) ? opts.tzOffset : tzOffsetHours(timeZone, date);
    const jd = julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);

    const midDay = (t) => fixHour(12 - sunPosition(jd + t).equation);

    const sunAngleTime = (angle, t, ccw) => {
        const decl = sunPosition(jd + t).declination;
        const noon = midDay(t);
        const c = (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat));
        const cc = Math.max(-1, Math.min(1, c));
        const tt = dacos(cc) / 15;
        return noon + (ccw ? -tt : tt);
    };

    const asrTime = (factor, t) => {
        const decl = sunPosition(jd + t).declination;
        const angle = -dacot(factor + dtan(Math.abs(lat - decl)));
        return sunAngleTime(angle, t);
    };

    let t = { imsak: 5, fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18, dhuha: 7 };
    const portion = (tt) => {
        const out = {};
        for (const k in tt) out[k] = tt[k] / 24;
        return out;
    };

    for (let i = 0; i < 3; i++) {
        const p = portion(t);
        t = {
            imsak:   o.imsakAngle > 0 ? sunAngleTime(o.imsakAngle, p.imsak, true) : t.imsak,
            fajr:    sunAngleTime(o.fajrAngle, p.fajr, true),
            sunrise: sunAngleTime(0.833, p.sunrise, true),
            dhuha:   sunAngleTime(-Math.abs(o.dhuhaAngle), p.dhuha, true),
            dhuhr:   midDay(p.dhuhr),
            asr:     asrTime(o.asrFactor, p.asr),
            sunset:  sunAngleTime(0.833, p.sunset),
            isha:    o.ishaInterval > 0 ? sunAngleTime(0.833, p.sunset) + o.ishaInterval / 60 : sunAngleTime(o.ishaAngle, p.isha),
        };
    }

    // Penyesuaian: ketinggian tempat, koreksi meridian, zona waktu
    const elevationAdj = 0.0347 * Math.sqrt(Math.max(0, o.elevation)); // derajat
    const shift = tz - lng / 15;
    const out = {};
    for (const k in t) out[k] = t[k] + shift;

    // Syuruq/maghrib dikoreksi ketinggian (matahari terbit lebih awal, terbenam lebih lambat)
    out.sunrise -= elevationAdj / 15;
    out.sunset += elevationAdj / 15;
    // Dhuha memakai sudut ketinggian; bila tidak tersedia, syuruq + 15 menit
    out.dhuha -= elevationAdj / 15;

    const H = (h) => secToHM(Math.round(fixHour(h) * 3600));

    return {
        imsak:   H(out.fajr - Math.max(0, o.imsakMinutes) / 60),
        fajar:   H(out.fajr),
        subuh:   H(out.fajr),
        syuruq:  H(out.sunrise),
        terbit:  H(out.sunrise),
        dhuha:   H(out.dhuha),
        dzuhur:  H(out.dhuhr),
        ashar:   H(out.asr),
        maghrib: H(out.sunset),
        isya:    H(out.isha),
        raw: out,
        source: 'calc',
        tzOffset: tz,
    };
}

/** Arah kiblat (derajat dari utara, searah jarum jam) */
export function qiblaBearing(lat, lng) {
    const kLat = 21.4224779, kLng = 39.8251832;
    const p1 = lat * DEG, p2 = kLat * DEG, dl = (kLng - lng) * DEG;
    const y = Math.sin(dl);
    const x = Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dl);
    return (Math.atan2(y, x) / DEG + 360) % 360;
}

/** Jarak ke Ka'bah (km) */
export function qiblaDistance(lat, lng) {
    const kLat = 21.4224779, kLng = 39.8251832;
    const p1 = lat * DEG, p2 = kLat * DEG, dl = (kLng - lng) * DEG;
    const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
    return 6371 * Math.acos(Math.max(-1, Math.min(1, c)));
}
