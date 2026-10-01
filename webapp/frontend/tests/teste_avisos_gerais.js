const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="avisos-gerais-conteudo"></div>', { runScripts:'outside-only' });
const w = dom.window;
w.HTMLDialogElement.prototype.showModal = function() {this.open=true;};
w.HTMLDialogElement.prototype.close = function() {this.dispatchEvent(new w.Event('close'));};
const catalogo=[{origem:'TAREFA',id:1,titulo:'Fio dental <img src=x>'},{origem:'DUNGEON',id:2,titulo:'Trabalho',sempre_aberta:false},{origem:'DUNGEON',id:3,titulo:'Livre',sempre_aberta:true}];
let regras=[], chamadas=[];
w.SoloDialog={toast:()=>assert.fail('erro inesperado')};
w.API={
  get:async url=>url.endsWith('catalogo')?catalogo:url.endsWith('previa')?{texto:'A missão ainda não foi iniciada.'}:regras,
  post:async(url,body)=>{chamadas.push(body);regras=[{...body,id:1,titulo:catalogo[0].titulo,ativo:true}];},
  patch:async(url,body)=>{regras[0].ativo=body.ativo;},
  delete:async()=>{regras=[];},
};
w.eval(fs.readFileSync(path.join(__dirname,'../js/pages/avisos-gerais.js'),'utf8'));
const A=w.AvisosGerais, tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  await A.carregar();w.document.querySelector('[data-ag=novo]').click();
  let f=w.document.querySelector('form');
  assert.equal(f.elements.evento.options.length,1);
  f.elements.origem.value='DUNGEON';f.elements.origem.dispatchEvent(new w.Event('change'));
  assert.equal(f.elements.evento.options.length,3);
  f.elements.evento.value='ABRE';f.elements.evento.dispatchEvent(new w.Event('change'));
  assert.equal(f.querySelector('[data-intervalo]').hidden,true);
  assert.equal(f.querySelector('[data-antecedencia]').hidden,false);
  f.elements.alvo_id.value='3';f.elements.alvo_id.dispatchEvent(new w.Event('change'));
  assert.equal(f.elements.evento.options.length,1,'portão sempre aberto não oferece alertas de abertura');
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
  w.document.querySelector('[data-ag=alternar]').click();await tick();
  assert.match(w.document.querySelector('article').textContent,/Pausado/);
  w.document.querySelector('[data-ag=excluir]').click();await tick();
  assert.equal(w.document.querySelectorAll('article').length,0);
  console.log('Central de avisos: configuração, prévia, pausa, remoção e escape OK');
})().catch(err=>{console.error(err);process.exitCode=1;});
