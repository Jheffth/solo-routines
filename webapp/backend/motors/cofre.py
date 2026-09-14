# -*- coding: utf-8 -*-
"""
O COFRE — cifra simétrica para segredos de terceiros guardados no banco.

POR QUE UM COFRE, E NÃO SIMPLESMENTE GUARDAR O TOKEN

Um refresh token do Google é acesso CONTÍNUO à conta de outra pessoa.
Quem o tem escreve e apaga eventos na agenda do hunter sem pedir licença,
e continua podendo amanhã. Não é senha — é pior: senha o dono troca e
revoga; um refresh token esquecido num dump de banco segue valendo até
alguém notar.

Este projeto já sabe como isso termina. A senha root do Contabo ficou
versionada em `scripts/deploy_contabo.py` desde o commit `8b1f269`, e o
conserto não foi apagar a linha — foi ter de ROTACIONAR a senha, porque
tirar do arquivo não tira do histórico. Guardar o token em claro seria
aceitar a mesma dívida de novo, sabendo o preço.

O QUE ISTO NÃO RESOLVE, PARA NÃO CRIAR ILUSÃO

Cifra em repouso protege contra o banco vazar — backup perdido, dump
copiado, SELECT de alguém que só devia ler. NÃO protege contra o servidor
inteiro ser comprometido: quem tem o processo tem a chave. É uma camada,
não uma muralha, e vale exatamente por isso.

A CHAVE MORA FORA DO CÓDIGO, em `CALENDARIO_CHAVE`. Sem ela, o cofre se
recusa a cifrar — e essa recusa é deliberada: um cofre que aceita chave
padrão é um cadeado com a chave pendurada.

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

O `cryptography` já está instalado: vem com `python-jose[cryptography]`,
que o `requirements.txt` fixa em 3.3.0. Não há dependência nova.

SE A CHAVE MUDAR, todo segredo guardado vira ilegível. `abrir()` devolve
None nesse caso em vez de explodir — e a consequência correta é o hunter
ver "reconecte sua agenda", não o servidor cair. Perder acesso à agenda é
recuperável com um clique; derrubar o app não.
"""
from __future__ import annotations

import os


class CofreIndisponivel(RuntimeError):
    """Não há chave configurada — guardar segredo agora seria guardá-lo em claro."""


def _chave() -> bytes | None:
    v = (os.getenv("CALENDARIO_CHAVE", "") or "").strip()
    return v.encode() if v else None


def disponivel() -> bool:
    """Dá para cifrar? A tela de conexão pergunta isto ANTES de mandar o
    hunter ao Google — melhor recusar na porta do que receber o token e
    descobrir que não há onde guardá-lo."""
    if not _chave():
        return False
    try:
        from cryptography.fernet import Fernet
        Fernet(_chave())
        return True
    except Exception:
        return False


def guardar(segredo: str | None) -> str | None:
    """Texto em claro → texto cifrado. Sem chave, RECUSA."""
    if segredo is None or segredo == "":
        return None
    ch = _chave()
    if not ch:
        raise CofreIndisponivel(
            "CALENDARIO_CHAVE nao configurada. Gere uma com "
            "`python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"` e coloque no .env."
        )
    from cryptography.fernet import Fernet
    return Fernet(ch).encrypt(str(segredo).encode()).decode()


def abrir(cifrado: str | None) -> str | None:
    """
    Texto cifrado → texto em claro. Devolve None quando não dá.

    NÃO LEVANTA EXCEÇÃO de propósito. Chave trocada, valor corrompido ou
    coluna vazia têm o mesmo desfecho útil: o app trata como "sem token" e
    pede reconexão. Explodir aqui derrubaria uma tela inteira por causa de
    uma integração opcional.
    """
    if not cifrado:
        return None
    ch = _chave()
    if not ch:
        return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(ch).decrypt(str(cifrado).encode()).decode()
    except Exception:
        return None
