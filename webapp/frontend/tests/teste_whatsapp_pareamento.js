/* Regressão: sessão aberta sem vínculo não pode bloquear o novo pareamento.
   Uso: node webapp/frontend/tests/teste_whatsapp_pareamento.js */
'use strict';
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
process.env.TZ = 'America/Sao_Paulo';
const dom = new JSDOM('<div id="bots-conteudo"></div>');
global.window = global;
global.document = dom.window.document;
global.Auth = { isCriador: () => true };
require('../js/pages/bots.js');
const B = window.Bots;
const cx = document.getElementById('bots-conteudo');
const base = { disponivel: true, vinculado: false, sessao: { conectado: true } };
const avisos = [];
let confirmou = true;
global.SoloDialog = { confirm: async () => confirmou, toast: msg => avisos.push(msg) };

async function main() {
  for (const vinculado of [false, true]) {
    for (const conectado of [false, true]) {
      cx.innerHTML = B._whatsapp({ ...base, vinculado, sessao: { conectado } });
      assert.ok(cx.querySelector('[data-bot-reparear]'), 'Arquiteto sempre pode recuperar a sessão');
      assert.equal(!!cx.querySelector('[data-bot-qr]'), !conectado);
      assert.equal(!!cx.querySelector('.bot-selo.on'), vinculado && conectado);
      if (!vinculado) assert.equal(cx.querySelector('[data-bot-codigo]').disabled, !conectado);
    }
  }
  Auth.isCriador = () => false;
  for (const conectado of [false, true]) {
    cx.innerHTML = B._whatsapp({ ...base, sessao: { conectado } });
    assert.equal(cx.querySelector('[data-bot-reparear]'), null);
    assert.equal(cx.querySelector('[data-bot-qr]'), null);
  }
  Auth.isCriador = () => true;
  cx.innerHTML = B._whatsapp({ ...base, disponivel: false });
  assert.equal(cx.querySelector('[data-bot-reparear]'), null);
  console.log('[ok] Estados de conexão, vínculo e permissão');

  let sessao = true;
  const chamadas = [];
  let qrResposta = { qrcode: 'data:image/png;base64,AAAA', estado: 'connecting' };
  let logoutOk = true;
  global.API = {
    get: async rota => {
      chamadas.push(rota);
      if (rota === '/bots/status') return { telegram: { disponivel: false }, whatsapp: { ...base, sessao: { conectado: sessao } } };
      if (rota === '/bots/avisos') return null;
      if (rota === '/bots/whatsapp/qrcode') return qrResposta;
      throw new Error('Rota inesperada: ' + rota);
    },
    delete: async rota => {
      assert.equal(rota, '/bots/whatsapp/sessao');
      chamadas.push(rota);
      if (logoutOk) sessao = false;
      return { ok: logoutOk };
    },
  };
  await B.carregar();
  const recuperar = cx.querySelector('[data-bot-reparear]');
  assert.equal(typeof recuperar.onclick, 'function');
  confirmou = false;
  chamadas.length = 0;
  await recuperar.onclick();
  assert.deepEqual(chamadas, [], 'Cancelar não encerra a sessão');
  confirmou = true;
  logoutOk = false;
  await recuperar.onclick();
  assert.deepEqual(chamadas, ['/bots/whatsapp/sessao']);
  assert.equal(recuperar.disabled, false);
  assert.match(avisos.pop(), /Não foi possível encerrar/);
  logoutOk = true;
  chamadas.length = 0;
  await recuperar.onclick();
  assert.equal(chamadas[0], '/bots/whatsapp/sessao');
  assert.equal(chamadas.at(-1), '/bots/whatsapp/qrcode');
  assert.ok(cx.querySelector('img.bot-qr'), 'Após sair, o novo QR aparece');
  assert.ok(!chamadas.some(x => x.includes('/vinculo/')), 'Recuperar sessão preserva os vínculos');
  console.log('[ok] Cancelamento, falha de logout e recuperação até exibir o QR');

  const qr = cx.querySelector('[data-bot-qr]');
  qrResposta = { estado: 'connecting' };
  await qr.onclick();
  assert.equal(cx.querySelector('img.bot-qr'), null, 'QR anterior sai da tela');
  assert.match(cx.querySelector('[data-bot-area="qr"]').textContent, /preparando o QR/);
  qrResposta = { pairing_code: '<teste>' };
  await qr.onclick();
  assert.equal(cx.querySelector('.bot-codigo-num').textContent, '<teste>');
  qrResposta = { estado: 'open' };
  sessao = true;
  await qr.onclick();
  assert.equal(cx.querySelector('img.bot-qr'), null);
  assert.ok(cx.querySelector('[data-bot-reparear]'));
  assert.match(avisos.pop(), /Sessão do Sistema conectada/);
  sessao = false;
  await B.carregar();
  const qrFalha = cx.querySelector('[data-bot-qr]');
  API.get = async () => { throw new Error('Sem conexão'); };
  await qrFalha.onclick();
  assert.equal(qrFalha.disabled, false);
  assert.match(cx.querySelector('[data-bot-area="qr"]').textContent, /tentar novamente/);
  console.log('[ok] Resposta sem QR, código alternativo e falha de rede');

  const agoraOriginal = Date.now;
  Date.now = () => Date.parse('2026-09-21T15:00:00Z');
  try {
    for (const data of ['2026-09-21T15:10:00', '2026-09-21T15:10:00Z', '2026-09-21T12:10:00-03:00']) {
      cx.innerHTML = `<span data-bot-prazo="${data}"></span>`;
      B._contar();
      assert.equal(cx.firstChild.textContent, 'vale por 10:00');
    }
    cx.innerHTML = '<span data-bot-prazo="2026-09-21T14:59:59"></span>';
    B._contar();
    assert.match(cx.firstChild.textContent, /expirado/);
  } finally {
    Date.now = agoraOriginal;
    clearInterval(B._relogio);
    dom.window.close();
  }
  console.log('[ok] Validade de dez minutos em São Paulo e expiração');
}
main().catch(e => { clearInterval(B._relogio); console.error(e); process.exitCode = 1; });
