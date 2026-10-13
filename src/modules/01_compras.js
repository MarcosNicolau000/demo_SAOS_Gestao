'use strict';
/* =====================================================================
   GHC GESTÃO — MÓDULO 01: COMPRAS, COTAÇÕES E ALÇADAS
   ---------------------------------------------------------------------
   Este módulo implementa o ciclo vital de aquisições de facilities:
   1. Solicitações de Compras (SC): abertura, triagem e controle
   2. Mapa de Cotação Comparativo: equalização de 3 propostas e economia
   3. Central de Aprovação por Alçada: governança e limites financeiros
   
   FLUXO ARQUITETURAL DO MÓDULO:
   // FLUXO DE COMPRAS E APROVAÇÃO POR ALÇADA
   // ENTRADA: Usuário operacional abre Solicitação de Compra (SC)
   // VERIFICAÇÃO: Material existente no catálogo ou avulso
        // MATERIAL CATALOGADO
              // Preenche especificações e sugere reposição de estoque
        // MATERIAL AVULSO
              // Requer detalhamento técnico completo
   // AÇÃO: Compradora inicia Mapa de Cotação Comparativo (3 Fornecedores)
   // CÁLCULO: (Valor Unitário × Quantidade) + Frete
   // COMPARAÇÃO: Identifica menor preço e calcula Economia Negociada
   // VERIFICAÇÃO DE REGRA DE NEGÓCIO:
        // MENOR PREÇO ESCOLHIDO COM 3 COTAÇÕES
              // Envio direto para aprovação conforme faixa de valor
        // OFERTA SUPERIOR OU MENOS DE 3 COTAÇÕES
              // Justificativa técnica/comercial OBRIGATÓRIA
   // ENCAMINHAMENTO: Define Alçada Requerida (Supervisão / Gerência / Diretoria)
   // DELIBERAÇÃO:
        // NÍVEL DO USUÁRIO >= ALÇADA EXIGIDA
              // Aprova (libera geração de Pedido PC) ou Reprova (devolve p/ cotação)
        // NÍVEL DO USUÁRIO < ALÇADA EXIGIDA
              // Bloqueia ação e orienta alternância de perfil na demonstração
   // RESULTADO FINAL: Compra homologada com rastreabilidade total
   ===================================================================== */

/* ---------------------------------------------------------------------
   Objeto Compras — Controlador central e escopo de métodos do módulo
   --------------------------------------------------------------------- */
