"""Criação de rotina diária por comando ou frase, sem descartar campos informados."""
import re
import math
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


NUMERO = r'-?\d+(?:[.,]\d+)*'
UNIDADES = r'reais|real|r\$|km|quilometros?|kg|quilos?|paginas?|passos?|minutos?|min|ml|litros?|unidades?|un'


def _numero(valor):
    valor = valor.strip()
    if re.fullmatch(r'\d{1,3}(?:\.\d{3})+(?:,\d+)?', valor):
        valor = valor.replace('.', '')
    elif '.' in valor and ',' in valor:
        raise ValueError('Informe um único alvo numérico válido para a meta.')
    try:
        numero = float(valor.replace(',', '.'))
    except ValueError:
        raise ValueError('Informe um único alvo numérico válido para a meta.') from None
    if not math.isfinite(numero) or numero <= 0:
        raise ValueError('O alvo da meta precisa ser um número positivo.')
    return numero


def _configurar_meta(dados, texto=None):
    if dados.get('natureza') != 'META':
        return
    if texto is not None:
        t = normalizar(texto)
        valores = list(re.finditer(r'r\$\s*(' + NUMERO + r')|(' + NUMERO + r')\s*(' + UNIDADES + r')(?!\w)', t))
        if len(valores) != 1:
            raise ValueError('Informe um único alvo e sua unidade para a META, por exemplo: conseguir 66,67 reais.')
        valor = valores[0]
        dados['meta_alvo'] = valor[1] or valor[2]
        dados['meta_unidade'] = 'R$' if valor[1] else valor[3]
    dados['meta_alvo'] = _numero(str(dados['meta_alvo']))
    unidade = normalizar(dados.get('meta_unidade') or '').strip()
    if not unidade:
        raise ValueError('Informe a unidade da meta, por exemplo R$, km ou páginas.')
    if unidade in {'r$', 'real', 'reais'}:
        especie, unidade = 'VALOR', 'R$'
    elif unidade in {'km', 'quilometro', 'quilometros'}:
        especie, unidade = 'DISTANCIA', 'km'
    elif unidade in {'kg', 'quilo', 'quilos'}:
        especie, unidade = 'PESO', 'kg'
    elif unidade in {'min', 'minuto', 'minutos'}:
        especie, unidade = 'TEMPO', 'min'
    elif unidade in {'pagina', 'paginas', 'passo', 'passos', 'un', 'unidade', 'unidades'}:
        especie = 'CONTAGEM'
    else:
        especie = 'LIVRE'
    dados.update(meta_especie=especie, meta_unidade=unidade)


