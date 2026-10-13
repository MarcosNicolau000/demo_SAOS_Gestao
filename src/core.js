'use strict';
/* =====================================================================
   GHC GESTÃO — NÚCLEO (contrato compartilhado por todos os módulos)
   ---------------------------------------------------------------------
   Globais expostos:  U (utilitários) · Icon · Store · Rules · UI · App
   Módulos registram páginas com App.register({...}) — veja o fim do arquivo.
   ===================================================================== */

/* ---------------------------------------------------------------------
   U — utilitários de formatação, datas e strings
   --------------------------------------------------------------------- */
const U = {
  // Formata número como moeda brasileira
  brl(n) { return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
  // Moeda abreviada para KPIs (R$ 18,4 mil)
  brlShort(n) {
    n = Number(n) || 0;
    if (Math.abs(n) >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (Math.abs(n) >= 1e4) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return U.brl(n);
  },
  // Número com casas decimais no padrão pt-BR
  num(n, d = 0) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); },
  // Percentual a partir de fração (0.123 -> 12,3%)
  pct(n, d = 1) { return ((Number(n) || 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; },
  // Data de hoje em ISO local (YYYY-MM-DD)
  today() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); },
  // Soma dias a uma data ISO
  addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); },
  // Diferença em dias (b - a)
  diffDays(a, b) { if (!a || !b) return 0; return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5); },
  // ISO -> dd/mm/aaaa
  date(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—'; },
  // Chave de mês (YYYY-MM)
  monthKey(iso) { return iso ? String(iso).slice(0, 7) : ''; },
  MONTHS: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  monthLabel(key) { const [y, m] = key.split('-'); return U.MONTHS[+m - 1] + '/' + y.slice(2); },
  // Escapa HTML (SEMPRE usar ao interpolar texto digitado pelo usuário)
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  // Converte "1.234,56" ou "1234.56" em número
  parseNum(v) {
    if (typeof v === 'number') return v;
    if (v == null || v === '') return 0;
    const s = String(v).trim();
    const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
    return isNaN(n) ? 0 : n;
  },
  // Normaliza texto para busca (sem acento, minúsculo)
  norm(s) { return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); },
  // Busca textual em vários campos
  match(q, ...fields) { if (!q) return true; const n = U.norm(q); return fields.some(f => U.norm(f).includes(n)); },
  // Soma por função
  sum(arr, fn) { return arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0); },
  // Agrupa em objeto
  groupBy(arr, fn) { return arr.reduce((acc, x) => { const k = fn(x); (acc[k] ||= []).push(x); return acc; }, {}); },
  // Iniciais de um nome
  initials(name) { return String(name || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase(); },
  // Debounce para buscas
  debounce(fn, ms = 180) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
  // Download de arquivo gerado no navegador
  download(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
};

/* ---------------------------------------------------------------------
   Icon — ícones SVG em traço (estilo Lucide). Uso: Icon('box')
   --------------------------------------------------------------------- */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  filePlus: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15h6"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62L18.3 9.38a1 1 0 0 0-.78-.38H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  trendUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
};
function Icon(name, attrs = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs}>${ICONS[name] || ICONS.info}</svg>`;
}

/* ---------------------------------------------------------------------
   Store — banco de dados em memória persistido no localStorage
   ---------------------------------------------------------------------
   Store.db = {
     version, config:{ usuarioId },
     usuarios:     [{ id, nome, perfil, nivel }]                    nivel 0=Compras, 1..3 = alçada
     solicitacoes: [{ id:'SC-0001', data, solicitante, area, cliente, centroCusto, localEntrega,
                      categoria, descricao, especificacao, qtd, unid, prioridade, status,
                      dataNecessidade, obs, itemCodigo? }]
     cotacoes:     [{ id:'COT-0001', scId, data, compradora,
                      ofertas:[{ fornecedorId, valor (UNITÁRIO), frete, prazo (dias), pagamento }] (até 3),
                      escolhida (índice da oferta), justificativa,
                      status:'Em cotação'|'Aguardando aprovação'|'Aprovada'|'Reprovada',
                      nivelRequerido, historico:[{ data, usuario, acao, obs }] }]
     pedidos:      [{ id:'PC-0001', scId, cotId, data, compradora, fornecedorId, cliente, centroCusto,
                      descricao, qtd, unid, valorUnit, valorProdutos, frete, status, previsao, pagamento,
                      localEntrega, responsavelRecebimento, transportadora, obs,
                      recebimentos:[{ data, qtd, nf, valorNF, responsavel }] }]
     fornecedores: [{ id:'G01', razao, fantasia, cnpj, categoria, contato, telefone, email, cidade,
                      status, prazoMedio, pagamento, obs }]
     avaliacoes:   [{ id:'AV-0001', data, fornecedorId, pedidoId, preco, prazo, qualidade, atendimento,
                      documentacao, responsavel, comentarios }]               notas 0..10
     estoque:      [{ codigo:'MAT-001', material, categoria, unid, atual, minimo, maximo,
                      consumoMensal, fornecedorId, ultimoPreco, local, obs }]
     movimentos:   [{ id:'MOV-0001', data, codigo, tipo:'Entrada'|'Saída', qtd, ref, responsavel, obs }]
   }
   Fluxo de mutação: altere Store.db.* e chame Store.commit('mensagem opcional').
   --------------------------------------------------------------------- */
const STORAGE_KEY = 'ghc-gestao-erp-v1';
const Store = {
  db: null,
  // Carrega do navegador ou gera dados de demonstração
  load() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* modo privado */ }
    try { this.db = raw ? JSON.parse(raw) : Seed.build(); } catch (e) { this.db = Seed.build(); }
    if (!raw) this.save();
  },
  // Persiste no localStorage
  save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db)); } catch (e) { /* cota/privado */ } },
  // Salva, re-renderiza a página atual e opcionalmente mostra um toast
  commit(msg, type = 'success') { this.save(); App.rerender(); if (msg) UI.toast(msg, type); },
  // Restaura os dados de demonstração
  reset() { this.db = Seed.build(); this.save(); App.rerender(); UI.toast('Dados de demonstração restaurados.', 'success'); },
  // Gera o próximo ID sequencial (SC-0042, PC-0010...)
  nextId(prefix, list, field = 'id', pad = 4) {
    let max = 0;
    for (const x of list) { const m = String(x[field] || '').match(/(\d+)$/); if (m) max = Math.max(max, +m[1]); }
    return prefix + String(max + 1).padStart(pad, '0');
  },
  // Usuário logado (simulado)
  user() { return this.db.usuarios.find(u => u.id === this.db.config.usuarioId) || this.db.usuarios[0]; },
  // Buscas rápidas por ID
  sc(id) { return this.db.solicitacoes.find(x => x.id === id); },
  cot(id) { return this.db.cotacoes.find(x => x.id === id); },
  cotBySc(scId) { return this.db.cotacoes.find(x => x.scId === scId); },
  pedido(id) { return this.db.pedidos.find(x => x.id === id); },
  pedidoByCot(cotId) { return this.db.pedidos.find(x => x.cotId === cotId); },
  pedidoBySc(scId) { return this.db.pedidos.find(x => x.scId === scId); },
  fornecedor(id) { return this.db.fornecedores.find(x => x.id === id); },
  fornecedorNome(id) { const f = this.fornecedor(id); return f ? (f.fantasia || f.razao) : '—'; },
  item(codigo) { return this.db.estoque.find(x => x.codigo === codigo); },
};

/* ---------------------------------------------------------------------
   Rules — regras de negócio PURAS (fórmulas da planilha, corrigidas)
   --------------------------------------------------------------------- */
const Rules = {
  // Listas de domínio (mesmos valores das validações da planilha)
  PRIORIDADES: ['Normal', 'Alta', 'Urgente'],
  STATUS_SC: ['Aberta', 'Em cotação', 'Aguardando aprovação', 'Aprovada', 'Comprada', 'Cancelada'],
  STATUS_COT: ['Em cotação', 'Aguardando aprovação', 'Aprovada', 'Reprovada'],
  STATUS_PEDIDO: ['Aguardando aprovação', 'Aprovado', 'Pedido emitido', 'Recebido parcial', 'Recebido', 'Cancelado'],
  STATUS_FORNECEDOR: ['Ativo', 'Em homologação', 'Bloqueado', 'Inativo'],
  CATEGORIAS: ['Metais', 'Elétrica', 'Hidráulica', 'Pintura', 'EPI', 'Fixadores', 'Ferragens', 'Limpeza', 'Serviços', 'Spot'],
  UNIDADES: ['un', 'm', '6m', 'kg', 'par', 'cento', 'lata', 'galão', 'rolo', 'barra', 'cx', 'serviço'],
  PAGAMENTOS: ['À vista', 'PIX', 'Boleto 14 dias', 'Boleto 28 dias', '28/56 dias', 'Cartão corporativo'],

  // Alçadas de aprovação por valor total da compra
  ALCADAS: [
    { nivel: 1, nome: 'Supervisão', limite: 2000 },
    { nivel: 2, nome: 'Gerência', limite: 10000 },
    { nivel: 3, nome: 'Diretoria', limite: Infinity },
  ],
  // Retorna a alçada exigida para um valor
  alcada(valor) { return this.ALCADAS.find(a => (Number(valor) || 0) <= a.limite); },
  // Usuário pode aprovar? (nível dele >= nível exigido)
  podeAprovar(usuario, cot) { return !!usuario && usuario.nivel >= (cot.nivelRequerido || 1); },

  // Total de uma oferta = valor unitário × qtd + frete (null se oferta vazia)
  ofertaTotal(o, qtd) {
    const v = Number(o?.valor) || 0;
    if (!o || !o.fornecedorId || v <= 0) return null;
    return v * (Number(qtd) || 0) + (Number(o.frete) || 0);
  },
  /* Análise de cotação.
     CORREÇÃO vs planilha: a planilha calculava economia = MAX(0, menor − escolhida),
     que é sempre 0. Aqui economia = maior cotação válida − escolhida (economia negociada). */
  cotacao(cot) {
    const sc = Store.sc(cot.scId);
    const qtd = Number(sc?.qtd) || 0;
    const totais = (cot.ofertas || []).map(o => this.ofertaTotal(o, qtd));
    const validos = totais.map((t, i) => ({ t, i })).filter(x => x.t != null);
    const base = { qtd, totais, validas: validos.length, menor: 0, maior: 0, media: 0, menorIdx: -1, escolhidaIdx: -1, escolhido: 0, economia: 0, economiaPct: 0, diffMenor: 0, precisaJustificativa: false };
    if (!validos.length) return base;
    const menorX = validos.reduce((a, b) => (b.t < a.t ? b : a));
    const maior = Math.max(...validos.map(x => x.t));
    const escolhidaIdx = cot.escolhida != null && totais[cot.escolhida] != null ? Number(cot.escolhida) : menorX.i;
    const escolhido = totais[escolhidaIdx];
    const economia = Math.max(0, maior - escolhido);
    return {
      ...base,
      menor: menorX.t, maior, media: U.sum(validos, x => x.t) / validos.length,
      menorIdx: menorX.i, escolhidaIdx, escolhido,
      economia, economiaPct: maior ? economia / maior : 0,
      diffMenor: escolhido - menorX.t,
      // Justificativa exigida quando há menos de 3 cotações ou quando não se escolhe a menor
      precisaJustificativa: validos.length < 3 || escolhidaIdx !== menorX.i,
    };
  },

  // Valor total do pedido (produtos + frete)
  pedidoTotal(p) { return (Number(p.valorProdutos) || 0) + (Number(p.frete) || 0); },
  // Quantidade já recebida
  qtdRecebida(p) { return U.sum(p.recebimentos || [], r => r.qtd); },
  // Data do último recebimento
  ultimaEntrega(p) { const r = (p.recebimentos || []).map(x => x.data).sort(); return r[r.length - 1] || null; },
  /* Situação de prazo da entrega.
     CORREÇÃO vs planilha: (1) linhas sem previsão não viram "Atrasada";
     (2) entrega feita depois da previsão aparece como "Entregue com atraso". */
  entrega(p, hoje = U.today()) {
    if (p.status === 'Cancelado') return { situacao: 'Cancelada', dias: 0, aberta: false, atrasada: false };
    const rec = this.qtdRecebida(p);
    const completa = Number(p.qtd) > 0 && rec >= Number(p.qtd);
    if (completa || p.status === 'Recebido') {
      const ult = this.ultimaEntrega(p);
      const dias = p.previsao && ult ? U.diffDays(p.previsao, ult) : 0;
      return dias > 0
        ? { situacao: 'Entregue com atraso', dias, aberta: false, atrasada: true, dataEntrega: ult }
        : { situacao: 'Entregue no prazo', dias: 0, aberta: false, atrasada: false, dataEntrega: ult };
    }
    if (p.previsao && p.previsao < hoje) {
      return { situacao: rec > 0 ? 'Parcial em atraso' : 'Atrasada', dias: U.diffDays(p.previsao, hoje), aberta: true, atrasada: true };
    }
    const faltam = p.previsao ? U.diffDays(hoje, p.previsao) : null;
    return { situacao: rec > 0 ? 'Recebido parcial' : 'No prazo', dias: 0, faltam, aberta: true, atrasada: false };
  },

  /* Estoque.
     CORREÇÃO vs planilha: ponto de pedido = mínimo + consumo diário × prazo REAL do fornecedor
     (a planilha usava mínimo + consumo/2, assumindo 15 dias para todos) e itens vazios não geram alerta. */
  estoque(item) {
    const forn = Store.fornecedor(item.fornecedorId);
    const prazo = Number(forn?.prazoMedio) || 7;
    const consumoDia = (Number(item.consumoMensal) || 0) / 30;
    const pontoPedido = Math.ceil((Number(item.minimo) || 0) + consumoDia * prazo);
    const atual = Number(item.atual) || 0;
    const comprar = atual <= pontoPedido;
    const critico = atual < (Number(item.minimo) || 0);
    return {
      prazo, consumoDia, pontoPedido, comprar, critico,
      status: critico ? 'Crítico' : comprar ? 'Comprar' : 'OK',
      sugestao: Math.max(0, Math.ceil((Number(item.maximo) || 0) - atual)),
      valor: atual * (Number(item.ultimoPreco) || 0),
      coberturaDias: consumoDia > 0 ? Math.floor(atual / consumoDia) : null,
      ocupacao: item.maximo ? Math.min(1, atual / item.maximo) : 0,
    };
  },

  // Nota final de uma avaliação (média dos 5 critérios)
  notaAvaliacao(a) {
    const v = [a.preco, a.prazo, a.qualidade, a.atendimento, a.documentacao].map(Number).filter(n => !isNaN(n));
    return v.length ? U.sum(v, x => x) / v.length : 0;
  },
  // Nota média do fornecedor (alimenta o cadastro automaticamente)
  notaFornecedor(fornecedorId) {
    const av = Store.db.avaliacoes.filter(a => a.fornecedorId === fornecedorId);
    if (!av.length) return { nota: null, total: 0, criterios: null };
    const avg = k => U.sum(av, a => a[k]) / av.length;
    return {
      nota: U.sum(av, a => this.notaAvaliacao(a)) / av.length, total: av.length,
      criterios: { preco: avg('preco'), prazo: avg('prazo'), qualidade: avg('qualidade'), atendimento: avg('atendimento'), documentacao: avg('documentacao') },
    };
  },
};

/* ---------------------------------------------------------------------
   UI — componentes que retornam HTML (strings) + modal/toast/confirm
   --------------------------------------------------------------------- */
const BADGE_MAP = {
  success: ['Aprovada', 'Aprovado', 'Comprada', 'Recebido', 'Entregue no prazo', 'No prazo', 'OK', 'Ativo', 'Entregue', 'Entrada'],
  warning: ['Aguardando aprovação', 'Em cotação', 'Recebido parcial', 'Alta', 'Em homologação', 'Comprar', 'Programada', 'Em trânsito'],
  error: ['Cancelada', 'Cancelado', 'Atrasada', 'Parcial em atraso', 'Entregue com atraso', 'Urgente', 'Crítico', 'Bloqueado', 'Reprovada', 'Saída'],
  info: ['Aberta', 'Pedido emitido'],
  neutral: ['Normal', 'Inativo'],
};
const UI = {
  // Badge colorido automaticamente pelo texto do status (ou variante forçada)
  badge(text, variant) {
    if (!variant) variant = Object.keys(BADGE_MAP).find(k => BADGE_MAP[k].includes(text)) || 'neutral';
    return `<span class="badge badge-${variant}">${U.esc(text)}</span>`;
  },
  // Cabeçalho padrão das páginas
  pageHead({ eyebrow = '', title, sub = '', actions = '' }) {
    return `<div class="page-head"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  },
  // Botão: UI.btn('Novo', {icon:'plus', variant:'primary', onclick:"Mod.fn()"})
  btn(label, { icon, variant = '', size = '', onclick = '', attrs = '', title = '' } = {}) {
    const cls = ['btn', variant && 'btn-' + variant, size && 'btn-' + size].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" ${onclick ? `onclick="${onclick}"` : ''} ${title ? `title="${U.esc(title)}"` : ''} ${attrs}>${icon ? Icon(icon) : ''}${label}</button>`;
  },
  // Card KPI (tone 'dark' = navy do DESIGN.md, 'light' = branco)
  kpi({ label, value, note = '', icon = 'chart', tone = 'dark' }) {
    return `<div class="kpi kpi-${tone}"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-icon">${Icon(icon)}</span></div><div class="kpi-value">${value}</div><div class="kpi-note">${note}</div></div>`;
  },
  /* Tabela: UI.table({ columns:[{label, render:(row)=>html, align:'right', width}], rows,
     empty:'texto', onRow:'Mod.abrir' (recebe row[rowKey]), rowKey:'id', foot: html opcional }) */
  table({ columns, rows, empty = 'Nenhum registro encontrado.', onRow = '', rowKey = 'id', foot = '' }) {
    const head = columns.map(c => `<th class="${c.align === 'right' ? 't-right' : c.align === 'center' ? 't-center' : ''}" ${c.width ? `style="width:${c.width}"` : ''}>${c.label}</th>`).join('');
    const body = rows.length
      ? rows.map(r => `<tr ${onRow ? `class="clickable" onclick="${onRow}('${U.esc(r[rowKey])}')"` : ''}>${columns.map(c => `<td class="${c.align === 'right' ? 't-right' : c.align === 'center' ? 't-center' : ''}">${c.render ? c.render(r) : U.esc(r[c.key])}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${columns.length}"><div class="empty">${Icon('search')}${empty}</div></td></tr>`;
    return `<div class="table-wrap"><table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;
  },
  /* Campo de formulário:
     UI.field({ name, label, type:'text'|'number'|'date'|'select'|'textarea'|'email', value, options:[str|{value,label}],
                required, full, placeholder, step, min, max, readonly, hint, attrs }) */
  field({ name, label, type = 'text', value = '', options = [], required = false, full = false, placeholder = '', step, min, max, readonly = false, hint = '', attrs = '' }) {
    const req = required ? 'required' : '';
    const common = `name="${name}" id="f_${name}" ${req} ${readonly ? 'readonly' : ''} ${attrs}`;
    let input;
    if (type === 'select') {
      const opts = options.map(o => {
        const v = typeof o === 'object' ? o.value : o; const l = typeof o === 'object' ? o.label : o;
        return `<option value="${U.esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${U.esc(l)}</option>`;
      }).join('');
      input = `<select ${common} ${readonly ? 'disabled' : ''}>${placeholder ? `<option value="">${U.esc(placeholder)}</option>` : ''}${opts}</select>`;
    } else if (type === 'textarea') {
      input = `<textarea ${common} placeholder="${U.esc(placeholder)}">${U.esc(value)}</textarea>`;
    } else {
      input = `<input type="${type}" ${common} value="${U.esc(value)}" placeholder="${U.esc(placeholder)}" ${step != null ? `step="${step}"` : ''} ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}>`;
    }
    return `<div class="field ${full ? 'full' : ''}"><label for="f_${name}">${label}${required ? ' <span class="req">*</span>' : ''}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  },
  // Lê todos os campos nomeados de um form como objeto (números continuam string — use U.parseNum)
  formValues(form) {
    const out = {};
    form.querySelectorAll('[name]').forEach(el => { out[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    return out;
  },
  /* Modal com formulário:
     UI.modal({ title, sub, body (html), size:'md'|'lg'|'xl', submitLabel:'Salvar', cancelLabel:'Cancelar',
                hideSubmit:false, extraFoot:'html',
                onOpen:(form)=>{}, onSubmit:(values, form, close)=>{ return false para manter aberto } })
     Retorna { close, form }. */
  modal({ title, sub = '', body = '', size = 'md', submitLabel = 'Salvar', cancelLabel = 'Cancelar', hideSubmit = false, extraFoot = '', onOpen, onSubmit }) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<form class="modal ${size}" novalidate>
      <div class="modal-head"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Fechar">${Icon('x')}</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${extraFoot}<button type="button" class="btn btn-ghost" data-close>${cancelLabel}</button>${hideSubmit ? '' : `<button type="submit" class="btn btn-primary">${submitLabel}</button>`}</div>
    </form>`;
    const form = wrap.querySelector('form');
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    form.addEventListener('submit', e => {
      e.preventDefault();
      // Validação nativa dos campos required
      const invalid = [...form.querySelectorAll('[required]')].find(el => !String(el.value).trim());
      if (invalid) { invalid.focus(); UI.toast('Preencha os campos obrigatórios.', 'error'); return; }
      if (!onSubmit) return close();
      const keep = onSubmit(UI.formValues(form), form, close);
      if (keep !== false) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    if (onOpen) onOpen(form);
    const first = form.querySelector('input:not([readonly]):not([type=hidden]), select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { close, form };
  },
  // Confirmação simples
  confirm(message, onYes, { title = 'Confirmar ação', yesLabel = 'Confirmar' } = {}) {
    UI.modal({ title, body: `<p style="margin:0">${message}</p>`, submitLabel: yesLabel, onSubmit: () => { onYes(); } });
  },
  // Toast no canto inferior direito
  toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + type; t.textContent = msg;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3600);
  },
  // Abas: UI.tabs([{id,label,count}], activeId, "Mod.setTab")
  tabs(items, active, onclick) {
    return `<div class="tabs">${items.map(t => `<button type="button" class="tab ${t.id === active ? 'active' : ''}" onclick="${onclick}('${t.id}')">${t.label}${t.count != null ? `<span class="count">${t.count}</span>` : ''}</button>`).join('')}</div>`;
  },
  // Barra de progresso (0..1) com tom
  progress(frac, tone = '') { return `<div class="progress ${tone}"><span style="width:${Math.max(0, Math.min(100, (Number(frac) || 0) * 100))}%"></span></div>`; },
  // Estrelas/nota 0..10
  nota(n) {
    if (n == null) return '<span class="muted small">Sem avaliação</span>';
    const tone = n >= 8 ? 'badge-success' : n >= 6 ? 'badge-warning' : 'badge-error';
    return `<span class="badge no-dot ${tone}">${Icon('star', 'style="width:12px;height:12px"')} ${U.num(n, 1)}</span>`;
  },
  // Aviso destacado
  notice(html, { icon = 'info', tone = '' } = {}) { return `<div class="notice ${tone}">${Icon(icon)}<div>${html}</div></div>`; },
  // Gráfico de barras verticais em SVG puro: data=[{label, value, value2?}]
  barChart(data, { height = 220, fmt = U.brlShort, color = 'var(--orange)', color2 = 'var(--navy)', legend = null } = {}) {
    if (!data.length) return `<div class="empty">Sem dados no período.</div>`;
    const max = Math.max(1, ...data.map(d => Math.max(d.value || 0, d.value2 || 0)));
    const w = 100 / data.length;
    const bars = data.map((d, i) => {
      const h1 = ((d.value || 0) / max) * (height - 40);
      const h2 = d.value2 != null ? ((d.value2 || 0) / max) * (height - 40) : 0;
      const x = i * w;
      const bw = d.value2 != null ? w * 0.3 : w * 0.55;
      return `<g><title>${U.esc(d.label)}: ${fmt(d.value)}${d.value2 != null ? ' / ' + fmt(d.value2) : ''}</title>
        <rect x="${x + (w - (d.value2 != null ? bw * 2 + w * 0.04 : bw)) / 2}%" y="${height - 22 - h1}" width="${bw}%" height="${h1}" rx="3" fill="${color}"/>
        ${d.value2 != null ? `<rect x="${x + (w - (bw * 2 + w * 0.04)) / 2 + bw + w * 0.04}%" y="${height - 22 - h2}" width="${bw}%" height="${h2}" rx="3" fill="${color2}"/>` : ''}
        <text x="${x + w / 2}%" y="${height - 6}" text-anchor="middle" font-size="11" fill="#64748B" font-family="Inter">${U.esc(d.label)}</text></g>`;
    }).join('');
    const leg = legend ? `<div class="row small muted" style="gap:16px;margin-top:8px">${legend.map((l, i) => `<span class="row" style="gap:6px"><span style="width:10px;height:10px;border-radius:2px;background:${i ? color2 : color}"></span>${l}</span>`).join('')}</div>` : '';
    return `<svg width="100%" height="${height}" role="img"><line x1="0" x2="100%" y1="${height - 22}" y2="${height - 22}" stroke="#E2E8F0"/>${bars}</svg>${leg}`;
  },
};

