"""Importação automática de prints esportivos pelo contrato neutro do Solo Bot."""
import base64
import binascii
import hashlib
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pydantic import ValidationError
from motors import tempo, treinos


def resposta(estado, texto, **extra):
    return dict(tratado=True, estado=estado, mensagens=[{'texto': texto}], **extra)


def data_do_print(dados, relativa, legenda, enviado_em):
    """Data explícita na legenda prevalece; Hoje/Ontem usam o dia do envio no fuso Solo."""
    envio = (enviado_em or datetime.now(timezone.utc)).astimezone(tempo.FUSO).date()
    explicita = re.search(r'\b(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})\b', legenda)
    if explicita:
        valor = explicita[1]
        try:
            return date.fromisoformat(valor) if '-' in valor else datetime.strptime(valor, '%d/%m/%Y').date()
        except ValueError:
            raise ValueError('A data da legenda é inválida. Use DD/MM/AAAA.') from None
    dia_legenda = re.search(r'\b(hoje|ontem)\b', legenda.lower())
    if dia_legenda:
        return envio - timedelta(days=dia_legenda[1] == 'ontem')
    if dados.get('data'):
        return date.fromisoformat(dados['data'])
    if relativa:
        return envio - timedelta(days=relativa == 'ontem')
    raise ValueError('Não consegui determinar a data. Reenvie o print com a legenda /rot treino DD/MM/AAAA.')


def modalidade_da_legenda(legenda):
    texto = ''.join(c for c in unicodedata.normalize('NFD', legenda.lower())
                    if unicodedata.category(c) != 'Mn')
    for palavras, modalidade in [(r'\bcaminhada\b', 'caminhada'), (r'\b(ciclismo|bicicleta|pedalada)\b', 'ciclismo'),
                                 (r'\bexercicio(?:s)?(?: geral)?\b', 'exercicio')]:
        if re.search(palavras, texto):
            return modalidade
    return 'corrida'  # preferência expressa do Arquiteto


def processar(db, usuario, imagem_base64, mime, legenda='', enviado_em=None):
    if mime.split(';')[0].strip().lower() not in ('image/jpeg', 'image/jpg', 'image/png', 'image/webp'):
        return resposta('invalido', 'Envie um print JPG, PNG ou WebP.')
    try:
        conteudo = base64.b64decode(imagem_base64, validate=True)
    except (binascii.Error, ValueError):
        return resposta('invalido', 'A imagem veio corrompida. Reenvie o print.')
    if not conteudo or len(conteudo) > 8 * 1024 * 1024:
        return resposta('invalido', 'O print deve ter até 8 MB.')
    try:
        leitura = treinos.ler_print(conteudo, detalhes=True)
    except (ValueError, RuntimeError) as erro:
        return resposta('indisponivel', str(erro) + ' A imagem não foi usada como referência de prompt.')
    if not leitura['strava']:
        return dict(tratado=False, estado='nao_treino', mensagens=[])
    if usuario is None:
        return resposta('sem_vinculo', 'Reconheci um print do Strava. Conecte sua conta do Rotinas ao Solo Bot pela guia Bots e reenvie o print.')
    dados = leitura['dados']
    if not dados.get('distancia_km') or not dados.get('duracao_segundos'):
        return resposta('incompleto', 'Reconheci o Strava, mas não consegui ler a distância e o tempo com segurança. Envie um print mais nítido ou preencha na guia Corrida e exercícios.')
    try:
        dia = data_do_print(dados, leitura.get('data_relativa'), legenda, enviado_em)
        from routers.treinos import AtividadeEntrada
        entrada = AtividadeEntrada(
            **{k: v for k, v in dados.items() if k not in ('data', 'titulo')},
            data=dia, modalidade=modalidade_da_legenda(legenda),
            titulo=dados.get('titulo', 'Corrida Strava'),
            print_hash=hashlib.sha256(conteudo).hexdigest())
    except ValueError as erro:
        texto = ('Os valores reconhecidos são inválidos. Confira o print e a data da atividade.'
                 if isinstance(erro, ValidationError) else str(erro))
        return resposta('incompleto', texto)
    try:
        atividade = treinos.salvar_atividade(db, usuario.id, entrada.model_dump())
    except treinos.TreinoDuplicado:
        return resposta('duplicado', f'Esse print ou treino já está registrado. Não somei novamente as métricas de {dia.strftime("%d/%m/%Y")}.')
    from database import AtividadeFisica, MetaExercicio
    atividades = db.query(AtividadeFisica).filter(AtividadeFisica.usuario_id == usuario.id,
                         AtividadeFisica.data == dia).all()
    resumo = treinos.metricas(atividades, 1)
    metas = db.query(MetaExercicio).filter(MetaExercicio.usuario_id == usuario.id).all()
    progresso = []
    for meta in metas:
        ini, final = treinos.intervalo(meta.periodo, dia)
        registros = db.query(AtividadeFisica).filter(AtividadeFisica.usuario_id == usuario.id,
                        AtividadeFisica.data >= ini, AtividadeFisica.data <= final).all()
        progresso.append(dict(id=meta.id, **treinos.progresso(meta, registros)))
    km = f'{atividade.distancia_km:g}'.replace('.', ',')
    minutos, segundos = divmod(atividade.duracao_segundos, 60)
    total_km = f'{resumo["distancia_km"]:g}'.replace('.', ',')
    total_minutos = f'{resumo["minutos"]:g}'.replace('.', ',')
    ritmo = ''
    if atividade.distancia_km:
        r_min, r_seg = divmod(round(atividade.duracao_segundos / atividade.distancia_km), 60)
        ritmo = f' · {r_min}:{r_seg:02d} /km'
    texto = (f'🏃 Corrida e exercícios — registrado em {dia.strftime("%d/%m/%Y")}\n'
             f'{km} km · {minutos}:{segundos:02d}{ritmo} · {atividade.modalidade}\n'
             f'Total do dia: {total_km} km e {total_minutos} minutos.\n'
             'Médias e metas atualizadas na guia Corrida e exercícios.')
    return resposta('registrado', texto, atividade_id=atividade.id, data=dia.isoformat(),
                    metricas_dia=resumo, metas=progresso)
