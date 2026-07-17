/* ============================================================
   charts.js — Solo Routines
   Wrappers Chart.js com tema escuro/roxo Solo Leveling
   ============================================================ */

// Registro de instancias para destruicao antes de recriar
const ChartInstances = {};

// Configuracao global Chart.js
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = 'rgba(200,200,220,0.6)';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.font.family = "'Rajdhani', sans-serif";
  Chart.defaults.font.size = 12;
}

const Charts = {

  // Destroi instancia existente antes de criar nova
  _destroy(id) {
    if (ChartInstances[id]) {
      ChartInstances[id].destroy();
      delete ChartInstances[id];
    }
  },

  // ── Grafico XP 7 dias (linha dourada) ──
  criarGraficoXPSemana(ctxOrId, dados) {
    const canvas = typeof ctxOrId === 'string' ? document.getElementById(ctxOrId) : ctxOrId;
    if (!canvas) return;
    this._destroy(canvas.id || 'xpSemana');

    const labels = dados.map(d => d.label || d.data || '');
    const values = dados.map(d => d.xp || d.valor || 0);
    const maxVal = Math.max(...values, 1);

    const gradient = canvas.getContext('2d').createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, 'rgba(245,158,11,0.35)');
    gradient.addColorStop(1, 'rgba(245,158,11,0.02)');

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'XP Ganho',
          data: values,
          borderColor: '#f59e0b',
          borderWidth: 2.5,
          backgroundColor: gradient,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: 'rgba(245,158,11,0.5)',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(5,5,8,0.92)',
            borderColor: 'rgba(245,158,11,0.3)',
            borderWidth: 1,
            titleFont: { family: "'Rajdhani', sans-serif", size: 13, weight: '600' },
            bodyFont:  { family: "'Rajdhani', sans-serif", size: 12 },
            callbacks: {
              label: ctx => ` +${ctx.parsed.y} XP`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: 'rgba(200,200,220,0.5)', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: 'rgba(200,200,220,0.5)',
              font: { size: 11 },
              precision: 0,
              callback: (v) => v >= 1000 ? (v/1000).toFixed(1)+'k' : v
            },
            beginAtZero: true,
            min: 0,
            suggestedMax: maxVal <= 1 ? 10 : Math.ceil(maxVal * 1.25)
          }
        }
      }
    });

    const id = canvas.id || 'xpSemana';
    ChartInstances[id] = chart;
    return chart;
  },

  // ── Grafico Radar por Categoria ──
  criarGraficoRadar(ctxOrId, dados) {
    const canvas = typeof ctxOrId === 'string' ? document.getElementById(ctxOrId) : ctxOrId;
    if (!canvas) return;
    this._destroy(canvas.id || 'radar');

    // dados: [{categoria: 'Saude', xp: 120}, ...]
    const labels = dados.map(d => d.categoria || d.label || '');
    const values = dados.map(d => d.xp || d.valor || 0);
    const maxVal = Math.max(...values, 10);

    const chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: 'XP por Categoria',
          data: values,
          borderColor: '#7c3aed',
          borderWidth: 2,
          backgroundColor: 'rgba(124,58,237,0.15)',
          pointBackgroundColor: '#06b6d4',
          pointBorderColor: 'rgba(6,182,212,0.5)',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(5,5,8,0.92)',
            borderColor: 'rgba(124,58,237,0.3)',
            borderWidth: 1,
            titleFont: { family: "'Rajdhani', sans-serif", size: 13, weight: '600' },
            bodyFont:  { family: "'Rajdhani', sans-serif", size: 12 }
          }
        },
        scales: {
          r: {
            grid: { color: 'rgba(255,255,255,0.07)' },
            angleLines: { color: 'rgba(255,255,255,0.07)' },
            pointLabels: {
              color: 'rgba(200,200,220,0.7)',
              font: { family: "'Rajdhani', sans-serif", size: 11 }
            },
            ticks: {
              color: 'rgba(200,200,220,0.4)',
              backdropColor: 'transparent',
              font: { size: 9 }
            },
            suggestedMin: 0,
            suggestedMax: maxVal * 1.15
          }
        }
      }
    });

    const id = canvas.id || 'radar';
    ChartInstances[id] = chart;
    return chart;
  },

  // ── Grafico XP Mensal (barras gradiente) ──
  criarGraficoXPMensal(ctxOrId, dados) {
    const canvas = typeof ctxOrId === 'string' ? document.getElementById(ctxOrId) : ctxOrId;
    if (!canvas) return;
    this._destroy(canvas.id || 'xpMensal');

    const labels = dados.map(d => d.label || d.mes || '');
    const values = dados.map(d => d.xp || d.valor || 0);
    const maxVal = Math.max(...values, 1);

    // Gradiente vertical para as barras
    const ctx2d = canvas.getContext('2d');
    const gradBar = ctx2d.createLinearGradient(0, 0, 0, 200);
    gradBar.addColorStop(0, 'rgba(124,58,237,0.85)');
    gradBar.addColorStop(1, 'rgba(124,58,237,0.2)');

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'XP Mensal',
          data: values,
          backgroundColor: gradBar,
          borderColor: 'rgba(124,58,237,0.6)',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(5,5,8,0.92)',
            borderColor: 'rgba(124,58,237,0.3)',
            borderWidth: 1,
            titleFont: { family: "'Rajdhani', sans-serif", size: 13, weight: '600' },
            bodyFont:  { family: "'Rajdhani', sans-serif", size: 12 },
            callbacks: {
              label: ctx => ` ${ctx.parsed.y} XP`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: 'rgba(200,200,220,0.5)', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: 'rgba(200,200,220,0.5)', font: { size: 11 } },
            beginAtZero: true,
            suggestedMax: maxVal * 1.2
          }
        }
      }
    });

    const id = canvas.id || 'xpMensal';
    ChartInstances[id] = chart;
    return chart;
  },

  // ── Heatmap Anual (grid de celulas por semana) ──
  // dados: { 'YYYY-MM-DD': count, ... }
  criarHeatmap(containerId, dados) {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();

    // Inicio do ano
    const inicio = new Date(anoAtual, 0, 1);
    const fim    = new Date(anoAtual, 11, 31);

    // Acha o valor maximo
    const maxVal = Math.max(...Object.values(dados || {}), 1);

    // Funcao para formatar data local sem fuso
    const fmtDate = d => {
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${dd}`;
    };

    // Meses abreviados
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

    // Calcula nivel de intensidade
    const getNivel = (count) => {
      if (!count || count === 0) return 0;
      const ratio = count / maxVal;
      if (ratio < 0.2) return 1;
      if (ratio < 0.4) return 2;
      if (ratio < 0.6) return 3;
      if (ratio < 0.85) return 4;
      return 5;
    };

    // Monta estrutura de semanas
    // Cada coluna = 1 semana (dom a sab)
    const semanas = [];
    let semana = new Array(7).fill(null);

    // Itera do inicio do ano ate o fim
    const cursor = new Date(inicio);
    // Avan eja ate o proximo domingo ou fica no primeiro dia
    // Primeiro: preenche dias vazios antes do dia 1 no inicio
    let diaSemana = cursor.getDay(); // 0=dom

    // Preenche a primeira semana com nulls antes do dia 1
    for (let i = 0; i < diaSemana; i++) {
      semana[i] = null;
    }

    while (cursor <= fim) {
      const ds = cursor.getDay();
      const dateStr = fmtDate(cursor);
      const count = (dados && dados[dateStr]) || 0;
      semana[ds] = { date: dateStr, count, nivel: getNivel(count) };

      if (ds === 6) {
        semanas.push([...semana]);
        semana = new Array(7).fill(null);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    // Ultima semana incompleta
    if (semana.some(s => s !== null)) {
      semanas.push([...semana]);
    }

    // Monta HTML
    let html = '<div class="heatmap-wrap"><div style="display:flex">';

    // Labels de dias da semana (coluna esquerda)
    html += '<div class="heatmap-days">';
    ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].forEach((d,i) => {
      // Mostra apenas alguns para nao poluir
      html += `<div class="heatmap-day-label">${i % 2 === 0 ? d : ''}</div>`;
    });
    html += '</div>';

    // Grid de semanas
    html += '<div>';

    // Linha de meses (aproximada)
    html += '<div class="heatmap-months" style="display:flex;gap:0;margin-bottom:4px;">';
    let mesAtual = -1;
    semanas.forEach((sem, si) => {
      // Pega o mes do primeiro dia nao-nulo da semana
      const primeiroDia = sem.find(d => d);
      if (primeiroDia) {
        const m = parseInt(primeiroDia.date.split('-')[1]) - 1;
        if (m !== mesAtual) {
          mesAtual = m;
          html += `<div class="heatmap-month-label" style="width:${15}px">${meses[m]}</div>`;
        } else {
          html += `<div style="width:15px"></div>`;
        }
      } else {
        html += `<div style="width:15px"></div>`;
      }
    });
    html += '</div>';

    // Celulas
    html += '<div class="heatmap-grid">';
    semanas.forEach(sem => {
      html += '<div class="heatmap-week">';
      sem.forEach(dia => {
        if (!dia) {
          html += '<div class="heatmap-cell lvl-0"></div>';
        } else {
          const tip = `${dia.date}: ${dia.count} atividade${dia.count !== 1 ? 's' : ''}`;
          html += `<div class="heatmap-cell lvl-${dia.nivel}" data-tip="${tip}" title="${tip}"></div>`;
        }
      });
      html += '</div>';
    });
    html += '</div>'; // heatmap-grid
    html += '</div>'; // semanas wrap
    html += '</div>'; // flex

    // Legenda
    html += `
      <div class="heatmap-legend">
        <span class="heatmap-legend-label">Menos</span>
        <div class="heatmap-legend-cells">
          ${[0,1,2,3,4,5].map(n => `<div class="heatmap-cell lvl-${n}" style="width:12px;height:12px"></div>`).join('')}
        </div>
        <span class="heatmap-legend-label">Mais</span>
      </div>
    `;
    html += '</div>'; // heatmap-wrap

    container.innerHTML = html;
  },

  // Atualiza dados de um grafico existente
  atualizarGrafico(id, novosDados) {
    const chart = ChartInstances[id];
    if (!chart) return;
    chart.data.datasets[0].data = novosDados;
    chart.update('active');
  }

};