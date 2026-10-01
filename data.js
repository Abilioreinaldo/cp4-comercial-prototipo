// Dados fictícios do protótipo. Nenhuma empresa, pessoa, telefone ou CNPJ daqui é real.
const TZ = 'America/Sao_Paulo';
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const addDias = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const inicioSemana = d => { const x = new Date(d + 'T12:00:00Z'); return addDias(d, -((x.getUTCDay() + 6) % 7)); };

const BASES = ['Dutra', 'Minas Gerais', 'Santos'];
const COMBUSTIVEIS = ['S10', 'S500', 'Gasolina', 'Etanol', 'ARLA'];
const ETAPAS = ['Novo lead qualificado', 'Diagnóstico', 'Rota levantada', 'Apresentação CP4', 'Proposta', 'Negociação', 'Aguardando cobertura', 'Fechado', 'Implantação', 'Ativo', 'Perdido'];
const ETAPAS_POSTO = ['Posto identificado', 'Contato', 'Apresentação CP4', 'Negociação', 'Cadastro'];
const COLUNAS = [
  { id: 'nao_trabalhado', nome: 'Leads' },
  { id: 'contato', nome: 'Contato realizado' },
  { id: 'reuniao', nome: 'Reunião' },
  { id: 'fechamento', nome: 'Fechamento' },
  { id: 'sem_interesse', nome: 'Sem interesse' },
];
const CANAIS = { ligacao: 'Ligação', whatsapp: 'Mensagem enviada (WhatsApp)', reuniao: 'Reunião', email: 'E-mail', outro: 'Outro' };

