/* O PACTO NA FORJA — o terceiro tipo.

   O pacto não é uma missão. Ele não tem frequência, prioridade,
   dificuldade, categoria nem recompensa — ele COBRA, não paga. Metade
   deste arquivo existe para provar que nenhum daqueles blocos sobrou na
   tela, porque um formulário que mostra "XP: 120" ao lado de uma
   penitência está mentindo sobre o que cria.

   A outra metade guarda a ESCADA: um pacto só assusta quando o hunter vê
   para onde ele cresce. "Fazer 1 flexão" é inofensivo; "1 › 2 › 4 › 8 ›
   16 › 32" é um contrato.

   Uso:  node webapp/frontend/tests/teste_pacto_lancador.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

/* ARMADILHA JÁ PAGA — não reintroduzir.

   A primeira versão deste arquivo fatiava com
   `fonte.slice(fonte.indexOf('_atualizar'), fonte.indexOf('_fmtPrazo'))`
   — e `_fmtPrazo` fica ANTES de `_atualizar` no arquivo. A fatia saiu
   vazia, e um dos dois asserts que a usavam PASSOU, porque procurar
   "não deve conter X" em string vazia dá verdadeiro sempre.

   Um assert que passa medindo nada é pior que um que falha: ele mente e
   ninguém desconfia. `fatia` explode se os marcos vierem invertidos ou
   se o resultado for pequeno demais para conter o que se procura. */
function fatia(txt, de, ate, min = 40) {
  const i = txt.indexOf(de);
  const j = ate ? txt.indexOf(ate, i + 1) : txt.length;
  if (i < 0) throw new Error(`marco inicial ausente: ${de}`);
  if (ate && j < 0) throw new Error(`marco final ausente depois de ${de}: ${ate}`);
  const r = txt.slice(i, ate ? j : undefined);
  if (r.length < min) throw new Error(`fatia curta demais (${r.length}) entre ${de} e ${ate}`);
  return r;
}

/* Buscar palavra em código-fonte cru acha o COMENTÁRIO que explica a
   decisão. Já aconteceu neste projeto mais de uma vez — inclusive neste
   arquivo, cujo assert "nenhuma escala hardcoded" casava com o comentário
   dizendo que a escala NÃO está aqui. */
const semComentarios = txt => txt
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

let falhas = 0, testes = 0;
function ok(cond, msg) {
  testes++; if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
}

/* Um DOM de mentirinha: só o suficiente para a Forja não explodir.
   jsdom seria mais fiel, mas aqui o que importa é o HTML gerado e a
   lógica da escada — não o layout. */
