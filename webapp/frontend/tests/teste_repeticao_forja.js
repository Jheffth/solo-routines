/* As amostras da Forja — e o clique que NÃO chama a API.

   A vitrine existe para julgar o desenho sem esperar o mundo real.
   Duas coisas precisam ser verdade ao mesmo tempo:

     · os botões FUNCIONAM (senão não dá para ver a barra andar)
     · e NÃO tocam na API (contar de verdade numa vitrine criaria XP
       a partir de uma amostra)

   Uso:  node webapp/frontend/tests/teste_repeticao_forja.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}

console.log('\n=== AS AMOSTRAS DA FORJA ===\n');

/* ══ 1. As amostras estão no console do Arquiteto ══ */
console.log('-- as cinco amostras --');
const fonte = ler('js', 'arquiteto-console.js');
const bloco = fonte.slice(fonte.indexOf('cardMissao()'),
                          fonte.indexOf("el.id = 'mc-vitrine'"));
const ids = [...bloco.matchAll(/id:\s*(92\d\d)/g)].map(m => m[1]);
ok(ids.length === 5, `cinco amostras de repetição (${ids.join(', ')})`);

const amostra = n => {
  const i = bloco.indexOf(`id: ${n}`);
  return bloco.slice(i, bloco.indexOf('{ id:', i + 5) + 1 || undefined);
};
ok(/alvo_repeticoes:\s*5[\s\S]*?repeticoes:\s*0/.test(amostra(9201)),
   'meta 0/5 — o estado em que o hunter mais vê o cartão, e o mais fácil de errar');
ok(/repeticoes:\s*3/.test(amostra(9202)), 'meta 3/5 — um segmento em curso, pulsando');
ok(/repeticoes:\s*5/.test(amostra(9203)) && /CONCLUIDA/.test(amostra(9203)),
   'meta cumprida 5/5');
ok(/alvo_repeticoes:\s*100[\s\S]*?repeticoes:\s*68/.test(amostra(9204)),
   'os CEM PULINHOS em 68 — o caso difícil que o Arquiteto apontou');
ok(/alvo_repeticoes:\s*null[\s\S]*?repeticoes:\s*87/.test(amostra(9205)),
   'e o contador livre em 87');
ok(/total_contador:\s*412/.test(amostra(9205)),
   '  com um total acumulado, que é o que dá sentido ao contador');

/* Duas prioridades diferentes: é assim que se confere que a moldura e
   os segmentos herdam a cor do cartão (dourado na Alta, vermelho na
   Crítica), que foi um pedido explícito. */
ok(/prioridade:\s*'ALTA'/.test(amostra(9201)) &&
   /prioridade:\s*'CRITICA'/.test(amostra(9202)),
   'em prioridades diferentes — dá para comparar dourado e vermelho lado a lado');

