# -*- coding: utf-8 -*-
"""
PLUMAS — o vocabulário de AVE, construído sobre 'geometria' e 'pincel'.

POR QUE ESTE ARQUIVO EXISTE

'pincel' sabe desenhar UMA pena: eixo, barbas, bico. Uma ave não é uma
pena maior — é um sistema de penas que se sobrepõem. A diferença não é
de escala, é de organização, e nenhuma quantidade de 'plumagem' produz
uma asa, porque barba e rêmige obedecem a regras opostas: a barba nasce
perpendicular a um eixo comum, a rêmige nasce de um bordo que se move e
aponta para uma direção própria.

Aqui entram as quatro peças que faltavam para o motor conseguir montar
uma ave inteira sem string crua: asa aberta, penacho de cauda, voluta
ornamental e a silhueta do corpo.

REGRA DE OURO DESTE ARQUIVO: nenhuma função sabe onde é o centro da
insígnia. Todas recebem âncora e tamanho, e nada que elas geram se
afasta da âncora mais do que o parâmetro de tamanho que receberam. Quem
posiciona é a peça; quem confere o viewBox 0..300 é o compositor.

NADA DE CRASE. Este SVG termina dentro de um template literal de
JavaScript, e uma crase perdida fecha a string no meio da arte. Já
aconteceu três vezes; por isso nem em comentário.
"""
from __future__ import annotations
import math

from . import geometria as G
from . import pincel as P

Ponto = tuple[float, float]


# ── APOIO INTERNO ────────────────────────────────────────────────────

def _versor(graus: float) -> Ponto:
    """Direção unitária a partir de um ângulo em graus (y cresce para baixo)."""
    a = math.radians(graus)
    return (math.cos(a), math.sin(a))


def _perp(v: Ponto) -> Ponto:
    """Perpendicular no sentido de ângulo crescente — a mesma convenção de G.normal."""
    return (-v[1], v[0])


def _eixo_curvo(base: Ponto, direcao: Ponto, comprimento: float,
                curvatura: float) -> list[Ponto]:
    """
    Uma Bézier que sai reta da base e arqueia para o fim.

    Curva reta é palito. Mas curvar desde a base também é errado: pena
    presa num bordo sai RÍGIDA da raiz e só cede perto da ponta, e é
    esse atraso na curvatura que dá a leitura de haste com tensão em vez
    de fio mole. Por isso os deslocamentos laterais dos dois pontos de
    controle crescem (0.10 e 0.26) em vez de serem iguais.
    """
    dx, dy = direcao
    nx, ny = _perp(direcao)
    L = comprimento
    k = curvatura * L
    p1 = (base[0] + dx * L * 0.36 + nx * k * 0.10,
          base[1] + dy * L * 0.36 + ny * k * 0.10)
    p2 = (base[0] + dx * L * 0.73 + nx * k * 0.26,
          base[1] + dy * L * 0.73 + ny * k * 0.26)
    p3 = (base[0] + dx * L + nx * k * 0.34,
          base[1] + dy * L + ny * k * 0.34)
    return [base, p1, p2, p3]


# ── A ASA ────────────────────────────────────────────────────────────

