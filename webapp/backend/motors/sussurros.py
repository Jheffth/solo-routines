"""Ecos pelo Solo Bot: pós-commit, melhor esforço e agenda persistente.

A tentativa espontânea é reservada ANTES da rede. Um timeout pode significar
que o Bot recebeu: não repetimos nessa situação (no máximo uma tentativa/dia).
Ecos imediatos são best-effort, sem fila de reenvio após queda do processo.
"""
import logging
import random
from datetime import datetime, time, timedelta
from sqlalchemy import event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import PreferenciaAviso, SussurroAgenda, SussurroEnviado, Usuario
from motors import ecos, tempo
import solobot_ponte

log = logging.getLogger(__name__)
_FILA = "ecos_apos_commit"


def modo(db, usuario_id):
    p = db.query(PreferenciaAviso).filter_by(usuario_id=usuario_id).first()
    return (p.sussurros if p else None) or "voz"


def recentes(db, usuario_id):
    return [r.cru for r in db.query(SussurroEnviado).filter_by(usuario_id=usuario_id)
            .order_by(SussurroEnviado.id.desc()).limit(10).all()]


def _enviar(bind, mensagem):
    """Sessão independente: after_commit não pode consultar a sessão original."""
    try:
        with Session(bind=bind) as db:
            uid = mensagem["usuario_id"]
            pref = modo(db, uid)
            if pref == "desligado":
                return False
            kwargs = {"voz": pref == "voz", "tom": "sussurro"}
            if mensagem.get("valido_ate") is not None:
                kwargs["valido_ate"] = mensagem["valido_ate"]
            # Não passa falado: o tom instrui o Bot a falar a frase literal.
            if not solobot_ponte.avisar(uid, mensagem["texto"], **kwargs):
                return False
            if mensagem.get("cru"):
                # Serializa a retenção por hunter sem apagar o histórico alheio.
                db.query(Usuario.id).filter_by(id=uid).with_for_update().first()
                db.add(SussurroEnviado(usuario_id=uid, cru=mensagem["cru"]))
                db.flush()
                antigos = [r.id for r in db.query(SussurroEnviado.id).filter_by(usuario_id=uid)
                           .order_by(SussurroEnviado.id.desc()).offset(10).all()]
                if antigos:
                    db.query(SussurroEnviado).filter(SussurroEnviado.id.in_(antigos)).delete(synchronize_session=False)
                db.commit()
            return True
    except Exception:
        # Nem a rede nem a manutenção do histórico podem desfazer a penitência.
        log.warning("Não foi possível entregar/registrar um sussurro do Sistema.")
        return False


def apos_commit(db, usuario, eco, *, teste=False, autor_id=None):
    """Registra intenção, nunca envia durante a transação da penitência."""
    if not eco or not eco.get("texto"):
        return
    if teste and not (usuario.nivel_acesso == "Arquiteto" and autor_id == usuario.id):
        return
    db.info.setdefault(_FILA, []).append({
        "usuario_id": usuario.id,
        "texto": ("[teste] " if teste else "") + eco["texto"],
        "cru": eco.get("cru"),
    })


@event.listens_for(Session, "after_commit")
def _confirmado(db):
    if db.in_nested_transaction():
        return  # release de savepoint não confirma a transação externa
    for mensagem in db.info.pop(_FILA, []):
        _enviar(db.get_bind(), mensagem)


@event.listens_for(Session, "after_rollback")
def _desfeito(db):
    db.info.pop(_FILA, None)


@event.listens_for(Session, "after_transaction_end")
def _encerrado(db, transacao):
    if transacao.parent is None:
        db.info.pop(_FILA, None)  # close() sem commit também descarta intenções


def varrer(db, usuario):
    """Chamado a cada cinco minutos, depois do commit do fechamento."""
    try:
        return _espontaneo(db.get_bind(), usuario.id)
    except Exception:
        log.warning("Não foi possível verificar o sussurro espontâneo.")
        return False


def _espontaneo(bind, usuario_id):
    from motors import penitencia
    agora = tempo.agora()
    with Session(bind=bind) as db:
        if modo(db, usuario_id) == "desligado":
            return False
        # A bancada do Arquiteto não fabrica uma perseguição espontânea.
        pendentes = [p for p in penitencia.pendentes(db, usuario_id) if not p.teste]
        if len(pendentes) < 4:
            return False
        agenda = db.query(SussurroAgenda).filter_by(usuario_id=usuario_id, dia=agora.date()).first()
        if not agenda:
            agenda = SussurroAgenda(usuario_id=usuario_id, dia=agora.date(),
                horario=datetime.combine(agora.date(), time(10)) + timedelta(minutes=random.randint(0, 660)))
            db.add(agenda)
            try:
                db.commit()  # sorteia uma única vez; índice resolve varredores concorrentes
            except IntegrityError:
                db.rollback()
                agenda = db.query(SussurroAgenda).filter_by(usuario_id=usuario_id, dia=agora.date()).one()
        if agenda.disparado_em or agora < agenda.horario or not time(10) <= agora.time() <= time(21):
            return False
        # Dívida mais antiga, não a falha que deu origem à dívida anos atrás.
        antiga = min(pendentes, key=lambda p: (p.criado_em or datetime.max, p.id))
        nascimento = tempo.dia_de_utc(antiga.criado_em) or antiga.data_prevista or agora.date()
        eco = ecos.para_falha(len(pendentes), penitencia.tem_pacto(db, usuario_id),
            {"missao": antiga.titulo, "dias": max(0, (agora.date() - nascimento).days)},
            evitar=recentes(db, usuario_id))
        reservado = db.query(SussurroAgenda).filter(
            SussurroAgenda.id == agenda.id, SussurroAgenda.disparado_em.is_(None)
        ).update({"disparado_em": agora}, synchronize_session=False)
        db.commit()
        if not reservado:
            return False
    return _enviar(bind, {"usuario_id": usuario_id, **eco,
        "valido_ate": datetime.combine(agora.date(), time(23, 59, 59), tzinfo=tempo.FUSO)})
