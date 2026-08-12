// ==========================================
// dashboard.js - MOTOR DE BUSINESS INTELLIGENCE E IA
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];

let grafCombo = null;
let grafPizza = null;
let grafTop = null;

let statsGlobais = { receitas: 0, despesas: 0, saldo: 0, taxaPoupanca: 0, mediaDiaria: 0, maiorGasto: null, topCategoria: null, transacoesNoPeriodo: 0 };

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    // Inicializa Filtros (Auto-preenche o Mês Atual)
    const hoje = new Date();
    document.getElementById('input-mes').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('input-ano').value = hoje.getFullYear();
    
    document.getElementById('filtro-periodo').value = 'por_mes';
    mudarTipoFiltro();

    document.getElementById('input-coach').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') enviarMensagemCoach();
    });

    await carregarDadosDoBanco();
});

async function carregarDadosDoBanco() {
    try {
        const [rTrans, rCat] = await Promise.all([
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id)
        ]);

        transacoesGlobais = rTrans.data || [];
        categoriasGlobais = rCat.data || [];

        processarEAtualizarTudo();

    } catch (e) { console.error("Erro ao puxar dados:", e.message); }
}

// ---------------------------------------------
// CONTROLE DE FILTROS NA TELA
// ---------------------------------------------
function mudarTipoFiltro() {
    const tipo = document.getElementById('filtro-periodo').value;
    document.getElementById('box-mes').classList.add('hidden');
    document.getElementById('box-ano').classList.add('hidden');
    document.getElementById('box-personalizado').classList.add('hidden');

    if (tipo === 'por_mes') document.getElementById('box-mes').classList.remove('hidden');
    else if (tipo === 'por_ano') document.getElementById('box-ano').classList.remove('hidden');
    else if (tipo === 'personalizado') document.getElementById('box-personalizado').classList.remove('hidden');

    processarEAtualizarTudo();
}

