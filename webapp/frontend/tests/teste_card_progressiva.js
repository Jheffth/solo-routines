/* O CARTÃO DO DESAFIO PROGRESSIVO — o fundo que conta o placar.

   O QUE ESTE ARQUIVO EXISTE PARA PRENDER

   A progressiva era o único tipo de missão sem linguagem visual própria:
   ganhava o rótulo, a barra de dias, e no fundo o MESMO chevron
   deslizante de qualquer missão ATIVA. Olhando de longe, um desafio de
   30 dias no dia 28 era indistinguível de uma tarefa qualquer.

   O efeito novo (`.mc-prog-escada`) é um campo de brasas subindo cuja
   INTENSIDADE é o placar: `--prog-carga` = dias_ok / alvo. É a parte
   que nenhum outro cartão faz, e é a que este teste protege — porque um
   refactor que largue a variável no caminho não quebra nada: o fundo
   simplesmente volta a ser constante, e ninguém percebe.

   A ARTE NÃO É MEDIDA AQUI. "Está bonito?" nenhum assert responde — a
   prévia renderizada é que responde, e foi o que reprovou a primeira
   versão (degraus horizontais que na tela liam como caderno pautado).
   O que se mede aqui é o que o refactor quebra em silêncio: a variável
   chegar, o elemento nascer nos estados certos, e o fundo não ter DUAS
   tramas brigando.

   Uso:  node webapp/frontend/tests/teste_card_progressiva.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}

/* Comentário mente em busca de texto cru — aconteceu quatro vezes neste
   projeto, incluindo um assert que casou com o comentário explicando
   por que a coisa NÃO era usada. */
const semComentarios = txt => txt
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const ctx = vm.createContext({ window: {}, document: { addEventListener() {} }, console });
vm.runInContext(ler('js', 'missao-card.js'), ctx);
const MC = vm.runInContext(
  'typeof MissaoCard !== "undefined" ? MissaoCard : window.MissaoCard', ctx);

const CSS = ler('css', 'missao-card.css');
const CSS_LIMPO = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

function missao(extra) {
  return Object.assign({
    id: 1, titulo: 'Meditar', status: 'ATIVA', status_hoje: 'ATIVA',
    prioridade: 'ALTA', dificuldade: 'DIFICIL', categoria: 'Mente',
    xp_recompensa: 120, moedas_recompensa: 30, penalidade_xp: 80,
    eh_progressiva: true, dias_progressivos_alvo: 30, dias_progressivos_ok: 2,
  }, extra);
}
const carga = h => {
  const m = h.match(/--prog-carga:\s*([0-9.]+)/);
  return m ? parseFloat(m[1]) : null;
};

console.log('\n-- a carga chega ao cartão, e é a fração da corrente --');
ok(typeof MC._cargaProgressiva === 'function', '_cargaProgressiva existe');
ok(Math.abs(MC._cargaProgressiva(missao({ dias_progressivos_ok: 15 })) - .5) < 1e-9,
   '15 de 30 ⇒ carga 0.5');
ok(MC._cargaProgressiva(missao({ dias_progressivos_ok: 0 })) === 0, '0 de 30 ⇒ 0');
ok(MC._cargaProgressiva(missao({ dias_progressivos_ok: 99 })) === 1,
   '99 de 30 ⇒ 1 (não estoura — o backend pode adiantar o contador)');
ok(MC._cargaProgressiva(missao({ dias_progressivos_alvo: null })) === 0,
   'sem alvo declarado ⇒ 0, e o fundo fica no mínimo em vez de sumir');
ok(MC._cargaProgressiva({}) === 0, 'missão sem os campos não explode');

const h2 = MC.html(missao({ dias_progressivos_ok: 2 }), {});
const h28 = MC.html(missao({ dias_progressivos_ok: 28 }), {});
ok(carga(h2) !== null, 'a variável --prog-carga é emitida no style da raiz');
ok(carga(h28) > carga(h2),
   `dia 28 mais carregado que dia 2 (${carga(h2)} → ${carga(h28)}) — é isto ` +
   'que faz o fundo do cartão esquentar conforme a corrente cresce');

