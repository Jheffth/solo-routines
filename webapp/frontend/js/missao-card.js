/* ============================================================
   missao-card.js — Cartão do Sistema (componente de produção)

   DOIS MODOS IRMÃOS, mesma família visual, mensagens diferentes:

     modo 'missao'  (padrão) → a OCORRÊNCIA. "carregar Dolphin em 14/07".
                               Status, prazo, ações de execução.
     modo 'agenda'          → a REGRA.      "carregar Dolphin toda terça".
                               Frequência, próxima ocorrência, gestão.

   Uso na lista (ocorrências):
     MissaoCard.cachear(missoes);
     container.innerHTML = missoes.map(m => MissaoCard.html(m)).join('');
     MissaoCard.montar(container, { onMudou: () => Dashboard.carregar() });

   Uso na agenda (regras cruas de /rotinas/):
     MissaoCard.cachear(rotinas, { modo: 'agenda' });
     container.innerHTML = rotinas.map(r => MissaoCard.html(r, { modo: 'agenda' })).join('');
     MissaoCard.montar(container, { onMudou, onAcao });

   - Estados vêm do backend; nada é inventado no cliente
   - Delegação de eventos: um listener por container, não por cartão
   - Timer único para todos os cartões (um setInterval global)
   Requer: css/missao-card.css
   ============================================================ */

