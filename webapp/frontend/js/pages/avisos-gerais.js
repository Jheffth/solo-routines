const AvisosGerais = {
  _regras: [], _catalogo: [],
  esc(v) { return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  _origens: {TAREFA:'Missão geral',ROTINA:'Rotina',DUNGEON:'Dungeon',MISSAO:'Missão interna da dungeon'},
  _eventos: {STATUS:'Acompanhar status',ABRE:'Portão prestes a abrir',FECHA:'Portão prestes a fechar',PRAZO:'Tempo da sessão prestes a acabar',ATIVA_EM:'Missão prestes a aparecer',EXPIRA_EM:'Ocorrência prestes a vencer'},
  _formatos: {texto:'Texto',audio:'Áudio',ambos:'Texto e áudio'},
  async carregar() {
    const host=document.getElementById('avisos-gerais-conteudo'); if(!host) return;
    host.innerHTML='<p role="status">Consultando seus avisos…</p>';
    try {
      [this._regras,this._catalogo]=await Promise.all([API.get('/avisos-gerais/'),API.get('/avisos-gerais/catalogo')]);
      host.innerHTML=`<div class="ag-toolbar"><div><strong>${this._regras.filter(r=>r.ativo).length}</strong> avisos ativos<p>Você escolhe o que acompanhar. A missão concluída encerra os lembretes.</p></div><button class="btn btn-primary" data-ag="novo">+ Novo aviso</button></div>
        <p class="ag-nota">Os avisos chegam pelos canais conectados ao Solo Bot. A preferência Sempre/Nunca e o silêncio da sua Conta Solo prevalecem. O áudio tem cópia escrita quando a voz está indisponível.</p>
        <div class="ag-lista">${this._regras.map(r=>this.card(r)).join('')||'<div class="ag-vazio">Nenhum aviso configurado. Escolha uma missão para começar — por exemplo, lembrar de comprar fio dental a cada hora.</div>'}</div>`;
      host.onclick=async e=>{
        const btn=e.target.closest('[data-ag]'); if(!btn) return;
        const acao=btn.dataset.ag;
        const r=this._regras.find(r=>r.id===Number(btn.dataset.id));
        if(acao==='novo') return this.formulario();
        if(!r) return;
        if(acao==='editar') return this.formulario(r);
        btn.disabled=true;
        try {
          if(acao==='previa') {
            const p=await API.get(`/avisos-gerais/${r.id}/previa`);
            this.dialogo('Prévia do aviso',`<p class="ag-previa">${this.esc(p.texto)}</p><p class="ag-nota">Esta prévia consulta o estado atual e não envia mensagem.</p>`);
          } else if(acao==='alternar') { await API.patch(`/avisos-gerais/${r.id}`,{ativo:!r.ativo}); await this.carregar(); }
          else if(acao==='excluir') { await API.delete(`/avisos-gerais/${r.id}`); await this.carregar(); }
        } catch(err) { SoloDialog.toast(err.message,'error'); }
        finally { btn.disabled=false; }
      };
    } catch(err) {
      host.innerHTML=`<p role="alert">${this.esc(err.message)}</p><button class="btn btn-secondary">Tentar novamente</button>`;
      host.querySelector('button').onclick=()=>this.carregar();
    }
  },
  card(r) {
    const tentativa=r.ultima_tentativa;
    const status={ACEITO:'Aceito pelo Solo Bot',FALHOU:'Última tentativa não foi aceita',RESERVADO:'Tentativa registrada',IGNORADO:'Alvo encerrado antes de enviar'};
    return `<article class="ag-card ${r.ativo?'':'ag-pausado'}"><div class="ag-topo"><span class="ag-tipo">${this._origens[r.origem]} · ${r.ativo?'Ativo':'Pausado'}</span><span class="ag-formato">${this._formatos[r.formato]}</span></div>
      <h3>${this.esc(r.titulo)}</h3><p>${this._eventos[r.evento]} · ${r.evento==='STATUS'?`a cada ${r.intervalo_min} min`:`${r.antecedencia_min} min antes`}</p>
      <p class="ag-nota">Das ${r.janela_de} às ${r.janela_ate} · horário de Brasília</p>
      ${r.evento==='STATUS'&&r.ativo?`<p class="ag-proximo">Próxima verificação: ${this.quando(r.proximo_em)}</p>`:''}
      ${tentativa?`<p class="ag-nota">${status[tentativa.status]||'Tentativa registrada'} · ${this.quando(tentativa.em)}</p>`:''}
      <div class="ag-acoes">${[['previa','Prévia'],['editar','Editar'],['alternar',r.ativo?'Pausar':'Retomar'],['excluir','Remover']].map(([a,t])=>`<button class="btn btn-secondary btn-sm" data-ag="${a}" data-id="${r.id}">${t}</button>`).join('')}</div></article>`;
  },
  quando(v) { return v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'; },
  dialogo(titulo,conteudo) {
    document.getElementById('ag-dialogo')?.close();
    const anterior=document.activeElement, d=document.createElement('dialog');
    d.id='ag-dialogo';d.className='ag-dialogo';d.setAttribute('aria-labelledby','ag-titulo');
    d.innerHTML=`<div class="ag-topo"><h2 id="ag-titulo">${this.esc(titulo)}</h2><button class="btn btn-secondary btn-sm" data-fechar aria-label="Fechar">×</button></div>${conteudo}`;
    d.querySelector('[data-fechar]').onclick=()=>d.close();
    d.addEventListener('close',()=>{d.remove();if(anterior?.isConnected)anterior.focus();},{once:true});
    document.body.appendChild(d);d.showModal();return d;
  },
  formulario(r=null) {
    const padrao={origem:'TAREFA',evento:'STATUS',formato:'texto',intervalo_min:60,antecedencia_min:30,janela_de:'08:00',janela_ate:'22:00',estados:['PENDENTE','ATIVA','PAUSADA','ATRASADA'],...r};
    const opts=(map,valor)=>Object.entries(map).map(([v,t])=>`<option value="${v}" ${valor===v?'selected':''}>${t}</option>`).join('');
    const d=this.dialogo(r?'Editar aviso':'Novo aviso',`<form class="ag-form"><label>O que acompanhar<select name="origem">${opts(this._origens,padrao.origem)}</select></label>
      <label>Missão ou dungeon<select name="alvo_id" required></select></label><label>Quando avisar<select name="evento"></select></label>
      <label>Como receber<select name="formato">${opts(this._formatos,padrao.formato)}</select></label>
      <div class="ag-form-grid"><label data-intervalo>A cada quantos minutos<input name="intervalo_min" type="number" min="5" max="1440" value="${padrao.intervalo_min}" required></label>
      <label data-antecedencia>Minutos antes<input name="antecedencia_min" type="number" min="5" max="180" value="${padrao.antecedencia_min}" required></label></div>
      <fieldset data-estados><legend>Avisar nestes estados</legend>${[['PENDENTE','Não iniciada'],['ATIVA','Em andamento'],['PAUSADA','Pausada'],['ATRASADA','Atrasada']].map(([v,t])=>`<label><input type="checkbox" name="estados" value="${v}" ${padrao.estados.includes(v)?'checked':''}> ${t}</label>`).join('')}</fieldset>
      <div class="ag-form-grid"><label>Receber a partir de<input type="time" name="janela_de" value="${padrao.janela_de}" required></label><label>Até<input type="time" name="janela_ate" value="${padrao.janela_ate}" required></label></div>
      <p class="ag-nota">O envio verifica os alvos a cada cinco minutos. A repetição começa após o intervalo escolhido. Nas dungeons, cada ocorrência tem seus próprios avisos; concluir ou expirar um card encerra os lembretes dele. Missões internas precisam de uma sessão real iniciada; saúde segue os eventos registrados pela dungeon. Janelas muito curtas podem terminar entre duas verificações.</p><p class="ag-erro" role="alert"></p>
      <button class="btn btn-primary" type="submit">Salvar aviso</button></form>`);
    const f=d.querySelector('form'), origem=f.elements.origem, alvos=f.elements.alvo_id, evento=f.elements.evento;
    const eventos=()=>{
      const atual=evento.value||padrao.evento;
      const alvo=this._catalogo.find(o=>o.origem===origem.value&&o.id===Number(alvos.value));
      if(!r&&origem.value==='MISSAO'&&['BEM_ESTAR','EVENTO_ALEATORIO'].includes(alvo?.natureza))f.elements.intervalo_min.value='5';
      const permitidos=alvo?.eventos||(origem.value==='DUNGEON'?['STATUS','PRAZO',...(!alvo?.sempre_aberta?['ABRE','FECHA']:[])]:['STATUS']);
      evento.innerHTML=opts(Object.fromEntries(permitidos.map(e=>[e,this._eventos[e]])),atual);
      campos();
    };
    const campos=()=>{
      f.querySelector('[data-intervalo]').hidden=evento.value!=='STATUS';
      f.querySelector('[data-antecedencia]').hidden=evento.value==='STATUS';
      f.querySelector('[data-estados]').hidden=evento.value!=='STATUS';
    };
    const selecionar=()=>{
      const lista=this._catalogo.filter(o=>o.origem===origem.value);
      if(r&&r.origem===origem.value&&!lista.some(o=>o.id===r.alvo_id))lista.unshift({id:r.alvo_id,titulo:r.titulo});
      alvos.innerHTML=lista.map(o=>`<option value="${o.id}" ${padrao.alvo_id===o.id?'selected':''}>${this.esc(o.titulo)}</option>`).join('');
      if(!lista.length)alvos.innerHTML='<option value="">Nenhum alvo disponível</option>';
      eventos();
    };
    origem.onchange=selecionar;alvos.onchange=eventos;evento.onchange=campos;selecionar();
    origem.focus();
    f.onsubmit=async e=>{
      e.preventDefault();const btn=f.querySelector('[type=submit]');if(btn.disabled)return;
      const corpo={origem:origem.value,alvo_id:Number(alvos.value),evento:evento.value,formato:f.elements.formato.value,
        intervalo_min:Number(f.elements.intervalo_min.value),antecedencia_min:Number(f.elements.antecedencia_min.value),
        janela_de:f.elements.janela_de.value,janela_ate:f.elements.janela_ate.value,
        estados:[...f.querySelectorAll('[name=estados]:checked')].map(el=>el.value)};
      if(!corpo.estados.length&&corpo.evento!=='STATUS')corpo.estados=padrao.estados;
      btn.disabled=true;f.querySelector('.ag-erro').textContent='';
      try {
        if(r)await API.put(`/avisos-gerais/${r.id}`,corpo);else await API.post('/avisos-gerais/',corpo);
        d.close();await this.carregar();
      } catch(err) {f.querySelector('.ag-erro').textContent=err.message;btn.disabled=false;}
    };
  },
};
window.AvisosGerais=AvisosGerais;
