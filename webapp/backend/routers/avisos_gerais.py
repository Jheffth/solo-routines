from datetime import timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db, Usuario, RegraAvisoGeral, Dungeon, DungeonMissao
from auth.router import get_usuario_atual
from motors import avisos_gerais as motor, avisos_dungeon, tempo

router=APIRouter(prefix='/avisos-gerais',tags=['avisos-gerais'])


class RegraIn(BaseModel):
    origem: Literal['TAREFA','ROTINA','DUNGEON','MISSAO']
    alvo_id: int=Field(gt=0)
    evento: Literal['STATUS','ABRE','FECHA','PRAZO','ATIVA_EM','EXPIRA_EM','DISPONIVEL']='STATUS'
    formato: Literal['texto','audio','ambos']='texto'
    intervalo_min: int=Field(default=60,ge=5,le=1440)
    antecedencia_min: int=Field(default=30,ge=5,le=180)
    estados: list[str]=Field(default_factory=lambda:['PENDENTE','ATIVA','PAUSADA','ATRASADA'])
    janela_de: str='08:00'
    janela_ate: str='22:00'

    @field_validator('janela_de','janela_ate')
    @classmethod
    def hora(cls,v):
        try:
            if len(v)!=5 or v[2]!=':': raise ValueError()
            motor.horario(v)
        except (ValueError,TypeError):
            raise ValueError('Use HH:MM válido.')
        return v

    @field_validator('estados')
    @classmethod
    def estados_validos(cls,v):
        if not v or len(v)>4 or any(s not in ('PENDENTE','ATIVA','PAUSADA','ATRASADA') for s in v):
            raise ValueError('Escolha estados em aberto: pendente, ativa, pausada ou atrasada.')
        return list(dict.fromkeys(v))


class Ativo(BaseModel):
    ativo: bool


def minha(db,uid,rid):
    r=db.query(RegraAvisoGeral).filter_by(id=rid,usuario_id=uid).first()
    if not r: raise HTTPException(404,'Regra de aviso não encontrada.')
    return r


def validar(db,uid,p):
    obj=motor.alvo(db,uid,p.origem,p.alvo_id)
    if not obj: raise HTTPException(404,'Alvo não encontrado na sua conta.')
    if p.janela_de==p.janela_ate:
        raise HTTPException(422,'O início e fim da janela devem ser diferentes.')
    if p.origem=='MISSAO':
        if not obj.ativo or obj.dungeon.status!='ATIVA':
            raise HTTPException(409,'Esta missão ou dungeon foi encerrada.')
        if p.evento not in avisos_dungeon.eventos(obj):
            raise HTTPException(422,'Este evento não está disponível para esta missão.')
        return
    permitidos=['STATUS','ABRE','FECHA','PRAZO'] if p.origem=='DUNGEON' else ['STATUS']
    if p.evento not in permitidos:
        raise HTTPException(422,'Este evento não está disponível para este alvo.')
    if p.origem=='DUNGEON' and obj.sempre_aberta and p.evento in ('ABRE','FECHA'):
        raise HTTPException(422,'Este portão fica sempre aberto. Escolha acompanhamento de status.')
    if ((p.origem=='ROTINA' and not obj.ativo) or
            (p.origem!='ROTINA' and obj.status in motor.FINAIS) or
            (p.origem=='DUNGEON' and obj.status!='ATIVA')):
        raise HTTPException(409,'Este alvo já foi encerrado.')
    if p.origem=='TAREFA' and obj.teste:
        raise HTTPException(422,'Missões de teste não recebem lembretes.')


