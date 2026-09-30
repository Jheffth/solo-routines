/* ============================================================
   TESTE — "AVISOS DESTA MISSÃO" NA FORJA

   O Arquiteto escolhe, ao criar uma rotina ou missão geral, como ela o
   avisa: por texto, por voz ou sem aviso. O backend já entende o campo
   (test_aviso_modo.py). Este teste cobra o caminho de CRIAR — porque uma
   opção que o servidor entende e a tela não oferece não existe para quem
   usa.

   O QUE ELE VIGIA
   1. O bloco aparece na rotina e na missão geral, e some no Pacto (o
      Pacto é a regra de punição, não uma missão que avisa).
   2. Nasce em "Por texto" — o padrão de sempre.
   3. A escolha sai no payload de criação, nos dois tipos.
   4. EDITAR NÃO APAGA A ESCOLHA: abrir uma missão "por voz" para mudar o
      título e salvar não pode devolvê-la para texto.

   Uso: NODE_PATH=/tmp/deps/node_modules node teste_forja_avisos.js
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let falhas = 0;
const ok = (cond, msg) => {
  if (!cond) falhas++;
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + msg);
};

const RAIZ  = path.join(__dirname, '..');
const fonte = fs.readFileSync(path.join(RAIZ, 'js', 'forja-missao.js'), 'utf8');

function montar() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' });
  const win = dom.window;
  win.chamadas = [];
  const grava = (nome) => async (a, b) => {
    win.chamadas.push([nome, b === undefined ? a : b]);
    return { id: 1 };
  };
  win.API = {
    rotinas: { criar: grava('rotina'), atualizar: grava('rotina-edit') },
    tarefas: { criar: grava('tarefa'), atualizar: grava('tarefa-edit') },
    get: async () => ({}), post: async () => ({}),
  };
  win.SoloDialog = { toast: () => {} };
  win.Glifos = { existe: () => true, linha: () => '<svg></svg>', rico: () => '<svg></svg>' };
  require('vm').runInContext(fonte + '\n;globalThis.__F = ForjaMissao;',
                             dom.getInternalVMContext());
  return { win, doc: win.document, F: win.__F };
}

const visivel = (doc, id) => {
  const el = doc.getElementById(id);
  return !!el && el.style.display !== 'none';
};
const clicar = (doc, campo, valor) => {
  const el = doc.querySelector(`[data-fm-campo="${campo}"][data-fm-valor="${valor}"]`);
  if (el) el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
  return !!el;
};
const espera = () => new Promise(r => setTimeout(r, 30));

(async () => {
  console.log('\n=== AVISOS DESTA MISSAO NA FORJA ===');

  // ── 1 · aparece, nasce em texto, some no pacto ────────────────────
  {
    const { doc, F } = montar();
    F.abrir();
    ok(visivel(doc, 'fm-bloco-avisos'), 'o bloco aparece na rotina');
    ok(F._estado.aviso_modo === 'texto', 'e nasce em "Por texto"');
    ok(doc.querySelector('[data-fm-campo="aviso_modo"][data-fm-valor="texto"]')
          .classList.contains('sel'), 'com "Por texto" marcado na tela');
    ok(['texto', 'voz', 'nenhum'].every(v =>
          doc.querySelector(`[data-fm-campo="aviso_modo"][data-fm-valor="${v}"]`)),
       'as tres opcoes existem');

    clicar(doc, 'tipo', 'PACTO');
    ok(!visivel(doc, 'fm-bloco-avisos'), 'no Pacto o bloco some');
    clicar(doc, 'tipo', 'TAREFA');
    ok(visivel(doc, 'fm-bloco-avisos'), 'e volta na missao geral');
  }

  // ── 2 · a escolha sai no payload: rotina ─────────────────────────
  {
    const { win, doc, F } = montar();
    F.abrir();
    F._estado.titulo = 'Acordar as 06:00';
    ok(clicar(doc, 'aviso_modo', 'voz'), 'da para clicar em "Por voz"');
    ok(F._estado.aviso_modo === 'voz', 'o clique vai para o estado');
    await F._salvar(); await espera();
    const c = win.chamadas.find(x => x[0] === 'rotina');
    ok(c && c[1].aviso_modo === 'voz', 'a rotina e criada com aviso_modo = voz');
  }

  // ── 3 · a escolha sai no payload: missao geral ───────────────────
  {
    const { win, doc, F } = montar();
    F.abrir({ tipo: 'TAREFA' });
    F._estado.titulo = 'Pagar a conta';
    clicar(doc, 'aviso_modo', 'nenhum');
    await F._salvar(); await espera();
    const c = win.chamadas.find(x => x[0] === 'tarefa');
    ok(c && c[1].aviso_modo === 'nenhum', 'a missao geral e criada com aviso_modo = nenhum');
  }

  // ── 4 · editar nao apaga a escolha ───────────────────────────────
  {
    const { win, F } = montar();
    F.abrir({ edicao: { id: 7, titulo: 'Banho', tipo: 'DIARIA', aviso_modo: 'voz',
                        categoria: 'Pessoal', prioridade: 'MEDIA', dificuldade: 'NORMAL' } });
    ok(F._estado.aviso_modo === 'voz', 'abrir para editar traz o modo salvo');
    F._estado.titulo = 'Banho Revigorante';
    await F._salvar(); await espera();
    const c = win.chamadas.find(x => x[0] === 'rotina-edit');
    ok(c && c[1].aviso_modo === 'voz',
       'salvar depois de mudar so o titulo mantem "por voz"');
  }

  console.log(falhas ? `\n${falhas} FALHA(S)\n` : '\n=== FORJA AVISOS OK ===\n');
  process.exit(falhas ? 1 : 0);
})();
