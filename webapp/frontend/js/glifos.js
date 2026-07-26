/* ============================================================
   glifos.js — O alfabeto visual do Sistema

   POR QUE EXISTE

   O lançador usava ~25 emojis. Emoji não é ilustração: cada
   sistema operacional desenha o seu, a cor não obedece ao tema,
   o peso não combina com o traço do app, e o mesmo símbolo muda
   de cara entre o Windows e o celular do hunter.

   Mas trocar por "SVG detalhado" só no lançador criaria um
   problema pior: o cartão de missão JÁ tinha um conjunto de
   glifos de categoria em traço simples. Saúde viraria uma
   ilustração rica no lançador e um traço no cartão — dois
   sistemas visuais para o mesmo conceito.

   Então: UM alfabeto, DUAS densidades.

     rico(nome)   → 28-32px. Camadas, profundidade, brilho.
                    Para o lançador, onde o ícone é protagonista.
     linha(nome)  → 12-16px. Só a silhueta, em traço.
                    Para o cartão, onde ele é etiqueta.

   A SILHUETA É A MESMA nos dois. O hunter reconhece o símbolo
   de Saúde tanto na ficha grande quanto no chip pequeno — que é
   o que faz um alfabeto ser alfabeto, e não um monte de desenhos.

   Todos usam `currentColor`, então quem manda na cor é o CSS de
   quem chama. Nenhum hex fixo aqui dentro.
   ============================================================ */

