"""Banco isolado: regras de perfeição, API e preservação de histórico."""
import os
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["AMBIENTE"] = "test"
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import IntegrityError
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from database import Base, Usuario, Rotina, ExecucaoDia, Habilidade, get_db
from auth.router import get_usuario_atual
from motors import habilidades as m
from routers import habilidades as h, rotinas, execucoes


class HabilidadesTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.u = Usuario(nome='Hunter', login='hunter', senha_hash='test')
        self.outro = Usuario(nome='Outro', login='outro', senha_hash='test')
        self.db.add_all([self.u, self.outro]); self.db.commit()
        self.agora = datetime(2026, 9, 30, 12)
        self.clock = patch.object(m.tempo, 'agora', return_value=self.agora)
        self.clock.start()
        self.r = Rotina(usuario_id=self.u.id, titulo='Sem café à noite', tipo='DIARIA', natureza='PASSIVA',
                        hora_inicio='16:00', hora_fim='05:00',
                        dificuldade='LENDARIO', prioridade='CRITICA', ativo=True,
                        criado_em=self.agora-timedelta(days=90))
        self.db.add(self.r); self.db.commit()
        self.hist = []
        for i in range(90, 0, -1):
            ed = ExecucaoDia(usuario_id=self.u.id, rotina_id=self.r.id,
                            data=(self.agora-timedelta(days=i)).date(), status='CONCLUIDA')
            self.hist.append(ed)
        self.db.add_all(self.hist); self.db.commit()
        app = FastAPI(); app.include_router(h.router); app.include_router(rotinas.router)
        app.include_router(execucoes.router)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_usuario_atual] = lambda: self.u
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close(); self.clock.stop(); self.db.close(); self.engine.dispose()

    def test_escala_dificuldade_e_prioridade(self):
        for dificuldade, di in m.DIFICULDADES.items():
            for prioridade, pi in m.PRIORIDADES.items():
                self.r.dificuldade = dificuldade; self.r.prioridade = prioridade
                self.assertEqual(m.meta(self.r), 90 + 30*(di+pi))

    def test_perfeicao_nao_e_streak_comum(self):
        self.assertEqual(m.progresso(self.r,self.hist)['sequencia'],90)
        ed=self.hist[-2]
        for campo,valor in [('status','CONFESSADA'),('reerguida',True),('confessada_em',self.agora),
                            ('fracassada_em',self.agora),('xp_perdido',1),
                            ('resposta_condicional','B'),('condicional_vitoria',False),
                            ('cancelada_em',self.agora)]:
            anterior=getattr(ed,campo); setattr(ed,campo,valor)
            with self.subTest(campo=campo):
                self.assertEqual(m.progresso(self.r,self.hist)['sequencia'],1)
            setattr(ed,campo,anterior)

    def test_ausencia_vencida_quebra_e_folga_nao(self):
        # Retira domingo; só é folga quando a regra é semanal seg-sáb.
        hist=[e for e in self.hist if e.data.weekday()!=6]
        self.assertEqual(m.progresso(self.r,hist)['sequencia'],2)
        self.r.tipo='SEMANAL'; self.r.dias_semana='[0,1,2,3,4,5]'
        self.assertEqual(m.progresso(self.r,hist)['sequencia'],len(hist))

    def test_janela_noturna_aberta_nao_quebra(self):
        self.r.hora_inicio='22:00'; self.r.hora_fim='05:00'
        self.hist[-1].status='ATIVA'
        agora=self.agora.replace(hour=2)
        self.assertEqual(m.progresso(self.r,self.hist,agora)['sequencia'],89)
        self.assertEqual(m.progresso(self.r,self.hist,self.agora)['sequencia'],0)

    def test_nao_conta_futuro_nem_duplicado(self):
        futuro=ExecucaoDia(id=1000,data=self.agora.date()+timedelta(days=1),status='CONCLUIDA')
        self.assertEqual(m.progresso(self.r,[*self.hist,self.hist[-1],futuro])['sequencia'],90)

    def test_conversao_http_persistencia_encerramento_e_bloqueios(self):
        hoje=ExecucaoDia(rotina_id=self.r.id,usuario_id=self.u.id,data=self.agora.date(),status='ATIVA')
        self.db.add(hoje); self.db.commit()
        antes=self.u.xp_total
        resp=self.client.post(f'/habilidades/de-rotina/{self.r.id}',json={'nome':' Imune a Café '})
        self.assertEqual(resp.status_code,201,resp.text)
        self.assertEqual(resp.json()['nome'],'Imune a Café')
        self.db.expire_all()
        self.assertFalse(self.r.ativo); self.assertEqual(self.r.status,'ARQUIVADA')
        self.assertEqual(hoje.status,'CANCELADA')
        self.assertEqual(self.db.query(ExecucaoDia).filter_by(status='CONCLUIDA').count(),90)
        self.assertEqual(self.u.xp_total,antes)
        dados=self.client.get('/habilidades/').json()
        self.assertEqual(len(dados['habilidades']),1); self.assertEqual(dados['progressos'],[])
        self.assertEqual(dados['habilidades'][0]['evidencia']['sequencia'],90)
        self.assertEqual(len(dados['habilidades'][0]['evidencia']['execucao_ids']),90)
        self.assertEqual(self.client.get('/rotinas/').json(),[])
        for metodo,url,body in [('post',f'/habilidades/de-rotina/{self.r.id}',{'nome':'Outra'}),
                                ('put',f'/rotinas/{self.r.id}',{'ativo':True}),
                                ('delete',f'/rotinas/{self.r.id}?extinguir=true',None),
                                ('post',f'/rotinas/{self.r.id}/retomar',None),
                                ('post',f'/rotinas/{self.r.id}/iniciar',None)]:
            with self.subTest(url=url):
                res=self.client.request(metodo,url,json=body)
                self.assertEqual(res.status_code,409,res.text)
        self.assertEqual(self.db.query(Habilidade).count(),1)

    def test_ownership_nome_e_insuficiencia(self):
        self.r.usuario_id=self.outro.id; self.db.commit()
        self.assertEqual(self.client.get('/habilidades/').json()['progressos'],[])
        url=f'/habilidades/de-rotina/{self.r.id}'
        self.assertEqual(self.client.post(url,json={'nome':'Invasão'}).status_code,404)
        self.r.usuario_id=self.u.id; self.db.commit()
        for nome in [' ', 'x'*81, 'linha\nnova']:
            self.assertEqual(self.client.post(url,json={'nome':nome}).status_code,422)
        self.hist[-1].status='FRACASSADA'; self.db.commit()
        self.assertEqual(self.client.post(url,json={'nome':'Sem sequência'}).status_code,409)
        self.assertEqual(self.db.query(Habilidade).count(),0)
        self.assertTrue(self.r.ativo)

    def test_regressao_rotina_comum_edita_inicia_e_arquiva(self):
        self.assertEqual(self.client.put(f'/rotinas/{self.r.id}',json={'titulo':'Sem café'}).status_code,200)
        self.assertEqual(self.client.post(f'/rotinas/{self.r.id}/iniciar').status_code,200)
        resposta=self.client.delete(f'/rotinas/{self.r.id}')
        self.assertEqual(resposta.status_code,200,resposta.text)
        self.assertEqual(resposta.json()['modo'],'arquivada')
        self.assertEqual(self.db.query(ExecucaoDia).filter_by(status='CONCLUIDA').count(),90)

    def test_transacao_falha_sem_aposentar_rotina(self):
        with patch.object(self.db,'commit',side_effect=IntegrityError('insert',{},Exception('unique'))):
            with self.assertRaises(HTTPException) as ctx:
                h.converter(self.r.id,h.Converter(nome='Habilidade'),self.db,self.u)
        self.assertEqual(ctx.exception.status_code,409)
        self.db.expire_all()
        self.assertTrue(self.r.ativo)
        self.assertEqual(self.db.query(Habilidade).count(),0)

    def test_tabela_nova_idempotente_e_acesso_autenticado(self):
        # Mesmo caminho create_all usado pela inicialização em bancos existentes.
        Base.metadata.create_all(self.engine)
        self.assertEqual(self.db.query(ExecucaoDia).count(),90)
        app=FastAPI(); app.include_router(h.router)
        with TestClient(app) as client:
            self.assertIn(client.get('/habilidades/').status_code,(401,403))


if __name__=='__main__': unittest.main()