const Compras = {
  // Filtros em memória para a listagem de Solicitações
  _scFiltros: {
    aba: 'todas',
    busca: '',
    prioridade: '',
    cliente: '',
    categoria: '',
  },

  // Filtros em memória para a listagem de Cotações
  _cotFiltros: {
    aba: 'todas',
    busca: '',
    status: '',
  },

  /* ===================================================================
     MÉTODOS DA PÁGINA: SOLICITAÇÕES DE COMPRA (SC)
     =================================================================== */

  // Atualiza o estado da aba de solicitações e redesenha a tabela
  setTabSC(abaId) {
    // Definindo a aba ativa no filtro
    this._scFiltros.aba = abaId;
    // Redesenhando o corpo da tabela de solicitações
    this.renderTabelaSC();
  },

  // Atualiza campo de busca textual ou filtros suspensos
  filtrarSC(campo, valor) {
    // Gravando o valor atualizado no estado local de filtros
    this._scFiltros[campo] = valor;
    // Redesenhando exclusivamente a tabela para não perder o foco do input
    this.renderTabelaSC();
  },

  // Retorna a lista de solicitações filtrada conforme critérios da tela
  obterSCFiltradas() {
    // Recuperando todas as solicitações registradas no Store
    const todas = Store.db.solicitacoes || [];
    const f = this._scFiltros;

    // Filtrando de acordo com a aba, busca e seletores ativos
    return todas.filter(s => {
      // Filtro de aba de status
      if (f.aba === 'abertas' && s.status !== 'Aberta') return false;
      if (f.aba === 'em_cotacao' && s.status !== 'Em cotação') return false;
      if (f.aba === 'aguardando_aprovacao' && s.status !== 'Aguardando aprovação') return false;
      if (f.aba === 'aprovadas_compradas' && !['Aprovada', 'Comprada'].includes(s.status)) return false;
      if (f.aba === 'canceladas' && s.status !== 'Cancelada') return false;

      // Filtro por prioridade
      if (f.prioridade && s.prioridade !== f.prioridade) return false;

      // Filtro por cliente / projeto
      if (f.cliente && s.cliente !== f.cliente) return false;

      // Filtro por categoria do item
      if (f.categoria && s.categoria !== f.categoria) return false;

      // Busca textual ampla
      if (f.busca && !U.match(f.busca, s.id, s.solicitante, s.area, s.cliente, s.centroCusto, s.descricao, s.especificacao)) {
        return false;
      }

      return true;
    });
  },

  // Atualiza o container da tabela de solicitações dinamicamente
  renderTabelaSC() {
    // Buscando o elemento de container da tabela na DOM
    const container = document.getElementById('sc-table-wrap');
    if (!container) return;

    // Obtendo as solicitações após aplicação dos filtros
    const lista = this.obterSCFiltradas();

    // Definição das colunas da tabela de solicitações
    const colunas = [
      {
        label: 'ID',
        render: s => `<span class="mono strong">${U.esc(s.id)}</span>`,
        width: '95px'
      },
      {
        label: 'Data / Nec.',
        render: s => `<div>${U.date(s.data)}</div><div class="cell-sub">Nec: ${U.date(s.dataNecessidade)}</div>`,
        width: '105px'
      },
      {
        label: 'Solicitante / Área',
        render: s => `<div class="cell-main">${U.esc(s.solicitante)}</div><div class="cell-sub">${U.esc(s.area)}</div>`
      },
      {
        label: 'Cliente / Centro de Custo',
        render: s => `<div class="cell-main">${U.esc(s.cliente)}</div><div class="cell-sub">${U.esc(s.centroCusto || 'Geral')}</div>`
      },
      {
        label: 'Material / Especificação',
        render: s => `<div class="cell-main">${U.esc(s.descricao)}</div><div class="cell-sub">${U.esc(s.especificacao || '—')}</div>`
      },
      {
        label: 'Qtd / Unid',
        align: 'right',
        render: s => `<span class="strong">${U.num(s.qtd)}</span> <span class="muted small">${U.esc(s.unid)}</span>`,
        width: '100px'
      },
      {
        label: 'Prioridade',
        align: 'center',
        render: s => UI.badge(s.prioridade),
        width: '105px'
      },
      {
        label: 'Status',
        align: 'center',
        render: s => UI.badge(s.status),
        width: '130px'
      },
      {
        label: 'Ações',
        align: 'right',
        render: s => this.renderAcoesSC(s),
        width: '160px'
      }
    ];

    // Injetando o HTML da tabela atualizada
    container.innerHTML = UI.table({
      columns: colunas,
      rows: lista,
      empty: 'Nenhuma solicitação encontrada com os filtros selecionados.',
      rowKey: 'id'
    });
  },

  // Monta os botões de ação contextuais para cada linha de solicitação
  renderAcoesSC(s) {
    // Array para acumular os botões de ação da linha
    const botoes = [];

    // Se estiver aberta, oferece atalho para iniciar cotação e cancelar
    if (s.status === 'Aberta') {
      botoes.push(UI.btn('Cotar', {
        icon: 'scale',
        size: 'xs',
        variant: 'primary',
        onclick: `Compras.cotarSC('${s.id}')`,
        title: 'Iniciar Mapa de Cotação'
      }));
      botoes.push(UI.btn('', {
        icon: 'trash',
        size: 'xs',
        variant: 'ghost',
        attrs: 'style="color:var(--error)"',
        onclick: `Compras.cancelarSC('${s.id}')`,
        title: 'Cancelar solicitação'
      }));
    } else if (s.status === 'Em cotação') {
      // Se já está em cotação, leva diretamente para o mapa
      botoes.push(UI.btn('Ver Cotação', {
        icon: 'scale',
        size: 'xs',
        variant: 'outline-orange',
        onclick: `Compras.abrirCotacaoPorSC('${s.id}')`,
        title: 'Abrir mapa comparativo'
      }));
    } else if (s.status === 'Aguardando aprovação') {
      // Se aguarda aprovação, oferece atalho para a tela de alçadas
      botoes.push(UI.btn('Alçada', {
        icon: 'checkCircle',
        size: 'xs',
        variant: 'dark',
        onclick: `App.go('aprovacoes')`,
        title: 'Ir para Central de Aprovações'
      }));
    }

    // Botão universal para visualizar detalhes completos
    botoes.push(UI.btn('', {
      icon: 'eye',
      size: 'xs',
      variant: 'ghost',
      onclick: `Compras.verDetalhesSC('${s.id}')`,
      title: 'Ver detalhes da solicitação'
    }));

    return `<div class="row" style="justify-content:flex-end;gap:4px">${botoes.join('')}</div>`;
  },

  // Modal para criação de uma nova Solicitação de Compra
  modalNovaSC() {
    // Gerando o próximo identificador sequencial (ex: SC-0010)
    const proximoId = Store.nextId('SC-', Store.db.solicitacoes);
    const usuarioAtual = Store.user();

    // Obtendo lista de clientes existentes para agilizar a digitação
    const clientesPredefinidos = [
      'Mercado Livre RC01',
      'Mercado Livre RC02',
      'Galpão Cajamar',
      'Condomínio Rochaverá',
      'CD B2W Louveira',
      'Hospital Alvorada',
      'Shopping Eldorado',
      'GHC Facilities Central'
    ];

    // Opções de materiais catalogados do estoque
    const opcoesEstoque = [
      { value: '', label: '— Material avulso / Não catalogado —' },
      ...Store.db.estoque.map(item => ({
        value: item.codigo,
        label: `${item.codigo} · ${item.material} (Saldo: ${item.atual} ${item.unid})`
      }))
    ];

    // Formulário em grid estilizado
    const corpoModal = `
      <div class="form-grid">
        <div class="form-section">1. Identificação e Origem da Demanda</div>
        ${UI.field({ name: 'id', label: 'Código SC', value: proximoId, readonly: true })}
        ${UI.field({ name: 'data', label: 'Data da Solicitação', type: 'date', value: U.today(), required: true })}
        ${UI.field({ name: 'solicitante', label: 'Solicitante', value: usuarioAtual.nome, required: true })}
        ${UI.field({ name: 'area', label: 'Área / Setor', value: usuarioAtual.perfil, required: true })}
        ${UI.field({ name: 'cliente', label: 'Cliente / Obra', type: 'select', options: clientesPredefinidos, required: true })}
        ${UI.field({ name: 'centroCusto', label: 'Centro de Custo', value: 'Meli RC01', placeholder: 'Ex: MANUT-PRED', required: true })}
        ${UI.field({ name: 'localEntrega', label: 'Local de Entrega', value: 'Almoxarifado Central - Barueri/SP', full: true, required: true })}

        <div class="form-section">2. Especificação do Material ou Serviço</div>
        ${UI.field({
          name: 'itemCodigo',
          label: 'Vincular a Item do Catálogo de Estoque',
          type: 'select',
          options: opcoesEstoque,
          full: true,
          hint: 'Ao selecionar um item do catálogo, a categoria, descrição e unidade são preenchidas automaticamente.'
        })}
        ${UI.field({ name: 'descricao', label: 'Descrição do Material / Serviço', placeholder: 'Nome claro e padronizado do material', full: true, required: true })}
        ${UI.field({ name: 'categoria', label: 'Categoria', type: 'select', options: Rules.CATEGORIAS, required: true })}
        ${UI.field({ name: 'prioridade', label: 'Prioridade', type: 'select', options: Rules.PRIORIDADES, value: 'Normal', required: true })}
        ${UI.field({ name: 'qtd', label: 'Quantidade', type: 'number', min: 1, step: 1, value: '1', required: true })}
        ${UI.field({ name: 'unid', label: 'Unidade', type: 'select', options: Rules.UNIDADES, value: 'un', required: true })}
        ${UI.field({ name: 'dataNecessidade', label: 'Data da Necessidade na Obra', type: 'date', value: U.addDays(U.today(), 5), required: true })}
        ${UI.field({ name: 'especificacao', label: 'Especificação Técnica Detalhada', type: 'textarea', placeholder: 'Marca recomendada, dimensões, norma técnica, CA para EPIs, etc.', full: true })}
        ${UI.field({ name: 'obs', label: 'Observações / Justificativa da Solicitação', type: 'textarea', placeholder: 'Motivo da compra (ex: reposição preventiva, atendimento de OS, corretiva urgente...)', full: true })}
      </div>
    `;

    // Abrindo o modal de cadastro
    UI.modal({
      title: 'Nova Solicitação de Compra',
      sub: 'Preencha os dados da requisição de suprimentos ou serviços.',
      size: 'lg',
      body: corpoModal,
      submitLabel: 'Salvar Solicitação',
      onOpen: form => {
        // Monitora seleção de item do estoque para autopreenchimento
        const selItem = form.querySelector('[name=itemCodigo]');
        const fDesc = form.querySelector('[name=descricao]');
        const fCat = form.querySelector('[name=categoria]');
        const fUnid = form.querySelector('[name=unid]');

        selItem.addEventListener('change', () => {
          const cod = selItem.value;
          if (cod) {
            const item = Store.item(cod);
            if (item) {
              fDesc.value = item.material;
              fCat.value = item.categoria;
              fUnid.value = item.unid;
            }
          }
        });
      },
      onSubmit: valores => {
        // Montando o novo objeto de solicitação de compra
        const novaSC = {
          id: proximoId,
          data: valores.data || U.today(),
          solicitante: valores.solicitante.trim(),
          area: valores.area.trim(),
          cliente: valores.cliente,
          centroCusto: valores.centroCusto.trim(),
          localEntrega: valores.localEntrega.trim(),
          categoria: valores.categoria,
          descricao: valores.descricao.trim(),
          especificacao: valores.especificacao ? valores.especificacao.trim() : '',
          qtd: U.parseNum(valores.qtd) || 1,
          unid: valores.unid,
          prioridade: valores.prioridade,
          status: 'Aberta',
          dataNecessidade: valores.dataNecessidade || U.addDays(U.today(), 5),
          obs: valores.obs ? valores.obs.trim() : '',
          itemCodigo: valores.itemCodigo || undefined,
        };

        // Persistindo no banco de dados local
        Store.db.solicitacoes.unshift(novaSC);
        Store.commit(`Solicitação ${novaSC.id} criada com sucesso!`);
      }
    });
  },

  // Modal para visualização detalhada de uma solicitação existente
  verDetalhesSC(scId) {
    // Buscando os dados da solicitação pelo identificador
    const sc = Store.sc(scId);
    if (!sc) return;

    // Buscando cotação e pedido relacionados caso existam
    const cot = Store.cotBySc(scId);
    const pedido = Store.pedidoBySc(scId);

    // Estruturando o corpo do modal com lista de definições
    const html = `
      <div class="stack" style="gap:18px">
        <div class="row between" style="padding-bottom:12px;border-bottom:1px solid var(--border)">
          <div>
            <div class="eyebrow">${U.esc(sc.categoria)} · ${U.esc(sc.prioridade)}</div>
            <h2 style="font-size:20px;margin-top:2px">${U.esc(sc.descricao)}</h2>
          </div>
          <div class="row" style="gap:8px">
            ${UI.badge(sc.prioridade)}
            ${UI.badge(sc.status)}
          </div>
        </div>

        <div class="dl">
          <dt>Código da SC:</dt>
          <dd><strong class="mono">${U.esc(sc.id)}</strong></dd>

          <dt>Data de Abertura:</dt>
          <dd>${U.date(sc.data)}</dd>

          <dt>Data Necessidade:</dt>
          <dd><span class="strong">${U.date(sc.dataNecessidade)}</span></dd>

          <dt>Solicitante:</dt>
          <dd>${U.esc(sc.solicitante)} (${U.esc(sc.area)})</dd>

          <dt>Cliente / Contrato:</dt>
          <dd>${U.esc(sc.cliente)}</dd>

          <dt>Centro de Custo:</dt>
          <dd>${U.esc(sc.centroCusto || '—')}</dd>

          <dt>Local de Entrega:</dt>
          <dd>${U.esc(sc.localEntrega || '—')}</dd>

          <dt>Quantidade:</dt>
          <dd><span class="strong" style="font-size:16px">${U.num(sc.qtd)} ${U.esc(sc.unid)}</span></dd>

          <dt>Item no Catálogo:</dt>
          <dd>${sc.itemCodigo ? `<span class="badge badge-info">${U.esc(sc.itemCodigo)}</span>` : '<span class="muted">Não vinculado</span>'}</dd>

          <dt>Especificação Técnica:</dt>
          <dd style="white-space:pre-wrap">${U.esc(sc.especificacao || 'Nenhuma especificação adicional.')}</dd>

          <dt>Observações:</dt>
          <dd style="white-space:pre-wrap">${U.esc(sc.obs || 'Nenhuma observação.')}</dd>
        </div>

        <div class="notice info" style="margin-top:8px">
          <div>
            <strong>Rastreabilidade do Ciclo de Compra:</strong><br>
            ${cot ? `• Cotação gerada: <strong>${cot.id}</strong> (Status: ${cot.status})<br>` : '• Nenhuma cotação vinculada até o momento.<br>'}
            ${pedido ? `• Pedido emitido: <strong>${pedido.id}</strong> (Status: ${pedido.status})` : '• Pedido de compra ainda não gerado.'}
          </div>
        </div>
      </div>
    `;

    // Montando botões extras no rodapé
    let botoesRodape = '';
    if (sc.status === 'Aberta') {
      botoesRodape = `<button type="button" class="btn btn-primary" onclick="Compras.cotarSC('${sc.id}')">${Icon('scale')} Iniciar Cotação</button>`;
    } else if (cot) {
      botoesRodape = `<button type="button" class="btn btn-outline-orange" onclick="App.go('cotacoes', { id: '${cot.id}' })">${Icon('scale')} Abrir Cotação ${cot.id}</button>`;
    }

    // Exibindo modal de detalhes
    UI.modal({
      title: `Detalhes da Solicitação ${sc.id}`,
      sub: `${sc.cliente} · ${sc.descricao}`,
      size: 'lg',
      body: html,
      hideSubmit: true,
      cancelLabel: 'Fechar',
      extraFoot: botoesRodape
    });
  },

  // Ação para cancelar uma solicitação aberta
  cancelarSC(scId) {
    // Buscando a solicitação
    const sc = Store.sc(scId);
    if (!sc) return;

    // Solicitando confirmação antes de alterar o status
    UI.confirm(
      `Deseja realmente cancelar a Solicitação de Compra <strong>${sc.id}</strong> (${sc.descricao})?`,
      () => {
        // Atualizando o status para Cancelada
        sc.status = 'Cancelada';
        // Persistindo e re-renderizando a interface
        Store.commit(`Solicitação ${sc.id} cancelada com sucesso.`, 'warning');
      },
      { title: 'Confirmar Cancelamento', yesLabel: 'Sim, Cancelar' }
    );
  },

  // Transforma uma SC aberta em processo de Cotação
  cotarSC(scId) {
    // Localizando a solicitação
    const sc = Store.sc(scId);
    if (!sc) return;

    // Verificando se já existe cotação criada para esta solicitação
    let cot = Store.cotBySc(scId);

    // Se não existir cotação, gera uma nova estrutura comparativa
    if (!cot) {
      const proximoCotId = Store.nextId('COT-', Store.db.cotacoes);
      const usuarioLogado = Store.user();

      // Buscando fornecedor padrão se o item for de catálogo
      const itemEstoque = sc.itemCodigo ? Store.item(sc.itemCodigo) : null;
      const fornecedorPadrao = itemEstoque?.fornecedorId || '';
      const precoPadrao = itemEstoque?.ultimoPreco || 0;

      // Criando a cotação com 3 colunas de ofertas vazias/pré-carregadas
      cot = {
        id: proximoCotId,
        scId: sc.id,
        data: U.today(),
        compradora: usuarioLogado.nome,
        ofertas: [
          { fornecedorId: fornecedorPadrao, valor: precoPadrao, frete: 0, prazo: 3, pagamento: 'Boleto 28 dias' },
          { fornecedorId: '', valor: 0, frete: 0, prazo: 0, pagamento: 'Boleto 28 dias' },
          { fornecedorId: '', valor: 0, frete: 0, prazo: 0, pagamento: 'Boleto 28 dias' },
        ],
        escolhida: 0,
        justificativa: '',
        status: 'Em cotação',
        nivelRequerido: 1,
        historico: [
          {
            data: U.today(),
            usuario: usuarioLogado.nome,
            acao: 'Cotação iniciada',
            obs: `Cotação comparativa aberta para atendimento da SC ${sc.id}`
          }
        ]
      };

      // Adicionando à lista de cotações
      Store.db.cotacoes.unshift(cot);
    }

    // Atualizando o status da SC para "Em cotação"
    sc.status = 'Em cotação';

    // Salvando alterações e navegando diretamente para o Mapa de Cotação
    Store.save();
    UI.toast(`Cotação ${cot.id} iniciada para ${sc.id}.`, 'info');
    App.go('cotacoes', { id: cot.id });
  },

  // Abre diretamente a cotação vinculada a uma SC
  abrirCotacaoPorSC(scId) {
    const cot = Store.cotBySc(scId);
    if (cot) {
      App.go('cotacoes', { id: cot.id });
    } else {
      this.cotarSC(scId);
    }
  },

  /* ===================================================================
     MÉTODOS DA PÁGINA: MAPA DE COTAÇÃO COMPARATIVO
     =================================================================== */

  // Atualiza a aba selecionada na listagem de cotações
  setTabCot(abaId) {
    this._cotFiltros.aba = abaId;
    App.rerender();
  },

  // Atualiza busca na tela de cotações
  filtrarCot(campo, valor) {
    this._cotFiltros[campo] = valor;
    App.rerender();
  },

  // Volta para a visualização geral da lista de cotações
  voltarListaCotacoes() {
    App.go('cotacoes', {});
  },

  // Atualiza campo de uma das 3 ofertas do mapa de cotação
  atualizarOferta(cotId, indexOferta, campo, valor) {
    // Localizando a cotação
    const cot = Store.cot(cotId);
    if (!cot) return;

    // Garantindo que a lista de ofertas existe
    cot.ofertas = cot.ofertas || [];
    while (cot.ofertas.length < 3) {
      cot.ofertas.push({ fornecedorId: '', valor: 0, frete: 0, prazo: 0, pagamento: 'Boleto 28 dias' });
    }

    // Atualizando a propriedade específica
    if (campo === 'fornecedorId' || campo === 'pagamento') {
      cot.ofertas[indexOferta][campo] = valor;
    } else {
      cot.ofertas[indexOferta][campo] = U.parseNum(valor);
    }

    // Recalculando a análise comparativa após alteração
    const analise = Rules.cotacao(cot);
    if (cot.escolhida == null || cot.escolhida < 0) {
      cot.escolhida = analise.menorIdx >= 0 ? analise.menorIdx : 0;
    }

    // Salvando alterações e atualizando o DOM da tela de cotações
    Store.save();
    App.rerender();
  },

  // Seleciona a oferta vencedora pelo índice (0, 1 ou 2)
  selecionarOferta(cotId, indexOferta) {
    const cot = Store.cot(cotId);
    if (!cot) return;

    // Definindo o índice da oferta escolhida
    cot.escolhida = Number(indexOferta);
    Store.save();
    App.rerender();
  },

  // Atualiza a justificativa técnica/comercial da cotação
  atualizarJustificativa(cotId, texto) {
    const cot = Store.cot(cotId);
    if (!cot) return;
    cot.justificativa = texto.trim();
    Store.save();
  },

  // Salva o rascunho da cotação em edição
  salvarRascunhoCotacao(cotId) {
    const cot = Store.cot(cotId);
    if (!cot) return;

    // Lendo o campo de justificativa da tela se houver
    const campoJust = document.getElementById('f_cot_justificativa');
    if (campoJust) {
      cot.justificativa = campoJust.value.trim();
    }

    // Registrando commit de rascunho
    Store.commit(`Rascunho da Cotação ${cot.id} salvo com sucesso!`, 'info');
  },

  // Valida regras de negócio e encaminha a cotação para a Central de Aprovação
  enviarParaAprovacao(cotId) {
    // Buscando a cotação e a solicitação de compra
    const cot = Store.cot(cotId);
    if (!cot) return;
    const sc = Store.sc(cot.scId);
    if (!sc) return;

    // Atualizando o texto da justificativa a partir do elemento na tela
    const campoJust = document.getElementById('f_cot_justificativa');
    if (campoJust) {
      cot.justificativa = campoJust.value.trim();
    }

    // Executando análise das 3 ofertas pela regra pura de negócio
    const analise = Rules.cotacao(cot);

    // Validação 1: Pelo menos uma oferta válida deve estar cadastrada
    if (analise.validas === 0) {
      UI.toast('Preencha ao menos uma proposta válida de fornecedor para prosseguir.', 'error');
      return;
    }

    // Validação 2: Oferta escolhida deve ser válida
    if (analise.totais[cot.escolhida] == null) {
      UI.toast('A oferta vencedora selecionada não possui fornecedor ou valor preenchido.', 'error');
      return;
    }

    // Validação 3: Justificativa obrigatória se houver menos de 3 cotações ou se a oferta não for a menor
    if (analise.precisaJustificativa && (!cot.justificativa || !cot.justificativa.trim())) {
      UI.toast('Atenção: A justificativa é OBRIGATÓRIA quando há menos de 3 propostas ou quando a menor cotação não for selecionada.', 'error');
      if (campoJust) campoJust.focus();
      return;
    }

    // Determinando o total da compra e a alçada financeira exigida
    const totalCompra = analise.escolhido;
    const alcadaExigida = Rules.alcada(totalCompra);

    // Atualizando o nível de alçada requerido e status
    cot.nivelRequerido = alcadaExigida.nivel;
    cot.status = 'Aguardando aprovação';
    sc.status = 'Aguardando aprovação';

    // Registrando no histórico de auditoria da cotação
    cot.historico = cot.historico || [];
    cot.historico.push({
      data: U.today(),
      usuario: Store.user().nome,
      acao: 'Enviada para aprovação',
      obs: `Valor total: ${U.brl(totalCompra)} · Alçada exigida: Nível ${alcadaExigida.nivel} (${alcadaExigida.nome})`
    });

    // Persistindo alterações
    Store.commit(`Cotação ${cot.id} enviada para aprovação na alçada de ${alcadaExigida.nome}!`, 'success');

    // Redirecionando automaticamente para a Central de Aprovações
    App.go('aprovacoes');
  },

  /* ===================================================================
     MÉTODOS DA PÁGINA: CENTRAL DE APROVAÇÕES POR ALÇADA
     =================================================================== */

  // Aprova formalmente uma cotação e oferece atalho para gerar Pedido PC
  aprovarCompra(cotId) {
    // Buscando cotação e solicitação vinculada
    const cot = Store.cot(cotId);
    if (!cot) return;
    const sc = Store.sc(cot.scId);
    const usuarioAtual = Store.user();

    // Verificação de segurança de permissão de alçada
    const analise = Rules.cotacao(cot);
    const alcadaReq = Rules.alcada(analise.escolhido);

    if (usuarioAtual.nivel < (cot.nivelRequerido || alcadaReq.nivel)) {
      UI.toast(`Alçada insuficiente. Requer nível ${alcadaReq.nivel} (${alcadaReq.nome}).`, 'error');
      return;
    }

    // Atualizando status da cotação e solicitação para Aprovada
    cot.status = 'Aprovada';
    if (sc) sc.status = 'Aprovada';

    // Adicionando ao histórico de auditoria
    cot.historico = cot.historico || [];
    cot.historico.push({
      data: U.today(),
      usuario: usuarioAtual.nome,
      acao: 'Aprovada',
      obs: `Compra de ${U.brl(analise.escolhido)} aprovada pelo perfil ${usuarioAtual.perfil} (Nível ${usuarioAtual.nivel})`
    });

    // Salvando alterações no Store
    Store.save();

    // Modal de confirmação oferecendo atalho imediato para gerar Pedido PC
    UI.modal({
      title: 'Compra Aprovada com Sucesso!',
      sub: `Cotação ${cot.id} liberada para faturamento.`,
      size: 'md',
      body: `
        <div class="stack" style="gap:14px">
          <div class="notice" style="border-color:var(--success);background:var(--success-tint);color:#065F46">
            <div>${Icon('checkCircle')}</div>
            <div>
              <strong>Aprovação Homologada com Sucesso!</strong><br>
              A compra no valor de <strong>${U.brl(analise.escolhido)}</strong> foi autorizada por <strong>${usuarioAtual.nome}</strong> (${usuarioAtual.perfil}).
            </div>
          </div>
          <p style="margin:0;font-size:13px">
            Deseja emitir o <strong>Pedido de Compra (PC)</strong> formal agora para envio ao fornecedor vencedor?
          </p>
        </div>
      `,
      submitLabel: 'Gerar Pedido (PC) Agora',
      cancelLabel: 'Manter Aprovada',
      onSubmit: () => {
        Compras.gerarPedido(cot.id);
      }
    });

    App.rerender();
  },

  // Reprova uma cotação com registro obrigatório de motivo
  reprovarCompra(cotId) {
    const cot = Store.cot(cotId);
    if (!cot) return;
    const sc = Store.sc(cot.scId);
    const usuarioAtual = Store.user();

    // Modal para preenchimento do motivo de reprovação
    UI.modal({
      title: 'Reprovar Cotação de Compra',
      sub: `Cotação ${cot.id} · A cotação será devolvida para renegociação da equipe de compras.`,
      size: 'md',
      body: `
        <div class="field full">
          <label for="f_motivo_reprovacao">Motivo da Reprovação <span class="req">*</span></label>
          <textarea id="f_motivo_reprovacao" name="motivo" class="field textarea" required placeholder="Descreva claramente o motivo (ex: valor acima do orçamento, prazo incompatível, necessidade de negociar prazo de pagamento...)"></textarea>
          <span class="hint">Este parecer será registrado no histórico de auditoria da cotação.</span>
        </div>
      `,
      submitLabel: 'Confirmar Reprovação',
      cancelLabel: 'Cancelar',
      onSubmit: valores => {
        const motivo = (valores.motivo || '').trim();
        if (!motivo) {
          UI.toast('Informe o motivo da reprovação.', 'error');
          return false;
        }

        // Atualizando o status
        cot.status = 'Reprovada';
        // Devolve a solicitação de compra para o status "Em cotação" para nova rodada
        if (sc) sc.status = 'Em cotação';

        // Registrando no histórico
        cot.historico = cot.historico || [];
        cot.historico.push({
          data: U.today(),
          usuario: usuarioAtual.nome,
          acao: 'Reprovada',
          obs: `Reprovada por ${usuarioAtual.nome}: ${motivo}`
        });

        Store.commit(`Cotação ${cot.id} reprovada e devolvida para compras.`, 'warning');
      }
    });
  },

  // Gera o Pedido de Compra (PC) a partir de uma cotação aprovada
  gerarPedido(cotId) {
    // Buscando cotação, análise e solicitação
    const cot = Store.cot(cotId);
    if (!cot) return;
    const sc = Store.sc(cot.scId);
    if (!sc) return;

    // Verificando se já existe pedido emitido para esta cotação
    let pedidoExistente = Store.pedidoByCot(cotId);
    if (pedidoExistente) {
      UI.toast(`Pedido ${pedidoExistente.id} já foi emitido para esta cotação.`, 'info');
      if (App.page('pedidos')) App.go('pedidos', { id: pedidoExistente.id });
      return;
    }

    // Calculando dados da oferta escolhida
    const analise = Rules.cotacao(cot);
    const ofertaEscolhida = cot.ofertas[analise.escolhidaIdx];
    const fornecedor = Store.fornecedor(ofertaEscolhida?.fornecedorId);

    // Gerando ID sequencial do Pedido de Compra
    const proximoPcId = Store.nextId('PC-', Store.db.pedidos);
    const valorUnit = Number(ofertaEscolhida?.valor) || 0;
    const valorProdutos = valorUnit * Number(sc.qtd || 1);
    const frete = Number(ofertaEscolhida?.frete) || 0;

    // Montando a estrutura do Pedido de Compra conforme contrato
    const novoPedido = {
      id: proximoPcId,
      scId: sc.id,
      cotId: cot.id,
      data: U.today(),
      compradora: cot.compradora || Store.user().nome,
      fornecedorId: ofertaEscolhida?.fornecedorId || 'G01',
      cliente: sc.cliente,
      centroCusto: sc.centroCusto,
      descricao: sc.descricao,
      qtd: sc.qtd,
      unid: sc.unid,
      valorUnit: valorUnit,
      valorProdutos: valorProdutos,
      frete: frete,
      status: 'Pedido emitido',
      previsao: U.addDays(U.today(), Number(ofertaEscolhida?.prazo) || 4),
      pagamento: ofertaEscolhida?.pagamento || 'Boleto 28 dias',
      localEntrega: sc.localEntrega,
      responsavelRecebimento: sc.solicitante,
      transportadora: 'Transporte Próprio do Fornecedor',
      obs: `Gerado a partir da Cotação ${cot.id}. Vencedor: ${fornecedor?.fantasia || 'Fornecedor'}`,
      recebimentos: []
    };

    // Atualizando o status da SC para "Comprada"
    sc.status = 'Comprada';

    // Adicionando o pedido ao Store
    Store.db.pedidos.unshift(novoPedido);

    // Registrando no histórico da cotação
    cot.historico = cot.historico || [];
    cot.historico.push({
      data: U.today(),
      usuario: Store.user().nome,
      acao: 'Pedido emitido',
      obs: `Emitido Pedido de Compra ${proximoPcId} no valor de ${U.brl(valorProdutos + frete)}`
    });

    // Persistindo
    Store.commit(`Pedido de Compra ${proximoPcId} emitido com sucesso!`, 'success');

    // Se o módulo de pedidos estiver registrado, navega para ele
    if (App.page('pedidos')) {
      App.go('pedidos', { id: proximoPcId });
    }
  }
};

