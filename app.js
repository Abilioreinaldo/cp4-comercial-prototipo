// CP4 Comercial — protótipo navegável. Tudo roda no navegador, sem servidor.
const KEY = 'cp4-comercial-proto-v1';
const $ = (s, e = document) => e.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtD = d => d ? d.split('-').reverse().join('/') : '—';
const fmtN = n => Number(n || 0).toLocaleString('pt-BR');
const fmtL = n => fmtN(n) + ' L';
const preco = v => { const n = Number(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : NaN; };
const norm = s => String(s || '').trim().toLowerCase();
const soma = (a, f) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);

let S = carregar();
const ui = { filtros: { base: '', cidade: '', tel: '', q: '', status: '', uf: '', conv: false }, vista: 'quadro', pag: {}, negTab: 'neg', negGrupo: 'andamento', tTab: 'passo', postosTab: 'demanda', rede: { q: '', uf: '', status: '' }, relMes: hoje().slice(0, 7) };
let modal = null;

function carregar() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1 && s.dia === hoje()) return s; } catch (e) { /* sem armazenamento */ }
  const s = seed(); s.dia = hoje(); return s;
}
function salvar() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* segue em memória */ } }
function toast(msg, erro) {
  const t = document.createElement('div'); t.className = 'toast' + (erro ? ' err' : ''); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), erro ? 5200 : 3200);
}

// ---------- domínio ----------
const eu = () => S.users.find(u => u.id === S.me);
const gestor = () => eu().perfil !== 'vendedor';
const nomeDe = id => (S.users.find(u => u.id === id) || {}).nome || 'Fila livre';
const lead = id => S.leads.find(l => l.id === id);
const opp = id => S.opps.find(o => o.id === id);
const oppDe = l => l.oppId ? opp(l.oppId) : null;
const leadDe = o => lead(o.leadId);
const rotasDe = o => S.rotas.filter(r => r.oppId === o.id);
const telValido = t => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 || d.length === 11; };
const aguardando = l => l.status === 'nao_trabalhado' && !l.ultimoContato && !l.oppId;
const podeEditar = l => gestor() || !l.ownerId || l.ownerId === S.me;
const leadsVisiveis = () => S.leads.filter(l => gestor() || !l.ownerId || l.ownerId === S.me);
const carteira = () => S.leads.filter(l => gestor() || l.ownerId === S.me);
const oppsVisiveis = () => S.opps.filter(o => gestor() || leadDe(o).ownerId === S.me);
const hist = (l, texto) => S.historico.push({ leadId: l.id, data: hoje(), userId: S.me, texto });

function postoDoPonto(p) {
  return S.postos.find(x => ['Credenciado', 'Ativo'].includes(x.status) && norm(x.cidade) === norm(p.cidade) && x.uf === p.uf && norm(x.rodovia) === norm(p.rodovia) && x.combustiveis.includes(p.combustivel));
}
function coberturaRota(r) { const c = r.pontos.filter(postoDoPonto).length; return c === r.pontos.length ? 'Disponível' : c === 0 ? 'Sem cobertura' : 'Parcial'; }
function situacao(o) {
  const rs = rotasDe(o), pts = rs.flatMap(r => r.pontos), falt = pts.filter(p => !postoDoPonto(p));
  return { rotas: rs, pontos: pts, faltam: falt, mapeado: soma(rs, r => r.litros), coberto: rs.length > 0 && falt.length === 0, fechado: ['Fechado', 'Implantação'].includes(o.etapa) };
}
function grupoDe(o) {
  if (o.etapa === 'Perdido') return 'perdidas';
  if (o.etapa === 'Ativo') return 'ativas';
  const s = situacao(o);
  if (!s.rotas.length) return 'rota';
  if (s.faltam.length) return 'postos';
  if (s.fechado) return 'prontas';
  return 'andamento';
}
const chave = p => [norm(p.cidade), p.uf, norm(p.rodovia), p.combustivel].join('|');
function demanda() {
  const m = new Map();
  S.opps.filter(o => !['Perdido', 'Ativo'].includes(o.etapa)).forEach(o => {
    const s = situacao(o), chaves = new Set(s.faltam.map(chave));
    s.faltam.forEach(p => {
      const k = chave(p);
      if (!m.has(k)) m.set(k, { k, cidade: p.cidade, uf: p.uf, rodovia: p.rodovia, combustivel: p.combustivel, litros: 0, opps: new Set(), destrava: new Set() });
      const d = m.get(k); d.litros += Number(p.litros) || 0; d.opps.add(o.id);
      if (chaves.size === 1) d.destrava.add(o.id);
    });
  });
  return [...m.values()].sort((a, b) => b.litros - a.litros);
}
const postoOppDe = k => S.postoOpps.find(q => chave(q) === k && !q.credenciado);

function metricas(uid) {
  const T = hoje(), seg = inicioSemana(T), mes = T.slice(0, 7);
  const A = S.atividades.filter(a => a.userId === uid && !a.desc), at = A.filter(a => a.tipo === 'atividade'), hj = at.filter(a => a.data === T);
  const efetDet = new Set(hj.filter(a => a.conversa).map(a => a.leadId)).size;
  const compl = (S.ajustes[uid + '|' + T] || {}).compl || 0;
  return {
    msg: hj.filter(a => a.canal === 'whatsapp').length, lig: hj.filter(a => a.canal === 'ligacao').length,
    realizados: hj.length + compl, efet: efetDet + compl, efetDet, compl,
    agend: new Set(A.filter(a => a.tipo === 'agendamento' && a.data === T).map(a => a.leadId)).size,
    reunHoje: hj.filter(a => a.canal === 'reuniao' && a.conversa).length,
    reun: at.filter(a => a.canal === 'reuniao' && a.conversa && a.data >= seg && a.data <= T).length,
    vendas: S.leads.filter(l => l.fechado && l.vendaUserId === uid && l.primeiroFechamento.slice(0, 7) === mes).length,
  };
}
function metaDe(uid) {
  const u = S.users.find(x => x.id === uid), ind = S.metas.ind[uid] || {}, out = {};
  ['msg', 'lig', 'efet', 'reun', 'vendas'].forEach(k => {
    const v = ind[k] ?? (u.perfil === 'vendedor' ? S.metas.padrao[k] : null);
    out[k] = v === '' || v == null ? null : Number(v);
  });
  return out;
}
function registrar(l, { canal, data, conversa, nota }) {
  S.atividades.push({ id: 'a' + (S.seq++), leadId: l.id, userId: S.me, canal, data: data || hoje(), conversa: !!conversa, nota: nota || '', desc: false, tipo: 'atividade' });
  if (!l.ultimoContato || l.ultimoContato < (data || hoje())) l.ultimoContato = data || hoje();
  if (!l.ownerId) l.ownerId = S.me;
  if (l.status === 'nao_trabalhado') l.status = 'contato';
}
function agendamento(l) { S.atividades.push({ id: 'a' + (S.seq++), leadId: l.id, userId: S.me, canal: 'reuniao', data: hoje(), conversa: false, nota: '', desc: false, tipo: 'agendamento' }); }
function fechar(l) {
  const o = oppDe(l);
  l.fechado = true; l.status = 'fechamento';
  if (!l.primeiroFechamento) { l.primeiroFechamento = hoje(); l.vendaUserId = l.ownerId || S.me; }
  if (o && !['Ativo', 'Implantação'].includes(o.etapa)) o.etapa = 'Fechado';
  hist(l, 'Fechamento registrado.');
}
function reservar(l) { if (!l.ownerId) { l.ownerId = S.me; return true; } return l.ownerId === S.me || gestor(); }
function moverLead(l, dest) {
  if (l.status === dest) return;
  if (!podeEditar(l)) return toast('Este lead está na carteira de outro vendedor.', true);
  const o = oppDe(l), de = l.status;
  if (o && o.etapa === 'Ativo') return toast('Transportadora ativa não volta de etapa por aqui. Peça revisão da gestão.', true);
  reservar(l);
  if (de === 'fechamento') { l.fechado = false; if (o && ['Fechado', 'Implantação'].includes(o.etapa)) o.etapa = 'Negociação'; }
  if (de === 'sem_interesse' && o && o.etapa === 'Perdido') o.etapa = 'Negociação';
  if (dest === 'contato' && de === 'nao_trabalhado') registrar(l, { canal: 'outro', conversa: false, nota: 'Movido para Contato realizado no quadro.' });
  if (dest === 'reuniao') agendamento(l);
  l.status = dest;
  if (dest === 'fechamento') fechar(l);
  if (dest === 'sem_interesse' && o) { o.etapa = 'Perdido'; o.motivoPerda = o.motivoPerda || 'Recusa registrada no quadro'; }
  hist(l, 'Movido para ' + COLUNAS.find(c => c.id === dest).nome + '.');
  salvar(); render();
  if (dest === 'sem_interesse') abrir({ type: 'motivo', leadId: l.id });
  else if (dest === 'reuniao' && !l.reuniaoData) toast('Reunião registrada sem data. Use Agendar reunião para completar a agenda.');
  else if (dest === 'fechamento' && (!l.telefone || !l.consumo)) toast('Venda registrada. Complete o cadastro para iniciar a implantação.');
  else toast('Etapa atualizada.');
}
function proximoLead(filaMsg, base) {
  const f = ui.filtros;
  const ok = l => aguardando(l) && (!l.ownerId || l.ownerId === S.me) && (filaMsg
    ? telValido(l.telefone) && (!base || l.bases.includes(base))
    : (!f.base || l.bases.includes(f.base)) && (!f.cidade || l.cidade === f.cidade) && (!f.uf || l.uf === f.uf) && (f.tel === 'com' ? !!l.telefone : f.tel === 'sem' ? !l.telefone : true));
  const c = S.leads.filter(ok);
  return c.find(l => l.ownerId === S.me) || c[0] || null;
}
function mensagemPara(l) {
  const v = eu().nome.split(' ')[0], c = (l.contato || '').split(' ')[0];
  return `Olá${c ? ', ' + c : ''}! Tudo bem?\n\nAqui é ${v}, da CP4. Trabalhamos com gestão de abastecimento e uma rede de postos para transportadoras.\n\nGostaria de conhecer as rotas da ${l.empresa} e avaliar como podemos ajudar nos abastecimentos.\n\nVocê cuida dessa área ou pode me indicar o responsável?`;
}

// ---------- componentes ----------
const pill = (t, c) => `<span class="pill ${c || ''}">${esc(t)}</span>`;
const NOVO = '<span class="novo" title="Proposta deste protótipo; não existe na ferramenta atual">Novo</span>';
const pillCob = c => pill(c, c === 'Disponível' ? 'ok' : c === 'Parcial' ? 'warn' : 'bad');
const pillEtapa = e => pill(e, e === 'Ativo' ? 'dark' : e === 'Perdido' ? 'bad' : ['Fechado', 'Implantação'].includes(e) ? 'ok' : e === 'Aguardando cobertura' ? 'warn' : 'info');
function fld(label, name, val, o = {}) {
  const a = `id="f-${name}" name="${name}" ${o.attrs || ''}`;
  let c;
  if (o.opts) c = `<select ${a}>${o.opts.map(x => { const [v, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`;
  else if (o.type === 'textarea') c = `<textarea ${a}>${esc(val)}</textarea>`;
  else c = `<input type="${o.type || 'text'}" value="${esc(val)}" ${a}>`;
  return `<label class="f ${o.full ? 'full' : ''}"><span>${esc(label)}</span>${c}</label>`;
}
const UFS = ['', 'SP', 'RJ', 'MG', 'PR', 'ES', 'GO', 'SC', 'RS', 'BA'];
function goal(label, per, real, meta) {
  if (!meta) return `<div class="card goal"><div class="eyebrow">${label} · ${per}</div><div class="v num">${real}</div><div class="bar"><i style="width:0"></i></div><div class="small muted">Meta não definida</div></div>`;
  const pct = Math.round(real / meta * 100), falta = Math.max(0, meta - real);
  return `<div class="card goal"><div class="eyebrow">${label} · ${per}</div><div class="v num">${real} <small>/ ${meta}</small></div><div class="bar"><i style="width:${Math.min(100, pct)}%"></i></div><div class="small ${falta ? 'muted' : ''}">${falta ? `Faltam ${falta} · ${pct}%` : pill('Meta atingida · ' + pct + '%', 'ok')}</div></div>`;
}
const stat = (label, v, alerta) => `<div class="card stat ${alerta && parseInt(v, 10) > 0 ? 'alert' : ''}"><div class="eyebrow">${label}</div><div class="v">${v}</div></div>`;
const vazio = t => `<div class="empty">${t}</div>`;

