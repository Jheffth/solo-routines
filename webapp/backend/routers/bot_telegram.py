"""
Router do Bot Telegram para o Solo Routines.
Recebe webhooks, permite concluir missões e consultar status via chat.
"""
import os, json, requests as req_lib
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta

from database import (
    get_db, Usuario, Rotina, TarefaDia, Execucao, SessionLocal
)
from motors.gamificacao import aplicar_xp, calcular_xp_rotina, calcular_xp_tarefa

router = APIRouter(prefix="/bot", tags=["bot-telegram"])

TELEGRAM_API   = "https://api.telegram.org/bot{token}/{method}"
BOT_TOKEN      = os.getenv("TELEGRAM_BOT_TOKEN", "")
ALLOWED_CHAT   = os.getenv("TELEGRAM_CHAT_ID", "")
WEBHOOK_SECRET = os.getenv("TELEGRAM_SECRET", "solorotinas")


def _tg(chat_id: str, texto: str, parse_mode: str = "Markdown"):
    if not BOT_TOKEN:
        return
    url = TELEGRAM_API.format(token=BOT_TOKEN, method="sendMessage")
    try:
        req_lib.post(url, json={"chat_id": chat_id, "text": texto,
                                "parse_mode": parse_mode}, timeout=10)
    except Exception as e:
        print(f"[BOT] Erro ao enviar: {e}")


def _get_usuario(db: Session):
    """Retorna o primeiro usuário ativo (modo solo — 1 usuário)."""
    return db.query(Usuario).filter(Usuario.ativo == True).first()