// ---------------------------------------------
// MOTOR ANALÍTICO (Data Science)
// ---------------------------------------------
function processarEAtualizarTudo() {
    const tipoFiltro = document.getElementById('filtro-periodo').value;
    const dataAtual = new Date();

    // 1. Filtrar Transações
    const transacoesFiltradas = transacoesGlobais.filter(t => {
        if (!t.data_vencimento) return true;
        const d = new Date(t.data_vencimento + 'T12:00:00Z');
        
        if (tipoFiltro === 'por_mes') {
            const val = document.getElementById('input-mes').value;
            if(!val) return true;
            const [anoF, mesF] = val.split('-');
            return d.getMonth() === (parseInt(mesF) - 1) && d.getFullYear() === parseInt(anoF);
        } else if (tipoFiltro === 'por_ano') {
            const val = document.getElementById('input-ano').value;
            if(!val) return true;
            return d.getFullYear() === parseInt(val);
        } else if (tipoFiltro === 'personalizado') {
            const dIni = document.getElementById('input-data-inicio').value;
            const dFim = document.getElementById('input-data-fim').value;
            let valid = true;
            if (dIni) valid = valid && d >= new Date(dIni + 'T12:00:00Z');
            if (dFim) valid = valid && d <= new Date(dFim + 'T12:00:00Z');
            return valid;
        }
        return true; 
    });

    // 2. Extração e Agrupamento
    let totalDespesas = 0, totalReceitas = 0;
    let maiorGasto = { valor: 0, descricao: "Nenhum" };
    const gastosPorCategoria = {};
    const topGastos = [];
    const agrupamentoTemporal = {}; // Para o Combo Chart

    // Define se o Combo Chart agrupa por Dia (Ex: "12/08") ou por Mês (Ex: "Ago/2026")
    const agruparPorMes = (tipoFiltro === 'por_ano' || tipoFiltro === 'tudo');

    transacoesFiltradas.forEach(t => { 
        // Lógica de Agrupamento de Tempo
        let chaveTempo = 'S/D';
        if (t.data_vencimento) {
            const partes = t.data_vencimento.split('-'); // [AAAA, MM, DD]
            if (agruparPorMes) {
                const mesesAbv = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                chaveTempo = `${mesesAbv[parseInt(partes[1])-1]}/${partes[0].slice(2)}`; // Ex: "Ago/26"
            } else {
                chaveTempo = `${partes[2]}/${partes[1]}`; // Ex: "12/08"
            }
        }
        if(!agrupamentoTemporal[chaveTempo]) agrupamentoTemporal[chaveTempo] = { rec: 0, des: 0 };

        if(t.tipo === 'despesa') {
            totalDespesas += t.valor; 
            agrupamentoTemporal[chaveTempo].des += t.valor;
            topGastos.push(t);
            
            if(t.valor > maiorGasto.valor) maiorGasto = t;
            
            const catNome = categoriasGlobais.find(c => c.id === t.categoria_id)?.nome || 'Outros';
            gastosPorCategoria[catNome] = (gastosPorCategoria[catNome] || 0) + t.valor;
        } else {
            totalReceitas += t.valor;
            agrupamentoTemporal[chaveTempo].rec += t.valor;
        }
    });

    let taxa = 0;
    if (totalReceitas > 0) taxa = ((totalReceitas - totalDespesas) / totalReceitas) * 100;
    else if (totalDespesas > 0) taxa = -100;

    const diasNoPeriodo = tipoFiltro === 'por_mes' ? 30 : 365; 
    const media = totalDespesas > 0 ? (totalDespesas / diasNoPeriodo) : 0;

    const categoriasOrdenadas = Object.keys(gastosPorCategoria).sort((a, b) => gastosPorCategoria[b] - gastosPorCategoria[a]);
    topGastos.sort((a, b) => b.valor - a.valor);

    // Memória da IA
    statsGlobais = { receitas: totalReceitas, despesas: totalDespesas, saldo: totalReceitas - totalDespesas, taxaPoupanca: taxa, mediaDiaria: media, maiorGasto: maiorGasto, topCategoria: categoriasOrdenadas.length > 0 ? { nome: categoriasOrdenadas[0], valor: gastosPorCategoria[categoriasOrdenadas[0]] } : null, transacoesNoPeriodo: transacoesFiltradas.length };

    // 3. Atualizar DOM Cards KPIs
    document.getElementById('kpi-saldo').innerText = formatarMoeda(totalReceitas - totalDespesas);
    document.getElementById('kpi-receitas').innerText = formatarMoeda(totalReceitas);
    document.getElementById('kpi-despesas').innerText = formatarMoeda(totalDespesas);
    
    let taxaTexto = taxa.toFixed(1) + "%";
    let corTaxa = taxa >= 20 ? 'bg-green-500' : (taxa > 0 ? 'bg-blue-500' : 'bg-red-500');
    document.getElementById('kpi-taxa-texto').innerText = taxaTexto;
    
    // Animação da Barra de Progresso da Poupança
    let percentualBarra = Math.min(Math.max(taxa, 0), 100); 
    const barra = document.getElementById('kpi-taxa-barra');
    barra.style.width = `${percentualBarra}%`;
    barra.className = `h-2 rounded-full transition-all duration-1000 ${corTaxa}`;

    // Atualiza a lista visual de Categorias
    renderizarListaCategorias(categoriasOrdenadas, gastosPorCategoria, totalDespesas);

    // 4. Renderiza Gráficos Sênior
    renderizarGraficos(agrupamentoTemporal, gastosPorCategoria, categoriasOrdenadas, topGastos.slice(0,5), totalDespesas);

    iniciarCoach();
}