def interpretar(texto):
    dados = dict(tipo='DIARIA', prioridade='MEDIA', dificuldade='NORMAL', descricao=None,
                 hora_inicio=None, hora_fim=None)
    if texto.split(' ', 1)[0].lower() == '/criarrotina':
        corpo = texto[len('/criarrotina'):].strip()
        if '|' in corpo:
            partes = [p.strip() for p in corpo.split('|')]
            if len(partes) not in (6, 9):
                raise ValueError('Use /criarrotina título | prioridade | dificuldade | início | fim | descrição; para META acrescente | META | alvo | unidade.')
            dados.update(zip(('titulo','prioridade','dificuldade','hora_inicio','hora_fim','descricao'), partes[:6]))
            if len(partes) == 9:
                if normalizar(partes[6]) != 'meta':
                    raise ValueError('Os três campos extras são: META | alvo | unidade.')
                dados.update(natureza='META', meta_alvo=partes[7], meta_unidade=partes[8])
            # Declaração de META no título também funciona no formato anterior.
            elif re.search(r'\b(?:rotina|miss[aã]o)\s+(?:de\s+)?metas?\b|^metas?\b', dados['titulo'], re.I):
                dados['natureza'] = 'META'
                _configurar_meta(dados, dados['titulo'])
            if len(partes) == 9:
                _configurar_meta(dados)
            return validar(dados)
        texto = corpo if eh_pedido(corpo) else 'Crie uma rotina diária. ' + corpo
    if not eh_pedido(texto):
        return None
    corpo = re.sub(r'^(?:crie|criar|cadastre|cadastrar|adicione|adicionar)\s+'
                   r'(?:(?:uma|um|nova|novo)\s+)*(?:rotina|miss[aã]o)\s*'
                   r'(?:di[aá]ria)?[ .,:-]*', '', texto, flags=re.I)
    if corpo == texto:
        raise ValueError('Diga: crie uma rotina diária, seguida do título e dos detalhes.')
    descricao = re.search(r'\bdescri[çc][aã]o\s*[:,]\s*(.*)', corpo, flags=re.I | re.S)
    cabecalho = corpo[:descricao.start()] if descricao else corpo
    if descricao:
        dados['descricao'] = re.sub(r'[ .;,]*\btodos os dias[ .;,]*$', '', descricao[1], flags=re.I).strip(' .;,')
    if re.search(r'\brotina\s+(?:semanal|mensal|anual)\b|\bdias da semana\b', normalizar(texto[:texto.find(descricao[0])] if descricao else texto)):
        raise ValueError('Este comando cria rotinas diárias. Para outra recorrência, use a tela de Rotinas.')
    declaracao = r'\b(?:rotina|miss[aã]o)\s+(?:de\s+)?metas?\b|^(?:de\s+)?metas?\b|\b(?:tipo|natureza)\s*[:,=]?\s*metas?\b'
    if re.search(declaracao, cabecalho, re.I):
        dados['natureza'] = 'META'
        cabecalho = re.sub(declaracao, ' ', cabecalho, flags=re.I)
    # Extrai os detalhes onde foram ditos; a descrição não interfere nos campos.
    for nome, padrao in [('prioridade', r'\bprioridade\s*[:,=]?\s*([^\s,.;]+)'),
                         ('dificuldade', r'\b(?:dificuldade|n[ií]vel)\s*[:,=]?\s*([^\s,.;]+)')]:
        marca = re.search(padrao, cabecalho, re.I)
        if marca:
            dados[nome] = marca[1]
            cabecalho = cabecalho[:marca.start()] + ' ' + cabecalho[marca.end():]
    prioridade = re.match(r'^\s*(cr[ií]tica|alta|m[eé]dia|baixa)\b', cabecalho, re.I)
    if prioridade:
        dados['prioridade'] = prioridade[1]
        cabecalho = cabecalho[prioridade.end():]
    janela = re.search(r'\b(?:janela(?: de hor[aá]rio)?|hor[aá]rio|dura[çc][aã]o)\s*[:,=]?\s*(?:das\s+)?'
                      r'(\d{1,2}:\d{2})\s*(?:[aàá]s?|ate|até|[-–])\s*(\d{1,2}:\d{2})', cabecalho, re.I)
    if janela:
        dados['hora_inicio'], dados['hora_fim'] = janela.groups()
        cabecalho = cabecalho[:janela.start()] + ' ' + cabecalho[janela.end():]
    elif re.search(r'\b(?:janela|hor[aá]rio|dura[çc][aã]o)\b', cabecalho, re.I):
        raise ValueError('Informe a janela como 05:30 às 05:45.')
    tipo = re.search(r'\btipo\s*[:,=]?\s*(\w+)', cabecalho, re.I)
    if tipo:
        if normalizar(tipo[1]) not in ('diaria', 'diario'):
            raise ValueError('Este comando cria uma rotina diária.')
        cabecalho = cabecalho[:tipo.start()] + ' ' + cabecalho[tipo.end():]
    cabecalho = re.sub(r'\btodos os dias\b', ' ', cabecalho, flags=re.I)
    dados['titulo'] = re.sub(r'\s+', ' ', cabecalho).strip(' .,:;')
    _configurar_meta(dados, cabecalho)
    return validar(dados)
