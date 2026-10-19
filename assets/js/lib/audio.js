/* Manajer audio: adzan, beep, notifikasi + kunci autoplay */

class AudioManager {
    constructor() {
        this.volume = 0.85;
        this.unlocked = false;
        this.ctx = null;
        this.el = new Audio();
        this.el.preload = 'auto';
        this.el.crossOrigin = 'anonymous';
        this._stopTimer = null;
        this.onstate = null;
    }

    _ensureCtx() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) this.ctx = new AC();
        }
        return this.ctx;
    }

    /** Panggil pada interaksi pengguna pertama. */
    async unlock() {
        try {
            const ctx = this._ensureCtx();
            if (ctx && ctx.state === 'suspended') await ctx.resume();
            // "pancing" elemen audio agar diizinkan
            this.el.volume = 0;
            try { await this.el.play(); } catch { /* diabaikan */ }
            this.el.pause();
            this.el.currentTime = 0;
            this.el.volume = this.volume;
            this.unlocked = true;
        } catch { /* diabaikan */ }
        return this.unlocked;
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, Number(v) || 0));
        this.el.volume = this.volume;
    }

    /** Mainkan berkas audio (adzan dan sejenisnya). */
    async play(url, { maxDuration = 0, loop = false } = {}) {
        if (!url) return false;
        try {
            clearTimeout(this._stopTimer);
            this.el.pause();
            this.el.src = url;
            this.el.loop = loop;
            this.el.currentTime = 0;
            this.el.volume = this.volume;
            await this.el.play();
            if (maxDuration > 0) {
                this._stopTimer = setTimeout(() => this.stop(), maxDuration * 1000);
            }
            return true;
        } catch (e) {
            console.warn('Audio gagal diputar:', e?.message || e);
            return false;
        }
    }

    stop() {
        clearTimeout(this._stopTimer);
        try { this.el.pause(); this.el.currentTime = 0; } catch { /* diabaikan */ }
    }

    isPlaying() { return !this.el.paused && !this.el.ended && this.el.currentTime > 0; }

    /** Nada sintetis (cadangan bila berkas tidak tersedia). */
    tone(seq = [[880, 0, 0.3]], gain = 0.25) {
        try {
            const ctx = this._ensureCtx();
            if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();
            const t0 = ctx.currentTime;
            for (const [freq, start, dur] of seq) {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                const s = t0 + start;
                g.gain.setValueAtTime(0, s);
                g.gain.linearRampToValueAtTime(gain * this.volume, s + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
                osc.connect(g); g.connect(ctx.destination);
                osc.start(s); osc.stop(s + dur + 0.05);
            }
        } catch { /* diabaikan */ }
    }

    async beep(url) {
        const ok = await this.play(url || '', { maxDuration: 3 });
        if (!ok) this.tone([[880, 0, 0.25], [1320, 0.28, 0.45]], 0.28);
    }

    async notify(url) {
        const ok = await this.play(url || '', { maxDuration: 4 });
        if (!ok) this.tone([[660, 0, 0.25], [880, 0.22, 0.25], [1174, 0.44, 0.5]], 0.26);
    }

    /** Uji coba dengan berkas / notifikasi */
    async test(url) {
        await this.unlock();
        if (url) return this.play(url, { maxDuration: 10 });
        await this.notify('');
        return true;
    }
}

export const audio = new AudioManager();
