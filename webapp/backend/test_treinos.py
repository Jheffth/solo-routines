"""Testes de cálculo, validação, OCR e autorização sem dados ou rede reais."""
import io
import math
from datetime import date
from types import SimpleNamespace as S
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from PIL import Image
from database import Base, Usuario, AtividadeFisica, MetaExercicio, get_db
from auth.router import get_usuario_atual
from motors import treinos as m, tempo
from routers.treinos import router


def atividade(km=1.91, segundos=1070, dia=date(2026, 11, 2), modalidade='corrida'):
    return S(distancia_km=km, duracao_segundos=segundos, data=dia,
             modalidade=modalidade, passos=2150, elevacao_m=15)


@pytest.mark.parametrize('periodo,ref,inicio,fim', [
    ('dia', date(2026,11,2), date(2026,11,2), date(2026,11,2)),
    ('semana', date(2026,11,1), date(2026,10,26), date(2026,11,1)),
    ('semana', date(2026,11,2), date(2026,11,2), date(2026,11,8)),
    ('semana', date(2027,1,1), date(2026,12,28), date(2027,1,3)),
    ('mes', date(2024,2,3), date(2024,2,1), date(2024,2,29)),
    ('mes', date(2026,12,1), date(2026,12,1), date(2026,12,31)),
    ('ano', date(2024,8,1), date(2024,1,1), date(2024,12,31)),
])
def test_periodos(periodo,ref,inicio,fim):
    assert m.intervalo(periodo,ref)==(inicio,fim)


def test_metricas_print_e_ponderacao():
    a=m.metricas([atividade()], 2)
    assert a['minutos']==17.83 and a['distancia_km']==1.91
    assert a['ritmo_segundos_km']==560.21
    assert a['velocidade_kmh']==6.43
    assert a['km_por_dia']==.955 and a['passos']==2150
    b=m.metricas([atividade(1,600),atividade(9,2700)], 7)
    assert b['ritmo_segundos_km']==330 # média simples seria 450
    assert b['km_por_treino']==5 and b['dias_ativos']==1


def test_sem_distancia_e_vazio():
    assert m.metricas([], 30)['ritmo_segundos_km'] is None
    assert m.metricas([atividade(0,600)], 1)['velocidade_kmh']==0


@pytest.mark.parametrize('tipo,alvo,limite,registros,atingida', [
    ('distancia', 3, None, [atividade(2),atividade(2)], True),
    ('minutos', 30, None, [atividade(segundos=900),atividade(segundos=900)], True),
    ('distancia_tempo', 5, 1800, [atividade(3,900),atividade(3,900)], False),
    ('distancia_tempo', 5, 1800, [atividade(5,1800)], True),
    ('distancia_tempo', 5, 1800, [atividade(5,1801)], False),
])
def test_metas(tipo,alvo,limite,registros,atingida):
    meta=S(tipo=tipo,alvo=alvo,tempo_limite_segundos=limite,modalidade='todas')
    assert m.progresso(meta,registros)['atingida'] is atingida


def test_meta_modalidade_e_excedente():
    meta=S(tipo='distancia',alvo=5,modalidade='corrida')
    assert m.progresso(meta,[atividade(10,modalidade='caminhada')])['atual']==0
    assert m.progresso(meta,[atividade(10)])['percentual']==200


def test_parser_strava():
    texto='Hoje às 06:28\nTrilha matinal\nDistância\n1,91 km\nTempo de movimentação\n17:50\nGanho de elevação\n15 m\nPassos\n2.150\nVelocidade média\n6,4 km/h'
    assert m.extrair_texto(texto)==dict(titulo='Trilha matinal',distancia_km=1.91,duracao_segundos=1070,passos=2150,elevacao_m=15)
    assert 'data' not in m.extrair_texto(texto)
    assert m.extrair_texto('02/11/2026')['data']=='2026-11-02'
    assert 'data' not in m.extrair_texto('31/02/2026')
    assert 'distancia_km' not in m.extrair_texto('Velocidade média\n6,4 km/h')


@pytest.mark.parametrize('texto,esperado',[('17:50',1070),('1:02:03',3723),('125:00',7500)])
def test_duracao(texto,esperado):
    assert m.duracao(texto)==esperado


