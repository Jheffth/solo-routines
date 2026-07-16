/* ============================================================
   dialog.js — Solo Routines
   Sistema premium de alertas, confirms e toasts arrastáveis
   Substitui alert() e confirm() nativos
   ============================================================ */

const SoloDialog = {
  _container: null,
  _toastContainer: null,
  _activeDialog: null,

  // ── Inicializar (chama uma vez no app init) ───────────────
  init() {
    if (document.getElementById('solo-dialog-root')) return;

    // Overlay de dialogs
    const root = document.createElement('div');
    root.id = 'solo-dialog-root';
    root.style.cssText = [
      'position:fixed','inset:0','z-index:99990',
      'display:none','align-items:center','justify-content:center',
      'backdrop-filter:blur(4px)','-webkit-backdrop-filter:blur(4px)',
      'background:rgba(0,0,0,.55)','transition:opacity .2s',
    ].join(';');
    document.body.appendChild(root);

    // Toast container (canto inferior direito)
    const tc = document.createElement('div');
    tc.id = 'solo-toast-root';
    tc.style.cssText = [
      'position:fixed','bottom:1.5rem','right:1.5rem',
      'z-index:99999','display:flex','flex-direction:column',
      'gap:.5rem','pointer-events:none','max-width:360px',
    ].join(';');
    document.body.appendChild(tc);

    this._container = root;
    this._toastContainer = tc;
  },

  // ── Alert (substitui alert()) ─────────────────────────────
  alert(msg, opts = {}) {
    return new Promise(resolve => {
      this._abrir({
        icon:        opts.icon  || '⚠️',
        titulo:      opts.titulo || 'Aviso',
        msg,
        tipo:        opts.tipo  || 'warn',  // 'warn'|'error'|'success'|'info'
        botoes: [
          { label: opts.btnOk || 'Entendido', classe: 'btn-ok', resolve: true },
        ],
        onClose: resolve,
      });
    });
  },

  // ── Confirm (substitui confirm()) ────────────────────────
  confirm(msg, opts = {}) {
    return new Promise(resolve => {
      this._abrir({
        icon:        opts.icon   || '⚡',
        titulo:      opts.titulo || 'Confirmar',
        msg,
        tipo:        opts.tipo   || 'warn',
        botoes: [
          { label: opts.btnCancel || 'Cancelar',  classe: 'btn-cancel', resolve: false },
          { label: opts.btnOk     || 'Confirmar', classe: 'btn-ok',     resolve: true  },
        ],
        onClose: resolve,
      });
    });
  },

  // ── Toast (notificação passageira) ───────────────────────
  toast(msg, tipo = 'success', duracao = 3500) {
    if (!this._toastContainer) this.init();
    const cores = {
      success: { border: '#10b981', icon: '✅', glow: 'rgba(16,185,129,.2)'  },
      error:   { border: '#ef4444', icon: '❌', glow: 'rgba(239,68,68,.2)'   },
      warn:    { border: '#f59e0b', icon: '⚠️', glow: 'rgba(245,158,11,.2)'  },
      info:    { border: '#3b82f6', icon: 'ℹ️', glow: 'rgba(59,130,246,.2)'  },
    };
    const c = cores[tipo] || cores.info;

    const el = document.createElement('div');
    el.style.cssText = [
      'pointer-events:auto',
      'display:flex','align-items:center','gap:.65rem',
      'padding:.75rem 1rem',
      'background:rgba(13,13,26,.92)',
      'backdrop-filter:blur(20px)','-webkit-backdrop-filter:blur(20px)',
      `border:1px solid ${c.border}55`,
      `border-left:3px solid ${c.border}`,
      'border-radius:.8rem',
      `box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 20px ${c.glow}`,
      'transform:translateX(120%)',
      'transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .35s',
      'cursor:pointer','user-select:none',
      'max-width:360px',
    ].join(';');

    el.innerHTML = `
      <span style="font-size:1.1rem;flex-shrink:0">${c.icon}</span>
      <span style="
        font-family:var(--font-section,Rajdhani,sans-serif);
        font-size:.82rem;color:#e2e8f0;line-height:1.4;flex:1
      ">${msg}</span>
      <span style="font-size:.9rem;color:#64748b;cursor:pointer;flex-shrink:0" title="Fechar">×</span>
    `;

    const fechar = () => {
      el.style.transform = 'translateX(120%)';
      el.style.opacity   = '0';
      setTimeout(() => el.remove(), 380);
    };
    el.addEventListener('click', fechar);
    this._toastContainer.appendChild(el);
    // Animar entrada
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transform = 'translateX(0)';
    }));
    // Auto fechar
    setTimeout(fechar, duracao);
  },

  // ── Abre um dialog modal ──────────────────────────────────
  _abrir({ icon, titulo, msg, tipo, botoes, onClose }) {
    if (!this._container) this.init();

    const CORES = {
      warn:    { header: 'rgba(245,158,11,.12)',  border: 'rgba(245,158,11,.35)',  accent: '#f59e0b' },
      error:   { header: 'rgba(239,68,68,.12)',   border: 'rgba(239,68,68,.35)',   accent: '#ef4444' },
      success: { header: 'rgba(16,185,129,.1)',   border: 'rgba(16,185,129,.3)',   accent: '#10b981' },
      info:    { header: 'rgba(59,130,246,.1)',   border: 'rgba(59,130,246,.3)',   accent: '#3b82f6' },
      danger:  { header: 'rgba(239,68,68,.14)',   border: 'rgba(239,68,68,.45)',   accent: '#f87171' },
    };
    const c = CORES[tipo] || CORES.warn;

    // Remove dialog anterior se existir
    document.getElementById('solo-dialog-box')?.remove();

    const box = document.createElement('div');
    box.id = 'solo-dialog-box';
    box.style.cssText = [
      'position:relative',
      'width:min(460px,92vw)',
      'background:rgba(10,10,20,.92)',
      'backdrop-filter:blur(28px)','-webkit-backdrop-filter:blur(28px)',
      `border:1px solid ${c.border}`,
      'border-radius:1rem',
      `box-shadow:0 20px 80px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.04),0 0 40px ${c.accent}22`,
      'overflow:hidden',
      'animation:dialogEntrada .25s cubic-bezier(.34,1.56,.64,1)',
    ].join(';');

    box.innerHTML = `
      <style>
        @keyframes dialogEntrada {
          from { opacity:0; transform:scale(.85) translateY(16px); }
          to   { opacity:1; transform:scale(1)  translateY(0); }
        }
      </style>

      <!-- Linha colorida topo -->
      <div style="height:3px;background:linear-gradient(90deg,${c.accent},transparent)"></div>

      <!-- Header arrastável -->
      <div id="solo-dialog-header" style="
        display:flex;align-items:center;gap:.65rem;
        padding:.85rem 1.1rem;cursor:move;
        background:${c.header};
        border-bottom:1px solid ${c.border}
      ">
        <span style="font-size:1.3rem">${icon}</span>
        <span style="
          font-family:var(--font-section,Rajdhani,sans-serif);
          font-size:.95rem;font-weight:700;letter-spacing:.06em;
          color:#e2e8f0;flex:1
        ">${titulo}</span>
        <button id="solo-dialog-x" style="
          background:none;border:none;color:#64748b;
          font-size:1.2rem;cursor:pointer;line-height:1;
          width:26px;height:26px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          transition:.2s
        " onmouseover="this.style.background='rgba(239,68,68,.2)';this.style.color='#f87171'"
           onmouseout="this.style.background='none';this.style.color='#64748b'">×</button>
      </div>

      <!-- Corpo da mensagem -->
      <div style="padding:1.1rem 1.2rem .8rem">
        <div style="
          font-family:var(--font-body,Inter,sans-serif);
          font-size:.88rem;color:#cbd5e1;line-height:1.6
        ">${msg.replace(/\n/g, '<br>')}</div>
      </div>

      <!-- Rodapé com botões -->
      <div style="
        display:flex;justify-content:flex-end;gap:.6rem;
        padding:.75rem 1.2rem 1rem;
        border-top:1px solid rgba(100,116,139,.1)
      " id="solo-dialog-btns"></div>
    `;

    // Monta botões
    const btnsEl = box.querySelector('#solo-dialog-btns');
    const fechar = (val) => {
      box.style.animation = 'none';
      box.style.opacity   = '0';
      box.style.transform = 'scale(.9)';
      box.style.transition = 'all .18s';
      setTimeout(() => {
        this._container.style.display = 'none';
        box.remove();
      }, 180);
      onClose(val);
    };

    box.querySelector('#solo-dialog-x').addEventListener('click', () => fechar(false));

    botoes.forEach(b => {
      const btn = document.createElement('button');
      const isOk = b.classe === 'btn-ok';
      btn.textContent = b.label;
      btn.style.cssText = [
        'font-family:var(--font-section,Rajdhani,sans-serif)',
        'font-size:.82rem','font-weight:700','letter-spacing:.08em',
        'padding:.45rem 1.2rem','border-radius:.5rem','cursor:pointer',
        'transition:all .2s','border:1px solid',
        isOk
          ? `background:${c.accent}22;border-color:${c.accent}77;color:${c.accent}`
          : 'background:rgba(100,116,139,.08);border-color:rgba(100,116,139,.25);color:#64748b',
      ].join(';');
      btn.onmouseover = () => {
        btn.style.background = isOk ? `${c.accent}33` : 'rgba(100,116,139,.15)';
        if (isOk) btn.style.boxShadow = `0 0 12px ${c.accent}44`;
      };
      btn.onmouseout = () => {
        btn.style.background = isOk ? `${c.accent}22` : 'rgba(100,116,139,.08)';
        btn.style.boxShadow  = 'none';
      };
      btn.addEventListener('click', () => fechar(b.resolve));
      btnsEl.appendChild(btn);
    });

    this._container.appendChild(box);
    this._container.style.display = 'flex';
    this._container.style.opacity = '1';

    // Fechar ao clicar fora
    this._container.addEventListener('click', (e) => {
      if (e.target === this._container) fechar(false);
    }, { once: true });

    // Drag
    this._makeDraggable(box, box.querySelector('#solo-dialog-header'));
  },

  // ── Drag simples ──────────────────────────────────────────
  _makeDraggable(box, handle) {
    let dx = 0, dy = 0, ox = 0, oy = 0;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      // Converte para posição absoluta ao iniciar drag
      const r = box.getBoundingClientRect();
      box.style.position  = 'fixed';
      box.style.left      = r.left + 'px';
      box.style.top       = r.top  + 'px';
      box.style.margin    = '0';
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;

      const move = (ev) => {
        box.style.left = (ev.clientX - ox) + 'px';
        box.style.top  = (ev.clientY - oy) + 'px';
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup',   up);
    });
  },
};

// ── Sobreescreve globais para compatibilidade ─────────────
window._nativeAlert   = window.alert;
window._nativeConfirm = window.confirm;

// alert() → toast de erro/warn automático
window.alert = (msg) => {
  if (!SoloDialog._container) SoloDialog.init();
  // Detecta tipo pela mensagem
  const tipo = /erro|error|falha|fail/i.test(msg) ? 'error' : 'warn';
  return SoloDialog.alert(msg, { tipo });
};

// confirm() → dialog síncrono emulado (retorna Promise)
// Como confirm() nativo é síncrono e o nosso é assíncrono,
// os callers que usam `if (!confirm(...))` precisam ser adaptados.
// Mantemos o nativo como fallback de emergência.
window.soloConfirm = (msg, opts) => SoloDialog.confirm(msg, opts);
