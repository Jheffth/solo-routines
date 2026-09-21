"""
Router do Bot Telegram para o Solo Routines.
Recebe webhooks, permite concluir missões e consultar status via chat.
"""
import os, requests as req_lib
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from motors import tempo

from database import (
    get_db, Usuario, Rotina, TarefaDia, Execucao, ExecucaoDia, SessionLocal
)
from auth.router import get_arquiteto
# `calcular_xp_rotina` saiu daqui junto com a conclusão inventada: quem
# precifica missão é a Balança, dentro do `execucoes.concluir`. O bot só
# usa `aplicar_xp` para a tarefa avulsa do `/add`.
from motors.gamificacao import aplicar_xp

router = APIRouter(prefix="/bot", tags=["bot-telegram"])

TELEGRAM_API   = "https://api.telegram.org/bot{token}/{method}"
BOT_TOKEN      = os.getenv("TELEGRAM_BOT_TOKEN", "")
ALLOWED_CHAT   = os.getenv("TELEGRAM_CHAT_ID", "")

# ══════════════════════════════════════════════════════════════════════
# O SEGREDO DO WEBHOOK — e por que ele não tem mais valor padrão
#
# Este valor era `os.getenv("TELEGRAM_SECRET", "solorotinas")`. O default
# é o problema inteiro: quem não preenchesse a variável ficaria com um
# segredo publicado no código, num endpoint aberto à internet.
#
# E o que ele guarda não é pouco. O `/api/bot/webhook` confia no
# `chat_id` que chega no corpo — tem de confiar, é assim que o Telegram
# identifica a conversa. Quem sabe o segredo monta o JSON à mão, escreve
# o `chat_id` de um hunter já vinculado e manda `/ok`, `/add`, `/status`:
# conclui missões que não fez, ganha XP, lê a rotina dele. Não é leitura
# indevida, é o Sistema inteiro operado por um estranho.
#
# O vínculo de seis dígitos não defende contra isso — ele prova quem é o
# DONO de um chat_id, e o forjador não precisa provar nada, ele já chega
# dizendo ser um chat_id que o vínculo aprovou.
#
# Sem segredo configurado o webhook RECUSA TUDO. Preferir silêncio a um
# bot que aceita qualquer um: um bot que não responde é um chamado de
# suporte; um bot que responde a estranhos é um estrago.
# ══════════════════════════════════════════════════════════════════════
WEBHOOK_SECRET = os.getenv("TELEGRAM_SECRET", "").strip()

# Valores que alguém escreveria "só para preencher". Se escaparem para
# produção, valem o mesmo que segredo nenhum — e é melhor dizer isso na
# tela do que deixar a porta encostada.
SEGREDOS_FRACOS = {"solorotinas", "solo", "troque-este-segredo", "secret",
                   "changeme", "123456", "mudar", "senha"}


def segredo_fraco() -> bool:
    return WEBHOOK_SECRET.lower() in SEGREDOS_FRACOS


def _chamar(metodo: str, corpo: dict) -> dict:
    """Uma ida ao Telegram. Nunca levanta — o chat não derruba o webhook."""
    if not BOT_TOKEN:
        return {}
    try:
        r = req_lib.post(TELEGRAM_API.format(token=BOT_TOKEN, method=metodo),
                         json=corpo, timeout=10)
        return r.json() or {}
    except Exception as e:
        print(f"[BOT] {metodo} falhou: {e}")
        return {}


def _tg(chat_id: str, texto: str, parse_mode: str = "Markdown", teclado=None):
    corpo = {"chat_id": chat_id, "text": texto, "parse_mode": parse_mode}
    if teclado:
        corpo["reply_markup"] = {"inline_keyboard": teclado}
    return _chamar("sendMessage", corpo)


def _editar(chat_id: str, message_id: int, texto: str, teclado=None):
    """
    Reescreve a mensagem que tinha os botões, em vez de mandar outra.

    É o que faz a lista se comportar como TELA e não como histórico: você
    toca em ✅ e a linha vira concluída ali mesmo. Mandando mensagem nova,
    o chat viraria uma pilha de versões da mesma lista, e os botões das
    versões velhas continuariam clicáveis logo acima — exatamente o
    convite ao toque errado que este desenho quer evitar.
    """
    corpo = {"chat_id": chat_id, "message_id": message_id, "text": texto,
             "parse_mode": "Markdown"}
    corpo["reply_markup"] = {"inline_keyboard": teclado or []}
    return _chamar("editMessageText", corpo)


def _responder_toque(callback_id: str, texto: str = "", alerta: bool = False):
    """
    O Telegram EXIGE esta resposta. Sem ela o botão fica com a
    ampulheta girando por uns segundos e depois falha sozinho — e o
    hunter conclui que o bot travou, mesmo quando a ação funcionou.

    `alerta=True` abre uma caixinha que precisa de OK: fica para o que a
    pessoa não pode deixar passar (uma recusa, um erro). O resto é o
    aviso discreto no topo, que some sozinho.
    """
    return _chamar("answerCallbackQuery",
                   {"callback_query_id": callback_id,
                    "text": texto[:200], "show_alert": bool(alerta)})


def _get_usuario(db: Session, chat_id: str = None):
    """
    O hunter dono DESTA conversa.

    A VERSÃO ANTERIOR ERA: "retorna o primeiro usuário ativo (modo solo —
    1 usuário)". Ela devolvia `db.query(Usuario).filter(ativo).first()`,
    sem olhar de quem era a mensagem.

    Com um hunter, funcionava. Com dois, o bot respondia a conversa de um
    com as missões do outro — e o segundo hunter simplesmente nunca
    recebia nada, sem nenhum erro, em nenhum log. A agenda do Google já
    tinha sido aberta a qualquer hunter; o bot ficou para trás e a
    incoerência não aparecia em lugar nenhum da tela.

    Agora quem responde é o vínculo: `chat_id` → hunter, provado uma vez
    por um código de seis dígitos que nasce no painel (motors/vinculo.py).

    O `chat_id=None` ainda aceita o caminho antigo, e SÓ quando existe um
    único hunter no sistema — é o que mantém as notificações agendadas
    funcionando para quem já usava o bot antes de vincular.
    """
    if chat_id:
        from motors import vinculo
        return vinculo.por_origem(db, "telegram", chat_id)

    ativos = db.query(Usuario).filter(Usuario.ativo == True).limit(2).all()
    return ativos[0] if len(ativos) == 1 else None


