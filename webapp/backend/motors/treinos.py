"""Métricas de exercícios, períodos civis e leitura local de prints do Strava."""
import io
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
from datetime import date, timedelta
from pathlib import Path

PERIODOS = ('dia', 'semana', 'mes', 'ano')


def intervalo(periodo, referencia):
    if periodo == 'dia':
        return referencia, referencia
    if periodo == 'semana':
        inicio = referencia - timedelta(days=referencia.weekday())
        return inicio, inicio + timedelta(days=6)
    if periodo == 'mes':
        inicio = referencia.replace(day=1)
        seguinte = (inicio.replace(day=28) + timedelta(days=4)).replace(day=1)
        return inicio, seguinte - timedelta(days=1)
    if periodo == 'ano':
        return date(referencia.year, 1, 1), date(referencia.year, 12, 31)
    raise ValueError('Período inválido.')


def metricas(atividades, dias):
    km = sum(a.distancia_km for a in atividades)
    segundos = sum(a.duracao_segundos for a in atividades)
    maximas = [a.velocidade_max_kmh for a in atividades if getattr(a, 'velocidade_max_kmh', None) is not None]
    n = len(atividades)
    ativos = len({a.data for a in atividades})
    return dict(treinos=n, dias_ativos=ativos, dias_periodo=dias,
                velocidade_max_kmh=max(maximas) if maximas else None,
                distancia_km=round(km, 3), minutos=round(segundos / 60, 2),
                passos=sum(a.passos or 0 for a in atividades),
                elevacao_m=sum(a.elevacao_m or 0 for a in atividades),
                km_por_treino=round(km / n, 3) if n else 0,
                minutos_por_treino=round(segundos / 60 / n, 2) if n else 0,
                km_por_dia=round(km / dias, 3),
                minutos_por_dia=round(segundos / 60 / dias, 2),
                ritmo_segundos_km=round(segundos / km, 2) if km else None,
                velocidade_kmh=round(km * 3600 / segundos, 2) if segundos else None)


def progresso(meta, atividades):
    if meta.modalidade != 'todas':
        atividades = [a for a in atividades if a.modalidade == meta.modalidade]
    if meta.tipo == 'distancia_tempo':
        # Exige UM treino que alcance a distância dentro do tempo; não soma sessões.
        candidatos = [a for a in atividades if a.duracao_segundos <= meta.tempo_limite_segundos]
        atual = max((a.distancia_km for a in candidatos), default=0)
    elif meta.tipo == 'distancia':
        atual = sum(a.distancia_km for a in atividades)
    else:
        atual = sum(a.duracao_segundos for a in atividades) / 60
    return dict(atual=round(atual, 3), alvo=meta.alvo,
                percentual=round(atual / meta.alvo * 100, 1), atingida=atual >= meta.alvo)


def duracao(texto):
    partes = texto.strip().split(':')
    if len(partes) not in (2, 3) or not all(p.isdigit() for p in partes):
        raise ValueError('Use mm:ss ou hh:mm:ss.')
    valores = list(map(int, partes))
    if valores[-1] >= 60 or (len(valores) == 3 and valores[-2] >= 60):
        raise ValueError('Minutos e segundos inválidos.')
    return sum(v * 60 ** i for i, v in enumerate(reversed(valores)))


