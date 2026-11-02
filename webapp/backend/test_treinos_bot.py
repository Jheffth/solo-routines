"""Contrato autenticado e importação automática de Strava nos canais do hub."""
import base64
from datetime import date, datetime, timezone
import pytest
from sqlalchemy import func
from test_treinos import cliente, entrada
from database import AtividadeFisica, ImportacaoTreino
from motors import treinos, treinos_bot
from routers import solobot


@pytest.fixture
def ponte_cliente(cliente,monkeypatch):
    c,db,atual,usuarios,app=cliente
    app.include_router(solobot.interno)
    monkeypatch.setattr(solobot.ponte,'token',lambda:'token-teste')
    leitura=dict(strava=True,data_relativa='hoje',dados=dict(titulo='Trilha matinal',distancia_km=1.91,duracao_segundos=1070,passos=2150,elevacao_m=15,velocidade_max_kmh=18.3))
    monkeypatch.setattr(treinos,'ler_print',lambda *a,**k:leitura)
    return c,db,usuarios,leitura


def corpo(usuario_id,**kw):
    return dict(usuario_id=str(usuario_id) if usuario_id else None,imagem_base64=base64.b64encode(b'print').decode(),mime='image/jpeg',enviado_em='2026-11-03T01:00:00+00:00',**kw)


def enviar(c,p,token='token-teste'):
    return c.post('/interno/bot/imagem',json=p,headers={'X-Solo-Token':token})


@pytest.mark.parametrize('canal',['whatsapp','telegram','bella'])
def test_registra_data_do_envio_e_metricas(ponte_cliente,canal):
    c,db,usuarios,_=ponte_cliente
    r=enviar(c,corpo(usuarios[0].id,canal=canal))
    assert r.status_code==200 and r.json()['estado']=='registrado'
    a=db.query(AtividadeFisica).one()
    assert a.usuario_id==usuarios[0].id and a.data==date(2026,11,2)
    assert a.modalidade=='corrida' and a.passos==2150 and a.velocidade_max_kmh==18.3
    assert r.json()['metricas_dia']['distancia_km']==1.91
    assert db.query(ImportacaoTreino).count()==1


@pytest.mark.parametrize('legenda,dia,modalidade',[
    ('/rot treino 01/11/2026 caminhada',date(2026,11,1),'caminhada'),
    ('corrida ontem',date(2026,11,1),'corrida'),
    ('ciclismo 2026-10-31',date(2026,10,31),'ciclismo'),
])
def test_legenda_tem_prioridade(ponte_cliente,legenda,dia,modalidade):
    c,db,usuarios,_=ponte_cliente
    assert enviar(c,corpo(usuarios[0].id,legenda=legenda)).json()['estado']=='registrado'
    a=db.query(AtividadeFisica).one()
    assert a.data==dia and a.modalidade==modalidade


def test_nao_treino_nao_grava(ponte_cliente):
    c,db,usuarios,leitura=ponte_cliente;leitura['strava']=False
    r=enviar(c,corpo(usuarios[0].id)).json()
    assert r['tratado'] is False and db.query(AtividadeFisica).count()==0


@pytest.mark.parametrize('campo',['distancia_km','duracao_segundos'])
def test_print_incompleto_nao_grava(ponte_cliente,campo):
    c,db,usuarios,leitura=ponte_cliente;leitura['dados'].pop(campo)
    r=enviar(c,corpo(usuarios[0].id)).json()
    assert r['tratado'] and r['estado']=='incompleto'
    assert db.query(AtividadeFisica).count()==0


@pytest.mark.parametrize('legenda',['31/02/2026','03/11/2026'])
def test_data_invalida_ou_futura_nao_grava(ponte_cliente,legenda):
    c,db,usuarios,_=ponte_cliente
    assert enviar(c,corpo(usuarios[0].id,legenda=legenda)).json()['estado']=='incompleto'
    assert db.query(AtividadeFisica).count()==0


def test_sem_data_pede_legenda(ponte_cliente):
    c,db,usuarios,leitura=ponte_cliente;leitura['data_relativa']=None
    r=enviar(c,corpo(usuarios[0].id)).json()
    assert r['estado']=='incompleto' and 'data' in r['mensagens'][0]['texto']
    assert db.query(AtividadeFisica).count()==0


