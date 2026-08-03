import paramiko
import os
import sys

def deploy():
    host = '169.58.116.61'
    user = 'root'
    password = '1601Jcs332503'

    print(f"🔄 Iniciando deploy no servidor Contabo ({host})...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(host, username=user, password=password, timeout=10)
    except Exception as e:
        print(f"❌ Erro ao conectar no servidor: {e}")
        return

    print("✅ Conectado via SSH.")

    # Tenta descobrir os arquivos que mudaram via git status se aplicável,
    # mas para simplificar, vamos rodar comandos remotos:
    # 1. Parar containers
    # 2. Enviar arquivos por sftp se necessario, ou fazer um rsync/sftp automatizado
    # Como o projeto não está como git no servidor, o script via paramiko pode usar SFTP para sincronizar.
    
    print("🚧 Aviso: O servidor atual não usa git pull. Os arquivos devem ser enviados via SFTP ou você deve usar SCP.")
    print("   Se você alterou arquivos, lembre-se de rodar um script SFTP de sync ou copiar as pastas manualmente.")
    print("   Para reiniciar o servidor no Contabo:")
    print("   -> docker compose build api && docker compose up -d (em /root/app/webapp)")
    
    cmd = "cd /root/app/webapp && docker compose build api && docker compose up -d"
    print(f"⚙️ Executando: {cmd}")
    
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    
    if out: print(out)
    if err: print("ERROR: " + err)
    
    print(f"✅ Deploy finalizado com status {exit_status}")
    ssh.close()

if __name__ == '__main__':
    deploy()
