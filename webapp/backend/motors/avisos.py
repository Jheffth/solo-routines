# -*- coding: utf-8 -*-
"""
OS AVISOS — a camada que persegue, e não a que mostra.

O calendário MOSTRA: o hunter vai até ele. O aviso PERSEGUE: ele vai até
o hunter. São naturezas opostas, e a segunda tem um custo que a primeira
não tem — a interrupção. Todo desenho aqui gira em torno de gastar esse
crédito com parcimônia.

OS QUATRO MOMENTOS

  ACENDEU    a janela abriu e o Sistema deu a largada sozinho
  BEIRA      falta pouco e a missão ainda está aberta — o último aviso
             que ainda salva alguma coisa
  VENCEU     o prazo passou; serve para saber, não para agir
  PORTÃO     um portão vai abrir; é o que faz o hunter estar lá na hora

POR QUE UM MOTOR, E NÃO CÓDIGO DENTRO DO BOT

A regra de "quando esta missão está em risco" não pode morar dentro do
bot do Telegram, senão o WhatsApp precisa de uma segunda cópia — e aí já
são duas verdades sobre o mesmo fato. Este arquivo DECIDE; quem envia é
outra camada, que recebe a lista pronta.

`pendentes()` é função do ESTADO, não do tempo decorrido: ela responde
"o que deveria estar avisado neste instante". Consequência direta: com o
varredor rodando de 5 em 5 minutos, ela vai responder a mesma coisa três
vezes enquanto faltarem 15 minutos. Quem impede a repetição é a tabela
`AvisoEnviado`, e não uma esperteza aqui dentro — porque uma memória em
variável morre no deploy e o hunter recebe tudo de novo.

O AGRUPAMENTO

Tudo que cai na mesma varredura vira UMA mensagem. Na agenda do
Arquiteto há umas dez missões com janela; um aviso por evento daria
vinte mensagens por dia, o bot viraria ruído e ele silenciaria a
conversa. Silenciada, ela para de servir para qualquer coisa —
inclusive para o aviso que importava.

A JANELA DE SILÊNCIO, E A EXCEÇÃO QUE NÃO É NEGOCIÁVEL

Nada entre 23:00 e 06:00. Um app que acorda alguém para falar de
produtividade trabalha contra o próprio propósito.

MAS: missão cuja janela está de fato ABERTA nesse intervalo continua
avisando. "Sem redes sociais entre 22h e 10h" e o protocolo de sono são
missões legítimas das 04:00 — calá-las seria calar justamente quem
precisa do aviso naquele horário. O silêncio é contra a interrupção
gratuita, nunca contra a missão noturna.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

from database import (AvisoEnviado, Dungeon, ExecucaoDia, PreferenciaAviso,
                      Rotina, TarefaDia)
from motors import calendario_projecao as projecao
from motors import prazos, tempo

# Um aviso velho não vale nada. Se o varredor ficou fora do ar por duas
# horas, não faz sentido despejar "faltam 15 minutos" de missões que já
# venceram há muito — isso é o velório da manhã inteira chegando junto.
TOLERANCIA_ATRASO_MIN = 20


# ══════════════════════════════════════════════════════════════════════
# PREFERÊNCIAS
# ══════════════════════════════════════════════════════════════════════
def preferencia(db, usuario) -> PreferenciaAviso:
    """A do hunter, criando a padrão na primeira vez."""
    p = db.query(PreferenciaAviso).filter(
        PreferenciaAviso.usuario_id == usuario.id).first()
    if not p:
        p = PreferenciaAviso(usuario_id=usuario.id)
        db.add(p)
        db.flush()
    return p


def _hhmm(texto: str, padrao: time) -> time:
    try:
        h, m = str(texto or "").split(":")
        return time(int(h), int(m))
    except Exception:
        return padrao


def em_silencio(pref: PreferenciaAviso, agora: datetime) -> bool:
    """
    Estamos dentro da janela de silêncio?

    A JANELA ATRAVESSA A MEIA-NOITE (23:00 → 06:00), e é por isso que a
    comparação tem dois formatos. Com `de <= ate` seria um intervalo
    normal do dia; com `de > ate` o intervalo é a UNIÃO de dois pedaços,
    e usar a lógica do primeiro caso aqui silenciaria o dia inteiro
    menos a madrugada — exatamente o contrário.
    """
    de = _hhmm(pref.silencio_de, time(23, 0))
    ate = _hhmm(pref.silencio_ate, time(6, 0))
    agora_h = agora.time()
    if de == ate:
        return False
    if de < ate:
        return de <= agora_h < ate
    return agora_h >= de or agora_h < ate


# ══════════════════════════════════════════════════════════════════════
# O MODO DE CADA MISSÃO — texto, voz ou nenhum
#
# QUANDO avisar é global (a preferência do hunter: acendeu, beira,
# venceu). COMO avisar é da missão, escolhido na Forja. A voz é por
# missão, e não uma chave geral, porque a fala custa por caractere e
# porque nem toda missão merece interromper com som: "Colocar o Dolphin
# para carregar" cabe numa linha de texto; "Acordar às 06:00" pede voz.
# ══════════════════════════════════════════════════════════════════════
MODOS_AVISO = ("texto", "voz", "nenhum")


def normalizar_modo(valor) -> str | None:
    """
    O que o cliente mandou, em algo que se pode guardar.

    "texto" vira NULL de propósito: é o padrão, e guardar o padrão
    explícito faria uma mudança futura de padrão não alcançar as missões
    antigas. Valor desconhecido também vira NULL — um modo inventado no
    banco calaria ou faria falar uma missão sem ninguém ter pedido.
    """
    v = str(valor or "").strip().lower()
    if v in ("voz", "nenhum"):
        return v
    return None


def modo_de(obj) -> str:
    return normalizar_modo(getattr(obj, "aviso_modo", None)) or "texto"


def _hora_falada(dt: datetime | None) -> str:
    """ "22 horas", "22 e 30", "meia-noite" — hora como se diz, não como se lê."""
    if not dt:
        return ""
    h, m = dt.hour, dt.minute
    if h == 0 and m == 0:
        return "meia-noite"
    if h == 12 and m == 0:
        return "meio-dia"
    if m == 0:
        return f"{h} hora" + ("s" if h != 1 else "")
    return f"{h} e {m:02d}"


def _minutos_falados(n: int) -> str:
    return "um minuto" if n == 1 else f"{n} minutos"


# ══════════════════════════════════════════════════════════════════════
# OS AVISOS
# ══════════════════════════════════════════════════════════════════════
class Aviso:
    """
    Um aviso que DEVERIA existir agora.

    `chave` é a identidade dele para efeito de "já foi dito", e carrega
    o dia de propósito: a mesma rotina pede o mesmo aviso amanhã, e uma
    chave sem data avisaria uma vez na vida.

    `urgente` decide se ele fura a janela de silêncio. Só fura o que
    ainda dá para agir dentro daquela janela.
    """

    __slots__ = ("tipo", "chave", "texto", "urgente", "quando", "voz", "falado",
                 "valido_ate")

    def __init__(self, tipo, chave, texto, urgente=False, quando=None,
                 voz=False, falado=None, valido_ate=None):
        self.tipo = tipo
        self.chave = chave
        self.texto = texto
        self.urgente = urgente
        self.quando = quando
        # `voz`: a missão pediu para ser avisada falando. `falado`: o texto
        # escrito para o OUVIDO — sem emoji, sem asterisco, com a hora por
        # extenso. Quem sintetiza é o Solo Bot; o Rotinas só diz o quê.
        self.voz = voz
        self.falado = falado
        # ATÉ QUANDO O AVISO FAZ SENTIDO (hora local do app, sem fuso — o
        # varredor põe o fuso ao mandar). "Faltam 10 minutos" entregue
        # depois do prazo, quando a Conta Solo segurou o aviso no horário
        # de silêncio, é pior que não entregar: o Solo Bot descarta.
        # None = não vence ("venceu" é notícia, vale de manhã também).
        self.valido_ate = valido_ate

    def __repr__(self):                       # pragma: no cover
        return f"<Aviso {self.chave}>"


def _ed_aberta(ed) -> bool:
    return (ed.status or "PENDENTE") in ("PENDENTE", "ATIVA", "PAUSADA")


def pendentes(db, usuario, agora: datetime | None = None,
              acesas: list | None = None, falhas: list | None = None) -> list:
    """
    A lista do que deveria estar avisado AGORA.

    `acesas` e `falhas` vêm do `fechamento.processar_usuario` que o
    varredor acabou de rodar. Poderiam ser redescobertos daqui varrendo o
    banco — e é exatamente isso que não se faz: seria uma segunda régua
    para o mesmo fato, e duas réguas é como nascem as divergências deste
    projeto. Quem fechou sabe o que fechou.
    """
    agora = agora or tempo.agora()
    hoje = agora.date()
    pref = preferencia(db, usuario)
    fora = []

    # ── ACENDEU ──────────────────────────────────────────────────────
    # Só o que acendeu NESTA passada. Varrer o banco atrás de ATIVA traria
    # também as que o hunter iniciou com o próprio dedo — e anunciar
    # "começou sozinha" para quem acabou de apertar o botão é o tipo de
    # mentira pequena que faz perder a confiança no resto.
    if pref.acendeu:
        for ed, r in (acesas or []):
            modo = modo_de(r)
            if modo == "nenhum":
                continue      # a missão pediu silêncio na Forja
            p = prazos.da_execucao(ed, r)
            fim = p.get("fim")
            quando = (f" · até {fim.strftime('%H:%M')}" if fim else "")
            fora.append(Aviso(
                "acendeu", f"acendeu:r:{r.id}:{ed.data.isoformat()}",
                f"▶️ *{r.titulo}* começou agora{quando}",
                # Uma missão que ACABOU de abrir é acionável mesmo às
                # 04:00 — é o protocolo de sono, e é o único momento em
                # que ele pode ser cumprido.
                urgente=True, quando=agora, valido_ate=fim,
                voz=(modo == "voz"),
                falado=(f"{r.titulo} começou agora"
                        + (f", e vai até as {_hora_falada(fim)}." if fim else "."))))

    # ── VENCEU ───────────────────────────────────────────────────────
    if pref.venceu:
        # O modo de cada missão que venceu, numa consulta por tabela.
        rids = {f["rotina_id"] for f in (falhas or []) if f.get("rotina_id")}
        tids = {f["tarefa_id"] for f in (falhas or []) if f.get("tarefa_id")}
        modos = {}
        if rids:
            for r in db.query(Rotina).filter(Rotina.id.in_(rids)).all():
                modos[("r", r.id)] = modo_de(r)
        if tids:
            for t in db.query(TarefaDia).filter(TarefaDia.id.in_(tids)).all():
                modos[("t", t.id)] = modo_de(t)

        for f in (falhas or []):
            if f.get("rotina_id"):
                alvo = ("r", f["rotina_id"])
            elif f.get("tarefa_id"):
                alvo = ("t", f["tarefa_id"])
            else:
                alvo = ("x", "x")
            modo = modos.get(alvo, "texto")
            if modo == "nenhum":
                continue
            dia = f.get("data") or hoje
            custo = f.get("xp") or 0
            fora.append(Aviso(
                "venceu", f"venceu:{alvo[0]}:{alvo[1]}:{dia}",
                f"❌ *{f.get('titulo')}* venceu"
                + (f" — −{custo} XP" if custo else ""),
                # NÃO é urgente: chega depois do estrago e não há o que
                # fazer. Acordar alguém para dar uma má notícia que ele
                # não pode desfazer é só crueldade com carimbo de recurso.
                urgente=False, quando=agora,
                voz=(modo == "voz"),
                falado=f"O prazo de {f.get('titulo')} venceu."))

    # ── BEIRA DA FALHA ───────────────────────────────────────────────
    if pref.beira:
        minutos = max(1, int(pref.minutos_beira or 15))
        abertas = db.query(ExecucaoDia).filter(
            ExecucaoDia.usuario_id == usuario.id,
            ExecucaoDia.data == hoje,
            ExecucaoDia.status.in_(("PENDENTE", "ATIVA", "PAUSADA")),
        ).all()
        if abertas:
            mae = {r.id: r for r in db.query(Rotina).filter(
                Rotina.id.in_({e.rotina_id for e in abertas})).all()}
            for ed in abertas:
                r = mae.get(ed.rotina_id)
                if r is None:
                    continue
                p = prazos.da_execucao(ed, r)
                fim = p.get("fim")
                if not fim:
                    continue
                resta = (fim - agora).total_seconds() / 60
                # A JANELA TEM DOIS LADOS. `resta <= minutos` sozinho
                # dispararia também para o que já venceu há três horas —
                # e o varredor que voltou de uma queda despejaria o
                # velório da manhã inteira de uma vez.
                if not (0 < resta <= minutos):
                    continue
                modo = modo_de(r)
                if modo == "nenhum":
                    continue
                fora.append(Aviso(
                    "beira", f"beira:r:{r.id}:{ed.data.isoformat()}",
                    f"⏳ *{r.titulo}* — {int(resta)} min para o prazo",
                    urgente=True, quando=fim, valido_ate=fim,
                    voz=(modo == "voz"),
                    falado=(f"Faltam {_minutos_falados(int(resta))} "
                            f"para o prazo de {r.titulo}.")))

        # A missão geral também corre contra o prazo, e é dívida: avisar
        # dela é ainda mais útil, porque ela não some no dia seguinte.
        for t in db.query(TarefaDia).filter(
            TarefaDia.usuario_id == usuario.id,
            TarefaDia.data_prevista == hoje,
            TarefaDia.status.in_(("PENDENTE", "ATIVA", "PAUSADA")),
        ).all():
            try:
                fim = prazos.da_tarefa(t).get("fim")
            except Exception:
                continue
            if not fim:
                continue
            resta = (fim - agora).total_seconds() / 60
            if not (0 < resta <= minutos):
                continue
            modo = modo_de(t)
            if modo == "nenhum":
                continue
            fora.append(Aviso(
                "beira", f"beira:t:{t.id}:{hoje.isoformat()}",
                f"⏳ *{t.titulo}* — {int(resta)} min para o prazo",
                urgente=True, quando=fim, valido_ate=fim,
                voz=(modo == "voz"),
                falado=(f"Faltam {_minutos_falados(int(resta))} "
                        f"para o prazo de {t.titulo}.")))

    # ── PORTÃO VAI ABRIR ─────────────────────────────────────────────
    if pref.portao:
        antec = max(1, int(pref.minutos_portao or 30))
        for d in db.query(Dungeon).filter(
            Dungeon.usuario_id == usuario.id, Dungeon.status == "ATIVA"
        ).all():
            if not projecao.dungeon_devida_em(d, hoje):
                continue
            entrada, _saida = projecao.horario_do_dia(d, hoje)
            if not entrada:
                continue          # portão sem hora não tem o que anunciar
            abre = _momento(hoje, entrada)
            if abre is None:
                continue
            faltam = (abre - agora).total_seconds() / 60
            if not (0 < faltam <= antec):
                continue
            fora.append(Aviso(
                "portao", f"portao:{d.id}:{hoje.isoformat()}",
                f"🚪 *{d.titulo}* abre em {int(faltam)} min "
                f"({entrada})",
                urgente=True, quando=abre, valido_ate=abre))

    return fora


def _momento(dia: date, hhmm: str) -> datetime | None:
    try:
        h, m = str(hhmm).split(":")[:2]
        return datetime.combine(dia, time(int(h), int(m)))
    except Exception:
        return None


# ══════════════════════════════════════════════════════════════════════
# A MEMÓRIA DO QUE JÁ FOI DITO
# ══════════════════════════════════════════════════════════════════════
def filtrar_novos(db, usuario, lista: list, canal: str = "telegram") -> list:
    """Tira os que já foram enviados. Uma consulta, não uma por aviso."""
    if not lista:
        return []
    chaves = {a.chave for a in lista}
    ja = {c for (c,) in db.query(AvisoEnviado.chave).filter(
        AvisoEnviado.usuario_id == usuario.id,
        AvisoEnviado.canal == canal,
        AvisoEnviado.chave.in_(chaves)).all()}
    return [a for a in lista if a.chave not in ja]


def marcar(db, usuario, lista: list, canal: str = "telegram") -> None:
    """
    Registra o que acabou de sair.

    O `UNIQUE` do banco é a garantia de verdade; este `try` existe para o
    caso de duas varreduras se cruzarem (o job atrasa, o seguinte começa).
    Perder o registro seria pior que o erro: o aviso sairia de novo.
    """
    for a in lista:
        db.add(AvisoEnviado(usuario_id=usuario.id, chave=a.chave, canal=canal))
    try:
        db.commit()
    except Exception:
        db.rollback()
        for a in lista:
            try:
                db.add(AvisoEnviado(usuario_id=usuario.id, chave=a.chave,
                                    canal=canal))
                db.commit()
            except Exception:
                db.rollback()


def limpar_antigos(db, dias: int = 14) -> int:
    """
    Varre o histórico velho. A chave carrega a data, então um registro de
    duas semanas atrás nunca mais será consultado — e uma tabela que só
    cresce acaba virando o problema seguinte.
    """
    corte = datetime.utcnow() - timedelta(days=dias)
    n = db.query(AvisoEnviado).filter(AvisoEnviado.enviado_em < corte).delete()
    db.commit()
    return n or 0


# ══════════════════════════════════════════════════════════════════════
# O TEXTO QUE VAI PARA O CHAT
# ══════════════════════════════════════════════════════════════════════
ORDEM = {"beira": 0, "portao": 1, "acendeu": 2, "venceu": 3}


def compor(lista: list) -> str:
    """
    Uma mensagem para tudo que caiu nesta varredura.

    A ORDEM É POR URGÊNCIA, não por tipo nem por hora: o que ainda dá
    para salvar vem primeiro, porque numa notificação lida de relance no
    bolso só as duas primeiras linhas existem de fato.
    """
    if not lista:
        return ""
    itens = sorted(lista, key=lambda a: (ORDEM.get(a.tipo, 9), a.texto))
    if len(itens) == 1:
        return itens[0].texto
    return "\n".join(["🔔 *Sistema*", ""] + [f"• {a.texto}" for a in itens])


def compor_falado(lista: list) -> str | None:
    """
    O roteiro para o ouvido — só com os avisos das missões que pediram voz.

    NUMA VARREDURA MISTA (uma missão de voz e duas de texto), a mensagem
    escrita leva as três e a fala leva só a de voz. Falar as três
    desrespeitaria a escolha feita na Forja para as outras duas, e seria
    exatamente a interrupção que a pessoa decidiu não receber.

    Devolve None quando ninguém pediu voz — e aí o Solo Bot nem cogita
    falar.
    """
    faladas = [a for a in sorted(lista, key=lambda a: ORDEM.get(a.tipo, 9))
               if a.voz and a.falado]
    if not faladas:
        return None
    return " ".join(a.falado for a in faladas)


def lotes(lista: list) -> list:
    """
    Como a varredura vira mensagens: `[(itens, valido_ate), ...]`.

    NO MÁXIMO DUAS, e o corte é pela validade, não pelo tipo:

      · os avisos DE PRAZO ("começou", "falta pouco", "portão abre") saem
        juntos, com a validade do que vence PRIMEIRO. Conservador de
        propósito: se a Conta Solo segurar a mensagem no silêncio, é
        melhor perder um "começou" ainda válido do que entregar um
        "faltam 9 minutos" de meia hora atrás. Um aviso vencido não deve
        sair por lugar nenhum.
      · os que NÃO VENCEM ("venceu") saem numa mensagem própria, sem
        validade — senão iriam para o descarte junto com o lote de prazo,
        e a notícia de uma derrota sumiria sem ser dada.

    Na prática quase toda varredura tem só um dos dois, e continua
    virando uma mensagem só.
    """
    com_prazo = [a for a in lista if a.valido_ate is not None]
    sem_prazo = [a for a in lista if a.valido_ate is None]
    saida = []
    if com_prazo:
        saida.append((com_prazo, min(a.valido_ate for a in com_prazo)))
    if sem_prazo:
        saida.append((sem_prazo, None))
    return saida


def para_enviar(db, usuario, agora=None, acesas=None, falhas=None,
                canal: str = "telegram") -> list:
    """
    O caminho inteiro, menos o envio: decidir, calar o que a hora manda
    calar, e tirar o que já foi dito.

    O SILÊNCIO É APLICADO ANTES DO FILTRO DE ENVIADOS, e a ordem importa:
    ao contrário, um aviso calado às 23:30 ficaria marcado como enviado e
    nunca mais sairia. Calado não é enviado.
    """
    agora = agora or tempo.agora()
    lista = pendentes(db, usuario, agora, acesas=acesas, falhas=falhas)
    pref = preferencia(db, usuario)
    if em_silencio(pref, agora):
        lista = [a for a in lista if a.urgente]
    return filtrar_novos(db, usuario, lista, canal=canal)