const comum = MC.html(missao({ eh_progressiva: false }), {});
ok(!/--prog-carga/.test(comum),
   'missão comum NÃO recebe a variável (nada de custo em cartão que não usa)');

console.log('\n-- o elemento nasce nos estados certos --');
const temEscada = h => /class="mc-prog-escada"/.test(h);
ok(temEscada(h2), 'ATIVA tem a escada');
ok(temEscada(MC.html(missao({ status: 'PENDENTE', status_hoje: 'PENDENTE' }), {})),
   'PENDENTE também — o desafio existe antes de começar o dia');
ok(temEscada(MC.html(missao({ status: 'FRACASSADA', status_hoje: 'FRACASSADA' }), {})),
   'FRACASSADA MANTÉM a escada: a derrota da progressiva é definitiva ' +
   '(FRACASSADA_FATAL, sem Reerguer) e o cartão precisa mostrar o que ruiu');
/* CONCLUIDA DEIXOU DE SER UMA RESPOSTA SÓ.

   Antes, CONCLUIDA tirava a escada — "virou história". Estava errado
   para o dia 1 de 30: o desafio não virou história nenhuma, só o dia
   dele acabou. O Arquiteto viu no cartão real ("a missão só conclui
   quando eu cumprir ela totalmente") e a regra passou a depender do
   PLACAR, não do status. */
ok(temEscada(MC.html(missao({ status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
                              dias_progressivos_ok: 1 }), {})),
   'CONCLUIDA no dia 1 de 30 MANTÉM a escada — é etapa, não desfecho');
ok(!temEscada(MC.html(missao({ status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
                              dias_progressivos_ok: 30 }), {})),
   'CONCLUIDA em 30 de 30 tira — aí sim virou história');

console.log('\n-- etapa cumprida não é desafio cumprido --');
const etapa = m => MC._etapaProgressiva(m);
ok(etapa(missao({ status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
                  dias_progressivos_ok: 1 })), 'dia 1 de 30 é etapa');
ok(!etapa(missao({ status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
                   dias_progressivos_ok: 30 })), 'dia 30 de 30 NÃO é etapa');
ok(!etapa(missao({ status: 'ATIVA', status_hoje: 'ATIVA' })),
   'missão ainda em curso não é etapa');
ok(!etapa(missao({ status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
                   dias_progressivos_alvo: null })),
   'sem alvo declarado não há etapa — CONCLUÍDA é conclusão mesmo');
ok(!etapa({ status: 'CONCLUIDA' }), 'missão comum concluída não é etapa');

const hEtapa = MC.html(missao({ status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
                                dias_progressivos_ok: 1 }), {});
const hFim = MC.html(missao({ status: 'CONCLUIDA', status_hoje: 'CONCLUIDA',
                              dias_progressivos_ok: 30 }), {});
ok(/mc-prog-etapa/.test(hEtapa) && !/mc-prog-etapa/.test(hFim),
   'só a etapa carrega a classe que desarma o verde');
ok(!/Missão cumprida/.test(hEtapa),
   'a etapa NÃO diz "Missão cumprida" — era a mentira do cartão');
ok(/Dia 1 de 30/.test(hEtapa) && /volta amanhã/.test(hEtapa),
   'ela diz quanto do desafio está de pé e que ele volta');
ok(/Missão cumprida/.test(hFim),
   'e o desfecho de verdade mantém o selo de sempre');

/* O VERDE É O ATIVO QUE SE PROTEGE AQUI. A regra do projeto reserva
   verde para missão CUMPRIDA; gastá-lo numa etapa esvazia o dia em que
   os 30 dias fecharem. O assert olha a CASCATA: `.mc.st-concluida` dá
   o verde, e a regra de etapa tem de vir DEPOIS e ser mais específica
   (2 classes vs 1), senão ela perde e o cartão fica verde do mesmo
   jeito — foi exatamente assim que a penitência custou dois "corrigido"
   falsos neste projeto. */
