"""
A CONEXÃO COM O CONTABO — um lugar só, sem segredo dentro.

A senha root estava copiada em SEIS arquivos deste repositório. Seis é o
número que interessa: quando um segredo aparece em seis lugares, ninguém
troca a senha, porque trocar significa caçar as seis cópias e alguma sempre
escapa. O segredo duplicado se defende sozinho contra a própria rotação.

Então agora existe UMA porta. Quem precisa do servidor importa daqui.

Ordem das credenciais:
  1. chave SSH (~/.ssh ou o agente) — o caminho certo, nada a digitar
  2. variável de ambiente SOLO_DEPLOY_SENHA
  3. pergunta no terminal, sem eco

Nenhuma lê arquivo do projeto. Se você instalar sua chave pública no
servidor (`ssh-copy-id root@<ip>`) e desligar `PasswordAuthentication`, os
itens 2 e 3 viram letra morta e o repositório passa a não ter como vazar
acesso nem por descuido.
"""
import getpass
import os
import sys

import paramiko

HOST = os.getenv("SOLO_DEPLOY_HOST", "169.58.116.61")
USER = os.getenv("SOLO_DEPLOY_USER", "root")


def conectar(host: str = HOST, user: str = USER, timeout: int = 15) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(host, username=user, timeout=timeout, look_for_keys=True)
        print(f"[SSH] {user}@{host} — conectado por chave.")
        return ssh
    except Exception:
        pass

    senha = os.getenv("SOLO_DEPLOY_SENHA", "")
    if not senha:
        print(f"[SSH] Sem chave para {user}@{host}.")
        print("[SSH] (Instale uma chave SSH e este passo desaparece.)")
        try:
            senha = getpass.getpass(f"Senha de {user}@{host}: ")
        except (EOFError, KeyboardInterrupt):
            senha = ""
    if not senha:
        print("[SSH] Sem credencial. Abortado.")
        sys.exit(1)

    ssh.connect(host, username=user, password=senha, timeout=timeout)
    print(f"[SSH] {user}@{host} — conectado por senha.")
    return ssh