def test_autenticacao_e_vinculo(ponte_cliente):
    c,db,usuarios,_=ponte_cliente
    assert enviar(c,corpo(usuarios[0].id),token='errado').status_code==403
    assert enviar(c,corpo(None)).json()['estado']=='sem_vinculo'
    assert enviar(c,corpo(99999)).json()['desvinculado']
    assert db.query(AtividadeFisica).count()==0


def test_isolamento_e_duplicidade_entre_canais(ponte_cliente):
    c,db,usuarios,_=ponte_cliente
    assert enviar(c,corpo(usuarios[0].id,canal='whatsapp')).json()['estado']=='registrado'
    p=corpo(usuarios[0].id,canal='bella');p['imagem_base64']=base64.b64encode(b'recomprimida').decode()
    assert enviar(c,p).json()['estado']=='duplicado'
    assert db.query(AtividadeFisica).count()==1
    p['usuario_id']=str(usuarios[1].id)
    assert enviar(c,p).json()['estado']=='registrado'
    assert db.query(AtividadeFisica).count()==2


def test_web_e_bot_compartilham_idempotencia(ponte_cliente):
    c,db,usuarios,_=ponte_cliente
    assert c.post('/api/treinos/atividades',json=entrada(print_hash='a'*64)).status_code==201
    assert enviar(c,corpo(usuarios[0].id)).json()['estado']=='duplicado'
    id=db.query(AtividadeFisica).one().id
    assert c.delete(f'/api/treinos/atividades/{id}').status_code==200
    assert db.query(ImportacaoTreino).count()==0
    assert enviar(c,corpo(usuarios[0].id)).json()['estado']=='registrado'


def test_ocr_indisponivel_nao_e_referencia(ponte_cliente,monkeypatch):
    c,db,usuarios,_=ponte_cliente
    def falhar(*a,**k):raise RuntimeError('OCR indisponível')
    monkeypatch.setattr(treinos,'ler_print',falhar)
    r=enviar(c,corpo(usuarios[0].id)).json()
    assert r['tratado'] and r['estado']=='indisponivel'
    assert db.query(AtividadeFisica).count()==0


def test_base64_corrompido_e_fuso_obrigatorio(ponte_cliente):
    c,db,usuarios,_=ponte_cliente;p=corpo(usuarios[0].id);p['imagem_base64']='!'
    assert enviar(c,p).json()['estado']=='invalido'
    p=corpo(usuarios[0].id);p['enviado_em']='2026-11-02T12:00:00'
    assert enviar(c,p).status_code==422
    assert db.query(AtividadeFisica).count()==0


def test_metas_recalculadas(ponte_cliente):
    c,db,usuarios,_=ponte_cliente
    r=c.post('/api/treinos/metas',json=dict(titulo='1km',periodo='dia',tipo='distancia',alvo=1,modalidade='corrida'))
    assert r.status_code==201
    assert enviar(c,corpo(usuarios[0].id)).json()['metas'][0]['atingida']


def test_chave_unica_e_rollback_sem_atividade_orfa(ponte_cliente):
    from sqlalchemy.exc import IntegrityError
    c,db,usuarios,_=ponte_cliente
    enviar(c,corpo(usuarios[0].id))
    original=db.query(ImportacaoTreino).one()
    db.add(ImportacaoTreino(usuario_id=original.usuario_id,atividade_id=original.atividade_id,assinatura=original.assinatura))
    with pytest.raises(IntegrityError):db.commit()
    db.rollback()
    assert db.query(AtividadeFisica).count()==1


@pytest.mark.parametrize('texto,esperado',[
    ('Strava App\nDistância\n1,91 km\nHoje',True),
    ('Strava App\nTempo de movimentação\n17:50\nHoje',True),
    ('Foto de roupa\nDistância\n1,91 km',False),
])
def test_classificacao_strava_incompleto(monkeypatch,texto,esperado):
    import io
    from types import SimpleNamespace
    from PIL import Image
    b=io.BytesIO();Image.new('RGB',(100,200)).save(b,format='PNG')
    monkeypatch.setattr(treinos,'executavel_ocr',lambda:'tesseract')
    monkeypatch.setattr(treinos.subprocess,'run',lambda *a,**k:SimpleNamespace(stdout=texto.encode('utf-8')))
    assert treinos.ler_print(b.getvalue(),detalhes=True)['strava'] is esperado