const nos = {};
function noFalso(id) {
  return nos[id] || (nos[id] = {
    id, style: { display: '', setProperty() {} }, value: '', textContent: '',
    innerHTML: '', placeholder: '', disabled: false, classList: {
      _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
  });
}
const ctx = vm.createContext({
  console, window: {},
  API: { get: async () => ({ tipos: [] }), post: async () => ({}), patch: async () => ({}) },
  Glifos: { rico: () => '<svg/>', linha: () => '<svg/>' },
  SoloDialog: { toast() {} },
  document: {
    addEventListener() {}, createElement: () => noFalso('novo'),
    getElementById: id => noFalso(id),
    querySelector: () => noFalso('q'), querySelectorAll: () => [],
    body: { appendChild() {} },
  },
});
vm.runInContext(ler('js', 'forja-missao.js'), ctx);
const F = vm.runInContext('ForjaMissao', ctx);

console.log('\n-- o PACTO existe como tipo --');
/* ERAM TRÊS; a PROGRESSIVA entrou depois e o assert ficou para trás,
   vermelho, avisando de uma mudança que já tinha sido aprovada. Prender
   o número exato é o certo — é assim que um tipo somem por acidente. */
ok(F.TIPOS.length === 4, `quatro tipos na Forja (${F.TIPOS.map(t => t.id).join(', ')})`);
const tp = F.TIPOS.find(t => t.id === 'PACTO');
ok(!!tp, 'PACTO está no catálogo de tipos');
ok(tp && tp.ico === 'caveira', 'usa o glifo da caveira — o mesmo da penitência');
ok(F.PACTO_TIPOS.length === 4, 'quatro modos de penitência');
ok(F.PACTO_TIPOS.map(t => t.id).join() === 'QUANTITATIVA,RESTRITIVA,TEMPORAL,TRIBUTO',
   'os quatro modos batem com motors/pactos.py');

console.log('\n-- a escala vem do SERVIDOR, não de uma cópia local --');
ok(F.PACTO_TIPOS.every(t => t.escala === null),
   'os fatores nascem vazios (uma cópia local seria a segunda verdade)');
ok(typeof F._consultarPactos === 'function', 'existe quem vá buscá-los');
ok(!/ESCALA_DO_TIPO|escala:\s*2\.0|escala:\s*1\.5/.test(semComentarios(ler('js', 'forja-missao.js'))),
   'nenhum fator de escala hardcoded no CÓDIGO (os comentários podem citá-la)');
ok(/ESCALA_DO_TIPO/.test(ler('js', 'forja-missao.js')),
   'e os comentários CITAM ESCALA_DO_TIPO — prova que o filtro de comentários agiu');

console.log('\n-- a escada --');
F._estado = { tipo: 'PACTO', titulo: 'Fazer {n} flexões',
              pct_tipo: 'QUANTITATIVA', pct_base: 1, pct_teto: 32 };
F.PACTO_TIPOS[0].escala = 2.0;
F.PACTO_TIPOS[2].escala = 1.5;
let esc = F._escada();
ok(esc.degraus.join() === '1,2,4,8,16,32', 'quantitativa dobra: 1 2 4 8 16 32');
ok(esc.fixa === false, 'e escala');

F._estado.pct_tipo = 'TEMPORAL'; F._estado.pct_base = 20; F._estado.pct_teto = 180;
esc = F._escada();
ok(esc.degraus[0] === 20 && esc.degraus[1] === 30 && esc.degraus[2] === 45,
   'temporal sobe 1,5× — dobrar MINUTOS chega ao absurdo rápido demais');
ok(esc.degraus[esc.degraus.length - 1] <= 180, 'nunca passa do teto');

/* DIVERGÊNCIA REAL ENCONTRADA no backend, e este assert existe para que
   ninguém a "conserte" de volta:

       ESCALA_DO_TIPO[RESTRITIVA] = None   // "não escala por reincidência"
       escalar(12, RESTRITIVA, 48)  → 24   // dobra

   O `None` significa duas coisas diferentes nos dois lugares. Enquanto o
   Arquiteto não decide qual vale, o endpoint reporta o fator MEDIDO
   (motors/pactos.fator_efetivo), e a escada desenha o que o Sistema
   realmente faz. Prometer "não escala" e dobrar seria a prévia mentindo
   — que é o oposto do motivo dela existir. */
F._estado.pct_tipo = 'RESTRITIVA';
F.PACTO_TIPOS[1].escala = 2.0;          // o que o servidor devolve hoje
F._estado.pct_base = 12; F._estado.pct_teto = 48;
esc = F._escada();
ok(esc.degraus.join() === '12,24,48', 'a restritiva desenha o que o servidor FAZ (12 24 48)');

/* O caminho "não escala" continua existindo e precisa funcionar — é o
   que aparecerá se o Arquiteto decidir que a restritiva só cresce por
   confissão. */
F.PACTO_TIPOS[1].escala = null;
ok(F._escada().fixa === true, 'fator ausente ⇒ a nota de "cresce por confissão"');
F.PACTO_TIPOS[1].escala = 2.0;

console.log('\n-- os extremos (onde um laço infinito moraria) --');
F._estado.pct_tipo = 'QUANTITATIVA';
F._estado.pct_base = 5; F._estado.pct_teto = 5;
ok(F._escada().degraus.join() === '5', 'base igual ao teto: um degrau só');
F._estado.pct_base = 10; F._estado.pct_teto = 3;
ok(F._escada().degraus.join() === '10', 'teto abaixo da base não trava nem inverte');
F._estado.pct_base = ''; F._estado.pct_teto = '';
ok(F._escada().degraus.length >= 1, 'campos vazios não quebram');
F._estado.pct_base = 1; F._estado.pct_teto = 999999;
ok(F._escada().degraus.length <= 7, 'teto absurdo não gera escada infinita');

console.log('\n-- o {n} do pacto NÃO é resolvido (a diferença da repetição) --');
const fonte = ler('js', 'forja-missao.js');
const salvarPacto = fatia(fonte, 'async _salvarPacto()', 'window.ForjaMissao');
ok(!/_resolverTitulo/.test(salvarPacto),
   '_salvarPacto NÃO chama _resolverTitulo — resolver congelaria a escalação');
ok(/titulo,\s*\/\/ com o \{n\} INTACTO/.test(salvarPacto),
   'e o código diz por quê');
ok(/_resolverTitulo/.test(fatia(fonte, 'async _salvar()', 'async _salvarPacto')),
   'a missão de repetição CONTINUA resolvendo — o teste sabe distinguir');

console.log('\n-- _salvarPacto fala com /pactos, não com /rotinas --');
ok(/API\.post\('\/pactos'/.test(salvarPacto), 'cria em POST /pactos');
ok(/API\.patch\('\/pactos\/'/.test(salvarPacto), 'edita em PATCH /pactos/{id}');
ok(!/rotinas|tarefas/.test(salvarPacto), 'não toca em rotinas nem tarefas');
ok(/teto < base/.test(salvarPacto), 'avisa quando o teto fica abaixo da base');

console.log('\n-- o formulário esconde tudo que é de MISSÃO --');
const trocar = fatia(fonte, '_trocarTipo() {', '/* ── Atualiza cor');
for (const bloco of ['fm-bloco-freq', 'fm-bloco-data', 'fm-bloco-prazo',
                     'fm-bloco-natureza', 'fm-bloco-repeticao', 'fm-bloco-prior',
                     'fm-bloco-dific', 'fm-bloco-categoria', 'fm-bloco-janela',
                     'fm-bloco-desc', 'fm-caixa-premio', 'fm-caixa-punicao']) {
  ok(new RegExp(`mostra\\('${bloco}',\\s*!pacto`).test(trocar),
     `${bloco} some no pacto`);
}
ok(/mostra\('fm-bloco-pacto', pacto\)/.test(trocar), 'e o bloco do pacto aparece');

console.log('\n-- os blocos escondidos precisam EXISTIR com esses ids --');
const render = fatia(fonte, '_render() {', '_bind(bd) {');
for (const bloco of ['fm-bloco-prior', 'fm-bloco-dific', 'fm-bloco-categoria',
                     'fm-bloco-janela', 'fm-bloco-desc', 'fm-caixa-premio',
                     'fm-caixa-punicao', 'fm-bloco-pacto', 'fm-pct-previa']) {
  ok(render.includes(`id="${bloco}"`), `${bloco} tem id no HTML`);
}

console.log('\n-- _atualizar não precifica um pacto --');
/* `_fmtPrazo` era o marco final aqui, e ele fica ANTES de `_atualizar` no
   arquivo — foi exatamente esse engano que gerou a fatia vazia. O marco
   certo é o método seguinte, `_notaQuando`. */
const atualizar = fatia(fonte, '  _atualizar() {', '  _notaQuando(');
const antesDoReturn = fatia(atualizar, 'const e = this._estado', 'return;');
ok(/tipo === 'PACTO'/.test(antesDoReturn), 'sai cedo quando é PACTO');
ok(!/fm-v-xp|_calcular/.test(antesDoReturn),
   'e sai ANTES de escrever XP — senão o pacto exibiria recompensa');

console.log('\n-- edição: a colisão do campo `tipo` --');
F._estado = { tipo: 'ROTINA', pct_tipo: 'QUANTITATIVA', pct_base: 1, pct_teto: 32,
              pct_unidade: '', titulo: '' };
F._carregarEdicao({ id: 7, titulo: 'Fazer {n} flexões', tipo: 'QUANTITATIVA',
                    base: 2, teto: 64, unidade: 'flexões', valor_atual: 4 });
ok(F._estado.tipo === 'PACTO', 'um pacto carrega como PACTO, não como ROTINA');
ok(F._estado.pct_tipo === 'QUANTITATIVA', 'o `tipo` do pacto vira `pct_tipo`');
ok(F._estado.pct_base === 2 && F._estado.pct_teto === 64, 'base e teto vêm do item');
ok(F._estado.frequencia !== 'QUANTITATIVA',
   'a frequência NÃO recebe "QUANTITATIVA" (era o bug que isto previne)');
ok(F._estado._pctTocado === true, 'os números dele não são sobrescritos por padrões');

/* Controle: uma rotina de verdade continua carregando como rotina. */
F._estado = { tipo: 'PACTO', dias_semana: [], frequencia: 'DIARIA' };
F._carregarEdicao({ id: 1, titulo: 'Correr', tipo: 'SEMANAL', dias_semana: [1, 3] });
ok(F._estado.tipo === 'ROTINA', 'uma rotina ainda carrega como ROTINA');

console.log('\n-- uma só tela de criação --');
const pacto = ler('js', 'pages', 'pacto.js');
ok(!/novaPenitencia/.test(pacto), 'o formulário duplicado saiu de pages/pacto.js');
ok(/ForjaMissao\.abrir\(\{[\s\S]{0,80}tipo: 'PACTO'/.test(pacto),
   'a aba do Pacto delega para a Forja');
ok(!/getElementById\('btn-pacto-novo'\)\s*\n?\s*\?\.addEventListener/.test(pacto),
   'sem listener duplicado no #btn-pacto-novo (abriria as DUAS telas)');
ok(/id === 'btn-pacto-novo'/.test(fonte), 'a Forja assume o botão');
ok(/abrirCatalogo/.test(pacto), 'o catálogo continua vivo em um lugar só');

console.log('\n-- a TRANSICAO Rotina -> Pacto (onde o bug morava) --');
/* O Arquiteto reportou "o botao continua com o simbolo de proibido" —
   cursor:not-allowed, ou seja, `disabled`.

   CAUSA: `_atualizar()` terminava com `btn.disabled = !titulo.trim()`,
   uma linha solta no fim da funcao. Quando o PACTO ganhou um early
   return no comeco, ela deixou de ser alcancada no modo pacto. O
   caminho do sintoma: a Forja abre em ROTINA com titulo vazio e trava o
   botao; o hunter clica em Pacto, escreve o titulo, ve a previa
   atualizar — e o botao continua morto.

   POR QUE MEUS ASSERTS NAO PEGARAM: eu abria direto em {tipo:'PACTO'},
   um render limpo onde o botao nunca chegou a ser desabilitado. O bug
   morava na TRANSICAO, e transicao e justamente o que teste de estado
   inicial nao ve. Por isso este bloco usa DOM de verdade e percorre o
   caminho do usuario, em vez de montar o estado final na mao. */
{
  const dom = new JSDOM('<body></body>',
    { pretendToBeVisual: true, runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  w.API = { get: async () => ({ tipos: [{ id: 'QUANTITATIVA', escala: 2, natureza: 'REPETICAO' }] }),
            post: async () => ({ id: 1 }), patch: async () => ({}) };
  w.Glifos = { rico: () => '<svg></svg>', linha: () => '<svg></svg>' };
  w.SoloDialog = { toast() {} };
  w.MissaoCard = { cachear() {}, html: () => '<div/>' };
  /* Node 22 não expõe mais os globais quando se passa o `window` do
     jsdom para `createContext` — o script morre em "window is not
     defined" e o resto do arquivo some do relatório sem medir nada.
     Quem devolve um contexto com os globais ligados é
     `getInternalVMContext`. Mesmo defeito, mesma correção que
     `teste_penitencia_card.js`. */
  vm.runInContext(ler('js', 'forja-missao.js'),
    typeof dom.getInternalVMContext === 'function'
      ? dom.getInternalVMContext() : vm.createContext(w));

  const FJ = w.ForjaMissao, D = w.document;
  const botao = () => D.querySelector('[data-fm-salvar]');
  const clicarTipo = v => D.querySelector(`[data-fm-campo="tipo"][data-fm-valor="${v}"]`)
                           .dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const digitar = txt => {
    const i = D.getElementById('fm-titulo-input');
    i.value = txt;
    i.dispatchEvent(new w.InputEvent('input', { bubbles: true }));
  };

  FJ.abrir();                                   // como o app abre de verdade
  ok(botao().disabled === true, 'abre em Rotina sem título ⇒ botão travado');
  clicarTipo('PACTO');
  ok(FJ._estado.tipo === 'PACTO', 'clicar em Pacto troca o tipo');
  ok(botao().disabled === true, 'segue travado — o título ainda está vazio');
  digitar('Fazer {n} Polichinelos');
  ok(botao().disabled === false,
     'ESCREVER O TÍTULO DESTRAVA — era exatamente isto que falhava');
  digitar('');
  ok(botao().disabled === true, 'apagar o título trava de novo');
  digitar('Fazer {n} flexões');
  clicarTipo('ROTINA');
  ok(botao().disabled === false, 'Pacto → Rotina com título: segue destravado');
  clicarTipo('PACTO');
  ok(botao().disabled === false, 'Rotina → Pacto com título: segue destravado');
}

console.log('\n-- o rodape nunca pode ficar fora de alcance --');
/* O Arquiteto reportou "o botao firmar o pacto nao ficou acessivel".
   O clique funciona (provado acima) e o botao nao nasce disabled — o
   suspeito era ALTURA: um modal mais alto que a janela transborda dos
   dois lados com `align-items:center`, e o rodape sai por baixo SEM
   barra de rolagem. A tela fica completa e inutil.

   Nao tenho navegador para medir layout, entao estes asserts guardam as
   duas condicoes que tornam o sintoma impossivel, em vez de fingir que
   mediram pixel. */
const css = ler('css', 'forja-missao.css');
const backdrop = fatia(css, '.fm-backdrop {', '}');
ok(/overflow-y:\s*auto/.test(backdrop),
   'o backdrop rola — sem isso o que passa da janela fica inalcancavel');
ok(/\.fm-backdrop\.on\s*>\s*\.fm-modal\s*\{\s*margin:\s*auto/.test(css),
   'e o modal centraliza por margin:auto (align-items:center corta o topo no overflow)');
ok(/\.fm-modal[\s\S]{0,400}?max-height/.test(css),
   'o modal tem teto de altura');

/* A causa que EU introduzi: quatro modos em 2x2 somavam ~110px de
   altura num modo em que a coluna da previa fica quase vazia. */
ok(/\.fm-pct-modos\s*\{\s*grid-template-columns:\s*repeat\(4/.test(css),
   'os quatro modos cabem em UMA linha');
ok(/max-width:\s*720px\)[\s\S]{0,120}?\.fm-pct-modos/.test(css),
   'e voltam a duas colunas quando a tela estreita');

console.log('\n-- o backend manda os fatores --');
const rt = fs.readFileSync(path.join(RAIZ, '..', 'backend', 'routers', 'pactos.py'), 'utf8');
ok(/"escala":\s*cat\.fator_efetivo/.test(rt),
   '/pactos/catalogo devolve o fator MEDIDO, não o declarado');
ok(/"declarada":\s*cat\.ESCALA_DO_TIPO/.test(rt),
   'e carrega o declarado junto, para a divergência ficar visível');
ok(/"natureza":\s*cat\.NATUREZA_DO_TIPO/.test(rt), 'e a natureza de cada tipo');

console.log(`\n=== ${testes - falhas}/${testes} ===`);
process.exit(falhas ? 1 : 0);