@pytest.mark.parametrize('texto',['17:99','1:60:00','12','xx:12'])
def test_duracao_invalida(texto):
    with pytest.raises(ValueError): m.duracao(texto)


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.setattr(tempo,'hoje',lambda:date(2026,11,2))
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessao=sessionmaker(bind=engine)()
    usuarios=[Usuario(nome='Conta A',login='contaa',senha_hash='sem-uso'),
              Usuario(nome='Conta B',login='contab',senha_hash='sem-uso')]
    sessao.add_all(usuarios); sessao.commit()
    atual={'usuario':usuarios[0]}
    app=FastAPI(); app.include_router(router,prefix='/api')
    def db(): yield sessao
    app.dependency_overrides[get_db]=db
    app.dependency_overrides[get_usuario_atual]=lambda:atual['usuario']
    with TestClient(app) as c:
        yield c,sessao,atual,usuarios,app
    sessao.close(); engine.dispose()


def entrada(**kwargs):
    return dict(titulo='Treino',data='2026-11-02',modalidade='corrida',distancia_km=1.91,duracao_segundos=1070,**kwargs)


def test_crud_recalcula_e_isola(cliente):
    c,db,atual,usuarios,_=cliente
    a=c.post('/api/treinos/atividades',json=entrada()); assert a.status_code==201
    mid=c.post('/api/treinos/metas',json=dict(titulo='5km',periodo='dia',tipo='distancia',alvo=5)).json()['id']
    id=a.json()['id']
    painel=c.get('/api/treinos?periodo=dia').json()
    assert painel['metricas']['distancia_km']==1.91
    atual['usuario']=usuarios[1]
    assert c.get('/api/treinos').json()['total']==0
    for recurso,rid,payload in [('atividades',id,entrada()),('metas',mid,dict(titulo='x',periodo='dia',tipo='minutos',alvo=5))]:
        assert c.put(f'/api/treinos/{recurso}/{rid}',json=payload).status_code==404
        assert c.delete(f'/api/treinos/{recurso}/{rid}').status_code==404
    atual['usuario']=usuarios[0]
    payload=entrada(); payload['distancia_km']=6
    assert c.put(f'/api/treinos/atividades/{id}',json=payload).status_code==200
    assert c.get('/api/treinos?periodo=dia').json()['metas'][0]['atingida']
    assert c.delete(f'/api/treinos/atividades/{id}').status_code==200
    assert not c.get('/api/treinos?periodo=dia').json()['metas'][0]['atingida']
    assert c.delete(f'/api/treinos/metas/{mid}').status_code==200


def test_medias_periodo_e_filtro(cliente):
    c,*_=cliente
    c.post('/api/treinos/atividades',json=entrada())
    assert c.get('/api/treinos?periodo=mes').json()['metricas']['dias_periodo']==2
    assert c.get('/api/treinos?periodo=mes&referencia=2024-02-15').json()['metricas']['dias_periodo']==29
    assert c.get('/api/treinos?modalidade=caminhada').json()['total']==0
    assert c.get('/api/treinos?periodo=invalido').status_code==422
    assert c.get('/api/treinos?pagina=0').status_code==422


@pytest.mark.parametrize('campo,valor', [('data','2026-11-03'),('distancia_km',-1),('distancia_km',0),('duracao_segundos',0),('passos',-1),('modalidade','invalida'),('titulo','   ')])
def test_validacao(cliente,campo,valor):
    c,*_=cliente
    p=entrada();p[campo]=valor
    assert c.post('/api/treinos/atividades',json=p).status_code==422


def test_exercicio_sem_km_e_meta_invalida(cliente):
    c,*_=cliente
    p=entrada();p.update(modalidade='exercicio',distancia_km=0)
    assert c.post('/api/treinos/atividades',json=p).status_code==201
    assert c.post('/api/treinos/metas',json=dict(titulo='x',periodo='dia',tipo='distancia_tempo',alvo=5)).status_code==422
    assert c.post('/api/treinos/metas',json=dict(titulo='x',periodo='dia',tipo='minutos',alvo=0)).status_code==422


def test_hash_duplicado_por_dono(cliente):
    c,_,atual,usuarios,_=cliente
    p=entrada(print_hash='a'*64)
    assert c.post('/api/treinos/atividades',json=p).status_code==201
    assert c.post('/api/treinos/atividades',json=p).status_code==409
    atual['usuario']=usuarios[1]
    assert c.post('/api/treinos/atividades',json=p).status_code==201


