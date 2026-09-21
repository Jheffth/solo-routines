# -*- coding: utf-8 -*-
"""
O BOT DO WHATSAPP — os mesmos comandos, o mesmo motor, outro transporte.

O PEDIDO FOI "REPLICAR 100%", E 100% NÃO EXISTE

Comandos e avisos: sim, idênticos — eles vêm do mesmo
`motors/conversa.py`, e um comando novo nasce nos dois canais no mesmo
instante.

BOTÕES: NÃO. A Evolution fala WhatsApp por Baileys, e os interativos
pararam de renderizar de forma confiável em conta não-oficial. O
SoloCMV, que roda em produção com o mesmo stack, não usa um botão
sequer em 1057 linhas de `servicos/whatsapp.py`. Um botão que não
aparece no aparelho de quem recebe é pior que botão nenhum: a conversa
trava num passo invisível.

A substituta é a LISTA NUMERADA — "responda 1, 2 ou 3" — com a escolha
guardada no banco por cinco minutos. É menos elegante e é honesto.

TRÊS COISAS QUE O SOLOCMV JÁ TINHA APRENDIDO, E QUE EU COPIEI

1. A EVOLUTION REENTREGA. Webhook que demora, reconexão, instabilidade
   do Baileys — e a mesma mensagem volta com o mesmo `key.id`. Num bot
   de leitura seria chato; aqui, `/ok` entregue duas vezes é XP em
   dobro e um lançamento fantasma no Extrato. Daí a `MensagemWhats`.

2. `fromMe`. Se o número do Sistema estiver pareado ao aparelho do
   próprio hunter, TUDO que ele escreve volta como eco. Processar eco
   cego faria o bot responder às conversas dele com outras pessoas. Só
   passa o que é comando, código de seis dígitos ou resposta a uma
   escolha pendente.

3. GRUPO NÃO É CONVERSA DE HUNTER. `@g.us` sai fora: o `/status` diz XP,
   nível e corrente, e despejar isso num grupo é vazar o painel de
   alguém para a turma inteira.

A PORTA DESTE WEBHOOK

Sem segredo no cabeçalho — a Evolution v2 não oferece um. A proteção é
de rede: este endpoint só deve ser alcançável de dentro do Docker
(`http://app:8000/...`), nunca publicado no Caddy. Se um dia precisar
ser público, um token na query vira obrigatório.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from database import MensagemWhats, SessionLocal, Usuario, get_db
from motors import avisos as motor_avisos
from motors import conversa, evolution, tempo, vinculo

router = APIRouter(prefix="/whats", tags=["bot-whatsapp"])


# ══════════════════════════════════════════════════════════════════════
# O CANAL
# ══════════════════════════════════════════════════════════════════════
class CanalWhatsApp(conversa.Canal):
    nome = "whatsapp"
    botoes = False          # e é isso que muda tudo abaixo

    def __init__(self, origem, rotulo=None, db=None, usuario=None):
        super().__init__(origem, rotulo)
        # O canal precisa do banco para guardar a escolha pendente. No
        # Telegram isso não existe: o botão carrega a resposta consigo.
        self.db = db
        self.usuario = usuario

    def enviar(self, texto: str, opcoes=None):
        corpo = texto
        plano = []

        if opcoes and self.db is not None and self.usuario is not None:
            plano = conversa.guardar_escolha(self.db, self.usuario, self, opcoes)
            if plano:
                corpo = texto + "\n\n" + _numerar(plano)

        return _enviar(self.origem, corpo)


def _numerar(plano: list) -> str:
    """
    A lista que substitui os botões.

    O TÍTULO DA MISSÃO ENTRA EM CADA LINHA quando existe. Sem ele, dez
    missões viram dez "▶️ Iniciar" idênticos e o número escolhido não
    significa nada para quem lê — que é exatamente o erro que o menu
    existe para evitar.
    """
    linhas = []
    for i, a in enumerate(plano, 1):
        titulo = (a.get("titulo") or "").strip()
        rotulo = a["rotulo"]
        linhas.append(f"*{i}.* {rotulo}" + (f" — {titulo}" if titulo else ""))
    linhas.append("")
    linhas.append("_Responda com o número._")
    return "\n".join(linhas)


def _enviar(jid: str, texto: str):
    """
    Uma função de módulo, e não `evolution.enviar` direto, pelo mesmo
    motivo do `_tg` no Telegram: é o ponto que os testes trocam por uma
    caixa de mentira sem precisar saber que existe um canal no meio.
    """
    return evolution.enviar(jid, texto)


# ══════════════════════════════════════════════════════════════════════
# A ENTREGA
# ══════════════════════════════════════════════════════════════════════
def _ja_visto(db: Session, mensagem_id: str) -> bool:
    """
    Esta mensagem já foi processada?

    O `UNIQUE` do banco é a garantia; o `try` cobre duas entregas
    simultâneas, que é justamente quando a corrida acontece. Em caso de
    dúvida, TRATA COMO JÁ VISTA: repetir um `/ok` custa XP indevido;
    perder um é um comando que o hunter repete.
    """
    if not mensagem_id:
        return False
    if db.query(MensagemWhats).filter(
            MensagemWhats.mensagem_id == mensagem_id).first():
        return True
    try:
        db.add(MensagemWhats(mensagem_id=mensagem_id))
        db.commit()
        return False
    except Exception:
        db.rollback()
        return True


def _texto_de(msg: dict) -> str:
    return (msg.get("conversation")
            or (msg.get("extendedTextMessage") or {}).get("text")
            or "").strip()


def processar_evento(db: Session, dados: dict) -> None:
    """Um `messages.upsert` da Evolution."""
    chave = dados.get("key") or {}
    jid = chave.get("remoteJid") or ""

    if not jid or "@g.us" in jid:
        return                      # grupo não é conversa de hunter

    texto = _texto_de(dados.get("message") or {})
    if not texto:
        return                      # áudio, figurinha, imagem: não é comando

    if _ja_visto(db, chave.get("id")):
        return

    usuario = vinculo.por_origem(db, "whatsapp", jid)
    canal = CanalWhatsApp(jid, rotulo=(dados.get("pushName") or jid.split("@")[0]),
                          db=db, usuario=usuario)

    # ── O ECO DO PRÓPRIO APARELHO ────────────────────────────────────
    #
    # Com o número do Sistema pareado ao celular do hunter, tudo que ele
    # digita — para qualquer pessoa — volta para cá marcado `fromMe`.
    # Responder a isso faria o bot se intrometer nas conversas dele.
    #
    # Passa só o que é inequivocamente dirigido ao Sistema: um comando,
    # os seis dígitos do vínculo, ou um número respondendo a uma escolha
    # que NÓS acabamos de oferecer.
    if chave.get("fromMe"):
        eh_comando = texto.startswith("/")
        eh_codigo = len(texto) == vinculo.DIGITOS and texto.isdigit()
        eh_escolha = bool(usuario and texto.strip().isdigit()
                          and conversa.resgatar_escolha(
                              db, usuario, canal, int(texto.strip())))
        if not (eh_comando or eh_codigo or eh_escolha):
            return

    # ── A RESPOSTA NUMERADA ──────────────────────────────────────────
    #
    # Antes do dispatch normal: um "2" solto não é comando nenhum, e sem
    # este atalho cairia no "comando não reconhecido".
    if usuario and texto.strip().isdigit() and len(texto.strip()) <= 2:
        escolha = conversa.resgatar_escolha(db, usuario, canal,
                                            int(texto.strip()))
        if escolha:
            # UMA ESCOLHA SE USA UMA VEZ. Sem esquecer, responder "1" de
            # novo repetiria a ação — e no caso do `ok`, isso é tentar
            # concluir a mesma missão duas vezes.
            conversa.esquecer_escolha(db, usuario, canal)
            ok, curta, longa = conversa.agir(db, usuario, canal,
                                             escolha["dados"])
            if isinstance(longa, tuple) and longa and longa[0] == "__bloco__":
                conversa.mostrar_blocos(db, usuario, canal, longa[1])
                return
            canal.enviar(longa or (("✅ " if ok else "⚠️ ") + curta))
            return

    conversa.processar(canal, texto, db)


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    """
    NUNCA LEVANTA. Webhook que responde erro faz a Evolution reenviar em
    laço, e um defeito nosso viraria uma tempestade de repetições — que
    a idempotência conteria, mas ao custo de uma tabela crescendo à toa.
    """
    try:
        corpo = await request.json()
    except Exception:
        return {"ok": True}

    try:
        evento = (corpo.get("event") or "").upper().replace(".", "_")
        if evento == "MESSAGES_UPSERT":
            processar_evento(db, corpo.get("data") or {})
    except Exception as e:
        print(f"[WHATSAPP] webhook ignorado: {e}")
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════
# OS AVISOS, PELO WHATSAPP
# ══════════════════════════════════════════════════════════════════════
def destinatarios(db: Session) -> list:
    """Quem tem conversa vinculada — e só se houver Evolution para falar."""
    if not evolution.configurado():
        return []
    try:
        return vinculo.vinculados(db, "whatsapp")
    except Exception as e:
        print(f"[WHATSAPP] nao consegui listar destinatarios: {e}")
        return []


def limpar_mensagens_antigas(db: Session, dias: int = 7) -> int:
    """
    A tabela de idempotência só cresce. Uma mensagem de uma semana atrás
    nunca mais será reentregue — a Evolution desiste muito antes disso.
    """
    corte = datetime.utcnow() - timedelta(days=dias)
    n = db.query(MensagemWhats).filter(MensagemWhats.recebida_em < corte).delete()
    db.commit()
    return n or 0
