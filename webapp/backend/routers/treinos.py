"""Registros e metas de exercícios privados por usuário autenticado."""
import hashlib
from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel, Field, model_validator, ConfigDict
from sqlalchemy.orm import Session
from auth.router import get_usuario_atual
from database import get_db, Usuario, AtividadeFisica, MetaExercicio
from motors import tempo, treinos as motor

router = APIRouter(prefix='/treinos', tags=['Corrida e exercícios'])
Modalidade = Literal['corrida', 'caminhada', 'ciclismo', 'exercicio']
Periodo = Literal['dia', 'semana', 'mes', 'ano']


class AtividadeEntrada(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    titulo: str = Field(min_length=1, max_length=120)
    data: date
    modalidade: Modalidade
    distancia_km: float = Field(default=0, ge=0, le=2000)
    duracao_segundos: int = Field(gt=0, le=604800)
    passos: int | None = Field(default=None, ge=0, le=2000000)
    elevacao_m: float | None = Field(default=None, ge=0, le=100000)
    velocidade_max_kmh: float | None = Field(default=None, ge=0, le=500)
    print_hash: str | None = Field(default=None, pattern=r'^[a-f0-9]{64}$')

    @model_validator(mode='after')
    def validar(self):
        self.titulo = self.titulo.strip()
        if not self.titulo:
            raise ValueError('Informe o título do treino.')
        if self.data > tempo.hoje():
            raise ValueError('O treino não pode ter data futura.')
        if self.modalidade != 'exercicio' and self.distancia_km <= 0:
            raise ValueError('Informe uma distância maior que zero.')
        return self


class MetaEntrada(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    titulo: str = Field(min_length=1, max_length=120)
    modalidade: Literal['todas', 'corrida', 'caminhada', 'ciclismo', 'exercicio'] = 'todas'
    periodo: Periodo
    tipo: Literal['distancia', 'minutos', 'distancia_tempo']
    alvo: float = Field(gt=0, le=1000000)
    tempo_limite_segundos: int | None = Field(default=None, gt=0, le=604800)

    @model_validator(mode='after')
    def validar(self):
        self.titulo = self.titulo.strip()
        if not self.titulo:
            raise ValueError('Informe o título da meta.')
        if self.tipo == 'distancia_tempo' and self.tempo_limite_segundos is None:
            raise ValueError('Informe o tempo limite da meta.')
        if self.tipo != 'distancia_tempo':
            self.tempo_limite_segundos = None
        return self


def serializar(a):
    return dict(id=a.id, titulo=a.titulo, data=a.data.isoformat(), modalidade=a.modalidade,
                distancia_km=a.distancia_km, duracao_segundos=a.duracao_segundos,
                passos=a.passos, elevacao_m=a.elevacao_m, velocidade_max_kmh=a.velocidade_max_kmh,
                ritmo_segundos_km=round(a.duracao_segundos/a.distancia_km, 2) if a.distancia_km else None)


def obter(db, classe, id, usuario):
    registro = db.query(classe).filter(classe.id == id, classe.usuario_id == usuario.id).first()
    if registro is None:
        raise HTTPException(404, 'Registro não encontrado.')
    return registro


@router.get('')
def painel(periodo: Periodo = 'mes', referencia: date | None = None,
           modalidade: Literal['todas', 'corrida', 'caminhada', 'ciclismo', 'exercicio'] = 'todas',
           pagina: int = Query(1, ge=1), db: Session = Depends(get_db),
           usuario: Usuario = Depends(get_usuario_atual)):
    referencia = referencia or tempo.hoje()
    inicio, fim = motor.intervalo(periodo, referencia)
    consulta = db.query(AtividadeFisica).filter(AtividadeFisica.usuario_id == usuario.id,
                     AtividadeFisica.data >= inicio, AtividadeFisica.data <= fim)
    if modalidade != 'todas':
        consulta = consulta.filter(AtividadeFisica.modalidade == modalidade)
    atividades = consulta.order_by(AtividadeFisica.data.desc(), AtividadeFisica.id.desc()).all()
    # O denominador inclui dias sem treino e exclui dias futuros do período em curso.
    dias = max(1, (min(fim, tempo.hoje()) - inicio).days + 1)
    metas = db.query(MetaExercicio).filter(MetaExercicio.usuario_id == usuario.id).order_by(MetaExercicio.id.desc()).all()
    metas_saida = []
    for m in metas:
        ini, final = motor.intervalo(m.periodo, referencia)
        registros = db.query(AtividadeFisica).filter(AtividadeFisica.usuario_id == usuario.id,
                       AtividadeFisica.data >= ini, AtividadeFisica.data <= final).all()
        metas_saida.append(dict(id=m.id, titulo=m.titulo, periodo=m.periodo, tipo=m.tipo,
                  modalidade=m.modalidade, tempo_limite_segundos=m.tempo_limite_segundos,
                  inicio=ini.isoformat(), fim=final.isoformat(), **motor.progresso(m, registros)))
    grupos = {}
    for a in atividades:
        grupos.setdefault(a.data, []).append(a)
    return dict(inicio=inicio.isoformat(), fim=fim.isoformat(), hoje=tempo.hoje().isoformat(),
                metricas=motor.metricas(atividades, dias),
                evolucao=[dict(data=d.isoformat(), **motor.metricas(grupos[d], 1)) for d in sorted(grupos)],
                atividades=[serializar(a) for a in atividades[(pagina-1)*50:pagina*50]],
                total=len(atividades), pagina=pagina, metas=metas_saida,
                leitura_disponivel=bool(motor.executavel_ocr()))


@router.post('/atividades', status_code=201)
def criar(entrada: AtividadeEntrada, db: Session = Depends(get_db), usuario: Usuario = Depends(get_usuario_atual)):
    try:
        a = motor.salvar_atividade(db, usuario.id, entrada.model_dump())
    except motor.TreinoDuplicado:
        raise HTTPException(409, 'Este print ou treino já foi registrado na sua conta.') from None
    return serializar(a)


@router.put('/atividades/{id}')
def editar(id: int, entrada: AtividadeEntrada, db: Session = Depends(get_db), usuario: Usuario = Depends(get_usuario_atual)):
    a = obter(db, AtividadeFisica, id, usuario)
    for campo, valor in entrada.model_dump(exclude={'print_hash'}).items():
        setattr(a, campo, valor)
    db.commit()
    return serializar(a)


@router.delete('/atividades/{id}')
def excluir(id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_usuario_atual)):
    db.delete(obter(db, AtividadeFisica, id, usuario))
    db.commit()
    return {'ok': True}


@router.post('/metas', status_code=201)
def criar_meta(entrada: MetaEntrada, db: Session = Depends(get_db), usuario: Usuario = Depends(get_usuario_atual)):
    m = MetaExercicio(usuario_id=usuario.id, **entrada.model_dump())
    db.add(m)
    db.commit()
    return {'id': m.id}


@router.put('/metas/{id}')
def editar_meta(id: int, entrada: MetaEntrada, db: Session = Depends(get_db), usuario: Usuario = Depends(get_usuario_atual)):
    m = obter(db, MetaExercicio, id, usuario)
    for campo, valor in entrada.model_dump().items():
        setattr(m, campo, valor)
    db.commit()
    return {'id': m.id}


@router.delete('/metas/{id}')
def excluir_meta(id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_usuario_atual)):
    db.delete(obter(db, MetaExercicio, id, usuario))
    db.commit()
    return {'ok': True}


@router.post('/ler-print')
async def importar(arquivo: UploadFile = File(...), db: Session = Depends(get_db), usuario: Usuario = Depends(get_usuario_atual)):
    from starlette.concurrency import run_in_threadpool
    conteudo = await arquivo.read(8 * 1024 * 1024 + 1)
    await arquivo.close()
    if len(conteudo) > 8 * 1024 * 1024:
        raise HTTPException(413, 'O print deve ter até 8 MB.')
    resumo = hashlib.sha256(conteudo).hexdigest()
    if db.query(AtividadeFisica.id).filter(AtividadeFisica.usuario_id == usuario.id,
                                         AtividadeFisica.print_hash == resumo).first():
        raise HTTPException(409, 'Este print já foi registrado na sua conta.')
    try:
        dados = await run_in_threadpool(motor.ler_print, conteudo)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    except RuntimeError as e:
        raise HTTPException(503, str(e)) from None
    return dict(dados=dados, print_hash=resumo,
                aviso='Revise todos os valores e informe a data real da atividade antes de salvar.')
