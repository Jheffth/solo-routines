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

  async registro(nome, login, email, senha, codigo) {
    try {
      const data = await API.auth.registro(nome, login, senha, codigo, email);
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
    // Qualquer nível acima de Hunter tem acesso ao painel gerencial
    return ['Suporte', 'Moderador', 'Admin', 'Criador', 'Arquiteto',
            'admin', 'ADMIN', 'criador', 'moderador', 'suporte'].includes(u.nivel_acesso) ||
           u.role === 'admin' || u.is_admin === true;
  },

  isCriador() {
    const u = Auth.getUsuario();
    return !!u && ['Criador', 'Arquiteto'].includes(u.nivel_acesso);
  },

  isModerador() {
    const u = Auth.getUsuario();
    return !!u && ['Moderador', 'Admin', 'Criador', 'Arquiteto'].includes(u.nivel_acesso);
  },

  isSuporte() {
    const u = Auth.getUsuario();
    return !!u && ['Suporte', 'Moderador', 'Admin', 'Criador', 'Arquiteto'].includes(u.nivel_acesso);
  },

  isGestor() {
    const u = Auth.getUsuario();
    return !!u && ['Admin', 'Criador', 'Arquiteto'].includes(u.nivel_acesso);
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

/* Trava/destrava as opções de cadastro. O convite é o portão: sem ele
   válido, nem o formulário nem os botões sociais respondem. */
Auth._travarRegistro   = function() { document.getElementById('reg-opcoes')?.classList.add('reg-travado'); };
Auth._destravarRegistro = function() { document.getElementById('reg-opcoes')?.classList.remove('reg-travado'); };

/* Volta para a escolha dos 3 botões (esconde o formulário). */
Auth._mostrarMetodos = function() {
  document.getElementById('form-registro')?.classList.add('hidden');
  document.getElementById('reg-metodos')?.classList.remove('hidden');
};
/* Revela o formulário clássico (esconde os botões). */
Auth._mostrarFormEmail = function() {
  if (document.getElementById('reg-opcoes')?.classList.contains('reg-travado')) return;
  document.getElementById('reg-metodos')?.classList.add('hidden');
  document.getElementById('form-registro')?.classList.remove('hidden');
};

/* Liga o portão (validação do convite → destrava) e a troca de método.
   Vive FORA do <form>, então o clone do form não o afeta — protegemos com
   flags/delegação para não empilhar listeners a cada entrada. */
Auth._ligarPortaoRegistro = function() {
  const opcoes = document.getElementById('reg-opcoes');
  const campo  = document.getElementById('reg-codigo');
  const statusEl = document.getElementById('reg-codigo-status');
  if (!opcoes || !campo) return;

  // Troca de método (e-mail ⇄ botões). Delegado no documento uma vez só —
  // sobrevive ao cloneNode do formulário (o botão "voltar" vive dentro dele).
  if (!Auth._metodosBound) {
    Auth._metodosBound = true;
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-metodo-email')) { e.preventDefault(); Auth._mostrarFormEmail(); }
      else if (e.target.closest('#reg-voltar'))  { e.preventDefault(); Auth._mostrarMetodos(); }
    });
  }

  // Validação ao vivo do convite — destrava as opções quando o código serve.
  if (!campo.dataset.valBound) {
    campo.dataset.valBound = '1';
    let timer = null;
    campo.addEventListener('input', () => {
      const cod = campo.value.trim().toUpperCase();
      campo.value = cod;
      clearTimeout(timer);
      Auth._travarRegistro();                 // qualquer edição re-tranca
      if (cod.length < 8) { if (statusEl) statusEl.textContent = ''; return; }
      if (statusEl) { statusEl.textContent = 'Verificando...'; statusEl.style.color = 'var(--text-muted)'; }
      timer = setTimeout(async () => {
        try {
          const r = await API.convites.validar(cod);
          if (r.valido) {
            const extras = [];
            if (r.nivel_acesso === 'Admin') extras.push('<b style="color:#fbbf24">⚙️ Conta de Administrador</b>');
            if (r.badges?.length) extras.push('🎁 ' + r.badges.map(b => b.icone + ' ' + b.titulo).join(' · '));
            if (statusEl) {
              statusEl.innerHTML = `✔ Convocado por <b>${r.convocado_por}</b>` +
                (extras.length ? `<br><span style="font-size:.66rem">${extras.join('<br>')}</span>` : '');
              statusEl.style.color = '#34d399';
            }
            Auth._destravarRegistro();          // 🔓 libera formulário + social
          } else {
            if (statusEl) { statusEl.textContent = '✕ ' + (r.motivo || 'Convite inválido'); statusEl.style.color = '#f87171'; }
          }
        } catch (_) { if (statusEl) statusEl.textContent = ''; }
      }, 450);
    });
  }

  // Ao (re)entrar na tela: revalida se já houver um código digitado,
  // senão garante o estado travado.
  if (campo.value.trim().length >= 8) campo.dispatchEvent(new Event('input'));
  else Auth._travarRegistro();
};

