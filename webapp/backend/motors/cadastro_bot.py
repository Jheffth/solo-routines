"""Criação de rotina por comando ou frase, sem descartar campos informados."""
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


def _natureza(dados, texto, remover=True):
    declaracao = (r"\b(?:rotina|miss[aã]o)\s+(?:de\s+)?(metas?|passivas?|ativas?)\b"
                  r"|^(?:de\s+)?(metas?|passivas?|ativas?)\b"
                  r"|\b(?:tipo|natureza)\s*[:,=]?\s*(\w+)\b")
    naturezas = set()
    for marca in re.finditer(declaracao, texto, re.I):
        valor = normalizar(next(g for g in marca.groups() if g))
        if valor in ('diaria', 'diario', 'semanal') and re.match(r'tipo\b', marca[0], re.I):
            continue  # Tipo de recorrência; não é a natureza da missão.
        if valor not in ('meta', 'metas', 'passiva', 'passivas', 'ativa', 'ativas'):
            raise ValueError('Natureza inválida. Use ATIVA, PASSIVA ou META.')
        naturezas.add(valor.rstrip('s').upper())
    if dados.get('natureza'):
        naturezas.add(dados['natureza'])
    if len(naturezas) > 1:
        raise ValueError('Informe uma única natureza: ATIVA, PASSIVA ou META.')
    if naturezas:
        dados['natureza'] = naturezas.pop()
    elif re.search(r'\b(?:proibi[çc][aã]o|proibido)\s*:', texto, re.I):
        dados['natureza'] = 'PASSIVA'
    if not remover:
        return texto
    return re.sub(declaracao,
                  lambda m: m[0] if normalizar(m.groups()[-1] or '') in ('diaria', 'diario', 'semanal') else ' ',
                  texto, flags=re.I)


DIAS = ('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo')
DIA = r'(?:segundas?|ter[çc]as?|quartas?|quintas?|sextas?|s[aá]bados?|domingos?)(?:-feiras?)?\b'


def _dia(texto):
    return DIAS.index(normalizar(texto).split('-')[0].rstrip('s'))


def _recorrencia(dados, texto):
    # Só expressões de agenda explícitas: palavras no título não definem os dias.
    if re.search(r'^(?:mensal|anual)\b|\btipo\s*[:,=]?\s*(?:mensal|anual)\b', texto.strip(), re.I):
        raise ValueError('Para rotina mensal ou anual, use a tela de Rotinas.')
    semanal = bool(re.search(r'^\s*semanal\b|\btipo\s*[:,=]?\s*semanal\b', texto, re.I))
    texto = re.sub(r'^\s*semanal\b|\btipo\s*[:,=]?\s*(?:di[aá]ri[ao]|semanal)\b', ' ', texto, flags=re.I)
    agendas = []
    padrao = (r'\btodos os dias(?: da semana)?\b|\bdias [uú]teis\b|\bfins? de semana\b'
              r'|\bde\s+' + DIA + r'\s+(?:[aàá]|at[eé])\s+' + DIA +
              r'|(?:\bdias da semana\s*[:,=]?\s*|\b(?:n[oa]s?|aos?|[aàá]s)\s+|\btod[oa]s?\s+[oa]s\s+)'
              + DIA + r'(?:\s*(?:,\s*(?:e\s+)?|e\s+)' + DIA + r')*')
    for marca in re.finditer(padrao, texto, re.I):
        t = normalizar(marca[0])
        if t.startswith('todos os dias'):
            dias = set(range(7))
        elif t == 'dias uteis':
            dias = set(range(5))
        elif 'de semana' in t and 'dias da semana' not in t:
            dias = {5, 6}
        else:
            dias = [_dia(m[0]) for m in re.finditer(DIA, marca[0], re.I)]
            if t.startswith('de '):
                inicio, fim = dias
                dias = [(inicio + i) % 7 for i in range((fim - inicio) % 7 + 1)]
            dias = set(dias)
        if re.match(r'\s*(?:e|ou|a|até)\b', texto[marca.end():], re.I):
            raise ValueError('Informe os dias completos, por exemplo segunda, quarta e sexta.')
        agendas.append(dias)
    if len({tuple(sorted(a)) for a in agendas}) > 1:
        raise ValueError('Os dias informados são conflitantes. Informe uma única agenda.')
    texto = re.sub(padrao, ' ', texto, flags=re.I)
    if re.search(r'\bdias da semana\b', texto, re.I):
        raise ValueError('Informe os dias da semana, por exemplo segunda, quarta e sexta.')
    if semanal and not agendas:
        raise ValueError('Informe os dias da rotina semanal; sem dias, a rotina é diária.')
    if agendas and agendas[0] != set(range(7)):
        dados.update(tipo='SEMANAL', dias_semana=sorted(agendas[0]))
    return texto


