/* ============================================================
   perfil.js — Solo Routines
   Página de perfil: hero card + formulário de edição + gráficos
   ============================================================ */

/* ConquistasAnim (legado): agora delega para a Cerimônia de Conquista
   oficial (ConquistaFX, em animations.js) — um único visual no app inteiro. */
window.ConquistasAnim = {
  async showUnlockModal(c) {
    if (typeof ConquistaFX !== 'undefined') ConquistaFX.show(c);
    return Promise.resolve();
  }
};

const Perfil = {
  _dadosCarregados: false,
  _dadosUsuario: null,

  async carregar() {
    try {
      const dados = await API.get('/perfil/');
      if (!dados) return;

      this._dadosUsuario = dados.usuario || null;

      if (dados.usuario)           this.renderHeroCard(dados.usuario);
      if (dados.usuario)           this.renderFormEdicao(dados.usuario);
      if (dados.radar_habilidades) this.renderRadar(dados.radar_habilidades);
      if (dados.xp_mensal)         this.renderXPMensal(dados.xp_mensal);
      if (dados.heatmap)           this.renderHeatmap(dados.heatmap);
      if (dados.conquistas)        this.renderConquistas(dados.conquistas);

      this._dadosCarregados = true;
    } catch (err) {
      console.error('[Perfil] Erro ao carregar:', err);
    }
  },

  /* ══════════════════════════════════════════════════════════
     O CARTÃO DO HUNTER SAIU DAQUI

     Havia um `renderHeroCard` de 105 linhas desenhando um SEGUNDO
     cartão do hunter — o terceiro do app, contando o da vitrine
     pública. E ele tinha DIVERGIDO do original:

       nome em MAIÚSCULAS       (no Dashboard, normal)
       titulo sempre "Hunter"   (no Dashboard, o do rank)
       sem relicário
       sem epígrafe
       e ignorando a aura equipada — chamava `Auras.porCargo` direto,
       sem olhar `aura_id`. Quem recebia uma aura de presente NÃO a
       via na própria ficha. Este arquivo não tinha uma única
       ocorrência de `aura_id`.

     Nada disso foi decidido: foi divergindo. Duas cópias da mesma
     coisa nunca ficam iguais por muito tempo.

     Agora o Perfil monta A MESMA PEÇA que o Dashboard, com a mesma
     escolha do hunter. A câmera de trocar foto aparece porque ESTE
     hospedeiro oferece a ação `trocar-foto` — o Dashboard não
     oferece, e por isso lá o retrato não é clicável.
     ══════════════════════════════════════════════════════════ */
  _slot() { return document.getElementById('perfil-hunter-card'); },

  renderHeroCard(dados) {
    const slot = this._slot();
    if (!slot || typeof Pecas === 'undefined') return;

    this._dadosUsuario = dados || this._dadosUsuario;
    const pacote = { hunter: dados || {} };

    const escolhida = Pecas.escolhida('banner', slot.dataset.pecaPadrao);

    /* REPINTAR SÓ SE FOR A MESMA PEÇA. Antes bastava haver algo
       montado para cair na repintura — e aí trocar a preferência num
       lugar não chegava no outro: o slot continuava com a peça velha
       até alguém recarregar a página. */
    if (slot.__peca && slot.dataset.peca === escolhida) {
      Object.assign(pacote, {
        reliquias:         slot.__peca.dados?.reliquias || [],
        reliquias_fixadas: slot.__peca.dados?.reliquias_fixadas || [],
      });
      Pecas.atualizar(slot, pacote);
    } else {
      Pecas.montar(slot, escolhida, pacote, {
        opcoes: Pecas.opcoesDe('banner'),
        acoes:  this._acoesBanner(),
      });
    }

    this._carregarReliquias().then(r => {
      if (!slot.__peca) return;
      Pecas.atualizar(slot, Object.assign({ hunter: this._dadosUsuario || dados }, r));
    });
  },

  /* O que a peça pode pedir AQUI. A lista é diferente da do
     Dashboard de propósito: é ela que decide o que a peça mostra.
     `trocar-foto` só existe nesta tela. */
  _acoesBanner() {
    return {
      'trocar-foto':     () => this.escolherFoto(),
      'trocar-aura':     () => window.Dashboard?._abrirModalAura?.(this._dadosUsuario || {}),
      'editar-altar':    () => window.AltarReliquias?.abrir(() => this.renderHeroCard(this._dadosUsuario)),
      'editar-epigrafe': () => window.Dashboard?._editarEpigrafe?.(),
      'ver-reliquias':   () => {},
    };
  },

  /* O hospedeiro busca, a peça desenha. Mesma divisão do Dashboard —
     e por isso a mesma peça serve aos dois sem saber onde está. */
  async _carregarReliquias() {
    try {
      const [lista, altar] = await Promise.all([
        API.conquistas.listar(),
        API.perfil.reliquias().catch(() => ({ fixadas: [] })),
      ]);
      const todas = (lista || []).filter(c => c.desbloqueada).sort((a, b) => {
        if (a.desbloqueada_em && b.desbloqueada_em) return new Date(b.desbloqueada_em) - new Date(a.desbloqueada_em);
        return 0;
      });
      return { reliquias: todas, reliquias_fixadas: altar.fixadas || [] };
    } catch (_) { return { reliquias: [], reliquias_fixadas: [] }; }
  },

  // ── Upload de foto local ────────────────────────────────
  escolherFoto() {
    let input = document.getElementById('pf-avatar-file');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'pf-avatar-file';
      input.accept = 'image/png,image/jpeg,image/gif,image/webp';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', () => this._enviarFoto(input));
    }
    input.value = '';
    input.click();
  },

  async _enviarFoto(input) {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    if (arquivo.size > 5 * 1024 * 1024) {
      SoloDialog.toast('Imagem muito grande — máximo 5 MB.', 'error');
      return;
    }
    try {
      SoloDialog.toast('⏳ Enviando foto...', 'info', 1500);
      const form = new FormData();
      form.append('arquivo', arquivo);
      const resp = await API.perfil.uploadAvatar(form);
      SoloDialog.toast('📷 Foto de perfil atualizada!', 'success');
      /* A BARRA LATERAL é o único lugar que ainda se pinta à mão, e
         só para dar resposta imediata: ela não é peça de ninguém.

         Antes esta linha varria também `#dash-avatar` e
         `#perfil-avatar-click` — dois ids que sumiram quando os
         cartões viraram peça. Não davam erro (o `forEach` de uma
         lista vazia não faz nada), o que é justamente o problema:
         teriam ficado ali para sempre, sem ninguém notar.

         O `?t=` quebra o cache do navegador: sem ele, a foto nova
         chega no mesmo endereço da antiga e nada muda na tela. */
      const url = resp.avatar_url + '?t=' + Date.now();
      const sb = document.getElementById('sidebar-avatar');
      if (sb) sb.innerHTML =
        `<img src="${url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;

      if (this._dadosUsuario) this._dadosUsuario.avatar_url = url;
      // A peça se repinta com o perfil recarregado.
      await this.carregar();
    } catch (err) {
      SoloDialog.toast('Erro no upload: ' + (err.message || err), 'error');
    }
  },

  async removerFoto() {
    try {
      await API.delete('/perfil/avatar');
      SoloDialog.toast('Foto removida.', 'info');
      await this.carregar();
    } catch (err) {
      SoloDialog.toast('Erro: ' + (err.message || err), 'error');
    }
  },

  // ── Formulário de edição ────────────────────────────────
  renderFormEdicao(dados) {
    const cont = document.getElementById('perfil-form-edicao');
    if (!cont) return;

    const isArquiteto = dados.nivel_acesso === 'Arquiteto';

    cont.innerHTML = `
      <div style="
        background:var(--bg-card);border:1px solid rgba(124,58,237,.2);
        border-radius:1rem;padding:1.5rem 2rem;margin-top:1.5rem
      ">
        <div style="font-family:var(--font-section);font-size:.8rem;font-weight:700;
          letter-spacing:.12em;text-transform:uppercase;color:var(--purple-glow);
          margin-bottom:1.2rem;display:flex;align-items:center;gap:.5rem">
          &#9998; Editar Informações
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem">

          <!-- Nome -->
          <div class="form-group">
            <label class="form-label">Nome de exibição</label>
            <input type="text" id="pf-edit-nome" class="form-input"
              value="${dados.nome || ''}" placeholder="Seu nome">
          </div>

          <!-- Título -->
          <div class="form-group">
            <label class="form-label">Título</label>
            <input type="text" id="pf-edit-titulo" class="form-input"
              value="${dados.titulo || ''}" placeholder="Ex: O Arquiteto do Sistema">
          </div>

          <!-- Classe -->
          <div class="form-group">
            <label class="form-label">Classe / Rank</label>
            <input type="text" id="pf-edit-classe" class="form-input"
              value="${dados.classe || ''}" placeholder="Ex: National Level">
          </div>

          <!-- Foto de Perfil (arquivo local) -->
          <div class="form-group">
            <label class="form-label">Foto de Perfil</label>
            <div style="display:flex;gap:.5rem;align-items:center">
              <button type="button" class="btn btn-sm" onclick="Perfil.escolherFoto()" style="
                font-family:var(--font-section);font-size:.75rem;padding:.5rem .9rem;border-radius:.5rem;
                border:1px solid rgba(124,58,237,.4);background:rgba(124,58,237,.12);
                color:var(--purple-glow);cursor:pointer">
                📷 Escolher do dispositivo
              </button>
              ${dados.avatar_url ? `
              <button type="button" class="btn btn-sm" onclick="Perfil.removerFoto()" style="
                font-family:var(--font-section);font-size:.75rem;padding:.5rem .9rem;border-radius:.5rem;
                border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.07);
                color:#f87171;cursor:pointer">
                ✕ Remover
              </button>` : ''}
            </div>
            <div style="font-size:.65rem;color:var(--text-muted);margin-top:.35rem">
              PNG, JPG, GIF ou WEBP · máx. 5 MB · ou clique direto na foto lá em cima
            </div>
          </div>

          ${isArquiteto ? `
          <!-- Nível (Arquiteto) -->
          <div class="form-group">
            <label class="form-label" style="color:var(--purple-glow)">
              &#9889; Nível <span style="font-size:.65rem;color:var(--text-muted)">(Arquiteto)</span>
            </label>
            <input type="number" id="pf-edit-nivel" class="form-input"
              value="${dados.nivel_atual || 1}" min="1" max="9999"
              style="border-color:rgba(168,85,247,.4)">
          </div>

          <!-- Mana Coins (Arquiteto) -->
          <div class="form-group">
            <label class="form-label" style="color:var(--gold-xp)">
              &#128176; Mana Coins <span style="font-size:.65rem;color:var(--text-muted)">(Arquiteto)</span>
            </label>
            <input type="number" id="pf-edit-moedas" class="form-input"
              value="${dados.moedas || 0}" min="0"
              style="border-color:rgba(245,158,11,.4)">
          </div>

          <!-- XP Total (Arquiteto) -->
          <div class="form-group">
            <label class="form-label" style="color:var(--cyan-skill)">
              &#11088; XP Total <span style="font-size:.65rem;color:var(--text-muted)">(Arquiteto)</span>
            </label>
            <input type="number" id="pf-edit-xp" class="form-input"
              value="${dados.xp_total || 0}" min="0"
              style="border-color:rgba(6,182,212,.4)">
          </div>
          ` : ''}

        </div>

        <!-- Botões -->
        <div style="display:flex;gap:.75rem;margin-top:1.5rem;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" onclick="Perfil.carregar()" style="font-family:var(--font-section)">
            &#8635; Cancelar
          </button>
          <button class="btn btn-primary btn-sm" id="pf-btn-salvar"
            onclick="Perfil.salvarEdicao()" style="font-family:var(--font-section)">
            &#128190; Salvar Alterações
          </button>
        </div>
      </div>
    `;
  },

  // ── Salvar edição ───────────────────────────────────────
  async salvarEdicao() {
    const btn = document.getElementById('pf-btn-salvar');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    const dados = this._dadosUsuario;
    const isArquiteto = dados?.nivel_acesso === 'Arquiteto';

    try {
      const payload = {
        nome:       document.getElementById('pf-edit-nome')?.value?.trim()   || undefined,
        titulo:     document.getElementById('pf-edit-titulo')?.value?.trim()  || undefined,
        classe:     document.getElementById('pf-edit-classe')?.value?.trim()  || undefined,
        // avatar agora é via upload local (Perfil.escolherFoto), não por URL
      };

      let endpoint = '/perfil/';

      if (isArquiteto) {
        endpoint = '/perfil/arquiteto';
        const nivel  = document.getElementById('pf-edit-nivel')?.value;
        const moedas = document.getElementById('pf-edit-moedas')?.value;
        const xp     = document.getElementById('pf-edit-xp')?.value;
        if (nivel  !== undefined) payload.nivel_atual = parseInt(nivel);
        if (moedas !== undefined) payload.moedas      = parseInt(moedas);
        if (xp     !== undefined) payload.xp_total    = parseInt(xp);
      }

      const resp = await API.put(endpoint, payload);

      if (resp && resp.ok !== false) {
        // Atualiza dados locais
        if (payload.nome)       this._dadosUsuario.nome       = payload.nome;
        if (payload.titulo)     this._dadosUsuario.titulo     = payload.titulo;
        if (payload.classe)     this._dadosUsuario.classe     = payload.classe;
        if (payload.avatar_url !== undefined) this._dadosUsuario.avatar_url = payload.avatar_url;
        if (isArquiteto) {
          if (payload.nivel_atual !== undefined) this._dadosUsuario.nivel_atual = payload.nivel_atual;
          if (payload.moedas      !== undefined) this._dadosUsuario.moedas      = payload.moedas;
          if (payload.xp_total    !== undefined) { this._dadosUsuario.xp_total = payload.xp_total; this._dadosUsuario.xp_atual = payload.xp_total; }
        }

        // Re-renderiza o hero card
        this.renderHeroCard(this._dadosUsuario);

        // Atualiza sidebar
        const sbNome = document.getElementById('sidebar-nome');
        if (sbNome && payload.nome) sbNome.textContent = payload.nome;

        // Feedback visual
        if (btn) { btn.disabled = false; btn.innerHTML = '&#10003; Salvo!'; btn.style.background = '#10b981'; }
        setTimeout(() => {
          if (btn) { btn.innerHTML = '&#128190; Salvar Alterações'; btn.style.background = ''; btn.disabled = false; }
        }, 2000);
      }
    } catch (err) {
      SoloDialog.toast('Erro ao salvar: ' + (err.message || err), 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '&#128190; Salvar Alterações'; }
    }
  },

  // Salvar campo único (usado pelo avatar click)
  async _salvarCampo(payload, dados) {
    const endpoint = dados.nivel_acesso === 'Arquiteto' ? '/perfil/arquiteto' : '/perfil/';
    try {
      await API.put(endpoint, payload);
      // Atualiza e re-renderiza
      Object.assign(this._dadosUsuario, payload);
      this.renderHeroCard(this._dadosUsuario);
      this.renderFormEdicao(this._dadosUsuario);
    } catch (err) { SoloDialog.toast('Erro: ' + err.message, 'error'); }
  },

  // ── Gráfico Radar ───────────────────────────────────────
  renderRadar(dados) {
    let arr = [];
    if (Array.isArray(dados)) {
      arr = dados;
    } else if (dados && typeof dados === 'object') {
      arr = Object.entries(dados).map(([categoria, xp]) => ({ categoria, xp: xp || 0 }));
    }
    if (!arr.length) {
      arr = [
        { categoria: 'Saúde',    xp: 0 },
        { categoria: 'Trabalho', xp: 0 },
        { categoria: 'Estudo',   xp: 0 },
        { categoria: 'Casa',     xp: 0 },
        { categoria: 'Pessoal',  xp: 0 },
        { categoria: 'Combate',  xp: 0 },
      ];
    }
    Charts.criarGraficoRadar('chart-radar', arr);
  },

  // ── Gráfico XP Mensal ───────────────────────────────────
  renderXPMensal(dados) {
    if (!dados || !dados.length) {
      const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      dados = meses.map(m => ({ mes: m, xp: 0 }));
    }
    Charts.criarGraficoXPMensal('chart-xp-mensal', dados);
  },

  // ── Heatmap anual ───────────────────────────────────────
  renderHeatmap(dados) {
    Charts.criarHeatmap('heatmap-container', dados || {});
  },

  // ── Conquistas ──────────────────────────────────────────
  async renderConquistas(lista) {
    const cont = document.getElementById('perfil-conquistas');
    if (!cont) return;

    if (!lista || !lista.length) {
      cont.innerHTML = `
        <div style="text-align:center;padding:2rem;opacity:.5">
          <div style="font-size:2.5rem;margin-bottom:.5rem">⬡</div>
          <div style="font-family:var(--font-section);color:var(--text-muted);font-size:.85rem">Nenhuma conquista ainda — complete missões para desbloquear</div>
        </div>`;
      return;
    }

    const now = new Date();
    const recent = lista.filter(c => c.desbloqueada && c.desbloqueada_em && (now - new Date(c.desbloqueada_em)) < 60000);

    // Ordena: desbloqueadas primeiro, depois por raridade (XP) decrescente
    const ordenada = [...lista].sort((a, b) => {
      if (a.desbloqueada !== b.desbloqueada) return a.desbloqueada ? -1 : 1;
      return (b.xp_bonus || 0) - (a.xp_bonus || 0);
    });

    let delay = 0;
    cont.innerHTML = ordenada.map((c, i) => {
      const isNew = recent.includes(c) && !localStorage.getItem('cq_seen_' + c.id);
      const rar   = this._raridade(c.xp_bonus || 0);

      let classes = `reliquia-card rar-${rar.k}`;
      let style = '';
      if (c.desbloqueada) {
        classes += ' desbloqueada c-pulsing';
        style += `--c-pulse-delay:${Math.random() * 2}s;`;
      } else {
        classes += ' bloqueada';
      }
      if (c.exclusiva_arquiteto) classes += ' comemorativa';

      if (isNew) { classes += ' c-materializing'; style += `--c-delay:${delay}ms;`; delay += 150; }
      else       { classes += ' c-entering';      style += `--c-delay:${i * 45}ms;`; }

      // Medalha: insígnia própria (se houver) → SVG da cerimônia → emoji
      const medalha = this._medalhaDe(c, 64);

      return `
        <div class="${classes}" style="${style}" title="${c.desbloqueada ? 'Conquistada' : 'Bloqueada'} — ${rar.nome}">
          <div class="reliquia-brilho"></div>
          ${c.exclusiva_arquiteto ? '<div class="reliquia-selo-arq">⟁</div>' : ''}
          <div class="reliquia-medalha">${medalha}</div>
          <div class="reliquia-nome">${c.titulo || c.nome || 'Conquista'}</div>
          <div class="reliquia-desc">${c.descricao || ''}</div>
          <div class="reliquia-rodape">
            <span class="reliquia-rar">${rar.nome}</span>
            ${c.xp_bonus ? `<span class="reliquia-xp">+${c.xp_bonus.toLocaleString('pt-BR')} XP</span>` : ''}
          </div>
          ${c.desbloqueada && c.desbloqueada_em
            ? `<div class="reliquia-data">⟢ ${this._fmtDateDisplay(c.desbloqueada_em)}</div>`
            : (c.desbloqueada ? '' : '<div class="reliquia-cadeado">🔒</div>')}
        </div>`;
    }).join('');

    for (const c of recent) {
      if (!localStorage.getItem('cq_seen_' + c.id)) {
        await ConquistasAnim.showUnlockModal(c);
        localStorage.setItem('cq_seen_' + c.id, '1');
      }
    }
  },

  /* Insígnias com arte própria (desenhadas no arquiteto-console.js).
     Cada entrada aponta para a função que gera o SVG da medalha. */
  _medalhaCustom(codigo, tam) {
    const mapa = {
      jh3ffth:       () => window.Jh3ffthFX?._svgMedalhaArquiteto?.(tam),
      solo:          () => window.SoloFX?._svgMedalhaSolo?.(tam),
      dominio_forja: () => window.ForjaFX?._svgMedalhaForja?.(tam),
      diana:         () => window.DianaFX?._svgMedalhaDiana?.(tam),
      fenix_pioneira: () => window.FenixFX?._svgMedalhaFenix?.(tam),
    };
    try { return (mapa[codigo] && mapa[codigo]()) || null; }
    catch (_) { return null; }
  },

  _medalhaDe(c, tam = 64) {
    const custom = this._medalhaCustom(c.codigo, tam);
    if (custom) {
      return `<span class="cq-medalhinha" style="width:${tam}px;height:${tam}px">${custom}</span>`;
    }
    return (typeof ConquistaFX !== 'undefined' && ConquistaFX.miniMedalha)
      ? ConquistaFX.miniMedalha(c, tam)
      : `<div style="font-size:2rem">${c.icone || '🏆'}</div>`;
  },

  // Raridade por faixa de XP — dita moldura, brilho e rótulo
  _raridade(xp) {
    if (xp >= 2000) return { k: 'lendaria', nome: 'Lendária' };
    if (xp >= 500)  return { k: 'epica',    nome: 'Épica'    };
    if (xp >= 200)  return { k: 'rara',     nome: 'Rara'     };
    return              { k: 'comum',    nome: 'Comum'    };
  },

  _getTituloByRank(rank) {
    const t = { 'E':'O Mais Fraco','D':'Iniciante','C':'Promissor','B':'Experiente','A':'Elite','S':'Monarch' };
    return t[rank] || 'Hunter';
  },

  _fmtDateDisplay(str) {
    if (!str) return '';
    const parts = str.split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
};