const iVerde = CSS_LIMPO.indexOf('.mc.st-concluida {');
const iEtapa = CSS_LIMPO.indexOf('.mc.st-concluida.mc-prog-etapa {');
ok(iVerde >= 0 && iEtapa > iVerde,
   'a regra da etapa vem depois da regra verde na cascata');
ok(/\.mc\.st-concluida\.mc-prog-etapa\s*\{[^}]*border-left-color:\s*var\(--mc-cor\)/
     .test(CSS_LIMPO),
   'e troca a borda verde pela cor do próprio desafio');
ok(/\.mc\.st-concluida\.mc-prog-etapa\s+\.mc-titulo\s*\{[^}]*text-decoration:\s*none/
     .test(CSS_LIMPO),
   'o título não é riscado: a linha volta amanhã e por mais 29 dias');

console.log('\n-- (retomando) os estados do elemento --');
ok(!temEscada(MC.html(missao({ status: 'CANCELADA', status_hoje: 'CANCELADA' }), {})),
   'CANCELADA não');
ok(!temEscada(comum), 'e missão comum nunca tem');
ok(/class="mc[^"]*\bmc-progressiva\b/.test(h2),
   'a raiz carrega mc-progressiva — é dela que todo o CSS pende');

console.log('\n-- a assinatura reconhece a mudança (senão o fundo fica velho) --');
const sig = m => MC.assinatura(m, {});
ok(sig(missao({ dias_progressivos_ok: 2 })) !== sig(missao({ dias_progressivos_ok: 3 })),
   'avançar um dia muda a assinatura ⇒ o cartão repinta');
ok(sig(missao({ dias_progressivos_alvo: 30 })) !== sig(missao({ dias_progressivos_alvo: 10 })),
   'e EDITAR O ALVO também — a carga é a razão entre os dois, e só o ' +
   'placar na assinatura deixaria o fundo na intensidade antiga');

console.log('\n-- uma trama só no fundo --');
/* O defeito que isto pega: `.mc-corrente` é emitida para TODO status
   ATIVA, inclusive o da progressiva. Duas tramas deslizando em ritmos
   diferentes no mesmo fundo brigam e o cartão vira ruído. A penitência
   e a passiva resolvem assim, neste mesmo arquivo. */
ok(/\.mc-progressiva\s+\.mc-corrente\s*\{[^}]*display:\s*none/.test(CSS_LIMPO),
   'a progressiva desliga os chevrons da .mc-corrente');
ok(/\.mc-penitencia\s+\.mc-prog-escada\s*\{[^}]*display:\s*none/.test(CSS_LIMPO),
   'e a PENITÊNCIA vence a progressiva: dívida é a emergência do momento');

console.log('\n-- linguagem própria, não um primo do giroflex --');
/* Foi este o defeito que reprovou duas auras neste projeto: arte nova
   falando a língua da arte velha. A varredura da penitência é UM
   gradiente linear deslizando na horizontal; a progressiva tem de ser
   outra coisa, não a mesma coisa em outra cor. */
const bloco = (sel) => {
  const i = CSS_LIMPO.indexOf(sel + ' {');
  if (i < 0) throw new Error('seletor não encontrado no CSS: ' + sel);
  const f = CSS_LIMPO.indexOf('}', i);
  if (f < 0 || f - i < 20) throw new Error('bloco vazio ou truncado: ' + sel);
  return CSS_LIMPO.slice(i, f);
};
const escada = bloco('.mc-prog-escada');
const varredura = bloco('.mc-giro-varredura');
const anim = txt => (txt.match(/animation:\s*([a-z-]+)/) || [])[1];
ok(anim(escada) && anim(varredura) && anim(escada) !== anim(varredura),
   `keyframes diferentes (${anim(escada)} ≠ ${anim(varredura)}) — sem isto ` +
   'o efeito novo seria o giroflex repintado');
