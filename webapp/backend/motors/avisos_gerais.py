"""Lembretes escolhidos pelo hunter. Nunca altera o ciclo de vida dos alvos."""
from datetime import datetime, time, timedelta
import logging
import hashlib
import json
import uuid
from sqlalchemy import or_, case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import (Usuario, Rotina, TarefaDia, ExecucaoDia, Dungeon, DungeonSessao, DungeonMissao,
                      RegraAvisoGeral, TentativaAvisoGeral, PreferenciaAvisoGeral, LoteAvisoGeral)
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
    ocorrencia=f'rotina:{obj.id}:{dia}' if r.origem=='ROTINA' else f'tarefa:{obj.id}'
    return {'texto':texto, 'estado':estado, 'fim':fim if fim and fim>agora else None, 'chave_evento':None, 'ocorrencia':ocorrencia}


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
        return {'texto':texto,'estado':estado,'fim':fecha,'chave_evento':None,'ocorrencia':f'dungeon:{d.id}:{dia}'}
    return None


def serializar(db,r):
    obj = alvo(db,r.usuario_id,r.origem,r.alvo_id)
    ultima = db.query(TentativaAvisoGeral).filter_by(regra_id=r.id).order_by(TentativaAvisoGeral.id.desc()).first()
    def iso(v): return v.replace(tzinfo=tempo.FUSO).isoformat() if v else None
    return {k:getattr(r,k) for k in ('id','origem','alvo_id','evento','formato','intervalo_min','antecedencia_min','estados','janela_de','janela_ate','ativo')} | {
        'titulo':(f'{obj.dungeon.titulo} · {obj.titulo}' if r.origem=='MISSAO' else obj.titulo) if obj else 'Alvo removido', 'proximo_em':iso(r.proximo_em),
        'ultimo_enviado_em':iso(r.ultimo_enviado_em),
        'adiado_ate':iso(r.adiamento.ate) if r.adiamento else None,
        'ultima_tentativa':{'status':ultima.status,'em':iso(ultima.criado_em)} if ultima else None}


def varrer_todos(bind):
    """Só hunters ativos com regras ativas; nenhum fechamento neste ciclo."""
    with Session(bind=bind) as db:
        ids=[uid for (uid,) in db.query(RegraAvisoGeral.usuario_id).join(Usuario).filter(
            Usuario.ativo==True,RegraAvisoGeral.ativo==True).distinct().all()]
    aceitos=0
    for uid in ids:
        try:
            aceitos+=varrer(bind,uid)
        except Exception:
            log.warning('Não foi possível verificar avisos de um hunter.')
    return aceitos


def preferencia(db,uid):
    row=db.get(PreferenciaAvisoGeral,uid)
    if not row:
        row=PreferenciaAvisoGeral(usuario_id=uid)
        db.add(row)
        try: db.commit()
        except IntegrityError:
            db.rollback();row=db.get(PreferenciaAvisoGeral,uid)
    return row


def preferencias(db,uid):
    p=preferencia(db,uid)
    usados=p.usados if p.dia_cota==tempo.agora().date() else 0
    return {'limite_diario':p.limite_diario,'agrupar':p.agrupar,'usados_hoje':usados,
            'restantes':max(0,p.limite_diario-usados) if p.limite_diario else None}


def adiado(r,agora):
    return bool(r.adiamento and r.adiamento.ate>agora)


def varrer(bind, uid):
    """Uma sessão por regra; confirmação antes da rede, sem repor lotes perdidos."""
    agora = tempo.agora()
    with Session(bind=bind) as db:
        p=preferencias(db,uid)
        if p['restantes']==0: return 0
        ids = [v for (v,) in db.query(RegraAvisoGeral.id).filter_by(usuario_id=uid,ativo=True).all()]
    reservas=[]
    for rid in ids:
        try:
            item=_processar(bind,rid,agora,reservar=True)
            if item: reservas.append(item)
        except Exception:
            log.warning('Não foi possível processar um aviso geral.')
    grupos=[]
    for item in reservas:
        grupo=next((g for g in grupos if p['agrupar'] and g[0]['formato']==item['formato'] and
                    len(g)<4 and sum(len(i['texto'])+3 for i in g)+len(item['texto'])<650),None)
        if grupo is None: grupos.append([item])
        else: grupo.append(item)
    aceitos=0
    for grupo in grupos:
        aceitos+=_entregar(bind,grupo,agora)
    return aceitos


def referencia(r,t,m):
    """Carimbo de configuração e ocorrência. Estado/progresso podem mudar."""
    campos=('id','origem','alvo_id','evento','formato','intervalo_min','antecedencia_min','estados','janela_de','janela_ate')
    dados={k:getattr(r,k) for k in campos}
    dados.update(criado_em=r.criado_em.isoformat(), proximo_em=r.proximo_em.isoformat(), tentativa=t.chave,
                 adiado_ate=r.adiamento.ate.isoformat() if r.adiamento else None,
                 ocorrencia=m.get('ocorrencia') or m['chave_evento'])
    digest=hashlib.sha256(json.dumps(dados,sort_keys=True).encode()).hexdigest()[:32]
    return f'central:{t.id}:{digest}'