def _processar(texto: str, chat_id: str, db: Session):
    txt = texto.strip()

    # ── O VÍNCULO VEM ANTES DE TUDO ──────────────────────────────────
    #
    # Estes dois caminhos são os únicos que rodam SEM hunter conhecido —
    # e têm de rodar, senão não haveria como sair do estado "não
    # vinculado". Tudo o mais exige saber de quem é a conversa.
    from motors import vinculo

    usuario = _get_usuario(db, chat_id)

    if txt.lower().startswith("/vincular") or (usuario is None and txt.strip().isdigit()):
        codigo = txt.split(maxsplit=1)[1] if " " in txt else txt.replace("/vincular", "")
        codigo = codigo.strip()
        if not codigo:
            _tg(chat_id, (
                "🔗 *Vincular esta conversa*\n\n"
                "1. Abra o Solo Routines\n"
                "2. Vá em *Bots*\n"
                "3. Gere o código do Telegram\n"
                "4. Mande ele aqui: `/vincular 123456`\n\n"
                "_O código vale 10 minutos._"
            ))
            return
        try:
            u = vinculo.vincular(db, "telegram", codigo, chat_id,
                                 nome=str(chat_id))
            _tg(chat_id, f"✅ Conversa vinculada a *{u.nome}*.\n"
                         "Mande /ajuda para ver o que dá para fazer.")
        except vinculo.ErroVinculo as e:
            _tg(chat_id, f"❌ {e.mensagem}")
        return

    if not usuario:
        _tg(chat_id, (
            "🔒 Esta conversa ainda não está vinculada a nenhum hunter.\n\n"
            "Abra o app em *Bots*, gere o código do Telegram e mande aqui:\n"
            "`/vincular 123456`"
        ))
        return

    if txt.lower().startswith("/desvincular"):
        vinculo.desvincular(db, usuario, "telegram")
        _tg(chat_id, "🔌 Conversa desvinculada. Nada mais será enviado aqui.")
        return

    hoje = tempo.hoje()

    # ── /start ou /ajuda ─────────────────────────────────
    if txt.lower() in ("/start", "/ajuda", "ajuda"):
        # O MENU COMEÇA PELOS BOTÕES, e não pela lista de comandos. Quem
        # abre `/hoje` e toca não erra de missão; quem digita o título
        # pode errar. A ajuda tem de empurrar para o caminho seguro
        # primeiro e só depois oferecer o atalho de quem tem pressa.
        _tg(chat_id, (
            "⚔️ *Solo Routines*\n\n"
            "O jeito curto: mande `/hoje` e toque nos botões.\n\n"
            "*O dia*\n"
            "▸ `/hoje` — tudo do dia, com botões\n"
            "▸ `/pendentes` — só o que falta\n"
            "▸ `/agora` — o que está em curso e quanto falta\n\n"
            "*Agir* (ou toque no botão)\n"
            "▸ `/iniciar [título]` — dar a largada\n"
            "▸ `/ok [título]` — concluir\n"
            "▸ `/pausar` · `/retomar` · `/cancelar` `[título]`\n"
            "▸ `/desfazer` — desfaz o último ato daqui\n\n"
            "*As especiais*\n"
            "▸ `/somar [título] [valor]` — registrar na meta\n"
            "▸ `/bloco [título]` — fechar etapa do circuito\n"
            "▸ `/confessar [título]` — a passiva que você quebrou\n"
            "▸ `/reerguer [título]` — segunda chance (custa Mana)\n\n"
            "*Conferir*\n"
            "▸ `/status` — XP, nível e corrente\n"
            "▸ `/extrato` — o que rendeu hoje\n"
            "▸ `/penitencia` — dívida em aberto\n"
            "▸ `/portoes` — quais abrem hoje\n"
            "▸ `/conquistas` · `/rotinas` · `/add [título]`\n"
        ))
        return

    # ── /hoje e /pendentes ────────────────────────────────
    #
    # A MESMA TELA, dois recortes. `/hoje` é o panorama; `/pendentes` é
    # o que ainda cobra alguma coisa. Numa terça com onze missões, o
    # panorama já não cabe numa olhada no ponto de ônibus — e o recorte
    # que importa nesse momento é sempre o segundo.
    if txt.startswith("/hoje") or txt.startswith("/pendentes"):
        so_abertas = txt.startswith("/pendentes")
        corpo, teclado = _lista_do_dia(db, usuario, hoje, so_abertas=so_abertas)
        _tg(chat_id, corpo, teclado=teclado)
        return

    # ── /status ───────────────────────────────────────────
    if txt.startswith("/status"):
        pct = 0
        if usuario.xp_proximo_nivel > 0:
            pct = round((usuario.xp_atual / usuario.xp_proximo_nivel) * 100, 1)
        bar_len = 10
        filled = int(bar_len * pct / 100)
        bar = "█" * filled + "░" * (bar_len - filled)

        _tg(chat_id, (
            f"⚔️ *{usuario.nome}* — {usuario.titulo}\n"
            f"🏅 Rank: *{usuario.classe}* | Nível: *{usuario.nivel_atual}*\n"
            f"✨ XP: `{usuario.xp_atual}/{usuario.xp_proximo_nivel}` [{bar}] {pct}%\n"
            f"💰 Mana Coins: *{usuario.moedas}*\n"
            f"🔥 Streak: *{usuario.streak_atual} dias* (máx: {usuario.streak_max})\n"
            f"📊 XP Total: *{usuario.xp_total}*"
        ))
        return

    # ── AS AÇÕES POR TÍTULO ───────────────────────────────
    #
    # Todas passam pelo MESMO caminho: acha (podendo não achar, achar uma
    # ou achar várias), age, responde. O que muda entre `/ok` e
    # `/iniciar` é uma string.
    #
    # E nenhuma delas escolhe sozinha quando há empate — ver a nota do
    # `_procurar`. Foi assim que o `/ok` antigo conseguia concluir a
    # missão errada, silenciosamente.
    for gatilho, acao, verbo in (
        ("/ok",        "ok",   "concluir"),
        ("/concluir",  "ok",   "concluir"),
        ("/iniciar",   "ini",  "iniciar"),
        ("/pausar",    "pau",  "pausar"),
        ("/retomar",   "ret",  "retomar"),
        ("/cancelar",  "can",  "cancelar"),
        ("/reerguer",  "reer", "reerguer"),
        ("/confessar", "conf", "confessar"),
    ):
        if not txt.lower().startswith(gatilho):
            continue

        busca = txt[len(gatilho):].strip()
        if not busca:
            _tg(chat_id, f"⚠️ Use: `{gatilho} título da missão`\n\n"
                         "Ou mande `/hoje` e toque no botão — é mais seguro.")
            return

        # Reerguer e confessar agem sobre missão JÁ FECHADA (fracassada,
        # a passiva do dia), então a busca não pode se limitar às abertas.
        achados = _procurar(db, usuario, busca, hoje,
                            abertas_apenas=acao not in ("reer", "conf"))
        if not achados:
            # ACHOU MAS ESTÁ FECHADA ≠ NÃO EXISTE. Responder "não achei"
            # para uma missão que o hunter acabou de concluir o faria
            # duvidar do título, quando o que mudou foi o estado. Segunda
            # varredura, agora sem filtrar, só para poder dizer a verdade.
            todas = _procurar(db, usuario, busca, hoje, abertas_apenas=False)
            if todas:
                a = todas[0]
                nome = {"CONCLUIDA": "já foi concluída hoje",
                        "FRACASSADA": "fracassou hoje",
                        "CANCELADA": "está cancelada"}.get(a.status, a.status)
                _tg(chat_id, f"⚠️ *{a.titulo}* {nome}.")
                return
            _tg(chat_id, f"❌ Não achei nenhuma missão de hoje com *{busca}*.")
            return
        if len(achados) > 1:
            _menu_escolha(chat_id, acao, achados,
                          f"Achei {len(achados)} missões com *{busca}* para {verbo}.")
            return

        ok, curta, longa = _agir(db, usuario, acao, achados[0], hoje)
        _tg(chat_id, longa or (("✅ " if ok else "⚠️ ") + curta))
        return

    # ── /agora — o que está em curso ──────────────────────
    #
    # O `/status` responde "quem eu sou" (XP, nível, corrente). Esta
    # pergunta é outra: "o que estou fazendo AGORA e quanto tempo me
    # resta". Juntar as duas num comando só faria a mais urgente ficar
    # embaixo da mais vaidosa.
    if txt.startswith("/agora"):
        alvos = _alvos_do_dia(db, usuario, hoje, abertas_apenas=True)
        correndo = [a for a in alvos if a.status in ("ATIVA", "PAUSADA")]

        if not correndo:
            proximas = [a for a in alvos if a.status == "PENDENTE"][:3]
            msg = "⏸️ *Nada em curso agora.*"
            if proximas:
                msg += "\n\nA seguir:\n" + "\n".join(
                    f"⬜ {a.titulo}" + (f" _{_hora_de(a)}_" if _hora_de(a) else "")
                    for a in proximas)
            teclado = [[{"text": f"▶️ Iniciar {a.titulo[:30]}",
                         "callback_data": f"ini|{a.chave}"}] for a in proximas]
            _tg(chat_id, msg, teclado=teclado)
            return

        linhas, teclado = ["⏱️ *Em curso*", ""], []
        for a in correndo:
            falta = _falta(a) or "sem corrida contra o relógio"
            desde = ""
            if a.ed is not None and getattr(a.ed, "iniciada_em", None):
                ini = tempo.de_utc(a.ed.iniciada_em)
                if ini:
                    corridos = int((tempo.agora() - ini).total_seconds() // 60)
                    desde = f" · já correu {corridos}min"
            linhas.append(f"{_SIMBOLO.get(a.status, '▶️')} *{a.titulo}*")
            linhas.append(f"   _{falta}{desde}_")
            teclado.append([{"text": f"— {a.titulo[:40]} —", "callback_data": "nada"}])
            teclado.append(_botoes_de(a))
        _tg(chat_id, "\n".join(linhas), teclado=teclado)
        return

    # ── /desfazer ─────────────────────────────────────────
    if txt.startswith("/desfazer"):
        _desfazer(db, usuario, chat_id, hoje)
        return

    # ── /somar [título] [valor] — as metas ────────────────
    if txt.lower().startswith("/somar"):
        _somar(db, usuario, chat_id, txt[6:].strip(), hoje)
        return

    # ── /bloco [título] — os circuitos ────────────────────
    if txt.lower().startswith("/bloco"):
        _bloco(db, usuario, chat_id, txt[6:].strip(), hoje)
        return

    # ── /extrato, /penitencia, /portoes ───────────────────
    if txt.startswith("/extrato"):
        _extrato(db, usuario, chat_id, hoje)
        return
    if txt.startswith("/penitencia") or txt.startswith("/penitência"):
        _penitencia(db, usuario, chat_id)
        return
    if txt.startswith("/portoes") or txt.startswith("/portões"):
        _portoes(db, usuario, chat_id, hoje)
        return


    # ── /add [título] ─────────────────────────────────────
    if txt.lower().startswith("/add"):
        titulo = txt[4:].strip()
        if not titulo:
            _tg(chat_id, "⚠️ Use: `/add título da tarefa`")
            return
        nova = TarefaDia(
            titulo=titulo,
            data_prevista=hoje,
            prioridade="MEDIA",
            categoria="Pessoal",
            status="PENDENTE",
            xp_recompensa=60,
            moedas_recompensa=10,
            usuario_id=usuario.id,
        )
        db.add(nova)
        db.commit()
        _tg(chat_id, f"📋 Tarefa *{titulo}* adicionada para hoje! (+60 XP ao concluir)")
        return

    # ── /rotinas ──────────────────────────────────────────
    if txt.startswith("/rotinas"):
        rotinas = db.query(Rotina).filter(
            Rotina.usuario_id == usuario.id, Rotina.ativo == True
        ).all()
        if not rotinas:
            _tg(chat_id, "📭 Nenhuma rotina cadastrada.")
            return
        msg = "🔄 *Suas Rotinas Ativas:*\n\n"
        for r in rotinas:
            msg += f"{r.icone} *{r.titulo}* [{r.tipo}] +{r.xp_recompensa} XP\n"
        _tg(chat_id, msg)
        return

    # ── /conquistas ───────────────────────────────────────
    if txt.startswith("/conquistas"):
        from database import ConquistaUsuario, Conquista
        cus = db.query(ConquistaUsuario).filter(
            ConquistaUsuario.usuario_id == usuario.id
        ).order_by(ConquistaUsuario.desbloqueada_em.desc()).limit(5).all()
        if not cus:
            _tg(chat_id, "🎯 Nenhuma conquista ainda. Complete missões para desbloquear!")
            return
        msg = "🏆 *Conquistas Recentes:*\n\n"
        for cu in cus:
            c = db.query(Conquista).filter(Conquista.id == cu.conquista_id).first()
            if c:
                msg += f"{c.icone} *{c.titulo}*\n_{c.descricao}_\n\n"
        _tg(chat_id, msg)
        return

    # ── mensagem não reconhecida ──────────────────────────
    _tg(chat_id, "❓ Comando não reconhecido. Use `/ajuda` para ver os comandos disponíveis.")


# ══════════════════════════════════════════════════════════════════════
# DESFAZER — a rede que um chat exige e uma tela não
# ══════════════════════════════════════════════════════════════════════
def _desfazer(db: Session, usuario, chat_id: str, hoje: date):
    """
    Desfaz o ÚLTIMO ato feito por aqui.

    O QUE ESTE COMANDO DELIBERADAMENTE NÃO FAZ: apagar o registro do
    Extrato ou devolver XP na mão. Concluir uma missão move meia dúzia
    de coisas — XP, Mana, corrente, penitência abatida, progressiva — e
    desmontar tudo isso de fora seria escrever uma sétima verdade sobre
    a economia do Sistema.

    O que ele faz é REABRIR a missão pelo caminho que já existe
    (`cancelar` + estado de volta), e dizer com todas as letras o que
    não voltou. Um desfazer honesto e parcial vale mais que um completo
    e mentiroso.
    """
    from database import AtoBot
    ato = db.query(AtoBot).filter(AtoBot.usuario_id == usuario.id,
                                  AtoBot.canal == "telegram").first()
    if not ato or not ato.acao:
        _tg(chat_id, "Não há nada recente para desfazer por aqui.")
        return

    # JANELA CURTA. Desfazer algo de três dias atrás não é correção de
    # erro de dedo — é reescrever o histórico, e para isso o Extrato
    # existe justamente para não deixar.
    idade = (datetime.utcnow() - (ato.criado_em or datetime.utcnow())).total_seconds()
    if idade > 3600:
        _tg(chat_id, f"O último ato daqui (*{ato.titulo}*) já tem mais de uma "
                     "hora. Passou da janela do desfazer — ajuste pelo app.")
        return

    alvo = _por_chave(db, usuario, "r" if ato.alvo_tipo == "rotina" else "t",
                      ato.alvo_id, hoje)
    if not alvo:
        _tg(chat_id, "A missão do último ato não está mais disponível.")
        return

    if ato.acao in ("ini", "ret"):
        # ── A LARGADA NÃO SE DESFAZ, E ISSO É DECISÃO DO SISTEMA ──────
        #
        # Minha primeira versão chamava `cancelar`, e o router respondeu:
        # "O Sistema não aceita desistência. Uma missão termina cumprida,
        # vencida pelo tempo, ou extinta pelo Arquiteto." É uma regra
        # deliberada, e um `/desfazer` que a contornasse pelo chat abriria
        # justamente a porta que o app mantém fechada.
        #
        # O que existe é PAUSAR. Então é isso que se oferece — dizendo o
        # que aconteceu de verdade, em vez de anunciar um desfazer que não
        # houve.
        ok, curta, _ = _agir(db, usuario, "pau", alvo, hoje)
        db.query(AtoBot).filter(AtoBot.id == ato.id).delete()
        db.commit()
        _tg(chat_id, (
            f"⏸️ *{alvo.titulo}* pausada.\n\n"
            "_A largada em si não se desfaz — o Sistema não aceita "
            "desistência. Uma missão termina cumprida, vencida pelo tempo "
            "ou extinta pelo Arquiteto._"
        ) if ok else f"⚠️ {curta}")
        return

    if ato.acao == "pau":
        ok, curta, _ = _agir(db, usuario, "ret", alvo, hoje)
        db.query(AtoBot).filter(AtoBot.id == ato.id).delete()
        db.commit()
        _tg(chat_id, f"↩️ *{alvo.titulo}* voltou a correr."
            if ok else f"⚠️ {curta}")
        return

    if ato.acao == "ok":
        _tg(chat_id, (
            f"↩️ *Desfazer conclusão de {alvo.titulo}*\n\n"
            f"Isso rendeu ✨{ato.xp} XP e 💰{ato.moedas} Mana, e o lançamento "
            "já está no Extrato — o Sistema não apaga o que aconteceu.\n\n"
            "Para corrigir de verdade, use o cartão no app: lá dá para ver "
            "o que foi creditado antes de mexer."
        ))
        return

    _tg(chat_id, f"Não sei desfazer *{ato.acao}* por aqui.")


# ══════════════════════════════════════════════════════════════════════
# AS ESPECIAIS
# ══════════════════════════════════════════════════════════════════════
def _somar(db: Session, usuario, chat_id: str, resto: str, hoje: date):
    """`/somar título valor` — registra na meta do dia."""
    from fastapi import HTTPException as _HTTPErro
    from routers import execucoes as _exec
    from motors import meta as _mt

    partes = (resto or "").rsplit(" ", 1)
    if len(partes) < 2:
        _tg(chat_id, "⚠️ Use: `/somar título 50`\n_O valor vai por último._")
        return
    busca, cru = partes[0].strip(), partes[1].strip()
    try:
        # Vírgula decimal: é como se escreve em português, e recusar
        # "12,50" por causa disso seria implicância com o próprio idioma.
        valor = float(cru.replace("R$", "").replace(",", "."))
    except ValueError:
        _tg(chat_id, f"⚠️ Não entendi *{cru}* como número.")
        return

    achados = [a for a in _procurar(db, usuario, busca, hoje)
               if _mt.eh_meta_valida(a.obj)]
    if not achados:
        _tg(chat_id, f"❌ Não achei missão de META hoje com *{busca}*.")
        return
    if len(achados) > 1:
        _menu_escolha(chat_id, "ok", achados,
                      f"Achei {len(achados)} metas com *{busca}*.")
        return

    a = achados[0]
    try:
        pedido = _exec.MetaRegistrarRequest(
            rotina_id=a.id if a.tipo == "r" else None,
            tarefa_id=a.id if a.tipo == "t" else None,
            valor=valor, nota="Pelo bot")
        r = _exec.meta_registrar(pedido, db, usuario) or {}
    except _HTTPErro as e:
        _tg(chat_id, f"⚠️ {e.detail}")
        return

    esp = getattr(a.obj, "meta_especie", None)
    un = _mt.unidade_de(a.obj)
    atual = r.get("atual", r.get("meta_atual"))
    alvo_n = getattr(a.obj, "meta_alvo", None)
    linha = f"📈 *{a.titulo}*\n+{_mt.formatar(valor, esp, un)}"
    if atual is not None and alvo_n:
        linha += (f"\nAgora: *{_mt.formatar(atual, esp, un)}* "
                  f"de {_mt.formatar(alvo_n, esp, un)}")
    # Se o registro fechou a meta, quem fechou foi o `_liquidar` lá
    # dentro — o bot só conta, não decide.
    if r.get("concluida") or r.get("alcancada"):
        linha += "\n\n✅ *Meta alcançada — missão concluída.*"
    _tg(chat_id, linha)


def _bloco(db: Session, usuario, chat_id: str, busca: str, hoje: date):
    """`/bloco título` — mostra as etapas e deixa fechar uma por botão."""
    from motors import circuito as _cir
    if not busca:
        _tg(chat_id, "⚠️ Use: `/bloco título da missão`")
        return

    achados = [a for a in _procurar(db, usuario, busca, hoje)
               if _cir.eh_circuito(a.obj)]
    if not achados:
        _tg(chat_id, f"❌ Não achei missão de CIRCUITO hoje com *{busca}*.")
        return
    if len(achados) > 1:
        _menu_escolha(chat_id, "ok", achados,
                      f"Achei {len(achados)} circuitos com *{busca}*.")
        return

    a = achados[0]
    acum = a.ed if a.tipo == "r" else a.obj
    desenho = _cir.normalizar(a.obj.circuito_payload) or {}
    feito = _cir.ler_feito(getattr(acum, "circuito_feito", None))
    p = _cir.progresso(desenho, feito)

    linhas = [f"🧩 *{a.titulo}*",
              f"_{p['fechados']} de {p['total']} blocos_", ""]
    teclado = []
    for e in (desenho.get("etapas") or []):
        pronto = _cir.bloco_completo(e, feito.get(e["id"]) or {})
        linhas.append(f"{'✅' if pronto else '⬜'} {e.get('titulo') or e['id']}")
        if not pronto:
            teclado.append([{"text": f"✔ {(e.get('titulo') or e['id'])[:40]}",
                             "callback_data": f"blk|{a.chave}|{e['id']}"}])
    _tg(chat_id, "\n".join(linhas), teclado=teclado)


# ══════════════════════════════════════════════════════════════════════
# LEITURA — estes só olham, nunca mexem
# ══════════════════════════════════════════════════════════════════════
def _extrato(db: Session, usuario, chat_id: str, hoje: date):
    execs = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao == hoje).all()
    fracassos = db.query(ExecucaoDia).filter(
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data == hoje,
        ExecucaoDia.status == "FRACASSADA").all()

    xp = sum(e.xp_ganho or 0 for e in execs)
    mc = sum(e.moedas_ganhas or 0 for e in execs)
    perdido = sum(f.xp_perdido or 0 for f in fracassos)

    linhas = [f"🧾 *Extrato — {hoje.strftime('%d/%m')}*", "",
              f"✅ Concluídas: *{len(execs)}*",
              f"✨ XP ganho: *+{xp}*",
              f"💰 Mana: *+{mc}*"]
    # A perda só aparece quando existe. "XP perdido: 0" todo dia
    # transforma o número em ruído, e no dia em que ele deixa de ser zero
    # ninguém repara.
    if perdido or fracassos:
        linhas += [f"❌ Fracassadas: *{len(fracassos)}*",
                   f"💀 XP perdido: *−{perdido}*",
                   f"➖ Saldo do dia: *{xp - perdido:+d}*"]
    _tg(chat_id, "\n".join(linhas))


