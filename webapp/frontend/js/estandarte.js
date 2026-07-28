/* ============================================================
   estandarte.js — Vitrine de Banners do Hunter (propostas)

   POR QUE ESTE ARQUIVO É SEPARADO DE TUDO

   Existe um `bannerMelhorado()` em arquiteto-console.js, com a flag
   `bannerPremium`, mexendo direto no `#hunter-card`. Aquele caminho está
   sendo trabalhado por outra mão. Este arquivo NÃO toca nele:

     • arquivo próprio (js/estandarte.js + css/estandarte.css)
     • prefixo próprio (`est-`) — zero colisão de seletor
     • não altera `#hunter-card`: desenha numa vitrine própria
     • registrado na Forja chamando `window.Estandarte` DIRETO

   DUAS PROPOSTAS, LADO A LADO

   V1 · O Estandarte (heráldico)
       Tecido pendurado em trilho de metal, bainha rasgada, selo de cera.
       Linguagem de relíquia. Foi a primeira tentativa e ficou longe da
       referência — o Arquiteto tinha razão. Fica como alternativa.

   V2 · O Portal (arcano)
       Fiel à referência: campo petróleo com arcos de circuito, hexágono
       com anel de luz, feixe ciano de XP, gemas de estatística à direita.
       Linguagem de HUD.

   E AS DUAS SÃO VIVAS: carregam a AURA real do hunter e as RELÍQUIAS reais
   do altar dele. Uma vitrine de cosmético que não mostra os cosméticos não
   testa nada — foi o que o Arquiteto apontou, e era o defeito central da
   primeira versão.

   Requer: css/estandarte.css · Auras · ConquistaFX (opcionais: degrada bem)
   ============================================================ */