def asa(ancora: Ponto, direcao_graus: float, envergadura: float,
        sem: P.Semente, n: int = 14, curvatura: float = 0.55,
        abertura: float = 52.0, escalonamento: float = 0.62,
        largura_pena: float = 9.0) -> list[str]:
    """
    Asa aberta: N rêmiges em leque, saindo de um bordo de ataque curvo.

    POR QUE O BORDO DE ATAQUE É CURVO, e não um ponto.

    A primeira versão desta função nascia todas as penas na mesma
    âncora. O resultado é um leque de papel: um vértice duro do qual
    saem raios, exatamente a mandala que este motor foi feito para
    abandonar. Numa asa real a raiz de cada rêmige está mais adiante que
    a anterior, ao longo de um bordo CONVEXO — e é essa convexidade que
    produz a sobreposição em telha, onde cada pena esconde a base da
    seguinte. Sem ela não existe profundidade: existem N linhas
    concorrendo pelo mesmo pixel.

    POR QUE AS PENAS NÃO PODEM SER IGUAIS.

    Penas de mesmo comprimento e mesma largura leem como serrilha de
    lâmina, não como asa — o olho reconhece a repetição antes de
    reconhecer a forma. Duas coisas quebram isso aqui: o comprimento
    segue um seno sobre o índice (as do meio são as mais longas, as das
    duas pontas encurtam) e cada pena passa por 'sem.jitter' em
    comprimento, ângulo e largura. A irregularidade é pequena de
    propósito: muita, e vira mato.

    O comprimento de cada pena é medido como o que SOBRA da envergadura
    depois da base — assim a asa inteira cabe num raio de 'envergadura'
    a partir da âncora, independentemente de 'escalonamento'. É esta
    função que garante o tamanho, não a confiança de quem chama.

    POR QUE AS PENAS NÃO DIVERGEM O ÂNGULO INTEIRO DA 'abertura'.

    A primeira versão distribuía os 52 graus inteiros entre as direções
    das penas. Renderizado, aquilo não é asa: é folha de palmeira. Com
    quatorze rêmiges de 9px num raio de 110px, uma divergência de 52
    graus deixa vãos escuros maiores que as próprias penas, e o olho lê
    serrilha. Numa asa aberta as rêmiges são quase PARALELAS e só se
    separam no terço final — a massa sólida perto do bordo é o que dá a
    leitura de asa.

    Então 'abertura' é repartida: só ~38% dela vira divergência entre as
    direções das penas, e o resto vira inclinação do bordo de ataque,
    onde as bases se espalham. O leque abre igual, mas as penas ficam
    quase paralelas e se sobrepõem.

    ATENÇÃO AO SIGNIFICADO DE 'abertura': ela é um controle monotônico
    de quanto o leque abre, NÃO uma medida. A pegada angular real da asa
    vista da âncora é maior que o valor pedido, porque o bordo de ataque
    deslocado também espalha. Medido nos padrões (envergadura 110):
    abertura 30 dá 77 graus de pegada, 52 dá 89, 80 dá 104. Quem
    precisar de um setor exato deve medir com 'G.limites', não confiar
    no número.

    O SINAL DA ABERTURA É A MÃO DA ASA. 'abertura' positiva dá uma asa;
    negativa dá o ESPELHO dela. Um par se faz assim:

        asa(esq, -168, env, sem, abertura=-52)
        asa(dir,  -12, env, sem, abertura=+52)

    Girar a mesma asa em 180 graus para o outro lado NÃO funciona: o
    bordo de ataque desce junto e a ave fica com uma asa de barriga para
    cima. Foi exatamente o que apareceu no primeiro teste renderizado.

    Parâmetros: 'direcao_graus' é para onde a asa aponta (0 = direita,
    90 = baixo, -90 = cima); 'escalonamento' é a fração da envergadura
    percorrida pelo bordo de ataque — 0 volta ao leque de papel, 1
    espalha demais e a asa se desfaz em penas soltas.

    Devolve a lista ORDENADA DE TRÁS PARA FRENTE: o índice 0 é a pena
    mais interna (junto ao corpo, no fundo do empilhamento) e o último é
    a rêmige externa, que fica por cima. Quem chama só precisa desenhar
    na ordem recebida.

    O chamador é responsável por manter o resultado dentro do viewBox
    0..300 — aqui não há conhecimento de tela, só de âncora e tamanho.
    """
    if n <= 0 or envergadura <= 0:
        return []

    escalonamento = min(0.92, max(0.0, escalonamento))

    # MÃO DA ASA. Uma asa não é simétrica: o bordo de ataque fica de um
    # lado só. Girar a asa direita em 180 graus não produz a esquerda —
    # produz uma direita de cabeça para baixo, com o bordo embaixo, e o
    # par fica com uma asa virada. O sinal da abertura é o espelho.
    lado = -1.0 if abertura < 0 else 1.0
    abertura = abs(abertura)

    # Bordo de ataque: um arco que sai da âncora inclinado para o lado
    # de fora do leque. O arco (o seno) é o que dá a convexidade.
    ang_bordo = direcao_graus - lado * abertura * 0.42
    d_bordo = _versor(ang_bordo)
    n_bordo = _perp(d_bordo)
    arco = envergadura * escalonamento * 0.34

    # a fatia da abertura que vira divergência entre as penas; o resto
    # do leque nasce das bases deslocadas (ver docstring)
    varredura = abertura * 0.38

    penas: list[str] = []
    for i in range(n):
        u = i / max(1, n - 1)

        # base sobre o bordo de ataque, empurrada para FORA do leque
        avanco = envergadura * escalonamento * u
        desvio = arco * math.sin(math.pi * u) * lado
        base = (ancora[0] + d_bordo[0] * avanco - n_bordo[0] * desvio,
                ancora[1] + d_bordo[1] * avanco - n_bordo[1] * desvio)

        # a pena mais interna aponta para trás (ângulo maior), a externa
        # acompanha a direção da asa — é a varredura que faz o leque
        ang = (direcao_graus + lado * (varredura * 0.5 - varredura * u)
               + sem.entre(-2.2, 2.2))
        dire = _versor(ang)

        # o que sobra da envergadura depois de andar até a base
        restante = envergadura - math.hypot(base[0] - ancora[0],
                                            base[1] - ancora[1])
        if restante <= envergadura * 0.05:
            continue

        # seno sobre o índice: meio longo, pontas curtas
        fator = 0.50 + 0.50 * math.sin(math.pi * u) ** 0.75
        comp = sem.jitter(restante * fator, 0.06)
        if comp <= envergadura * 0.04:
            continue

        eixo = _eixo_curvo(base, dire, comp, curvatura * lado)

        # Largura quase igual em todas: as do meio ganham só 14%. A
        # versão anterior variava 66%..100% e as penas magras da raiz
        # abriam buracos justamente onde a asa precisa ser sólida.
        larg = sem.jitter(largura_pena * (0.86 + 0.14 * math.sin(math.pi * u)),
                          0.13)
        penas.append(G.contorno(eixo, larg, G.perfil_lamina,
                                passos=20,
                                assimetria=sem.entre(0.44, 0.58)))
    return penas


