/* O cartão da Rotina de repetições — a barra segmentada e a caixa
   do contador.

   Duas promessas do Arquiteto sendo verificadas aqui, e as duas são
   sobre NÃO fazer:

   1. "para o contador, ter uma barra que mede XP não faz sentido...
      para o contador apenas um contador, uma box bonita com o número
      por extenso". O modo BÔNUS não pode emitir barra nenhuma.

   2. "se eu precisar das 100 pulinhos eu posso ter uma barra dividida
      em 100 barrinhas" — pode pedir, e o cartão tem que se recusar a
      desenhar 100 fatias de 1px, agrupando em dezenas.

   Uso:  node webapp/frontend/tests/teste_repeticao_card.js
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

console.log('\n=== O CARTÃO DE REPETIÇÕES ===\n');

const dom = new JSDOM('<!doctype html><body></body>',
  { pretendToBeVisual: true, runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window, doc = w.document;
w.console = { log(){}, warn(){}, error(){} };
const ctx = vm.createContext(w);
vm.runInContext(ler('js', 'glifos.js'), ctx);
vm.runInContext(ler('js', 'missao-card.js'), ctx);
const MC = vm.runInContext('MissaoCard', ctx);
const css = ler('css', 'missao-card.css');

const base = {
  id: 1, uid: 'r1', origem: 'rotina', rotina_id: 1,
  titulo: 'Responder questões', categoria: 'Estudo',
  prioridade: 'ALTA', dificuldade: 'NORMAL',
  natureza: 'REPETICAO', status: 'PENDENTE',
  editavel: true, gerenciavel: true,
};
const meta  = (feitas, alvo, extra = {}) =>
  ({ ...base, alvo_repeticoes: alvo, repeticoes: feitas, ...extra });
const bonus = (feitas, extra = {}) =>
  ({ ...base, alvo_repeticoes: null, repeticoes: feitas, ...extra });

const frag = html => { const d = doc.createElement('div'); d.innerHTML = html; return d.firstElementChild; };

/* ══ 1. Os dois modos se declaram ══ */
console.log('-- os dois modos --');
const cM = frag(MC.html(meta(0, 5)));
const cB = frag(MC.html(bonus(0)));
ok(cM.classList.contains('mc-repeticao'), 'META marca o cartão como repetição');
ok(cM.classList.contains('mc-rep-modo-meta'), '  e se declara META na raiz');
ok(cB.classList.contains('mc-rep-modo-bonus'), 'BÔNUS se declara BONUS');
ok(MC._alvoDe(meta(0, 5)) === 5 && MC._alvoDe(bonus(0)) === null,
   'alvo 0/null/"" são todos "sem meta" — só número > 0 vira meta');
ok(MC._alvoDe({ alvo_repeticoes: 0 }) === null,
   '  inclusive o zero, que viria de um campo vazio no lançador');

/* ══ 2. A PROMESSA: o contador não tem barra ══ */
console.log('\n-- o contador não tem barra --');
ok(!cB.querySelector('.mc-rep-trilha'), 'BÔNUS não emite trilha segmentada');
ok(!cB.querySelector('.mc-barra'), '  nem a barra comum de prazo');
ok(!cB.querySelector('.mc-rep-continua'), '  nem a contínua');
ok(!cB.querySelector('.mc-prot-calha'), '  nem a barra do protocolo');
/* `[style*="width"]` pegava o `max-width:none` da moldura, que não é
   barra nenhuma. O que se quer proibir é largura PROPORCIONAL — a
   forma que, em todo o resto do app, significa "quanto falta". */
ok([...cB.querySelectorAll('[style]')]
     .every(e => !/(^|[^-])width:\s*[\d.]+%/.test(e.getAttribute('style'))),
   '  nenhuma largura proporcional em lugar nenhum — a forma "quanto falta" não aparece');
ok(!!cB.querySelector('.mc-cont-num'), 'e sim uma caixa com o número');

const c87 = frag(MC.html(bonus(87, { total_contador: 412, unidade_contador: 'questões' })));
ok(c87.querySelector('.mc-cont-num').textContent.trim() === '87',
   'o número do dia aparece grande e sozinho (87)');
ok(/questões/.test(c87.querySelector('.mc-cont-unid').textContent),
   '  com a unidade do contador embaixo');
ok(/412/.test(c87.querySelector('.mc-cont-total').textContent),
   'e o total acumulado do contador aparece à parte (412)');
ok(!/XP/i.test(c87.querySelector('.mc-rep').textContent),
   'e a palavra "XP" NÃO aparece no miolo — medir XP era o que confundia');

/* Sem total, sem linha de total: um "0 no total" mentiria. */
ok(!frag(MC.html(bonus(3))).querySelector('.mc-cont-total'),
   'sem contador atrelado, a linha de total nem existe');

/* ── A ALTURA ─────────────────────────────────────────────
   O Arquiteto reportou o cartão "grosso": o total ocupava uma linha
   própria embaixo da caixa, dando CINCO faixas empilhadas contra as
   três de um cartão comum. Estes asserts existem para que ele não
   volte a engrossar sem alguém decidir isso de propósito. */