// ---------- telas ----------
const ROTAS = {
  'meu-dia': ['Meu Dia', vMeuDia], 'prospeccao': ['Prospecção', vProspeccao], 'negociacoes': ['Negociações', vNegociacoes], 'postos': ['Postos', vPostos],
  'visao': ['Visão Geral', vVisao, 1], 'equipe': ['Equipe e metas', vEquipe, 1], 'relatorios': ['Relatórios', vRelatorios], 'config': ['Configurações', vConfig, 1],
};
function rotaAtual() {
  const h = location.hash.slice(1) || 'meu-dia';
  if (h.startsWith('t-') && opp(h.slice(2))) return { id: 'negociacoes', opp: opp(h.slice(2)) };
  if (!ROTAS[h] || (ROTAS[h][2] && !gestor())) return { id: 'meu-dia' };
  return { id: h };
}
function render() {
  const r = rotaAtual(), g = gestor(), dem = demanda().length;
  const link = (id, extra) => `<a href="#${id}" class="${r.id === id ? 'on' : ''}">${ROTAS[id][0]}${extra || ''}</a>`;
  $('#app').innerHTML = `<div class="shell" id="shell">
    <aside class="side">
      <div class="brand"><img src="logo-white.png" alt="CP4 Logtech"><span>Comercial</span></div>
      <nav class="nav">
        ${link('meu-dia')}${link('prospeccao')}${link('negociacoes')}${link('postos', dem ? `<span class="count">${dem}</span>` : '')}
        <div class="nav-label">${g ? 'Gestão' : 'Meus resultados'}</div>
        ${g ? link('visao') + link('equipe') : ''}${link('relatorios')}${g ? link('config') : ''}
      </nav>
      <div class="side-foot"><span>Protótipo navegável. Todos os dados são fictícios e ficam só neste navegador.</span><button data-a="reiniciar">Reiniciar dados de exemplo</button></div>
    </aside>
    <div class="scrim" data-a="menu"></div>
    <div class="main">
      <header class="top">
        <button class="btn sm menu-btn" data-a="menu" aria-label="Abrir menu">Menu</button>
        <h1>${r.opp ? esc(leadDe(r.opp).empresa) : ROTAS[r.id][0]}</h1>
        <span class="proto-pill">Protótipo · dados fictícios</span>
        <label class="as">Ver como <select id="ver-como" data-c="trocarUsuario">${S.users.filter(u => u.ativo).map(u => `<option value="${u.id}" ${u.id === S.me ? 'selected' : ''}>${esc(u.nome)} · ${u.perfil}</option>`).join('')}</select></label>
      </header>
      <main class="page">${r.opp ? vTransportadora(r.opp) : ROTAS[r.id][1]()}</main>
    </div></div>`;
}

function vMeuDia() {
  const T = hoje(), m = metricas(S.me), mt = metaDe(S.me), meus = S.leads.filter(l => l.ownerId === S.me);
  const aberto = l => !['fechamento', 'sem_interesse'].includes(l.status);
  const atras = meus.filter(l => aberto(l) && l.proxData && l.proxData < T), hj = meus.filter(l => aberto(l) && l.proxData === T);
  const fila = [...atras.sort((a, b) => a.proxData.localeCompare(b.proxData)), ...hj].slice(0, 12);
  const reun = meus.filter(l => l.status === 'reuniao' && l.reuniaoData >= T).sort((a, b) => (a.reuniaoData + a.reuniaoHora).localeCompare(b.reuniaoData + b.reuniaoHora)).slice(0, 30);
  const passos = S.opps.filter(o => leadDe(o).ownerId === S.me && !['Ativo', 'Perdido'].includes(o.etapa));
  const regs = S.atividades.filter(a => a.userId === S.me && a.tipo === 'atividade').slice(-8).reverse();
  const pct = mt.msg ? Math.round(m.msg / mt.msg * 100) : 0;
  return `
  <section class="hero">
    <div><div class="eyebrow">Mensagens enviadas · hoje</div>
      <div class="big">${m.msg} <small>${mt.msg ? '/ ' + mt.msg : ''}</small></div>
      <div class="small" style="margin-top:6px;color:#DCE7E5">${mt.msg ? (m.msg >= mt.msg ? `Meta atingida · ${pct}%` : `Faltam ${mt.msg - m.msg} · ${pct}%`) : 'Meta não definida'}</div>
      <div class="bar"><i style="width:${Math.min(100, pct)}%"></i></div></div>
    <div class="stack"><button class="btn lime" data-a="fila">Pegar fila de mensagens</button>
      ${gestor() ? `<button class="btn sm" data-a="metas" data-uid="${S.me}">${S.metas.ind[S.me] ? 'Editar minha meta' : 'Definir minha meta'}</button>` : ''}</div>
  </section>
  <section class="grid g4">
    ${goal('Ligações', 'hoje', m.lig, mt.lig)}${goal('Contatos efetivos', 'hoje', m.efet, mt.efet)}${goal('Reuniões realizadas', 'semana', m.reun, mt.reun)}${goal('Vendas fechadas', 'mês', m.vendas, mt.vendas)}
  </section>
  <section class="row">
    <button class="btn primary" data-a="registro" data-canal="ligacao">Registrar ligação</button>
    <button class="btn" data-a="agendar">Agendar reunião</button>
    <button class="btn" data-a="registro" data-canal="reuniao">Reunião realizada</button>
    <button class="btn ghost" data-a="ajuste">Ajustar total de contatos</button>
  </section>
  <section class="stack"><h2>Atividades de hoje</h2>
    <div class="kpis">${stat('Mensagens', m.msg)}${stat('Ligações', m.lig)}${stat('Contatos realizados', m.realizados)}${stat('Contatos efetivos', m.efet)}${stat('Reuniões agendadas', m.agend)}${stat('Reuniões realizadas', m.reunHoje)}</div>
  </section>
  <section class="kpis">${stat('Aguardando primeiro contato', meus.filter(aguardando).length)}${stat('Retornos atrasados', atras.length, 1)}${stat('Retornos de hoje', hj.length)}${stat('Contatos efetivos hoje', m.efet)}</section>
  <section class="grid g2">
    <div class="card"><div class="section-title"><h3>Quem precisa de você agora</h3><a href="#prospeccao" class="small">Ver meus leads</a></div>
      <div class="list">${fila.map(l => `<div class="item"><div><div class="t">${esc(l.empresa)}</div><div class="small muted">${esc(l.proxAcao || 'Retorno')} · ${esc(l.contato)}</div></div>
        ${l.proxData < T ? pill('Atrasado · ' + fmtD(l.proxData), 'bad') : pill('Hoje', 'warn')}
        <button class="btn sm go" data-a="atender" data-id="${l.id}">Atender</button><button class="btn sm ghost" data-a="editarLead" data-id="${l.id}">Editar</button></div>`).join('') || vazio('Nenhum retorno pendente.')}</div></div>
    <div class="stack">
      <div class="card"><h3>Próximas reuniões</h3><div class="list">${reun.map(l => `<div class="item"><div><div class="t">${esc(l.empresa)}</div><div class="small muted">${fmtD(l.reuniaoData)} às ${esc(l.reuniaoHora)} · ${esc(l.contato)}</div></div><button class="btn sm" data-a="registro" data-canal="reuniao" data-id="${l.id}">Registrar realização</button></div>`).join('') || vazio('Nenhuma reunião agendada.')}</div></div>
      <div class="card"><h3>Próximos passos das negociações</h3><div class="list">${passos.map(o => { const a = acaoPrincipal(o); return `<div class="item"><div><div class="t">${esc(leadDe(o).empresa)}</div><div class="small muted">${esc(a.dica)}</div></div><a class="btn sm" href="#t-${o.id}">Abrir</a></div>`; }).join('') || vazio('Nenhuma negociação aberta na sua carteira.')}</div></div>
    </div>
  </section>
  <section class="stack"><div class="section-title"><h2>Meus últimos registros</h2><span class="small muted">Desconsiderar tira o registro das metas e mantém o histórico.</span></div>
    <div class="table-wrap"><table><thead><tr><th>Data</th><th>Empresa</th><th>Canal</th><th>Conversa</th><th>Anotação</th><th></th></tr></thead><tbody>
    ${regs.map(a => `<tr><td class="num">${fmtD(a.data)}</td><td>${esc(lead(a.leadId).empresa)}</td><td>${CANAIS[a.canal]}</td><td>${a.conversa ? pill('Sim', 'ok') : pill('Não')}</td><td class="muted">${esc(a.nota)}</td>
      <td class="r">${a.desc ? pill('Desconsiderado', 'warn') : `<button class="btn sm ghost danger" data-a="desconsiderar" data-id="${a.id}">Desconsiderar</button>`}</td></tr>`).join('') || `<tr><td colspan="6">${vazio('Nenhum registro ainda.')}</td></tr>`}
    </tbody></table></div></section>`;
}

