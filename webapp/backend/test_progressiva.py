# -*- coding: utf-8 -*-
"""
O DESAFIO PROGRESSIVO — que ele possa ser perdido, mas nunca ANTES DA LARGADA.

O DEFEITO QUE ESTE ARQUIVO PRENDE

O Arquiteto criou um desafio progressivo entre 06:20 e 06:40 e ele apareceu
no Dashboard JÁ FRACASSADO, morto no mesmo minuto em que nasceu. A corrente
de dano tinha quatro elos, e cada um deles estava certo sozinho:

  1. `materializar` cria a instância de HOJE mesmo com a janela vencida
     — decisão deliberada e documentada: "quem cria decide".
  2. `fechar_vencidas` vê o prazo no passado e marca FRACASSADA.
  3. Como `eh_progressiva`, chama `especiais.aplicar_fatal_failure`.
  4. `aplicar_fatal_failure` desliga a rotina PARA SEMPRE
     (`ativo=False`, `status=FRACASSADA_FATAL`) — e progressiva não pode
     ser reerguida (routers/execucoes.py).

Para uma rotina comum o elo 1 custa um pouco de XP. Para a progressiva é
capital. Por isso a correção é uma EXCEÇÃO ESTREITA, e não a revogação da
decisão do elo 1: no dia em que nasce, a progressiva só ganha instância se
ainda houver tempo de cumpri-la.

O QUE OS ASSERTS COBREM — e por que cada um precisa existir:

  · o CONTROLE (a corrente de dano é real). Sem ele, os outros asserts
    passariam mesmo que a instância nunca fizesse mal a ninguém, e o teste
    provaria nada. Ele insere à mão a instância que o código antigo criava.
  · progressiva nascendo com a janela vencida NÃO ganha instância hoje
  · progressiva nascendo com a janela por vir GANHA (não se corta demais)
  · rotina COMUM na mesma situação continua ganhando — a decisão do
    Arquiteto sobre rotina comum não foi tocada de carona
  · progressiva nascida ONTEM ganha instância hoje mesmo com janela
    vencida — do segundo dia em diante o rigor é o ponto do desafio
  · progressiva SEM janela (dia inteiro) nasce viva a qualquer hora

Uso: DATABASE_URL=sqlite:///./x.db SECRET_KEY=... python test_progressiva.py
"""
from datetime import datetime, timedelta

import main                                     # noqa: F401  (cria o schema)
from fastapi.testclient import TestClient
from database import SessionLocal, Usuario, Rotina, ExecucaoDia
from motors import tempo, fechamento

falhas = 0


def ok(cond, msg):
    global falhas
    if not cond:
        falhas += 1
    print(("  [ok]  " if cond else "  [XX]  ") + msg)