const MissaoCard = {

  /* ── Tabelas ───────────────────────────────────────────────
     REGRA DE COR: quem comanda o cartão é a PRIORIDADE (urgência),
     mantendo a convenção que o app já usa nas listas.
     A DIFICULDADE vira o selo de rank (ela multiplica o XP).      */
  PRIORIDADES: {
    /* VERDE e VERMELHO são RESERVADOS ao desfecho: verde = cumprida,
       vermelho = fracassada. Se a prioridade também os usasse, uma missão
       de baixa prioridade PENDENTE nasceria com a cara de cumprida, e uma
       crítica pendente com a cara de fracassada — a cor diria duas coisas
       ao mesmo tempo. A escala abaixo lê como calor crescente sem tocar
       em nenhum dos dois. */
    CRITICA: { cor: '#e11d48', rotulo: 'Crítica' },   // magenta — urgente
    ALTA:    { cor: '#f59e0b', rotulo: 'Alta'    },   // âmbar
    MEDIA:   { cor: '#64748b', rotulo: 'Média'   },   // azul-aço — neutro
    BAIXA:   { cor: '#3b82f6', rotulo: 'Baixa'   },   // azul — tranquilo
  },
  RANKS: {   // dificuldade -> selo de rank (multiplicador de XP)
    FACIL:    { letra: 'C', mult: '×0.5' },
    NORMAL:   { letra: 'B', mult: '×1'   },
    DIFICIL:  { letra: 'A', mult: '×1.5' },
    LENDARIO: { letra: 'S', mult: '×2.5' },
  },
  STATUS: {
    /* `gl` é a chave no alfabeto (js/glifos.js). Antes o rótulo trazia o
       emoji embutido; agora traz o NOME do desenho, e quem monta decide o
       tamanho. Emoji muda de cara em cada sistema operacional — num app que
       cuida do próprio traço, isso destoava. */
    PENDENTE:   { rotulo: 'Pendente',   gl: 'pendente',   classe: 'st-pendente'   },
    ATIVA:      { rotulo: 'Em curso',   gl: 'ativa',      classe: 'st-ativa'      },
    PAUSADA:    { rotulo: 'Pausada',    gl: 'pausada',    classe: 'st-pausada'    },
    CONCLUIDA:  { rotulo: 'Concluída',  gl: 'concluida',  classe: 'st-concluida'  },
    FRACASSADA: { rotulo: 'Fracassada', gl: 'fracassada', classe: 'st-fracassada' },
    CANCELADA:  { rotulo: 'Cancelada',  gl: 'cancelada',  classe: 'st-cancelada'  },
    /* Exclusivo da missão passiva. Não é fracasso — é o hunter admitindo que
       quebrou o protocolo, num sistema que ninguém consegue auditar. Por isso
       tem rótulo e cor próprios: tratá-la como derrota puniria a honestidade
       exatamente onde ela é a única coisa que sustenta o registro. */
    CONFESSADA: { rotulo: 'Confessada', gl: 'confessada', classe: 'st-confessada' },
  },
  /* Índice = weekday() do Python (0=segunda), que é o que o backend grava em
     dias_semana. Date.getDay() usa outra origem (0=domingo) — converter sempre. */
  DIAS_CURTOS: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],

  /* Glifos de categoria — SVG de linha (estilo profissional, sem emoji).
     Cada um é o miolo de um viewBox 0 0 24 24, traço = currentColor. */
  GLIFOS: {
    'saude':    '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'trabalho': '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    'estudo':   '<path d="M12 7v13"/><path d="M3 18V5a1 1 0 0 1 1-1h4a4 4 0 0 1 4 4 4 4 0 0 1 4-4h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3H4a1 1 0 0 1-1-1z"/>',
    'casa':     '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21V12h6v9"/>',
    'pessoal':  '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'combate':  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'default':  '<path d="M12 2l8 10-8 10-8-10z"/>',
  },

  _catKey(categoria) {
    return (categoria || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // "Saúde" → "saude"
  },

  /* O alfabeto do Sistema vive em js/glifos.js e é a fonte única.

     Usa a versão RICA, a mesma do lançador. Eu havia posto a versão em traço
     aqui, e o resultado foi um símbolo pobre ao lado de um símbolo rico para
     o mesmo conceito — Saúde tinha duas caras no app. O sigilo do cartão tem
     26px, espaço de sobra para as camadas respirarem.

     A tabela GLIFOS local ficou como rede de segurança: se o módulo não
     carregar, o cartão desenha o traço antigo em vez de ficar sem ícone. */
  /* A missão é um PROTOCOLO? (natureza PASSIVA)

     Vale a pena a função em vez do teste solto: são cinco lugares que
     precisam saber, e um deles esquecido significaria oferecer "Concluir"
     numa missão que se conclui sozinha — ou "Iniciar" numa que já começou
     por conta própria. */
  _ehPassiva(m) {
    return (m?.natureza || 'ATIVA').toUpperCase() === 'PASSIVA';
  },

  /* O protocolo JÁ ENTROU EM VIGOR?

     Mesma técnica do contador de prazo: o servidor manda quantos SEGUNDOS
     faltam para a vigência começar, e o navegador só soma o tempo passado
     desde a resposta. Ler `prazo_inicio` como data local daria o horário do
     relógio do hunter, e um protocolo das 16:00 apareceria aberto às 13:00
     para quem estivesse com o computador adiantado. */
  _emVigor(m) {
    if (m.prazo_ate_abrir === undefined || m.prazo_ate_abrir === null) {
      return m.prazo_abriu !== false;      // sem informação, não trava nada
    }
    const decorrido = (Date.now() - (this._recebidoEm || Date.now())) / 1000;
    return (m.prazo_ate_abrir - decorrido) <= 0;
  },

  /* Glifo do alfabeto, em traço, no tamanho de etiqueta. */
  _g(nome, tam = 12) {
    return (typeof Glifos !== 'undefined' && Glifos.existe(nome))
      ? Glifos.linha(nome, tam) : '';
  },

  _glifoCat(categoria) {
    if (typeof Glifos !== 'undefined' && Glifos.existe(this._catKey(categoria))) {
      return Glifos.rico(this._catKey(categoria), 26);
    }
    return this._glifoCatLocal(categoria);
  },

  _glifoCatLocal(categoria) {
    const paths = this.GLIFOS[this._catKey(categoria)] || this.GLIFOS.default;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  },

  /* Raio (XP) e disco de mana (moedas) — SVG, no lugar dos emojis. */
  _glifoXp() {
    return `<svg class="mc-glifo-xp" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 L4 14 h6 l-1 8 L20 9 h-6 z"/></svg>`;
  },
  _glifoMoeda() {
    return `<svg class="mc-glifo-moeda" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="8"/><path d="M12 8 L15 12 L12 16 L9 12 Z" fill="currentColor" stroke="none"/></svg>`;
  },

  /* Glifos miúdos da ficha de agenda e do chip de data. Traço fino de 1.8
     para não pesar ao lado de texto de .62rem. */
  _glifoMini(paths) {
    return `<svg class="mc-glifo-mini" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  },
  _glifoCal()     { return this._glifoMini('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>'); },
  _glifoRelogio() { return this._glifoMini('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'); },
  _glifoCiclo()   { return this._glifoMini('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'); },

  /* ── CORRENTE DE ENERGIA (só na missão em curso) ─────────
     Chevrons atravessando o fundo do cartão, da esquerda para a direita.

     Você sugeriu verde neon, e eu recomendo NÃO usar verde aqui — por uma
     regra que você mesmo estabeleceu: verde é reservado a missão CUMPRIDA e
     vermelho a fracassada. Uma missão em curso pintada de verde seria lida
     como já concluída num relance, que é exatamente o modo como se lê uma
     lista. Pelo mesmo motivo a escala de prioridade foi tirada do verde.

     Então a corrente usa a COR DA PRÓPRIA MISSÃO (`--mc-cor`): funciona como
     o neon (movimento contínuo, brilho baixo, direção clara) e ainda diz de
     que prioridade a missão é enquanto se move. Uma missão crítica em curso
     pulsa magenta; uma tranquila, azul.

     Um único elemento com uma única animação — o `background-position`
     desliza a trama inteira. Duas animações no mesmo elemento se cancelam
     nesta base de código, e já nos custou uma tarde. */
  _corrente(status) {
    if (status !== 'ATIVA') return '';
    return '<div class="mc-corrente" aria-hidden="true"></div>';
  },

  /* ── Sigilo (ícone cinético em SVG) ────────────────────── */
  _sigilo(cor, categoria) {
    return `
      <div class="mc-sigilo">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <g class="mc-sigilo-anel">
            <circle cx="50" cy="50" r="34" fill="none" stroke="${cor}" stroke-opacity=".45"
                    stroke-width="2" stroke-dasharray="9 7"/>
          </g>
          <polygon points="50,26 62,50 50,74 38,50" fill="${cor}" fill-opacity=".18"
                   stroke="${cor}" stroke-opacity=".7" stroke-width="1.5"/>
          <g class="mc-sigilo-arco">
            <circle cx="50" cy="50" r="42" fill="none" stroke="${cor}" stroke-opacity=".85"
                    stroke-width="2" stroke-dasharray="22 242" stroke-linecap="round"/>
          </g>
        </svg>
        <span class="mc-sigilo-ico">${this._glifoCat(categoria)}</span>
      </div>`;
  },

  /* ── Utilitários ─────────────────────────────────────────── */
  _alpha(hex, a) {
    const n = parseInt(String(hex).slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  },
  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  _hm(h) { return h ? String(h).slice(0, 5) : ''; },

  _hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  /* new Date("2026-07-24") é lido como UTC e, a oeste de Greenwich, volta um
     dia. Por isso a data ISO é quebrada à mão em componentes locais. */
  _dataDe(iso) {
    if (!iso) return null;
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!a || !m || !d) return null;
    return new Date(a, m - 1, d);
  },
  _ddmm(dt) {
    return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0');
  },
  /* Sem o campo data o registro é legado (rotina crua de hoje) — trata como hoje. */
  _ehHoje(m) {
    return !m || !m.data || String(m.data).slice(0, 10) === this._hojeISO();
  },

  /* ── Chave de DOM/cache ──────────────────────────────────
     ExecucaoDia.id=5 e TarefaDia.id=5 coexistem, então `id` sozinho colide.
     O contrato manda usar `uid`; `id` só sobrevive como queda de compatibilidade
     para dados antigos (a página de Rotinas ainda entrega rotina crua). */
  _chave(m, modo) {
    if (modo === 'agenda') return 'a' + m.id;
    return String(m.uid != null ? m.uid : m.id);
  },

  /* ── Prazo: devolve {texto, classe, pct} ─────────────────
     Só faz sentido para a ocorrência de HOJE: o relógio compara com o agora.
     Numa missão de ontem o contador correria para trás sem significado algum. */
  /* Instante em que este lote de missões chegou do servidor. O contador conta
     a partir DAQUI, somando o tempo que passou desde a resposta.

     Por que não usar `new Date(m.prazo_final)`: o servidor manda o horário de
     Brasília sem fuso ("2026-07-25T22:00:00"), e o navegador o interpretaria
     como horário LOCAL. Um hunter viajando, ou com o relógio do computador
     adiantado, veria um prazo diferente do que o servidor vai cobrar. Usando
     `prazo_restante` (segundos, calculado pelo servidor) mais o tempo local
     decorrido desde a resposta, o único relógio que importa é o do servidor —
     o do navegador só serve de cronômetro, e para isso ele basta. */
  _recebidoEm: 0,

  _segundosRestantes(m) {
    if (m.prazo_restante === undefined || m.prazo_restante === null) return null;
    const decorridoLocal = (Date.now() - (this._recebidoEm || Date.now())) / 1000;
    return Math.round(m.prazo_restante - decorridoLocal);
  },

  /* ── PRAZO: quanto FALTA, e quanto já se DEVE ────────────
     Três estados, e a diferença entre eles é o coração desta feature:

       no prazo  → "1h 30m 12s"  neutro
       apertado  → menos de 30 min, pulsando
       vencido   → "-10m 32s" em vermelho, NEGATIVO e continuando a crescer

     O negativo é de propósito. Uma missão vencida não vira "Prazo vencido" e
     para: ela segue contando a dívida, porque o hunter ainda pode concluí-la
     (levando a punição) e o tamanho do atraso é a informação que ele quer. */
  /* ══════════════════════════════════════════════════════════
     A VIGÍLIA — a linha tracejada que percorre o cartão INTEIRO

     Antes era uma faixa de 2px só no TOPO, com fundo tracejado
     deslizando. Ficava parecendo um cabeçalho aceso, e não uma
     vigília: uma vigília cerca, não encima.

     Agora é um retângulo em SVG por cima do cartão, com o mesmo
     tracejado correndo pelo perímetro.

     `pathLength="100"` É A PEÇA-CHAVE, e não é detalhe: ele diz ao
     navegador para tratar o contorno como se medisse 100, qualquer
     que seja o tamanho real. Sem isso, o tracejado de um cartão
     largo teria traços curtos e o de um estreito, traços longos —
     o mesmo protocolo com duas aparências dependendo da tela. Com
     ele, `stroke-dasharray="2 2.6"` significa a MESMA proporção em
     qualquer largura. É o que torna a moldura responsiva de graça.

     Duas camadas: um halo borrado por baixo e o traço nítido por
     cima. Uma linha sozinha lê como borda; com o halo, lê como
     energia parada — que é o que um protocolo é.
     ══════════════════════════════════════════════════════════ */
  _vigilia(m, chave) {
    const vigor = this._emVigor(m) && m.status !== 'CONCLUIDA' && m.status !== 'CANCELADA';
    return `
      <svg class="mc-vigia${vigor ? ' em-vigor' : ''}" data-mc-vigia="${chave}"
           aria-hidden="true" preserveAspectRatio="none" style="max-width:none">
        <rect class="mc-vigia-halo" x="1" y="1" rx="13" pathLength="100"/>
        <rect class="mc-vigia-fio"  x="1" y="1" rx="13" pathLength="100"/>
      </svg>`;
  },

  /* ── A BARRA DO PROTOCOLO ─────────────────────────────────

     Uma missão passiva não é executada: ela é ATRAVESSADA. O hunter
     não aperta nada — o tempo passa e ela se cumpre sozinha. Por
     isso a barra dela não mede "quanto falta para o prazo", e sim
     QUANTO JÁ FOI CUMPRIDO. É a única barra do app que enche sem o
     hunter fazer nada, e ver isso encher é o prêmio dela.

     Três camadas no preenchimento, e cada uma faz uma coisa:
       · a AURA — o mesmo trecho, borrado e mais alto, que vaza da
         calha. É o que dá a impressão de brilho em volta.
       · o CORPO — o degradê que clareia até a ponta.
       · a CABEÇA — o ponto de luz na frente, que pulsa. Sem ele a
         barra parece parada mesmo enquanto anda, porque o
         movimento é lento demais para o olho perceber.

     A porcentagem em texto existe porque a barra é lenta: numa
     vigília de 13 horas, um minuto move menos de 0,2% — invisível.
     O número é o que prova que está andando. */
  _barraProtocolo(m, chave, prazo) {
    const pct = Math.max(0, Math.min(100, prazo.pct || 0));
    const vigor = this._emVigor(m);
    return `
      <div class="mc-prot" data-mc-prot="${chave}">
        <div class="mc-prot-topo">
          <span class="mc-prot-lbl">${this._g('passiva', 11)} ${vigor ? 'Vigília em curso' : 'Aguardando a hora'}</span>
          <span class="mc-prot-pct" data-mc-prot-pct>${pct.toFixed(pct >= 99.5 ? 0 : 1)}%</span>
        </div>
        <div class="mc-prot-calha">
          <div class="mc-prot-aura"  data-mc-prot-fill style="width:${pct}%"></div>
          <div class="mc-prot-fill"  data-mc-prot-fill style="width:${pct}%">
            <span class="mc-prot-cabeca"></span>
          </div>
        </div>
      </div>`;
  },

  _prazo(m) {
    const seg = this._segundosRestantes(m);
    if (seg === null) return null;

    // Missão encerrada não tem corrida: o placar já é história.
    if (['CONCLUIDA', 'FRACASSADA', 'CANCELADA'].includes(m.status)) return null;

    // Reerguida: a janela foi perdida e comprada de volta. Não é mais corrida,
    // é o resto do dia — mostrar contagem regressiva aqui seria falso drama.
    if (m.reerguida) {
      return { texto: 'Reerguida — vale até 23:59', classe: 'reerguida', pct: 100, seg };
    }

    const venceu = seg < 0;
    const abs = Math.abs(seg);
    const hh = Math.floor(abs / 3600), mm = Math.floor((abs % 3600) / 60), ss = abs % 60;
    const corpo = hh > 0
      ? `${hh}h ${String(mm).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s`
      : `${mm}m ${String(ss).padStart(2, '0')}s`;

    // Fração da vigência já consumida, para a barra.
    const total = (m.prazo_minutos || 0) * 60;
    const pct = total > 0
      ? Math.min(100, Math.max(0, ((total - seg) / total) * 100))
      : (venceu ? 100 : 0);

    return {
      texto:  venceu ? `−${corpo}` : corpo,
      classe: venceu ? 'vencido' : (seg < 1800 ? 'urgente' : ''),
      pct, seg,
    };
  },

  /* ── CRONÔMETRO ──────────────────────────────────────────
     Quanto a missão levou, do play ao fim.

     Duas leituras diferentes, e é importante não confundi-las:
       • PRAZO    — quanto FALTA até o fim da janela. Conta para trás.
       • DECORRIDO — há quanto tempo a missão está em curso. Conta para frente.

     O prazo já existia. O decorrido é o que faltava: sem ele, o hunter
     concluía a missão e não ficava sabendo quanto tempo ela custou — que é
     justamente o dado que transforma execução em estatística.

     A DURAÇÃO final vem pronta do servidor (`duracao_segundos`), porque
     subtrair dois instantes lá é imune a fuso; aqui só formatamos. O contador
     ao vivo é calculado no cliente, porque precisa correr a cada segundo. */

  /* Lê um carimbo do servidor. Os horários de ciclo são gravados no fuso do
     hunter e chegam SEM sufixo de fuso — deixar o navegador adivinhar faria
     ele assumir UTC e errar por horas. Por isso quebramos à mão. */
  _instante(iso) {
    if (!iso) return null;
    const [d, h] = String(iso).split('T');
    if (!d) return null;
    const [Y, M, D] = d.split('-').map(Number);
    const [hh = 0, mm = 0, ss = 0] = (h || '').split(':').map(v => parseInt(v, 10) || 0);
    return new Date(Y, (M || 1) - 1, D || 1, hh, mm, Math.floor(ss));
  },

  _hhmm(iso) {
    const dt = this._instante(iso);
    if (!dt) return null;
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  },

  /* Duração legível. Segundos só aparecem abaixo de uma hora — "2h 14m 07s"
     é ruído; o que importa numa missão longa é a ordem de grandeza. */
  /* Duração legível — SEMPRE com os segundos.

     Esta função descartava os segundos assim que a missão passava de uma
     hora: exibia "1h 10m" e ficava ali, imóvel, por sessenta segundos. Num
     cronômetro que está correndo, um número parado não parece preciso —
     parece quebrado. O hunter olha e conclui que travou.

     O segundo é o que prova que a coisa está viva, e é justamente na missão
     longa que essa prova falta mais. Custa três caracteres.

     `tabular-nums` no CSS mantém a largura estável enquanto os dígitos
     giram; sem isso o texto ficaria dançando de um lado para o outro. */
  _dur(seg) {
    if (seg === null || seg === undefined || seg < 0) return null;
    const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    const dd = n => String(n).padStart(2, '0');
    if (h > 0) return `${h}h ${dd(m)}m ${dd(s)}s`;
    if (m > 0) return `${m}m ${dd(s)}s`;
    return `${s}s`;
  },

  _glifoRelogio() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 2"/></svg>`;
  },

  /* O bloco do cronômetro, conforme o momento da missão. */
  _cronometro(m, chave) {
    const status = m.status_hoje || m.status || 'PENDENTE';
    // PENDENTE não tem cronômetro, por definição — ela não largou.
    // Esta guarda existe porque um dado antigo com `iniciada_em` preenchido
    // fazia o cartão exibir um contador correndo há horas numa missão que
    // nunca começou. O ESTADO manda; o carimbo é só o detalhe.
    if (status === 'PENDENTE') return '';

    const ini = m.iniciada_em, fim = m.concluida_em;
    const rel = this._glifoRelogio();

    // Terminada: mostra o trajeto completo e o quanto custou.
    if (fim && ini) {
      const d = this._dur(m.duracao_segundos);
      return `<span class="mc-crono mc-crono-fim" title="Início e conclusão">
        ${rel}<b>${this._hhmm(ini)}</b><span class="mc-crono-seta">→</span><b>${this._hhmm(fim)}</b>
        ${d ? `<span class="mc-crono-dur">${d}</span>` : ''}</span>`;
    }
    // Concluída sem ter sido iniciada (o hunter pulou o play).
    if (fim) {
      return `<span class="mc-crono" title="Concluída sem cronômetro">
        ${rel}<b>${this._hhmm(fim)}</b></span>`;
    }
    // Em curso: o contador corre para frente, atualizado pelo timer global.
    if (ini) {
      const decorrido = Math.max(0, Math.floor((Date.now() - this._instante(ini)) / 1000));
      return `<span class="mc-crono mc-crono-vivo" title="Em curso desde ${this._hhmm(ini)}">
        ${rel}<b>${this._hhmm(ini)}</b>
        <span class="mc-crono-dur" data-mc-decorrido="${chave}">${this._dur(decorrido)}</span></span>`;
    }
    return '';
  },

  /* O Arquiteto vê poderes que os demais hunters não têm */
  _ehArquiteto() {
    try { return window.Auth?.getUsuario?.()?.nivel_acesso === 'Arquiteto'; }
    catch (_) { return false; }
  },

  /* ── Selo de recompensa ──────────────────────────────────
     Enquanto a missão corre, o selo mostra o PROMETIDO. Depois de fechada
     mostra o REALIZADO — que raramente bate com o prometido (bônus de streak,
     penalidade). Num card já concluído o número prometido só engana. */
  _recompensa(m, status, rotulo) {
    const primeiro = (...vs) => {
      for (const v of vs) if (v !== null && v !== undefined) return v;
      return 0;
    };
    const tit = ` title="${this._esc(rotulo || 'Recompensa da missão')}"`;

    if (status === 'CONCLUIDA') {
      const xp = primeiro(m.xp_ganho, m.xp_ganho_hoje, m.xp_recompensa);
      const mo = primeiro(m.moedas_ganhas, m.moedas_hoje, m.moedas_recompensa);
      return `<div class="mc-recompensa mc-rec-ganho" title="Recompensa recebida">
        ${this._glifoXp()}<b>+${xp}</b><span class="mc-rec-un">XP</span>
        ${mo ? `<span class="mc-rec-sep"></span>${this._glifoMoeda()}<b class="mc-rec-moeda">+${mo}</b>` : ''}
      </div>`;
    }
    if (status === 'FRACASSADA') {
      const perda = Math.abs(primeiro(m.xp_perdido, m.xp_perdido_hoje, m.penalidade_xp));
      return `<div class="mc-recompensa mc-rec-perda" title="Penalidade aplicada">
        ${this._glifoXp()}<b>−${perda}</b><span class="mc-rec-un">XP</span>
      </div>`;
    }
    return `<div class="mc-recompensa"${tit}>
      ${this._glifoXp()}<b>${m.xp_recompensa || 0}</b><span class="mc-rec-un">XP</span>
      ${m.moedas_recompensa ? `<span class="mc-rec-sep"></span>${this._glifoMoeda()}<b class="mc-rec-moeda">${m.moedas_recompensa}</b>` : ''}
    </div>`;
  },

  /* ── Desfecho em selo (usado quando não há ação possível) ── */
  _selo(status) {
    switch (status) {
      case 'CONCLUIDA':  return `<span class="mc-selo mc-selo-ok">${this._g('concluida', 13)} Missão cumprida</span>`;
      case 'FRACASSADA': return `<span class="mc-selo mc-selo-falha">${this._g('fracassada', 13)} Prazo perdido</span>`;
      case 'CANCELADA':  return `<span class="mc-selo mc-selo-neutro">${this._g('cancelada', 13)} Cancelada</span>`;
      case 'CONFESSADA': return `<span class="mc-selo mc-selo-confessado">${this._g('confessada', 13)} Confessada</span>`;
      case 'ATIVA':      return `<span class="mc-selo mc-selo-neutro">${this._g('ativa', 13)} Ficou em curso</span>`;
      case 'PAUSADA':    return `<span class="mc-selo mc-selo-neutro">${this._g('pausada', 13)} Ficou pausada</span>`;
      default:           return `<span class="mc-selo mc-selo-neutro">${this._g('pendente', 13)} Não cumprida</span>`;
    }
  },

  /* ── Ações da OCORRÊNCIA (máquina de estados) ──────────── */
  _acoes(status, chave, m = {}) {
    const b = (acao, cls, rot, extra = '') =>
      `<button class="mc-btn ${cls}" data-mc-acao="${acao}" data-mc-id="${chave}" ${extra}>${rot}</button>`;

    // Duas permissões distintas, e tratá-las como uma só criava regressão:
    //   editavel    → EXECUTAR. Só hoje: não se conclui ontem nem se adianta amanhã.
    //   gerenciavel → EDITAR/EXCLUIR. De hoje em diante.
    // O passado é histórico: fica só o selo do desfecho. Já uma missão FUTURA
    // não é executável, mas continua editável — sem isto, agendar algo para
    // amanhã produzia um cartão que ninguém mais conseguia corrigir.
    // (comparar com !== false mantém os dados legados, que não trazem os campos.)
    const podeExecutar = m.editavel    !== false;
    const podeGerir    = m.gerenciavel !== undefined
      ? m.gerenciavel !== false
      : podeExecutar;

    if (!podeExecutar && !podeGerir) return this._selo(status);

    // Extinguir: exclusivo do Arquiteto — apaga a missão e estorna
    // todo o XP/moedas que ela já concedeu. Sempre disponível.
    const extinguir = this._ehArquiteto()
      ? b('extinguir', 'mc-btn-extinguir', '⟁',
          'title="Extinguir (Arquiteto) — apaga a missão e estorna todo o XP que ela já deu"')
      : '';

    // Editar / Excluir: ações discretas delegadas à página (onAcao),
    // presentes em QUALQUER estado. Não competem com Iniciar/Concluir.
    // 'excluir' é a exclusão NORMAL — diferente do 'extinguir' do Arquiteto.
    const gerir = podeGerir
      ? b('editar',  'mc-btn-editar',  this._g('editar', 13), 'title="Editar missão"') +
        b('excluir', 'mc-btn-excluir', this._g('excluir', 13), 'title="Excluir missão"')
      : '';

    // Missão futura: existe, é ajustável, mas ainda não chegou a vez dela.
    if (!podeExecutar) {
      return `<span class="mc-selo mc-selo-neutro">${this._g('agendada', 13)} Agendada</span>` + gerir + extinguir;
    }

    // ── MISSÃO PASSIVA: tudo se inverte ─────────────────────
    // Ela não tem "Iniciar" (acende sozinha às 16:00), não tem "Concluir"
    // (cumpre-se sozinha às 05:00) e não tem "Pausar" — pausar um protocolo
    // de "sem cafeína" não quer dizer nada. O único ato disponível é o
    // oposto de todos os outros: CONFESSAR que quebrou.
    if (this._ehPassiva(m)) {
      if (status === 'CONCLUIDA') {
        // Ainda dá para confessar depois: o protocolo é de sono, e o hunter
        // pode acordar arrependido. O servidor aceita até o dia seguinte.
        return `<span class="mc-selo mc-selo-ok">${this._g('concluida', 13)} Protocolo mantido</span>`
             + b('confessar', 'mc-btn-confessar', this._g('confessada', 13),
                 'title="Quebrei o protocolo — confessar mesmo depois de encerrado"')
             + gerir + extinguir;
      }
      if (status === 'CONFESSADA') {
        return `<span class="mc-selo mc-selo-confessado">${this._g('confessada', 13)} Confessada</span>`
             + gerir + extinguir;
      }
      if (status === 'PENDENTE' || status === 'ATIVA') {
        // ANTES DA HORA NÃO HÁ O QUE CONFESSAR.
        // "Sem cafeína após as 16h" às 11:59 não foi quebrado — não começou.
        // Oferecer o botão ali convidava o hunter a registrar uma derrota
        // sobre um período que ainda não existe, e ainda cobrava a punição.
        if (!this._emVigor(m)) {
          const h = (m.hora_inicio || '').slice(0, 5);
          return `<span class="mc-selo mc-selo-espera">${this._g('pendente', 13)} `
               + `Entra em vigor${h ? ' às ' + h : ''}</span>` + gerir + extinguir;
        }
        return `<span class="mc-selo mc-selo-vigilia">${this._g('passiva', 13)} Protocolo em vigor</span>`
             + b('confessar', 'mc-btn-confessar',
                 this._g('confessada', 13) + ' Confessar',
                 'title="Admitir que quebrou o protocolo. Custa metade da punição e mantém a sequência."')
             + gerir + extinguir;
      }
    }

    let acoes;
    switch (status) {
      case 'PENDENTE':
        acoes = b('iniciar', 'mc-btn-iniciar', this._g('ativa', 13) + ' Iniciar Missão') +
                b('cancelar', 'mc-btn-neutro', this._g('cancelada', 13), 'title="Cancelar hoje"');
        break;
      case 'ATIVA':
        acoes = b('pausar', 'mc-btn-neutro', this._g('pausada', 13) + ' Pausar') +
                b('cancelar', 'mc-btn-perigo', this._g('cancelada', 13) + ' Cancelar hoje') +
                b('concluir', 'mc-btn-concluir', this._g('concluida', 13) + ' Concluir');
        break;
      case 'CONFESSADA':
        acoes = `<span class="mc-selo mc-selo-confessado">${this._g('confessada', 13)} Confessada</span>`;
        break;
      case 'PAUSADA':
        acoes = b('retomar', 'mc-btn-iniciar', this._g('ativa', 12) + ' Retomar') +
                b('cancelar', 'mc-btn-perigo', this._g('cancelada', 13) + ' Cancelar hoje') +
                b('concluir', 'mc-btn-concluir', this._g('concluida', 13) + ' Concluir');
        break;
      case 'CONCLUIDA':
        acoes = `<span class="mc-selo mc-selo-ok">${this._g('concluida', 13)} Missão cumprida</span>`;
        break;
      case 'FRACASSADA': {
        acoes = `<span class="mc-selo mc-selo-falha">${this._g('fracassada', 13)} Prazo perdido</span>`;
        // REERGUER — só faz sentido para a rotina de JANELA de HOJE que ainda
        // não foi reerguida. O hunter perdeu a corrida, mas não deveria ficar
        // sem tomar banho por causa disso: paga Mana e a missão volta a ser
        // jogável até as 23:59 — sem recompensa, porque a corrida já era.
        // A checagem final é do servidor; aqui só decidimos o que oferecer.
        if (m.origem === 'rotina' && m.prazo_janela && !m.reerguida && this._ehHoje(m)) {
          acoes += b('reerguer', 'mc-btn-reerguer',
                     this._g('ativa', 13) + ' Reerguer',
                     'title="Pagar Mana para reabrir esta missão até as 23:59. Não paga recompensa."');
        }
        break;
      }
      case 'CANCELADA':
        acoes = `<span class="mc-selo mc-selo-neutro">${this._g('cancelada', 13)} Cancelada hoje</span>` +
                b('retomar', 'mc-btn-neutro', this._g('ativa', 13) + ' Retomar');
        break;
      default:
        acoes = '';
    }
    return acoes + gerir + extinguir;
  },

  /* ── Ações da REGRA (gestão, nunca execução) ─────────────
     Uma regra não se "conclui": ela agenda. Por isso aqui só existem
     suspender/reativar, editar, excluir e o extinguir do Arquiteto.
     Os nomes 'suspender'/'reativar' são propositalmente diferentes de
     'pausar'/'retomar' para que um clique na agenda nunca caia na rota
     de execução da ocorrência do dia. */
  _acoesAgenda(chave, ativo) {
    const b = (acao, cls, rot, extra = '') =>
      `<button class="mc-btn ${cls}" data-mc-acao="${acao}" data-mc-id="${chave}"
               data-mc-modo="agenda" ${extra}>${rot}</button>`;

    const extinguir = this._ehArquiteto()
      ? b('extinguir', 'mc-btn-extinguir', '⟁',
          'title="Extinguir (Arquiteto) — apaga a regra, o histórico e estorna o XP concedido"')
      : '';

    const alternar = ativo
      ? b('suspender', 'mc-btn-neutro',  this._g('pausada', 13) + ' Suspender', 'title="A regra para de gerar missões"')
      : b('reativar',  'mc-btn-iniciar', this._g('ativa', 12) + ' Reativar',  'title="A regra volta a gerar missões"');

    return alternar +
      b('editar',  'mc-btn-editar',  this._g('editar', 13), 'title="Editar regra"') +
      b('excluir', 'mc-btn-excluir', this._g('excluir', 13), 'title="Excluir regra"') +
      extinguir;
  },

  /* ── Frequência em linguagem humana ──────────────────────
     "Seg · Qua · Sex" lê-se de relance; "[0,2,4]" não. Os atalhos
     "Dias úteis"/"Fim de semana" cobrem os dois arranjos mais comuns. */
  _frequencia(r) {
    const tipo = (r.tipo || 'DIARIA').toUpperCase();
    if (tipo === 'DIARIA') return 'Todo dia';
    if (tipo === 'SEMANAL') {
      const dias = [...new Set(r.dias_semana || [])]
        .filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
        .sort((a, b) => a - b);
      if (!dias.length)     return 'Semanal';
      if (dias.length === 7) return 'Todo dia';
      const chave = dias.join(',');
      if (chave === '0,1,2,3,4') return 'Dias úteis';
      if (chave === '5,6')       return 'Fim de semana';
      return dias.map(d => this.DIAS_CURTOS[d]).join(' · ');
    }
    if (tipo === 'MENSAL') return r.dia_mes ? `Todo dia ${r.dia_mes}` : 'Mensal';
    if (tipo === 'ANUAL') {
      const md = String(r.mes_dia || '').split('-');
      return md.length === 2 && md[0] && md[1] ? `Todo ${md[1]}/${md[0]}` : 'Anual';
    }
    if (tipo === 'AVULSA') return 'Sem repetição';
    return tipo;
  },

  /* Espelha _eh_rotina_de_hoje() do backend (rotinas.py). Se as duas
     divergirem, a agenda promete um dia em que nada será gerado. */
  _ocorreEm(r, d) {
    const tipo = (r.tipo || 'DIARIA').toUpperCase();
    if (tipo === 'DIARIA') return true;
    if (tipo === 'SEMANAL') {
      const dias = r.dias_semana || [];
      return dias.includes((d.getDay() + 6) % 7);   // Date.getDay(): 0=domingo
    }
    if (tipo === 'MENSAL') return !!r.dia_mes && d.getDate() === r.dia_mes;
    if (tipo === 'ANUAL') {
      const md = String(r.mes_dia || '').split('-');
      return md.length === 2 &&
             (d.getMonth() + 1) === Number(md[0]) && d.getDate() === Number(md[1]);
    }
    return false;   // AVULSA não se repete
  },

  /* Varredura dia a dia por até 366 dias: qualquer regra periódica cai dentro
     de um ano, e o laço é curto o bastante para rodar por cartão sem custo.
     Fórmula fechada por tipo daria o mesmo com três vezes mais casos de borda
     (dia 31 em fevereiro, 29/02 em ano comum). */
  _proxima(r) {
    if (r.ativo === false) return { texto: 'Suspensa', classe: 'ag-suspensa' };
    const d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 366; i++) {
      if (this._ocorreEm(r, d)) {
        if (i === 0) return { texto: 'Hoje',   classe: 'ag-hoje' };
        if (i === 1) return { texto: 'Amanhã', classe: 'ag-breve' };
        const dia = this.DIAS_CURTOS[(d.getDay() + 6) % 7].toLowerCase();
        return { texto: `${dia}, ${this._ddmm(d)}`, classe: '' };
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  },

  _janela(r) {
    const i = this._hm(r.hora_inicio), f = this._hm(r.hora_fim);
    if (i && f) return `${i} – ${f}`;
    if (f)      return `até ${f}`;
    if (i)      return `a partir de ${i}`;
    return '';
  },

  /* ── HTML: porta de entrada dos dois modos ─────────────── */
  html(m, opts = {}) {
    // Lembra como este cartão foi pedido, para que `repintar` o refaça igual.
    const chave = this._chave(m, opts.modo === 'agenda' ? 'agenda' : 'missao');
    this._render_opts[chave] = opts;
    return (opts.modo === 'agenda')
      ? this._htmlAgenda(m, opts)
      : this._htmlMissao(m, opts);
  },

  /* ── ASSINATURA: o que, neste cartão, JUSTIFICA repintá-lo ──
     Comparar o HTML inteiro para decidir se algo mudou parece a solução
     óbvia, e não funciona: o cartão contém um cronômetro. O texto "1h 29m
     58s" difere de "1h 29m 59s" a cada segundo, então dois cartões idênticos
     em tudo que importa nunca teriam HTML igual — e a lista se redesenharia
     de ponta a ponta a cada leitura, que é exatamente o defeito a corrigir.
     (Descobri isso executando: a primeira versão da reconciliação trocava os
     três cartões mesmo recebendo dados idênticos.)

     A assinatura lista só os campos cuja mudança altera a CARA do cartão. O
     tempo que corre não entra aqui — quem cuida dele é o timer global, que
     escreve direto no nó existente sem recriá-lo. */
  assinatura(m, opts = {}) {
    return [
      opts.compacto ? 'c' : 'n',
      opts.modo === 'agenda' ? 'a' : 'm',
      m.status_hoje || m.status || 'PENDENTE',
      m.titulo || '', m.categoria || '', m.prioridade || '', m.dificuldade || '',
      m.xp_recompensa ?? '', m.moedas_recompensa ?? '', m.penalidade_xp ?? '',
      m.xp_ganho ?? '', m.moedas_ganhas ?? '', m.xp_perdido ?? '',
      m.iniciada_em || '', m.concluida_em || '', m.fracassada_em || '', m.cancelada_em || '',
      m.reerguida ? 'R' : '', m.prazo_janela ? 'J' : '',
      m.natureza || 'ATIVA', m.confessada_em || '',
      // O protocolo muda de cara quando entra em vigor (o botão Confessar
      // aparece). Sem isto na assinatura, a reconciliação não perceberia a
      // virada das 16:00 e o cartão ficaria dizendo "entra em vigor" a noite
      // toda. É estado, não relógio — por isso entra aqui.
      this._ehPassiva(m) ? (this._emVigor(m) ? 'V' : 'v') : '',
      m.editavel ? 'E' : '', m.gerenciavel ? 'G' : '',
      m.ativo === false ? 'off' : '',
      (m.dias_semana || []).join(','), m.hora_inicio || '', m.hora_fim || '',
    ].join('|').replace(/"/g, '');
  },

  /* ── HTML da OCORRÊNCIA ──────────────────────────────────
     opts.compacto → variante FINA (usada no Extrato do Dashboard):
     mesmo componente, layout condensado numa faixa baixa. */
  _htmlMissao(m, opts = {}) {
    const compacto = opts.compacto ? ' mc-compacto' : '';
    const status = m.status_hoje || m.status || 'PENDENTE';
    const st     = this.STATUS[status] || this.STATUS.PENDENTE;
    const prior  = this.PRIORIDADES[(m.prioridade || 'MEDIA').toUpperCase()] || this.PRIORIDADES.MEDIA;
    const rank   = this.RANKS[(m.dificuldade || 'NORMAL').toUpperCase()] || this.RANKS.NORMAL;
    const prazo  = this._prazo(m);
    const chave  = this._chave(m, 'missao');
    const cor    = prior.cor;                      // ← a prioridade comanda

    // Card selado: o extrato mistura dias, e um cartão de ontem não pode
    // parecer clicável. A classe muda o visual; _acoes() corta os botões.
    const selado = m.editavel === false ? ' mc-selado' : '';

    // Chip de data: só aparece quando a missão NÃO é de hoje. Sem ele, ao
    // rolar o extrato o hunter perde a noção de qual dia está lendo.
    const dt = this._ehHoje(m) ? null : this._dataDe(m.data);
    const chipData = dt
      ? `<span class="mc-chip mc-chip-data" title="Dia desta missão">${this._glifoCal()} ${this._ddmm(dt)}</span>`
      : '';

    // Selo de recompensa — mesma marca nos dois modos. No cheio ele flutua
    // no topo direito; no compacto ele entra no FLUXO dos chips (à esquerda),
    // onde se alinha naturalmente em vez de flutuar num x variável.
    const recompensa = this._recompensa(m, status);

    // Marca de PROTOCOLO. Vai na raiz do cartão porque muda a leitura dele
    // inteira: não é um estado passageiro como "em curso", é o que a missão É.
    const passiva = this._ehPassiva(m) ? ' mc-passiva' : '';

    return `
    <div class="mc ${st.classe}${compacto}${selado}${passiva}" data-mc-card="${chave}"
         data-mc-sig="${this.assinatura(m, opts)}"
         style="--mc-cor:${cor};--mc-cor-suave:${this._alpha(cor, .14)}">
      <div class="mc-fio"></div>
      ${passiva ? this._vigilia(m, chave) : ''}
      ${this._corrente(status)}
      ${this._sigilo(cor, m.categoria)}
      <div class="mc-corpo">
        <div class="mc-topo">
          <div class="mc-titulo" title="${this._esc(m.titulo)}">${this._esc(m.titulo) || 'Missão'}</div>
          ${compacto ? '' : recompensa}
        </div>

        <div class="mc-chips">
          <span class="mc-chip mc-chip-prior">${this._g('prior_media', 11)} ${prior.rotulo}</span>
          <span class="mc-chip mc-chip-rank" title="Dificuldade ${(m.dificuldade || 'NORMAL').toLowerCase()} — XP ${rank.mult}">${this._g('prior_alta', 11)} ${rank.letra}-Rank</span>
          <span class="mc-chip mc-chip-status">${this._g(st.gl)} ${st.rotulo}</span>
          ${m.categoria ? `<span class="mc-chip mc-chip-cat">${this._esc(m.categoria)}</span>` : ''}
          ${chipData}
          ${this._cronometro(m, chave)}
          ${prazo ? `<span class="mc-div"></span>
          <span class="mc-prazo ${prazo.classe}" data-mc-prazo="${chave}">
            <span class="lbl">${this._g('ampulheta', 11)} Prazo</span> <span data-mc-timer>${prazo.texto}</span>
          </span>` : ''}
          ${compacto ? recompensa : ''}
        </div>

        ${passiva && prazo
          ? this._barraProtocolo(m, chave, prazo)
          : (prazo ? `<div class="mc-barra"><div class="mc-barra-fill" data-mc-barra="${chave}"
                     style="width:${prazo.pct}%"></div></div>` : '')}

        ${compacto ? '' : `<div class="mc-acoes">${this._acoes(status, chave, m)}</div>`}
      </div>
      ${compacto ? `<div class="mc-acoes">${this._acoes(status, chave, m)}</div>` : ''}
    </div>`;
  },

  /* ── HTML da REGRA (agenda) ──────────────────────────────
     Irmão do cartão de missão: mesmo casco, mesmo sigilo, mesmos chips.
     A diferença é o miolo — em vez de contador de prazo, uma FICHA de
     agendamento (frequência / próxima / janela). Nenhum data-mc-prazo é
     emitido aqui: regra não tem prazo, e registrar um faria o timer global
     girar de graça enquanto a tela estivesse aberta. */
  _htmlAgenda(r, opts = {}) {
    const prior = this.PRIORIDADES[(r.prioridade || 'MEDIA').toUpperCase()] || this.PRIORIDADES.MEDIA;
    const rank  = this.RANKS[(r.dificuldade || 'NORMAL').toUpperCase()] || this.RANKS.NORMAL;
    const cor   = prior.cor;
    const chave = this._chave(r, 'agenda');
    const ativo = r.ativo !== false;
    const prox  = this._proxima(r);
    const janela = this._janela(r);
    const tipo  = (r.tipo || 'DIARIA').toUpperCase();

    return `
    <div class="mc mc-agenda ${ativo ? 'ag-ativa' : 'ag-pausada'}" data-mc-card="${chave}"
         data-mc-sig="${this.assinatura(r, opts)}"
         style="--mc-cor:${cor};--mc-cor-suave:${this._alpha(cor, .14)}">
      <div class="mc-fio"></div>
      ${this._sigilo(cor, r.categoria)}
      <div class="mc-corpo">
        <div class="mc-topo">
          <div class="mc-titulo" title="${this._esc(r.titulo)}">${this._esc(r.titulo) || 'Rotina'}</div>
          ${this._recompensa(r, 'PENDENTE', 'Recompensa por ocorrência')}
        </div>

        <div class="mc-chips">
          <span class="mc-chip mc-chip-prior">${this._g('prior_media', 11)} ${prior.rotulo}</span>
          <span class="mc-chip mc-chip-rank" title="Dificuldade ${(r.dificuldade || 'NORMAL').toLowerCase()} — XP ${rank.mult}">${this._g('prior_alta', 11)} ${rank.letra}-Rank</span>
          <span class="mc-chip mc-chip-estado ${ativo ? 'on' : 'off'}">${ativo ? this._g('ativa', 12) + ' Ativa' : this._g('pausada', 12) + ' Pausada'}</span>
          ${r.categoria ? `<span class="mc-chip mc-chip-cat">${this._esc(r.categoria)}</span>` : ''}
          <span class="mc-chip mc-chip-tipo">${tipo}</span>
        </div>

        ${r.descricao ? `<div class="mc-ag-desc">${this._esc(r.descricao)}</div>` : ''}

        <div class="mc-ag-ficha">
          <div class="mc-ag-linha">
            <span class="mc-ag-rot">${this._glifoCiclo()}Frequência</span>
            <span class="mc-ag-val">${this._frequencia(r)}</span>
          </div>
          <div class="mc-ag-linha">
            <span class="mc-ag-rot">${this._glifoCal()}Próxima</span>
            <span class="mc-ag-val ${prox ? prox.classe : ''}">${prox ? prox.texto : '—'}</span>
          </div>
          ${janela ? `<div class="mc-ag-linha">
            <span class="mc-ag-rot">${this._glifoRelogio()}Janela</span>
            <span class="mc-ag-val mc-ag-num">${janela}</span>
          </div>` : ''}
        </div>

        <div class="mc-acoes">${this._acoesAgenda(chave, ativo)}</div>
      </div>
    </div>`;
  },

  /* ── Montagem: delegação de eventos + timer único ──────── */
  montar(container, opts = {}) {
    if (!container) return;
    this._onMudou = opts.onMudou || null;
    this._onAcao  = opts.onAcao || null;
    this._demo    = !!opts.demo;

    if (!container.dataset.mcBound) {
      container.dataset.mcBound = '1';
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mc-acao]');
        if (!btn) return;
        e.preventDefault();
        // A chave é STRING (uid "r123" / "a45"): parseInt aqui truncaria tudo
        // para o id numérico e reabriria a colisão que o uid resolve.
        this._executar(btn.dataset.mcAcao, btn.dataset.mcId, btn);
      });
    }
    this._iniciarTimer();
  },

  /* ── REPINTURA CIRÚRGICA ─────────────────────────────────
     Troca UM cartão no lugar, sem tocar em mais nada da tela.

     Antes, clicar em Iniciar disparava a recarga do extrato inteiro: o
     `innerHTML` do container era reescrito, todos os cartões morriam e
     renasciam, e o hunter via a lista sumir e voltar. Para uma mudança que
     afeta um cartão só, isso é derrubar a casa para trocar uma lâmpada — e
     ainda perde a posição da rolagem e qualquer animação em curso.

     `outerHTML` preserva a posição no documento: o cartão novo nasce
     exatamente onde o velho estava. O container mantém o listener, porque a
     delegação vive nele, não nos cartões. */
  repintar(chave, opts = {}) {
    const m = this._cache?.[chave];
    if (!m) return false;
    const alvo = document.querySelector(`[data-mc-card="${chave}"]`);
    if (!alvo) return false;
    alvo.outerHTML = this.html(m, opts.render || this._render_opts?.[chave] || {});
    this._iniciarTimer();          // o cartão novo pode ter prazo a correr
    return true;
  },

  /* Guarda COMO cada cartão foi desenhado (compacto, modo agenda…), para que
     a repintura o refaça igual. Sem isto, um cartão compacto do extrato
     voltaria em tamanho normal depois do primeiro clique — e a lista pularia. */
  _render_opts: {},

  /* Um único intervalo move TODOS os relógios da tela: os prazos que correm
     para trás e os cronômetros que correm para frente. Um timer por cartão
     seria dezenas de intervalos disputando o mesmo segundo. */
  _iniciarTimer() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      const prazos = document.querySelectorAll('[data-mc-prazo]');
      const cronos = document.querySelectorAll('[data-mc-decorrido]');
      // Nada para mover: o intervalo se encerra sozinho em vez de girar à toa.
      if (!prazos.length && !cronos.length) {
        clearInterval(this._timer); this._timer = null; return;
      }

      prazos.forEach(el => {
        const m = this._cache?.[el.dataset.mcPrazo];
        if (!m) return;
        const p = this._prazo(m);
        if (!p) return;
        el.querySelector('[data-mc-timer]').textContent = p.texto;
        el.classList.toggle('urgente', p.classe === 'urgente');
        el.classList.toggle('vencido', p.classe === 'vencido');
        el.classList.toggle('reerguida', p.classe === 'reerguida');
        // O rótulo troca junto: enquanto há tempo é "Prazo"; depois de vencer
        // não é mais prazo nenhum, é atraso — e o cartão deve dizer isso.
        const lbl = el.querySelector('.lbl');
        if (lbl && p.classe !== 'reerguida') {
          const texto = p.classe === 'vencido' ? 'Atraso' : 'Prazo';
          if (!lbl.textContent.includes(texto)) {
            lbl.innerHTML = this._g('ampulheta', 11) + ' ' + texto;
          }
        }
        const barra = document.querySelector(`[data-mc-barra="${el.dataset.mcPrazo}"]`);
        if (barra) barra.style.width = p.pct + '%';

        /* A barra do protocolo anda no MESMO tique do prazo. São duas
           camadas (aura e corpo) e as duas recebem a mesma largura:
           se andassem separadas, o brilho descolaria do preenchimento
           em qualquer soluço de quadro. */
        const prot = document.querySelector(`[data-mc-prot="${el.dataset.mcPrazo}"]`);
        if (prot) {
          prot.querySelectorAll('[data-mc-prot-fill]').forEach(f => { f.style.width = p.pct + '%'; });
          const n = prot.querySelector('[data-mc-prot-pct]');
          if (n) n.textContent = p.pct.toFixed(p.pct >= 99.5 ? 0 : 1) + '%';
        }
      });

      cronos.forEach(el => {
        const m = this._cache?.[el.dataset.mcDecorrido];
        if (!m || !m.iniciada_em || m.concluida_em) return;
        const ini = this._instante(m.iniciada_em);
        if (!ini) return;
        el.textContent = this._dur(Math.max(0, Math.floor((Date.now() - ini) / 1000)));
      });

      // A VIRADA DAS 16:00. Um protocolo esperando a hora precisa trocar de
      // cara sozinho quando ela chega — senão o hunter olha às 16:05 e o
      // cartão ainda diz "entra em vigor às 16:00", com o botão ausente.
      // Repinta apenas os que efetivamente viraram: comparar a assinatura
      // com a que está no DOM custa quase nada e evita repintar por nada.
      document.querySelectorAll('.mc-passiva[data-mc-card]').forEach(el => {
        const m = this._cache?.[el.dataset.mcCard];
        if (!m) return;
        const opts = this._render_opts?.[el.dataset.mcCard] || {};
        if (el.dataset.mcSig !== this.assinatura(m, opts)) this.repintar(el.dataset.mcCard);
      });
    }, 1000);
  },

  /* Encerra o timer de prazo na hora (a página chama ao sair da tela). */
  pararTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  /* ── Cache (alimenta timer, ações e diálogos) ────────────
     opts.modo  : 'missao' (uid) | 'agenda' (prefixo "a" + id da regra).
                  Os dois espaços de chave são disjuntos de propósito — uma
                  tela pode listar o extrato e a agenda ao mesmo tempo.
     opts.merge : some listas convivem na mesma tela; sem isto a segunda
                  chamada apagaria a primeira. */
  cachear(itens, opts = {}) {
    const modo = opts.modo === 'agenda' ? 'agenda' : 'missao';
    if (!opts.merge || !this._cache) this._cache = {};
    // Marca do instante da resposta: é a âncora de TODOS os contadores.
    // `prazo_restante` veio calculado pelo servidor neste momento; daqui em
    // diante o navegador só soma o tempo que passou. Assim o relógio local
    // pode estar errado que o prazo continua o do servidor.
    this._recebidoEm = Date.now();
    (itens || []).forEach(m => { this._cache[this._chave(m, modo)] = m; });
  },

  /* ── Roteamento das ações ────────────────────────────────
     ARMADILHA nº1 do contrato: `m.id` é o id da OCORRÊNCIA, mas as rotas
     /rotinas/ esperam o id da REGRA (`m.rotina_id`). Mandar m.id numa rota
     /rotinas/ age silenciosamente na rotina errada.
     O terceiro caso é o legado: registro sem `origem` vem da página de
     Rotinas, onde `m.id` ainda É o id da regra. */
  _rota(chave) {
    const m = this._cache?.[chave] || {};
    if (m.origem === 'geral')  return { m, base: '/tarefas', id: m.id,        tarefa: true  };
    if (m.origem === 'rotina') return { m, base: '/rotinas', id: m.rotina_id, tarefa: false };
    const legado = (m.id !== undefined && m.id !== null) ? m.id : parseInt(chave, 10);
    return { m, base: '/rotinas', id: legado, tarefa: false };
  },

  /* ── Execução das ações contra a API real ──────────────── */
  async _executar(acao, chave, btn) {
    if (btn?.dataset?.mcModo === 'agenda') return this._executarAgenda(acao, chave, btn);

    const { m, base, id, tarefa } = this._rota(chave);

    // Editar / Excluir (normal): o card não resolve — delega à página.
    // NÃO toca a API. (Não confundir com 'extinguir', do Arquiteto.)
    if (acao === 'editar' || acao === 'excluir') {
      this._onAcao && this._onAcao(acao, id, m, chave);
      return;
    }
    // Extinguir é irreversível: confirma ANTES de qualquer coisa
    if (acao === 'extinguir') return this._extinguir(chave);
    // Reerguer COBRA MANA, então também confirma antes — e a confirmação
    // precisa dizer as duas coisas que o hunter vai querer saber depois:
    // que custa, e que não paga.
    if (acao === 'reerguer') return this._reerguer(chave, btn);
    if (acao === 'confessar') return this._confessar(chave, btn);
    if (this._demo) return this._demoTransicao(acao, chave);

    // Trava de segurança: origem "rotina" sem rotina_id significa que a lista
    // não foi cacheada (ou veio malformada). Disparar assim mandaria a ação
    // para /rotinas/undefined — ou, pior, para a rotina errada num retry.
    if (!Number.isFinite(Number(id))) {
      SoloDialog?.toast?.('Não consegui identificar a missão — recarregue a lista.', 'error');
      return;
    }

    const card = document.querySelector(`[data-mc-card="${chave}"]`);
    btn.disabled = true;
    try {
      let resp;
      switch (acao) {
        case 'iniciar':  resp = await API.post(`${base}/${id}/iniciar`, {});  break;
        case 'pausar':   resp = await API.post(`${base}/${id}/pausar`, {});   break;
        case 'retomar':  resp = await API.post(`${base}/${id}/retomar`, {});  break;
        case 'cancelar': resp = await API.post(`${base}/${id}/cancelar`, {}); break;
        case 'concluir':
          // Tarefa fecha por rota própria; rotina fecha pela Execução, que é
          // quem grava streak e bônus.
          resp = tarefa ? await API.post(`/tarefas/${id}/concluir`, {})
                        : await API.execucoes.concluirRotina(id);
          if (typeof missionComplete === 'function' && card) {
            // As duas rotas premiam em envelopes diferentes: a tarefa devolve
            // {tarefa, resultado} e a rotina devolve o ganho na raiz. Sem
            // olhar os dois, a comemoração de toda missão geral saía "+0 XP".
            const g = resp?.resultado || resp || {};
            missionComplete(card, g.xp_ganho || 0, g.moedas_ganhas || 0);
          }
          break;
      }

      // O SERVIDOR JÁ DISSE COMO A MISSÃO FICOU — usa isso e repinta este
      // cartão, em vez de mandar a página inteira recarregar para descobrir.
      // É a diferença entre a lista piscar e o botão simplesmente virar.
      this._absorver(chave, acao, resp);
      this.repintar(chave);

      if (this._onMudou) await this._onMudou(resp, acao, id, chave);
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  /* Costura a resposta da API de volta no cache.

     As rotas respondem em formatos diferentes — /tarefas/ devolve a tarefa
     crua, /execucoes/rotina devolve {rotina_id, resultado, liquidacao} — e
     nenhuma delas fala a língua do extrato (`uid`, `origem`, `prazo_*`).
     Por isso não dá para trocar o objeto: costuramos campo a campo.

     Quando a resposta não traz o campo, o estado é DEDUZIDO da ação. É o
     mesmo que o servidor acabou de fazer, e vale mais que ficar com o cartão
     desatualizado esperando a próxima leitura. A leitura seguinte reconcilia
     de qualquer forma. */
  _absorver(chave, acao, resp) {
    const m = this._cache?.[chave];
    if (!m) return;
    const agora = new Date().toISOString().slice(0, 19);
    const corpo = (resp && (resp.tarefa || resp)) || {};

    switch (acao) {
      case 'iniciar':
        m.status = 'ATIVA';
        m.iniciada_em = corpo.iniciada_em || m.iniciada_em || agora;
        break;
      case 'pausar':   m.status = 'PAUSADA'; break;
      case 'retomar':  m.status = 'ATIVA';   break;
      case 'cancelar':
        m.status = 'CANCELADA';
        m.cancelada_em = corpo.cancelada_em || agora;
        break;
      case 'concluir': {
        m.status = 'CONCLUIDA';
        m.concluida_em = corpo.concluida_em || agora;
        const g = resp?.resultado || {};
        m.xp_ganho      = g.xp_ganho      ?? m.xp_ganho ?? 0;
        m.moedas_ganhas = g.moedas_ganhas ?? m.moedas_ganhas ?? 0;
        // A liquidação diz se foi no prazo, atrasada ou reerguida — o cartão
        // precisa saber para não exibir recompensa que não foi paga.
        if (resp?.liquidacao) m.xp_perdido = resp.liquidacao.penalidade || 0;
        break;
      }
      case 'reerguer':
        m.status = 'PENDENTE';
        m.reerguida = true;
        m.iniciada_em = null;
        m.fracassada_em = null;
        break;
      case 'confessar':
        m.status = 'CONFESSADA';
        m.confessada_em = agora;
        m.concluida_em = null;
        // A recompensa some: ou nunca foi paga, ou o servidor acabou de
        // estornar. Deixar o número antigo no cartão seria mentir sobre o
        // saldo logo depois de o hunter ter sido honesto.
        m.xp_ganho = 0;
        m.moedas_ganhas = 0;
        m.xp_perdido = resp?.liquidacao?.penalidade || 0;
        break;
    }
    // `status_hoje` é o nome do campo em registros vindos da página Rotinas.
    // Deixar os dois em desacordo faria o cartão ler o antigo e "voltar".
    if ('status_hoje' in m) m.status_hoje = m.status;
  },

  /* ── REERGUER ────────────────────────────────────────────
     A segunda chance que custa Mana.

     Confirmação obrigatória, e o texto diz as duas coisas que o hunter só
     descobriria depois: quanto custa, e que a missão reerguida NÃO paga
     recompensa. Um botão que gasta moeda sem avisar é uma armadilha.

     `SoloDialog` é um `const` de topo, não uma propriedade de window — testar
     `window.SoloDialog` daria falso. E o fallback é `false`: sem diálogo
     disponível, NÃO se gasta a Mana do hunter por conta própria. */
  async _reerguer(chave, btn) {
    const m = this._cache?.[chave] || {};
    const confirmado = (typeof SoloDialog !== 'undefined' && SoloDialog.confirmar)
      ? await SoloDialog.confirmar({
          titulo: 'Reerguer a missão?',
          texto: `"${m.titulo}" perdeu a janela de hoje. Reerguer custa Mana e `
               + 'devolve a missão até as 23:59 — mas ela não paga XP nem Mana '
               + 'ao ser concluída. O ganho é ter feito.',
          confirmar: 'Pagar e reerguer',
          cancelar: 'Deixar como está',
        })
      : false;
    if (!confirmado) return;

    btn.disabled = true;
    try {
      const resp = await API.post('/execucoes/reerguer', { execucao_id: m.id });
      SoloDialog?.toast?.(resp?.mensagem || 'Missão reerguida.', 'success');
      this._absorver(chave, 'reerguer', resp);
      this.repintar(chave);
      if (this._onMudou) await this._onMudou(resp, 'reerguer', m.id, chave);
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  /* ── CONFESSAR ───────────────────────────────────────────
     O único jeito de uma missão passiva falhar, e o hunter é quem aperta.

     A confirmação existe por um motivo diferente da do Reerguer: lá era
     porque gasta moeda; aqui é porque o ato é irreversível e ninguém o
     obrigou a isso. Vale dizer, no texto, que confessar é barato — senão o
     hunter hesita achando que vai perder a sequência, e a hesitação é
     exatamente o que produz o registro falso. */
  async _confessar(chave, btn) {
    const m = this._cache?.[chave] || {};
    const jaEncerrada = (m.status || '') === 'CONCLUIDA';
    const confirmado = (typeof SoloDialog !== 'undefined' && SoloDialog.confirmar)
      ? await SoloDialog.confirmar({
          titulo: 'Confessar?',
          texto: `"${m.titulo}" — você quebrou o protocolo. Confessar custa `
               + 'metade da punição e NÃO quebra sua sequência. '
               + (jaEncerrada
                   ? 'Como ela já havia sido encerrada, a recompensa recebida será devolvida.'
                   : 'Ninguém além de você saberia — e é por isso que isto vale.'),
          confirmar: 'Confessar',
          cancelar: 'Deixar como está',
        })
      : false;
    if (!confirmado) return;

    btn.disabled = true;
    try {
      const resp = await API.post('/execucoes/confessar', { execucao_id: m.id });
      SoloDialog?.toast?.(resp?.mensagem || 'Confissão registrada.', 'info');
      this._absorver(chave, 'confessar', resp);
      this.repintar(chave);
      if (this._onMudou) await this._onMudou(resp, 'confessar', m.id, chave);
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  /* ── Execução das ações da AGENDA ────────────────────────
     Suspender/reativar são um simples toque no campo `ativo`, então o card
     resolve sozinho e repinta só o próprio cartão — recarregar a lista
     inteira por um toggle seria desproporcional. Editar e excluir continuam
     com a página, que é quem tem o formulário e o diálogo de confirmação. */
  async _executarAgenda(acao, chave, btn) {
    const r  = this._cache?.[chave] || {};
    const id = r.id !== undefined ? r.id : parseInt(String(chave).slice(1), 10);

    if (acao === 'editar' || acao === 'excluir') {
      this._onAcao && this._onAcao(acao, id, r, chave);
      return;
    }
    if (acao === 'extinguir') return this._extinguir(chave, { agenda: true });
    if (acao !== 'suspender' && acao !== 'reativar') return;

    const ativo = (acao === 'reativar');
    btn.disabled = true;
    try {
      if (!this._demo) await API.put(`/rotinas/${id}`, { ativo });
      r.ativo = ativo;
      const card = document.querySelector(`[data-mc-card="${chave}"]`);
      if (card) card.outerHTML = this.html(r, { modo: 'agenda' });
      SoloDialog?.toast?.(ativo ? 'Regra reativada — volta a gerar missões.'
                                : 'Regra suspensa — não gera novas missões.', 'info');
      if (this._onMudou) await this._onMudou(null, acao, id, chave);
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
      btn.disabled = false;
    }
  },

  /* ── Extinguir (Arquiteto): apaga e estorna o XP ─────────
     Na agenda o alvo é a REGRA inteira; no extrato de origem "rotina" o
     backend também só expõe DELETE da regra — logo o texto avisa que o
     histórico vai junto. */
  async _extinguir(chave, opts = {}) {
    const agenda = !!opts.agenda;
    const alvo = agenda
      ? { m: this._cache?.[chave] || {}, base: '/rotinas',
          id: (this._cache?.[chave]?.id ?? parseInt(String(chave).slice(1), 10)) }
      : this._rota(chave);
    const m = alvo.m || {};
    const rotulo = agenda ? 'esta rotina' : 'esta missão';

    const ok = await SoloDialog.confirm(
      `Extinguir <b>"${this._esc(m.titulo) || rotulo}"</b> da existência?<br><br>` +
      `<span style="color:#f87171">Isto apaga ${agenda ? 'a rotina' : 'a missão'}, todo o seu histórico e ` +
      `<b>estorna o XP e as moedas</b> que ela já concedeu.</span><br>` +
      `<span style="color:#94a3b8;font-size:.8rem">Poder exclusivo do Arquiteto · irreversível</span>`,
      { titulo: agenda ? 'Extinguir Rotina' : 'Extinguir Missão', tipo: 'error', icon: '⟁',
        btnOk: 'Extinguir', btnCancel: 'Manter' }
    );
    if (!ok) return;

    const card = document.querySelector(`[data-mc-card="${chave}"]`);
    try {
      if (!this._demo) await API.delete(`${alvo.base}/${alvo.id}?extinguir=true`);
      // Dissolução: o cartão se desfaz antes de sumir
      if (card) {
        card.classList.add('mc-extinguindo');
        if (typeof SFX !== 'undefined') SFX.play('carimbo');
        setTimeout(() => card.remove(), 700);
      }
      if (this._cache) delete this._cache[chave];
      SoloDialog?.toast?.(agenda ? '⟁ Rotina extinta — XP estornado'
                                 : '⟁ Missão extinta — XP estornado', 'info');
      if (!this._demo && this._onMudou) {
        setTimeout(() => this._onMudou(null, 'extinguir', alvo.id, chave), 750);
      }
    } catch (err) {
      SoloDialog?.toast?.(err.message || String(err), 'error');
    }
  },

  /* Modo demonstração (Forja): transita o estado sem tocar a API */
  _demoTransicao(acao, chave) {
    const proximo = {
      iniciar: 'ATIVA', retomar: 'ATIVA', pausar: 'PAUSADA',
      cancelar: 'CANCELADA', concluir: 'CONCLUIDA',
    }[acao];
    const m = this._cache?.[chave];
    if (!m || !proximo) return;
    m.status_hoje = proximo;
    const card = document.querySelector(`[data-mc-card="${chave}"]`);
    if (card) {
      // Repinta preservando a variante: sem isto, um cartão do extrato
      // voltaria em tamanho cheio no meio da faixa fina.
      const compacto = card.classList.contains('mc-compacto');
      card.outerHTML = this.html(m, { compacto });
      if (acao === 'concluir' && typeof createSparks === 'function') {
        const novo = document.querySelector(`[data-mc-card="${chave}"]`);
        const r = novo?.getBoundingClientRect();
        if (r) createSparks(r.right - 80, r.top + r.height / 2, 12);
        if (typeof SFX !== 'undefined') SFX.play('carimbo');
      }
    }
  },
};

window.MissaoCard = MissaoCard;