def _processar(texto: str, chat_id: str, db: Session):
    txt = texto.strip()
    usuario = _get_usuario(db)
    if not usuario:
        _tg(chat_id, "❌ Nenhum usuário encontrado no sistema.")
        return

    hoje = date.today()

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
                check = "✅" if r.ultima_execucao == hoje else "⬜"
                msg += f"{check} {r.icone} {r.titulo} (+{r.xp_recompensa} XP)\n"
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
            from datetime import datetime
            tarefa.status = "CONCLUIDA"
            tarefa.concluida_em = datetime.utcnow()
            db.flush()
            res = aplicar_xp(db, usuario, tarefa.xp_recompensa, tarefa.moedas_recompensa,
                             hoje, tarefa_id=tarefa.id, observacao=f"Bot: {tarefa.titulo}")
            _tg(chat_id, (
                f"✅ *Tarefa concluída!*\n"
                f"📋 {tarefa.titulo}\n"
                f"✨ +{res['xp_ganho']} XP | 💰 +{res['moedas_ganhas']} Mana Coins\n"
                f"🔥 Streak: {res['streak_atual']} dias\n"
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
            ja = db.query(Execucao).filter(
                Execucao.usuario_id == usuario.id,
                Execucao.rotina_id == rotina.id,
                Execucao.data_execucao == hoje,
            ).first()
            if ja:
                _tg(chat_id, f"⚠️ Rotina *{rotina.titulo}* já foi concluída hoje!")
                return
            rotina.ultima_execucao = hoje
            db.flush()
            xp_b, mc = calcular_xp_rotina(rotina.tipo)
            res = aplicar_xp(db, usuario, rotina.xp_recompensa or xp_b,
                             rotina.moedas_recompensa or mc,
                             hoje, rotina_id=rotina.id,
                             observacao=f"Bot: {rotina.titulo}")
            _tg(chat_id, (
                f"✅ *Rotina concluída!*\n"
                f"🔄 {rotina.icone} {rotina.titulo}\n"
                f"✨ +{res['xp_ganho']} XP | 💰 +{res['moedas_ganhas']} Mana Coins\n"
                f"🔥 Streak: {res['streak_atual']} dias\n"
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
    if not rotina.ativo:
        return False
    if rotina.tipo == "DIARIA":
        return True
    if rotina.tipo == "SEMANAL":
        try:
            dias = json.loads(rotina.dias_semana) if rotina.dias_semana else []
            return hoje.weekday() in dias
        except Exception:
            return False
    if rotina.tipo == "MENSAL":
        return hoje.day == rotina.dia_mes
    if rotina.tipo == "ANUAL" and rotina.mes_dia:
        try:
            m, d = rotina.mes_dia.split("-")
            return hoje.month == int(m) and hoje.day == int(d)
        except Exception:
            return False
    return False


def _level_up_msg(level_ups: list) -> str:
    if not level_ups:
        return ""
    msgs = []
    for lu in level_ups:
        msgs.append(f"\n🎉 *LEVEL UP!* Nível {lu['nivel']} — {lu['rank']}\n_{lu['titulo']}_\n+{lu['moedas_bonus']} Mana Coins bônus!")
    return "\n".join(msgs)


# ── Notificações automáticas ──────────────────────────────────

def notificar_manha(db: Session):
    """Envia resumo das missões do dia às 07:00."""
    if not BOT_TOKEN or not ALLOWED_CHAT:
        return
    usuario = _get_usuario(db)
    if not usuario:
        return
    hoje = date.today()
    rotinas = [r for r in db.query(Rotina).filter(
        Rotina.usuario_id == usuario.id, Rotina.ativo == True
    ).all() if _rotina_de_hoje(r, hoje)]
    tarefas = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista == hoje,
    ).count()

    _tg(ALLOWED_CHAT, (
        f"⚔️ *Sistema de Missões Ativado!*\n"
        f"📅 {hoje.strftime('%A, %d/%m/%Y')}\n\n"
        f"🔄 Rotinas hoje: *{len(rotinas)}*\n"
        f"📋 Tarefas: *{tarefas}*\n"
        f"🔥 Streak atual: *{usuario.streak_atual} dias*\n\n"
        f"Use `/hoje` para ver os detalhes. *Arise!* 🌑"
    ))


def notificar_tarde(db: Session):
    """Lembra de missões críticas pendentes às 14:00."""
    if not BOT_TOKEN or not ALLOWED_CHAT:
        return
    usuario = _get_usuario(db)
    if not usuario:
        return
    hoje = date.today()
    pendentes = db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista == hoje,
        TarefaDia.status == "PENDENTE",
        TarefaDia.prioridade.in_(["CRITICA", "ALTA"]),
    ).all()
    if pendentes:
        msg = "🔔 *Missões críticas pendentes:*\n\n"
        for t in pendentes:
            msg += f"🔴 {t.titulo}\n"
        _tg(ALLOWED_CHAT, msg)


def notificar_noite(db: Session):
    """Envia resumo do dia às 21:00."""
    if not BOT_TOKEN or not ALLOWED_CHAT:
        return
    usuario = _get_usuario(db)
    if not usuario:
        return
    hoje = date.today()
    execs = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao == hoje,
    ).all()
    xp_hoje = sum(e.xp_ganho for e in execs)
    mc_hoje  = sum(e.moedas_ganhas for e in execs)

    _tg(ALLOWED_CHAT, (
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
    secret_header = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if WEBHOOK_SECRET and secret_header != WEBHOOK_SECRET:
        raise HTTPException(403, "Token secreto inválido")

    try:
        update = await request.json()
    except Exception:
        return {"ok": True}

    message = update.get("message") or update.get("edited_message")
    if message:
        chat_id = str(message.get("chat", {}).get("id", ""))
        texto   = message.get("text", "")

        if ALLOWED_CHAT and chat_id != ALLOWED_CHAT:
            _tg(chat_id, "⛔ Acesso não autorizado.")
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


@router.post("/configurar-webhook")
def configurar_webhook(webhook_url: str):
    if not BOT_TOKEN:
        raise HTTPException(400, "TELEGRAM_BOT_TOKEN não configurado")
    url_webhook = f"{webhook_url}/api/bot/webhook"
    resp = req_lib.post(
        TELEGRAM_API.format(token=BOT_TOKEN, method="setWebhook"),
        json={"url": url_webhook, "secret_token": WEBHOOK_SECRET,
              "allowed_updates": ["message", "edited_message"]},
        timeout=15,
    )
    resultado = resp.json()
    if resultado.get("ok"):
        return {"ok": True, "msg": f"Webhook configurado: {url_webhook}"}
    raise HTTPException(400, f"Telegram: {resultado.get('description')}")


@router.get("/status")
def status_bot():
    return {
        "token_configurado":  bool(BOT_TOKEN),
        "chat_id_configurado": bool(ALLOWED_CHAT),
        "pronto":             bool(BOT_TOKEN and ALLOWED_CHAT),
    }
