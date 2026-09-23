const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<body></body>', {runScripts:'outside-only', pretendToBeVisual:true});
const w=dom.window;
w.API={dungeons:{acervo:async()=>({acervo:[]})}};
w.SoloDialog={toast(){}};
w.eval(fs.readFileSync(path.join(__dirname,'../js/forja-portao.js'),'utf8'));
w.eval(fs.readFileSync(path.join(__dirname,'../js/pages/dungeon-interior.js'),'utf8')+'\nwindow.D=DungeonInterior;');
const F=w.ForjaPortao,D=w.D,doc=w.document;
D._aberto=true;D._dungeon={id:1,titulo:'Teste'};D._sessao={id:2,status:'ATIVA'};
D._renderMissoes=()=>{};D._atualizarContadores=()=>{};
async function main(){
 D._abrirForjaRapida();
 assert.equal(doc.querySelectorAll('[data-fp-nat]').length,9);
 assert.equal(F._passo,2);
 assert.ok(doc.getElementById('fp-backdrop').classList.contains('fp-so-missoes'));
 for(const nat of ['PADRAO','AGENDADA','CIRCUITO','META','REPETICAO','RESISTENCIA','EVENTO_ALEATORIO','BEM_ESTAR','FLAVOR']){
  F._escolherNatureza(nat);doc.getElementById('fpm-titulo').value=nat;
  if(nat==='CIRCUITO')F._blocos[0].titulo='Etapa';
  if(nat==='META')doc.getElementById('fpm-alvo').value='42.5';
  F._pregarMissao();
 }
 assert.equal(F._missoes.length,9);
 let calls=0,release;
 w.API.post=async(url,p)=>{calls++;assert.equal(url,'/dungeons/1/sessao/missoes');assert.equal(p.sessao_id,2);
  if(calls===1)await new Promise(r=>release=r);
  if(p.natureza==='META')assert.equal(p.meta_alvo,42.5);
  if(p.natureza==='CIRCUITO')assert.equal(p.circuito_payload.etapas[0].titulo,'Etapa');
  return {execucao: ['FLAVOR','BEM_ESTAR','EVENTO_ALEATORIO'].includes(p.natureza)?null:{id:calls}};
 };
 const save=F._salvar();await F._salvar();assert.equal(calls,1);release();await save;
 assert.equal(calls,9);assert.equal(D._execs.length,6);
 D._abrirForjaRapida();F._missoes=[{titulo:'A'},{titulo:'B'}];
 calls=0;w.API.post=async()=>{calls++;if(calls===2)throw Error('Falha');return {execucao:null};};
 await F._salvar();assert.equal(F._missoes.length,1);assert.equal(F._missoes[0].titulo,'B');
 w.API.post=async()=>{calls++;return {execucao:null};};await F._salvar();assert.equal(calls,3);
 F.abrir(null);assert.equal(F._interior,null);assert.equal(F._passo,0);
 assert.ok(!doc.getElementById('fp-backdrop').classList.contains('fp-so-missoes'));
 console.log('OK: nove tipos, integração, payloads, sem duplicação, falha parcial e criador original.');dom.window.close();
}
main().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
