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

/* ══ 3. Quitada: A LÁPIDE ══ */
console.log('\n-- quitada: a lápide --');
/* O Arquiteto: "a dívida quitada está verde e não cinza... precisa ter
   o cinza por cima, a borda tem que parar de piscar e virar cinza
   também."

   O QUE ACONTECEU, e é a lição mais útil deste arquivo:

   A regra existia e mirava `.mc-penitencia.mc-concluida`. Essa classe
   NÃO EXISTE — o estado vem de `STATUS[x].classe`, que usa `st-`. Nada
   ficava cinza.

   E O TESTE PASSOU. Ele lia o CSS, achava a regra escrita, e dava OK.
   Provou que a REGRA EXISTE; nunca que ela CASA com um cartão. Um
   teste que lê dois arquivos separados não percebe que eles não se
   falam.

   Os asserts abaixo CRUZAM os dois: extraem o seletor do CSS e
   perguntam ao cartão renderizado `el.matches(seletor)`. */
const quitado = frag(MC.html(pen({
  status: 'CONCLUIDA', alvo_repeticoes: 30, repeticoes: 30, xp_ganho: 22,
})));

/* O CRUZAMENTO. Este é o assert que teria pego o bug. */
const seletorLapide = /(\.mc-penitencia\.[a-z-]+),/.exec(semCom)?.[1] || '';
ok(!!seletorLapide, `o CSS tem uma regra de lápide (${seletorLapide})`);
ok(quitado.matches(seletorLapide),
   `e o cartão quitado CASA com ela — classes reais: "${[...quitado.classList].join(' ')}"`);
ok(!quitado.matches('.mc-penitencia.mc-concluida'),
   '  (e NÃO com `mc-concluida`, que era o seletor errado da versão anterior)');

const quit = bloco(new RegExp(seletorLapide.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                              + '[\\s\\S]*?\\{([^}]*)\\}'));
ok(/animation:\s*none/.test(quit),
   'cumprida, o giroflex PARA — continuar piscando puniria quem cumpriu');
ok(/filter:\s*grayscale\(1\)/.test(quit),
   'e um CINZA cobre o cartão inteiro — inclusive a barra vermelha e os chips');
ok(/opacity:\s*\.[0-9]/.test(quit), '  com opacidade reduzida: lápide');
ok(/border-color:\s*rgba\(148,163,184/.test(quit),
   'a BORDA vira cinza — o Arquiteto pediu que ela parasse de piscar E mudasse de cor');
ok(!/#16a34a/.test(quit), 'e o verde saiu: "vencida" não é "vitória"');

/* A BARRA DE LUZ some. Ela é `position:absolute` e o `grayscale` a
   deixaria cinza mas presente — e uma barra cinza no topo pareceria
   defeito. */
const barra = semCom.match(new RegExp(seletorLapide.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              + '[\\s\\S]{0,400}?\\.mc-giroflex[^}]*\\{([^}]*)\\}'));
ok(barra && /display:\s*none/.test(barra[1]),
   'a barra de luz some de vez — cinza no topo pareceria defeito');

/* E a trilha para de pulsar: o cinza tira a cor, mas o MOVIMENTO
   continuaria, e movimento numa coisa encerrada é ruído. */
ok(/\.st-concluida\s+\.mc-rep-seg\.meio::after[\s\S]{0,140}animation:\s*none/.test(semCom),
   'a trilha cumprida para de pulsar');

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

/* ══ 9. O LUGAR RESERVADO — E O QUE ELE NÃO MOSTRA ══ */
console.log('\n-- o lugar reservado --');
/* "a área do pacto é só um container, onde os pactos estarão visíveis,
   é igual à aba das rotinas. Quando necessários eles vão para o
   dashboard. Os pactos concluídos são visíveis no dashboard, em cinza,
   NUNCA AQUI."

   A primeira versão listava aqui as dívidas em aberto e as quitadas —
   ocorrência dentro da página de REGRA. É exatamente a confusão que o
   cabeçalho de `extrato.py` documenta como o defeito original do
   projeto:

     ROTINA é a REGRA · ExecucaoDia é a OCORRÊNCIA
     PACTO  é a REGRA · PENITÊNCIA  é a OCORRÊNCIA

   Estes asserts existem para a página não voltar a inchar. */
const html = ler('index.html');
ok(/data-page="pacto"/.test(html), 'há um item de menu para o Pacto');
ok(/id="page-pacto"/.test(html), '  e a página existe');
ok(/id="nav-pacto-badge"/.test(html),
   'com um selo no menu — a dívida é lembrada de outra tela');

const pagina = html.slice(html.indexOf('id="page-pacto"'),
                          html.indexOf('id="page-dungeons"'));
ok(/id="pacto-lista"/.test(pagina), 'a página tem o CARDÁPIO');
ok(!/id="pacto-abertas"/.test(pagina),
   'e NÃO lista as dívidas em aberto — elas são ocorrência, e vivem no Dashboard');
ok(!/id="pacto-quitadas"/.test(pagina),
   'nem as quitadas: "em cinza no dashboard, NUNCA AQUI"');
ok(/id="pacto-aviso"/.test(pagina),
   'só um PONTEIRO para o Dashboard — como a aba Rotinas faz com "Ver missões de hoje"');

const app = ler('js', 'app.js');
ok(/case 'pacto':/.test(app), 'o roteador conhece a página');
const pj = ler('js', 'pages', 'pacto.js');
ok(!/MissaoCard\.html/.test(pj),
   'e a página NÃO desenha cartão de missão — se desenhasse, seria ocorrência de novo');
ok(!/\/pactos\/penitencias/.test(pj),
   '  nem busca as penitências: dado que ela não pode mostrar, ela não pede');
ok(/App\?\.navigate\?\.\('dashboard'\)/.test(pj),
   'o ponteiro usa `App.navigate` — o nome que existe de verdade');
ok(/cardápio muda, a dívida não|dívida não/.test(pj),
   'e remover do pacto avisa que a dívida já cobrada CONTINUA');

/* A REGRA E A OCORRÊNCIA usam nomes diferentes no código, e é isso que
   impede a confusão de voltar. */
ok(/PACTO\s+é a REGRA/.test(pj),
   'o arquivo declara a separação regra × ocorrência no cabeçalho');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