def _penitencia(db: Session, usuario, chat_id: str):
    from motors import penitencia as _pen
    abertas = _pen.pendentes(db, usuario.id)
    if not abertas:
        _tg(chat_id, "⛓️ Nenhuma penitência em aberto. A conta está limpa.")
        return
    linhas = [f"⛓️ *Penitências em aberto: {len(abertas)}*", ""]
    teclado = []
    for t in abertas[:8]:
        origem = getattr(t, "origem_data", None)
        linhas.append(f"• {t.titulo}" + (f" _(de {origem.strftime('%d/%m')})_"
                                         if origem else ""))
        teclado.append([{"text": f"✔ {t.titulo[:40]}",
                         "callback_data": f"ok|t|{t.id}"}])
    linhas.append("\n_Cumprir quita a dívida — não paga XP cheio._")
    _tg(chat_id, "\n".join(linhas), teclado=teclado)


def _portoes(db: Session, usuario, chat_id: str, hoje: date):
    """Quais portões abrem hoje, e a que horas."""
    from database import Dungeon
    from motors import calendario_projecao as _proj

    todos = db.query(Dungeon).filter(Dungeon.usuario_id == usuario.id,
                                     Dungeon.status == "ATIVA").all()
    abertos = [d for d in todos if _proj.dungeon_devida_em(d, hoje)]
    if not abertos:
        _tg(chat_id, "🚪 Nenhum portão abre hoje.")
        return

    linhas = [f"🚪 *Portões de hoje — {hoje.strftime('%d/%m')}*", ""]
    for d in abertos:
        ini, fim = _proj.horario_do_dia(d, hoje)
        quando = f"{ini}–{fim}" if ini and fim else (ini or "dia inteiro")
        linhas.append(f"▸ *{d.titulo}* — _{quando}_")
    # ATRAVESSAR O PORTÃO NÃO SE FAZ POR AQUI, de propósito: a dungeon é
    # uma sessão viva, com heartbeat e cronômetro. Abrir uma pelo chat e
    # sair andando deixaria uma sessão aberta sem ninguém dentro.
    linhas.append("\n_Para atravessar, use o app — a sessão precisa de "
                  "você presente._")
    _tg(chat_id, "\n".join(linhas))