def test_importacao_revisavel_nao_grava(cliente,monkeypatch):
    c,_,atual,usuarios,_=cliente
    monkeypatch.setattr(m,'ler_print',lambda conteudo:dict(distancia_km=1.91,duracao_segundos=1070))
    resp=c.post('/api/treinos/ler-print',files={'arquivo':('strava.jpg',b'imagem','image/jpeg')})
    assert resp.status_code==200
    assert c.get('/api/treinos').json()['total']==0
    p=entrada(print_hash=resp.json()['print_hash'])
    c.post('/api/treinos/atividades',json=p)
    assert c.post('/api/treinos/ler-print',files={'arquivo':('strava.jpg',b'imagem','image/jpeg')}).status_code==409
    atual['usuario']=usuarios[1]
    assert c.post('/api/treinos/ler-print',files={'arquivo':('strava.jpg',b'imagem','image/jpeg')}).status_code==200


def test_ocr_imagem_invalida_e_ausente(monkeypatch):
    with pytest.raises(ValueError): m.ler_print(b'nao-e-imagem')
    b=io.BytesIO(); Image.new('RGB',(30,30)).save(b,format='PNG')
    monkeypatch.setattr(m,'executavel_ocr',lambda:None)
    with pytest.raises(RuntimeError): m.ler_print(b.getvalue())


def test_importacao_grande(cliente):
    c,*_=cliente
    assert c.post('/api/treinos/ler-print',files={'arquivo':('x.png',b'x'*(8*1024*1024+1),'image/png')}).status_code==413


def test_sem_sessao(cliente):
    c,_,_,_,app=cliente
    del app.dependency_overrides[get_usuario_atual]
    assert c.get('/api/treinos').status_code==401
    assert c.post('/api/treinos/atividades',json=entrada()).status_code==401
    assert c.post('/api/treinos/ler-print',files={'arquivo':('x.png',b'x','image/png')}).status_code==401


def test_paginacao_e_ordem(cliente):
    c,db,_,usuarios,_=cliente
    db.add_all([AtividadeFisica(usuario_id=usuarios[0].id,titulo=f'Treino {i}',data=date(2026,11,2),modalidade='corrida',distancia_km=1,duracao_segundos=60) for i in range(51)])
    db.commit()
    a=c.get('/api/treinos').json(); b=c.get('/api/treinos?pagina=2').json()
    assert a['total']==51 and len(a['atividades'])==50 and len(b['atividades'])==1
    assert a['metricas']['distancia_km']==51
    assert a['atividades'][0]['id']>b['atividades'][0]['id']


def test_ocr_pipeline_e_limpeza(monkeypatch):
    b=io.BytesIO(); Image.new('RGB',(100,200),'black').save(b,format='PNG')
    arquivos=[]
    monkeypatch.setattr(m,'executavel_ocr',lambda:'tesseract')
    def executar(args,**kwargs):
        from pathlib import Path
        arquivos.append(Path(args[1]))
        assert arquivos[-1].exists()
        texto=('Trilha matinal\nDistância\n1,91 km\nTempo de movimentação\n17:50' if len(arquivos)<3 else 'Ganho de elevação\n15 m\nPassos\n2.150\nVelocidade máx.\n18,3 km/h')
        return S(stdout=texto.encode('utf-8'))
    monkeypatch.setattr(m.subprocess,'run',executar)
    dados=m.ler_print(b.getvalue())
    assert dados['titulo']=='Trilha matinal'
    assert dados['velocidade_max_kmh']==18.3
    assert dados['passos']==2150 and dados['duracao_segundos']==1070
    assert all(not f.exists() for f in arquivos)


def test_meta_editavel(cliente):
    c,*_=cliente
    p=dict(titulo='Meta',periodo='dia',tipo='distancia',alvo=1)
    id=c.post('/api/treinos/metas',json=p).json()['id']
    c.post('/api/treinos/atividades',json=entrada())
    assert c.get('/api/treinos').json()['metas'][0]['atingida']
    p.update(alvo=5,periodo='ano')
    assert c.put(f'/api/treinos/metas/{id}',json=p).status_code==200
    meta=c.get('/api/treinos').json()['metas'][0]
    assert not meta['atingida'] and meta['inicio']=='2026-01-01'
