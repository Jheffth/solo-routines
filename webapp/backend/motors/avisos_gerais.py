"""Lembretes escolhidos pelo hunter. Nunca altera o ciclo de vida dos alvos."""
from datetime import datetime, time, timedelta
import logging
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import (Rotina, TarefaDia, ExecucaoDia, Dungeon, DungeonSessao, DungeonMissao,
                      RegraAvisoGeral, TentativaAvisoGeral)
from motors import tempo, prazos, calendario_projecao as proj
from motors.fechamento import rotina_devida_em
import solobot_ponte

log = logging.getLogger(__name__)
MODELOS = {"TAREFA": TarefaDia, "ROTINA": Rotina, "DUNGEON": Dungeon, "MISSAO": DungeonMissao}
FINAIS = {"CONCLUIDA", "CANCELADA", "CONFESSADA", "FRACASSADA_FATAL"}


def alvo(db, uid, origem, oid):
    if origem=='MISSAO':
        return db.query(DungeonMissao).join(Dungeon).filter(
            DungeonMissao.id==oid,Dungeon.usuario_id==uid).first()
    cls = MODELOS.get(origem)
    return db.query(cls).filter(cls.id == oid, cls.usuario_id == uid).first() if cls else None


def horario(txt):
    h, m = txt.split(':')
    return time(int(h), int(m))


def na_janela(r, agora):
    de, ate = horario(r.janela_de), horario(r.janela_ate)
    return (de <= agora.time() < ate) if de < ate else (agora.time() >= de or agora.time() < ate)


def prazo_texto(fim, agora):
    quando = 'de hoje' if fim.date() == agora.date() else 'em ' + fim.strftime('%d/%m/%Y')
    return f"O prazo {'venceu às' if fim <= agora else 'é até'} {fim:%H:%M} {quando}."


def mensagem(db, r, agora=None):
    """Prévia e envio usam a mesma regra, sempre consultando o alvo real."""
    agora = agora or tempo.agora()
    obj = alvo(db, r.usuario_id, r.origem, r.alvo_id)
    if not obj:
        return None
    if r.origem == 'MISSAO':
        from motors import avisos_dungeon
        return avisos_dungeon.mensagem(db,r,obj,agora)
    if r.origem == 'DUNGEON':
        return _dungeon(db, r, obj, agora)
    if r.origem == 'ROTINA':
        if not obj.ativo:
            return None
        ed, p = None, None
        # A ocorrência de ontem pode ter uma janela ainda aberta esta manhã.
        for dia in (agora.date()-timedelta(days=1), agora.date()):
            if not rotina_devida_em(obj, dia):
                continue
            candidato = db.query(ExecucaoDia).filter_by(rotina_id=obj.id, usuario_id=r.usuario_id, data=dia).first()
            prazo = prazos.da_execucao(candidato,obj) if candidato else prazos.da_rotina(obj,dia)
            if prazo['inicio'] <= agora < prazo['fim']:
                ed, p = candidato, prazo
                break
        if p is None:
            return None
        estado = ed.status if ed else 'PENDENTE'
        if estado == 'FRACASSADA' or estado in FINAIS:
            return None
        titulo, fim = obj.titulo, p['fim']
    else:
        if obj.status in FINAIS or obj.teste:
            return None
        p = prazos.da_tarefa(obj)
        if agora < p['inicio']:
            return None
        estado, titulo, fim = obj.status, obj.titulo, p['fim']
        if obj.natureza == 'PUNICAO':
            fim = None
    if fim and fim <= agora:
        estado = 'ATRASADA'
    if estado not in r.estados:
        return None
    estados = {'PENDENTE':'ainda não foi iniciada.', 'ATIVA':'está em andamento. Você está prestes a concluir?',
               'PAUSADA':'está pausada.', 'ATRASADA':'continua em aberto e está atrasada.',
               'FRACASSADA':'continua em aberto e está atrasada.'}
    texto = f"A missão {titulo} {estados.get(estado,'continua em aberto.')}"
    if fim:
        texto += ' ' + prazo_texto(fim,agora)
    else:
        texto += ' Esta penitência permanece até ser quitada.'
    return {'texto':texto, 'estado':estado, 'fim':fim if fim and fim>agora else None, 'chave_evento':None}


