// ==========================================
// movimentacoes.js - IA ESTRITA, INVERSOR R$ E ANIMAÇÕES
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let transacoesFiltradas = [];
let categoriasGlobais = [];

let isHistoricoExpandido = false; 
let reconhecimentoDeVoz = null; 

let timerPressao;
let modoSelecao = false;
let selecionados = new Set();

document.addEventListener('DOMContentLoaded', async () => {
    
    setTimeout(() => document.body.classList.remove('fade-in'), 500);

    document.querySelectorAll('a').forEach(link => {
        if(link.hostname === window.location.hostname && link.target !== '_blank') {
            link.addEventListener('click', e => {
                e.preventDefault();
                const href = link.getAttribute('href');
                document.body.style.opacity = 0;
                document.body.style.transition = 'opacity 0.2s ease-in-out';
                setTimeout(() => window.location.href = href, 200);
            });
        }
    });

    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    const inputRapido = document.getElementById('input-rapido');
    if (inputRapido) {
        inputRapido.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') processarFraseNLP(this.value);
        });
    }

    const hoje = new Date();
    document.getElementById('input-mes').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('transacao-data').value = hoje.toISOString().split('T')[0];

    await carregarDadosDoBanco();
});

window.iniciarPressao = function(id) {
    if (modoSelecao) return; 
    timerPressao = setTimeout(() => { ativarModoSelecao(id); }, 500); 
};

window.cancelarPressao = function() { clearTimeout(timerPressao); };

window.clicarCard = function(event, id) {
    if (modoSelecao) {
        event.preventDefault();
        const card = document.getElementById(`card-transacao-${id}`);
        if (selecionados.has(id)) {
            selecionados.delete(id);
            card.classList.remove('wiggle-ativo');
        } else {
            selecionados.add(id);
            card.classList.add('wiggle-ativo');
        }
        atualizarBarraSelecao();
    }
};

function ativarModoSelecao(idInicial) {
    modoSelecao = true;
    if (navigator.vibrate) navigator.vibrate(50); 
    selecionados.add(idInicial);
    const card = document.getElementById(`card-transacao-${idInicial}`);
    if(card) card.classList.add('wiggle-ativo');
    const barra = document.getElementById('barra-selecao');
    if(barra) barra.classList.replace('hidden', 'flex');
    atualizarBarraSelecao();
}

window.sairModoSelecao = function() {
    modoSelecao = false;
    selecionados.clear();
    document.querySelectorAll('.wiggle-ativo').forEach(card => card.classList.remove('wiggle-ativo'));
    const barra = document.getElementById('barra-selecao');
    if(barra) barra.classList.replace('flex', 'hidden');
};

function atualizarBarraSelecao() {
    const qtd = selecionados.size;
    const contador = document.getElementById('contador-selecao');
    if(contador) contador.innerText = qtd;
    if (qtd === 0) sairModoSelecao();
}

