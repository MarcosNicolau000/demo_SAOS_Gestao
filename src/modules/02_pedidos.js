'use strict';
/* =====================================================================
   GHC GESTÃO — MÓDULO 02: PEDIDOS DE COMPRA E ENTREGAS & NF
   ---------------------------------------------------------------------
   Responsabilidade Arquitetural:
   1. Página 'pedidos' (Section: Compras, Order: 4, Icon: cart):
      - Emissão formal de Pedidos de Compra (PC-xxxx) originados de Cotações Aprovadas.
      - Acompanhamento do ciclo de vida: Emissão -> Em Trânsito -> Recebido / Cancelado.
      - Espelho do Pedido corporativo: Ordem de Compra formal para envio ao fornecedor,
        com layout oficial para impressão / PDF, dados fiscais e regras de faturamento.
      - Gestão de cancelamento de pedidos com rastreabilidade de motivo.

   2. Página 'entregas' (Section: Compras, Order: 5, Icon: truck):
      - Monitoramento de prazos logísticos com cálculo real de atraso (sem linhas fantasmas).
      - Registro de recebimentos parciais e totais com lançamento de Nota Fiscal (NF).
      - Integração automática com estoque: incrementa o saldo atual (Store.db.estoque)
        e gera movimentação auditável de 'Entrada' (Store.db.movimentos).
      - Disparo de avaliação rápida de fornecedor pós-entrega (Store.db.avaliacoes).
   ===================================================================== */

