/* ============================================================
   ESQUELETO — a espera com a forma do que está vindo.

   O Claude-em-Chrome reportou spinner genérico por 2–3 segundos ao
   trocar de página, sem skeleton, "num app com tanto capricho visual".
   Está certo sobre a estética. Mas vale separar duas coisas que é
   fácil confundir:

     · o SPINNER é feio → isto aqui resolve
     · a ESPERA é longa  → isto aqui NÃO resolve

   Medido nesta máquina, os endpoints respondem em 5–16ms contra
   SQLite. Os 2–3 segundos vêm do banco estar em us-east-1 (Neon), e
   nenhum esqueleto encurta uma viagem à Virgínia. O esqueleto torna a
   espera menos vazia; quem a encurta é a decisão sobre o banco.

   POR QUE UM MÓDULO E NÃO UMA STRING POR PÁGINA: são dez chamadas de
   `loading-spinner-wrap` espalhadas. Uma string copiada dez vezes é
   uma mudança de estética que precisa ser feita dez vezes — e a
   décima sempre fica para trás.

   Uso:
     cont.innerHTML = Esqueleto.lista(4);     // cartões de missão
     cont.innerHTML = Esqueleto.grade(6);     // itens de loja/materiais
   ============================================================ */

const Esqueleto = {
  /* Uma pilha de cartões no formato dos cartões de missão: sigilo à
     esquerda, duas linhas de texto, botão à direita. É a FORMA que faz
     a espera dizer "as missões estão vindo" em vez de "algo está
     acontecendo". */
  lista(n = 4, opts = {}) {
    const comBotao = opts.botao !== false;
    let s = '<div class="sk-lista" aria-hidden="true">';
    for (let i = 0; i < n; i++) {
      s += `<div class="sk-card">
              <div class="sk-selo"></div>
              <div class="sk-corpo">
                <div class="sk-linha titulo"></div>
                <div class="sk-linha chips"></div>
              </div>
              ${comBotao ? '<div class="sk-botao"></div>' : ''}
            </div>`;
    }
    return s + '</div>';
  },

  /* Para telas em grade (loja, materiais): mesmos blocos, sem o botão,
     e o contêiner herda o grid da própria página. */
  grade(n = 6) {
    let s = '';
    for (let i = 0; i < n; i++) {
      s += `<div class="sk-card" aria-hidden="true" style="flex-direction:column;
              align-items:stretch;gap:.6rem">
              <div class="sk-selo" style="width:100%;height:78px"></div>
              <div class="sk-linha titulo" style="width:70%"></div>
              <div class="sk-linha" style="width:45%"></div>
            </div>`;
    }
    return s;
  },

  /* O TROCO SÓ ACONTECE SE A TELA ESTIVER VAZIA.

     `rotinas.js` já tinha essa lógica embutida: se a lista atual tem
     conteúdo, ela recarrega em SILÊNCIO, sem piscar. Trocar cartões
     reais por esqueleto a cada refresh seria uma regressão — o hunter
     veria a lista sumir e voltar. Esta função preserva aquela regra e
     evita que cada página a reinvente. */
  trocar(el, html) {
    if (!el) return false;
    const atual = el.innerHTML.trim();
    const vazio = !atual
      || atual.includes('loading-spinner')
      || atual.includes('sk-lista')
      || atual.includes('empty-state');
    if (!vazio) return false;
    el.innerHTML = html;
    return true;
  },
};

if (typeof window !== 'undefined') window.Esqueleto = Esqueleto;