window.excluirSelecionados = async function() {
    if (selecionados.size === 0) return;
    const confirmacao = await Swal.fire({ title: 'Excluir Registros?', text: `Você está prestes a excluir ${selecionados.size} registros. Isso não pode ser desfeito.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8', confirmButtonText: 'Sim, excluir todos', cancelButtonText: 'Cancelar' });
    if (!confirmacao.isConfirmed) return;
    try {
        const idsArray = Array.from(selecionados);
        const { error } = await supabaseClient.from('transacoes').delete().in('id', idsArray).eq('usuario_id', usuarioLogado.id);
        if (error) throw error;
        transacoesGlobais = transacoesGlobais.filter(t => !selecionados.has(t.id));
        sairModoSelecao(); window.aplicarFiltrosHistorico(); atualizarTopCards();
        Swal.fire({ icon: 'success', title: 'Excluídos!', showConfirmButton: false, timer: 1500 });
    } catch(e) { Swal.fire({ icon: 'error', title: 'Erro ao excluir', text: e.message }); }
};

window.animarContador = function(id, valorFinal, formato = 'moeda', duracao = 1000) {
    const elemento = document.getElementById(id);
    if (!elemento) return;
    const startTimestamp = performance.now();
    const step = (currentTimestamp) => {
        const progress = Math.min((currentTimestamp - startTimestamp) / duracao, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4); 
        const valorAtual = easeProgress * valorFinal;
        if (formato === 'moeda') {
            let parts = Math.abs(valorAtual).toFixed(2).split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            elemento.innerText = (valorAtual < 0 ? "- R$ " : "R$ ") + parts.join(',');
        } else if (formato === 'inteiro') { elemento.innerText = Math.round(valorAtual); }
        if (progress < 1) requestAnimationFrame(step);
        else {
            if (formato === 'moeda') {
                let parts = Math.abs(valorFinal).toFixed(2).split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                elemento.innerText = (valorFinal < 0 ? "- R$ " : "R$ ") + parts.join(',');
            } else if (formato === 'inteiro') { elemento.innerText = valorFinal; }
        }
    };
    requestAnimationFrame(step);
};

function removerAcentos(texto) {
    if (!texto) return '';
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function aplicarMascaraMoeda(input) {
    let valor = input.value.replace(/\D/g, ''); 
    if (valor === '') { input.value = ''; return; }
    valor = (parseInt(valor) / 100).toFixed(2) + '';
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    valor = valor.replace(/(\d)(\d{3}),/g, "$1.$2,");
    input.value = valor;
}
window.aplicarMascaraMoeda = aplicarMascaraMoeda;

function desmascararMoeda(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

async function carregarDadosDoBanco() {
    try {
        const [resTrans, resCat] = await Promise.all([
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id).order('data_vencimento', { ascending: false }).order('id', { ascending: false }),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id).order('nome', { ascending: true })
        ]);
        transacoesGlobais = (resTrans.data || []).filter(t => t.tipo !== 'despesa' || t.pago === true);
        categoriasGlobais = resCat.data || [];
        const selectCat = document.getElementById('transacao-categoria');
        selectCat.innerHTML = '<option value="" disabled selected>Selecione a Pasta...</option>' + categoriasGlobais.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        atualizarTopCards(); window.mudarTipoFiltroHistorico(); 
    } catch (e) { console.error("Erro ao puxar dados:", e.message); }
}

function atualizarTopCards() {
    let saldo = 0, entradas = 0, saidas = 0;
    const mesAtual = new Date().getMonth(); const anoAtual = new Date().getFullYear();
    transacoesGlobais.forEach(t => {
        if(t.tipo === 'receita') saldo += t.valor; else saldo -= t.valor;
        if(t.data_vencimento) {
            const d = new Date(t.data_vencimento + 'T12:00:00Z');
            if(d.getMonth() === mesAtual && d.getFullYear() === anoAtual) {
                if(t.tipo === 'receita') entradas += t.valor; else saidas += t.valor;
            }
        }
    });
    window.animarContador('saldo-disponivel', saldo, 'moeda', 1000);
    window.animarContador('entradas-mes', entradas, 'moeda', 1000);
    window.animarContador('saidas-mes', saidas, 'moeda', 1000);
}

window.mudarTipoFiltroHistorico = function() {
    const tipo = document.getElementById('filtro-periodo').value;
    document.getElementById('box-mes').classList.add('hidden'); document.getElementById('box-personalizado').classList.add('hidden');
    if (tipo === 'por_mes') document.getElementById('box-mes').classList.remove('hidden');
    else if (tipo === 'personalizado') document.getElementById('box-personalizado').classList.remove('hidden');
    window.aplicarFiltrosHistorico();
};

window.aplicarFiltrosHistorico = function() {
    isHistoricoExpandido = false; 
    const termoBusca = removerAcentos(document.getElementById('busca-historico').value);
    const tipoFiltro = document.getElementById('filtro-periodo').value;
    transacoesFiltradas = transacoesGlobais.filter(t => {
        let dataOk = true;
        if (t.data_vencimento) {
            const dStr = t.data_vencimento; 
            if (tipoFiltro === 'essa_semana') {
                const d = new Date(t.data_vencimento + 'T12:00:00Z'); d.setHours(0,0,0,0);
                const dataHoje = new Date(); dataHoje.setHours(0,0,0,0);
                const inicioSemana = new Date(dataHoje); inicioSemana.setDate(dataHoje.getDate() - dataHoje.getDay()); 
                const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6); fimSemana.setHours(23, 59, 59, 999);
                dataOk = (d >= inicioSemana && d <= fimSemana);
            } else if (tipoFiltro === 'por_mes') {
                const val = document.getElementById('input-mes').value; if(val) dataOk = dStr.startsWith(val);
            } else if (tipoFiltro === 'personalizado') {
                const dIni = document.getElementById('input-data-inicio').value; const dFim = document.getElementById('input-data-fim').value;
                if (dIni) dataOk = dataOk && (dStr >= dIni); if (dFim) dataOk = dataOk && (dStr <= dFim);
            }
        }
        let buscaOk = true;
        if (termoBusca) {
            const catNome = removerAcentos(categoriasGlobais.find(c => c.id === t.categoria_id)?.nome || '');
            const desc = removerAcentos(t.descricao);
            buscaOk = desc.includes(termoBusca) || catNome.includes(termoBusca) || t.valor.toString().includes(termoBusca);
        }
        return dataOk && buscaOk;
    });
    renderizarMiniKPIs(); renderizarListaHistorico();
};

function renderizarMiniKPIs() {
    let qtdEntradas = 0, qtdSaidas = 0, somaEntradas = 0, somaSaidas = 0;
    transacoesFiltradas.forEach(t => { if(t.tipo === 'receita') { qtdEntradas++; somaEntradas += t.valor; } else { qtdSaidas++; somaSaidas += t.valor; } });
    const balanco = somaEntradas - somaSaidas;
    const corBalanco = balanco >= 0 ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30';
    const sinalBalanco = balanco >= 0 ? '+' : '-';
    document.getElementById('mini-kpis-historico').innerHTML = `
        <span class="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] px-2.5 py-1.5 rounded-lg font-black shadow-sm flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-500/30"><i class="fa-solid fa-arrow-trend-up"></i> <span id="kpi-mini-qtd-ent">0</span> Entradas • <span id="kpi-mini-val-ent">R$ 0,00</span></span>
        <span class="bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-[10px] px-2.5 py-1.5 rounded-lg font-black shadow-sm flex items-center gap-1.5 border border-rose-200 dark:border-rose-500/30"><i class="fa-solid fa-arrow-trend-down"></i> <span id="kpi-mini-qtd-sai">0</span> Saídas • <span id="kpi-mini-val-sai">R$ 0,00</span></span>
        <span class="${corBalanco} text-[10px] px-2.5 py-1.5 rounded-lg font-black shadow-sm flex items-center gap-1.5 border">Fluxo: ${sinalBalanco} <span id="kpi-mini-val-bal">R$ 0,00</span></span>`;
    window.animarContador('kpi-mini-qtd-ent', qtdEntradas, 'inteiro', 800); window.animarContador('kpi-mini-val-ent', somaEntradas, 'moeda', 800);
    window.animarContador('kpi-mini-qtd-sai', qtdSaidas, 'inteiro', 800); window.animarContador('kpi-mini-val-sai', somaSaidas, 'moeda', 800);
    window.animarContador('kpi-mini-val-bal', Math.abs(balanco), 'moeda', 800);
}

window.toggleExpandirHistorico = function() {
    isHistoricoExpandido = !isHistoricoExpandido;
    renderizarListaHistorico();
};

function renderizarListaHistorico() {
    const container = document.getElementById('lista-transacoes');
    const btnToggle = document.getElementById('btn-toggle-historico');
    if (transacoesFiltradas.length === 0) {
        container.innerHTML = `<div class="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700 border-dashed"><i class="fa-solid fa-magnifying-glass text-2xl text-slate-300 dark:text-slate-600 mb-2"></i><p class="text-xs font-bold text-slate-400 mt-2">Nenhum registro encontrado nesta visão.</p></div>`;
        btnToggle.classList.add('hidden'); return;
    }
    const transacoesExibidas = isHistoricoExpandido ? transacoesFiltradas : transacoesFiltradas.slice(0, 5);
    const htmlLista = transacoesExibidas.map(t => {
        const cat = categoriasGlobais.find(c => c.id === t.categoria_id) || { nome: 'Outros', icone: 'fa-tag', cor: 'text-gray-500' };
        const isReceita = t.tipo === 'receita';
        const corBg = isReceita ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10';
        const corTxt = isReceita ? 'text-emerald-500' : 'text-rose-500';
        const corValor = isReceita ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
        const sinal = isReceita ? '+' : '-';
        const iconeSinal = isReceita ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
        let dataStr = t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : '--/--/----';

        return `
        <div id="card-transacao-${t.id}" 
             onmousedown="window.iniciarPressao(${t.id})" onmouseup="window.cancelarPressao()" onmouseleave="window.cancelarPressao()"
             ontouchstart="window.iniciarPressao(${t.id})" ontouchend="window.cancelarPressao()" ontouchmove="window.cancelarPressao()"
             onclick="window.clicarCard(event, ${t.id})"
             class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer select-none">
            <div class="flex items-center gap-4 min-w-0 w-full sm:w-auto pointer-events-none">
                <div class="w-12 h-12 rounded-2xl ${corBg} flex items-center justify-center ${corTxt} text-xl shadow-inner shrink-0 relative">
                    <i class="fa-solid ${cat.icone}"></i>
                    <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${corBg} border border-white dark:border-slate-900 flex items-center justify-center">
                        <i class="fa-solid ${iconeSinal} text-[8px] ${corTxt}"></i>
                    </div>
                </div>
                <div class="min-w-0 flex-1">
                    <h4 class="font-bold text-sm text-slate-900 dark:text-white break-words whitespace-normal leading-tight">${t.descricao}</h4>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">${cat.nome} • <i class="fa-regular fa-calendar ml-0.5"></i> ${dataStr}</p>
                </div>
            </div>
            <div class="flex flex-row sm:flex-col md:flex-row items-center sm:items-end md:items-center justify-between sm:justify-center gap-3 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0">
                <span class="font-black text-base md:text-lg ${corValor} whitespace-nowrap pointer-events-none">${sinal} ${formatarMoeda(t.valor)}</span>
                <div class="flex items-center gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="event.stopPropagation(); window.abrirModalEdicao(${t.id})" class="w-10 h-10 md:w-8 md:h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-indigo-500 hover:text-white transition flex items-center justify-center border border-slate-200 dark:border-slate-700"><i class="fa-solid fa-pen text-sm md:text-xs pointer-events-none"></i></button>
                    <button onclick="event.stopPropagation(); window.excluirTransacao(${t.id})" class="w-10 h-10 md:w-8 md:h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-rose-500 hover:text-white transition flex items-center justify-center border border-slate-200 dark:border-slate-700"><i class="fa-solid fa-trash text-sm md:text-xs pointer-events-none"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = htmlLista;
    if (transacoesFiltradas.length > 5) {
        btnToggle.classList.remove('hidden');
        if (isHistoricoExpandido) btnToggle.innerHTML = '<i class="fa-solid fa-chevron-up"></i> Minimizar Lista';
        else btnToggle.innerHTML = `<i class="fa-solid fa-chevron-down"></i> Mostrar mais ${transacoesFiltradas.length - 5} transações`;
    } else btnToggle.classList.add('hidden');
}

// ==========================================
// CÉREBRO NLP SÊNIOR: REGRA ESTRITA DE INDEFINIDO
// ==========================================
const dicionarioDeInteligencia = [
    { pasta: 'alimentação', regras: [{ titulo: 'Delivery', palavras: ['ifood', 'delivery', 'rappi', 'zedelivery'] }, { titulo: 'Fast Food', palavras: ['pizza', 'hamburguer', 'lanche', 'mcdonalds', 'bk', 'coxinha', 'salgado', 'pastel', 'mequi'] }, { titulo: 'Mercado', palavras: ['mercado', 'supermercado', 'açougue', 'padaria', 'compra', 'compras'] }, { titulo: 'Restaurante', palavras: ['restaurante', 'almoço', 'jantar', 'comida', 'self service'] }]},
    { pasta: 'veículo', regras: [{ titulo: 'Combustível', palavras: ['gasolina', 'álcool', 'alcool', 'etanol', 'diesel', 'posto', 'combustível', 'combustivel', 'abasteci'] }, { titulo: 'Peças / Manutenção', palavras: ['oficina', 'mecânico', 'peça', 'pneu', 'óleo', 'revisão', 'carro', 'moto'] }, { titulo: 'Serviços Auto', palavras: ['estacionamento', 'pedágio', 'lavagem', 'lava rápido'] }, { titulo: 'Transporte', palavras: ['uber', '99', 'ônibus', 'passagem', 'metrô', 'táxi', 'taxi'] }]},
    { pasta: 'moradia', regras: [{ titulo: 'Aluguel', palavras: ['aluguel', 'condomínio'] }, { titulo: 'Conta de Luz', palavras: ['luz', 'energia', 'cpfl', 'cemig', 'enel'] }, { titulo: 'Conta de Água', palavras: ['água', 'sabesp', 'sanepar', 'copasa'] }, { titulo: 'Internet', palavras: ['internet', 'vivo', 'claro', 'tim', 'fibra'] }, { titulo: 'Reparos e Casa', palavras: ['reparo', 'faxina', 'limpeza', 'material de construção'] }]},
    { pasta: 'estudo', regras: [{ titulo: 'Mensalidade', palavras: ['faculdade', 'escola', 'mensalidade'] }, { titulo: 'Cursos Extras', palavras: ['curso', 'certificado', 'prova', 'concurso'] }, { titulo: 'Material Didático', palavras: ['livro', 'caderno', 'material', 'papelaria'] }]},
    { pasta: 'saúde', regras: [{ titulo: 'Remédios', palavras: ['farmácia', 'remédio', 'medicamento'] }, { titulo: 'Consultas Médicas', palavras: ['médico', 'consulta', 'exame', 'dentista', 'terapia', 'psicólogo'] }, { titulo: 'Imprevisto', palavras: ['imprevisto', 'acidente', 'pronto socorro', 'hospital'] }]},
    { pasta: 'lazer', regras: [{ titulo: 'Jogos', palavras: ['jogo', 'steam', 'xbox', 'playstation', 'game'] }, { titulo: 'Passeio', palavras: ['cinema', 'festa', 'shopping', 'bar', 'show', 'viagem', 'ingresso'] }, { titulo: 'Compras Pessoais', palavras: ['roupa', 'presente', 'tênis', 'perfume', 'fone', 'celular', 'compras'] }]},
    { pasta: 'assinaturas', regras: [{ titulo: 'Streaming', palavras: ['netflix', 'spotify', 'amazon', 'prime', 'disney', 'hbo'] }, { titulo: 'Serviços Recorrentes', palavras: ['assinatura', 'gympass', 'academia'] }]}
];

function processarFraseNLP(fraseBruta) {
    if(!fraseBruta || fraseBruta.trim() === '') {
        document.getElementById('form-transacao').reset();
        document.getElementById('transacao-id').value = '';
        document.getElementById('transacao-data').value = new Date().toISOString().split('T')[0];
        document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-money-bill-transfer text-indigo-500"></i> Lançar Valor Real`;
        document.getElementById('modal-transacao').classList.remove('hidden');
        return;
    }

    let textoCru = fraseBruta.toLowerCase();
    
    let dataCalculada = new Date(); dataCalculada.setHours(12,0,0,0);
    if (textoCru.includes('mes passado')) { dataCalculada.setMonth(dataCalculada.getMonth() - 1); textoCru = textoCru.replace(/do mes passado|no mes passado|mes passado/g, ''); }
    if (textoCru.includes('anteontem')) { dataCalculada.setDate(dataCalculada.getDate() - 2); textoCru = textoCru.replace('anteontem', ''); }
    else if (textoCru.includes('ontem')) { dataCalculada.setDate(dataCalculada.getDate() - 1); textoCru = textoCru.replace('ontem', ''); }
    else if (textoCru.includes('hoje')) { textoCru = textoCru.replace('hoje', ''); }

    const matchDataBarra = textoCru.match(/(?:dia\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
    const matchDia = textoCru.match(/(?:no )?dia\s*(\d{1,2})/i);

    if (matchDataBarra) {
        dataCalculada.setDate(1); dataCalculada.setMonth(parseInt(matchDataBarra[2]) - 1); dataCalculada.setDate(parseInt(matchDataBarra[1]));
        if (matchDataBarra[3]) { let ano = parseInt(matchDataBarra[3]); if (ano < 100) ano += 2000; dataCalculada.setFullYear(ano); }
        else if (dataCalculada > new Date()) dataCalculada.setFullYear(dataCalculada.getFullYear() - 1);
        textoCru = textoCru.replace(matchDataBarra[0], ''); 
    } else if (matchDia) {
        let diaNum = parseInt(matchDia[1]); const mesAtual = new Date().getMonth();
        dataCalculada.setDate(1); 
        if (diaNum > new Date().getDate()) dataCalculada.setMonth(mesAtual - 1);
        dataCalculada.setDate(diaNum);
        textoCru = textoCru.replace(matchDia[0], ''); 
    }

    // A MÁGICA DA FUSÃO DE CENTAVOS ("45 e 46" -> "45,46")
    let textoValores = textoCru.replace(/(\d+)\s*(?:reais|r\$|brl)?\s*e\s*(\d{1,2})\s*(?:centavos|centavo|c)?\b/gi, "$1,$2");
    
    // Purificando o Sotaque do Chrome ("52.000" -> "52000")
    textoValores = textoValores.replace(/\.(\d{3})/g, '$1'); 
    textoValores = textoValores.replace(/\bum mil\b/g, '1000'); 
    
    textoValores = textoValores.replace(/\b(\d+(?:,\d+)?)\s*(?:k|mil|milhares)\b/gi, (match, numero) => {
        return (parseFloat(numero.replace(',', '.')) * 1000).toString();
    });

    // Removemos os símbolos para extração matemática
    let extracaoString = textoValores.replace(/\br\$\b|\breais\b|\breal\b|\$|\bconto\b|\bcontos\b|\bcentavos\b|\bcentavo\b|\bbrl\b/gi, ''); 
    const nums = extracaoString.match(/\d+(?:,\d+)?/g);
    const valorExtraido = nums ? Math.max(...nums.map(n => parseFloat(n.replace(',', '.')))) : 0;

    const palavrasReceita = ['recebi', 'ganhei', 'pix', 'salario', 'renda', 'vendi', 'deposito', 'entrou'];
    const isReceita = palavrasReceita.some(p => textoCru.includes(p));

    let catDetectada = null; 
    let tituloFinal = '';

    // Mata a pontuação para buscar no dicionário limpo
    let descCrua = textoCru.replace(/\d+(?:[.,]\d+)?/g, '');
    descCrua = descCrua.replace(/\br\$\b|\breais\b|\breal\b|\$|\bmil\b|\bk\b|\bconto\b|\bcontos\b|\bbrl\b|\bcentavos\b|\bcentavo\b/gi, ' ');
    descCrua = descCrua.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " "); 
    descCrua = removerAcentos(descCrua);

    if (isReceita) {
        catDetectada = categoriasGlobais.find(c => removerAcentos(c.nome.toLowerCase()).includes('renda') || removerAcentos(c.nome.toLowerCase()).includes('salario'));
        if (descCrua.includes('salario')) tituloFinal = 'Salário';
        else if (descCrua.includes('pix')) tituloFinal = 'Transferência Pix';
    } else {
        for (const d of dicionarioDeInteligencia) {
            for (const regra of d.regras) {
                // Caça de Palavra Exata do Dicionário VIP
                if (regra.palavras.some(p => descCrua.includes(removerAcentos(p)))) {
                    let busca = removerAcentos(d.pasta === 'saúde' ? 'imprevistos' : d.pasta);
                    catDetectada = categoriasGlobais.find(c => removerAcentos(c.nome.toLowerCase()).includes(busca));
                    tituloFinal = regra.titulo; 
                    break;
                }
            }
            if (catDetectada || tituloFinal) break;
        }
    }

    // A REGRA ABSOLUTA DE INDEFINIDO: Se não achou no dicionário, sem adivinhação.
    if (!tituloFinal) {
        tituloFinal = isReceita ? 'Recebimento Indefinido' : 'Gasto Indefinido';
        catDetectada = categoriasGlobais.find(c => removerAcentos(c.nome.toLowerCase()).includes('lazer') || removerAcentos(c.nome.toLowerCase()).includes('outros'));
    }

    document.getElementById('transacao-id').value = ''; 
    document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-indigo-600"></i> ${isReceita ? 'Registrar Entrada' : 'Registrar Saída'}`;
    document.getElementById('transacao-desc').value = tituloFinal;
    
    if(valorExtraido > 0) {
        let valorStr = valorExtraido.toFixed(2).replace('.', ',');
        valorStr = valorStr.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
        valorStr = valorStr.replace(/(\d)(\d{3}),/g, "$1.$2,");
        document.getElementById('transacao-valor').value = valorStr;
    } else { document.getElementById('transacao-valor').value = ''; }

    document.getElementById('transacao-data').value = dataCalculada.toISOString().split('T')[0];
    if (catDetectada) document.getElementById('transacao-categoria').value = catDetectada.id;
    
    document.querySelector(`input[name="tipo"][value="${isReceita ? 'receita' : 'despesa'}"]`).checked = true;
    document.getElementById('modal-transacao').classList.remove('hidden');
}

window.abrirModalComTextoRapido = function() { processarFraseNLP(document.getElementById('input-rapido').value); };

// ==========================================
// MICROFONE REATIVO (Com o Inversor de R$ ao Vivo)
// ==========================================
window.ativarMicrofone = function() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return Swal.fire('Ops!', 'Seu navegador não suporta microfone nativo. Use o Chrome.', 'error');
    
    reconhecimentoDeVoz = new SpeechRecognition(); 
    reconhecimentoDeVoz.lang = 'pt-BR'; 
    reconhecimentoDeVoz.interimResults = true; 
    reconhecimentoDeVoz.continuous = false; 
    
    const modalMic = document.getElementById('modal-microfone');
    const textoInterim = document.getElementById('texto-interim');
    const wave1 = document.getElementById('mic-wave-1');
    const wave2 = document.getElementById('mic-wave-2');

    modalMic.classList.remove('hidden');
    textoInterim.innerText = "Fale agora...";

    if(wave1 && wave2) {
        wave1.style.transform = 'scale(1.1)';
        wave2.style.transform = 'scale(1.05)';
    }

    reconhecimentoDeVoz.onresult = (event) => {
        let textoTemporario = '';
        let textoFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) { 
            if (event.results[i].isFinal) {
                textoFinal += event.results[i][0].transcript; 
            } else {
                textoTemporario += event.results[i][0].transcript;
            }
        }
        
        if(wave1 && wave2) {
            let fatorVolumeFake = 1.1 + (textoTemporario.length % 5) * 0.15; 
            wave1.style.transform = `scale(${fatorVolumeFake * 1.3})`;
            wave2.style.transform = `scale(${fatorVolumeFake * 1.1})`;
            
            setTimeout(() => {
                wave1.style.transform = 'scale(1.1)';
                wave2.style.transform = 'scale(1.05)';
            }, 150);
        }

        let transcricaoAoVivo = textoFinal || textoTemporario;
        if (transcricaoAoVivo.length > 0) {
            let t = transcricaoAoVivo.toLowerCase();
            
            // 1. Purifica os sotaques do Chrome
            t = t.replace(/\bbrl\b/g, "reais");
            
            // 2. A MÁGICA: Joga o R$ para frente ("25 reais" vira "R$ 25")
            t = t.replace(/(\d+(?:[.,]\d+)?)\s*(reais|real|r\$)/g, "R$ $1");
            
            // Se falou apenas "reais" sem número
            t = t.replace(/\breais\b|\breal\b/g, "R$");
            
            transcricaoAoVivo = t.charAt(0).toUpperCase() + t.slice(1);
            textoInterim.innerText = transcricaoAoVivo;
        }

        if (textoFinal && textoFinal.trim() !== '') {
            let t = textoFinal.toLowerCase();
            
            t = t.replace(/\bbrl\b/g, "reais");
            t = t.replace(/(\d+(?:[.,]\d+)?)\s*(reais|real|r\$)/g, "R$ $1");
            t = t.replace(/\breais\b|\breal\b/g, "R$");
            t = t.replace(/\.\s*$/g, ""); // Tira ponto final nojento do Chrome
            
            t = t.charAt(0).toUpperCase() + t.slice(1);
            document.getElementById('input-rapido').value = t;
            
            setTimeout(() => { 
                window.cancelarMicrofone(); 
                processarFraseNLP(t); 
            }, 750);
        }
    };

    reconhecimentoDeVoz.onerror = (e) => { 
        window.cancelarMicrofone(); 
        if (e.error === 'not-allowed') {
            Swal.fire({ icon: 'warning', title: 'Microfone Bloqueado', text: 'Libere a permissão de microfone.', confirmButtonColor: '#4f46e5' });
        }
    };
    
    reconhecimentoDeVoz.onend = () => { 
        setTimeout(() => {
            if(!modalMic.classList.contains('hidden') && (textoInterim.innerText === "Fale agora..." || textoInterim.innerText === '')) {
                window.cancelarMicrofone();
            }
        }, 1200);
    };

    reconhecimentoDeVoz.start();
};

window.cancelarMicrofone = function() { 
    if(reconhecimentoDeVoz) {
        reconhecimentoDeVoz.onresult = null;
        reconhecimentoDeVoz.onerror = null;
        reconhecimentoDeVoz.onend = null;
        reconhecimentoDeVoz.abort();
    }
    reconhecimentoDeVoz = null; 
    document.getElementById('modal-microfone').classList.add('hidden'); 
};

// ==========================================
// FUNÇÕES DE CRUD
// ==========================================
window.abrirModalEdicao = function(id) {
    const t = transacoesGlobais.find(x => x.id === id); if(!t) return;
    document.getElementById('transacao-id').value = t.id; document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-indigo-600"></i> Editar Lançamento`;
    document.getElementById('transacao-desc').value = t.descricao;
    let valorStr = t.valor.toFixed(2).replace('.', ','); valorStr = valorStr.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,"); valorStr = valorStr.replace(/(\d)(\d{3}),/g, "$1.$2,");
    document.getElementById('transacao-valor').value = valorStr; document.getElementById('transacao-data').value = t.data_vencimento; document.getElementById('transacao-categoria').value = t.categoria_id; document.querySelector(`input[name="tipo"][value="${t.tipo}"]`).checked = true;
    document.getElementById('modal-transacao').classList.remove('hidden');
};

window.fecharModal = function() { document.getElementById('modal-transacao').classList.add('hidden'); };

window.excluirTransacao = async function(id) {
    if(modoSelecao) return; // Se for modo seleção, bloqueia exclusão individual
    const confirmacao = await Swal.fire({ title: 'Excluir Transação?', text: "Essa ação apagará este registro do fluxo.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8', confirmButtonText: 'Sim', cancelButtonText: 'Cancelar' });
    if(!confirmacao.isConfirmed) return;
    try {
        await supabaseClient.from('transacoes').delete().eq('id', id).eq('usuario_id', usuarioLogado.id);
        await carregarDadosDoBanco(); Swal.fire({ icon: 'success', title: 'Excluído!', showConfirmButton: false, timer: 1500 });
    } catch(e) { Swal.fire('Erro', e.message, 'error'); }
};

window.salvarTransacao = async function(event) {
    event.preventDefault();
    const id = document.getElementById('transacao-id').value; const desc = document.getElementById('transacao-desc').value.trim(); const val = desmascararMoeda(document.getElementById('transacao-valor').value); const dataV = document.getElementById('transacao-data').value; const catId = parseInt(document.getElementById('transacao-categoria').value); const tipo = document.querySelector('input[name="tipo"]:checked').value;
    if(!desc || isNaN(val) || val <= 0 || !dataV) return Swal.fire('Aviso', 'Preencha os dados corretamente.', 'warning');
    const payload = { usuario_id: usuarioLogado.id, descricao: desc, valor: val, data_vencimento: dataV, categoria_id: catId, tipo: tipo, pago: true };
    const btn = document.getElementById('btn-salvar-transacao'); const conteudoOriginal = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...'; btn.disabled = true;

    try {
        if (id) await supabaseClient.from('transacoes').update(payload).eq('id', id).eq('usuario_id', usuarioLogado.id);
        else await supabaseClient.from('transacoes').insert([payload]);
        await carregarDadosDoBanco(); window.fecharModal(); document.getElementById('input-rapido').value = '';
        
        const isReceita = tipo === 'receita';
        const urlAnimacao = isReceita ? "https://lottie.host/85450f21-2b79-46bd-8e77-a0d7fc86ceaf/63OdW0EjZh.json" : "https://lottie.host/78d29cd2-20ba-42fa-89bb-5471e7c8353c/EglrVN8uNB.lottie";

        const overlayLottie = document.createElement('div');
        overlayLottie.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh; z-index: 999999; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); transition: opacity 0.3s ease; opacity: 0;';
        overlayLottie.innerHTML = `<dotlottie-wc src="${urlAnimacao}" style="width: 280px; height: 280px;" autoplay></dotlottie-wc>`;
        document.documentElement.appendChild(overlayLottie);
        
        requestAnimationFrame(() => overlayLottie.style.opacity = '1');
        setTimeout(() => { overlayLottie.style.opacity = '0'; setTimeout(() => overlayLottie.remove(), 300); }, 2600);
    } catch(e) { Swal.fire('Erro', e.message, 'error'); } finally { btn.innerHTML = conteudoOriginal; btn.disabled = false; }
};
