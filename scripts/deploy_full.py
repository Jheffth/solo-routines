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
import subprocess

def get_tracked_files():
    try:
        # Pega todos os arquivos rastreados pelo git
        result = subprocess.run(['git', 'ls-files', 'webapp/'], capture_output=True, text=True, check=True)
        files = result.stdout.splitlines()
        # Filtra pastas ou arquivos indesejados se precisar, mas o git ls-files ja e bem limpo
        return [f for f in files if os.path.isfile(os.path.join(LOCAL_BASE, f.replace('/', os.sep)))]
    except Exception as e:
        print(f"[ERRO] Falha ao obter arquivos do git: {e}")
        sys.exit(1)

def conferir_arvore():
    """
    AVISA quando ha mudanca salva mas NAO COMMITADA.

    `git ls-files` lista o que esta VERSIONADO. Um arquivo editado e nao
    commitado sobe com o conteudo do disco (o SFTP le o disco), mas um
    arquivo NOVO e nao commitado nao sobe de jeito nenhum -- e o script
    imprime "enviados com sucesso" do mesmo jeito.

    Foi assim que a correcao das punicoes ficou dias sem chegar a
    producao enquanto todos os testes passavam localmente: deploy que
    diz sucesso e nao leva tudo e pior que deploy que falha, porque
    ninguem vai investigar.
    """
    try:
        sujo = subprocess.run(['git', 'status', '--porcelain'],
                              capture_output=True, text=True).stdout.strip()
        novos = [l[3:] for l in sujo.splitlines()
                 if l.startswith('??') and l[3:].startswith('webapp/')]
        mods = [l[3:] for l in sujo.splitlines()
                if not l.startswith('??') and l[3:].startswith('webapp/')]
        if novos:
            print("\n[AVISO] Arquivos NOVOS e nao commitados em webapp/ NAO SERAO ENVIADOS:")
            for f in novos[:15]:
                print(f"         - {f}")
            print("         Commite antes, ou eles ficam so na sua maquina.\n")
        if mods:
            print(f"[NOTA] {len(mods)} arquivo(s) modificado(s) e nao commitado(s) "
                  f"serao enviados como estao no disco.\n")
    except Exception:
        pass


def commit_atual():
    """O commit que esta subindo — gravado no servidor para conferencia."""
    try:
        h = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'],
                           capture_output=True, text=True).stdout.strip()
        m = subprocess.run(['git', 'log', '-1', '--pretty=%s'],
                           capture_output=True, text=True).stdout.strip()
        return f"{h} {m}"
    except Exception:
        return "desconhecido"


conferir_arvore()
COMMIT = commit_atual()
print(f"[DEPLOY] Enviando commit: {COMMIT}")
ARQUIVOS = get_tracked_files()


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
        # CARIMBO. Sem ele, "o servidor esta com o codigo novo?" so se
        # responde por fe. Com ele, um `cat` no servidor responde.
        try:
            import io as _io
            carimbo = _io.BytesIO(
                f"{COMMIT}\n{len(ARQUIVOS)} arquivos\n".encode("utf-8"))
            sftp.putfo(carimbo, posixpath.join(REMOTE_BASE, "VERSAO_DEPLOY.txt"))
            print(f"[OK] Carimbo gravado: {COMMIT}")
        except Exception as e:
            print(f"[AVISO] nao consegui gravar o carimbo: {e}")
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