function leadsFiltrados() {
  const f = ui.filtros, q = norm(f.q);
  return leadsVisiveis().filter(l => (!f.base || l.bases.includes(f.base)) && (!f.cidade || l.cidade === f.cidade) && (!f.uf || l.uf === f.uf) && (!f.status || l.status === f.status)
    && (f.tel === 'com' ? !!l.telefone : f.tel === 'sem' ? !l.telefone : true)
    && (!q || [l.empresa, l.cnpj, l.contato, l.telefone, l.email].some(x => norm(x).includes(q))));
}
function cartaoLead(l, arrasta) {
  const T = hoje(), o = oppDe(l);
  return `<div class="kc" ${arrasta ? `draggable="true" data-lead="${l.id}"` : ''}>
    <div class="t" data-a="atender" data-id="${l.id}">${esc(l.empresa)}</div>
    <div class="small muted">${esc(l.contato || 'Sem contato')} · ${esc(l.cidade)}/${l.uf}</div>
    <div class="row" style="gap:4px">${l.bases.map(b => pill(b)).join('')}${l.ownerId ? pill(nomeDe(l.ownerId).split(' ')[0], 'info') : pill('Livre', 'ok')}${o ? pill('Qualificada', 'dark') : ''}${!l.telefone ? pill('Sem telefone', 'warn') : ''}</div>
    ${l.proxData ? `<div class="small ${l.proxData < T && !['fechamento', 'sem_interesse'].includes(l.status) ? '' : 'muted'}">${l.proxData < T && !['fechamento', 'sem_interesse'].includes(l.status) ? pill('Atrasado', 'bad') : ''} ${fmtD(l.proxData)} · ${esc(l.proxAcao)}</div>` : ''}
    ${l.status === 'sem_interesse' ? `<div class="small muted">${esc(l.motivoRecusa || 'Motivo não informado')} · <a href="#" data-a="motivo" data-id="${l.id}">${l.motivoRecusa ? 'Editar motivo' : 'Informar motivo'}</a></div>` : ''}
    <div class="row" style="gap:6px"><button class="btn sm go" data-a="atender" data-id="${l.id}">${l.ultimoContato ? 'Continuar' : 'Atender lead'}</button><button class="btn sm ghost" data-a="editarLead" data-id="${l.id}">Editar</button>
      <select data-c="moverSel" data-id="${l.id}" aria-label="Mover para">${COLUNAS.map(c => `<option value="${c.id}" ${c.id === l.status ? 'selected' : ''}>${c.id === l.status ? 'Mover para…' : c.nome}</option>`).join('')}</select></div>
  </div>`;
}
function vProspeccao() {
  const vis = leadsVisiveis(), f = ui.filtros, ls = leadsFiltrados();
  const base = (b, nome) => { const x = vis.filter(l => !b || l.bases.includes(b)); return `<button class="base ${f.base === b ? 'on' : ''}" data-a="base" data-b="${b}"><div class="eyebrow">${nome}</div><div class="v">${x.filter(aguardando).length}</div><div class="small muted">aguardando primeiro contato · ${x.length} cadastrados</div></button>`; };
  const cidades = [...new Set(vis.map(l => l.cidade))].sort(), ufs = [...new Set(vis.map(l => l.uf))].sort();
  let corpo;
  if (ui.vista === 'quadro') {
    corpo = `<div class="board">${COLUNAS.map(c => {
      const x = ls.filter(l => l.status === c.id), pg = ui.pag[c.id] || 0, pgs = Math.ceil(x.length / 30);
      return `<div class="col" data-col="${c.id}"><div class="col-h"><span>${c.nome}</span><span class="pill">${x.length}</span></div>
        ${x.slice(pg * 30, pg * 30 + 30).map(l => cartaoLead(l, true)).join('') || '<div class="small muted" style="padding:8px 4px">Solte um cartão aqui.</div>'}
        ${pgs > 1 ? `<div class="row between small"><button class="btn sm" data-a="pag" data-col="${c.id}" data-d="-1" ${pg === 0 ? 'disabled' : ''}>Anterior</button><span class="muted">${pg + 1} de ${pgs}</span><button class="btn sm" data-a="pag" data-col="${c.id}" data-d="1" ${pg >= pgs - 1 ? 'disabled' : ''}>Próxima</button></div>` : ''}</div>`;
    }).join('')}</div>`;
  } else {
    const x = ls.filter(l => f.conv || !l.oppId);
    corpo = ui.vista === 'cartoes' ? `<div class="cards">${x.slice(0, 60).map(l => cartaoLead(l)).join('') || vazio('Nenhuma empresa neste recorte.')}</div>`
      : `<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Contato</th><th>Telefone</th><th>Cidade</th><th>Base</th><th>Etapa</th><th>Vendedor</th><th class="r">Consumo</th><th>Próxima ação</th><th></th></tr></thead><tbody>
        ${x.slice(0, 80).map(l => `<tr><td><b>${esc(l.empresa)}</b></td><td>${esc(l.contato)}</td><td class="num">${esc(l.telefone || '—')}</td><td>${esc(l.cidade)}/${l.uf}</td><td>${l.bases.join(', ')}</td><td>${pill(COLUNAS.find(c => c.id === l.status).nome)}</td><td>${esc(nomeDe(l.ownerId))}</td><td class="r">${fmtL(l.consumo)}</td><td class="small">${l.proxData ? fmtD(l.proxData) + ' · ' + esc(l.proxAcao) : '—'}</td><td class="r"><button class="btn sm go" data-a="atender" data-id="${l.id}">Atender</button></td></tr>`).join('') || `<tr><td colspan="10">${vazio('Nenhuma empresa neste recorte.')}</td></tr>`}
        </tbody></table></div>`;
  }
  return `
  <section class="stack"><div class="section-title"><h2>Trabalhe por base comercial</h2><span class="small muted">A base indica a origem da lista, não o endereço da empresa.</span></div>
    <div class="bases">${base('', 'Todas as bases')}${BASES.map(b => base(b, b)).join('')}</div></section>
  <section class="row between">
    <div class="row"><button class="btn primary" data-a="novoLead">Novo lead</button><button class="btn go" data-a="proximo">Pegar próximo lead</button></div>
    <div class="chips">${[['quadro', 'Quadro de etapas'], ['cartoes', 'Cartões'], ['tabela', 'Tabela']].map(([v, t]) => `<button class="chip ${ui.vista === v ? 'on' : ''}" data-a="vista" data-v="${v}">${t}</button>`).join('')}</div>
  </section>
  <section class="filters">
    <input type="search" id="flt-q" placeholder="Buscar empresa, CNPJ, responsável, telefone ou e-mail" value="${esc(f.q)}" data-i="q">
    <select id="flt-cidade" data-c="filtro" data-k="cidade"><option value="">Cidade</option>${cidades.map(c => `<option ${f.cidade === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
    <select id="flt-uf" data-c="filtro" data-k="uf"><option value="">UF</option>${ufs.map(c => `<option ${f.uf === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
    <select id="flt-tel" data-c="filtro" data-k="tel"><option value="">Telefone</option><option value="com" ${f.tel === 'com' ? 'selected' : ''}>Com telefone</option><option value="sem" ${f.tel === 'sem' ? 'selected' : ''}>Sem telefone</option></select>
    <select id="flt-status" data-c="filtro" data-k="status"><option value="">Status</option>${COLUNAS.map(c => `<option value="${c.id}" ${f.status === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}</select>
    ${ui.vista !== 'quadro' ? `<label class="check small"><input type="checkbox" id="flt-conv" data-c="filtroConv" ${f.conv ? 'checked' : ''}> Incluir convertidas</label>` : ''}
    <button class="btn sm ghost" data-a="limpar">Limpar filtros</button>
  </section>
  <section id="lista-leads">${corpo}</section>`;
}

function acaoPrincipal(o) {
  const g = grupoDe(o), s = situacao(o);
  if (g === 'ativas') return { t: 'Registrar volume', a: 'volume', dica: 'Ativa. Registre os abastecimentos realizados.' };
  if (g === 'perdidas') return { t: 'Abrir', a: '', dica: 'Perdida: ' + (o.motivoPerda || 'motivo não informado') };
  if (g === 'rota') return { t: 'Mapear rota', a: 'rota', dica: 'Falta mapear a rota e o consumo por ponto.' };
  if (g === 'postos') return { t: 'Ver postos necessários', a: 'verPostos', dica: `Faltam postos em ${s.faltam.length} ponto(s): ${fmtL(soma(s.faltam, p => p.litros))} sem cobertura.` };
  if (g === 'prontas') return { t: 'Ativar transportadora', a: 'ativar', dica: 'Fechada e com cobertura completa. Pronta para ativar.' };
  return { t: 'Preparar proposta', a: 'proposta', dica: 'Cobertura completa. Avance com a proposta e o fechamento.' };
}
function vNegociacoes() {
  const os = oppsVisiveis();
  const tabs = `<div class="tabs">${[['neg', 'Negociações'], ['emp', 'Empresas'], ['rotas', 'Todas as rotas']].map(([v, t]) => `<button class="${ui.negTab === v ? 'on' : ''}" data-a="negTab" data-v="${v}">${t}</button>`).join('')}</div>`;
  if (ui.negTab === 'emp') return tabs + `<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Responsável</th><th>Cidade</th><th class="r">Frota</th><th class="r">Consumo</th><th>Etapa</th><th>Vendedor</th><th></th></tr></thead><tbody>
    ${os.map(o => { const l = leadDe(o); return `<tr><td><b>${esc(l.empresa)}</b></td><td>${esc(l.contato)}</td><td>${esc(l.cidade)}/${l.uf}</td><td class="r">${l.frota}</td><td class="r">${fmtL(l.consumo)}</td><td>${pillEtapa(o.etapa)}</td><td>${esc(nomeDe(l.ownerId))}</td><td class="r"><a class="btn sm" href="#t-${o.id}">Abrir</a></td></tr>`; }).join('')}</tbody></table></div>`;
  if (ui.negTab === 'rotas') { const rs = os.flatMap(o => rotasDe(o).map(r => [o, r])); return tabs + `<div class="table-wrap"><table><thead><tr><th>Transportadora</th><th>Trajeto</th><th>Rodovia</th><th class="r">Litros/mês</th><th class="r">Pontos</th><th>Cobertura</th><th></th></tr></thead><tbody>
    ${rs.map(([o, r]) => `<tr><td><b>${esc(leadDe(o).empresa)}</b></td><td>${esc(r.origem)} → ${esc(r.destino)}</td><td>${esc(r.rodovia)}</td><td class="r">${fmtL(r.litros)}</td><td class="r">${r.pontos.length}</td><td>${pillCob(coberturaRota(r))}</td><td class="r"><a class="btn sm" href="#t-${o.id}" data-a="tTab" data-v="rotas">Ver</a></td></tr>`).join('') || `<tr><td colspan="7">${vazio('Nenhuma rota cadastrada.')}</td></tr>`}</tbody></table></div>`; }
  const grupos = [['andamento', 'Em andamento'], ['rota', 'Levantar rota'], ['postos', 'Faltam postos'], ['prontas', 'Prontas para ativar'], ['ativas', 'Ativas'], ['perdidas', 'Perdidas']];
  const no = g => os.filter(o => g === 'andamento' ? !['ativas', 'perdidas'].includes(grupoDe(o)) : grupoDe(o) === g);
  return tabs + `<div class="chips">${grupos.map(([g, t]) => `<button class="chip ${ui.negGrupo === g ? 'on' : ''}" data-a="negGrupo" data-v="${g}">${t}<b>${no(g).length}</b></button>`).join('')}</div>
  <div class="grid g2">${no(ui.negGrupo).map(o => { const l = leadDe(o), s = situacao(o), a = acaoPrincipal(o);
    return `<div class="card stack"><div class="row between"><h3>${esc(l.empresa)}</h3>${pillEtapa(o.etapa)}</div>
      <div class="small muted">${esc(nomeDe(l.ownerId))} · ${esc(l.cidade)}/${l.uf} · potencial ${fmtL(l.consumo)}/mês</div>
      <div class="row" style="gap:6px">${s.rotas.length ? pill(s.rotas.length + ' rota(s) · ' + fmtL(s.mapeado)) : pill('Sem rota', 'warn')}${s.rotas.length ? (s.faltam.length ? pill(s.faltam.length + ' ponto(s) sem posto', 'bad') : pill('Cobertura completa', 'ok')) : ''}</div>
      <div class="small">${esc(a.dica)}</div>
      ${o.proxAcao ? `<div class="small muted">Próxima ação: ${fmtD(o.proxData)} · ${esc(o.proxAcao)}</div>` : ''}
      <div class="row">${a.a ? `<button class="btn go" data-a="${a.a}" data-id="${o.id}">${a.t}</button>` : ''}<a class="btn" href="#t-${o.id}">Abrir transportadora</a></div></div>`; }).join('') || `<div class="card">${vazio('Nenhuma empresa neste grupo.')}</div>`}</div>`;
}

function vTransportadora(o) {
  const l = leadDe(o), s = situacao(o), a = acaoPrincipal(o), edita = podeEditar(l);
  const realizado = soma(S.volumes.filter(v => v.oppId === o.id), v => v.litros);
  const passos = [['Qualificada', true], ['Rota mapeada', s.rotas.length > 0], ['Cobertura completa', s.coberto], ['Fechamento', s.fechado || o.etapa === 'Ativo'], ['Ativa', o.etapa === 'Ativo']];
  const atual = passos.findIndex(p => !p[1]);
  const tabs = [['passo', 'Próximo passo'], ['rotas', 'Rotas e postos'], ['dados', 'Dados'], ['reuniao', 'Reunião'], ['hist', 'Histórico']];
  let corpo = '';
  if (ui.tTab === 'passo') {
    const props = S.propostas.filter(p => p.oppId === o.id);
    corpo = `<div class="card"><div class="steps">${passos.map((p, i) => `<div class="step ${p[1] ? 'done' : i === atual ? 'now' : ''}">${p[1] ? 'Concluído' : i === atual ? 'Agora' : 'Depois'}<b>${p[0]}</b></div>`).join('')}</div></div>
    <div class="note ${o.etapa === 'Perdido' ? 'bad' : s.faltam.length ? 'warn' : 'ok'}"><b>${esc(a.dica)}</b>${o.etapa === 'Fechado' && !s.coberto ? ' Fechado e Ativo são situações diferentes: a ativação exige rota e cobertura de todos os pontos.' : ''}</div>
    <div class="kpis">${stat('Potencial', fmtL(l.consumo))}${stat('Mapeado em rotas', fmtL(s.mapeado))}${stat('Ativado', fmtL(o.volumeAtivado))}${stat('Realizado', fmtL(realizado))}${stat('Frota', l.frota + ' veículos')}</div>
    <div class="card stack"><h3>Propostas</h3><div class="table-wrap"><table><thead><tr><th class="r">Preço (R$/L)</th><th class="r">Litros/mês</th><th>Validade</th><th>Situação</th><th>Condições</th></tr></thead><tbody>
      ${props.map(p => `<tr><td class="r">${esc(p.preco)}</td><td class="r">${fmtL(p.litros)}</td><td class="num">${fmtD(p.validade)}</td><td>${pill(p.status, p.status === 'Aceita' ? 'ok' : p.status === 'Recusada' ? 'bad' : 'info')}</td><td class="muted">${esc(p.condicoes)}</td></tr>`).join('') || `<tr><td colspan="5">${vazio('Nenhuma proposta registrada.')}</td></tr>`}</tbody></table></div>
      <div class="small muted">Proposta aceita não muda a etapa para Fechado. Registre também o fechamento.</div></div>`;
  } else if (ui.tTab === 'rotas') {
    corpo = s.rotas.map(r => `<div class="card stack"><div class="row between"><h3>${esc(r.origem)} → ${esc(r.destino)} · ${esc(r.rodovia)}</h3><div class="row">${pill(fmtL(r.litros) + '/mês')}${pillCob(coberturaRota(r))}</div></div>
      <div><div class="row" style="gap:6px"><span class="eyebrow">Mapa da cobertura</span>${NOVO}</div>
      <div class="strip"><div class="stop ok"><b>${esc(r.origem)}</b>Origem</div>${r.pontos.map(p => { const ps = postoDoPonto(p); return `<div class="stop ${ps ? 'ok' : 'miss'}"><b>${esc(p.cidade)}/${p.uf}</b>${p.combustivel} · ${fmtL(p.litros)}<br>${ps ? esc(ps.nome) : 'Sem posto'}</div>`; }).join('')}<div class="stop ok"><b>${esc(r.destino)}</b>Destino</div></div></div>
      <div class="table-wrap"><table><thead><tr><th>Ponto</th><th>Rodovia</th><th>Combustível</th><th class="r">Litros/mês</th><th>Cobertura</th><th></th></tr></thead><tbody>
      ${r.pontos.map(p => { const ps = postoDoPonto(p), q = postoOppDe(chave(p)); return `<tr><td><b>${esc(p.cidade)}/${p.uf}</b></td><td>${esc(p.rodovia)}</td><td>${p.combustivel}</td><td class="r">${fmtL(p.litros)}</td><td>${ps ? pill(ps.nome, 'ok') : pill('Sem posto', 'bad')}</td><td class="r">${ps ? '' : `<button class="btn sm" data-a="oppPosto" data-k="${esc(chave(p))}">${q ? 'Abrir negociação do posto' : 'Gerar oportunidade de posto'}</button>`}</td></tr>`; }).join('')}</tbody></table></div>
      ${r.frequencia || r.precoAtual ? `<div class="small muted">${esc(r.frequencia)}${r.precoAtual ? ' · paga hoje R$ ' + esc(r.precoAtual) + '/L' : ''}</div>` : ''}</div>`).join('') || `<div class="card">${vazio('Nenhuma rota cadastrada. Mapeie a primeira rota para verificar a cobertura.')}</div>`;
    corpo += `<div class="small muted">Disponível para distribuir em novas rotas: <b>${fmtL(l.consumo - s.mapeado)}</b>. A cobertura é cadastral: confirme distância, sentido da rodovia e horário antes de operar.</div>`;
  } else if (ui.tTab === 'dados') {
    corpo = `<div class="card"><dl class="dl">${[['Razão social', l.empresa], ['CNPJ', l.cnpj || '—'], ['Responsável', l.contato], ['Telefone', l.telefone || '—'], ['E-mail', l.email || '—'], ['Cidade', l.cidade + '/' + l.uf], ['Bases', l.bases.join(', ')], ['Frota', l.frota + ' veículos'], ['Consumo estimado', fmtL(l.consumo) + '/mês'], ['Combustível', l.combustivel], ['Sistema atual', l.sistema || '—'], ['Vendedor', nomeDe(l.ownerId)], ['Preço atual', o.precoAtual ? 'R$ ' + o.precoAtual : '—'], ['Concorrente', o.concorrente || '—']].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>
    ${edita ? `<div><button class="btn" data-a="cadastro" data-id="${l.id}">Cadastro completo</button></div>` : ''}`;
  } else if (ui.tTab === 'reuniao') {
    corpo = `<div class="card stack"><h3>Resumo da reunião</h3><p>${l.resumo ? esc(l.resumo) : '<span class="muted">Nenhum resumo salvo.</span>'}</p>
      <div class="note">O resumo é uma anotação. A realização é uma atividade: para contar na meta, use Registrar reunião.</div>
      ${edita ? `<div class="row"><button class="btn" data-a="editarLead" data-id="${l.id}">Editar contato e resumo</button><button class="btn" data-a="registro" data-canal="reuniao" data-id="${l.id}">Registrar reunião</button></div>` : ''}</div>`;
  } else {
    const ev = [...S.atividades.filter(x => x.leadId === l.id).map(x => ({ data: x.data, userId: x.userId, texto: (x.tipo === 'agendamento' ? 'Reunião agendada' : CANAIS[x.canal] + (x.conversa ? ' · houve conversa' : '')) + (x.nota ? ' — ' + x.nota : '') + (x.desc ? ' (desconsiderado)' : '') })), ...S.historico.filter(x => x.leadId === l.id)]
      .sort((a, b) => b.data.localeCompare(a.data)).slice(0, 100);
    corpo = `<div class="card"><div class="list">${ev.map(e => `<div class="item"><div><div>${esc(e.texto)}</div><div class="small muted">${fmtD(e.data)} · ${esc(nomeDe(e.userId))}</div></div></div>`).join('') || vazio('Sem registros.')}</div></div>`;
  }
  return `<div class="row between"><a href="#negociacoes" class="btn sm ghost">← Negociações</a><div class="row">${pillEtapa(o.etapa)}${pill(nomeDe(l.ownerId), 'info')}</div></div>
  ${edita ? `<div class="row">${a.a ? `<button class="btn go" data-a="${a.a}" data-id="${o.id}">${a.t}</button>` : ''}
    ${o.etapa !== 'Ativo' ? `<button class="btn" data-a="rota" data-id="${o.id}">Mapear rota</button>` : ''}
    <button class="btn" data-a="negociacao" data-id="${o.id}">Atualizar negociação</button><button class="btn" data-a="proposta" data-id="${o.id}">Registrar proposta</button>
    ${o.etapa === 'Ativo' ? `<button class="btn" data-a="importarCP4" data-id="${o.id}">Importar abastecimentos da plataforma CP4 ${NOVO}</button>` : ''}</div>` : ''}
  <div class="tabs">${tabs.map(([v, t]) => `<button class="${ui.tTab === v ? 'on' : ''}" data-a="tTab" data-v="${v}">${t}</button>`).join('')}</div>${corpo}`;
}

function vPostos() {
  const tabs = `<div class="tabs">${[['demanda', 'Onde precisamos de postos'], ['rede', 'Rede credenciada']].map(([v, t]) => `<button class="${ui.postosTab === v ? 'on' : ''}" data-a="postosTab" data-v="${v}">${t}</button>`).join('')}</div>`;
  if (ui.postosTab === 'rede') {
    const f = ui.rede, q = norm(f.q), ps = S.postos.filter(p => (!q || [p.nome, p.cidade, p.rodovia, p.bandeira].some(x => norm(x).includes(q))) && (!f.uf || p.uf === f.uf) && (!f.status || p.status === f.status));
    return tabs + `<div class="row between"><div class="filters" style="flex:1"><input type="search" id="rede-q" placeholder="Nome, cidade, rodovia ou bandeira" value="${esc(f.q)}" data-i="redeQ">
      <select id="rede-uf" data-c="rede" data-k="uf"><option value="">UF</option>${[...new Set(S.postos.map(p => p.uf))].sort().map(u => `<option ${f.uf === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      <select id="rede-st" data-c="rede" data-k="status"><option value="">Status</option>${['Credenciado', 'Ativo', 'Inativo'].map(u => `<option ${f.status === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      ${gestor() ? '<button class="btn primary" data-a="posto">Cadastrar posto</button>' : ''}</div>
    <div class="table-wrap" id="lista-rede"><table><thead><tr><th>Posto</th><th>Bandeira</th><th>Cidade</th><th>Rodovia</th><th>KM</th><th>Combustíveis</th><th class="r">Preço ref.</th><th>Status</th><th></th></tr></thead><tbody>
    ${ps.map(p => `<tr><td><b>${esc(p.nome)}</b></td><td>${esc(p.bandeira)}</td><td>${esc(p.cidade)}/${p.uf}</td><td>${esc(p.rodovia)}</td><td class="num">${esc(p.km)}</td><td>${p.combustiveis.join(', ')}</td><td class="r">${p.preco ? 'R$ ' + esc(p.preco) : '—'}</td><td>${pill(p.status, p.status === 'Inativo' ? 'bad' : 'ok')}</td><td class="r">${gestor() ? `<button class="btn sm" data-a="posto" data-id="${p.id}">Editar</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="9">${vazio('Nenhum posto neste recorte.')}</td></tr>`}</tbody></table></div>
    <div class="small muted">Postos inativos deixam de oferecer cobertura. Depois do credenciamento, a edição do posto fica com gerente ou administrador.</div>`;
  }
  const d = demanda(), max = d.length ? d[0].litros : 1, emAnd = S.postoOpps.filter(q => !q.credenciado);
  return tabs + `<div class="card"><div class="section-title"><h3>Prioridade de credenciamento</h3><span class="small muted">Litros por mês ainda sem cobertura, do maior para o menor.</span></div>
    ${d.map((x, i) => { const q = postoOppDe(x.k); return `<div class="rank"><div><div class="t"><b>${i + 1}. ${esc(x.cidade)}/${x.uf}</b> · ${esc(x.rodovia)} · ${x.combustivel}</div>
        <div class="small muted">${[...x.opps].map(id => esc(leadDe(opp(id)).empresa)).join(', ')}</div>
        ${x.destrava.size ? `<div class="small" style="margin-top:4px">${NOVO} Credenciar aqui deixa ${x.destrava.size} transportadora(s) com cobertura completa.</div>` : ''}</div>
      <div><div class="num"><b>${fmtL(x.litros)}</b>/mês · ${x.opps.size} transportadora(s)</div><div class="bar" style="margin-top:6px"><i style="width:${Math.round(x.litros / max * 100)}%"></i></div></div>
      <div class="stack tight">${q ? pill(q.etapa + ' · ' + nomeDe(q.ownerId).split(' ')[0], 'info') : ''}<button class="btn ${q ? '' : 'go'} sm" data-a="oppPosto" data-k="${esc(x.k)}">${q ? 'Abrir negociação' : 'Gerar oportunidade de posto'}</button></div></div>`; }).join('') || vazio('Todos os pontos das rotas têm posto credenciado.')}</div>
  <div class="card"><h3>Negociações de postos em andamento</h3><div class="list">${emAnd.map(q => `<div class="item"><div><div class="t">${esc(q.nome || 'Posto a identificar')}</div><div class="small muted">${esc(q.cidade)}/${q.uf} · ${esc(q.rodovia)} · ${q.combustivel} · ${esc(nomeDe(q.ownerId))}</div></div>${pill(q.etapa, 'info')}<button class="btn sm" data-a="oppPosto" data-k="${esc(chave(q))}">Abrir</button></div>`).join('') || vazio('Nenhuma negociação aberta.')}</div></div>`;
}

function vVisao() {
  const vend = S.users.filter(u => u.perfil === 'vendedor' && u.ativo), os = S.opps, ab = os.filter(o => !['Ativo', 'Perdido'].includes(o.etapa)), d = demanda(), T = hoje();
  const linha = u => { const m = metricas(u.id), mt = metaDe(u.id), c = (r, x) => `<td class="r">${r}${x ? ` <span class="muted">/ ${x}</span>` : ''}<div class="bar" style="margin-top:4px"><i style="width:${x ? Math.min(100, Math.round(r / x * 100)) : 0}%"></i></div></td>`;
    return `<tr><td><b>${esc(u.nome)}</b></td>${c(m.msg, mt.msg)}${c(m.lig, mt.lig)}${c(m.efet, mt.efet)}${c(m.reun, mt.reun)}${c(m.vendas, mt.vendas)}</tr>`; };
  const max = Math.max(1, ...ETAPAS.map(e => os.filter(o => o.etapa === e).length));
  const atras = S.leads.filter(l => l.proxData && l.proxData < T && !['fechamento', 'sem_interesse'].includes(l.status)).length;
  return `<div class="kpis">${stat('Leads em prospecção', S.leads.filter(l => !l.oppId).length)}${stat('Oportunidades qualificadas', os.length)}${stat('Litros potenciais', fmtL(soma(ab, o => leadDe(o).consumo)))}${stat('Aguardando cobertura', fmtL(soma(d, x => x.litros)), 1)}${stat('Litros ativados', fmtL(soma(os, o => o.volumeAtivado)))}${stat('Transportadoras ativas', os.filter(o => o.etapa === 'Ativo').length)}${stat('Postos credenciados', S.postos.filter(p => p.status !== 'Inativo').length)}${stat('Pontos sem posto', d.length, 1)}</div>
  <section class="stack"><h2>Metas da equipe</h2><div class="table-wrap"><table><thead><tr><th>Vendedor</th><th class="r">Mensagens (dia)</th><th class="r">Ligações (dia)</th><th class="r">Contatos efetivos (dia)</th><th class="r">Reuniões (semana)</th><th class="r">Vendas (mês)</th></tr></thead><tbody>${vend.map(linha).join('')}</tbody></table></div></section>
  <section class="grid g2">
    <div class="card stack"><div class="section-title"><h3>Onde a rede precisa crescer</h3><a href="#postos" class="small">Ver ranking completo</a></div>
      ${d.slice(0, 5).map(x => `<div class="item"><div><div class="t">${esc(x.cidade)}/${x.uf} · ${esc(x.rodovia)}</div><div class="small muted">${x.combustivel} · ${x.opps.size} transportadora(s)</div></div><b class="num">${fmtL(x.litros)}</b></div>`).join('') || vazio('Sem pendências de cobertura.')}</div>
    <div class="card stack"><h3>Atenção do comercial</h3><div class="list">
      <div class="item"><div>Retornos atrasados na equipe</div>${pill(atras, atras ? 'bad' : 'ok')}</div>
      <div class="item"><div>Fechadas sem rota mapeada</div>${pill(os.filter(o => situacao(o).fechado && !rotasDe(o).length).length)}</div>
      <div class="item"><div>Prontas para ativar</div>${pill(os.filter(o => grupoDe(o) === 'prontas').length, 'ok')}</div>
      <div class="item"><div>Vendas fechadas sem cadastro de transportadora</div>${pill(S.leads.filter(l => l.fechado && !l.oppId).length, 'warn')}</div></div></div>
  </section>
  <section class="card stack"><h3>Oportunidades por etapa</h3>${ETAPAS.map(e => { const n = os.filter(o => o.etapa === e).length; return `<div class="hbar"><span>${e}</span><div class="bar"><i style="width:${n / max * 100}%"></i></div><b class="num">${n}</b></div>`; }).join('')}</section>`;
}

function vEquipe() {
  const p = S.metas.padrao, rot = { msg: 'Mensagens/dia', lig: 'Ligações/dia', efet: 'Contatos efetivos/dia', reun: 'Reuniões/semana', vendas: 'Vendas/mês' };
  return `<div class="card stack"><div class="row between"><h3>Meta padrão por vendedor</h3><button class="btn primary" data-a="metas" data-uid="">Definir meta padrão</button></div>
    <div class="kpis">${Object.keys(rot).map(k => stat(rot[k], p[k] === '' || p[k] == null ? '—' : p[k])).join('')}</div></div>
  <section class="grid g2">${S.users.filter(u => u.perfil === 'vendedor').map(u => { const mt = metaDe(u.id), ind = S.metas.ind[u.id] || {}; return `<div class="card stack"><div class="row between"><h3>${esc(u.nome)}</h3>${u.ativo ? pill('Ativo', 'ok') : pill('Inativo', 'bad')}</div>
      <div class="row" style="gap:6px">${Object.keys(rot).map(k => pill(rot[k] + ': ' + (mt[k] ?? '—') + (ind[k] != null && ind[k] !== '' ? ' (individual)' : ''), ind[k] != null && ind[k] !== '' ? 'info' : '')).join('')}</div>
      <div><button class="btn sm" data-a="metas" data-uid="${u.id}">Ajustar metas</button></div></div>`; }).join('')}</section>
  <section class="stack"><div class="row between"><h2>Equipe comercial</h2>${eu().perfil === 'admin' ? '<button class="btn" data-a="acesso">Liberar acesso</button>' : '<span class="small muted">Somente o administrador libera ou altera acessos.</span>'}</div>
    <div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Acesso</th><th></th></tr></thead><tbody>${S.users.map(u => `<tr><td><b>${esc(u.nome)}</b></td><td>${esc(u.email)}</td><td>${u.perfil}</td><td>${u.ativo ? pill('Ativo', 'ok') : pill('Inativo', 'bad')}</td><td class="r">${eu().perfil === 'admin' ? `<button class="btn sm" data-a="acesso" data-id="${u.id}">Editar</button>` : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function resumoVendedores() {
  return S.users.filter(u => u.perfil === 'vendedor' && (gestor() || u.id === S.me)).map(u => {
    const os = S.opps.filter(o => leadDe(o).ownerId === u.id), at = os.filter(o => o.etapa === 'Ativo').length, pe = os.filter(o => o.etapa === 'Perdido').length;
    return { u, os, n: os.length, potencial: soma(os.filter(o => !['Ativo', 'Perdido'].includes(o.etapa)), o => leadDe(o).consumo), ativado: soma(os, o => o.volumeAtivado), conv: at + pe ? Math.round(at / (at + pe) * 100) + '%' : '—' };
  });
}
function vRelatorios() {
  const rs = resumoVendedores(), vols = S.volumes.filter(v => v.data.slice(0, 7) === ui.relMes && (gestor() || leadDe(opp(v.oppId)).ownerId === S.me)).sort((a, b) => b.data.localeCompare(a.data));
  return `<section class="stack"><div class="row between"><h2>Resultado por vendedor</h2><button class="btn" data-a="csv">Exportar CSV</button></div>
    <div class="table-wrap"><table><thead><tr><th>Vendedor</th><th class="r">Oportunidades</th><th class="r">Potencial aberto</th><th class="r">Volume ativado</th><th class="r">Conversão</th></tr></thead><tbody>${rs.map(r => `<tr><td><b>${esc(r.u.nome)}</b></td><td class="r">${r.n}</td><td class="r">${fmtL(r.potencial)}</td><td class="r">${fmtL(r.ativado)}</td><td class="r">${r.conv}</td></tr>`).join('')}</tbody></table></div>
    <div class="small muted">Conversão = ativos ÷ (ativos + perdidos). Posição atual das oportunidades, sem filtro de período.</div></section>
  <section class="stack"><h2>Funil por vendedor</h2><div class="table-wrap"><table><thead><tr><th>Etapa</th>${rs.map(r => `<th class="r">${esc(r.u.nome.split(' ')[0])}</th>`).join('')}</tr></thead><tbody>${ETAPAS.map(e => `<tr><td>${e}</td>${rs.map(r => `<td class="r">${r.os.filter(o => o.etapa === e).length || '·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
  <section class="stack"><div class="row between"><h2>Volume realizado</h2><label class="row small muted">Mês <input type="month" id="rel-mes" value="${ui.relMes}" data-c="relMes" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px"></label></div>
    <div class="table-wrap"><table><thead><tr><th>Data</th><th>Transportadora</th><th>Posto</th><th class="r">Litros</th><th>Referência</th><th>Origem</th></tr></thead><tbody>${vols.map(v => `<tr><td class="num">${fmtD(v.data)}</td><td>${esc(leadDe(opp(v.oppId)).empresa)}</td><td>${esc((S.postos.find(p => p.id === v.postoId) || {}).nome)}</td><td class="r">${fmtL(v.litros)}</td><td class="mono">${esc(v.ref)}</td><td>${v.origem === 'plataforma' ? pill('Plataforma CP4', 'dark') : pill('Manual')}</td></tr>`).join('') || `<tr><td colspan="6">${vazio('Nenhum abastecimento lançado neste mês.')}</td></tr>`}</tbody>
    ${vols.length ? `<tfoot><tr><td colspan="3"><b>Total</b></td><td class="r"><b>${fmtL(soma(vols, v => v.litros))}</b></td><td colspan="2"></td></tr></tfoot>` : ''}</table></div></section>`;
}
function vConfig() {
  return `<div class="card stack"><h3>Critérios comerciais</h3><div class="list">
    <div class="item"><div><div class="t">Fuso das datas</div><div class="small muted">America/Sao_Paulo. Semana de segunda a domingo.</div></div></div>
    <div class="item"><div><div class="t">Cobertura de um ponto</div><div class="small muted">Posto com a mesma cidade, UF, rodovia e combustível, com status Credenciado ou Ativo.</div></div></div>
    <div class="item"><div><div class="t">Contato efetivo</div><div class="small muted">Empresas distintas com conversa confirmada, por usuário e por dia.</div></div></div>
    <div class="item"><div><div class="t">Venda fechada</div><div class="small muted">Primeiro fechamento por empresa. Reabrir tira do realizado; fechar de novo mantém a data original.</div></div></div>
    <div class="item"><div><div class="t">Ativação</div><div class="small muted">Exige Fechado ou Implantação, pelo menos uma rota e cobertura em todos os pontos.</div></div></div></div>
    <div class="row"><a class="btn" href="#prospeccao">Ir para Prospecção</a><a class="btn" href="#postos">Ver demanda da rede</a></div></div>
  <div class="card stack"><div class="row"><h3>O que este protótipo propõe além da ferramenta atual</h3>${NOVO}</div><div class="list">
    <div class="item"><div><div class="t">Mapa da cobertura na rota</div><div class="small muted">Linha do trajeto com cada ponto marcado como coberto ou sem posto, na aba Rotas e postos.</div></div></div>
    <div class="item"><div><div class="t">Impacto do credenciamento</div><div class="small muted">O ranking de postos mostra quantas transportadoras ficam com cobertura completa ao credenciar aquele local.</div></div></div>
    <div class="item"><div><div class="t">Volume realizado vindo da plataforma CP4</div><div class="small muted">Abastecimentos importados da operação, sem digitação. Aqui a importação é simulada.</div></div></div></div></div>`;
}

// ---------- modais ----------
function abrir(m) { modal = m; renderModal(); }
function fecharModal() { modal = null; renderModal(); }
function lerForm() {
  const f = $('#modal-root form'); if (!f) return {};
  const d = Object.fromEntries(new FormData(f)); f.querySelectorAll('input[type=checkbox]').forEach(c => d[c.name] = c.checked); return d;
}
function moldura(titulo, sub, corpo, botoes, largo, form) {
  return `<div class="overlay" data-a="fundo"><form class="modal ${largo ? 'wide' : ''}" data-form="${form}" novalidate>
    <div class="modal-h"><div><h2>${titulo}</h2>${sub ? `<div class="small muted">${sub}</div>` : ''}</div><button type="button" class="x" data-a="fechar" aria-label="Fechar">×</button></div>
    ${corpo}<div class="modal-f">${botoes}</div></form></div>`;
}
const selEmpresa = (id, lista) => fld('Empresa', 'leadId', id || '', { full: true, opts: [['', 'Selecione…'], ...(lista || carteira()).slice().sort((a, b) => a.empresa.localeCompare(b.empresa)).map(l => [l.id, l.empresa])] });
const cabLead = l => `<div class="note"><b>${esc(l.empresa)}</b><br>${esc(l.contato || 'Sem contato cadastrado')} · <span class="num">${esc(l.telefone || 'sem telefone')}</span> · ${esc(l.cidade)}/${l.uf} · ${l.bases.join(', ')}${l.consumo ? ' · ' + fmtL(l.consumo) + '/mês' : ''}</div>`;

const M = {
  atender(m) {
    const l = lead(m.leadId), f = m.f, T = hoje(), r = f.resultado;
    const res = [['nao_atendeu', 'Não atendeu'], ['retornar', 'Retornar depois'], ['conversando', 'Estou conversando'], ['interesse', 'Tem interesse'], ['sem_interesse', 'Sem interesse'], ['sem_perfil', 'Sem perfil']];
    let extra = '';
    if (['nao_atendeu', 'retornar', 'conversando'].includes(r)) extra = `<div class="form">${fld(r === 'nao_atendeu' ? 'Tentar novamente em' : 'Data do retorno', 'data', f.data || T, { type: 'date', attrs: `min="${T}"` })}
      <div class="f"><span>Atalhos</span><div class="row" style="gap:6px">${[[0, 'Hoje'], [1, 'Amanhã'], [7, 'Em 7 dias']].map(([n, t]) => `<button type="button" class="btn sm" data-a="atalhoData" data-n="${n}">${t}</button>`).join('')}</div></div>
      ${fld('O que fazer no próximo contato', 'acao', f.acao, { full: true })}</div>`;
    if (r === 'interesse') extra = `<div class="form">${fld('Responsável', 'contato', f.contato ?? l.contato)}${fld('Telefone / WhatsApp', 'telefone', f.telefone ?? l.telefone)}${fld('Consumo mensal (litros)', 'consumo', f.consumo ?? l.consumo, { type: 'number', attrs: 'min="1"' })}${fld('Combustível', 'combustivel', f.combustivel ?? l.combustivel, { opts: COMBUSTIVEIS })}</div>
      <div class="note ok">Ao salvar, a empresa é qualificada e entra em Negociações${l.oppId ? ' (já existe oportunidade: o vínculo é mantido).' : '.'}</div>`;
    const btn = r === 'interesse' ? (l.oppId ? 'Salvar e abrir negociação' : 'Salvar e mapear rota') : 'Salvar atendimento';
    return moldura('Atendimento do lead', '', `${cabLead(l)}
      <div class="row"><button type="button" class="btn sm" data-a="atalho" data-t="Ligar">Ligar</button><button type="button" class="btn sm" data-a="atalho" data-t="Abrir WhatsApp">Abrir WhatsApp</button><span class="small muted">Os atalhos não salvam o atendimento.</span></div>
      <div class="form">${fld('Como você falou com a empresa?', 'canal', f.canal || 'ligacao', { opts: Object.entries(CANAIS), full: true })}</div>
      <div><div class="eyebrow" style="margin-bottom:6px">Resultado da conversa</div><div class="opts">${res.map(([v, t]) => `<button type="button" class="opt ${r === v ? 'on' : ''}" data-a="resultado" data-v="${v}">${t}</button>`).join('')}</div></div>
      ${r && r !== 'nao_atendeu' ? `<label class="check"><input type="checkbox" id="f-conversa" name="conversa" ${f.conversa ? 'checked' : ''}> Houve conversa com a empresa</label>` : ''}
      ${extra}<div class="form">${fld('Anotação rápida (opcional)', 'nota', f.nota, { type: 'textarea', full: true })}</div>`,
      `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button>${r !== 'interesse' ? '<button class="btn" name="go" value="next">Salvar e próximo lead</button>' : ''}<button class="btn primary" name="go" value="save">${btn}</button>`, false, 'atender');
  },
  fila(m) {
    if (!m.leadId) return moldura('Registrar mensagem', 'Um lead por vez é reservado para você.', `<div class="form">${fld('Base comercial', 'base', m.base || '', { opts: [['', 'Todas as bases'], ...BASES], full: true })}</div>
      <details><summary class="small muted" style="cursor:pointer">Buscar uma empresa específica</summary><div class="form" style="margin-top:8px">${selEmpresa('', S.leads.filter(l => l.ownerId === S.me))}</div></details>`,
      `<button type="button" class="btn ghost" data-a="fechar">Fechar</button><button class="btn lime">Pegar fila</button>`, false, 'filaPegar');
    const l = lead(m.leadId);
    return moldura('Registrar mensagem', 'O texto é preenchido automaticamente. O envio é feito por você no WhatsApp.', `${cabLead(l)}
      <div class="form">${fld('Mensagem pronta · pode editar', 'msg', m.msg, { type: 'textarea', full: true, attrs: 'style="min-height:190px"' })}</div>
      <div class="row"><button type="button" class="btn" data-a="copiar">Copiar mensagem</button><button type="button" class="btn" data-a="atalho" data-t="Abrir WhatsApp">Abrir WhatsApp</button><button type="button" class="btn ghost" data-a="trocarEmpresa">Trocar empresa</button></div>
      <div class="form">${fld('Data da atividade', 'data', hoje(), { type: 'date', attrs: `max="${hoje()}"` })}<div class="f"><span>&nbsp;</span><label class="check"><input type="checkbox" id="f-conversa" name="conversa"> Houve conversa com a empresa</label></div></div>
      <div class="note">Copiar ou abrir o WhatsApp não conta na meta. A mensagem só conta depois de salvar.</div>`,
      `<button class="btn" name="go" value="sair">Salvar e sair</button><button class="btn lime" name="go" value="next">Salvar e próximo da fila</button>`, false, 'filaSalvar');
  },
  registro(m) {
    const reun = m.canal === 'reuniao';
    return moldura(reun ? 'Reunião realizada' : 'Registrar atividade', '', `<div class="form">${selEmpresa(m.leadId)}
      ${fld('Tipo de atividade', 'canal', m.canal, { opts: Object.entries(CANAIS) })}${fld('Data da atividade', 'data', hoje(), { type: 'date', attrs: `max="${hoje()}"` })}
      <div class="f full"><label class="check"><input type="checkbox" id="f-conversa" name="conversa" ${reun ? 'checked' : ''}> ${reun ? 'A reunião foi realizada' : 'Houve conversa com a empresa'}</label></div>
      ${fld('Anotação', 'nota', '', { type: 'textarea', full: true })}</div>`,
      `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">Salvar registro</button>`, false, 'registro');
  },
  agendar(m) {
    return moldura('Agendar reunião', 'Agendar não conta como conversa efetiva nem como reunião realizada.', `<div class="form">${selEmpresa(m.leadId)}
      ${fld('Data da reunião', 'data', addDias(hoje(), 1), { type: 'date', attrs: `min="${hoje()}"` })}${fld('Horário de Brasília', 'hora', '10:00', { type: 'time' })}${fld('Anotação (opcional)', 'nota', '', { type: 'textarea', full: true })}</div>`,
      `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">Salvar registro</button>`, false, 'agendar');
  },
  ajuste() {
    const m = metricas(S.me);
    return moldura('Ajustar total de contatos', `Hoje há ${m.efetDet} contato(s) efetivo(s) detalhado(s).`, `<div class="form">${fld('Total de empresas com quem conversou hoje', 'total', m.efet, { type: 'number', attrs: `min="${m.efetDet}"` })}${fld('Motivo', 'motivo', '', { full: true })}</div>
      <div class="note">A diferença fica como complemento manual. Não cria atendimentos nem move clientes no quadro.</div>`,
      `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">Salvar ajuste</button>`, false, 'ajuste');
  },
  motivo(m) {
    const l = lead(m.leadId);
    return moldura('Motivo da recusa', esc(l.empresa), `<div class="form">${fld('Motivo', 'motivo', l.motivoRecusa, { type: 'textarea', full: true })}</div>`, `<button type="button" class="btn ghost" data-a="fechar">Agora não</button><button class="btn primary">Salvar motivo</button>`, false, 'motivo');
  },
  lead(m) {
    const l = m.leadId ? lead(m.leadId) : { combustivel: 'S10', ownerId: S.me, bases: [] }, novo = !m.leadId, comp = m.completo || novo;
    const dono = gestor() ? fld('Responsável comercial', 'ownerId', l.ownerId || '', { opts: [['', 'Fila livre'], ...S.users.filter(u => u.ativo).map(u => [u.id, u.nome])] }) : '';
    const basico = `${fld('Nome da empresa', 'empresa', l.empresa, { full: true, attrs: 'required' })}${fld('Com quem vamos falar?', 'contato', l.contato)}${fld('Telefone / WhatsApp', 'telefone', l.telefone)}`;
    const mais = `${fld('Cidade', 'cidade', l.cidade)}${fld('UF', 'uf', l.uf || '', { opts: UFS })}${fld('CNPJ', 'cnpj', l.cnpj)}${fld('E-mail', 'email', l.email, { type: 'email' })}${fld('Frota (veículos)', 'frota', l.frota, { type: 'number', attrs: 'min="0"' })}${fld('Consumo estimado (L/mês)', 'consumo', l.consumo, { type: 'number', attrs: 'min="0"' })}${fld('Combustível', 'combustivel', l.combustivel, { opts: COMBUSTIVEIS })}${fld('Sistema / cartão atual', 'sistema', l.sistema)}${fld('Região / base comercial (personalizada)', 'regiao', l.regiao)}${dono}${fld('Observações', 'obs', l.obs, { type: 'textarea', full: true })}`;
    const corpo = novo ? `<div class="form">${basico}${fld('Cidade', 'cidade', '')}${fld('UF', 'uf', '', { opts: UFS })}</div><details><summary class="small muted" style="cursor:pointer">Mais informações (opcional)</summary><div class="form" style="margin-top:10px">${fld('CNPJ', 'cnpj', '')}${fld('E-mail', 'email', '', { type: 'email' })}${fld('Frota (veículos)', 'frota', '', { type: 'number' })}${fld('Consumo estimado (L/mês)', 'consumo', '', { type: 'number' })}${fld('Combustível', 'combustivel', 'S10', { opts: COMBUSTIVEIS })}${fld('Sistema / cartão atual', 'sistema', '')}${dono}${fld('Observações', 'obs', '', { type: 'textarea', full: true })}</div></details>`
      : comp ? `<div class="form">${basico}${mais}</div>` : `<div class="form">${basico}${fld('Resumo da reunião: conversa, condições combinadas e próximos passos', 'resumo', l.resumo, { type: 'textarea', full: true })}</div>`;
    return moldura(novo ? 'Novo lead' : comp ? 'Cadastro completo' : 'Editar contato e reunião', novo ? 'Só o nome é obrigatório. O restante pode ser completado no atendimento.' : esc(l.empresa), corpo,
      `${!novo && !comp ? `<button type="button" class="btn ghost" data-a="cadastro" data-id="${l.id}">Cadastro completo</button>` : ''}<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">${novo ? 'Salvar e começar atendimento' : 'Salvar alterações'}</button>`, comp, 'lead');
  },
  negociacao(m) {
    const o = opp(m.oppId);
    return moldura('Atualizar negociação', esc(leadDe(o).empresa), `<div class="form">${fld('Etapa comercial', 'etapa', o.etapa, { opts: ETAPAS.filter(e => e !== 'Ativo' || o.etapa === 'Ativo'), full: true })}
      ${fld('Preço atual (R$/L)', 'precoAtual', o.precoAtual)}${fld('Concorrente', 'concorrente', o.concorrente)}${fld('Próxima ação', 'proxAcao', o.proxAcao)}${fld('Data', 'proxData', o.proxData, { type: 'date' })}${fld('Motivo da perda (obrigatório em Perdido)', 'motivoPerda', o.motivoPerda, { full: true })}</div>
      <div class="note">Ativo exige o comando de ativação e não é selecionado aqui.</div>`, `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">Salvar</button>`, false, 'negociacao');
  },
  proposta(m) {
    const o = opp(m.oppId), l = leadDe(o);
    return moldura('Registrar proposta', `${esc(l.empresa)} · potencial ${fmtL(l.consumo)}/mês`, `<div class="form">${fld('Preço proposto (R$/L)', 'preco', '')}${fld('Litros por mês', 'litros', situacao(o).mapeado || l.consumo, { type: 'number', attrs: 'min="1"' })}${fld('Validade', 'validade', addDias(hoje(), 15), { type: 'date' })}${fld('Situação', 'status', 'Aberta', { opts: ['Aberta', 'Aceita', 'Recusada'] })}${fld('Condições e observações', 'condicoes', '', { type: 'textarea', full: true })}</div>
      <div class="note">Registro interno. Proposta aceita não muda a etapa para Fechado.</div>`, `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">Salvar</button>`, false, 'proposta');
  },
  rota(m) {
    const o = opp(m.oppId), l = leadDe(o), f = m.f, disp = l.consumo - situacao(o).mapeado, somaP = soma(f.pontos, p => p.litros);
    const passo = `<div class="steps">${['Trajeto e consumo', 'Onde abastecer', 'Conferir e salvar'].map((t, i) => `<div class="step ${f.step > i + 1 ? 'done' : f.step === i + 1 ? 'now' : ''}">Etapa ${i + 1}<b>${t}</b></div>`).join('')}</div>`;
    let corpo, bot;
    if (f.step === 1) {
      corpo = `<div class="note">Disponível para distribuir: <b>${fmtL(disp)}</b> de ${fmtL(l.consumo)}/mês.</div><div class="form">${fld('Cidade de origem', 'origemC', f.origemC)}${fld('UF de origem', 'origemUf', f.origemUf, { opts: UFS })}${fld('Cidade de destino', 'destinoC', f.destinoC)}${fld('UF de destino', 'destinoUf', f.destinoUf, { opts: UFS })}${fld('Rodovia principal', 'rodovia', f.rodovia, { attrs: 'placeholder="Ex.: BR-116"' })}${fld('Litros por mês nesta rota', 'litros', f.litros, { type: 'number', attrs: 'min="1"' })}</div>`;
      bot = `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">Continuar</button>`;
    } else if (f.step === 2) {
      corpo = `<div class="note ${somaP === Number(f.litros) ? 'ok' : 'warn'}">Distribuído: <b>${fmtL(somaP)}</b> de ${fmtL(f.litros)}. A soma dos pontos deve ser exatamente igual ao volume da rota.</div>
        <div>${f.pontos.map((p, i) => `<div class="ponto">${fld('Cidade', 'p_cidade_' + i, p.cidade)}${fld('UF', 'p_uf_' + i, p.uf, { opts: UFS })}${fld('Rodovia', 'p_rodovia_' + i, p.rodovia)}${fld('Combustível', 'p_combustivel_' + i, p.combustivel, { opts: COMBUSTIVEIS })}${fld('Litros/mês', 'p_litros_' + i, p.litros, { type: 'number', attrs: 'min="0"' })}<button type="button" class="btn sm ghost danger" data-a="rmPonto" data-i="${i}" ${f.pontos.length === 1 ? 'disabled' : ''}>Remover</button></div>`).join('')}</div>
        <div><button type="button" class="btn sm" data-a="addPonto" ${f.pontos.length >= 30 ? 'disabled' : ''}>Adicionar outro ponto</button></div>`;
      bot = `<button type="button" class="btn ghost" data-a="rotaVoltar">Voltar</button><button class="btn primary">Continuar</button>`;
    } else {
      corpo = `<div class="note"><b>${esc(f.origemC)}/${f.origemUf} → ${esc(f.destinoC)}/${f.destinoUf}</b> · ${esc(f.rodovia)} · ${fmtL(f.litros)}/mês</div>
        <div class="table-wrap"><table><thead><tr><th>Ponto</th><th>Rodovia</th><th>Combustível</th><th class="r">Litros</th><th>Cobertura hoje</th></tr></thead><tbody>${f.pontos.map(p => `<tr><td>${esc(p.cidade)}/${p.uf}</td><td>${esc(p.rodovia)}</td><td>${p.combustivel}</td><td class="r">${fmtL(p.litros)}</td><td>${postoDoPonto(p) ? pill('Com posto', 'ok') : pill('Sem posto', 'bad')}</td></tr>`).join('')}</tbody></table></div>
        <details><summary class="small muted" style="cursor:pointer">Frequência, preços e outras informações</summary><div class="form" style="margin-top:10px">${fld('Frequência de viagens', 'frequencia', f.frequencia)}${fld('Preço pago atualmente (R$/L)', 'precoAtual', f.precoAtual)}${fld('Postos usados atualmente', 'postosAtuais', f.postosAtuais, { full: true })}${fld('Observações', 'obs', f.obs, { type: 'textarea', full: true })}</div></details>`;
      bot = `<button type="button" class="btn ghost" data-a="rotaVoltar">Voltar</button><button class="btn go">Salvar e ver cobertura</button>`;
    }
    return moldura('Mapear rota', esc(l.empresa), passo + corpo, bot, true, 'rota');
  },
  ativar(m) {
    const o = opp(m.oppId), l = leadDe(o), s = situacao(o), teto = Math.min(s.mapeado, l.consumo);
    return moldura('Ativar transportadora', esc(l.empresa), `<div class="note ok">Fechamento registrado, ${s.rotas.length} rota(s) e cobertura em todos os ${s.pontos.length} pontos.</div>
      <div class="form">${fld('Volume mensal ativado (L)', 'volume', teto, { type: 'number', attrs: `min="1" max="${teto}"`, full: true })}</div><div class="small muted">Máximo: ${fmtL(teto)} (volume mapeado nas rotas, limitado ao potencial).</div>`,
      `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn go">Confirmar ativação</button>`, false, 'ativar');
  },
  volume(m) {
    const o = opp(m.oppId), ps = [...new Set(situacao(o).pontos.map(postoDoPonto).filter(Boolean))];
    return moldura('Registrar volume', esc(leadDe(o).empresa), `<div class="form">${fld('Posto utilizado', 'postoId', '', { opts: ps.map(p => [p.id, `${p.nome} · ${p.cidade}/${p.uf}`]), full: true })}${fld('Data do abastecimento', 'data', hoje(), { type: 'date', attrs: `max="${hoje()}"` })}${fld('Litros realizados', 'litros', '', { type: 'number', attrs: 'min="1"' })}${fld('Referência única (nota, controle ou teste)', 'ref', '', { full: true })}</div>`,
      `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">Salvar</button>`, false, 'volume');
  },
  postoOpp(m) {
    const q = S.postoOpps.find(x => x.id === m.id), d = demanda().find(x => x.k === chave(q)), edita = !q.credenciado && (gestor() || q.ownerId === S.me);
    const pronto = q.nome && q.responsavel && q.telefone && preco(q.preco) > 0 && q.etapa === 'Cadastro';
    return moldura('Oportunidade de posto', `${esc(q.cidade)}/${q.uf} · ${esc(q.rodovia)} · ${q.combustivel} · ${esc(nomeDe(q.ownerId))}`, `
      <div class="note warn"><b>Demanda relacionada:</b> ${d ? `${fmtL(d.litros)}/mês de ${[...d.opps].map(id => esc(leadDe(opp(id)).empresa)).join(', ')}` : 'sem demanda aberta neste local'}</div>
      <fieldset ${edita ? '' : 'disabled'} style="border:0;padding:0;margin:0"><div class="form">${fld('Etapa', 'etapa', q.etapa, { opts: ETAPAS_POSTO, full: true })}${fld('Nome do posto', 'nome', q.nome)}${fld('CNPJ', 'cnpj', q.cnpj)}${fld('Bandeira', 'bandeira', q.bandeira)}${fld('Quilômetro', 'km', q.km)}${fld('Preço negociado (R$/L)', 'preco', q.preco)}${fld('Responsável', 'responsavel', q.responsavel)}${fld('Telefone', 'telefone', q.telefone)}${fld('Data do contato', 'dataContato', q.dataContato, { type: 'date' })}${fld('Observações', 'obs', q.obs, { type: 'textarea', full: true })}</div></fieldset>
      <div class="note">${pronto ? 'Dados salvos completos. Já é possível credenciar.' : 'Para credenciar: salve nome, responsável, telefone, preço maior que zero e a etapa Cadastro. Credenciar usa os dados já salvos.'}</div>`,
      edita ? `<button type="button" class="btn ghost" data-a="fechar">Fechar</button><button class="btn primary">Salvar</button><button type="button" class="btn go" data-a="credenciar" data-id="${q.id}" ${pronto ? '' : 'disabled'}>Credenciar posto</button>` : `<button type="button" class="btn" data-a="fechar">Fechar</button>`, true, 'postoOpp');
  },
  posto(m) {
    const p = m.id ? S.postos.find(x => x.id === m.id) : { combustiveis: ['S10'], status: 'Credenciado' };
    return moldura(m.id ? 'Editar posto' : 'Cadastrar posto', 'Rede credenciada', `<div class="form">${fld('Nome', 'nome', p.nome, { full: true })}${fld('CNPJ', 'cnpj', p.cnpj)}${fld('Bandeira', 'bandeira', p.bandeira)}${fld('Cidade', 'cidade', p.cidade)}${fld('UF', 'uf', p.uf || '', { opts: UFS })}${fld('Rodovia', 'rodovia', p.rodovia)}${fld('KM', 'km', p.km)}${fld('Combustíveis (separe por vírgula)', 'combustiveis', p.combustiveis.join(', '))}${fld('Preço de referência (R$/L)', 'preco', p.preco)}${fld('Status', 'status', p.status, { opts: ['Credenciado', 'Ativo', 'Inativo'] })}${fld('Contato', 'contato', p.contato)}${fld('Observações', 'obs', p.obs, { type: 'textarea', full: true })}</div>`,
      `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">Salvar</button>`, true, 'posto');
  },
  metas(m) {
    const ind = !!m.uid, v = ind ? (S.metas.ind[m.uid] || {}) : S.metas.padrao, u = ind && S.users.find(x => x.id === m.uid), n = (l, k) => fld(l, k, v[k] ?? '', { type: 'number', attrs: 'min="0" max="100000" step="1"' });
    return moldura(ind ? (m.uid === S.me ? 'Minhas metas' : 'Ajustar metas') : 'Definir meta padrão', ind ? esc(u.nome) + (u.perfil === 'vendedor' ? ' · campo vazio segue a meta padrão' : ' · este perfil não herda o padrão dos vendedores') : 'Valores por vendedor',
      `<div class="form">${n('Mensagens por dia', 'msg')}${n('Ligações por dia', 'lig')}${n('Contatos efetivos por dia', 'efet')}${n('Reuniões realizadas por semana', 'reun')}${n('Vendas fechadas por mês', 'vendas')}</div><div class="note">Zero não exige meta naquele indicador, mas continua contando os resultados.</div>`,
      `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">Salvar metas</button>`, false, 'metas');
  },
  acesso(m) {
    const u = m.id ? S.users.find(x => x.id === m.id) : { perfil: 'vendedor', ativo: true };
    return moldura(m.id ? 'Editar acesso' : 'Liberar acesso', 'Libera uma identidade já existente. Não cria conta nem define senha.', `<div class="form">${fld('Nome', 'nome', u.nome)}${fld('E-mail', 'email', u.email, { type: 'email' })}${fld('Perfil', 'perfil', u.perfil, { opts: [['vendedor', 'Vendedor'], ['gerente', 'Gerente'], ['admin', 'Administrador']] })}${fld('Acesso', 'ativo', u.ativo ? '1' : '0', { opts: [['1', 'Ativo'], ['0', 'Inativo']] })}</div>`,
      `<button type="button" class="btn ghost" data-a="fechar">Cancelar</button><button class="btn primary">Salvar acesso</button>`, false, 'acesso');
  },
  csv(m) { return moldura('Exportar CSV', 'Resumo por vendedor', `<div class="form">${fld('Conteúdo do arquivo', 'csv', m.csv, { type: 'textarea', full: true, attrs: 'readonly style="min-height:150px;font-family:var(--font-mono);font-size:12px"' })}</div>`, `<button type="button" class="btn ghost" data-a="fechar">Fechar</button><button type="button" class="btn primary" data-a="baixarCsv">Baixar arquivo</button>`, false, 'nada'); },
};
function renderModal() { $('#modal-root').innerHTML = modal ? M[modal.type](modal) : ''; }

// ---------- envios de formulário ----------
const erro = msg => (toast(msg, true), false);
function fim(msg) { salvar(); fecharModal(); render(); if (msg) toast(msg); return true; }
const F = {
  atender(d, go) {
    const l = lead(modal.leadId), r = modal.f.resultado, T = hoje();
    if (!r) return erro('Escolha o resultado da conversa.');
    if (r === 'interesse') {
      if (!d.contato || !telValido(d.telefone) || !(Number(d.consumo) > 0) || !d.combustivel) return erro('Para qualificar, informe responsável, telefone válido, consumo mensal positivo e combustível.');
      Object.assign(l, { contato: d.contato, telefone: d.telefone, consumo: Number(d.consumo), combustivel: d.combustivel });
    }
    registrar(l, { canal: d.canal, data: T, conversa: r === 'nao_atendeu' ? false : d.conversa, nota: d.nota });
    if (['nao_atendeu', 'retornar', 'conversando'].includes(r)) { l.proxData = d.data || T; l.proxAcao = d.acao || (r === 'nao_atendeu' ? 'Tentar novamente' : 'Retorno combinado'); }
    if (r === 'sem_interesse' || r === 'sem_perfil') { l.status = 'sem_interesse'; l.fechado = false; l.motivoRecusa = (r === 'sem_perfil' ? 'Sem perfil. ' : '') + (d.nota || ''); l.proxData = ''; const o = oppDe(l); if (o) { o.etapa = 'Perdido'; o.motivoPerda = l.motivoRecusa; } }
    if (r === 'interesse') {
      let o = oppDe(l);
      if (!o) { o = { id: 'o' + (S.seq++), leadId: l.id, etapa: 'Novo lead qualificado', precoAtual: '', concorrente: l.sistema || '', proxAcao: 'Mapear rota', proxData: T, motivoPerda: '', volumeAtivado: 0 }; S.opps.push(o); l.oppId = o.id; hist(l, 'Empresa qualificada: oportunidade criada.'); }
      ui.tTab = 'passo'; fim('Atendimento salvo. Empresa em Negociações.'); location.hash = 't-' + o.id; return;
    }
    if (go === 'next') { salvar(); const n = proximoLead(false); if (!n) return fim('Atendimento salvo. Não há leads não trabalhados disponíveis neste recorte.'); reservar(n); salvar(); render(); abrir({ type: 'atender', leadId: n.id, f: {} }); return toast('Atendimento salvo. Próximo lead reservado para você.'); }
    fim('Atendimento salvo.');
  },
  filaPegar(d) {
    const l = d.leadId ? lead(d.leadId) : proximoLead(true, d.base);
    if (!l) return erro('Fila concluída nesta base. Troque de base ou complete telefones na Prospecção.');
    reservar(l); salvar(); render(); abrir({ type: 'fila', base: d.base, leadId: l.id, msg: mensagemPara(l) });
  },
  filaSalvar(d, go) {
    const l = lead(modal.leadId), base = modal.base;
    if (d.data > hoje()) return erro('A atividade deve ter data de hoje ou anterior.');
    registrar(l, { canal: 'whatsapp', data: d.data, conversa: d.conversa, nota: d.msg });
    if (go !== 'next') return fim('Mensagem registrada.');
    salvar(); const n = proximoLead(true, base);
    if (!n) return fim('Mensagem registrada. Fila concluída nesta base.');
    reservar(n); salvar(); render(); abrir({ type: 'fila', base, leadId: n.id, msg: mensagemPara(n) }); toast('Mensagem registrada. Próximo da fila.');
  },
  registro(d) {
    const l = lead(d.leadId); if (!l) return erro('Selecione a empresa.');
    if (!d.data || d.data > hoje()) return erro('A atividade deve ter data de hoje ou anterior.');
    registrar(l, { canal: d.canal, data: d.data, conversa: d.conversa, nota: d.nota });
    if (d.canal === 'reuniao' && d.conversa) { hist(l, 'Reunião registrada como realizada.'); if (l.reuniaoData && l.reuniaoData <= d.data) { l.reuniaoData = ''; l.reuniaoHora = ''; } }
    fim(d.canal === 'reuniao' && !d.conversa ? 'Registro salvo. Sem marcar a realização, a reunião não entra na meta.' : 'Registro salvo.');
  },
  agendar(d) {
    const l = lead(d.leadId); if (!l) return erro('Selecione a empresa.');
    if (!d.data || d.data < hoje() || !d.hora) return erro('Informe hoje ou uma data futura e um horário válido.');
    if (l.status === 'fechamento') return erro('Cliente fechado: reabra o atendimento antes de agendar nova reunião.');
    agendamento(l); reservar(l);
    Object.assign(l, { status: 'reuniao', reuniaoData: d.data, reuniaoHora: d.hora, proxData: d.data, proxAcao: 'Reunião às ' + d.hora });
    hist(l, `Reunião agendada para ${fmtD(d.data)} às ${d.hora}.` + (d.nota ? ' ' + d.nota : ''));
    fim('Reunião agendada.');
  },
  ajuste(d) {
    const m = metricas(S.me), t = Number(d.total);
    if (!(t >= m.efetDet)) return erro('O total não pode ser menor que os contatos efetivos já detalhados. Corrija os registros antes.');
    if (!d.motivo) return erro('Informe o motivo do ajuste.');
    S.ajustes[S.me + '|' + hoje()] = { compl: t - m.efetDet, motivo: d.motivo }; fim('Total ajustado.');
  },
  motivo(d) { const l = lead(modal.leadId); l.motivoRecusa = d.motivo; const o = oppDe(l); if (o && d.motivo) o.motivoPerda = d.motivo; fim('Motivo salvo.'); },
  lead(d) {
    if (!d.empresa || !d.empresa.trim()) return erro('Informe o nome da empresa.');
    const novo = !modal.leadId, l = novo ? null : lead(modal.leadId);
    if (d.cnpj && S.leads.some(x => x !== l && x.cnpj && x.cnpj.replace(/\D/g, '') === d.cnpj.replace(/\D/g, ''))) return erro('Este CNPJ já existe em outro cadastro.');
    if (l && l.oppId && d.consumo !== undefined && Number(d.consumo) < situacao(opp(l.oppId)).mapeado) return erro('O consumo não pode ficar abaixo do volume já distribuído nas rotas.');
    ['frota', 'consumo'].forEach(k => { if (d[k] !== undefined) d[k] = Number(d[k]) || 0; });
    if (!gestor()) delete d.ownerId; else if (d.ownerId === '') d.ownerId = null;
    if (novo) {
      const n = Object.assign({ id: 'l' + (S.seq++), contato: '', telefone: '', cidade: '', uf: '', cnpj: '', email: '', frota: 0, consumo: 0, combustivel: 'S10', sistema: '', regiao: '', bases: [], status: 'nao_trabalhado', ownerId: S.me, proxData: '', proxAcao: '', ultimoContato: '', obs: '', resumo: '', motivoRecusa: '', fechado: false, primeiroFechamento: '', vendaUserId: '', oppId: '', reuniaoData: '', reuniaoHora: '' }, d);
      S.leads.unshift(n); salvar(); render(); toast('Lead criado.');
      return n.ownerId === S.me || gestor() ? abrir({ type: 'atender', leadId: n.id, f: {} }) : fecharModal();
    }
    Object.assign(l, d); hist(l, 'Cadastro atualizado.'); fim('Alterações salvas.');
  },
  negociacao(d) {
    const o = opp(modal.oppId), l = leadDe(o);
    if (d.etapa === 'Perdido' && !d.motivoPerda) return erro('Informe o motivo da perda.');
    if (o.etapa === 'Ativo' && d.etapa !== 'Ativo') return erro('Transportadora ativa: a mudança de etapa precisa de revisão da gestão.');
    const antes = o.etapa; Object.assign(o, d);
    if (d.etapa === 'Fechado' && !l.fechado) fechar(l);
    if (['Fechado', 'Implantação'].includes(antes) && !['Fechado', 'Implantação', 'Ativo'].includes(d.etapa)) { l.fechado = false; if (l.status === 'fechamento') l.status = 'contato'; }
    if (d.etapa === 'Perdido') { l.status = 'sem_interesse'; l.fechado = false; l.motivoRecusa = d.motivoPerda; } else if (l.status === 'sem_interesse') l.status = 'contato';
    if (antes !== d.etapa) hist(l, `Etapa comercial: ${antes} → ${d.etapa}.`);
    fim('Negociação atualizada.');
  },
  proposta(d) {
    const o = opp(modal.oppId), l = leadDe(o), lit = Number(d.litros);
    if (!(preco(d.preco) > 0) || !(lit > 0)) return erro('Preço e litros precisam ser positivos.');
    if (lit > l.consumo) return erro('O volume proposto não pode exceder o potencial da empresa.');
    S.propostas.push({ id: 'pr' + (S.seq++), oppId: o.id, preco: d.preco, litros: lit, validade: d.validade, status: d.status, condicoes: d.condicoes });
    hist(l, `Proposta registrada: R$ ${d.preco}/L para ${fmtL(lit)}/mês (${d.status}).`); ui.tTab = 'passo';
    fim(d.status === 'Aceita' ? 'Proposta salva. Registre também o fechamento.' : 'Proposta salva.');
  },
  rota(d) {
    const o = opp(modal.oppId), l = leadDe(o), f = modal.f; sincRota(d);
    if (f.step === 1) {
      const disp = l.consumo - situacao(o).mapeado;
      if (!f.origemC || !f.origemUf || !f.destinoC || !f.destinoUf || !f.rodovia) return erro('Preencha origem, destino e rodovia principal.');
      if (!(Number(f.litros) > 0)) return erro('O volume da rota deve ser positivo.');
      if (Number(f.litros) > disp) return erro('A soma das rotas ultrapassa o consumo mensal da transportadora.');
      if (!f.pontos[0].rodovia) f.pontos.forEach(p => p.rodovia = p.rodovia || f.rodovia);
      f.step = 2; return renderModal();
    }
    if (f.step === 2) {
      if (f.pontos.some(p => !p.cidade || !p.uf || !p.rodovia || !p.combustivel)) return erro('Preencha cidade, UF, rodovia e combustível de cada ponto.');
      if (new Set(f.pontos.map(chave)).size < f.pontos.length) return erro('Pontos iguais em cidade, UF, rodovia e combustível devem ser agrupados.');
      if (soma(f.pontos, p => p.litros) !== Number(f.litros)) return erro('Distribua exatamente os litros da rota entre os pontos.');
      f.step = 3; return renderModal();
    }
    S.rotas.push({ id: 'r' + (S.seq++), oppId: o.id, origem: `${f.origemC}/${f.origemUf}`, destino: `${f.destinoC}/${f.destinoUf}`, rodovia: f.rodovia, litros: Number(f.litros), pontos: f.pontos.map(p => ({ ...p, litros: Number(p.litros) || 0 })), frequencia: f.frequencia || '', precoAtual: f.precoAtual || '', postosAtuais: f.postosAtuais || '', outras: '', obs: f.obs || '' });
    hist(l, `Rota mapeada: ${f.origemC} → ${f.destinoC}, ${fmtL(f.litros)}/mês.`); ui.tTab = 'rotas';
    fim('Rota salva. Confira a cobertura.'); location.hash = 't-' + o.id;
  },
  ativar(d) {
    const o = opp(modal.oppId), l = leadDe(o), s = situacao(o), v = Number(d.volume);
    if (!(v > 0) || v > Math.min(s.mapeado, l.consumo)) return erro('O volume deve ser positivo e não pode superar o mapeado nas rotas nem o potencial.');
    o.etapa = 'Ativo'; o.volumeAtivado = v; hist(l, `Transportadora ativada com ${fmtL(v)}/mês.`); fim('Transportadora ativada.');
  },
  volume(d) {
    const o = opp(modal.oppId), lit = Number(d.litros);
    if (!d.postoId) return erro('Escolha o posto utilizado.');
    if (!d.data || d.data > hoje()) return erro('A data não pode ser futura.');
    if (!(lit > 0)) return erro('Informe os litros realizados.');
    if (!d.ref || S.volumes.some(v => norm(v.ref) === norm(d.ref))) return erro('Esta referência já existe ou está vazia. Use uma referência única.');
    S.volumes.push({ id: 'vol' + (S.seq++), oppId: o.id, postoId: d.postoId, data: d.data, litros: lit, ref: d.ref, origem: 'manual' }); fim('Volume registrado.');
  },
  postoOpp(d) { const q = S.postoOpps.find(x => x.id === modal.id); Object.assign(q, d); salvar(); render(); renderModal(); toast('Negociação do posto salva.'); },
  posto(d) {
    if (!d.nome || !d.cidade || !d.uf || !d.rodovia) return erro('Informe nome, cidade, UF e rodovia.');
    d.combustiveis = d.combustiveis.split(',').map(x => x.trim()).filter(x => COMBUSTIVEIS.includes(x));
    if (!d.combustiveis.length) return erro('Informe ao menos um combustível: S10, S500, Gasolina, Etanol ou ARLA.');
    if (modal.id) Object.assign(S.postos.find(x => x.id === modal.id), d); else S.postos.push(Object.assign({ id: 'p' + (S.seq++), telefone: '', lat: '', lng: '' }, d));
    fim('Posto salvo. Cobertura recalculada.');
  },
  metas(d) {
    const v = {}; let ok = true;
    Object.entries(d).forEach(([k, x]) => { if (x === '') return; const n = Number(x); if (!Number.isInteger(n) || n < 0 || n > 100000) ok = false; v[k] = n; });
    if (!ok) return erro('Use números inteiros de zero a 100.000.');
    if (modal.uid) S.metas.ind[modal.uid] = v; else S.metas.padrao = Object.assign({ msg: '', lig: '', efet: '', reun: '', vendas: '' }, v);
    fim('Metas salvas.');
  },
  acesso(d) {
    if (!d.nome || !d.email) return erro('Informe nome e e-mail.');
    const u = modal.id && S.users.find(x => x.id === modal.id), ativo = d.ativo === '1';
    if (u && u.perfil === 'admin' && (d.perfil !== 'admin' || !ativo) && S.users.filter(x => x.perfil === 'admin' && x.ativo).length === 1) return erro('O administrador principal deve continuar ativo e com perfil de administrador.');
    if (u) Object.assign(u, { nome: d.nome, email: d.email, perfil: d.perfil, ativo }); else S.users.push({ id: 'u' + (S.seq++), nome: d.nome, email: d.email, perfil: d.perfil, ativo });
    if (!eu().ativo || eu().perfil !== 'admin') S.me = S.users.find(x => x.perfil === 'admin' && x.ativo).id;
    fim('Acesso salvo.');
  },
  nada() {},
};
function sincRota(d) {
  const f = modal.f;
  ['origemC', 'origemUf', 'destinoC', 'destinoUf', 'rodovia', 'litros', 'frequencia', 'precoAtual', 'postosAtuais', 'obs'].forEach(k => { if (d[k] !== undefined) f[k] = d[k]; });
  f.pontos.forEach((p, i) => ['cidade', 'uf', 'rodovia', 'combustivel', 'litros'].forEach(k => { const v = d[`p_${k}_${i}`]; if (v !== undefined) p[k] = k === 'litros' ? (v === '' ? '' : Number(v)) : v.trim(); }));
}
const novoPonto = f => ({ cidade: '', uf: '', rodovia: f.rodovia || '', combustivel: 'S10', litros: '' });

// ---------- ações ----------
const A = {
  menu() { $('#shell').classList.toggle('open'); },
  fechar: fecharModal,
  fundo(d, el, e) { if (e.target === el) fecharModal(); },
  reiniciar() { try { localStorage.removeItem(KEY); } catch (e) { /* ok */ } S = seed(); S.dia = hoje(); salvar(); location.hash = 'meu-dia'; render(); toast('Dados de exemplo restaurados.'); },
  fila() { abrir({ type: 'fila', base: ui.filtros.base }); },
  trocarEmpresa() { abrir({ type: 'fila', base: modal.base }); },
  copiar() { const t = $('#f-msg'); const ok = () => toast('Mensagem copiada. Lembre de salvar para contar na meta.'); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(ok).catch(() => { t.select(); toast('Texto selecionado. Use Ctrl+C para copiar.'); }); },
  atalho(d) { toast(`${d.t}: no produto, este atalho abre o aplicativo. Ele não registra o atendimento.`); },
  registro(d) { abrir({ type: 'registro', canal: d.canal || 'ligacao', leadId: d.id }); },
  agendar(d) { abrir({ type: 'agendar', leadId: d.id }); },
  ajuste() { abrir({ type: 'ajuste' }); },
  desconsiderar(d) { S.atividades.find(a => a.id === d.id).desc = true; salvar(); render(); toast('Registro desconsiderado. O histórico foi mantido.'); },
  atender(d) {
    const l = lead(d.id);
    if (!podeEditar(l)) return toast('Lead já reservado por outro vendedor.', true);
    if (!l.ownerId) { reservar(l); salvar(); render(); toast('Lead reservado para você.'); }
    abrir({ type: 'atender', leadId: l.id, f: {} });
  },
  proximo() { const l = proximoLead(false); if (!l) return toast('Não há leads não trabalhados disponíveis neste recorte.', true); reservar(l); salvar(); render(); abrir({ type: 'atender', leadId: l.id, f: {} }); },
  resultado(d) { Object.assign(modal.f, lerForm(), { resultado: d.v }); modal.f.conversa = !['nao_atendeu'].includes(d.v); renderModal(); },
  atalhoData(d) { $('#f-data').value = addDias(hoje(), Number(d.n)); },
  novoLead() { abrir({ type: 'lead' }); },
  editarLead(d) { if (!podeEditar(lead(d.id))) return toast('Registro de outro vendedor.', true); abrir({ type: 'lead', leadId: d.id }); },
  cadastro(d) { abrir({ type: 'lead', leadId: d.id, completo: true }); },
  motivo(d, el, e) { e.preventDefault(); abrir({ type: 'motivo', leadId: d.id }); },
  base(d) { ui.filtros.base = d.b; ui.pag = {}; render(); },
  vista(d) { ui.vista = d.v; render(); },
  pag(d) { ui.pag[d.col] = (ui.pag[d.col] || 0) + Number(d.d); render(); },
  limpar() { ui.filtros = { base: '', cidade: '', tel: '', q: '', status: '', uf: '', conv: false }; ui.pag = {}; render(); },
  negTab(d) { ui.negTab = d.v; render(); },
  negGrupo(d) { ui.negGrupo = d.v; render(); },
  tTab(d) { ui.tTab = d.v; render(); },
  postosTab(d) { ui.postosTab = d.v; render(); },
  rota(d) { const f = { step: 1, origemC: '', origemUf: '', destinoC: '', destinoUf: '', rodovia: '', litros: '', pontos: [] }; f.pontos.push(novoPonto(f)); abrir({ type: 'rota', oppId: d.id, f }); },
  addPonto() { sincRota(lerForm()); modal.f.pontos.push(novoPonto(modal.f)); renderModal(); },
  rmPonto(d) { sincRota(lerForm()); modal.f.pontos.splice(Number(d.i), 1); renderModal(); },
  rotaVoltar() { sincRota(lerForm()); modal.f.step--; renderModal(); },
  verPostos(d) { ui.tTab = 'rotas'; location.hash = 't-' + d.id; render(); },
  negociacao(d) { abrir({ type: 'negociacao', oppId: d.id }); },
  proposta(d) { abrir({ type: 'proposta', oppId: d.id }); },
  ativar(d) {
    const o = opp(d.id), s = situacao(o);
    if (!s.fechado) return toast('Ativação indisponível: a empresa precisa estar em Fechado ou Implantação.', true);
    if (!s.coberto) return toast('Ativação indisponível: é preciso rota cadastrada e cobertura em todos os pontos.', true);
    abrir({ type: 'ativar', oppId: d.id });
  },
  volume(d) { abrir({ type: 'volume', oppId: d.id }); },
  importarCP4(d) {
    const o = opp(d.id), ps = [...new Set(situacao(o).pontos.map(postoDoPonto).filter(Boolean))], T = hoje(), mes = T.slice(0, 8) + '01';
    let n = 0;
    ps.forEach((p, i) => { const ref = `CP4-TX-${T.replace(/-/g, '')}-${o.id}-${i + 1}`; if (S.volumes.some(v => v.ref === ref)) return; const dt = addDias(T, -1 - i); S.volumes.push({ id: 'vol' + (S.seq++), oppId: o.id, postoId: p.id, data: dt < mes ? mes : dt, litros: 1800 + i * 650, ref, origem: 'plataforma' }); n++; });
    salvar(); render(); toast(n ? `${n} abastecimento(s) importado(s) da plataforma CP4 (simulação).` : 'Nenhum abastecimento novo na plataforma desde a última importação.');
  },
  oppPosto(d) {
    let q = postoOppDe(d.k);
    if (q && q.ownerId !== S.me && !gestor()) return toast(`Já existe negociação de ${nomeDe(q.ownerId)} para este local. Procure o gerente.`, true);
    if (!q) { const x = demanda().find(y => y.k === d.k); if (!x) return toast('Este local já tem cobertura.', true);
      q = { id: 'q' + (S.seq++), cidade: x.cidade, uf: x.uf, rodovia: x.rodovia, combustivel: x.combustivel, etapa: 'Posto identificado', nome: '', cnpj: '', bandeira: '', km: '', preco: '', responsavel: '', telefone: '', whatsapp: '', dataContato: hoje(), obs: '', ownerId: S.me, credenciado: false };
      S.postoOpps.push(q); salvar(); render(); toast('Oportunidade de posto criada.'); }
    abrir({ type: 'postoOpp', id: q.id });
  },
  credenciar(d) {
    const q = S.postoOpps.find(x => x.id === d.id);
    if (!(q.nome && q.responsavel && q.telefone && preco(q.preco) > 0 && q.etapa === 'Cadastro')) return toast('Salve nome, responsável, telefone, preço e a etapa Cadastro antes de credenciar.', true);
    S.postos.push({ id: 'p' + (S.seq++), nome: q.nome, cnpj: q.cnpj, bandeira: q.bandeira, cidade: q.cidade, uf: q.uf, rodovia: q.rodovia, km: q.km, combustiveis: [q.combustivel], preco: q.preco, status: 'Credenciado', contato: q.responsavel, telefone: q.telefone, lat: '', lng: '', obs: q.obs });
    q.credenciado = true; fim('Posto credenciado. A cobertura das rotas foi recalculada.');
  },
  posto(d) { abrir({ type: 'posto', id: d.id }); },
  metas(d) { abrir({ type: 'metas', uid: d.uid }); },
  acesso(d) { abrir({ type: 'acesso', id: d.id }); },
  csv() { abrir({ type: 'csv', csv: 'Vendedor;Oportunidades;Litros potenciais abertos;Litros ativados;Conversão\n' + resumoVendedores().map(r => [r.u.nome, r.n, r.potencial, r.ativado, r.conv].join(';')).join('\n') }); },
  baixarCsv() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + modal.csv], { type: 'text/csv;charset=utf-8' })); a.download = 'cp4-comercial-resumo-vendedores.csv'; a.click(); toast('Arquivo gerado.'); },
};
const C = {
  trocarUsuario(el) { S.me = el.value; salvar(); render(); toast('Você está vendo como ' + eu().nome + ' (' + eu().perfil + ').'); },
  filtro(el) { ui.filtros[el.dataset.k] = el.value; ui.pag = {}; render(); },
  filtroConv(el) { ui.filtros.conv = el.checked; render(); },
  moverSel(el) { moverLead(lead(el.dataset.id), el.value); },
  rede(el) { ui.rede[el.dataset.k] = el.value; render(); },
  relMes(el) { ui.relMes = el.value || hoje().slice(0, 7); render(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = A[el.dataset.a]; if (a) a(el.dataset, el, e);
  if (el.tagName === 'A' && el.closest('.nav')) $('#shell').classList.remove('open');
});
document.addEventListener('change', e => { const el = e.target.closest('[data-c]'); if (el) C[el.dataset.c](el); });
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.i; if (!k) return;
  if (k === 'q') ui.filtros.q = e.target.value; else ui.rede.q = e.target.value;
  const id = e.target.id, pos = e.target.selectionStart; render();
  const n = document.getElementById(id); n.focus(); n.setSelectionRange(pos, pos);
});
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target.dataset.form; if (F[f]) F[f](lerForm(), e.submitter && e.submitter.value); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal) fecharModal(); });
let arrastando = null;
document.addEventListener('dragstart', e => { const c = e.target.closest('[data-lead]'); if (!c) return; arrastando = c.dataset.lead; c.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', arrastando); });
document.addEventListener('dragend', e => { const c = e.target.closest && e.target.closest('[data-lead]'); if (c) c.classList.remove('drag'); document.querySelectorAll('.col.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('dragover', e => { const col = e.target.closest('.col'); if (!col || !arrastando) return; e.preventDefault(); document.querySelectorAll('.col.over').forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over'); });
document.addEventListener('drop', e => { const col = e.target.closest('.col'); if (!col || !arrastando) return; e.preventDefault(); const id = arrastando; arrastando = null; moverLead(lead(id), col.dataset.col); });
window.addEventListener('hashchange', () => { modal = null; renderModal(); render(); window.scrollTo(0, 0); });
render();
