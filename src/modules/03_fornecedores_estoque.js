'use strict';
/* =====================================================================
   GHC GESTÃO — MÓDULO 03: FORNECEDORES, AVALIAÇÕES E ESTOQUE DINÂMICO
   ---------------------------------------------------------------------
   Este módulo implementa a gestão estratégica da cadeia de suprimentos:
   1. Cadastro Homologado de Fornecedores e Ficha Cadastral 360°
   2. Avaliação de Desempenho (SLA de Preço, Prazo, Qualidade, SAC, Docs)
   3. Controle de Estoque com Reposição Dinâmica e Ponto de Pedido (ROP)
   
   Contratos consumidos do core.js:
   - U (utilitários de moeda, formatação, data e busca)
   - Icon (biblioteca vetorial SVG estilo Lucide)
   - Store (repositório centralizado, persistência e commit)
   - Rules (motor de regras puras: alçadas, estoque, SLA de fornecedores)
   - UI (componentes de design system: badges, KPIs, tabelas, modais, toasts)
   - App (registro de páginas no ciclo de vida do ERP)
   ===================================================================== */

// Objeto global do módulo para encapsular estado e handlers de interface
const ModFornecedoresEstoque = {
  // Estado local para controle de filtros reativos sem repintar a tela inteira
  state: {
    fornecedores: {
      busca: '',
      categoria: '',
      status: '',
    },
    avaliacoes: {
      busca: '',
      fornecedorId: '',
    },
    estoque: {
      busca: '',
      categoria: '',
      aba: 'todos', // 'todos' | 'comprar' | 'critico' | 'normais'
    },
    movimentos: {
      busca: '',
      tipo: '',
    },
  },

  /* ===================================================================
     1. PÁGINA: FORNECEDORES (CADASTROS)
     =================================================================== */

  // Renderizador principal da página de Fornecedores
  renderFornecedores(el, params) {
    // Calculando métricas de alto nível para os cards de KPI
    const total = Store.db.fornecedores.length;
    const ativos = Store.db.fornecedores.filter(f => f.status === 'Ativo').length;
    const categoriasUnicas = new Set(Store.db.fornecedores.map(f => f.categoria)).size;
    
    // Média geral da base considerando todos os fornecedores avaliados
    const fornecedoresComNota = Store.db.fornecedores
      .map(f => Rules.notaFornecedor(f.id).nota)
      .filter(n => n !== null);
    const mediaGeral = fornecedoresComNota.length
      ? U.num(U.sum(fornecedoresComNota, x => x) / fornecedoresComNota.length, 1)
      : '—';

    // Montando a estrutura visual da página
    el.innerHTML = `
      ${UI.pageHead({
        eyebrow: 'Cadastros Estratégicos',
        title: 'Gestão de Fornecedores',
        sub: 'Homologação, histórico contratual, condições comerciais e indicador unificado de desempenho (SLA).',
        actions: UI.btn('Novo Fornecedor', {
          icon: 'plus',
          variant: 'primary',
          onclick: 'ModFornecedoresEstoque.modalNovoFornecedor()',
          title: 'Cadastrar nova empresa parceira no catálogo homologado',
        }),
      })}

      <!-- KPIs Estratégicos de Fornecedores -->
      <div class="kpis">
        ${UI.kpi({ label: 'Total de Fornecedores', value: total, note: 'Empresas cadastradas', icon: 'building', tone: 'dark' })}
        ${UI.kpi({ label: 'Fornecedores Ativos', value: ativos, note: `${total - ativos} inativos ou em homologação`, icon: 'checkCircle', tone: 'light' })}
        ${UI.kpi({ label: 'Categorias Atendidas', value: categoriasUnicas, note: 'Segmentos de materiais e serviços', icon: 'layers', tone: 'light' })}
        ${UI.kpi({ label: 'Nota Média da Base', value: mediaGeral, note: 'Avaliação de entregas e SLA', icon: 'star', tone: 'light' })}
      </div>

      <!-- Card principal com toolbar e listagem -->
      <div class="card flush">
        <div class="toolbar">
          <div class="search">
            ${Icon('search')}
            <input
              type="text"
              id="buscaFornecedorInput"
              placeholder="Buscar por razão social, nome fantasia, CNPJ, contato ou cidade..."
              value="${U.esc(this.state.fornecedores.busca)}"
              oninput="ModFornecedoresEstoque.onBuscaFornecedor(this.value)"
            />
          </div>
          <select id="filtroFornecedorCategoria" onchange="ModFornecedoresEstoque.onFiltroFornecedorCategoria(this.value)">
            <option value="">Todas as categorias</option>
            ${Rules.CATEGORIAS.map(cat => `<option value="${cat}" ${this.state.fornecedores.categoria === cat ? 'selected' : ''}>${cat}</option>`).join('')}
          </select>
          <select id="filtroFornecedorStatus" onchange="ModFornecedoresEstoque.onFiltroFornecedorStatus(this.value)">
            <option value="">Todos os status</option>
            ${Rules.STATUS_FORNECEDOR.map(st => `<option value="${st}" ${this.state.fornecedores.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        </div>

        <div id="fornecedoresTabelaContainer"></div>
      </div>
    `;

    // Desenha a tabela com os filtros atuais
    this.renderTabelaFornecedores();

    // Se veio parâmetro para abrir ficha específica (ex: App.go('fornecedores', { id: 'G01' }))
    if (params && params.id) {
      setTimeout(() => this.modalFichaFornecedor(params.id), 50);
    }
  },

  // Atualiza apenas a tabela de fornecedores preservando o foco do input de busca
  renderTabelaFornecedores() {
    const container = document.getElementById('fornecedoresTabelaContainer');
    if (!container) return;

    const { busca, categoria, status } = this.state.fornecedores;

    // Filtragem dos registros conforme os critérios da toolbar
    const filtrados = Store.db.fornecedores.filter(f => {
      if (categoria && f.categoria !== categoria) return false;
      if (status && f.status !== status) return false;
      if (busca && !U.match(busca, f.id, f.razao, f.fantasia, f.cnpj, f.contato, f.telefone, f.email, f.cidade)) {
        return false;
      }
      return true;
    });

    // Renderizando tabela com o componente padrão UI.table
    container.innerHTML = UI.table({
      columns: [
        {
          label: 'Código',
          width: '90px',
          render: f => `<span class="mono strong c-orange">${U.esc(f.id)}</span>`,
        },
        {
          label: 'Fornecedor',
          render: f => `
            <div class="cell-main">${U.esc(f.fantasia || f.razao)}</div>
            <div class="cell-sub">${U.esc(f.razao)}</div>
          `,
        },
        {
          label: 'Categoria',
          render: f => `<span class="chip">${U.esc(f.categoria)}</span>`,
        },
        {
          label: 'CNPJ',
          render: f => `<span class="mono small">${U.esc(f.cnpj)}</span>`,
        },
        {
          label: 'Contato / Fone',
          render: f => `
            <div class="cell-main small">${U.esc(f.contato || '—')}</div>
            <div class="cell-sub">${U.esc(f.telefone || f.email || '—')}</div>
          `,
        },
        {
          label: 'Cidade/UF',
          render: f => `<span class="small">${U.esc(f.cidade || '—')}</span>`,
        },
        {
          label: 'Prazo Médio',
          align: 'center',
          render: f => `<span>${f.prazoMedio ? f.prazoMedio + ' dias' : '—'}</span>`,
        },
        {
          label: 'Nota SLA',
          align: 'center',
          render: f => {
            const inf = Rules.notaFornecedor(f.id);
            return UI.nota(inf.nota);
          },
        },
        {
          label: 'Status',
          render: f => UI.badge(f.status),
        },
        {
          label: 'Ações',
          align: 'right',
          width: '180px',
          render: f => `
            <div class="row" style="justify-content: flex-end; gap: 6px;">
              ${UI.btn('Ficha', {
                icon: 'eye',
                size: 'xs',
                variant: 'ghost',
                onclick: `ModFornecedoresEstoque.modalFichaFornecedor('${f.id}')`,
                title: 'Visualizar ficha técnica e histórico',
              })}
              ${UI.btn('Editar', {
                icon: 'edit',
                size: 'xs',
                variant: 'ghost',
                onclick: `ModFornecedoresEstoque.modalEditarFornecedor('${f.id}')`,
                title: 'Editar dados cadastrais',
              })}
            </div>
          `,
        },
      ],
      rows: filtrados,
      empty: 'Nenhum fornecedor localizado com os filtros selecionados.',
    });
  },

  // Handlers reativos de filtro da tela de fornecedores
  onBuscaFornecedor(val) {
    this.state.fornecedores.busca = val;
    this.renderTabelaFornecedores();
  },

  onFiltroFornecedorCategoria(val) {
    this.state.fornecedores.categoria = val;
    this.renderTabelaFornecedores();
  },

  onFiltroFornecedorStatus(val) {
    this.state.fornecedores.status = val;
    this.renderTabelaFornecedores();
  },

  // Modal para cadastro de um novo fornecedor
  modalNovoFornecedor() {
    // Geração do próximo código com prefixo 'G' (ex: G11)
    const proximoCodigo = Store.nextId('G', Store.db.fornecedores, 'id', 2);

    UI.modal({
      title: 'Novo Fornecedor Homologado',
      sub: 'Cadastre os dados fiscais, operacionais e termos comerciais da empresa parceira.',
      size: 'lg',
      submitLabel: 'Salvar Fornecedor',
      body: `
        <div class="form-grid">
          <div class="form-section">Identificação da Empresa</div>
          ${UI.field({ name: 'id', label: 'Código', value: proximoCodigo, readonly: true, hint: 'Código sequencial atribuído pelo sistema' })}
          ${UI.field({ name: 'status', label: 'Status Inicial', type: 'select', value: 'Ativo', options: Rules.STATUS_FORNECEDOR, required: true })}
          ${UI.field({ name: 'razao', label: 'Razão Social', placeholder: 'Ex: Metalúrgica Paulista S.A.', required: true, full: true })}
          ${UI.field({ name: 'fantasia', label: 'Nome Fantasia', placeholder: 'Ex: Paulista Metais', required: true })}
          ${UI.field({ name: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0001-00', required: true })}
          ${UI.field({ name: 'categoria', label: 'Categoria Principal', type: 'select', options: Rules.CATEGORIAS, required: true })}
          ${UI.field({ name: 'cidade', label: 'Cidade / UF', placeholder: 'Ex: São Paulo/SP', required: true })}

          <div class="form-section">Contato e Comunicação</div>
          ${UI.field({ name: 'contato', label: 'Pessoa de Contato', placeholder: 'Ex: Carlos Silva (Vendas)', required: true })}
          ${UI.field({ name: 'telefone', label: 'Telefone Comercial', placeholder: '(11) 9999-9999', required: true })}
          ${UI.field({ name: 'email', label: 'E-mail Comercial', type: 'email', placeholder: 'comercial@fornecedor.com.br', required: true, full: true })}

          <div class="form-section">Condições Comerciais e Logística</div>
          ${UI.field({ name: 'prazoMedio', label: 'Prazo Médio de Entrega (dias)', type: 'number', value: '3', min: 0, required: true, hint: 'Tempo de entrega padrão para Grande SP' })}
          ${UI.field({ name: 'pagamento', label: 'Condição Padrão de Pagamento', type: 'select', value: 'Boleto 28 dias', options: Rules.PAGAMENTOS, required: true })}
          ${UI.field({ name: 'obs', label: 'Observações e Escopo de Atendimento', type: 'textarea', full: true, placeholder: 'Descreva os materiais fornecidos, certificados vigentes, laudos técnicos...' })}
        </div>
      `,
      onSubmit: (values) => {
        // Validação de duplicidade de CNPJ
        const duplicado = Store.db.fornecedores.find(
          f => f.cnpj.replace(/\D/g, '') === values.cnpj.replace(/\D/g, '')
        );
        if (duplicado) {
          UI.toast(`CNPJ já cadastrado no fornecedor ${duplicado.fantasia} (${duplicado.id}).`, 'error');
          return false;
        }

        // Montando o registro formatado
        const novoFornecedor = {
          id: values.id || proximoCodigo,
          razao: values.razao.trim(),
          fantasia: values.fantasia.trim(),
          cnpj: values.cnpj.trim(),
          categoria: values.categoria,
          contato: values.contato.trim(),
          telefone: values.telefone.trim(),
          email: values.email.trim(),
          cidade: values.cidade.trim(),
          status: values.status || 'Ativo',
          prazoMedio: U.parseNum(values.prazoMedio) || 3,
          pagamento: values.pagamento || 'Boleto 28 dias',
          obs: (values.obs || '').trim(),
        };

        // Persistência no banco central
        Store.db.fornecedores.push(novoFornecedor);
        Store.commit(`Fornecedor ${novoFornecedor.fantasia} cadastrado com sucesso!`);
      },
    });
  },

  // Modal para edição de fornecedor existente
  modalEditarFornecedor(id) {
    const f = Store.fornecedor(id);
    if (!f) return UI.toast('Fornecedor não encontrado.', 'error');

    UI.modal({
      title: `Editar Fornecedor: ${f.fantasia || f.razao}`,
      sub: `Código de registro: ${f.id} · CNPJ: ${f.cnpj}`,
      size: 'lg',
      submitLabel: 'Salvar Alterações',
      body: `
        <div class="form-grid">
          <div class="form-section">Identificação da Empresa</div>
          ${UI.field({ name: 'id', label: 'Código', value: f.id, readonly: true })}
          ${UI.field({ name: 'status', label: 'Status', type: 'select', value: f.status, options: Rules.STATUS_FORNECEDOR, required: true })}
          ${UI.field({ name: 'razao', label: 'Razão Social', value: f.razao, required: true, full: true })}
          ${UI.field({ name: 'fantasia', label: 'Nome Fantasia', value: f.fantasia, required: true })}
          ${UI.field({ name: 'cnpj', label: 'CNPJ', value: f.cnpj, required: true })}
          ${UI.field({ name: 'categoria', label: 'Categoria', type: 'select', value: f.categoria, options: Rules.CATEGORIAS, required: true })}
          ${UI.field({ name: 'cidade', label: 'Cidade / UF', value: f.cidade, required: true })}

          <div class="form-section">Contato e Comunicação</div>
          ${UI.field({ name: 'contato', label: 'Pessoa de Contato', value: f.contato, required: true })}
          ${UI.field({ name: 'telefone', label: 'Telefone', value: f.telefone, required: true })}
          ${UI.field({ name: 'email', label: 'E-mail Comercial', type: 'email', value: f.email, required: true, full: true })}

          <div class="form-section">Condições Comerciais e Logística</div>
          ${UI.field({ name: 'prazoMedio', label: 'Prazo Médio de Entrega (dias)', type: 'number', value: f.prazoMedio, min: 0, required: true })}
          ${UI.field({ name: 'pagamento', label: 'Condição Padrão de Pagamento', type: 'select', value: f.pagamento, options: Rules.PAGAMENTOS, required: true })}
          ${UI.field({ name: 'obs', label: 'Observações e Escopo', type: 'textarea', value: f.obs || '', full: true })}
        </div>
      `,
      onSubmit: (values) => {
        // Atualiza campos cadastrais no objeto em memória
        f.razao = values.razao.trim();
        f.fantasia = values.fantasia.trim();
        f.cnpj = values.cnpj.trim();
        f.categoria = values.categoria;
        f.contato = values.contato.trim();
        f.telefone = values.telefone.trim();
        f.email = values.email.trim();
        f.cidade = values.cidade.trim();
        f.status = values.status;
        f.prazoMedio = U.parseNum(values.prazoMedio) || 3;
        f.pagamento = values.pagamento;
        f.obs = (values.obs || '').trim();

        Store.commit(`Dados do fornecedor ${f.fantasia} atualizados com sucesso!`);
      },
    });
  },

  // Modal 360° com Ficha Completa do Fornecedor
  modalFichaFornecedor(id) {
    const f = Store.fornecedor(id);
    if (!f) return UI.toast('Fornecedor não encontrado.', 'error');

    // Desempenho consolidado do fornecedor
    const notaInfo = Rules.notaFornecedor(f.id);
    const avaliacoes = Store.db.avaliacoes.filter(a => a.fornecedorId === f.id);
    
    // Cotações onde este fornecedor participou
    const cotacoes = Store.db.cotacoes.filter(c =>
      (c.ofertas || []).some(o => o.fornecedorId === f.id)
    );

    // Pedidos de compra atendidos pelo fornecedor
    const pedidos = Store.db.pedidos.filter(p => p.fornecedorId === f.id);
    const totalComprado = U.sum(pedidos, p => Rules.pedidoTotal(p));

    // Render dos critérios com barras de progresso
    const crit = notaInfo.criterios || { preco: 0, prazo: 0, qualidade: 0, atendimento: 0, documentacao: 0 };
    const progTone = v => (v >= 8 ? 'ok' : v >= 6 ? 'warn' : 'bad');

    UI.modal({
      title: `Ficha Técnica: ${f.fantasia || f.razao}`,
      sub: `${f.id} · ${f.razao} · CNPJ: ${f.cnpj}`,
      size: 'xl',
      hideSubmit: true,
      cancelLabel: 'Fechar',
      extraFoot: `
        ${UI.btn('Nova Avaliação', {
          icon: 'star',
          size: 'sm',
          variant: 'primary',
          onclick: `ModFornecedoresEstoque.modalNovaAvaliacao('${f.id}')`,
        })}
        ${UI.btn('Editar Cadastro', {
          icon: 'edit',
          size: 'sm',
          variant: 'ghost',
          onclick: `ModFornecedoresEstoque.modalEditarFornecedor('${f.id}')`,
        })}
      `,
      body: `
        <div class="stack" style="gap: 20px;">
          <!-- Bloco Superior: Dados Gerais e Indicador de Nota -->
          <div class="grid grid-main">
            <!-- Dados Cadastrais -->
            <div class="card">
              <div class="card-head">
                <h2>Dados Cadastrais & Contato</h2>
                ${UI.badge(f.status)}
              </div>
              <div class="dl">
                <dt>Razão Social</dt><dd>${U.esc(f.razao)}</dd>
                <dt>Nome Fantasia</dt><dd><b>${U.esc(f.fantasia)}</b></dd>
                <dt>CNPJ</dt><dd class="mono">${U.esc(f.cnpj)}</dd>
                <dt>Categoria</dt><dd><span class="chip">${U.esc(f.categoria)}</span></dd>
                <dt>Contato</dt><dd>${U.esc(f.contato || '—')}</dd>
                <dt>Telefone</dt><dd>${U.esc(f.telefone || '—')}</dd>
                <dt>E-mail</dt><dd><a href="mailto:${U.esc(f.email)}">${U.esc(f.email || '—')}</a></dd>
                <dt>Localização</dt><dd>${U.esc(f.cidade || '—')}</dd>
                <dt>Prazo Médio</dt><dd><b>${f.prazoMedio} dias</b> úteis</dd>
                <dt>Condição Pgto</dt><dd>${U.esc(f.pagamento || '—')}</dd>
                <dt>Observações</dt><dd class="muted">${U.esc(f.obs || 'Nenhuma observação informada.')}</dd>
              </div>
            </div>

            <!-- Scorecard SLA de Desempenho -->
            <div class="card card-dark">
              <div class="card-head">
                <h2>Scorecard SLA de Desempenho</h2>
                ${UI.nota(notaInfo.nota)}
              </div>
              <div class="row between" style="margin-bottom: 16px;">
                <div>
                  <div class="label-caps" style="color: #94A3B8;">Nota Média Geral</div>
                  <div style="font-size: 36px; font-weight: 800; color: #fff; font-family: var(--font-head); line-height: 42px;">
                    ${notaInfo.nota !== null ? U.num(notaInfo.nota, 1) : '—'} <span style="font-size: 16px; color: #94A3B8; font-weight: 400;">/ 10</span>
                  </div>
                </div>
                <div class="t-right">
                  <div class="label-caps" style="color: #94A3B8;">Amostragem</div>
                  <div style="font-size: 20px; font-weight: 700; color: var(--orange); font-family: var(--font-head);">
                    ${notaInfo.total} ${notaInfo.total === 1 ? 'avaliação' : 'avaliações'}
                  </div>
                </div>
              </div>

              <!-- Barras de critério -->
              <div class="stack" style="gap: 10px;">
                <div>
                  <div class="row between small" style="margin-bottom: 3px;">
                    <span>Competitividade de Preço</span>
                    <b>${crit.preco ? U.num(crit.preco, 1) : '—'}</b>
                  </div>
                  ${UI.progress(crit.preco / 10, progTone(crit.preco))}
                </div>
                <div>
                  <div class="row between small" style="margin-bottom: 3px;">
                    <span>Pontualidade no Prazo de Entrega</span>
                    <b>${crit.prazo ? U.num(crit.prazo, 1) : '—'}</b>
                  </div>
                  ${UI.progress(crit.prazo / 10, progTone(crit.prazo))}
                </div>
                <div>
                  <div class="row between small" style="margin-bottom: 3px;">
                    <span>Qualidade e Conformidade dos Materiais</span>
                    <b>${crit.qualidade ? U.num(crit.qualidade, 1) : '—'}</b>
                  </div>
                  ${UI.progress(crit.qualidade / 10, progTone(crit.qualidade))}
                </div>
                <div>
                  <div class="row between small" style="margin-bottom: 3px;">
                    <span>Atendimento Comercial & Suporte</span>
                    <b>${crit.atendimento ? U.num(crit.atendimento, 1) : '—'}</b>
                  </div>
                  ${UI.progress(crit.atendimento / 10, progTone(crit.atendimento))}
                </div>
                <div>
                  <div class="row between small" style="margin-bottom: 3px;">
                    <span>Documentação Fiscal e Certificados (CA/Laudo)</span>
                    <b>${crit.documentacao ? U.num(crit.documentacao, 1) : '—'}</b>
                  </div>
                  ${UI.progress(crit.documentacao / 10, progTone(crit.documentacao))}
                </div>
              </div>
            </div>
          </div>

          <!-- Histórico de Pedidos de Compra (PCs) Fornecidos -->
          <div class="card flush">
            <div class="card-head">
              <h2>Histórico de Fornecimento (${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'})</h2>
              <span class="muted small">Volume faturado: <b class="c-orange">${U.brl(totalComprado)}</b></span>
            </div>
            ${UI.table({
              columns: [
                { label: 'Pedido', width: '95px', render: p => `<span class="mono strong">${U.esc(p.id)}</span>` },
                { label: 'Data', width: '90px', render: p => U.date(p.data) },
                { label: 'Cliente / Obra', render: p => `<div class="cell-main">${U.esc(p.cliente)}</div><div class="cell-sub">${U.esc(p.centroCusto)}</div>` },
                { label: 'Material', render: p => `<div class="cell-main">${U.esc(p.descricao)}</div><div class="cell-sub">${p.qtd} ${p.unid}</div>` },
                { label: 'Valor Total', align: 'right', render: p => `<b>${U.brl(Rules.pedidoTotal(p))}</b>` },
                {
                  label: 'SLA Entrega',
                  render: p => {
                    const ent = Rules.entrega(p);
                    return UI.badge(ent.situacao);
                  },
                },
                { label: 'Status Pedido', render: p => UI.badge(p.status) },
              ],
              rows: pedidos,
              empty: 'Nenhum pedido de compra emitido para este fornecedor até o momento.',
            })}
          </div>

          <!-- Histórico de Cotações Disputadas -->
          <div class="card flush">
            <div class="card-head">
              <h2>Participação em Cotações (${cotacoes.length})</h2>
              <span class="muted small">Histórico de concorrência e preços unitários ofertados</span>
            </div>
            ${UI.table({
              columns: [
                { label: 'Cotação', width: '95px', render: c => `<span class="mono strong">${U.esc(c.id)}</span>` },
                { label: 'SC Vinculada', width: '95px', render: c => `<span class="mono small">${U.esc(c.scId)}</span>` },
                { label: 'Data', width: '90px', render: c => U.date(c.data) },
                {
                  label: 'Proposta do Fornecedor',
                  render: c => {
                    const of = (c.ofertas || []).find(o => o.fornecedorId === f.id);
                    if (!of) return '—';
                    return `<b>${U.brl(of.valor)}</b> unit. · Frete: ${U.brl(of.frete)} · Prazo: ${of.prazo}d`;
                  },
                },
                {
                  label: 'Resultado',
                  render: c => {
                    const ofIdx = (c.ofertas || []).findIndex(o => o.fornecedorId === f.id);
                    if (c.status === 'Aprovada' && c.escolhida === ofIdx) {
                      return `<span class="badge badge-success">${Icon('check')} Proposta Vencedora</span>`;
                    }
                    if (c.status === 'Aprovada' && c.escolhida !== ofIdx) {
                      return `<span class="badge badge-neutral">Não Selecionado</span>`;
                    }
                    return UI.badge(c.status);
                  },
                },
              ],
              rows: cotacoes,
              empty: 'Este fornecedor ainda não foi incluído em mapas de cotação comparativos.',
            })}
          </div>

          <!-- Histórico das Avaliações Registradas -->
          <div class="card flush">
            <div class="card-head">
              <h2>Auditoria das Avaliações Registradas (${avaliacoes.length})</h2>
            </div>
            ${UI.table({
              columns: [
                { label: 'ID', width: '90px', render: a => `<span class="mono strong">${U.esc(a.id)}</span>` },
                { label: 'Data', width: '90px', render: a => U.date(a.data) },
                { label: 'Pedido Vinculado', width: '100px', render: a => `<span class="mono small">${U.esc(a.pedidoId || '—')}</span>` },
                { label: 'Nota Média', align: 'center', render: a => UI.nota(Rules.notaAvaliacao(a)) },
                { label: 'Avaliador', render: a => `<span class="small">${U.esc(a.responsavel)}</span>` },
                { label: 'Comentários e Parecer Técnico', render: a => `<div class="muted small">${U.esc(a.comentarios || 'Sem comentários')}</div>` },
              ],
              rows: avaliacoes,
              empty: 'Nenhuma avaliação individual registrada para este parceiro.',
            })}
          </div>
        </div>
      `,
    });
  },

  /* ===================================================================
     2. PÁGINA: AVALIAÇÃO DE FORNECEDORES (CADASTROS)
     =================================================================== */

  // Renderizador principal da página de Avaliação de Fornecedores
  renderAvaliacoes(el, params) {
    const avaliacoes = Store.db.avaliacoes;
    const totalAv = avaliacoes.length;

    // Cálculo da média geral da GHC
    const todasNotas = avaliacoes.map(a => Rules.notaAvaliacao(a));
    const mediaGeralGhc = todasNotas.length
      ? U.num(U.sum(todasNotas, x => x) / todasNotas.length, 1)
      : '—';

    // Identificação dos Fornecedores Top Performance (>= 8.5) e Críticos (< 7.0)
    const notasFornecedores = Store.db.fornecedores
      .map(f => ({ f, inf: Rules.notaFornecedor(f.id) }))
      .filter(item => item.inf.nota !== null);

    const topPerformance = notasFornecedores.filter(item => item.inf.nota >= 8.5).length;
    const criticos = notasFornecedores.filter(item => item.inf.nota < 7.0).length;

    el.innerHTML = `
      ${UI.pageHead({
        eyebrow: 'Gestão da Qualidade',
        title: 'Avaliação de Desempenho e SLA',
        sub: 'Auditoria contínua de entrega por 5 dimensões estratégicas: Preço, Prazo, Qualidade, SAC e Compliance Fiscal.',
        actions: UI.btn('Nova Avaliação', {
          icon: 'plus',
          variant: 'primary',
          onclick: 'ModFornecedoresEstoque.modalNovaAvaliacao()',
          title: 'Registrar avaliação de fornecimento ou entrega de pedido',
        }),
      })}

      <!-- KPIs da Gestão de Qualidade -->
      <div class="kpis">
        ${UI.kpi({ label: 'Média Geral da GHC', value: mediaGeralGhc, note: 'Nota consolidada de todos os fornecedores', icon: 'star', tone: 'dark' })}
        ${UI.kpi({ label: 'Avaliações Registradas', value: totalAv, note: 'Auditorias de fornecimento realizadas', icon: 'checkCircle', tone: 'light' })}
        ${UI.kpi({ label: 'Top Performance (≥ 8.5)', value: topPerformance, note: 'Fornecedores recomendados e prioritários', icon: 'trendUp', tone: 'light' })}
        ${UI.kpi({ label: 'Fornecedores Críticos (< 7.0)', value: criticos, note: 'Exigem plano de ação corretiva ou bloqueio', icon: 'alert', tone: 'light' })}
      </div>

      <!-- Ranking Visual de Fornecedores -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-head">
          <div>
            <h2>Ranking Geral de Performance dos Fornecedores</h2>
            <div class="hint">Classificação ordenada por nota média ponderada das avaliações realizadas</div>
          </div>
          <span class="chip">Atualizado em tempo real</span>
        </div>
        <div id="rankingFornecedoresContainer">
          ${this.buildRankingHtml()}
        </div>
      </div>

      <!-- Histórico Detalhado de Avaliações -->
      <div class="card flush">
        <div class="card-head">
          <div>
            <h2>Histórico Completo de Avaliações</h2>
            <div class="hint">Registro detalhado de cada evento avaliado com notas por critério</div>
          </div>
        </div>

        <div class="toolbar">
          <div class="search">
            ${Icon('search')}
            <input
              type="text"
              id="buscaAvaliacoesInput"
              placeholder="Buscar por avaliador, pedido, fornecedor ou observação..."
              value="${U.esc(this.state.avaliacoes.busca)}"
              oninput="ModFornecedoresEstoque.onBuscaAvaliacoes(this.value)"
            />
          </div>
          <select id="filtroAvaliacoesFornecedor" onchange="ModFornecedoresEstoque.onFiltroAvaliacoesFornecedor(this.value)">
            <option value="">Todos os fornecedores</option>
            ${Store.db.fornecedores.map(f => `<option value="${f.id}" ${this.state.avaliacoes.fornecedorId === f.id ? 'selected' : ''}>${f.fantasia || f.razao}</option>`).join('')}
          </select>
        </div>

        <div id="avaliacoesTabelaContainer"></div>
      </div>
    `;

    // Desenha a tabela com os filtros aplicados
    this.renderTabelaAvaliacoes();
  },

  // Monta os cards horizontais do Ranking Visual de Fornecedores
  buildRankingHtml() {
    // Coleta todos os fornecedores e calcula suas notas
    const ranking = Store.db.fornecedores.map(f => {
      const inf = Rules.notaFornecedor(f.id);
      return { f, ...inf };
    });

    // Ordena: primeiro os que têm nota (da maior para a menor), depois os sem avaliação
    ranking.sort((a, b) => {
      if (a.nota !== null && b.nota !== null) return b.nota - a.nota;
      if (a.nota !== null) return -1;
      if (b.nota !== null) return 1;
      return a.f.fantasia.localeCompare(b.f.fantasia);
    });

    if (!ranking.length) {
      return `<div class="empty">Nenhum fornecedor cadastrado para exibição do ranking.</div>`;
    }

    // Renderiza grid responsivo com cartões estilizados
    return `
      <div class="grid grid-2" style="gap: 14px;">
        ${ranking.map((item, idx) => {
          const { f, nota, total, criterios } = item;
          const pos = idx + 1;
          const posBadgeColor = pos === 1 ? 'background: #F59E0B; color: #fff;' : pos === 2 ? 'background: #94A3B8; color: #fff;' : pos === 3 ? 'background: #B45309; color: #fff;' : 'background: var(--chip); color: var(--slate);';
          const cr = criterios || { preco: 0, prazo: 0, qualidade: 0, atendimento: 0, documentacao: 0 };

          return `
            <div class="card" style="padding: 16px; border: 1px solid var(--border); box-shadow: none; position: relative;">
              <div class="row between" style="margin-bottom: 10px;">
                <div class="row" style="gap: 10px;">
                  <span class="badge no-dot" style="${posBadgeColor} font-weight: 800; font-size: 12px; min-width: 28px; justify-content: center;">#${pos}</span>
                  <div>
                    <div style="font-weight: 700; font-size: 14px; color: var(--text);">${U.esc(f.fantasia || f.razao)}</div>
                    <div class="small muted">${U.esc(f.categoria)} · ${U.esc(f.cidade)}</div>
                  </div>
                </div>
                <div class="t-right">
                  ${UI.nota(nota)}
                  <div class="small muted" style="margin-top: 2px;">${total} ${total === 1 ? 'avaliação' : 'avaliações'}</div>
                </div>
              </div>

              ${nota !== null ? `
                <div class="stack" style="gap: 6px; font-size: 11.5px; background: #FBFCFE; padding: 10px; border-radius: var(--r-md); border: 1px solid var(--border);">
                  <div class="row between">
                    <span class="muted">Preço: <b>${U.num(cr.preco, 1)}</b></span>
                    <span class="muted">Prazo: <b>${U.num(cr.prazo, 1)}</b></span>
                    <span class="muted">Qualidade: <b>${U.num(cr.qualidade, 1)}</b></span>
                  </div>
                  <div class="row between">
                    <span class="muted">Atendimento: <b>${U.num(cr.atendimento, 1)}</b></span>
                    <span class="muted">Documentação: <b>${U.num(cr.documentacao, 1)}</b></span>
                  </div>
                </div>
              ` : `
                <div class="notice info" style="margin-bottom: 0; padding: 8px 12px; font-size: 12px;">
                  Fornecedor homologado aguardando primeira avaliação de entrega.
                </div>
              `}

              <div class="row between" style="margin-top: 10px;">
                <button type="button" class="btn btn-ghost btn-xs" onclick="ModFornecedoresEstoque.modalFichaFornecedor('${f.id}')">
                  ${Icon('eye')} Ver Ficha
                </button>
                <button type="button" class="btn btn-outline-orange btn-xs" onclick="ModFornecedoresEstoque.modalNovaAvaliacao('${f.id}')">
                  ${Icon('plus')} Avaliar
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // Atualiza apenas a tabela com o histórico das avaliações
  renderTabelaAvaliacoes() {
    const container = document.getElementById('avaliacoesTabelaContainer');
    if (!container) return;

    const { busca, fornecedorId } = this.state.avaliacoes;

    const filtradas = Store.db.avaliacoes.filter(a => {
      if (fornecedorId && a.fornecedorId !== fornecedorId) return false;
      if (busca && !U.match(busca, a.id, a.pedidoId, a.responsavel, a.comentarios, Store.fornecedorNome(a.fornecedorId))) {
        return false;
      }
      return true;
    });

    container.innerHTML = UI.table({
      columns: [
        {
          label: 'ID',
          width: '90px',
          render: a => `<span class="mono strong c-orange">${U.esc(a.id)}</span>`,
        },
        {
          label: 'Data',
          width: '90px',
          render: a => U.date(a.data),
        },
        {
          label: 'Fornecedor',
          render: a => `
            <div class="cell-main">${U.esc(Store.fornecedorNome(a.fornecedorId))}</div>
            <div class="cell-sub">${U.esc(a.fornecedorId)}</div>
          `,
        },
        {
          label: 'Pedido Ref.',
          width: '100px',
          render: a => `<span class="mono small">${U.esc(a.pedidoId || '—')}</span>`,
        },
        {
          label: 'Notas por Critério (0 a 10)',
          render: a => `
            <div class="small" style="line-height: 1.4;">
              Preço: <b>${a.preco}</b> · Prazo: <b>${a.prazo}</b> · Qual.: <b>${a.qualidade}</b><br>
              Atend.: <b>${a.atendimento}</b> · Docs: <b>${a.documentacao}</b>
            </div>
          `,
        },
        {
          label: 'Média Final',
          align: 'center',
          render: a => UI.nota(Rules.notaAvaliacao(a)),
        },
        {
          label: 'Avaliador',
          render: a => `<span class="small strong">${U.esc(a.responsavel)}</span>`,
        },
        {
          label: 'Comentários',
          render: a => `<div class="small muted" style="max-width: 280px;">${U.esc(a.comentarios || '—')}</div>`,
        },
        {
          label: 'Ações',
          align: 'right',
          width: '80px',
          render: a => `
            <button type="button" class="btn btn-ghost btn-xs btn-danger" onclick="ModFornecedoresEstoque.confirmarExclusaoAvaliacao('${a.id}')" title="Excluir avaliação">
              ${Icon('trash')}
            </button>
          `,
        },
      ],
      rows: filtradas,
      empty: 'Nenhuma avaliação encontrada com os critérios informados.',
    });
  },

  onBuscaAvaliacoes(val) {
    this.state.avaliacoes.busca = val;
    this.renderTabelaAvaliacoes();
  },

  onFiltroAvaliacoesFornecedor(val) {
    this.state.avaliacoes.fornecedorId = val;
    this.renderTabelaAvaliacoes();
  },

  // Modal para lançamento de nova avaliação de fornecedor
  modalNovaAvaliacao(fornecedorIdPadrao = '', pedidoIdPadrao = '') {
    const proximoId = Store.nextId('AV-', Store.db.avaliacoes, 'id', 4);
    const usuarioLogado = Store.user().nome;

    // Opções de fornecedores
    const optsFornecedores = Store.db.fornecedores.map(f => ({
      value: f.id,
      label: `${f.id} — ${f.fantasia || f.razao} (${f.categoria})`,
    }));

    // Opções de pedidos para vínculo
    const optsPedidos = [
      { value: '', label: 'Sem vínculo específico com pedido (Avaliação Geral)' },
      ...Store.db.pedidos.map(p => ({
        value: p.id,
        label: `${p.id} — ${Store.fornecedorNome(p.fornecedorId)} · ${U.brl(Rules.pedidoTotal(p))} (${p.descricao})`,
      })),
    ];

    UI.modal({
      title: 'Nova Avaliação de Desempenho (SLA)',
      sub: 'Audite a entrega ou fornecimento pontuando as 5 dimensões com notas de 0 a 10.',
      size: 'lg',
      submitLabel: 'Registrar Avaliação',
      body: `
        <div class="form-grid">
          <div class="form-section">Fornecedor e Documento Relacionado</div>
          ${UI.field({
            name: 'fornecedorId',
            label: 'Fornecedor Avaliado',
            type: 'select',
            options: optsFornecedores,
            value: fornecedorIdPadrao || (optsFornecedores[0]?.value || ''),
            required: true,
            full: true,
          })}
          ${UI.field({
            name: 'pedidoId',
            label: 'Pedido de Compra Correspondente',
            type: 'select',
            options: optsPedidos,
            value: pedidoIdPadrao || '',
            full: true,
            hint: 'Vincular ao pedido permite auditar atrasos e divergências de notas fiscais',
          })}

          <div class="form-section">Critérios de Avaliação (Notas de 0.0 a 10.0)</div>
          ${UI.field({ name: 'preco', label: '1. Competitividade de Preço', type: 'number', value: '10', min: 0, max: 10, step: 0.5, required: true, hint: 'Aderência às cotações e negociação' })}
          ${UI.field({ name: 'prazo', label: '2. Prazo de Entrega', type: 'number', value: '10', min: 0, max: 10, step: 0.5, required: true, hint: 'Pontualidade na data combinada' })}
          ${UI.field({ name: 'qualidade', label: '3. Qualidade do Material', type: 'number', value: '10', min: 0, max: 10, step: 0.5, required: true, hint: 'Sem avarias, conformidade técnica' })}
          ${UI.field({ name: 'atendimento', label: '4. Atendimento Comercial', type: 'number', value: '10', min: 0, max: 10, step: 0.5, required: true, hint: 'Agilidade em dúvidas e suporte' })}
          ${UI.field({ name: 'documentacao', label: '5. Documentação Fiscal e Certificados', type: 'number', value: '10', min: 0, max: 10, step: 0.5, required: true, hint: 'NF correta, laudo, CA de EPIs' })}

          <div class="form-section">Responsabilidade e Parecer da Auditoria</div>
          ${UI.field({ name: 'responsavel', label: 'Responsável pela Avaliação', value: usuarioLogado, required: true })}
          ${UI.field({ name: 'data', label: 'Data da Avaliação', type: 'date', value: U.today(), required: true })}
          ${UI.field({ name: 'comentarios', label: 'Comentários Técnicos e Observações', type: 'textarea', full: true, placeholder: 'Descreva ocorrências, pontualidade, atendimento do motorista ou elogios ao parceiro...' })}
        </div>
      `,
      onSubmit: (values) => {
        // Validação das notas
        const campos = ['preco', 'prazo', 'qualidade', 'atendimento', 'documentacao'];
        for (const c of campos) {
          const val = U.parseNum(values[c]);
          if (isNaN(val) || val < 0 || val > 10) {
            UI.toast(`A nota do critério ${c} deve estar entre 0 e 10.`, 'error');
            return false;
          }
        }

        // Criando o registro no banco central
        const novaAv = {
          id: proximoId,
          data: values.data || U.today(),
          fornecedorId: values.fornecedorId,
          pedidoId: values.pedidoId || '—',
          preco: Math.min(10, Math.max(0, U.parseNum(values.preco))),
          prazo: Math.min(10, Math.max(0, U.parseNum(values.prazo))),
          qualidade: Math.min(10, Math.max(0, U.parseNum(values.qualidade))),
          atendimento: Math.min(10, Math.max(0, U.parseNum(values.atendimento))),
          documentacao: Math.min(10, Math.max(0, U.parseNum(values.documentacao))),
          responsavel: (values.responsavel || usuarioLogado).trim(),
          comentarios: (values.comentarios || '').trim(),
        };

        Store.db.avaliacoes.unshift(novaAv);
        Store.commit(`Avaliação ${novaAv.id} gravada com sucesso! As notas do fornecedor foram recalculadas.`);
      },
    });
  },

  // Confirmação para exclusão de avaliação
  confirmarExclusaoAvaliacao(id) {
    UI.confirm(
      `Deseja realmente remover a avaliação ${id}? O score do fornecedor será recalculado imediatamente.`,
      () => {
        Store.db.avaliacoes = Store.db.avaliacoes.filter(a => a.id !== id);
        Store.commit(`Avaliação ${id} removida com sucesso!`, 'info');
      },
      { title: 'Remover Avaliação', yesLabel: 'Excluir' }
    );
  },

  /* ===================================================================
     3. PÁGINA: CONTROLE DE ESTOQUE E REPOSIÇÃO DINÂMICA (SUPRIMENTOS)
     =================================================================== */

  // Renderizador principal da página de Estoque
  renderEstoque(el, params) {
    const itens = Store.db.estoque;
    const totalItens = itens.length;

    // Métricas analíticas do catálogo de materiais
    const analises = itens.map(i => Rules.estoque(i));
    const itensParaComprar = analises.filter(a => a.comprar).length;
    const itensCriticos = analises.filter(a => a.critico).length;
    const valorEstoqueTotal = U.sum(analises, a => a.valor);
    const consumoMensalGeral = U.sum(itens, i => i.consumoMensal);

    el.innerHTML = `
      ${UI.pageHead({
        eyebrow: 'Suprimentos & Almoxarifado',
        title: 'Controle de Estoque e Reposição',
        sub: 'Monitoramento dinâmico de saldo, Ponto de Pedido (ROP) baseado em consumo diário e prazo de entrega dos fornecedores.',
        actions: `
          ${UI.btn('Novo Material', {
            icon: 'plus',
            variant: 'ghost',
            onclick: 'ModFornecedoresEstoque.modalNovoItemEstoque()',
            title: 'Cadastrar novo código de item no almoxarifado',
          })}
        `,
      })}

      <!-- KPIs Estratégicos de Estoque -->
      <div class="kpis">
        ${UI.kpi({ label: 'Itens Cadastrados', value: totalItens, note: 'SKUs catalogados no almoxarifado', icon: 'box', tone: 'dark' })}
        ${UI.kpi({
          label: 'Necessidade de Compra',
          value: `<span class="${itensParaComprar > 0 ? 'c-orange' : ''}">${itensParaComprar}</span>`,
          note: `${itensCriticos} itens em nível crítico (< Mínimo)`,
          icon: 'alert',
          tone: itensCriticos > 0 ? 'dark' : 'light',
        })}
        ${UI.kpi({ label: 'Valor Total em Estoque', value: U.brlShort(valorEstoqueTotal), note: `Custo total do inventário físico`, icon: 'wallet', tone: 'light' })}
        ${UI.kpi({ label: 'Consumo Mensal Médio', value: `${U.num(consumoMensalGeral, 0)} un`, note: 'Giro mensal consolidado das operações', icon: 'refresh', tone: 'light' })}
      </div>

      <!-- Abas de Navegação do Almoxarifado -->
      <div class="tabs" id="estoqueTabs">
        ${this.buildTabsEstoqueHtml(itensParaComprar, itensCriticos, totalItens - itensParaComprar, totalItens)}
      </div>

      <!-- Card da Tabela de Materiais -->
      <div class="card flush" style="margin-bottom: 24px;">
        <div class="toolbar">
          <div class="search">
            ${Icon('search')}
            <input
              type="text"
              id="buscaEstoqueInput"
              placeholder="Buscar por código, material, categoria, localização ou fornecedor..."
              value="${U.esc(this.state.estoque.busca)}"
              oninput="ModFornecedoresEstoque.onBuscaEstoque(this.value)"
            />
          </div>
          <select id="filtroEstoqueCategoria" onchange="ModFornecedoresEstoque.onFiltroEstoqueCategoria(this.value)">
            <option value="">Todas as categorias</option>
            ${Rules.CATEGORIAS.map(cat => `<option value="${cat}" ${this.state.estoque.categoria === cat ? 'selected' : ''}>${cat}</option>`).join('')}
          </select>
        </div>

        <div id="estoqueTabelaContainer"></div>
      </div>

      <!-- Sub-painel: Histórico Recente de Entradas e Saídas -->
      <div class="card flush">
        <div class="card-head">
          <div>
            <h2>Histórico Recente de Entradas e Saídas</h2>
            <div class="hint">Log auditável de baixas em ordens de serviço (OS) e recebimentos de pedidos</div>
          </div>
        </div>

        <div id="estoqueMovimentosContainer">
          ${this.buildMovimentosHtml()}
        </div>
      </div>
    `;

    // Desenha a tabela com a aba e filtros atuais
    this.renderTabelaEstoque();
  },

  // Constrói os botões de abas com contadores dinâmicos
  buildTabsEstoqueHtml(qtdComprar, qtdCriticos, qtdNormais, totalGeral) {
    const { aba } = this.state.estoque;
    const tabs = [
      { id: 'todos', label: 'Todos os Itens', count: totalGeral },
      { id: 'comprar', label: 'Necessidade de Compra', count: qtdComprar },
      { id: 'critico', label: 'Saldo Crítico (< Mínimo)', count: qtdCriticos },
      { id: 'normais', label: 'Saldo Normal (OK)', count: qtdNormais },
    ];

    return tabs.map(t => `
      <button
        type="button"
        class="tab ${t.id === aba ? 'active' : ''}"
        onclick="ModFornecedoresEstoque.setAbaEstoque('${t.id}')"
      >
        ${t.label}
        ${t.count != null ? `<span class="count">${t.count}</span>` : ''}
      </button>
    `).join('');
  },

  // Alterna a aba ativa e redesenha a tabela
  setAbaEstoque(novaAba) {
    this.state.estoque.aba = novaAba;
    
    // Atualiza estado visual das abas
    const tabsContainer = document.getElementById('estoqueTabs');
    if (tabsContainer) {
      tabsContainer.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${novaAba}'`));
      });
    }

    this.renderTabelaEstoque();
  },

  // Renderiza a listagem de materiais de estoque
  renderTabelaEstoque() {
    const container = document.getElementById('estoqueTabelaContainer');
    if (!container) return;

    const { busca, categoria, aba } = this.state.estoque;

    // Filtragem baseada em busca, categoria e aba selecionada
    const filtrados = Store.db.estoque.filter(item => {
      const calc = Rules.estoque(item);

      // Filtro por aba
      if (aba === 'comprar' && !calc.comprar) return false;
      if (aba === 'critico' && !calc.critico) return false;
      if (aba === 'normais' && calc.comprar) return false;

      // Filtro por categoria
      if (categoria && item.categoria !== categoria) return false;

      // Filtro textual
      if (busca && !U.match(busca, item.codigo, item.material, item.categoria, item.local, item.obs, Store.fornecedorNome(item.fornecedorId))) {
        return false;
      }

      return true;
    });

    container.innerHTML = UI.table({
      columns: [
        {
          label: 'Código',
          width: '90px',
          render: i => `<span class="mono strong c-orange">${U.esc(i.codigo)}</span>`,
        },
        {
          label: 'Material / Descrição',
          render: i => `
            <div class="cell-main">${U.esc(i.material)}</div>
            <div class="cell-sub">${U.esc(i.local || 'Almoxarifado Central')} ${i.obs ? `· ${U.esc(i.obs)}` : ''}</div>
          `,
        },
        {
          label: 'Cat. / Unid.',
          render: i => `
            <span class="chip">${U.esc(i.categoria)}</span>
            <span class="muted small" style="margin-left: 4px;">${U.esc(i.unid)}</span>
          `,
        },
        {
          label: 'Saldo Atual',
          align: 'right',
          render: i => {
            const calc = Rules.estoque(i);
            const cor = calc.critico ? 'color: var(--error); font-weight: 800;' : calc.comprar ? 'color: var(--warning); font-weight: 700;' : 'font-weight: 600;';
            return `<span style="${cor} font-size: 14px;">${i.atual}</span> <span class="muted small">${i.unid}</span>`;
          },
        },
        {
          label: 'Mín / Máx',
          align: 'center',
          render: i => `<span class="small muted">${i.minimo} / ${i.maximo}</span>`,
        },
        {
          label: 'Consumo Médio',
          align: 'right',
          render: i => `<span class="small">${i.consumoMensal}/mês</span>`,
        },
        {
          label: 'Ponto de Pedido (ROP)',
          align: 'center',
          render: i => {
            const calc = Rules.estoque(i);
            return `
              <span class="mono small strong" title="Mínimo (${i.minimo}) + Consumo Diário (${U.num(calc.consumoDia, 1)}) × Prazo Fornecedor (${calc.prazo} dias)">
                ${calc.pontoPedido} ${i.unid}
              </span>
            `;
          },
        },
        {
          label: 'Status',
          align: 'center',
          render: i => {
            const calc = Rules.estoque(i);
            return UI.badge(calc.status);
          },
        },
        {
          label: 'Fornecedor Principal',
          render: i => `
            <div class="small strong">${U.esc(Store.fornecedorNome(i.fornecedorId))}</div>
            <div class="small muted">${i.fornecedorId ? `Prazo: ${Rules.estoque(i).prazo}d` : '—'}</div>
          `,
        },
        {
          label: 'Último Preço',
          align: 'right',
          render: i => `<span class="small">${U.brl(i.ultimoPreco)}</span>`,
        },
        {
          label: 'Valor em Estoque',
          align: 'right',
          render: i => {
            const calc = Rules.estoque(i);
            return `<b>${U.brl(calc.valor)}</b>`;
          },
        },
        {
          label: 'Ações Operacionais',
          align: 'right',
          width: '210px',
          render: i => `
            <div class="row" style="justify-content: flex-end; gap: 6px;">
              ${UI.btn('Gerar SC', {
                icon: 'filePlus',
                size: 'xs',
                variant: 'primary',
                onclick: `ModFornecedoresEstoque.modalGerarSolicitacao('${i.codigo}')`,
                title: `Gerar Solicitação de Compra sugerida (${Rules.estoque(i).sugestao} ${i.unid})`,
              })}
              ${UI.btn('Mover', {
                icon: 'refresh',
                size: 'xs',
                variant: 'ghost',
                onclick: `ModFornecedoresEstoque.modalMovimentacao('${i.codigo}')`,
                title: 'Registrar entrada ou saída de material',
              })}
              ${UI.btn('', {
                icon: 'edit',
                size: 'xs',
                variant: 'ghost',
                onclick: `ModFornecedoresEstoque.modalEditarItemEstoque('${i.codigo}')`,
                title: 'Editar parâmetros de estoque',
              })}
            </div>
          `,
        },
      ],
      rows: filtrados,
      empty: 'Nenhum material encontrado para esta visão.',
    });
  },

  onBuscaEstoque(val) {
    this.state.estoque.busca = val;
    this.renderTabelaEstoque();
  },

  onFiltroEstoqueCategoria(val) {
    this.state.estoque.categoria = val;
    this.renderTabelaEstoque();
  },

  // Monta tabela com histórico de movimentações (Entradas/Saídas)
  buildMovimentosHtml() {
    const movs = Store.db.movimentos || [];

    return UI.table({
      columns: [
        { label: 'Data', width: '90px', render: m => U.date(m.data) },
        { label: 'Tipo', width: '90px', render: m => UI.badge(m.tipo) },
        {
          label: 'Material / Código',
          render: m => {
            const item = Store.item(m.codigo);
            return `
              <div class="cell-main">${item ? U.esc(item.material) : U.esc(m.codigo)}</div>
              <div class="cell-sub mono">${U.esc(m.codigo)}</div>
            `;
          },
        },
        {
          label: 'Quantidade',
          align: 'right',
          render: m => {
            const item = Store.item(m.codigo);
            const unid = item ? item.unid : '';
            const sinal = m.tipo === 'Saída' ? '−' : '+';
            const cor = m.tipo === 'Saída' ? 'c-error' : 'c-success';
            return `<b class="${cor}">${sinal}${m.qtd} ${unid}</b>`;
          },
        },
        { label: 'Referência', render: m => `<span class="chip">${U.esc(m.ref || 'Ajuste')}</span>` },
        { label: 'Responsável', render: m => `<span class="small">${U.esc(m.responsavel || '—')}</span>` },
        { label: 'Observações', render: m => `<span class="muted small">${U.esc(m.obs || '—')}</span>` },
      ],
      rows: movs,
      empty: 'Nenhuma movimentação de material registrada.',
    });
  },

  // AÇÃO PODEROSA 1: Gerar Solicitação de Compras direta a partir do Estoque
  modalGerarSolicitacao(codigo) {
    const item = Store.item(codigo);
    if (!item) return UI.toast('Item de estoque não encontrado.', 'error');

    const calc = Rules.estoque(item);
    const qtdSugerida = calc.sugestao > 0 ? calc.sugestao : Math.max(1, (item.maximo || 10) - (item.atual || 0));
    const usuarioLogado = Store.user().nome;
    const proximaSc = Store.nextId('SC-', Store.db.solicitacoes, 'id', 4);

    UI.modal({
      title: `Gerar Solicitação de Reposição: ${item.codigo}`,
      sub: `${item.material} · Saldo Atual: ${item.atual} ${item.unid} (Ponto de Pedido: ${calc.pontoPedido})`,
      size: 'lg',
      submitLabel: 'Confirmar e Criar SC',
      body: `
        ${calc.critico ? UI.notice('Atenção: O saldo deste material está abaixo do Mínimo de segurança!', { icon: 'alert', tone: 'bad' }) : ''}
        <div class="form-grid">
          <div class="form-section">Dados da Solicitação de Compras</div>
          ${UI.field({ name: 'id', label: 'Código SC', value: proximaSc, readonly: true })}
          ${UI.field({ name: 'prioridade', label: 'Prioridade', type: 'select', value: calc.critico ? 'Urgente' : 'Alta', options: Rules.PRIORIDADES, required: true })}
          ${UI.field({ name: 'material', label: 'Material Solicitado', value: item.material, readonly: true, full: true })}
          ${UI.field({ name: 'qtd', label: 'Quantidade Sugerida para Reposição (Máx − Atual)', type: 'number', value: qtdSugerida, min: 1, required: true, hint: `Capacidade máxima cadastrada: ${item.maximo} ${item.unid}` })}
          ${UI.field({ name: 'unid', label: 'Unidade', value: item.unid, readonly: true })}
          ${UI.field({ name: 'categoria', label: 'Categoria', value: item.categoria, readonly: true })}
          ${UI.field({ name: 'fornecedorSugerido', label: 'Fornecedor Principal de Referência', value: Store.fornecedorNome(item.fornecedorId), readonly: true })}

          <div class="form-section">Destino da Compra e Alocação</div>
          ${UI.field({ name: 'cliente', label: 'Cliente / Contrato', value: 'GHC Facilities Central', required: true })}
          ${UI.field({ name: 'centroCusto', label: 'Centro de Custo', value: 'ALMOX-CENTRAL', required: true })}
          ${UI.field({ name: 'localEntrega', label: 'Local de Entrega', value: 'Barueri/SP - Almoxarifado Central', required: true, full: true })}
          ${UI.field({ name: 'solicitante', label: 'Solicitante Responsável', value: usuarioLogado, required: true })}
          ${UI.field({ name: 'dataNecessidade', label: 'Data Limite de Necessidade', type: 'date', value: U.addDays(U.today(), calc.prazo || 5), required: true })}
          ${UI.field({ name: 'obs', label: 'Justificativa Operacional', type: 'textarea', full: true, value: `Reposição automática de estoque disparada via ROP. Saldo atual: ${item.atual} ${item.unid}; Estoque Mínimo: ${item.minimo}; Ponto de Pedido: ${calc.pontoPedido}.` })}
        </div>
      `,
      onSubmit: (values) => {
        const qtdNumerica = U.parseNum(values.qtd);
        if (qtdNumerica <= 0) {
          UI.toast('A quantidade deve ser maior que zero.', 'error');
          return false;
        }

        // Criando a Solicitação de Compras no banco unificado
        const novaSolicitacao = {
          id: proximaSc,
          data: U.today(),
          solicitante: values.solicitante.trim(),
          area: 'Compras / Almoxarifado',
          cliente: values.cliente.trim(),
          centroCusto: values.centroCusto.trim(),
          localEntrega: values.localEntrega.trim(),
          categoria: item.categoria,
          descricao: item.material,
          especificacao: `Reposição de estoque SKU ${item.codigo}. Unidade: ${item.unid}.`,
          qtd: qtdNumerica,
          unid: item.unid,
          prioridade: values.prioridade,
          status: 'Aberta',
          dataNecessidade: values.dataNecessidade || U.addDays(U.today(), 5),
          obs: values.obs.trim(),
          itemCodigo: item.codigo,
        };

        Store.db.solicitacoes.unshift(novaSolicitacao);
        Store.commit(`Solicitação de Compra ${novaSolicitacao.id} criada com sucesso para reposição de ${item.material}!`);
      },
    });
  },

  // AÇÃO PODEROSA 2: Movimentação Rápida de Estoque (Saída em OS ou Entrada)
  modalMovimentacao(codigo) {
    const item = Store.item(codigo);
    if (!item) return UI.toast('Item de estoque não encontrado.', 'error');

    const usuarioLogado = Store.user().nome;

    UI.modal({
      title: `Registrar Movimentação: ${item.codigo}`,
      sub: `${item.material} · Saldo Atual: ${item.atual} ${item.unid}`,
      size: 'md',
      submitLabel: 'Confirmar Movimentação',
      body: `
        <div class="form-grid">
          ${UI.field({
            name: 'tipo',
            label: 'Tipo de Movimentação',
            type: 'select',
            options: [
              { value: 'Saída', label: 'Saída (Consumo em OS / Manutenção)' },
              { value: 'Entrada', label: 'Entrada (Reposição / Devolução / Ajuste)' },
            ],
            value: 'Saída',
            required: true,
            full: true,
          })}
          ${UI.field({ name: 'qtd', label: `Quantidade (${item.unid})`, type: 'number', value: '1', min: 1, required: true })}
          ${UI.field({ name: 'ref', label: 'Referência (ex: OS-8902 ou PC-0001)', placeholder: 'OS-XXXX / Balanço', required: true })}
          ${UI.field({ name: 'responsavel', label: 'Responsável', value: usuarioLogado, required: true, full: true })}
          ${UI.field({ name: 'obs', label: 'Observação / Motivo', type: 'textarea', full: true, placeholder: 'Ex: Aplicação em quadro elétrico Rochaverá...' })}
        </div>
      `,
      onSubmit: (values) => {
        const qtdNumerica = U.parseNum(values.qtd);
        if (qtdNumerica <= 0) {
          UI.toast('Informe uma quantidade válida superior a zero.', 'error');
          return false;
        }

        // Se for saída, valida se não ultrapassa o saldo atual
        if (values.tipo === 'Saída' && qtdNumerica > item.atual) {
          UI.toast(`Quantidade de saída (${qtdNumerica} ${item.unid}) é maior que o saldo atual (${item.atual} ${item.unid}).`, 'error');
          return false;
        }

        // Atualização do saldo físico do material
        if (values.tipo === 'Saída') {
          item.atual -= qtdNumerica;
        } else {
          item.atual += qtdNumerica;
        }

        // Registro da movimentação no histórico auditável
        const novoMovId = Store.nextId('MOV-', Store.db.movimentos, 'id', 4);
        Store.db.movimentos.unshift({
          id: novoMovId,
          data: U.today(),
          codigo: item.codigo,
          tipo: values.tipo,
          qtd: qtdNumerica,
          ref: values.ref.trim(),
          responsavel: values.responsavel.trim(),
          obs: (values.obs || '').trim(),
        });

        Store.commit(`Movimentação ${novoMovId} (${values.tipo} de ${qtdNumerica} ${item.unid}) registrada com sucesso! Novo saldo: ${item.atual} ${item.unid}`);
      },
    });
  },

  // Modal para cadastro de novo SKU no almoxarifado
  modalNovoItemEstoque() {
    const proximoCodigo = Store.nextId('MAT-', Store.db.estoque, 'codigo', 3);
    const optsFornecedores = Store.db.fornecedores.map(f => ({
      value: f.id,
      label: `${f.fantasia || f.razao} (${f.categoria})`,
    }));

    UI.modal({
      title: 'Cadastrar Novo Material de Estoque',
      sub: 'Insira as diretrizes de estocagem, consumo médio e fornecedor chave.',
      size: 'lg',
      submitLabel: 'Salvar Material',
      body: `
        <div class="form-grid">
          <div class="form-section">Identificação do Material</div>
          ${UI.field({ name: 'codigo', label: 'Código SKU', value: proximoCodigo, readonly: true })}
          ${UI.field({ name: 'categoria', label: 'Categoria', type: 'select', options: Rules.CATEGORIAS, required: true })}
          ${UI.field({ name: 'material', label: 'Nome / Descrição do Material', placeholder: 'Ex: Fita isolante 3M 19mm x 20m', required: true, full: true })}
          ${UI.field({ name: 'unid', label: 'Unidade de Medida', type: 'select', options: Rules.UNIDADES, value: 'un', required: true })}
          ${UI.field({ name: 'local', label: 'Localização no Almoxarifado', placeholder: 'Ex: Prateleira E-03 / Gaveta 04', required: true })}

          <div class="form-section">Parâmetros de Reposição e Consumo</div>
          ${UI.field({ name: 'atual', label: 'Saldo Inicial em Estoque', type: 'number', value: '0', min: 0, required: true })}
          ${UI.field({ name: 'minimo', label: 'Estoque Mínimo de Segurança', type: 'number', value: '10', min: 0, required: true })}
          ${UI.field({ name: 'maximo', label: 'Estoque Máximo Capacidade', type: 'number', value: '40', min: 1, required: true })}
          ${UI.field({ name: 'consumoMensal', label: 'Consumo Médio Mensal Previsto', type: 'number', value: '15', min: 0, required: true })}

          <div class="form-section">Fornecedor Preferencial e Custo</div>
          ${UI.field({ name: 'fornecedorId', label: 'Fornecedor Principal Homologado', type: 'select', options: optsFornecedores, required: true, full: true })}
          ${UI.field({ name: 'ultimoPreco', label: 'Último Preço Unitário (R$)', type: 'number', step: 0.01, value: '10.00', min: 0, required: true })}
          ${UI.field({ name: 'obs', label: 'Observações / Especificação Técnica', type: 'textarea', full: true, placeholder: 'Normas técnicas, CA de EPI ou detalhes de aplicação...' })}
        </div>
      `,
      onSubmit: (values) => {
        const novoItem = {
          codigo: values.codigo || proximoCodigo,
          material: values.material.trim(),
          categoria: values.categoria,
          unid: values.unid,
          atual: U.parseNum(values.atual),
          minimo: U.parseNum(values.minimo),
          maximo: U.parseNum(values.maximo),
          consumoMensal: U.parseNum(values.consumoMensal),
          fornecedorId: values.fornecedorId,
          ultimoPreco: U.parseNum(values.ultimoPreco),
          local: values.local.trim(),
          obs: (values.obs || '').trim(),
        };

        Store.db.estoque.push(novoItem);
        Store.commit(`Material ${novoItem.material} (${novoItem.codigo}) cadastrado com sucesso!`);
      },
    });
  },

  // Modal para editar parâmetros do SKU
  modalEditarItemEstoque(codigo) {
    const item = Store.item(codigo);
    if (!item) return UI.toast('Item de estoque não encontrado.', 'error');

    const optsFornecedores = Store.db.fornecedores.map(f => ({
      value: f.id,
      label: `${f.fantasia || f.razao} (${f.categoria})`,
    }));

    UI.modal({
      title: `Editar Material: ${item.codigo}`,
      sub: item.material,
      size: 'lg',
      submitLabel: 'Salvar Alterações',
      body: `
        <div class="form-grid">
          <div class="form-section">Identificação do Material</div>
          ${UI.field({ name: 'codigo', label: 'Código SKU', value: item.codigo, readonly: true })}
          ${UI.field({ name: 'categoria', label: 'Categoria', type: 'select', value: item.categoria, options: Rules.CATEGORIAS, required: true })}
          ${UI.field({ name: 'material', label: 'Descrição do Material', value: item.material, required: true, full: true })}
          ${UI.field({ name: 'unid', label: 'Unidade de Medida', type: 'select', value: item.unid, options: Rules.UNIDADES, required: true })}
          ${UI.field({ name: 'local', label: 'Localização', value: item.local || '', required: true })}

          <div class="form-section">Parâmetros de Reposição e Consumo</div>
          ${UI.field({ name: 'atual', label: 'Saldo Físico Atual', type: 'number', value: item.atual, min: 0, required: true })}
          ${UI.field({ name: 'minimo', label: 'Estoque Mínimo', type: 'number', value: item.minimo, min: 0, required: true })}
          ${UI.field({ name: 'maximo', label: 'Estoque Máximo', type: 'number', value: item.maximo, min: 1, required: true })}
          ${UI.field({ name: 'consumoMensal', label: 'Consumo Mensal Médio', type: 'number', value: item.consumoMensal, min: 0, required: true })}

          <div class="form-section">Fornecedor Preferencial e Custo</div>
          ${UI.field({ name: 'fornecedorId', label: 'Fornecedor Principal', type: 'select', value: item.fornecedorId, options: optsFornecedores, required: true, full: true })}
          ${UI.field({ name: 'ultimoPreco', label: 'Último Preço Unitário (R$)', type: 'number', step: 0.01, value: item.ultimoPreco, min: 0, required: true })}
          ${UI.field({ name: 'obs', label: 'Observações', type: 'textarea', value: item.obs || '', full: true })}
        </div>
      `,
      onSubmit: (values) => {
        item.material = values.material.trim();
        item.categoria = values.categoria;
        item.unid = values.unid;
        item.atual = U.parseNum(values.atual);
        item.minimo = U.parseNum(values.minimo);
        item.maximo = U.parseNum(values.maximo);
        item.consumoMensal = U.parseNum(values.consumoMensal);
        item.fornecedorId = values.fornecedorId;
        item.ultimoPreco = U.parseNum(values.ultimoPreco);
        item.local = values.local.trim();
        item.obs = (values.obs || '').trim();

        Store.commit(`Parâmetros do material ${item.codigo} atualizados com sucesso!`);
      },
    });
  },
};

/* =====================================================================
   REGISTRO DAS PÁGINAS NO CICLO DE VIDA DO ERP (APP.REGISTER)
   ===================================================================== */

// 1. Cadastros -> Fornecedores (Order: 1)
App.register({
  id: 'fornecedores',
  label: 'Fornecedores',
  icon: 'building',
  section: 'Cadastros',
  order: 1,
  render: (el, params) => ModFornecedoresEstoque.renderFornecedores(el, params),
});

// 2. Cadastros -> Avaliação de Fornecedores (Order: 2)
App.register({
  id: 'avaliacoes',
  label: 'Avaliação de Fornecedores',
  icon: 'star',
  section: 'Cadastros',
  order: 2,
  render: (el, params) => ModFornecedoresEstoque.renderAvaliacoes(el, params),
});

// 3. Suprimentos -> Controle de Estoque (Order: 1)
App.register({
  id: 'estoque',
  label: 'Controle de Estoque',
  icon: 'box',
  section: 'Suprimentos',
  order: 1,
  badge: () => {
    // Alerta visual no menu lateral com a quantidade de itens que atingiram ponto de reposição
    if (!Store.db || !Store.db.estoque) return null;
    const itensComprar = Store.db.estoque.filter(item => Rules.estoque(item).comprar).length;
    return itensComprar > 0 ? itensComprar : null;
  },
  render: (el, params) => ModFornecedoresEstoque.renderEstoque(el, params),
});
