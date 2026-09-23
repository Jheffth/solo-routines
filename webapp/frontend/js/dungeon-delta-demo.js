/* Vitrine independente: nenhuma chamada de API, apenas dados de demonstração. */
window.DungeonDeltaDemo = {
  abrir() {
    if (document.getElementById('delta-demo')) return;
    const focoAnterior = document.activeElement;
    const el = document.createElement('dialog');
    el.id = 'delta-demo';
    el.setAttribute('aria-labelledby', 'delta-titulo');
    const icon = (tipo) => {
      const paths = { relogio: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
        alvo: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
        circuito: '<rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><path d="M6 9v9h9m0-3 3 3-3 3"/>',
        agua: '<path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
        runa: '<path d="m12 2 8 10-8 10-8-10Z"/><path d="M12 7v10m-4-5h8"/>' };
      return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[tipo] || paths.runa}</svg>`;
    };
    const dificuldades = {
      FACIL: {nome:'Fácil',rank:'C',cor:'#3b82f6'},
      NORMAL: {nome:'Normal',rank:'B',cor:'#94a3b8'},
      DIFICIL: {nome:'Difícil',rank:'A',cor:'#f59e0b'},
      LENDARIO: {nome:'Lendária',rank:'S',cor:'#e11d48'},
    };
    const sigilo = c => `<div class="dd-sigilo" aria-hidden="true"><svg class="dd-orbitas" viewBox="0 0 100 100"><circle class="dd-anel-externo" cx="50" cy="50" r="45"/><circle class="dd-anel-interno" cx="50" cy="50" r="35"/><path class="dd-arco" d="M50 5a45 45 0 0 1 45 45"/><path class="dd-runa" d="m50 21 29 29-29 29-29-29Z"/></svg><span class="dd-nucleo">${icon(c.icon)}</span></div>`;
    const css = `
      #delta-demo{--dd-ac:#a78bfa;--dd-line:#ffffff14;box-sizing:border-box;width:min(1120px,96vw);max-width:96vw;max-height:94dvh;padding:0;border:1px solid #8b5cf655;border-radius:18px;background:#090d19;color:#e5eaf5;box-shadow:0 30px 100px #000a;font:14px Inter,system-ui,sans-serif;overflow:auto}
      #delta-demo *{box-sizing:border-box}#delta-demo::backdrop{background:#02040cda;backdrop-filter:blur(8px)}
      #delta-demo button{font:inherit;cursor:pointer}#delta-demo button:focus-visible{outline:2px solid #c4b5fd;outline-offset:4px}#delta-demo button:disabled{cursor:default;opacity:.55}
      #delta-demo .dd-top{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:24px 28px;background:#0d1222f5;border-bottom:1px solid var(--dd-line);backdrop-filter:blur(12px)}
      #delta-demo .dd-kicker{color:#b5a2fa;font-size:10px;letter-spacing:.2em;font-weight:700;text-transform:uppercase}#delta-demo h2{font-size:26px;letter-spacing:-.03em;margin:6px 0 0}#delta-demo .dd-close{border:1px solid var(--dd-line);background:#ffffff06;color:#cbd5e1;width:40px;height:40px;border-radius:10px;font-size:22px}
      #delta-demo .dd-intro{padding:20px 28px 0;color:#9ba9c2;line-height:1.6;margin:0}#delta-demo .dd-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:16px 28px 22px}#delta-demo .dd-tools button{padding:9px 13px;background:#151d31;color:#d5dff5;border:1px solid #ffffff18;border-radius:8px}#delta-demo .dd-summary{margin-left:auto;font-size:12px;color:#a5b4cc}
      #delta-demo .dd-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;padding:0 28px 28px}#delta-demo .dd-card{position:relative;min-width:0;padding:19px;border:1px solid var(--dd-line);border-radius:12px;background:linear-gradient(135deg,#ffffff04,transparent 70%),#101625;overflow:hidden}
      #delta-demo .dd-card[data-state=running]{border-color:#a78bfa80;box-shadow:inset 3px 0 #a78bfa,0 0 28px #8b5cf610}#delta-demo .dd-card[data-state=waiting]{border-style:dashed;background:#0c1424}#delta-demo .dd-card[data-state=done]{border-color:#34d39935}#delta-demo .dd-card[data-state=failed]{border-color:#fb718540}
      #delta-demo .dd-head{display:flex;gap:12px;align-items:flex-start}#delta-demo .dd-icon{flex-shrink:0;width:38px;height:42px;display:grid;place-items:center;color:var(--dd-ac);background:#a78bfa0c;clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)}#delta-demo svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
      #delta-demo .dd-title{flex:1;min-width:0}#delta-demo h3{font-size:16px;line-height:1.4;overflow-wrap:anywhere;margin:0 0 6px;font-weight:650}#delta-demo .dd-type{font-size:10px;letter-spacing:.1em;color:#96a5c0;text-transform:uppercase}#delta-demo .dd-state{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:650;margin:15px 0 8px;color:#c4b5fd}#delta-demo .dd-state:before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor}
      #delta-demo [data-state=waiting] .dd-state{color:#7dd3fc}#delta-demo [data-state=done] .dd-state{color:#6ee7b7}#delta-demo [data-state=failed] .dd-state{color:#fda4af}#delta-demo [data-state=paused] .dd-state{color:#fcd34d}
      #delta-demo .dd-detail{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:34px;color:#abb8cd;font-size:12px}#delta-demo .dd-clock{font:700 23px ui-monospace,monospace;font-variant-numeric:tabular-nums;letter-spacing:.03em;color:#dce9ff}#delta-demo [data-state=waiting] .dd-clock{color:#7dd3fc}
      #delta-demo .dd-track{height:5px;border-radius:4px;background:#ffffff0a;overflow:hidden;margin:10px 0 16px}#delta-demo .dd-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#c4b5fd);transition:width .3s}#delta-demo [data-state=done] .dd-fill{background:#34d399}
      #delta-demo .dd-bottom{display:flex;gap:12px;align-items:center;justify-content:space-between;border-top:1px solid var(--dd-line);padding-top:13px;margin-top:12px;flex-wrap:wrap}#delta-demo .dd-loot{display:flex;gap:12px;font-size:11px;color:#c9a95c}#delta-demo .dd-loot span:last-child{color:#8eabc9}#delta-demo .dd-actions{display:flex;gap:6px;flex-wrap:wrap}#delta-demo .dd-actions button{min-height:36px;border:1px solid #a78bfa35;border-radius:7px;padding:7px 12px;background:#a78bfa10;color:#d8ccff;font-size:12px;font-weight:600}#delta-demo .dd-actions .primary{background:#8b5cf6;border-color:#a78bfa;color:white}#delta-demo .dd-streak{font-size:11px;color:#abb8cd;margin:12px 0 0}#delta-demo .dd-streak b{color:#ddd6fe}#delta-demo .dd-help{color:#8fa1bc;font-size:11px;line-height:1.5;margin:8px 0 0}#delta-demo .dd-foot{padding:0 28px 24px;color:#8092ae;font-size:11px}#delta-demo .dd-live{min-height:20px;padding:0 28px 14px;color:#c4b5fd;font-size:12px}
      @media(max-width:720px){#delta-demo .dd-grid{grid-template-columns:1fr;padding:0 16px 20px}#delta-demo .dd-top{padding:18px 16px}#delta-demo .dd-intro,#delta-demo .dd-tools{padding-left:16px;padding-right:16px}#delta-demo h2{font-size:22px}#delta-demo .dd-summary{margin-left:0;width:100%}#delta-demo .dd-actions button{min-height:44px}#delta-demo .dd-card{padding:16px}}

      /* A mesma linguagem cinética do Card Atual: fio, corrente e sigilo. */
      #delta-demo {background:radial-gradient(ellipse at 5% 15%,#7c3aed26,transparent 55%),radial-gradient(ellipse at 95% 80%,#0ea5e914,transparent 50%),#070912ee;backdrop-filter:blur(24px);border-color:#a78bfa44}
      #delta-demo .dd-top {background:linear-gradient(130deg,#100d20ed,#070b18ed)}
      #delta-demo h2 {font-family:var(--font-title,'Cinzel Decorative',serif);font-size:23px;color:#ede9fe;text-shadow:0 0 24px #a78bfa35}
      #delta-demo .dd-card {isolation:isolate;background:radial-gradient(120% 140% at 0 0,color-mix(in srgb,var(--dd-ac) 14%,transparent),transparent 58%),linear-gradient(145deg,#0b0916ab,#06060dc4);backdrop-filter:blur(14px);border:1px solid color-mix(in srgb,var(--dd-ac) 25%,transparent);border-left:3px solid var(--dd-ac);border-radius:14px;transition:transform .22s,box-shadow .22s,border-color .22s}
      #delta-demo .dd-card:hover {transform:translateY(-2px);border-color:color-mix(in srgb,var(--dd-ac) 60%,transparent);box-shadow:0 8px 26px #0007,0 0 24px color-mix(in srgb,var(--dd-ac) 16%,transparent)}
      #delta-demo .dd-card[data-state=running] {border-color:color-mix(in srgb,var(--dd-ac) 60%,transparent);box-shadow:inset 3px 0 var(--dd-ac),0 0 28px color-mix(in srgb,var(--dd-ac) 13%,transparent)}
      #delta-demo .dd-card[data-state=waiting] {background:radial-gradient(ellipse at top left,color-mix(in srgb,var(--dd-ac) 10%,transparent),transparent 70%),#0b0d18a8;border-left-style:solid;border-top-style:dashed}
      #delta-demo .dd-card[data-state=done] {border-color:#34d39945;border-left-color:#34d399;background:radial-gradient(ellipse at top left,#34d3990c,transparent 65%),#090e18c9}
      #delta-demo .dd-card[data-state=failed] {border-color:#fb718540;border-left-color:#fb7185;background:radial-gradient(ellipse at top left,#fb71850b,transparent 65%),#110c18b0}
      #delta-demo .dd-card > :not(.dd-corrente):not(.dd-fio) {position:relative;z-index:1}
      #delta-demo .dd-fio {position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--dd-ac),#fff,var(--dd-ac),transparent);background-size:200% 100%;opacity:.25;pointer-events:none}
      #delta-demo [data-state=running] .dd-fio {opacity:1;animation:dd-fio 2.4s linear infinite}
      #delta-demo .dd-corrente {display:none;position:absolute;inset:0;pointer-events:none;opacity:.5;background-image:repeating-linear-gradient(115deg,transparent 0 22px,color-mix(in srgb,var(--dd-ac) 13%,transparent) 22px 24px,transparent 24px 46px),repeating-linear-gradient(65deg,transparent 0 22px,color-mix(in srgb,var(--dd-ac) 13%,transparent) 22px 24px,transparent 24px 46px);background-size:92px 100%;mask-image:linear-gradient(90deg,transparent,#000 22%,#000 78%,transparent)}
      #delta-demo [data-state=running] .dd-corrente {display:block;animation:dd-corrente 2.8s linear infinite}
      #delta-demo .dd-sigilo {position:relative;width:70px;height:70px;flex:0 0 70px;color:var(--dd-ac);background:radial-gradient(circle,color-mix(in srgb,var(--dd-ac) 17%,transparent),transparent 68%)}
      #delta-demo .dd-orbitas {width:70px;height:70px;stroke:currentColor;stroke-width:1;overflow:visible}
      #delta-demo .dd-anel-externo {stroke-dasharray:2 8;opacity:.6;transform-origin:50px 50px;animation:dd-giro 18s linear infinite}
      #delta-demo .dd-anel-interno {stroke-dasharray:34 10;opacity:.3;transform-origin:50px 50px;animation:dd-giro 24s linear infinite reverse}
      #delta-demo .dd-arco {stroke-width:2;opacity:.75;transform-origin:50px 50px;animation:dd-giro 6s linear infinite}
      #delta-demo .dd-runa {opacity:.35;fill:color-mix(in srgb,var(--dd-ac) 8%,transparent)}
      #delta-demo .dd-nucleo {position:absolute;inset:0;display:grid;place-items:center}
      #delta-demo .dd-nucleo svg {width:25px;height:25px}
      #delta-demo [data-state=waiting] .dd-arco {animation-duration:16s;opacity:.4}
      #delta-demo [data-state=paused] .dd-sigilo * {animation-play-state:paused}
      #delta-demo [data-state=done] .dd-sigilo {color:#34d399}#delta-demo [data-state=failed] .dd-sigilo {color:#fb7185}
      #delta-demo [data-state=done] .dd-sigilo *,#delta-demo [data-state=failed] .dd-sigilo * {animation:none}
      #delta-demo h3 {font-family:var(--font-section,'Rajdhani',system-ui);font-size:18px;line-height:1.3;letter-spacing:.01em;text-shadow:0 0 18px color-mix(in srgb,var(--dd-ac) 18%,transparent)}
      #delta-demo .dd-type {font-size:9px;line-height:1.6;margin-bottom:5px;letter-spacing:.14em;color:color-mix(in srgb,var(--dd-ac) 45%,#a5b4c8)}
      #delta-demo .dd-dificuldade {display:inline-flex;gap:5px;margin-top:3px;padding:3px 7px;border:1px solid color-mix(in srgb,var(--dd-ac) 30%,transparent);background:color-mix(in srgb,var(--dd-ac) 9%,transparent);border-radius:4px;font-size:10px;font-weight:700;color:var(--dd-ac);letter-spacing:.05em}
      #delta-demo .dd-dificuldade span {font-weight:500;color:#c1cbdc}
      #delta-demo [data-state=running] .dd-state,#delta-demo [data-state=ready] .dd-state {color:color-mix(in srgb,var(--dd-ac) 65%,white)}
      #delta-demo .dd-clock {color:color-mix(in srgb,var(--dd-ac) 45%,white);text-shadow:0 0 18px color-mix(in srgb,var(--dd-ac) 30%,transparent)}
      #delta-demo .dd-fill {background:linear-gradient(90deg,var(--dd-ac),color-mix(in srgb,var(--dd-ac) 35%,white),var(--dd-ac));background-size:200% 100%;box-shadow:0 0 12px color-mix(in srgb,var(--dd-ac) 35%,transparent)}
      #delta-demo [data-state=running] .dd-fill {animation:dd-fio 2.6s linear infinite}
      #delta-demo .dd-actions button {border-color:color-mix(in srgb,var(--dd-ac) 35%,transparent);background:color-mix(in srgb,var(--dd-ac) 9%,transparent);color:#e2e8f0}
      #delta-demo .dd-actions .primary {background:linear-gradient(135deg,color-mix(in srgb,var(--dd-ac) 72%,#121526),color-mix(in srgb,var(--dd-ac) 40%,#121526));border-color:color-mix(in srgb,var(--dd-ac) 65%,transparent);box-shadow:0 0 14px color-mix(in srgb,var(--dd-ac) 15%,transparent);color:#fff}
      #delta-demo .dd-actions button:hover {filter:brightness(1.2)}
      #delta-demo .dd-palette {display:flex;gap:8px;flex-wrap:wrap;padding:16px 28px 0}#delta-demo .dd-palette span {border:1px solid color-mix(in srgb,var(--tone) 40%,transparent);background:color-mix(in srgb,var(--tone) 8%,transparent);border-radius:6px;padding:5px 9px;color:var(--tone);font-size:11px}
      @keyframes dd-giro {to{transform:rotate(360deg)}}
      @keyframes dd-fio {from{background-position:200% 0}to{background-position:-200% 0}}
      @keyframes dd-corrente {from{background-position:0 0,0 0}to{background-position:92px 0,-92px 0}}
      @media(max-width:720px){#delta-demo .dd-sigilo,#delta-demo .dd-orbitas{width:58px;height:58px}#delta-demo .dd-sigilo{flex-basis:58px}#delta-demo .dd-palette{padding:16px 16px 0}#delta-demo h3{font-size:17px}}
      @media(prefers-reduced-motion:reduce){#delta-demo *{transition:none!important;animation:none!important}}
    `;
    let offset = 0, timer;
    const now = () => Date.now() + offset;
    let cards;
    function reset() {
      offset = 0;
      cards = [
        {id:1,difficulty:'DIFICIL',title:'Estudar 45 minutos de Português',type:'Missão agendada',icon:'relogio',state:'waiting',due:now()+45000,xp:180,coins:15,streak:4},
        {id:2,difficulty:'LENDARIO',title:'Ler 20 páginas de Anatomia',type:'Meta · páginas',icon:'alvo',state:'running',value:10,target:20,xp:220,coins:20,streak:2},
        {id:3,difficulty:'NORMAL',title:'Completar circuito de mobilidade',type:'Circuito · 4 etapas',icon:'circuito',state:'ready',value:0,target:4,xp:90,coins:8,streak:3},
        {id:4,difficulty:'FACIL',title:'Beber um copo de água',type:'Bem-estar · próxima ocorrência',icon:'agua',state:'waiting',due:now()+15000,health:true,xp:30,coins:3,streak:2},
        {id:5,difficulty:'DIFICIL',title:'Fazer 3 séries de flexão',type:'Repetição · registro de hoje',icon:'runa',state:'done',value:3,target:3,xp:90,coins:8,streak:5},
        {id:6,difficulty:'FACIL',title:'Pausa para alongar',type:'Bem-estar · ocorrência anterior',icon:'agua',state:'failed',xp:30,coins:3,streak:0},
      ];
    }
    const labels = {waiting:'Aguardando horário',ready:'Disponível',running:'Em andamento',paused:'Pausada',done:'Concluída',failed:'Falhou — prazo encerrado'};
    const format = ms => {const sec=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;};
    const cardHTML = c => {
      const terminal = ['done','failed'].includes(c.state);
      const nivel = dificuldades[c.difficulty] || dificuldades.NORMAL;
      const btn = (action,label,primary=false) => `<button type="button" data-id="${c.id}" data-action="${action}" class="${primary?'primary':''}">${label}</button>`;
      let actions='';
      if(c.state==='ready') actions=btn('start','Iniciar',true);
      if(c.state==='running') actions=(c.target?btn('progress',c.icon==='circuito'?'Concluir etapa':'+5 páginas',true):btn('done','Concluir',true))+(c.health?'':btn('pause','Pausar'));
      if(c.state==='paused') actions=btn('start','Retomar',true);
      const detalhe = c.state==='waiting' ? 'Ativa em' : c.health && !terminal ? 'Prazo para concluir' : c.target ? `${c.value} / ${c.target} ${c.icon==='alvo'?'páginas':c.icon==='circuito'?'etapas':'séries'}` : terminal ? 'Ocorrência registrada no dia' : 'Você controla o início e a conclusão';
      return `<article class="dd-card" data-state="${c.state}" data-card="${c.id}" style="--dd-ac:${nivel.cor}"><span class="dd-fio" aria-hidden="true"></span><span class="dd-corrente" aria-hidden="true"></span><div class="dd-head">${sigilo(c)}<div class="dd-title"><div class="dd-type">${c.type}</div><h3>${c.title}</h3><span class="dd-dificuldade">${nivel.rank}-Rank <span>· ${nivel.nome}</span></span></div></div><div class="dd-state">${labels[c.state]}</div><div class="dd-detail"><span>${detalhe}</span>${c.due&&!terminal?`<time class="dd-clock" data-clock="${c.id}">${format(c.due-now())}</time>`:''}</div>${c.target?`<div class="dd-track" role="progressbar" aria-label="Progresso de ${c.title}" aria-valuemin="0" aria-valuemax="${c.target}" aria-valuenow="${c.value}"><div class="dd-fill" style="width:${c.value/c.target*100}%"></div></div>`:''}<div class="dd-bottom"><div class="dd-loot"><span>${c.state==='done'?'Recebido':c.state==='failed'?'Não recebido':'Recompensa'} ${c.xp} XP</span><span>${c.coins} moedas</span></div><div class="dd-actions">${actions}</div></div><p class="dd-streak">Sequência <b>${c.streak}</b> ${c.streak===1?'conclusão':'conclusões'}</p>${c.state==='waiting'?'<p class="dd-help">O card já está visível. A ação será liberada no horário.</p>':c.state==='failed'?'<p class="dd-help">Registro preservado. Esta ocorrência interrompeu a sequência.</p>':''}</article>`;
    };
    function render() {
      const focused = el.querySelector(':focus');
      const id=focused?.dataset.id, action=focused?.dataset.action;
      el.querySelector('.dd-grid').innerHTML=cards.map(cardHTML).join('');
      el.querySelector('.dd-summary').textContent=`${cards.filter(c=>c.state==='done').length} concluídas · ${cards.filter(c=>c.state==='waiting').length} previstas · ${cards.filter(c=>c.state==='failed').length} falhada(s)`;
      if(id) el.querySelector(`[data-id="${id}"][data-action="${action}"]`)?.focus();
    }
    const announce = msg => {el.querySelector('.dd-live').textContent=msg;};
    function tick() {
      if (!el.isConnected) {clearInterval(timer);return;}
      let changed=false;
      for(const c of cards.slice()) {
        if(c.due && c.due<=now() && c.state==='waiting') {
          if(c.health) {
            const previous=cards.filter(x=>x.health&&['done','failed'].includes(x.state)).at(-1);
            c.streak=previous?.streak??c.streak;
            c.state='running';c.type='Bem-estar · ocorrência atual';c.due=now()+20000;
            cards.push({...c,id:Math.max(...cards.map(x=>x.id))+1,state:'waiting',type:'Bem-estar · próxima ocorrência',due:now()+30000});
          } else {c.state='ready';c.due=null;}
          changed=true;announce(`${c.title}: disponível agora.`);
        } else if(c.health && c.state==='running' && c.due<=now()) {
          c.state='failed';c.streak=0;changed=true;announce('Prazo encerrado. A ocorrência permanece no histórico.');
        }
      }
      if(changed) render();
      el.querySelectorAll('[data-clock]').forEach(t=>{const c=cards.find(x=>x.id===Number(t.dataset.clock));t.textContent=format(c.due-now());});
    }
    reset();
    el.innerHTML=`<style>${css}</style><header class="dd-top"><div><div class="dd-kicker">Forja de testes / proposta Codex</div><h2 id="delta-titulo">Delta — Sentinela II</h2></div><button type="button" class="dd-close" data-close aria-label="Fechar demonstração">×</button></header><p class="dd-intro">A identidade do Card Atual dentro da dungeon: sigilos vivos, corrente de energia, vidro e neon. As cores desta proposta indicam a dificuldade. <b>Demonstração: não grava missões nem concede recompensas reais.</b></p><div class="dd-palette" aria-label="Cores de dificuldade">${Object.values(dificuldades).map(n=>`<span style="--tone:${n.cor}">${n.rank}-Rank · ${n.nome}</span>`).join('')}</div><div class="dd-tools"><button type="button" data-forward>Avançar 15 segundos</button><button type="button" data-reset>Reiniciar demonstração</button><span class="dd-summary"></span></div><div class="dd-live" role="status" aria-live="polite"></div><main class="dd-grid"></main><footer class="dd-foot">Tempo acelerado para avaliação · saúde ativa em 15s e tem prazo de 20s · os modelos Alpha, Beta e Gamma permanecem separados.</footer>`;
    (document.fullscreenElement||document.body).appendChild(el);
    render();
    el.addEventListener('keydown',e=>e.stopPropagation());
    el.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-close'))return el.close();
      if(b.hasAttribute('data-reset')){reset();render();announce('Demonstração reiniciada.');return;}
      if(b.hasAttribute('data-forward')){offset+=15000;tick();return;}
      tick();
      const c=cards.find(x=>x.id===Number(b.dataset.id));if(!c||['done','failed','waiting'].includes(c.state))return;
      switch(b.dataset.action){
        case 'start':c.state='running';break;
        case 'pause':c.state='paused';break;
        case 'progress':c.value=Math.min(c.target,c.value+(c.icon==='alvo'?5:1));if(c.value===c.target){c.state='done';c.streak++;}break;
        case 'done':c.state='done';c.streak++;break;
      }
      render();announce(`${c.title}: ${labels[c.state]}.`);
    });
    el.addEventListener('close',()=>{clearInterval(timer);el.remove();focoAnterior?.focus();},{once:true});
    el.showModal();
    timer=setInterval(tick,1000);
  },
};
