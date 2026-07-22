/* ============================================================
   app.js — Solo Routines
   Router SPA principal: navegacao, auth, configs, lancador
   ============================================================ */

// ── Modal helper global ──
const Modal = {
  _callback: null,

  confirmar(titulo, msg, onConfirm, opts = {}) {
    this._callback = onConfirm;

    const elTitulo  = document.getElementById('modal-titulo');
    const elIcon    = document.getElementById('modal-icon');
    const elMsg     = document.getElementById('modal-msg');
    const elConfirm = document.getElementById('modal-confirmar');
    const backdrop  = document.getElementById('window-backdrop');
    const janela    = document.getElementById('modal-confirmacao');

    if (elTitulo) elTitulo.textContent = opts.titulo || titulo;
    if (elIcon)   elIcon.textContent   = opts.icon   || '⚠️';
    if (elMsg)    elMsg.innerHTML      = `<strong>${titulo}</strong><br><span style="font-size:.85rem;color:var(--text-muted)">${msg}</span>`;

    if (elConfirm) {
      elConfirm.className = `btn btn-sm ${opts.confirmClass || 'btn-danger'}`;
      elConfirm.textContent = opts.confirmText || 'Confirmar';
    }

    if (backdrop) backdrop.classList.add('visible');
    if (janela)   janela.classList.add('visible');
  },

  fechar() {
    document.getElementById('window-backdrop')?.classList.remove('visible');
    document.getElementById('modal-confirmacao')?.classList.remove('visible');
    this._callback = null;
  },

  _bindEvents() {
    document.getElementById('modal-confirmar')?.addEventListener('click', async () => {
      if (this._callback) await this._callback();
      this.fechar();
    });
    document.getElementById('modal-cancelar')?.addEventListener('click', () => this.fechar());
    document.getElementById('modal-fechar')?.addEventListener('click',   () => this.fechar());
  }
};

