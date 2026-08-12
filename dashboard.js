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

function processarEAtualizarTudo() {
    const tipoFiltro = document.getElementById('filtro-periodo').value;
    const dataAtual = new Date();

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

    let totalDespesas = 0, totalReceitas = 0;
    let maiorGasto = { valor: 0, descricao: "Nenhum" };
    const gastosPorCategoria = {};
    const topGastos = [];
    const agrupamentoTemporal = {}; 

    const agruparPorMes = (tipoFiltro === 'por_ano' || tipoFiltro === 'tudo');

    transacoesFiltradas.forEach(t => { 
        let chaveTempo = 'S/D';
        if (t.data_vencimento) {
            const partes = t.data_vencimento.split('-'); 
            if (agruparPorMes) {
                const mesesAbv = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                chaveTempo = `${mesesAbv[parseInt(partes[1])-1]}/${partes[0].slice(2)}`; 
            } else {
                chaveTempo = `${partes[2]}/${partes[1]}`; 
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

    statsGlobais = { receitas: totalReceitas, despesas: totalDespesas, saldo: totalReceitas - totalDespesas, taxaPoupanca: taxa, mediaDiaria: media, maiorGasto: maiorGasto, topCategoria: categoriasOrdenadas.length > 0 ? { nome: categoriasOrdenadas[0], valor: gastosPorCategoria[categoriasOrdenadas[0]] } : null, transacoesNoPeriodo: transacoesFiltradas.length };

    document.getElementById('kpi-saldo').innerText = formatarMoeda(totalReceitas - totalDespesas);
    document.getElementById('kpi-receitas').innerText = formatarMoeda(totalReceitas);
    document.getElementById('kpi-despesas').innerText = formatarMoeda(totalDespesas);
    
    let taxaTexto = taxa.toFixed(1) + "%";
    let corTaxa = taxa >= 20 ? 'bg-indigo-600' : (taxa > 0 ? 'bg-sky-500' : 'bg-rose-500');
    document.getElementById('kpi-taxa-texto').innerText = taxaTexto;
    
    let percentualBarra = Math.min(Math.max(taxa, 0), 100); 
    const barra = document.getElementById('kpi-taxa-barra');
    barra.style.width = `${percentualBarra}%`;
    barra.className = `h-1.5 rounded-full transition-all duration-1000 ${corTaxa}`;

    renderizarListaCategorias(categoriasOrdenadas, gastosPorCategoria, totalDespesas);
    renderizarGraficos(agrupamentoTemporal, gastosPorCategoria, categoriasOrdenadas, topGastos.slice(0,5), totalDespesas);
    iniciarCoach();
}

// ---------------------------------------------
// LISTA DE CATEGORIAS HTML (Progress Bars)
// ---------------------------------------------
function renderizarListaCategorias(ordenadas, gastos, totalGeral) {
    const paleta = ['bg-indigo-600', 'bg-blue-500', 'bg-sky-400', 'bg-teal-400', 'bg-slate-400', 'bg-gray-300'];
    
    const html = ordenadas.map((cat, index) => {
        const valor = gastos[cat];
        const perc = totalGeral > 0 ? ((valor / totalGeral) * 100).toFixed(1) : 0;
        const cor = paleta[index % paleta.length];
        
        return `
        <div>
            <div class="flex justify-between items-end mb-1.5 gap-2">
                <span class="text-xs font-bold text-slate-700 truncate flex-1" title="${cat}">${cat}</span>
                <div class="text-right flex items-center gap-2 shrink-0">
                    <span class="text-[10px] font-bold text-slate-400">${perc}%</span>
                    <span class="text-sm font-black text-slate-900 whitespace-nowrap">${formatarMoeda(valor)}</span>
                </div>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-1.5">
                <div class="${cor} h-1.5 rounded-full transition-all duration-1000" style="width: ${perc}%"></div>
            </div>
        </div>
        `;
    }).join('');

    document.getElementById('lista-categorias-progress').innerHTML = html || '<p class="text-xs text-slate-400 font-bold">Sem despesas.</p>';
}

// ---------------------------------------------
// ENGENHARIA VISUAL DOS GRÁFICOS (CHART.JS SÊNIOR)
// ---------------------------------------------
function renderizarGraficos(agrupamentoTemporal, gastosPorCategoria, categoriasOrdenadas, top5, totalDespesas) {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#94a3b8'; 

    const tooltipPro = {
        backgroundColor: 'rgba(15, 23, 42, 0.95)', 
        titleFont: { size: 12, family: 'Inter', weight: 'bold' },
        bodyFont: { size: 13, family: 'Inter', weight: 'bold' },
        padding: 12,
        cornerRadius: 6,
        displayColors: true,
        boxPadding: 4
    };

    const chavesTempo = Object.keys(agrupamentoTemporal).sort((a,b) => {
        if(a==='S/D') return -1; if(b==='S/D') return 1;
        return 1; 
    });
    
    const labelsT = [];
    const dadosRec = [];
    const dadosDes = []; // Estes serão negativos no gráfico
    const dadosAcumulados = [];
    let acumuladoAtual = 0;

    chavesTempo.forEach(c => {
        labelsT.push(c);
        dadosRec.push(agrupamentoTemporal[c].rec);
        
        // MÁGICA DE WALL STREET: Transformamos a despesa em número negativo para descer do Eixo Zero
        dadosDes.push(-Math.abs(agrupamentoTemporal[c].des)); 
        
        acumuladoAtual += (agrupamentoTemporal[c].rec - agrupamentoTemporal[c].des);
        dadosAcumulados.push(acumuladoAtual);
    });

    // 1. GRÁFICO COMBO MASTER (Barras Divergentes + Linha)
    const ctxC = document.getElementById('graficoCombo').getContext('2d');
    if (grafCombo) grafCombo.destroy();

    const gradRec = ctxC.createLinearGradient(0, 0, 0, 400);
    gradRec.addColorStop(0, 'rgba(16, 185, 129, 0.9)'); 
    gradRec.addColorStop(1, 'rgba(16, 185, 129, 0.3)');

    const gradDes = ctxC.createLinearGradient(0, 0, 0, 400);
    gradDes.addColorStop(0, 'rgba(244, 63, 94, 0.3)'); // Ao contrário porque ela desce
    gradDes.addColorStop(1, 'rgba(244, 63, 94, 0.9)');

    grafCombo = new Chart(ctxC, {
        type: 'bar',
        data: {
            labels: labelsT.length > 0 ? labelsT : ['Vazio'],
            datasets: [
                {
                    type: 'line',
                    label: 'Saldo Acumulado',
                    data: dadosAcumulados,
                    borderColor: '#4f46e5', // Indigo 600
                    borderWidth: 2,
                    tension: 0.2, // Curva quase reta (corporativa)
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#4f46e5',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    stack: 'linha' // Isola a linha para não somar com as barras
                },
                {
                    type: 'bar',
                    label: 'Entradas',
                    data: dadosRec,
                    backgroundColor: gradRec,
                    borderRadius: 4,     
                    maxBarThickness: 30, 
                    stack: 'barras'
                },
                {
                    type: 'bar',
                    label: 'Saídas',
                    data: dadosDes,
                    backgroundColor: gradDes,
                    borderRadius: 4,
                    maxBarThickness: 30,
                    stack: 'barras' // Força empilhamento com a receita no mesmo dia
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: false }, 
                tooltip: { 
                    ...tooltipPro, 
                    callbacks: { 
                        // Formatação mágica: Lê o número negativo e mostra como Real absoluto na tooltip
                        label: (ctx) => ` ${ctx.dataset.label}: ${formatarMoeda(Math.abs(ctx.raw))}` 
                    } 
                } 
            },
            scales: {
                x: { 
                    stacked: true, // Alinha as barras na mesma coluna
                    grid: { display: false }, 
                    ticks: { font: { size: 10 } } 
                },
                y: { 
                    stacked: true, 
                    grid: { 
                        // EIXO ZERO EM DESTAQUE (Linha base sólida)
                        color: (ctx) => ctx.tick.value === 0 ? '#94a3b8' : '#f1f5f9',
                        lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1,
                        borderDash: (ctx) => ctx.tick.value === 0 ? [] : [4, 4]
                    }, 
                    border: { display: false }, 
                    ticks: { 
                        font: { size: 10 },
                        // Formata o eixo lateral tirando o sinal de menos
                        callback: (value) => value >= 0 ? `R$ ${value}` : `-R$ ${Math.abs(value)}`
                    } 
                }
            }
        }
    });

    // 2. PIZZA (Doughnut Extremamente Fino - Header Externo)
    const ctxP = document.getElementById('graficoPizza').getContext('2d');
    if (grafPizza) grafPizza.destroy();

    const paletaCorp = ['#4f46e5', '#3b82f6', '#38bdf8', '#2dd4bf', '#94a3b8', '#cbd5e1'];
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

    document.getElementById('pizza-total').innerText = formatarMoeda(totalDespesas);

    grafPizza = new Chart(ctxP, {
        type: 'doughnut',
        data: { labels: lblP, datasets: [{ data: datP, backgroundColor: categoriasOrdenadas.length === 0 ? ['#f8fafc'] : paletaCorp, borderWidth: 2, borderColor: '#ffffff', hoverOffset: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, cutout: '80%', 
            plugins: { 
                legend: { display: false }, 
                tooltip: { ...tooltipPro, callbacks: { label: (ctx) => ` ${formatarMoeda(categoriasOrdenadas.length === 0 ? 0 : ctx.raw)}` } } 
            } 
        }
    });

    // 3. TOP 5 GASTOS (Barras Horizontais Profissionais)
    const ctxT = document.getElementById('graficoTopGastos').getContext('2d');
    if (grafTop) grafTop.destroy();

    const gradTop = ctxT.createLinearGradient(0, 0, 400, 0);
    gradTop.addColorStop(0, '#64748b'); 
    gradTop.addColorStop(1, '#334155'); 

    grafTop = new Chart(ctxT, {
        type: 'bar',
        data: {
            labels: top5.length > 0 ? top5.map(t => {
                const limit = 15;
                return t.descricao.length > limit ? t.descricao.substring(0, limit) + '...' : t.descricao;
            }) : ['Nenhum'],
            datasets: [{
                data: top5.length > 0 ? top5.map(t => t.valor) : [0],
                backgroundColor: gradTop,
                borderRadius: 3,
                maxBarThickness: 12 
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { ...tooltipPro, callbacks: { label: (ctx) => ` ${formatarMoeda(ctx.raw)}` } } },
            scales: { x: { display: false }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 'bold', size: 10 }, color: '#475569' } } }
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
        div.className = "bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-sm self-end max-w-[85%] text-sm font-medium shadow-sm slide-up-chat";
        div.innerText = texto;
    } else {
        div.className = "bg-slate-800 border border-slate-700 text-slate-100 p-4 rounded-2xl rounded-tl-sm self-start max-w-[90%] text-sm font-medium shadow-sm slide-up-chat leading-relaxed";
        div.innerHTML = texto; 
    }
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; 
}

function iniciarCoach() {
    chatBox.innerHTML = ''; 
    let saudacao = "";
    
    if (statsGlobais.transacoesNoPeriodo === 0) {
        saudacao = "Base de dados vazia para o período selecionado. Ajuste os filtros no painel superior.";
    } else if (statsGlobais.taxaPoupanca < 0) {
        saudacao = "<b class='text-rose-400'>Alerta de Queima!</b> O fluxo de caixa operou no negativo neste período. Solicite um <i>Relatório</i> ou um plano para <i>Otimizar Custos</i>.";
    } else {
        saudacao = `Caixa saudável. A retenção líquida está em <b class='text-emerald-400'>${statsGlobais.taxaPoupanca.toFixed(1)}%</b>. O que vamos auditar hoje?`;
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
    typingDiv.className = "text-slate-500 text-xs italic mt-2 self-start slide-up-chat flex items-center gap-2";
    typingDiv.id = "coach-typing";
    typingDiv.innerHTML = "<i class='fa-solid fa-circle-notch fa-spin text-indigo-500'></i> Processando algoritmos...";
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
        document.getElementById('coach-typing').remove();
        gerarRespostaIA(texto.toLowerCase());
    }, 1000);
}

function gerarRespostaIA(pergunta) {
    let resposta = "";

    if (statsGlobais.transacoesNoPeriodo === 0) {
        resposta = "O algoritmo requer dados populados para gerar predições. Altere o período analisado.";
        return adicionarMensagemNoChat(resposta, false);
    }

    if (pergunta.includes('relatório') || pergunta.includes('relatorio')) {
        resposta = `
            📊 <b class="text-indigo-300">Fechamento Executivo:</b><br><br>
            <span class="text-emerald-400"><i class="fa-solid fa-arrow-turn-up"></i> Captação:</span> <b>${formatarMoeda(statsGlobais.receitas)}</b><br>
            <span class="text-rose-400"><i class="fa-solid fa-arrow-turn-down"></i> Queima:</span> <b>${formatarMoeda(statsGlobais.despesas)}</b><br>
            <span class="text-slate-400"><i class="fa-solid fa-scale-balanced"></i> Margem Líquida:</span> <b class="${statsGlobais.saldo < 0 ? 'text-rose-400' : 'text-emerald-400'} text-lg">${formatarMoeda(statsGlobais.saldo)}</b><br><br>
            O centro de custo mais oneroso foi <b>${statsGlobais.topCategoria ? statsGlobais.topCategoria.nome : 'Nada'}</b>, responsável por ${formatarMoeda(statsGlobais.topCategoria ? statsGlobais.topCategoria.valor : 0)} das saídas.
        `;
    } 
    else if (pergunta.includes('cortar') || pergunta.includes('economizar') || pergunta.includes('otimizar')) {
        if (!statsGlobais.topCategoria) {
             resposta = "Estrutura enxuta detectada. Foco prioritário deve ser na alavancagem de receita.";
        } else {
             const economia = statsGlobais.topCategoria.valor * 0.15; 
             resposta = `💡 <b class="text-indigo-300">Plano de Otimização:</b><br><br>
             Identificamos um alto volume de capital direcionado para <b>${statsGlobais.topCategoria.nome}</b>.<br><br>
             Recomendação: Aplicar tática de contenção e reduzir 15% neste centro de custo no próximo ciclo. O impacto projetado será de <b class="text-emerald-400">+${formatarMoeda(economia)} no seu caixa livre</b>.`;
        }
    }
    else if (pergunta.includes('previsão') || pergunta.includes('previsao') || pergunta.includes('burn')) {
        if (statsGlobais.mediaDiaria === 0) {
            resposta = "Volume insuficiente de saídas para gerar um cálculo de Burn Rate preciso.";
        } else {
            const gastoMensalEstimado = statsGlobais.mediaDiaria * 30;
            resposta = `🔮 <b class="text-indigo-300">Análise de Burn Rate:</b><br><br>
            A velocidade atual de queima é de <b>${formatarMoeda(statsGlobais.mediaDiaria)} / dia</b>.<br><br>
            Mantendo a tração de despesas atual, o algoritmo projeta que um ciclo completo (30 dias) drenará <b>${formatarMoeda(gastoMensalEstimado)}</b> do seu caixa total.`;
        }
    }
    else {
        resposta = "Operando como Motor de BI.<br>Solicite o <b>Relatório Executivo</b>, táticas para <b>Otimizar Custos</b> ou uma projeção de <b>Burn Rate</b>.";
    }

    adicionarMensagemNoChat(resposta, false);
}
