/* O CARTÃO DA PENITÊNCIA — o giroflex e o cronômetro.

   A PRIMEIRA VERSÃO ERA GÉLIDA, e o Arquiteto derrubou testando:
   "o user bateria o olho e acharia que era só mais uma missão
   rotineira."

   O erro foi meu, e vale registrar porque é o tipo que se repete:
   otimizei para SEMANTICAMENTE CORRETO (punição é consequência, não
   urgência, logo não é vermelha) em vez de LEGÍVEL DE RELANCE. Uma
   punição que não se anuncia não é punição.

   O que este teste prende:

   · o giroflex ALTERNA — dois keyframes com cores diferentes. Um
     cartão vermelho fixo passaria por crítica;
   · a frequência fica LONGE do limiar fotossensível;
   · quitada, o giroflex DESLIGA — continuar piscando puniria quem
     cumpriu;
   · o cronômetro CRESCE e carrega dias;
   · e o `reduced-motion` mantém o sinal, só tira o movimento.

   Uso:  node webapp/frontend/tests/teste_penitencia_card.js
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

console.log('\n=== O CARTÃO DA PENITÊNCIA ===\n');

const dom = new JSDOM('<!doctype html><body></body>',
  { pretendToBeVisual: true, runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window, doc = w.document;
w.console = { log(){}, warn(){}, error(){} };
const ctx = vm.createContext(w);
vm.runInContext(ler('js', 'glifos.js'), ctx);
vm.runInContext(ler('js', 'missao-card.js'), ctx);
const MC = vm.runInContext('MissaoCard', ctx);
const css = ler('css', 'missao-card.css');
const semCom = css.replace(/\/\*[\s\S]*?\*\//g, '');

const agora = Date.now();
/* ISO LOCAL, não UTC.

   A primeira versão usava `toISOString().slice(0,19)`, que devolve UTC
   sem o `Z`. O cartão parseia como hora LOCAL (é o que o servidor
   manda), então num fuso UTC-3 a fixture nascia três horas no futuro e
   o cronômetro clampava em zero.

   O assert acusou o código; o errado era o dado do teste. Vale a
   lembrança: fixture que fabrica o formato errado prova a coisa
   errada. */