def extrair_texto(texto):
    """Lê apenas valores presentes. Data relativa precisa de revisão humana."""
    t = ''.join(c for c in unicodedata.normalize('NFD', texto.lower())
                if unicodedata.category(c) != 'Mn')
    dados = {}
    titulo = re.search(r'(?:^|\n)([^\r\n]+)\s*\n\s*Dist[âa]ncia', texto, re.I)
    if titulo:
        dados['titulo'] = titulo[1].strip()[:120]
    maxima = re.search(r'velocidade max(?:ima|\.)?\s*\n\s*(\d+(?:[.,]\d+)?)\s*km/h', t)
    if maxima:
        dados['velocidade_max_kmh'] = float(maxima[1].replace(',', '.'))
    km = re.search(r'(\d+(?:[.,]\d+)?)\s*km(?!\s*[/h])\b', t)
    if km:
        dados['distancia_km'] = float(km[1].replace(',', '.'))
    movimento = re.search(r'(?:tempo de movimentacao|tempo de movimento|tempo decorrido|duracao)([\s\S]{0,120})', t)
    if movimento:
        relogio = re.search(r'\b\d{1,3}:\d{2}(?::\d{2})?\b', movimento[1])
        if relogio:
            try:
                dados['duracao_segundos'] = duracao(relogio[0])
            except ValueError:
                pass
    for campo, rotulo, padrao in [('passos', 'passos', r'\b\d[\d. ]*\b'),
                                 ('elevacao_m', 'ganho de elevacao', r'\b\d+\s*m\b')]:
        trecho = re.search(rotulo + r'\s*\n([^\n]+)', t)
        if trecho:
            valor = re.search(padrao, trecho[1])
            if valor:
                dados[campo] = int(re.sub(r'\D', '', valor[0]))
    # Só uma data explícita; "Hoje" nunca vira data histórica inventada.
    explicita = re.search(r'\b(\d{2})/(\d{2})/(\d{4})\b', t)
    if explicita:
        try:
            dados['data'] = date(int(explicita[3]), int(explicita[2]), int(explicita[1])).isoformat()
        except ValueError:
            pass
    return dados


def executavel_ocr():
    return shutil.which(os.getenv('TESSERACT_CMD', 'tesseract'))


def ler_print(conteudo):
    from PIL import Image, ImageOps, UnidentifiedImageError
    import warnings
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            imagem = Image.open(io.BytesIO(conteudo))
            if imagem.format not in ('JPEG', 'PNG', 'WEBP'):
                raise ValueError('Envie uma imagem JPG, PNG ou WebP.')
            if imagem.width * imagem.height > 16000000:
                raise ValueError('Imagem muito grande. Limite de 16 megapixels.')
            imagem = ImageOps.exif_transpose(imagem).convert('RGB')
            imagem.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValueError('Imagem inválida ou grande demais.') from None
    exe = executavel_ocr()
    if not exe:
        raise RuntimeError('Leitura de prints indisponível: instale o Tesseract com o idioma português no servidor.')
    # Colunas independentes evitam misturar passos com o tempo e elevação com km.
    textos = []
    with tempfile.TemporaryDirectory(prefix='solo-treino-') as pasta:
        for i, parte in enumerate((imagem, imagem.crop((0, 0, imagem.width//2, imagem.height)),
                                   imagem.crop((imagem.width//2, 0, imagem.width, imagem.height)))):
            parte = ImageOps.grayscale(parte)
            # O Strava usa fundo escuro; inverter melhora a leitura de caracteres claros.
            if sum(parte.resize((1, 1)).getdata()) < 128:
                parte = ImageOps.invert(parte)
            parte = parte.resize((parte.width * 2, parte.height * 2))
            arquivo = Path(pasta) / f'coluna-{i}.png'
            parte.save(arquivo)
            try:
                processo = subprocess.run([exe, str(arquivo), 'stdout', '-l', 'por+eng', '--psm', '6'],
                                          capture_output=True, timeout=20, check=True)
            except (subprocess.SubprocessError, OSError):
                raise RuntimeError('Não foi possível ler o print. Tente outra imagem ou preencha os dados manualmente.') from None
            textos.append(processo.stdout.decode('utf-8', errors='replace'))
    dados = extrair_texto(textos[0])
    dados.update({k: v for k, v in extrair_texto(textos[1]).items() if k != 'titulo'})
    dados.update({k: v for k, v in extrair_texto(textos[2]).items() if k in ('passos', 'elevacao_m', 'data', 'velocidade_max_kmh')})
    return dados
