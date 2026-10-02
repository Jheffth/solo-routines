const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="avisos-gerais-conteudo"></div>', { runScripts:'outside-only' });
const w = dom.window;
w.HTMLDialogElement.prototype.showModal = function() {this.open=true;};
w.HTMLDialogElement.prototype.close = function() {this.dispatchEvent(new w.Event('close'));};
const catalogo=[{origem:'TAREFA',id:1,titulo:'Fio dental <img src=x>'},{origem:'DUNGEON',id:2,titulo:'Trabalho',sempre_aberta:false},{origem:'DUNGEON',id:3,titulo:'Livre',sempre_aberta:true},
  {origem:'MISSAO',id:4,titulo:'Trabalho · Beber água',natureza:'BEM_ESTAR',eventos:['STATUS','DISPONIVEL','ATIVA_EM','EXPIRA_EM']},
  {origem:'MISSAO',id:5,titulo:'Trabalho · Padrão',natureza:'PADRAO',eventos:['STATUS']},
  {origem:'TAREFA',id:6,titulo:'Ler 100 páginas',eventos:['STATUS','PRAZO','PROGRESSO']},
  {origem:'RESUMO',id:1,titulo:'Seu dia',eventos:['AGENDA','BALANCO']}];
let regras=[], chamadas=[], pref={limite_diario:0,agrupar:false,usados_hoje:0};
w.SoloDialog={toast:()=>assert.fail('erro inesperado')};
w.API={
  get:async url=>url.endsWith('catalogo')?catalogo:url.endsWith('preferencias')?pref:url.endsWith('previa')?{texto:'A missão ainda não foi iniciada.'}:regras,
  post:async(url,body)=>{if(url.endsWith('/adiar')){regras[0].adiado_ate=new Date(Date.now()+3600000).toISOString();return;}chamadas.push(body);regras=[{...body,id:1,titulo:catalogo[0].titulo,ativo:true}];},
  put:async(url,body)=>{pref={...pref,...body};},
  patch:async(url,body)=>{regras[0].ativo=body.ativo;},
  delete:async()=>{regras=[];},
};
w.eval(fs.readFileSync(path.join(__dirname,'../js/pages/avisos-gerais.js'),'utf8'));
const A=w.AvisosGerais, tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  await A.carregar();w.document.querySelector('[data-ag=novo]').click();
  let f=w.document.querySelector('form');
  assert.equal(f.elements.evento.options.length,1);
  f.elements.alvo_id.value='6';f.elements.alvo_id.dispatchEvent(new w.Event('change'));
  assert.equal(f.elements.evento.options.length,3);
  f.elements.evento.value='PROGRESSO';f.elements.evento.dispatchEvent(new w.Event('change'));
  assert.equal(f.querySelector('[data-antecedencia]').hidden,true);
  assert.equal(f.querySelector('[data-intervalo]').hidden,true);
  assert.equal(f.querySelector('[data-estados]').hidden,true);
  assert.match(f.textContent,/desafio progressivo inteiro/);
  f.elements.evento.value='PRAZO';f.elements.evento.dispatchEvent(new w.Event('change'));
  assert.equal(f.querySelector('[data-antecedencia]').hidden,false);
  assert.match(A.card({origem:'TAREFA',evento:'PROGRESSO',formato:'texto',ativo:true,titulo:'Ler',janela_de:'08:00',janela_ate:'22:00'}),/80%/);
  f.elements.origem.value='DUNGEON';f.elements.origem.dispatchEvent(new w.Event('change'));
  assert.equal(f.elements.evento.options.length,4);
  f.elements.evento.value='ABRE';f.elements.evento.dispatchEvent(new w.Event('change'));
  assert.equal(f.querySelector('[data-intervalo]').hidden,true);
  assert.equal(f.querySelector('[data-antecedencia]').hidden,false);
  f.elements.alvo_id.value='3';f.elements.alvo_id.dispatchEvent(new w.Event('change'));
  assert.equal(f.elements.evento.options.length,2,'portão sempre aberto oferece prazo de sessão');
  assert.equal([...f.elements.evento.options].some(o=>o.value==='ABRE'),false);
  f.elements.origem.value='TAREFA';f.elements.origem.dispatchEvent(new w.Event('change'));
  f.elements.formato.value='audio';f.elements.intervalo_min.value='60';
  assert.equal(w.document.querySelectorAll('img').length,0,'título é texto');
  f.dispatchEvent(new w.Event('submit',{cancelable:true}));
  f.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(chamadas.length,1);assert.equal(chamadas[0].formato,'audio');assert.equal(chamadas[0].intervalo_min,60);
  assert.equal(w.document.querySelectorAll('img').length,0);
  w.document.querySelector('[data-ag=previa]').click();await tick();
  assert.match(w.document.querySelector('dialog').textContent,/não foi iniciada/);
  w.document.querySelector('[data-fechar]').click();
  w.document.querySelector('[data-ag=adiar]').click();await tick();
  assert.match(w.document.querySelector('article').textContent,/Silenciado até/);
  w.document.querySelector('[data-ag=alternar]').click();await tick();
  assert.match(w.document.querySelector('article').textContent,/Pausado/);
  w.document.querySelector('[data-ag=excluir]').click();await tick();
  assert.equal(w.document.querySelectorAll('article').length,0);
  w.document.querySelector('[data-ag=novo]').click();f=w.document.querySelector('form');
  f.elements.origem.value='MISSAO';f.elements.origem.dispatchEvent(new w.Event('change'));
  assert.deepEqual([...f.elements.evento.options].map(o=>o.value),['STATUS','DISPONIVEL','ATIVA_EM','EXPIRA_EM']);
  assert.equal(f.elements.intervalo_min.value,'5','saúde sugere intervalo curto');
  f.elements.evento.value='DISPONIVEL';f.elements.evento.dispatchEvent(new w.Event('change'));
  assert.equal(f.querySelector('[data-intervalo]').hidden,true);
  assert.equal(f.querySelector('[data-antecedencia]').hidden,true);
  assert.equal(f.querySelector('[data-estados]').hidden,true);
  assert.match(A.card({origem:'MISSAO',evento:'DISPONIVEL',formato:'texto',ativo:true,titulo:'Água',janela_de:'08:00',janela_ate:'22:00'}),/uma vez por ocorrência/);
  f.elements.evento.value='EXPIRA_EM';f.elements.evento.dispatchEvent(new w.Event('change'));
  assert.equal(f.querySelector('[data-estados]').hidden,true);
  assert.equal(f.querySelector('[data-antecedencia]').hidden,false);
  f.elements.alvo_id.value='5';f.elements.alvo_id.dispatchEvent(new w.Event('change'));
  assert.deepEqual([...f.elements.evento.options].map(o=>o.value),['STATUS']);
  w.document.querySelector('[data-fechar]').click();
  w.document.querySelector('[data-ag=preferencias]').click();
  f=w.document.querySelector('form');f.elements.limite.value='7';f.elements.agrupar.checked=true;
  f.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(pref.limite_diario,7);assert.equal(pref.agrupar,true);
  assert.match(w.document.getElementById('avisos-gerais-conteudo').textContent,/limite 7/);
  w.document.querySelector('[data-ag=novo]').click();f=w.document.querySelector('form');
  f.elements.origem.value='RESUMO';f.elements.origem.dispatchEvent(new w.Event('change'));
  assert.deepEqual([...f.elements.evento.options].map(o=>o.value),['AGENDA','BALANCO']);
  assert.equal(f.querySelector('[data-antecedencia]').hidden,true);
  assert.equal(f.querySelector('[data-hora-ate]').hidden,true);
  assert.equal(f.querySelector('[data-resumo]').hidden,false);
  assert.match(f.querySelector('[data-hora-label]').textContent,/Horário do resumo/);
  f.elements.evento.value='BALANCO';f.elements.janela_de.value='21:30';f.elements.formato.value='ambos';
  f.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(chamadas.at(-1).origem,'RESUMO');assert.equal(chamadas.at(-1).evento,'BALANCO');
  assert.equal(chamadas.at(-1).janela_de,'21:30');assert.equal(chamadas.at(-1).formato,'ambos');
  assert.match(w.document.querySelector('article').textContent,/uma vez por dia/);
  assert.match(w.document.querySelector('article').textContent,/Todos os dias às 21:30/);
  console.log('Central de avisos: configuração, prévia, pausa, remoção e escape OK');
})().catch(err=>{console.error(err);process.exitCode=1;});
