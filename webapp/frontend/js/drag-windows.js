// ============================================================
// SOLO ROUTINES — Drag Windows System
// Janelas flutuantes arrastáveis com suporte a mouse e touch
// ============================================================

class DragWindow {
  constructor(windowEl, options = {}) {
    this.el = typeof windowEl === 'string' ? document.querySelector(windowEl) : windowEl;
    if (!this.el) throw new Error('DragWindow: elemento não encontrado');
    this.opts = { backdropId: null, onClose: null, centerOnOpen: true, ...options };
    this._isDragging = false;
    this._startX = 0; this._startY = 0;
    this._elX = 0;    this._elY = 0;
    this._bindDrag();
  }

  _bindDrag() {
    const header = this.el.querySelector('.window-header');
    if (!header) return;

    // Remove listeners antigos (caso seja re-bind)
    header.removeEventListener('mousedown', this._onHeaderMouseDown);
    header.removeEventListener('touchstart', this._onHeaderTouchStart);

    this._onHeaderMouseDown = (e) => {
      if (e.target.closest('.window-close-btn')) return;
      this._startDrag(e.clientX, e.clientY);
      document.addEventListener('mousemove', this._onMouseMove);
      document.addEventListener('mouseup', this._onMouseUp);
    };
    this._onHeaderTouchStart = (e) => {
      if (e.target.closest('.window-close-btn')) return;
      const t = e.touches[0];
      this._startDrag(t.clientX, t.clientY);
      document.addEventListener('touchmove', this._onTouchMove, { passive: false });
      document.addEventListener('touchend', this._onTouchEnd);
    };

    // Mouse
    header.addEventListener('mousedown', this._onHeaderMouseDown);
    // Touch
    header.addEventListener('touchstart', this._onHeaderTouchStart, { passive: true });

    // Botão fechar
    const closeBtn = this.el.querySelector('.window-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
  }

  // Re-associa drag ao novo header (após innerHTML replacement)
  rebind() {
    this._bindDrag();
  }

  _startDrag(x, y) {
    this._isDragging = true;
    this._startX = x;
    this._startY = y;
    const rect = this.el.getBoundingClientRect();
    this._elX = rect.left;
    this._elY = rect.top;
    this.el.style.transition = 'none';
    this.el.style.transform = 'none';
    this.el.style.left = this._elX + 'px';
    this.el.style.top  = this._elY + 'px';
    this.el.classList.add('dragging');
  }

  _onMouseMove = (e) => {
    if (!this._isDragging) return;
    this._move(e.clientX, e.clientY);
  };
  _onTouchMove = (e) => {
    if (!this._isDragging) return;
    e.preventDefault();
    const t = e.touches[0];
    this._move(t.clientX, t.clientY);
  };
  _onMouseUp  = () => this._endDrag();
  _onTouchEnd = () => this._endDrag();

  _move(x, y) {
    const dx = x - this._startX;
    const dy = y - this._startY;
    let newLeft = this._elX + dx;
    let newTop  = this._elY + dy;
    // Limitar à tela
    const rect = this.el.getBoundingClientRect();
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth  - rect.width));
    newTop  = Math.max(0, Math.min(newTop,  window.innerHeight - 60));
    this.el.style.left = newLeft + 'px';
    this.el.style.top  = newTop  + 'px';
  }

  _endDrag() {
    this._isDragging = false;
    this.el.classList.remove('dragging');
    this.el.style.transition = '';
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend',  this._onTouchEnd);
  }

  center() {
    const w = this.el.offsetWidth  || 480;
    const h = this.el.offsetHeight || 500;
    this.el.style.left = Math.max(0, (window.innerWidth  - w) / 2) + 'px';
    this.el.style.top  = Math.max(0, (window.innerHeight - h) / 2) + 'px';
    this.el.style.transform = 'none';
  }

  open() {
    this.el.classList.remove('closing');
    this.el.classList.add('visible');
    this.el.style.display = 'flex';
    if (this.opts.centerOnOpen) {
      requestAnimationFrame(() => this.center());
    }
    if (this.opts.backdropId) {
      const bd = document.getElementById(this.opts.backdropId);
      if (bd) bd.classList.add('visible');
    }
    this.el.dispatchEvent(new CustomEvent('window:open'));
  }

  close() {
    this.el.classList.add('closing');
    setTimeout(() => {
      this.el.classList.remove('visible', 'closing');
      this.el.style.display = 'none'; // FIX: era '' (vazio) que removia o display:none do fechar()
    }, 200);
    if (this.opts.backdropId) {
      const bd = document.getElementById(this.opts.backdropId);
      if (bd) bd.classList.remove('visible');
    }
    this.opts.onClose?.();
    this.el.dispatchEvent(new CustomEvent('window:close'));
  }

  isOpen() {
    return this.el.classList.contains('visible');
  }

  toggle() {
    this.isOpen() ? this.close() : this.open();
  }
}

// Helper global
function makeDraggable(selector, options = {}) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (el) return new DragWindow(el, options);
  return null;
}

window.DragWindow = DragWindow;
window.makeDraggable = makeDraggable;
