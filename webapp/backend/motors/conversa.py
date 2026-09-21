# -*- coding: utf-8 -*-
"""
A CONVERSA — um motor, dois canais.

POR QUE ISTO SAIU DE DENTRO DO BOT DO TELEGRAM

Porque o pedido foi "replicar 100% no WhatsApp", e a alternativa era
copiar mil linhas para um segundo arquivo. Este projeto já pagou caro
por cópias: a regra de recorrência chegou a existir em CINCO lugares, e
a quinta era a do bot — a que ninguém lembraria de ajustar, porque não
aparece em tela nenhuma.

Duas regras iguais hoje não são duas regras: são uma regra e uma
bomba-relógio. Um comando novo nasce aqui e existe nos dois canais no
mesmo instante; uma trava nova vale nos dois sem ninguém precisar
lembrar.

O QUE UM CANAL PRECISA SABER FAZER

    nome      "telegram" | "whatsapp" — é a chave do vínculo e do ato
    origem    o chat_id ou o JID: quem está falando
    rotulo    um nome para exibir, quando houver
    botoes    True se o canal renderiza botão de verdade
    enviar(texto, opcoes=None)

E SÓ. Nada de HTTP aqui dentro, nada de formato de teclado. O motor
DECIDE e escreve; o canal entrega do jeito que o aplicativo dele
permite.

A DIFERENÇA QUE NÃO DÁ PARA ESCONDER

O Telegram tem teclado inline: "achei três missões com esse nome" vira
três botões e um toque, e não há o que digitar errado.

O WhatsApp, via Evolution/Baileys, NÃO TEM botão confiável — os
interativos pararam de renderizar em conta não-oficial, e o SoloCMV,
que roda em produção, não usa um sequer. Lá o mesmo menu vira lista
numerada e a resposta é um "2".

Por isso `opcoes` é uma estrutura NEUTRA, e não um teclado do Telegram:

    [{"titulo": "Banho Revigorante",
      "acoes": [{"rotulo": "▶️ Iniciar", "dados": "ini|r|12"},
                {"rotulo": "✅ Concluir", "dados": "ok|r|12"}]}]

O Telegram vira uma linha de rótulo e uma de botões. O WhatsApp vira
"1. ▶️ Iniciar — Banho Revigorante" e uma escolha pendente no banco.
O motor não sabe nem precisa saber qual dos dois aconteceu.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from database import (AtoBot, Execucao, ExecucaoDia, Rotina, TarefaDia,
                      Usuario)
from motors import tempo, vinculo


class Canal:
    """
    O contrato. Um canal concreto herda e implementa `_entregar`.

    `origem` é o que o aplicativo usa para identificar a conversa — o
    `chat_id` no Telegram, o JID no WhatsApp. Ele prova que ALGUÉM
    falou, nunca QUEM: quem prova isso é o vínculo de seis dígitos.
    """

    nome = "?"
    botoes = False

    def __init__(self, origem: str, rotulo: str | None = None):
        self.origem = str(origem)
        self.rotulo = (rotulo or str(origem))[:64]

    def enviar(self, texto: str, opcoes=None):
        raise NotImplementedError


def _plano(opcoes) -> list:
    """As ações de todos os grupos, numa lista só e na ordem mostrada."""
    saida = []
    for g in (opcoes or []):
        for a in (g.get("acoes") or []):
            saida.append({"rotulo": a["rotulo"], "dados": a["dados"],
                          "titulo": g.get("titulo") or ""})
    return saida



def _processar(texto: str, db: Session, canal):
    txt = texto.strip()

    # ── O VÍNCULO VEM ANTES DE TUDO ──────────────────────────────────
    #
    # Estes dois caminhos são os únicos que rodam SEM hunter conhecido —
    # e têm de rodar, senão não haveria como sair do estado "não
    # vinculado". Tudo o mais exige saber de quem é a conversa.
    from motors import vinculo

    usuario = vinculo.por_origem(db, canal.nome, canal.origem)

    if txt.lower().startswith("/vincular") or (usuario is None and txt.strip().isdigit()):
        codigo = txt.split(maxsplit=1)[1] if " " in txt else txt.replace("/vincular", "")
        codigo = codigo.strip()
        if not codigo:
            canal.enviar((
                "🔗 *Vincular esta conversa*\n\n"
                "1. Abra o Solo Routines\n"
                "2. Vá em *Bots*\n"
                "3. Gere o código do Telegram\n"
                "4. Mande ele aqui: `/vincular 123456`\n\n"
                "_O código vale 10 minutos._"
            ))
            return
        try:
            u = vinculo.vincular(db, canal.nome, codigo, canal.origem,
                                 nome=canal.rotulo)
            canal.enviar(f"✅ Conversa vinculada a *{u.nome}*.\n"
                         "Mande /ajuda para ver o que dá para fazer.")
        except vinculo.ErroVinculo as e:
            canal.enviar(f"❌ {e.mensagem}")
        return

    if not usuario:
        canal.enviar((
            "🔒 Esta conversa ainda não está vinculada a nenhum hunter.\n\n"
            "Abra o app em *Bots*, gere o código do Telegram e mande aqui:\n"
            "`/vincular 123456`"
        ))
        return

    if txt.lower().startswith("/desvincular"):
        vinculo.desvincular(db, usuario, canal.nome)
        canal.enviar("🔌 Conversa desvinculada. Nada mais será enviado aqui.")
        return

    hoje = tempo.hoje()

    # ── /start ou /ajuda ─────────────────────────────────
    if txt.lower() in ("/start", "/ajuda", "ajuda"):
        # O MENU COMEÇA PELOS BOTÕES, e não pela lista de comandos. Quem
        # abre `/hoje` e toca não erra de missão; quem digita o título
        # pode errar. A ajuda tem de empurrar para o caminho seguro
        # primeiro e só depois oferecer o atalho de quem tem pressa.
        canal.enviar((
            "⚔️ *Solo Routines*\n\n"
            "O jeito curto: mande `/hoje` e toque nos botões.\n\n"
            "*O dia*\n"
            "▸ `/hoje` — tudo do dia, com botões\n"
            "▸ `/pendentes` — só o que falta\n"
            "▸ `/agora` — o que está em curso e quanto falta\n\n"
            "*Agir* (ou toque no botão)\n"
            "▸ `/iniciar [título]` — dar a largada\n"
            "▸ `/ok [título]` — concluir\n"
            "▸ `/pausar` · `/retomar` · `/cancelar` `[título]`\n"
            "▸ `/desfazer` — desfaz o último ato daqui\n\n"
            "*As especiais*\n"
            "▸ `/somar [título] [valor]` — registrar na meta\n"
            "▸ `/bloco [título]` — fechar etapa do circuito\n"
            "▸ `/confessar [título]` — a passiva que você quebrou\n"
            "▸ `/reerguer [título]` — segunda chance (custa Mana)\n\n"
            "*Conferir*\n"
            "▸ `/status` — XP, nível e corrente\n"
            "▸ `/extrato` — o que rendeu hoje\n"
            "▸ `/penitencia` — dívida em aberto\n"
            "▸ `/portoes` — quais abrem hoje\n"
            "▸ `/conquistas` · `/rotinas` · `/add [título]`\n"
        ))
        return

    # ── /hoje e /pendentes ────────────────────────────────
    #
    # A MESMA TELA, dois recortes. `/hoje` é o panorama; `/pendentes` é
    # o que ainda cobra alguma coisa. Numa terça com onze missões, o
    # panorama já não cabe numa olhada no ponto de ônibus — e o recorte
    # que importa nesse momento é sempre o segundo.
    if txt.startswith("/hoje") or txt.startswith("/pendentes"):
        so_abertas = txt.startswith("/pendentes")
        corpo, teclado = _lista_do_dia(db, usuario, hoje, so_abertas=so_abertas)
        canal.enviar(corpo, opcoes=teclado)
        return

    # ── /status ───────────────────────────────────────────
    if txt.startswith("/status"):
        pct = 0
        if usuario.xp_proximo_nivel > 0:
            pct = round((usuario.xp_atual / usuario.xp_proximo_nivel) * 100, 1)
        bar_len = 10
        filled = int(bar_len * pct / 100)
        bar = "█" * filled + "░" * (bar_len - filled)

        canal.enviar((
            f"⚔️ *{usuario.nome}* — {usuario.titulo}\n"
            f"🏅 Rank: *{usuario.classe}* | Nível: *{usuario.nivel_atual}*\n"
            f"✨ XP: `{usuario.xp_atual}/{usuario.xp_proximo_nivel}` [{bar}] {pct}%\n"
            f"💰 Mana Coins: *{usuario.moedas}*\n"
            f"🔥 Streak: *{usuario.streak_atual} dias* (máx: {usuario.streak_max})\n"
            f"📊 XP Total: *{usuario.xp_total}*"
        ))
        return

    # ── AS AÇÕES POR TÍTULO ───────────────────────────────
    #
    # Todas passam pelo MESMO caminho: acha (podendo não achar, achar uma
    # ou achar várias), age, responde. O que muda entre `/ok` e
    # `/iniciar` é uma string.
    #
    # E nenhuma delas escolhe sozinha quando há empate — ver a nota do
    # `_procurar`. Foi assim que o `/ok` antigo conseguia concluir a
    # missão errada, silenciosamente.
    for gatilho, acao, verbo in (
        ("/ok",        "ok",   "concluir"),
        ("/concluir",  "ok",   "concluir"),
        ("/iniciar",   "ini",  "iniciar"),
        ("/pausar",    "pau",  "pausar"),
        ("/retomar",   "ret",  "retomar"),
        ("/cancelar",  "can",  "cancelar"),
        ("/reerguer",  "reer", "reerguer"),
        ("/confessar", "conf", "confessar"),
    ):
        if not txt.lower().startswith(gatilho):
            continue

        busca = txt[len(gatilho):].strip()
        if not busca:
            canal.enviar(f"⚠️ Use: `{gatilho} título da missão`\n\n"
                         "Ou mande `/hoje` e toque no botão — é mais seguro.")
            return

        # Reerguer e confessar agem sobre missão JÁ FECHADA (fracassada,
        # a passiva do dia), então a busca não pode se limitar às abertas.
        achados = _procurar(db, usuario, busca, hoje,
                            abertas_apenas=acao not in ("reer", "conf"))
        if not achados:
            # ACHOU MAS ESTÁ FECHADA ≠ NÃO EXISTE. Responder "não achei"
            # para uma missão que o hunter acabou de concluir o faria
            # duvidar do título, quando o que mudou foi o estado. Segunda
            # varredura, agora sem filtrar, só para poder dizer a verdade.
            todas = _procurar(db, usuario, busca, hoje, abertas_apenas=False)
            if todas:
                a = todas[0]
                nome = {"CONCLUIDA": "já foi concluída hoje",
                        "FRACASSADA": "fracassou hoje",
                        "CANCELADA": "está cancelada"}.get(a.status, a.status)
                canal.enviar(f"⚠️ *{a.titulo}* {nome}.")
                return
            canal.enviar(f"❌ Não achei nenhuma missão de hoje com *{busca}*.")
            return
        if len(achados) > 1:
            _menu_escolha(canal, acao, achados,
                          f"Achei {len(achados)} missões com *{busca}* para {verbo}.")
            return

        ok, curta, longa = _agir(db, usuario, canal, acao, achados[0], hoje)
        canal.enviar(longa or (("✅ " if ok else "⚠️ ") + curta))
        return

    # ── /agora — o que está em curso ──────────────────────
    #
    # O `/status` responde "quem eu sou" (XP, nível, corrente). Esta
    # pergunta é outra: "o que estou fazendo AGORA e quanto tempo me
    # resta". Juntar as duas num comando só faria a mais urgente ficar
    # embaixo da mais vaidosa.
    if txt.startswith("/agora"):
        alvos = _alvos_do_dia(db, usuario, hoje, abertas_apenas=True)
        correndo = [a for a in alvos if a.status in ("ATIVA", "PAUSADA")]

        if not correndo:
            proximas = [a for a in alvos if a.status == "PENDENTE"][:3]
            msg = "⏸️ *Nada em curso agora.*"
            if proximas:
                msg += "\n\nA seguir:\n" + "\n".join(
                    f"⬜ {a.titulo}" + (f" _{_hora_de(a)}_" if _hora_de(a) else "")
                    for a in proximas)
            teclado = [{"titulo": a.titulo,
                        "acoes": [{"rotulo": "▶️ Iniciar",
                                   "dados": f"ini|{a.chave}"}]}
                       for a in proximas]
            canal.enviar(msg, opcoes=teclado)
            return

        linhas, teclado = ["⏱️ *Em curso*", ""], []
        for a in correndo:
            falta = _falta(a) or "sem corrida contra o relógio"
            desde = ""
            if a.ed is not None and getattr(a.ed, "iniciada_em", None):
                ini = tempo.de_utc(a.ed.iniciada_em)
                if ini:
                    corridos = int((tempo.agora() - ini).total_seconds() // 60)
                    desde = f" · já correu {corridos}min"
            linhas.append(f"{_SIMBOLO.get(a.status, '▶️')} *{a.titulo}*")
            linhas.append(f"   _{falta}{desde}_")
            teclado.append({"titulo": a.titulo, "acoes": _botoes_de(a)})
        canal.enviar("\n".join(linhas), opcoes=teclado)
        return

    # ── /desfazer ─────────────────────────────────────────
    if txt.startswith("/desfazer"):
        _desfazer(db, usuario, canal, hoje)
        return

    # ── /somar [título] [valor] — as metas ────────────────
    if txt.lower().startswith("/somar"):
        _somar(db, usuario, canal, txt[6:].strip(), hoje)
        return

    # ── /bloco [título] — os circuitos ────────────────────
    if txt.lower().startswith("/bloco"):
        _bloco(db, usuario, canal, txt[6:].strip(), hoje)
        return

    # ── /extrato, /penitencia, /portoes ───────────────────
    if txt.startswith("/extrato"):
        _extrato(db, usuario, canal, hoje)
        return
    if txt.startswith("/penitencia") or txt.startswith("/penitência"):
        _penitencia(db, usuario, canal)
        return
    if txt.startswith("/portoes") or txt.startswith("/portões"):
        _portoes(db, usuario, canal, hoje)
        return


    # ── /add [título] ─────────────────────────────────────
    if txt.lower().startswith("/add"):
        titulo = txt[4:].strip()
        if not titulo:
            canal.enviar("⚠️ Use: `/add título da tarefa`")
            return
        nova = TarefaDia(
            titulo=titulo,
            data_prevista=hoje,
            prioridade="MEDIA",
            categoria="Pessoal",
            status="PENDENTE",
            xp_recompensa=60,
            moedas_recompensa=10,
            usuario_id=usuario.id,
        )
        db.add(nova)
        db.commit()
        canal.enviar(f"📋 Tarefa *{titulo}* adicionada para hoje! (+60 XP ao concluir)")
        return

    # ── /rotinas ──────────────────────────────────────────
    if txt.startswith("/rotinas"):
        rotinas = db.query(Rotina).filter(
            Rotina.usuario_id == usuario.id, Rotina.ativo == True
        ).all()
        if not rotinas:
            canal.enviar("📭 Nenhuma rotina cadastrada.")
            return
        msg = "🔄 *Suas Rotinas Ativas:*\n\n"
        for r in rotinas:
            msg += f"{r.icone} *{r.titulo}* [{r.tipo}] +{r.xp_recompensa} XP\n"
        canal.enviar(msg)
        return

    # ── /conquistas ───────────────────────────────────────
    if txt.startswith("/conquistas"):
        from database import ConquistaUsuario, Conquista
        cus = db.query(ConquistaUsuario).filter(
            ConquistaUsuario.usuario_id == usuario.id
        ).order_by(ConquistaUsuario.desbloqueada_em.desc()).limit(5).all()
        if not cus:
            canal.enviar("🎯 Nenhuma conquista ainda. Complete missões para desbloquear!")
            return
        msg = "🏆 *Conquistas Recentes:*\n\n"
        for cu in cus:
            c = db.query(Conquista).filter(Conquista.id == cu.conquista_id).first()
            if c:
                msg += f"{c.icone} *{c.titulo}*\n_{c.descricao}_\n\n"
        canal.enviar(msg)
        return

    # ── mensagem não reconhecida ──────────────────────────
    canal.enviar("❓ Comando não reconhecido. Use `/ajuda` para ver os comandos disponíveis.")


# ══════════════════════════════════════════════════════════════════════
# DESFAZER — a rede que um chat exige e uma tela não
# ══════════════════════════════════════════════════════════════════════
def _desfazer(db: Session, usuario, canal, hoje: date):
    """
    Desfaz o ÚLTIMO ato feito por aqui.

    O QUE ESTE COMANDO DELIBERADAMENTE NÃO FAZ: apagar o registro do
    Extrato ou devolver XP na mão. Concluir uma missão move meia dúzia
    de coisas — XP, Mana, corrente, penitência abatida, progressiva — e
    desmontar tudo isso de fora seria escrever uma sétima verdade sobre
    a economia do Sistema.

    O que ele faz é REABRIR a missão pelo caminho que já existe
    (`cancelar` + estado de volta), e dizer com todas as letras o que
    não voltou. Um desfazer honesto e parcial vale mais que um completo
    e mentiroso.
    """
    from database import AtoBot
    ato = db.query(AtoBot).filter(AtoBot.usuario_id == usuario.id,
                                  AtoBot.canal == canal.nome).first()
    if not ato or not ato.acao:
        canal.enviar("Não há nada recente para desfazer por aqui.")
        return

    # JANELA CURTA. Desfazer algo de três dias atrás não é correção de
    # erro de dedo — é reescrever o histórico, e para isso o Extrato
    # existe justamente para não deixar.
    idade = (datetime.utcnow() - (ato.criado_em or datetime.utcnow())).total_seconds()
    if idade > 3600:
        canal.enviar(f"O último ato daqui (*{ato.titulo}*) já tem mais de uma "
                     "hora. Passou da janela do desfazer — ajuste pelo app.")
        return

    alvo = _por_chave(db, usuario, "r" if ato.alvo_tipo == "rotina" else "t",
                      ato.alvo_id, hoje)
    if not alvo:
        canal.enviar("A missão do último ato não está mais disponível.")
        return

    if ato.acao in ("ini", "ret"):
        # ── A LARGADA NÃO SE DESFAZ, E ISSO É DECISÃO DO SISTEMA ──────
        #
        # Minha primeira versão chamava `cancelar`, e o router respondeu:
        # "O Sistema não aceita desistência. Uma missão termina cumprida,
        # vencida pelo tempo, ou extinta pelo Arquiteto." É uma regra
        # deliberada, e um `/desfazer` que a contornasse pelo chat abriria
        # justamente a porta que o app mantém fechada.
        #
        # O que existe é PAUSAR. Então é isso que se oferece — dizendo o
        # que aconteceu de verdade, em vez de anunciar um desfazer que não
        # houve.
        ok, curta, _ = _agir(db, usuario, canal, "pau", alvo, hoje)
        db.query(AtoBot).filter(AtoBot.id == ato.id).delete()
        db.commit()
        canal.enviar((
            f"⏸️ *{alvo.titulo}* pausada.\n\n"
            "_A largada em si não se desfaz — o Sistema não aceita "
            "desistência. Uma missão termina cumprida, vencida pelo tempo "
            "ou extinta pelo Arquiteto._"
        ) if ok else f"⚠️ {curta}")
        return

    if ato.acao == "pau":
        ok, curta, _ = _agir(db, usuario, canal, "ret", alvo, hoje)
        db.query(AtoBot).filter(AtoBot.id == ato.id).delete()
        db.commit()
        canal.enviar(f"↩️ *{alvo.titulo}* voltou a correr."
            if ok else f"⚠️ {curta}")
        return

    if ato.acao == "ok":
        canal.enviar((
            f"↩️ *Desfazer conclusão de {alvo.titulo}*\n\n"
            f"Isso rendeu ✨{ato.xp} XP e 💰{ato.moedas} Mana, e o lançamento "
            "já está no Extrato — o Sistema não apaga o que aconteceu.\n\n"
            "Para corrigir de verdade, use o cartão no app: lá dá para ver "
            "o que foi creditado antes de mexer."
        ))
        return

    canal.enviar(f"Não sei desfazer *{ato.acao}* por aqui.")


# ══════════════════════════════════════════════════════════════════════
# AS ESPECIAIS
# ══════════════════════════════════════════════════════════════════════
def _somar(db: Session, usuario, canal, resto: str, hoje: date):
    """`/somar título valor` — registra na meta do dia."""
    from fastapi import HTTPException as _HTTPErro
    from routers import execucoes as _exec
    from motors import meta as _mt

    partes = (resto or "").rsplit(" ", 1)
    if len(partes) < 2:
        canal.enviar("⚠️ Use: `/somar título 50`\n_O valor vai por último._")
        return
    busca, cru = partes[0].strip(), partes[1].strip()
    try:
        # Vírgula decimal: é como se escreve em português, e recusar
        # "12,50" por causa disso seria implicância com o próprio idioma.
        valor = float(cru.replace("R$", "").replace(",", "."))
    except ValueError:
        canal.enviar(f"⚠️ Não entendi *{cru}* como número.")
        return

    achados = [a for a in _procurar(db, usuario, busca, hoje)
               if _mt.eh_meta_valida(a.obj)]
    if not achados:
        canal.enviar(f"❌ Não achei missão de META hoje com *{busca}*.")
        return
    if len(achados) > 1:
        _menu_escolha(canal, "ok", achados,
                      f"Achei {len(achados)} metas com *{busca}*.")
        return

    a = achados[0]
    try:
        pedido = _exec.MetaRegistrarRequest(
            rotina_id=a.id if a.tipo == "r" else None,
            tarefa_id=a.id if a.tipo == "t" else None,
            valor=valor, nota="Pelo bot")
        r = _exec.meta_registrar(pedido, db, usuario) or {}
    except _HTTPErro as e:
        canal.enviar(f"⚠️ {e.detail}")
        return

    esp = getattr(a.obj, "meta_especie", None)
    un = _mt.unidade_de(a.obj)
    atual = r.get("atual", r.get("meta_atual"))
    alvo_n = getattr(a.obj, "meta_alvo", None)
    linha = f"📈 *{a.titulo}*\n+{_mt.formatar(valor, esp, un)}"
    if atual is not None and alvo_n:
        linha += (f"\nAgora: *{_mt.formatar(atual, esp, un)}* "
                  f"de {_mt.formatar(alvo_n, esp, un)}")
    # Se o registro fechou a meta, quem fechou foi o `_liquidar` lá
    # dentro — o bot só conta, não decide.
    if r.get("concluida") or r.get("alcancada"):
        linha += "\n\n✅ *Meta alcançada — missão concluída.*"
    canal.enviar(linha)


def _bloco(db: Session, usuario, canal, busca: str, hoje: date):
    """`/bloco título` — mostra as etapas e deixa fechar uma por botão."""
    from motors import circuito as _cir
    if not busca:
        canal.enviar("⚠️ Use: `/bloco título da missão`")
        return

    achados = [a for a in _procurar(db, usuario, busca, hoje)
               if _cir.eh_circuito(a.obj)]
    if not achados:
        canal.enviar(f"❌ Não achei missão de CIRCUITO hoje com *{busca}*.")
        return
    if len(achados) > 1:
        _menu_escolha(canal, "ok", achados,
                      f"Achei {len(achados)} circuitos com *{busca}*.")
        return

    a = achados[0]
    acum = a.ed if a.tipo == "r" else a.obj
    desenho = _cir.normalizar(a.obj.circuito_payload) or {}
    feito = _cir.ler_feito(getattr(acum, "circuito_feito", None))
    p = _cir.progresso(desenho, feito)

    linhas = [f"🧩 *{a.titulo}*",
              f"_{p['fechados']} de {p['total']} blocos_", ""]
    teclado = []
    for e in (desenho.get("etapas") or []):
        pronto = _cir.bloco_completo(e, feito.get(e["id"]) or {})
        linhas.append(f"{'✅' if pronto else '⬜'} {e.get('titulo') or e['id']}")
        if not pronto:
            teclado.append({"titulo": e.get("titulo") or e["id"],
                            "acoes": [{"rotulo": "✔ Fechar bloco",
                                       "dados": f"blk|{a.chave}|{e['id']}"}]})
    canal.enviar("\n".join(linhas), opcoes=teclado)


# ══════════════════════════════════════════════════════════════════════
# LEITURA — estes só olham, nunca mexem
# ══════════════════════════════════════════════════════════════════════
def _extrato(db: Session, usuario, canal, hoje: date):
    execs = db.query(Execucao).filter(
        Execucao.usuario_id == usuario.id,
        Execucao.data_execucao == hoje).all()
    fracassos = db.query(ExecucaoDia).filter(
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data == hoje,
        ExecucaoDia.status == "FRACASSADA").all()

    xp = sum(e.xp_ganho or 0 for e in execs)
    mc = sum(e.moedas_ganhas or 0 for e in execs)
    perdido = sum(f.xp_perdido or 0 for f in fracassos)

    linhas = [f"🧾 *Extrato — {hoje.strftime('%d/%m')}*", "",
              f"✅ Concluídas: *{len(execs)}*",
              f"✨ XP ganho: *+{xp}*",
              f"💰 Mana: *+{mc}*"]
    # A perda só aparece quando existe. "XP perdido: 0" todo dia
    # transforma o número em ruído, e no dia em que ele deixa de ser zero
    # ninguém repara.
    if perdido or fracassos:
        linhas += [f"❌ Fracassadas: *{len(fracassos)}*",
                   f"💀 XP perdido: *−{perdido}*",
                   f"➖ Saldo do dia: *{xp - perdido:+d}*"]
    canal.enviar("\n".join(linhas))


def _penitencia(db: Session, usuario, canal):
    from motors import penitencia as _pen
    abertas = _pen.pendentes(db, usuario.id)
    if not abertas:
        canal.enviar("⛓️ Nenhuma penitência em aberto. A conta está limpa.")
        return
    linhas = [f"⛓️ *Penitências em aberto: {len(abertas)}*", ""]
    teclado = []
    for t in abertas[:8]:
        origem = getattr(t, "origem_data", None)
        linhas.append(f"• {t.titulo}" + (f" _(de {origem.strftime('%d/%m')})_"
                                         if origem else ""))
        teclado.append({"titulo": t.titulo,
                        "acoes": [{"rotulo": "✔ Cumprir",
                                   "dados": f"ok|t|{t.id}"}]})
    linhas.append("\n_Cumprir quita a dívida — não paga XP cheio._")
    canal.enviar("\n".join(linhas), opcoes=teclado)


def _portoes(db: Session, usuario, canal, hoje: date):
    """Quais portões abrem hoje, e a que horas."""
    from database import Dungeon
    from motors import calendario_projecao as _proj

    todos = db.query(Dungeon).filter(Dungeon.usuario_id == usuario.id,
                                     Dungeon.status == "ATIVA").all()
    abertos = [d for d in todos if _proj.dungeon_devida_em(d, hoje)]
    if not abertos:
        canal.enviar("🚪 Nenhum portão abre hoje.")
        return

    linhas = [f"🚪 *Portões de hoje — {hoje.strftime('%d/%m')}*", ""]
    for d in abertos:
        ini, fim = _proj.horario_do_dia(d, hoje)
        quando = f"{ini}–{fim}" if ini and fim else (ini or "dia inteiro")
        linhas.append(f"▸ *{d.titulo}* — _{quando}_")
    # ATRAVESSAR O PORTÃO NÃO SE FAZ POR AQUI, de propósito: a dungeon é
    # uma sessão viva, com heartbeat e cronômetro. Abrir uma pelo chat e
    # sair andando deixaria uma sessão aberta sem ninguém dentro.
    linhas.append("\n_Para atravessar, use o app — a sessão precisa de "
                  "você presente._")
    canal.enviar("\n".join(linhas))


def _rotina_de_hoje(rotina: Rotina, hoje: date) -> bool:
    """
    A ROTINA CAI NESTE DIA? — e esta função não sabe a resposta.

    Ela era a QUINTA cópia da regra de recorrência neste projeto. Uma
    reescrita de memória do `fechamento.rotina_devida_em`: mesmos quatro
    tipos, mesma leitura do `dias_semana`, mesmo `mes_dia` partido no
    hífen. Parecia idêntica.

    Duas regras iguais hoje não são duas regras: são uma regra e uma
    bomba-relógio. A divergência não chega quando se copia — chega no dia
    em que alguém ajusta UMA delas. E a cópia do bot é a que ninguém
    lembraria de ajustar, porque ela não aparece em nenhuma tela: o
    sintoma seria o bot listando um dia diferente do que o app mostra,
    sem erro nenhum, e a suspeita cairia no fuso ou no cache.

    O calendário já tinha matado a quarta cópia apontando para cá. Esta
    aponta para o mesmo lugar.
    """
    from motors import fechamento
    return fechamento.rotina_devida_em(rotina, hoje)


def _estado_do_dia(db: Session, usuario, rotina: Rotina, hoje: date) -> str:
    """
    O status REAL da rotina hoje — da `ExecucaoDia`, que é o que a tela lê.

    O `/hoje` marcava ✅ comparando `rotina.ultima_execucao == hoje`. Esse
    campo é um carimbo solto, escrito por vários caminhos e lido por
    nenhuma tela; o ciclo de vida da missão (PENDENTE → ATIVA →
    CONCLUIDA | FRACASSADA | CANCELADA) mora na `ExecucaoDia`.

    Na prática: uma missão em curso, com o cronômetro correndo no app,
    aparecia no chat com o mesmo quadradinho vazio de uma que nem
    começou. E uma fracassada aparecia como pendente — convidando o
    hunter a um `/ok` que só traria "não encontrada".
    """
    ed = db.query(ExecucaoDia).filter(
        ExecucaoDia.rotina_id == rotina.id,
        ExecucaoDia.usuario_id == usuario.id,
        ExecucaoDia.data == hoje,
    ).first()
    return (ed.status if ed else "PENDENTE") or "PENDENTE"


# O símbolo carrega o estado sozinho: no chat não há cor nem tooltip para
# socorrer, e "⬜" para tudo esconde exatamente o que o hunter quer saber.
_SIMBOLO = {
    "PENDENTE":   "⬜",
    "ATIVA":      "▶️",
    "CONCLUIDA":  "✅",
    "FRACASSADA": "❌",
    "CANCELADA":  "🚫",
    "PAUSADA":    "⏸️",
}


# ══════════════════════════════════════════════════════════════════════
# ACHAR A MISSÃO — e por que isto é o coração do bot, não um detalhe
#
# O `/ok` original fazia `ilike %texto%` e pegava O PRIMEIRO que casasse.
# Numa agenda com "Fazer 50 abdominais" e "Faça 30 flexões" repetidas, e
# três missões começando com "Conseguir", um `/ok conseguir` fechava uma
# à sorte. E fechar a errada não é um engano reversível: custa XP, mexe
# na corrente e deixa a certa em aberto.
#
# A regra aqui é simples e vale para todo comando que recebe um título:
# ZERO resultados é um aviso; UM é a ação; MAIS DE UM NUNCA ESCOLHE
# SOZINHO — devolve a lista com botões, e quem decide é o hunter.
# ══════════════════════════════════════════════════════════════════════
class Alvo:
    """Uma missão concreta, já sabendo se é rotina ou missão geral."""

    __slots__ = ("tipo", "id", "titulo", "obj", "ed", "status")

    def __init__(self, tipo, obj, ed=None, status="PENDENTE"):
        self.tipo = tipo              # 'r' (rotina) | 't' (missão geral)
        self.obj = obj
        self.id = obj.id
        self.titulo = obj.titulo
        self.ed = ed                  # a ExecucaoDia, só para rotina
        self.status = status

    @property
    def chave(self):
        return f"{self.tipo}|{self.id}"


def _alvos_do_dia(db: Session, usuario, hoje: date, abertas_apenas=False) -> list:
    """Tudo que existe hoje para este hunter, rotinas e missões gerais."""
    lista = []

    rotinas = db.query(Rotina).filter(
        Rotina.usuario_id == usuario.id, Rotina.ativo == True      # noqa: E712
    ).all()
    devidas = [r for r in rotinas if _rotina_de_hoje(r, hoje)]
    if devidas:
        eds = {e.rotina_id: e for e in db.query(ExecucaoDia).filter(
            ExecucaoDia.usuario_id == usuario.id,
            ExecucaoDia.data == hoje,
            ExecucaoDia.rotina_id.in_([r.id for r in devidas]),
        ).all()}
        for r in devidas:
            ed = eds.get(r.id)
            lista.append(Alvo("r", r, ed, (ed.status if ed else "PENDENTE") or "PENDENTE"))

    for t in db.query(TarefaDia).filter(
        TarefaDia.usuario_id == usuario.id,
        TarefaDia.data_prevista == hoje,
    ).all():
        lista.append(Alvo("t", t, None, (t.status or "PENDENTE")))

    if abertas_apenas:
        lista = [a for a in lista
                 if a.status in ("PENDENTE", "ATIVA", "PAUSADA")]

    # Quem tem hora vai primeiro e em ordem: é a linha do tempo do dia.
    # O resto é "em algum momento" e desce para o fim.
    def ordem(a):
        h = getattr(a.obj, "hora_inicio", None) or getattr(a.obj, "hora_limite", None)
        return (h is None, str(h or ""), a.titulo or "")
    lista.sort(key=ordem)
    return lista


def _procurar(db: Session, usuario, busca: str, hoje: date,
              abertas_apenas=True) -> list:
    """
    Os alvos que casam com o texto. Pode devolver zero, um ou vários —
    e quem chama TEM de tratar os três casos.
    """
    termo = (busca or "").strip().lower()
    if not termo:
        return []
    todos = _alvos_do_dia(db, usuario, hoje, abertas_apenas=abertas_apenas)

    # Casar o título inteiro vence: quem digitou o nome exato não quer
    # ver um menu de desambiguação por causa de um prefixo compartilhado.
    exatos = [a for a in todos if (a.titulo or "").strip().lower() == termo]
    if exatos:
        return exatos
    return [a for a in todos if termo in (a.titulo or "").lower()]


def _menu_escolha(canal, acao: str, alvos: list, cabecalho: str):
    """Mais de uma casou: o hunter escolhe, o bot não adivinha."""
    # SEM `titulo` no grupo, e de propósito: aqui o próprio rótulo da
    # ação já é o nome da missão. Repetir viraria uma linha morta acima
    # de cada opção no Telegram, e "1. Acordar — Acordar" no WhatsApp.
    teclado = [{"titulo": "",
                "acoes": [{"rotulo": f"{_SIMBOLO.get(a.status, '⬜')} {a.titulo[:40]}",
                           "dados": f"{acao}|{a.chave}"}]} for a in alvos[:8]]
    extra = ("\n\n_Mostrando as 8 primeiras._" if len(alvos) > 8 else "")
    canal.enviar(f"{cabecalho}\n\nQual delas?{extra}", opcoes=teclado)


def _por_chave(db: Session, usuario, tipo: str, ident: int, hoje: date):
    """
    Um alvo a partir do que veio de um BOTÃO.

    E aqui mora a regra de segurança do teclado inteiro: o
    `callback_data` viaja no cliente e volta como o cliente quiser. Um
    hunter curioso manda `ok|r|999` e tenta concluir a rotina de outro.

    Por isso a consulta filtra por `usuario_id` SEMPRE, e não confia em
    nada além do id. É a mesma disciplina do `vinculo.por_origem`: o que
    chega do canal prova que alguém falou, nunca de quem é a coisa.
    """
    if tipo == "r":
        r = db.query(Rotina).filter(Rotina.id == ident,
                                    Rotina.usuario_id == usuario.id).first()
        if not r:
            return None
        ed = db.query(ExecucaoDia).filter(
            ExecucaoDia.rotina_id == r.id,
            ExecucaoDia.usuario_id == usuario.id,
            ExecucaoDia.data == hoje).first()
        return Alvo("r", r, ed, (ed.status if ed else "PENDENTE") or "PENDENTE")

    t = db.query(TarefaDia).filter(TarefaDia.id == ident,
                                   TarefaDia.usuario_id == usuario.id).first()
    return Alvo("t", t, None, (t.status or "PENDENTE")) if t else None


# ══════════════════════════════════════════════════════════════════════
# O TEMPO QUE FALTA
# ══════════════════════════════════════════════════════════════════════
def _falta(alvo: Alvo) -> str:
    """
    Quanto resta do prazo, em texto curto.

    Vazio quando não há corrida: uma missão de dia inteiro dizendo
    "faltam 9h14" transformaria toda linha da lista num cronômetro, e o
    urgente deixaria de se destacar do que só precisa acontecer hoje.
    """
    from motors import prazos, tempo as _t
    try:
        if alvo.tipo == "r":
            p = (prazos.da_execucao(alvo.ed, alvo.obj) if alvo.ed
                 else prazos.da_rotina(alvo.obj, _t.hoje()))
        else:
            p = prazos.da_tarefa(alvo.obj)
    except Exception:
        return ""
    if not p or not p.get("fim"):
        return ""
    # Só anuncia contagem de JANELA — o dia inteiro não é uma corrida.
    if not p.get("janela") and not p.get("reerguida"):
        return ""
    resta = (p["fim"] - _t.agora()).total_seconds()
    if resta <= 0:
        return "prazo vencido"
    h, m = int(resta // 3600), int((resta % 3600) // 60)
    return (f"{h}h{m:02d}m" if h else f"{m}m") + " restantes"


def _hora_de(alvo: Alvo) -> str:
    hi = getattr(alvo.obj, "hora_inicio", None)
    hf = getattr(alvo.obj, "hora_fim", None) or getattr(alvo.obj, "hora_limite", None)
    if hi and hf:
        return f"{hi}–{hf}"
    return hi or hf or ""


# ══════════════════════════════════════════════════════════════════════
# A LISTA COM BOTÕES
# ══════════════════════════════════════════════════════════════════════
def _botoes_de(alvo: Alvo) -> list:
    """
    O que dá para fazer com ESTA missão agora.

    Um botão que não cabe no estado não aparece — e isso não é enfeite.
    "Iniciar" numa missão já concluída só tem um destino possível: um
    toque, um erro e a suspeita de que o bot está quebrado. Botão que
    existe tem de funcionar.
    """
    b = []
    st = alvo.status
    if st in ("PENDENTE", "PAUSADA"):
        b.append({"rotulo": "▶️ Iniciar" if st == "PENDENTE" else "▶️ Retomar",
                  "dados": f"{'ini' if st == 'PENDENTE' else 'ret'}|{alvo.chave}"})
    if st == "ATIVA":
        b.append({"rotulo": "⏸️ Pausar", "dados": f"pau|{alvo.chave}"})
    if st in ("PENDENTE", "ATIVA", "PAUSADA"):
        b.append({"rotulo": "✅ Concluir", "dados": f"ok|{alvo.chave}"})
    if st == "FRACASSADA":
        # Reerguer custa Mana — por isso vai com o preço no rótulo, e não
        # como um botão inocente ao lado dos outros.
        b.append({"rotulo": "🔥 Reerguer", "dados": f"reer|{alvo.chave}"})
    return b


def _lista_do_dia(db: Session, usuario, hoje: date, so_abertas=False):
    """Devolve `(texto, teclado)` — a tela do dia dentro do chat."""
    alvos = _alvos_do_dia(db, usuario, hoje, abertas_apenas=so_abertas)

    titulo = "📋 *Pendentes*" if so_abertas else \
             f"📅 *Missões de Hoje — {hoje.strftime('%d/%m/%Y')}*"
    if not alvos:
        vazio = ("Nada em aberto. 🎉" if so_abertas
                 else "Nenhuma missão para hoje! 🎉")
        return f"{titulo}\n\n{vazio}", []

    linhas, teclado = [titulo, ""], []
    for a in alvos:
        marca = _SIMBOLO.get(a.status, "⬜")
        hora = _hora_de(a)
        falta = _falta(a) if a.status in ("PENDENTE", "ATIVA", "PAUSADA") else ""
        cauda = " · ".join(x for x in (hora, falta) if x)
        linhas.append(f"{marca} {a.titulo}" + (f"\n   _{cauda}_" if cauda else ""))

        bts = _botoes_de(a)
        if bts:
            # O TÍTULO ANDA JUNTO DAS AÇÕES, e não é enfeite de layout:
            # é o que permite ao canal sem botão escrever "1. ▶️ Iniciar
            # — Banho Revigorante". Sem ele a lista numerada viraria dez
            # "Iniciar" idênticos, e o erro de dedo deixaria de ser
            # acidente para virar estatística.
            teclado.append({"titulo": a.titulo, "acoes": bts})

    return "\n".join(linhas), teclado


# ══════════════════════════════════════════════════════════════════════
# AGIR
# ══════════════════════════════════════════════════════════════════════
def _registrar_ato(db: Session, usuario, canal, acao: str, alvo: Alvo, res=None):
    """Guarda o último ato para o `/desfazer`. Uma linha por hunter/canal."""
    from database import AtoBot
    a = db.query(AtoBot).filter(AtoBot.usuario_id == usuario.id,
                                AtoBot.canal == canal.nome).first()
    if not a:
        a = AtoBot(usuario_id=usuario.id, canal=canal.nome)
        db.add(a)
    a.acao = acao
    a.alvo_tipo = "rotina" if alvo.tipo == "r" else "tarefa"
    a.alvo_id = alvo.id
    a.titulo = (alvo.titulo or "")[:200]
    a.xp = int((res or {}).get("xp_ganho", 0) or 0)
    a.moedas = int((res or {}).get("moedas_ganhas", 0) or 0)
    a.criado_em = datetime.utcnow()
    db.commit()


def _agir(db: Session, usuario, canal, acao: str, alvo: Alvo, hoje: date):
    """
    Executa a ação pelos MESMOS endpoints que o app usa.

    Nenhuma regra nasce aqui — este arquivo já pagou caro por isso uma
    vez, quando o `/ok` inventou a própria conclusão e deixou missões
    num limbo que o fechamento punia. Aqui só se traduz "toque no botão"
    para "chamada de router", e o resultado de volta para uma frase.

    Devolve `(ok, frase_curta, frase_longa)`. A curta vai no aviso do
    topo do Telegram (200 caracteres); a longa, quando existe, vira
    mensagem no chat.
    """
    from fastapi import HTTPException as _HTTPErro
    from routers import execucoes as _exec, rotinas as _rot, tarefas as _tar

    try:
        if acao == "ok":
            if alvo.tipo == "r":
                corpo, res = _exec.concluir(db, usuario, alvo.obj, hoje,
                                            observacao=f"Bot: {alvo.titulo}")
            else:
                corpo = _tar.concluir(db, usuario, alvo.obj)
                res = corpo.get("resultado")
            _registrar_ato(db, usuario, canal, "ok", alvo, res)
            if not res:
                return True, "Penitência cumprida.", f"⛓️ *Penitência cumprida.*\n📋 {alvo.titulo}"
            liq = (corpo or {}).get("liquidacao") or {}
            atraso = liq.get("penalidade") or 0
            longa = (f"✅ *Concluída!*\n{alvo.titulo}\n"
                     f"✨ +{res['xp_ganho']} XP | 💰 +{res['moedas_ganhas']} Mana\n"
                     + (f"⏰ −{atraso} XP por fora do prazo\n" if atraso else "")
                     + f"🔥 Streak: {res['streak_atual']} dias"
                     + (_level_up_msg(res['level_ups']) if res.get('level_ups') else ""))
            return True, f"+{res['xp_ganho']} XP", longa

        if acao == "ini":
            (_rot.iniciar_rotina if alvo.tipo == "r" else _tar.iniciar_tarefa)(
                alvo.id, db, usuario)
            _registrar_ato(db, usuario, canal, "ini", alvo)
            return True, "Missão iniciada.", None

        if acao == "pau":
            (_rot.pausar_rotina if alvo.tipo == "r" else _tar.pausar_tarefa)(
                alvo.id, db, usuario)
            _registrar_ato(db, usuario, canal, "pau", alvo)
            return True, "Pausada.", None

        if acao == "ret":
            (_rot.retomar_rotina if alvo.tipo == "r" else _tar.retomar_tarefa)(
                alvo.id, db, usuario)
            _registrar_ato(db, usuario, canal, "ret", alvo)
            return True, "Retomada.", None

        if acao == "can":
            (_rot.cancelar_rotina if alvo.tipo == "r" else _tar.cancelar_tarefa)(
                alvo.id, db, usuario)
            _registrar_ato(db, usuario, canal, "can", alvo)
            return True, "Cancelada.", None

        if acao == "reer":
            if alvo.tipo != "r" or not alvo.ed:
                return False, "Só rotina do dia se reergue.", None
            r = _exec.reerguer(_exec.ReerguerRequest(execucao_id=alvo.ed.id),
                               db, usuario)
            _registrar_ato(db, usuario, canal, "reer", alvo)
            custo = (r or {}).get("custo") or (r or {}).get("moedas") or ""
            return True, "Reerguida.", (
                f"🔥 *{alvo.titulo}* reerguida.\n"
                + (f"💰 Custou {custo} Mana.\n" if custo else "")
                + "_A janela não volta: o que volta é o resto do dia._")

        if acao == "conf":
            if alvo.tipo != "r" or not alvo.ed:
                return False, "Só rotina do dia se confessa.", None
            _exec.confessar(_exec.ConfessarRequest(execucao_id=alvo.ed.id,
                                                   observacao="Confessada pelo bot"),
                            db, usuario)
            _registrar_ato(db, usuario, canal, "conf", alvo)
            return True, "Confessada.", (
                f"🕯️ *{alvo.titulo}* — confessada.\n"
                "_Dizer a verdade na hora vale mais que o placar do dia._")

    except _HTTPErro as e:
        return False, str(e.detail)[:190], None
    except Exception as e:                      # pragma: no cover
        print(f"[BOT] acao {acao} falhou: {e}")
        return False, "Não consegui fazer isso agora.", None

    return False, "Ação desconhecida.", None


def _level_up_msg(level_ups: list) -> str:
    if not level_ups:
        return ""
    msgs = []
    for lu in level_ups:
        msgs.append(f"\n🎉 *LEVEL UP!* Nível {lu['nivel']} — {lu['rank']}\n_{lu['titulo']}_\n+{lu['moedas_bonus']} Mana Coins bônus!")
    return "\n".join(msgs)



# ══════════════════════════════════════════════════════════════════════
# A API PÚBLICA — o que os dois routers chamam
# ══════════════════════════════════════════════════════════════════════
def processar(canal: Canal, texto: str, db: Session):
    """Uma mensagem de texto, venha de onde vier."""
    return _processar(texto, db, canal)


def agir(db: Session, usuario, canal: Canal, dados: str, hoje: date | None = None):
    """
    Executa o que um BOTÃO (ou um número da lista) carrega.

    `dados` é a string que viajou até o aplicativo do hunter e voltou —
    `ok|r|12`, `blk|r|7|etapa3`. Ela NÃO É CONFIÁVEL em nenhum dos dois
    canais: no Telegram vem do cliente dele, no WhatsApp vem da lista que
    guardamos, mas o hunter pode responder qualquer número.

    Por isso todo alvo passa pelo `_por_chave`, que filtra por
    `usuario_id`. Devolve `(ok, curta, longa)`.
    """
    hoje = hoje or tempo.hoje()
    partes = (dados or "").split("|")
    if len(partes) < 3:
        return False, "Não reconheci essa opção.", None

    acao, tipo, ident = partes[0], partes[1], partes[2]
    if tipo not in ("r", "t") or not str(ident).isdigit():
        return False, "Não reconheci essa opção.", None

    alvo = _por_chave(db, usuario, tipo, int(ident), hoje)
    if not alvo:
        # Cobre também a tentativa de alcançar a missão de OUTRO hunter.
        # Para quem toca, os dois casos são o mesmo — e é melhor assim:
        # um "não é sua" confirmaria que o id existe.
        return False, "Essa missão não está mais disponível.", None

    if acao == "blk" and len(partes) >= 4:
        from fastapi import HTTPException as _HTTPErro
        from routers import execucoes as _exec
        try:
            _exec.circuito_registrar(_exec.CircuitoRegistrarRequest(
                rotina_id=alvo.id if alvo.tipo == "r" else None,
                tarefa_id=alvo.id if alvo.tipo == "t" else None,
                etapa_id=partes[3], valor=None), db, usuario)
            return True, "Bloco fechado.", ("__bloco__", alvo.titulo)
        except _HTTPErro as e:
            return False, str(e.detail)[:190], None

    return _agir(db, usuario, canal, acao, alvo, hoje)


def tela_do_dia(db: Session, usuario, hoje: date | None = None, so_abertas=False):
    """`(texto, opcoes)` — usado pelo canal que redesenha a lista."""
    return _lista_do_dia(db, usuario, hoje or tempo.hoje(), so_abertas=so_abertas)


def mostrar_blocos(db: Session, usuario, canal: Canal, titulo: str,
                   hoje: date | None = None):
    _bloco(db, usuario, canal, titulo, hoje or tempo.hoje())


def rotina_de_hoje(rotina: Rotina, hoje: date) -> bool:
    return _rotina_de_hoje(rotina, hoje)


# ══════════════════════════════════════════════════════════════════════
# A ESCOLHA NUMERADA — para o canal que não tem botão
# ══════════════════════════════════════════════════════════════════════
MINUTOS_ESCOLHA = 5


def guardar_escolha(db: Session, usuario, canal: Canal, opcoes) -> list:
    """
    Guarda o que foi oferecido, para o "2" da próxima mensagem ter
    significado. Devolve a lista achatada, na ordem numerada.
    """
    import json
    from database import EscolhaPendente

    plano = _plano(opcoes)
    if not plano:
        return []

    e = db.query(EscolhaPendente).filter(
        EscolhaPendente.usuario_id == usuario.id,
        EscolhaPendente.canal == canal.nome).first()
    if not e:
        e = EscolhaPendente(usuario_id=usuario.id, canal=canal.nome)
        db.add(e)
    e.opcoes = json.dumps(plano, ensure_ascii=False)
    e.criada_em = datetime.utcnow()
    db.commit()
    return plano


def resgatar_escolha(db: Session, usuario, canal: Canal, numero: int):
    """
    O que o número N significava — ou None.

    A VALIDADE CURTA É A REGRA IMPORTANTE. Um "2" digitado meia hora
    depois quase nunca responde àquela pergunta: responde à seguinte, ou
    a nada. E aplicar esse "2" na lista velha é concluir a missão errada
    — exatamente o que o menu existe para evitar.
    """
    import json
    from database import EscolhaPendente

    e = db.query(EscolhaPendente).filter(
        EscolhaPendente.usuario_id == usuario.id,
        EscolhaPendente.canal == canal.nome).first()
    if not e:
        return None
    idade = (datetime.utcnow() - (e.criada_em or datetime.utcnow())).total_seconds()
    if idade > MINUTOS_ESCOLHA * 60:
        return None
    try:
        plano = json.loads(e.opcoes or "[]")
    except Exception:
        return None
    if not (1 <= numero <= len(plano)):
        return None
    return plano[numero - 1]


def esquecer_escolha(db: Session, usuario, canal: Canal) -> None:
    """
    UMA ESCOLHA SE USA UMA VEZ. Sem isto, responder "1" de novo repetiria
    a ação — e no caso do `ok` isso é tentar concluir duas vezes.
    """
    from database import EscolhaPendente
    db.query(EscolhaPendente).filter(
        EscolhaPendente.usuario_id == usuario.id,
        EscolhaPendente.canal == canal.nome).delete()
    db.commit()