def validar_pendente(db,uid,ref):
    """Só o Bot autenticado consulta. Não envia, não altera estados/XP."""
    try:
        if ref.startswith('lote:'):
            lote=db.get(LoteAvisoGeral,ref[5:])
            if not lote or lote.usuario_id!=uid or lote.valido_ate<=tempo.agora():
                return {'valido':False}
            textos=[v['texto'] for v in (validar_pendente(db,uid,r) for r in lote.referencias) if v['valido']]
            return {'valido':True,'texto':_texto_grupo(textos)} if textos else {'valido':False}
        prefixo,tid,_=ref.split(':')
        if prefixo!='central': return {'valido':False}
        t=db.get(TentativaAvisoGeral,int(tid))
        r=db.get(RegraAvisoGeral,t.regra_id) if t else None
        usuario=db.get(Usuario,uid)
        if not r or r.usuario_id!=uid or not r.ativo or not usuario or not usuario.ativo:
            return {'valido':False}
        agora=tempo.agora()
        if adiado(r,agora): return {'valido':False}
        atual=mensagem(db,r,agora) if na_janela(r,agora) else None
        if not atual or referencia(r,t,atual)!=ref:
            return {'valido':False}
        return {'valido':True,'texto':atual['texto']}
    except (ValueError,TypeError,AttributeError):
        return {'valido':False}


def _processar(bind,rid,agora,reservar=False):
    with Session(bind=bind) as db:
        r=db.get(RegraAvisoGeral,rid)
        if not r or not r.ativo or not na_janela(r,agora) or adiado(r,agora):
            return False
        if r.evento=='STATUS' and r.proximo_em>agora:
            return False
        m=mensagem(db,r,agora)
        if not m:
            return False
        chave=m['chave_evento'] or r.proximo_em.isoformat()
        anterior=r.proximo_em;anterior_chave=r.ultima_chave
        # Disponibilidade não tem repetição; a validade é a do próprio card.
        proximo=m['fim'] if r.evento=='DISPONIVEL' else agora+timedelta(minutes=r.intervalo_min)
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
        ref=referencia(r,tentativa,atual)
        db.commit()
    item={'rid':rid,'tid':tid,'uid':uid,'texto':atual['texto'],'formato':formato,'referencia':ref,
          'valido':valido,'anterior':anterior,'anterior_chave':anterior_chave,'chave':chave,'proximo':proximo}
    return item if reservar else bool(_entregar(bind,[item],agora))


def _texto_grupo(textos):
    return textos[0] if len(textos)==1 else 'Seus lembretes:\n'+'\n'.join('• '+t for t in textos)


def _entregar(bind,itens,agora):
    agora=tempo.agora()  # a cota pertence ao dia da tentativa, em Brasília
    uid=itens[0]['uid']
    with Session(bind=bind) as db:
        vivos=[]
        for item in itens:
            atual=validar_pendente(db,uid,item['referencia'])
            if atual['valido']:
                item['texto']=atual['texto'];vivos.append(item)
            else:
                t=db.get(TentativaAvisoGeral,item['tid'])
                if t:t.status='IGNORADO'
        db.commit()
        if not vivos: return 0
        preferencia(db,uid)
        cls=PreferenciaAvisoGeral;dia=agora.date()
        q=db.query(cls).filter(cls.usuario_id==uid,or_(cls.limite_diario==0,cls.dia_cota.is_(None),cls.dia_cota!=dia,cls.usados<cls.limite_diario))
        if not q.update({'dia_cota':dia,'usados':case((cls.dia_cota==dia,cls.usados+1),else_=1)},synchronize_session=False):
            # Nada saiu para a rede: devolver as reservas para a próxima oportunidade.
            for item in vivos:
                db.query(RegraAvisoGeral).filter_by(id=item['rid'],ultima_chave=item['chave'],proximo_em=item['proximo']).update(
                    {'proximo_em':item['anterior'],'ultima_chave':item['anterior_chave']},synchronize_session=False)
                t=db.get(TentativaAvisoGeral,item['tid'])
                if t:db.delete(t)
            db.commit();return 0
        texto=_texto_grupo([i['texto'] for i in vivos]);ref=vivos[0]['referencia']
        valido=min(i['valido'] for i in vivos);formato=vivos[0]['formato']
        if len(vivos)>1:
            lote=LoteAvisoGeral(id=uuid.uuid4().hex,usuario_id=uid,referencias=[i['referencia'] for i in vivos],valido_ate=valido)
            db.add(lote);ref='lote:'+lote.id
        db.commit() # cota e grupo persistidos antes da rede
    try:
        entregue=solobot_ponte.avisar(uid,texto,falado=texto,
            voz=formato!='texto',formato=formato,valido_ate=valido.replace(tzinfo=tempo.FUSO),referencia=ref)
    except Exception:
        entregue=False
    with Session(bind=bind) as db:
        for item in vivos:
            tentativa=db.get(TentativaAvisoGeral,item['tid'])
            if tentativa:tentativa.status='ACEITO' if entregue else 'FALHOU'
            if entregue:db.query(RegraAvisoGeral).filter_by(id=item['rid']).update({'ultimo_enviado_em':agora})
        db.commit()
    return len(vivos) if entregue else 0
