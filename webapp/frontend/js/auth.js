/* ============================================================
   SOLO ROUTINES — AUTH MANAGER
   ============================================================ */

// Helpers de token
function _srSetToken(t) {
  if (t) localStorage.setItem('sr_token', t);
  else   localStorage.removeItem('sr_token');
}
function _srGetToken() { return localStorage.getItem('sr_token'); }

const Auth = {
  _usuario: null,

  async login(loginStr, senha) {
    try {
      const data = await API.auth.login(loginStr, senha);
      if (data.usuario || data.user) {
        Auth._usuario = data.usuario || data.user;
        localStorage.setItem('sr_usuario', JSON.stringify(Auth._usuario));
      }
      return { sucesso: true, data };
    } catch (err) {
      return { sucesso: false, erro: err.message };
    }
  },

  async registro(nome, login, email, senha) {
    try {
      const data = await API.auth.registro(nome, login, email, senha);
      return { sucesso: true, data };
    } catch (err) {
      return { sucesso: false, erro: err.message };
    }
  },

  setToken(t) { _srSetToken(t); },
  getToken()  { return _srGetToken(); },

  logout() {
    _srSetToken(null);
    Auth._usuario = null;
    localStorage.removeItem('sr_usuario');
    API.setToken(null);
    // Delega ao App para evitar acoplamento direto ao DOM
    if (window.App?.mostrarLogin) {
      window.App.mostrarLogin();
    } else {
      Auth._redirecionarLogin();
    }
  },

  getUsuario() {
    if (Auth._usuario) return Auth._usuario;
    const stored = localStorage.getItem('sr_usuario');
    if (stored) {
      try {
        Auth._usuario = JSON.parse(stored);
        return Auth._usuario;
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  setUsuario(usuario) {
    Auth._usuario = usuario;
    localStorage.setItem('sr_usuario', JSON.stringify(usuario));
  },

  async refreshUsuario() {
    try {
      const data = await API.auth.me();
      const usuario = data.usuario || data.user || data;
      Auth.setUsuario(usuario);
      return usuario;
    } catch (e) {
      return Auth.getUsuario();
    }
  },

  isAdmin() {
    const u = Auth.getUsuario();
    if (!u) return false;
    return u.nivel_acesso === 'Arquiteto' ||
           u.nivel_acesso === 'Admin' ||
           u.nivel_acesso === 'Criador' ||
           u.nivel_acesso === 'admin' ||
           u.nivel_acesso === 'ADMIN' ||
           u.role === 'admin' ||
           u.is_admin === true;
  },

  isAutenticado() {
    return !!localStorage.getItem('sr_token');
  },

  async verificarSessao() {
    if (!Auth.isAutenticado()) {
      Auth._redirecionarLogin();
      return false;
    }
    try {
      const usuario = await Auth.refreshUsuario();
      if (!usuario) {
        Auth._redirecionarLogin();
        return false;
      }
      return true;
    } catch (err) {
      Auth._redirecionarLogin();
      return false;
    }
  },

  _redirecionarLogin() {
    Auth._usuario = null;
    localStorage.removeItem('sr_usuario');
    localStorage.removeItem('sr_token');
    document.getElementById('main-app').classList.remove('visible');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('registro-screen').style.display = 'none';
  },

  getIniciais() {
    const u = Auth.getUsuario();
    if (!u || !u.nome) return '?';
    const parts = u.nome.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  },

  atualizarSidebarUI() {
    const u = Auth.getUsuario();
    if (!u) return;

    const avatarEl = document.getElementById('sidebar-user-avatar');
    const nameEl   = document.getElementById('sidebar-user-name');
    const rankEl   = document.getElementById('sidebar-user-rank');

    if (avatarEl) {
      if (u.avatar_url) {
        avatarEl.innerHTML = '<img src="' + u.avatar_url + '" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      } else {
        avatarEl.textContent = Auth.getIniciais();
      }
    }
    if (nameEl) nameEl.textContent = u.nome || u.login || 'Hunter';
    if (rankEl) rankEl.textContent = 'Rank ' + (u.rank || 'E') + ' - Nv.' + (u.nivel || 1);

    const adminNav = document.getElementById('nav-gerencial');
    if (adminNav) {
      adminNav.style.display = Auth.isAdmin() ? 'flex' : 'none';
    }
  },
};

window.addEventListener('sr:session-expired', function() {
  if (window.ToastManager) {
    ToastManager.mostrar('Sessao expirada', 'Faca login novamente', 'warning');
  }
  setTimeout(function() { Auth._redirecionarLogin(); }, 1500);
});

window.Auth = Auth;


// ── Metodos de bind de formulario ──
Auth.bindLogin = function() {
  const form = document.getElementById('form-login');
  if (!form) return;

  // Remove listener anterior clonando
  const novoForm = form.cloneNode(true);
  form.parentNode.replaceChild(novoForm, form);

  novoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroEl = document.getElementById('login-erro');
    const btn    = document.getElementById('btn-entrar');

    const login = document.getElementById('login-usuario')?.value?.trim();
    const senha = document.getElementById('login-senha')?.value;

    if (!login || !senha) {
      if (erroEl) { erroEl.textContent = 'Preencha login e senha'; erroEl.classList.remove('hidden'); }
      return;
    }

    if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Entrando...'; }
    if (erroEl) erroEl.classList.add('hidden');

    const resultado = await Auth.login(login, senha);

    if (resultado.sucesso) {
      const usuario = resultado.data.usuario || resultado.data.user || resultado.data;
      if (window.App?.mostrarApp) {
        App.mostrarApp(usuario);
        try { await Dashboard.carregar(); } catch(e) { console.warn('[Login] Dashboard.carregar:', e); }
      }
    } else {
      if (erroEl) {
        erroEl.textContent = resultado.erro || 'Login ou senha incorretos';
        erroEl.classList.remove('hidden');
      }
      if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'Entrar no Sistema'; }
    }
  });
};

