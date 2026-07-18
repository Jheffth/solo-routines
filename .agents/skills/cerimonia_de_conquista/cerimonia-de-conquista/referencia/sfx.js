/* ============================================================
   sfx.js — Motor de Som do Sistema
   Procura arquivos em /sounds/<nome>.(mp3|ogg|wav).
   Se não existirem, sintetiza um som reserva via Web Audio —
   troque os arquivos na pasta sounds/ quando quiser, sem código.
   ============================================================ */

const SFX = {
  _ctx: null,
  _cache: {},          // nome -> HTMLAudioElement | 'synth'
  volume: 0.55,

  get enabled() { return localStorage.getItem('sr_sfx') !== 'off'; },
  set enabled(v) { localStorage.setItem('sr_sfx', v ? 'on' : 'off'); },

  _audioCtx() {
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (_) { return null; }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  },

  /* Toca um som pelo nome. Arquivo em /sounds/ tem prioridade. */
  play(nome) {
    if (!this.enabled) return;
    const cacheado = this._cache[nome];
    if (cacheado === 'synth') { this._synth(nome); return; }
    if (cacheado instanceof Audio) {
      const a = cacheado.cloneNode();
      a.volume = this.volume;
      a.play().catch(() => {});
      return;
    }
    // Primeira vez: tenta o arquivo
    this._descobrir(nome).then(audio => {
      this._cache[nome] = audio || 'synth';
      this.play(nome);
    });
  },

  _descobrir(nome) {
    const tentar = ext => new Promise(res => {
      const a = new Audio(`/sounds/${nome}.${ext}`);
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => res(a), { once: true });
      a.addEventListener('error', () => res(null), { once: true });
      setTimeout(() => res(null), 2500);
    });
    return tentar('mp3').then(a => a || tentar('ogg')).then(a => a || tentar('wav'));
  },

  /* ── Sons sintetizados de reserva ──────────────────────── */
  _synth(nome) {
    const ctx = this._audioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = this.volume * 0.6;
    master.connect(ctx.destination);

    const nota = (freq, ini, dur, tipo = 'sine', vol = 1) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = tipo; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0 + ini);
      g.gain.linearRampToValueAtTime(vol, t0 + ini + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + ini + dur);
      o.connect(g); g.connect(master);
      o.start(t0 + ini); o.stop(t0 + ini + dur + 0.05);
    };
    const ruido = (ini, dur, freqCorte, vol = 1) => {
      const n = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      n.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freqCorte;
      const g = ctx.createGain(); g.gain.value = vol;
      n.connect(f); f.connect(g); g.connect(master);
      n.start(t0 + ini);
    };

    switch (nome) {
      case 'conquista': {
        // Fanfarra arcana ascendente: E5 → G#5 → B5 → E6 + brilho
        const notas = [659.25, 830.6, 987.77, 1318.5];
        notas.forEach((f, i) => {
          nota(f, i * 0.12, 0.9, 'sine', 0.8);
          nota(f * 2, i * 0.12, 0.45, 'sine', 0.18);   // harmônico
        });
        nota(1975, 0.5, 1.2, 'triangle', 0.12);          // shimmer final
        nota(1975 * 1.007, 0.5, 1.2, 'triangle', 0.1);   // detune (brilho)
        break;
      }
      case 'carimbo': {
        // Impacto de selo: thump grave + sopro
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t0);
        o.frequency.exponentialRampToValueAtTime(48, t0 + 0.18);
        g.gain.setValueAtTime(0.9, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + 0.25);
        ruido(0, 0.14, 900, 0.35);
        break;
      }
      case 'levelup': {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => nota(f, i * 0.09, 0.7, 'sine', 0.7));
        ruido(0.4, 0.5, 4000, 0.08);
        break;
      }
      default:
        nota(880, 0, 0.25, 'sine', 0.5);
    }
  },
};

window.SFX = SFX;