/* ---------------------------------------------------------------------
   App — registro de páginas, navegação e shell
   ---------------------------------------------------------------------
   App.register({
     id: 'solicitacoes',            // usado na URL (#solicitacoes)
     label: 'Solicitações',         // texto do menu
     icon: 'filePlus',              // chave de ICONS
     section: 'Compras',            // uma de App.SECTIONS
     order: 10,                     // ordem dentro da seção
     badge: () => número | null,    // opcional: contador laranja no menu
     tag: 'Em breve',               // opcional: etiqueta cinza no menu
     render: (el, params) => {}     // desenha a página dentro de el
   })
   App.go('pedidos', { id:'PC-0003' }) navega passando parâmetros.
   App.rerender() redesenha a página atual (Store.commit já chama).
   Dica: para filtros com <input>, re-renderize SÓ a área da tabela para não perder o foco.
   --------------------------------------------------------------------- */
const App = {
  pages: [],
  current: null,
  params: {},
  SECTIONS: ['Visão geral', 'Compras', 'Suprimentos', 'Cadastros', 'Gestão', 'Próximas fases'],
  register(page) { this.pages.push(page); },
  page(id) { return this.pages.find(p => p.id === id); },
  // Inicializa a aplicação
  start() {
    Store.load();
    this.pages.sort((a, b) => (this.SECTIONS.indexOf(a.section) - this.SECTIONS.indexOf(b.section)) || ((a.order || 0) - (b.order || 0)));
    document.getElementById('menuBtn').innerHTML = Icon('menu');
    document.getElementById('menuBtn').onclick = () => document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('resetBtn').innerHTML = Icon('refresh') + '<span>Restaurar demo</span>';
    document.getElementById('resetBtn').onclick = () => UI.confirm('Todos os dados alterados nesta demonstração serão substituídos pelos dados originais. Deseja continuar?', () => Store.reset(), { title: 'Restaurar dados de demonstração', yesLabel: 'Restaurar' });
    const sel = document.getElementById('userSelect');
    sel.onchange = () => { Store.db.config.usuarioId = sel.value; Store.commit('Perfil alterado para ' + Store.user().nome + ' (' + Store.user().perfil + ').', ''); };
    window.addEventListener('hashchange', () => { const id = location.hash.slice(1).split('?')[0]; if (id && id !== this.current && this.page(id)) this.go(id); });
    const initial = location.hash.slice(1).split('?')[0];
    this.go(this.page(initial) ? initial : (this.pages[0]?.id || ''));
  },
  // Navega para uma página
  go(id, params = {}) {
    if (!this.page(id)) return;
    this.current = id; this.params = params;
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    document.getElementById('sidebar').classList.remove('open');
    this.rerender();
    window.scrollTo({ top: 0 });
  },
  // Redesenha menu, topo e página atual
  rerender() {
    this.renderNav();
    this.renderUser();
    const page = this.page(this.current);
    if (!page) return;
    document.getElementById('crumbSection').textContent = page.section;
    document.getElementById('crumbPage').textContent = page.label;
    document.title = page.label + ' | GHC Gestão';
    const el = document.getElementById('view');
    try {
      el.innerHTML = '';
      page.render(el, this.params || {});
      el.insertAdjacentHTML('beforeend', `<div class="footer"><span>GHC Facilities · Gestão integrada de compras e suprimentos</span><span>Desenvolvido por SAOS Technologies · Protótipo com dados fictícios</span></div>`);
    } catch (err) {
      console.error(err);
      el.innerHTML = UI.notice('Erro ao renderizar esta página: ' + U.esc(err.message), { icon: 'alert' });
    }
  },
  renderNav() {
    const groups = this.SECTIONS.map(sec => {
      const items = this.pages.filter(p => p.section === sec);
      if (!items.length) return '';
      return `<div><div class="nav-group-label">${sec}</div>${items.map(p => {
        let b = null; try { b = p.badge ? p.badge() : null; } catch (e) { b = null; }
        return `<button type="button" class="nav-item ${p.id === this.current ? 'active' : ''}" onclick="App.go('${p.id}')">${Icon(p.icon)}<span>${p.label}</span>${b ? `<span class="nav-badge">${b}</span>` : ''}${p.tag ? `<span class="nav-tag">${p.tag}</span>` : ''}</button>`;
      }).join('')}</div>`;
    }).join('');
    document.getElementById('nav').innerHTML = groups;
  },
  renderUser() {
    const u = Store.user();
    document.getElementById('userAvatar').textContent = U.initials(u.nome);
    document.getElementById('userSelect').innerHTML = Store.db.usuarios.map(x => `<option value="${x.id}" ${x.id === u.id ? 'selected' : ''}>${U.esc(x.nome)} · ${U.esc(x.perfil)}</option>`).join('');
  },
};
