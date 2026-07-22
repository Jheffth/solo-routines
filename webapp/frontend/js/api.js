/* ============================================================
   SOLO ROUTINES — API CLIENT
   ============================================================ */

class API {
  static BASE  = '/api';
  static token = localStorage.getItem('sr_token');

  /* ── Core request ──────────────────────────────────────── */
  static async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (API.token) headers['Authorization'] = `Bearer ${API.token}`;

    const config = { method: method.toUpperCase(), headers };
    if (body !== null && method !== 'GET') config.body = JSON.stringify(body);

    try {
      const response = await fetch(`${API.BASE}${path}`, config);

      if (response.status === 401) {
        API.token = null;
        localStorage.removeItem('sr_token');
        window.dispatchEvent(new CustomEvent('sr:session-expired'));
        throw new Error('Sessao expirada. Faca login novamente.');
      }

      let data;
      const ct = response.headers.get('content-type');
      if (ct && ct.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      if (!response.ok) {
        throw new Error(data?.detail || data?.message || data?.error || ('Erro ' + response.status));
      }

      // ── Canal ÚNICO de celebração ────────────────────────────────
      // Ordem sagrada: ASCENSÃO (level-up) primeiro, CERIMÔNIA depois.
      // Cobre rotinas/tarefas (resultado.* | novas_conquistas) e
      // dungeons (eventos_xp.*). ConquistaFX deduplica sozinho.
      let conquistasNovas = [];
      if (data?.resultado?.conquistas?.length)       conquistasNovas = data.resultado.conquistas;
      else if (data?.novas_conquistas?.length)       conquistasNovas = data.novas_conquistas;
      else if (data?.eventos_xp?.conquistas?.length) conquistasNovas = data.eventos_xp.conquistas;

      let levelUps = [];
      if (data?.level_ups?.length)                   levelUps = data.level_ups;
      else if (data?.resultado?.level_ups?.length)   levelUps = data.resultado.level_ups;
      else if (data?.eventos_xp?.level_ups?.length)  levelUps = data.eventos_xp.level_ups;

      // Ganho de XP sem cerimônia (missão comum): ainda assim a Janela de
      // Status precisa refletir o novo XP/moedas.
      const houveGanho = !!(data?.xp_ganho || data?.resultado?.xp_ganho ||
                            data?.eventos_xp?.xp_ganho);
      if (houveGanho && !levelUps.length && !conquistasNovas.length) {
        window.dispatchEvent(new CustomEvent('sr:recompensa', { detail: { xp: true } }));
      }

      const celebrar = async () => {
        if (levelUps.length && window.Ascensao) {
          await window.Ascensao.mostrar(levelUps);       // aguarda a Ascensão terminar
        }
        if (conquistasNovas.length && window.ConquistaFX) {
          conquistasNovas.forEach(c => window.ConquistaFX.show(c));
        }
        // Avisa o app para atualizar a Janela de Status (XP, nível, relíquias)
        // sem o usuário precisar recarregar a página.
        window.dispatchEvent(new CustomEvent('sr:recompensa', {
          detail: { levelUps, conquistas: conquistasNovas },
        }));
      };
      if (levelUps.length || conquistasNovas.length) celebrar();

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Nao foi possivel conectar ao servidor.');
      }
      throw err;
    }
  }

  static async get(path)            { return API.request('GET', path); }
  static async post(path, body)     { return API.request('POST', path, body); }
  static async put(path, body)      { return API.request('PUT', path, body); }
  static async patch(path, body)    { return API.request('PATCH', path, body); }
  static async delete(path)         { return API.request('DELETE', path); }

  static setToken(t) {
    API.token = t;
    if (t) localStorage.setItem('sr_token', t);
    else   localStorage.removeItem('sr_token');
  }

  /* ── Auth ──────────────────────────────────────────────── */
  static auth = {
    /** OAuth2PasswordRequestForm: exige form-urlencoded username/password */
    login: async (login, senha) => {
      const form = new URLSearchParams();
      form.append('username', login);
      form.append('password', senha);

      const headers = {};
      if (API.token) headers['Authorization'] = `Bearer ${API.token}`;

      const res = await fetch(`${API.BASE}/auth/login`, {
        method: 'POST',
        headers,
        body: form,
      });

      let data;
      try { data = await res.json(); } catch { data = {}; }

      if (!res.ok) {
        throw new Error(data?.detail || data?.message || 'Login ou senha incorretos');
      }

      const token = data.access_token || data.token;
      if (token) {
        API.token = token;
        localStorage.setItem('sr_token', token);
      }
      return data;
    },

    registro: async (nome, login, senha, codigo, email) =>
      API.post('/auth/registro', { nome, login, senha, codigo, email: email || null }),

    me: async () => API.get('/auth/me'),

    logout: async () => {
      try { await API.post('/auth/logout', {}); } catch { /* ignore */ }
      API.token = null;
      localStorage.removeItem('sr_token');
    },
  };

  /* ── Dashboard ────────────────────────────────────────── */
  static dashboard = {
    get: async () => API.get('/dashboard/'),
  };

  /* ── Rotinas ───────────────────────────────────────────── */
  static rotinas = {
    listar: async (frequencia = null) => {
      const q = frequencia ? `?frequencia=${frequencia}` : '';
      return API.get('/rotinas' + q);
    },
    hoje:     async ()       => API.get('/rotinas/hoje'),
    criar:    async (dados)  => API.post('/rotinas/', dados),
    atualizar:async (id, d)  => API.put('/rotinas/' + id, d),
    deletar:  async (id)     => API.delete('/rotinas/' + id),
  };

  /* ── Tarefas ───────────────────────────────────────────── */
  static tarefas = {
    listar: async (filtros = {}) => {
      const p = new URLSearchParams();
      if (filtros.status)     p.set('status', filtros.status);
      if (filtros.data)       p.set('data', filtros.data);
      if (filtros.prioridade) p.set('prioridade', filtros.prioridade);
      const q = p.toString() ? '?' + p.toString() : '';
      return API.get('/tarefas' + q);
    },
    hoje:     async ()       => API.get('/tarefas/hoje'),
    criar:    async (dados)  => API.post('/tarefas/', dados),
    concluir: async (id)     => API.patch('/tarefas/' + id + '/concluir', {}),
    atualizar:async (id, d)  => API.put('/tarefas/' + id, d),
    deletar:  async (id)     => API.delete('/tarefas/' + id),
  };

  /* ── Execucoes ───────────────────────────────────────── */
  static execucoes = {
    concluirRotina: async (rotinaId) => API.post('/execucoes/rotina', { rotina_id: rotinaId }),
    historico:      async (periodo = 'semana') => API.get('/execucoes/historico?periodo=' + periodo),
    heatmap:        async () => API.get('/execucoes/heatmap'),
  };

  /* ── Convites (Arquiteto) ─────────────────────────────── */
  static convites = {
    listar:  async ()      => API.get('/convites/'),
    gerar:   async (d)     => API.post('/convites/', d),
    revogar: async (id)    => API.delete('/convites/' + id),
    validar: async (cod)   => API.get('/convites/validar/' + encodeURIComponent(cod)),
    badges:  async ()      => API.get('/convites/badges-disponiveis'),
  };

  /* ── Emblemas, hunters e permissões ───────────────────── */
  static emblemas = {
    pendentes:     async ()    => API.get('/emblemas/pendentes'),
    celebradas:    async ()    => API.post('/emblemas/celebradas', {}),
    colecionaveis: async ()    => API.get('/emblemas/colecionaveis'),
    presentear:    async (d)   => API.post('/emblemas/presentear', d),
    recolher:      async (uid, cod) => API.delete(`/emblemas/recolher?usuario_id=${uid}&codigo=${encodeURIComponent(cod)}`),
    hunters:       async ()    => API.get('/emblemas/hunters'),
    permissoes:    async ()    => API.get('/emblemas/permissoes'),
  };

  /* ── Materiais: a Casa de Trocas entre hunters ────────── */
  static materiais = {
    inventario:  async ()          => API.get('/materiais/inventario'),
    hunter:      async (nick)      => API.get('/materiais/hunter/' + encodeURIComponent(nick)),
    enviar:      async (d)         => API.post('/materiais/enviar', d),
    forjar:      async (codigo)    => API.post('/materiais/forjar', { codigo }),
    historico:   async ()          => API.get('/materiais/historico'),
    catalogo:    async ()          => API.get('/materiais/catalogo'),
    definirStatus: async (cod, t)  => API.patch('/materiais/catalogo/' + encodeURIComponent(cod),
                                                { transferivel: t }),
  };

  /* ── Hunters: busca e perfil público ──────────────────── */
  /* ── Social: BuddyList + Chat ─────────────────────────── */
  static social = {
    amigos:    async ()             => API.get('/social/amigos'),
    pedir:     async (login)        => API.post('/social/pedir', { login }),
    responder: async (id, aceitar)  => API.post('/social/responder', { amizade_id: id, aceitar }),
    remover:   async (login)        => API.delete('/social/amigo/' + encodeURIComponent(login)),
    conversa:  async (login, antesDe, aposId) => {
      const qs = [];
      if (antesDe) qs.push('antes_de=' + encodeURIComponent(antesDe));
      if (aposId)  qs.push('apos_id=' + encodeURIComponent(aposId));
      return API.get('/social/conversa/' + encodeURIComponent(login)
                     + (qs.length ? '?' + qs.join('&') : ''));
    },
    enviar:    async (login, corpo) => API.post('/social/enviar', { login, corpo }),
    novidades: async ()             => API.get('/social/novidades'),
    digitando: async (login)        => API.post('/social/digitando', { login }),
  };

  static hunters = {
    buscar: async (q)     => API.get('/hunters/buscar?q=' + encodeURIComponent(q)),
    perfil: async (login) => API.get('/hunters/' + encodeURIComponent(login)),
  };

  /* ── Sala de Poderes do Arquiteto ─────────────────────── */
  static arquiteto = {
    poderes:         async ()    => API.get('/arquiteto/poderes'),
    dossie:          async (id)  => API.get('/arquiteto/hunter/' + id),
    decretos:        async ()    => API.get('/arquiteto/decretos'),
    revogarBadge:    async (d)   => API.post('/arquiteto/revogar/badge', d),
    revogarCargo:    async (d)   => API.post('/arquiteto/revogar/cargo', d),
    concederCargo:   async (d)   => API.post('/arquiteto/conceder/cargo', d),
    revogarAcesso:   async (d)   => API.post('/arquiteto/revogar/acesso', d),
    restaurarAcesso: async (d)   => API.post('/arquiteto/restaurar/acesso', d),
    revogarXp:       async (d)   => API.post('/arquiteto/revogar/xp', d),
    revogarConvite:  async (d)   => API.post('/arquiteto/revogar/convite', d),
  };

  /* ── Dungeons ─────────────────────────────────────────── */
  static dungeons = {
    listar:       async ()        => API.get('/dungeons/'),
    obter:        async (id)      => API.get('/dungeons/' + id),
    criar:        async (dados)   => API.post('/dungeons/', dados),
    atualizar:    async (id, d)   => API.put('/dungeons/' + id, d),
    deletar:      async (id)      => API.delete('/dungeons/' + id),
    // Missões
    criarMissao:  async (id, m)   => API.post('/dungeons/' + id + '/missoes', m),
    atualizarMissao: async (mid, m) => API.put('/dungeons/missoes/' + mid, m),
    deletarMissao:async (mid)     => API.delete('/dungeons/missoes/' + mid),
    // Ciclo de vida da sessão
    sessao:       async (id)      => API.get('/dungeons/' + id + '/sessao'),
    entrar:       async (id)      => API.post('/dungeons/' + id + '/entrar', {}),
    entrarArquiteto: async (id)   => API.post('/dungeons/' + id + '/entrar-arquiteto', {}),
    heartbeat:    async (id, teste = false) => API.post('/dungeons/' + id + '/heartbeat' + (teste ? '?teste=true' : ''), {}),
    sair:         async (id, teste = false) => API.post('/dungeons/' + id + '/sair' + (teste ? '?teste=true' : ''), {}),
    fracassar:    async (id)      => API.post('/dungeons/' + id + '/fracassar', {}),
    resetar:      async (id)      => API.post('/dungeons/' + id + '/resetar', {}),
    cancelar:     async (id)      => API.post('/dungeons/' + id + '/cancelar', {}),
    cumprir:      async (execId)  => API.post('/dungeons/execucoes/' + execId + '/cumprir', {}),
    iniciarExec:  async (execId)  => API.post('/dungeons/execucoes/' + execId + '/iniciar', {}),
    pausarExec:   async (execId)  => API.post('/dungeons/execucoes/' + execId + '/pausar', {}),
    retomarExec:  async (execId)  => API.post('/dungeons/execucoes/' + execId + '/retomar', {}),
    cancelarExec: async (execId)  => API.post('/dungeons/execucoes/' + execId + '/cancelar', {}),
    historico:    async (id)      => API.get('/dungeons/' + id + '/historico'),
    score:        async (id, filtros = {}) => {
      const p = new URLSearchParams();
      if (filtros.inicio)        p.set('inicio', filtros.inicio);
      if (filtros.fim)           p.set('fim', filtros.fim);
      if (filtros.status)        p.set('status', filtros.status);
      if (filtros.natureza)      p.set('natureza', filtros.natureza);
      if (filtros.apenas_falhas) p.set('apenas_falhas', 'true');
      const q = p.toString() ? '?' + p.toString() : '';
      return API.get('/dungeons/' + id + '/score' + q);
    },
  };

  /* ── Recompensas ──────────────────────────────────────── */
  static recompensas = {
    listar:  async ()   => API.get('/recompensas/'),
    resgatar:async (id) => API.post('/recompensas/' + id + '/resgatar', {}),
  };

  /* ── Conquistas ─────────────────────────────────────── */
  static conquistas = {
    listar:        async ()   => API.get('/conquistas/'),
    comemorativas: async ()   => API.get('/conquistas/comemorativas'),
    conceder:      async (id) => API.post('/conquistas/' + id + '/conceder', {}),
    revogar:       async (id) => API.delete('/conquistas/' + id + '/revogar'),
    visibilidade:  async (id, visivel) => API.put('/conquistas/' + id + '/visibilidade', { visivel }),
  };

  /* ── Perfil ──────────────────────────────────────────── */
  static perfil = {
    get: async () => API.get('/perfil/'),
    reliquias: async ()          => API.get('/perfil/reliquias'),
    definirReliquias: async (c)  => API.put('/perfil/reliquias', { codigos: c }),
    uploadAvatar: async (formData) => {
      const res = await fetch(API.BASE + '/perfil/avatar', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + API.token },
        body: formData,
      });
      if (!res.ok) throw new Error('Falha no upload de avatar');
      return res.json();
    },
  };

  /* ── Configuracoes ───────────────────────────────────── */
  static configuracoes = {
    get:      async ()            => API.get('/configuracoes/'),
    atualizar:async (chave, val)  => API.put('/configuracoes/', { chave, valor: val }),
    batch:    async (configs)     => API.put('/configuracoes/batch', { configs }),
  };

  /* ── Gerencial (Admin) ─────────────────────────────────── */
  static gerencial = {
    stats:    async ()             => API.get('/gerencial/stats'),
    usuarios: async ()             => API.get('/gerencial/usuarios'),
    ajustar:  async (id, payload)  => API.put('/gerencial/usuarios/' + id, payload),
    deletar:  async (id)           => API.delete('/gerencial/usuarios/' + id),
    logs:     async (limit = 50)   => API.get('/gerencial/logs?limit=' + limit),
  };
}

// Expõe globalmente
window.API = API;