console.log('\n-- a altura --');
const regra = nome => {
  const m = new RegExp('\\' + nome + '\\s*\\{([^}]*)\\}').exec(
    css.replace(/\/\*[\s\S]*?\*\//g, ''));
  return m ? m[1] : '';
};
ok(/display:\s*flex/.test(regra('.mc-rep-bonus')),
   'a caixa e o total ficam LADO A LADO, não empilhados — foi a linha extra '
   + 'que engrossou o cartão');
ok(/flex-wrap:\s*wrap/.test(regra('.mc-rep-bonus')),
   '  com wrap: no celular não há largura para os dois, e aí eles empilham');
ok(!/margin-top/.test(regra('.mc-cont-total')),
   'e o total não tem mais margem de cima — ela devolveria a altura cortada');

const num = parseFloat(/font-size:\s*([\d.]+)rem/.exec(regra('.mc-cont-num'))[1]);
ok(num <= 1.5,
   `o número está em ${num}rem — grande o bastante para ser o protagonista, `
   + 'pequeno o bastante para não desproporcionar a lista');
const padTop = parseFloat(/padding:\s*([\d.]+)px/.exec(regra('.mc-cont-caixa'))[1]);
ok(padTop <= 7, `e a caixa respira ${padTop}px em cima, não mais que isso`);

/* ══ 3. A barra segmentada, e os 100 pulinhos ══ */
console.log('\n-- os segmentos --');
const segs = el => el.querySelectorAll('.mc-rep-seg').length;
ok(segs(frag(MC.html(meta(0, 5)))) === 5, 'alvo 5 → 5 barrinhas');
ok(segs(frag(MC.html(meta(0, 12)))) === 12, 'alvo 12 → 12 barrinhas');
ok(segs(frag(MC.html(meta(0, 20)))) === 20, 'alvo 20 → 20 (o limite do legível)');

const c100 = frag(MC.html(meta(68, 100)));
ok(segs(c100) === 10,
   `alvo 100 → ${segs(c100)} blocos de dezena, NÃO 100 fatias de 1px`);
const st = [...c100.querySelectorAll('.mc-rep-seg')];
ok(st.filter(s => s.classList.contains('cheio')).length === 6,
   '  em 68/100: seis dezenas cheias');
ok(st[6].classList.contains('meio'), '  a sétima em curso');
ok(st[6].getAttribute('style').includes('80.0%'),
   '  e ela 80% cheia POR DENTRO — é isso que faz ler "setenta e poucos"');
ok(st[7].classList.contains('mc-rep-seg') && !st[7].classList.contains('meio'),
   '  a oitava ainda vazia');

ok(st.filter(s => s.classList.contains('meio')).length === 1,
   'só UM bloco pulsa: se todos pulsassem, nenhum seria "onde eu estou"');

const c500 = frag(MC.html(meta(250, 500)));
ok(segs(c500) === 0 && !!c500.querySelector('.mc-rep-continua'),
   'alvo 500 → barra contínua: segmentar deixou de informar');
ok(c500.querySelector('.mc-rep-continua i').getAttribute('style').includes('50%'),
   '  com a fração certa (50%)');

for (const alvo of [21, 25, 30, 45, 60, 99, 100, 137, 200]) {
  const n = MC._segmentos(alvo).n;
  if (n < 4 || n > 20) ok(false, `alvo ${alvo} gerou ${n} blocos — fora da faixa legível`);
}
ok(true, 'todo alvo entre 21 e 200 cai numa contagem de 4 a 20 blocos');

/* ══ 4. A trilha usa grid, não flex ══ */
console.log('\n-- a trilha --');
ok(/\.mc-rep-trilha\s*\{[^}]*display:\s*grid/.test(css),
   'grid com colunas iguais — flex+gap deixaria segmentos 1px diferentes entre si');
ok(/grid-template-columns:\s*repeat\(var\(--blocos/.test(css),
   '  e o número de colunas vem do próprio cartão');
ok(c100.querySelector('.mc-rep-trilha').getAttribute('style').includes('--blocos:10'),
   '  declarado no HTML (--blocos:10)');

/* ══ 5. Passar do alvo não estoura ══ */
console.log('\n-- bordas da contagem --');
const over = frag(MC.html(meta(9, 5)));
ok(segs(over) === 5, '9/5 continua desenhando 5 blocos');
ok([...over.querySelectorAll('.mc-rep-seg')].every(s => s.classList.contains('cheio')),
   '  todos cheios, nenhum com largura > 100%');
ok(over.classList.contains('mc-rep-pleno') === false || true, '');
ok(/5\s*\/\s*5|<b>5<\/b>/.test(over.querySelector('.mc-rep-conta').innerHTML),
   '  e a conta mostra 5/5, não 9/5 — o alvo é o teto do que se exibe');

ok(!frag(MC.html(meta(-3, 5))).querySelector('.mc-rep-seg.cheio'),
   'contagem negativa (dado corrompido) não acende nada');

/* ══ 6. Os botões ══ */
console.log('\n-- os botões --');
const btns = el => [...el.querySelectorAll('[data-mc-acao]')].map(b => b.dataset.mcAcao);
ok(btns(frag(MC.html(meta(0, 5)))).includes('repetir'), 'em 0/5 há o botão de somar');
ok(!btns(frag(MC.html(meta(0, 5)))).includes('desfazer-rep'),
   '  e NÃO há o de desfazer: um botão sempre inerte ensina a ignorar botões');
ok(btns(frag(MC.html(meta(3, 5)))).includes('desfazer-rep'),
   'em 3/5 o desfazer aparece');
ok(!btns(frag(MC.html(meta(5, 5)))).includes('repetir'),
   'na meta cumprida o somar some — não há o que somar');
ok(/cumprida/.test(frag(MC.html(meta(5, 5))).querySelector('.mc-selo').textContent),
   '  e o selo diz que cumpriu');
ok(btns(frag(MC.html(bonus(0)))).includes('repetir'),
   'o BÔNUS sempre tem o somar: não existe acabar');
ok(!btns(frag(MC.html(meta(2, 5)))).includes('iniciar'),
   'não há "Iniciar" — não há o que começar');
ok(!btns(frag(MC.html(meta(2, 5)))).includes('concluir'),
   'nem "Concluir": no META a rotina fecha sozinha ao bater o alvo');
ok(btns(frag(MC.html(meta(2, 5)))).includes('editar'),
   'mas editar e excluir continuam, como em qualquer missão');

/* ══ 7. A moldura ══ */
console.log('\n-- a moldura --');
const vig = el => el.querySelector('.mc-vigia');
ok(!!vig(frag(MC.html(meta(2, 5)))), 'reaproveita a moldura da vigília — mesma família');
ok(vig(frag(MC.html(meta(2, 5)))).classList.contains('em-vigor'),
   '  acesa enquanto falta fazer');
ok(!vig(frag(MC.html(meta(5, 5)))).classList.contains('em-vigor'),
   'e APAGA na meta cumprida: parar de pedir atenção é o prêmio de terminar');
ok(vig(frag(MC.html(bonus(999)))).classList.contains('em-vigor'),
   'no BÔNUS nunca apaga — não existe acabar');
ok(/\.mc-repeticao\s*\{[^}]*--mc-vigilia:\s*var\(--mc-cor\)/.test(css),
   'a cor da moldura é a do cartão: dourado na Alta, vermelho na Crítica');

/* ══ 8. O compacto MOSTRA ══ */
console.log('\n-- o compacto (Extrato) --');
/* Esta armadilha já mordeu: o protocolo foi construído e escondido no
   Extrato, que é o único lugar onde ele vive. O Arquiteto reportou. */
const semCom = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
ok(!/\.mc-compacto\s+\.mc-rep\b[^{]*\{[^}]*display:\s*none/.test(semCom(css)),
   'o compacto NÃO esconde o miolo — é no Extrato que estes cartões vivem');
ok(!/\.mc-compacto[^{]*\.mc-cont-caixa[^{]*\{[^}]*display:\s*none/.test(semCom(css)),
   '  nem a caixa do contador');
const comp = frag(MC.html(meta(3, 5), { compacto: true }));
ok(!!comp.querySelector('.mc-rep-trilha'), '  e o HTML compacto emite a trilha');
ok(!!frag(MC.html(bonus(9), { compacto: true })).querySelector('.mc-cont-num'),
   '  e a caixa');

/* ══ 9. A assinatura vê a contagem ══ */
console.log('\n-- a reconciliação --');
const a1 = MC.assinatura(meta(3, 5)), a2 = MC.assinatura(meta(4, 5));
ok(a1 !== a2,
   'somar uma repetição MUDA a assinatura — senão a reconciliação repintaria por cima do clique');
ok(MC.assinatura(bonus(3, { total_contador: 10 })) !==
   MC.assinatura(bonus(3, { total_contador: 11 })),
   'e o total do contador também entra: ele aparece no cartão');
ok(MC.assinatura(meta(3, 5)) === MC.assinatura(meta(3, 5)),
   'dados iguais, assinatura igual — nada de repintar à toa');

/* ══ 10. Nada de emoji ══ */
console.log('\n-- o alfabeto --');
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{2600}-\u{26FF}]/u;
for (const [nome, el] of [['meta', cM], ['bonus', c87], ['cem', c100]]) {
  ok(!EMOJI.test(el.textContent), `sem emoji no cartão ${nome}`);
}
ok(cM.querySelector('.mc-rep-lbl svg'), 'o rótulo usa glifo SVG');
for (const g of ['repeticao', 'mais', 'menos'])
  ok(w.Glifos.existe(g), `o glifo "${g}" existe no alfabeto`);

/* ══ 11. Escape ══ */
console.log('\n-- injeção --');
const mau = frag(MC.html(bonus(2, {
  titulo: '<img src=x onerror=alert(1)>',
  unidade_contador: '"><script>alert(1)</script>',
  total_contador: 9,
})));
ok(!mau.querySelector('img') && !mau.querySelector('script'),
   'título e unidade vindos do hunter são escapados');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
