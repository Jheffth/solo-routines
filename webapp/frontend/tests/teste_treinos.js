/* Fluxo da guia em DOM real: renderização, formulários, filtros e segurança. */
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<div id="treinos-conteudo"></div>',{runScripts:'outside-only',url:'http://localhost'});
const w=dom.window;
w.HTMLElement.prototype.scrollIntoView=()=>{};
const chamadas=[];
const dados={hoje:'2026-11-02',inicio:'2026-11-01',fim:'2026-11-30',total:1,pagina:1,leitura_disponivel:true,
 metricas:{treinos:1,dias_ativos:1,dias_periodo:2,distancia_km:1.91,minutos:17.83,ritmo_segundos_km:560.21,velocidade_kmh:6.43},
 metas:[{id:1,titulo:'<img src=x onerror=alert(1)>',periodo:'mes',modalidade:'corrida',tipo:'distancia_tempo',tempo_limite_segundos:1800,inicio:'2026-11-01',fim:'2026-11-30',atual:0,alvo:5,percentual:0}],
 atividades:[{id:1,titulo:'<script>alert(1)</script>',data:'2026-11-02',modalidade:'corrida',distancia_km:1.91,duracao_segundos:1070,passos:2150,elevacao_m:15,ritmo_segundos_km:560.21}],evolucao:[]};
w.API={BASE:'/api',token:'teste',get:async url=>{chamadas.push(['GET',url]);return dados;},post:async(url,p)=>{chamadas.push(['POST',url,p]);return {};},put:async(url,p)=>{chamadas.push(['PUT',url,p]);return {};}};
w.Modal={confirmar:()=>{}};
w.eval(fs.readFileSync(path.join(__dirname,'../js/pages/treinos.js'),'utf8'));
(async()=>{
 await w.Treinos.carregar();
 assert.ok(w.document.querySelector('table'));
 assert.equal(w.document.querySelectorAll('img,script').length,0,'títulos são texto seguro');
 assert.ok(w.document.body.textContent.includes('9:20'));
 w.Treinos.formAtividade();
 const form=w.document.querySelector('#tr-atividade');
 form.elements.titulo.value='Corrida';form.elements.distancia_km.value='1.91';form.elements.duracao.value='17:50';form.elements.revisado.checked=true;
 await form.onsubmit({preventDefault(){}});
 assert.equal(chamadas.find(c=>c[0]==='POST')[2].duracao_segundos,1070);

 w.Treinos.formAtividade();
 w.fetch=async()=>({ok:true,status:200,json:async()=>({dados:{titulo:'Trilha matinal',distancia_km:1.91,duracao_segundos:1070,passos:2150,elevacao_m:15,velocidade_max_kmh:18.3},print_hash:'a'.repeat(64),aviso:'Confira a data'})});
 const arquivo=w.document.querySelector('#tr-print');
 Object.defineProperty(arquivo,'files',{value:[new w.File(['imagem'],'strava.jpg',{type:'image/jpeg'})]});
 arquivo.dispatchEvent(new w.Event('change'));
 await new Promise(resolve=>setImmediate(resolve));
 const importado=w.document.querySelector('#tr-atividade');
 assert.equal(importado.elements.duracao.value,'17:50');
 assert.equal(importado.elements.passos.value,'2150');
 assert.equal(importado.elements.velocidade_max_kmh.value,'18.3');
 assert.equal(importado.elements.data.value,'','data relativa exige revisão');
 assert.equal(importado.elements.titulo.value,'Trilha matinal');
 assert.equal(importado.elements.revisado.checked,false);
 w.Treinos.formMeta();
 let meta=w.document.querySelector('#tr-meta');
 meta.elements.tipo.value='distancia_tempo';meta.elements.tipo.onchange();
 assert.equal(w.document.querySelector('#tr-limite').hidden,false);
 meta.elements.titulo.value='5km em 30min';meta.elements.alvo.value='5';meta.elements.limite.value='30:00';
 await meta.onsubmit({preventDefault(){}});
 assert.equal(chamadas.find(c=>c[1]==='/treinos/metas')[2].tempo_limite_segundos,1800);
 w.Treinos.formAtividade();
 let f=w.document.querySelector('#tr-atividade');f.elements.duracao.value='17:99';
 await f.onsubmit({preventDefault(){}});
 assert.ok(w.document.querySelector('#tr-form-erro').textContent.includes('segundos'));
 await w.Treinos.carregar();
 w.document.querySelector('#tr-periodo').value='ano';
 await w.Treinos.acao('filtrar');
 assert.ok(chamadas.at(-1)[1].includes('periodo=ano'));
 console.log('Fluxos de renderização, segurança, atividade, meta, validação e filtros: OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
