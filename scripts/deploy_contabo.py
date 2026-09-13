"""
DEPLOY NO CONTABO — reconstrói a imagem e sobe o contêiner.

A SENHA ROOT SAIU DAQUI. Ela estava escrita em texto puro na linha 8, e este
arquivo é versionado desde o commit 8b1f269 — ou seja, ela está no HISTÓRICO
do git, não só no arquivo. Tirá-la daqui é metade do trabalho:

    A SENHA CONTINUA COMPROMETIDA ATÉ SER TROCADA NO SERVIDOR.

Qualquer pessoa com uma cópia do repositório, de qualquer commit desde
8b1f269, tem acesso root à máquina. Trocar a senha no painel do Contabo é a
outra metade, e é a que importa.

Melhor ainda: troque a senha E desligue o login por senha, passando a usar
chave SSH (`ssh-copy-id`, depois `PasswordAuthentication no` no sshd). Com
chave, este script não precisa de segredo nenhum — o `paramiko` acha a chave
sozinho no ~/.ssh e o argumento `password` deixa de existir.

Como este script pega a credencial agora, em ordem:
  1. chave SSH do agente / ~/.ssh (o caminho recomendado; nada a digitar)
  2. variável de ambiente SOLO_DEPLOY_SENHA
  3. pergunta no terminal, sem ecoar

Nenhuma delas grava a senha em arquivo.
"""
import getpass
import os
import sys

import paramiko

HOST = os.getenv("SOLO_DEPLOY_HOST", "169.58.116.61")
USER = os.getenv("SOLO_DEPLOY_USER", "root")
DIR_REMOTO = "/root/app/webapp"


def _conectar() -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    # 1. Chave SSH. O jeito certo: sem segredo em lugar nenhum.
    try:
        ssh.connect(HOST, username=USER, timeout=10, look_for_keys=True)
        print("[SSH] Conectado por chave.")
        return ssh
    except Exception:
        pass

    # 2/3. Senha, só se não houver chave. Nunca lida de arquivo do projeto.
    senha = os.getenv("SOLO_DEPLOY_SENHA", "")
    if not senha:
        print(f"[SSH] Sem chave para {USER}@{HOST}.")
        print("[SSH] (Configure uma chave SSH e este passo desaparece.)")
        senha = getpass.getpass(f"Senha de {USER}@{HOST}: ")
    if not senha:
        print("[SSH] Sem credencial. Abortado.")
        sys.exit(1)

    ssh.connect(HOST, username=USER, password=senha, timeout=10)
    print("[SSH] Conectado por senha.")
    return ssh


def deploy() -> int:
    print(f"[DEPLOY] Servidor Contabo ({HOST})...")

    try:
        ssh = _conectar()
    except Exception as e:
        print(f"[DEPLOY] Erro ao conectar: {e}")
        return 1

    # O /root/app/ do Contabo NÃO é um repositório git — está documentado em
    # SOLO_DEPLOY_CONFIG.md. Um `git pull` aqui não faz nada; os arquivos
    # chegam por SFTP antes deste passo. É também por isso que o endpoint de
    # versão não consegue descobrir o commit sozinho e depende do
    # `backend/build_info.json` gravado por scripts/selar_build.py.
    print("[DEPLOY] Aviso: o servidor nao usa git pull.")
    print("[DEPLOY] Envie os arquivos por SFTP/SCP antes de rodar isto.")
    print("[DEPLOY] E rode `python scripts/selar_build.py` antes de enviar,")
    print("[DEPLOY] senao o rodape sobe marcado como 'sem selo'.")

    cmd = f"cd {DIR_REMOTO} && docker compose build api && docker compose up -d"
    print(f"[DEPLOY] Executando: {cmd}")

    stdin, stdout, stderr = ssh.exec_command(cmd)
    status = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")

    if out:
        print(out)
    if err:
        print("ERRO: " + err)

    if status != 0 and "SECRET_KEY" in (out + err):
        print()
        print("[DEPLOY] Parece faltar o arquivo .env no servidor.")
        print(f"[DEPLOY] Crie {DIR_REMOTO}/.env usando webapp/.env.example")
        print("[DEPLOY] como molde e rode de novo.")

    print(f"[DEPLOY] Finalizado com status {status}")
    ssh.close()
    return status


if __name__ == "__main__":
    sys.exit(deploy())