def _rotina_de_hoje(rotina: Rotina, hoje: date) -> bool:
    """
    A ROTINA CAI NESTE DIA? — e esta função não sabe a resposta.

    Ela era a QUINTA cópia da regra de recorrência neste projeto. Uma
    reescrita de memória do `fechamento.rotina_devida_em`: mesmos quatro
    tipos, mesma leitura do `dias_semana`, mesmo `mes_dia` partido no
    hífen. Parecia idêntica.

    Duas regras iguais hoje não são duas regras: são uma regra e uma
    bomba-relógio. A divergência não chega quando se copia — chega no dia
    em que alguém ajusta UMA delas. E a cópia do bot é a que ninguém
    lembraria de ajustar, porque ela não aparece em nenhuma tela: o
    sintoma seria o bot listando um dia diferente do que o app mostra,
    sem erro nenhum, e a suspeita cairia no fuso ou no cache.

    O calendário já tinha matado a quarta cópia apontando para cá. Esta
    aponta para o mesmo lugar.
    """
    from motors import fechamento
    return fechamento.rotina_devida_em(rotina, hoje)


def _estado_do_dia(db: Session, usuario, rotina: Rotina, hoje: date) -> str:
    """
    O status REAL da rotina hoje — da `ExecucaoDia`, que é o que a tela lê.

    O `/hoje` marcava ✅ comparando `rotina.ultima_execucao == hoje`. Esse
    campo é um carimbo solto, escrito por vários caminhos e lido por
    nenhuma tela; o ciclo de vida da missão (PENDENTE → ATIVA →
    CONCLUIDA | FRACASSADA | CANCELADA) mora na `ExecucaoDia`.

    Na prática: uma missão em curso, com o cronômetro correndo no app,
    aparecia no chat com o mesmo quadradinho vazio de uma que nem
    começou. E uma fracassada aparecia como pendente — convidando o
    hunter a um `/ok` que só traria "não encontrada".
    """
    ed = db.query(ExecucaoDia).filter(
        ExecucaoDia.rotina_id == rotina.id,
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data == hoje,
    ).first()
    return (ed.status if ed else "PENDENTE") or "PENDENTE"


# O símbolo carrega o estado sozinho: no chat não há cor nem tooltip para
# socorrer, e "⬜" para tudo esconde exatamente o que o hunter quer saber.
_SIMBOLO = {
    "PENDENTE":   "⬜",
    "ATIVA":      "▶️",
    "CONCLUIDA":  "✅",
    "FRACASSADA": "❌",
    "CANCELADA":  "🚫",
    "PAUSADA":    "⏸️",
}


# ══════════════════════════════════════════════════════════════════════
# ACHAR A MISSÃO — e por que isto é o coração do bot, não um detalhe
#
# O `/ok` original fazia `ilike %texto%` e pegava O PRIMEIRO que casasse.
# Numa agenda com "Fazer 50 abdominais" e "Faça 30 flexões" repetidas, e
# três missões começando com "Conseguir", um `/ok conseguir` fechava uma
# à sorte. E fechar a errada não é um engano reversível: custa XP, mexe
# na corrente e deixa a certa em aberto.
#
# A regra aqui é simples e vale para todo comando que recebe um título:
# ZERO resultados é um aviso; UM é a ação; MAIS DE UM NUNCA ESCOLHE
# SOZINHO — devolve a lista com botões, e quem decide é o hunter.
# ══════════════════════════════════════════════════════════════════════
class Alvo:
    """Uma missão concreta, já sabendo se é rotina ou missão geral."""

    __slots__ = ("tipo", "id", "titulo", "obj", "ed", "status")

    def __init__(self, tipo, obj, ed=None, status="PENDENTE"):
        self.tipo = tipo              # 'r' (rotina) | 't' (missão geral)
        self.obj = obj
        self.id = obj.id
        self.titulo = obj.titulo
        self.ed = ed                  # a ExecucaoDia, só para rotina
        self.status = status

    @property
    def chave(self):
        return f"{self.tipo}|{self.id}"


def _alvos_do_dia(db: Session, usuario, hoje: date, abertas_apenas=False) -> list:
    """Tudo que existe hoje para este hunter, rotinas e missões gerais."""
    lista = []

    rotinas = db.query(Rotina).filter(
        Rotina.usuario_id == usuario.id, Rotina.ativo == True      # noqa: E712
    ).all()
    devidas = [r for r in rotinas if _rotina_de_hoje(r, hoje)]
    if devidas:
        eds = {e.rotina_id: e for e in db.query(ExecucaoDia).filter(
            ExecucaoDia.usuario_id == usuario.id,
            ExecucaoDia.data == hoje,
            ExecucaoDia.rotina_id.in_([r.id for r in devidas]),
        ).all()}
        for r in devidas:
            ed = eds.get(r.id)
            lista.append(Alvo("r", r, ed, (ed.status if ed else "PENDENTE") or "PENDENTE"))

    for t in db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista == hoje,
    ).all():
        lista.append(Alvo("t", t, None, (t.status or "PENDENTE")))

    if abertas_apenas:
        lista = [a for a in lista
                 if a.status in ("PENDENTE", "ATIVA", "PAUSADA")]

    # Quem tem hora vai primeiro e em ordem: é a linha do tempo do dia.
    # O resto é "em algum momento" e desce para o fim.
    def ordem(a):
        h = getattr(a.obj, "hora_inicio", None) or getattr(a.obj, "hora_limite", None)
        return (h is None, str(h or ""), a.titulo or "")
    lista.sort(key=ordem)
    return lista


