/* ══════════════════════════════════════════════════════════════════
   O ESTADO DO PORTÃO — a leitura, separada do desenho

   POR QUE ISTO É UM ARQUIVO PRÓPRIO

   O `_statusInfo` da grade decidia oito coisas ao mesmo tempo: se o
   portão abriu, se o hunter chegou tarde, o que escrever na faixa, se o
   botão existe e como ele se chama. Misturado ao HTML, ninguém
   conseguia testá-lo sem montar a página inteira — e foi assim que ele
   ficou sem o caso mais novo do Sistema:

     `SUSPENSA` NÃO EXISTIA NO SWITCH. Caía no fallback e a grade
     mostrava "—" com o botão desabilitado. Depois de tudo que
     construímos para o hunter poder sair de um portão aberto e voltar,
     a tela não oferecia a volta. O backend deixava; a porta não estava
     lá.

   O mesmo valia para `CONCLUIDA` num portão que não fecha: o servidor
   aceita a reentrada desde o commit do portão aberto, e a grade
   continuava dizendo "você já atravessou hoje".

   Aqui a leitura é uma função pura: entra a dungeon, sai um objeto.
   Sem DOM, sem relógio implícito (o `agora` é injetável, senão um teste
   de "portão selado" falharia depois das 06:00 da manhã real).

   O PRAZO É A ÚNICA CONTA DELICADA. Ele espelha `_prazo_da_sessao` do
   servidor: duas fontes — a hora de saída do dia e a duração máxima
   contada da PRIMEIRA travessia — e vale a mais apertada. Se esta
   função divergir de lá, o portão mente sobre quanto tempo resta, que é
   pior do que não dizer nada.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const MIN = 60000;

  /* As duas cores de cada rank: o núcleo e a franja.
     Neon de uma cor só fica chapado — o que faz parecer luz é o matiz
     derivar na borda, como num tubo de verdade. */
  const RANK = {
    E: ['#a8b4c8', '#6d7f9e'],
    D: ['#5cf2a0', '#12d9c4'],
    C: ['#63b3ff', '#7a6cff'],
    B: ['#cf8bff', '#ff6ad5'],
    A: ['#ff9a3c', '#ff3d6e'],
    S: ['#ffd34d', '#ff8a1f'],
  };

  const PEDRA = ['#6a7189', '#3a3f52'];   // o portão selado não é ouro: é pedra
  const RUINA = ['#ff4d6a', '#8c1030'];   // o portão perdido

  function hhmm(txt, base) {
    if (!txt) return null;
    const p = String(txt).split(':');
    if (p.length < 2) return null;
    const h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    const d = new Date(base.getTime());
    d.setHours(h, m, 0, 0);
    return d;
  }

  const quando = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  };

  /* "3h06", "52 min", "agora" — o tempo dito como gente fala. */
  function duracao(ms) {
    const min = Math.max(0, Math.round(ms / MIN));
    if (min < 1) return 'agora';
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), r = min % 60;
    return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
  }

  const relogio = (d) => d
    ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
    : '--:--';

  /* ═══════════════════════════════════════════════════════════════
     O PRAZO — espelho de `_prazo_da_sessao` no servidor
     ═══════════════════════════════════════════════════════════════ */
  function prazoDa(d, s, agora) {
    const limites = [];

    const hs = d.hora_saida_hoje || d.hora_saida;
    const fim = hhmm(hs, agora);
    if (fim) limites.push(fim);

    /* A DURAÇÃO CONTA DA PRIMEIRA TRAVESSIA, não da permanência: sair
       para outra dungeon gasta o prazo igual. É a regra do Arquiteto —
       "se for uma dungeon com limite de tempo, o tempo não para". */
    const dur = d.duracao_max_min;
    const ent = quando(s && s.entrada_em);
    if (dur && ent) limites.push(new Date(ent.getTime() + dur * MIN));

    if (!limites.length) return null;
    return new Date(Math.min.apply(null, limites.map(x => x.getTime())));
  }

  /* Quanto do prazo já correu, de 0 a 1 — é o que acende o aro. */
  function corrido(d, s, agora, prazo) {
    if (!prazo) return null;
    const ent = quando(s && s.entrada_em);
    const inicio = hhmm(d.hora_entrada_hoje || d.hora_entrada, agora) || ent;
    if (!inicio) return null;
    const total = prazo.getTime() - inicio.getTime();
    if (total <= 0) return 1;
    return Math.max(0, Math.min(1, (agora.getTime() - inicio.getTime()) / total));
  }

  /* ═══════════════════════════════════════════════════════════════
     A LEITURA
     ═══════════════════════════════════════════════════════════════ */
  function ler(d, agora) {
    agora = agora || new Date();
    const s       = d.sessao_hoje || null;
    const aberto  = !!d.sempre_aberta;
    const st      = s ? s.status : null;
    const prazo   = prazoDa(d, s, agora);
    const pct     = corrido(d, s, agora, prazo);
    const hEnt    = d.hora_entrada_hoje || d.hora_entrada;
    const abre    = hhmm(hEnt, agora);

    const base = {
      prazo_em: prazo, pct: pct,
      cores: RANK[d.rank] || RANK.E,
      selos: [], acao: null, botao: null, ativo: false,
    };

    const selosDoQuadro = () => {
      const out = [];
      if (d.total_missoes) out.push(d.total_missoes + (d.total_missoes === 1 ? ' missão' : ' missões'));
      if (d.streak_atual > 0) out.push(d.streak_atual + ' dias');
      return out;
    };

    /* ── O portão nem existe hoje ──────────────────────────────── */
    if (d.folga_hoje) {
      return Object.assign(base, {
        chave: 'FOLGA', materia: 'selado', cores: PEDRA, pct: null,
        selo: 'FOLGA', selo_cor: '#8286a0',
        prazo: 'trancado — folga programada hoje',
        botao: 'TRANCADO', selos: selosDoQuadro(),
      });
    }
    if (!d.devida_hoje) {
      return Object.assign(base, {
        chave: 'FECHADO', materia: 'selado', cores: PEDRA, pct: null,
        selo: 'FECHADO', selo_cor: '#8286a0',
        prazo: 'este portão não abre hoje',
        botao: 'FECHADO', selos: selosDoQuadro(),
      });
    }

    /* ── Já resolvido ──────────────────────────────────────────── */
    if (st === 'FRACASSADA') {
      return Object.assign(base, {
        chave: 'PERDIDO', materia: 'perdido', cores: RUINA, pct: null,
        selo: 'PORTÃO PERDIDO', selo_cor: '#ff4d6a',
        prazo: (s.xp_perdido > 0 ? `−${s.xp_perdido} XP` : 'sem travessia') + ' · rank F',
        botao: 'PERDIDO', selos: selosDoQuadro(),
      });
    }
    if (st === 'CANCELADA') {
      return Object.assign(base, {
        chave: 'CANCELADA', materia: 'selado', cores: PEDRA, pct: null,
        selo: 'SESSÃO CANCELADA', selo_cor: '#8286a0',
        prazo: 'cancelada hoje', botao: 'ENCERRADO', selos: selosDoQuadro(),
      });
    }

    /* ── Dentro ────────────────────────────────────────────────── */
    if (st === 'ATIVA') {
      const dentro = s.tempo_total_min || 0;
      const resta  = prazo ? ` · fecha em ${duracao(prazo - agora)}` : ' · sem prazo';
      const selos  = [];
      if (d.total_missoes) {
        const feitas = Math.round((s.pct_missoes_concluidas || 0) / 100 * d.total_missoes);
        selos.push(`${feitas}/${d.total_missoes} missões`);
      }
      if (d.streak_atual > 0) selos.push(d.streak_atual + ' dias');
      if (s.xp_ganho > 0) selos.push('+' + s.xp_ganho + ' XP');
      return Object.assign(base, {
        chave: 'DENTRO', materia: 'dentro',
        selo: 'VOCÊ ESTÁ DENTRO', selo_cor: '#5cf2a0',
        prazo: (dentro > 0 ? duracao(dentro * MIN) + ' dentro' : 'recém-entrou') + resta,
        botao: 'RETORNAR', acao: 'entrar', ativo: true, selos: selos,
      });
    }

    /* ── FORA: A SESSÃO SUSPENSA ───────────────────────────────────
       Este ramo é a razão do arquivo. Ele não existia, e o hunter que
       saísse de um portão aberto encontrava "—" e um botão morto. */
    if (st === 'SUSPENSA') {
      const venceu = prazo && agora > prazo;
      if (venceu) {
        return Object.assign(base, {
          chave: 'VENCIDO', materia: 'perdido', cores: RUINA, pct: 1,
          selo: 'O TEMPO ACABOU', selo_cor: '#ff4d6a',
          prazo: `o prazo venceu às ${relogio(prazo)} — você estava fora`,
          botao: 'VENCIDO', selos: selosDoQuadro(),
        });
      }
      const fora  = s.minutos_fora || 0;
      const selos = [];
      if (s.visitas > 1) selos.push(s.visitas + ' visitas');
      if (d.total_missoes) selos.push(d.total_missoes + ' missões');
      selos.push('intacto');
      return Object.assign(base, {
        chave: 'FORA', materia: 'fora',
        selo: 'VOCÊ SAIU — O PRAZO CORRE', selo_cor: '#63b3ff',
        prazo: (prazo ? `restam ${duracao(prazo - agora)}` : 'sem prazo')
             + (fora > 0 ? ` · ${duracao(fora * MIN)} fora` : ''),
        botao: 'RETOMAR', acao: 'entrar', ativo: true, selos: selos,
      });
    }

    /* ── Clear ─────────────────────────────────────────────────────
       Num portão que não fecha ele pode VOLTAR depois do clear — o
       servidor aceita desde o portão aberto, e era a grade que
       recusava. O clear já pago não se paga de novo: quem volta e
       conclui mais missões recebe só a diferença. */
    if (st === 'CONCLUIDA') {
      const podeVoltar = aberto && (!prazo || agora <= prazo);
      const selos = [`rank ${s.rank_obtido || '—'}`];
      if (s.xp_ganho > 0) selos.push('+' + s.xp_ganho + ' XP');
      if (s.visitas > 1) selos.push(s.visitas + ' visitas');
      return Object.assign(base, {
        chave: 'CLEAR', materia: podeVoltar ? 'fora' : 'selado',
        cores: podeVoltar ? base.cores : PEDRA,
        pct: podeVoltar ? pct : null,
        selo: 'CLEAR DE HOJE', selo_cor: '#5cf2a0',
        prazo: `rank ${s.rank_obtido || '—'} · ${Math.round(s.pct_missoes_concluidas || 0)}% do quadro`
             + (podeVoltar && prazo ? ` · ainda restam ${duracao(prazo - agora)}` : ''),
        botao: podeVoltar ? 'VOLTAR' : 'ATRAVESSADO',
        acao: podeVoltar ? 'entrar' : null, ativo: podeVoltar, selos: selos,
      });
    }

    /* ── Ainda não atravessou ──────────────────────────────────── */

    // O PORTÃO QUE NÃO FECHA NÃO TEM HORA. Sem porta não há selo, não há
    // atraso e não há no-show: ele está aberto enquanto o dia existir.
    if (aberto) {
      const venceu = prazo && agora > prazo;
      if (venceu) {
        return Object.assign(base, {
          chave: 'VENCIDO', materia: 'perdido', cores: RUINA, pct: 1,
          selo: 'O TEMPO ACABOU', selo_cor: '#ff4d6a',
          prazo: `o prazo venceu às ${relogio(prazo)}`,
          botao: 'VENCIDO', selos: selosDoQuadro(),
        });
      }
      return Object.assign(base, {
        chave: 'ABERTO', materia: 'aberto',
        selo: '∞ NUNCA FECHA', selo_cor: '#63b3ff',
        prazo: prazo ? `restam ${duracao(prazo - agora)} de travessia`
                     : 'sem prazo — atravesse quando puder',
        botao: 'ATRAVESSAR', acao: 'entrar', ativo: true, selos: selosDoQuadro(),
      });
    }

    // Selado: o portão só se abre NA hora, nunca antes.
    if (abre && agora < abre) {
      return Object.assign(base, {
        chave: 'SELADO', materia: 'selado', cores: PEDRA, pct: null,
        selo: 'SELADO', selo_cor: '#8286a0',
        prazo: `abre às ${hEnt} · faltam ${duracao(abre - agora)}`,
        botao: 'SELADO', selos: selosDoQuadro(),
      });
    }

    // Passou da hora de saída sem travessia: o portão se perdeu.
    if (prazo && agora > prazo) {
      return Object.assign(base, {
        chave: 'PERDIDO', materia: 'perdido', cores: RUINA, pct: null,
        selo: 'PORTÃO PERDIDO', selo_cor: '#ff4d6a',
        prazo: `sem travessia até ${relogio(prazo)}`,
        botao: 'PERDIDO', selos: selosDoQuadro(),
      });
    }

    // Aberto — com ou sem atraso em curso.
    const tol = hhmm(hEnt, agora);
    const limiteTol = tol ? new Date(tol.getTime() + (d.tolerancia_min || 0) * MIN) : null;
    const atrasado = limiteTol && agora > limiteTol;

    if (atrasado) {
      return Object.assign(base, {
        chave: 'ATRASADO', materia: 'aberto',
        selo: 'ATRASO EM CURSO', selo_cor: '#ffb648',
        prazo: `${duracao(agora - tol)} de atraso · punição na entrada`,
        botao: 'ATRAVESSAR MESMO ASSIM', acao: 'entrar', ativo: true,
        selos: selosDoQuadro(),
      });
    }
    return Object.assign(base, {
      chave: 'ABERTO', materia: 'aberto',
      selo: 'PORTÃO ABERTO', selo_cor: '#5cf2a0',
      prazo: limiteTol ? `atravesse até ${relogio(limiteTol)}` : 'atravesse',
      botao: 'ATRAVESSAR', acao: 'entrar', ativo: true, selos: selosDoQuadro(),
    });
  }

  window.PortaoEstado = { ler, prazoDa, corrido, duracao, relogio, RANK, PEDRA, RUINA };
})();
