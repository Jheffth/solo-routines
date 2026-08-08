# -*- coding: utf-8 -*-
"""
Deploy completo para o servidor Contabo.
1. Envia os arquivos modificados via SFTP
2. Faz docker compose up --build no servidor

Uso: python scripts/deploy_full.py
"""
import os
import sys
import paramiko
import posixpath

HOST     = '169.58.116.61'
USER     = 'root'
PASSWORD = '1601Jcs332503'
REMOTE_BASE = '/root/app'
LOCAL_BASE  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # raiz do projeto

# Arquivos a enviar (relativos à raiz do projeto)
ARQUIVOS = [
    # Backend — Python
    'webapp/backend/database.py',
    'webapp/backend/motors/migracao.py',
    'webapp/backend/motors/especiais.py',
    'webapp/backend/motors/fechamento.py',
    'webapp/backend/routers/execucoes.py',
    'webapp/backend/routers/rotinas.py',
    'webapp/backend/routers/recompensas.py',
    'webapp/backend/auth/router.py',
    # Frontend — JS
    'webapp/frontend/js/forja-missao.js',
    'webapp/frontend/js/missao-card.js',
    'webapp/frontend/js/pages/loja.js',
    'webapp/frontend/js/pages/progressivas.js',
    'webapp/frontend/js/pages/rotinas.js',
    'webapp/frontend/js/app.js',
    # Frontend — CSS
    'webapp/frontend/css/forja-missao.css',
    'webapp/frontend/css/missao-card.css',
    'webapp/frontend/css/loja.css',
    # HTML
    'webapp/frontend/index.html',
]


def sftp_upload(sftp, local_path, remote_path):
    """Garante que o diretório remoto existe e faz upload do arquivo."""
    remote_dir = posixpath.dirname(remote_path)
    # Cria diretórios recursivamente
    parts = remote_dir.split('/')
    current = ''
    for part in parts:
        if not part:
            current = '/'
            continue
        current = posixpath.join(current, part)
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)

    sftp.put(local_path, remote_path)


def main():
    print(f"\n{'='*60}")
    print(f"  DEPLOY -> Contabo ({HOST})")
    print(f"  {len(ARQUIVOS)} arquivo(s) a enviar")
    print(f"{'='*60}\n")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    except Exception as e:
        print(f"[ERRO] Falha ao conectar: {e}")
        sys.exit(1)

    print("[OK] SSH conectado.\n")

    sftp = ssh.open_sftp()

    erros = []
    for rel_path in ARQUIVOS:
        local  = os.path.join(LOCAL_BASE, rel_path.replace('/', os.sep))
        remote = posixpath.join(REMOTE_BASE, rel_path)

        if not os.path.exists(local):
            print(f"  [SKIP] nao existe localmente: {rel_path}")
            continue

        try:
            sftp_upload(sftp, local, remote)
            print(f"  [OK] {rel_path}")
        except Exception as e:
            print(f"  [ERRO] {rel_path}: {e}")
            erros.append(rel_path)

    sftp.close()

    print(f"\n{'-'*60}")
    if erros:
        print(f"[AVISO] {len(erros)} arquivo(s) falharam: {erros}")
    else:
        print(f"[OK] Todos os {len(ARQUIVOS)} arquivo(s) enviados com sucesso.")

    print("\n[*] Reiniciando container Docker no servidor...")
    cmd = "cd /root/app/webapp && docker compose up -d --build api 2>&1 | tail -20"
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')

    if out:
        print(out)
    if err and exit_status != 0:
        print("STDERR:", err)

    if exit_status == 0:
        print(f"[OK] Container reiniciado com sucesso!")
    else:
        print(f"[ERRO] docker compose saiu com codigo {exit_status}")

    ssh.close()
    print(f"\n{'='*60}")
    print(f"  Deploy finalizado!")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