Auth.bindRegistro = function() {
  const form = document.getElementById('form-registro');
  if (!form) return;

  const novoForm = form.cloneNode(true);
  form.parentNode.replaceChild(novoForm, form);

  novoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroEl = document.getElementById('registro-erro');
    const btn    = document.getElementById('btn-criar-hunter');

    const nome      = document.getElementById('reg-nome')?.value?.trim();
    const login     = document.getElementById('reg-login')?.value?.trim();
    const senha     = document.getElementById('reg-senha')?.value;
    const confirmar = document.getElementById('reg-confirmar')?.value;

    if (!nome || !login || !senha) {
      if (erroEl) { erroEl.textContent = 'Preencha todos os campos'; erroEl.classList.remove('hidden'); }
      return;
    }
    if (senha !== confirmar) {
      if (erroEl) { erroEl.textContent = 'As senhas nao conferem'; erroEl.classList.remove('hidden'); }
      return;
    }
    if (senha.length < 6) {
      if (erroEl) { erroEl.textContent = 'Senha deve ter pelo menos 6 caracteres'; erroEl.classList.remove('hidden'); }
      return;
    }

    if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Criando...'; }
    if (erroEl) erroEl.classList.add('hidden');

    const resultado = await Auth.registro(nome, login, '', senha);

    if (resultado.sucesso) {
      // Auto-login apos registro
      const loginRes = await Auth.login(login, senha);
      if (loginRes.sucesso) {
        const usuario = loginRes.data.usuario || loginRes.data.user || loginRes.data;
        if (window.App?.mostrarApp) {
          App.mostrarApp(usuario);
          await Dashboard.carregar();
        }
      } else {
        // Redireciona para login
        if (window.App?._mostrarLogin) App._mostrarLogin();
      }
    } else {
      if (erroEl) {
        erroEl.textContent = resultado.erro || 'Erro ao criar conta';
        erroEl.classList.remove('hidden');
      }
      if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'Criar Hunter'; }
    }
  });
};

/* ============================================================
   Botão Olho — Revelar / Ocultar Senha
   Usa event delegation no documento para sobreviver a cloneNode()
   ============================================================ */

// Ícone: olho normal (senha oculta) — roxo suave
const _SVG_OLHO_OCULTO = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
     viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
     style="display:block">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>
</svg>`;

// Ícone: olho riscado + traço vermelho (senha visível)
const _SVG_OLHO_VISIVEL = `
<span style="position:relative;display:inline-flex;align-items:center;justify-content:center">
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
       style="display:block">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
             a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8
             a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23" stroke="#ef4444" stroke-width="2.5"/>
  </svg>
</span>`;

// Mapa: btnId → inputId
const _PARES_OLHO = {
  'olho-login':    'login-senha',
  'olho-reg-senha':'reg-senha',
  'olho-reg-conf': 'reg-confirmar',
};

// Aplica estado visual ao botão
function _atualizarOlho(btn, inputEl) {
  const visivel = inputEl.type === 'text';
  btn.innerHTML  = visivel ? _SVG_OLHO_VISIVEL : _SVG_OLHO_OCULTO;
  btn.style.color = visivel ? '#ef4444' : '#64748b';
  btn.title      = visivel ? 'Ocultar senha' : 'Revelar senha';
  btn.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Revelar senha');
  btn.setAttribute('data-visivel', visivel ? '1' : '0');
}

// Event delegation — funciona mesmo após cloneNode()
document.addEventListener('click', function(e) {
  // Sobe até encontrar um btn-olho
  const btn = e.target.closest('.btn-olho');
  if (!btn) return;

  const inputId = _PARES_OLHO[btn.id];
  if (!inputId) return;

  const input = document.getElementById(inputId);
  if (!input) return;

  e.preventDefault();
  e.stopPropagation();

  // Alterna tipo
  input.type = (input.type === 'password') ? 'text' : 'password';
  _atualizarOlho(btn, input);
  input.focus();
}, true); // capture=true garante execução antes de qualquer outro handler

// Inicializa estado visual dos botões no load
document.addEventListener('DOMContentLoaded', function() {
  Object.keys(_PARES_OLHO).forEach(function(btnId) {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(_PARES_OLHO[btnId]);
    if (btn && input) _atualizarOlho(btn, input);
  });
});