/* Corrida e exercícios: revisão dos prints, histórico e metas privadas. */
(function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numero = v => Number(v || 0).toLocaleString('pt-BR', {maximumFractionDigits: 2});
  const relogio = v => {
    if (v == null) return '—';
    const n = Math.round(v);
    return n >= 3600 ? `${Math.floor(n/3600)}:${String(Math.floor(n%3600/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}` : `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
  };
  const segundos = texto => {
    if (!/^\d{1,4}:\d{2}(:\d{2})?$/.test(texto)) throw new Error('Use mm:ss ou hh:mm:ss para os tempos.');
    const p = texto.split(':').map(Number);
    if (p.at(-1) >= 60 || (p.length === 3 && p[1] >= 60)) throw new Error('Confira os minutos e segundos.');
    return p.reduce((a,b) => a*60+b, 0);
  };
  const rotulos = {dia:'Dia', semana:'Semana', mes:'Mês', ano:'Ano', corrida:'Corrida', caminhada:'Caminhada', ciclismo:'Ciclismo', exercicio:'Exercício', todas:'Todas as modalidades'};
  const opcoes = (valores, atual) => valores.map(v => `<option value="${v}" ${v===atual?'selected':''}>${rotulos[v]}</option>`).join('');
  const dataBr = d => d.split('-').reverse().join('/');
  const Treinos = {
    periodo: 'mes', referencia: '', modalidade: 'todas', pagina: 1, dados: null, pedido: 0,
    async carregar() {
      const cx = document.getElementById('treinos-conteudo');
      if (!cx) return;
      const pedido = ++this.pedido;
      cx.innerHTML = '<p role="status">Carregando seus exercícios…</p>';
      try {
        const q = new URLSearchParams({periodo:this.periodo, modalidade:this.modalidade, pagina:this.pagina});
        if (this.referencia) q.set('referencia', this.referencia);
        const dados = await API.get(`/treinos?${q}`);
        if (pedido !== this.pedido) return;
        this.dados = dados;
        this.referencia ||= dados.hoje;
        this.desenhar(cx);
      } catch (e) {
        if (pedido === this.pedido) {
          cx.innerHTML = `<p role="alert">${esc(e.message)}</p><button class="btn" data-acao="recarregar">Tentar novamente</button>`;
          cx.querySelector('button').onclick = () => this.carregar();
        }
      }
    },
    desenhar(cx) {
      const d = this.dados, m = d.metricas;
      cx.innerHTML = `
        <div class="tr-filtros card">
          <label>Período<select id="tr-periodo">${opcoes(['dia','semana','mes','ano'],this.periodo)}</select></label>
          <label>Data de referência<input type="date" id="tr-referencia" value="${esc(this.referencia)}" required></label>
          <label>Modalidade<select id="tr-modalidade">${opcoes(['todas','corrida','caminhada','ciclismo','exercicio'],this.modalidade)}</select></label>
          <button class="btn btn-primary" data-acao="filtrar">Consultar</button>
        </div>
        <p class="tr-legenda">${dataBr(d.inicio)} a ${dataBr(d.fim)} · Semana de segunda a domingo.</p>
        <div class="tr-numeros">${[
          [numero(m.distancia_km),'km percorridos'],[numero(m.minutos),'minutos em movimento'],
          [m.treinos,`${m.dias_ativos} dias ativos`],[relogio(m.ritmo_segundos_km),'min/km · ritmo ponderado'],
          [numero(m.velocidade_kmh),'km/h · velocidade média'],[m.velocidade_max_kmh==null?'—':numero(m.velocidade_max_kmh),'km/h · velocidade máxima'],[numero(m.km_por_treino),'km por treino'],
          [numero(m.minutos_por_treino),'minutos por treino'],[numero(m.km_por_dia),'km por dia'],
          [numero(m.minutos_por_dia),'minutos por dia'],[numero(m.passos),'passos'],[numero(m.elevacao_m),'m de elevação']
        ].map(([valor,label])=>`<article class="card"><strong>${valor}</strong><span>${label}</span></article>`).join('')}</div>
        <p class="tr-legenda">Média diária considera ${m.dias_periodo} dias, incluindo os sem treino. No período atual, conta até hoje. Ritmo e velocidade usam distância e tempo totais; exercícios sem distância entram no tempo.</p>
        <div class="tr-acoes"><button class="btn btn-primary" data-acao="novo">+ Registrar exercício</button><button class="btn" data-acao="nova-meta">+ Criar meta</button></div>
        <div id="tr-editor" hidden></div>
        <section class="card tr-secao"><h2>Metas</h2><p class="tr-legenda">Cada meta usa seu próprio período na data consultada e a modalidade escolhida na criação.</p>
          <div class="tr-metas">${d.metas.length ? d.metas.map(meta => {
            const unidade = meta.tipo === 'minutos' ? 'min' : 'km';
            return `<article class="tr-meta"><h3>${esc(meta.titulo)}</h3><p>${rotulos[meta.periodo]} · ${rotulos[meta.modalidade]} · ${dataBr(meta.inicio)} a ${dataBr(meta.fim)}</p>
              <strong>${numero(meta.atual)} / ${numero(meta.alvo)} ${unidade} · ${numero(meta.percentual)}% ${meta.atingida?'✓':''}</strong>
              ${meta.tipo==='distancia_tempo'?`<p>Em um único treino de até ${relogio(meta.tempo_limite_segundos)}. Sessões não são somadas.</p>`:''}
              <progress max="100" value="${Math.min(100,meta.percentual)}" aria-label="Progresso da meta ${esc(meta.titulo)}"></progress>
              <div class="tr-acoes"><button class="btn btn-sm" data-acao="editar-meta" data-id="${meta.id}">Editar</button><button class="btn btn-sm" data-acao="excluir-meta" data-id="${meta.id}">Excluir</button></div></article>`;
          }).join('') : '<p>Crie sua primeira meta de quilômetros, minutos ou distância em um tempo limite.</p>'}</div>
        </section>
        <section class="card tr-secao"><h2>Evolução diária</h2>${d.evolucao.length ? `<div class="tr-grafico">${d.evolucao.map(a=>`<div class="tr-dia"><span>${dataBr(a.data)}</span><meter min="0" max="${Math.max(...d.evolucao.map(x=>x.distancia_km),1)}" value="${a.distancia_km}" aria-label="Distância em ${dataBr(a.data)}"></meter><span>${numero(a.distancia_km)} km · ${numero(a.minutos)} min</span></div>`).join('')}</div>` : '<p>Seus treinos aparecerão aqui.</p>'}</section>
        <section class="card tr-secao"><h2>Histórico · ${d.total} registros</h2><div class="tr-tabela"><table><thead><tr><th>Data / atividade</th><th>Modalidade</th><th>Distância</th><th>Tempo</th><th>Ritmo</th><th>Passos / elevação</th><th>Ações</th></tr></thead><tbody>${d.atividades.map(a=>`<tr><td>${dataBr(a.data)}<br><strong>${esc(a.titulo)}</strong></td><td>${rotulos[a.modalidade]}</td><td>${numero(a.distancia_km)} km</td><td>${relogio(a.duracao_segundos)}</td><td>${relogio(a.ritmo_segundos_km)} /km</td><td>${a.passos==null?'—':numero(a.passos)} / ${a.elevacao_m==null?'—':numero(a.elevacao_m)+' m'}</td><td><button class="btn btn-sm" data-acao="editar" data-id="${a.id}">Editar</button><button class="btn btn-sm" data-acao="excluir" data-id="${a.id}">Excluir</button></td></tr>`).join('') || '<tr><td colspan="7">Nenhum exercício neste período.</td></tr>'}</tbody></table></div>
        <div class="tr-acoes"><button class="btn" data-acao="anterior" ${this.pagina===1?'disabled':''}>Anterior</button><span>Página ${this.pagina}</span><button class="btn" data-acao="proxima" ${this.pagina*50>=d.total?'disabled':''}>Próxima</button></div></section>
        <p id="tr-aviso" role="alert"></p>`;
      cx.onclick = e => {
        const b = e.target.closest('[data-acao]');
        if (!b || b.disabled) return;
        this.acao(b.dataset.acao, Number(b.dataset.id), b).catch(err=>this.erro(err));
      };
    },
    erro(e) {
      const el = document.getElementById('tr-form-erro') || document.getElementById('tr-aviso');
      if (el) el.textContent = typeof e.message === 'string' && !e.message.includes('[object Object]') ? e.message : 'Confira os campos informados e tente novamente.';
    },
    async acao(acao, id, botao) {
      if (acao === 'filtrar') {
        const data = document.getElementById('tr-referencia');
        if (!data.reportValidity()) return;
        this.periodo = document.getElementById('tr-periodo').value;
        this.referencia = data.value;
        this.modalidade = document.getElementById('tr-modalidade').value;
        this.pagina = 1;
        return this.carregar();
      }
      if (acao === 'anterior' || acao === 'proxima') { this.pagina += acao==='anterior'?-1:1; return this.carregar(); }
      if (acao === 'novo' || acao === 'editar') return this.formAtividade(this.dados.atividades.find(a=>a.id===id));
      if (acao === 'nova-meta' || acao === 'editar-meta') return this.formMeta(this.dados.metas.find(m=>m.id===id));
      if (acao === 'cancelar') { document.getElementById('tr-editor').hidden=true; return; }
      if (acao === 'excluir' || acao === 'excluir-meta') {
        Modal.confirmar('Excluir registro?', 'Esta ação remove o registro e recalcula suas métricas e metas.', async () => {
          try { await API.delete(`/treinos/${acao==='excluir'?'atividades':'metas'}/${id}`); await this.carregar(); }
          catch (e) { this.erro(e); }
        });
      }
    },
    editor(html) {
      const editor = document.getElementById('tr-editor');
      editor.hidden=false;
      editor.className='card tr-secao';
      editor.innerHTML=html;
      editor.scrollIntoView({behavior:'smooth',block:'start'});
      return editor;
    },
    formAtividade(a) {
      const editor = this.editor(`<h2>${a?'Editar exercício':'Registrar exercício'}</h2>
        ${!a?`<label class="tr-upload">Importar print do Strava (JPG, PNG ou WebP · até 8 MB)<input type="file" id="tr-print" accept="image/jpeg,image/png,image/webp" ${this.dados.leitura_disponivel?'':'disabled'}></label><p>${this.dados.leitura_disponivel?'A leitura preenche os campos abaixo. Revise antes de salvar.':'Leitura automática indisponível neste servidor. O cadastro manual continua disponível.'}</p><p id="tr-leitura" role="status"></p>`:''}
        <form id="tr-atividade" class="tr-form">
          <label>Título<input name="titulo" maxlength="120" required value="${esc(a?.titulo || '')}"></label>
          <label>Data da atividade<input name="data" type="date" max="${this.dados.hoje}" required value="${a?.data || this.dados.hoje}"></label>
          <label>Modalidade<select name="modalidade">${opcoes(['corrida','caminhada','ciclismo','exercicio'],a?.modalidade || 'corrida')}</select></label>
          <label>Distância (km)<input name="distancia_km" type="number" min="0" max="2000" step="0.001" required value="${a?.distancia_km ?? ''}"></label>
          <label>Tempo em movimento (mm:ss ou hh:mm:ss)<input name="duracao" placeholder="17:50" required value="${a?relogio(a.duracao_segundos):''}"></label>
          <label>Passos (opcional)<input name="passos" type="number" min="0" max="2000000" step="1" value="${a?.passos ?? ''}"></label>
          <label>Elevação (m, opcional)<input name="elevacao_m" type="number" min="0" max="100000" step="0.1" value="${a?.elevacao_m ?? ''}"></label>
          <label>Velocidade máxima (km/h, opcional)<input name="velocidade_max_kmh" type="number" min="0" max="500" step="0.1" value="${a?.velocidade_max_kmh ?? ''}"></label>
          <label class="tr-confirmar"><input type="checkbox" name="revisado" required> Conferi a data, a modalidade e os valores.</label>
          <div class="tr-acoes"><button class="btn btn-primary" type="submit">Salvar exercício</button><button class="btn" type="button" data-acao="cancelar">Cancelar</button></div>
        </form><p id="tr-form-erro" role="alert"></p>`);
      const form = editor.querySelector('form');
      let hash = null, lendo = false;
      editor.querySelector('#tr-print')?.addEventListener('change', async e => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;
        const status = editor.querySelector('#tr-leitura');
        const submit = form.querySelector('[type=submit]');
        hash = null;
        form.elements.revisado.checked = false;
        if (arquivo.size>8*1024*1024) { status.textContent='O print deve ter até 8 MB.'; return; }
        lendo = true; e.target.disabled=true; submit.disabled=true;
        status.textContent='Lendo o print…';
        try {
          const body = new FormData(); body.append('arquivo',arquivo);
          const res = await fetch(`${API.BASE}/treinos/ler-print`,{method:'POST', headers:{Authorization:`Bearer ${API.token}`},body});
          const resp = await res.json();
          if (res.status===401) { API.setToken(null); window.dispatchEvent(new Event('sr:session-expired')); }
          if (!res.ok) throw new Error(typeof resp.detail==='string'?resp.detail:'Não foi possível ler o print.');
          // Não mantém valores do print anterior quando o novo não contém o campo.
          for (const campo of ['distancia_km','passos','elevacao_m','velocidade_max_kmh']) form.elements[campo].value=resp.dados[campo] ?? '';
          form.elements.duracao.value=resp.dados.duracao_segundos ? relogio(resp.dados.duracao_segundos) : '';
          form.elements.data.value=resp.dados.data || '';
          form.elements.titulo.value=resp.dados.titulo || 'Atividade Strava';
          hash=resp.print_hash;
          status.textContent=resp.aviso;
        } catch(err) { status.textContent=err.message; }
        finally { lendo=false; e.target.disabled=false; submit.disabled=false; }
      });
      form.onsubmit=async e=>{
        e.preventDefault(); if (lendo) return;
        const b=form.querySelector('[type=submit]'); b.disabled=true;
        try {
          const f=new FormData(form), payload={titulo:f.get('titulo'),data:f.get('data'),modalidade:f.get('modalidade'),distancia_km:Number(f.get('distancia_km')),duracao_segundos:segundos(f.get('duracao')),passos:f.get('passos')===''?null:Number(f.get('passos')),elevacao_m:f.get('elevacao_m')===''?null:Number(f.get('elevacao_m')),velocidade_max_kmh:f.get('velocidade_max_kmh')===''?null:Number(f.get('velocidade_max_kmh')),print_hash:hash};
          await (a?API.put(`/treinos/atividades/${a.id}`,payload):API.post('/treinos/atividades',payload));
          this.referencia=payload.data; this.pagina=1; this.modalidade='todas'; await this.carregar();
        } catch(err) { this.erro(err); } finally { b.disabled=false; }
      };
    },
    formMeta(m) {
      const editor=this.editor(`<h2>${m?'Editar meta':'Criar meta'}</h2><form id="tr-meta" class="tr-form">
        <label>Nome da meta<input name="titulo" maxlength="120" required value="${esc(m?.titulo||'')}"></label>
        <label>Período<select name="periodo">${opcoes(['dia','semana','mes','ano'],m?.periodo||'mes')}</select></label>
        <label>Modalidade<select name="modalidade">${opcoes(['todas','corrida','caminhada','ciclismo','exercicio'],m?.modalidade||'corrida')}</select></label>
        <label>Tipo<select name="tipo"><option value="distancia">Quilômetros acumulados</option><option value="minutos">Minutos acumulados</option><option value="distancia_tempo">Quilômetros em um tempo limite</option></select></label>
        <label><span id="tr-unidade">Alvo em km</span><input name="alvo" type="number" min="0.001" max="1000000" step="0.001" required value="${m?.alvo??''}"></label>
        <label id="tr-limite">Tempo limite de um treino (mm:ss ou hh:mm:ss)<input name="limite" placeholder="30:00" value="${m?.tempo_limite_segundos?relogio(m.tempo_limite_segundos):''}"></label>
        <p class="tr-confirmar">A meta se renova em cada período. Para distância em tempo limite, um único treino precisa alcançar os km dentro do tempo informado.</p>
        <div class="tr-acoes"><button class="btn btn-primary" type="submit">Salvar meta</button><button class="btn" type="button" data-acao="cancelar">Cancelar</button></div></form><p id="tr-form-erro" role="alert"></p>`);
      const form=editor.querySelector('form'); form.elements.tipo.value=m?.tipo||'distancia';
      const atualizar=()=>{
        const combinado=form.elements.tipo.value==='distancia_tempo';
        editor.querySelector('#tr-limite').hidden=!combinado;
        form.elements.limite.required=combinado;
        editor.querySelector('#tr-unidade').textContent=form.elements.tipo.value==='minutos'?'Alvo em minutos':'Alvo em km';
      };
      form.elements.tipo.onchange=atualizar; atualizar();
      form.onsubmit=async e=>{
        e.preventDefault(); const b=form.querySelector('[type=submit]'); b.disabled=true;
        try {
          const f=new FormData(form), payload={titulo:f.get('titulo'),periodo:f.get('periodo'),modalidade:f.get('modalidade'),tipo:f.get('tipo'),alvo:Number(f.get('alvo')),tempo_limite_segundos:f.get('tipo')==='distancia_tempo'?segundos(f.get('limite')):null};
          await (m?API.put(`/treinos/metas/${m.id}`,payload):API.post('/treinos/metas',payload));
          await this.carregar();
        } catch(err) { this.erro(err); } finally { b.disabled=false; }
      };
    }
  };
  window.Treinos=Treinos;
})();