def _procurar(db: Session, usuario, busca: str, hoje: date,
              abertas_apenas=True) -> list:
    """
    Os alvos que casam com o texto. Pode devolver zero, um ou vários —
    e quem chama TEM de tratar os três casos.
    """
    termo = (busca or "").strip().lower()
    if not termo:
        return []
    todos = _alvos_do_dia(db, usuario, hoje, abertas_apenas=abertas_apenas)

    # Casar o título inteiro vence: quem digitou o nome exato não quer
    # ver um menu de desambiguação por causa de um prefixo compartilhado.
    exatos = [a for a in todos if (a.titulo or "").strip().lower() == termo]
    if exatos:
        return exatos
    return [a for a in todos if termo in (a.titulo or "").lower()]


def _menu_escolha(chat_id: str, acao: str, alvos: list, cabecalho: str):
    """Mais de uma casou: o hunter escolhe, o bot não adivinha."""
    teclado = [[{"text": f"{_SIMBOLO.get(a.status, '⬜')} {a.titulo[:50]}",
                 "callback_data": f"{acao}|{a.chave}"}] for a in alvos[:8]]
    extra = ("\n\n_Mostrando as 8 primeiras._" if len(alvos) > 8 else "")
    _tg(chat_id, f"{cabecalho}\n\nQual delas?{extra}", teclado=teclado)


def _por_chave(db: Session, usuario, tipo: str, ident: int, hoje: date):
    """
    Um alvo a partir do que veio de um BOTÃO.

    E aqui mora a regra de segurança do teclado inteiro: o
    `callback_data` viaja no cliente e volta como o cliente quiser. Um
    hunter curioso manda `ok|r|999` e tenta concluir a rotina de outro.

    Por isso a consulta filtra por `usuario_id` SEMPRE, e não confia em
    nada além do id. É a mesma disciplina do `vinculo.por_origem`: o que
    chega do canal prova que alguém falou, nunca de quem é a coisa.
    """
    if tipo == "r":
        r = db.query(Rotina).filter(Rotina.id == ident,
                                    Rotina.usuario_id == usuario.id).first()
        if not r:
            return None
        ed = db.query(ExecucaoDia).filter(
            ExecucaoDia.rotina_id == r.id,
            ExecucaoDia.usuario_id == usuario.id,
            ExecucaoDia.data == hoje).first()
        return Alvo("r", r, ed, (ed.status if ed else "PENDENTE") or "PENDENTE")

    t = db.query(TarefaDia).filter(TarefaDia.id == ident,
                                   TarefaDia.usuario_id == usuario.id).first()
    return Alvo("t", t, None, (t.status or "PENDENTE")) if t else None