def interpretar(texto):
    dados = dict(tipo='DIARIA', prioridade='MEDIA', dificuldade='NORMAL', descricao=None,
                 hora_inicio=None, hora_fim=None)
    if texto.split(' ', 1)[0].lower() == '/criarrotina':
        corpo = texto[len('/criarrotina'):].strip()
        if '|' in corpo:
            partes = [p.strip() for p in corpo.split('|')]
            if len(partes) not in (6, 7, 9):
                raise ValueError('Use título | prioridade | dificuldade | início | fim | descrição; acrescente | PASSIVA, ou | META | alvo | unidade.')
            dados.update(zip(('titulo', 'prioridade', 'dificuldade', 'hora_inicio', 'hora_fim', 'descricao'), partes[:6]))
            if len(partes) == 7:
                natureza = normalizar(partes[6]).upper()
                if natureza not in ('ATIVA', 'PASSIVA'):
                    raise ValueError('Use ATIVA ou PASSIVA; para META, informe também alvo e unidade.')
                dados['natureza'] = natureza
            elif len(partes) == 9:
                if normalizar(partes[6]) != 'meta':
                    raise ValueError('Os três campos extras são: META | alvo | unidade.')
                dados.update(natureza='META', meta_alvo=partes[7], meta_unidade=partes[8])
            _natureza(dados, dados['titulo'], remover=False)
            _configurar_meta(dados, dados['titulo'] if len(partes) != 9 else None)
            return validar(dados)
        texto = corpo if eh_pedido(corpo) else 'Crie uma rotina diária. ' + corpo
    if not eh_pedido(texto):
        return None
    corpo = re.sub(r'^(?:crie|criar|cadastre|cadastrar|adicione|adicionar)\s+'
                   r'(?:(?:uma|um|nova|novo)\s+)*(?:rotina|miss[aã]o)\s*'
                   r'(?:di[aá]ria)?[ .,:-]*', '', texto, flags=re.I)
    if corpo == texto:
        raise ValueError('Diga: crie uma rotina, seguida do título e dos detalhes.')
    descricao = re.search(r'\bdescri[çc][aã]o\s*[:,]\s*(.*)', corpo, flags=re.I | re.S)
    cabecalho = corpo[:descricao.start()] if descricao else corpo
    if descricao:
        dados['descricao'] = re.sub(r'[ .;,]*\btodos os dias[ .;,]*$', '', descricao[1], flags=re.I).strip(' .;,')
    cabecalho = _natureza(dados, cabecalho)
    # Extrai os detalhes onde foram ditos; a descrição não interfere nos campos.
    for nome, padrao in [('prioridade', r'\bprioridade\s*[:,=]?\s*([^\s,.;]+)'),
                         ('dificuldade', r'\bdificuldade\s*[:,=]?\s*([^\s,.;]+)')]:
        marca = re.search(padrao, cabecalho, re.I)
        if marca:
            dados[nome] = marca[1]
            cabecalho = cabecalho[:marca.start()] + ' ' + cabecalho[marca.end():]
    nivel = re.search(r'\bn[ií]vel\s*[:,=]?\s*([^\s,.;]+)', cabecalho, re.I)
    if nivel:
        nome = 'prioridade' if normalizar(nivel[1]) in ('critica', 'alta', 'media', 'baixa') else 'dificuldade'
        dados[nome] = nivel[1]
        fim = nivel.end()
        if nome == 'prioridade':
            dificuldade = re.match(r'[ ,;]*\b(f[aá]cil|normal|dif[ií]cil|lend[aá]rio)\b', cabecalho[fim:], re.I)
            if dificuldade:
                dados['dificuldade'] = dificuldade[1]
                fim += dificuldade.end()
        cabecalho = cabecalho[:nivel.start()] + ' ' + cabecalho[fim:]
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
    cabecalho = _recorrencia(dados, cabecalho)
    dados['titulo'] = re.sub(r'\s+', ' ', cabecalho).strip(' .,:;')
    _configurar_meta(dados, cabecalho)
    return validar(dados)