// ---------------------------------------------
// LISTA DE CATEGORIAS HTML (Progress Bars)
// ---------------------------------------------
function renderizarListaCategorias(ordenadas, gastos, totalGeral) {
    const paleta = ['text-blue-500 bg-blue-500', 'text-purple-500 bg-purple-500', 'text-pink-500 bg-pink-500', 'text-orange-500 bg-orange-500', 'text-teal-500 bg-teal-500', 'text-gray-500 bg-gray-500'];
    
    const html = ordenadas.map((cat, index) => {
        const valor = gastos[cat];
        const perc = totalGeral > 0 ? ((valor / totalGeral) * 100).toFixed(1) : 0;
        const classesCor = paleta[index % paleta.length].split(' '); // [text-cor, bg-cor]
        
        return `
        <div>
            <div class="flex justify-between items-end mb-1">
                <span class="text-sm font-bold text-gray-700 truncate w-32" title="${cat}">${cat}</span>
                <div class="text-right">
                    <span class="text-xs font-black text-gray-900 block">${formatarMoeda(valor)}</span>
                    <span class="text-[10px] font-bold ${classesCor[0]}">${perc}%</span>
                </div>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-1.5">
                <div class="${classesCor[1]} h-1.5 rounded-full transition-all duration-1000" style="width: ${perc}%"></div>
            </div>
        </div>
        `;
    }).join('');

    document.getElementById('lista-categorias-progress').innerHTML = html || '<p class="text-xs text-gray-400 font-bold">Sem despesas.</p>';
}