# ══════════════════════════════════════════════════════════════════════
# O TEMPO QUE FALTA
# ══════════════════════════════════════════════════════════════════════
def _falta(alvo: Alvo) -> str:
    """
    Quanto resta do prazo, em texto curto.

    Vazio quando não há corrida: uma missão de dia inteiro dizendo
    "faltam 9h14" transformaria toda linha da lista num cronômetro, e o
    urgente deixaria de se destacar do que só precisa acontecer hoje.
    """
    from motors import prazos, tempo as _t
    try:
        if alvo.tipo == "r":
            p = (prazos.da_execucao(alvo.ed, alvo.obj) if alvo.ed
                 else prazos.da_rotina(alvo.obj, _t.hoje()))
        else:
            p = prazos.da_tarefa(alvo.obj)
    except Exception:
        return ""
    if not p or not p.get("fim"):
        return ""
    # Só anuncia contagem de JANELA — o dia inteiro não é uma corrida.
    if not p.get("janela") and not p.get("reerguida"):
        return ""
    resta = (p["fim"] - _t.agora()).total_seconds()
    if resta <= 0:
        return "prazo vencido"
    h, m = int(resta // 3600), int((resta % 3600) // 60)
    return (f"{h}h{m:02d}m" if h else f"{m}m") + " restantes"


def _hora_de(alvo: Alvo) -> str:
    hi = getattr(alvo.obj, "hora_inicio", None)
    hf = getattr(alvo.obj, "hora_fim", None) or getattr(alvo.obj, "hora_limite", None)
    if hi and hf:
        return f"{hi}–{hf}"
    return hi or hf or ""


# ══════════════════════════════════════════════════════════════════════
# A LISTA COM BOTÕES
# ══════════════════════════════════════════════════════════════════════
def _botoes_de(alvo: Alvo) -> list:
    """
    O que dá para fazer com ESTA missão agora.

    Um botão que não cabe no estado não aparece — e isso não é enfeite.
    "Iniciar" numa missão já concluída só tem um destino possível: um
    toque, um erro e a suspeita de que o bot está quebrado. Botão que
    existe tem de funcionar.
    """
    b = []
    st = alvo.status
    if st in ("PENDENTE", "PAUSADA"):
        b.append({"text": "▶️ Iniciar" if st == "PENDENTE" else "▶️ Retomar",
                  "callback_data": f"{'ini' if st == 'PENDENTE' else 'ret'}|{alvo.chave}"})
    if st == "ATIVA":
        b.append({"text": "⏸️ Pausar", "callback_data": f"pau|{alvo.chave}"})
    if st in ("PENDENTE", "ATIVA", "PAUSADA"):
        b.append({"text": "✅ Concluir", "callback_data": f"ok|{alvo.chave}"})
    if st == "FRACASSADA":
        # Reerguer custa Mana — por isso vai com o preço no rótulo, e não
        # como um botão inocente ao lado dos outros.
        b.append({"text": "🔥 Reerguer", "callback_data": f"reer|{alvo.chave}"})
    return b


def _lista_do_dia(db: Session, usuario, hoje: date, so_abertas=False):
    """Devolve `(texto, teclado)` — a tela do dia dentro do chat."""
    alvos = _alvos_do_dia(db, usuario, hoje, abertas_apenas=so_abertas)

    titulo = "📋 *Pendentes*" if so_abertas else \
             f"📅 *Missões de Hoje — {hoje.strftime('%d/%m/%Y')}*"
    if not alvos:
        vazio = ("Nada em aberto. 🎉" if so_abertas
                 else "Nenhuma missão para hoje! 🎉")
        return f"{titulo}\n\n{vazio}", []

    linhas, teclado = [titulo, ""], []
    for a in alvos:
        marca = _SIMBOLO.get(a.status, "⬜")
        hora = _hora_de(a)
        falta = _falta(a) if a.status in ("PENDENTE", "ATIVA", "PAUSADA") else ""
        cauda = " · ".join(x for x in (hora, falta) if x)
        linhas.append(f"{marca} {a.titulo}" + (f"\n   _{cauda}_" if cauda else ""))

        bts = _botoes_de(a)
        if bts:
            # O rótulo da missão vai numa linha PRÓPRIA acima dos botões.
            # Sem ele, uma lista de dez missões vira trinta botões
            # idênticos e o toque errado deixa de ser acidente: vira
            # estatística.
            teclado.append([{"text": f"— {a.titulo[:40]} —",
                             "callback_data": "nada"}])
            teclado.append(bts)

    return "\n".join(linhas), teclado


# ══════════════════════════════════════════════════════════════════════
# AGIR
# ══════════════════════════════════════════════════════════════════════
def _registrar_ato(db: Session, usuario, acao: str, alvo: Alvo, res=None):
    """Guarda o último ato para o `/desfazer`. Uma linha por hunter/canal."""
    from database import AtoBot
    a = db.query(AtoBot).filter(AtoBot.usuario_id == usuario.id,
                                AtoBot.canal == "telegram").first()
    if not a:
        a = AtoBot(usuario_id=usuario.id, canal="telegram")
        db.add(a)
    a.acao = acao
    a.alvo_tipo = "rotina" if alvo.tipo == "r" else "tarefa"
    a.alvo_id = alvo.id
    a.titulo = (alvo.titulo or "")[:200]
    a.xp = int((res or {}).get("xp_ganho", 0) or 0)
    a.moedas = int((res or {}).get("moedas_ganhas", 0) or 0)
    a.criado_em = datetime.utcnow()
    db.commit()


def _agir(db: Session, usuario, acao: str, alvo: Alvo, hoje: date):
    """
    Executa a ação pelos MESMOS endpoints que o app usa.

    Nenhuma regra nasce aqui — este arquivo já pagou caro por isso uma
    vez, quando o `/ok` inventou a própria conclusão e deixou missões
    num limbo que o fechamento punia. Aqui só se traduz "toque no botão"
    para "chamada de router", e o resultado de volta para uma frase.

    Devolve `(ok, frase_curta, frase_longa)`. A curta vai no aviso do
    topo do Telegram (200 caracteres); a longa, quando existe, vira
    mensagem no chat.
    """
    from fastapi import HTTPException as _HTTPErro
    from routers import execucoes as _exec, rotinas as _rot, tarefas as _tar

    try:
        if acao == "ok":
            if alvo.tipo == "r":
                corpo, res = _exec.concluir(db, usuario, alvo.obj, hoje,
                                            observacao=f"Bot: {alvo.titulo}")
            else:
                corpo = _tar.concluir(db, usuario, alvo.obj)
                res = corpo.get("resultado")
            _registrar_ato(db, usuario, "ok", alvo, res)
            if not res:
                return True, "Penitência cumprida.", f"⛓️ *Penitência cumprida.*\n📋 {alvo.titulo}"
            liq = (corpo or {}).get("liquidacao") or {}
            atraso = liq.get("penalidade") or 0
            longa = (f"✅ *Concluída!*\n{alvo.titulo}\n"
                     f"✨ +{res['xp_ganho']} XP | 💰 +{res['moedas_ganhas']} Mana\n"
                     + (f"⏰ −{atraso} XP por fora do prazo\n" if atraso else "")
                     + f"🔥 Streak: {res['streak_atual']} dias"
                     + (_level_up_msg(res['level_ups']) if res.get('level_ups') else ""))
            return True, f"+{res['xp_ganho']} XP", longa

        if acao == "ini":
            (_rot.iniciar_rotina if alvo.tipo == "r" else _tar.iniciar_tarefa)(
                alvo.id, db, usuario)
            _registrar_ato(db, usuario, "ini", alvo)
            return True, "Missão iniciada.", None

        if acao == "pau":
            (_rot.pausar_rotina if alvo.tipo == "r" else _tar.pausar_tarefa)(
                alvo.id, db, usuario)
            _registrar_ato(db, usuario, "pau", alvo)
            return True, "Pausada.", None

        if acao == "ret":
            (_rot.retomar_rotina if alvo.tipo == "r" else _tar.retomar_tarefa)(
                alvo.id, db, usuario)
            _registrar_ato(db, usuario, "ret", alvo)
            return True, "Retomada.", None

        if acao == "can":
            (_rot.cancelar_rotina if alvo.tipo == "r" else _tar.cancelar_tarefa)(
                alvo.id, db, usuario)
            _registrar_ato(db, usuario, "can", alvo)
            return True, "Cancelada.", None

        if acao == "reer":
            if alvo.tipo != "r" or not alvo.ed:
                return False, "Só rotina do dia se reergue.", None
            r = _exec.reerguer(_exec.ReerguerRequest(execucao_id=alvo.ed.id),
                               db, usuario)
            _registrar_ato(db, usuario, "reer", alvo)
            custo = (r or {}).get("custo") or (r or {}).get("moedas") or ""
            return True, "Reerguida.", (
                f"🔥 *{alvo.titulo}* reerguida.\n"
                + (f"💰 Custou {custo} Mana.\n" if custo else "")
                + "_A janela não volta: o que volta é o resto do dia._")

        if acao == "conf":
            if alvo.tipo != "r" or not alvo.ed:
                return False, "Só rotina do dia se confessa.", None
            _exec.confessar(_exec.ConfessarRequest(execucao_id=alvo.ed.id,
                                                   observacao="Confessada pelo bot"),
                            db, usuario)
            _registrar_ato(db, usuario, "conf", alvo)
            return True, "Confessada.", (
                f"🕯️ *{alvo.titulo}* — confessada.\n"
                "_Dizer a verdade na hora vale mais que o placar do dia._")

    except _HTTPErro as e:
        return False, str(e.detail)[:190], None
    except Exception as e:                      # pragma: no cover
        print(f"[BOT] acao {acao} falhou: {e}")
        return False, "Não consegui fazer isso agora.", None

    return False, "Ação desconhecida.", None


def _level_up_msg(level_ups: list) -> str:
    if not level_ups:
        return ""
    msgs = []
    for lu in level_ups:
        msgs.append(f"\n🎉 *LEVEL UP!* Nível {lu['nivel']} — {lu['rank']}\n_{lu['titulo']}_\n+{lu['moedas_bonus']} Mana Coins bônus!")
    return "\n".join(msgs)


# ── Notificações automáticas ──────────────────────────────────

def _destinatarios(db: Session) -> list:
    """
    Os hunters alcançáveis pelo Telegram — cada um no SEU chat.

    Antes as três notificações mandavam para `ALLOWED_CHAT`, um id único
    no `.env`. Não era só limitação: era um vazamento. O resumo do dia
    inclui XP, corrente e as missões pelo nome — e todo hunter que
    surgisse depois teria os dados dele despejados no chat do primeiro.

    Hunter sem vínculo simplesmente não está nesta lista. Ninguém recebe
    aviso de uma conversa que não provou ser dele.
    """
    if not BOT_TOKEN:
        return []
    try:
        from motors import vinculo
        return vinculo.vinculados(db, "telegram")
    except Exception as e:
        print(f"[BOT] nao consegui listar destinatarios: {e}")
        return []


def _para_cada(db: Session, envio) -> None:
    """
    UM HUNTER COM PROBLEMA NÃO CALA O BOT PARA OS OUTROS.

    Mesma disciplina do `fechamento.rodar`: o laço engole a falha
    individual, registra e segue. Sem isto, um chat bloqueado — o hunter
    apagou a conversa, deu block no bot — derrubaria a notificação de
    todo mundo, e o sintoma seria "o bot parou de funcionar".
    """
    for usuario in _destinatarios(db):
        try:
            envio(db, usuario, usuario.telegram_chat_id)
        except Exception as e:
            print(f"[BOT] falha ao notificar {usuario.login}: {e}")


def varrer_avisos(db: Session) -> dict:
    """
    O VARREDOR — de cinco em cinco minutos.

    POR QUE ELE RODA O FECHAMENTO, e não só consulta

    O auto-início era calculado NA LEITURA: a missão das 20:00 só virava
    ATIVA no banco quando alguém abria o app. O próprio `auto_iniciar`
    já previa este dia — "quando [a notificação] existir, o processo por
    minuto vira necessário, e o gancho é esta mesma função".

    Sem rodar o fechamento aqui não haveria o que anunciar: no banco, a
    missão ainda não teria começado, e o prazo ainda não teria vencido.
    O aviso seria uma segunda verdade sobre o estado — que é o defeito
    que este arquivo já cometeu uma vez, com o `/ok`.

    Efeito colateral bem-vindo: a missão passa a fracassar na hora em que
    o prazo vence de verdade, e não quando alguém entra no app ou à
    meia-noite. `processar_usuario` é idempotente por desenho, e o
    julgamento da penitência tem a trava de "um por dia".

    CINCO MINUTOS é a granularidade certa: "faltam 15 minutos" com
    resolução de 5 é honesto; com resolução de 30 seria mentira.

    UM HUNTER COM PROBLEMA NÃO CALA OS OUTROS — mesma disciplina do
    `fechamento.rodar` e do `_para_cada`.
    """
    from motors import avisos, fechamento

    resultado = {"hunters": 0, "avisos": 0, "erros": 0}

    # ── O FECHAMENTO VALE PARA TODO HUNTER, tenha bot ou não ─────────
    #
    # Minha primeira versão varria só `_destinatarios()`, ou seja, só
    # quem tem conversa vinculada — e, pior, nem isso: sem
    # `TELEGRAM_BOT_TOKEN` aquela lista é vazia por desenho, então o
    # varredor inteiro virava no-op num servidor sem bot.
    #
    # Acender a missão na hora e fracassá-la quando o prazo vence é
    # comportamento do SISTEMA, não do Telegram. Amarrar um ao outro
    # faria o app se comportar diferente conforme uma variável de
    # ambiente que nada tem a ver com missões.
    for usuario in db.query(Usuario).filter(Usuario.ativo == True).all():  # noqa: E712
        try:
            resumo = fechamento.processar_usuario(db, usuario)
            db.commit()
            resultado["hunters"] += 1

            # Daqui para baixo é sobre AVISAR, e aí sim é preciso ter
            # para onde mandar.
            if not (BOT_TOKEN and usuario.telegram_chat_id):
                continue

            lista = avisos.para_enviar(
                db, usuario,
                acesas=resumo.get("acesas_agora"),
                falhas=resumo.get("falhas"))
            if not lista:
                continue

            _tg(usuario.telegram_chat_id, avisos.compor(lista))

            # SÓ MARCA DEPOIS DE ENVIAR. Marcar antes e falhar no envio
            # cala o aviso para sempre — e o silêncio de um defeito é
            # indistinguível do silêncio de "não havia nada".
            avisos.marcar(db, usuario, lista)
            resultado["avisos"] += len(lista)
        except Exception as e:
            db.rollback()
            resultado["erros"] += 1
            print(f"[AVISOS] ⚠ hunter {usuario.login}: {e}")
    return resultado


def notificar_manha(db: Session):
    """Resumo das missões do dia, às 07:00."""
    _para_cada(db, _manha)


def _manha(db: Session, usuario, chat: str):
    hoje = tempo.hoje()
    rotinas = [r for r in db.query(Rotina).filter(
        Rotina.usuario_id == usuario.id, Rotina.ativo == True
    ).all() if _rotina_de_hoje(r, hoje)]
    tarefas = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista == hoje,
    ).count()

    _tg(chat, (
        f"⚔️ *Sistema de Missões Ativado!*\n"
        f"📅 {hoje.strftime('%A, %d/%m/%Y')}\n\n"
        f"🔄 Rotinas hoje: *{len(rotinas)}*\n"
        f"📋 Tarefas: *{tarefas}*\n"
        f"🔥 Streak atual: *{usuario.streak_atual} dias*\n\n"
        f"Use `/hoje` para ver os detalhes. *Arise!* 🌑"
    ))