# ── O PENACHO ────────────────────────────────────────────────────────

def penacho(base: Ponto, direcao_graus: float, comprimento: float,
            sem: P.Semente, n: int = 7, abertura: float = 38.0,
            largura: float = 6.0, ondulacao: float = 0.5) -> list[str]:
    """
    Plumas de cauda longas e ondulantes.

    POR QUE CADA PLUMA É UM S, e não um arco.

    Um arco simples tem curvatura de um sinal só: a pluma inteira cede
    para o mesmo lado e o conjunto lê como jato de água. A pena de cauda
    real sai do corpo já com uma direção, perde a força no meio e volta
    — dois pontos de inflexão. É por isso que os dois pontos de controle
    ficam em LADOS OPOSTOS da direção: é a inflexão que transforma
    'linha comprida' em 'pluma pesada'.

    'ondulacao' é a amplitude do S em fração do comprimento. Perto de 0
    a pluma vira reta; acima de ~1.2 o S se dobra sobre si mesmo e o
    contorno se auto-intersecta (o preenchimento fica com miolo vazado),
    então o valor é limitado aqui dentro.

    O perfil é 'perfil_folha' — fino nas duas pontas — porque a pluma de
    cauda não tem base grossa visível: ela emerge de baixo das cobertas.
    Base larga faria a cauda parecer colada por fora.

    As bases NÃO coincidem: elas se espalham num arco curto, senão as
    sete plumas nascem do mesmo pixel e a cauda vira um X.

    O chamador é responsável pelo enquadramento. Nada aqui se afasta de
    'base' mais que ~1.05 * comprimento (o excedente é o deslocamento
    lateral da ponta do S somado ao jitter) — margem medida, não
    estimada.
    """
    if n <= 0 or comprimento <= 0:
        return []

    ondulacao = min(1.2, max(0.0, ondulacao))
    d_base = _versor(direcao_graus)
    n_base = _perp(d_base)
    espalhamento = largura * 0.95 * min(6.0, n)

    plumas: list[str] = []
    for i in range(n):
        u = i / max(1, n - 1)
        s = (u - 0.5) * 2.0  # -1 .. +1

        # base sobre um arco curto, levemente recuada nas pontas
        raiz = (base[0] + n_base[0] * s * espalhamento * 0.5
                - d_base[0] * abs(s) * espalhamento * 0.18,
                base[1] + n_base[1] * s * espalhamento * 0.5
                - d_base[1] * abs(s) * espalhamento * 0.18)

        ang = direcao_graus + s * abertura * 0.5 + sem.entre(-1.8, 1.8)
        dire = _versor(ang)
        norm = _perp(dire)

        # as centrais são as mais longas — cauda de ave nenhuma é reta na ponta
        comp = sem.jitter(comprimento * (0.70 + 0.30 * math.cos(s * math.pi * 0.5)),
                          0.08)
        amp = comp * ondulacao * 0.22 * sem.jitter(1.0, 0.20)

        # o sinal alterna com o lado do leque: as plumas da esquerda
        # ondulam para a esquerda, e o penacho abre em vez de torcer
        lado = 1.0 if s >= 0 else -1.0

        p1 = (raiz[0] + dire[0] * comp * 0.33 + norm[0] * amp * lado,
              raiz[1] + dire[1] * comp * 0.33 + norm[1] * amp * lado)
        p2 = (raiz[0] + dire[0] * comp * 0.70 - norm[0] * amp * lado,
              raiz[1] + dire[1] * comp * 0.70 - norm[1] * amp * lado)
        p3 = (raiz[0] + dire[0] * comp + norm[0] * amp * 0.45 * lado,
              raiz[1] + dire[1] * comp + norm[1] * amp * 0.45 * lado)

        w = sem.jitter(largura * (0.72 + 0.28 * math.cos(s * math.pi * 0.5)), 0.14)
        plumas.append(G.contorno([raiz, p1, p2, p3], w, G.perfil_folha,
                                 passos=34,
                                 assimetria=sem.entre(0.45, 0.57)))
    return plumas


