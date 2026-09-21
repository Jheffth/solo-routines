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
from motors import conversa

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




# ══════════════════════════════════════════════════════════════════════
# O CANAL — o que o motor de conversa precisa saber sobre o Telegram
#
# Toda a conversa mudou de casa: `motors/conversa.py`. Aqui ficou o
# TRANSPORTE — falar HTTP com o Telegram — e a tradução do formato
# neutro de opções para o teclado inline.
#
# A razão da mudança foi o WhatsApp. Copiar mil linhas para um segundo
# arquivo criaria a sétima segunda-verdade deste projeto, e a regra de
# recorrência já mostrou como isso termina: cinco cópias, e a do bot era
# a que ninguém lembraria de ajustar.
# ══════════════════════════════════════════════════════════════════════
class CanalTelegram(conversa.Canal):
    nome = "telegram"
    botoes = True          # e é o único dos dois que tem

    def enviar(self, texto: str, opcoes=None):
        # `_tg` é procurado no MÓDULO a cada chamada, e não guardado no
        # objeto: é o que permite os testes trocarem o Telegram por uma
        # caixa de mentira sem saber que existe um canal no meio.
        return _tg(self.origem, texto, teclado=_teclado(opcoes))


def _teclado(opcoes):
    """
    O formato neutro do motor vira teclado inline.

        [{"titulo": "Banho", "acoes": [{"rotulo": "▶️", "dados": "ini|r|1"}]}]

    O título vira uma linha PRÓPRIA acima dos botões, com um
    `callback_data` que não faz nada. Sem ele, uma lista de dez missões
    seria trinta botões idênticos e o toque errado deixaria de ser
    acidente para virar estatística.
    """
    if not opcoes:
        return None
    linhas = []
    for g in opcoes:
        acoes = [{"text": a["rotulo"], "callback_data": a["dados"]}
                 for a in (g.get("acoes") or [])]
        if not acoes:
            continue
        titulo = (g.get("titulo") or "").strip()
        if titulo:
            linhas.append([{"text": f"— {titulo[:40]} —", "callback_data": "nada"}])
        linhas.append(acoes)
    return linhas or None


def _processar(texto: str, chat_id: str, db: Session):
    """
    A porta de entrada do texto. Mantida com esta assinatura porque é o
    que os testes e o webhook chamam — por dentro, delega ao motor.
    """
    return conversa.processar(CanalTelegram(chat_id), texto, db)


def _rotina_de_hoje(rotina, hoje):
    """Atalho de compatibilidade: a regra mora no motor (e, antes dele,
    no `fechamento.rotina_devida_em`, que é a única cópia de verdade)."""
    return conversa.rotina_de_hoje(rotina, hoje)


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


def _canais_de_aviso(db: Session, usuario) -> list:
    """
    POR ONDE OS AVISOS DESTE HUNTER SAEM — e por que é uma escolha.

    Com os dois canais vinculados e sem escolher, o mesmo "faltam 15
    minutos" chegaria no Telegram E no WhatsApp. Tecnicamente funciona
    (a dedupe já separa por canal), mas o caminho mais curto para alguém
    silenciar os DOIS é receber tudo em dobro.

    O canal não escolhido NÃO É DESLIGADO: ele continua aceitando
    comandos normalmente. Isto decide quem o Sistema PROCURA, não com
    quem ele conversa.

    E a preferência não vale contra a realidade: escolher WhatsApp sem
    ter WhatsApp vinculado não deixa o hunter sem aviso nenhum — cai no
    canal que existe. Uma preferência que produz silêncio total é um
    defeito disfarçado de configuração.
    """
    from motors import avisos as _av
    pref = _av.preferencia(db, usuario)
    escolha = (pref.canal_avisos or "telegram").lower()

    tem_tg = bool(BOT_TOKEN and usuario.telegram_chat_id)
    tem_wa = False
    try:
        from motors import evolution
        tem_wa = bool(evolution.configurado() and usuario.whatsapp_jid)
    except Exception:
        tem_wa = False

    canais = []
    quer_tg = escolha in ("telegram", "ambos") or not tem_wa
    quer_wa = escolha in ("whatsapp", "ambos") or not tem_tg

    if tem_tg and quer_tg:
        chat = usuario.telegram_chat_id
        canais.append(("telegram", lambda texto: _tg(chat, texto)))
    if tem_wa and quer_wa:
        from routers import bot_whatsapp as _wa
        jid = usuario.whatsapp_jid
        canais.append(("whatsapp", lambda texto: _wa._enviar(jid, texto)))
    return canais


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
            for canal, entregar in _canais_de_aviso(db, usuario):
                lista = avisos.para_enviar(
                    db, usuario,
                    acesas=resumo.get("acesas_agora"),
                    falhas=resumo.get("falhas"),
                    canal=canal)
                if not lista:
                    continue

                entregar(avisos.compor(lista))

                # SÓ MARCA DEPOIS DE ENVIAR. Marcar antes e falhar no
                # envio cala o aviso para sempre — e o silêncio de um
                # defeito é indistinguível do silêncio de "não havia
                # nada".
                avisos.marcar(db, usuario, lista, canal=canal)
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
       outro hunter. Quem defende é o `conversa.agir`, que reconfere todo
       alvo contra `usuario_id`. Este é o ponto do bot mais parecido com
       um formulário aberto na internet.

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

    canal = CanalTelegram(chat_id)
    ok, curta, longa = conversa.agir(db, usuario, canal, dados)
    _responder_toque(cb_id, curta, alerta=not ok)
    if not ok:
        return

    # O bloco do circuito repinta a própria lista de etapas, não a do
    # dia: fechar um bloco não muda o estado da missão.
    if isinstance(longa, tuple) and longa and longa[0] == "__bloco__":
        conversa.mostrar_blocos(db, usuario, canal, longa[1])
        return

    # A LISTA SE REDESENHA NO LUGAR. Sem isto o hunter fica olhando os
    # botões do estado anterior e toca de novo, achando que o primeiro
    # toque não pegou.
    corpo, opcoes = conversa.tela_do_dia(db, usuario)
    if message_id:
        _editar(chat_id, message_id, corpo, _teclado(opcoes))
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