const Estandarte = {

  /* ── Tecidos do V1 ───────────────────────────────────────
     Cada um é uma paleta completa: pano, dobra, fio e cera mudam juntos.
     Trocar só o acento deixaria os três com cara de mesma coisa pintada. */
  TECIDOS: {
    obsidiana: {
      nome: 'Obsidiana e Ouro',
      pano: '#0d0a14', panoAlto: '#1a1426', pano2: '#080610',
      fio: '#d4a94a', fioAlto: '#f4d98a',
      cera: '#8b1a1a', ceraAlto: '#c23b3b',
      trilho: '#5a4a2a', luz: 'rgba(212,169,74,.55)',
    },
    sangue: {
      nome: 'Sangue do Monarca',
      pano: '#160709', panoAlto: '#2b0d12', pano2: '#0d0407',
      fio: '#e0b8c0', fioAlto: '#ffe3e9',
      cera: '#2a0a0d', ceraAlto: '#7a1f28',
      trilho: '#4a2228', luz: 'rgba(224,80,110,.5)',
    },
    gelo: {
      nome: 'Gelo Sombrio',
      pano: '#070d14', panoAlto: '#0f1c2b', pano2: '#04080e',
      fio: '#a8c8e0', fioAlto: '#dff0ff',
      cera: '#123045', ceraAlto: '#2d6b91',
      trilho: '#25404f', luz: 'rgba(120,190,230,.45)',
    },
  },

  /* ── Campos do V2 ────────────────────────────────────────
     "Petróleo" é o da referência. Os outros dois existem para provar que
     a peça aguenta troca de paleta sem desmontar. */
  CAMPOS: {
    petroleo: { nome: 'Petróleo',  fundo: '#0a1f24', fundo2: '#061418',
                circuito: '#1d5f68', feixe: '#3fd8e8', feixe2: '#8ff4ff' },
    abissal:  { nome: 'Abissal',   fundo: '#0d1030', fundo2: '#060818',
                circuito: '#2a3a7a', feixe: '#7c8cff', feixe2: '#c4ccff' },
    brasa:    { nome: 'Brasa',     fundo: '#251208', fundo2: '#140903',
                circuito: '#6b3a15', feixe: '#ff9d3f', feixe2: '#ffd9a8' },
  },

  /* Cor do RANK — do hunter, não do banner. Atravessa as duas propostas. */
  RANK_CORES: {
    E: '#94a3b8', D: '#22d3ee', C: '#10b981',
    B: '#3b82f6', A: '#a855f7', S: '#fbbf24', N: '#fb7185',
  },

  _opcoes: {
    versao: 'v2',        // v2 é a fiel à referência — abre nela
    tecido: 'obsidiana', // V1
    campo: 'petroleo',   // V2
    rasgado: true, trilho: true, brasao: true, balanco: true,
    aura: '',            // '' = a aura real do hunter
    rank: '',            // '' = o rank real
  },

  _el: null,
  _acervo: [],           // relíquias reais, já filtradas pelo altar
  _auraReal: null,
  _carregado: false,

  /* ── Dados ───────────────────────────────────────────────── */
  _hunter() {
    const u = (typeof Auth !== 'undefined' && Auth.getUsuario) ? Auth.getUsuario() : null;
    return u || {
      nome: 'Hunter', titulo: 'Sem título', classe: 'E-Rank',
      nivel_atual: 1, xp_atual: 0, xp_proximo_nivel: 100,
      moedas: 0, streak_atual: 0, nivel_acesso: 'User',
    };
  },

  /* Busca o que a vitrine precisa MOSTRAR: as relíquias do altar e a aura
     ativa. Sem isto, a vitrine desenha molduras vazias — que era
     exatamente o problema: não dava para ver aura nem insígnia nenhuma.

     Tolerante a falha de propósito: a bancada de testes tem que abrir
     mesmo com a rede fora, senão ela deixa de servir justamente quando
     mais se precisa dela. */
  async _carregarAcervo() {
    if (this._carregado) return;
    this._carregado = true;
    try {
      const [conq, altar] = await Promise.allSettled([
        API.conquistas.listar(),
        API.perfil.reliquias().catch(() => ({ fixadas: [] })),
      ]);
      const todas = (conq.status === 'fulfilled' ? (conq.value || []) : [])
        .filter(c => c.desbloqueada);
      const fix = (altar.status === 'fulfilled' ? (altar.value?.fixadas || []) : [])
        .map(cod => todas.find(c => c.codigo === cod)).filter(Boolean);
      this._acervo = (fix.length ? fix : todas).slice(0, 5);
    } catch (_) { this._acervo = []; }

    try {
      const me = await API.auth.me();
      this._auraReal = me?.aura_id || null;
      this._perfil = me || null;
    } catch (_) { /* segue com o que Auth já tem */ }
  },

  /* Auras disponíveis para experimentar. Vem do REGISTRO de desenho, não de
     uma lista escrita à mão: aura nova aparece aqui sozinha — mesma lição
     que a Forja de Testes aprendeu ao parar de manter catálogo manual. */
  _aurasDisponiveis() {
    if (typeof Auras === 'undefined' || !Auras._registro) return [];
    return Object.keys(Auras._registro).filter(id => id && id !== 'nome');
  },

  _letraRank(classe) {
    const c = (classe || 'E-Rank').toUpperCase();
    if (c.includes('NATIONAL')) return 'N';
    const m = c.match(/\b([EDCBAS])\b|^([EDCBAS])-/);
    return (m && (m[1] || m[2])) || 'E';
  },

  /* ── Abertura ────────────────────────────────────────────── */
  async abrir() {
    this._render();
    await this._carregarAcervo();
    this._render();          // repinta já com aura e relíquias reais
  },

  fechar() {
    this._el?.remove();
    this._el = null;
  },

  /* ── A vitrine ───────────────────────────────────────────── */
  _render() {
    const rolagem = this._el?.querySelector('.est-palco')?.scrollTop || 0;
    this.fechar();

    const o = this._opcoes;
    const el = document.createElement('div');
    el.className = 'est-overlay';
    el.innerHTML = `
      <div class="est-painel" role="dialog" aria-label="Vitrine de banners">
        <header class="est-topo">
          <div>
            <h2>Vitrine de Banners</h2>
            <p>PROPOSTAS DE INTERFACE · ENSAIO · NADA É SALVO</p>
          </div>
          <div class="est-versoes">
            <button class="est-v ${o.versao === 'v1' ? 'on' : ''}" data-est-versao="v1">
              V1 · Estandarte</button>
            <button class="est-v ${o.versao === 'v2' ? 'on' : ''}" data-est-versao="v2">
              V2 · Portal</button>
            <button class="est-v ${o.versao === 'v3' ? 'on' : ''}" data-est-versao="v3">
              V3 · S-Rank</button>
            <button class="est-v ${o.versao === 'v4' ? 'on' : ''}" data-est-versao="v4" style="color: #22d3ee; border-color: rgba(34, 211, 238, 0.4);">
              V4 · Otimizada</button>
          </div>
          <button class="est-x" data-est-fechar aria-label="Fechar">✕</button>
        </header>

        <div class="est-palco"></div>

        <div class="est-controles">${this._controles()}</div>

        <footer class="est-rodape">
          <span>${this._acervo.length
            ? `Mostrando as ${this._acervo.length} relíquia(s) reais do seu altar.`
            : 'Sem relíquias no altar — as molduras aparecem vazias.'}</span>
          ${this._emTesteDash ? `
            <button class="est-btn est-btn-destaque" data-est-testar-dash title="Atualiza o teste no banner do Dashboard com as opções escolhidas">⚡ Atualizar no Dashboard</button>
            <button class="est-btn est-btn-perigo" data-est-restaurar-dash title="Restaura o banner real original do Dashboard">🔄 Restaurar Banner Real</button>
          ` : `
            <button class="est-btn est-btn-destaque" data-est-testar-dash title="Substitui o banner real do Dashboard por esta versão para testar">🎯 Testar no Lugar do Banner Real</button>
          `}
          <button class="est-btn" data-est-fechar>Fechar</button>
        </footer>
      </div>`;

    el.addEventListener('click', e => { if (e.target === el) this.fechar(); });
    document.body.appendChild(el);
    this._el = el;
    this._ligar(el);
    this._pintar();
    const p = el.querySelector('.est-palco');
    if (p) p.scrollTop = rolagem;
  },

  _controles() {
    const o = this._opcoes;
    const grupo = (rot, corpo) =>
      `<div class="est-grupo"><span class="est-rot">${rot}</span><div class="est-ops">${corpo}</div></div>`;

    const auras = this._aurasDisponiveis();
    const seletorAura = grupo('Aura no retrato', `
      <select class="est-sel" data-est-aura>
        <option value="">Minha aura${this._auraReal ? ` (${this._auraReal})` : ' (do cargo)'}</option>
        <option value="__nenhuma">Sem aura</option>
        ${auras.map(a => `<option value="${a}" ${o.aura === a ? 'selected' : ''}>${a}</option>`).join('')}
      </select>`);

    const seletorRank = grupo('Rank (experimentar)', `
      <select class="est-sel" data-est-rank>
        <option value="">Meu rank</option>
        ${['E', 'D', 'C', 'B', 'A', 'S', 'N'].map(r =>
          `<option value="${r}" ${o.rank === r ? 'selected' : ''}>${r}-Rank</option>`).join('')}
      </select>`);

    if (o.versao === 'v1') {
      return grupo('Tecido', Object.entries(this.TECIDOS).map(([id, t]) => `
        <button class="est-op ${o.tecido === id ? 'on' : ''}" data-est-tecido="${id}"
                style="--amostra:${t.panoAlto};--amostra-fio:${t.fio}">
          <span class="est-swatch"></span>${t.nome}</button>`).join(''))
        + grupo('Acabamento', [
            ['rasgado', 'Bainha rasgada'], ['trilho', 'Trilho'],
            ['brasao', 'Brasão'], ['balanco', 'Balanço'],
          ].map(([k, r]) =>
            `<button class="est-op ${o[k] ? 'on' : ''}" data-est-toggle="${k}">${r}</button>`).join(''))
        + seletorAura + seletorRank;
    }

    return grupo('Campo', Object.entries(this.CAMPOS).map(([id, c]) => `
      <button class="est-op ${o.campo === id ? 'on' : ''}" data-est-campo="${id}"
              style="--amostra:${c.fundo};--amostra-fio:${c.feixe}">
        <span class="est-swatch"></span>${c.nome}</button>`).join(''))
      + seletorAura + seletorRank;
  },

  _ligar(el) {
    el.querySelectorAll('[data-est-fechar]').forEach(b =>
      b.addEventListener('click', () => this.fechar()));

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-est-testar-dash]')) { return this.testarNoDashboard(); }
      if (e.target.closest('[data-est-restaurar-dash]')) { return this.restaurarDashboard(); }
      const v = e.target.closest('[data-est-versao]');
      if (v) { this._opcoes.versao = v.dataset.estVersao; return this._render(); }
      const t = e.target.closest('[data-est-tecido]');
      if (t) { this._opcoes.tecido = t.dataset.estTecido; return this._render(); }
      const c = e.target.closest('[data-est-campo]');
      if (c) { this._opcoes.campo = c.dataset.estCampo; return this._render(); }
      const g = e.target.closest('[data-est-toggle]');
      if (g) { this._opcoes[g.dataset.estToggle] = !this._opcoes[g.dataset.estToggle]; return this._render(); }
    });

    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-est-aura]')) { this._opcoes.aura = e.target.value; return this._pintar(); }
      if (e.target.matches('[data-est-rank]')) { this._opcoes.rank = e.target.value; return this._pintar(); }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._el) this.fechar();
    }, { once: true });
  },

  _emTesteDash: false,

  testarNoDashboard() {
    const card = document.getElementById('hunter-card');
    if (!card) {
      SoloDialog?.toast?.('Abra a página do Dashboard primeiro para visualizar o teste no lugar do banner real!', 'warn');
      return;
    }

    const containerTeste = document.getElementById('est-teste-banner-container');
    
    this._emTesteDash = true;
    card.classList.add('est-teste-ativo');

    const u = { ...this._hunter(), ...(this._perfil || {}) };
    const v = this._opcoes.versao;
    const htmlBanner = v === 'v1' ? this.html(u) : v === 'v2' ? this.htmlV2(u) : this.htmlV3(u);
    const vNome = v === 'v1' ? 'V1 (Estandarte)' : v === 'v2' ? 'V2 (Portal)' : 'V3 (S-Rank)';

    if (containerTeste) {
      const wrap = document.getElementById('est-teste-banner-wrap');
      if (wrap) wrap.innerHTML = htmlBanner;
      const aviso = document.querySelector('#est-teste-aviso-bar span');
      if (aviso) aviso.innerHTML = `⚡ <strong>MODO TESTE ARQUITETO:</strong> Visualizando Banner ${vNome} no lugar do banner real`;
    } else {
      const c = document.createElement('div');
      c.id = 'est-teste-banner-container';
      c.style.position = 'relative';
      c.style.zIndex = '5';
      c.style.width = '100%';
      c.innerHTML = `
        <div id="est-teste-aviso-bar" style="position:relative; z-index:10; width:100%; margin-bottom:0.6rem; display:flex; align-items:center; justify-content:space-between; background:rgba(16,185,129,0.18); border:1px solid rgba(16,185,129,0.5); border-radius:8px; padding:0.45rem 0.9rem; font-family:var(--font-section); font-size:0.68rem; color:#a7f3d0; box-shadow:0 0 12px rgba(16,185,129,0.2);">
          <span>⚡ <strong>MODO TESTE ARQUITETO:</strong> Visualizando Banner ${vNome} no lugar do banner real</span>
          <button id="btn-restaurar-banner-direct" style="background:rgba(239,68,68,0.25); border:1px solid rgba(239,68,68,0.6); color:#fca5a5; padding:0.25rem 0.65rem; border-radius:6px; font-size:0.62rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.4)'" onmouseout="this.style.background='rgba(239,68,68,0.25)'">✕ Restaurar Original</button>
        </div>
        <div id="est-teste-banner-wrap">${htmlBanner}</div>
      `;
      card.appendChild(c);

      c.querySelector('#btn-restaurar-banner-direct')?.addEventListener('click', () => {
        this.restaurarDashboard();
      });
    }

    SoloDialog?.toast?.(`Banner ${vNome} aplicado no lugar do banner real do Dashboard!`, 'success');
    if (this._el) this._render();
  },

  restaurarDashboard() {
    const card = document.getElementById('hunter-card');
    if (this._emTesteDash) {
      this._emTesteDash = false;
      const c = document.getElementById('est-teste-banner-container');
      if (c) c.remove();
      
      if (card) {
        card.classList.remove('est-teste-ativo');
      }
      
      SoloDialog?.toast?.('Banner real do Dashboard restaurado!', 'info');
      if (this._el) this._render();
    }
  },

  _pintar() {
    const u = { ...this._hunter(), ...(this._perfil || {}) };
    const htmlBanner = this._opcoes.versao === 'v1' ? this.html(u) : 
                       this._opcoes.versao === 'v2' ? this.htmlV2(u) : 
                       this._opcoes.versao === 'v3' ? this.htmlV3(u) : 
                       this.htmlV4(u);

    const palco = this._el?.querySelector('.est-palco');
    if (palco) {
      palco.innerHTML = htmlBanner;
      window.BadgeCard?.ligarTodos('.est-palco [data-bc]', this._acervo);
    }

    if (this._emTesteDash) {
      const wrap = document.getElementById('est-teste-banner-wrap');
      if (wrap) {
        wrap.innerHTML = htmlBanner;
        const vNome = this._opcoes.versao === 'v1' ? 'V1 (Estandarte)' : this._opcoes.versao === 'v2' ? 'V2 (Portal)' : this._opcoes.versao === 'v3' ? 'V3 (S-Rank)' : 'V4 (Otimizada)';
        const avisoTxt = document.querySelector('#est-teste-aviso-bar span');
        if (avisoTxt) avisoTxt.innerHTML = `⚡ <strong>MODO TESTE ARQUITETO:</strong> Visualizando Banner ${vNome} no lugar do banner real`;
        window.BadgeCard?.ligarTodos('#est-teste-banner-wrap [data-bc]', this._acervo);
      }
    }

    this._bindBotoesDashboard();
  },

  _bindBotoesDashboard() {
    if (!this._emTesteDash) return;
    
    const wrap = document.getElementById('est-teste-banner-wrap');
    if (!wrap) return;

    // Aura button
    const btnAura = wrap.querySelector('#dash-btn-trocar-aura');
    if (btnAura) {
      btnAura.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.restaurarDashboard();
        if (window.App && window.App.navigate) {
          window.App.navigate('inventario', { aba: 'cosmeticos' });
        }
      };
    }

    // Altar button (pode haver versão desktop e mobile com o mesmo ID por conta de layout)
    const btnsAltar = wrap.querySelectorAll('#dash-altar');
    btnsAltar.forEach(btnAltar => {
      btnAltar.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.AltarReliquias && window.AltarReliquias.abrir) {
          window.AltarReliquias.abrir(async () => {
            await this.abrir(); // Re-carrega o acervo e renderiza novamente
          });
        }
      };
    });
    
    // Swap / Carrossel 3D Button (Apenas Mobile)
    const btnSwap = wrap.querySelector('#dash-altar-swap');
    if (btnSwap) {
      const grid = wrap.querySelector('.pt-v4-grid');
      let isGemasFront = false;
      
      const girarCarrossel = () => {
        if (!grid) return;
        isGemasFront = !isGemasFront;
        if (isGemasFront) {
          grid.classList.add('cq-gemas-front');
          grid.classList.remove('cq-badges-front');
        } else {
          grid.classList.add('cq-badges-front');
          grid.classList.remove('cq-gemas-front');
        }
      };
      
      // Limpa qualquer interval anterior do mesmo widget para evitar leaks
      if (this._carouselInterval) clearInterval(this._carouselInterval);
      
      // Inicia o carrossel automático a cada 5 segundos
      this._carouselInterval = setInterval(girarCarrossel, 5000);
      
      btnSwap.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Quando o usuário clica, ele assume o controle e para o giro automático
        if (this._carouselInterval) {
          clearInterval(this._carouselInterval);
          this._carouselInterval = null;
        }
        girarCarrossel();
      };
    }

    // Editar Epígrafe
    const btnEpigrafe = wrap.querySelector('#dash-btn-editar-epigrafe');
    if (btnEpigrafe) {
      btnEpigrafe.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const { value: novaFrase } = await Swal.fire({
          title: 'Editar Citação',
          input: 'text',
          inputLabel: 'Qual a sua epígrafe? (Máximo 100 caracteres)',
          inputValue: this._u.bio || '',
          inputAttributes: {
            maxlength: 100
          },
          showCancelButton: true,
          confirmButtonText: 'Gravar',
          cancelButtonText: 'Cancelar',
          background: '#0d1117',
          color: '#c9d1d9',
          customClass: {
            confirmButton: 'solo-btn-primary',
            cancelButton: 'solo-btn-secondary'
          }
        });
        
        if (novaFrase !== undefined) {
          try {
            const resp = await fetch('/api/perfil', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (localStorage.getItem('solo_token') || '')
              },
              body: JSON.stringify({ bio: novaFrase })
            });
            if (resp.ok) {
              const data = await resp.json();
              this._u.bio = novaFrase;
              // Atualiza localmente sem precisar recarregar o banner inteiro, ou recarrega:
              this.abrir();
            } else {
              Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível salvar a epígrafe.' });
            }
          } catch (err) {
            console.error(err);
          }
        }
      };
    }
  },

  /* ── Peças compartilhadas ────────────────────────────────── */

  /* A AURA de verdade, no tamanho pedido. `Auras.bloco` já vem com largura
     em atributo — obrigatório por causa da regra global `svg{max-width:100%}`
     que colapsa desenho sem tamanho próprio (custou caro descobrir isso). */
  _aura(u, tam) {
    if (typeof Auras === 'undefined') return '';
    const esc = this._opcoes.aura;
    if (esc === '__nenhuma') return '';
    const id = esc || this._auraReal || null;
    if (id && Auras.existe && Auras.existe(id)) return Auras.bloco(id, tam);
    // Sem aura cosmética: cai na aura do CARGO, que é o que o Dashboard faz.
    const cargo = u.nivel_acesso;
    if (cargo && Auras.existe && Auras.existe(String(cargo).toLowerCase())) {
      return Auras.bloco(String(cargo).toLowerCase(), tam);
    }
    return '';
  },

  _reliquias(tam = 34, hideEditBtn = false) {
    if (!this._acervo.length) return '';
    const medalha = c => (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(c, tam)
      : `<span style="font-size:${tam * .7}px">${c.icone || '🏆'}</span>`;
    
    const itens = this._acervo.map(c =>
      `<span class="est-reliquia" data-bc="${c.codigo}" style="cursor:pointer">${medalha(c)}</span>`).join('');
      
    const btnEditar = (this._emTesteDash && !hideEditBtn)
      ? `<button class="est-btn-altar est-btn-altar-desktop" id="dash-altar" title="Modificar Relíquias"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>` 
      : '';
      
    return itens + btnEditar;
  },

  _rank(u) {
    return this._opcoes.rank || this._letraRank(u.classe);
  },

  /* ══════════════════════════════════════════════════════════
     V2 · O PORTAL — fiel à referência
     ══════════════════════════════════════════════════════════ */
  htmlV2(u, opts = {}) {
    const o = { ...this._opcoes, ...opts };
    const c = this.CAMPOS[o.campo] || this.CAMPOS.petroleo;
    const letra = this._rank(u);
    const corRank = this.RANK_CORES[letra] || '#a855f7';

    const xp = Math.max(0, u.xp_atual || 0);
    const alvo = Math.max(1, u.xp_proximo_nivel || 100);
    const pct = Math.min(100, (xp / alvo) * 100);

    const estilo = [
      `--pt-fundo:${c.fundo}`, `--pt-fundo2:${c.fundo2}`,
      `--pt-circuito:${c.circuito}`, `--pt-feixe:${c.feixe}`, `--pt-feixe2:${c.feixe2}`,
      `--pt-rank:${corRank}`,
    ].join(';');

    const cargo = u.nivel_acesso && u.nivel_acesso !== 'User' ? u.nivel_acesso : null;

    return `
      <div class="pt-banner" style="${estilo}">
        ${this._circuito()}

        <div class="pt-conteudo">
          <!-- Retrato hexagonal com anel de luz e selo de rank -->
          <div class="pt-retrato">
            ${this._aura(u, 210)}
            ${this._orbitaHex()}
            <div class="pt-hex">
              <div class="pt-hex-luz"></div>
              <div class="pt-hex-foto">
                ${u.avatar_url
                  ? `<img src="${this._esc(u.avatar_url)}" alt="">`
                  : `<span class="pt-inicial">${this._esc((u.nome || 'H')[0]).toUpperCase()}</span>`}
              </div>
            </div>
            ${this._seloHex(letra, corRank)}
            <button class="est-btn-aura" id="dash-btn-trocar-aura" title="Trocar Aura">◈</button>
          </div>

          <!-- Identidade -->
          <div class="pt-identidade">
            <div class="pt-nome">${this._esc(u.nome || 'Hunter')}</div>
            <div class="pt-titulo">"${this._esc(u.titulo || 'Sem título')}"</div>
            <div class="pt-chips">
              <span class="pt-chip pt-chip-rank">${letra}-Rank</span>
              ${cargo ? `<span class="pt-chip pt-chip-cargo">★ ${this._esc(cargo).toUpperCase()} ★</span>` : ''}
            </div>
          </div>

          <!-- Núcleo: sigilo + feixe de XP + relíquias -->
          <div class="pt-nucleo">
            <div class="pt-linha-xp">
              <div class="pt-sigilo" title="${(typeof Gemas!=='undefined'&&Gemas.nomeRank)?Gemas.nomeRank(letra):('Rank '+letra)}">
                ${this._medalhaRank(letra, 72)}
              </div>
              <div class="pt-feixe-caixa">
                <div class="pt-xp-num">${xp.toLocaleString('pt-BR')} / ${alvo.toLocaleString('pt-BR')} XP</div>
                ${this._barraXP(pct, c)}
              </div>
            </div>
            <div class="pt-reliquias">
              <span class="pt-reliquias-vao" aria-hidden="true"></span>
              <span class="pt-reliquias-fila">${this._reliquias(50)
                || '<span class="pt-vazio">nenhuma relíquia no altar</span>'}</span>
            </div>
          </div>

          <!-- Gemas de estatística -->
          <div class="pt-gemas">
            ${this._gema('ametista', u.nivel_atual ?? 1, 'Nível')}
            ${this._gema('ambar', (u.moedas ?? 0).toLocaleString('pt-BR'), 'Mana Coins')}
            ${this._gema('rubi', u.streak_atual ?? 0, 'Streak')}
          </div>
        </div>
      </div>`;
  },

  /* ══════════════════════════════════════════════════════════
     V4 · S-RANK (Otimizada com Dock e Epígrafe)
     ══════════════════════════════════════════════════════════ */
  htmlV4(u, opts = {}) {
    const o = { ...this._opcoes, ...opts };
    const c = this.CAMPOS[o.campo] || this.CAMPOS.petroleo;
    const letra = this._rank(u);
    const corRank = this.RANK_CORES[letra] || '#a855f7';
    
    const xp = Math.max(0, u.xp_atual || 0);
    const alvo = Math.max(1, u.xp_proximo_nivel || 100);
    const pct = Math.min(100, (xp / alvo) * 100);
    
    const estilo = [
      `--pt-fundo:${c.fundo}`, `--pt-fundo2:${c.fundo2}`,
      `--pt-circuito:${c.circuito}`, `--pt-feixe:${c.feixe}`, `--pt-feixe2:${c.feixe2}`,
      `--pt-rank:${corRank}`,
    ].join(';');

    const cargo = u.nivel_acesso && u.nivel_acesso !== 'User' ? u.nivel_acesso : null;
    const epigrafe = u.bio || 'Desperte o seu sistema. Erga-se contra a maré do ordinário.';

    return `
      <div class="pt-banner pt-v4-banner" style="${estilo}">
        <div class="pt-v4-hologrid"></div>
        ${this._circuito()}

        <div class="pt-v3-grid pt-v4-grid">
          
          <!-- Coluna 1: Avatar + Identidade -->
          <div class="pt-v3-avatar-grupo pt-v4-avatar">
            <div class="pt-retrato">
              ${this._aura(u, 210)}
              ${this._orbitaHex()}
              <div class="pt-hex">
                <div class="pt-hex-luz"></div>
                <div class="pt-hex-foto">
                  ${u.avatar_url
                    ? `<img src="${this._esc(u.avatar_url)}" alt="">`
                    : `<span class="pt-inicial">${this._esc((u.nome || 'H')[0]).toUpperCase()}</span>`}
                </div>
              </div>
              ${this._seloHex(letra, corRank)}
              <button class="est-btn-aura" id="dash-btn-trocar-aura" title="Trocar Aura">◈</button>
            </div>

            <div class="pt-identidade">
              <div class="pt-nome">${this._esc(u.nome || 'Hunter')}</div>
              <div class="pt-titulo pt-v4-shimmer">"${this._esc(u.titulo || 'Sem título')}"</div>
              <div class="pt-chips">
                <span class="pt-chip pt-chip-rank">${letra}-Rank</span>
                ${cargo ? `<span class="pt-chip pt-chip-cargo">★ ${this._esc(cargo).toUpperCase()} ★</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Coluna 2: Núcleo e Estruturas de Encaixe -->
          <div class="pt-nucleo pt-v4-nucleo">
            
            <div class="pt-v4-trilho-mestre">
              <div class="pt-v4-ancora pt-v4-ancora-esq"><svg viewBox="0 0 10 20"><path fill="currentColor" d="M10,0 L0,5 L0,15 L10,20 Z"/></svg></div>
              <div class="pt-linha-xp">
                <div class="pt-feixe-caixa">
                  <div class="pt-xp-num">${xp.toLocaleString('pt-BR')} / ${alvo.toLocaleString('pt-BR')} XP</div>
                  ${this._barraXP(pct, c)}
                </div>
              </div>
              <div class="pt-v4-ancora pt-v4-ancora-dir"><svg viewBox="0 0 10 20"><path fill="currentColor" d="M0,0 L10,5 L10,15 L0,20 Z"/></svg></div>
            </div>

            <div class="pt-v4-reliquias-dock">
              <div class="pt-reliquias">
                <span class="pt-reliquias-fila">${this._reliquias(50)
                  || '<span class="pt-vazio">nenhuma relíquia no altar</span>'}</span>
              </div>
            </div>

            <div class="pt-v4-epigrafe">
              <span class="pt-v4-quote-mark left">❝</span>
              <span class="pt-v4-quote-text">${this._esc(epigrafe)}</span>
              <span class="pt-v4-quote-mark right">❞</span>
              <button class="est-btn-editar-epigrafe" id="dash-btn-editar-epigrafe" title="Editar Epígrafe">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
            </div>

          </div>

          <!-- Coluna 3: Gemas -->
          <div class="pt-gemas pt-v4-gemas">
            <div class="pt-v4-fio-conector"></div>
            ${this._gema('ametista', u.nivel_atual ?? 1, 'Nível', { auraV3: true })}
            ${this._gema('ambar', (u.moedas ?? 0).toLocaleString('pt-BR'), 'Mana Coins', { auraV3: true })}
            ${this._gema('rubi', u.streak_atual ?? 0, 'Streak', { auraV3: true })}
          </div>
          
          <!-- Botões de Ação Mobile Soltos no Grid -->
          <div class="est-v4-acoes-mobile">
            <button class="est-btn-altar" id="dash-altar-swap" title="Girar Carrossel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <polyline points="23 20 23 14 17 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"></path>
                <path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14"></path>
              </svg>
            </button>
            <button class="est-btn-altar" id="dash-altar" title="Modificar Relíquias">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          </div>
          
        </div>
      </div>`;
  },

  /* ══════════════════════════════════════════════════════════
     V3 · S-RANK (Arquitetura em 3 Colunas)
     ══════════════════════════════════════════════════════════ */
  htmlV3(u, opts = {}) {
    const o = { ...this._opcoes, ...opts };
    const c = this.CAMPOS[o.campo] || this.CAMPOS.petroleo;
    const letra = this._rank(u);
    const corRank = this.RANK_CORES[letra] || '#a855f7';
    
    const xp = Math.max(0, u.xp_atual || 0);
    const alvo = Math.max(1, u.xp_proximo_nivel || 100);
    const pct = Math.min(100, (xp / alvo) * 100);
    
    const estilo = [
      `--pt-fundo:${c.fundo}`, `--pt-fundo2:${c.fundo2}`,
      `--pt-circuito:${c.circuito}`, `--pt-feixe:${c.feixe}`, `--pt-feixe2:${c.feixe2}`,
      `--pt-rank:${corRank}`,
    ].join(';');

    const cargo = u.nivel_acesso && u.nivel_acesso !== 'User' ? u.nivel_acesso : null;

    return `
      <div class="pt-banner" style="${estilo}">
        ${this._circuito()}

        <div class="pt-v3-grid">
          
          <!-- Coluna 1: Avatar + Identidade -->
          <div class="pt-v3-avatar-grupo">
            <!-- Retrato hexagonal -->
            <div class="pt-retrato">
              ${this._aura(u, 210)}
              ${this._orbitaHex()}
              <div class="pt-hex">
                <div class="pt-hex-luz"></div>
                <div class="pt-hex-foto">
                  ${u.avatar_url
                    ? `<img src="${this._esc(u.avatar_url)}" alt="">`
                    : `<span class="pt-inicial">${this._esc((u.nome || 'H')[0]).toUpperCase()}</span>`}
                </div>
              </div>
              ${this._seloHex(letra, corRank)}
              <button class="est-btn-aura" id="dash-btn-trocar-aura" title="Trocar Aura">◈</button>
            </div>

            <!-- Identidade -->
            <div class="pt-identidade">
              <div class="pt-nome">${this._esc(u.nome || 'Hunter')}</div>
              <div class="pt-titulo">"${this._esc(u.titulo || 'Sem título')}"</div>
              <div class="pt-chips">
                <span class="pt-chip pt-chip-rank">${letra}-Rank</span>
                ${cargo ? `<span class="pt-chip pt-chip-cargo">★ ${this._esc(cargo).toUpperCase()} ★</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Coluna 2: Núcleo (Plasma e Relíquias) -->
          <div class="pt-nucleo">
            <div class="pt-linha-xp">
              <!-- Escudo removido conforme solicitado para abrir espaço para a barra -->
              <div class="pt-feixe-caixa">
                <div class="pt-xp-num">${xp.toLocaleString('pt-BR')} / ${alvo.toLocaleString('pt-BR')} XP</div>
                ${this._barraXP(pct, c)}
              </div>
            </div>
            <div class="pt-reliquias">
              <span class="pt-reliquias-fila">${this._reliquias(50)
                || '<span class="pt-vazio">nenhuma relíquia no altar</span>'}</span>
            </div>
          </div>

          <!-- Coluna 3: Gemas -->
          <div class="pt-gemas">
            ${this._gema('ametista', u.nivel_atual ?? 1, 'Nível', { auraV3: true })}
            ${this._gema('ambar', (u.moedas ?? 0).toLocaleString('pt-BR'), 'Mana Coins', { auraV3: true })}
            ${this._gema('rubi', u.streak_atual ?? 0, 'Streak', { auraV3: true })}
          </div>

        </div>
      </div>`;
  },

  /* O ANEL QUE GIRA EM TORNO DO HEXÁGONO.

     ERRO MEU, CORRIGIDO: eu havia inventado um contorno hexagonal com
     `stroke-dasharray` correndo. O Arquiteto mandou olhar o código, e ele
     estava certo — o projeto JÁ TEM esse efeito, e é outra coisa:

       `.hunter-hex-ring` em css/status-window.css
       → conic-gradient com dois arcos claros
       → recortado em hexágono por clip-path
       → girando com `cq-anel-girar`, e com blur(1px)

     A diferença não é de gosto: um traço percorrendo o contorno é uma
     linha viajando; um cone girando é LUZ VARRENDO a superfície. São
     leituras diferentes, e a segunda é a linguagem do app.

     Copiar a técnica (não importar a classe) mantém o prefixo `pt-` e o
     isolamento deste arquivo — mas o efeito é o mesmo, e quando o do
     projeto mudar, este aqui é uma linha para acompanhar. */
  _orbitaHex() {
    return '<span class="pt-anel" aria-hidden="true"></span>';
  },

  /* SELO HEXAGONAL DO RANK — encostado no retrato.

     Era um círculo pequeno, solto no canto. Vira hexágono pela mesma razão
     que a foto é hexagonal: repetir a forma amarra as duas peças como um
     conjunto só, em vez de "uma foto e um distintivo". Encosta no vértice
     inferior-direito do hexágono grande, de modo que as arestas conversem.

     Em SVG, não em CSS, por um motivo prático: o bisel interno e o anel
     externo precisam acompanhar o recorte hexagonal. Com `clip-path` a
     borda some junto com o recorte — é preciso desenhar cada camada. */
  _seloHex(letra, cor) {
    const hex = (r) => {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${(24 + r * Math.cos(a)).toFixed(2)},${(24 + r * Math.sin(a)).toFixed(2)}`);
      }
      return pts.join(' ');
    };
    return `
      <span class="pt-selo-hex" title="Rank ${letra}">
        <svg viewBox="0 0 48 48" width="48" height="48" style="max-width:none" aria-hidden="true">
          <defs>
            <linearGradient id="shBorda" x1=".2" y1="0" x2=".8" y2="1">
              <stop offset="0%"   stop-color="#fff3cd"/>
              <stop offset="45%"  stop-color="${cor}"/>
              <stop offset="100%" stop-color="#0a1116"/>
            </linearGradient>
            <radialGradient id="shMiolo" cx="38%" cy="30%">
              <stop offset="0%"   stop-color="#0f2b33"/>
              <stop offset="100%" stop-color="#040d11"/>
            </radialGradient>
            <filter id="shGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.6"/>
            </filter>
          </defs>
          <polygon points="${hex(23)}" fill="${cor}" opacity=".45" filter="url(#shGlow)"/>
          <polygon points="${hex(21)}" fill="url(#shBorda)"/>
          <polygon points="${hex(17)}" fill="url(#shMiolo)"/>
          <polygon points="${hex(17)}" fill="none" stroke="${cor}" stroke-width="1" opacity=".9"/>
          <path d="M ${hex(19).split(' ')[4]} L ${hex(19).split(' ')[5]} L ${hex(19).split(' ')[0]}"
                fill="none" stroke="#fff" stroke-width="1.4" opacity=".4" stroke-linecap="round"/>
        </svg>
        <span class="pt-selo-letra" style="color:${cor}">${letra}</span>
      </span>`;
  },

  /* ══════════════════════════════════════════════════════════
     A BARRA DE XP — em SVG, e não em CSS

     POR QUE MUDOU DE TECNOLOGIA

     A primeira versão empilhava três camadas de CSS: uma calha com
     `overflow: visible`, um halo em `radial-gradient` e um lustro em
     `background-position`. Funcionava na teoria e não apareceu na tela —
     e não é mistério: um brilho que precisa TRANSBORDAR os limites do
     elemento fica à mercê de cada `overflow`, `border-radius` e contexto
     de empilhamento no caminho até a raiz. Basta um ancestral recortando
     para ele sumir, e são muitos ancestrais.

     Em SVG o brilho não depende de nada disso. `feGaussianBlur` desenha o
     borrão DENTRO da própria tela do SVG, e a região de filtro
     (`x/y/width/height` a -50%/200%) reserva o espaço para ele existir.
     Deixa de ser uma aposta sobre a cascata e vira desenho.

     O EFEITO QUE CIRCUNDA A BARRA, em quatro camadas:

       1. AURA — o trecho preenchido, borrado e ampliado. É a luz que a
          energia joga em volta: ela acompanha o preenchimento, então
          cresce conforme o XP sobe.
       2. TRILHO — a calha escura com luz de borda embaixo (metal polido).
       3. FEIXE — o preenchimento, com degradê que clareia até a ponta.
       4. CENTELHA — um ponto de luz na cabeça do feixe, pulsando, mais
          uma faísca que corre pelo perímetro do trecho aceso.

     A centelha que corre usa `stroke-dasharray` com `stroke-dashoffset`
     animado: um traço curto percorrendo o contorno do trecho preenchido.
     É essa que dá a leitura de "circula a barra".
     ══════════════════════════════════════════════════════════ */
  _barraXP(pct, campo) {
    /* A tela reserva 96px à ESQUERDA da barra: é lá que os três feixes
       saem do escudo e se juntam. O CSS puxa o SVG para a esquerda com
       margem negativa, de modo que essa faixa caia sobre o escudo. */
    const W = 980, H = 78;
    const zona = 45;                    // faixa de convergência e ancoragem do nodo
    const bx = zona, bw = W - zona - 14;
    const cy = H / 2, bh = 11;
    const by = cy - bh / 2;
    const fw = Math.max(bh, bw * (pct / 100));
    const px = bx + fw;

    /* ══════════════════════════════════════════════════════
       A HÉLICE — três correções sobre a versão anterior

       1. A AMPLITUDE, medida duas vezes. Primeiro estava alta demais (15
          numa barra de 5,5 de raio) e a onda parecia passar POR CIMA.
          Baixei para 9 e ficou pior: os arcos de trás quase não saíam da
          barra — sobravam 3,5px visíveis — então o que se via era só a
          camada da frente, e o efeito virou linha reta.

          O ponto certo é OUTRO: os dois arcos precisam aparecer FORA da
          barra, e a oclusão acontece só na travessia. Com 17, cada arco
          sobra 11px além da borda: dá para ver o de cima passando atrás e
          o de baixo passando à frente. É a alternância entre os dois que
          produz a volta, não a altura da onda.

       2. E FALTAVA PERSPECTIVA. Numa hélice real, o trecho que passa NA
          FRENTE está mais perto: mais grosso e mais brilhante. O que passa
          ATRÁS está mais longe: mais fino e mais apagado. Sem essa
          diferença, os dois lados parecem estar no mesmo plano — e o
          conjunto vira zigue-zague.

       3. AS PONTAS. Ela nascia e morria no corte. Agora entra pela
          esquerda como TRÊS FEIXES saindo do escudo, que se fundem num só
          na boca da barra; e à direita ultrapassa o fim e se dissolve
          numa máscara de desvanecimento.
       ══════════════════════════════════════════════════════ */
    const ciclos = 2.6;   // menos ciclos = arcos mais largos, leitura mais clara
    const lam = bw / ciclos;
    const amp = 17;                      // sobra ~11px de cada lado da barra
    const x0 = bx - lam, x1 = bx + bw + lam * .6;

    const pontoY = (x) => cy + Math.sin(((x - bx) / lam) * Math.PI * 2) * amp;

    const segmento = (xa, xb) => {
      const passos = 16;
      const d = [];
      for (let i = 0; i <= passos; i++) {
        const x = xa + (xb - xa) * (i / passos);
        d.push(`${i ? 'L' : 'M'} ${x.toFixed(1)} ${pontoY(x).toFixed(1)}`);
      }
      return d.join(' ');
    };

    const tras = [], frente = [];
    const meio = lam / 2;
    let k = 0;
    for (let xa = x0; xa < x1; xa += meio, k++) {
      const seg = segmento(xa, Math.min(xa + meio + 2, x1));
      (k % 2 === 0 ? tras : frente).push(seg);
    }

    /* O NODO DE ORIGEM E OS FEIXES.
       Como a barra estava 'flutuando', criamos um ancoradouro tecnológico (um losango).
       Os três feixes convergem das extremidades (perspectiva do circuito) 
       e injetam energia no nodo, que por sua vez ejeta a barra de XP. */
    const feixes = [-1.5, 0, 1.5].map((n, i) => {
      const yIni = cy + n * 18;
      const xIni = -10; // Nascem de fora da tela
      const yFim = cy;
      const d = `M ${xIni} ${yIni} C ${bx * 0.4} ${yIni} ${bx * 0.6} ${yFim} ${bx} ${yFim}`;
      return `<path class="pt-feixe-nasce pt-feixe-n${i}" d="${d}" fill="none"
                    stroke="url(#feixeNasce)" stroke-width="${2.5 - Math.abs(n) * .5}"
                    stroke-linecap="round" filter="url(#linhaBrilho)"/>`;
    }).join('');

    const nodoOrigem = `
      <g class="pt-nodo-ancora">
        <polygon points="${bx-10},${cy} ${bx},${cy-10} ${bx+10},${cy} ${bx},${cy+10}" fill="${campo.fundo2}" stroke="${campo.feixe}" stroke-width="1.5" filter="url(#linhaBrilho)"/>
        <circle cx="${bx}" cy="${cy}" r="3" fill="#fff" filter="url(#linhaBrilho)"/>
        <path d="M 0 ${cy} L ${bx} ${cy}" stroke="${campo.circuito}" stroke-width="1.5" stroke-dasharray="2 4" opacity="0.5"/>
      </g>
    `;

    return `
      <svg class="pt-barra" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
           width="100%" height="${H}" aria-hidden="true"
           style="max-width:none;--lam:${lam.toFixed(2)}px">
        <defs>
          <linearGradient id="feixeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stop-color="${campo.feixe}" stop-opacity=".3"/>
            <stop offset="55%"  stop-color="${campo.feixe}"/>
            <stop offset="100%" stop-color="${campo.feixe2}"/>
          </linearGradient>
          <linearGradient id="trilhoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#000" stop-opacity=".78"/>
            <stop offset="100%" stop-color="#000" stop-opacity=".38"/>
          </linearGradient>
          <linearGradient id="linhaGrad" x1="0" y1="0" x2="1" y2="0"
                          gradientUnits="objectBoundingBox">
            <stop offset="0%"   stop-color="${campo.feixe}"  stop-opacity=".25"/>
            <stop offset="14%"  stop-color="${campo.feixe2}" stop-opacity=".95"/>
            <stop offset="30%"  stop-color="${campo.feixe}"  stop-opacity=".45"/>
            <stop offset="48%"  stop-color="${campo.feixe2}" stop-opacity="1"/>
            <stop offset="64%"  stop-color="${campo.feixe}"  stop-opacity=".35"/>
            <stop offset="82%"  stop-color="${campo.feixe2}" stop-opacity=".9"/>
            <stop offset="100%" stop-color="${campo.feixe}"  stop-opacity=".3"/>
          </linearGradient>
          <linearGradient id="feixeNasce" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stop-color="${campo.feixe2}" stop-opacity="0"/>
            <stop offset="35%"  stop-color="${campo.feixe2}" stop-opacity=".55"/>
            <stop offset="100%" stop-color="${campo.feixe2}" stop-opacity=".95"/>
          </linearGradient>

          <filter id="aura" x="-30%" y="-200%" width="160%" height="500%">
            <feGaussianBlur stdDeviation="8"/>
          </filter>
          <filter id="linhaBrilho" x="-30%" y="-200%" width="160%" height="500%">
            <feGaussianBlur stdDeviation="2.4"/>
          </filter>
          <filter id="auraForte" x="-40%" y="-200%" width="180%" height="500%">
            <feGaussianBlur stdDeviation="3"/>
          </filter>

          <!-- DESVANECIMENTO NAS PONTAS. A hélice ultrapassa o fim da barra
               e SOME aos poucos, em vez de ser cortada no meio do traço. À
               esquerda o mesmo, para a fusão dos feixes parecer nascimento. -->
          <linearGradient id="fadeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"    stop-color="#fff" stop-opacity="0"/>
            <stop offset="${(zona / W * 100).toFixed(1)}%" stop-color="#fff" stop-opacity="1"/>
            <stop offset="88%"   stop-color="#fff" stop-opacity="1"/>
            <stop offset="100%"  stop-color="#fff" stop-opacity="0"/>
          </linearGradient>
          <mask id="dissolver">
            <rect x="0" y="0" width="${W}" height="${H}" fill="url(#fadeGrad)"/>
          </mask>
        </defs>

        <!-- os três feixes nascendo do escudo -->
        <g>${feixes}</g>

        <g mask="url(#dissolver)">
          <!-- 1 · aura do trecho aceso -->
          <rect x="${bx}" y="${by}" width="${fw}" height="${bh}" rx="${bh / 2}"
                fill="${campo.feixe}" opacity=".5" filter="url(#aura)"/>

          <!-- 2 · a metade que passa ATRÁS: mais fina e mais apagada,
                   porque está mais longe do olho -->
          <g class="pt-onda pt-onda-tras">
            ${tras.map(d => `<path d="${d}" fill="none" stroke="url(#linhaGrad)"
                    stroke-width="2.4" stroke-linecap="round"
                    filter="url(#linhaBrilho)" opacity=".42"/>`).join('')}
          </g>

          <!-- 3 · trilho -->
          <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh / 2}"
                fill="url(#trilhoGrad)" stroke="${campo.circuito}" stroke-width="1"/>

          <!-- 4 · feixe -->
          <rect x="${bx}" y="${by}" width="${fw}" height="${bh}" rx="${bh / 2}"
                fill="url(#feixeGrad)" filter="url(#auraForte)" opacity=".85"/>
          <rect x="${bx}" y="${by}" width="${fw}" height="${bh}" rx="${bh / 2}"
                fill="url(#feixeGrad)"/>

          <!-- 5 · a metade DA FRENTE: mais grossa e mais brilhante,
                   porque está mais perto. É esta diferença que produz o
                   volume — sem ela, os dois lados parecem coplanares. -->
          <g class="pt-onda pt-onda-frente">
            ${frente.map(d => `<path d="${d}" fill="none" stroke="url(#linhaGrad)"
                    stroke-width="5" stroke-linecap="round"
                    filter="url(#linhaBrilho)" opacity="1"/>`).join('')}
          </g>

          <!-- 6 · centelha na cabeça do feixe -->
          <circle cx="${px}" cy="${cy}" r="11" fill="${campo.feixe2}"
                  opacity=".45" filter="url(#auraForte)"/>
          <circle class="pt-centelha" cx="${px}" cy="${cy}" r="5" fill="#fff"/>
          <circle cx="${px}" cy="${cy}" r="2.2" fill="#fff"/>
        </g>
      </svg>`;
  },

  /* Arcos de circuito no canto direito — a assinatura visual da referência.
     Ficam em opacidade baixa: é atmosfera, não desenho para olhar. */
  _circuito() {
    return `
      <svg class="pt-circuito" viewBox="0 0 400 120" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="1">
          <path d="M400 20 L330 20 L310 40 L250 40"/>
          <path d="M400 60 L350 60 L332 78 L268 78"/>
          <path d="M400 100 L360 100 L344 84 L300 84"/>
          <path d="M250 40 L235 55 L235 95"/>
          <circle cx="250" cy="40" r="3"/><circle cx="268" cy="78" r="3"/>
          <circle cx="300" cy="84" r="3"/><circle cx="235" cy="95" r="3"/>
          <path d="M400 8 A 112 112 0 0 0 288 120" stroke-opacity=".55"/>
          <path d="M400 -14 A 134 134 0 0 0 266 120" stroke-opacity=".35"/>
          <path d="M400 34 A 86 86 0 0 0 314 120" stroke-opacity=".45"/>
        </g>
      </svg>`;
  },

  /* PEDRA LAPIDADA de estatística.
     Antes era um hexágono com degradê, e hexágono com degradê não é pedra:
     é polígono pintado. Agora vem de `Gemas.pedraComValor`, que desenha
     mesa, facetas de coroa alternando luz, pavilhão e cintilação — o mesmo
     processo das badges (SVG forjado em código, IDs únicos, tamanho
     explícito). Sem a forja carregada, cai num disco simples em vez de
     sumir: a vitrine tem que abrir sempre. */
  _gema(pedra, valor, rotulo, opts = {}) {
    if (typeof Gemas !== 'undefined' && Gemas.pedraComValor) {
      return `
        <div class="pt-gema" title="${rotulo}">
          ${Gemas.pedraComValor(pedra, valor, 56, opts)}
          <span class="pt-gema-rot">${rotulo}</span>
        </div>`;
    }
    return `
      <div class="pt-gema">
        <div class="pt-gema-fallback"><span class="pt-gema-val">${valor}</span></div>
        <span class="pt-gema-rot">${rotulo}</span>
      </div>`;
  },

  /* MEDALHA DE RANK — evolui de E a N (Gemas.rank).
     Substituiu o sigilo lunar, que era decoração fixa. Agora a peça à
     esquerda da barra CONTA alguma coisa: quanto mais alto o rank, mais
     raios, anéis e — no S e no N — coroa e louros. A diferença se vê na
     silhueta, de longe, sem precisar ler a letra. */
  _medalhaRank(letra, tam = 46) {
    if (typeof Gemas !== 'undefined' && Gemas.rank) return Gemas.rank(letra, tam);
    return `<span class="pt-rank-fallback">${letra}</span>`;
  },

  /* ══════════════════════════════════════════════════════════
     V1 · O ESTANDARTE (heráldico)
     ══════════════════════════════════════════════════════════ */
  html(u, opts = {}) {
    const o = { ...this._opcoes, ...opts };
    const t = this.TECIDOS[o.tecido] || this.TECIDOS.obsidiana;
    const letra = this._rank(u);
    const corRank = this.RANK_CORES[letra] || '#a855f7';

    const xp = Math.max(0, u.xp_atual || 0);
    const alvo = Math.max(1, u.xp_proximo_nivel || 100);
    const pct = Math.min(100, (xp / alvo) * 100);

    const estilo = [
      `--est-pano:${t.pano}`, `--est-pano-alto:${t.panoAlto}`, `--est-pano2:${t.pano2}`,
      `--est-fio:${t.fio}`, `--est-fio-alto:${t.fioAlto}`,
      `--est-cera:${t.cera}`, `--est-cera-alto:${t.ceraAlto}`,
      `--est-trilho:${t.trilho}`, `--est-luz:${t.luz}`,
      `--est-rank:${corRank}`,
    ].join(';');

    const classes = ['est-flamula'];
    if (o.rasgado) classes.push('est-rasgado');
    if (o.balanco) classes.push('est-balanco');

    return `
      <div class="est-conjunto" style="${estilo}">
        ${o.trilho ? this._trilho() : ''}
        <div class="${classes.join(' ')}">
          ${o.brasao ? this._brasao() : ''}
          <div class="est-trama" aria-hidden="true"></div>

          <div class="est-conteudo">
            ${this._retrato(u, letra)}

            <div class="est-centro">
              <div class="est-nome">${this._esc(u.nome || 'Hunter')}</div>
              <div class="est-titulo">"${this._esc(u.titulo || 'Sem título')}"</div>
              ${this._fita(xp, alvo, pct)}
              <div class="est-reliquias">${this._reliquias(44)}</div>
            </div>

            <div class="est-medalhas">
              ${this._medalha('nivel', u.nivel_atual ?? 1, 'Nível')}
              ${this._medalha('mana', (u.moedas ?? 0).toLocaleString('pt-BR'), 'Mana')}
              ${this._medalha('chama', u.streak_atual ?? 0, 'Streak')}
            </div>
          </div>

          ${o.rasgado ? this._bainha() : ''}
        </div>
      </div>`;
  },

  _trilho() {
    return `
      <div class="est-trilho" aria-hidden="true">
        <span class="est-anel esq"></span>
        <span class="est-barra"></span>
        <span class="est-anel dir"></span>
      </div>`;
  },

  _brasao() {
    return `
      <svg class="est-brasao" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="est-losango" width="14" height="14" patternUnits="userSpaceOnUse"
                   patternTransform="rotate(45)">
            <path d="M0 0h14v14H0z" fill="none"/>
            <path d="M0 7h14M7 0v14" stroke="currentColor" stroke-width=".6" opacity=".5"/>
          </pattern>
        </defs>
        <path d="M0 0 L100 0 L100 60 L0 60 Z" fill="url(#est-losango)" opacity=".5"/>
        <path d="M100 0 L200 0 L200 60 L100 60 Z" fill="currentColor" opacity=".045"/>
        <path d="M0 0 L200 60" stroke="currentColor" stroke-width=".5" opacity=".12"/>
        <path d="M0 60 L200 0" stroke="currentColor" stroke-width=".5" opacity=".12"/>
      </svg>`;
  },

  _retrato(u, letra) {
    const foto = u.avatar_url
      ? `<img src="${this._esc(u.avatar_url)}" alt="">`
      : `<span class="est-inicial">${this._esc((u.nome || 'H')[0]).toUpperCase()}</span>`;
    return `
      <div class="est-retrato">
        ${this._aura(u, 196)}
        <div class="est-moldura">
          <div class="est-foto">${foto}</div>
        </div>
        <div class="est-selo" title="Rank ${letra}">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <path class="est-cera-borda" d="M20 2.5 25 6 31 5.4 33.5 11 38 14.5 36.4 20.5
              38 26.5 33.5 30 31 35.6 25 35 20 38.5 15 35 9 35.6 6.5 30 2 26.5 3.6 20.5
              2 14.5 6.5 11 9 5.4 15 6Z"/>
          </svg>
          <span class="est-letra">${letra}</span>
        </div>
        <button class="est-btn-aura" id="dash-btn-trocar-aura" title="Trocar Aura">◈</button>
      </div>`;
  },

  _fita(xp, alvo, pct) {
    return `
      <div class="est-fita">
        <div class="est-fita-corpo">
          <div class="est-fita-preenche" style="width:${pct}%"></div>
          <span class="est-fita-txt">${xp.toLocaleString('pt-BR')} / ${alvo.toLocaleString('pt-BR')} XP</span>
        </div>
        <span class="est-fita-cauda esq"></span>
        <span class="est-fita-cauda dir"></span>
      </div>`;
  },

  _medalha(tipo, valor, rotulo) {
    return `
      <div class="est-medalha est-med-${tipo}">
        <span class="est-corrente" aria-hidden="true"></span>
        <span class="est-disco"><span class="est-valor">${valor}</span></span>
        <span class="est-med-rot">${rotulo}</span>
      </div>`;
  },

  _bainha() {
    return `
      <svg class="est-bainha" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 L0 6 L8 3 L16 8 L24 2 L33 7 L41 3 L50 9 L58 4 L67 8 L75 2 L84 7
                 L92 3 L101 9 L109 4 L118 7 L126 2 L135 8 L143 3 L152 9 L160 4 L169 7
                 L177 2 L186 8 L194 3 L200 6 L200 0 Z"/>
      </svg>`;
  },

  _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
};

window.Estandarte = Estandarte;