const Glifos = {

  /* Cada entrada tem:
       base  — massa de fundo, preenchida com pouca opacidade (dá corpo)
       traco — o contorno principal, a silhueta que define o símbolo
       luz   — realces finos que só aparecem no tamanho grande
     A versão em linha usa SÓ `traco`. */
  _G: {

    /* ── Natureza da missão ───────────────────────────────── */
    rotina: {   // ciclo que se repete
      base: '<circle cx="12" cy="12" r="9"/>',
      traco: '<path d="M20 12a8 8 0 0 1-8 8 8 8 0 0 1-7-4.2"/>'
           + '<path d="M4 12a8 8 0 0 1 8-8 8 8 0 0 1 7 4.2"/>'
           + '<path d="M19 3.5v4.7h-4.7"/><path d="M5 20.5v-4.7h4.7"/>',
      luz: '<circle cx="12" cy="12" r="2.6" opacity=".55"/>',
    },
    avulsa: {   // pergaminho de uso único
      base: '<path d="M6 2.5h8.5L19 7v14.5H6z"/>',
      traco: '<path d="M14.2 2.6v4.6h4.6"/>'
           + '<path d="M6.2 2.6h8.2L18.8 7v14.4H6.2z"/>'
           + '<path d="M9 12.5h6M9 16h4.5"/>',
      luz: '<path d="M9 9h3" opacity=".6"/>',
    },

    /* ── Frequência ───────────────────────────────────────── */
    diaria: {   // sol nascendo sobre o horizonte
      base: '<circle cx="12" cy="13" r="4.2"/>',
      traco: '<path d="M2.5 18.5h19"/><path d="M7.8 13a4.2 4.2 0 0 1 8.4 0"/>'
           + '<path d="M12 3.2v2.6M4.6 6l1.9 1.9M19.4 6l-1.9 1.9M2.6 13h2.4M19 13h2.4"/>',
      luz: '<path d="M9.6 13a2.4 2.4 0 0 1 4.8 0" opacity=".7"/>',
    },
    semanal: {  // calendário com a semana marcada
      base: '<rect x="3" y="5" width="18" height="16" rx="2"/>',
      traco: '<rect x="3.2" y="5.2" width="17.6" height="15.6" rx="2"/>'
           + '<path d="M3.2 9.8h17.6"/><path d="M8 3v4M16 3v4"/>',
      luz: '<rect x="6.2" y="12.4" width="11.6" height="2.4" rx="1.2" opacity=".65"/>',
    },
    mensal: {   // calendário cheio, o mês inteiro
      base: '<rect x="3" y="5" width="18" height="16" rx="2"/>',
      traco: '<rect x="3.2" y="5.2" width="17.6" height="15.6" rx="2"/>'
           + '<path d="M3.2 9.8h17.6"/><path d="M8 3v4M16 3v4"/>',
      luz: '<g opacity=".7"><circle cx="7.5" cy="13" r="1"/><circle cx="12" cy="13" r="1"/>'
         + '<circle cx="16.5" cy="13" r="1"/><circle cx="7.5" cy="17" r="1"/>'
         + '<circle cx="12" cy="17" r="1"/></g>',
    },
    anual: {    // alvo distante — a data que vem uma vez só
      base: '<circle cx="12" cy="12" r="9"/>',
      traco: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="5"/>',
      luz: '<circle cx="12" cy="12" r="1.9" opacity=".9"/>',
    },

    /* ── Prioridade — chama que cresce com a urgência ─────── */
    prior_baixa: {
      base: '<circle cx="12" cy="12" r="7"/>',
      traco: '<circle cx="12" cy="12" r="7.2"/><path d="M8.8 12h6.4"/>',
      luz: '',
    },
    prior_media: {
      base: '<circle cx="12" cy="12" r="7"/>',
      traco: '<circle cx="12" cy="12" r="7.2"/><path d="M12 8.4v7.2M8.4 12h7.2"/>',
      luz: '',
    },
    prior_alta: {
      base: '<path d="M12 3l2.6 6.2 6.4.5-4.9 4.2 1.5 6.3L12 16.9 6.4 20.2l1.5-6.3L3 9.7l6.4-.5z"/>',
      traco: '<path d="M12 3.4l2.5 5.9 6.1.5-4.7 4 1.5 6L12 16.6 6.6 19.8l1.5-6-4.7-4 6.1-.5z"/>',
      luz: '<path d="M12 7.4l1.2 2.9 3 .3-2.3 2" opacity=".7"/>',
    },
    prior_critica: {
      base: '<path d="M12 2.6l9.4 16.3H2.6z"/>',
      traco: '<path d="M12 3.2l8.9 15.4H3.1z"/><path d="M12 9v4.4"/>',
      luz: '<circle cx="12" cy="16" r="1" opacity=".95"/>',
    },

    /* ── Dificuldade — o peso do desafio ──────────────────── */
    dific_facil: {   // pluma
      base: '<path d="M19 4c-7 0-12 4.6-12 10.4L5 20"/>',
      traco: '<path d="M19.2 4.2c-7.2 0-12.2 4.7-12.2 10.6L4.8 20.2"/>'
           + '<path d="M19.2 4.2c0 6.4-4.4 10.6-10.4 10.6"/>',
      luz: '<path d="M16 7.4c-3.4.5-6 2.4-7.3 5" opacity=".65"/>',
    },
    dific_normal: {  // raio
      base: '<path d="M13.4 2.2 4.6 13.6h6l-1.2 8.2 9-11.6h-6z"/>',
      traco: '<path d="M13.2 2.6 5 13.4h5.9l-1.1 7.8 8.2-10.8h-5.8z"/>',
      luz: '<path d="M11.4 6.6 8.6 10.4h2.6" opacity=".7"/>',
    },
    dific_dificil: { // chama dupla
      base: '<path d="M12 2.4c3 3.6 5.6 6 5.6 9.6a5.6 5.6 0 0 1-11.2 0c0-3.6 2.6-6 5.6-9.6z"/>',
      traco: '<path d="M12 3c2.9 3.4 5.3 5.8 5.3 9.2a5.3 5.3 0 0 1-10.6 0C6.7 8.8 9.1 6.4 12 3z"/>',
      luz: '<path d="M12 11.4c1.3 1.5 2.2 2.5 2.2 3.9a2.2 2.2 0 0 1-4.4 0c0-1.4.9-2.4 2.2-3.9z" opacity=".85"/>',
    },
    dific_lendario: { // crânio coroado
      base: '<path d="M5 11a7 7 0 0 1 14 0v3.4l-1.6 1.3v2.9H6.6v-2.9L5 14.4z"/>',
      traco: '<path d="M5.2 11.2a6.8 6.8 0 0 1 13.6 0v3.2l-1.6 1.3v2.9H6.8v-2.9l-1.6-1.3z"/>'
           + '<path d="M10 19v2.4M14 19v2.4"/>',
      luz: '<g opacity=".95"><circle cx="9.2" cy="11.6" r="1.7"/><circle cx="14.8" cy="11.6" r="1.7"/>'
         + '<path d="M12 14.4v1.8"/></g>',
    },

    /* ── Categorias — mesma silhueta do cartão ────────────── */
    saude: {    // batimento
      base: '<circle cx="12" cy="12" r="9.2"/>',
      traco: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
      luz: '<circle cx="15" cy="21" r="1" opacity=".8"/>',
    },
    trabalho: { // maleta
      base: '<rect x="2" y="7" width="20" height="14" rx="2"/>',
      traco: '<rect x="2.2" y="7.2" width="19.6" height="13.6" rx="2"/>'
           + '<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
      luz: '<path d="M2.2 12.6h19.6" opacity=".6"/>',
    },
    estudo: {   // livro aberto
      base: '<path d="M3 5h5.5A3.5 3.5 0 0 1 12 8.5V19H3z"/>',
      traco: '<path d="M12 7v13"/>'
           + '<path d="M3 18V5a1 1 0 0 1 1-1h4a4 4 0 0 1 4 4 4 4 0 0 1 4-4h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3H4a1 1 0 0 1-1-1z"/>',
      luz: '<path d="M5.6 8h3.6M5.6 11h3.2" opacity=".6"/>',
    },
    casa: {     // telhado e porta
      base: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      traco: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
           + '<path d="M9 21V12h6v9"/>',
      luz: '<path d="M12 4.6 5.2 10" opacity=".55"/>',
    },
    pessoal: {  // busto
      base: '<circle cx="12" cy="7" r="4.2"/>',
      traco: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      luz: '<path d="M9.6 5.6a3 3 0 0 1 2.4-1.2" opacity=".7"/>',
    },
    combate: {  // escudo
      base: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      traco: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      luz: '<path d="M12 6.4v9.4M8.6 10h6.8" opacity=".8"/>',
    },

    /* ── Missão passiva e confissão ───────────────────────── */
    passiva: {    // olho vigilante dentro de um escudo — o protocolo velando
      base: '<path d="M12 21.4c4.8-2 7.4-5.6 7.4-9.6V5.6L12 2.8 4.6 5.6v6.2c0 4 2.6 7.6 7.4 9.6z"/>',
      traco: '<path d="M12 21.4c4.8-2 7.4-5.6 7.4-9.6V5.6L12 2.8 4.6 5.6v6.2c0 4 2.6 7.6 7.4 9.6z"/>'
           + '<path d="M7.4 11.6c1.4-2 2.9-3 4.6-3s3.2 1 4.6 3c-1.4 2-2.9 3-4.6 3s-3.2-1-4.6-3z"/>',
      luz: '<circle cx="12" cy="11.6" r="1.5" opacity=".95"/>',
    },
    confessada: { // mão erguida sobre uma linha — quem se entrega
      base: '',
      traco: '<path d="M12 3.2v7.4"/><path d="M9.2 5.6 12 3.2l2.8 2.4"/>'
           + '<path d="M4.6 13.4h14.8"/>'
           + '<path d="M6.8 13.4v3.2a5.2 5.2 0 0 0 10.4 0v-3.2"/>',
      luz: '<path d="M12 17.2v2.6" opacity=".85"/>',
    },

    /* ── Estados e ações do cartão ────────────────────────── */
    pendente: {   // ampulheta parada — ainda não largou
      base: '',
      traco: '<path d="M7 3.2h10M7 20.8h10"/>'
           + '<path d="M8 3.2v3.6L12 12l-4 5.2v3.6"/><path d="M16 3.2v3.6L12 12l4 5.2v3.6"/>',
      luz: '<path d="M10 18.8h4" opacity=".9"/>',
    },
    ativa: {      // triângulo de execução
      base: '<circle cx="12" cy="12" r="9"/>',
      traco: '<circle cx="12" cy="12" r="8.6"/><path d="M10 8.4 16 12l-6 3.6z"/>',
      luz: '',
    },
    pausada: {
      base: '<circle cx="12" cy="12" r="9"/>',
      traco: '<circle cx="12" cy="12" r="8.6"/><path d="M10 8.8v6.4M14 8.8v6.4"/>',
      luz: '',
    },
    concluida: {  // selo com marca
      base: '<circle cx="12" cy="12" r="9"/>',
      traco: '<circle cx="12" cy="12" r="8.6"/><path d="M7.8 12.2 10.8 15.2 16.2 9.4"/>',
      luz: '',
    },
    fracassada: { // cruz de derrota, não caveira
      base: '<circle cx="12" cy="12" r="9"/>',
      traco: '<circle cx="12" cy="12" r="8.6"/><path d="M8.6 8.6 15.4 15.4M15.4 8.6 8.6 15.4"/>',
      luz: '',
    },
    cancelada: {  // círculo cortado
      base: '<circle cx="12" cy="12" r="9"/>',
      traco: '<circle cx="12" cy="12" r="8.6"/><path d="M6.4 17.6 17.6 6.4"/>',
      luz: '',
    },
    editar: {     // estilete
      base: '',
      traco: '<path d="M15.6 3.9a2.1 2.1 0 0 1 3 3L8.4 17.1l-4 1 1-4z"/>'
           + '<path d="M13.9 5.6l3 3"/>',
      luz: '',
    },
    excluir: {    // urna
      base: '<path d="M5.6 7.4h12.8l-1 12.2a1.6 1.6 0 0 1-1.6 1.4H8.2a1.6 1.6 0 0 1-1.6-1.4z"/>',
      traco: '<path d="M3.8 7.4h16.4"/>'
           + '<path d="M5.8 7.4 6.8 19.6a1.6 1.6 0 0 0 1.6 1.4h7.2a1.6 1.6 0 0 0 1.6-1.4L18.2 7.4"/>'
           + '<path d="M9.4 7.4V5a1.4 1.4 0 0 1 1.4-1.4h2.4A1.4 1.4 0 0 1 14.6 5v2.4"/>'
           + '<path d="M10.4 11.2v5.6M13.6 11.2v5.6"/>',
      luz: '',
    },
    agendada: {   // calendário com seta adiante
      base: '<rect x="3" y="5" width="18" height="16" rx="2"/>',
      traco: '<rect x="3.2" y="5.2" width="17.6" height="15.6" rx="2"/>'
           + '<path d="M3.2 9.8h17.6M8 3v4M16 3v4"/>',
      luz: '<path d="M10 15.2h5M13 13.2l2 2-2 2" opacity=".9"/>',
    },
    /* ── Utilitários ──────────────────────────────────────── */
    titulo: {   // lâminas cruzadas
      base: '',
      traco: '<path d="M3.5 3.5 14 14M20.5 3.5 10 14"/>'
           + '<path d="M6.2 20.4 9 17.6M17.8 20.4 15 17.6"/>'
           + '<path d="M8.4 15.6 5.2 18.8a2 2 0 0 0 2.8 2.8l3.2-3.2"/>'
           + '<path d="M15.6 15.6l3.2 3.2a2 2 0 0 1-2.8 2.8l-3.2-3.2"/>',
      luz: '',
    },
    relogio: {
      /* Mostrador com bisel, marcas de hora e ponteiros em 10h10 — a posição
         clássica dos relojoeiros, porque abre o mostrador em V e deixa a
         marca das 12h respirando. Simétrico no eixo vertical; os ponteiros
         são a única quebra, e é ela que dá vida ao desenho. */
      base: '<circle cx="12" cy="12.6" r="8.4"/>',
      traco: '<circle cx="12" cy="12.6" r="8.4"/>'
           // marcas das 12, 3, 6 e 9
           + '<path d="M12 5.4v1.5M12 18.3v1.5M4.8 12.6h1.5M17.7 12.6h1.5"/>'
           // ponteiros: hora às 10, minuto às 2
           + '<path d="M12 12.6 8.9 10.3M12 12.6l3.5-2.6"/>',
      luz: '<circle cx="12" cy="12.6" r="1" opacity=".95"/>'
         // pés e coroa do despertador, espelhados
         + '<path d="M6.6 19.4 5.2 21M17.4 19.4 18.8 21M12 4.2V2.8" '
         + 'stroke-linecap="round" fill="none" opacity=".85"/>',
    },
    ampulheta: {  // duração / tempo escorrendo
      base: '<path d="M7 3h10v3.4L12 12l5 5.6V21H7v-3.4L12 12 7 6.4z"/>',
      traco: '<path d="M6.6 2.8h10.8M6.6 21.2h10.8"/>'
           + '<path d="M7.4 2.8v3.8L12 12l-4.6 5.4v3.8"/>'
           + '<path d="M16.6 2.8v3.8L12 12l4.6 5.4v3.8"/>',
      luz: '<path d="M10 18.6h4" opacity=".8"/>',
    },
    bigorna: {  // forjar
      /* Simétrica em torno de x=12 e centrada no viewBox. A versão anterior
         era uma bigorna "de perfil", com o chifre só de um lado — dentro de
         um botão, ao lado de um texto centralizado, ela puxava o peso visual
         para a esquerda e parecia torta. Aqui: bigorna de frente (bloco →
         cintura → base → pés), com faíscas simétricas acima. */
      /* Ocupa y de 3.6 a 20.4 — centrado no viewBox de 24. A primeira versão
         começava em 0.9 e terminava em 20.5, encostada no topo e com folga
         embaixo; num botão isso lê como se o ícone estivesse subindo. */
      base: '<rect x="3.6" y="9.4" width="16.8" height="3.2" rx="1.1"/>'
          + '<rect x="6.4" y="16.0" width="11.2" height="2.5" rx=".9"/>',
      traco: '<rect x="3.6" y="9.4" width="16.8" height="3.2" rx="1.1"/>'
           + '<path d="M9.6 12.6 10.7 16h2.6l1.1-3.4"/>'
           + '<rect x="6.4" y="16.0" width="11.2" height="2.5" rx=".9"/>'
           + '<rect x="8.6" y="18.5" width="6.8" height="1.9" rx=".6"/>',
      // Faíscas do martelo, espelhadas — reforçam o "forjar" sem quebrar o eixo.
      luz: '<path d="M12 3.6v2.2M9.4 4.7l1.2 1.5M14.6 4.7l-1.2 1.5" opacity=".9"/>',
    },
    olho: {     // prévia
      base: '<path d="M1.6 12S5.4 4.8 12 4.8 22.4 12 22.4 12 18.6 19.2 12 19.2 1.6 12 1.6 12z"/>',
      traco: '<path d="M1.8 12S5.5 5 12 5s10.2 7 10.2 7-3.7 7-10.2 7S1.8 12 1.8 12z"/>'
           + '<circle cx="12" cy="12" r="3.2"/>',
      luz: '<circle cx="10.9" cy="10.9" r="1" opacity=".9"/>',
    },
    xp: {       // raio de energia
      base: '<path d="M13.4 2.2 4.6 13.6h6l-1.2 8.2 9-11.6h-6z"/>',
      traco: '<path d="M13.2 2.6 5 13.4h5.9l-1.1 7.8 8.2-10.8h-5.8z"/>',
      luz: '',
    },
    moeda: {
      base: '<circle cx="12" cy="12" r="8.4"/>',
      traco: '<circle cx="12" cy="12" r="8.2"/>',
      luz: '<path d="M12 7.4 15.4 12 12 16.6 8.6 12z" opacity=".95"/>',
    },
    etiqueta: {
      base: '<path d="M3 3h8.6L21 12.4 12.4 21 3 11.6z"/>',
      traco: '<path d="M3.2 3.2h8.3l9.3 9.3-8.3 8.3-9.3-9.3z"/>',
      luz: '<circle cx="7.6" cy="7.6" r="1.5" opacity=".9"/>',
    },
    engrenagem: {  // cálculo automático
      base: '<circle cx="12" cy="12" r="7.6"/>',
      traco: '<circle cx="12" cy="12" r="3.2"/>'
           + '<path d="M12 2.2v2.6M12 19.2v2.6M2.2 12h2.6M19.2 12h2.6"/>'
           + '<path d="M5.1 5.1l1.8 1.8M17.1 17.1l1.8 1.8M18.9 5.1l-1.8 1.8M6.9 17.1l-1.8 1.8"/>',
      luz: '<circle cx="12" cy="12" r="1.1" opacity=".9"/>',
    },
    padrao: {
      base: '<path d="M12 2l8 10-8 10-8-10z"/>',
      traco: '<path d="M12 2l8 10-8 10-8-10z"/>',
      luz: '',
    },
  },

  _achar(nome) {
    return this._G[String(nome || '').toLowerCase()] || this._G.padrao;
  },

  /* Versão RICA — para o lançador, onde o ícone é protagonista.
     Três camadas: massa de fundo, silhueta e realces. */
  rico(nome, tam = 30) {
    const g = this._achar(nome);
    return `<svg class="glifo glifo-rico" viewBox="0 0 24 24" width="${tam}" height="${tam}"
      fill="none" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      ${g.base ? `<g fill="currentColor" stroke="none" opacity=".17">${g.base}</g>` : ''}
      <g>${g.traco}</g>
      ${g.luz ? `<g fill="currentColor" stroke="currentColor" stroke-width="1.2">${g.luz}</g>` : ''}
    </svg>`;
  },

  /* Versão em LINHA — para o cartão, onde ele é etiqueta.
     Só a silhueta: em 14px, camadas viram borrão. */
  linha(nome, tam = 14) {
    const g = this._achar(nome);
    return `<svg class="glifo glifo-linha" viewBox="0 0 24 24" width="${tam}" height="${tam}"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g.traco}</svg>`;
  },

  /* Só o miolo, para quem já tem o <svg> montado (o cartão usa assim). */
  paths(nome) {
    return this._achar(nome).traco;
  },

  existe(nome) {
    return !!this._G[String(nome || '').toLowerCase()];
  },
};

window.Glifos = Glifos;