function seed() {
  const T = hoje(), seg = inicioSemana(T), mesIni = T.slice(0, 8) + '01';
  const naSemana = k => { const d = addDias(T, -k); return d < seg ? seg : d; };
  const noMes = k => { const d = addDias(T, -k); return d < mesIni ? mesIni : d; };
  let rnd = 7; const R = n => (rnd = (rnd * 1103515245 + 12345) % 2147483648, rnd % n);

  const S = {
    v: 1, seq: 1000, me: 'u1',
    users: [
      { id: 'u1', nome: 'Marina Couto', email: 'marina@exemplo.cp4', perfil: 'vendedor', ativo: true },
      { id: 'u2', nome: 'Diego Farias', email: 'diego@exemplo.cp4', perfil: 'vendedor', ativo: true },
      { id: 'u3', nome: 'Renata Prado', email: 'renata@exemplo.cp4', perfil: 'gerente', ativo: true },
      { id: 'u4', nome: 'Helena Brandão', email: 'helena@exemplo.cp4', perfil: 'admin', ativo: true },
    ],
    metas: { padrao: { msg: 80, lig: 30, efet: 80, reun: 10, vendas: 30 }, ind: { u2: { lig: 25 } } },
    leads: [], atividades: [], opps: [], rotas: [], postos: [], postoOpps: [], propostas: [], volumes: [], historico: [], ajustes: {},
  };

  const nomes = ['Rodomar', 'Serra Azul', 'TransVale', 'Litoral', 'Mantiqueira', 'Via Minas', 'Bandeirante', 'Paraíba do Sul', 'Cruzeiro', 'Atlântica', 'Itatiaia', 'Planalto', 'Estrela Guia', 'Rota Sul', 'Aliança', 'Pioneira', 'Tropeiro', 'Horizonte', 'Canastra', 'Araucária', 'Jequitibá', 'Ipê Roxo', 'Boa Viagem', 'Tamoios', 'Ouro Verde', 'Três Pontes', 'Caravela', 'Vitória Régia', 'Sabiá', 'Guará'];
  const formas = [n => 'Transportes ' + n, n => n + ' Logística', n => 'Expresso ' + n, n => n + ' Cargas'];
  const pnomes = ['Carlos', 'Fernanda', 'João', 'Patrícia', 'Rogério', 'Simone', 'Wagner', 'Luciana', 'Márcio', 'Aline', 'Edson', 'Tatiane'];
  const snomes = ['Azevedo', 'Barros', 'Cardoso', 'Dantas', 'Esteves', 'Fontes', 'Guimarães', 'Lacerda', 'Moraes', 'Nogueira'];
  const cidades = {
    'Dutra': [['Guarulhos', 'SP'], ['São José dos Campos', 'SP'], ['Taubaté', 'SP'], ['Resende', 'RJ'], ['Volta Redonda', 'RJ']],
    'Minas Gerais': [['Betim', 'MG'], ['Contagem', 'MG'], ['Pouso Alegre', 'MG'], ['Uberlândia', 'MG'], ['Campinas', 'SP']],
    'Santos': [['Santos', 'SP'], ['Cubatão', 'SP'], ['Guarujá', 'SP'], ['São Vicente', 'SP']],
  };
  const sistemas = ['Cartão frota', 'Vale combustível', 'Conta no posto', 'Tanque próprio', ''];

  for (let i = 0; i < 110; i++) {
    const base = BASES[i % 3], [cidade, uf] = cidades[base][R(cidades[base].length)];
    const ddd = uf === 'SP' ? (base === 'Santos' ? 13 : 12) : uf === 'RJ' ? 24 : 31;
    let tel = `(${ddd}) 9${String(1000 + R(9000))}-${String(1000 + R(9000))}`;
    if (i > 87 && i % 7 === 0) tel = '';
    if (i === 99) tel = '(12) 9812';
    S.leads.push({
      id: 'l' + i, empresa: formas[Math.floor(i / 30)](nomes[i % 30]), contato: pnomes[R(12)] + ' ' + snomes[R(10)],
      telefone: tel, cidade, uf, cnpj: '', email: '', frota: 8 + R(70), consumo: (10 + R(90)) * 1000, combustivel: 'S10',
      sistema: sistemas[R(5)], regiao: '', bases: i % 9 === 0 ? [base, BASES[(i + 1) % 3]] : [base],
      status: 'nao_trabalhado', ownerId: null, proxData: '', proxAcao: '', ultimoContato: '', obs: '', resumo: '',
      motivoRecusa: '', fechado: false, primeiroFechamento: '', vendaUserId: '', oppId: '', reuniaoData: '', reuniaoHora: '',
    });
  }
  const L = i => S.leads[i];
  const act = (i, userId, canal, data, conversa, nota) => {
    S.atividades.push({ id: 'a' + (S.seq++), leadId: 'l' + i, userId, canal, data, conversa, nota: nota || '', desc: false, tipo: 'atividade' });
    if (!L(i).ultimoContato || L(i).ultimoContato < data) L(i).ultimoContato = data;
  };

  // carteira trabalhada hoje
  for (let i = 7; i <= 40; i++) { Object.assign(L(i), { ownerId: 'u1', status: 'contato' }); act(i, 'u1', 'whatsapp', T, i < 23, 'Apresentação inicial da CP4.'); }
  for (let i = 41; i <= 52; i++) { Object.assign(L(i), { ownerId: 'u1', status: 'contato' }); act(i, 'u1', 'ligacao', T, i < 44, i < 44 ? 'Conversou com o responsável.' : 'Não atendeu.'); }
  for (let i = 53; i <= 70; i++) { Object.assign(L(i), { ownerId: 'u2', status: 'contato' }); act(i, 'u2', 'whatsapp', T, i < 61); }
  for (let i = 71; i <= 77; i++) { Object.assign(L(i), { ownerId: 'u2', status: 'contato' }); act(i, 'u2', 'ligacao', T, i < 73); }
  // retornos
  [[8, -2, 'Retornar com tabela de preços'], [9, -1, 'Ligar para o gestor de frota'], [12, -1, 'Confirmar volume mensal'],
   [14, 0, 'Enviar apresentação'], [15, 0, 'Falar com o financeiro'], [17, 0, 'Retorno combinado'], [19, 0, 'Validar rotas'],
   [21, 2, 'Retomar conversa'], [55, -1, 'Retornar ligação'], [57, 0, 'Enviar proposta'], [60, 3, 'Retomar conversa']]
    .forEach(([i, d, a]) => Object.assign(L(i), { proxData: addDias(T, d), proxAcao: a }));
  // reuniões agendadas
  [[78, 'u1', 0, '15:00'], [79, 'u1', 2, '10:30'], [80, 'u2', 1, '14:00'], [81, 'u2', 4, '09:00']].forEach(([i, u, d, h]) => {
    Object.assign(L(i), { ownerId: u, status: 'reuniao', reuniaoData: addDias(T, d), reuniaoHora: h, proxData: addDias(T, d), proxAcao: 'Reunião às ' + h, ultimoContato: noMes(3) });
    S.atividades.push({ id: 'a' + (S.seq++), leadId: 'l' + i, userId: u, canal: 'reuniao', data: noMes(2), conversa: false, nota: '', desc: false, tipo: 'agendamento' });
  });
  // fechados sem cadastro completo
  Object.assign(L(82), { ownerId: 'u1', status: 'fechamento', fechado: true, primeiroFechamento: noMes(6), vendaUserId: 'u1', ultimoContato: noMes(6) });
  Object.assign(L(83), { ownerId: 'u2', status: 'fechamento', fechado: true, primeiroFechamento: noMes(4), vendaUserId: 'u2', ultimoContato: noMes(4) });
  [[84, 'u1', 'Contrato vigente com outro fornecedor'], [85, 'u1', 'Sem perfil: frota abastece em tanque próprio'], [86, 'u2', 'Preço'], [87, 'u2', '']]
    .forEach(([i, u, m]) => Object.assign(L(i), { ownerId: u, status: 'sem_interesse', motivoRecusa: m, ultimoContato: noMes(8) }));
  [88, 89, 90, 91].forEach(i => L(i).ownerId = 'u1'); [92, 93].forEach(i => L(i).ownerId = 'u2');

  // transportadoras qualificadas
  const opp = (i, owner, etapa, extra, consumo, status) => {
    const o = Object.assign({ id: 'o' + i, leadId: 'l' + i, etapa, precoAtual: '', concorrente: '', proxAcao: '', proxData: '', motivoPerda: '', volumeAtivado: 0 }, extra);
    S.opps.push(o); Object.assign(L(i), { ownerId: owner, oppId: o.id, status: status || 'contato', consumo, ultimoContato: noMes(5) });
    return o;
  };
  const rota = (oppId, o, d, rod, litros, pontos, extra) => S.rotas.push(Object.assign({ id: 'r' + (S.seq++), oppId, origem: o, destino: d, rodovia: rod, litros,
    pontos: pontos.map(p => ({ cidade: p[0], uf: p[1], rodovia: p[2], combustivel: p[3], litros: p[4] })), frequencia: '', precoAtual: '', postosAtuais: '', outras: '', obs: '' }, extra));

  opp(0, 'u1', 'Ativo', { volumeAtivado: 35000, concorrente: 'Cartão frota' }, 60000, 'fechamento');
  Object.assign(L(0), { fechado: true, primeiroFechamento: noMes(12), vendaUserId: 'u1', resumo: 'Fechado com início pela rota da Dutra. Segunda rota (Fernão Dias) fica para o próximo trimestre.' });
  rota('o0', 'Guarulhos/SP', 'Resende/RJ', 'BR-116', 40000, [['Taubaté', 'SP', 'BR-116', 'S10', 25000], ['Resende', 'RJ', 'BR-116', 'S10', 15000]], { frequencia: '12 viagens por semana', precoAtual: '6,09' });

  opp(1, 'u1', 'Fechado', { proxAcao: 'Ativar transportadora', proxData: T }, 32000, 'fechamento');
  Object.assign(L(1), { fechado: true, primeiroFechamento: noMes(2), vendaUserId: 'u1' });
  rota('o1', 'São José dos Campos/SP', 'Guarulhos/SP', 'BR-116', 24000, [['São José dos Campos', 'SP', 'BR-116', 'S10', 14000], ['Guarulhos', 'SP', 'BR-116', 'S10', 10000]]);

  opp(2, 'u2', 'Aguardando cobertura', { proxAcao: 'Acompanhar credenciamento em Pouso Alegre', proxData: addDias(T, 3), concorrente: 'Conta no posto' }, 45000);
  rota('o2', 'Betim/MG', 'São Paulo/SP', 'BR-381', 30000, [['Betim', 'MG', 'BR-381', 'S10', 12000], ['Pouso Alegre', 'MG', 'BR-381', 'S10', 18000]]);

  opp(3, 'u2', 'Proposta', { proxAcao: 'Apresentar proposta revisada', proxData: addDias(T, 1) }, 28000);
  rota('o3', 'Santos/SP', 'São Paulo/SP', 'SP-150', 20000, [['Santos', 'SP', 'SP-150', 'S10', 11000], ['Cubatão', 'SP', 'SP-150', 'S500', 9000]]);

  opp(4, 'u1', 'Diagnóstico', { proxAcao: 'Levantar rotas com o gestor de frota', proxData: T }, 52000);
  opp(5, 'u2', 'Perdido', { motivoPerda: 'Renovou contrato com o fornecedor atual por 12 meses' }, 38000, 'sem_interesse');
  opp(6, 'u1', 'Negociação', { proxAcao: 'Negociar prazo de pagamento', proxData: addDias(T, 2), precoAtual: '6,15' }, 40000);
  rota('o6', 'Contagem/MG', 'Campinas/SP', 'BR-381', 26000, [['Contagem', 'MG', 'BR-381', 'S10', 8000], ['Pouso Alegre', 'MG', 'BR-381', 'S10', 10000], ['Campinas', 'SP', 'SP-065', 'S10', 8000]]);

  // reuniões realizadas na semana
  [[0, 'u1', 0], [1, 'u1', 1], [4, 'u1', 2], [6, 'u1', 3], [2, 'u2', 1], [3, 'u2', 2]].forEach(([i, u, k]) => act(i, u, 'reuniao', naSemana(k), true, 'Reunião realizada.'));

  const posto = (nome, bandeira, cidade, uf, rodovia, km, comb, preco, status) => S.postos.push({ id: 'p' + (S.seq++), nome, cnpj: '', bandeira, cidade, uf, rodovia, km, combustiveis: comb, preco, status, contato: pnomes[R(12)] + ' ' + snomes[R(10)], telefone: '', lat: '', lng: '', obs: '' });
  posto('Posto Trevo de Guarulhos', 'Bandeira branca', 'Guarulhos', 'SP', 'BR-116', '212', ['S10', 'S500', 'ARLA'], '5,89', 'Ativo');
  posto('Auto Posto Vale do Paraíba', 'Bandeira branca', 'São José dos Campos', 'SP', 'BR-116', '148', ['S10', 'ARLA'], '5,92', 'Ativo');
  posto('Posto Caminho do Vale', 'Ipiranga', 'Taubaté', 'SP', 'BR-116', '110', ['S10', 'S500'], '5,95', 'Ativo');
  posto('Posto Agulhas Negras', 'Bandeira branca', 'Resende', 'RJ', 'BR-116', '305', ['S10'], '6,02', 'Credenciado');
  posto('Posto Serra da Moeda', 'Shell', 'Betim', 'MG', 'BR-381', '492', ['S10', 'S500'], '5,98', 'Ativo');
  posto('Posto Mineirão', 'Bandeira branca', 'Contagem', 'MG', 'BR-381', '478', ['S10'], '5,96', 'Credenciado');
  posto('Posto Porto Novo', 'Petrobras', 'Santos', 'SP', 'SP-150', '62', ['S10', 'S500', 'Gasolina'], '6,05', 'Ativo');
  posto('Posto Fernão Velho', 'Bandeira branca', 'Pouso Alegre', 'MG', 'BR-381', '860', ['S10'], '5,90', 'Inativo');

  S.postoOpps.push({ id: 'q' + (S.seq++), cidade: 'Cubatão', uf: 'SP', rodovia: 'SP-150', combustivel: 'S500', etapa: 'Negociação', nome: 'Posto Serra do Mar', cnpj: '', bandeira: 'Bandeira branca', km: '55', preco: '', responsavel: 'Rogério Lacerda', telefone: '(13) 93322-1100', whatsapp: '', dataContato: noMes(3), obs: 'Pediu simulação de volume.', ownerId: 'u2', credenciado: false });

  S.propostas.push({ id: 'pr' + (S.seq++), oppId: 'o3', preco: '5,97', litros: 20000, validade: addDias(T, 10), status: 'Aberta', condicoes: 'Faturamento quinzenal.' });
  [[2, 6200, 'p3'], [5, 4800, 'p4'], [9, 7100, 'p3']].forEach(([k, l, pi], n) => S.volumes.push({ id: 'vol' + (S.seq++), oppId: 'o0', postoId: S.postos[pi === 'p3' ? 2 : 3].id, data: noMes(k), litros: l, ref: 'NF-' + (48210 + n), origem: 'manual' }));
  S.historico.push({ leadId: 'l0', data: noMes(12), userId: 'u1', texto: 'Fechamento registrado.' }, { leadId: 'l0', data: noMes(10), userId: 'u1', texto: 'Transportadora ativada com 35.000 L/mês.' });
  return S;
}