def notificar_tarde(db: Session):
    """Lembra das missões críticas pendentes, às 14:00."""
    _para_cada(db, _tarde)


def _tarde(db: Session, usuario, chat: str):
    hoje = tempo.hoje()
    pendentes = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista == hoje,
        TarefaDia.status == "PENDENTE",
        TarefaDia.prioridade.in_(["CRITICA", "ALTA"]),
    ).all()
    if not pendentes:
        return          # silêncio é melhor que "você não tem nada crítico"
    msg = "🔔 *Missões críticas pendentes:*\n\n"
    for t in pendentes:
        msg += f"🔴 {t.titulo}\n"
    _tg(chat, msg)


def notificar_noite(db: Session):
    """Resumo do dia, às 21:00."""
    _para_cada(db, _noite)


def _noite(db: Session, usuario, chat: str):
    hoje = tempo.hoje()
    execs = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao == hoje,
    ).all()
    xp_hoje = sum(e.xp_ganho or 0 for e in execs)
    mc_hoje = sum(e.moedas_ganhas or 0 for e in execs)

    _tg(chat, (
        f"🌑 *Fim do Dia — Relatório*\n\n"
        f"✅ Missões concluídas: *{len(execs)}*\n"
        f"✨ XP ganho hoje: *{xp_hoje}*\n"
        f"💰 Mana Coins: *+{mc_hoje}*\n"
        f"🔥 Streak: *{usuario.streak_atual} dias*\n"
        f"🏅 Nível: *{usuario.nivel_atual}* ({usuario.classe})\n\n"
        f"_Continue amanhã para manter o streak!_ ⚔️"
    ))


# ══════════════════════════════════════════════════════════════════════
# O TOQUE NUM BOTÃO
# ══════════════════════════════════════════════════════════════════════
def _tocou(toque: dict, db: Session):
    """
    Um `callback_query`: alguém tocou num botão da lista.

    TRÊS COISAS QUE PRECISAM ESTAR CERTAS AQUI, e nenhuma é óbvia:

    1. RESPONDER SEMPRE. O Telegram espera o `answerCallbackQuery`; sem
       ele a ampulheta gira no botão e o hunter conclui que travou —
       inclusive quando a ação funcionou.

    2. O `callback_data` NÃO É CONFIÁVEL. Ele viaja no cliente e volta
       como o cliente quiser: `ok|r|999` tentando concluir a rotina de
       outro hunter. Quem defende é o `_por_chave`, que filtra por
       `usuario_id` sempre. Este é o ponto do bot mais parecido com um
       formulário aberto na internet.

    3. BOTÃO VELHO É NORMAL. A lista de ontem continua rolável no chat,
       com os botões de ontem clicáveis. O estado real manda: se a
       missão já fechou, a resposta é um aviso, nunca um segundo
       crédito.
    """
    cb_id = toque.get("id", "")
    dados = toque.get("data") or ""
    msg = toque.get("message") or {}
    chat_id = str((msg.get("chat") or {}).get("id", ""))
    message_id = msg.get("message_id")

    if dados == "nada":
        # É o rótulo da missão, não um botão. O Telegram exige
        # `callback_data` em todo botão, então o rótulo virou um que não
        # faz nada — e precisa responder, senão gira a ampulheta.
        _responder_toque(cb_id)
        return

    usuario = _get_usuario(db, chat_id)
    if not usuario:
        _responder_toque(cb_id, "Esta conversa não está vinculada.", True)
        return

    partes = dados.split("|")
    if len(partes) < 3:
        _responder_toque(cb_id, "Botão não reconhecido.", True)
        return

    acao, tipo, ident = partes[0], partes[1], partes[2]
    if tipo not in ("r", "t") or not str(ident).isdigit():
        _responder_toque(cb_id, "Botão não reconhecido.", True)
        return

    hoje = tempo.hoje()
    alvo = _por_chave(db, usuario, tipo, int(ident), hoje)
    if not alvo:
        # Inclui a tentativa de alcançar a missão de outro hunter: para
        # quem toca, os dois casos são o mesmo — e é melhor assim, um
        # "não é sua" confirmaria que o id existe.
        _responder_toque(cb_id, "Essa missão não está mais disponível.", True)
        return

    # O BLOCO DO CIRCUITO tem um quarto pedaço: qual etapa.
    if acao == "blk" and len(partes) >= 4:
        from fastapi import HTTPException as _HTTPErro
        from routers import execucoes as _exec
        try:
            _exec.circuito_registrar(_exec.CircuitoRegistrarRequest(
                rotina_id=alvo.id if alvo.tipo == "r" else None,
                tarefa_id=alvo.id if alvo.tipo == "t" else None,
                etapa_id=partes[3], valor=None), db, usuario)
            _responder_toque(cb_id, "Bloco fechado.")
            _bloco(db, usuario, chat_id, alvo.titulo, hoje)
        except _HTTPErro as e:
            _responder_toque(cb_id, str(e.detail)[:190], True)
        return

    ok, curta, longa = _agir(db, usuario, acao, alvo, hoje)
    _responder_toque(cb_id, curta, alerta=not ok)

    if ok:
        # A LISTA SE REDESENHA NO LUGAR. Sem isto o hunter fica olhando
        # os botões do estado anterior e toca de novo, achando que o
        # primeiro toque não pegou.
        corpo, teclado = _lista_do_dia(db, usuario, hoje)
        if message_id:
            _editar(chat_id, message_id, corpo, teclado)
        if longa:
            _tg(chat_id, longa)


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/webhook")
async def webhook(request: Request):
    # `if WEBHOOK_SECRET and ...` era o desenho antigo: sem segredo, a
    # condição toda virava falsa e o endpoint aceitava QUALQUER corpo.
    # Uma variável esquecida no `.env` abria a porta em silêncio — e o
    # sintoma era "o bot funciona", que é o pior sintoma possível.
    if not WEBHOOK_SECRET:
        raise HTTPException(503, "TELEGRAM_SECRET não configurado no servidor")

    # `secrets.compare_digest`, e não `!=`: comparar strings sai no
    # primeiro byte diferente, e o tempo de resposta vaza quantos bytes
    # estavam certos. Com respostas suficientes o segredo se descobre
    # caractere por caractere.
    import secrets as _secrets
    cabecalho = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not _secrets.compare_digest(cabecalho, WEBHOOK_SECRET):
        raise HTTPException(403, "Token secreto inválido")

    try:
        update = await request.json()
    except Exception:
        return {"ok": True}

    # ── O TOQUE NUM BOTÃO ────────────────────────────────────────────
    toque = update.get("callback_query")
    if toque:
        db = SessionLocal()
        try:
            _tocou(toque, db)
        except Exception as e:
            print(f"[BOT] callback: {e}")
            _responder_toque(toque.get("id", ""), "Não consegui fazer isso.", True)
        finally:
            db.close()
        return {"ok": True}

    message = update.get("message") or update.get("edited_message")
    if message:
        chat_id = str(message.get("chat", {}).get("id", ""))
        texto   = message.get("text", "")

        # A TRAVA DO `ALLOWED_CHAT` SAIU DAQUI.
        #
        # Ela comparava o chat com um único id fixo no `.env` — a mesma
        # premissa de um hunter só que o `_get_usuario` carregava. Com
        # ela de pé, nenhum outro hunter conseguiria sequer VINCULAR: a
        # primeira mensagem dele levaria "acesso não autorizado" e o
        # fluxo do código de seis dígitos nunca começaria.
        #
        # Quem autoriza agora é o vínculo, e ele é mais forte: o
        # `ALLOWED_CHAT` protegia um id que qualquer um pode descobrir,
        # enquanto o vínculo exige um código que só aparece na tela de
        # quem já entrou na conta.
        #
        # Mantido só como LISTA DE ESPERA opcional: preenchido, restringe
        # quem pode tentar vincular. Vazio (o padrão), qualquer um pode
        # tentar — e sem o código não passa da porta.
        if ALLOWED_CHAT and chat_id not in [c.strip() for c in ALLOWED_CHAT.split(",")]:
            _tg(chat_id, "⛔ Este bot não está aberto para novas conversas.")
            return {"ok": True}

        if texto:
            db = SessionLocal()
            try:
                _processar(texto, chat_id, db)
            except Exception as e:
                print(f"[BOT] Erro inesperado: {e}")
                _tg(chat_id, f"❌ Erro: {e}")
            finally:
                db.close()

    return {"ok": True}