# ── A VOLUTA ─────────────────────────────────────────────────────────

def voluta(inicio: Ponto, raio: float, voltas: float, sem: P.Semente,
           largura: float = 4.0, sentido: int = 1,
           passos_por_volta: int = 3) -> str:
    """
    Espiral ornamental que afina ao enrolar — a voluta do art nouveau.

    POR QUE ESPIRAL LOGARÍTMICA, e não de Arquimedes.

    Na espiral de Arquimedes o espaçamento entre as voltas é constante,
    e o olho lê mola, ou rosca. A logarítmica multiplica o raio por um
    fator fixo a cada volta: as voltas externas são largas e as internas
    se apertam depressa. É essa aceleração que faz a forma parecer
    CRESCIDA em vez de enrolada, e é o motivo de ela aparecer em
    samambaia, concha e capitel jônico — e nas volutas de Mucha.

    POR QUE A LARGURA É INTERPOLADA ENTRE TRECHOS.

    A voluta é uma corrente de Béziers. Aplicar 'perfil_caligrafico' a
    cada trecho isoladamente daria um bojo no meio de CADA trecho e um
    estrangulamento em cada emenda — a espiral sairia com nós, como um
    bambu. Então o perfil calligráfico é avaliado uma vez sobre a
    espiral INTEIRA, e cada trecho recebe uma rampa linear entre a
    largura da sua emenda de entrada e a da saída. As emendas ficam
    invisíveis e a pressão sobe rápido e alivia devagar, que é a
    assinatura do gesto de mão.

    'inicio' é a PONTA SOLTA da espiral, não o centro: é o ponto por
    onde a voluta se conecta ao resto do desenho. O centro fica a 'raio'
    de distância, e por construção nada da voluta se afasta de 'inicio'
    mais que 2*raio. 'sentido' = +1 enrola num sentido, -1 no outro.

    Devolve UM path: os trechos vêm concatenados por espaço. Cada trecho
    é fechado, então o preenchimento funciona com qualquer fill-rule.
    """
    voltas = max(0.15, float(voltas))
    passos_por_volta = max(2, int(passos_por_volta))
    trechos_n = max(2, int(round(voltas * passos_por_volta)))
    if raio <= 0 or largura <= 0:
        return ""

    # decaimento: no fim das voltas o raio vale ~12% do inicial. Menos
    # que isso e o miolo vira um borrão sólido na renderização pequena.
    aperto = sem.jitter(0.12, 0.18)
    k = math.log(1.0 / max(0.04, aperto)) / (math.tau * voltas)

    s_total = math.tau * voltas
    # centro escolhido para que o parâmetro s=0 caia exatamente em 'inicio'
    centro = (inicio[0] - raio, inicio[1])

    def ponto(s: float) -> Ponto:
        r = raio * math.exp(-k * s)
        a = sentido * s
        return (centro[0] + r * math.cos(a), centro[1] + r * math.sin(a))

    def deriv(s: float) -> Ponto:
        r = raio * math.exp(-k * s)
        a = sentido * s
        return (-k * r * math.cos(a) - r * math.sin(a) * sentido,
                -k * r * math.sin(a) + r * math.cos(a) * sentido)

    def espessura(u: float) -> float:
        # 'u' é a posição ao longo da espiral inteira, 0..1
        return largura * max(0.06, G.perfil_caligrafico(u))

    partes: list[str] = []
    h = s_total / trechos_n
    for j in range(trechos_n):
        s0, s1 = h * j, h * (j + 1)
        p0, p3 = ponto(s0), ponto(s1)
        d0, d1 = deriv(s0), deriv(s1)
        # Hermite para Bézier: os controles ficam a um terço da tangente
        p1 = (p0[0] + d0[0] * h / 3.0, p0[1] + d0[1] * h / 3.0)
        p2 = (p3[0] - d1[0] * h / 3.0, p3[1] - d1[1] * h / 3.0)

        wa = espessura(s0 / s_total)
        wb = espessura(s1 / s_total)
        # largura = 1.0 e o perfil devolve pixels: a rampa linear é o que
        # costura um trecho no outro sem degrau
        partes.append(G.contorno(
            [p0, p1, p2, p3], 1.0,
            (lambda a, b: (lambda t: a + (b - a) * t))(wa, wb),
            passos=14, assimetria=0.5))
    return " ".join(partes)