// ---------------------------------------------
// ENGENHARIA DOS GRÁFICOS (CHART.JS COMBO)
// ---------------------------------------------
function renderizarGraficos(agrupamentoTemporal, gastosPorCategoria, categoriasOrdenadas, top5, totalDespesas) {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#94a3b8'; // Slate 400

    // PREPARAÇÃO DADOS DO TEMPO (Ordenação lógica)
    const chavesTempo = Object.keys(agrupamentoTemporal).sort((a,b) => {
        if(a==='S/D') return -1; if(b==='S/D') return 1;
        // Ordenação simplificada (melhorar se necessário para multianos)
        return 1; 
    });
    
    const labelsT = [];
    const dadosRec = [];
    const dadosDes = [];
    const dadosAcumulados = [];
    let acumuladoAtual = 0;

    chavesTempo.forEach(c => {
        labelsT.push(c);
        dadosRec.push(agrupamentoTemporal[c].rec);
        dadosDes.push(agrupamentoTemporal[c].des);
        
        // A Linha do Combo Chart soma Receitas e subtrai Despesas dia a dia
        acumuladoAtual += (agrupamentoTemporal[c].rec - agrupamentoTemporal[c].des);
        dadosAcumulados.push(acumuladoAtual);
    });

    // 1. GRÁFICO COMBO MASTER (Barras + Linha)
    const ctxC = document.getElementById('graficoCombo').getContext('2d');
    if (grafCombo) grafCombo.destroy();

    grafCombo = new Chart(ctxC, {
        type: 'bar',
        data: {
            labels: labelsT.length > 0 ? labelsT : ['Vazio'],
            datasets: [
                {
                    type: 'line',
                    label: 'Saldo Acumulado',
                    data: dadosAcumulados,
                    borderColor: '#3b82f6', // Azul principal
                    borderWidth: 3,
                    tension: 0.4, // Curva suave
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#3b82f6',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'Entradas',
                    data: dadosRec,
                    backgroundColor: 'rgba(34, 197, 94, 0.8)', // Verde
                    borderRadius: 4,
                    barPercentage: 0.6,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'Saídas',
                    data: dadosDes,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)', // Vermelho
                    borderRadius: 4,
                    barPercentage: 0.6,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: false }, 
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatarMoeda(ctx.raw)}` } } 
            },
            scales: {
                x: { grid: { display: false } },
                y: { grid: { borderDash: [4, 4], color: '#f1f5f9' }, beginAtZero: true }
            }
        }
    });

    // 2. PIZZA (Doughnut Clean)
    const ctxP = document.getElementById('graficoPizza').getContext('2d');
    if (grafPizza) grafPizza.destroy();

    const paletaHex = ['#3b82f6', '#a855f7', '#ec4899', '#f97316', '#14b8a6', '#64748b'];
    let lblP = [], datP = [];
    
    if (categoriasOrdenadas.length === 0) { lblP = ['Vazio']; datP = [1]; } 
    else {
        let soma = 0;
        for (let i = 0; i < Math.min(5, categoriasOrdenadas.length); i++) {
            lblP.push(categoriasOrdenadas[i]); datP.push(gastosPorCategoria[categoriasOrdenadas[i]]);
            soma += gastosPorCategoria[categoriasOrdenadas[i]];
        }
        if (categoriasOrdenadas.length > 5) { lblP.push('Outros'); datP.push(totalDespesas - soma); }
    }

    // Injeta o Total Dinâmico no centro da Pizza
    document.getElementById('pizza-total').innerText = formatarMoeda(totalDespesas);

    grafPizza = new Chart(ctxP, {
        type: 'doughnut',
        data: { labels: lblP, datasets: [{ data: datP, backgroundColor: categoriasOrdenadas.length === 0 ? ['#f8fafc'] : paletaHex, borderWidth: 0, hoverOffset: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '80%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${formatarMoeda(categoriasOrdenadas.length === 0 ? 0 : ctx.raw)}` } } } }
    });

    // 3. TOP 5 GASTOS (Barra Horizontal Fina)
    const ctxT = document.getElementById('graficoTopGastos').getContext('2d');
    if (grafTop) grafTop.destroy();

    grafTop = new Chart(ctxT, {
        type: 'bar',
        data: {
            labels: top5.length > 0 ? top5.map(t => {
                const limit = 15;
                return t.descricao.length > limit ? t.descricao.substring(0, limit) + '...' : t.descricao;
            }) : ['Nenhum'],
            datasets: [{
                data: top5.length > 0 ? top5.map(t => t.valor) : [0],
                backgroundColor: '#f97316',
                borderRadius: 4,
                barPercentage: 0.4 // Barras bem finas e elegantes
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${formatarMoeda(ctx.raw)}` } } },
            scales: { x: { display: false }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 'bold', size: 11 }, color: '#475569' } } }
        }
    });
}

// ---------------------------------------------
// O COACH FLUTUANTE (WIDGET IA)
// ---------------------------------------------
function toggleCoach() {
    const janela = document.getElementById('janela-coach');
    if (janela.classList.contains('hidden')) {
        janela.classList.remove('hidden');
        iniciarCoach();
    } else {
        janela.classList.add('hidden');
    }
}

const chatBox = document.getElementById('chat-box');

function adicionarMensagemNoChat(texto, isUsuario = false) {
    const div = document.createElement('div');
    if (isUsuario) {
        div.className = "bg-blue-600 text-white p-3 rounded-2xl rounded-tr-sm self-end max-w-[85%] text-sm font-medium shadow-sm slide-up-chat";
        div.innerText = texto;
    } else {
        div.className = "bg-gray-800 text-gray-100 p-4 rounded-2xl rounded-tl-sm self-start max-w-[90%] text-sm font-medium border border-gray-700 shadow-sm slide-up-chat leading-relaxed";
        div.innerHTML = texto; 
    }
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; 
}

function iniciarCoach() {
    chatBox.innerHTML = ''; 
    let saudacao = "";
    
    if (statsGlobais.transacoesNoPeriodo === 0) {
        saudacao = "Olá! Não encontrei movimentações neste período. Ajuste o filtro no painel superior.";
    } else if (statsGlobais.taxaPoupanca < 0) {
        saudacao = "<b>Alerta Crítico! 🚨</b> Identifiquei que você queimou mais caixa do que captou. Peça um <i>Relatório</i> ou <i>Redução de Custos</i> abaixo.";
    } else {
        saudacao = `Tudo sob controle! Sua taxa de poupança está saudável em <b>${statsGlobais.taxaPoupanca.toFixed(1)}%</b>. O que vamos analisar hoje?`;
    }
    
    adicionarMensagemNoChat(saudacao, false);
}

function atalhoCoach(comando) {
    document.getElementById('input-coach').value = comando;
    enviarMensagemCoach();
}

function enviarMensagemCoach() {
    const input = document.getElementById('input-coach');
    const texto = input.value.trim();
    if (!texto) return;

    adicionarMensagemNoChat(texto, true);
    input.value = '';

    const typingDiv = document.createElement('div');
    typingDiv.className = "text-gray-400 text-xs italic mt-2 self-start slide-up-chat flex items-center gap-2";
    typingDiv.id = "coach-typing";
    typingDiv.innerHTML = "<i class='fa-solid fa-circle-notch fa-spin text-blue-500'></i> Extraindo matriz de dados...";
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
        document.getElementById('coach-typing').remove();
        gerarRespostaIA(texto.toLowerCase());
    }, 1200);
}

function gerarRespostaIA(pergunta) {
    let resposta = "";

    if (statsGlobais.transacoesNoPeriodo === 0) {
        resposta = "Desculpe, o motor precisa de dados para rodar as previsões. Tente alterar o filtro.";
        return adicionarMensagemNoChat(resposta, false);
    }

    if (pergunta.includes('relatório') || pergunta.includes('relatorio')) {
        resposta = `
            📊 <b>Fechamento Executivo:</b><br><br>
            <span class="text-green-400"><i class="fa-solid fa-plus"></i> Captado:</span> <b>${formatarMoeda(statsGlobais.receitas)}</b><br>
            <span class="text-red-400"><i class="fa-solid fa-minus"></i> Queimado:</span> <b>${formatarMoeda(statsGlobais.despesas)}</b><br>
            <span class="text-blue-300"><i class="fa-solid fa-equals"></i> Saldo Líquido:</span> <b class="${statsGlobais.saldo < 0 ? 'text-red-400' : 'text-green-400'} text-lg">${formatarMoeda(statsGlobais.saldo)}</b><br><br>
            Cuidado com a pasta de <b>${statsGlobais.topCategoria ? statsGlobais.topCategoria.nome : 'Nada'}</b>, ela sugou ${formatarMoeda(statsGlobais.topCategoria ? statsGlobais.topCategoria.valor : 0)} do seu caixa.
        `;
    } 
    else if (pergunta.includes('cortar') || pergunta.includes('economizar') || pergunta.includes('redução')) {
        if (!statsGlobais.topCategoria) {
             resposta = "Seu caixa está enxuto. Continue focado em gerar mais receita.";
        } else {
             const economia = statsGlobais.topCategoria.valor * 0.15; 
             resposta = `💡 <b>Estratégia de Retenção:</b><br><br>
             O ralo do seu caixa hoje é a pasta <b>${statsGlobais.topCategoria.nome}</b>.<br><br>
             Meta para o próximo ciclo: force uma redução de apenas 15% nela. Isso vai injetar <b>${formatarMoeda(economia)} diretos na sua margem de lucro</b>. O gráfico de Fluxo agradece!`;
        }
    }
    else if (pergunta.includes('previsão') || pergunta.includes('previsao') || pergunta.includes('burn')) {
        if (statsGlobais.mediaDiaria === 0) {
            resposta = "Não há queima diária suficiente para traçar uma projeção (Burn Rate).";
        } else {
            const gastoMensalEstimado = statsGlobais.mediaDiaria * 30;
            resposta = `🔮 <b>Análise de Burn Rate:</b><br><br>
            Sua velocidade de queima é de <b>${formatarMoeda(statsGlobais.mediaDiaria)} / dia</b>.<br><br>
            Projeção matemática: Se você não puxar o freio, o sistema estima que você fechará um ciclo de 30 dias queimando <b>${formatarMoeda(gastoMensalEstimado)}</b>. Fique atento à linha azul no gráfico Combo!`;
        }
    }
    else {
        resposta = "Sou um motor lógico de BI.<br>Tente pedir o <b>Relatório Mensal</b>, um plano de <b>Redução de Custos</b> ou uma <b>Previsão de Burn Rate</b>.";
    }

    adicionarMensagemNoChat(resposta, false);
}