// Expondo Compras globalmente para eventos inline HTML
window.Compras = Compras;


/* =====================================================================
   REGISTRO DA PÁGINA 1: SOLICITAÇÕES DE COMPRA (SC)
   ===================================================================== */
App.register({
  id: 'solicitacoes',
  label: 'Solicitações',
  icon: 'filePlus',
  section: 'Compras',
  order: 1,

  // Badge no menu lateral com total de solicitações pendentes de ação
  badge: () => {
    const abertas = (Store.db.solicitacoes || []).filter(s => ['Aberta', 'Em cotação'].includes(s.status)).length;
    return abertas > 0 ? abertas : null;
  },

  // Renderização principal da página de Solicitações
  render: (el, params) => {
    const solicitacoes = Store.db.solicitacoes || [];
    const f = Compras._scFiltros;

    // Contadores para as abas
    const contAbertas = solicitacoes.filter(s => s.status === 'Aberta').length;
    const contEmCotacao = solicitacoes.filter(s => s.status === 'Em cotação').length;
    const contAguardando = solicitacoes.filter(s => s.status === 'Aguardando aprovação').length;
    const contAprovadas = solicitacoes.filter(s => ['Aprovada', 'Comprada'].includes(s.status)).length;
    const contCanceladas = solicitacoes.filter(s => s.status === 'Cancelada').length;

    // Definição das abas superiores
    const abas = [
      { id: 'todas', label: 'Todas', count: solicitacoes.length },
      { id: 'abertas', label: 'Abertas', count: contAbertas },
      { id: 'em_cotacao', label: 'Em cotação', count: contEmCotacao },
      { id: 'aguardando_aprovacao', label: 'Aguardando aprovação', count: contAguardando },
      { id: 'aprovadas_compradas', label: 'Aprovadas / Compradas', count: contAprovadas },
      { id: 'canceladas', label: 'Canceladas', count: contCanceladas },
    ];

    // Lista única de clientes para o seletor de filtro
    const clientesUnicos = [...new Set(solicitacoes.map(s => s.cliente).filter(Boolean))].sort();

    // Montando a interface da página
    el.innerHTML = `
      ${UI.pageHead({
        eyebrow: 'Módulo de Compras',
        title: 'Solicitações de Compra (SC)',
        sub: 'Abertura, triagem e controle de requisições de compras para contratos e obras de facilities.',
        actions: UI.btn('Nova Solicitação', {
          icon: 'plus',
          variant: 'primary',
          onclick: 'Compras.modalNovaSC()'
        })
      })}

      <!-- Abas de navegação por status -->
      ${UI.tabs(abas, f.aba, 'Compras.setTabSC')}

      <!-- Card principal contendo barra de filtros e tabela -->
      <div class="card flush">
        <!-- Toolbar com busca e filtros combinados -->
        <div class="toolbar">
          <div class="search">
            ${Icon('search')}
            <input type="text"
                   id="sc_input_busca"
                   placeholder="Buscar por ID, solicitante, cliente, material..."
                   value="${U.esc(f.busca)}"
                   oninput="Compras.filtrarSC('busca', this.value)">
          </div>

          <select onchange="Compras.filtrarSC('prioridade', this.value)" aria-label="Filtrar por prioridade">
            <option value="">Todas as prioridades</option>
            ${Rules.PRIORIDADES.map(p => `<option value="${p}" ${f.prioridade === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>

          <select onchange="Compras.filtrarSC('cliente', this.value)" aria-label="Filtrar por cliente">
            <option value="">Todos os clientes / obras</option>
            ${clientesUnicos.map(c => `<option value="${U.esc(c)}" ${f.cliente === c ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}
          </select>

          <select onchange="Compras.filtrarSC('categoria', this.value)" aria-label="Filtrar por categoria">
            <option value="">Todas as categorias</option>
            ${Rules.CATEGORIAS.map(cat => `<option value="${cat}" ${f.categoria === cat ? 'selected' : ''}>${cat}</option>`).join('')}
          </select>
        </div>

        <!-- Container onde a tabela é injetada -->
        <div id="sc-table-wrap"></div>
      </div>
    `;

    // Renderizando a tabela pela primeira vez
    Compras.renderTabelaSC();
  }
});


/* =====================================================================
   REGISTRO DA PÁGINA 2: MAPA DE COTAÇÃO COMPARATIVO
   ===================================================================== */
App.register({
  id: 'cotacoes',
  label: 'Mapa de Cotação',
  icon: 'scale',
  section: 'Compras',
  order: 2,

  // Badge com cotações em andamento
  badge: () => {
    const emCotacao = (Store.db.cotacoes || []).filter(c => c.status === 'Em cotação').length;
    return emCotacao > 0 ? emCotacao : null;
  },

  // Renderização principal: Alterna entre Lista e Mapa Comparativo Detalhado
  render: (el, params) => {
    const cotId = params?.id;

    // Se um ID foi passado por parâmetro, abre a visão detalhada do Mapa
    if (cotId) {
      Compras.renderMapaDetalhado(el, cotId);
    } else {
      Compras.renderListaCotacoes(el);
    }
  }
});

// Extensão do objeto Compras com renderizações da tela de Cotações
Compras.renderListaCotacoes = function(el) {
  const todasCot = Store.db.cotacoes || [];
  const f = this._cotFiltros;

  // KPIs superiores do Mapa de Cotação
  const totalCot = todasCot.length;
  const emAndamento = todasCot.filter(c => c.status === 'Em cotação').length;
  const aguardandoAprovacao = todasCot.filter(c => c.status === 'Aguardando aprovação').length;

  // Cálculo da economia total acumulada nas cotações finalizadas
  const economiaTotal = U.sum(todasCot.filter(c => ['Aprovada', 'Aguardando aprovação'].includes(c.status)), c => {
    const an = Rules.cotacao(c);
    return an.economia || 0;
  });

  // Filtragem da listagem
  const listaFiltrada = todasCot.filter(c => {
    if (f.aba === 'em_cotacao' && c.status !== 'Em cotação') return false;
    if (f.aba === 'aguardando' && c.status !== 'Aguardando aprovação') return false;
    if (f.aba === 'aprovadas' && c.status !== 'Aprovada') return false;
    if (f.aba === 'reprovadas' && c.status !== 'Reprovada') return false;

    if (f.busca) {
      const sc = Store.sc(c.scId);
      if (!U.match(f.busca, c.id, c.scId, c.compradora, sc?.cliente, sc?.descricao)) {
        return false;
      }
    }
    return true;
  });

  // Abas de status
  const abas = [
    { id: 'todas', label: 'Todas as Cotações', count: totalCot },
    { id: 'em_cotacao', label: 'Em cotação', count: emAndamento },
    { id: 'aguardando', label: 'Aguardando aprovação', count: aguardandoAprovacao },
    { id: 'aprovadas', label: 'Aprovadas', count: todasCot.filter(c => c.status === 'Aprovada').length },
    { id: 'reprovadas', label: 'Reprovadas', count: todasCot.filter(c => c.status === 'Reprovada').length },
  ];

  // Definição das colunas da tabela de cotações
  const colunas = [
    {
      label: 'Cotação / Data',
      render: c => `<span class="mono strong">${U.esc(c.id)}</span><div class="cell-sub">${U.date(c.data)}</div>`,
      width: '110px'
    },
    {
      label: 'SC Vinculada / Obra',
      render: c => {
        const sc = Store.sc(c.scId);
        return `<div class="cell-main"><span class="mono">${U.esc(c.scId)}</span> · ${U.esc(sc?.cliente || '—')}</div><div class="cell-sub">${U.esc(sc?.centroCusto || '')}</div>`;
      }
    },
    {
      label: 'Material / Qtd',
      render: c => {
        const sc = Store.sc(c.scId);
        return `<div class="cell-main">${U.esc(sc?.descricao || '—')}</div><div class="cell-sub">Qtd: <strong>${U.num(sc?.qtd)} ${U.esc(sc?.unid)}</strong></div>`;
      }
    },
    {
      label: 'Status',
      align: 'center',
      render: c => UI.badge(c.status),
      width: '140px'
    },
    {
      label: 'Propostas',
      align: 'center',
      render: c => {
        const an = Rules.cotacao(c);
        return `<span class="badge ${an.validas >= 3 ? 'badge-success' : 'badge-warning'}">${an.validas} de 3 cotados</span>`;
      },
      width: '120px'
    },
    {
      label: 'Menor Cotação',
      align: 'right',
      render: c => {
        const an = Rules.cotacao(c);
        return an.menor ? `<span class="strong">${U.brl(an.menor)}</span>` : '<span class="muted">—</span>';
      },
      width: '125px'
    },
    {
      label: 'Oferta Escolhida',
      align: 'right',
      render: c => {
        const an = Rules.cotacao(c);
        const fornNome = c.ofertas && c.ofertas[an.escolhidaIdx] ? Store.fornecedorNome(c.ofertas[an.escolhidaIdx].fornecedorId) : '—';
        return `<div><strong class="c-orange">${U.brl(an.escolhido)}</strong></div><div class="cell-sub">${U.esc(fornNome)}</div>`;
      },
      width: '140px'
    },
    {
      label: 'Economia',
      align: 'right',
      render: c => {
        const an = Rules.cotacao(c);
        if (!an.economia) return '<span class="muted">—</span>';
        return `<div><strong class="c-success">${U.brl(an.economia)}</strong></div><div class="cell-sub c-success">${U.pct(an.economiaPct)}</div>`;
      },
      width: '110px'
    },
    {
      label: 'Ação',
      align: 'right',
      render: c => UI.btn('Abrir Mapa', {
        icon: 'scale',
        size: 'xs',
        variant: 'primary',
        onclick: `App.go('cotacoes', { id: '${c.id}' })`
      }),
      width: '115px'
    }
  ];

  // Renderizando o HTML da visão de listagem
  el.innerHTML = `
    ${UI.pageHead({
      eyebrow: 'Módulo de Compras',
      title: 'Mapa de Cotações Comparativo',
      sub: 'Equalização de propostas de fornecedores, seleção da proposta mais vantajosa e encaminhamento para aprovação por alçada.',
      actions: UI.btn('Ver Solicitações', {
        icon: 'filePlus',
        variant: 'dark',
        onclick: "App.go('solicitacoes')"
      })
    })}

    <!-- KPIs de Eficiência do Módulo de Compras -->
    <div class="kpis">
      ${UI.kpi({ label: 'Cotações em Andamento', value: emAndamento, note: 'Aguardando fornecedores', icon: 'scale', tone: 'dark' })}
      ${UI.kpi({ label: 'Aguardando Aprovação', value: aguardandoAprovacao, note: 'Pendentes na alçada', icon: 'clock', tone: 'light' })}
      ${UI.kpi({ label: 'Economia Negociada', value: U.brlShort(economiaTotal), note: 'Total economizado vs maior cotação', icon: 'trendUp', tone: 'dark' })}
      ${UI.kpi({ label: 'Cotações Totais', value: totalCot, note: 'Registradas no ERP', icon: 'box', tone: 'light' })}
    </div>

    <!-- Abas de navegação -->
    ${UI.tabs(abas, f.aba, 'Compras.setTabCot')}

    <!-- Tabela de Cotações com toolbar de busca -->
    <div class="card flush">
      <div class="toolbar">
        <div class="search">
          ${Icon('search')}
          <input type="text"
                 placeholder="Buscar por ID da cotação, SC, obra, material..."
                 value="${U.esc(f.busca)}"
                 oninput="Compras.filtrarCot('busca', this.value)">
        </div>
      </div>
      ${UI.table({
        columns: colunas,
        rows: listaFiltrada,
        empty: 'Nenhuma cotação encontrada no momento.',
        rowKey: 'id'
      })}
    </div>
  `;
};

// Renderização detalhada do Mapa de Cotação Comparativo (3 Fornecedores)
Compras.renderMapaDetalhado = function(el, cotId) {
  const cot = Store.cot(cotId);
  if (!cot) {
    el.innerHTML = UI.notice('Cotação não encontrada no sistema.', { icon: 'alert' });
    return;
  }

  const sc = Store.sc(cot.scId);

  // Garantindo que a cotação possua 3 slots de ofertas
  cot.ofertas = cot.ofertas || [];
  while (cot.ofertas.length < 3) {
    cot.ofertas.push({ fornecedorId: '', valor: 0, frete: 0, prazo: 0, pagamento: 'Boleto 28 dias' });
  }

  // Executando cálculo das regras puras de cotação
  const analise = Rules.cotacao(cot);

  // Se nenhuma oferta estiver selecionada, assume a menor válida
  if (cot.escolhida == null || cot.escolhida < 0) {
    cot.escolhida = analise.menorIdx >= 0 ? analise.menorIdx : 0;
  }

  // Alçada exigida calculada com base no valor total da oferta escolhida
  const totalEscolhido = analise.escolhido;
  const alcadaExigida = Rules.alcada(totalEscolhido);

  // Fornecedores ativos disponíveis para cotação
  const fornecedoresAtivos = (Store.db.fornecedores || []).filter(f => f.status === 'Ativo');

  // Modo somente leitura se a cotação já estiver Aprovada
  const isConcluida = ['Aprovada'].includes(cot.status);

  // Montando as 3 colunas de ofertas comparativas
  const colunasOfertasHtml = [0, 1, 2].map(idx => {
    const oferta = cot.ofertas[idx] || { fornecedorId: '', valor: 0, frete: 0, prazo: 0, pagamento: 'Boleto 28 dias' };
    const valorUnit = Number(oferta.valor) || 0;
    const frete = Number(oferta.frete) || 0;
    const qtd = Number(sc?.qtd) || 0;
    const totalOferta = valorUnit > 0 ? (valorUnit * qtd + frete) : 0;
    const isMenor = analise.menorIdx === idx && analise.validas > 0;
    const isEscolhida = Number(cot.escolhida) === idx;

    return `
      <div class="card ${isEscolhida ? 'accent' : ''}" style="display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div class="row between" style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)">
            <span class="label-caps">Proposta 0${idx + 1}</span>
            <div class="row" style="gap:6px">
              ${isMenor ? '<span class="badge badge-success no-dot">⭐ Menor Preço</span>' : ''}
              ${isEscolhida ? '<span class="badge badge-orange no-dot">Vencedora</span>' : ''}
            </div>
          </div>

          <!-- Seletor de Fornecedor -->
          <div class="field" style="margin-bottom:12px">
            <label>Fornecedor Homologado <span class="req">*</span></label>
            <select class="input"
                    ${isConcluida ? 'disabled' : ''}
                    onchange="Compras.atualizarOferta('${cot.id}', ${idx}, 'fornecedorId', this.value)">
              <option value="">Selecione o fornecedor...</option>
              ${fornecedoresAtivos.map(f => `
                <option value="${f.id}" ${oferta.fornecedorId === f.id ? 'selected' : ''}>
                  ${U.esc(f.fantasia || f.razao)} (${f.cidade})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Grade de valores e prazos -->
          <div class="form-grid" style="gap:10px">
            <div class="field">
              <label>Valor Unitário (R$)</label>
              <input type="number"
                     step="0.01"
                     min="0"
                     class="input"
                     value="${oferta.valor || ''}"
                     placeholder="0,00"
                     ${isConcluida ? 'readonly' : ''}
                     onchange="Compras.atualizarOferta('${cot.id}', ${idx}, 'valor', this.value)">
            </div>

            <div class="field">
              <label>Frete (R$)</label>
              <input type="number"
                     step="0.01"
                     min="0"
                     class="input"
                     value="${oferta.frete || ''}"
                     placeholder="0,00"
                     ${isConcluida ? 'readonly' : ''}
                     onchange="Compras.atualizarOferta('${cot.id}', ${idx}, 'frete', this.value)">
            </div>

            <div class="field">
              <label>Prazo de Entrega (dias)</label>
              <input type="number"
                     min="0"
                     class="input"
                     value="${oferta.prazo || ''}"
                     placeholder="Ex: 3"
                     ${isConcluida ? 'readonly' : ''}
                     onchange="Compras.atualizarOferta('${cot.id}', ${idx}, 'prazo', this.value)">
            </div>

            <div class="field">
              <label>Condição Pagamento</label>
              <select class="input"
                      ${isConcluida ? 'disabled' : ''}
                      onchange="Compras.atualizarOferta('${cot.id}', ${idx}, 'pagamento', this.value)">
                ${Rules.PAGAMENTOS.map(pag => `<option value="${pag}" ${oferta.pagamento === pag ? 'selected' : ''}>${pag}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Total calculado da Oferta -->
          <div style="margin-top:14px;padding:12px;background:var(--chip);border-radius:var(--r-md)">
            <div class="row between small muted">
              <span>Produtos (${qtd} × ${U.brl(valorUnit)}):</span>
              <span>${U.brl(valorUnit * qtd)}</span>
            </div>
            <div class="row between small muted" style="margin-top:2px">
              <span>Frete:</span>
              <span>${U.brl(frete)}</span>
            </div>
            <div class="row between strong" style="font-size:15px;margin-top:8px;padding-top:6px;border-top:1px dashed var(--border)">
              <span>Total da Oferta:</span>
              <span class="${isMenor ? 'c-success' : 'c-orange'}">${U.brl(totalOferta)}</span>
            </div>
          </div>
        </div>

        <!-- Seletor de proposta vencedora -->
        <div style="margin-top:16px">
          <label class="row" style="cursor:pointer;padding:10px 14px;border:1.5px solid ${isEscolhida ? 'var(--orange)' : 'var(--border)'};border-radius:var(--r-md);background:${isEscolhida ? 'var(--orange-tint)' : '#fff'};justify-content:center;font-weight:600">
            <input type="radio"
                   name="cot_radio_escolha"
                   value="${idx}"
                   ${isEscolhida ? 'checked' : ''}
                   ${isConcluida ? 'disabled' : ''}
                   onchange="Compras.selecionarOferta('${cot.id}', ${idx})">
            <span>${isEscolhida ? '✓ Oferta Selecionada' : 'Selecionar como Vencedora'}</span>
          </label>
        </div>
      </div>
    `;
  }).join('');

  // Renderizando o mapa completo
  el.innerHTML = `
    <!-- Topo da tela com navegação de retorno -->
    <div style="margin-bottom:16px">
      <button type="button" class="btn btn-ghost btn-sm" onclick="Compras.voltarListaCotacoes()">
        ${Icon('arrowRight', 'style="transform:rotate(180deg)"')} Voltar para Lista de Cotações
      </button>
    </div>

    ${UI.pageHead({
      eyebrow: `Cotação ${cot.id} · Vinculada à SC ${sc?.id || '—'}`,
      title: `Mapa Comparativo: ${sc?.descricao || 'Material'}`,
      sub: `Compradora responsável: ${cot.compradora || 'Juliana Silva'} · Data de abertura: ${U.date(cot.data)}`,
      actions: `
        ${UI.badge(cot.status)}
        ${cot.status === 'Aguardando aprovação' ? UI.btn('Ver Aprovações', { icon: 'checkCircle', variant: 'primary', onclick: "App.go('aprovacoes')" }) : ''}
        ${cot.status === 'Aprovada' ? UI.btn('Emitir Pedido PC', { icon: 'cart', variant: 'success', onclick: `Compras.gerarPedido('${cot.id}')` }) : ''}
      `
    })}

    <!-- Card de Resumo da Solicitação Vinculada -->
    <div class="card" style="margin-bottom:20px;background:#FBFCFE">
      <div class="row between wrap" style="gap:16px">
        <div>
          <span class="eyebrow">${sc?.categoria || 'Insumo'} · ${sc?.prioridade || 'Normal'}</span>
          <h3 style="margin-top:2px;font-size:17px">${U.esc(sc?.descricao || '—')}</h3>
          <p class="muted small" style="margin:4px 0 0">${U.esc(sc?.especificacao || 'Sem especificação adicional')}</p>
        </div>
        <div class="row wrap" style="gap:24px">
          <div>
            <div class="label-caps muted">Cliente / Obra</div>
            <div class="strong">${U.esc(sc?.cliente || '—')}</div>
            <div class="small muted">${U.esc(sc?.centroCusto || '')}</div>
          </div>
          <div>
            <div class="label-caps muted">Quantidade</div>
            <div class="strong" style="font-size:16px;color:var(--orange)">${U.num(sc?.qtd)} ${U.esc(sc?.unid)}</div>
          </div>
          <div>
            <div class="label-caps muted">Data Necessidade</div>
            <div class="strong">${U.date(sc?.dataNecessidade)}</div>
          </div>
          <div>
            <div class="label-caps muted">Local de Entrega</div>
            <div class="small">${U.esc(sc?.localEntrega || 'Almoxarifado Central')}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Matriz de 3 Colunas de Propostas -->
    <div class="grid grid-3" style="margin-bottom:20px">
      ${colunasOfertasHtml}
    </div>

    <!-- Painel Comparativo de Negociação e Economia Obtida -->
    <div class="card accent" style="margin-bottom:20px">
      <div class="card-head">
        <div>
          <h2>Painel Comparativo de Negociação & Alçada Exigida</h2>
          <div class="hint">Equalização financeira conforme política de compras da GHC Facilities</div>
        </div>
        <div class="row" style="gap:8px">
          <span class="badge ${analise.validas >= 3 ? 'badge-success' : 'badge-warning'}">
            ${analise.validas} de 3 Cotações Válidas
          </span>
          <span class="badge badge-info">
            Alçada: ${alcadaExigida.nome} (Nível ${alcadaExigida.nivel})
          </span>
        </div>
      </div>

      <!-- Métricas comparativas -->
      <div class="kpis" style="margin-bottom:16px">
        ${UI.kpi({ label: 'Menor Oferta Válida', value: U.brl(analise.menor), note: 'Menor custo identificado', icon: 'scale', tone: 'light' })}
        ${UI.kpi({ label: 'Proposta Escolhida', value: U.brl(analise.escolhido), note: 'Valor total a faturar', icon: 'cart', tone: 'dark' })}
        ${UI.kpi({ label: 'Economia Negociada', value: U.brl(analise.economia), note: `${U.pct(analise.economiaPct)} vs maior proposta`, icon: 'trendUp', tone: 'light' })}
        ${UI.kpi({ label: 'Média de Mercado', value: U.brl(analise.media), note: 'Média das propostas válidas', icon: 'chart', tone: 'light' })}
      </div>

      <!-- Alerta e Campo de Justificativa Obrigatória -->
      ${analise.precisaJustificativa ? `
        <div class="notice" style="border-color:var(--warning);background:var(--warning-tint);color:#92400E;margin-bottom:16px">
          <div>${Icon('alert')}</div>
          <div>
            <strong>Justificativa Técnica / Comercial Obrigatória para Aprovação:</strong><br>
            ${analise.validas < 3 ? '• Há menos de 3 fornecedores válidos cotados nesta rodada.<br>' : ''}
            ${analise.escolhidaIdx !== analise.menorIdx ? `• A oferta escolhida (${U.brl(analise.escolhido)}) é superior à menor cotação (${U.brl(analise.menor)}).<br>` : ''}
            Conforme a governança de compras da GHC, justifique a escolha abaixo para liberar o envio à alçada.
          </div>
        </div>
      ` : ''}

      <div class="field full">
        <label for="f_cot_justificativa">
          Justificativa da Escolha da Proposta
          ${analise.precisaJustificativa ? '<span class="req">* (Obrigatória)</span>' : '<span class="muted">(Opcional)</span>'}
        </label>
        <textarea id="f_cot_justificativa"
                  class="field textarea"
                  rows="3"
                  ${isConcluida ? 'readonly' : ''}
                  placeholder="Ex: Fornecedor homologado com menor prazo de entrega garantido, pronta entrega de peças originais, ou frete incluso com melhor condição de pagamento..."
                  onchange="Compras.atualizarJustificativa('${cot.id}', this.value)">${U.esc(cot.justificativa || '')}</textarea>
      </div>

      <!-- Rodapé de Ações do Mapa -->
      <div class="row between wrap" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <div class="small muted">
          Alçada requerida: <strong>${alcadaExigida.nome} (Nível ${alcadaExigida.nivel})</strong> — Limite de até ${alcadaExigida.limite === Infinity ? 'qualquer valor' : U.brl(alcadaExigida.limite)}
        </div>
        <div class="actions">
          ${!isConcluida && cot.status !== 'Aguardando aprovação' ? `
            <button type="button" class="btn btn-ghost" onclick="Compras.salvarRascunhoCotacao('${cot.id}')">
              Salvar Rascunho
            </button>
            <button type="button" class="btn btn-primary" onclick="Compras.enviarParaAprovacao('${cot.id}')">
              ${Icon('checkCircle')} Enviar para Aprovação por Alçada
            </button>
          ` : ''}
          ${cot.status === 'Aguardando aprovação' ? `
            <button type="button" class="btn btn-dark" onclick="App.go('aprovacoes')">
              ${Icon('clock')} Ir para Central de Aprovação (${alcadaExigida.nome})
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- Timeline do Histórico de Auditoria da Cotação -->
    <div class="card">
      <div class="card-head">
        <h2>Histórico de Auditoria & Tramitação</h2>
      </div>
      <ul class="timeline">
        ${(cot.historico || []).map(h => `
          <li>
            <div class="row between">
              <strong>${U.esc(h.acao)} · ${U.esc(h.usuario)}</strong>
              <span class="when">${U.date(h.data)}</span>
            </div>
            <div class="small muted" style="margin-top:2px">${U.esc(h.obs)}</div>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
};


/* =====================================================================
   REGISTRO DA PÁGINA 3: CENTRAL DE APROVAÇÃO POR ALÇADA
   ===================================================================== */
App.register({
  id: 'aprovacoes',
  label: 'Aprovações',
  icon: 'checkCircle',
  section: 'Compras',
  order: 3,

  // Badge no menu lateral com total de compras pendentes de aprovação
  badge: () => {
    const pendentes = (Store.db.cotacoes || []).filter(c => c.status === 'Aguardando aprovação').length;
    return pendentes > 0 ? pendentes : null;
  },

  // Renderização principal da Central de Aprovação
  render: (el, params) => {
    const usuarioAtual = Store.user();
    const pendentes = (Store.db.cotacoes || []).filter(c => c.status === 'Aguardando aprovação');
    const concluidas = (Store.db.cotacoes || []).filter(c => ['Aprovada', 'Reprovada'].includes(c.status));

    // Determina descrição amigável do nível do usuário logado
    const descNivel = usuarioAtual.nivel === 0
      ? 'Compras (Sem alçada aprovadora de compras)'
      : usuarioAtual.nivel === 1
        ? 'Supervisão Operacional (Alçada até R$ 2.000,00)'
        : usuarioAtual.nivel === 2
          ? 'Gerência de Facilities (Alçada até R$ 10.000,00)'
          : 'Diretoria de Operações (Alçada Ilimitada)';

    // Renderização dos cards de compras aguardando aprovação
    const cardsPendentesHtml = pendentes.length ? pendentes.map(cot => {
      const sc = Store.sc(cot.scId);
      const analise = Rules.cotacao(cot);
      const ofertaEscolhida = cot.ofertas[analise.escolhidaIdx];
      const fornecedor = Store.fornecedor(ofertaEscolhida?.fornecedorId);
      const totalCompra = analise.escolhido;
      const alcadaReq = Rules.alcada(totalCompra);
      const podeAprovar = Rules.podeAprovar(usuarioAtual, cot);

      return `
        <div class="card accent" style="margin-bottom:18px">
          <!-- Cabeçalho do Card da Compra -->
          <div class="row between wrap" style="gap:12px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">
            <div>
              <div class="eyebrow">Cotação ${cot.id} · Requisição ${sc?.id || '—'} · Data: ${U.date(cot.data)}</div>
              <h3 style="font-size:18px;margin-top:2px">${U.esc(sc?.descricao || 'Material')}</h3>
            </div>
            <div class="row" style="gap:8px">
              <span class="badge ${alcadaReq.nivel === 1 ? 'badge-info' : alcadaReq.nivel === 2 ? 'badge-warning' : 'badge-error'} no-dot">
                Requer Nível ${alcadaReq.nivel} · ${alcadaReq.nome}
              </span>
              ${UI.badge(cot.status)}
            </div>
          </div>

          <!-- Grade de Informações da Compra -->
          <div class="grid grid-main" style="gap:20px;margin-bottom:16px">
            <!-- Dados da Solicitação e do Fornecedor Escolhido -->
            <div class="dl">
              <dt>Cliente / Contrato:</dt>
              <dd><strong>${U.esc(sc?.cliente || '—')}</strong> (${U.esc(sc?.centroCusto || '')})</dd>

              <dt>Solicitante:</dt>
              <dd>${U.esc(sc?.solicitante || '—')} · ${U.esc(sc?.area || '')}</dd>

              <dt>Quantidade:</dt>
              <dd><span class="strong">${U.num(sc?.qtd)} ${U.esc(sc?.unid)}</span></dd>

              <dt>Fornecedor Vencedor:</dt>
              <dd>
                <strong class="c-orange">${U.esc(fornecedor?.fantasia || fornecedor?.razao || 'Fornecedor')}</strong>
                <span class="small muted"> (${ofertaEscolhida?.prazo || 0} dias · ${ofertaEscolhida?.pagamento || 'Boleto'})</span>
              </dd>

              <dt>Justificativa:</dt>
              <dd style="font-style:italic">"${U.esc(cot.justificativa || 'Menor preço e melhor condição de atendimento.')}"</dd>
            </div>

            <!-- Painel de Valores e Economia Obtida -->
            <div style="background:var(--chip);padding:16px;border-radius:var(--r-md);display:flex;flex-direction:column;justify-content:center">
              <span class="label-caps muted">Valor Total da Compra</span>
              <div style="font-size:28px;font-weight:800;color:var(--text);margin:6px 0">${U.brl(totalCompra)}</div>
              
              <div class="small" style="margin-top:4px">
                Economia obtida: <strong class="c-success">${U.brl(analise.economia)} (${U.pct(analise.economiaPct)})</strong>
              </div>
              <div class="small muted" style="margin-top:2px">
                Menor oferta da rodada: ${U.brl(analise.menor)}
              </div>
              ${analise.diffMenor > 0 ? `
                <div class="badge badge-warning" style="margin-top:8px">
                  + ${U.brl(analise.diffMenor)} vs menor cotação
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Ações de Deliberação ou Bloqueio por Alçada -->
          <div style="padding-top:14px;border-top:1px solid var(--border)">
            ${podeAprovar ? `
              <div class="row between wrap" style="gap:12px">
                <div class="row" style="gap:8px">
                  <span class="badge badge-success no-dot">✓ Você possui alçada suficiente para aprovar este valor</span>
                </div>
                <div class="actions">
                  <button type="button" class="btn btn-ghost" onclick="App.go('cotacoes', { id: '${cot.id}' })">
                    ${Icon('eye')} Ver Mapa Completo
                  </button>
                  <button type="button" class="btn btn-danger" onclick="Compras.reprovarCompra('${cot.id}')">
                    ${Icon('x')} Reprovar
                  </button>
                  <button type="button" class="btn btn-success" onclick="Compras.aprovarCompra('${cot.id}')">
                    ${Icon('check')} Aprovar Compra
                  </button>
                </div>
              </div>
            ` : `
              <div class="notice" style="border-color:var(--error);background:var(--error-tint);color:#991B1B;margin:0">
                <div>${Icon('alert')}</div>
                <div style="flex:1">
                  <strong>Alçada Insuficiente para Aprovação:</strong><br>
                  Esta compra de <strong>${U.brl(totalCompra)}</strong> requer alçada de <strong>${alcadaReq.nome} (Nível ${alcadaReq.nivel})</strong>.
                  Seu usuário atual <strong>${usuarioAtual.nome}</strong> possui nível <strong>${usuarioAtual.nivel} (${usuarioAtual.perfil})</strong>.<br>
                  <span class="small" style="display:inline-block;margin-top:4px;color:#7F1D1D">
                    💡 <strong>Recurso Interativo da Demonstração:</strong> No topo da tela (ao lado da logo), alterne o usuário para 
                    <strong>${alcadaReq.nivel === 2 ? 'Roberto Santos (Gerente)' : 'Diretoria GHC (Diretor)'}</strong> para aprovar esta compra imediatamente.
                  </span>
                </div>
                <div class="actions" style="opacity:0.4;pointer-events:none">
                  <button type="button" class="btn btn-ghost" disabled>Reprovar</button>
                  <button type="button" class="btn btn-dark" disabled>Aprovar Compra</button>
                </div>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('') : `
      <div class="card" style="text-align:center;padding:40px 20px">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--success-tint);color:var(--success);display:grid;place-items:center;margin:0 auto 12px">
          ${Icon('checkCircle')}
        </div>
        <h3 style="font-size:16px;margin:0 0 6px">Todas as cotações foram deliberadas!</h3>
        <p class="muted small" style="margin:0 0 16px">Não há compras pendentes de aprovação por alçada no momento.</p>
        <button type="button" class="btn btn-outline-orange btn-sm" onclick="App.go('cotacoes')">
          ${Icon('scale')} Ir para Mapa de Cotações
        </button>
      </div>
    `;

    // Tabela de cotações já deliberadas (histórico de governança)
    const colunasConcluidas = [
      {
        label: 'Cotação / SC',
        render: c => `<span class="mono strong">${U.esc(c.id)}</span><div class="cell-sub">${U.esc(c.scId)}</div>`,
        width: '110px'
      },
      {
        label: 'Material / Obra',
        render: c => {
          const sc = Store.sc(c.scId);
          return `<div class="cell-main">${U.esc(sc?.descricao || '—')}</div><div class="cell-sub">${U.esc(sc?.cliente || '')}</div>`;
        }
      },
      {
        label: 'Fornecedor Vencedor',
        render: c => {
          const an = Rules.cotacao(c);
          return c.ofertas && c.ofertas[an.escolhidaIdx] ? Store.fornecedorNome(c.ofertas[an.escolhidaIdx].fornecedorId) : '—';
        }
      },
      {
        label: 'Valor Total',
        align: 'right',
        render: c => {
          const an = Rules.cotacao(c);
          return `<span class="strong">${U.brl(an.escolhido)}</span>`;
        },
        width: '120px'
      },
      {
        label: 'Status',
        align: 'center',
        render: c => UI.badge(c.status),
        width: '120px'
      },
      {
        label: 'Ações',
        align: 'right',
        render: c => {
          const botoes = [
            UI.btn('Ver Mapa', {
              icon: 'eye',
              size: 'xs',
              variant: 'ghost',
              onclick: `App.go('cotacoes', { id: '${c.id}' })`
            })
          ];
          if (c.status === 'Aprovada') {
            botoes.push(UI.btn('Emitir PC', {
              icon: 'cart',
              size: 'xs',
              variant: 'success',
              onclick: `Compras.gerarPedido('${c.id}')`
            }));
          }
          return `<div class="row" style="justify-content:flex-end;gap:4px">${botoes.join('')}</div>`;
        },
        width: '180px'
      }
    ];

    // Renderizando a página completa de Aprovações
    el.innerHTML = `
      ${UI.pageHead({
        eyebrow: 'Governança & Compliance Financeiro',
        title: 'Central de Aprovação por Alçada',
        sub: 'Controle rigoroso de limites de gastos por alçada de autorização na GHC Facilities.',
        actions: UI.btn('Atualizar', {
          icon: 'refresh',
          variant: 'ghost',
          onclick: "App.rerender()"
        })
      })}

      <!-- Card do Perfil do Usuário Ativo e Instrução para a Demo -->
      <div class="card" style="margin-bottom:20px;background:var(--navy);color:#E2E8F0;border:1px solid var(--slate)">
        <div class="row between wrap" style="gap:16px">
          <div class="row" style="gap:14px">
            <div class="avatar" style="width:44px;height:44px;font-size:16px;background:var(--orange)">
              ${U.initials(usuarioAtual.nome)}
            </div>
            <div>
              <div class="label-caps" style="color:var(--orange)">Usuário Logado no Sistema</div>
              <h2 style="color:#fff;font-size:17px;margin:2px 0">${U.esc(usuarioAtual.nome)} · ${U.esc(usuarioAtual.perfil)}</h2>
              <div class="small" style="color:#94A3B8">${descNivel}</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.06);padding:10px 14px;border-radius:var(--r-md);max-width:440px">
            <span class="small" style="color:#CBD5E1">
              💡 <strong>Dica de Demonstração:</strong> Alterne o perfil de usuário no seletor no topo da tela para simular a visão e autoridade de Supervisores, Gerentes e Diretores.
            </span>
          </div>
        </div>
      </div>

      <!-- Banner Explicativo da Política de Alçadas da GHC -->
      <div class="grid grid-3" style="margin-bottom:24px">
        <div class="card ${usuarioAtual.nivel === 1 ? 'accent' : ''}" style="background:#fff">
          <div class="eyebrow">Alçada 01</div>
          <h3 style="font-size:16px;margin:4px 0 2px">Supervisão Operacional</h3>
          <div style="font-size:22px;font-weight:800;color:var(--orange);margin-bottom:6px">Até R$ 2.000,00</div>
          <p class="small muted" style="margin:0">
            Autorização de materiais de reposição contínua, insumos de limpeza, EPIs e pequenos reparos de manutenção civil.
          </p>
        </div>

        <div class="card ${usuarioAtual.nivel === 2 ? 'accent' : ''}" style="background:#fff">
          <div class="eyebrow">Alçada 02</div>
          <h3 style="font-size:16px;margin:4px 0 2px">Gerência de Facilities</h3>
          <div style="font-size:22px;font-weight:800;color:var(--orange);margin-bottom:6px">Até R$ 10.000,00</div>
          <p class="small muted" style="margin:0">
            Compras de médio vulto, peças estruturais metálicas, materiais elétricos de quadros e compras programadas de contratos.
          </p>
        </div>

        <div class="card ${usuarioAtual.nivel === 3 ? 'accent' : ''}" style="background:#fff">
          <div class="eyebrow">Alçada 03</div>
          <h3 style="font-size:16px;margin:4px 0 2px">Diretoria de Operações</h3>
          <div style="font-size:22px;font-weight:800;color:var(--orange);margin-bottom:6px">Acima de R$ 10.000,00</div>
          <p class="small muted" style="margin:0">
            Capex, grandes obras prediais, contratação de serviços especializados de grande porte e investimentos em ativos.
          </p>
        </div>
      </div>

      <!-- Seção: Compras Pendentes de Aprovação -->
      <div style="margin-bottom:30px">
        <div class="row between" style="margin-bottom:14px">
          <h2>Compras Aguardando Autorização (${pendentes.length})</h2>
        </div>
        ${cardsPendentesHtml}
      </div>

      <!-- Seção: Histórico de Compras Deliberadas -->
      <div class="card flush">
        <div class="card-head">
          <div>
            <h2>Histórico Recente de Compras Deliberadas</h2>
            <div class="hint">Registro permanente de governança e aprovação financeira</div>
          </div>
        </div>
        ${UI.table({
          columns: colunasConcluidas,
          rows: concluidas,
          empty: 'Nenhuma deliberação registrada no histórico recente.',
          rowKey: 'id'
        })}
      </div>
    `;
  }
});