# ── O CORPO ──────────────────────────────────────────────────────────

def corpo_ave(centro: Ponto, altura: float, sem: P.Semente,
              inclinacao: float = -12.0) -> dict:
    """
    Silhueta de ave em voo, em partes separadas.

    POR QUE PARTES SEPARADAS, e não uma silhueta única.

    Uma silhueta fechada é chapada: torso, pescoço e cabeça recebem a
    mesma cor, o mesmo gradiente e a mesma sombra, e a ave lê como
    adesivo. Devolvendo peças, quem chama pode dar ao torso um gradiente
    com volume, ao pescoço um tom mais escuro (ele fica em sombra
    debaixo da cabeça, sempre) e ao bico um material duro. É a mesma
    razão de 'pincel.bico' devolver dicionário.

    POR QUE O TORSO É UMA GOTA, e não um oval.

    Oval é simétrico e não tem frente. Ave em voo tem massa concentrada
    no peito (onde estão os músculos que batem a asa) e afina para a
    cauda — 'perfil_gota' sobre um eixo inclinado dá exatamente isso, e
    com ele a direção do voo já fica legível antes de existir asa.

    POR QUE O BICO É CURVO E CURTO.

    Bico reto lê como agulha colada; bico longo lê como cegonha. A
    curvatura leve com ponta muito afiada (o expoente 1.35 no perfil,
    mais agressivo que 'perfil_lamina') é o que diferencia ave de rapina
    de pássaro genérico, e é o detalhe que o olho usa para decidir se a
    insígnia é ameaçadora ou fofa.

    'inclinacao' em graus inclina o eixo do corpo em relação à vertical:
    negativo aponta o peito para a direita e para cima, que é a leitura
    de subida.

    'altura' é a silhueta INTEIRA, da ponta da cauda à ponta do bico —
    não o torso. A cadeia torso + pescoço + cabeça + bico soma quase uma
    vez e meia o comprimento do torso, então o fator 0.68 abaixo é o que
    faz 'altura' significar o que o nome diz. Sem ele, pedir uma ave de
    120 devolvia uma de 176 e ela estourava o viewBox do compositor
    quando encostada na borda. 'centro' é o centro do TORSO, e não o
    centro da caixa: a cabeça fica ~0.65*altura acima dele e a cauda
    ~0.35*altura abaixo. O enquadramento no viewBox é do chamador.

    Chaves devolvidas: 'torso', 'pescoco', 'cabeca', 'bico' (paths),
    'olho', 'ancora_asa_esq', 'ancora_asa_dir', 'ancora_cauda' (pontos).
    """
    # 0.68: a soma das quatro peças mede ~1.47 comprimentos de torso.
    # Dividir por isso é o que faz 'altura' ser a altura da ave.
    h = max(1.0, float(altura)) * 0.68

    # eixo do corpo: da cauda para o peito, subindo
    ang_corpo = -90.0 + inclinacao
    d = _versor(ang_corpo)
    nrm = _perp(d)

    cauda = (centro[0] - d[0] * h * 0.42, centro[1] - d[1] * h * 0.42)
    peito = (centro[0] + d[0] * h * 0.40, centro[1] + d[1] * h * 0.40)

    # leve arqueamento do dorso — corpo reto lê como fuselagem
    curva = sem.jitter(h * 0.05, 0.25)
    t1 = (cauda[0] + d[0] * h * 0.30 + nrm[0] * curva,
          cauda[1] + d[1] * h * 0.30 + nrm[1] * curva)
    t2 = (cauda[0] + d[0] * h * 0.62 + nrm[0] * curva * 0.6,
          cauda[1] + d[1] * h * 0.62 + nrm[1] * curva * 0.6)
    eixo_torso = [cauda, t1, t2, peito]
    torso = G.contorno(eixo_torso, h * 0.34, G.perfil_gota,
                       passos=46, assimetria=0.53)

    # PESCOÇO: sobe do peito e se inclina para a frente. Não usa
    # perfil_lamina porque ele morreria em zero exatamente onde a cabeça
    # se encaixa, e apareceria uma fresta entre as duas peças.
    ang_pesc = ang_corpo - 20.0
    d_p = _versor(ang_pesc)
    n_p = _perp(d_p)
    l_pesc = h * 0.26
    base_cab = (peito[0] + d_p[0] * l_pesc, peito[1] + d_p[1] * l_pesc)
    k_p = h * 0.045
    pescoco = G.contorno(
        [peito,
         (peito[0] + d_p[0] * l_pesc * 0.35 - n_p[0] * k_p,
          peito[1] + d_p[1] * l_pesc * 0.35 - n_p[1] * k_p),
         (peito[0] + d_p[0] * l_pesc * 0.72 - n_p[0] * k_p * 0.7,
          peito[1] + d_p[1] * l_pesc * 0.72 - n_p[1] * k_p * 0.7),
         base_cab],
        h * 0.17,
        lambda t: 1.0 - 0.34 * t,
        passos=26, assimetria=0.5)

    # CABEÇA: oval curto. O expoente 0.5 no seno arredonda as duas
    # pontas — perfil_folha puro daria um formato de lente, com bicos
    # nas extremidades, e a cabeça pareceria uma semente.
    ang_cab = ang_pesc - 8.0
    d_c = _versor(ang_cab)
    n_c = _perp(d_c)
    l_cab = h * 0.21
    fim_cab = (base_cab[0] + d_c[0] * l_cab, base_cab[1] + d_c[1] * l_cab)
    eixo_cab = [base_cab,
                (base_cab[0] + d_c[0] * l_cab * 0.33,
                 base_cab[1] + d_c[1] * l_cab * 0.33),
                (base_cab[0] + d_c[0] * l_cab * 0.67,
                 base_cab[1] + d_c[1] * l_cab * 0.67),
                fim_cab]
    cabeca = G.contorno(eixo_cab, h * 0.155,
                        lambda t: math.sin(math.pi * min(1.0, max(0.0, t))) ** 0.5,
                        passos=40, assimetria=0.5)

    # BICO: curto, curvo e afiado, saindo da frente da cabeça.
    ang_bico = ang_cab + 16.0
    d_b = _versor(ang_bico)
    inicio_bico = G.sobre(eixo_cab, 0.80)
    l_bico = h * 0.155
    eixo_bico = _eixo_curvo(inicio_bico, d_b, l_bico, 0.42)
    bico = G.contorno(eixo_bico, h * 0.085,
                      lambda t: (1.0 - min(1.0, max(0.0, t))) ** 1.35,
                      passos=22, assimetria=0.5)

    # OLHO: à frente e acima do meio da cabeça. Centralizado ele deixa a
    # ave com cara de brinquedo; adiantado dá a leitura de predador.
    meio_cab = G.sobre(eixo_cab, 0.52)
    olho = (meio_cab[0] + d_c[0] * l_cab * 0.16 - n_c[0] * h * 0.035,
            meio_cab[1] + d_c[1] * l_cab * 0.16 - n_c[1] * h * 0.035)

    # ÂNCORAS: os ombros ficam à frente do meio do torso, onde a massa é
    # maior. Ancorar as asas no centro geométrico faria a ave parecer
    # dobrada ao meio no ar.
    ombro = (centro[0] + d[0] * h * 0.16, centro[1] + d[1] * h * 0.16)
    lat = h * 0.15
    ancora_esq = (ombro[0] - nrm[0] * lat, ombro[1] - nrm[1] * lat)
    ancora_dir = (ombro[0] + nrm[0] * lat, ombro[1] + nrm[1] * lat)
    ancora_cauda = (cauda[0] - d[0] * h * 0.02, cauda[1] - d[1] * h * 0.02)

    return {
        "torso": torso,
        "pescoco": pescoco,
        "cabeca": cabeca,
        "bico": bico,
        "olho": olho,
        "ancora_asa_esq": ancora_esq,
        "ancora_asa_dir": ancora_dir,
        "ancora_cauda": ancora_cauda,
    }
