const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<main></main>', {runScripts:'outside-only'});
const w = dom.window;
w.eval(fs.readFileSync(path.join(__dirname,'../js/pages/bots.js'),'utf8'));
const B=w.Bots, host=w.document.querySelector('main');
let salvo;
w.API={put:async (url,body) => {assert.equal(url,'/bots/avisos'); salvo=body; return body;}};
w.SoloDialog={toast:()=>{}};
B.carregar=async () => {};
(async () => {
  for(const canal of [false,true]) {
    for(const modo of ['voz','texto','desligado']) {
      host.innerHTML=B._avisos({sussurros:modo},{vinculado:canal});
      const select=host.querySelector('[data-av=sussurros]');
      assert.equal(select.value,modo);
      assert.deepEqual([...select.options].map(o=>o.textContent),['Desligado','Só texto','Com voz']);
      assert.match(host.textContent,/Personalizada \/ Sempre \/ Nunca/);
      select.value='desligado';
      await B.salvarAvisos(host.querySelector('[data-av-salvar]'));
      assert.equal(salvo.sussurros,'desligado');
    }
  }
  host.innerHTML=B._avisos({},{});
  assert.equal(host.querySelector('[data-av=sussurros]').value,'voz');
  assert.equal(host.querySelector('[data-av=beira]'),null);
  console.log('OK: preferência nos canais antigos e no Solo Bot, três modos, padrão Com voz e salvamento.');
  dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close();});
