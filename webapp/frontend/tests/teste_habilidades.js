/* Exercita o fluxo do usuário no DOM, com respostas de API controladas. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<main><div id="habilidades-conteudo"></div><section id="dash-habilidades"></section><div id="rotinas"><div data-hab-rotina="7"></div></div></main>', { runScripts:'outside-only', url:'http://localhost' });
const w = dom.window;
w.HTMLDialogElement.prototype.showModal = function () { this.open=true; };
w.HTMLDialogElement.prototype.close = function () { this.open=false; this.dispatchEvent(new w.Event('close')); };
const p = {rotina_id:7,titulo:'Evitar café <script>ruim()</script>',categoria:'Saúde',dificuldade:'LENDARIO',prioridade:'CRITICA',meta:90,sequencia:90,elegivel:true,inicio:'2026-07-02',fim:'2026-09-29'};
const habilidade = {id:1,nome:'Imune a Café <img src=x onerror=alert(1)>',criado_em:'2026-09-30T15:00:00Z',evidencia:{...p,tipo:'DIARIA',natureza:'PASSIVA',base_historica:'Histórico registrado'}};
let dados = {habilidades:[],progressos:[p]}, postados=[], paginas=[], falhar=false;
w.API = {
  get:async () => { if(falhar) throw new Error('Sem conexão'); return dados; },
  post:async (url,body) => { postados.push({url,body}); dados={habilidades:[habilidade],progressos:[]}; return habilidade; },
};
w.App = { navigate:async page => { paginas.push(page); if(page==='habilidades') await w.Habilidades.carregar(); } };
w.eval(fs.readFileSync(path.join(__dirname,'../js/pages/habilidades.js'),'utf8'));
const H=w.Habilidades;
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  await H.carregar();
  assert.equal(w.document.querySelectorAll('[data-hab-converter]').length,1);
  assert.equal(w.document.querySelectorAll('script').length,0);
  w.document.querySelector('[data-hab-converter]').click();
  assert.ok(w.document.querySelector('dialog').open);
  const input=w.document.getElementById('hab-nome');
  assert.equal(w.document.activeElement,input);
  input.value='Imune a Café';
  const form=w.document.querySelector('form');
  form.dispatchEvent(new w.Event('submit',{cancelable:true}));
  form.dispatchEvent(new w.Event('submit',{cancelable:true}));
  await tick();
  assert.equal(postados.length,1,'duplo clique não envia duas conversões');
  assert.deepEqual(postados[0].body.nome,'Imune a Café');
  assert.equal(paginas.at(-1),'habilidades');
  assert.equal(w.document.querySelectorAll('[data-hab-converter]').length,0);
  assert.equal(w.document.querySelectorAll('img').length,0,'nome é texto, não HTML');
  w.document.querySelector('[data-hab-detalhe]').click();
  assert.match(w.document.querySelector('dialog').textContent,/meta de 90/);
  w.document.querySelector('[data-fechar]').click();
  assert.equal(w.document.querySelector('dialog'),null);
  await H.dashboard();
  assert.match(w.document.getElementById('dash-habilidades').textContent,/Imune a Café/);
  await H.carregar(); // recarregar preserva o card retornado pelo servidor
  assert.equal(w.document.querySelectorAll('#habilidades-conteudo .hab-adquirida').length,1);
  dados={habilidades:[],progressos:[{...p,sequencia:89,elegivel:false}]};
  await H.montarRotinas(w.document.getElementById('rotinas'));
  assert.equal(w.document.querySelectorAll('#rotinas [data-hab-converter]').length,0);
  assert.match(w.document.getElementById('rotinas').textContent,/Faltam 1 execuções/);
  falhar=true; await H.carregar();
  assert.match(w.document.getElementById('habilidades-conteudo').textContent,/Tentar novamente/);
  falhar=false; w.document.querySelector('#habilidades-conteudo button').click(); await tick();
  assert.match(w.document.getElementById('habilidades-conteudo').textContent,/89 \/ 90/);
  console.log('OK: conversão, duplo clique, foco, detalhes, persistência, dashboard, progresso, escape HTML e recuperação de erro.');
  dom.window.close();
})().catch(err => { console.error(err); process.exitCode=1; dom.window.close(); });
