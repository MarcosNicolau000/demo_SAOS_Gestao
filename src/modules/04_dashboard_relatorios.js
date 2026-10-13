'use strict';
/* =====================================================================
   GHC GESTÃO — MÓDULO 04: DASHBOARD EXECUTIVO, RELATÓRIOS & BI E ROADMAP
   ---------------------------------------------------------------------
   Páginas registradas:
   1. 'overview'   — Visão Geral Executiva (4 KPIs Navy/Orange, Ciclo de Compras,
                      Gráficos SVG, Alertas Imediatos, Fornecedores Top)
   2. 'relatorios' — Relatórios Mensais & BI (Tabela Consolidada Jan-Dez,
                      Exportação/Importação Excel .xlsx via SheetJS)
   3. 'financeiro' — Roadmap Fase 2: Integração NF -> Contas a Pagar & Fluxo Caixa
   4. 'operacoes'  — Roadmap Fase 3: Operação de Facilities & Rastreabilidade OS
   5. 'rh'         — Roadmap Fase 4: Gestão da Equipe & Fichas de EPIs (NR-06)
   ===================================================================== */

const ModDashboard = {
  anoSelecionado: 2026,

  // Altera o ano e recarrega a visualização
  setAno(ano) {
    this.anoSelecionado = Number(ano) || 2026;
    App.rerender();
  },

  /* -------------------------------------------------------------------
     AÇÃO RÁPIDA: Reposição de Estoque Crítico
     ------------------------------------------------------------------- */
  comprarItemEstoque(codigo) {
    const item = Store.item(codigo);
    if (!item) {
      UI.toast('Item de estoque não encontrado.', 'error');
      return;
    }
    const analise = Rules.estoque(item);
    const qtdSugerida = analise.sugestao || item.minimo || 1;
    const user = Store.user();

    UI.modal({
      title: 'Solicitação Rápida de Compra (Reposição)',
      sub: `Reposição de item crítico em estoque: ${item.codigo} - ${item.material}`,
      size: 'md',
      submitLabel: 'Gerar Solicitação (SC)',
      body: `
        <div class="form-grid">
          ${UI.field({ name: 'material', label: 'Material', value: item.material, readonly: true, full: true })}
          ${UI.field({ name: 'categoria', label: 'Categoria', value: item.categoria, readonly: true })}
          ${UI.field({ name: 'unid', label: 'Unidade', value: item.unid, readonly: true })}
          ${UI.field({ name: 'qtd', label: 'Quantidade Sugerida', type: 'number', value: qtdSugerida, min: 1, required: true })}
          ${UI.field({ name: 'prioridade', label: 'Prioridade', type: 'select', value: analise.critico ? 'Urgente' : 'Alta', options: Rules.PRIORIDADES, required: true })}
          ${UI.field({ name: 'cliente', label: 'Destino / Almoxarifado', value: 'Almoxarifado Central (GHC)', full: true })}
          ${UI.field({ name: 'obs', label: 'Justificativa Operacional', type: 'textarea', value: `Reposição automática: Saldo atual (${item.atual} ${item.unid}) atingiu o ponto de pedido (${analise.pontoPedido} ${item.unid}).`, full: true })}
        </div>
      `,
      onSubmit: (values) => {
        const novaSc = {
          id: Store.nextId('SC-', Store.db.solicitacoes),
          data: U.today(),
          solicitante: user.nome,
          area: 'Almoxarifado / Suprimentos',
          cliente: values.cliente || 'GHC Facilities Central',
          centroCusto: 'ALMOX-CENTRAL',
          localEntrega: 'Barueri/SP',
          categoria: item.categoria,
          descricao: item.material,
          especificacao: `Item cadastrado ${item.codigo}. Reposição de estoque.`,
          qtd: U.parseNum(values.qtd),
          unid: item.unid,
          prioridade: values.prioridade,
          status: 'Aberta',
          dataNecessidade: U.addDays(U.today(), analise.prazo || 3),
          obs: values.obs,
          itemCodigo: item.codigo,
        };

        Store.db.solicitacoes.unshift(novaSc);
        Store.commit(`Solicitação ${novaSc.id} criada com sucesso para reposição de ${item.material}.`, 'success');
      }
    });
  },

  /* -------------------------------------------------------------------
     AÇÃO RÁPIDA: Aprovação Direta de Cotação Pendente
     ------------------------------------------------------------------- */
  aprovarCotacao(cotId) {
    const cot = Store.cot(cotId);
    if (!cot) {
      UI.toast('Cotação não encontrada.', 'error');
      return;
    }
    const sc = Store.sc(cot.scId);
    const analise = Rules.cotacao(cot);
    const user = Store.user();

    if (!Rules.podeAprovar(user, cot)) {
      const alcada = Rules.alcada(analise.escolhido);
      UI.toast(`Usuário ${user.nome} (${user.perfil}) não possui alçada para aprovar ${U.brl(analise.escolhido)}. Exigido: Nível ${alcada?.nivel} (${alcada?.nome}).`, 'warning');
      return;
    }

    UI.confirm(
      `Confirma a aprovação da Cotação <b>${cot.id}</b> no valor de <b>${U.brl(analise.escolhido)}</b> e a emissão automática do Pedido de Compra?`,
      () => {
        cot.status = 'Aprovada';
        cot.historico = cot.historico || [];
        cot.historico.push({
          data: U.today(),
          usuario: user.nome,
          acao: 'Aprovada pelo Dashboard',
          obs: `Aprovado pelo perfil ${user.perfil} (alçada nível ${user.nivel}).`
        });

        // Atualiza status da solicitação
        if (sc) {
          sc.status = 'Comprada';
        }

        // Gera automaticamente o Pedido de Compra (PC)
        const ofertaEscolhida = cot.ofertas[analise.escolhidaIdx];
        const forn = Store.fornecedor(ofertaEscolhida.fornecedorId);
        const novoPc = {
          id: Store.nextId('PC-', Store.db.pedidos),
          scId: cot.scId,
          cotId: cot.id,
          data: U.today(),
          compradora: cot.compradora || user.nome,
          fornecedorId: ofertaEscolhida.fornecedorId,
          cliente: sc ? sc.cliente : 'GHC Facilities',
          centroCusto: sc ? sc.centroCusto : 'GERAL',
          descricao: sc ? sc.descricao : 'Compra de materiais',
          qtd: sc ? sc.qtd : 1,
          unid: sc ? sc.unid : 'un',
          valorUnit: ofertaEscolhida.valor,
          valorProdutos: (Number(ofertaEscolhida.valor) || 0) * (Number(sc?.qtd) || 1),
          frete: Number(ofertaEscolhida.frete) || 0,
          status: 'Pedido emitido',
          previsao: U.addDays(U.today(), ofertaEscolhida.prazo || 3),
          pagamento: ofertaEscolhida.pagamento || forn?.pagamento || 'Boleto 28 dias',
          localEntrega: sc ? sc.localEntrega : 'São Paulo/SP',
          responsavelRecebimento: sc ? sc.solicitante : 'Almoxarifado',
          transportadora: 'A definir pelo fornecedor',
          obs: `Pedido gerado automaticamente após aprovação da cotação ${cot.id}.`,
          recebimentos: []
        };

        Store.db.pedidos.unshift(novoPc);
        Store.commit(`Cotação ${cot.id} aprovada! Pedido de Compra ${novoPc.id} emitido com sucesso.`, 'success');
      },
      { title: 'Aprovar Cotação & Emitir Pedido', yesLabel: 'Aprovar e Emitir PC' }
    );
  },

  /* -------------------------------------------------------------------
     EXPORTAÇÃO EXCEL: Relatório Mensal Consolidado (.xlsx)
     ------------------------------------------------------------------- */
  exportRelatorioMensal(ano) {
    if (typeof XLSX === 'undefined') {
      UI.toast('Biblioteca SheetJS (XLSX) indisponível no momento.', 'error');
      return;
    }

    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const dados = this.calcularMetricasAno(ano);

    const headers = [
      'Mês',
      'Nº Solicitações',
      'Nº Pedidos',
      'Valor Comprado (R$)',
      'Menor Cotação Base (R$)',
      'Economia Negociada (R$)',
      'Economia %',
      'Compras Urgentes',
      'Entregas Atrasadas',
      'Fornecedores Utilizados'
    ];

    const rows = [headers];

    let totSc = 0, totPc = 0, totComprado = 0, totMenor = 0, totEco = 0, totUrg = 0, totAtrasadas = 0;

    dados.forEach(d => {
      rows.push([
        d.mes,
        d.scs,
        d.pcs,
        d.valComprado,
        d.menorBase,
        d.economia,
        Number((d.pct * 100).toFixed(1)),
        d.urgentes,
        d.atrasadas,
        d.forns
      ]);
      totSc += d.scs;
      totPc += d.pcs;
      totComprado += d.valComprado;
      totMenor += d.menorBase;
      totEco += d.economia;
      totUrg += d.urgentes;
      totAtrasadas += d.atrasadas;
    });

    const totPct = (totComprado + totEco) > 0 ? (totEco / (totComprado + totEco)) * 100 : 0;
    const fornsAno = new Set(
      Store.db.pedidos
        .filter(p => p.data && p.data.startsWith(String(ano)) && p.status !== 'Cancelado')
        .map(p => p.fornecedorId)
        .filter(Boolean)
    ).size;

    rows.push([
      'TOTAL / MÉDIA',
      totSc,
      totPc,
      totComprado,
      totMenor,
      totEco,
      Number(totPct.toFixed(1)),
      totUrg,
      totAtrasadas,
      fornsAno
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Largura das colunas para visual limpo
    ws['!cols'] = [
      { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
      { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 18 },
      { wch: 18 }, { wch: 22 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, `Relatório Mensal ${ano}`);
    XLSX.writeFile(wb, `Relatorio_Mensal_GHC_${ano}.xlsx`);
    UI.toast(`Relatório mensal de ${ano} exportado com sucesso!`, 'success');
  },

  /* -------------------------------------------------------------------
     EXPORTAÇÃO EXCEL: Base Completa do ERP com 8 Abas (.xlsx)
     ------------------------------------------------------------------- */
  exportBaseCompleta(ano) {
    if (typeof XLSX === 'undefined') {
      UI.toast('Biblioteca SheetJS (XLSX) indisponível no momento.', 'error');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Aba Solicitações
    const headSc = [
      'ID Solicitação', 'Data', 'Solicitante', 'Área', 'Cliente/Projeto',
      'Centro de Custo', 'Local de Entrega', 'Categoria', 'Descrição do Material/Serviço',
      'Especificação Técnica', 'Qtd.', 'Unid.', 'Prioridade', 'Status',
      'Data Necessidade', 'Observações'
    ];
    const rowsSc = [headSc];
    Store.db.solicitacoes.forEach(s => {
      rowsSc.push([
        s.id, s.data, s.solicitante, s.area, s.cliente,
        s.centroCusto, s.localEntrega, s.categoria, s.descricao,
        s.especificacao || '', s.qtd, s.unid, s.prioridade, s.status,
        s.dataNecessidade || '', s.obs || ''
      ]);
    });
    const wsSc = XLSX.utils.aoa_to_sheet(rowsSc);
    XLSX.utils.book_append_sheet(wb, wsSc, 'Solicitações');

    // 2. Aba Mapa Cotação
    const headCot = [
      'ID Cotação', 'ID Solicitação', 'Data', 'Compradora', 'Categoria', 'Item', 'Qtd.', 'Unid.',
      'Fornecedor 1', 'Valor 1', 'Frete 1', 'Prazo 1', 'Pagamento 1',
      'Fornecedor 2', 'Valor 2', 'Frete 2', 'Prazo 2', 'Pagamento 2',
      'Fornecedor 3', 'Valor 3', 'Frete 3', 'Prazo 3', 'Pagamento 3',
      'Melhor Fornecedor', 'Valor Escolhido', 'Frete Escolhido', 'Total Compra',
      'Menor Cotação', 'Economia', 'Economia %', 'Justificativa', 'Aprovado Por', 'Data Aprovação'
    ];
    const rowsCot = [headCot];
    Store.db.cotacoes.forEach(c => {
      const sc = Store.sc(c.scId);
      const analise = Rules.cotacao(c);
      const o1 = c.ofertas?.[0] || {};
      const o2 = c.ofertas?.[1] || {};
      const o3 = c.ofertas?.[2] || {};
      const fornEscolhida = c.ofertas?.[analise.escolhidaIdx];
      const aprovador = c.historico?.find(h => h.acao.includes('Aprovad'));

      rowsCot.push([
        c.id, c.scId, c.data, c.compradora || '', sc?.categoria || '', sc?.descricao || '', sc?.qtd || 1, sc?.unid || 'un',
        Store.fornecedorNome(o1.fornecedorId), o1.valor || '', o1.frete || '', o1.prazo || '', o1.pagamento || '',
        Store.fornecedorNome(o2.fornecedorId), o2.valor || '', o2.frete || '', o2.prazo || '', o2.pagamento || '',
        Store.fornecedorNome(o3.fornecedorId), o3.valor || '', o3.frete || '', o3.prazo || '', o3.pagamento || '',
        Store.fornecedorNome(fornEscolhida?.fornecedorId), fornEscolhida?.valor || 0, fornEscolhida?.frete || 0,
        analise.escolhido, analise.menor, analise.economia, Number((analise.economiaPct * 100).toFixed(1)),
        c.justificativa || '', aprovador ? aprovador.usuario : '', aprovador ? aprovador.data : ''
      ]);
    });
    const wsCot = XLSX.utils.aoa_to_sheet(rowsCot);
    XLSX.utils.book_append_sheet(wb, wsCot, 'Mapa Cotação');

    // 3. Aba Pedidos
    const headPed = [
      'Nº Pedido', 'ID Solicitação', 'ID Cotação', 'Data Pedido', 'Compradora',
      'Fornecedor', 'CNPJ', 'Cliente/Projeto', 'Centro de Custo', 'Valor Produtos',
      'Frete', 'Status', 'Previsão Entrega', 'Condição Pagamento', 'Local Entrega',
      'Responsável Recebimento', 'NF', 'Data NF', 'Data Recebimento', 'Valor NF', 'Observações'
    ];
    const rowsPed = [headPed];
    Store.db.pedidos.forEach(p => {
      const forn = Store.fornecedor(p.fornecedorId);
      const rec = p.recebimentos?.[0] || {};
      rowsPed.push([
        p.id, p.scId, p.cotId || '', p.data, p.compradora || '',
        forn?.fantasia || forn?.razao || '', forn?.cnpj || '', p.cliente || '', p.centroCusto || '',
        p.valorProdutos || 0, p.frete || 0, p.status, p.previsao || '', p.pagamento || '',
        p.localEntrega || '', p.responsavelRecebimento || '', rec.nf || '', rec.data || '',
        rec.data || '', rec.valorNF || '', p.obs || ''
      ]);
    });
    const wsPed = XLSX.utils.aoa_to_sheet(rowsPed);
    XLSX.utils.book_append_sheet(wb, wsPed, 'Pedidos');

    // 4. Aba Fornecedores
    const headForn = [
      'Código', 'Razão Social', 'Nome Fantasia', 'CNPJ', 'Categoria', 'Contato',
      'Telefone', 'E-mail', 'Cidade/UF', 'Status', 'Prazo Médio (dias)',
      'Condição Pagamento', 'Última Cotação', 'Avaliação Preço', 'Avaliação Prazo',
      'Avaliação Qualidade', 'Avaliação Atendimento', 'Observações'
    ];
    const rowsForn = [headForn];
    Store.db.fornecedores.forEach(f => {
      const nota = Rules.notaFornecedor(f.id);
      rowsForn.push([
        f.id, f.razao, f.fantasia, f.cnpj, f.categoria, f.contato || '',
        f.telefone || '', f.email || '', f.cidade || '', f.status, f.prazoMedio || 0,
        f.pagamento || '', '',
        nota.criterios ? Number(nota.criterios.preco.toFixed(1)) : '',
        nota.criterios ? Number(nota.criterios.prazo.toFixed(1)) : '',
        nota.criterios ? Number(nota.criterios.qualidade.toFixed(1)) : '',
        nota.criterios ? Number(nota.criterios.atendimento.toFixed(1)) : '',
        f.obs || ''
      ]);
    });
    const wsForn = XLSX.utils.aoa_to_sheet(rowsForn);
    XLSX.utils.book_append_sheet(wb, wsForn, 'Fornecedores');

    // 5. Aba Entregas
    const headEnt = [
      'Nº Pedido', 'Fornecedor', 'Cliente/Projeto', 'Item', 'Qtd. Pedida',
      'Qtd. Recebida', 'Data Pedido', 'Data Prevista', 'Data Entrega',
      'Status', 'Situação Prazo', 'Dias Atraso', 'NF', 'Transportadora', 'Observações'
    ];
    const rowsEnt = [headEnt];
    Store.db.pedidos.forEach(p => {
      const forn = Store.fornecedor(p.fornecedorId);
      const ent = Rules.entrega(p);
      const recQtd = Rules.qtdRecebida(p);
      const rec = p.recebimentos?.[0] || {};
      rowsEnt.push([
        p.id, forn?.fantasia || forn?.razao || '', p.cliente || '', p.descricao || '',
        p.qtd || 0, recQtd, p.data, p.previsao || '', ent.dataEntrega || '',
        p.status, ent.situacao, ent.dias || 0, rec.nf || '', p.transportadora || '', p.obs || ''
      ]);
    });
    const wsEnt = XLSX.utils.aoa_to_sheet(rowsEnt);
    XLSX.utils.book_append_sheet(wb, wsEnt, 'Entregas');

    // 6. Aba Estoque
    const headEst = [
      'Código', 'Material', 'Categoria', 'Unidade', 'Estoque Atual', 'Estoque Mínimo',
      'Estoque Máximo', 'Consumo Médio Mensal', 'Ponto de Pedido', 'Necessidade Compra',
      'Fornecedor Principal', 'Último Preço', 'Valor Estoque', 'Local', 'Observações'
    ];
    const rowsEst = [headEst];
    Store.db.estoque.forEach(i => {
      const forn = Store.fornecedor(i.fornecedorId);
      const st = Rules.estoque(i);
      rowsEst.push([
        i.codigo, i.material, i.categoria, i.unid, i.atual, i.minimo,
        i.maximo, i.consumoMensal, st.pontoPedido, st.comprar ? 'SIM' : 'NÃO',
        forn?.fantasia || forn?.razao || '', i.ultimoPreco || 0, st.valor, i.local || '', i.obs || ''
      ]);
    });
    const wsEst = XLSX.utils.aoa_to_sheet(rowsEst);
    XLSX.utils.book_append_sheet(wb, wsEst, 'Estoque');

    // 7. Aba Avaliação Fornecedores
    const headAv = [
      'Data', 'Fornecedor', 'Pedido', 'Preço (0-10)', 'Prazo (0-10)',
      'Qualidade (0-10)', 'Atendimento (0-10)', 'Documentação (0-10)', 'Nota Final',
      'Responsável', 'Comentários'
    ];
    const rowsAv = [headAv];
    Store.db.avaliacoes.forEach(a => {
      const forn = Store.fornecedor(a.fornecedorId);
      const notaFinal = Rules.notaAvaliacao(a);
      rowsAv.push([
        a.data, forn?.fantasia || forn?.razao || '', a.pedidoId || '',
        a.preco, a.prazo, a.qualidade, a.atendimento, a.documentacao,
        Number(notaFinal.toFixed(1)), a.responsavel || '', a.comentarios || ''
      ]);
    });
    const wsAv = XLSX.utils.aoa_to_sheet(rowsAv);
    XLSX.utils.book_append_sheet(wb, wsAv, 'Avaliação Fornecedores');

    // 8. Aba Relatório Mensal
    const dadosMes = this.calcularMetricasAno(ano);
    const headRel = [
      'Mês', 'Nº Solicitações', 'Nº Pedidos', 'Valor Comprado', 'Menor Cotação Base',
      'Economia Negociada', 'Economia %', 'Compras Emergenciais', 'Entregas Atrasadas', 'Fornecedores Utilizados'
    ];
    const rowsRel = [headRel];
    dadosMes.forEach(d => {
      rowsRel.push([
        d.mes, d.scs, d.pcs, d.valComprado, d.menorBase, d.economia,
        Number((d.pct * 100).toFixed(1)), d.urgentes, d.atrasadas, d.forns
      ]);
    });
    const wsRel = XLSX.utils.aoa_to_sheet(rowsRel);
    XLSX.utils.book_append_sheet(wb, wsRel, 'Relatório Mensal');

    XLSX.writeFile(wb, 'Base_Completa_GHC_Gestao.xlsx');
    UI.toast('Base Completa do ERP (.xlsx com 8 abas) exportada com sucesso!', 'success');
  },

  /* -------------------------------------------------------------------
     IMPORTAÇÃO EXCEL: Ler Planilha GHC Compras (.xlsx)
     ------------------------------------------------------------------- */
  importPlanilha(inputEl) {
    if (!inputEl || !inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];

    if (typeof XLSX === 'undefined') {
      UI.toast('Biblioteca SheetJS (XLSX) indisponível para leitura.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        let countSc = 0, countForn = 0, countPed = 0, countEst = 0;

        wb.SheetNames.forEach(sheetName => {
          const sNorm = U.norm(sheetName);
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

          if (!rows || !rows.length) return;

          // Importa Solicitações
          if (sNorm.includes('solicita')) {
            const importadas = [];
            rows.forEach((r, idx) => {
              const id = r['ID Solicitação'] || r['ID'] || `SC-IMP-${idx + 1}`;
              const desc = r['Descrição do Material/Serviço'] || r['Descrição'] || r['Descricao'] || r['Material'];
              if (!desc && !r['Solicitante']) return;

              importadas.push({
                id: String(id),
                data: r['Data'] ? String(r['Data']).slice(0, 10) : U.today(),
                solicitante: String(r['Solicitante'] || 'Operacional'),
                area: String(r['Área'] || r['Area'] || 'Manutenção'),
                cliente: String(r['Cliente/Projeto'] || r['Cliente'] || 'GHC Facilities'),
                centroCusto: String(r['Centro de Custo'] || r['CC'] || 'GERAL'),
                localEntrega: String(r['Local de Entrega'] || r['Local'] || 'São Paulo/SP'),
                categoria: String(r['Categoria'] || 'Spot'),
                descricao: String(desc || 'Item de compra'),
                especificacao: String(r['Especificação Técnica'] || r['Especificação'] || ''),
                qtd: U.parseNum(r['Qtd.'] || r['Qtd'] || 1),
                unid: String(r['Unid.'] || r['Unidade'] || 'un'),
                prioridade: String(r['Prioridade'] || 'Normal'),
                status: String(r['Status'] || 'Aberta'),
                dataNecessidade: r['Data Necessidade'] ? String(r['Data Necessidade']).slice(0, 10) : U.addDays(U.today(), 4),
                obs: String(r['Observações'] || r['Obs'] || '')
              });
            });

            if (importadas.length) {
              Store.db.solicitacoes = importadas;
              countSc = importadas.length;
            }
          }

          // Importa Fornecedores
          else if (sNorm.includes('fornecedor') && !sNorm.includes('avalia')) {
            const importados = [];
            rows.forEach((r, idx) => {
              const cod = r['Código'] || r['Codigo'] || `G${String(idx + 1).padStart(2, '0')}`;
              const razao = r['Razão Social'] || r['Razao Social'] || r['Nome Fantasia'] || r['Fornecedor'];
              if (!razao) return;

              importados.push({
                id: String(cod),
                razao: String(razao),
                fantasia: String(r['Nome Fantasia'] || razao),
                cnpj: String(r['CNPJ'] || ''),
                categoria: String(r['Categoria'] || 'Geral'),
                contato: String(r['Contato'] || ''),
                telefone: String(r['Telefone'] || ''),
                email: String(r['E-mail'] || r['Email'] || ''),
                cidade: String(r['Cidade/UF'] || r['Cidade'] || 'São Paulo/SP'),
                status: String(r['Status'] || 'Ativo'),
                prazoMedio: U.parseNum(r['Prazo Médio (dias)'] || 5),
                pagamento: String(r['Condição Pagamento'] || 'Boleto 28 dias'),
                obs: String(r['Observações'] || '')
              });
            });

            if (importados.length) {
              Store.db.fornecedores = importados;
              countForn = importados.length;
            }
          }

          // Importa Pedidos
          else if (sNorm.includes('pedido')) {
            const importados = [];
            rows.forEach((r, idx) => {
              const id = r['Nº Pedido'] || r['No Pedido'] || `PC-IMP-${idx + 1}`;
              if (!r['Fornecedor'] && !r['Valor Produtos']) return;

              importados.push({
                id: String(id),
                scId: String(r['ID Solicitação'] || ''),
                cotId: String(r['ID Cotação'] || ''),
                data: r['Data Pedido'] ? String(r['Data Pedido']).slice(0, 10) : U.today(),
                compradora: String(r['Compradora'] || 'Juliana Silva'),
                fornecedorId: String(r['Fornecedor'] || ''),
                cliente: String(r['Cliente/Projeto'] || 'GHC Facilities'),
                centroCusto: String(r['Centro de Custo'] || 'GERAL'),
                descricao: String(r['Item'] || r['Descrição'] || 'Pedido de compra'),
                qtd: U.parseNum(r['Qtd. Pedida'] || r['Qtd'] || 1),
                unid: 'un',
                valorUnit: U.parseNum(r['Valor Unitário'] || r['Valor Produtos'] || 0),
                valorProdutos: U.parseNum(r['Valor Produtos'] || 0),
                frete: U.parseNum(r['Frete'] || 0),
                status: String(r['Status'] || 'Pedido emitido'),
                previsao: r['Previsão Entrega'] ? String(r['Previsão Entrega']).slice(0, 10) : U.addDays(U.today(), 3),
                pagamento: String(r['Condição Pagamento'] || 'Boleto 28 dias'),
                localEntrega: String(r['Local Entrega'] || 'Central GHC'),
                responsavelRecebimento: String(r['Responsável Recebimento'] || 'Almoxarifado'),
                transportadora: String(r['Transportadora'] || ''),
                obs: String(r['Observações'] || ''),
                recebimentos: []
              });
            });

            if (importados.length) {
              Store.db.pedidos = importados;
              countPed = importados.length;
            }
          }

          // Importa Estoque
          else if (sNorm.includes('estoque')) {
            const importados = [];
            rows.forEach((r, idx) => {
              const cod = r['Código'] || r['Codigo'] || `MAT-IMP-${idx + 1}`;
              const mat = r['Material'];
              if (!mat) return;

              importados.push({
                codigo: String(cod),
                material: String(mat),
                categoria: String(r['Categoria'] || 'Geral'),
                unid: String(r['Unidade'] || 'un'),
                atual: U.parseNum(r['Estoque Atual'] || 0),
                minimo: U.parseNum(r['Estoque Mínimo'] || 0),
                maximo: U.parseNum(r['Estoque Máximo'] || 0),
                consumoMensal: U.parseNum(r['Consumo Médio Mensal'] || 0),
                fornecedorId: String(r['Fornecedor Principal'] || ''),
                ultimoPreco: U.parseNum(r['Último Preço'] || 0),
                local: String(r['Local'] || 'Depósito'),
                obs: String(r['Observações'] || '')
              });
            });

            if (importados.length) {
              Store.db.estoque = importados;
              countEst = importados.length;
            }
          }
        });

        inputEl.value = ''; // Limpa input
        Store.commit(`Planilha importada com sucesso: ${countSc} solicitações, ${countForn} fornecedores, ${countPed} pedidos e ${countEst} itens de estoque carregados!`, 'success');
      } catch (err) {
        console.error(err);
        UI.toast('Falha ao processar o arquivo Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  /* -------------------------------------------------------------------
     CÁLCULO CONSOLIDADO DAS MÉTRICAS MENSAIS
     ------------------------------------------------------------------- */
  calcularMetricasAno(ano) {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const anoStr = String(ano);

    return meses.map((mes, idx) => {
      const mesNum = idx + 1;
      const prefix = `${anoStr}-${String(mesNum).padStart(2, '0')}`;

      const scs = Store.db.solicitacoes.filter(s => s.data && s.data.startsWith(prefix));
      const pcs = Store.db.pedidos.filter(p => p.data && p.data.startsWith(prefix) && p.status !== 'Cancelado');
      const cots = Store.db.cotacoes.filter(c => c.data && c.data.startsWith(prefix));

      const valComprado = U.sum(pcs, p => Rules.pedidoTotal(p));
      const menorBase = U.sum(cots, c => Rules.cotacao(c).menor);
      const economia = U.sum(cots, c => Rules.cotacao(c).economia);
      const pct = (valComprado + economia) > 0 ? (economia / (valComprado + economia)) : 0;
      const urgentes = scs.filter(s => s.prioridade === 'Urgente').length;

      // Entregas com previsão no mês que estão ou foram entregues em atraso
      const atrasadas = pcs.filter(p => {
        const ent = Rules.entrega(p);
        return ent.atrasada;
      }).length;

      const forns = new Set(pcs.map(p => p.fornecedorId).filter(Boolean)).size;

      return {
        mes,
        mesNum,
        scs: scs.length,
        pcs: pcs.length,
        valComprado,
        menorBase,
        economia,
        pct,
        urgentes,
        atrasadas,
        forns
      };
    });
  }
};

window.ModDashboard = ModDashboard;

/* =====================================================================
   1. PÁGINA: VISÃO GERAL (OVERVIEW)
   ===================================================================== */
App.register({
  id: 'overview',
  label: 'Visão Geral',
  icon: 'dashboard',
  section: 'Visão geral',
  order: 1,
  badge: () => {
    // Alerta no menu com soma de pendências urgentes
    const criticos = Store.db.estoque.filter(i => Rules.estoque(i).critico).length;
    const atrasadas = Store.db.pedidos.filter(p => Rules.entrega(p).atrasada).length;
    const total = criticos + atrasadas;
    return total > 0 ? total : null;
  },
  render(el) {
    const db = Store.db;
    const user = Store.user();

    // 1. Cálculos dos 4 KPIs Executivos Estratégicos
    const scsAbertas = db.solicitacoes.filter(s => s.status === 'Aberta' || s.status === 'Em cotação' || s.status === 'Aguardando aprovação').length;

    let totalEconomia = 0;
    let totalBaseMaior = 0;
    db.cotacoes.forEach(c => {
      const an = Rules.cotacao(c);
      totalEconomia += an.economia;
      totalBaseMaior += an.maior;
    });
    const pctEconomia = totalBaseMaior > 0 ? (totalEconomia / totalBaseMaior) : 0;

    const pedidosAtivos = db.pedidos.filter(p => p.status !== 'Cancelado');
    const valorCompradoTotal = U.sum(pedidosAtivos, p => Rules.pedidoTotal(p));

    const entregasAtrasadasList = db.pedidos.filter(p => Rules.entrega(p).atrasada);
    const estoqueComprarList = db.estoque.filter(i => Rules.estoque(i).comprar);
    const pontosAtencao = entregasAtrasadasList.length + estoqueComprarList.length;

    // 2. Números vivos do Ciclo Operacional de Compras GHC
    const etapaSolicitacoes = db.solicitacoes.filter(s => s.status === 'Aberta' || s.status === 'Em cotação').length;
    const etapaCotacoes = db.cotacoes.filter(c => c.status === 'Em cotação').length;
    const etapaAprovacoes = db.cotacoes.filter(c => c.status === 'Aguardando aprovação').length;
    const etapaRecebimento = db.pedidos.filter(p => p.status === 'Pedido emitido' || p.status === 'Recebido parcial').length;

    // 3. Dados do Gráfico de Compras e Economia (Últimos meses)
    const metricas = ModDashboard.calcularMetricasAno(2026);
    // Filtra meses que possuem movimentação ou últimos 6 meses
    const mesesGrafico = metricas.slice(6, 12).map(m => ({
      label: m.mes,
      value: m.valComprado,
      value2: m.economia
    }));

    // 4. Solicitações Recentes (Top 5)
    const solicitacoesRecentes = [...db.solicitacoes].slice(0, 5);

    // 5. Itens Críticos de Estoque
    const itensCriticos = db.estoque
      .filter(i => Rules.estoque(i).comprar)
      .slice(0, 4);

    // 6. Cotações aguardando aprovação
    const cotacoesPendentes = db.cotacoes
      .filter(c => c.status === 'Aguardando aprovação')
      .slice(0, 3);

    // 7. Top 3 Fornecedores Mais Bem Avaliados
    const fornecedoresRanqueados = db.fornecedores
      .map(f => ({ forn: f, notaInfo: Rules.notaFornecedor(f.id) }))
      .filter(x => x.notaInfo.nota != null)
      .sort((a, b) => b.notaInfo.nota - a.notaInfo.nota)
      .slice(0, 3);

    // RENDERIZAÇÃO DO HTML
    el.innerHTML = `
      ${UI.pageHead({
        eyebrow: 'PAINEL EXECUTIVO CORPORATIVO',
        title: 'Visão Geral de Compras & Suprimentos',
        sub: `Monitoramento em tempo real do ciclo de compras da GHC Facilities · Usuário: <b>${U.esc(user.nome)}</b> (${user.perfil})`,
        actions: `
          ${UI.btn('Nova Solicitação', { icon: 'plus', variant: 'primary', onclick: "App.go('solicitacoes')" })}
          ${UI.btn('Relatórios & BI', { icon: 'chart', variant: 'dark', onclick: "App.go('relatorios')" })}
        `
      })}

      <!-- 4 KPIS EXECUTIVOS ESTRATÉGICOS (DARK CARD NAVY COM LARANJA) -->
      <div class="kpis">
        <div class="kpi kpi-dark clickable" onclick="App.go('solicitacoes')" title="Clique para filtrar solicitações" style="cursor:pointer">
          <div class="kpi-top">
            <span class="kpi-label">Solicitações Abertas</span>
            <span class="kpi-icon">${Icon('filePlus')}</span>
          </div>
          <div class="kpi-value"><span class="hl">${scsAbertas}</span> <span style="font-size:18px;font-weight:500;color:#94A3B8">demandas</span></div>
          <div class="kpi-note" style="color:#CBD5E1">
            <span style="color:var(--orange);font-weight:600">Ver solicitações pendentes &rarr;</span>
          </div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Economia Negociada Total</span>
            <span class="kpi-icon">${Icon('trendUp')}</span>
          </div>
          <div class="kpi-value"><span class="hl">${U.brlShort(totalEconomia)}</span></div>
          <div class="kpi-note" style="color:#CBD5E1">
            <b style="color:var(--success)">${U.pct(pctEconomia)}</b> de economia média vs maior proposta
          </div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Valor Comprado Total</span>
            <span class="kpi-icon">${Icon('cart')}</span>
          </div>
          <div class="kpi-value">${U.brlShort(valorCompradoTotal)}</div>
          <div class="kpi-note" style="color:#94A3B8">
            <b>${pedidosAtivos.length}</b> pedidos válidos / ativos emitidos
          </div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Pontos de Atenção</span>
            <span class="kpi-icon" style="background:var(--error-tint);color:var(--error)">${Icon('alert')}</span>
          </div>
          <div class="kpi-value" style="color:${pontosAtencao > 0 ? 'var(--error)' : '#fff'}">${pontosAtencao}</div>
          <div class="kpi-note" style="color:#CBD5E1">
            ${entregasAtrasadasList.length} entregas em atraso · ${estoqueComprarList.length} itens a repor
          </div>
        </div>
      </div>

      <!-- PAINEL: CICLO OPERACIONAL DE COMPRAS GHC (4 ETAPAS INTEGRADAS) -->
      <div class="card flush mb-16" style="border-top:3px solid var(--orange)">
        <div class="card-head" style="padding:16px 20px 10px">
          <div>
            <div class="eyebrow">ESTRUTURA OPERACIONAL INTEGRADA</div>
            <h2 style="font-size:16px;margin-top:2px">Ciclo de Vida das Compras GHC (Ponta a Ponta)</h2>
          </div>
          <span class="chip" style="gap:6px"><span class="pulse"></span> Monitoramento Ativo</span>
        </div>
        <div style="padding:0 20px 18px">
          <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:14px">
            
            <!-- Etapa 1 -->
            <div class="card clickable" onclick="App.go('solicitacoes')" style="padding:14px;background:#FBFCFE;border:1px solid var(--border)">
              <div class="row between" style="margin-bottom:8px">
                <span class="badge badge-info" style="font-size:10px">01 · SOLICITAÇÃO</span>
                <span style="font-weight:700;font-size:16px;color:var(--text)">${etapaSolicitacoes}</span>
              </div>
              <div style="font-weight:600;font-size:13px;color:var(--text)">Requisições das Unidades</div>
              <div class="small muted" style="margin-top:2px">Demandas de contratos e almoxarifado</div>
            </div>

            <!-- Etapa 2 -->
            <div class="card clickable" onclick="App.go('cotacoes')" style="padding:14px;background:#FBFCFE;border:1px solid var(--border)">
              <div class="row between" style="margin-bottom:8px">
                <span class="badge badge-warning" style="font-size:10px">02 · COTAÇÃO</span>
                <span style="font-weight:700;font-size:16px;color:var(--text)">${etapaCotacoes}</span>
              </div>
              <div style="font-weight:600;font-size:13px;color:var(--text)">Mapa de Preços</div>
              <div class="small muted" style="margin-top:2px">Equalização de propostas e fretes</div>
            </div>

            <!-- Etapa 3 -->
            <div class="card clickable" onclick="App.go('cotacoes')" style="padding:14px;background:#FBFCFE;border:1px solid var(--border)">
              <div class="row between" style="margin-bottom:8px">
                <span class="badge badge-orange" style="font-size:10px">03 · APROVAÇÃO</span>
                <span style="font-weight:700;font-size:16px;color:var(--text)">${etapaAprovacoes}</span>
              </div>
              <div style="font-weight:600;font-size:13px;color:var(--text)">Alçadas de Decisão</div>
              <div class="small muted" style="margin-top:2px">Supervisão, Gerência e Diretoria</div>
            </div>

            <!-- Etapa 4 -->
            <div class="card clickable" onclick="App.go('pedidos')" style="padding:14px;background:#FBFCFE;border:1px solid var(--border)">
              <div class="row between" style="margin-bottom:8px">
                <span class="badge badge-success" style="font-size:10px">04 · RECEBIMENTO</span>
                <span style="font-weight:700;font-size:16px;color:var(--text)">${etapaRecebimento}</span>
              </div>
              <div style="font-weight:600;font-size:13px;color:var(--text)">Entrega & Almoxarifado</div>
              <div class="small muted" style="margin-top:2px">Conferência física, NF e entrada</div>
            </div>

          </div>
        </div>
      </div>

      <!-- GRID PRINCIPAL (2 COLUNAS) -->
      <div class="grid grid-main">
        
        <!-- COLUNA 1 (ESQUERDA): GRÁFICO E SOLICITAÇÕES RECENTES -->
        <div class="stack">
          
          <!-- Card Gráfico de Compras vs Economia -->
          <div class="card">
            <div class="card-head">
              <div>
                <h2 class="card-title">Volume Comprado vs. Economia Negociada (R$)</h2>
                <div class="hint">Acompanhamento mês a mês das economias geradas nas cotações comparativas</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="App.go('relatorios')">Ver Relatório Completo &rarr;</button>
            </div>
            <div style="padding-top:8px">
              ${UI.barChart(mesesGrafico, {
                height: 230,
                fmt: U.brlShort,
                color: 'var(--orange)',
                color2: 'var(--navy)',
                legend: ['Valor Comprado (R$)', 'Economia Negociada (R$)']
              })}
            </div>
          </div>

          <!-- Card Tabela Solicitações Recentes -->
          <div class="card flush">
            <div class="card-head" style="padding:18px 20px 12px">
              <div>
                <h2 class="card-title">Solicitações de Compras Recentes</h2>
                <div class="hint">Últimas requisições abertas pelas equipes operacionais em campo</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="App.go('solicitacoes')">Ver Todas (${db.solicitacoes.length}) &rarr;</button>
            </div>
            ${UI.table({
              columns: [
                { label: 'ID', render: r => `<span class="badge badge-neutral">${U.esc(r.id)}</span>` },
                { label: 'Data', render: r => `<span class="small">${U.date(r.data)}</span>` },
                { label: 'Solicitante / Cliente', render: r => `
                  <div class="cell-main">${U.esc(r.solicitante)}</div>
                  <div class="cell-sub">${U.esc(r.cliente)} · ${U.esc(r.centroCusto)}</div>
                ` },
                { label: 'Material / Descrição', render: r => `
                  <div class="cell-main">${U.esc(r.descricao)}</div>
                  <div class="cell-sub">${r.qtd} ${U.esc(r.unid)} · ${U.esc(r.categoria)}</div>
                ` },
                { label: 'Prioridade', render: r => UI.badge(r.prioridade) },
                { label: 'Status', render: r => UI.badge(r.status) }
              ],
              rows: solicitacoesRecentes,
              onRow: "App.go('solicitacoes')"
            })}
          </div>

        </div>

        <!-- COLUNA 2 (DIREITA): ALERTAS IMEDIATOS E FORNECEDORES -->
        <div class="stack">
          
          <!-- Card de Alertas e Ações Imediatas -->
          <div class="card accent">
            <div class="card-head">
              <div>
                <div class="eyebrow" style="color:var(--error)">ATENÇÃO PRIORITÁRIA</div>
                <h2 class="card-title">Alertas & Ações Imediatas</h2>
              </div>
            </div>

            <div class="stack" style="gap:14px">
              
              <!-- 1. Alertas de Ruptura de Estoque -->
              <div>
                <div class="row between" style="margin-bottom:8px">
                  <span class="label-caps" style="color:var(--error);display:flex;align-items:center;gap:5px">
                    ${Icon('box')} Ruptura de Estoque (${itensCriticos.length})
                  </span>
                  <a href="javascript:App.go('estoque')" class="small" style="color:var(--muted)">Estoque &rarr;</a>
                </div>
                ${itensCriticos.length ? itensCriticos.map(item => {
                  const st = Rules.estoque(item);
                  return `
                    <div style="background:#FFF5F5;border:1px solid #FED7D7;border-radius:var(--r-md);padding:10px 12px;margin-bottom:8px">
                      <div class="row between">
                        <div>
                          <b style="font-size:12.5px;color:#9B2C2C">${U.esc(item.material)}</b>
                          <div class="small" style="color:#C53030">
                            Saldo: <b>${item.atual} ${item.unid}</b> (Mínimo: ${item.minimo} ${item.unid})
                          </div>
                        </div>
                        <button class="btn btn-primary btn-xs" onclick="ModDashboard.comprarItemEstoque('${item.codigo}')" title="Gerar requisição imediata de compra">
                          ${Icon('cart')} Comprar
                        </button>
                      </div>
                    </div>
                  `;
                }).join('') : `<div class="small muted">Nenhum item com estoque crítico no momento.</div>`}
              </div>

              <!-- 2. Alertas de Entregas Atrasadas -->
              <div style="padding-top:8px;border-top:1px dashed var(--border)">
                <div class="row between" style="margin-bottom:8px">
                  <span class="label-caps" style="color:#B45309;display:flex;align-items:center;gap:5px">
                    ${Icon('truck')} Entregas em Atraso (${entregasAtrasadasList.length})
                  </span>
                  <a href="javascript:App.go('pedidos')" class="small" style="color:var(--muted)">Pedidos &rarr;</a>
                </div>
                ${entregasAtrasadasList.length ? entregasAtrasadasList.map(p => {
                  const ent = Rules.entrega(p);
                  return `
                    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--r-md);padding:10px 12px;margin-bottom:8px">
                      <div class="row between">
                        <div>
                          <b style="font-size:12.5px;color:#92400E">${U.esc(p.id)} · ${U.esc(Store.fornecedorNome(p.fornecedorId))}</b>
                          <div class="small" style="color:#B45309">${U.esc(p.descricao)}</div>
                        </div>
                        <span class="badge badge-error" style="font-size:10.5px">${ent.dias} dias atraso</span>
                      </div>
                    </div>
                  `;
                }).join('') : `<div class="small muted">Nenhum pedido com entrega em atraso.</div>`}
              </div>

              <!-- 3. Cotações Pendentes de Aprovação -->
              <div style="padding-top:8px;border-top:1px dashed var(--border)">
                <div class="row between" style="margin-bottom:8px">
                  <span class="label-caps" style="color:var(--orange-deep);display:flex;align-items:center;gap:5px">
                    ${Icon('scale')} Cotações Pendentes (${cotacoesPendentes.length})
                  </span>
                  <a href="javascript:App.go('cotacoes')" class="small" style="color:var(--muted)">Cotações &rarr;</a>
                </div>
                ${cotacoesPendentes.length ? cotacoesPendentes.map(cot => {
                  const an = Rules.cotacao(cot);
                  const sc = Store.sc(cot.scId);
                  const alcada = Rules.alcada(an.escolhido);
                  const podeAprovar = Rules.podeAprovar(user, cot);

                  return `
                    <div style="background:#FFF7ED;border:1px solid #FFEDD5;border-radius:var(--r-md);padding:10px 12px;margin-bottom:8px">
                      <div class="row between" style="align-items:flex-start">
                        <div>
                          <b style="font-size:12.5px;color:#9A3412">${U.esc(cot.id)} · ${U.brl(an.escolhido)}</b>
                          <div class="small" style="color:#C2410C">${U.esc(sc ? sc.descricao : 'Material')}</div>
                          <div class="small muted" style="margin-top:2px">Alçada: Nível ${alcada?.nivel} (${alcada?.nome})</div>
                        </div>
                        ${podeAprovar ? `
                          <button class="btn btn-success btn-xs" onclick="ModDashboard.aprovarCotacao('${cot.id}')" title="Aprovar e gerar Pedido de Compra">
                            ${Icon('check')} Aprovar
                          </button>
                        ` : `
                          <span class="badge badge-warning" style="font-size:10px" title="Perfil sem alçada para este valor">Requer Nível ${alcada?.nivel}</span>
                        `}
                      </div>
                    </div>
                  `;
                }).join('') : `<div class="small muted">Nenhuma cotação aguardando aprovação.</div>`}
              </div>

            </div>
          </div>

          <!-- Card de Fornecedores em Destaque -->
          <div class="card">
            <div class="card-head">
              <div>
                <h2 class="card-title">Fornecedores em Destaque</h2>
                <div class="hint">Top parceiros avaliados por pontualidade, preço e qualidade</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="App.go('fornecedores')">Ver Todos &rarr;</button>
            </div>
            <div class="stack" style="gap:10px">
              ${fornecedoresRanqueados.map((item, idx) => {
                const f = item.forn;
                const nota = item.notaInfo.nota;
                const crit = item.notaInfo.criterios;
                return `
                  <div style="padding:12px;border:1px solid var(--border);border-radius:var(--r-md);background:#FBFCFE">
                    <div class="row between">
                      <div>
                        <div class="row" style="gap:6px">
                          <span class="badge badge-dark" style="font-size:10px">#${idx + 1}</span>
                          <b style="font-size:13px;color:var(--text)">${U.esc(f.fantasia || f.razao)}</b>
                        </div>
                        <div class="small muted" style="margin-top:3px">${U.esc(f.categoria)} · Prazo médio: ${f.prazoMedio} dias</div>
                      </div>
                      ${UI.nota(nota)}
                    </div>
                    ${crit ? `
                      <div class="row small muted" style="gap:12px;margin-top:8px;padding-top:6px;border-top:1px dashed var(--border);font-size:11px">
                        <span>Preço: <b>${U.num(crit.preco, 1)}</b></span>
                        <span>Prazo: <b>${U.num(crit.prazo, 1)}</b></span>
                        <span>Qualidade: <b>${U.num(crit.qualidade, 1)}</b></span>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>

      </div>
    `;
  }
});

/* =====================================================================
   2. PÁGINA: RELATÓRIOS & BI (GESTÃO CONSOLIDADA & EXCEL)
   ===================================================================== */
App.register({
  id: 'relatorios',
  label: 'Relatórios & BI',
  icon: 'chart',
  section: 'Gestão',
  order: 1,
  render(el) {
    const ano = ModDashboard.anoSelecionado;
    const metricas = ModDashboard.calcularMetricasAno(ano);

    // Totais Consolidados do Ano
    let totSc = 0, totPc = 0, totComprado = 0, totMenor = 0, totEco = 0, totUrg = 0, totAtrasadas = 0;
    metricas.forEach(d => {
      totSc += d.scs;
      totPc += d.pcs;
      totComprado += d.valComprado;
      totMenor += d.menorBase;
      totEco += d.economia;
      totUrg += d.urgentes;
      totAtrasadas += d.atrasadas;
    });

    const totPctEco = (totComprado + totEco) > 0 ? (totEco / (totComprado + totEco)) : 0;
    const totalFornAno = new Set(
      Store.db.pedidos
        .filter(p => p.data && p.data.startsWith(String(ano)) && p.status !== 'Cancelado')
        .map(p => p.fornecedorId)
        .filter(Boolean)
    ).size;

    // Dados para o Gráfico de Barras dos 12 meses
    const dadosGrafico = metricas.map(d => ({
      label: d.mes,
      value: d.valComprado,
      value2: d.economia
    }));

    el.innerHTML = `
      ${UI.pageHead({
        eyebrow: 'BUSINESS INTELLIGENCE & AUDITORIA DE COMPRAS',
        title: 'Relatório Mensal Consolidado & Exportações',
        sub: 'Reprodução corrigida e automatizada da planilha de compras da GHC. Cálculo real de economia negociada, compliance de entregas e integrações Excel.',
        actions: `
          <input type="file" id="ghcExcelFileInput" accept=".xlsx,.xls" style="display:none" onchange="ModDashboard.importPlanilha(this)">
          
          <div class="row" style="gap:8px">
            <!-- Seletor de Ano -->
            <select class="input" style="width:110px;font-weight:600" onchange="ModDashboard.setAno(this.value)" aria-label="Ano do Relatório">
              <option value="2026" ${ano === 2026 ? 'selected' : ''}>2026</option>
              <option value="2025" ${ano === 2025 ? 'selected' : ''}>2025</option>
              <option value="2024" ${ano === 2024 ? 'selected' : ''}>2024</option>
            </select>

            <!-- Botões de Ação Excel -->
            ${UI.btn('Importar Planilha GHC (.xlsx)', {
              icon: 'upload',
              variant: 'outline-orange',
              onclick: "document.getElementById('ghcExcelFileInput').click()",
              title: 'Carrega a planilha original da GHC e sincroniza com o banco de dados'
            })}

            ${UI.btn('Exportar Relatório Excel (.xlsx)', {
              icon: 'download',
              variant: 'dark',
              onclick: `ModDashboard.exportRelatorioMensal(${ano})`,
              title: 'Gera planilha Excel (.xlsx) com a tabela mensal consolidada'
            })}

            ${UI.btn('Exportar Base Completa ERP (.xlsx)', {
              icon: 'download',
              variant: 'primary',
              onclick: `ModDashboard.exportBaseCompleta(${ano})`,
              title: 'Exporta pasta de trabalho com 8 abas idênticas à planilha da GHC, 100% preenchida'
            })}
          </div>
        `
      })}

      <!-- 4 KPIS DO RELATÓRIO DO ANO SELECIONADO -->
      <div class="kpis">
        <div class="kpi kpi-light">
          <div class="kpi-top">
            <span class="kpi-label">Volume Anual Comprado</span>
            <span class="kpi-icon">${Icon('cart')}</span>
          </div>
          <div class="kpi-value">${U.brlShort(totComprado)}</div>
          <div class="kpi-note"><b>${totPc}</b> pedidos formalizados em ${ano}</div>
        </div>

        <div class="kpi kpi-light">
          <div class="kpi-top">
            <span class="kpi-label">Economia Total Obtida</span>
            <span class="kpi-icon">${Icon('trendUp')}</span>
          </div>
          <div class="kpi-value" style="color:var(--success)">${U.brlShort(totEco)}</div>
          <div class="kpi-note"><b>${U.pct(totPctEco)}</b> de redução de custos negociada</div>
        </div>

        <div class="kpi kpi-light">
          <div class="kpi-top">
            <span class="kpi-label">Compras Emergenciais</span>
            <span class="kpi-icon">${Icon('alert')}</span>
          </div>
          <div class="kpi-value" style="color:${totUrg > 0 ? 'var(--orange-deep)' : 'var(--text)'}">${totUrg}</div>
          <div class="kpi-note">${totSc > 0 ? U.pct(totUrg / totSc) : '0%'} do total de requisições</div>
        </div>

        <div class="kpi kpi-light">
          <div class="kpi-top">
            <span class="kpi-label">Entregas Fora do Prazo</span>
            <span class="kpi-icon">${Icon('clock')}</span>
          </div>
          <div class="kpi-value" style="color:${totAtrasadas > 0 ? 'var(--error)' : 'var(--text)'}">${totAtrasadas}</div>
          <div class="kpi-note">Ocorrências registradas no período</div>
        </div>
      </div>

      <!-- GRÁFICO DE ACOMPANHAMENTO MENSAL -->
      <div class="card mb-16">
        <div class="card-head">
          <div>
            <h2 class="card-title">Evolução Mensal: Volume de Compras & Economia (${ano})</h2>
            <div class="hint">Valores mensais apurados nas 12 competências do ano</div>
          </div>
        </div>
        <div style="padding-top:10px">
          ${UI.barChart(dadosGrafico, {
            height: 240,
            fmt: U.brlShort,
            color: 'var(--orange)',
            color2: 'var(--navy)',
            legend: ['Valor Comprado (R$)', 'Economia Negociada (R$)']
          })}
        </div>
      </div>

      <!-- TABELA MENSAL CONSOLIDADA (REPRODUÇÃO CORRIGIDA DA PLANILHA ORIGINAL) -->
      <div class="card flush">
        <div class="card-head" style="padding:18px 20px 12px">
          <div>
            <h2 class="card-title">Tabela Mensal Consolidada (Aba 'Relatório Mensal' Corrigida)</h2>
            <div class="hint">Fórmulas da planilha original corrigidas: cálculo correto de economia, tolerância a datas vazias e agregação confiável</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="ModDashboard.exportRelatorioMensal(${ano})">
            ${Icon('download')} Baixar Tabela (.xlsx)
          </button>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Mês</th>
                <th class="t-right">Nº SCs</th>
                <th class="t-right">Nº Pedidos</th>
                <th class="t-right">Valor Comprado</th>
                <th class="t-right">Menor Cotação Base</th>
                <th class="t-right">Economia Negociada</th>
                <th class="t-right">% Economia</th>
                <th class="t-right">Emergenciais (Urgentes)</th>
                <th class="t-right">Entregas Atrasadas</th>
                <th class="t-right">Fornecedores</th>
              </tr>
            </thead>
            <tbody>
              ${metricas.map(d => `
                <tr>
                  <td><b>${d.mes}</b></td>
                  <td class="t-right">${d.scs}</td>
                  <td class="t-right">${d.pcs}</td>
                  <td class="t-right">${U.brl(d.valComprado)}</td>
                  <td class="t-right">${U.brl(d.menorBase)}</td>
                  <td class="t-right" style="color:${d.economia > 0 ? 'var(--success)' : 'inherit'};font-weight:${d.economia > 0 ? '600' : 'normal'}">${U.brl(d.economia)}</td>
                  <td class="t-right">${U.pct(d.pct)}</td>
                  <td class="t-right">${d.urgentes > 0 ? `<span class="badge badge-error" style="font-size:11px">${d.urgentes}</span>` : '0'}</td>
                  <td class="t-right">${d.atrasadas > 0 ? `<span class="badge badge-warning" style="font-size:11px">${d.atrasadas}</span>` : '0'}</td>
                  <td class="t-right">${d.forns}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#F8FAFC;font-weight:700">
                <td>TOTAL / MÉDIA</td>
                <td class="t-right">${totSc}</td>
                <td class="t-right">${totPc}</td>
                <td class="t-right">${U.brl(totComprado)}</td>
                <td class="t-right">${U.brl(totMenor)}</td>
                <td class="t-right" style="color:var(--success)">${U.brl(totEco)}</td>
                <td class="t-right">${U.pct(totPctEco)}</td>
                <td class="t-right">${totUrg}</td>
                <td class="t-right">${totAtrasadas}</td>
                <td class="t-right">${totalFornAno}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }
});

/* =====================================================================
   3. ROADMAP ESTRATÉGICO — FASE 2: FINANCEIRO & CONTAS A PAGAR
   ===================================================================== */
App.register({
  id: 'financeiro',
  label: 'Financeiro',
  icon: 'wallet',
  section: 'Próximas fases',
  order: 1,
  tag: 'Fase 2',
  render(el) {
    el.innerHTML = `
      ${UI.pageHead({
        eyebrow: 'ROADMAP ESTRATÉGICO · FASE 2 (PREVISÃO: Q2/2026)',
        title: 'Módulo Financeiro & Contas a Pagar Automatizado',
        sub: 'Demonstração de integração direta entre Compras e Financeiro: as NFs conferidas na portaria/almoxarifado geram títulos a pagar automaticamente, com conciliação bancária e projeção de fluxo de caixa sem digitação manual.',
        actions: `
          <span class="badge badge-orange" style="font-size:12px;padding:6px 12px">Fase 2 no Roadmap</span>
        `
      })}

      <!-- 4 KPIS DA FASE FINANCEIRA -->
      <div class="kpis">
        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Contas a Pagar Projetado (30d)</span>
            <span class="kpi-icon">${Icon('wallet')}</span>
          </div>
          <div class="kpi-value"><span class="hl">R$ 148,9 mil</span></div>
          <div class="kpi-note" style="color:#CBD5E1">Alimentado diretamente pelos PCs emitidos</div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">NFs com Lançamento 100% Automático</span>
            <span class="kpi-icon">${Icon('checkCircle')}</span>
          </div>
          <div class="kpi-value">98,4%</div>
          <div class="kpi-note" style="color:#CBD5E1">Leitura de XML / Danfe sem digitação manual</div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Economia em Juros & DDA</span>
            <span class="kpi-icon">${Icon('trendUp')}</span>
          </div>
          <div class="kpi-value"><span class="hl">R$ 7,4 mil</span></div>
          <div class="kpi-note" style="color:#CBD5E1">Zero multas por atraso de pagamento de boletos</div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Vencimentos Desta Semana</span>
            <span class="kpi-icon">${Icon('clock')}</span>
          </div>
          <div class="kpi-value">4 <span style="font-size:18px;font-weight:400;color:#94A3B8">boletos</span></div>
          <div class="kpi-note" style="color:#CBD5E1">R$ 8.920,00 agendados no banco via DDA</div>
        </div>
      </div>

      <!-- PAINEL: FLUXO DE INTEGRAÇÃO COMPRAS -> FINANCEIRO -->
      <div class="card mb-16">
        <div class="card-head">
          <div>
            <div class="eyebrow">ARQUITETURA DE INTEGRAÇÃO CONTÍNUA</div>
            <h2 class="card-title">Como o Módulo de Compras Alimentará o Financeiro da GHC</h2>
          </div>
          <span class="badge badge-success">3-Way Matching Fiscal</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:14px;padding-top:6px">
          
          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-info" style="margin-bottom:8px">1. PEDIDO APROVADO</div>
            <div style="font-weight:600;font-size:13px">PC Travado no ERP</div>
            <p class="small muted" style="margin:6px 0 0">Valor, frete, alçada de aprovação e condição de pagamento registrados sem divergências.</p>
          </div>

          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-warning" style="margin-bottom:8px">2. NF NA PORTARIA</div>
            <div style="font-weight:600;font-size:13px">Captura de XML SEFAZ</div>
            <p class="small muted" style="margin:6px 0 0">Leitura do código de barras da Danfe e confronto automático de itens com a ordem de compra.</p>
          </div>

          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-orange" style="margin-bottom:8px">3. CONTAS A PAGAR</div>
            <div style="font-weight:600;font-size:13px">Título Gerado no Vencimento</div>
            <p class="small muted" style="margin:6px 0 0">Lançamento automático de boleto/PIX no fluxo de caixa conforme os prazos acordados (28 dias).</p>
          </div>

          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-success" style="margin-bottom:8px">4. BANCO & OFX</div>
            <div style="font-weight:600;font-size:13px">Conciliação Bancária</div>
            <p class="small muted" style="margin:6px 0 0">Baixa automática via integração bancária (Open Finance / DDA) sem digitação de comprovantes.</p>
          </div>

        </div>
      </div>

      <!-- TABELA DEMONSTRATIVA: PREVISÃO DE DESEMBOLSO POR FORNECEDOR -->
      <div class="card flush">
        <div class="card-head" style="padding:18px 20px 12px">
          <div>
            <h2 class="card-title">Simulação: Previsão de Desembolso Semanal (Títulos das Compras Reais)</h2>
            <div class="hint">Demonstrativo de títulos gerados a partir dos pedidos ativos da demonstração</div>
          </div>
        </div>

        ${UI.table({
          columns: [
            { label: 'Título / NF', render: r => `<span class="mono strong">${U.esc(r.titulo)}</span>` },
            { label: 'Fornecedor', render: r => `<div class="cell-main">${U.esc(r.forn)}</div><div class="cell-sub">${U.esc(r.categoria)}</div>` },
            { label: 'Contrato / CC', render: r => `<span class="badge badge-neutral">${U.esc(r.cc)}</span>` },
            { label: 'Vencimento', render: r => `<span class="small">${U.date(r.vencimento)}</span>` },
            { label: 'Valor (R$)', align: 'right', render: r => `<b>${U.brl(r.valor)}</b>` },
            { label: 'Condição', render: r => `<span class="small">${U.esc(r.condicao)}</span>` },
            { label: 'Status Financeiro', render: r => UI.badge(r.status) }
          ],
          rows: [
            { titulo: 'NF-10492 / PC-0001', forn: 'Aço & Metal Paulistana', categoria: 'Metais', cc: 'Meli RC01', vencimento: U.addDays(U.today(), 12), valor: 960.00, condicao: 'Boleto 28 dias', status: 'Agendado' },
            { titulo: 'NF-89211 / PC-0002', forn: 'Eletroeste Materiais', categoria: 'Elétrica', cc: 'GL-Cajamar', vencimento: U.addDays(U.today(), 14), valor: 888.00, condicao: 'Boleto 28 dias', status: 'Agendado' },
            { titulo: 'NF-3490 / PC-0003', forn: 'Hidro Vale Tubos', categoria: 'Hidráulica', cc: 'ROCH-PRED', vencimento: U.addDays(U.today(), 7), valor: 388.00, condicao: 'Boleto 14 dias', status: 'Aguardando aprovação' },
            { titulo: 'PREV / PC-0004', forn: 'Delta EPIs & Segurança', categoria: 'EPI', cc: 'ALMOX-CENTRAL', vencimento: U.addDays(U.today(), 20), valor: 905.00, condicao: 'Boleto 28 dias', status: 'Aguardando aprovação' }
          ]
        })}
      </div>
    `;
  }
});

/* =====================================================================
   4. ROADMAP ESTRATÉGICO — FASE 3: OPERAÇÃO & ORDENS DE SERVIÇO (OS)
   ===================================================================== */
App.register({
  id: 'operacoes',
  label: 'Operação & OS',
  icon: 'wrench',
  section: 'Próximas fases',
  order: 2,
  tag: 'Fase 3',
  render(el) {
    el.innerHTML = `
      ${UI.pageHead({
        eyebrow: 'ROADMAP ESTRATÉGICO · FASE 3 (PREVISÃO: Q3/2026)',
        title: 'Operação de Facilities & Ordens de Serviço (OS)',
        sub: 'Rastreabilidade total de ponta a ponta: saídas do almoxarifado e compras diretas vinculadas às Ordens de Serviço executadas nos clientes contratantes (Mercado Livre, Cajamar, Rochaverá), controlando a rentabilidade real de cada contrato.',
        actions: `
          <span class="badge badge-orange" style="font-size:12px;padding:6px 12px">Fase 3 no Roadmap</span>
        `
      })}

      <!-- 4 KPIS OPERACIONAIS -->
      <div class="kpis">
        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Ordens de Serviço em Aberto</span>
            <span class="kpi-icon">${Icon('wrench')}</span>
          </div>
          <div class="kpi-value"><span class="hl">42</span> <span style="font-size:18px;font-weight:400;color:#94A3B8">chamados</span></div>
          <div class="kpi-note" style="color:#CBD5E1">Atendimento de manutenção predial e civil</div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Custo Médio de Materiais / OS</span>
            <span class="kpi-icon">${Icon('cart')}</span>
          </div>
          <div class="kpi-value">R$ 385,00</div>
          <div class="kpi-note" style="color:#CBD5E1">Apropriação precisa por centro de custo</div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">SLA de Atendimento em Dia</span>
            <span class="kpi-icon">${Icon('clock')}</span>
          </div>
          <div class="kpi-value"><span class="hl">96,2%</span></div>
          <div class="kpi-note" style="color:#CBD5E1">Conclusão dentro do prazo contratual</div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Contratos Monitorados</span>
            <span class="kpi-icon">${Icon('building')}</span>
          </div>
          <div class="kpi-value">100%</div>
          <div class="kpi-note" style="color:#CBD5E1">Rastreabilidade ativa nos clientes GHC</div>
        </div>
      </div>

      <!-- PAINEL: CICLO DA ORDEM DE SERVIÇO & MATERIAIS -->
      <div class="card mb-16">
        <div class="card-head">
          <div>
            <div class="eyebrow">RASTREABILIDADE CONTRATUAL</div>
            <h2 class="card-title">Ciclo Integrado: Chamado do Cliente ➔ Material ➔ Apontamento de Custo</h2>
          </div>
          <span class="chip">App do Técnico em Campo</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:14px;padding-top:6px">
          
          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-info" style="margin-bottom:8px">1. ABERTURA DE OS</div>
            <div style="font-weight:600;font-size:13px">Chamado no Cliente</div>
            <p class="small muted" style="margin:6px 0 0">Requisição de reparo preventivo ou corretivo aberta pelo gestor do galpão ou condomínio.</p>
          </div>

          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-warning" style="margin-bottom:8px">2. RESERVA / COMPRA</div>
            <div style="font-weight:600;font-size:13px">Baixa de Estoque ou SC</div>
            <p class="small muted" style="margin:6px 0 0">Baixa automática do material no almoxarifado ou criação de solicitação de compra direta com vínculo na OS.</p>
          </div>

          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-orange" style="margin-bottom:8px">3. EXECUÇÃO EM CAMPO</div>
            <div style="font-weight:600;font-size:13px">Check-in Técnico</div>
            <p class="small muted" style="margin:6px 0 0">Oficial técnico registra foto de antes/depois, peças aplicadas e tempo de mão de obra via tablet/mobile.</p>
          </div>

          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-success" style="margin-bottom:8px">4. FECHAMENTO & DRE</div>
            <div style="font-weight:600;font-size:13px">Rentabilidade Real</div>
            <p class="small muted" style="margin:6px 0 0">Comparação exata entre o valor faturado do contrato de facilities e o custo real de materiais consumidos.</p>
          </div>

        </div>
      </div>

      <!-- TABELA DEMONSTRATIVA: ORDENS DE SERVIÇO VINCULADAS A COMPRAS -->
      <div class="card flush">
        <div class="card-head" style="padding:18px 20px 12px">
          <div>
            <h2 class="card-title">Ordens de Serviço em Andamento nos Contratos GHC</h2>
            <div class="hint">Exemplo de vinculação real entre materiais adquiridos e atendimentos operacionais</div>
          </div>
        </div>

        ${UI.table({
          columns: [
            { label: 'OS / Chamado', render: r => `<span class="mono strong">${U.esc(r.os)}</span>` },
            { label: 'Cliente & Local', render: r => `<div class="cell-main">${U.esc(r.cliente)}</div><div class="cell-sub">${U.esc(r.local)}</div>` },
            { label: 'Serviço Realizado', render: r => U.esc(r.servico) },
            { label: 'Materiais Vinculados', render: r => `<b>${U.esc(r.materiais)}</b>` },
            { label: 'Técnico Responsável', render: r => `<span class="small">${U.esc(r.tecnico)}</span>` },
            { label: 'Custo de Peças', align: 'right', render: r => `<b>${U.brl(r.custo)}</b>` },
            { label: 'Status da OS', render: r => UI.badge(r.status) }
          ],
          rows: [
            { os: 'OS-8821', cliente: 'Mercado Livre RC01', local: 'Perus/SP', servico: 'Reparo emergencial de batente de doca pós-colisão', materiais: 'Cantoneira 1 1/2" (10 barras - PC-0001)', tecnico: 'Marcos Vinicius (Serralheiro)', custo: 960.00, status: 'Aprovado' },
            { os: 'OS-8834', cliente: 'Galpão Cajamar', local: 'Cajamar/SP', servico: 'Substituição de luminárias de galpão (corredor 4)', materiais: 'Lâmpadas Tubular LED 18W (60 un - PC-0002)', tecnico: 'Oficial Eletricista', custo: 888.00, status: 'Aprovado' },
            { os: 'OS-8850', cliente: 'Condomínio Rochaverá', local: 'Morumbi/SP', servico: 'Revisão hidráulica banheiros Torre B', materiais: 'Reparo Válvula Hydra Max (8 un - PC-0003)', tecnico: 'Renato Dias (Encanador)', custo: 388.00, status: 'Recebido parcial' },
            { os: 'OS-8862', cliente: 'Mercado Livre RC02', local: 'Santana de Parnaíba/SP', servico: 'Adequação guarda-corpo externo (Exigência CIPA)', materiais: 'Metalon 50x50 galvanizado (16 barras - COT-0005)', tecnico: 'Carlos Mendes (Supervisor)', custo: 2440.00, status: 'Aguardando aprovação' }
          ]
        })}
      </div>
    `;
  }
});

/* =====================================================================
   5. ROADMAP ESTRATÉGICO — FASE 4: PESSOAS, RH & EPIS (NR-06)
   ===================================================================== */
App.register({
  id: 'rh',
  label: 'Pessoas & RH',
  icon: 'users',
  section: 'Próximas fases',
  order: 3,
  tag: 'Fase 4',
  render(el) {
    el.innerHTML = `
      ${UI.pageHead({
        eyebrow: 'ROADMAP ESTRATÉGICO · FASE 4 (PREVISÃO: Q4/2026)',
        title: 'Gestão de Pessoas, Equipes & Fichas de EPIs (NR-06)',
        sub: 'Digitalização completa da entrega de Equipamentos de Proteção Individual vinculada ao estoque, validação automática de Certificados de Aprovação (CA), controle de treinamentos obrigatórios (NR-10, NR-35) e governança LGPD.',
        actions: `
          <span class="badge badge-orange" style="font-size:12px;padding:6px 12px">Fase 4 no Roadmap</span>
        `
      })}

      <!-- 4 KPIS DE RH & SEGURANÇA -->
      <div class="kpis">
        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Efetivo Operacional Ativo</span>
            <span class="kpi-icon">${Icon('users')}</span>
          </div>
          <div class="kpi-value"><span class="hl">38</span> <span style="font-size:18px;font-weight:400;color:#94A3B8">colaboradores</span></div>
          <div class="kpi-note" style="color:#CBD5E1">Eletricistas, serralheiros, oficiais e limpeza</div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Fichas de EPI Digitais (NR-06)</span>
            <span class="kpi-icon">${Icon('shield')}</span>
          </div>
          <div class="kpi-value">100%</div>
          <div class="kpi-note" style="color:#CBD5E1">Assinatura biométrica / digital auditável</div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Certificados de CA Vigentes</span>
            <span class="kpi-icon">${Icon('checkCircle')}</span>
          </div>
          <div class="kpi-value"><span class="hl">Zero</span> vencidos</div>
          <div class="kpi-note" style="color:#CBD5E1">Conformidade total com o Ministério do Trabalho</div>
        </div>

        <div class="kpi kpi-dark">
          <div class="kpi-top">
            <span class="kpi-label">Treinamentos Obrigatórios em Dia</span>
            <span class="kpi-icon">${Icon('star')}</span>
          </div>
          <div class="kpi-value">94,8%</div>
          <div class="kpi-note" style="color:#CBD5E1">NR-10 (Elétrica) e NR-35 (Trabalho em Altura)</div>
        </div>
      </div>

      <!-- PAINEL: GESTÃO DIGITAL DE EPIS & COMPLIANCE TRABALHISTA -->
      <div class="card mb-16">
        <div class="card-head">
          <div>
            <div class="eyebrow">SEGURANÇA DO TRABALHO & NR-06</div>
            <h2 class="card-title">Fluxo de Entrega de EPIs Integrado ao Almoxarifado</h2>
          </div>
          <span class="badge badge-success">Proteção contra Passivo Trabalhista</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:14px;padding-top:6px">
          
          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-info" style="margin-bottom:8px">1. COMPRA DO LOTE</div>
            <div style="font-weight:600;font-size:13px">Entrada com N° do CA</div>
            <p class="small muted" style="margin:6px 0 0">O recebimento do pedido de EPI cadastra o número e validade do Certificado de Aprovação oficial.</p>
          </div>

          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-warning" style="margin-bottom:8px">2. SOLICITAÇÃO</div>
            <div style="font-weight:600;font-size:13px">Peridiocidade / Troca</div>
            <p class="small muted" style="margin:6px 0 0">O sistema avisa o momento exato de reposição por desgaste ou validade de higienização.</p>
          </div>

          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-orange" style="margin-bottom:8px">3. ENTREGA DIGITAL</div>
            <div style="font-weight:600;font-size:13px">Assinatura Eletrônica</div>
            <p class="small muted" style="margin:6px 0 0">Colaborador assina no tablet com registro de data/hora e termo de responsabilidade da Portaria 672.</p>
          </div>

          <div style="background:#FBFCFE;border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div class="badge badge-success" style="margin-bottom:8px">4. PRONTUÁRIO AUDITÁVEL</div>
            <div style="font-weight:600;font-size:13px">Dossiê Jurídico 100%</div>
            <p class="small muted" style="margin:6px 0 0">Exportação em 1 clique de todo o histórico do colaborador para auditorias de clientes e fiscalizações.</p>
          </div>

        </div>
      </div>

      <!-- TABELA DEMONSTRATIVA: CONTROLE DE EQUIPE & EPIS -->
      <div class="card flush">
        <div class="card-head" style="padding:18px 20px 12px">
          <div>
            <h2 class="card-title">Prontuário de EPIs & Alocação dos Profissionais GHC</h2>
            <div class="hint">Demonstração da ficha digital individual vinculada aos materiais do almoxarifado</div>
          </div>
        </div>

        ${UI.table({
          columns: [
            { label: 'Colaborador', render: r => `<div class="cell-main">${U.esc(r.nome)}</div><div class="cell-sub">${U.esc(r.cargo)}</div>` },
            { label: 'Unidade Alocada', render: r => `<span class="badge badge-neutral">${U.esc(r.unidade)}</span>` },
            { label: 'EPIs em Posse (Ativos)', render: r => U.esc(r.epis) },
            { label: 'Certificado de CA', render: r => `<span class="mono">${U.esc(r.ca)}</span>` },
            { label: 'Última Entrega', render: r => `<span class="small">${U.date(r.data)}</span>` },
            { label: 'Treinamentos NR', render: r => `<span class="badge badge-info" style="font-size:11px">${U.esc(r.nrs)}</span>` },
            { label: 'Status da Ficha', render: r => UI.badge(r.status) }
          ],
          rows: [
            { nome: 'Marcos Vinicius', cargo: 'Oficial Serralheiro', unidade: 'Mercado Livre RC01', epis: 'Máscara de solda, Luva de raspa, Óculos ampla visão', ca: 'CA 13420 / CA 27500', data: U.addDays(U.today(), -14), nrs: 'NR-18 / NR-35', status: 'OK' },
            { nome: 'Oficial Eletricista', cargo: 'Eletricista de Manutenção', unidade: 'Galpão Cajamar', epis: 'Botina bico composite, Luva isolante 1000V, Capacete aba', ca: 'CA 35400 / CA 11200', data: U.addDays(U.today(), -28), nrs: 'NR-10 / NR-35', status: 'OK' },
            { nome: 'Renato Dias', cargo: 'Oficial de Hidráulica', unidade: 'Condomínio Rochaverá', epis: 'Luva nitrílica cano longo, Óculos proteção, Botina', ca: 'CA 28900 / CA 35400', data: U.addDays(U.today(), -45), nrs: 'NR-33 (Espaço Confinado)', status: 'OK' },
            { nome: 'Valéria Meireles', cargo: 'Supervisora de Higienização', unidade: 'Hospital Alvorada', epis: 'Avental impermeável, Luva nitrílica, Bota de PVC', ca: 'CA 19400 / CA 32100', data: U.addDays(U.today(), -10), nrs: 'NR-32 (Serviços de Saúde)', status: 'OK' }
          ]
        })}
      </div>
    `;
  }
});
