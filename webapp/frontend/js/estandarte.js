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
  get TECIDOS() { return BannersArte.TECIDOS; },

  get CAMPOS() { return BannersArte.CAMPOS; },

  get RANK_CORES() { return BannersArte.RANK_CORES; },

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

  /* ── ATALHOS PARA O VOCABULÁRIO ────────────────────────────
     Estas treze funções moram em js/banners-arte.js. Ficam aqui como
     atalhos de uma linha para que NENHUMA chamada da V1/V2/V3/V4
     precisasse mudar — o que torna a extração verificável: se o HTML
     das quatro versões sai idêntico, a mudança foi só de endereço.

     `_aura`, `_reliquias` e `_rank` NÃO estão aqui de propósito: elas
     leem estado de bancada (a aura que o Arquiteto escolheu no
     painel, o acervo carregado, o rank forçado para teste). Isso é
     Vitrine, não vocabulário. */
  _letraRank(classe) { return BannersArte.letraRank(classe); },

  async abrir() {
    this._render();
    await this._carregarAcervo();
    this._render();          // repinta já com aura e relíquias reais
  },

  fechar() {
    this._el?.remove();
    this._el = null;
    /* O carrossel da V4 girava para sempre depois que a Vitrine
       fechava — contra um `.pt-v4-grid` que já tinha saído do DOM.
       Na peça o timer é do registro; aqui, no preview da própria
       Vitrine, ainda é nosso. */
    if (this._carouselInterval) {
      clearInterval(this._carouselInterval);
      this._carouselInterval = null;
    }
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

  /* ══════════════════════════════════════════════════════════
     TESTAR NO LUGAR DO BANNER REAL

     Tinha DOIS defeitos, os dois achados por leitura:

     1. NÃO CONHECIA A V4. A cadeia de versões aqui tinha três
        ramos — `v1 : v2 : senão V3` — enquanto a do `_pintar()`
        tinha quatro. Escolher V4 e mandar testar no Dashboard
        mostrava a V3. Dois caminhos que deveriam ser um só
        divergiram, e o segundo ficou para trás.

     2. INJETAVA HTML DENTRO DO #hunter-card. Aquilo era uma div
        estática; hoje é o SLOT de uma peça. Enfiar conteúdo lá
        dentro brigaria com a montagem — a peça apaga o contêiner
        ao montar.

     A correção dos dois é a mesma: o quadro de teste vira IRMÃO do
     slot, e o slot é escondido enquanto durar o teste. Ninguém
     escreve dentro da casa do outro.
     ══════════════════════════════════════════════════════════ */
  _htmlDaVersao(u, v) {
    return v === 'v1' ? this.html(u)
         : v === 'v2' ? this.htmlV2(u)
         : v === 'v3' ? this.htmlV3(u)
         : this.htmlV4(u);
  },

  _nomeDaVersao(v) {
    return { v1: 'V1 (Estandarte)', v2: 'V2 (Portal)', v3: 'V3 (S-Rank)' }[v] || 'V4 (Otimizada)';
  },

  testarNoDashboard() {
    const slot = document.getElementById('hunter-card');
    if (!slot) {
      SoloDialog?.toast?.('Abra a página do Dashboard primeiro para visualizar o teste no lugar do banner real!', 'warn');
      return;
    }

    /* O SLOT É EMPRESTADO, NÃO INVADIDO.

       A versão anterior fazia `card.appendChild()` dentro do
       #hunter-card. Aquilo era uma div estática; hoje é o slot de
       uma peça, e a peça apaga o contêiner ao montar — os dois
       escreveriam no mesmo lugar.

       Desmontar antes resolve pela raiz: o Dashboard recolhe seus
       timers e ouvintes, a bancada usa o espaço, e no restaurar a
       peça volta do zero. É a mesma disciplina que o contrato pede
       de qualquer um que queira o contêiner de outro. */
    if (typeof Pecas !== 'undefined') Pecas.desmontar(slot);

    this._emTesteDash = true;
    slot.classList.add('est-teste-ativo');

    const u = { ...this._hunter(), ...(this._perfil || {}) };
    const v = this._opcoes.versao;
    const vNome = this._nomeDaVersao(v);

    let c = document.getElementById('est-teste-banner-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'est-teste-banner-container';
      c.style.cssText = 'position:relative;z-index:5;width:100%';
      c.innerHTML = `
        <div id="est-teste-aviso-bar" style="position:relative; z-index:10; width:100%; margin-bottom:0.6rem; display:flex; align-items:center; justify-content:space-between; background:rgba(16,185,129,0.18); border:1px solid rgba(16,185,129,0.5); border-radius:8px; padding:0.45rem 0.9rem; font-family:var(--font-section); font-size:0.68rem; color:#a7f3d0; box-shadow:0 0 12px rgba(16,185,129,0.2);">
          <span></span>
          <button id="btn-restaurar-banner-direct" style="background:rgba(239,68,68,0.25); border:1px solid rgba(239,68,68,0.6); color:#fca5a5; padding:0.25rem 0.65rem; border-radius:6px; font-size:0.62rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.4)'" onmouseout="this.style.background='rgba(239,68,68,0.25)'">✕ Restaurar Original</button>
        </div>
        <div id="est-teste-banner-wrap"></div>
      `;
      slot.appendChild(c);
      c.querySelector('#btn-restaurar-banner-direct')?.addEventListener('click', () => this.restaurarDashboard());
    }

    c.querySelector('#est-teste-banner-wrap').innerHTML = this._htmlDaVersao(u, v);
    c.querySelector('#est-teste-aviso-bar span').innerHTML =
      `⚡ <strong>MODO TESTE ARQUITETO:</strong> Visualizando Banner ${vNome} no lugar do banner real`;

    SoloDialog?.toast?.(`Banner ${vNome} aplicado no lugar do banner real do Dashboard!`, 'success');
    if (this._el) this._render();
  },

  restaurarDashboard() {
    if (!this._emTesteDash) return;
    this._emTesteDash = false;
    document.getElementById('est-teste-banner-container')?.remove();

    const slot = document.getElementById('hunter-card');
    if (slot) slot.classList.remove('est-teste-ativo');

    // Devolver o slot é REMONTAR: não existe peça hibernando fora
    // da página, e a que estava aqui foi desmontada de propósito.
    if (typeof Dashboard !== 'undefined' && Dashboard._montarBanner && window.__dashDados) {
      Dashboard._montarBanner(window.__dashDados);
    }

    SoloDialog?.toast?.('Banner real do Dashboard restaurado!', 'info');
    if (this._el) this._render();
  },

  _pintar() {
    const u = { ...this._hunter(), ...(this._perfil || {}) };
    // UMA cadeia de versões no arquivo inteiro. Eram duas, e a
    // segunda esqueceu a V4 — o tipo de divergência que só aparece
    // quando alguém reclama que testou uma coisa e viu outra.
    const htmlBanner = this._htmlDaVersao(u, this._opcoes.versao);

    const palco = this._el?.querySelector('.est-palco');
    if (palco) {
      palco.innerHTML = htmlBanner;
      window.BadgeCard?.ligarTodos('.est-palco [data-bc]', this._acervo);
    }

    if (this._emTesteDash) {
      const wrap = document.getElementById('est-teste-banner-wrap');
      if (wrap) {
        wrap.innerHTML = htmlBanner;
        const vNome = this._nomeDaVersao(this._opcoes.versao);
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
            ${BannersArte.botaoAura()}
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
              ${BannersArte.botaoAura()}
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
              ${BannersArte.botaoAura()}
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
  _orbitaHex() { return BannersArte.orbitaHex(); },

  _seloHex(letra, cor) { return BannersArte.seloHex(letra, cor); },

  _barraXP(pct, campo) { return BannersArte.barraXP(pct, campo); },

  _circuito() { return BannersArte.circuito(); },

  _gema(pedra, valor, rotulo, opts) { return BannersArte.gema(pedra, valor, rotulo, opts); },

  _medalhaRank(letra, tam) { return BannersArte.medalhaRank(letra, tam); },

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

  _trilho() { return BannersArte.trilho(); },

  _brasao() { return BannersArte.brasao(); },

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
        ${BannersArte.botaoAura()}
      </div>`;
  },

  _fita(xp, alvo, pct) { return BannersArte.fita(xp, alvo, pct); },

  _medalha(tipo, valor, rotulo) { return BannersArte.medalha(tipo, valor, rotulo); },

  _bainha() { return BannersArte.bainha(); },

  _esc(v) { return BannersArte.esc(v); },

};

window.Estandarte = Estandarte;