def _dungeon(db, r, d, agora):
    if d.status != 'ATIVA':
        return None
    if r.evento=='PRAZO':
        from motors import avisos_dungeon
        return avisos_dungeon.tempo_sessao(db,r,d,agora)
    if d.sempre_aberta and r.evento != 'STATUS':
        return None
    for dia in (agora.date()-timedelta(days=1), agora.date(), agora.date()+timedelta(days=1)):
        if not proj.dungeon_devida_em(d,dia):
            continue
        entrada, saida = proj.horario_do_dia(d,dia)
        abre = datetime.combine(dia,horario(entrada)) if entrada else None
        fecha = datetime.combine(dia,horario(saida)) if saida else None
        if abre and fecha and fecha <= abre:
            fecha += timedelta(days=1)
        if d.sempre_aberta:
            abre,fecha = datetime.combine(dia,time()),datetime.combine(dia+timedelta(days=1),time())
        if r.evento in ('ABRE','FECHA'):
            momento = abre if r.evento=='ABRE' else fecha
            if not momento or not 0 < (momento-agora).total_seconds() <= r.antecedencia_min*60:
                continue
            minutos = max(1,int((momento-agora).total_seconds()/60))
            return {'texto':f"O portão de {d.titulo} {'abre' if r.evento=='ABRE' else 'fecha'} em {minutos} minutos, às {momento:%H:%M}.",
                    'estado':r.evento,'fim':momento,'chave_evento':f'{dia}:{r.evento}:{momento.isoformat()}'}
        if (abre and agora<abre) or (fecha and agora>=fecha) or dia>agora.date():
            continue
        if dia<agora.date() and not (fecha and fecha.date()==agora.date()):
            continue
        sessao = db.query(DungeonSessao).filter_by(dungeon_id=d.id,usuario_id=r.usuario_id,data=dia,modo_teste=False).order_by(DungeonSessao.id.desc()).first()
        if sessao and sessao.status in FINAIS | {'FRACASSADA'}:
            return None
        if sessao and sessao.entrada_em:
            from motors.avisos_dungeon import prazo_sessao
            limite=prazo_sessao(d,sessao)
            if limite and agora>=limite:
                return None
            if limite:
                fecha=min(fecha,limite) if fecha else limite
        estado = ('PAUSADA' if sessao.status == 'SUSPENSA' else sessao.status) if sessao else 'PENDENTE'
        if estado not in r.estados:
            return None
        descricao = {'ATIVA':'está em andamento.', 'PAUSADA':'está suspensa. Você pretende retornar?'}
        texto = f"A dungeon {d.titulo} {descricao.get(estado,'aguarda sua entrada.')}"
        if fecha and not d.sempre_aberta:
            texto += f" O portão fecha às {fecha:%H:%M}."
        return {'texto':texto,'estado':estado,'fim':fecha,'chave_evento':None}
    return None


def serializar(db,r):
    obj = alvo(db,r.usuario_id,r.origem,r.alvo_id)
    ultima = db.query(TentativaAvisoGeral).filter_by(regra_id=r.id).order_by(TentativaAvisoGeral.id.desc()).first()
    def iso(v): return v.replace(tzinfo=tempo.FUSO).isoformat() if v else None
    return {k:getattr(r,k) for k in ('id','origem','alvo_id','evento','formato','intervalo_min','antecedencia_min','estados','janela_de','janela_ate','ativo')} | {
        'titulo':(f'{obj.dungeon.titulo} · {obj.titulo}' if r.origem=='MISSAO' else obj.titulo) if obj else 'Alvo removido', 'proximo_em':iso(r.proximo_em),
        'ultimo_enviado_em':iso(r.ultimo_enviado_em),
        'ultima_tentativa':{'status':ultima.status,'em':iso(ultima.criado_em)} if ultima else None}


def varrer(bind, uid):
    """Uma sessão por regra; confirmação antes da rede, sem repor lotes perdidos."""
    agora = tempo.agora()
    with Session(bind=bind) as db:
        ids = [v for (v,) in db.query(RegraAvisoGeral.id).filter_by(usuario_id=uid,ativo=True).all()]
    aceitos = 0
    for rid in ids:
        try:
            aceitos += int(_processar(bind,rid,agora))
        except Exception:
            log.warning('Não foi possível processar um aviso geral.')
    return aceitos


def _processar(bind,rid,agora):
    with Session(bind=bind) as db:
        r=db.get(RegraAvisoGeral,rid)
        if not r or not r.ativo or not na_janela(r,agora):
            return False
        m=mensagem(db,r,agora)
        if not m:
            return False
        if r.evento=='STATUS' and r.proximo_em>agora:
            return False
        chave=m['chave_evento'] or r.proximo_em.isoformat()
        proximo=agora+timedelta(minutes=r.intervalo_min)
        q=db.query(RegraAvisoGeral).filter_by(id=rid,ativo=True)
        q=q.filter(RegraAvisoGeral.proximo_em<=agora) if r.evento=='STATUS' else q.filter(or_(RegraAvisoGeral.ultima_chave.is_(None),RegraAvisoGeral.ultima_chave!=chave))
        if not q.update({'proximo_em':proximo,'ultima_chave':chave},synchronize_session=False):
            db.rollback();return False
        tentativa=TentativaAvisoGeral(regra_id=rid,chave=f'{rid}:{chave}',texto=m['texto'],criado_em=agora)
        db.add(tentativa)
        try:
            db.commit()
        except IntegrityError:
            db.rollback();return False
        tid=tentativa.id
        db.expire_all()
        r=db.get(RegraAvisoGeral,rid)
        atual=mensagem(db,r,tempo.agora()) if r and r.ativo else None
        if not atual or (m['chave_evento'] and atual['chave_evento']!=m['chave_evento']):
            tentativa.status='IGNORADO';db.commit();return False
        valido=min(proximo,atual['fim']) if atual['fim'] else proximo
        # Estado atual confirma o conteúdo imediatamente antes da entrega.
        tentativa.texto=atual['texto']
        formato=r.formato
        uid=r.usuario_id
        db.commit()
    try:
        entregue=solobot_ponte.avisar(uid,atual['texto'],falado=atual['texto'],
            voz=formato!='texto',formato=formato,valido_ate=valido.replace(tzinfo=tempo.FUSO))
    except Exception:
        entregue=False
    with Session(bind=bind) as db:
        tentativa=db.get(TentativaAvisoGeral,tid)
        if tentativa:
            tentativa.status='ACEITO' if entregue else 'FALHOU'
        if entregue:
            db.query(RegraAvisoGeral).filter_by(id=rid).update({'ultimo_enviado_em':agora})
        db.commit()
    return bool(entregue)