# O menu que aparece ao digitar "/" no Telegram. A ordem é a de uso, não
# a alfabética: `/hoje` é o que a pessoa quer em nove de cada dez vezes,
# e o que exige explicação fica embaixo.
COMANDOS_MENU = [
    {"command": "hoje",       "description": "Missões do dia, com botões"},
    {"command": "pendentes",  "description": "Só o que ainda falta"},
    {"command": "agora",      "description": "O que está em curso e quanto falta"},
    {"command": "iniciar",    "description": "Dar a largada numa missão"},
    {"command": "ok",         "description": "Concluir uma missão"},
    {"command": "pausar",     "description": "Pausar o cronômetro"},
    {"command": "retomar",    "description": "Voltar a correr"},
    {"command": "desfazer",   "description": "Desfaz o último ato daqui"},
    {"command": "somar",      "description": "Registrar valor numa meta"},
    {"command": "bloco",      "description": "Fechar etapa de um circuito"},
    {"command": "confessar",  "description": "A passiva que você quebrou"},
    {"command": "reerguer",   "description": "Segunda chance (custa Mana)"},
    {"command": "status",     "description": "XP, nível e corrente"},
    {"command": "extrato",    "description": "O que o dia rendeu"},
    {"command": "penitencia", "description": "Dívida em aberto"},
    {"command": "portoes",    "description": "Quais portões abrem hoje"},
    {"command": "add",        "description": "Criar uma missão rápida"},
    {"command": "ajuda",      "description": "Todos os comandos"},
]


def _base_publica() -> str:
    """
    De onde o Telegram vai nos chamar.

    Reaproveita `OAUTH_REDIRECT_BASE` porque ela já responde exatamente a
    esta pergunta — "qual é o endereço público desta instância" — e é a
    que o Google usa para voltar do OAuth. Duas variáveis para o mesmo
    fato divergem no dia em que o domínio muda, e a que ninguém lembrar
    de trocar quebra calada.
    """
    return os.getenv("OAUTH_REDIRECT_BASE", "").rstrip("/")


def _url_webhook(base: str | None = None) -> str:
    return f"{(base or _base_publica()).rstrip('/')}/api/bot/webhook"


@router.post("/configurar-webhook")
def configurar_webhook(
    webhook_url: str | None = None,
    _: Usuario = Depends(get_arquiteto),
):
    """
    Registra o webhook no Telegram. O `webhook_url` virou OPCIONAL: sem
    ele, usa o endereço público que o servidor já conhece — era a única
    coisa que obrigava o Arquiteto a montar um `curl` à mão.
    """
    if not BOT_TOKEN:
        raise HTTPException(400, "TELEGRAM_BOT_TOKEN não configurado neste servidor")
    if not WEBHOOK_SECRET:
        raise HTTPException(400,
            "TELEGRAM_SECRET não configurado. Sem segredo o webhook recusa "
            "tudo — registrar agora só criaria um bot mudo.")

    base = (webhook_url or _base_publica()).rstrip("/")
    if not base.startswith("https://"):
        # Não é capricho: o Telegram só entrega webhook em HTTPS. Sem esta
        # checagem o erro chega como um "Bad Request" genérico deles.
        raise HTTPException(400,
            f"O endereço precisa começar com https:// (recebi '{base or 'vazio'}'). "
            "Confira OAUTH_REDIRECT_BASE no .env do servidor.")

    alvo = _url_webhook(base)
    resp = req_lib.post(
        TELEGRAM_API.format(token=BOT_TOKEN, method="setWebhook"),
        json={"url": alvo, "secret_token": WEBHOOK_SECRET,
              # `callback_query` E OBRIGATORIO AQUI. Sem ele o Telegram
              # simplesmente NAO ENTREGA os toques nos botoes — e o
              # sintoma seria o pior possivel: a lista aparece bonita,
              # os botoes existem, e tocar neles nao faz nada, sem erro
              # em lugar nenhum.
              "allowed_updates": ["message", "edited_message",
                                  "callback_query"],
              # Updates acumulados enquanto o webhook esteve fora valem
              # pouco e podem executar comandos velhos (`/ok` de ontem
              # chegando hoje). Descartar é mais honesto que reviver.
              "drop_pending_updates": True},
        timeout=15,
    )
    resultado = resp.json()
    if not resultado.get("ok"):
        raise HTTPException(400, f"Telegram: {resultado.get('description')}")

    # ── O MENU DE COMANDOS, no mesmo ato ─────────────────────────────
    #
    # É o "/" que abre a lista dentro do Telegram. Sem isto o hunter só
    # descobre um comando lendo o `/ajuda` — e comando que não aparece no
    # menu é comando que ninguém usa.
    #
    # Registrado JUNTO com o webhook de propósito: são as duas metades da
    # mesma configuração, e separá-las criaria o estado meio-pronto em que
    # o bot responde mas parece não ter comandos.
    #
    # Falhar aqui NÃO derruba o registro do webhook: o menu é conforto, o
    # webhook é o que faz o bot existir.
    menu = _chamar("setMyCommands", {"commands": COMANDOS_MENU})
    return {"ok": True, "url": alvo,
            "menu_ok": bool(menu.get("ok")),
            "msg": f"Webhook registrado em {alvo}"}


@router.delete("/webhook")
def remover_webhook(_: Usuario = Depends(get_arquiteto)):
    if not BOT_TOKEN:
        raise HTTPException(400, "TELEGRAM_BOT_TOKEN não configurado")
    resp = req_lib.post(TELEGRAM_API.format(token=BOT_TOKEN, method="deleteWebhook"),
                        json={"drop_pending_updates": True}, timeout=15)
    return {"ok": bool(resp.json().get("ok"))}


def diagnostico() -> dict:
    """
    O ESTADO REAL DO BOT, perguntado ao Telegram.

    A versão anterior respondia:

        "pronto": bool(BOT_TOKEN and ALLOWED_CHAT)

    e estava errada nas duas pontas. O `ALLOWED_CHAT` deixou de ser
    autorização quando o vínculo de seis dígitos entrou — virou lista de
    espera opcional, e o normal é estar VAZIO. Ou seja: um bot
    perfeitamente funcional relatava `pronto: false`, enquanto um bot com
    as duas variáveis preenchidas e nenhum webhook registrado — que é o
    estado em que ele nunca recebe uma única mensagem — relatava
    `pronto: true`. A resposta era decorativa nos dois sentidos.

    Ter o token não é estar pronto. Pronto é o TELEGRAM saber para onde
    entregar, e quem tem essa informação é o Telegram. `getWebhookInfo`
    ainda devolve de graça as duas coisas que o Arquiteto precisaria de
    acesso ao servidor para descobrir: quantos updates estão encalhados e
    qual foi o último erro de entrega.

    SÓ O ARQUITETO vê isto (ver os dois endpoints que chamam esta
    função). A resposta diz o endereço do webhook e o erro cru do
    Telegram — é diagnóstico de servidor, não informação de hunter.
    """
    info: dict = {}
    erro_consulta = None
    if BOT_TOKEN:
        try:
            r = req_lib.get(TELEGRAM_API.format(token=BOT_TOKEN,
                                                method="getWebhookInfo"),
                            timeout=10)
            info = (r.json() or {}).get("result") or {}
        except Exception as e:
            # NÃO inventa um estado. "Não consegui perguntar" é diferente
            # de "não está registrado", e confundir os dois manda o
            # Arquiteto reconfigurar um webhook que estava de pé.
            erro_consulta = str(e)

    registrado = bool(info.get("url"))
    esperado = _url_webhook()

    return {
        "token_configurado": bool(BOT_TOKEN),
        "segredo_configurado": bool(WEBHOOK_SECRET),
        "segredo_fraco": segredo_fraco(),
        "usuario_bot": os.getenv("TELEGRAM_BOT_USERNAME", ""),
        "lista_espera": [c.strip() for c in ALLOWED_CHAT.split(",") if c.strip()],

        "webhook_registrado": registrado,
        "webhook_url": info.get("url") or "",
        "webhook_esperado": esperado,
        # Registrado num endereço que não é o nosso é pior que não
        # registrado: parece certo na lista e as mensagens vão para outro
        # lugar (uma instância antiga, um túnel de teste esquecido).
        "webhook_confere": bool(registrado and info.get("url") == esperado),
        "updates_pendentes": info.get("pending_update_count", 0),
        "ultimo_erro": info.get("last_error_message") or "",
        "erro_consulta": erro_consulta,

        "pronto": bool(BOT_TOKEN and WEBHOOK_SECRET and not segredo_fraco()
                       and registrado and info.get("url") == esperado),
    }


@router.get("/status")
def status_bot(_: Usuario = Depends(get_arquiteto)):
    return diagnostico()
