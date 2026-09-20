/* ============================================================
   TESTE — O PAINEL "ESTADO DO BOT" DIZ A VERDADE

   POR QUE ESTE ARQUIVO EXISTE

   O painel responde uma pergunta que nenhuma outra tela respondia: "o
   bot esta no ar?". E a resposta dele tem de ser confiavel exatamente
   no caso em que tudo PARECE certo — token preenchido, hunter
   vinculado, cartao verde — e nada funciona, porque o webhook nao esta
   registrado ou aponta para outro endereco.

   Um painel de diagnostico que erra e pior que nenhum: manda o
   Arquiteto procurar defeito no lugar errado.

   AS TRES ARMADILHAS QUE ESTE TESTE VIGIA

   1. "nao consegui perguntar" virar "nao esta registrado". Sao coisas
      opostas, e confundi-las faz reconfigurar um webhook que estava de
      pe.
   2. cor sozinha dizendo certo/errado. Cor e o primeiro canal que se
      perde — no brilho baixo do celular na rua, numa captura em preto e
      branco colada num chat pedindo ajuda.
   3. texto vindo do Telegram entrar sem escape. `last_error_message` e
      texto de fora; e a unica coisa nesta tela que um estranho
      influencia.

   Uso: node teste_bots_painel.js
   ============================================================ */
'use strict';
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'js', 'pages', 'bots.js'));
const B = window.Bots;

let falhas = 0;
function diz(caso, cond, msg) {
  console.log((cond ? '  [ok]  ' : '  [XX]  ') + caso + ' :: ' + msg);
  if (!cond) falhas++;
}

const CERTO = {
  token_configurado: true, segredo_configurado: true, segredo_fraco: false,
  usuario_bot: 'solo_rotinas_bot',
  webhook_registrado: true, webhook_confere: true,
  webhook_url: 'https://soloroutines.duckdns.org/api/bot/webhook',
  webhook_esperado: 'https://soloroutines.duckdns.org/api/bot/webhook',
  updates_pendentes: 0, ultimo_erro: '', lista_espera: [], pronto: true,
};
const remix = (mudancas) => Object.assign({}, CERTO, mudancas);

console.log('\n=== PAINEL ESTADO DO BOT ===');

/* ── 1 · o painel nao existe para quem nao e Arquiteto ─────────────
   O servidor manda `servidor: null`. A regra de verdade esta no
   backend; esconder aqui e conveniencia, nao seguranca. */
diz('hunter comum', B._servidorTg.call(B, null) === '', 'nao desenha nada');

/* ── 2 · o selo acompanha o `pronto` do servidor ──────────────────
   E `pronto` ja nao e "tem token": e o Telegram sabendo para onde
   entregar. Ver a nota em routers/bot_telegram.py. */
diz('tudo certo', B._servidorTg.call(B, CERTO).includes('no ar'),
    'anuncia no ar quando o servidor diz pronto');

const semWebhook = remix({
  webhook_registrado: false, webhook_confere: false, webhook_url: '',
  pronto: false,
});
const hSem = B._servidorTg.call(B, semWebhook);
diz('sem webhook', hSem.includes('fora do ar'),
    'token preenchido NAO vira "no ar" sozinho');
diz('sem webhook', hSem.includes('não tem para onde entregar'),
    'e explica por que, em vez de so marcar vermelho');

/* ── 3 · registrado no endereco errado ─────────────────────────────
   Pior que nao registrado: parece certo e as mensagens vao para outra
   instancia — um tunel de teste esquecido, um dominio antigo. */
const trocado = remix({
  webhook_confere: false, webhook_url: 'https://tunel-antigo.ngrok.io/api/bot/webhook',
  updates_pendentes: 12, ultimo_erro: 'Wrong response from the webhook: 404',
  pronto: false,
});
const hTr = B._servidorTg.call(B, trocado);
diz('endereco errado', hTr.includes('tunel-antigo') && hTr.includes('soloroutines'),
    'mostra os DOIS enderecos — o que esta e o que devia estar');
diz('endereco errado', hTr.includes('12'), 'conta as mensagens encalhadas');
diz('endereco errado', hTr.includes('404'), 'repete o erro cru do Telegram');

/* ── 4 · o segredo de exemplo ──────────────────────────────────── */
diz('segredo fraco', B._servidorTg.call(B, remix({ segredo_fraco: true, pronto: false }))
      .includes('troque'),
    'acusa o valor de exemplo em vez de aceitar calado');
diz('sem segredo', B._servidorTg.call(B, remix({ segredo_configurado: false, pronto: false }))
      .includes('TELEGRAM_SECRET'),
    'diz o nome da variavel que falta');

/* ── 5 · a armadilha numero 1 ─────────────────────────────────────── */
const hErro = B._servidorTg.call(B, { erro_consulta: 'timeout apos 10s' });
diz('consulta falhou', hErro.includes('timeout apos 10s'), 'mostra a falha');
diz('consulta falhou', !hErro.includes('bot-diag-lista'),
    'NAO desenha a lista de estados — nao consegui perguntar nao e "esta errado"');
diz('consulta falhou', !hErro.includes('✕'),
    'e nao marca nada como quebrado sem ter conferido');

/* ── 6 · a armadilha numero 2 ─────────────────────────────────────── */
[['tudo certo', CERTO], ['sem webhook', semWebhook], ['endereco errado', trocado]]
  .forEach(([nome, s]) => {
    const h = B._servidorTg.call(B, s);
    diz(nome, /[✓✕·]/.test(h), 'cada linha carrega simbolo, nao so cor');
  });

/* ── 7 · o botao nao promete o que nao pode cumprir ───────────────── */
diz('tudo certo', !/data-bot-webhook[^>]*disabled/.test(B._servidorTg.call(B, CERTO)),
    'botao ativo quando da para registrar');
[['sem token', { token_configurado: false }], ['sem segredo', { segredo_configurado: false }]]
  .forEach(([nome, m]) => {
    const h = B._servidorTg.call(B, remix(Object.assign({ pronto: false }, m)));
    diz(nome, /data-bot-webhook[\s\S]{0,140}disabled/.test(h),
        'botao travado — registrar agora so criaria um bot mudo');
  });

/* ── 8 · a armadilha numero 3 ─────────────────────────────────────── */
const veneno = '<img src=x onerror=alert(1)>';
[['erro_consulta', { erro_consulta: veneno }],
 ['ultimo_erro', remix({ ultimo_erro: veneno, pronto: false })],
 ['webhook_url', remix({ webhook_confere: false, webhook_url: veneno, pronto: false })]]
  .forEach(([campo, s]) => {
    const h = B._servidorTg.call(B, s);
    diz('escape', !h.includes('<img'), campo + ' vindo de fora vai escapado');
  });

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\n=== PAINEL OK ===\n');
process.exit(falhas ? 1 : 0);