def rodar():
    print("\n=== O DESAFIO PROGRESSIVO ===\n")
    cli = TestClient(main.app)
    with cli:
        pass
    db = SessionLocal()
    u = db.query(Usuario).filter_by(nivel_acesso="Arquiteto").first()

    hoje = tempo.hoje()
    agora = tempo.agora()

    def limpar():
        for r in db.query(Rotina).filter(Rotina.usuario_id == u.id).all():
            db.query(ExecucaoDia).filter_by(rotina_id=r.id).delete()
            db.delete(r)
        db.commit()

    # Horários RELATIVOS a `agora`. Fixá-los ("06:20") faria o teste passar
    # ou falhar conforme a hora em que alguém o roda — e um teste que muda
    # de resposta às 06:30 é pior do que nenhum.
    def hm(minutos_atras):
        return (agora - timedelta(minutes=minutos_atras)).strftime("%H:%M")

    VENC_I, VENC_F = hm(80), hm(40)        # janela fechada há 40 min
    PORVIR_I, PORVIR_F = hm(-20), hm(-40)  # janela ainda por chegar

    # A PRIMEIRA VERSÃO DESTE TESTE TROCOU OS DOIS de lugar (início DEPOIS
    # do fim). `prazos.da_rotina` trata fim<=início como janela que cruza a
    # meia-noite e empurra o fim para o dia seguinte — então o assert
    # passava, mas medindo uma janela de 23h40m em vez da janela curta no
    # futuro que ele diz medir. Passar pelo motivo errado é a única coisa
    # pior do que falhar.
    assert PORVIR_I < PORVIR_F, "a janela 'por vir' precisa ser início < fim"

    # E entre 23:20 e a meia-noite não EXISTE janela curta no futuro dentro
    # do dia de hoje: qualquer uma vira madrugada e passa a ser outro caso.
    # O assert correspondente é omitido nessa faixa, com aviso — melhor um
    # buraco declarado do que um assert que muda de significado às 23:20.
    porvir_vale = (agora + timedelta(minutes=40)).date() == agora.date()

    def cria(titulo, ini, fim, prog, dias_atras=0):
        r = Rotina(
            usuario_id=u.id, titulo=titulo, tipo="DIARIA", ativo=True,
            hora_inicio=ini, hora_fim=fim, eh_progressiva=prog,
            dias_progressivos_alvo=30 if prog else None,
            criado_em=datetime.utcnow() - timedelta(days=dias_atras),
            prioridade="ALTA", dificuldade="NORMAL", status="ATIVA",
            penalidade_xp=50,
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        return r

    def instancias(r):
        return db.query(ExecucaoDia).filter(
            ExecucaoDia.rotina_id == r.id, ExecucaoDia.data == hoje).count()

    # ══ 0. CONTROLE — a corrente de dano é real ══════════════════════
    # Este bloco NÃO testa a correção; ele testa que havia o que corrigir.
    # Insere à mão exatamente a instância que o código antigo criava e
    # mostra o desafio morrendo. Se um dia `aplicar_fatal_failure` deixar
    # de ser fatal, é aqui que se descobre — e aí a exceção estreita lá do
    # `materializar` pode ser reavaliada em vez de virar folclore.
    print("-- controle: com a instância do dia, o desafio morre --")
    limpar()
    alvo = cria("Controle progressivo", VENC_I, VENC_F, True)
    db.add(ExecucaoDia(rotina_id=alvo.id, usuario_id=u.id,
                       data=hoje, status="PENDENTE"))
    db.commit()
    fechamento.fechar_vencidas(db, u)
    db.commit()
    db.refresh(alvo)
    ok(alvo.ativo is False and alvo.status == "FRACASSADA_FATAL",
       f"instância vencida ⇒ ativo={alvo.ativo}, status={alvo.status} "
       f"(fatal, sem volta — é o dano que a correção evita)")

    # ══ 1. A CORREÇÃO ════════════════════════════════════════════════
    print("\n-- no dia em que nasce, a progressiva precisa de tempo --")
    limpar()
    prog_venc = cria("Prog · janela vencida", VENC_I, VENC_F, True)
    prog_porvir = cria("Prog · janela por vir", PORVIR_I, PORVIR_F, True)
    comum_venc = cria("Comum · janela vencida", VENC_I, VENC_F, False)
    prog_ontem = cria("Prog · nascida ontem", VENC_I, VENC_F, True, dias_atras=1)
    prog_livre = cria("Prog · dia inteiro", None, None, True)

    fechamento.materializar(db, u.id, hoje)
    db.commit()

    ok(instancias(prog_venc) == 0,
       f"progressiva nascida com a janela {VENC_I}–{VENC_F} já vencida NÃO "
       f"ganha instância hoje (agora {agora:%H:%M}) — a corrente começa amanhã")
    if porvir_vale:
        ok(instancias(prog_porvir) == 1,
           f"mas com a janela {PORVIR_I}–{PORVIR_F} ainda por vir ela nasce "
           f"normalmente — a exceção não corta um dia legítimo")
    else:
        print(f"  [--]  janela 'por vir' omitida: às {agora:%H:%M} ela cairia "
              f"na madrugada e viraria outro caso")
    ok(instancias(comum_venc) == 1,
       "a ROTINA COMUM na mesma situação continua ganhando instância — a "
       "decisão do Arquiteto ('quem cria decide') não foi revogada de carona")
    ok(instancias(prog_ontem) == 1,
       "progressiva nascida ONTEM ganha a instância de hoje mesmo com a "
       "janela vencida — teve o dia todo; do 2º dia em diante o rigor é o ponto")
    ok(instancias(prog_livre) == 1,
       "progressiva SEM janela (dia inteiro) nasce viva a qualquer hora")

    # ══ 2. E O DESAFIO CONTINUA DE PÉ ════════════════════════════════
    print("\n-- e depois do fechamento ela segue viva --")
    fechamento.fechar_vencidas(db, u)
    db.commit()
    db.refresh(prog_venc)
    ok(prog_venc.ativo is True and prog_venc.status != "FRACASSADA_FATAL",
       f"o desafio que nasceu fora da janela sobrevive ao fechamento "
       f"(ativo={prog_venc.ativo}, status={prog_venc.status})")

    # A progressiva nascida ontem TEM de morrer — senão a correção teria
    # comprado a sobrevivência do desafio ao preço de tirar dele o risco,
    # que é a única coisa que o torna valioso.
    db.refresh(prog_ontem)
    ok(prog_ontem.ativo is False and prog_ontem.status == "FRACASSADA_FATAL",
       "e a que nasceu ontem MORRE ao falhar — a correção não amoleceu o "
       "desafio, só impediu que ele nascesse morto")

    limpar()
    db.close()
    print(f"\n=== {'TUDO OK' if not falhas else str(falhas) + ' FALHA(S)'} ===")
    return falhas


if __name__ == "__main__":
    import sys
    sys.exit(1 if rodar() else 0)
