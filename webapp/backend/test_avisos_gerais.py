"""Central de avisos: estado real, isolamento e reserva persistente, sem rede."""
import os
os.environ['DATABASE_URL']='sqlite:///:memory:'
os.environ['AMBIENTE']='test'
import uuid
import unittest
from pathlib import Path
from datetime import datetime,timedelta
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fastapi import FastAPI
from fastapi.testclient import TestClient
from database import (Base,Usuario,TarefaDia,Rotina,ExecucaoDia,Dungeon,DungeonSessao,
    RegraAvisoGeral,TentativaAvisoGeral,get_db)
from auth.router import get_usuario_atual
from motors import avisos_gerais as m
from routers import avisos_gerais as r
import solobot_ponte


class AvisosTest(unittest.TestCase):
    def setUp(self):
        self.path=Path(__file__).parent/('.test-central-'+uuid.uuid4().hex+'.db')
        self.engine=create_engine('sqlite:///'+self.path.resolve().as_posix())
        Base.metadata.create_all(self.engine);self.db=Session(self.engine)
        self.u=Usuario(nome='Hunter',login='hunter',senha_hash='fixture')
        self.outro=Usuario(nome='Outro',login='outro',senha_hash='fixture')
        self.db.add_all([self.u,self.outro]);self.db.commit()
        self.agora=datetime(2026,10,1,12)
        self.clock=patch.object(m.tempo,'agora',side_effect=lambda:self.agora);self.clock.start()
        self.t=TarefaDia(usuario_id=self.u.id,titulo='Comprar fio dental',data_prevista=self.agora.date(),
            criado_em=self.agora+timedelta(hours=3),status='PENDENTE') # criado em UTC = meio-dia Brasília
        self.db.add(self.t);self.db.commit()
        self.patch=patch.object(solobot_ponte,'avisar',return_value=True);self.enviar=self.patch.start()
        app=FastAPI();app.include_router(r.router)
        app.dependency_overrides[get_db]=lambda:self.db
        app.dependency_overrides[get_usuario_atual]=lambda:self.u
        self.client=TestClient(app)

    def tearDown(self):
        self.client.close();self.db.close();self.clock.stop();self.patch.stop();self.engine.dispose();self.path.unlink(missing_ok=True)

    def regra(self,origem='TAREFA',oid=None,**extra):
        p={'origem':origem,'alvo_id':oid or self.t.id,**extra}
        res=self.client.post('/avisos-gerais/',json=p)
        self.assertEqual(res.status_code,201,res.text)
        return res.json()

    def varrer(self):
        return m.varrer(self.engine,self.u.id)

    def test_intervalo_estado_atraso_termino_validade_e_reinicio(self):
        regra=self.regra(formato='audio')
        self.assertEqual(self.varrer(),0)
        self.agora+=timedelta(hours=1)
        self.assertEqual(self.varrer(),1);self.assertEqual(self.varrer(),0)
        chamada=self.enviar.call_args
        self.assertIn('ainda não foi iniciada',chamada.args[1])
        self.assertIn('23:59 de hoje',chamada.args[1])
        self.assertEqual(chamada.kwargs['formato'],'audio');self.assertTrue(chamada.kwargs['voz'])
        self.assertEqual(chamada.kwargs['valido_ate'].isoformat(),'2026-10-01T14:00:00-03:00')
        self.db.close();self.db=Session(self.engine);self.t=self.db.get(TarefaDia,self.t.id);self.u=self.db.get(Usuario,self.u.id)
        self.t.status='ATIVA';self.db.commit();self.agora+=timedelta(hours=1)
        self.assertEqual(self.varrer(),1)
        self.assertIn('está em andamento. Você está prestes a concluir?',self.enviar.call_args.args[1])
        self.t.status='CONCLUIDA';self.db.commit();self.agora+=timedelta(hours=1)
        self.assertEqual(self.varrer(),0)
        self.assertEqual(self.db.query(TentativaAvisoGeral).count(),2)

    def test_atrasada_nao_inventa_prazo_futuro_nem_lote_perdido(self):
        self.regra(formato='ambos')
        self.agora+=timedelta(days=1)
        self.assertEqual(self.varrer(),1);self.assertEqual(self.varrer(),0)
        self.assertIn('O prazo venceu',self.enviar.call_args.args[1])
        self.assertEqual(self.enviar.call_count,1)

    def test_propriedade_duplicata_validacao_e_previa_sem_envio(self):
        self.t.usuario_id=self.outro.id;self.db.commit()
        res=self.client.post('/avisos-gerais/',json={'origem':'TAREFA','alvo_id':self.t.id})
        self.assertEqual(res.status_code,404)
        self.t.usuario_id=self.u.id;self.db.commit()
        regra=self.regra()
        self.assertEqual(self.client.post('/avisos-gerais/',json={'origem':'TAREFA','alvo_id':self.t.id}).status_code,409)
        for extra in [{'intervalo_min':1},{'formato':'x'},{'janela_de':'29:10'},{'estados':['CONCLUIDA']},{'evento':'ABRE'}]:
            self.assertEqual(self.client.post('/avisos-gerais/',json={'origem':'TAREFA','alvo_id':self.t.id,**extra}).status_code,422)
        self.assertIn('não foi iniciada',self.client.get(f"/avisos-gerais/{regra['id']}/previa").json()['texto'])
        self.enviar.assert_not_called()
        self.u=self.outro
        self.assertEqual(self.client.get(f"/avisos-gerais/{regra['id']}/previa").status_code,404)
        self.assertEqual(self.client.delete(f"/avisos-gerais/{regra['id']}").status_code,404)

    def test_pausa_janela_timeout_sem_repetir_e_remocao(self):
        regra=self.regra(janela_de='14:00',janela_ate='18:00')
        self.agora+=timedelta(hours=1);self.assertEqual(self.varrer(),0)
        self.agora+=timedelta(hours=1)
        self.enviar.return_value=False
        self.assertEqual(self.varrer(),0);self.assertEqual(self.varrer(),0)
        self.enviar.assert_called_once()
        self.assertEqual(self.db.query(TentativaAvisoGeral).one().status,'FALHOU')
        rid=regra['id'];self.client.patch(f'/avisos-gerais/{rid}',json={'ativo':False})
        self.agora+=timedelta(hours=1);self.assertEqual(self.varrer(),0)
        self.assertEqual(self.client.delete(f'/avisos-gerais/{rid}').status_code,200)
        self.assertEqual(self.db.query(TentativaAvisoGeral).count(),0)

    def test_portao_noturno_abertura_fechamento_folga_e_sempre_aberto(self):
        d=Dungeon(usuario_id=self.u.id,titulo='Trabalho',hora_entrada='22:00',hora_saida='02:00',status='ATIVA')
        self.db.add(d);self.db.commit()
        self.regra('DUNGEON',d.id,evento='ABRE',janela_de='00:00',janela_ate='23:59')
        self.regra('DUNGEON',d.id,evento='FECHA',janela_de='00:00',janela_ate='23:59')
        self.agora=self.agora.replace(hour=21,minute=45)
        self.assertEqual(self.varrer(),1);self.assertEqual(self.varrer(),0)
        self.assertIn('abre em 15 minutos',self.enviar.call_args.args[1])
        self.agora=(self.agora+timedelta(days=1)).replace(hour=1,minute=45)
        self.assertEqual(self.varrer(),1)
        self.assertIn('fecha em 15 minutos',self.enviar.call_args.args[1])
        self.assertEqual(self.varrer(),0)
        d.sempre_aberta=True;self.db.commit()
        self.assertEqual(self.varrer(),0)
        self.assertEqual(self.client.put('/avisos-gerais/1',json={'origem':'DUNGEON','alvo_id':d.id,'evento':'ABRE'}).status_code,422)

    def test_rotina_folgas_e_termino(self):
        rot=Rotina(usuario_id=self.u.id,titulo='Rotina',tipo='SEMANAL',dias_semana='[3]',ativo=True)
        self.db.add(rot);self.db.commit();self.regra('ROTINA',rot.id)
        self.agora+=timedelta(hours=1);self.assertEqual(self.varrer(),1)
        ed=ExecucaoDia(usuario_id=self.u.id,rotina_id=rot.id,data=self.agora.date(),status='CONCLUIDA')
        self.db.add(ed);self.db.commit();self.agora+=timedelta(hours=1);self.assertEqual(self.varrer(),0)
        self.agora+=timedelta(days=1);self.assertEqual(self.varrer(),0)

    def test_sessao_dungeon_real_suspensa_concluida_e_teste_ignorado(self):
        d=Dungeon(usuario_id=self.u.id,titulo='Estudo',hora_entrada='08:00',hora_saida='22:00',status='ATIVA')
        self.db.add(d);self.db.commit();self.regra('DUNGEON',d.id)
        teste=DungeonSessao(dungeon_id=d.id,usuario_id=self.u.id,data=self.agora.date(),status='ATIVA',modo_teste=True)
        self.db.add(teste);self.db.commit();self.agora+=timedelta(hours=1)
        self.assertEqual(self.varrer(),1)
        self.assertIn('aguarda sua entrada',self.enviar.call_args.args[1])
        real=DungeonSessao(dungeon_id=d.id,usuario_id=self.u.id,data=self.agora.date(),status='ATIVA',modo_teste=False)
        self.db.add(real);self.db.commit();self.agora+=timedelta(hours=1)
        self.assertEqual(self.varrer(),1);self.assertIn('em andamento',self.enviar.call_args.args[1])
        real.status='SUSPENSA';self.db.commit();self.agora+=timedelta(hours=1)
        self.assertEqual(self.varrer(),1);self.assertIn('suspensa',self.enviar.call_args.args[1])
        real.status='CONCLUIDA';self.db.commit();self.agora+=timedelta(hours=1)
        self.assertEqual(self.varrer(),0)

    def test_conclusao_entre_reserva_e_entrega_impede_envio(self):
        self.regra();self.agora+=timedelta(hours=1)
        original=m.mensagem
        chamadas=0
        def finalizar(db,r,agora=None):
            nonlocal chamadas
            chamadas+=1
            if chamadas==2:
                t=db.get(TarefaDia,self.t.id);t.status='CONCLUIDA';db.commit()
            return original(db,r,agora)
        with patch.object(m,'mensagem',side_effect=finalizar):
            self.assertEqual(self.varrer(),0)
        self.enviar.assert_not_called()
        self.assertEqual(self.db.query(TentativaAvisoGeral).one().status,'IGNORADO')

    def test_ponte_transmite_formato_e_mantem_contrato_antigo(self):
        self.patch.stop()
        with patch.object(solobot_ponte,'token',return_value='fixture'), patch.object(solobot_ponte,'_post',return_value={'entregues':1}) as post:
            self.assertTrue(solobot_ponte.avisar(1,'Lembrete',formato='audio',voz=True))
            self.assertEqual(post.call_args.args[1]['formato'],'audio')
            self.assertTrue(solobot_ponte.avisar(1,'Lembrete'))
            self.assertNotIn('formato',post.call_args.args[1])


if __name__=='__main__':unittest.main()
