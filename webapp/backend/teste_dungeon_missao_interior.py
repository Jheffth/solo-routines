"""Criação dentro da dungeon: banco isolado, sem servidor ou mensagens."""
import unittest
from datetime import timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException
from database import Base, Usuario, Dungeon, DungeonSessao, DungeonMissao, DungeonMissaoExecucao
from routers import dungeons as d


class MissaoInteriorTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.u = Usuario(login='interior-test', nome='Teste', senha_hash='nao-utilizado')
        self.db.add(self.u)
        self.db.flush()
        self.dg = Dungeon(usuario_id=self.u.id, titulo='Teste', sempre_aberta=True)
        self.db.add(self.dg)
        self.db.flush()
        self.s = DungeonSessao(dungeon_id=self.dg.id, usuario_id=self.u.id,
                              data=d.tempo.hoje(), status='ATIVA', entrada_em=d._agora(),
                              xp_ganho=50, tempo_total_min=12)
        self.db.add(self.s)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def criar(self, titulo='Nova missão'):
        return d.criar_missao_interior(self.dg.id, d.MissaoInteriorCreate(
            sessao_id=self.s.id, titulo=titulo), self.db, self.u)

    def test_cria_missao_e_execucao_sem_reiniciar_sessao(self):
        r = self.criar()
        self.assertEqual(r['execucao']['status'], 'PENDENTE')
        self.assertEqual(self.db.query(DungeonMissao).count(), 1)
        self.assertEqual(self.db.query(DungeonMissaoExecucao).count(), 1)
        self.assertEqual(self.s.xp_ganho, 50)
        self.assertEqual(self.s.tempo_total_min, 12)

    def test_todas_naturezas_preservam_configuracao_e_ciclo(self):
        for nat in d._NATUREZAS_ARMADAS + d._NATUREZAS_BONUS + ("FLAVOR",):
            with self.subTest(natureza=nat):
                payload = d.MissaoInteriorCreate(sessao_id=self.s.id, titulo=nat,
                    natureza=nat, xp_recompensa=75, moedas_recompensa=8, penalidade_xp=12,
                    meta_alvo=42.5, meta_unidade="km", meta_especie="PICO", meta_modo="SUBIR",
                    alvo_repeticoes=7, meta_minutos=90, intervalo_min=25,
                    janela_disparo_min=10, janela_disparo_max=20, expira_em_min=4,
                    hora_inicio="09:00", hora_limite="18:00",
                    circuito_payload={"etapas": [{"id": "b1", "titulo": "Bloco", "modo": "CHECK"}]})
                r = d.criar_missao_interior(self.dg.id, payload, self.db, self.u)
                m = self.db.get(DungeonMissao, r['missao']['id'])
                self.assertEqual(m.natureza, nat)
                self.assertEqual(m.xp_recompensa, 0 if nat == "FLAVOR" else 75)
                self.assertEqual(m.moedas_recompensa, 0 if nat == "FLAVOR" else 8)
                if nat in d._NATUREZAS_ARMADAS:
                    self.assertEqual(r['execucao']['status'], "EM_PROGRESSO" if nat == "RESISTENCIA" else "PENDENTE")
                else:
                    self.assertIsNone(r['execucao'])
                if nat == "CIRCUITO": self.assertIn('Bloco', m.circuito_payload)
                if nat == "META":
                    self.assertEqual(m.meta_alvo, 42.5)
                    self.assertEqual(m.meta_especie, "PICO")
                if nat == "REPETICAO": self.assertEqual(m.alvo_repeticoes, 7)
                if nat == "AGENDADA": self.assertEqual(m.hora_limite, "18:00")
                if nat == "RESISTENCIA": self.assertEqual(m.meta_minutos, 90)
                if nat == "BEM_ESTAR": self.assertEqual(m.intervalo_min, 25)
                if nat == "EVENTO_ALEATORIO": self.assertEqual(m.janela_disparo_max, 20)
        self.assertEqual(self.s.xp_ganho, 50)
        self.assertEqual(self.s.tempo_total_min, 12)

    def test_dia_diferente_salva_sem_armar(self):
        r = d.criar_missao_interior(self.dg.id, d.MissaoInteriorCreate(
            sessao_id=self.s.id, titulo="Outro dia", dias_semana=[(d.tempo.hoje().weekday()+1)%7]), self.db, self.u)
        self.assertIsNone(r['execucao'])
        self.assertEqual(self.db.query(DungeonMissao).count(), 1)

    def test_recusa_natureza_invalida(self):
        with self.assertRaises(HTTPException):
            d.criar_missao_interior(self.dg.id, d.MissaoInteriorCreate(
                sessao_id=self.s.id, titulo="Inválida", natureza="INVENTADA"), self.db, self.u)
        self.assertEqual(self.db.query(DungeonMissao).count(), 0)

    def test_recusa_sessao_encerrada(self):
        self.s.status = 'CONCLUIDA'
        self.db.commit()
        with self.assertRaises(HTTPException) as e:
            self.criar()
        self.assertEqual(e.exception.status_code, 409)
        self.assertEqual(self.db.query(DungeonMissao).count(), 0)

    def test_recusa_teste_sem_permissao_e_titulo_vazio(self):
        with self.assertRaises(HTTPException):
            self.criar('   ')
        self.s.modo_teste = True
        self.db.commit()
        with self.assertRaises(HTTPException):
            self.criar()

    def test_arquiteto_adiciona_em_teste_fora_do_horario(self):
        self.u.nivel_acesso = 'Arquiteto'
        self.s.modo_teste = True
        self.dg.duracao_max_min = 1
        self.s.entrada_em = d._agora() - timedelta(minutes=2)
        self.db.commit()
        xp_antes = self.u.xp_total
        r = self.criar()
        self.assertEqual(r['execucao']['status'], 'PENDENTE')
        self.assertTrue(self.s.modo_teste)
        self.assertEqual(self.u.xp_total, xp_antes)
        self.assertEqual(self.s.xp_ganho, 50)

    def test_recusa_outro_dono(self):
        outro = Usuario(id=999, login='outro')
        with self.assertRaises(HTTPException) as e:
            d.criar_missao_interior(self.dg.id, d.MissaoInteriorCreate(
                sessao_id=self.s.id, titulo='Intrusa'), self.db, outro)
        self.assertEqual(e.exception.status_code, 404)

    def test_recusa_prazo_vencido(self):
        self.dg.duracao_max_min = 1
        self.s.entrada_em = d._agora() - timedelta(minutes=2)
        self.db.commit()
        with self.assertRaises(HTTPException) as e:
            self.criar()
        self.assertEqual(e.exception.status_code, 409)

    def test_recusa_sessao_de_outro_dia(self):
        self.s.data = d.tempo.hoje() - timedelta(days=1)
        self.db.commit()
        with self.assertRaises(HTTPException):
            self.criar()


if __name__ == '__main__':
    unittest.main()
