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
from database import (Base,Usuario,TarefaDia,Rotina,ExecucaoDia,Dungeon,DungeonSessao,DungeonMissao,DungeonMissaoExecucao,
    RegraAvisoGeral,TentativaAvisoGeral,get_db)
from auth.router import get_usuario_atual
from motors import avisos_gerais as m
from routers import avisos_gerais as r
from routers import solobot as router_bot
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
        app=FastAPI();app.include_router(r.router);app.include_router(router_bot.interno)
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
            self.assertTrue(solobot_ponte.avisar(1,'Lembrete',formato='audio',voz=True,referencia='central:1:fixture'))
            self.assertEqual(post.call_args.args[1]['formato'],'audio')
            self.assertEqual(post.call_args.args[1]['referencia'],'central:1:fixture')
            self.assertTrue(solobot_ponte.avisar(1,'Lembrete'))
            self.assertNotIn('formato',post.call_args.args[1])
            self.assertNotIn('referencia',post.call_args.args[1])

    def interna(self,natureza='AGENDADA',**extra):
        d=Dungeon(usuario_id=self.u.id,titulo='Estudo',hora_entrada='08:00',hora_saida='22:00',status='ATIVA')
        self.db.add(d);self.db.flush()
        s=DungeonSessao(dungeon_id=d.id,usuario_id=self.u.id,data=self.agora.date(),status='ATIVA',entrada_em=self.agora-timedelta(minutes=30),modo_teste=False)
        missao=DungeonMissao(dungeon_id=d.id,titulo='Beber água',natureza=natureza,**extra)
        self.db.add_all([s,missao]);self.db.commit()
        return d,s,missao

    def execucao(self,s,missao,**extra):
        e=DungeonMissaoExecucao(dungeon_missao_id=missao.id,dungeon_sessao_id=s.id,**extra)
        self.db.add(e);self.db.commit();return e

    def test_interna_agendada_antecipacao_status_prazo_e_encerramento(self):
        d,s,missao=self.interna(hora_inicio='12:15',hora_limite='13:00')
        e=self.execucao(s,missao,status='PENDENTE')
        self.regra('MISSAO',missao.id,evento='ATIVA_EM')
        self.assertEqual(self.varrer(),1);self.assertEqual(self.varrer(),0)
        self.assertIn('disponível em 15 minutos',self.enviar.call_args.args[1])
        self.assertEqual(self.enviar.call_args.kwargs['valido_ate'].hour,12)
        self.regra('MISSAO',missao.id,evento='STATUS',intervalo_min=5)
        self.regra('MISSAO',missao.id,evento='EXPIRA_EM',antecedencia_min=10)
        self.agora=self.agora.replace(minute=10);self.assertEqual(self.varrer(),0)
        self.agora=self.agora.replace(minute=20);self.assertEqual(self.varrer(),1)
        e.status='EM_PROGRESSO';self.db.commit();self.agora=self.agora.replace(minute=50)
        self.assertEqual(self.varrer(),2);self.assertEqual(self.varrer(),0)
        self.assertIn('vence em 10 minutos',self.enviar.call_args.args[1])
        e.status='CONCLUIDA';self.db.commit();self.agora+=timedelta(minutes=5)
        self.assertEqual(self.varrer(),0)

    def test_saude_proxima_ocorrencia_expiracao_e_novo_card(self):
        d,s,missao=self.interna('BEM_ESTAR',intervalo_min=45,expira_em_min=10)
        self.regra('MISSAO',missao.id,evento='ATIVA_EM',antecedencia_min=20)
        self.regra('MISSAO',missao.id,evento='EXPIRA_EM',antecedencia_min=5)
        self.assertEqual(self.varrer(),1);self.assertEqual(self.varrer(),0)
        self.agora+=timedelta(minutes=15)
        e=self.execucao(s,missao,status='PENDENTE',disparada_em=self.agora)
        self.assertEqual(self.varrer(),0)
        self.agora+=timedelta(minutes=5);self.assertEqual(self.varrer(),1)
        self.assertEqual(self.enviar.call_args.kwargs['valido_ate'].minute,25)
        self.assertEqual(self.varrer(),0)
        self.agora+=timedelta(minutes=6)
        # Mesmo sem heartbeat para mudar o status, não cobra card vencido.
        self.assertEqual(self.varrer(),0)
        e.status='EXPIRADA';self.db.commit()
        self.agora=self.agora.replace(minute=45);self.assertEqual(self.varrer(),1)
        self.assertIn('disponível em 15 minutos',self.enviar.call_args.args[1])
        self.agora=self.agora.replace(hour=13,minute=0)
        novo=self.execucao(s,missao,status='PENDENTE',disparada_em=self.agora)
        self.agora+=timedelta(minutes=5);self.assertEqual(self.varrer(),1)
        novo.status='CONCLUIDA';self.db.commit();self.assertEqual(self.varrer(),0)
        self.assertEqual(self.db.query(TentativaAvisoGeral).count(),4)

    def test_missao_interna_propriedade_folgas_e_sessoes_teste(self):
        d,s,missao=self.interna(hora_inicio='12:15',hora_limite='13:00')
        self.execucao(s,missao,status='PENDENTE')
        self.regra('MISSAO',missao.id,evento='ATIVA_EM')
        s.modo_teste=True;self.db.commit();self.assertEqual(self.varrer(),0)
        s.modo_teste=False;missao.dias_semana='[4]';self.db.commit();self.assertEqual(self.varrer(),0)
        missao.dias_semana=None;self.db.commit()
        itens=self.client.get('/avisos-gerais/catalogo').json()
        self.assertEqual(next(i for i in itens if i['origem']=='MISSAO')['eventos'],['STATUS','ATIVA_EM','EXPIRA_EM'])
        self.u=self.outro
        self.assertEqual(self.client.post('/avisos-gerais/',json={'origem':'MISSAO','alvo_id':missao.id}).status_code,404)
        self.assertFalse(any(i['origem']=='MISSAO' for i in self.client.get('/avisos-gerais/catalogo').json()))

    def test_prazo_sessao_conta_primeira_entrada_mesmo_suspensa(self):
        d,s,missao=self.interna()
        d.sempre_aberta=True;d.hora_saida=None;d.duracao_max_min=45;s.status='SUSPENSA';self.db.commit()
        self.regra('DUNGEON',d.id,evento='PRAZO',antecedencia_min=20)
        self.assertEqual(self.varrer(),1);self.assertEqual(self.varrer(),0)
        self.assertIn('termina em 15 minutos',self.enviar.call_args.args[1])
        self.assertEqual(self.enviar.call_args.kwargs['valido_ate'].minute,15)
        self.agora+=timedelta(minutes=16);self.assertEqual(self.varrer(),0)

    def test_aleatoria_anuncia_janela_sem_promessa_de_horario(self):
        d,s,missao=self.interna('EVENTO_ALEATORIO',janela_disparo_min=45,janela_disparo_max=60)
        self.regra('MISSAO',missao.id,evento='ATIVA_EM')
        self.assertEqual(self.varrer(),1)
        self.assertIn('pode aparecer na janela das 12:15 às 12:30',self.enviar.call_args.args[1])
        self.assertEqual(self.db.query(DungeonMissaoExecucao).count(),0,'pré-aviso não gera card')

    def test_interna_rejeita_eventos_impossiveis_e_missao_inativa(self):
        d,s,missao=self.interna('PADRAO')
        for ev in ('ABRE','PRAZO','ATIVA_EM','EXPIRA_EM'):
            self.assertEqual(self.client.post('/avisos-gerais/',json={'origem':'MISSAO','alvo_id':missao.id,'evento':ev}).status_code,422)
        missao.tipo='PASSIVA';self.db.commit()
        self.assertEqual(self.client.post('/avisos-gerais/',json={'origem':'MISSAO','alvo_id':missao.id}).status_code,422)
        missao.tipo='ATIVA';missao.ativo=False;self.db.commit()
        self.assertEqual(self.client.post('/avisos-gerais/',json={'origem':'MISSAO','alvo_id':missao.id}).status_code,409)

    def test_prazo_sessao_limita_card_e_impede_antecipar_apos_fim(self):
        d,s,missao=self.interna(hora_inicio='12:15',hora_limite='13:00')
        d.duracao_max_min=40;self.db.commit() # primeira entrada 11:30 -> 12:10
        self.execucao(s,missao,status='PENDENTE')
        self.regra('MISSAO',missao.id,evento='ATIVA_EM')
        self.assertEqual(self.varrer(),0,'não promete card que só abriria após o fim')
        missao.hora_inicio='11:45';self.db.commit()
        self.regra('MISSAO',missao.id,evento='EXPIRA_EM')
        self.assertEqual(self.varrer(),1)
        self.assertIn('vence em 10 minutos',self.enviar.call_args.args[1])
        self.assertEqual(self.enviar.call_args.kwargs['valido_ate'].minute,10)
        self.regra('DUNGEON',d.id,evento='STATUS',intervalo_min=5)
        self.agora+=timedelta(minutes=11);self.assertEqual(self.varrer(),0)

    def test_troca_ocorrencia_entre_reserva_e_entrega_nao_manda_outro_card(self):
        d,s,missao=self.interna('BEM_ESTAR',intervalo_min=45,expira_em_min=10)
        e=self.execucao(s,missao,status='PENDENTE',disparada_em=self.agora-timedelta(minutes=5))
        self.regra('MISSAO',missao.id,evento='EXPIRA_EM')
        original=m.mensagem;chamadas=0
        def trocar(db,r,agora=None):
            nonlocal chamadas
            chamadas+=1
            if chamadas==2:
                db.get(DungeonMissaoExecucao,e.id).status='CONCLUIDA'
                db.add(DungeonMissaoExecucao(dungeon_missao_id=missao.id,dungeon_sessao_id=s.id,status='PENDENTE',disparada_em=self.agora))
                db.commit()
            return original(db,r,agora)
        with patch.object(m,'mensagem',side_effect=trocar):
            self.assertEqual(self.varrer(),0)
        self.enviar.assert_not_called()
        self.assertEqual(self.db.query(TentativaAvisoGeral).one().status,'IGNORADO')
        self.assertEqual(self.varrer(),1,'nova ocorrência tem sua própria oportunidade')

    def pendente(self):
        regra=self.regra();self.agora+=timedelta(hours=1)
        self.assertEqual(self.varrer(),1)
        return regra,self.enviar.call_args.kwargs['referencia']

    def test_revalidacao_atualiza_status_e_revoga_apos_conclusao(self):
        regra,ref=self.pendente()
        self.assertTrue(m.validar_pendente(self.db,self.u.id,ref)['valido'])
        self.t.status='ATIVA';self.db.commit()
        self.assertIn('em andamento',m.validar_pendente(self.db,self.u.id,ref)['texto'])
        self.t.status='CONCLUIDA';self.db.commit()
        self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])

    def test_revalidacao_pausa_edicao_remocao_e_usuario_inativo(self):
        regra,ref=self.pendente();rid=regra['id']
        self.client.patch(f'/avisos-gerais/{rid}',json={'ativo':False})
        self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])
        self.client.patch(f'/avisos-gerais/{rid}',json={'ativo':True})
        # Mudar formato invalida áudio/texto enfileirado com a configuração antiga.
        row=self.db.get(RegraAvisoGeral,rid);row.formato='audio';self.db.commit()
        self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])
        row.formato='texto';self.u.ativo=False;self.db.commit()
        self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])
        self.u.ativo=True;self.db.commit()
        self.client.delete(f'/avisos-gerais/{rid}')
        self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])

    def test_revalidacao_protege_token_dono_e_referencia(self):
        regra,ref=self.pendente()
        url='/interno/bot/validar-aviso';body={'usuario_id':self.u.id,'referencia':ref}
        with patch.object(solobot_ponte,'token',return_value='fixture'):
            self.assertEqual(self.client.post(url,json=body).status_code,403)
            self.assertTrue(self.client.post(url,json=body,headers={'X-Solo-Token':'fixture'}).json()['valido'])
            body['usuario_id']=self.outro.id
            self.assertFalse(self.client.post(url,json=body,headers={'X-Solo-Token':'fixture'}).json()['valido'])
        for errado in ('x','central:x:y','central:9999:abc',ref+'0'):
            self.assertFalse(m.validar_pendente(self.db,self.u.id,errado)['valido'])

    def test_revalidacao_saude_nao_recicla_card_concluido_em_nova_ocorrencia(self):
        d,s,missao=self.interna('BEM_ESTAR',intervalo_min=45,expira_em_min=30)
        e=self.execucao(s,missao,status='PENDENTE',disparada_em=self.agora)
        self.regra('MISSAO',missao.id,intervalo_min=5)
        self.agora+=timedelta(minutes=5);self.assertEqual(self.varrer(),1)
        ref=self.enviar.call_args.kwargs['referencia']
        self.assertTrue(m.validar_pendente(self.db,self.u.id,ref)['valido'])
        e.status='CONCLUIDA';self.db.commit()
        self.execucao(s,missao,status='PENDENTE',disparada_em=self.agora)
        self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])

    def test_revalidacao_rotina_nao_transporta_ocorrencia_para_dia_seguinte(self):
        rot=Rotina(usuario_id=self.u.id,titulo='Rotina',tipo='DIARIA',ativo=True)
        self.db.add(rot);self.db.commit();self.regra('ROTINA',rot.id)
        self.agora+=timedelta(hours=1);self.assertEqual(self.varrer(),1)
        ref=self.enviar.call_args.kwargs['referencia']
        self.agora+=timedelta(days=1)
        self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])

    def test_card_curto_avisa_sem_esperar_intervalo_e_uma_vez_por_ocorrencia(self):
        d,s,missao=self.interna('BEM_ESTAR',intervalo_min=45,expira_em_min=1)
        self.regra('MISSAO',missao.id,evento='DISPONIVEL',intervalo_min=60)
        e=self.execucao(s,missao,status='PENDENTE',disparada_em=self.agora)
        self.agora+=timedelta(seconds=20)
        self.assertEqual(m.varrer_todos(self.engine),1)
        self.assertIn('está disponível',self.enviar.call_args.args[1])
        self.assertEqual(self.enviar.call_args.kwargs['valido_ate'].minute,1)
        self.agora+=timedelta(seconds=30)
        self.assertEqual(m.varrer_todos(self.engine),0)
        self.agora+=timedelta(seconds=30)
        self.assertEqual(m.varrer_todos(self.engine),0,'não envia card já vencido')
        e.status='EXPIRADA';self.db.commit()
        self.execucao(s,missao,status='PENDENTE',disparada_em=self.agora)
        self.assertEqual(m.varrer_todos(self.engine),1,'novo card não espera uma hora')
        self.assertEqual(m.varrer_todos(self.engine),0)
        self.assertEqual(self.db.query(TentativaAvisoGeral).count(),2)

    def test_varredura_rapida_filtra_inativos_e_nao_interrompe_outro_hunter(self):
        self.regra()
        outra=TarefaDia(usuario_id=self.outro.id,titulo='Outra',status='PENDENTE',data_prevista=self.agora.date())
        self.db.add(outra);self.db.commit()
        self.u,self.outro=self.outro,self.u
        self.regra('TAREFA',outra.id)
        vistos=[]
        def processar(bind,uid):
            vistos.append(uid)
            if uid==self.outro.id:raise RuntimeError('simulado')
            return 1
        with patch.object(m,'varrer',side_effect=processar):
            self.assertEqual(m.varrer_todos(self.engine),1)
        self.assertEqual(set(vistos),{self.u.id,self.outro.id})
        self.outro.ativo=False;self.db.commit();vistos.clear()
        with patch.object(m,'varrer',side_effect=processar):
            self.assertEqual(m.varrer_todos(self.engine),1)
        self.assertEqual(vistos,[self.u.id])
        self.db.query(RegraAvisoGeral).update({'ativo':False});self.db.commit()
        with patch.object(m,'varrer') as varrer:
            self.assertEqual(m.varrer_todos(self.engine),0);varrer.assert_not_called()

    def test_card_disponivel_revalidacao_para_ao_concluir(self):
        d,s,missao=self.interna('EVENTO_ALEATORIO',expira_em_min=30)
        e=self.execucao(s,missao,status='PENDENTE',disparada_em=self.agora)
        self.regra('MISSAO',missao.id,evento='DISPONIVEL',intervalo_min=5)
        self.assertEqual(self.varrer(),1)
        ref=self.enviar.call_args.kwargs['referencia']
        self.assertEqual(self.enviar.call_args.kwargs['valido_ate'].minute,30)
        self.agora+=timedelta(minutes=10)
        self.assertTrue(m.validar_pendente(self.db,self.u.id,ref)['valido'])
        e.status='CONCLUIDA';self.db.commit()
        self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])
        self.assertEqual(self.varrer(),0)

    def test_agendamento_central_30_segundos_e_falha_isolada(self):
        import main
        job=main.scheduler.get_job('central_avisos')
        agora=self.agora.replace(second=10,tzinfo=m.tempo.FUSO)
        primeiro=job.trigger.get_next_fire_time(None,agora)
        segundo=job.trigger.get_next_fire_time(primeiro,primeiro)
        self.assertEqual((primeiro-agora).total_seconds(),20)
        self.assertEqual((segundo-primeiro).total_seconds(),30)
        self.assertEqual(job.max_instances,1);self.assertTrue(job.coalesce)
        with patch.object(m,'varrer_todos',side_effect=RuntimeError('simulado')):
            main._job_central_avisos() # job não derruba o scheduler

    def segunda_tarefa(self,formato='texto'):
        t=TarefaDia(usuario_id=self.u.id,titulo='Comprar pão',data_prevista=self.agora.date(),criado_em=self.agora+timedelta(hours=3),status='PENDENTE')
        self.db.add(t);self.db.commit();self.regra('TAREFA',t.id,formato=formato)
        return t

    def test_adiar_persistente_revoga_fila_sem_mudar_prazo(self):
        regra,ref=self.pendente();rid=regra['id']
        res=self.client.post(f'/avisos-gerais/{rid}/adiar')
        self.assertEqual(res.status_code,200)
        self.assertEqual(res.json()['adiado_ate'],'2026-10-01T14:00:00-03:00')
        self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])
        self.agora+=timedelta(minutes=59);self.assertEqual(self.varrer(),0)
        self.agora+=timedelta(minutes=1);self.assertEqual(self.varrer(),1)
        self.assertIn('23:59 de hoje',self.enviar.call_args.args[1])
        self.u=self.outro
        self.assertEqual(self.client.post(f'/avisos-gerais/{rid}/adiar').status_code,404)

    def test_limite_diario_falhas_contam_e_virada_libera_sem_lote_perdido(self):
        self.regra(intervalo_min=5)
        self.assertEqual(self.client.put('/avisos-gerais/preferencias',json={'limite_diario':1,'agrupar':False}).status_code,200)
        self.enviar.return_value=False;self.agora+=timedelta(minutes=5)
        self.assertEqual(self.varrer(),0);self.enviar.assert_called_once()
        self.agora+=timedelta(hours=2);self.assertEqual(self.varrer(),0)
        p=self.client.get('/avisos-gerais/preferencias').json()
        self.assertEqual(p['usados_hoje'],1);self.assertEqual(p['restantes'],0)
        self.agora+=timedelta(days=1);self.enviar.return_value=True
        self.assertEqual(self.varrer(),1);self.assertEqual(self.varrer(),0)
        self.assertEqual(self.enviar.call_count,2)

    def test_grupo_usa_uma_cota_mesmo_formato_e_revoga_so_membro_encerrado(self):
        self.regra();t=self.segunda_tarefa()
        self.client.put('/avisos-gerais/preferencias',json={'limite_diario':1,'agrupar':True})
        self.agora+=timedelta(hours=1)
        self.assertEqual(self.varrer(),2);self.enviar.assert_called_once()
        self.assertIn('fio dental',self.enviar.call_args.args[1]);self.assertIn('Comprar pão',self.enviar.call_args.args[1])
        ref=self.enviar.call_args.kwargs['referencia'];self.assertTrue(ref.startswith('lote:'))
        self.assertEqual(self.client.get('/avisos-gerais/preferencias').json()['usados_hoje'],1)
        self.t.status='CONCLUIDA';self.db.commit()
        valido=m.validar_pendente(self.db,self.u.id,ref)
        self.assertTrue(valido['valido']);self.assertNotIn('fio dental',valido['texto']);self.assertIn('Comprar pão',valido['texto'])
        self.assertFalse(m.validar_pendente(self.db,self.outro.id,ref)['valido'])
        t.status='CONCLUIDA';self.db.commit();self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])

    def test_limite_devolve_reservas_nao_enviadas_e_formatos_nao_misturam(self):
        self.regra(formato='audio');self.segunda_tarefa(formato='texto')
        self.client.put('/avisos-gerais/preferencias',json={'limite_diario':1,'agrupar':True})
        self.agora+=timedelta(hours=1);self.assertEqual(self.varrer(),1)
        self.assertEqual(self.db.query(TentativaAvisoGeral).count(),1)
        self.client.put('/avisos-gerais/preferencias',json={'limite_diario':2,'agrupar':True})
        self.assertEqual(self.varrer(),1)
        self.assertEqual({c.kwargs['formato'] for c in self.enviar.call_args_list},{'audio','texto'})
        self.assertEqual(self.db.query(TentativaAvisoGeral).count(),2)

    def test_preferencias_isoladas_e_limites_validados(self):
        self.client.put('/avisos-gerais/preferencias',json={'limite_diario':7,'agrupar':True})
        for v in (-1,101):
            self.assertEqual(self.client.put('/avisos-gerais/preferencias',json={'limite_diario':v}).status_code,422)
        self.u=self.outro
        p=self.client.get('/avisos-gerais/preferencias').json()
        self.assertEqual(p['limite_diario'],0);self.assertFalse(p['agrupar'])

    def test_cota_atomica_duas_entregas_concorrentes(self):
        from concurrent.futures import ThreadPoolExecutor
        primeiro=self.regra();self.segunda_tarefa()
        self.client.put('/avisos-gerais/preferencias',json={'limite_diario':1,'agrupar':False})
        self.agora+=timedelta(hours=1)
        ids=[rid for (rid,) in self.db.query(RegraAvisoGeral.id).all()]
        reservas=[m._processar(self.engine,rid,self.agora,reservar=True) for rid in ids]
        with ThreadPoolExecutor(max_workers=2) as executor:
            resultados=list(executor.map(lambda item:m._entregar(self.engine,[item],self.agora),reservas))
        self.assertEqual(sorted(resultados),[0,1]);self.enviar.assert_called_once()
        self.assertEqual(self.client.get('/avisos-gerais/preferencias').json()['usados_hoje'],1)

    def test_agrupamento_respeita_tamanho_e_prazo_mais_curto(self):
        self.regra();self.segunda_tarefa()
        self.client.put('/avisos-gerais/preferencias',json={'agrupar':True})
        self.agora+=timedelta(hours=1)
        self.assertEqual(self.varrer(),2)
        self.assertLess(len(self.enviar.call_args.kwargs['falado']),900)
        ref=self.enviar.call_args.kwargs['referencia']
        self.agora+=timedelta(hours=1)
        self.assertFalse(m.validar_pendente(self.db,self.u.id,ref)['valido'])


if __name__=='__main__':unittest.main()
