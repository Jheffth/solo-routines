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


/* ══════════════════════════════════════════════════════════════════
   O CARTÃO DOS AVISOS

   A armadilha aqui é oferecer configuração de um canal que não existe:
   quatro chaves bonitas que não ligam coisa nenhuma, e a pessoa saindo
   convencida de que vai receber avisos.
   ══════════════════════════════════════════════════════════════════ */
const PREF = {
  acendeu: true, beira: true, venceu: false, portao: true,
  minutos_beira: 15, minutos_portao: 30,
  silencio_de: '23:00', silencio_ate: '06:00',
};

console.log('\n=== CARTAO DOS AVISOS ===');

let a = B._avisos.call(B, PREF, { vinculado: false, disponivel: true });
diz('sem canal', !a.includes('data-av='),
    'nao oferece chave nenhuma — configurar o nada engana');
diz('sem canal', a.includes('Conecte o Telegram'), 'e diz o que fazer antes');

diz('sem preferencia', B._avisos.call(B, null, { vinculado: true })
      .includes('Não consegui ler'),
    'preferencia ilegivel vira aviso, nao tela em branco');

a = B._avisos.call(B, PREF, { vinculado: true });
['beira', 'acendeu', 'portao', 'venceu'].forEach(k =>
  diz('com canal', a.includes('data-av="' + k + '"'), 'a chave ' + k + ' existe'));
diz('com canal', (a.match(/checked/g) || []).length === 3,
    'tres ligadas e uma desligada — a tela reflete o servidor, nao um padrao fixo');
diz('com canal', a.includes('value="15"') && a.includes('value="30"'),
    'os minutos vem do servidor');
diz('com canal', a.includes('min="5"') && a.includes('max="120"'),
    'e a tela limita o mesmo que o servidor limita no banco');
diz('com canal', a.includes('exceto'),
    'a excecao da janela noturna esta escrita, nao escondida no codigo');
diz('com canal', a.includes('o mais frequente'),
    'a chave mais cara avisa que e a mais cara');

diz('escape', !B._avisos.call(B,
      Object.assign({}, PREF, { silencio_de: '"><img src=x onerror=alert(1)>' }),
      { vinculado: true }).includes('<img'),
    'valor de campo vai escapado');


/* ── O SELETOR DE CANAL ────────────────────────────────────────────
   Com dois canais vinculados e sem escolha, o mesmo "faltam 15 min"
   chegaria no Telegram E no WhatsApp — e o caminho mais curto para
   alguém silenciar os DOIS é receber tudo em dobro. */
const SO_TG  = { telegram: { vinculado: true },  whatsapp: { vinculado: false } };
const SO_WA  = { telegram: { vinculado: false }, whatsapp: { vinculado: true } };
const DOIS   = { telegram: { vinculado: true },  whatsapp: { vinculado: true } };
const NENHUM = { telegram: { vinculado: false }, whatsapp: { vinculado: false } };
const PW = Object.assign({}, PREF, { canal_avisos: 'whatsapp' });

diz('nenhum canal', !B._avisos.call(B, PW, NENHUM).includes('data-av='),
    'sem canal nenhum nao oferece chave');
diz('nenhum canal', B._avisos.call(B, PW, NENHUM).includes('Telegram ou o WhatsApp'),
    'e cita os dois caminhos possiveis');

[['so telegram', SO_TG], ['so whatsapp', SO_WA]].forEach(([nome, d]) => {
  const h = B._avisos.call(B, PW, d);
  diz(nome, h.includes('data-av="beira"'), 'um canal ja libera as chaves');
  diz(nome, !h.includes('canal_avisos'),
      'e o seletor nao aparece — pergunta de resposta unica custa a leitura de quem ja decidiu');
});

const hD = B._avisos.call(B, PW, DOIS);
diz('dois canais', hD.includes('canal_avisos'), 'com dois, o seletor aparece');
diz('dois canais', hD.includes('value="ambos"'), 'com a opcao de receber nos dois');
diz('dois canais', hD.includes('procura'),
    'e explica que o canal nao escolhido continua aceitando comandos');

diz('compat', B._avisos.call(B, PW, { vinculado: true }).includes('data-av="beira"'),
    'a chamada antiga (so o telegram) continua desenhando');

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\n=== PAINEL OK ===\n');
process.exit(falhas ? 1 : 0);
