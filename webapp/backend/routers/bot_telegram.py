"""
Router do Bot Telegram para o Solo Routines.
Recebe webhooks, permite concluir missões e consultar status via chat.
"""
import os, requests as req_lib
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta
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


def _tg(chat_id: str, texto: str, parse_mode: str = "Markdown"):
    if not BOT_TOKEN:
        return
    url = TELEGRAM_API.format(token=BOT_TOKEN, method="sendMessage")
    try:
        req_lib.post(url, json={"chat_id": chat_id, "text": texto,
                                "parse_mode": parse_mode}, timeout=10)
    except Exception as e:
        print(f"[BOT] Erro ao enviar: {e}")


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
        _tg(chat_id, (
            "⚔️ *Solo Routines Bot*\n\n"
            "Comandos disponíveis:\n"
            "▸ `/hoje` — Missões e rotinas do dia\n"
            "▸ `/status` — Seu XP, nível e streak\n"
            "▸ `/ok [título]` — Concluir uma missão\n"
            "▸ `/rotinas` — Listar rotinas ativas\n"
            "▸ `/add [título]` — Adicionar tarefa rápida\n"
            "▸ `/conquistas` — Ver conquistas recentes\n"
            "▸ `/ajuda` — Este menu\n"
        ))
        return

    # ── /hoje ─────────────────────────────────────────────
    if txt.startswith("/hoje"):
        rotinas = [
            r for r in db.query(Rotina).filter(
                Rotina.usuario_id == usuario.id, Rotina.ativo == True
            ).all()
            if _rotina_de_hoje(r, hoje)
        ]
        tarefas = db.query(TarefaDia).filter(
            TarefaDia.usuario_id == usuario.id,
            TarefaDia.data_prevista == hoje,
        ).all()

        msg = f"📅 *Missões de Hoje — {hoje.strftime('%d/%m/%Y')}*\n\n"
        if rotinas:
            msg += "🔄 *Rotinas:*\n"
            for r in rotinas:
                est = _estado_do_dia(db, usuario, r, hoje)
                msg += (f"{_SIMBOLO.get(est, '⬜')} {r.icone} {r.titulo} "
                        f"(+{r.xp_recompensa} XP)\n")
        if tarefas:
            msg += "\n📋 *Tarefas:*\n"
            for t in tarefas:
                check = "✅" if t.status == "CONCLUIDA" else ("🔴" if t.prioridade == "CRITICA" else "⬜")
                hora = f" ⏰{t.hora_limite}" if t.hora_limite else ""
                msg += f"{check} {t.titulo}{hora} (+{t.xp_recompensa} XP)\n"
        if not rotinas and not tarefas:
            msg += "Nenhuma missão para hoje! 🎉"

        _tg(chat_id, msg)
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

    # ── /ok [título] ──────────────────────────────────────
    if txt.lower().startswith("/ok"):
        busca = txt[3:].strip()
        if not busca:
            _tg(chat_id, "⚠️ Use: `/ok título da missão`")
            return

        # Procura tarefa pendente
        tarefa = db.query(TarefaDia).filter(
            TarefaDia.usuario_id == usuario.id,
            TarefaDia.data_prevista == hoje,
            TarefaDia.status == "PENDENTE",
            TarefaDia.titulo.ilike(f"%{busca}%"),
        ).first()

        if tarefa:
            # Mesmo princípio do caminho da rotina, logo abaixo: quem
            # conclui é o `tarefas.concluir`. A versão anterior carimbava
            # CONCLUIDA e pagava o XP cru — e com isso uma PENITÊNCIA
            # cumprida pelo chat pagava progresso cheio, quando o desenho
            # manda quitá-la devolvendo só uma fração do que a falha
            # tomou. Falhar de propósito virava estratégia, pelo Telegram.
            from fastapi import HTTPException as _HTTPErro
            from routers import tarefas as _tar
            try:
                # Devolve o corpo já montado (passou pelo `anexar`), não a
                # dupla `(corpo, resultado)` do `execucoes.concluir`.
                corpo = _tar.concluir(db, usuario, tarefa)
            except _HTTPErro as e:
                _tg(chat_id, f"⚠️ {e.detail}")
                return

            res = corpo.get("resultado")
            if not res:
                # Penitência quitada: não é ganho de XP, é dívida abatida.
                # Anunciar "+0 XP" faria parecer defeito o que é a regra.
                _tg(chat_id, f"⛓️ *Penitência cumprida.*\n📋 {tarefa.titulo}")
                return

            liq = corpo.get("liquidacao") or {}
            atraso = liq.get("penalidade") or 0
            _tg(chat_id, (
                f"✅ *Tarefa concluída!*\n"
                f"📋 {tarefa.titulo}\n"
                f"✨ +{res['xp_ganho']} XP | 💰 +{res['moedas_ganhas']} Mana Coins\n"
                + (f"⏰ −{atraso} XP por fora do prazo\n" if atraso else "")
                + f"🔥 Streak: {res['streak_atual']} dias\n"
                + (_level_up_msg(res['level_ups']) if res['level_ups'] else "")
            ))
            return

        # Procura rotina de hoje
        rotina = db.query(Rotina).filter(
            Rotina.usuario_id == usuario.id,
            Rotina.ativo == True,
            Rotina.titulo.ilike(f"%{busca}%"),
        ).first()

        if rotina and _rotina_de_hoje(rotina, hoje):
            # ── CONCLUIR É UM ATO SÓ, E ELE MORA NO `execucoes.concluir` ──
            #
            # Aqui havia uma conclusão inventada: `ultima_execucao = hoje`
            # mais um `aplicar_xp` com o XP cru da rotina. Parecia certo e
            # não era conclusão nenhuma — a tela lê a `ExecucaoDia`, que
            # ficava PENDENTE. O bot dizia "concluída", o cartão no app
            # continuava com o botão INICIAR MISSÃO, e o `aplicar_xp`
            # ainda gravava a linha em `Execucao` que TRANCA a conclusão
            # pelo app. A missão virava impossível de fechar — e à meia-
            # noite o fechamento a marcava FRACASSADA, com punição.
            #
            # O import é aqui dentro, e não no topo: `main.py` monta os
            # dois routers, e importar um do outro em tempo de módulo
            # fecharia o ciclo.
            from fastapi import HTTPException as _HTTPErro
            from routers import execucoes as _exec
            try:
                corpo, res = _exec.concluir(db, usuario, rotina, hoje,
                                            observacao=f"Bot: {rotina.titulo}")
            except _HTTPErro as e:
                # As travas da meta e do circuito já falam em português e
                # dizem quanto falta. Repassar é melhor que traduzir.
                _tg(chat_id, f"⚠️ {e.detail}")
                return

            liq = corpo.get("liquidacao") or {}
            atraso = liq.get("penalidade") or 0
            _tg(chat_id, (
                f"✅ *Rotina concluída!*\n"
                f"🔄 {rotina.icone} {rotina.titulo}\n"
                f"✨ +{res['xp_ganho']} XP | 💰 +{res['moedas_ganhas']} Mana Coins\n"
                # O XP agora vem da Balança e do PRAZO, não do número cru
                # da rotina. Se saiu menos por atraso, o chat diz — senão
                # o hunter vê um valor diferente do cartão e não entende.
                + (f"⏰ −{atraso} XP por fora do prazo\n" if atraso else "")
                + f"🔥 Streak: {res['streak_atual']} dias\n"
                + (_level_up_msg(res['level_ups']) if res['level_ups'] else "")
            ))
            return

        _tg(chat_id, f"❌ Missão *{busca}* não encontrada nas pendentes de hoje.")
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
}


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
              "allowed_updates": ["message", "edited_message"],
              # Updates acumulados enquanto o webhook esteve fora valem
              # pouco e podem executar comandos velhos (`/ok` de ontem
              # chegando hoje). Descartar é mais honesto que reviver.
              "drop_pending_updates": True},
        timeout=15,
    )
    resultado = resp.json()
    if resultado.get("ok"):
        return {"ok": True, "url": alvo, "msg": f"Webhook registrado em {alvo}"}
    raise HTTPException(400, f"Telegram: {resultado.get('description')}")


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
