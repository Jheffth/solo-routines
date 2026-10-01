/* Habilidades: o legado permanente da disciplina. Dados sempre vêm do servidor. */
const Habilidades = {
  _cores: { LENDARIO: '#fbbf24', DIFICIL: '#a855f7', NORMAL: '#22d3ee', FACIL: '#34d399' },
  _rotulos: { LENDARIO: 'Lendária', DIFICIL: 'Difícil', NORMAL: 'Normal', FACIL: 'Fácil',
    CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' },
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  glifo() {
    return '<svg class="hab-glifo" viewBox="0 0 80 80" fill="none" aria-hidden="true"><path class="hab-orbita" d="M40 4 71 22v36L40 76 9 58V22Z" stroke="currentColor" stroke-width="1"/><path d="m40 12 24 14v28L40 68 16 54V26Z" stroke="currentColor" opacity=".35"/><path d="m40 20 7 13 14 7-14 7-7 13-7-13-14-7 14-7Z" fill="currentColor" fill-opacity=".13" stroke="currentColor" stroke-width="1.5"/><path d="m30 40 7 7 14-15" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="40" cy="4" r="2.5" fill="currentColor"/><circle cx="40" cy="76" r="2.5" fill="currentColor"/></svg>';
  },
  data(v) { return v ? new Date(v.length === 10 ? v + 'T12:00:00' : v).toLocaleDateString('pt-BR') : '—'; },
  cor(d) { return this._cores[d] || this._cores.NORMAL; },
  card(h) {
    const e = h.evidencia;
    return `<article class="hab-card hab-adquirida" style="--hab-cor:${this.cor(e.dificuldade)}">
      <div class="hab-card-top">${this.glifo()}<span class="hab-etiqueta">Habilidade permanente</span></div>
      <h3>${this.esc(h.nome)}</h3><p>${this.esc(e.categoria)} · ${this.esc(this._rotulos[e.dificuldade] || e.dificuldade)}</p>
      <div class="hab-feito"><strong>${e.sequencia}</strong><span>execuções perfeitas<br>sem quebrar a sequência</span></div>
      <p class="hab-origem">Origem: ${this.esc(e.titulo)}</p>
      <button class="btn btn-secondary btn-sm" data-hab-detalhe="${h.id}">Ver trajetória</button>
    </article>`;
  },
  progresso(p, compacto = false) {
    const pc = Math.min(100, Math.round(p.sequencia / p.meta * 100));
    return `<article class="hab-progresso ${p.elegivel ? 'hab-pronta' : ''}" style="--hab-cor:${this.cor(p.dificuldade)}">
      <div class="hab-linha"><span class="hab-etiqueta">${p.elegivel ? 'Maestria alcançada' : 'Em evolução'}</span><b>${p.sequencia} / ${p.meta}</b></div>
      ${compacto ? '' : `<h3>${this.esc(p.titulo)}</h3><p>${this.esc(this._rotulos[p.dificuldade])} · Prioridade ${this.esc(this._rotulos[p.prioridade])}</p>`}
      <progress max="${p.meta}" value="${Math.min(p.sequencia, p.meta)}" aria-label="Execuções perfeitas de ${this.esc(p.titulo)}">${pc}%</progress>
      ${p.elegivel ? `<button class="btn btn-primary" data-hab-converter="${p.rotina_id}">Virar habilidade</button>` : `<small>Faltam ${Math.max(0, p.meta - p.sequencia)} execuções perfeitas consecutivas.</small>`}
    </article>`;
  },
  bind(host, dados) {
    host.querySelectorAll('[data-hab-converter]').forEach(btn => btn.addEventListener('click', () => {
      const p = dados.progressos.find(p => p.rotina_id === Number(btn.dataset.habConverter));
      if (p) this.converter(p);
    }));
    host.querySelectorAll('[data-hab-detalhe]').forEach(btn => btn.addEventListener('click', () => {
      const h = dados.habilidades.find(h => h.id === Number(btn.dataset.habDetalhe));
      if (h) this.detalhes(h);
    }));
    host.querySelector('[data-hab-abrir]')?.addEventListener('click', () => App.navigate('habilidades'));
  },
  async carregar() {
    const host = document.getElementById('habilidades-conteudo');
    if (!host) return;
    host.innerHTML = '<p role="status">Consultando sua trajetória…</p>';
    try {
      const dados = await API.get('/habilidades/');
      host.innerHTML = `<div class="hab-resumo"><strong>${dados.habilidades.length}</strong><span>habilidades adquiridas</span><strong>${dados.progressos.filter(p => p.elegivel).length}</strong><span>prontas para despertar</span></div>
        <h2 class="hab-secao">Seu legado</h2><div class="hab-grid">${dados.habilidades.map(h => this.card(h)).join('') || '<div class="hab-vazio">Sua disciplina está construindo a primeira habilidade. Acompanhe as sequências abaixo.</div>'}</div>
        <h2 class="hab-secao">Caminho da maestria</h2><p class="hab-explicacao">Só contam conclusões perfeitas. Confissões, falhas e missões reerguidas interrompem a sequência. Dias fora da programação não a interrompem.</p>
        <details class="hab-regras"><summary>Como a meta é calculada</summary><p>Lendária + Crítica: 90 execuções. Cada degrau abaixo na dificuldade ou prioridade acrescenta 30, até 270 em Fácil + Baixa. O histórico anterior usa a configuração atual da rotina; cada dia conta uma vez.</p></details>
        <div class="hab-grid">${dados.progressos.map(p => this.progresso(p)).join('') || '<p>Nenhuma rotina ativa. Crie uma rotina para começar sua trajetória.</p>'}</div>`;
      this.bind(host, dados);
    } catch (err) { this.erro(host, err, () => this.carregar()); }
  },
  erro(host, err, repetir) {
    host.innerHTML = `<p role="alert">Não foi possível consultar as habilidades: ${this.esc(err.message)}</p><button class="btn btn-secondary">Tentar novamente</button>`;
    host.querySelector('button').addEventListener('click', repetir);
  },
  async dashboard() {
    const host = document.getElementById('dash-habilidades');
    if (!host) return;
    try {
      const dados = await API.get('/habilidades/');
      const prontas = dados.progressos.filter(p => p.elegivel);
      host.innerHTML = `<div class="hab-linha"><div><span class="hab-etiqueta">Disciplina que se torna parte de você</span><h2>Habilidades <small>· ${dados.habilidades.length}</small></h2></div><button class="btn btn-secondary btn-sm" data-hab-abrir>Ver todas</button></div>
        <div class="hab-grid hab-dashboard-grid">${dados.habilidades.slice(0,3).map(h => this.card(h)).join('')}
        ${prontas.slice(0,2).map(p => this.progresso(p)).join('')}
        ${!dados.habilidades.length && !prontas.length ? (dados.progressos[0] ? this.progresso(dados.progressos[0]) : '<p>Suas futuras habilidades nascerão das rotinas cumpridas sem quebrar a sequência.</p>') : ''}</div>`;
      this.bind(host, dados);
    } catch (err) { this.erro(host, err, () => this.dashboard()); }
  },
  async montarRotinas(host) {
    const consulta = Symbol('consulta');
    host._habilidadesConsulta = consulta;
    try {
      const dados = await API.get('/habilidades/');
      if (!host.isConnected || host._habilidadesConsulta !== consulta) return;
      host.querySelectorAll('[data-hab-rotina]').forEach(slot => {
        const p = dados.progressos.find(p => p.rotina_id === Number(slot.dataset.habRotina));
        slot.innerHTML = p ? this.progresso(p, true) : '';
      });
      this.bind(host, dados);
    } catch (_) {
      if (host._habilidadesConsulta !== consulta) return;
      host.querySelectorAll('[data-hab-rotina]').forEach(slot => { slot.textContent = 'Progresso de habilidade indisponível. Consulte a guia Habilidades.'; });
    }
  },
  programacao(e) {
    let dias = [];
    try { dias = JSON.parse(e.dias_semana || '[]'); } catch (_) { /* legado inválido */ }
    if (!Array.isArray(dias)) dias = [];
    const semana = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
    const frequencia = e.tipo === 'SEMANAL' ? dias.map(d => semana[d]).filter(Boolean).join(', ')
      : e.tipo === 'MENSAL' ? `Todo dia ${e.dia_mes}`
      : e.tipo === 'ANUAL' ? `Todo ano em ${e.mes_dia?.split('-').reverse().join('/') || '—'}` : 'Todos os dias';
    return `${frequencia} · ${e.hora_inicio || 'Dia inteiro'}${e.hora_fim ? ' até ' + e.hora_fim : ''}`;
  },
  dialogo(titulo, corpo) {
    document.getElementById('hab-dialogo')?.close();
    document.getElementById('hab-dialogo')?.remove();
    const anterior = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id = 'hab-dialogo'; dialog.className = 'hab-dialogo';
    dialog.setAttribute('aria-labelledby', 'hab-dialogo-titulo');
    dialog.innerHTML = `<div class="hab-linha"><h2 id="hab-dialogo-titulo">${this.esc(titulo)}</h2><button class="btn btn-secondary btn-sm" data-fechar aria-label="Fechar">×</button></div>${corpo}`;
    document.body.appendChild(dialog);
    dialog.querySelector('[data-fechar]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { dialog.remove(); if (anterior?.isConnected) anterior.focus(); }, { once: true });
    dialog.showModal();
    return dialog;
  },
  converter(p) {
    const dialog = this.dialogo('Despertar habilidade', `<div class="hab-ritual" style="--hab-cor:${this.cor(p.dificuldade)}">${this.glifo()}<p>${p.sequencia} execuções perfeitas de <strong>${this.esc(p.titulo)}</strong></p></div>
      <p>A rotina deixará a agenda e suas ocorrências abertas serão encerradas sem penalidade. Suas vitórias e a origem da habilidade ficarão preservadas.</p>
      <form><label for="hab-nome">Nome da nova habilidade</label><input id="hab-nome" name="nome" maxlength="80" required placeholder="Ex.: Imune a Café" autocomplete="off">
      <p class="hab-erro" role="alert"></p><button type="submit" class="btn btn-primary">Criar habilidade permanente</button></form>`);
    dialog.querySelector('input').focus();
    dialog.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = dialog.querySelector('[type=submit]');
      if (btn.disabled) return;
      const nome = dialog.querySelector('input').value.trim();
      if (!nome) { dialog.querySelector('.hab-erro').textContent = 'Dê um nome à habilidade.'; return; }
      btn.disabled = true; btn.textContent = 'Registrando…';
      try {
        await API.post(`/habilidades/de-rotina/${p.rotina_id}`, { nome });
        dialog.close();
        if (typeof SoloDialog !== 'undefined') SoloDialog.toast('Habilidade adquirida. Sua trajetória foi preservada.', 'success');
        await App.navigate('habilidades');
      } catch (err) {
        dialog.querySelector('.hab-erro').textContent = err.message;
        btn.disabled = false; btn.textContent = 'Criar habilidade permanente';
      }
    });
  },
  detalhes(h) {
    const e = h.evidencia;
    this.dialogo(h.nome, `<div class="hab-ritual" style="--hab-cor:${this.cor(e.dificuldade)}">${this.glifo()}<span class="hab-etiqueta">Adquirida em ${this.data(h.criado_em)}</span></div>
      <dl class="hab-dados"><dt>Rotina de origem</dt><dd>${this.esc(e.titulo)}</dd><dt>Disciplina</dt><dd>${this.esc(e.categoria)} · ${this.esc(e.natureza)}</dd><dt>Dificuldade / prioridade</dt><dd>${this.esc(this._rotulos[e.dificuldade])} / ${this.esc(this._rotulos[e.prioridade])}</dd><dt>Sequência perfeita</dt><dd>${e.sequencia} execuções · meta de ${e.meta}</dd><dt>Trajetória</dt><dd>${this.data(e.inicio)} a ${this.data(e.fim)}</dd><dt>Programação de origem</dt><dd>${this.esc(this.programacao(e))}</dd></dl>
      <p>${this.esc(e.descricao || '')}</p><p class="hab-explicacao">${this.esc(e.base_historica)}. Histórico preservado no Extrato de Missões.</p>`);
  },
};
window.Habilidades = Habilidades;