const localIso = ms => {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
       + `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const iso = localIso;
const dia = ms => localIso(ms).slice(0, 10);

const pen = (extra = {}) => ({
  id: 1, uid: 'g1', origem: 'geral', titulo: 'Fazer 8 flexões',
  categoria: 'Combate', prioridade: 'ALTA', dificuldade: 'NORMAL',
  natureza: 'PUNICAO', status: 'PENDENTE', editavel: true, gerenciavel: true,
  origem_titulo: 'Passar fio dental',
  origem_data: dia(agora - 2 * 86400000),
  penitencia_desde: iso(agora - 2 * 86400000 - 4 * 3600000),
  xp_a_reparar: 30, ...extra,
});
const frag = html => { const d = doc.createElement('div'); d.innerHTML = html; return d.firstElementChild; };
const bloco = re => { const m = re.exec(semCom); return m ? m[1] : ''; };

/* ══ 1. Ela se anuncia ══ */
console.log('-- ela se anuncia --');
const c = frag(MC.html(pen()));
ok(c.classList.contains('mc-penitencia'), 'o cartão se marca como penitência');
ok(/PENITÊNCIA/.test(bloco(/\.mc-penitencia\s+\.mc-corpo::before\s*\{([^}]*)\}/)),
   'e carrega a PALAVRA no selo — animação sozinha pode ser erro de rede');

/* ══ 2. O GIROFLEX: AS DUAS CORES AO MESMO TEMPO ══ */
console.log('\n-- o giroflex --');
/* A SEGUNDA versão fazia o cartão INTEIRO trocar de vermelho para
   azul. O Arquiteto cortou: "o efeito de giroflex dá a sensação
   imediata das DUAS cores".

   Ele está certo, e é assim que uma viatura funciona: as duas lâmpadas
   estão lá o tempo todo, lado a lado. O que alterna é QUAL ESTÁ ACESA.
   Um cartão que troca de cor inteiro não lê como giroflex — lê como um
   cartão indeciso.

   Estes asserts existem para a terceira versão não voltar a ser a
   segunda. */
const kf = nome => {
  const m = new RegExp('@keyframes\\s+' + nome + '\\s*\\{([\\s\\S]*?)\\n\\}').exec(semCom);
  return m ? m[1] : '';
};
const raiz = bloco(/\.mc-penitencia\s*\{([^}]*)\}/);

ok(/--giro-vermelho:\s*#[0-9a-f]{6}/i.test(raiz) && /--giro-azul:\s*#[0-9a-f]{6}/i.test(raiz),
   'as duas cores são declaradas na raiz');

/* AS DUAS COEXISTEM NA BORDA — mesmo com tudo parado. É o assert que
   separa "giroflex" de "cartão que troca de cor". */
ok(/border-left-color:\s*var\(--giro-vermelho\)/.test(raiz),
   'a borda ESQUERDA é vermelha, fixa');
ok(/border-right-color:\s*var\(--giro-azul\)/.test(raiz),
   'e a DIREITA é azul, fixa — as duas existem mesmo sem animação');

/* O SOPRO alterna INTENSIDADE, não cor. Em cada quadro do keyframe as
   duas cores têm que aparecer. */
const sopro = kf('mc-giro-sopro');
/* Os quadros são extraídos pelas CHAVES, não por `split('%')`. A
   primeira versão partia em todo `%` — inclusive os de dentro do
   `color-mix(... 92%, transparent)` — e comparava fragmentos que não
   eram quadro nenhum. */
const quadros = [...sopro.matchAll(/\{([^}]*)\}/g)].map(m => m[1]);
ok(quadros.length >= 2, 'o halo tem dois quadros');
ok(quadros.every(q => q.includes('--giro-vermelho') && q.includes('--giro-azul')),
   'e em CADA UM deles as duas cores estão presentes — nunca há um '
   + 'instante em que só uma esteja na tela');

/* A BARRA DE LUZ — a peça que mais parece viatura. */
ok(!!c.querySelector('.mc-giroflex'), 'há uma barra de luz no cartão');
ok(!!c.querySelector('.mc-giro-r') && !!c.querySelector('.mc-giro-b'),
   '  com as duas lâmpadas, lado a lado');
const lamp = kf('mc-giro-lampada');
ok(/opacity:\s*\.?[0-9]/.test(lamp), 'elas pulsam por opacidade');
const minOp = Math.min(...[...lamp.matchAll(/opacity:\s*([\d.]+)/g)].map(m => parseFloat(m[1])));
ok(minOp > 0,
   `e nenhuma apaga de todo (mínimo ${minOp}) — viatura tem as duas lentes visíveis`);
ok(/animation-delay:\s*calc\(var\(--giro-ciclo\)\s*\/\s*-2\)/.test(semCom),
   'a azul vai meio ciclo atrasada: em fase, as duas dariam um flash branco');

/* A VELOCIDADE. Ele pediu mais rápido — e o teto de segurança continua. */
const ciclo = parseFloat(/--giro-ciclo:\s*([\d.]+)s/.exec(raiz)[1]);
ok(ciclo <= 1.2,
   `o ciclo é de ${ciclo}s (${(1 / ciclo).toFixed(2)} Hz) — mais rápido que os 2,4s de antes`);
ok(ciclo >= 0.34,
   `  e ainda abaixo de 3 Hz, o limiar fotossensível — este assert existe por `
   + `segurança, não por estética`);

/* CORES VIVAS, não os tons lavados da versão anterior. */
const [rr, rg, rb] = /--giro-vermelho:\s*#(..)(..)(..)/.exec(raiz).slice(1).map(h => parseInt(h, 16));
ok(rr > 220 && rg < 90,
   `o vermelho é vivo (#${rr.toString(16)}${rg.toString(16)}${rb.toString(16)}), não lavado`);

/* A CAVEIRA — o losango é de todo cartão. */
console.log('\n-- a caveira --');
ok(!!c.querySelector('.mc-sigilo-caveira'),
   'o sigilo da penitência é uma CAVEIRA');
ok(!c.querySelector('.mc-sigilo polygon'),
   '  e o losango sumiu — ele é o desenho de toda missão, e dizia "mais uma da lista"');
const comum0 = frag(MC.html({ ...pen(), natureza: 'ATIVA' }));
ok(!!comum0.querySelector('.mc-sigilo polygon'),
   'a missão comum MANTÉM o losango — só a punição troca');
ok(!comum0.querySelector('.mc-sigilo-caveira'), '  e não ganha caveira');
ok(w.Glifos.existe('caveira'), 'e a caveira existe no alfabeto, para quem mais precisar');

/* ══ 3. Quitada, o giroflex desliga ══ */
console.log('\n-- quitada --');
const quit = bloco(/\.mc-penitencia\.mc-concluida,[\s\S]*?\{([^}]*)\}/);
ok(/animation:\s*none/.test(quit),
   'cumprida, o giroflex PARA — continuar piscando puniria quem cumpriu');
ok(/QUITADA/.test(semCom), 'e o selo troca para QUITADA');
ok(/#16a34a|134,239,172|bbf7d0/.test(quit + semCom.slice(semCom.indexOf('mc-penitencia.mc-concluida'))),
   '  em verde: o desfecho bom tem cor de desfecho bom');

/* ══ 4. O CRONÔMETRO CRESCE ══ */
console.log('\n-- o cronômetro --');
const crono = c.querySelector('[data-mc-pen-crono]');
ok(!!crono, 'há um cronômetro, não um texto fixo');
ok(/^2d /.test(crono.textContent),
   `e ele conta DIAS: "${crono.textContent}" — "52h" ninguém lê como dois dias`);
ok(/\d{2}:\d{2}:\d{2}/.test(crono.textContent),
   '  com os segundos ainda correndo: o ponto é "e AINDA está contando"');

ok(MC._durDivida(45) === '0m 45s', 'menos de um minuto: 0m 45s');
ok(MC._durDivida(3725) === '01:02:05', 'menos de um dia: 01:02:05');
ok(MC._durDivida(3 * 86400 + 3725) === '3d 01:02:05', 'mais de um dia: 3d 01:02:05');
ok(MC._durDivida(null) === '', 'sem instante, string vazia — nunca "NaN"');

/* Ele conta do INSTANTE, não da data. Contar da meia-noite mentiria
   por até 24 horas. */
const s1 = MC._segsDivida(pen({ penitencia_desde: iso(agora - 3600000) }));
ok(Math.abs(s1 - 3600) < 120, `conta do INSTANTE (${s1}s para 1h atrás)`);
const s2 = MC._segsDivida(pen({ penitencia_desde: null, origem_data: dia(agora) }));
ok(s2 !== null, '  e cai na data quando o instante falta, em vez de sumir');

/* O timer global tem que MOVER esse número. */
const fonte = ler('js', 'missao-card.js');
ok(/data-mc-pen-crono/.test(fonte.slice(fonte.indexOf('_iniciarTimer'))),
   'o timer global atualiza o cronômetro da dívida');
ok(/!dividas\.length/.test(fonte),
   '  e o intervalo só se encerra quando NÃO há dívida na tela — senão ele '
   + 'morreria e o número congelaria');

/* ══ 5. O que a penitência não oferece ══ */
console.log('\n-- o que ela não negocia --');
const acoes = el => [...el.querySelectorAll('[data-mc-acao]')].map(b => b.dataset.mcAcao);
const a = acoes(c);
ok(!a.includes('cancelar'), 'sem Cancelar');
ok(!a.includes('excluir'), 'sem Excluir — a dívida não se apaga');
ok(!a.includes('pausar'), 'sem Pausar');
ok(a.includes('repetir') || a.includes('concluir'),
   'só o caminho de cumprir');

const semAlvo = frag(MC.html(pen({ alvo_repeticoes: null })));
ok(acoes(semAlvo).includes('concluir'), 'sem alvo, o botão é "Cumprir a penitência"');
const comAlvo = frag(MC.html(pen({ alvo_repeticoes: 8, repeticoes: 3 })));
ok(acoes(comAlvo).includes('repetir'),
   'com alvo, ela se cumpre CONTANDO — mesma mecânica da repetição');
ok(comAlvo.querySelectorAll('.mc-rep-seg').length === 8, '  com os 8 segmentos');

/* ══ 6. De onde ela veio ══ */
console.log('\n-- de onde ela veio --');
ok(/Passar fio dental/.test(c.querySelector('.mc-pen-origem').textContent),
   'o cartão nomeia a falha — punição anônima é arbitrária');
ok(/\+30 XP/.test(c.querySelector('.mc-pen-reparo').textContent),
   'e promete a reparação de quitar');
ok(!frag(MC.html(pen({ origem_titulo: null }))).querySelector('.mc-pen-origem'),
   'sem origem, a linha nem existe');

/* ══ 7. Acessibilidade ══ */
console.log('\n-- acessibilidade --');
const reduz = semCom.slice(semCom.indexOf('prefers-reduced-motion',
                                          semCom.indexOf('.mc-penitencia')));
ok(/\.mc-penitencia[\s\S]{0,200}animation:\s*none/.test(reduz),
   'reduced-motion congela o giroflex');
ok(/--giro-vermelho/.test(reduz),
   '  mas mantém o VERMELHO fixo: o sinal continua lendo como punição');

/* ══ 8. Não virou outra coisa ══ */
console.log('\n-- não contaminou o resto --');
const comum = frag(MC.html({ ...pen(), natureza: 'ATIVA' }));
ok(!comum.classList.contains('mc-penitencia'), 'missão comum não pisca');
ok(!comum.querySelector('[data-mc-pen-crono]'), '  e não tem cronômetro de dívida');
const critica = frag(MC.html({ ...pen(), natureza: 'ATIVA', prioridade: 'CRITICA' }));
ok(!critica.classList.contains('mc-penitencia'),
   'e a CRÍTICA continua sendo crítica — é a alternância que separa as duas');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
