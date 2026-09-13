/* ============================================================
   TESTE — O SELO DO RODAPÉ

   O rodapé anunciou, durante meses e ao mesmo tempo:

       Solo Routines 1.6.0     (o VERSION dizia 1.8.0)
       Ambiente: RENDER        (o servidor é Contabo)
       Commit: unknown         (nunca funcionou em produção)

   Três mentiras num selo de nove palavras, e nenhuma delas quebrou nada —
   por isso duraram. Um selo de versão errado não derruba o site; só faz o
   Arquiteto jurar que subiu o que não subiu.

   O QUE ESTE ARQUIVO PROTEGE

   1. O NOME DO HOSPEDEIRO NÃO VOLTA PARA DENTRO DO CÓDIGO.
      "RENDER" estava cravado numa tabela de tradução do JavaScript. A casa
      onde o app roda é informação DO SERVIDOR; quando ela vira literal no
      front, migrar de servidor deixa de atualizar o rodapé. O primeiro
      assert proíbe a string no arquivo inteiro.

   2. NENHUM NÚMERO PLAUSÍVEL NO CAMINHO DE ERRO.
      Este é o assert que importa de verdade. Sem selo, o rodapé tem de
      dizer "sem selo" — não "v1.6.0", não "v0.0.0", não um número redondo
      qualquer. Um erro que parece um acerto não é encontrado nunca.

   3. AMBIENTE DESCONHECIDO NÃO VIRA CHUTE.
      Se amanhã aparecer um "homolog2", o rodapé escreve HOMOLOG2 em vez de
      assumir produção.

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_selo_versao.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let falhas = 0, testes = 0;
const ok = (cond, msg) => {
  testes++;
  if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
};

const RAIZ = path.join(__dirname, '..');
const fonte = fs.readFileSync(path.join(RAIZ, 'js', 'version.js'), 'utf8');

/* O comentário de cabeçalho do version.js CITA a linha errada para
   explicar o bug. Um assert que procura "RENDER" no texto cru acharia a
   explicação e reprovaria a própria correção. */
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function montar(resposta) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="version-badge">
      <span id="version-text">carregando...</span>
      <span id="version-env"></span>
      <span id="version-sha"></span>
    </div></body></html>`, { runScripts: 'outside-only', url: 'http://localhost/' });
  const win = dom.window;
  win.fetch = async () => ({ ok: true, json: async () => resposta });
  vm.runInContext(fonte, dom.getInternalVMContext());
  return win;
}

const ler = (win, id) => win.document.getElementById(id).textContent;

async function rodar() {
  console.log('\n=== O SELO DO RODAPÉ ===\n');

  /* ── 1. O HOSPEDEIRO NÃO MORA NO FRONT ─────────────────────────── */
  console.log('-- o nome do servidor vem do servidor --');
  {
    ok(!/RENDER/i.test(codigo),
       'a palavra RENDER nao existe mais no codigo do version.js');
    ok(!/CONTABO/i.test(codigo),
       'e CONTABO tambem nao foi cravado no lugar dela (seria o mesmo erro)');
    ok(/hospedeiro/i.test(codigo),
       'o front le o campo `hospedeiro` que o backend manda');
  }

  /* ── 2. PRODUÇÃO EM CASA CONHECIDA ─────────────────────────────── */
  console.log('\n-- producao no contabo --');
  {
    const win = montar({
      versao: '1.8.0', sha: 'a1b2c3d', selado: true, sujo: false,
      ramo: 'main', ambiente: 'production', hospedeiro: 'Contabo',
      timestamp: new Date().toISOString(),
    });
    await win.SoloVersion.recarregar();

    ok(ler(win, 'version-text') === 'v1.8.0', 'a versao e a que o servidor mandou');
    const env = ler(win, 'version-env');
    ok(!/RENDER/i.test(env), 'o rotulo NAO diz RENDER');
    ok(env.includes('PRODUÇÃO'), 'diz PRODUÇÃO — o regime');
    ok(env.includes('CONTABO'), 'e diz CONTABO — a casa');
    ok(ler(win, 'version-sha') === '#a1b2c3d', 'o commit aparece com cerquilha');
  }

  /* ── 3. O CAMINHO DE ERRO NÃO INVENTA NÚMERO ───────────────────── */
  console.log('\n-- sem selo, ninguem chuta versao --');
  {
    const win = montar({
      versao: 'sem selo', sha: 'sem selo', selado: false, sujo: false,
      ramo: '?', ambiente: 'production', hospedeiro: 'Contabo',
      timestamp: new Date().toISOString(),
    });
    await win.SoloVersion.recarregar();

    const txt = ler(win, 'version-text');
    ok(txt === 'sem selo', 'o rodape admite que nao sabe a versao');
    ok(!/\d+\.\d+\.\d+/.test(txt),
       'e NAO escreve numero nenhum — era esse o bug do 1.6.0');
    ok(ler(win, 'version-sha') === '',
       'nem finge um hash: o campo do commit fica vazio');
  }

  /* ── 4. ÁRVORE SUJA É DENUNCIADA ───────────────────────────────── */
  console.log('\n-- o que subiu tem coisa fora do commit --');
  {
    const win = montar({
      versao: '1.8.0', sha: 'a1b2c3d', selado: true, sujo: true,
      ramo: 'main', ambiente: 'production', hospedeiro: 'Contabo',
      timestamp: new Date().toISOString(),
    });
    await win.SoloVersion.recarregar();
    ok(ler(win, 'version-sha') === '#a1b2c3d+',
       'o "+" avisa que ha alteracoes alem do commit selado');
  }

  /* ── 5. AMBIENTE DESCONHECIDO ──────────────────────────────────── */
  console.log('\n-- ambiente que ninguem previu --');
  {
    const win = montar({
      versao: '1.8.0', sha: 'a1b2c3d', selado: true, sujo: false,
      ramo: 'main', ambiente: 'homolog2', hospedeiro: '',
      timestamp: new Date().toISOString(),
    });
    await win.SoloVersion.recarregar();
    const env = ler(win, 'version-env');
    ok(env === 'HOMOLOG2', 'ecoa o nome em maiusculas em vez de assumir producao');
    ok(!env.includes('·'), 'e sem hospedeiro nao inventa separador nem casa');
  }

  /* ── 6. DEV LOCAL ──────────────────────────────────────────────── */
  console.log('\n-- a maquina do arquiteto --');
  {
    const win = montar({
      versao: '1.8.0', sha: 'ffee11a', selado: true, sujo: true,
      ramo: 'main', ambiente: 'dev', hospedeiro: '',
      timestamp: new Date().toISOString(),
    });
    await win.SoloVersion.recarregar();
    ok(ler(win, 'version-env') === 'LOCAL', 'dev continua se chamando LOCAL');
  }

  console.log(`\n${'='.repeat(46)}`);
  console.log(falhas === 0 ? `TUDO VERDE — ${testes} asserts`
                           : `${falhas} FALHA(S) de ${testes} asserts`);
  console.log('='.repeat(46) + '\n');
  process.exit(falhas === 0 ? 0 : 1);
}

rodar().catch(e => { console.error(e); process.exit(1); });