@router.get('/catalogo')
def catalogo(db:Session=Depends(get_db),usuario:Usuario=Depends(get_usuario_atual)):
    itens=[]
    for origem,cls in motor.MODELOS.items():
        if origem=='MISSAO':
            missoes=db.query(DungeonMissao).join(Dungeon).filter(
                Dungeon.usuario_id==usuario.id,Dungeon.status=='ATIVA',DungeonMissao.ativo==True).order_by(DungeonMissao.id.desc()).all()
            for obj in missoes:
                eventos=avisos_dungeon.eventos(obj)
                if eventos:
                    itens.append({'origem':origem,'id':obj.id,'titulo':f'{obj.dungeon.titulo} · {obj.titulo}',
                                  'natureza':obj.natureza,'eventos':eventos})
            continue
        for obj in db.query(cls).filter(cls.usuario_id==usuario.id).order_by(cls.id.desc()).all():
            if origem=='ROTINA' and not obj.ativo: continue
            if origem!='ROTINA' and obj.status in motor.FINAIS: continue
            if origem=='TAREFA' and obj.teste: continue
            if origem=='DUNGEON' and obj.status!='ATIVA': continue
            itens.append({'origem':origem,'id':obj.id,'titulo':obj.titulo,
                          'sempre_aberta':bool(getattr(obj,'sempre_aberta',False)),
                          'eventos':(['STATUS','PRAZO']+([] if obj.sempre_aberta else ['ABRE','FECHA'])) if origem=='DUNGEON' else ['STATUS']})
    return itens


@router.get('/')
def listar(db:Session=Depends(get_db),usuario:Usuario=Depends(get_usuario_atual)):
    return [motor.serializar(db,r) for r in db.query(RegraAvisoGeral).filter_by(usuario_id=usuario.id).order_by(RegraAvisoGeral.id.desc()).all()]


@router.post('/',status_code=201)
def criar(p:RegraIn,db:Session=Depends(get_db),usuario:Usuario=Depends(get_usuario_atual)):
    validar(db,usuario.id,p)
    r=RegraAvisoGeral(usuario_id=usuario.id,**p.model_dump(),
        proximo_em=tempo.agora()+timedelta(minutes=p.intervalo_min))
    db.add(r)
    try: db.commit()
    except IntegrityError:
        db.rollback();raise HTTPException(409,'Já existe um aviso para este alvo e evento. Edite a regra existente.')
    return motor.serializar(db,r)


@router.put('/{rid}')
def editar(rid:int,p:RegraIn,db:Session=Depends(get_db),usuario:Usuario=Depends(get_usuario_atual)):
    r=minha(db,usuario.id,rid);validar(db,usuario.id,p)
    if (r.origem,r.alvo_id,r.evento)!=(p.origem,p.alvo_id,p.evento):
        r.ultima_chave=None
    for campo,valor in p.model_dump().items(): setattr(r,campo,valor)
    r.proximo_em=tempo.agora()+timedelta(minutes=p.intervalo_min)
    # Mantém o carimbo do evento já anunciado; editar o formato não o repete.
    try: db.commit()
    except IntegrityError:
        db.rollback();raise HTTPException(409,'Já existe um aviso para este alvo e evento.')
    return motor.serializar(db,r)


@router.patch('/{rid}')
def ativar(rid:int,p:Ativo,db:Session=Depends(get_db),usuario:Usuario=Depends(get_usuario_atual)):
    r=minha(db,usuario.id,rid);r.ativo=p.ativo
    if p.ativo: r.proximo_em=tempo.agora()+timedelta(minutes=r.intervalo_min)
    db.commit();return motor.serializar(db,r)


@router.get('/{rid}/previa')
def previa(rid:int,db:Session=Depends(get_db),usuario:Usuario=Depends(get_usuario_atual)):
    r=minha(db,usuario.id,rid)
    m=motor.mensagem(db,r)
    return {'texto':m['texto'] if m else 'Nenhum aviso seria enviado agora: o alvo está fora do horário, dos estados escolhidos ou já foi encerrado.'}


@router.delete('/{rid}')
def excluir(rid:int,db:Session=Depends(get_db),usuario:Usuario=Depends(get_usuario_atual)):
    r=minha(db,usuario.id,rid);db.delete(r);db.commit();return {'ok':True}
