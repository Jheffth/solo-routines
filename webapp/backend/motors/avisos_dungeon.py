"""Avisos sobre os cards reais da dungeon; apenas leitura, sem disparar eventos."""
from datetime import datetime, timedelta
from math import ceil
from database import DungeonSessao, DungeonMissaoExecucao

BONUS = {'BEM_ESTAR', 'EVENTO_ALEATORIO'}
ABERTOS = {'PENDENTE', 'EM_PROGRESSO', 'PAUSADA'}


def eventos(m):
    if m.tipo == 'PASSIVA' or m.natureza == 'FLAVOR':
        return []
    nomes = ['STATUS']
    if (m.natureza == 'AGENDADA' and m.hora_inicio) or m.natureza in BONUS:
        nomes.append('ATIVA_EM')
    if (m.natureza == 'AGENDADA' and m.hora_limite) or m.natureza in BONUS:
        nomes.append('EXPIRA_EM')
    return nomes


def proximidade(momento, agora, antecedencia):
    return momento and 0 < (momento-agora).total_seconds() <= antecedencia*60


def aviso(texto, estado, fim, chave=None):
    return {'texto':texto, 'estado':estado, 'fim':fim, 'chave_evento':chave}


def sessao(db, uid, dungeon_id, agora):
    # Sem sessão real iniciada não existe ocorrência interna para cobrar.
    return db.query(DungeonSessao).filter(
        DungeonSessao.usuario_id == uid, DungeonSessao.dungeon_id == dungeon_id,
        DungeonSessao.modo_teste == False,  # noqa: E712
        DungeonSessao.status.in_(['ATIVA','SUSPENSA']),
        DungeonSessao.data <= agora.date(), DungeonSessao.entrada_em.isnot(None),
    ).order_by(DungeonSessao.data.desc(),DungeonSessao.id.desc()).first()


def prazo_sessao(d,s):
    from routers.dungeons import _prazo_da_sessao
    return _prazo_da_sessao(d,s)


def tempo_sessao(db,r,d,agora):
    s=sessao(db,r.usuario_id,d.id,agora)
    if not s:
        return None
    fim=prazo_sessao(d,s)
    if not proximidade(fim,agora,r.antecedencia_min):
        return None
    minutos=ceil((fim-agora).total_seconds()/60)
    return aviso(f"O tempo da sessão de {d.titulo} termina em {minutos} minutos, às {fim:%H:%M}. O prazo continua correndo mesmo fora da dungeon.",
                 'PRAZO',fim,f'sessao:{s.id}:PRAZO:{fim.isoformat()}')


def mensagem(db,r,m,agora):
    from routers.dungeons import _missao_eh_de_hoje, _agenda_sessao, _parse_hhmm
    d=m.dungeon
    if not m.ativo or d.status!='ATIVA' or r.evento not in eventos(m):
        return None
    s=sessao(db,r.usuario_id,d.id,agora)
    if not s or not _missao_eh_de_hoje(m,s.data):
        return None
    fim_s=prazo_sessao(d,s) or datetime.combine(s.data+timedelta(days=1),datetime.min.time())
    if agora>=fim_s:
        return None
    if m.natureza in BONUS and s.status!='ATIVA':
        return None
    execs=db.query(DungeonMissaoExecucao).filter_by(
        dungeon_sessao_id=s.id,dungeon_missao_id=m.id).order_by(DungeonMissaoExecucao.id).all()
    abertas=[e for e in execs if e.status in ABERTOS]
    titulo=f'{m.titulo}, na dungeon {d.titulo}'

    if r.evento=='ATIVA_EM':
        # Um pop-in atual não é a próxima ocorrência; não antecipar outro
        # enquanto o card ainda aguarda conclusão/expiração no heartbeat.
        if m.natureza in BONUS and abertas:
            return None
        if m.natureza=='AGENDADA' and (not abertas or any(e.status=='CONCLUIDA' for e in execs)):
            return None
        agenda=next((a for a in _agenda_sessao(s) if a['missao']['id']==m.id),None)
        inicio=datetime.fromisoformat(agenda['proxima_em']) if agenda and agenda['proxima_em'] else None
        if not proximidade(inicio,agora,r.antecedencia_min) or inicio>=fim_s:
            return None
        minutos=ceil((inicio-agora).total_seconds()/60)
        if m.natureza=='EVENTO_ALEATORIO':
            janela=datetime.fromisoformat(agenda['janela_fim'])
            texto=f"A missão {titulo} pode aparecer na janela das {inicio:%H:%M} às {janela:%H:%M}. A janela começa em {minutos} minutos."
        else:
            texto=f"A missão {titulo} ficará disponível em {minutos} minutos, às {inicio:%H:%M}."
        return aviso(texto,'ATIVA_EM',inicio,f'missao:{m.id}:sessao:{s.id}:ATIVA_EM:{inicio.isoformat()}')

    for e in abertas:
        inicio=_parse_hhmm(m.hora_inicio,s.data) if m.natureza=='AGENDADA' else None
        fim=_parse_hhmm(m.hora_limite,s.data) if m.natureza=='AGENDADA' else None
        if m.natureza in BONUS:
            if not e.disparada_em:
                continue
            inicio=e.disparada_em
            fim=inicio+timedelta(minutes=m.expira_em_min or 5)
        fim=min(fim,fim_s) if fim else fim_s
        if (inicio and agora<inicio) or agora>=fim:
            continue
        if r.evento=='EXPIRA_EM':
            if not proximidade(fim,agora,r.antecedencia_min):
                continue
            minutos=ceil((fim-agora).total_seconds()/60)
            return aviso(f"A missão {titulo} vence em {minutos} minutos, às {fim:%H:%M}. Conclua esta ocorrência antes do prazo.",
                         'EXPIRA_EM',fim,f'execucao:{e.id}:EXPIRA_EM:{fim.isoformat()}')
        estado={'EM_PROGRESSO':'ATIVA'}.get(e.status,e.status)
        if estado not in r.estados:
            continue
        descricao={'PENDENTE':'está disponível e ainda não foi iniciada.',
                   'ATIVA':'está em andamento. Você está prestes a concluir?', 'PAUSADA':'está pausada.'}
        return aviso(f"A missão {titulo} {descricao[estado]} O prazo desta ocorrência é até {fim:%H:%M}.",estado,fim)
    return None
