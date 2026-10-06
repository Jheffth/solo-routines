"""Criação de rotina diária por comando ou frase, sem descartar campos informados."""
import re
import unicodedata


def normalizar(texto):
    return ''.join(c for c in unicodedata.normalize('NFKD', texto)
                   if not unicodedata.combining(c)).lower()


def eh_pedido(texto):
    t = normalizar(texto)
    return bool(re.match(r'^(?:crie|criar|cadastre|cadastrar|adicione|adicionar)\b', t)
                and re.search(r'\brotina\b|\bdiaria\b|\btodos os dias\b', t))


def validar(dados):
    for campo, permitidos in [('prioridade', {'CRITICA', 'ALTA', 'MEDIA', 'BAIXA'}),
                              ('dificuldade', {'FACIL', 'NORMAL', 'DIFICIL', 'LENDARIO'})]:
        dados[campo] = normalizar(dados[campo]).upper()
        if dados[campo] not in permitidos:
            raise ValueError(f"{campo.capitalize()} inválida. Opções: " + ', '.join(sorted(permitidos)))
    titulo = dados['titulo'].strip(' .,;:')
    if not titulo or len(titulo) > 200:
        raise ValueError('Informe um título de até 200 caracteres.')
    dados['titulo'] = titulo
    for campo in ('hora_inicio', 'hora_fim'):
        horario = dados.get(campo)
        if horario:
            if not re.fullmatch(r'(?:[01]?\d|2[0-3]):[0-5]\d', horario):
                raise ValueError('Horário inválido. Use HH:MM, por exemplo 05:30 às 05:45.')
            dados[campo] = horario.zfill(5)
    if bool(dados.get('hora_inicio')) != bool(dados.get('hora_fim')):
        raise ValueError('Informe início e fim da janela de horário.')
    if dados.get('hora_inicio') and dados['hora_inicio'] == dados['hora_fim']:
        raise ValueError('Início e fim precisam ser diferentes.')
    return dados


def interpretar(texto):
    dados = dict(tipo='DIARIA', prioridade='MEDIA', dificuldade='NORMAL', descricao=None,
                 hora_inicio=None, hora_fim=None)
    if texto.split(' ', 1)[0].lower() == '/criarrotina':
        corpo = texto[len('/criarrotina'):].strip()
        if '|' in corpo:
            partes = [p.strip() for p in corpo.split('|')]
            if len(partes) != 6:
                raise ValueError('Use /criarrotina título | prioridade | dificuldade | início | fim | descrição.')
            dados.update(zip(('titulo','prioridade','dificuldade','hora_inicio','hora_fim','descricao'), partes))
            return validar(dados)
        # Também permite todos os detalhes em linguagem natural após o comando.
        texto = corpo if eh_pedido(corpo) else 'Crie uma rotina diária. ' + corpo
    if not eh_pedido(texto):
        return None
    corpo = re.sub(r'^(?:crie|criar|cadastre|cadastrar|adicione|adicionar)\s+'
                   r'(?:(?:uma|um|nova|novo)\s+)*(?:rotina|miss[aã]o)\s*'
                   r'(?:di[aá]ria)?[ .,:-]*', '', texto, flags=re.I)
    if corpo == texto:
        raise ValueError('Diga: crie uma rotina diária, seguida do título e dos detalhes.')
    if re.search(r'\brotina\s+(?:semanal|mensal|anual)\b|\bdias da semana\b', normalizar(texto.split('descrição:')[0])):
        raise ValueError('Este comando cria rotinas diárias. Para outra recorrência, use a tela de Rotinas.')
    # A descrição é um campo próprio; palavras nela não alteram prioridade ou horário.
    descricao = re.search(r'\bdescri[çc][aã]o\s*[:,]\s*(.*)', corpo, flags=re.I | re.S)
    cabecalho = corpo[:descricao.start()] if descricao else corpo
    if descricao:
        dados['descricao'] = re.sub(r'[ .;,]*\btodos os dias[ .;,]*$', '', descricao[1], flags=re.I).strip(' .;,')
    marcas = list(re.finditer(r'\b(prioridade|dificuldade|janela(?: de hor[aá]rio)?|hor[aá]rio|tipo|todos os dias)\b', cabecalho, re.I))
    dados['titulo'] = cabecalho[:marcas[0].start()] if marcas else cabecalho
    for i, marca in enumerate(marcas):
        valor = cabecalho[marca.end():marcas[i+1].start() if i+1 < len(marcas) else len(cabecalho)].strip(' .,:;')
        nome = normalizar(marca[1])
        if nome in ('prioridade', 'dificuldade'):
            dados[nome] = valor
        elif nome == 'tipo' and normalizar(valor) not in ('diaria', 'diario'):
            raise ValueError('Este comando cria uma rotina diária.')
        elif nome.startswith('janela') or nome == 'horario':
            horas = re.fullmatch(r'(\d{1,2}:\d{2})\s*(?:[aàá]s?|ate|até|[-–])\s*(\d{1,2}:\d{2})', valor, re.I)
            if not horas:
                raise ValueError('Informe a janela como 05:30 às 05:45.')
            dados['hora_inicio'], dados['hora_fim'] = horas.groups()
    return validar(dados)