/* ══ 2. Desenham de verdade ══ */
console.log('\n-- desenham --');
const dom = new JSDOM('<!doctype html><body><div id="lista"></div></body>',
  { pretendToBeVisual: true, runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window, doc = w.document;
w.console = { log(){}, warn(){}, error(){} };
const chamadas = [];
w.API = { post: async (...a) => { chamadas.push(a); return {}; },
          get: async () => ({}), execucoes: {
            repetir:     async (...a) => { chamadas.push(['repetir', ...a]); return {}; },
            desfazerRep: async (...a) => { chamadas.push(['desfazer', ...a]); return {}; } } };
w.SoloDialog = { toast(){} };
const ctx = vm.createContext(w);
vm.runInContext(ler('js', 'glifos.js'), ctx);
vm.runInContext(ler('js', 'missao-card.js'), ctx);
const MC = vm.runInContext('MissaoCard', ctx);

const amostras = [
  { id: 9201, uid: '9201', titulo: 'Responder 5 questões', categoria: 'Estudo',
    prioridade: 'ALTA', dificuldade: 'NORMAL', natureza: 'REPETICAO',
    status_hoje: 'PENDENTE', alvo_repeticoes: 5, repeticoes: 0 },
  { id: 9204, uid: '9204', titulo: 'Cem pulinhos', categoria: 'Combate',
    prioridade: 'ALTA', dificuldade: 'DIFICIL', natureza: 'REPETICAO',
    status_hoje: 'PENDENTE', alvo_repeticoes: 100, repeticoes: 68 },
  { id: 9205, uid: '9205', titulo: 'Questões avulsas', categoria: 'Estudo',
    prioridade: 'MEDIA', dificuldade: 'NORMAL', natureza: 'REPETICAO',
    status_hoje: 'PENDENTE', alvo_repeticoes: null, repeticoes: 87,
    total_contador: 412, unidade_contador: 'questões' },
];
const lista = doc.getElementById('lista');
MC.cachear(amostras);
lista.innerHTML = amostras.map(m => MC.html(m)).join('');
MC.montar(lista, { demo: true });

ok(lista.querySelectorAll('.mc-repeticao').length === 3, 'os três cartões nascem');
ok(lista.querySelector('[data-mc-card="9201"] .mc-rep-trilha'), 'o 0/5 tem trilha');
ok(lista.querySelectorAll('[data-mc-card="9204"] .mc-rep-seg').length === 10,
   'os cem pulinhos viram DEZ blocos');
ok(!lista.querySelector('[data-mc-card="9205"] .mc-rep-trilha'),
   'e o contador livre não tem trilha nenhuma');
ok(lista.querySelector('[data-mc-card="9205"] .mc-cont-num').textContent.trim() === '87',
   '  só o número (87)');

/* ══ 3. O CLIQUE ANDA — e não chama a API ══ */
console.log('\n-- o clique na vitrine --');
const btnMais = c => lista.querySelector(`[data-mc-card="${c}"] [data-mc-acao="repetir"]`);
const conta = c => lista.querySelector(`[data-mc-card="${c}"] [data-mc-rep-conta]`).textContent;
const cheios = c => lista.querySelectorAll(`[data-mc-card="${c}"] .mc-rep-seg.cheio`).length;

ok(cheios(9201) === 0, 'em 0/5 nenhum segmento aceso');
btnMais(9201).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
ok(/1/.test(conta(9201)), 'clicar em + faz a conta andar (1/5)');
ok(cheios(9201) === 1, '  e acende um segmento — dá para JULGAR o desenho');
ok(chamadas.length === 0,
   'e NENHUMA chamada à API: contar de verdade numa vitrine criaria XP de uma amostra');

for (let i = 0; i < 3; i++)
  btnMais(9201).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
ok(cheios(9201) === 4, 'quatro cliques, quatro segmentos');
const menos = lista.querySelector('[data-mc-card="9201"] [data-mc-acao="desfazer-rep"]');
ok(!!menos, 'o − apareceu assim que houve o que desfazer');
menos.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
ok(cheios(9201) === 3, 'e ele volta um');
ok(chamadas.length === 0, '  ainda sem tocar na API');

/* O contador livre também anda. */
lista.querySelector('[data-mc-card="9205"] [data-mc-acao="repetir"]')
     .dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
ok(lista.querySelector('[data-mc-card="9205"] .mc-cont-num').textContent.trim() === '88',
   'o contador livre também anda (88)');
ok(chamadas.length === 0, '  e também sem API');

/* O bloco de dezena enche POR DENTRO — é o ponto do agrupamento. */
const seg7 = () => lista.querySelectorAll('[data-mc-card="9204"] .mc-rep-seg')[6];
const p7 = seg7().getAttribute('style');
lista.querySelector('[data-mc-card="9204"] [data-mc-acao="repetir"]')
     .dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
ok(seg7().getAttribute('style') !== p7,
   'nos cem pulinhos, um clique move o bloco de dezena POR DENTRO (68→69)');
ok(seg7().classList.contains('meio'),
   '  e ele continua sendo o bloco em curso, não pula para o próximo');

/* ══ 4. Não sobrou timer ══ */
console.log('\n-- limpeza --');
MC.desmontar && MC.desmontar(lista);
ok(true, 'desmontar não explode');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
