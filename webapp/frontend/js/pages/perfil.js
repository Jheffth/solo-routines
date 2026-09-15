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

      /* A AGENDA se monta sozinha e em silêncio: ela decide se aparece
         (só aparece se o servidor puder cumprir) e não pode derrubar o
         perfil se o endpoint dela falhar — é uma integração opcional
         pendurada numa tela que tem de abrir de qualquer jeito. */
      if (typeof Agenda !== 'undefined') Agenda.montar().catch(() => {});

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
  /* ══════════════════════════════════════════════════════════
     OS GLIFOS DO PERFIL

     Esta página era o último canto do app escrito em emoji. Dois
     defeitos que o glifo não tem: quem desenha o emoji é o SISTEMA
     OPERACIONAL — o mesmo caractere é uma coisa no Windows e outra no
     Mac, e nenhuma delas foi desenhada para este app — e ele não
     herda a cor do texto, então fica sempre com a paleta de outra
     pessoa dentro da nossa.

     `_g` degrada para vazio se o alfabeto não estiver carregado: um
     ícone ausente é um detalhe, um `undefined` no meio do HTML é uma
     tela quebrada. */
  _g(nome, tam = 16) {
    try {
      return (typeof Glifos !== 'undefined' && Glifos.linha)
        ? Glifos.linha(nome, tam) : '';
    } catch (_) { return ''; }
  },

  /* As rubricas das seções vivem como `data-` no HTML e são montadas
     aqui — assim o índice fica legível e o desenho, num lugar só. */
  _montarRubricas() {
    document.querySelectorAll('#page-perfil .pf-rubrica').forEach(el => {
      if (el.dataset.pronta) return;
      const nota = el.dataset.nota
        ? `<span class="pf-rubrica-nota">${el.dataset.nota}</span>` : '';
      el.innerHTML = `
        <span class="pf-rubrica-glifo">${this._g(el.dataset.glifo, 17)}</span>
        <h3 class="pf-rubrica-titulo">${el.dataset.titulo || ''}</h3>
        ${nota}
        <span class="pf-rubrica-fio"></span>`;
      el.dataset.pronta = '1';
    });

    const vitrine = document.getElementById('btn-ver-vitrine');
    if (vitrine && vitrine.dataset.glifoBt && !vitrine.dataset.pronta) {
      vitrine.innerHTML = this._g(vitrine.dataset.glifoBt, 15)
                        + '<span>' + vitrine.textContent.trim() + '</span>';
      vitrine.dataset.pronta = '1';
    }
  },

  renderFormEdicao(dados) {
    const cont = document.getElementById('perfil-form-edicao');
    if (!cont) return;

    this._montarRubricas();
    const isArquiteto = dados.nivel_acesso === 'Arquiteto';

    cont.innerHTML = `
      <div class="pf-ficha">
        <div class="pf-rubrica pf-rubrica--ficha" data-pronta="1">
          <span class="pf-rubrica-glifo">${this._g('editar', 17)}</span>
          <h3 class="pf-rubrica-titulo">Identidade</h3>
          <span class="pf-rubrica-nota">como o Sistema te chama</span>
          <span class="pf-rubrica-fio"></span>
        </div>

        <div class="pf-grade">
          <div class="pf-campo">
            <label class="pf-rot" for="pf-edit-nome">Nome de exibição</label>
            <input type="text" id="pf-edit-nome" class="pf-input"
              value="${dados.nome || ''}" placeholder="Seu nome">
          </div>

          <div class="pf-campo">
            <label class="pf-rot" for="pf-edit-titulo">Título</label>
            <input type="text" id="pf-edit-titulo" class="pf-input"
              value="${dados.titulo || ''}" placeholder="O Arquiteto do Sistema">
          </div>

          <div class="pf-campo">
            <label class="pf-rot" for="pf-edit-classe">Classe / Rank</label>
            <input type="text" id="pf-edit-classe" class="pf-input"
              value="${dados.classe || ''}" placeholder="National Level">
          </div>

          <div class="pf-campo">
            <span class="pf-rot">Retrato</span>
            <div class="pf-foto-acoes">
              <button type="button" class="pf-bt" onclick="Perfil.escolherFoto()">
                ${this._g('camera', 15)}<span>Escolher arquivo</span>
              </button>
              ${dados.avatar_url ? `
              <button type="button" class="pf-bt pf-bt--perigo" onclick="Perfil.removerFoto()">
                ${this._g('excluir', 15)}<span>Remover</span>
              </button>` : ''}
            </div>
            <p class="pf-dica">
              PNG, JPG, GIF ou WEBP · até 5 MB · ou clique direto no retrato acima
            </p>
          </div>
        </div>

        ${isArquiteto ? `
        <!-- OS PODERES FICAM SEPARADOS, e não misturados com o nome.
             Editar "Nome de exibição" é cosmético; reescrever o XP total
             é mexer na economia do Sistema. Eram oito campos na mesma
             grade, com a mesma cara — e a única diferença era um
             "(Arquiteto)" em letra miúda na etiqueta. Agora a fronteira
             é visível antes de o cursor chegar no campo. -->
        <div class="pf-poderes">
          <div class="pf-rubrica pf-rubrica--poderes" data-pronta="1">
            <span class="pf-rubrica-glifo">${this._g('caveira', 17)}</span>
            <h3 class="pf-rubrica-titulo">Poderes do Arquiteto</h3>
            <span class="pf-rubrica-nota">escrevem direto na economia</span>
            <span class="pf-rubrica-fio"></span>
          </div>

          <div class="pf-grade">
            <div class="pf-campo pf-campo--nivel">
              <label class="pf-rot" for="pf-edit-nivel">
                ${this._g('xp', 13)}<span>Nível</span>
              </label>
              <input type="number" id="pf-edit-nivel" class="pf-input"
                value="${dados.nivel_atual || 1}" min="1" max="9999">
            </div>

            <div class="pf-campo pf-campo--mana">
              <label class="pf-rot" for="pf-edit-moedas">
                ${this._g('moeda', 13)}<span>Mana Coins</span>
              </label>
              <input type="number" id="pf-edit-moedas" class="pf-input"
                value="${dados.moedas || 0}" min="0">
            </div>

            <div class="pf-campo pf-campo--xp">
              <label class="pf-rot" for="pf-edit-xp">
                ${this._g('combate', 13)}<span>XP total</span>
              </label>
              <input type="number" id="pf-edit-xp" class="pf-input"
                value="${dados.xp_total || 0}" min="0">
            </div>
          </div>

          <div class="pf-poderes-acoes">
            <button type="button" class="pf-bt pf-bt--perigo" onclick="Perfil.nerfarArquiteto()">
              ${this._g('menos', 15)}<span>Nerfar</span>
            </button>
            <button type="button" class="pf-bt pf-bt--ouro" onclick="Perfil.buffarArquiteto()">
              ${this._g('mais', 15)}<span>Buffar</span>
            </button>
          </div>
        </div>` : ''}

        <div class="pf-rodape">
          <button type="button" class="pf-bt" onclick="Perfil.carregar()">
            ${this._g('cancelada', 15)}<span>Descartar</span>
          </button>
          <button type="button" class="pf-bt pf-bt--on" id="pf-btn-salvar"
            onclick="Perfil.salvarEdicao()">
            ${this._g('salvar', 15)}<span>Salvar alterações</span>
          </button>
        </div>
      </div>
    `;
  },

  // ── Salvar edição ───────────────────────────────────────
  async salvarEdicao() {
    /* O RÓTULO MORA NUM `<span>`, e trocar só ele é proposital: o botão
       carrega um SVG ao lado, e `btn.textContent = '...'` apagaria o
       glifo junto. Ele não voltaria — o botão só é redesenhado no
       `carregar()` seguinte, e um salvamento que falha não recarrega
       nada. Ficaria um botão pelado até o F5. */
    const btn = document.getElementById('pf-btn-salvar');
    const rot = btn?.querySelector('span');
    if (btn) { btn.disabled = true; if (rot) rot.textContent = 'Salvando...'; }

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

        // Feedback visual — só o rótulo e uma classe. Reescrever o
        // `innerHTML` aqui era o que apagava o glifo e o trazia de volta
        // como emoji, desfazendo a modernização a cada salvamento.
        if (btn) {
          btn.disabled = false;
          btn.classList.add('salvou');
          if (rot) rot.textContent = 'Salvo';
        }
        setTimeout(() => {
          if (btn) {
            btn.classList.remove('salvou');
            if (rot) rot.textContent = 'Salvar alterações';
          }
        }, 2000);
      }
    } catch (err) {
      if (btn) { btn.disabled = false; if (rot) rot.textContent = 'Salvar alterações'; }
      SoloDialog.toast('Erro ao salvar: ' + (err.message || err), 'error');
    }
  },

  // ── Funções Exclusivas do Arquiteto ──────────────────────
  async nerfarArquiteto() {
    const ok = typeof SoloDialog !== 'undefined' && SoloDialog.confirm
      ? await SoloDialog.confirm("Tem certeza que deseja NERFAR o Arquiteto para o Nível 1 e Rank E?", {
          titulo: "CUIDADO: Nerf de Arquiteto",
          textoConfirmar: "Sim, Nerfar",
          corBotao: "#ef4444"
        })
      : confirm("Tem certeza que deseja NERFAR o Arquiteto para o Nível 1 e Rank E?");
    if (!ok) return;

    try {
      const resp = await API.post('/perfil/nerf_arquiteto', {});
      SoloDialog.toast(resp.detalhe || 'Arquiteto nerfado com sucesso.', 'success');
      await this.carregar();
    } catch (err) {
      SoloDialog.toast('Erro: ' + (err.message || err), 'error');
    }
  },

  async buffarArquiteto() {
    const ok = typeof SoloDialog !== 'undefined' && SoloDialog.confirm
      ? await SoloDialog.confirm("Tem certeza que deseja BUFFAR o Arquiteto de volta ao Topo?", {
          titulo: "Restaurar Poderes",
          textoConfirmar: "Sim, Buffar",
          corBotao: "#f59e0b"
        })
      : confirm("Tem certeza que deseja BUFFAR o Arquiteto de volta ao Topo?");
    if (!ok) return;

    try {
      const resp = await API.post('/perfil/buff_arquiteto', {});
      SoloDialog.toast(resp.detalhe || 'Poderes do Arquiteto restaurados.', 'success');
      await this.carregar();
    } catch (err) {
      SoloDialog.toast('Erro: ' + (err.message || err), 'error');
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
        <div class="${classes}" style="${style}" data-id="${c.codigo || c.id}" title="${c.desbloqueada ? 'Conquistada' : 'Bloqueada'} — ${rar.nome}">
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