// ── App SPA principal ──
const App = {
  currentPage: 'dashboard',
  _usuario: null,

  async init() {
    // 0. Inicializar sistema de dialogs premium
    if (typeof SoloDialog !== 'undefined') SoloDialog.init();

    // 1. Bind eventos de modal
    Modal._bindEvents();

    // 2. Carregar configs visuais
    await this._carregarConfigs();

    // 3. Bind navegacao sidebar
    this._bindNavegacao();

    // 4. Bind sidebar mobile
    this._bindSidebarMobile();

    // 5. Bind logout
    document.getElementById('btn-logout')?.addEventListener('click', () => Auth.logout());

    // 6. Bind backdrop — apenas para fechar o Modal de confirmacao
    // O Lancador gerencia o seu proprio backdrop internamente
    document.getElementById('window-backdrop')?.addEventListener('click', () => {
      Modal.fechar();
    });

    // 7. (o "+ Nova Missão" do cabeçalho saiu — o lugar dele agora é a
    //     busca de hunters. O botão flutuante e os de cada página seguem
    //     ligados pelo lancador.js, que trata #btn-fab e #btn-nova-rotina.)

    // 7b. Atalho da ficha de edição para a vitrine pública
    document.getElementById('btn-ver-vitrine')?.addEventListener('click', () => {
      const login = this._usuario?.login || Auth._usuario?.login;
      if (login) window.HunterPublico?.abrir(login, 'perfil');
    });

    // 8. Bind link-ir-registro e link-ir-login
    document.getElementById('link-ir-registro')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._mostrarRegistro();
    });
    document.getElementById('link-ir-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._mostrarLogin();
    });

    // 9. Verificar autenticacao
    const token = Auth.getToken();
    if (token) {
      try {
        const usuario = await API.auth.me();
        if (usuario) {
          this.mostrarApp(usuario);
          await Dashboard.carregar();
        } else {
          Auth.logout(false);
          this.mostrarLogin();
        }
      } catch (_) {
        Auth.logout(false);
        this.mostrarLogin();
      }
    } else {
      this.mostrarLogin();
    }

    // 10. Inicializa drag-windows
    if (typeof DragWindows !== 'undefined') DragWindows.init();

    // 11. Inicializa particulas (canvas bg)
    this._initParticulas();

    // 12. Recompensa recebida → atualiza a página atual sozinha
    this._bindRecompensa();
  },

  /* Badges recebidas fora da sessão (registro/presente) são celebradas
     agora — o hunter nunca encontra medalhas caladas no perfil. */
  async celebrarPendentes() {
    try {
      const r = await API.emblemas.pendentes();
      const novas = r?.novas_conquistas || [];
      if (!novas.length) return;
      // pequeno respiro para o app terminar de pintar antes da cerimônia
      await new Promise(res => setTimeout(res, 900));
      novas.forEach(c => window.ConquistaFX?.show(c));
      await API.emblemas.celebradas();          // não repete no próximo login
    } catch (_) { /* silencioso: celebração nunca pode travar a entrada */ }
  },

  /* Ouve o fim de qualquer celebração (Ascensão/Cerimônia) e recarrega
     os dados da página visível — sem F5, sem piscar a tela. */
  _bindRecompensa() {
    if (this._recompensaBound) return;
    this._recompensaBound = true;
    window.addEventListener('sr:recompensa', () => {
      clearTimeout(this._recompensaTimer);
      // pequeno atraso: deixa o selo/carimbo assentarem antes de repintar
      this._recompensaTimer = setTimeout(() => this.atualizarPaginaAtual(), 700);
    });
  },

  /* Recarrega os dados da página em foco (útil após ganhos de XP) */
  async atualizarPaginaAtual() {
    try {
      switch (this.currentPage) {
        case 'dashboard': await Dashboard.carregar(); break;
        case 'perfil':    await Perfil.carregar();    break;
        case 'rotinas':   await Rotinas.carregar();   break;
        case 'tarefas':   await Tarefas.carregar();   break;
        case 'dungeons':  await Dungeons.carregar();  break;
        case 'loja':      await Loja.carregar();      break;
        case 'materiais': await Materiais.carregar(); break;
      }
      // A sidebar mostra rank/nível — atualiza sempre
      const u = await API.auth.me();
      if (u) {
        const rankEl = document.getElementById('sidebar-rank');
        if (rankEl && u.nivel_acesso !== 'Arquiteto') {
          rankEl.textContent = `${u.classe || 'E-Rank'} — Nv.${u.nivel_atual || 1}`;
        }
      }
    } catch (_) { /* silencioso: atualização é cortesia, não pode quebrar nada */ }
  },

  async navigate(page) {
    if (this.currentPage === page) return;

    // Limpa recursos da página anterior (timers, etc.)
    if (this.currentPage === 'rotinas' && page !== 'rotinas') {
      if (typeof Rotinas !== 'undefined') Rotinas.destruir();
    }
    if (this.currentPage === 'dashboard' && page !== 'dashboard') {
      if (typeof Dashboard !== 'undefined') Dashboard._pararTimerDash?.();
    }

    // Esconde pagina atual
    const atual = document.getElementById(`page-${this.currentPage}`);
    if (atual) atual.classList.add('hidden');

    // Mostra nova pagina
    const nova = document.getElementById(`page-${page}`);
    if (nova) {
      nova.classList.remove('hidden');
      nova.classList.add('active');
    }
    if (atual) {
      atual.classList.remove('active');
    }

    // Atualiza nav items
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navItem = document.getElementById(`nav-${page}`);
    if (navItem) navItem.classList.add('active');

    this.currentPage = page;

    // Fecha sidebar mobile
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');

    // Carrega conteudo
    switch (page) {
      case 'dashboard': await Dashboard.carregar(); break;
      case 'rotinas':   await Rotinas.carregar();   break;
      case 'tarefas':   await Tarefas.carregar();   break;
      case 'dungeons':  await Dungeons.carregar();  break;
      case 'loja':      await Loja.carregar();      break;
      case 'perfil':    await Perfil.carregar();    break;
      case 'materiais': await Materiais.carregar(); break;
      // 'hunter' não recarrega sozinho: quem abre é HunterPublico.abrir(login),
      // que já sabe de quem é o perfil. Navegar para cá sem login mostraria
      // uma tela vazia — por isso não há chamada aqui.
      case 'hunter':    break;
      case 'gerencial': await Gerencial.carregar(); break;
      case 'sistema':   await PainelAdmin.carregar(); break;
    }
  },

  mostrarLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('registro-screen')?.classList.add('hidden');
    document.getElementById('main-app')?.classList.add('hidden');
    Auth.bindLogin();
  },

  _mostrarRegistro() {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('registro-screen')?.classList.remove('hidden');
    Auth.bindRegistro();
  },

  _mostrarLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('registro-screen')?.classList.add('hidden');
  },

  mostrarApp(usuario) {
    this._usuario = usuario;

    // Atualiza o Auth com o usuário
    Auth.setUsuario(usuario);

    // Troca de tela
    const loginScreen    = document.getElementById('login-screen');
    const registroScreen = document.getElementById('registro-screen');
    const mainApp        = document.getElementById('main-app');

    if (loginScreen)    { loginScreen.classList.add('hidden');    loginScreen.style.display = 'none'; }
    if (registroScreen) { registroScreen.classList.add('hidden'); registroScreen.style.display = 'none'; }
    if (mainApp)        { mainApp.classList.remove('hidden');      mainApp.style.display = 'flex'; }

    // Preenche sidebar
    const nomeEl  = document.getElementById('sidebar-nome');
    const rankEl  = document.getElementById('sidebar-rank');
    const avEl    = document.getElementById('sidebar-avatar');

    if (nomeEl) nomeEl.textContent = usuario.nome || 'Hunter';

    // Badge especial para Arquiteto
    if (rankEl) {
      if (usuario.nivel_acesso === 'Arquiteto') {
        rankEl.innerHTML = `<span style="color:#fbbf24;font-weight:700;text-shadow:0 0 8px rgba(251,191,36,.6)">★ Arquiteto ★</span>`;
        if (avEl) { avEl.style.border = '2px solid #fbbf24'; avEl.style.boxShadow = '0 0 16px rgba(251,191,36,.5)'; }
        // O avatar da sidebar é pequeno demais para a aura: ali a moldura
        // dourada já basta. A aura entra nos hexágonos grandes (dashboard,
        // perfil e vitrine), aplicada por cada tela.
      } else {
        rankEl.textContent = `${usuario.classe || 'E-Rank'} — Nv.${usuario.nivel_atual || 1}`;
      }
    }
    if (avEl && usuario.avatar_url) {
      avEl.innerHTML = `<img src="${usuario.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    }

    // Mostra menu admin (Arquiteto, Criador, Admin)
    const isAdmin = Auth.isAdmin();
    const navAdminSection = document.getElementById('nav-admin-section');
    const navGerencial    = document.getElementById('nav-gerencial');
    const navSistema      = document.getElementById('nav-sistema');
    const isArquiteto     = usuario.nivel_acesso === 'Arquiteto';
    if (navAdminSection) navAdminSection.classList.toggle('hidden', !isAdmin);
    if (navSistema)      navSistema.classList.toggle('hidden', !isAdmin);
    // Configurações visuais continuam sendo exclusividade do Arquiteto
    if (navGerencial)    navGerencial.classList.toggle('hidden', !isArquiteto);

    // Menu do Painel Admin conforme privilégios
    this._aplicarPrivilegios();

    // Mostra pagina inicial
    this._mostrarPaginaInicial();

    // Celebra o que chegou enquanto o hunter estava fora
    this.celebrarPendentes();

    // BuddyList: liga o botão do menu e o contador global de não-lidas
    this._bindAmigos();
  },

  /* Botão "Amigos" abre a BuddyList (drawer), e um polling leve mantém o
     badge do menu com o total de não-lidas + pedidos. Uma vez só. */
  _bindAmigos() {
    if (this._amigosBound) return;
    this._amigosBound = true;

    document.getElementById('nav-amigos')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.BuddyList?.alternar();
    });

    const badge = document.getElementById('nav-amigos-badge');
    // Lembra quantas não-lidas havia na última checagem, para tocar o som
    // SÓ quando o número SOBE (mensagem nova chegou), não a cada poll.
    // Começa em null: a primeira checagem não toca — evita som ao logar
    // com mensagens já pendentes.
    this._ultimasNaoLidas = null;

    const pintar = async () => {
      try {
        const n = await API.social.novidades();
        const naoLidas = n.total_nao_lidas || 0;
        const total = naoLidas + (n.pedidos_recebidos || 0);

        // Som de mensagem nova: toca quando o total de não-lidas aumenta.
        // Com o chat aberto, a leitura marca como lida e o total não sobe,
        // então não toca — que é o certo (você já está vendo).
        if (this._ultimasNaoLidas !== null && naoLidas > this._ultimasNaoLidas) {
          window.SFX?.play('mensagem');
        }
        this._ultimasNaoLidas = naoLidas;

        if (!badge) return;
        badge.textContent = total > 99 ? '99+' : total;
        badge.classList.toggle('hidden', total === 0);
      } catch (_) { /* silencioso: contador é cortesia */ }
    };
    pintar();
    // 8s: folgado o bastante para não pesar, rápido o bastante para a
    // mensagem nova "chegar" sem dar a sensação de que travou.
    clearInterval(this._amigosTimer);
    this._amigosTimer = setInterval(pintar, 8000);
  },

  /* Consulta o mapa de permissões e ajusta o menu */
  async _aplicarPrivilegios() {
    try {
      const p = await API.emblemas.permissoes();
      this._perm = p;
      const secao   = document.getElementById('nav-admin-section');
      const sistema = document.getElementById('nav-sistema');
      const config  = document.getElementById('nav-gerencial');
      if (secao)   secao.classList.toggle('hidden', !p.pode.ver_painel);
      if (sistema) sistema.classList.toggle('hidden', !p.pode.ver_painel);
      if (config)  config.classList.toggle('hidden', !p.pode.configurar_sistema);
    } catch (_) { /* mantém o comportamento atual em caso de falha */ }
  },

  /* Atalho usado pelas telas: App.pode('gerar_convites') */
  pode(acao) {
    return !!this._perm?.pode?.[acao];
  },

  _mostrarPaginaInicial() {
    // Esconde todas as paginas
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
      p.classList.add('hidden');
    });
    // Mostra dashboard
    const dash = document.getElementById('page-dashboard');
    if (dash) {
      dash.classList.remove('hidden');
      dash.classList.add('active');
    }
    // Ativa nav dashboard
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('nav-dashboard')?.classList.add('active');
    this.currentPage = 'dashboard';
  },

  aplicarConfig(configs) {
    if (!configs) return;

    // Nome do app
    if (configs.app_nome) {
      const els = document.querySelectorAll('#sidebar-app-nome, title');
      els.forEach(el => {
        if (el.tagName === 'TITLE') el.textContent = configs.app_nome;
        else el.textContent = configs.app_nome;
      });
    }

    // Logo
    if (configs.logo_url) {
      const logoEl = document.getElementById('sidebar-logo-img');
      if (logoEl) {
        // Verifica se e URL ou emoji
        if (configs.logo_url.startsWith('http') || configs.logo_url.startsWith('/')) {
          logoEl.innerHTML = `<img src="${configs.logo_url}" alt="Logo" style="width:100%;height:100%;object-fit:contain">`;
        } else {
          logoEl.textContent = configs.logo_url;
        }
      }
    }

    // Cor de destaque
    if (configs.cor_destaque) {
      document.documentElement.style.setProperty('--purple-main', configs.cor_destaque);
      // Gera variacoes
      document.documentElement.style.setProperty('--purple-glow', configs.cor_destaque + 'cc');
    }

    // Fontes
    if (configs.fonte_titulo) {
      document.documentElement.style.setProperty('--font-title', configs.fonte_titulo);
    }
    if (configs.fonte_secao) {
      document.documentElement.style.setProperty('--font-section', configs.fonte_secao);
    }
    if (configs.fonte_body) {
      document.documentElement.style.setProperty('--font-body', configs.fonte_body);
    }
  },

  async _carregarConfigs() {
    try {
      const configs = await API.get('/admin/configs');
      if (configs) this.aplicarConfig(configs);
    } catch (_) {
      // Sem configs, usa padroes
    }
  },

  _bindNavegacao() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page) this.navigate(page);
      });
    });
  },

  _bindSidebarMobile() {
    const toggle   = document.getElementById('sidebar-toggle');
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebar-overlay');

    toggle?.addEventListener('click', () => {
      sidebar?.classList.toggle('open');
      overlay?.classList.toggle('visible');
    });
    overlay?.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      overlay?.classList.remove('visible');
    });
  },

  // ── Canvas de particulas ──
  _initParticulas() {
    const canvas = document.getElementById('particles-bg');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let W = window.innerWidth;
    let H = window.innerHeight;

    canvas.width  = W;
    canvas.height = H;

    window.addEventListener('resize', () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    });

    const NUM = 60;
    const particles = Array.from({ length: NUM }, () => ({
      x:     Math.random() * W,
      y:     Math.random() * H,
      r:     Math.random() * 1.5 + 0.3,
      vx:    (Math.random() - 0.5) * 0.3,
      vy:    (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      // Cor: mistura de roxo, ciano e dourado
      hue:   [270, 190, 45][Math.floor(Math.random() * 3)]
    }));

    const animate = () => {
      ctx.clearRect(0, 0, W, H);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Rebate nas bordas
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        // Pulsa alpha suavemente
        p.alpha += (Math.random() - 0.5) * 0.01;
        p.alpha  = Math.max(0.05, Math.min(0.55, p.alpha));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.alpha})`;
        ctx.fill();
      });

      // Linhas entre particulas proximas
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(124,58,237,${0.08 * (1 - dist/100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    };

    animate();
  }
};

// ── Expõe globalmente e inicializa ──
window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());