const PedidosModule = {
  /* -------------------------------------------------------------------
     Estado Interno das Telas (Filtros, Abas e Busca)
     ------------------------------------------------------------------- */
  state: {
    pedidos: {
      tab: 'todos',          // 'todos' | 'abertos' | 'parciais' | 'recebidos' | 'cancelados'
      busca: '',
      fornecedorId: '',
      cliente: '',
      status: ''
    },
    entregas: {
      tab: 'todas',          // 'todas' | 'atrasadas' | 'noprazo' | 'recebidas'
      busca: '',
      fornecedorId: '',
      situacao: ''
    }
  },

  /* ===================================================================
     LÓGICA DE DADOS & FILTROS: PEDIDOS DE COMPRA
     =================================================================== */

  // Filtra e retorna a lista de pedidos segundo os critérios ativos
  getPedidosFiltrados() {
    const s = this.state.pedidos;
    return (Store.db.pedidos || []).filter(p => {
      // 1. Filtro por Aba de Status Operacional
      if (s.tab === 'abertos' && (p.status === 'Recebido' || p.status === 'Cancelado')) return false;
      if (s.tab === 'parciais' && p.status !== 'Recebido parcial') return false;
      if (s.tab === 'recebidos' && p.status !== 'Recebido') return false;
      if (s.tab === 'cancelados' && p.status !== 'Cancelado') return false;

      // 2. Filtro por Fornecedor específico
      if (s.fornecedorId && p.fornecedorId !== s.fornecedorId) return false;

      // 3. Filtro por Cliente / Contrato
      if (s.cliente && p.cliente !== s.cliente) return false;

      // 4. Filtro por Status específico
      if (s.status && p.status !== s.status) return false;

      // 5. Busca Textual Ampla (N° Pedido, Fornecedor, Material, Cliente, CC)
      if (s.busca) {
        const fornNome = Store.fornecedorNome(p.fornecedorId);
        const match = U.match(s.busca, p.id, fornNome, p.descricao, p.cliente, p.centroCusto, p.status);
        if (!match) return false;
      }

      return true;
    });
  },

  // Calcula os indicadores chave (KPIs) para a tela de Pedidos
  getKpisPedidos() {
    const list = Store.db.pedidos || [];
    const validos = list.filter(p => p.status !== 'Cancelado');

    const totalPedidos = list.length;
    const totalComprado = U.sum(validos, p => Rules.pedidoTotal(p));
    const emTransito = list.filter(p => p.status === 'Pedido emitido' || p.status === 'Recebido parcial').length;
    const recebidos = list.filter(p => p.status === 'Recebido').length;

    return { totalPedidos, totalComprado, emTransito, recebidos };
  },

  /* ===================================================================
     LÓGICA DE DADOS & FILTROS: ENTREGAS & NOTAS FISCAIS
     =================================================================== */

  // Filtra e retorna as entregas baseando-se nas regras de negócio de prazo
  getEntregasFiltradas() {
    const s = this.state.entregas;
    return (Store.db.pedidos || []).filter(p => {
      // Ignora pedidos cancelados da esteira de entregas
      if (p.status === 'Cancelado') return false;

      const reg = Rules.entrega(p);

      // 1. Filtro por Abas de Prazo
      if (s.tab === 'atrasadas' && !reg.atrasada) return false;
      if (s.tab === 'noprazo' && (reg.atrasada || p.status === 'Recebido')) return false;
      if (s.tab === 'recebidas' && p.status !== 'Recebido') return false;

      // 2. Filtro por Fornecedor
      if (s.fornecedorId && p.fornecedorId !== s.fornecedorId) return false;

      // 3. Filtro por Situação de Prazo
      if (s.situacao && reg.situacao !== s.situacao) return false;

      // 4. Busca Textual (Pedido, Fornecedor, Material, NF, Transportadora)
      if (s.busca) {
        const fornNome = Store.fornecedorNome(p.fornecedorId);
        const nfsStr = (p.recebimentos || []).map(r => r.nf).join(' ');
        const match = U.match(s.busca, p.id, fornNome, p.descricao, p.cliente, p.centroCusto, nfsStr, p.transportadora);
        if (!match) return false;
      }

      return true;
    });
  },

  // Calcula os indicadores chave (KPIs) para a tela de Entregas & NF
  getKpisEntregas() {
    const list = (Store.db.pedidos || []).filter(p => p.status !== 'Cancelado');

    // Entregas no Prazo (em aberto no prazo ou finalizadas no prazo)
    const noPrazo = list.filter(p => !Rules.entrega(p).atrasada).length;

    // Entregas Atrasadas (cálculo real corrigido contra previsão sem linhas fantasmas)
    const atrasadas = list.filter(p => Rules.entrega(p).atrasada).length;

    // Recebimentos Parciais
    const parciais = list.filter(p => p.status === 'Recebido parcial').length;

    // Total de Notas Fiscais Lançadas
    const totalNfs = U.sum(list, p => (p.recebimentos || []).length);
    const totalValorNf = U.sum(list, p => U.sum(p.recebimentos || [], r => r.valorNF || 0));

    return { noPrazo, atrasadas, parciais, totalNfs, totalValorNf };
  },

  /* ===================================================================
     AÇÕES & MODAIS: PEDIDOS DE COMPRA
     =================================================================== */

  /* Abre o modal de emissão de Novo Pedido a partir de uma Cotação Aprovada */
  abrirNovoPedido(preCotId = '') {
    // 1. Busca cotações aprovadas que ainda não geraram pedido
    const cotacoesDisponiveis = (Store.db.cotacoes || []).filter(c => {
      if (c.status !== 'Aprovada') return false;
      const jaTemPedido = Store.db.pedidos.some(p => p.cotId === c.id);
      return !jaTemPedido;
    });

    // Se houver uma cotação pré-selecionada ou a primeira disponível
    const cotIdSelecionada = preCotId || (cotacoesDisponiveis[0]?.id || '');
    const novoId = Store.nextId('PC-', Store.db.pedidos, 'id', 4);

    // Opções para o select de cotações
    let cotOptions = cotacoesDisponiveis.map(c => {
      const sc = Store.sc(c.scId);
      const forn = Store.fornecedorNome(c.ofertas[c.escolhida]?.fornecedorId);
      const total = Rules.cotacao(c).escolhido;
      return {
        value: c.id,
        label: `${c.id} · ${sc ? sc.descricao : 'Item'} (${forn} — ${U.brl(total)})`
      };
    });

    // Se todas as aprovadas já tiverem pedido, oferecemos flexibilidade para aprovar/emitir
    if (!cotOptions.length) {
      cotOptions = [
        { value: '', label: 'Nenhuma cotação aprovada pendente de pedido' },
        ...(Store.db.cotacoes || []).map(c => {
          const sc = Store.sc(c.scId);
          return { value: c.id, label: `${c.id} (${c.status}) · ${sc?.descricao || 'Material'}` };
        })
      ];
    }

    const fornecedoresOpts = (Store.db.fornecedores || []).map(f => ({
      value: f.id,
      label: `${f.fantasia || f.razao} (${f.cnpj})`
    }));

    const pagamentosOpts = Rules.PAGAMENTOS.map(p => ({ value: p, label: p }));
    const unidadesOpts = Rules.UNIDADES.map(u => ({ value: u, label: u }));

    const bodyHtml = `
      <div class="notice info" style="margin-bottom:16px">
        ${Icon('info')}
        <div>
          <b>Governança de Suprimentos GHC:</b> Pedidos de Compra são formalizados a partir de Cotações Aprovadas por alçada. Selecione a cotação aprovada abaixo para carregar automaticamente o fornecedor vencedor, condições e valores negociados.
        </div>
      </div>

      <div class="form-grid cols-2">
        <div class="field full">
          <label for="f_cotId">Cotação Aprovada de Origem <span class="req">*</span></label>
          <select name="cotId" id="f_cotId" onchange="PedidosModule.onSelecionarCotacaoNovoPedido(this.value)">
            <option value="">Selecione uma cotação aprovada...</option>
            ${cotOptions.map(o => `<option value="${U.esc(o.value)}" ${o.value === cotIdSelecionada ? 'selected' : ''}>${U.esc(o.label)}</option>`).join('')}
          </select>
        </div>

        ${UI.field({ name: 'id', label: 'Número do Pedido (PC)', value: novoId, readonly: true })}
        ${UI.field({ name: 'data', label: 'Data de Emissão', type: 'date', value: U.today(), required: true })}

        <div class="form-section">Dados do Fornecedor & Itens Negociados</div>

        <div class="field full">
          <label for="f_fornecedorId">Fornecedor Vencedor <span class="req">*</span></label>
          <select name="fornecedorId" id="f_fornecedorId" required>
            <option value="">Selecione o fornecedor...</option>
            ${fornecedoresOpts.map(o => `<option value="${U.esc(o.value)}">${U.esc(o.label)}</option>`).join('')}
          </select>
        </div>

        ${UI.field({ name: 'descricao', label: 'Descrição do Material / Serviço', full: true, required: true, placeholder: 'Ex: Cabo flexível 2,5mm...' })}
        ${UI.field({ name: 'qtd', label: 'Quantidade', type: 'number', step: 'any', min: '0.01', required: true })}
        
        <div class="field">
          <label for="f_unid">Unidade de Medida <span class="req">*</span></label>
          <select name="unid" id="f_unid" required>
            ${unidadesOpts.map(o => `<option value="${U.esc(o.value)}">${U.esc(o.label)}</option>`).join('')}
          </select>
        </div>

        ${UI.field({ name: 'valorUnit', label: 'Valor Unitário (R$)', type: 'number', step: '0.01', min: '0', required: true })}
        ${UI.field({ name: 'frete', label: 'Valor do Frete (R$)', type: 'number', step: '0.01', min: '0', value: '0.00' })}

        <div class="form-section">Faturamento, Logística & Destino</div>

        ${UI.field({ name: 'cliente', label: 'Cliente / Projeto Destino', required: true, placeholder: 'Ex: Mercado Livre RC01' })}
        ${UI.field({ name: 'centroCusto', label: 'Centro de Custo', required: true, placeholder: 'Ex: Meli RC01' })}
        ${UI.field({ name: 'localEntrega', label: 'Endereço / Local de Entrega', full: true, required: true, placeholder: 'Ex: Docas 3 e 4 - Perus/SP' })}
        
        <div class="field">
          <label for="f_pagamento">Condição de Pagamento <span class="req">*</span></label>
          <select name="pagamento" id="f_pagamento" required>
            ${pagamentosOpts.map(o => `<option value="${U.esc(o.value)}">${U.esc(o.label)}</option>`).join('')}
          </select>
        </div>

        ${UI.field({ name: 'previsao', label: 'Previsão de Entrega Prometida', type: 'date', required: true })}
        ${UI.field({ name: 'transportadora', label: 'Transportadora / Frete', placeholder: 'Ex: Própria do Fornecedor / Braspress' })}
        ${UI.field({ name: 'responsavelRecebimento', label: 'Responsável no Recebimento', placeholder: 'Ex: Almoxarifado Central / Carlos Mendes' })}
        ${UI.field({ name: 'obs', label: 'Observações do Pedido', type: 'textarea', full: true, placeholder: 'Instruções especiais de entrega, faturamento ou contato com portaria...' })}
        <input type="hidden" name="scId" id="f_scId" value="">
      </div>
    `;

    UI.modal({
      title: 'Novo Pedido de Compra (PC)',
      sub: 'Geração e emissão de ordem de fornecimento com bloqueio de governança',
      body: bodyHtml,
      size: 'lg',
      submitLabel: 'Emitir Pedido de Compra',
      onOpen: (form) => {
        // Se houver cotação inicial, preenche os campos automaticamente
        if (cotIdSelecionada) {
          PedidosModule.preencherCamposPorCotacao(form, cotIdSelecionada);
        }
      },
      onSubmit: (values, form, close) => {
        // Validação de segurança
        const qtd = Number(values.qtd) || 0;
        const vUnit = U.parseNum(values.valorUnit);
        const frete = U.parseNum(values.frete);

        if (qtd <= 0 || vUnit <= 0) {
          UI.toast('Informe quantidade e valor unitário válidos.', 'error');
          return false;
        }

        const vProd = qtd * vUnit;
        const compradora = Store.user()?.nome || 'Juliana Silva';

        // Cria o registro canônico do Pedido de Compra
        const novoPedido = {
          id: values.id || Store.nextId('PC-', Store.db.pedidos, 'id', 4),
          scId: values.scId || null,
          cotId: values.cotId || null,
          data: values.data || U.today(),
          compradora,
          fornecedorId: values.fornecedorId,
          cliente: values.cliente,
          centroCusto: values.centroCusto,
          descricao: values.descricao,
          qtd,
          unid: values.unid,
          valorUnit: vUnit,
          valorProdutos: vProd,
          frete,
          status: 'Pedido emitido',
          previsao: values.previsao,
          pagamento: values.pagamento,
          localEntrega: values.localEntrega,
          responsavelRecebimento: values.responsavelRecebimento || 'Almoxarifado',
          transportadora: values.transportadora || 'A definir',
          obs: values.obs || '',
          recebimentos: []
        };

        // Adiciona à base em memória
        Store.db.pedidos = Store.db.pedidos || [];
        Store.db.pedidos.unshift(novoPedido);

        // Atualiza a SC vinculada se existir
        if (novoPedido.scId) {
          const sc = Store.sc(novoPedido.scId);
          if (sc && sc.status !== 'Comprada') {
            sc.status = 'Comprada';
          }
        }

        // Atualiza a Cotação se existir
        if (novoPedido.cotId) {
          const cot = Store.cot(novoPedido.cotId);
          if (cot && cot.status !== 'Aprovada') {
            cot.status = 'Aprovada';
          }
        }

        // Persiste e notifica
        Store.commit(`Pedido de Compra ${novoPedido.id} emitido com sucesso!`, 'success');
        close();

        // Oferece abertura imediata do Espelho formal do Pedido
        setTimeout(() => {
          PedidosModule.abrirEspelho(novoPedido.id);
        }, 250);

        return true;
      }
    });
  },

  // Evento disparado no formulário ao trocar a cotação selecionada
  onSelecionarCotacaoNovoPedido(cotId) {
    const form = document.querySelector('.modal form');
    if (!form || !cotId) return;
    this.preencherCamposPorCotacao(form, cotId);
  },

  // Auto-completa campos da cotação no formulário de emissão
  preencherCamposPorCotacao(form, cotId) {
    const cot = Store.cot(cotId);
    if (!cot) return;

    const sc = Store.sc(cot.scId);
    const oferta = cot.ofertas && cot.ofertas[cot.escolhida != null ? cot.escolhida : 0];

    if (oferta) {
      if (form.fornecedorId) form.fornecedorId.value = oferta.fornecedorId || '';
      if (form.valorUnit) form.valorUnit.value = Number(oferta.valor || 0).toFixed(2);
      if (form.frete) form.frete.value = Number(oferta.frete || 0).toFixed(2);
      if (form.pagamento) form.pagamento.value = oferta.pagamento || 'Boleto 28 dias';
      
      // Previsão baseada no prazo do fornecedor
      const prazoDias = Number(oferta.prazo) || 5;
      if (form.previsao) form.previsao.value = U.addDays(U.today(), prazoDias);
    }

    if (sc) {
      if (form.scId) form.scId.value = sc.id;
      if (form.descricao) form.descricao.value = sc.descricao;
      if (form.qtd) form.qtd.value = sc.qtd;
      if (form.unid) form.unid.value = sc.unid;
      if (form.cliente) form.cliente.value = sc.cliente;
      if (form.centroCusto) form.centroCusto.value = sc.centroCusto;
      if (form.localEntrega) form.localEntrega.value = sc.localEntrega || 'Almoxarifado Central';
      if (form.responsavelRecebimento) form.responsavelRecebimento.value = sc.solicitante || '';
    }
  },

  /* ===================================================================
     ESPELHO DO PEDIDO DE COMPRA (ORDEM DE FORNECIMENTO FORMAL)
     =================================================================== */

  // Exibe a visualização formal de Ordem de Compra pronta para impressão
  abrirEspelho(pedidoId) {
    const p = Store.pedido(pedidoId);
    if (!p) {
      UI.toast('Pedido não encontrado.', 'error');
      return;
    }

    const forn = Store.fornecedor(p.fornecedorId) || {};
    const sc = p.scId ? Store.sc(p.scId) : null;
    const cot = p.cotId ? Store.cot(p.cotId) : null;

    const totalProd = Number(p.valorProdutos) || (Number(p.qtd) * Number(p.valorUnit));
    const frete = Number(p.frete) || 0;
    const totalGeral = totalProd + frete;

    const htmlEspelho = `
      <div class="espelho-pedido-container" style="background:#fff;padding:4px 8px;color:#0B1C30;font-family:Inter,sans-serif">
        
        <!-- CABEÇALHO FORMAL CORPORATIVO -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #081221;padding-bottom:14px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="background:#081221;color:#fff;border-radius:6px;padding:8px 12px;font-family:Montserrat,sans-serif;font-weight:800;font-size:18px;letter-spacing:-0.03em">
              GHC <span style="color:#E25C1D">FACILITIES</span>
            </div>
            <div>
              <div style="font-weight:700;font-size:13px;text-transform:uppercase;color:#081221">GHC Serviços e Facilities Ltda.</div>
              <div style="font-size:11px;color:#64748B">CNPJ: 12.345.678/0001-90 · Inscrição Estadual: 112.345.678.900</div>
              <div style="font-size:11px;color:#64748B">Av. das Nações Unidas, 14.261 · Morumbi · São Paulo/SP · CEP: 04794-000</div>
              <div style="font-size:11px;color:#64748B">Tel: (11) 3090-4400 · suprimentos@ghcfacilities.com.br</div>
            </div>
          </div>

          <div style="text-align:right">
            <div class="label-caps" style="color:#E25C1D;margin-bottom:2px">ORDEM DE COMPRA</div>
            <div style="font-family:Montserrat,sans-serif;font-size:24px;font-weight:800;color:#081221">${p.id}</div>
            <div style="font-size:11.5px;color:#64748B;margin-top:2px">Emissão: <b>${U.date(p.data)}</b></div>
            <div style="margin-top:4px">${UI.badge(p.status)}</div>
          </div>
        </div>

        <!-- BLOCO 1: DADOS DO FORNECEDOR & FATURAMENTO -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
          
          <!-- Quadro Fornecedor -->
          <div style="border:1px solid #CBD5E1;border-radius:6px;padding:12px;background:#F8FAFC">
            <div class="label-caps" style="color:#081221;border-bottom:1px solid #E2E8F0;padding-bottom:4px;margin-bottom:8px">1. Dados do Fornecedor</div>
            <div style="font-size:12px;line-height:18px">
              <div>Razão Social: <b>${U.esc(forn.razao || forn.fantasia || '—')}</b></div>
              <div>Nome Fantasia: <b>${U.esc(forn.fantasia || '—')}</b></div>
              <div>CNPJ: <span class="mono">${U.esc(forn.cnpj || '—')}</span></div>
              <div>Contato Comercial: ${U.esc(forn.contato || '—')}</div>
              <div>Telefone: ${U.esc(forn.telefone || '—')} · E-mail: ${U.esc(forn.email || '—')}</div>
              <div>Município / UF: ${U.esc(forn.cidade || '—')}</div>
            </div>
          </div>

          <!-- Quadro Entrega e Cobrança -->
          <div style="border:1px solid #CBD5E1;border-radius:6px;padding:12px;background:#F8FAFC">
            <div class="label-caps" style="color:#081221;border-bottom:1px solid #E2E8F0;padding-bottom:4px;margin-bottom:8px">2. Local de Entrega & Projeto</div>
            <div style="font-size:12px;line-height:18px">
              <div>Cliente / Contrato: <b>${U.esc(p.cliente)}</b></div>
              <div>Centro de Custo: <b>${U.esc(p.centroCusto)}</b></div>
              <div>Local de Entrega: <b>${U.esc(p.localEntrega || 'Almoxarifado Central')}</b></div>
              <div>Responsável no Local: ${U.esc(p.responsavelRecebimento || 'Carlos Mendes')}</div>
              <div>Previsão de Entrega: <b>${U.date(p.previsao)}</b></div>
              <div>Compradora Responsável: ${U.esc(p.compradora || 'Juliana Silva')}</div>
            </div>
          </div>

        </div>

        <!-- BLOCO 2: ITENS DA ORDEM DE COMPRA -->
        <div style="margin-bottom:16px">
          <div class="label-caps" style="color:#081221;margin-bottom:6px">3. Itens do Pedido</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:#081221;color:#fff;text-transform:uppercase;font-size:11px;letter-spacing:.05em">
                <th style="padding:8px 10px;text-align:center;width:40px">Item</th>
                <th style="padding:8px 10px;text-align:left;width:90px">Código</th>
                <th style="padding:8px 10px;text-align:left">Descrição do Material / Serviço</th>
                <th style="padding:8px 10px;text-align:center;width:60px">Unid</th>
                <th style="padding:8px 10px;text-align:right;width:70px">Qtd</th>
                <th style="padding:8px 10px;text-align:right;width:110px">Valor Unit.</th>
                <th style="padding:8px 10px;text-align:right;width:120px">Total Item</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid #E2E8F0">
                <td style="padding:10px;text-align:center;font-weight:600">01</td>
                <td style="padding:10px;font-family:monospace;font-size:11px">${U.esc(sc?.itemCodigo || 'MAT-ESP')}</td>
                <td style="padding:10px">
                  <div style="font-weight:600;color:#081221">${U.esc(p.descricao)}</div>
                  ${sc?.especificacao ? `<div style="font-size:11px;color:#64748B;margin-top:2px">${U.esc(sc.especificacao)}</div>` : ''}
                  ${p.scId ? `<div style="font-size:10px;color:#E25C1D;margin-top:2px">Ref. Solicitação: ${p.scId} ${p.cotId ? `· Cotação: ${p.cotId}` : ''}</div>` : ''}
                </td>
                <td style="padding:10px;text-align:center">${U.esc(p.unid)}</td>
                <td style="padding:10px;text-align:right;font-weight:600">${U.num(p.qtd)}</td>
                <td style="padding:10px;text-align:right">${U.brl(p.valorUnit)}</td>
                <td style="padding:10px;text-align:right;font-weight:700">${U.brl(totalProd)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- QUADRO DE TOTAIS -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:18px">
          <div style="width:320px;border:1px solid #CBD5E1;border-radius:6px;padding:10px 14px;background:#F8FAFC;font-size:12.5px">
            <div style="display:flex;justify-content:space-between;padding:3px 0">
              <span style="color:#64748B">Subtotal dos Produtos:</span>
              <b>${U.brl(totalProd)}</b>
            </div>
            <div style="display:flex;justify-content:space-between;padding:3px 0">
              <span style="color:#64748B">Frete (${U.esc(p.transportadora || 'Fornecedor')}):</span>
              <b>${U.brl(frete)}</b>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0 2px;border-top:1.5px solid #081221;font-size:15px;color:#081221;margin-top:4px">
              <span style="font-weight:700">VALOR TOTAL DO PEDIDO:</span>
              <span style="font-weight:800;color:#E25C1D">${U.brl(totalGeral)}</span>
            </div>
          </div>
        </div>

        <!-- BLOCO 3: CONDIÇÕES COMERCIAIS & REGRAS DE FATURAMENTO -->
        <div style="border:1px solid #E2E8F0;border-left:3px solid #E25C1D;border-radius:4px;padding:12px;background:#FFFBF8;margin-bottom:20px;font-size:11.5px;line-height:18px">
          <div class="label-caps" style="color:#C2410C;margin-bottom:4px">4. Condições de Fornecimento & Regras Fiscais Obrigatórias</div>
          <div>• <b>Condição de Pagamento:</b> ${U.esc(p.pagamento || 'Boleto 28 dias')} (Vencimento contado a partir do aceite fiscal da NF).</div>
          <div>• <b>Identificação Obrigatória na NF:</b> Constar no campo 'Informações Complementares' o N° deste Pedido (<b>${p.id}</b>) e o Centro de Custo (<b>${U.esc(p.centroCusto)}</b>).</div>
          <div>• <b>Envio Fiscal Antecipado:</b> O arquivo XML da NF-e e o DANFE devem ser encaminhados para <u>nfe@ghcfacilities.com.br</u> antes do despacho.</div>
          <div>• <b>Horário de Recebimento nas Obras/Bases:</b> Segunda a Sexta, das 08h00 às 16h30. Mercadoria desacompanhada de NF não será aceita.</div>
          ${p.obs ? `<div style="margin-top:4px;color:#334155">• <b>Observações Específicas:</b> ${U.esc(p.obs)}</div>` : ''}
        </div>

        <!-- BLOCO 4: ÁREA DE ASSINATURAS E APROVAÇÃO -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding-top:20px;border-top:1px dashed #CBD5E1;text-align:center;font-size:11px">
          <div>
            <div style="border-bottom:1px solid #081221;height:32px;margin-bottom:6px"></div>
            <b>${U.esc(p.compradora || 'Juliana Silva')}</b>
            <div style="color:#64748B">Comprador Emitente · GHC</div>
          </div>
          <div>
            <div style="border-bottom:1px solid #081221;height:32px;margin-bottom:6px"></div>
            <b>Gestão Operacional / Alçada</b>
            <div style="color:#64748B">Aprovação de Suprimentos</div>
          </div>
          <div>
            <div style="border-bottom:1px solid #081221;height:32px;margin-bottom:6px"></div>
            <b>${U.esc(forn.fantasia || 'Representante Fornecedor')}</b>
            <div style="color:#64748B">Aceite do Pedido & Prazo</div>
          </div>
        </div>

      </div>
    `;

    UI.modal({
      title: `Espelho do Pedido — ${p.id}`,
      sub: `Documento oficial de Ordem de Compra para emissão ao fornecedor ${Store.fornecedorNome(p.fornecedorId)}`,
      body: htmlEspelho,
      size: 'lg',
      hideSubmit: true,
      cancelLabel: 'Fechar',
      extraFoot: `
        <button type="button" class="btn btn-dark" onclick="window.print()" style="margin-right:auto">
          ${Icon('printer')} Imprimir Ordem de Compra
        </button>
        ${p.status !== 'Recebido' && p.status !== 'Cancelado' ? `
          <button type="button" class="btn btn-primary" onclick="PedidosModule.abrirRegistrarRecebimento('${p.id}');">
            ${Icon('truck')} Registrar Recebimento
          </button>
        ` : ''}
      `
    });
  },

  /* ===================================================================
     CANCELAMENTO DE PEDIDO DE COMPRA
     =================================================================== */

  // Cancela o pedido com confirmação prévia e registro do motivo
  cancelarPedido(pedidoId) {
    const p = Store.pedido(pedidoId);
    if (!p) return;

    if (p.status === 'Cancelado') {
      UI.toast('Este pedido já está cancelado.', 'warning');
      return;
    }

    if (p.status === 'Recebido') {
      UI.toast('Não é possível cancelar um pedido já recebido 100%.', 'error');
      return;
    }

    const bodyHtml = `
      <div class="notice" style="margin-bottom:14px">
        ${Icon('alert')}
        <div>
          Você está prestes a cancelar o pedido <b>${p.id}</b> (${Store.fornecedorNome(p.fornecedorId)} - ${U.brl(Rules.pedidoTotal(p))}). 
          Se houver recebimentos parciais, eles permanecerão no histórico, mas nenhuma entrega adicional poderá ser lançada.
        </div>
      </div>
      <div class="field full">
        <label for="f_motivo">Motivo do Cancelamento <span class="req">*</span></label>
        <textarea name="motivo" id="f_motivo" required placeholder="Ex: Cancelamento solicitado pelo cliente, desacordo comercial de prazo, desistência de compra..."></textarea>
      </div>
    `;

    UI.modal({
      title: `Cancelar Pedido ${p.id}`,
      sub: 'Confirmação e rastreabilidade de governança',
      body: bodyHtml,
      submitLabel: 'Confirmar Cancelamento',
      onSubmit: (values, form, close) => {
        const motivo = (values.motivo || '').trim();
        if (!motivo) {
          UI.toast('Informe o motivo do cancelamento.', 'error');
          return false;
        }

        p.status = 'Cancelado';
        p.motivoCancelamento = motivo;

        Store.commit(`Pedido ${p.id} cancelado com sucesso.`, 'warning');
        close();
        return true;
      }
    });
  },

  /* ===================================================================
     REGISTRO DE RECEBIMENTO & INTEGRAÇÃO DE ESTOQUE (ENTREGAS & NF)
     =================================================================== */

  // Modal para lançamento de recebimento com conferência física e NF
  abrirRegistrarRecebimento(pedidoId) {
    const p = Store.pedido(pedidoId);
    if (!p) {
      UI.toast('Pedido não encontrado.', 'error');
      return;
    }

    if (p.status === 'Cancelado') {
      UI.toast('Não é possível registrar recebimento em pedido cancelado.', 'error');
      return;
    }

    const totalPedido = Number(p.qtd) || 0;
    const jaRecebido = Rules.qtdRecebida(p);
    const saldoRestante = Math.max(0, totalPedido - jaRecebido);

    if (saldoRestante <= 0) {
      UI.toast('Este pedido já foi 100% recebido.', 'warning');
      return;
    }

    const fornNome = Store.fornecedorNome(p.fornecedorId);
    const userNome = Store.user()?.nome || p.responsavelRecebimento || 'Almoxarifado';

    // Estimativa proporcional do valor da NF (saldo * unitário)
    const valorEstimadoNF = (saldoRestante * Number(p.valorUnit) + (jaRecebido === 0 ? Number(p.frete) : 0)).toFixed(2);

    const bodyHtml = `
      <!-- CARD RESUMO DO PEDIDO -->
      <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:6px;padding:12px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #E2E8F0;padding-bottom:6px;margin-bottom:8px">
          <div>
            <b style="font-size:14px;color:#081221">${p.id}</b> · <span style="color:#64748B">${U.esc(fornNome)}</span>
          </div>
          <div>${UI.badge(p.status)}</div>
        </div>
        <div style="font-size:12.5px;color:#334155;line-height:19px">
          <div>Material: <b>${U.esc(p.descricao)}</b></div>
          <div>Cliente / Centro de Custo: <b>${U.esc(p.cliente)}</b> (${U.esc(p.centroCusto)})</div>
          <div style="display:flex;gap:18px;margin-top:6px;font-size:12px;background:#EFF4FF;padding:6px 10px;border-radius:4px">
            <span>Total do Pedido: <b>${U.num(totalPedido)} ${U.esc(p.unid)}</b></span>
            <span>Já Recebido: <b style="color:#047857">${U.num(jaRecebido)} ${U.esc(p.unid)}</b></span>
            <span>Saldo a Receber: <b style="color:#E25C1D">${U.num(saldoRestante)} ${U.esc(p.unid)}</b></span>
          </div>
        </div>
      </div>

      <!-- FORMULÁRIO DE CONFERÊNCIA FISCAL -->
      <div class="form-grid cols-2">
        ${UI.field({ name: 'data', label: 'Data do Recebimento', type: 'date', value: U.today(), required: true })}
        ${UI.field({ name: 'qtd', label: `Qtd Recebida nesta remessa (${p.unid})`, type: 'number', step: 'any', min: '0.01', max: String(saldoRestante), value: String(saldoRestante), required: true, hint: `Máximo disponível: ${U.num(saldoRestante)} ${p.unid}` })}

        ${UI.field({ name: 'nf', label: 'Número da Nota Fiscal (NF-e)', required: true, placeholder: 'Ex: NF-12490' })}
        ${UI.field({ name: 'valorNF', label: 'Valor Total da NF (R$)', type: 'number', step: '0.01', min: '0.01', value: valorEstimadoNF, required: true })}

        ${UI.field({ name: 'responsavel', label: 'Responsável pela Conferência', value: userNome, required: true })}
        ${UI.field({ name: 'transportadora', label: 'Transportadora / Rastreio', value: p.transportadora || '', placeholder: 'Ex: Braspress / Motoboy' })}

        ${UI.field({ name: 'obs', label: 'Observações da Entrega', type: 'textarea', full: true, placeholder: 'Estado da embalagem, laudos técnicos anexos, condições físicas do material...' })}
      </div>
    `;

    UI.modal({
      title: `Registrar Recebimento & NF — ${p.id}`,
      sub: 'Conferência física com atualização instantânea de saldo em estoque',
      body: bodyHtml,
      size: 'md',
      submitLabel: 'Confirmar Entrada & Atualizar Estoque',
      onSubmit: (values, form, close) => {
        const qtdInformada = Number(values.qtd) || 0;
        const nfNum = (values.nf || '').trim();
        const vNF = U.parseNum(values.valorNF);
        const responsavel = (values.responsavel || userNome).trim();
        const dataRec = values.data || U.today();

        if (qtdInformada <= 0) {
          UI.toast('Informe uma quantidade válida para recebimento.', 'error');
          return false;
        }

        if (qtdInformada > saldoRestante + 0.0001) {
          UI.toast(`A quantidade não pode exceder o saldo pendente de ${U.num(saldoRestante)} ${p.unid}.`, 'error');
          return false;
        }

        if (!nfNum) {
          UI.toast('O número da Nota Fiscal é obrigatório.', 'error');
          return false;
        }

        // 1. Cria o objeto canônico de recebimento
        const novoRecebimento = {
          data: dataRec,
          qtd: qtdInformada,
          nf: nfNum,
          valorNF: vNF,
          responsavel,
          transportadora: (values.transportadora || '').trim(),
          obs: (values.obs || '').trim()
        };

        p.recebimentos = p.recebimentos || [];
        p.recebimentos.push(novoRecebimento);

        // 2. Atualiza os status do Pedido e da Solicitação (SC)
        const totalRecebidoApos = Rules.qtdRecebida(p);
        if (totalRecebidoApos >= totalPedido) {
          p.status = 'Recebido';
          // Se 100% recebido, atualiza a SC para Comprada
          if (p.scId) {
            const sc = Store.sc(p.scId);
            if (sc) sc.status = 'Comprada';
          }
        } else {
          p.status = 'Recebido parcial';
        }

        // 3. INTEGRAÇÃO AUTOMÁTICA COM O ESTOQUE
        let itemEstoque = null;

        // Tenta localizar por código direto (se SC ou Pedido tiverem itemCodigo)
        if (p.itemCodigo) {
          itemEstoque = Store.item(p.itemCodigo);
        } else if (p.scId) {
          const sc = Store.sc(p.scId);
          if (sc?.itemCodigo) itemEstoque = Store.item(sc.itemCodigo);
        }

        // Se não localizou por código, faz busca fuzzy por descrição/nome
        if (!itemEstoque) {
          itemEstoque = (Store.db.estoque || []).find(it => U.norm(it.material) === U.norm(p.descricao))
                     || (Store.db.estoque || []).find(it => U.norm(it.material).includes(U.norm(p.descricao)) || U.norm(p.descricao).includes(U.norm(it.material)));
        }

        // Se localizou item em estoque, incrementa saldo e gera movimentação
        if (itemEstoque) {
          itemEstoque.atual = (Number(itemEstoque.atual) || 0) + qtdInformada;
          if (p.valorUnit) itemEstoque.ultimoPreco = Number(p.valorUnit);

          Store.db.movimentos = Store.db.movimentos || [];
          const movId = Store.nextId('MOV-', Store.db.movimentos, 'id', 4);
          Store.db.movimentos.unshift({
            id: movId,
            data: dataRec,
            codigo: itemEstoque.codigo,
            tipo: 'Entrada',
            qtd: qtdInformada,
            ref: p.id,
            responsavel,
            obs: `Recebimento ${p.id} - ${nfNum}`
          });
        }

        // 4. Salva a mutação no banco de dados e notifica
        Store.save();
        App.rerender();
        UI.toast(`Recebimento da ${nfNum} registrado com sucesso! Estoque atualizado (+${U.num(qtdInformada)} ${p.unid}).`, 'success');
        close();

        // 5. Oferece avaliação rápida de desempenho do fornecedor
        setTimeout(() => {
          PedidosModule.conviteAvaliacaoRapida(p, novoRecebimento);
        }, 300);

        return true;
      }
    });
  },

  /* Histórico completo de remessas e notas fiscais de um pedido */
  abrirHistoricoRecebimentos(pedidoId) {
    const p = Store.pedido(pedidoId);
    if (!p) return;

    const recs = p.recebimentos || [];
    const fornNome = Store.fornecedorNome(p.fornecedorId);

    const bodyHtml = `
      <div style="margin-bottom:12px;font-size:13px;color:#64748B">
        Fornecedor: <b>${U.esc(fornNome)}</b> · Material: <b>${U.esc(p.descricao)}</b>
      </div>
      ${recs.length ? `
        <table class="table" style="font-size:12px">
          <thead>
            <tr>
              <th>Data</th>
              <th>Nota Fiscal</th>
              <th>Valor NF</th>
              <th class="t-right">Qtd Recebida</th>
              <th>Responsável</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            ${recs.map(r => `
              <tr>
                <td>${U.date(r.data)}</td>
                <td><span class="mono" style="font-weight:700">${U.esc(r.nf)}</span></td>
                <td>${U.brl(r.valorNF)}</td>
                <td class="t-right" style="font-weight:700;color:#047857">${U.num(r.qtd)} ${U.esc(p.unid)}</td>
                <td>${U.esc(r.responsavel)}</td>
                <td class="muted">${U.esc(r.obs || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2"><b>Total Recebido Acumulado:</b></td>
              <td><b>${U.brl(U.sum(recs, r => r.valorNF || 0))}</b></td>
              <td class="t-right" style="font-weight:800;color:#047857">${U.num(Rules.qtdRecebida(p))} / ${U.num(p.qtd)} ${U.esc(p.unid)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      ` : '<div class="empty">Nenhum recebimento registrado para este pedido até o momento.</div>'}
    `;

    UI.modal({
      title: `Histórico de Entregas & NFs — ${p.id}`,
      sub: 'Rastreabilidade de todas as remessas físicas conferidas',
      body: bodyHtml,
      size: 'lg',
      hideSubmit: true,
      cancelLabel: 'Fechar'
    });
  },

  /* ===================================================================
     AVALIAÇÃO RÁPIDA DE FORNECEDORES (PÓS-ENTREGA)
     =================================================================== */

  // Modal com convite oferecendo avaliação do fornecedor
  conviteAvaliacaoRapida(p, recebimento) {
    const fornNome = Store.fornecedorNome(p.fornecedorId);

    const bodyHtml = `
      <div style="text-align:center;padding:10px 6px">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(226,92,29,0.12);color:#E25C1D;display:grid;place-items:center;margin:0 auto 14px">
          ${Icon('star')}
        </div>
        <h4 style="font-size:16px;font-weight:700;margin-bottom:6px;color:#081221">Avaliar Desempenho do Fornecedor?</h4>
        <p style="color:#64748B;font-size:13px;line-height:20px;max-width:440px;margin:0 auto 18px">
          A entrega da NF <b>${U.esc(recebimento.nf)}</b> foi registrada com sucesso. Deseja pontuar o fornecedor <b>${U.esc(fornNome)}</b> nesta entrega para alimentar o ranking homologado da GHC?
        </p>
      </div>
    `;

    UI.modal({
      title: 'Qualificação de Fornecedor',
      body: bodyHtml,
      size: 'md',
      submitLabel: 'Avaliar Agora',
      cancelLabel: 'Mais Tarde',
      onSubmit: (values, form, close) => {
        close();
        setTimeout(() => {
          PedidosModule.abrirModalAvaliacaoRapida(p.id);
        }, 200);
        return true;
      }
    });
  },

  // Modal completo com notas de 0 a 10 para os 5 critérios da GHC
  abrirModalAvaliacaoRapida(pedidoId) {
    const p = Store.pedido(pedidoId);
    if (!p) return;

    const fornNome = Store.fornecedorNome(p.fornecedorId);
    const reg = Rules.entrega(p);

    // Sugestão de nota de prazo baseada na pontualidade real
    const sugestaoPrazo = reg.atrasada ? (reg.dias > 5 ? 5 : 7) : 10;

    const bodyHtml = `
      <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:6px;padding:12px;margin-bottom:16px;font-size:13px">
        Fornecedor: <b>${U.esc(fornNome)}</b> · Pedido: <b>${p.id}</b> (${U.esc(p.descricao)})<br>
        Situação da Entrega: ${UI.badge(reg.situacao)}
      </div>

      <div class="form-grid cols-2">
        <div class="field">
          <label for="f_preco">1. Preço e Condições (0 a 10) <span class="req">*</span></label>
          <input type="number" name="preco" id="f_preco" min="0" max="10" step="0.5" value="10" required>
          <span class="hint">Fidelidade aos valores cotados e frete</span>
        </div>

        <div class="field">
          <label for="f_prazo">2. Prazo de Entrega (0 a 10) <span class="req">*</span></label>
          <input type="number" name="prazo" id="f_prazo" min="0" max="10" step="0.5" value="${sugestaoPrazo}" required>
          <span class="hint">Cumprimento da data combinada</span>
        </div>

        <div class="field">
          <label for="f_qualidade">3. Qualidade do Material (0 a 10) <span class="req">*</span></label>
          <input type="number" name="qualidade" id="f_qualidade" min="0" max="10" step="0.5" value="10" required>
          <span class="hint">Embalagem, especificações e sem avarias</span>
        </div>

        <div class="field">
          <label for="f_atendimento">4. Atendimento Comercial (0 a 10) <span class="req">*</span></label>
          <input type="number" name="atendimento" id="f_atendimento" min="0" max="10" step="0.5" value="9" required>
          <span class="hint">Agilidade na cotação e suporte de envio</span>
        </div>

        <div class="field full">
          <label for="f_documentacao">5. Documentação & NF-e (0 a 10) <span class="req">*</span></label>
          <input type="number" name="documentacao" id="f_documentacao" min="0" max="10" step="0.5" value="10" required>
          <span class="hint">Envio prévio de XML, laudos e correções fiscais</span>
        </div>

        <div class="field full">
          <label for="f_comentarios">Comentários e Justificativa da Avaliação</label>
          <textarea name="comentarios" id="f_comentarios" placeholder="Ex: Material entregue em conformidade com as especificações da engenharia..."></textarea>
        </div>
      </div>
    `;

    UI.modal({
      title: `Avaliação de Fornecedor — ${fornNome}`,
      sub: 'Métricas de desempenho para qualificação e histórico homologado',
      body: bodyHtml,
      size: 'md',
      submitLabel: 'Salvar Avaliação de Desempenho',
      onSubmit: (values, form, close) => {
        const preco = Number(values.preco) || 0;
        const prazo = Number(values.prazo) || 0;
        const qualidade = Number(values.qualidade) || 0;
        const atendimento = Number(values.atendimento) || 0;
        const documentacao = Number(values.documentacao) || 0;

        Store.db.avaliacoes = Store.db.avaliacoes || [];
        const avId = Store.nextId('AV-', Store.db.avaliacoes, 'id', 4);

        Store.db.avaliacoes.unshift({
          id: avId,
          data: U.today(),
          fornecedorId: p.fornecedorId,
          pedidoId: p.id,
          preco,
          prazo,
          qualidade,
          atendimento,
          documentacao,
          responsavel: Store.user()?.nome || 'Juliana Silva',
          comentarios: (values.comentarios || '').trim() || 'Avaliação registrada após recebimento fiscal.'
        });

        Store.commit(`Avaliação ${avId} gravada com sucesso! Score do fornecedor atualizado.`, 'success');
        close();
        return true;
      }
    });
  },

  /* ===================================================================
     RENDERIZAÇÃO DA PÁGINA: PEDIDOS DE COMPRA
     =================================================================== */

  renderPedidos(el, params = {}) {
    const kpis = this.getKpisPedidos();
    const pedidos = this.getPedidosFiltrados();

    // Se veio com parâmetro de abrir espelho direto
    if (params.id) {
      setTimeout(() => PedidosModule.abrirEspelho(params.id), 100);
    }

    // Lista única de clientes para o filtro
    const clientesUnicos = [...new Set((Store.db.pedidos || []).map(p => p.cliente).filter(Boolean))];
    const fornecedoresUnicos = (Store.db.fornecedores || []);

    // Definição das Abas com contadores dinâmicos
    const all = Store.db.pedidos || [];
    const tabsData = [
      { id: 'todos', label: 'Todos os Pedidos', count: all.length },
      { id: 'abertos', label: 'Em Aberto', count: all.filter(p => p.status !== 'Recebido' && p.status !== 'Cancelado').length },
      { id: 'parciais', label: 'Recebidos Parcial', count: all.filter(p => p.status === 'Recebido parcial').length },
      { id: 'recebidos', label: 'Recebidos 100%', count: all.filter(p => p.status === 'Recebido').length },
      { id: 'cancelados', label: 'Cancelados', count: all.filter(p => p.status === 'Cancelado').length }
    ];

    el.innerHTML = `
      <!-- CABEÇALHO -->
      ${UI.pageHead({
        eyebrow: 'MÓDULO DE COMPRAS · ETAPA 03',
        title: 'Pedidos de Compra',
        sub: 'Ordens de compra emitidas a fornecedores, acompanhamento financeiro, espelho formal e controle de recebimentos.',
        actions: `
          ${UI.btn('+ Novo Pedido', {
            icon: 'plus',
            variant: 'primary',
            onclick: "PedidosModule.abrirNovoPedido()"
          })}
        `
      })}

      <!-- KPIS OPERACIONAIS -->
      <div class="kpis">
        ${UI.kpi({
          label: 'Pedidos Emitidos',
          value: kpis.totalPedidos,
          note: 'Total cadastrado no período',
          icon: 'cart',
          tone: 'dark'
        })}
        ${UI.kpi({
          label: 'Total Comprado',
          value: U.brlShort(kpis.totalComprado),
          note: 'Produtos e fretes contratados',
          icon: 'wallet',
          tone: 'dark'
        })}
        ${UI.kpi({
          label: 'Em Trânsito / Aberto',
          value: kpis.emTransito,
          note: 'Aguardando entrega física',
          icon: 'truck',
          tone: 'light'
        })}
        ${UI.kpi({
          label: 'Recebidos 100%',
          value: kpis.recebidos,
          note: 'Entregas finalizadas na base',
          icon: 'checkCircle',
          tone: 'light'
        })}
      </div>

      <!-- PAINEL PRINCIPAL COM TABELA -->
      <div class="card flush">
        
        <!-- ABAS DE NAVEGAÇÃO -->
        <div style="padding:16px 20px 0">
          ${UI.tabs(tabsData, this.state.pedidos.tab, "PedidosModule.setTabPedidos")}
        </div>

        <!-- TOOLBAR DE BUSCA E FILTROS -->
        <div class="toolbar">
          <div class="search">
            ${Icon('search')}
            <input type="text" id="filtroBuscaPedidos" placeholder="Buscar por N° pedido, fornecedor, material, cliente ou centro de custo..." value="${U.esc(this.state.pedidos.busca)}" oninput="PedidosModule.onBuscaPedidos(this.value)">
          </div>

          <select onchange="PedidosModule.setFiltroFornecedorPedidos(this.value)" aria-label="Filtrar por Fornecedor">
            <option value="">Todos os Fornecedores</option>
            ${fornecedoresUnicos.map(f => `<option value="${f.id}" ${this.state.pedidos.fornecedorId === f.id ? 'selected' : ''}>${U.esc(f.fantasia || f.razao)}</option>`).join('')}
          </select>

          <select onchange="PedidosModule.setFiltroClientePedidos(this.value)" aria-label="Filtrar por Cliente">
            <option value="">Todos os Clientes</option>
            ${clientesUnicos.map(c => `<option value="${U.esc(c)}" ${this.state.pedidos.cliente === c ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}
          </select>

          <select onchange="PedidosModule.setFiltroStatusPedidos(this.value)" aria-label="Filtrar por Status">
            <option value="">Todos os Status</option>
            ${Rules.STATUS_PEDIDO.map(st => `<option value="${st}" ${this.state.pedidos.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>

          ${(this.state.pedidos.busca || this.state.pedidos.fornecedorId || this.state.pedidos.cliente || this.state.pedidos.status) ? `
            <button type="button" class="btn btn-ghost btn-xs" onclick="PedidosModule.limparFiltrosPedidos()">Limpar filtros</button>
          ` : ''}
        </div>

        <!-- TABELA DE PEDIDOS -->
        <div id="pedidosTabelaContainer">
          ${this.renderTabelaPedidosHtml(pedidos)}
        </div>

      </div>
    `;
  },

  // Gera o HTML da tabela de pedidos
  renderTabelaPedidosHtml(pedidos) {
    return UI.table({
      columns: [
        {
          label: 'N° Pedido',
          render: (p) => `
            <div>
              <a href="javascript:void(0)" onclick="PedidosModule.abrirEspelho('${p.id}')" style="font-weight:700;color:var(--orange);text-decoration:none">
                ${p.id}
              </a>
              <div class="cell-sub">${U.date(p.data)}</div>
            </div>
          `
        },
        {
          label: 'Fornecedor',
          render: (p) => {
            const f = Store.fornecedor(p.fornecedorId);
            return `
              <div>
                <div class="cell-main">${U.esc(f ? (f.fantasia || f.razao) : '—')}</div>
                <div class="cell-sub">${U.esc(f?.cidade || '—')}</div>
              </div>
            `;
          }
        },
        {
          label: 'Cliente / CC',
          render: (p) => `
            <div>
              <div class="cell-main">${U.esc(p.cliente)}</div>
              <div class="cell-sub">${U.esc(p.centroCusto)}</div>
            </div>
          `
        },
        {
          label: 'Material / Descrição',
          render: (p) => `
            <div style="max-width:260px" title="${U.esc(p.descricao)}">
              <div class="cell-main" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${U.esc(p.descricao)}</div>
              <div class="cell-sub">${p.scId ? `Ref: ${p.scId}` : 'Pedido Direto'}</div>
            </div>
          `
        },
        {
          label: 'Qtd Pedida',
          align: 'right',
          render: (p) => `<b>${U.num(p.qtd)}</b> <span class="muted small">${U.esc(p.unid)}</span>`
        },
        {
          label: 'Valor Total',
          align: 'right',
          render: (p) => `
            <div>
              <b style="color:var(--text)">${U.brl(Rules.pedidoTotal(p))}</b>
              ${p.frete ? `<div class="cell-sub">Frete: ${U.brl(p.frete)}</div>` : ''}
            </div>
          `
        },
        {
          label: 'Previsão Entrega',
          render: (p) => {
            const reg = Rules.entrega(p);
            return `
              <div>
                <div>${U.date(p.previsao)}</div>
                <div style="margin-top:2px">${UI.badge(reg.situacao)}</div>
              </div>
            `;
          }
        },
        {
          label: 'Status Pedido',
          align: 'center',
          render: (p) => UI.badge(p.status)
        },
        {
          label: 'Ações',
          align: 'right',
          render: (p) => `
            <div class="row" style="justify-content:flex-end;gap:6px">
              <button type="button" class="btn btn-ghost btn-xs" onclick="PedidosModule.abrirEspelho('${p.id}')" title="Espelho / Ordem de Compra">
                ${Icon('printer')} Espelho
              </button>
              ${p.status !== 'Recebido' && p.status !== 'Cancelado' ? `
                <button type="button" class="btn btn-outline-orange btn-xs" onclick="PedidosModule.abrirRegistrarRecebimento('${p.id}')" title="Receber Remessa">
                  ${Icon('truck')} Receber
                </button>
                <button type="button" class="btn btn-ghost btn-xs" style="color:var(--error)" onclick="PedidosModule.cancelarPedido('${p.id}')" title="Cancelar Pedido">
                  ${Icon('x')}
                </button>
              ` : ''}
            </div>
          `
        }
      ],
      rows: pedidos,
      empty: 'Nenhum pedido de compra encontrado com os filtros aplicados.'
    });
  },

  // Handlers reativos de filtros e busca de Pedidos
  setTabPedidos(tabId) {
    this.state.pedidos.tab = tabId;
    App.rerender();
  },

  onBuscaPedidos: U.debounce(function(val) {
    PedidosModule.state.pedidos.busca = val;
    const container = document.getElementById('pedidosTabelaContainer');
    if (container) {
      container.innerHTML = PedidosModule.renderTabelaPedidosHtml(PedidosModule.getPedidosFiltrados());
    }
  }, 120),

  setFiltroFornecedorPedidos(val) {
    this.state.pedidos.fornecedorId = val;
    App.rerender();
  },

  setFiltroClientePedidos(val) {
    this.state.pedidos.cliente = val;
    App.rerender();
  },

  setFiltroStatusPedidos(val) {
    this.state.pedidos.status = val;
    App.rerender();
  },

  limparFiltrosPedidos() {
    this.state.pedidos.busca = '';
    this.state.pedidos.fornecedorId = '';
    this.state.pedidos.cliente = '';
    this.state.pedidos.status = '';
    App.rerender();
  },

  /* ===================================================================
     RENDERIZAÇÃO DA PÁGINA: ENTREGAS & NOTAS FISCAIS
     =================================================================== */

  renderEntregas(el, params = {}) {
    const kpis = this.getKpisEntregas();
    const entregas = this.getEntregasFiltradas();

    // Se navegou com parâmetro direto para receber
    if (params.receberId) {
      setTimeout(() => PedidosModule.abrirRegistrarRecebimento(params.receberId), 100);
    }

    const fornecedoresUnicos = (Store.db.fornecedores || []);

    // Definição das abas com contagens reais
    const todasEntregas = (Store.db.pedidos || []).filter(p => p.status !== 'Cancelado');
    const tabsData = [
      { id: 'todas', label: 'Todas as Entregas', count: todasEntregas.length },
      { id: 'atrasadas', label: 'Atrasadas', count: todasEntregas.filter(p => Rules.entrega(p).atrasada).length },
      { id: 'noprazo', label: 'No Prazo', count: todasEntregas.filter(p => !Rules.entrega(p).atrasada && p.status !== 'Recebido').length },
      { id: 'recebidas', label: 'Recebidas 100%', count: todasEntregas.filter(p => p.status === 'Recebido').length }
    ];

    el.innerHTML = `
      <!-- CABEÇALHO -->
      ${UI.pageHead({
        eyebrow: 'SUPRIMENTOS & LOGÍSTICA · ETAPA 04',
        title: 'Entregas & Notas Fiscais',
        sub: 'Monitoramento de prazos acordados, conferência física de remessas, lançamento de NFs e alimentação direta do estoque.',
        actions: `
          ${UI.btn('Ver Almoxarifado / Estoque', {
            icon: 'box',
            variant: 'ghost',
            onclick: "App.go('estoque')"
          })}
        `
      })}

      <!-- KPIS OPERACIONAIS -->
      <div class="kpis">
        ${UI.kpi({
          label: 'Entregas no Prazo',
          value: kpis.noPrazo,
          note: 'Em trânsito ou recebidas pontuais',
          icon: 'checkCircle',
          tone: 'dark'
        })}
        ${UI.kpi({
          label: 'Entregas Atrasadas',
          value: `<span style="color:${kpis.atrasadas > 0 ? '#EF4444' : 'inherit'}">${kpis.atrasadas}</span>`,
          note: 'Cálculo real contra data prevista',
          icon: 'alert',
          tone: 'dark'
        })}
        ${UI.kpi({
          label: 'Recebimentos Parciais',
          value: kpis.parciais,
          note: 'Saldo físico ainda pendente',
          icon: 'truck',
          tone: 'light'
        })}
        ${UI.kpi({
          label: 'NFs Lançadas',
          value: kpis.totalNfs,
          note: `Total faturado: ${U.brlShort(kpis.totalValorNf)}`,
          icon: 'sheet',
          tone: 'light'
        })}
      </div>

      <!-- PAINEL PRINCIPAL COM TABELA DE ENTREGAS -->
      <div class="card flush">
        
        <!-- ABAS DE NAVEGAÇÃO -->
        <div style="padding:16px 20px 0">
          ${UI.tabs(tabsData, this.state.entregas.tab, "PedidosModule.setTabEntregas")}
        </div>

        <!-- TOOLBAR DE BUSCA E FILTROS -->
        <div class="toolbar">
          <div class="search">
            ${Icon('search')}
            <input type="text" id="filtroBuscaEntregas" placeholder="Buscar por pedido, material, fornecedor, N° da NF ou transportadora..." value="${U.esc(this.state.entregas.busca)}" oninput="PedidosModule.onBuscaEntregas(this.value)">
          </div>

          <select onchange="PedidosModule.setFiltroFornecedorEntregas(this.value)" aria-label="Filtrar por Fornecedor">
            <option value="">Todos os Fornecedores</option>
            ${fornecedoresUnicos.map(f => `<option value="${f.id}" ${this.state.entregas.fornecedorId === f.id ? 'selected' : ''}>${U.esc(f.fantasia || f.razao)}</option>`).join('')}
          </select>

          ${this.state.entregas.busca || this.state.entregas.fornecedorId ? `
            <button type="button" class="btn btn-ghost btn-xs" onclick="PedidosModule.limparFiltrosEntregas()">Limpar filtros</button>
          ` : ''}
        </div>

        <!-- TABELA DE ENTREGAS -->
        <div id="entregasTabelaContainer">
          ${this.renderTabelaEntregasHtml(entregas)}
        </div>

      </div>
    `;
  },

  // Gera o HTML da tabela de entregas e conferência física
  renderTabelaEntregasHtml(entregas) {
    return UI.table({
      columns: [
        {
          label: 'Pedido',
          render: (p) => `
            <div>
              <a href="javascript:void(0)" onclick="PedidosModule.abrirEspelho('${p.id}')" style="font-weight:700;color:var(--orange);text-decoration:none">
                ${p.id}
              </a>
              <div class="cell-sub">${U.date(p.data)}</div>
            </div>
          `
        },
        {
          label: 'Fornecedor',
          render: (p) => {
            const f = Store.fornecedor(p.fornecedorId);
            return `
              <div>
                <div class="cell-main">${U.esc(f ? (f.fantasia || f.razao) : '—')}</div>
                <div class="cell-sub">${U.esc(f?.telefone || f?.contato || '—')}</div>
              </div>
            `;
          }
        },
        {
          label: 'Cliente / Projeto',
          render: (p) => `
            <div>
              <div class="cell-main">${U.esc(p.cliente)}</div>
              <div class="cell-sub">${U.esc(p.centroCusto)}</div>
            </div>
          `
        },
        {
          label: 'Item / Material',
          render: (p) => `
            <div style="max-width:220px" title="${U.esc(p.descricao)}">
              <div class="cell-main" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${U.esc(p.descricao)}</div>
              <div class="cell-sub">${U.esc(p.localEntrega || 'Almoxarifado Central')}</div>
            </div>
          `
        },
        {
          label: 'Qtd Pedida',
          align: 'right',
          render: (p) => `<b>${U.num(p.qtd)}</b> <span class="muted small">${U.esc(p.unid)}</span>`
        },
        {
          label: 'Progresso Recebimento',
          render: (p) => {
            const rec = Rules.qtdRecebida(p);
            const total = Number(p.qtd) || 1;
            const frac = Math.min(1, rec / total);
            const pct = Math.round(frac * 100);
            const tone = frac >= 1 ? 'ok' : frac > 0 ? 'warn' : '';

            return `
              <div style="min-width:130px">
                <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px">
                  <b>${U.num(rec)} ${U.esc(p.unid)}</b>
                  <span class="muted">${pct}%</span>
                </div>
                ${UI.progress(frac, tone)}
              </div>
            `;
          }
        },
        {
          label: 'Previsão Entrega',
          render: (p) => `<div>${U.date(p.previsao)}</div>`
        },
        {
          label: 'Situação do Prazo',
          render: (p) => {
            const reg = Rules.entrega(p);
            let texto = reg.situacao;

            // Enriquecimento do badge com quantidade exata de dias
            if (reg.dias > 0) {
              texto += ` (${reg.dias}d)`;
            } else if (reg.faltam != null && reg.faltam > 0 && reg.aberta) {
              texto += ` (em ${reg.faltam}d)`;
            }

            return UI.badge(texto);
          }
        },
        {
          label: 'Notas Fiscais',
          render: (p) => {
            const recs = p.recebimentos || [];
            if (!recs.length) return '<span class="muted small">Nenhuma NF</span>';

            return `
              <div style="display:flex;flex-direction:column;gap:3px">
                ${recs.map(r => `
                  <span class="chip" style="font-family:monospace;font-size:10.5px" title="Recebido em ${U.date(r.data)} por ${U.esc(r.responsavel)} · ${U.brl(r.valorNF)}">
                    ${U.esc(r.nf)} (${U.num(r.qtd)})
                  </span>
                `).join('')}
              </div>
            `;
          }
        },
        {
          label: 'Transportadora',
          render: (p) => `<div class="cell-sub" style="font-size:12px;color:var(--text-2)">${U.esc(p.transportadora || '—')}</div>`
        },
        {
          label: 'Ações',
          align: 'right',
          render: (p) => {
            const saldo = Math.max(0, (Number(p.qtd) || 0) - Rules.qtdRecebida(p));
            const temRecs = (p.recebimentos || []).length > 0;

            return `
              <div class="row" style="justify-content:flex-end;gap:6px">
                ${saldo > 0 ? `
                  <button type="button" class="btn btn-primary btn-xs" onclick="PedidosModule.abrirRegistrarRecebimento('${p.id}')">
                    ${Icon('truck')} Receber
                  </button>
                ` : ''}
                ${temRecs ? `
                  <button type="button" class="btn btn-ghost btn-xs" onclick="PedidosModule.abrirHistoricoRecebimentos('${p.id}')" title="Ver Histórico de NFs">
                    ${Icon('sheet')} NFs
                  </button>
                ` : ''}
                <button type="button" class="btn btn-ghost btn-xs" onclick="PedidosModule.abrirEspelho('${p.id}')" title="Ver Espelho do Pedido">
                  ${Icon('eye')}
                </button>
              </div>
            `;
          }
        }
      ],
      rows: entregas,
      empty: 'Nenhuma entrega encontrada com os filtros selecionados.'
    });
  },

  // Handlers reativos de filtros e busca de Entregas
  setTabEntregas(tabId) {
    this.state.entregas.tab = tabId;
    App.rerender();
  },

  onBuscaEntregas: U.debounce(function(val) {
    PedidosModule.state.entregas.busca = val;
    const container = document.getElementById('entregasTabelaContainer');
    if (container) {
      container.innerHTML = PedidosModule.renderTabelaEntregasHtml(PedidosModule.getEntregasFiltradas());
    }
  }, 120),

  setFiltroFornecedorEntregas(val) {
    this.state.entregas.fornecedorId = val;
    App.rerender();
  },

  limparFiltrosEntregas() {
    this.state.entregas.busca = '';
    this.state.entregas.fornecedorId = '';
    App.rerender();
  }
};

// Exposição global no window para callbacks de eventos HTML onclick/onchange
window.PedidosModule = PedidosModule;
window.Pedidos = PedidosModule;

/* =====================================================================
   REGISTRO DAS PÁGINAS NO APP SHELL
   ===================================================================== */

// 1. Registro da Página 'pedidos'
App.register({
  id: 'pedidos',
  label: 'Pedidos',
  icon: 'cart',
  section: 'Compras',
  order: 4,
  badge() {
    // Badge com contagem de pedidos em aberto (não recebidos e não cancelados)
    const abertos = (Store.db.pedidos || []).filter(p => p.status !== 'Recebido' && p.status !== 'Cancelado').length;
    return abertos > 0 ? abertos : null;
  },
  render(el, params) {
    PedidosModule.renderPedidos(el, params);
  }
});

// 2. Registro da Página 'entregas'
App.register({
  id: 'entregas',
  label: 'Entregas & NF',
  icon: 'truck',
  section: 'Compras',
  order: 5,
  badge() {
    // Badge com contagem de entregas atrasadas (Rules.entrega(p).atrasada)
    const atrasadas = (Store.db.pedidos || []).filter(p => p.status !== 'Cancelado' && Rules.entrega(p).atrasada).length;
    return atrasadas > 0 ? atrasadas : null;
  },
  render(el, params) {
    PedidosModule.renderEntregas(el, params);
  }
});