ok(/radial-gradient/.test(escada) && !/radial-gradient/.test(varredura),
   'a escada é feita de brasas (radial), a varredura de faixa (linear)');
ok(new RegExp('@keyframes\\s+' + anim(escada)).test(CSS_LIMPO),
   'o keyframe da escada existe de fato (referência órfã já aconteceu aqui)');

/* UMA ANIMAÇÃO POR ELEMENTO. O comentário da `.mc-corrente` avisa que
   duas animações no mesmo elemento se cancelam nesta base de código, e
   que isso já custou uma tarde. A profundidade das brasas vem de
   deslocamentos DIFERENTES por camada dentro do mesmo keyframe. */
ok((escada.match(/animation:/g) || []).length === 1,
   'um `animation:` só na escada');
/* CASA AS CHAVES em vez de procurar o primeiro '}'. A primeira versão
   fazia indexOf('}') e parava no fim do bloco `from`, antes do `to` —
   e os três asserts abaixo mediam uma string vazia, achavam NaN e
   reprovavam CSS correto. Fatia mal-feita já produziu neste projeto o
   contrário disso, que é pior: assert PASSANDO sobre nada. */
function blocoChaves(marca) {
  const i = CSS_LIMPO.indexOf(marca);
  if (i < 0) throw new Error('não achei: ' + marca);
  let nivel = 0;
  for (let j = CSS_LIMPO.indexOf('{', i); j < CSS_LIMPO.length; j++) {
    if (CSS_LIMPO[j] === '{') nivel++;
    else if (CSS_LIMPO[j] === '}' && --nivel === 0) return CSS_LIMPO.slice(i, j + 1);
  }
  throw new Error('chave não fechou: ' + marca);
}
const kf = blocoChaves('@keyframes ' + anim(escada));
ok(/from\s*\{/.test(kf) && /to\s*\{/.test(kf),
   'o bloco do keyframe foi lido inteiro (from E to) — não uma fatia dele');
const destinos = (kf.match(/to\s*\{\s*background-position:\s*([^;}]+)/) || [])[1] || '';
const passos = destinos.split(',').map(s => s.trim());
ok(passos.length === 4, `o keyframe move as 4 camadas (achei ${passos.length})`);
const px = passos.slice(0, 3).map(s => Math.abs(parseFloat((s.match(/(-?\d+)px/) || [])[1])));
ok(px[0] > px[1] && px[1] > px[2],
   `as três camadas de brasa andam distâncias diferentes (${px.join(' > ')}) — ` +
   'é a paralaxe; iguais, o campo vira um padrão chapado');

/* O deslocamento tem de ser a ALTURA DO LADRILHO da camada, senão o
   padrão salta na virada do ciclo. Erro que não quebra nada e só
   aparece a olho, olhando muito tempo. */
const tamanhos = (escada.match(/background-size:\s*([^;]+)/) || [])[1] || '';
const alturas = tamanhos.split(',').slice(0, 3)
  .map(s => parseFloat(s.trim().split(/\s+/)[1]));
ok(alturas.every((a, i) => a === px[i]),
   `cada camada anda exatamente a altura do seu ladrilho ` +
   `(${alturas.join('/')} vs ${px.join('/')}) — o loop não salta`);

console.log('\n-- acessibilidade e o estado morto --');
const rm = CSS_LIMPO.slice(CSS_LIMPO.indexOf('@media (prefers-reduced-motion'));
ok(/\.mc-prog-escada\s*\{[^}]*animation:\s*none/.test(rm),
   'reduced-motion para as brasas');
ok(/\.mc-prog-escada[\s\S]{0,400}?opacity:\s*calc\([^)]*--prog-carga/.test(CSS_LIMPO),
   'mas a CARGA continua pintada — o movimento era o jeito de contar, ' +
   'não a informação');
const morta = bloco('.mc-progressiva.st-fracassada .mc-prog-escada');
ok(/animation:\s*none/.test(morta) && /grayscale/.test(morta),
   'fracassada: as brasas congelam e perdem a cor');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