Auth.bindRegistro = function() {
  const form = document.getElementById('form-registro');
  if (!form) return;

  // Portão + troca de método: liga uma vez (vivem fora do form).
  Auth._ligarPortaoRegistro();

  // Form clonado a cada entrada para zerar o listener de submit anterior.
  const novoForm = form.cloneNode(true);
  novoForm.classList.add('hidden');          // sempre começa escondido
  form.parentNode.replaceChild(novoForm, form);

  // Ao (re)entrar na tela, volta para a escolha dos 3 botões.
  Auth._mostrarMetodos();

  novoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroEl = document.getElementById('registro-erro');
    const btn    = document.getElementById('btn-criar-hunter');

    const codigo    = document.getElementById('reg-codigo')?.value?.trim().toUpperCase();
    const nome      = document.getElementById('reg-nome')?.value?.trim();
    const email     = document.getElementById('reg-email')?.value?.trim();
    const login     = document.getElementById('reg-login')?.value?.trim();
    const senha     = document.getElementById('reg-senha')?.value;
    const confirmar = document.getElementById('reg-confirmar')?.value;

    if (!codigo) {
      if (erroEl) { erroEl.textContent = 'O Sistema é fechado — informe seu código de convite'; erroEl.classList.remove('hidden'); }
      return;
    }
    if (!nome || !login || !senha) {
      if (erroEl) { erroEl.textContent = 'Preencha todos os campos'; erroEl.classList.remove('hidden'); }
      return;
    }
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(login)) {
      if (erroEl) { erroEl.textContent = 'Login: 3 a 30 caracteres (letras, números, . _ -)'; erroEl.classList.remove('hidden'); }
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

    const resultado = await Auth.registro(nome, login, email, senha, codigo);

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
   OAuth social — Google / Discord
   ------------------------------------------------------------
   O fluxo SAI da SPA: clicar num botão redireciona o navegador ao
   provedor; ele volta a index.html com #sr_token=<jwt> (ou #sr_erro).
   Aqui tratamos os dois lados:
     • consumirTokenDaUrl() — lê o fragmento no boot e vira sessão;
     • bindOAuth()          — desenha e liga os botões.
   ============================================================ */

// Guardado entre boot e a tela de login: se a volta do provedor trouxe erro,
// mostramos ao pintar a tela de login (que ainda nem existe no instante do boot).
Auth._oauthErro = null;
Auth._oauthProv = null;   // cache de /disponiveis — busca só uma vez

/* Lê #sr_token / #sr_erro deixado pela volta do provedor. O fragmento (#…)
   nunca chega ao servidor nem aos logs — por isso o token vem por ali.
   Devolve true se logou (há token), para o boot pular direto ao app. */
Auth.consumirTokenDaUrl = function() {
  const h = window.location.hash || '';
  if (!h || (h.indexOf('sr_token=') < 0 && h.indexOf('sr_erro=') < 0)) return false;

  const p = new URLSearchParams(h.replace(/^#/, ''));
  const token = p.get('sr_token');
  const erro  = p.get('sr_erro');

  // Limpa o fragmento da barra de endereço: token não fica no histórico,
  // e um F5 não repete o efeito.
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch (_) { window.location.hash = ''; }

  if (token) {
    _srSetToken(token);
    API.token = token;
    return true;
  }
  if (erro) Auth._oauthErro = erro;
  return false;
};

/* Descobre quais provedores estão configurados (uma vez) e pinta as telas. */
Auth.bindOAuth = async function() {
  if (!Auth._oauthProv) {
    try { Auth._oauthProv = await API.auth.oauth.disponiveis(); }
    catch { Auth._oauthProv = {}; }
  }
  Auth._pintarOAuth();
};

/* Mostra só os botões dos provedores ativos.
   - Login: o bloco inteiro aparece/some conforme haja algum provedor.
   - Registro: os botões vivem dentro da aba "social"; se não houver
     provedor, a aba some e a barra de abas vira invisível (sobra só o
     formulário, sem uma "escolha" de aba única sem sentido). */
Auth._pintarOAuth = function() {
  const prov = Auth._oauthProv || {};
  const algum = Object.values(prov).some(Boolean);

  // Tela de LOGIN
  const blocoLogin = document.getElementById('oauth-login');
  if (blocoLogin) {
    blocoLogin.classList.toggle('hidden', !algum);
    blocoLogin.querySelectorAll('.btn-oauth').forEach(b =>
      b.classList.toggle('hidden', !prov[b.dataset.prov]));
  }

  // Tela de REGISTRO: só os botões de provedor ativo. O botão de e-mail
  // (.btn-metodo) é sempre visível e não é tocado aqui.
  document.querySelectorAll('#reg-metodos .btn-oauth').forEach(b =>
    b.classList.toggle('hidden', !prov[b.dataset.prov]));

  // Erro trazido do provedor aparece na tela de login.
  if (Auth._oauthErro) {
    const el = document.getElementById('login-erro');
    if (el) { el.textContent = Auth._oauthErro; el.classList.remove('hidden'); }
    Auth._oauthErro = null;
  }
};

// Clique nos botões sociais — delegado no documento, sobrevive a cloneNode().
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn-oauth');
  if (!btn) return;
  e.preventDefault();

  const prov = btn.dataset.prov;
  const modo = btn.dataset.modo || 'login';

  if (modo === 'registro') {
    // Registro social continua fechado: sem convite, nem sai daqui.
    const cod = document.getElementById('reg-codigo')?.value?.trim().toUpperCase();
    const erroEl = document.getElementById('registro-erro');
    if (!cod) {
      if (erroEl) {
        erroEl.textContent = 'Informe o código de convite antes de registrar com ' +
          (prov === 'google' ? 'Google' : 'Discord') + '.';
        erroEl.classList.remove('hidden');
      }
      document.getElementById('reg-codigo')?.focus();
      return;
    }
    API.auth.oauth.iniciar(prov, 'registro', cod);
  } else {
    API.auth.oauth.iniciar(prov, 'login');
  }
});


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