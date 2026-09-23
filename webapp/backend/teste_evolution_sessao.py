"""Regressão do logout recusado porque a sessão já estava desconectada.

Uso: python -m unittest teste_evolution_sessao.py (na pasta backend).
Não acessa a rede, credenciais ou banco.
"""
import unittest
from unittest.mock import patch

from motors import evolution


class EncerrarSessaoTest(unittest.TestCase):
    def test_logout_sucesso(self):
        for status in (200, 201, 204):
            with self.subTest(status=status), patch.object(
                evolution, "_req", return_value={"status": status}
            ) as req:
                self.assertTrue(evolution.desconectar())
                self.assertEqual(req.call_count, 1)

    def test_sessao_ja_encerrada(self):
        for estado in ("close", "closed", "refused"):
            for dados in ({"state": estado}, {"instance": {"state": estado}}):
                with self.subTest(dados=dados), patch.object(
                    evolution, "_req", side_effect=[
                        {"status": 400, "erro": "instance is not connected"},
                        {"status": 200, "dados": dados},
                    ]
                ) as req:
                    self.assertTrue(evolution.desconectar())
                    self.assertEqual(req.call_args.args[0], "GET")
                    self.assertIn("/instance/connectionState/", req.call_args.args[1])

    def test_instancia_ausente(self):
        with patch.object(evolution, "_req", side_effect=[
            {"status": 404}, {"status": 404},
        ]):
            self.assertTrue(evolution.desconectar())

    def test_logout_falhou_com_sessao_ainda_ativa_ou_estado_desconhecido(self):
        for dados in ({"state": "open"}, {"state": "connecting"}, {}):
            with self.subTest(dados=dados), patch.object(
                evolution, "_req", side_effect=[
                    {"status": 400}, {"status": 200, "dados": dados},
                ]
            ):
                self.assertFalse(evolution.desconectar())

    def test_consulta_falhou_nao_significa_sessao_encerrada(self):
        for status in (0, 401, 403, 500):
            with self.subTest(status=status), patch.object(
                evolution, "_req", side_effect=[
                    {"status": 400}, {"status": status},
                ]
            ):
                self.assertFalse(evolution.desconectar())

    def test_falhas_reais_no_logout_continuam_falhas(self):
        for status in (0, 401, 403, 500):
            with self.subTest(status=status), patch.object(
                evolution, "_req", return_value={"status": status}
            ) as req:
                self.assertFalse(evolution.desconectar())
                self.assertEqual(req.call_count, 1)


if __name__ == "__main__":
    unittest.main()
