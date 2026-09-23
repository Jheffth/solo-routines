import unittest
from unittest.mock import patch
from datetime import timedelta
import teste_dungeon_missao_interior as base
from routers import dungeons as d
from database import DungeonMissaoExecucao

class AgendaTest(base.MissaoInteriorTest):
    def test_bem_estar_contagem_ocorrencias_e_streak(self):
        agora = d._agora()
        self.s.entrada_em = agora
        self.s.ultimo_heartbeat_em = agora
        self.s.modo_teste = True
        self.u.nivel_acesso = 'Arquiteto'
        self.db.commit()
        r = d.criar_missao_interior(self.dg.id, d.MissaoInteriorCreate(
            sessao_id=self.s.id, titulo='Agua', natureza='BEM_ESTAR', intervalo_min=5,
            expira_em_min=1), self.db, self.u)
        mid = r['missao']['id']
        self.assertEqual(r['sessao']['agenda'][0]['proxima_em'], (agora+timedelta(minutes=5)).isoformat())
        xp = self.u.xp_total
        with patch.object(d, '_agora', return_value=agora+timedelta(minutes=5)):
            r = d.heartbeat(self.dg.id, True, self.db, self.u)
            self.assertEqual(len(r['novos_eventos']), 1)
            eid = r['novos_eventos'][0]['id']
            d.cumprir_missao(eid, self.db, self.u)
            self.assertEqual(d._exec_to_dict(self.db.get(DungeonMissaoExecucao,eid))['streak'],1)
            self.assertEqual(len(d.heartbeat(self.dg.id,True,self.db,self.u)['novos_eventos']),0)
        with patch.object(d, '_agora', return_value=agora+timedelta(minutes=10)):
            r = d.heartbeat(self.dg.id, True, self.db, self.u)
            segundo = r['novos_eventos'][0]['id']
        with patch.object(d, '_agora', return_value=agora+timedelta(minutes=12)):
            r = d.heartbeat(self.dg.id, True, self.db, self.u)
            self.assertEqual(self.db.get(DungeonMissaoExecucao,segundo).status,'EXPIRADA')
            self.assertEqual(d._exec_to_dict(self.db.get(DungeonMissaoExecucao,segundo))['streak'],0)
            with self.assertRaises(Exception): d.cumprir_missao(segundo,self.db,self.u)
        self.db.expire_all()
        self.assertEqual(self.db.query(DungeonMissaoExecucao).filter_by(dungeon_missao_id=mid).count(),2)
        self.assertEqual(self.u.xp_total,xp)

    def test_agendada_nao_inicia_antes_ou_depois(self):
        hoje = d._agora().replace(hour=12,minute=0,second=0,microsecond=0)
        r=d.criar_missao_interior(self.dg.id,d.MissaoInteriorCreate(sessao_id=self.s.id,
            titulo='Horario',natureza='AGENDADA',hora_inicio='13:00',hora_limite='14:00'),self.db,self.u)
        eid=r['execucao']['id']
        with patch.object(d,'_agora',return_value=hoje):
            with self.assertRaises(Exception): d.iniciar_missao_exec(eid,self.db,self.u)
        with patch.object(d,'_agora',return_value=hoje+timedelta(hours=3)):
            with self.assertRaises(Exception): d.iniciar_missao_exec(eid,self.db,self.u)
        with patch.object(d,'_agora',return_value=hoje+timedelta(hours=1)):
            self.assertEqual(d.iniciar_missao_exec(eid,self.db,self.u)['execucao']['status'],'EM_PROGRESSO')

if __name__=='__main__': unittest.main()
