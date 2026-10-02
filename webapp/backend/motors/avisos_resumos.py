"""Retrato do dia, somente leitura. Não materializa execuções ou derrotas."""
from collections import Counter
from datetime import datetime, time, timedelta
from sqlalchemy import or_
from database import Rotina, ExecucaoDia, TarefaDia, Dungeon, DungeonSessao, DungeonMissaoExecucao
from motors import prazos, calendario_projecao as proj
from motors.fechamento import rotina_devida_em

EVENTOS={'AGENDA':'Agenda do dia','BALANCO':'Balanço do dia'}
TERMINAIS={'CONCLUIDA','CANCELADA','CONFESSADA','FRACASSADA_FATAL','FRACASSADA','EXPIRADA'}
FIM_TAREFA=TERMINAIS-{'FRACASSADA'}  # missão geral fracassada pode continuar em dívida


def mensagem(db,r,agora,previa=False):
    if r.evento not in EVENTOS: return None
    hora=time.fromisoformat(r.janela_de)
    inicio=datetime.combine(agora.date(),hora)
    fim=min(inicio+timedelta(hours=1),datetime.combine(agora.date()+timedelta(days=1),time()))
    if not previa and not inicio<=agora<fim: return None
    uid=r.usuario_id;dia=agora.date()
    estados=Counter();proximas=[];abertas=0
    execs={e.rotina_id:e for e in db.query(ExecucaoDia).filter_by(usuario_id=uid,data=dia).all()}
    for rot in db.query(Rotina).filter_by(usuario_id=uid,ativo=True).all():
        if not rotina_devida_em(rot,dia): continue
        e=execs.get(rot.id);estado=e.status if e else 'PENDENTE'
        p=prazos.da_execucao(e,rot) if e else prazos.da_rotina(rot,dia)
        # Uma rotina sem execução não é uma derrota registrada.
        estados[estado]+=1
        if estado not in TERMINAIS: abertas+=1
        if estado not in TERMINAIS and p['fim']>agora:
            proximas.append((p['fim'],rot.titulo))
    for t in db.query(TarefaDia).filter_by(usuario_id=uid,data_prevista=dia,teste=False).all():
        estados[t.status]+=1
        if t.status not in FIM_TAREFA: abertas+=1
        p=prazos.da_tarefa(t)
        if t.status not in FIM_TAREFA and t.natureza!='PUNICAO' and p['fim']>agora:
            proximas.append((p['fim'],t.titulo))
    falhas=sum(estados[s] for s in ('FRACASSADA','FRACASSADA_FATAL','EXPIRADA','CONFESSADA'))
    texto=f"{EVENTOS[r.evento]} de {dia:%d/%m}, atualizado às {agora:%H:%M}. "
    texto+=f"Missões e rotinas: {sum(estados.values())} previstas, {estados['CONCLUIDA']} concluídas, {abertas} em aberto, {falhas} falhas registradas e {estados['CANCELADA']} canceladas. "
    atrasadas=db.query(TarefaDia).filter(TarefaDia.usuario_id==uid,TarefaDia.teste==False,
        TarefaDia.data_prevista<dia,TarefaDia.status.notin_(FIM_TAREFA),or_(TarefaDia.natureza.is_(None),TarefaDia.natureza!='PUNICAO')).count()
    texto+=f"Missões de dias anteriores em aberto: {atrasadas}. "
    dungeons=[d for d in db.query(Dungeon).filter_by(usuario_id=uid,status='ATIVA').all() if proj.dungeon_devida_em(d,dia)]
    sessoes=db.query(DungeonSessao).filter_by(usuario_id=uid,data=dia,modo_teste=False).all()
    cards=Counter(s for (s,) in db.query(DungeonMissaoExecucao.status).join(DungeonSessao).filter(
        DungeonSessao.usuario_id==uid,DungeonSessao.data==dia,DungeonSessao.modo_teste==False).all())
    texto+=f"Dungeons: {len(dungeons)} previstas, {len(sessoes)} sessões registradas. Cards internos registrados: {sum(cards.values())}, {cards['CONCLUIDA']} concluídos, {sum(n for s,n in cards.items() if s not in TERMINAIS)} em aberto. "
    if proximas:
        # Limite fixo para manter texto/áudio dentro do contrato da ponte.
        itens=[f'{str(titulo)[:60]} até {fim:%H:%M}' for fim,titulo in sorted(proximas)[:3]]
        texto+='Próximos prazos: '+ '; '.join(itens)+'.'
    else: texto+='Nenhum próximo prazo de missão ou rotina hoje.'
    portoes=[]
    for d in dungeons:
        if d.sempre_aberta: continue
        entrada,_=proj.horario_do_dia(d,dia)
        if entrada:
            try: abre=datetime.combine(dia,time.fromisoformat(entrada))
            except (TypeError,ValueError): continue
            if abre>agora: portoes.append((abre,d.titulo))
    for abre,titulo in sorted(portoes)[:2]:
        linha=f' Portão de {str(titulo)[:40]} abre às {abre:%H:%M}.'
        if len(texto)+len(linha)<=850: texto+=linha
    return {'texto':texto,'estado':r.evento,'fim':fim,
            'chave_evento':f'resumo:{dia}:{r.evento}','ocorrencia':f'resumo:{dia}:{r.evento}'}
