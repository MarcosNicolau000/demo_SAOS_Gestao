'use strict';
/* =====================================================================
   GHC GESTÃO — DADOS DE DEMONSTRAÇÃO (SEED)
   Baseados na operação real de facilities da GHC:
   - Clientes reais (Mercado Livre RC01/RC02, Cajamar, Rochaverá, etc.)
   - Centros de custo e materiais de manutenção predial / civil / elétrica
   - Fornecedores homologados e avaliados
   - Ciclo completo em andamento: SC -> COT -> Aprovação -> PC -> Entrega -> Estoque
   ===================================================================== */
const Seed = {
  build() {
    const hoje = U.today();
    const d = (offset) => U.addDays(hoje, offset);

    return {
      version: '1.0',
      config: {
        usuarioId: 'USR-02', // Padrão: Carlos Mendes (Supervisor - Alçada até R$ 2.000)
      },

      /* Usuários com perfis e níveis de alçada de aprovação */
      usuarios: [
        { id: 'USR-01', nome: 'Juliana Silva', perfil: 'Compradora', nivel: 0, email: 'juliana.silva@ghcfacilities.com.br' },
        { id: 'USR-02', nome: 'Carlos Mendes', perfil: 'Supervisor Operacional', nivel: 1, email: 'carlos.mendes@ghcfacilities.com.br' }, // Até R$ 2.000
        { id: 'USR-03', nome: 'Roberto Santos', perfil: 'Gerente de Facilities', nivel: 2, email: 'roberto.santos@ghcfacilities.com.br' }, // Até R$ 10.000
        { id: 'USR-04', nome: 'Diretoria GHC', perfil: 'Diretor de Operações', nivel: 3, email: 'diretoria@ghcfacilities.com.br' }, // Acima de R$ 10.000
      ],

      /* Fornecedores homologados */
      fornecedores: [
        { id: 'G01', razao: 'Paulistana Aços e Metais Ltda', fantasia: 'Aço & Metal Paulistana', cnpj: '45.123.890/0001-12', categoria: 'Metais', contato: 'Marcos Vinicius', telefone: '(11) 3941-2200', email: 'vendas@acopaulistana.com.br', cidade: 'São Paulo/SP', status: 'Ativo', prazoMedio: 4, pagamento: 'Boleto 28 dias', obs: 'Fornecedor chave de serralheria e perfis' },
        { id: 'G02', razao: 'Eletroeste Distribuidora de Materiais Ltda', fantasia: 'Eletroeste Materiais', cnpj: '18.452.109/0001-44', categoria: 'Elétrica', contato: 'Camila Rocha', telefone: '(11) 4195-7788', email: 'comercial@eletroeste.com.br', cidade: 'Barueri/SP', status: 'Ativo', prazoMedio: 2, pagamento: 'Boleto 28 dias', obs: 'Entrega rápida para Grande SP' },
        { id: 'G03', razao: 'Hidro Vale Tubos e Conexões Eireli', fantasia: 'Hidro Vale Tubos', cnpj: '09.331.782/0001-90', categoria: 'Hidráulica', contato: 'Renato Dias', telefone: '(11) 3682-1144', email: 'vendas@hidrovale.com.br', cidade: 'Osasco/SP', status: 'Ativo', prazoMedio: 3, pagamento: 'Boleto 14 dias', obs: 'Tubulações prediais e esgoto' },
        { id: 'G04', razao: 'Cores & Proteção Tintas Industriais Ltda', fantasia: 'Cores Tintas', cnpj: '62.774.901/0001-33', categoria: 'Pintura', contato: 'Fabiana Souza', telefone: '(11) 2291-5500', email: 'atendimento@corestintas.com.br', cidade: 'São Paulo/SP', status: 'Ativo', prazoMedio: 5, pagamento: 'Boleto 28 dias', obs: 'Tintas epóxi, demarcação e acrílica' },
        { id: 'G05', razao: 'Segurança Total Equipamentos de Proteção Ltda', fantasia: 'Delta EPIs & Segurança', cnpj: '33.109.845/0001-67', categoria: 'EPI', contato: 'Bruno Ramos', telefone: '(11) 3105-9900', email: 'pedidos@deltaepis.com.br', cidade: 'São Paulo/SP', status: 'Ativo', prazoMedio: 3, pagamento: 'Boleto 28 dias', obs: 'Certificados CA atualizados' },
        { id: 'G06', razao: 'FixaBem Parafusos e Fixadores Industriais Ltda', fantasia: 'FixaBem Fixadores', cnpj: '51.882.340/0001-01', categoria: 'Fixadores', contato: 'Edson Lima', telefone: '(11) 2085-3311', email: 'vendas@fixabem.com.br', cidade: 'Guarulhos/SP', status: 'Ativo', prazoMedio: 2, pagamento: 'Boleto 14 dias', obs: 'Parafusos, chumbadores e buchas' },
        { id: 'G07', razao: 'Atlas Ferragens e Fechaduras Eireli', fantasia: 'Atlas Ferragens', cnpj: '21.094.661/0001-78', categoria: 'Ferragens', contato: 'Luciana Prado', telefone: '(11) 3311-8080', email: 'atlas@atlasferragens.com.br', cidade: 'São Paulo/SP', status: 'Ativo', prazoMedio: 4, pagamento: 'Boleto 28 dias', obs: 'Molas hidráulicas e barras antipânico' },
        { id: 'G08', razao: 'EcoClean Produtos Químicos de Limpeza Ltda', fantasia: 'EcoClean Higiene', cnpj: '77.201.554/0001-19', categoria: 'Limpeza', contato: 'Valéria Meireles', telefone: '(11) 4781-6200', email: 'vendas@ecoclean.com.br', cidade: 'Embu/SP', status: 'Ativo', prazoMedio: 3, pagamento: 'Boleto 28 dias', obs: 'Produtos concentrados e dispensers' },
        { id: 'G09', razao: 'Krona Refrigeração e Climatização Peças Ltda', fantasia: 'Krona Clima Peças', cnpj: '14.520.981/0001-85', categoria: 'Serviços', contato: 'Thiago Faria', telefone: '(11) 5055-4000', email: 'krona@kronaclima.com.br', cidade: 'São Paulo/SP', status: 'Em homologação', prazoMedio: 7, pagamento: 'À vista', obs: 'Filtros para fancoil e gás R410' },
        { id: 'G10', razao: 'SulMetais Estruturas Rápidas Eireli', fantasia: 'SulMetais', cnpj: '08.614.229/0001-52', categoria: 'Metais', contato: 'Jorge Viana', telefone: '(11) 3788-0200', email: 'contato@sulmetais.com.br', cidade: 'São Paulo/SP', status: 'Ativo', prazoMedio: 6, pagamento: 'Boleto 28 dias', obs: 'Perfis especiais e chapas galvanizadas' },
      ],

      /* Catálogo de Materiais & Estoque com regras dinâmicas de reposição */
      estoque: [
        { codigo: 'MAT-001', material: 'Cabo flexível 2,5 mm² antichama (Rolo 100m)', categoria: 'Elétrica', unid: 'rolo', atual: 4, minimo: 8, maximo: 25, consumoMensal: 30, fornecedorId: 'G02', ultimoPreco: 195.00, local: 'Prateleira E-01', obs: 'Uso constante em manutenções elétricas' },
        { codigo: 'MAT-002', material: 'Disjuntor bipolar DIN 20A Curva C', categoria: 'Elétrica', unid: 'un', atual: 28, minimo: 15, maximo: 50, consumoMensal: 20, fornecedorId: 'G02', ultimoPreco: 38.50, local: 'Prateleira E-02', obs: 'Padrão para quadros de distribuição' },
        { codigo: 'MAT-003', material: 'Lâmpada tubular LED T8 18W 120cm Bivolt', categoria: 'Elétrica', unid: 'un', atual: 62, minimo: 40, maximo: 160, consumoMensal: 100, fornecedorId: 'G02', ultimoPreco: 14.80, local: 'Prateleira E-04', obs: 'Iluminação de galpões e garagens' },
        { codigo: 'MAT-004', material: 'Tubo de PVC Soldável 25mm 3/4" (Barra 6m)', categoria: 'Hidráulica', unid: 'barra', atual: 6, minimo: 12, maximo: 36, consumoMensal: 18, fornecedorId: 'G03', ultimoPreco: 28.00, local: 'Rack H-01', obs: 'Tubulação predial' },
        { codigo: 'MAT-005', material: 'Reparo para válvula Hydra Max 1 1/2"', categoria: 'Hidráulica', unid: 'un', atual: 14, minimo: 10, maximo: 30, consumoMensal: 12, fornecedorId: 'G03', ultimoPreco: 46.00, local: 'Gaveta H-08', obs: 'Banheiros corporativos' },
        { codigo: 'MAT-006', material: 'Tinta acrílica fosca branca Premium (Lata 18L)', categoria: 'Pintura', unid: 'lata', atual: 5, minimo: 8, maximo: 20, consumoMensal: 10, fornecedorId: 'G04', ultimoPreco: 340.00, local: 'Pátio Tintas P-01', obs: 'Pintura predial e corredores' },
        { codigo: 'MAT-007', material: 'Tinta demarcação viária amarela (Galão 3,6L)', categoria: 'Pintura', unid: 'galão', atual: 8, minimo: 6, maximo: 18, consumoMensal: 8, fornecedorId: 'G04', ultimoPreco: 125.00, local: 'Pátio Tintas P-02', obs: 'Sinalização de docas e garagens' },
        { codigo: 'MAT-008', material: 'Luva de segurança vaqueta mista cano curto', categoria: 'EPI', unid: 'par', atual: 15, minimo: 25, maximo: 80, consumoMensal: 60, fornecedorId: 'G05', ultimoPreco: 22.00, local: 'Armário EPI-A', obs: 'CA 13420' },
        { codigo: 'MAT-009', material: 'Óculos de proteção ampla visão antiembaçante', categoria: 'EPI', unid: 'un', atual: 34, minimo: 20, maximo: 60, consumoMensal: 25, fornecedorId: 'G05', ultimoPreco: 18.50, local: 'Armário EPI-B', obs: 'CA 27500' },
        { codigo: 'MAT-010', material: 'Botina de segurança com bico de composite nº 41', categoria: 'EPI', unid: 'par', atual: 3, minimo: 6, maximo: 15, consumoMensal: 5, fornecedorId: 'G05', ultimoPreco: 110.00, local: 'Armário EPI-C', obs: 'CA 35400' },
        { codigo: 'MAT-011', material: 'Parafuso sextavado zincado 1/4" x 2" c/ bucha 10', categoria: 'Fixadores', unid: 'cento', atual: 9, minimo: 8, maximo: 24, consumoMensal: 14, fornecedorId: 'G06', ultimoPreco: 48.00, local: 'Gaveteiro F-03', obs: 'Fixações de quadros e canaletas' },
        { codigo: 'MAT-012', material: 'Chumbador parabolt CBA 3/8" x 3"', categoria: 'Fixadores', unid: 'un', atual: 75, minimo: 50, maximo: 150, consumoMensal: 60, fornecedorId: 'G06', ultimoPreco: 6.80, local: 'Gaveteiro F-05', obs: 'Fixação estrutural em concreto' },
        { codigo: 'MAT-013', material: 'Tubo Metalon quadrado 50x50mm chapa 16 (Barra 6m)', categoria: 'Metais', unid: 'barra', atual: 5, minimo: 10, maximo: 30, consumoMensal: 16, fornecedorId: 'G01', ultimoPreco: 145.00, local: 'Cavalete M-01', obs: 'Serralheria, gradis e portões' },
        { codigo: 'MAT-014', material: 'Cantoneira de ferro 1 1/2" x 1/8" (Barra 6m)', categoria: 'Metais', unid: 'barra', atual: 8, minimo: 8, maximo: 24, consumoMensal: 12, fornecedorId: 'G01', ultimoPreco: 92.00, local: 'Cavalete M-02', obs: 'Proteção de quinas e batentes' },
        { codigo: 'MAT-015', material: 'Mola hidráulica aérea para porta 65kg Prata', categoria: 'Ferragens', unid: 'un', atual: 7, minimo: 5, maximo: 16, consumoMensal: 6, fornecedorId: 'G07', ultimoPreco: 185.00, local: 'Prateleira FE-02', obs: 'Portas corta-fogo e sociais' },
        { codigo: 'MAT-016', material: 'Detergente desengraxante industrial alcalino (Bombona 20L)', categoria: 'Limpeza', unid: 'un', atual: 4, minimo: 6, maximo: 18, consumoMensal: 8, fornecedorId: 'G08', ultimoPreco: 160.00, local: 'Depósito Q-01', obs: 'Limpeza pesada de pisos de galpão' },
      ],

      /* Movimentações de estoque registradas */
      movimentos: [
        { id: 'MOV-0001', data: d(-14), codigo: 'MAT-003', tipo: 'Entrada', qtd: 80, ref: 'PC-0001', responsavel: 'Carlos Mendes', obs: 'Recebimento de pedido de reposição' },
        { id: 'MOV-0002', data: d(-10), codigo: 'MAT-003', tipo: 'Saída', qtd: 18, ref: 'OS-8821', responsavel: 'Oficial Eletricista', obs: 'Substituição luminárias Mercado Livre RC01' },
        { id: 'MOV-0003', data: d(-8), codigo: 'MAT-001', tipo: 'Saída', qtd: 4, ref: 'OS-8834', responsavel: 'Oficial Eletricista', obs: 'Adequação infraestrutura Cajamar' },
        { id: 'MOV-0004', data: d(-5), codigo: 'MAT-006', tipo: 'Saída', qtd: 3, ref: 'OS-8850', responsavel: 'Oficial Pintor', obs: 'Demarcação de vagas Rochaverá' },
        { id: 'MOV-0005', data: d(-2), codigo: 'MAT-008', tipo: 'Saída', qtd: 10, ref: 'ENTREGA-EPI', responsavel: 'Segurança Trabalho', obs: 'Distribuição mensal de EPI equipe civil' },
      ],

      /* Solicitações de Compras (SCs) */
      solicitacoes: [
        {
          id: 'SC-0001', data: d(-18), solicitante: 'Paulo Assis', area: 'Diretoria de Operações',
          cliente: 'Mercado Livre', centroCusto: 'Meli RC01', localEntrega: 'Perus/SP',
          categoria: 'Metais', descricao: 'Cantoneira de ferro 1 1/2" x 1/8"', especificacao: 'Barra 6m - reforço de batente das docas',
          qtd: 10, unid: 'barra', prioridade: 'Normal', status: 'Comprada',
          dataNecessidade: d(-8), obs: 'Atendimento emergencial pós-colisão de empilhadeira', itemCodigo: 'MAT-014'
        },
        {
          id: 'SC-0002', data: d(-16), solicitante: 'Carlos Mendes', area: 'Supervisão de Manutenção',
          cliente: 'Galpão Cajamar', centroCusto: 'GL-Cajamar', localEntrega: 'Cajamar/SP',
          categoria: 'Elétrica', descricao: 'Lâmpada tubular LED T8 18W 120cm Bivolt', especificacao: 'Temperatura 6500K Bivolt com selo Procel',
          qtd: 60, unid: 'un', prioridade: 'Normal', status: 'Comprada',
          dataNecessidade: d(-5), obs: 'Reposição para corredor 4', itemCodigo: 'MAT-003'
        },
        {
          id: 'SC-0003', data: d(-12), solicitante: 'Renato Dias', area: 'Oficial Hidráulico',
          cliente: 'Condomínio Rochaverá', centroCusto: 'ROCH-PRED', localEntrega: 'Morumbi/SP',
          categoria: 'Hidráulica', descricao: 'Reparo para válvula Hydra Max 1 1/2"', especificacao: 'Original Deca ref. 4686.004',
          qtd: 12, unid: 'un', prioridade: 'Alta', status: 'Comprada',
          dataNecessidade: d(-2), obs: 'Vazamentos recorrentes no bloco C', itemCodigo: 'MAT-005'
        },
        {
          id: 'SC-0004', data: d(-10), solicitante: 'Juliana Silva', area: 'Compras / Almoxarifado',
          cliente: 'GHC Facilities Central', centroCusto: 'ALMOX-CENTRAL', localEntrega: 'Barueri/SP',
          categoria: 'EPI', descricao: 'Luva de segurança vaqueta mista cano curto', especificacao: 'Vaqueta dorso raspa tamanho G CA 13420',
          qtd: 40, unid: 'par', prioridade: 'Alta', status: 'Aprovada',
          dataNecessidade: d(2), obs: 'Estoque atingiu nível crítico', itemCodigo: 'MAT-008'
        },
        {
          id: 'SC-0005', data: d(-7), solicitante: 'Carlos Mendes', area: 'Supervisão de Manutenção',
          cliente: 'Mercado Livre', centroCusto: 'Meli RC02', localEntrega: 'Santana de Parnaíba/SP',
          categoria: 'Metais', descricao: 'Tubo Metalon quadrado 50x50mm chapa 16 (Barra 6m)', especificacao: 'Galvanizado a fogo para guarda-corpo externo',
          qtd: 16, unid: 'barra', prioridade: 'Urgente', status: 'Aguardando aprovação',
          dataNecessidade: d(1), obs: 'Exigência da CIPA para liberação de acesso externo', itemCodigo: 'MAT-013'
        },
        {
          id: 'SC-0006', data: d(-5), solicitante: 'Marcos Vinicius', area: 'Oficial Serralheiro',
          cliente: 'CD B2W Louveira', centroCusto: 'CD-LOUV', localEntrega: 'Louveira/SP',
          categoria: 'Fixadores', descricao: 'Chumbador parabolt CBA 3/8" x 3"', especificacao: 'Aço carbono zincado com arruela e porca',
          qtd: 100, unid: 'un', prioridade: 'Normal', status: 'Em cotação',
          dataNecessidade: d(5), obs: 'Fixação de protetores de coluna', itemCodigo: 'MAT-012'
        },
        {
          id: 'SC-0007', data: d(-4), solicitante: 'Valéria Meireles', area: 'Supervisão de Limpeza',
          cliente: 'Hospital Alvorada', centroCusto: 'HOSP-FAC', localEntrega: 'Moema/SP',
          categoria: 'Limpeza', descricao: 'Detergente desengraxante industrial alcalino (Bombona 20L)', especificacao: 'Biodegradável alto rendimento 1:50',
          qtd: 8, unid: 'un', prioridade: 'Alta', status: 'Em cotação',
          dataNecessidade: d(3), obs: 'Limpeza pesada de subsolo e gerador', itemCodigo: 'MAT-016'
        },
        {
          id: 'SC-0008', data: d(-2), solicitante: 'Oficial Eletricista', area: 'Manutenção Elétrica',
          cliente: 'Shopping Eldorado', centroCusto: 'SHOP-ELD', localEntrega: 'Pinheiros/SP',
          categoria: 'Elétrica', descricao: 'Cabo flexível 2,5 mm² antichama (Rolo 100m)', especificacao: '750V cor azul claro e preto selo Inmetro',
          qtd: 10, unid: 'rolo', prioridade: 'Normal', status: 'Aberta',
          dataNecessidade: d(7), obs: 'Reforma de iluminação de emergência setor doca', itemCodigo: 'MAT-001'
        },
        {
          id: 'SC-0009', data: d(-1), solicitante: 'Roberto Santos', area: 'Gerência de Facilities',
          cliente: 'Condomínio Rochaverá', centroCusto: 'ROCH-PRED', localEntrega: 'Morumbi/SP',
          categoria: 'Pintura', descricao: 'Tinta acrílica fosca branca Premium (Lata 18L)', especificacao: 'Resistente a intempéries Suvinil ou Coral',
          qtd: 6, unid: 'lata', prioridade: 'Normal', status: 'Aberta',
          dataNecessidade: d(10), obs: 'Pintura de fachada interna bloco B', itemCodigo: 'MAT-006'
        },
      ],

      /* Cotações comparativas (Mapa de Cotação) */
      cotacoes: [
        {
          id: 'COT-0001', scId: 'SC-0001', data: d(-17), compradora: 'Juliana Silva',
          ofertas: [
            { fornecedorId: 'G01', valor: 92.00, frete: 40.00, prazo: 3, pagamento: 'Boleto 28 dias' },
            { fornecedorId: 'G10', valor: 98.00, frete: 50.00, prazo: 5, pagamento: 'Boleto 28 dias' },
            { fornecedorId: 'G06', valor: 105.00, frete: 0.00, prazo: 6, pagamento: 'Boleto 14 dias' },
          ],
          escolhida: 0, justificativa: 'Menor preço total e menor prazo de entrega garantido.',
          status: 'Aprovada', nivelRequerido: 1,
          historico: [
            { data: d(-17), usuario: 'Juliana Silva', acao: 'Cotação finalizada', obs: '3 fornecedores cotados' },
            { data: d(-16), usuario: 'Carlos Mendes', acao: 'Aprovado', obs: 'Alçada de supervisão OK' },
          ]
        },
        {
          id: 'COT-0002', scId: 'SC-0002', data: d(-15), compradora: 'Juliana Silva',
          ofertas: [
            { fornecedorId: 'G02', valor: 14.80, frete: 0.00, prazo: 2, pagamento: 'Boleto 28 dias' },
            { fornecedorId: 'G05', valor: 16.50, frete: 30.00, prazo: 4, pagamento: 'Boleto 14 dias' },
            { fornecedorId: 'G07', valor: 17.20, frete: 25.00, prazo: 5, pagamento: 'Boleto 28 dias' },
          ],
          escolhida: 0, justificativa: 'Frete grátis e menor preço unitário com faturamento direto.',
          status: 'Aprovada', nivelRequerido: 1,
          historico: [
            { data: d(-15), usuario: 'Juliana Silva', acao: 'Cotação finalizada', obs: '3 fornecedores cotados' },
            { data: d(-14), usuario: 'Carlos Mendes', acao: 'Aprovado', obs: 'Dentro da alçada de R$ 2.000' },
          ]
        },
        {
          id: 'COT-0003', scId: 'SC-0003', data: d(-11), compradora: 'Juliana Silva',
          ofertas: [
            { fornecedorId: 'G03', valor: 46.00, frete: 20.00, prazo: 2, pagamento: 'Boleto 14 dias' },
            { fornecedorId: 'G06', valor: 49.50, frete: 15.00, prazo: 3, pagamento: 'Boleto 14 dias' },
          ],
          escolhida: 0, justificativa: 'Fornecedor G03 possui pronta entrega das peças originais Deca.',
          status: 'Aprovada', nivelRequerido: 1,
          historico: [
            { data: d(-11), usuario: 'Juliana Silva', acao: 'Cotação finalizada', obs: '2 fornecedores (terceiro sem estoque)' },
            { data: d(-10), usuario: 'Carlos Mendes', acao: 'Aprovado', obs: 'Valor R$ 572,00 aprovado por supervisão' },
          ]
        },
        {
          id: 'COT-0004', scId: 'SC-0004', data: d(-9), compradora: 'Juliana Silva',
          ofertas: [
            { fornecedorId: 'G05', valor: 22.00, frete: 25.00, prazo: 3, pagamento: 'Boleto 28 dias' },
            { fornecedorId: 'G08', valor: 24.50, frete: 30.00, prazo: 4, pagamento: 'Boleto 14 dias' },
            { fornecedorId: 'G07', valor: 26.00, frete: 0.00, prazo: 5, pagamento: 'Boleto 28 dias' },
          ],
          escolhida: 0, justificativa: 'Melhor preço mesmo considerando frete. Material atende especificação do SESMT.',
          status: 'Aprovada', nivelRequerido: 1,
          historico: [
            { data: d(-9), usuario: 'Juliana Silva', acao: 'Cotação finalizada', obs: 'Enviada para aprovação' },
            { data: d(-8), usuario: 'Carlos Mendes', acao: 'Aprovado', obs: 'Valor R$ 905,00 aprovado' },
          ]
        },
        {
          id: 'COT-0005', scId: 'SC-0005', data: d(-6), compradora: 'Juliana Silva',
          ofertas: [
            { fornecedorId: 'G01', valor: 145.00, frete: 120.00, prazo: 4, pagamento: 'Boleto 28 dias' }, // Total R$ 2.440
            { fornecedorId: 'G10', valor: 152.00, frete: 90.00, prazo: 3, pagamento: 'Boleto 28 dias' },  // Total R$ 2.522
            { fornecedorId: 'G06', valor: 160.00, frete: 80.00, prazo: 6, pagamento: 'Boleto 14 dias' },  // Total R$ 2.640
          ],
          escolhida: 0, justificativa: 'Menor custo total (economia de R$ 200 vs terceira cotação). Prazo atende a necessidade.',
          status: 'Aguardando aprovação', nivelRequerido: 2, // Acima de R$ 2.000 -> Exige Gerente!
          historico: [
            { data: d(-6), usuario: 'Juliana Silva', acao: 'Cotação finalizada', obs: 'Valor R$ 2.440,00 requer aprovação do Gerente de Facilities' },
          ]
        },
        {
          id: 'COT-0006', scId: 'SC-0006', data: d(-4), compradora: 'Juliana Silva',
          ofertas: [
            { fornecedorId: 'G06', valor: 6.80, frete: 20.00, prazo: 2, pagamento: 'Boleto 14 dias' },
            { fornecedorId: 'G01', valor: 7.50, frete: 35.00, prazo: 4, pagamento: 'Boleto 28 dias' },
          ],
          escolhida: 0, justificativa: 'Aguardando terceira cotação para validação.',
          status: 'Em cotação', nivelRequerido: 1,
          historico: [
            { data: d(-4), usuario: 'Juliana Silva', acao: 'Em andamento', obs: 'Solicitada cotação para Atlas Ferragens' },
          ]
        },
      ],

      /* Pedidos de Compra (PCs) */
      pedidos: [
        {
          id: 'PC-0001', scId: 'SC-0001', cotId: 'COT-0001', data: d(-16), compradora: 'Juliana Silva',
          fornecedorId: 'G01', cliente: 'Mercado Livre', centroCusto: 'Meli RC01',
          descricao: 'Cantoneira de ferro 1 1/2" x 1/8" (Barra 6m)', qtd: 10, unid: 'barra',
          valorUnit: 92.00, valorProdutos: 920.00, frete: 40.00, status: 'Recebido',
          previsao: d(-13), pagamento: 'Boleto 28 dias', localEntrega: 'Perus/SP',
          responsavelRecebimento: 'Paulo Assis', transportadora: 'Própria do Fornecedor',
          obs: 'Entregue com nota fiscal no almoxarifado de Perus',
          recebimentos: [
            { data: d(-13), qtd: 10, nf: 'NF-10492', valorNF: 960.00, responsavel: 'Paulo Assis' }
          ]
        },
        {
          id: 'PC-0002', scId: 'SC-0002', cotId: 'COT-0002', data: d(-14), compradora: 'Juliana Silva',
          fornecedorId: 'G02', cliente: 'Galpão Cajamar', centroCusto: 'GL-Cajamar',
          descricao: 'Lâmpada tubular LED T8 18W 120cm Bivolt', qtd: 60, unid: 'un',
          valorUnit: 14.80, valorProdutos: 888.00, frete: 0.00, status: 'Recebido',
          previsao: d(-12), pagamento: 'Boleto 28 dias', localEntrega: 'Cajamar/SP',
          responsavelRecebimento: 'Carlos Mendes', transportadora: 'Expresso Mercurio',
          obs: 'Conferido 100% dos itens sem avarias',
          recebimentos: [
            { data: d(-11), qtd: 60, nf: 'NF-89211', valorNF: 888.00, responsavel: 'Carlos Mendes' } // Entregue 1 dia após a previsão (Atraso real!)
          ]
        },
        {
          id: 'PC-0003', scId: 'SC-0003', cotId: 'COT-0003', data: d(-10), compradora: 'Juliana Silva',
          fornecedorId: 'G03', cliente: 'Condomínio Rochaverá', centroCusto: 'ROCH-PRED',
          descricao: 'Reparo para válvula Hydra Max 1 1/2"', qtd: 12, unid: 'un',
          valorUnit: 46.00, valorProdutos: 552.00, frete: 20.00, status: 'Recebido parcial',
          previsao: d(-4), pagamento: 'Boleto 14 dias', localEntrega: 'Morumbi/SP',
          responsavelRecebimento: 'Renato Dias', transportadora: 'Motoboy Express',
          obs: 'Fornecedor entregou 8 unidades imediatas; saldo de 4 unidades em trânsito',
          recebimentos: [
            { data: d(-7), qtd: 8, nf: 'NF-3490', valorNF: 388.00, responsavel: 'Renato Dias' }
          ]
        },
        {
          id: 'PC-0004', scId: 'SC-0004', cotId: 'COT-0004', data: d(-8), compradora: 'Juliana Silva',
          fornecedorId: 'G05', cliente: 'GHC Facilities Central', centroCusto: 'ALMOX-CENTRAL',
          descricao: 'Luva de segurança vaqueta mista cano curto', qtd: 40, unid: 'par',
          valorUnit: 22.00, valorProdutos: 880.00, frete: 25.00, status: 'Pedido emitido',
          previsao: d(-2), pagamento: 'Boleto 28 dias', localEntrega: 'Barueri/SP',
          responsavelRecebimento: 'Juliana Silva', transportadora: 'Braspress',
          obs: 'Pedido emitido, previsão original era há 2 dias -> ATRASADO!',
          recebimentos: []
        },
      ],

      /* Avaliações de Desempenho dos Fornecedores */
      avaliacoes: [
        { id: 'AV-0001', data: d(-13), fornecedorId: 'G01', pedidoId: 'PC-0001', preco: 9, prazo: 10, qualidade: 10, atendimento: 9, documentacao: 10, responsavel: 'Paulo Assis', comentarios: 'Material entregue exatamente no prazo combinado, laudo do aço acompanhou a NF.' },
        { id: 'AV-0002', data: d(-11), fornecedorId: 'G02', pedidoId: 'PC-0002', preco: 10, prazo: 7, qualidade: 9, atendimento: 8, documentacao: 10, responsavel: 'Carlos Mendes', comentarios: 'Atrasou 1 dia da data prometida na cotação, porém excelente preço e lâmpadas intactas.' },
        { id: 'AV-0003', data: d(-7), fornecedorId: 'G03', pedidoId: 'PC-0003', preco: 8, prazo: 6, qualidade: 9, atendimento: 7, documentacao: 8, responsavel: 'Renato Dias', comentarios: 'Entregou parcial porque faltaram 4 reparos no estoque deles. Aguardando complemento.' },
      ],
    };
  }
};
