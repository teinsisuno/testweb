/* =================================================================
   Tampilan utama (layar masjid / TV)
   ================================================================= */
import { state, toast, recomputeHijri } from '../store.js';
import { audio } from '../lib/audio.js';
import { KEYS, getDayTimes, buildTimeline, computeStatus } from '../lib/schedule.js';
import { pad, fmtDur, ymd, hmToSec, nowInZone } from '../lib/util.js';
import { hijriLabel, toHijri, tanggalId, nextHolidays, greeting } from '../lib/hijri.js';
import { navigate } from '../main.js';

const LS_ADZAN_MODE = 'jjs:adzan-mode';
const LS_VOLUME = 'jjs:volume';

export default {
    name: 'Display',

    data() {
        return {
            zoneNow: new Date(),
            todayTimes: null,
            tomorrowTimes: null,
            timeline: [],
            status: { phase: 'normal' },
            currentSec: 0,
            adzanMode: localStorage.getItem(LS_ADZAN_MODE) !== '0',
            currentVolume: Number(localStorage.getItem(LS_VOLUME) ?? 0.85),
            showBanner: false,
            bannerText: '',
            fired: {},
            slideIndex: 0,
            slideTimer: null,
            idle: false,
            idleTimer: null,
            holiday: null,
            tickerDur: 40,
            lastDayKey: '',
            reloadToken: 0,
            demo: new URLSearchParams(location.search).get('demo') || '',
            demoPrayer: new URLSearchParams(location.search).get('p') || 'ashar',
        };
    },

    computed: {
        s() { return state.settings || {}; },
        loc() { return this.s.location || {}; },
        theme() { return this.s.theme || {}; },
        clock() { return this.s.clock || {}; },
        visuals() { return this.s.visible || KEYS; },
        visibleKeys() { return KEYS.filter(k => this.visuals.includes(k)); },
        labels() { return this.s.labels || {}; },
        mosque() { return this.s.mosque || {}; },

        themeStyle() {
            return {
                '--accent': this.theme.accent || '#ff8a00',
                '--accentText': this.theme.accentText || '#ffffff',
                '--barBg': this.theme.barBg || 'rgba(12,16,22,0.62)',
                '--barBlur': (this.theme.barBlur ?? 10) + 'px',
                '--topFade': (this.theme.topFade ?? 92) / 100,
                '--textTop': this.theme.textTop || '#0b1220',
                '--tickerBg': this.s.runningText?.bg || '#0f8a3c',
                '--tickerColor': this.s.runningText?.color || '#ffffff',
                '--tickerDur': this.tickerDur + 's',
            };
        },

        clockParts() {
            const d = this.zoneNow;
            let h = d.getHours();
            const m = pad(d.getMinutes());
            const sec = pad(d.getSeconds());
            let ampm = '';
            if (Number(this.clock.format) === 12) { ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; }
            return { hh: pad(h), mm: m, ss: sec, ampm };
        },

        greet() { return greeting(this.zoneNow.getHours()); },

        hijriText() {
            const off = Number(this.s.calc?.hijriOffset || 0);
            return hijriLabel(toHijri(this.zoneNow, off), true);
        },
        gregText() { return tanggalId(this.zoneNow); },

        slides() { return state.media.filter(m => Number(m.active) !== 0); },

        tickerText() {
            const sep = this.s.runningText?.separator || '  •  ';
            const items = (state.runningText || [])
                .filter(t => Number(t.active) !== 0)
                .map(t => String(t.text || '').trim())
                .filter(Boolean);
            return items.join(sep);
        },

        activeKey() {
            const st = this.status;
            if (st.event) return st.event.key;
            if (st.nextEvent) return st.nextEvent.key;
            return null;
        },

        barItems() {
            const t = this.todayTimes;
            if (!t) return [];
            const active = this.activeKey;
            const nx = this.status.nextEvent;
            return this.visibleKeys.map(k => {
                const sec = hmToSec(t[k]);
                const isActive = k === active;
                return {
                    key: k,
                    label: this.labels[k] || k,
                    time: t[k] || '--:--',
                    active: isActive,
                    passed: sec !== null && sec < this.currentSec && !isActive && this.status.phase === 'normal',
                    isNext: !isActive && nx && nx.key === k && nx.dayOffset === 0,
                };
            });
        },

        /** Kartu hitung mundur terpisah di atas bilah jadwal (kanan layar) */
        countdownCard() {
            const st = this.status;
            const isPre = st.phase === 'adzan' || st.phase === 'iqomah';
            if (isPre && st.event) {
                const total = st.iqomahIn ?? st.secondsLeft ?? 0;
                return {
                    tag: st.phase === 'adzan' ? 'ADZAN' : 'IQOMAH',
                    title: st.event.label,
                    caption: 'Menuju Iqomah',
                    value: this.fmt(total),
                    alert: true,
                };
            }
            const nx = st.nextEvent;
            if (!nx) return null;
            return {
                tag: '',
                title: nx.label,
                caption: nx.dayOffset > 0 ? 'Besok' : 'Jadwal berikutnya',
                value: this.fmt(st.secondsToNext ?? 0),
                alert: false,
            };
        },

        /** Layar hitam penuh saat iqomah & sholat berjamaah */
        sholatScreen() {
            if (this.status.phase !== 'sholat') return null;
            if (this.s.display?.showSholatScreen === false) return null;
            const ev = this.status.event;
            if (!ev) return null;
            const tpl = this.s.display?.sholatText || 'Harap tenang sedang ibadah sholat {prayer}';
            return {
                text: String(tpl).replace(/\{prayer\}/gi, ev.label),
                prayer: ev.label,
                remain: this.s.display?.sholatCountdown ? this.fmt(this.status.secondsLeft ?? 0) : '',
            };
        },

        countdownText() {
            return this.countdownCard ? '-' + this.countdownCard.value : '';
        },

        dimStyle() { return { opacity: (this.s.slideshow?.dim ?? 35) / 100 }; },
        isOffline() { return state.fromCache || !state.online; },
    },

    methods: {
        fmt(sec) { return fmtDur(Math.max(0, Number(sec) || 0)); },

        async reloadSchedule() {
            const token = ++this.reloadToken;
            const tz = this.loc.timezone || 'Asia/Jakarta';
            const zn = nowInZone(tz);
            this.zoneNow = zn;
            const day = new Date(zn.getFullYear(), zn.getMonth(), zn.getDate());
            const dayKey = ymd(day);
            if (dayKey !== this.lastDayKey || !this.todayTimes) {
                this.lastDayKey = dayKey;
                const t = await getDayTimes(day, this.s);
                const tmr = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
                const t2 = await getDayTimes(tmr, this.s);
                if (token !== this.reloadToken) return;
                this.todayTimes = t;
                this.tomorrowTimes = t2;
                recomputeHijri(day);
                this.updateHoliday();
            }
            this.timeline = buildTimeline(this.todayTimes, this.tomorrowTimes, this.s, day);
            this.currentSec = zn.getHours() * 3600 + zn.getMinutes() * 60 + zn.getSeconds();
            this.status = computeStatus(this.currentSec, this.timeline);
        },

        tick() {
            const tz = this.loc.timezone || 'Asia/Jakarta';
            const zn = nowInZone(tz);
            this.zoneNow = zn;
            if (ymd(zn) !== this.lastDayKey) { this.reloadSchedule(); return; }
            this.currentSec = zn.getHours() * 3600 + zn.getMinutes() * 60 + zn.getSeconds();
            this.status = computeStatus(this.currentSec, this.timeline);
            if (this.demo) {
                const ev = this.timeline.find(e => e.key === this.demoPrayer && e.dayOffset === 0) || this.timeline[0];
                this.status = { phase: this.demo, event: ev, secondsLeft: 245, iqomahIn: 418, nextEvent: ev };
            }
            this.handleTriggers();
        },

        handleTriggers() {
            if (this.demo) return;
            const st = this.status;
            const ev = st.event;
            const key = ev ? `${ev.dateKey}:${ev.key}` : null;

            if (st.phase === 'adzan' && key && !this.fired[key + ':adzan']) {
                this.fired[key + ':adzan'] = true;
                this.playAdzan(ev);
            }
            if (st.phase === 'iqomah' && key && !this.fired[key + ':iqomah']) {
                this.fired[key + ':iqomah'] = true;
                if (this.adzanMode && this.s.adzan?.iqomahOn !== false && this.s.audio?.beepEnabled !== false) {
                    audio.beep(this.s.audio?.beepUrl);
                }
            }
            const nx = st.nextEvent;
            if (st.phase === 'normal' && nx && nx.prayer && this.s.adzan?.preAdzanOn !== false) {
                const mins = Number(this.s.adzan?.preAdzanMin ?? 5);
                const remain = nx.timeSec - this.currentSec;
                const mk = `${nx.dateKey}:${nx.key}:pre`;
                if (mins > 0 && remain <= mins * 60 && remain > mins * 60 - 3 && !this.fired[mk]) {
                    this.fired[mk] = true;
                    this.showPreAdzan(nx, mins);
                }
            }
            if (Object.keys(this.fired).length > 120) this.fired = {};
        },

        async playAdzan(ev) {
            if (!this.adzanMode || this.s.audio?.adzanEnabled === false) return;
            const delay = Number(this.s.audio?.adzanDelay || 0);
            if (delay > 0) await new Promise(r => setTimeout(r, delay * 1000));
            await audio.unlock();
            audio.setVolume(this.currentVolume);
            const ok = await audio.play(this.s.audio?.adzanUrl || 'assets/audio/adzan.wav', {
                maxDuration: Number(this.s.audio?.adzanDuration || 180) + 60,
            });
            if (!ok) audio.tone([[440, 0, 0.6], [554, 0.5, 0.6], [659, 1.0, 0.9]], 0.3);
        },

        showPreAdzan(ev, mins) {
            this.bannerText = `Menuju ${ev.label} — ${mins} menit lagi`;
            this.showBanner = true;
            if (this.adzanMode && this.s.audio?.beepEnabled !== false) audio.notify(this.s.audio?.notifyUrl);
            clearTimeout(this._bannerT);
            this._bannerT = setTimeout(() => { this.showBanner = false; }, Math.min(90000, mins * 60000));
        },

        toggleAdzanMode() {
            this.adzanMode = !this.adzanMode;
            localStorage.setItem(LS_ADZAN_MODE, this.adzanMode ? '1' : '0');
            if (!this.adzanMode) audio.stop();
            toast(this.adzanMode ? 'Mode Muadzin aktif' : 'Mode Senyap aktif', 'info', 2000);
        },

        startSlideshow() {
            this.stopSlideshow();
            const cfg = this.s.slideshow || {};
            if (cfg.enabled === false || this.slides.length === 0) return;
            const cur = this.slides[this.slideIndex];
            const dur = Number((cur && cur.duration) || cfg.interval || 15) * 1000;
            this.slideTimer = setTimeout(() => this.nextSlide(), Math.max(2500, dur));
        },
        stopSlideshow() { clearTimeout(this.slideTimer); this.slideTimer = null; },
        nextSlide() {
            const n = this.slides.length;
            if (n <= 1) return;
            if (this.s.slideshow?.shuffle) {
                let i = this.slideIndex;
                while (i === this.slideIndex && n > 1) i = Math.floor(Math.random() * n);
                this.slideIndex = i;
            } else {
                this.slideIndex = (this.slideIndex + 1) % n;
            }
            this.$nextTick(() => this.syncVideos());
            this.startSlideshow();
        },
        syncVideos() {
            const vids = document.querySelectorAll('.slide video');
            vids.forEach((v, i) => {
                if (i === this.slideIndex) { try { v.currentTime = 0; v.play().catch(() => {}); } catch { /* */ } }
                else { try { v.pause(); } catch { /* */ } }
            });
        },
        onVideoEnded() { this.nextSlide(); },

        toggleFullscreen() {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
            else document.exitFullscreen?.().catch(() => {});
        },
        goAdmin() { navigate('/admin'); },

        onActivity() {
            this.idle = false;
            clearTimeout(this.idleTimer);
            this.idleTimer = setTimeout(() => {
                if (this.s.display?.hideCursor) this.idle = true;
            }, 4000);
        },

        computeTickerDur() {
            const speed = Math.max(10, Number(this.s.runningText?.speed || 70));
            const width = window.innerWidth || 1920;
            const textWidth = this.tickerText.length * (window.innerWidth / 55) + width;
            this.tickerDur = Math.max(12, Math.round(textWidth / speed));
        },

        updateHoliday() {
            const list = state.holidays?.length ? state.holidays : [];
            const off = Number(this.s.calc?.hijriOffset || 0);
            const up = nextHolidays(list, this.zoneNow, 400, 1, off);
            this.holiday = up[0] || null;
        },

        holidayLabelText() {
            if (!this.holiday) return '';
            if (this.holiday.isToday) return `Hari ini: ${this.holiday.name}`;
            return `${this.holiday.name} -${this.holiday.daysLeft} Hari`;
        },
    },

    watch: {
        's.slideshow': { handler() { this.slideIndex = 0; this.startSlideshow(); this.$nextTick(() => this.syncVideos()); }, deep: true },
        's.runningText': { handler() { this.computeTickerDur(); }, deep: true },
        's.audio.volume'(v) { this.currentVolume = Number(v) || 0; audio.setVolume(this.currentVolume); },
        's.calc.hijriOffset'() { this.updateHoliday(); recomputeHijri(this.zoneNow); },
    },

    async mounted() {
        audio.setVolume(this.currentVolume);
        await this.reloadSchedule();
        this._interval = setInterval(() => this.tick(), 1000);
        this.startSlideshow();
        this.$nextTick(() => this.syncVideos());
        this.computeTickerDur();
        this._holInterval = setInterval(() => this.updateHoliday(), 60000);
        this._resInterval = setInterval(() => { this.reloadSchedule(); }, 30 * 60000);
        this.onActivity();
        this._onActivity = () => this.onActivity();
        window.addEventListener('mousemove', this._onActivity);
        window.addEventListener('pointerdown', this._onActivity);
        window.addEventListener('keydown', this._onActivity);
        window.addEventListener('resize', () => this.computeTickerDur());
        this._onVis = () => { if (!document.hidden) { this.reloadSchedule(); this.startSlideshow(); } };
        document.addEventListener('visibilitychange', this._onVis);
    },

    beforeUnmount() {
        clearInterval(this._interval);
        clearInterval(this._holInterval);
        clearInterval(this._resInterval);
        clearTimeout(this._bannerT);
        clearTimeout(this.idleTimer);
        this.stopSlideshow();
        window.removeEventListener('mousemove', this._onActivity);
        window.removeEventListener('pointerdown', this._onActivity);
        window.removeEventListener('keydown', this._onActivity);
        document.removeEventListener('visibilitychange', this._onVis);
    },

    template: `
<div class="tv" :class="{ 'hide-cursor': idle }" :style="themeStyle">

    <div class="stage">
        <div v-for="(m, i) in slides" :key="m.id || i"
             class="slide"
             :class="[{ 'is-active': i === slideIndex }, 'anim-' + (s.slideshow?.transition || 'fade')]">
            <img v-if="m.type !== 'video'" :src="m.src" :alt="m.title || ''" loading="lazy" />
            <video v-else :src="m.src" muted playsinline preload="metadata" @ended="onVideoEnded"></video>
        </div>
        <div class="dim" :style="dimStyle"></div>
        <div class="vignette"></div>
    </div>

    <div class="ui">
        <header class="topbar">
            <div class="row1">
                <div class="clock-wrap">
                    <div class="clock">
                        <span>{{ clockParts.hh }}</span><span>:</span><span>{{ clockParts.mm }}</span>
                        <span v-if="clock.showSeconds" class="sec">:{{ clockParts.ss }}</span>
                        <span v-if="clockParts.ampm" class="ampm">{{ clockParts.ampm }}</span>
                    </div>
                    <div class="islamic-greet">{{ greet }} di {{ mosque.name }}</div>
                </div>

                <div class="mosque">
                    <img v-if="mosque.logo" class="logo" :src="mosque.logo" alt="logo" />
                    <div class="mosque-name">
                        <svg v-if="!mosque.logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                            <path d="M4 21V11l8-6 8 6v10"/><path d="M4 21h16"/><path d="M12 5V3"/>
                            <path d="M9 21v-4a3 3 0 0 1 6 0v4"/>
                        </svg>
                        <span>{{ mosque.name }}</span>
                    </div>
                    <div class="mosque-addr">{{ mosque.address }}</div>
                </div>

                <div class="dates">
                    <div class="hijri" v-if="clock.showHijri !== false">{{ hijriText }}</div>
                    <div class="greg" v-if="clock.showGregorian !== false">{{ gregText }}</div>
                </div>
            </div>

            <div class="row2">
                <button class="pill pill-muadzin" :class="{ on: adzanMode }" @click="toggleAdzanMode"
                        :title="adzanMode ? 'Nonaktifkan suara adzan' : 'Aktifkan suara adzan'">
                    <span class="dot"></span>
                    <svg v-if="adzanMode" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="m17 9 4 6M21 9l-4 6"/>
                    </svg>
                    <span>{{ adzanMode ? 'Mode Muadzin' : 'Mode Senyap' }}</span>
                </button>

                <div v-if="holiday && s.hijri?.holidaysEnabled !== false"
                     class="pill pill-holiday" :class="{ 'is-today': holiday.isToday }"
                     :title="(holiday.description || '') + ' — ' + holiday.dateLabel + ' (' + holiday.hijriLabel + ')'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M12 3a9 9 0 1 0 9 9c0-1-.2-2-.5-2.9A7 7 0 0 1 12 3z"/>
                    </svg>
                    <span class="hname">{{ holiday.name }}</span>
                    <span class="hcount">{{ holiday.isToday ? 'HARI INI' : '-' + holiday.daysLeft + ' Hari' }}</span>
                </div>
            </div>
        </header>

        <div class="float-btns">
            <button v-if="s.display?.showSettingsButton !== false" class="icon-btn" @click="goAdmin" title="Pengaturan (S)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
                </svg>
            </button>
            <button class="icon-btn" @click="toggleFullscreen" title="Layar penuh (F)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M16 21h3a2 2 0 0 0 2-2v-3M8 21H5a2 2 0 0 1-2-2v-3"/>
                </svg>
            </button>
        </div>

        <footer class="bottombar">
            <div class="next-row" v-if="countdownCard">
                <div class="next-card" :class="{ alert: countdownCard.alert }">
                    <span class="nc-tag" v-if="countdownCard.tag">{{ countdownCard.tag }}</span>
                    <div class="nc-body">
                        <span class="nc-caption">{{ countdownCard.caption }}</span>
                        <span class="nc-title">{{ countdownCard.title }}</span>
                        <span class="nc-value">-{{ countdownCard.value }}</span>
                    </div>
                </div>
            </div>

            <div class="prayers">
                <template v-if="barItems.length">
                    <div v-for="it in barItems" :key="it.key"
                         class="prayer"
                         :class="{ 'is-active': it.active, 'is-passed': it.passed, 'is-next': it.isNext }">
                        <span class="p-label">{{ it.label }}</span>
                        <span class="p-time">{{ it.time }}</span>
                    </div>
                </template>
                <div v-else class="prayer">
                    <span class="p-label">Memuat jadwal…</span>
                    <span class="p-time">--:--</span>
                </div>
            </div>
            <div class="ticker" v-if="s.runningText?.enabled !== false && tickerText">
                <div class="track"><span>{{ tickerText }}</span></div>
            </div>
        </footer>
    </div>

    <transition name="fade">
        <div class="banner" v-if="showBanner">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>
            </svg>
            <span>{{ bannerText }}</span>
        </div>
    </transition>

    <!-- Layar hitam penuh saat iqomah & sholat berjamaah -->
    <div class="sholat-screen" v-if="sholatScreen">
        <div class="ss-inner">
            <div class="ss-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                    <path d="M4 21V11l8-6 8 6v10"/><path d="M4 21h16"/><path d="M12 5V3"/><path d="M9 21v-4a3 3 0 0 1 6 0v4"/>
                </svg>
            </div>
            <div class="ss-text">{{ sholatScreen.text }}</div>
            <div class="ss-remain" v-if="sholatScreen.remain">{{ sholatScreen.remain }}</div>
        </div>
    </div>

    <div v-if="isOffline" class="offline-badge">
        <span class="dot"></span><span>Mode Offline — jadwal dari cache</span>
    </div>
</div>
`,
};
