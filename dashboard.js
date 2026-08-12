// ==========================================
// dashboard.js - MOTOR DE DATA SCIENCE E COACH IA
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];

// Instâncias dos Gráficos para poder destruir e recriar na filtragem
let grafBalanco = null;
let grafPizza = null;
let grafEvolucao = null;
let grafTop = null;

let statsGlobais = { receitas: 0, despesas: 0, saldo: 0, taxaPoupanca: 0, mediaDiaria: 0, maiorGasto: null, topCategoria: null, transacoesNoPeriodo: 0 };

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    document.getElementById('filtro-periodo').addEventListener('change', processarEAtualizarTudo);

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
// O MOTOR DE PROCESSAMENTO (Matemática Pura)
// ---------------------------------------------
function processarEAtualizarTudo() {
    const periodoSelect = document.getElementById('filtro-periodo').value;
    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth();
    const anoAtual = dataAtual.getFullYear();

    // 1. Filtragem Base
    const transacoesFiltradas = transacoesGlobais.filter(t => {
        if (!t.data_vencimento) return true;
        const dTransacao = new Date(t.data_vencimento + 'T12:00:00Z');
        
        if (periodoSelect === 'mes_atual') return dTransacao.getMonth() === mesAtual && dTransacao.getFullYear() === anoAtual;
        if (periodoSelect === 'mes_passado') {
            const mAnt = mesAtual === 0 ? 11 : mesAtual - 1;
            const aAnt = mesAtual === 0 ? anoAtual - 1 : anoAtual;
            return dTransacao.getMonth() === mAnt && dTransacao.getFullYear() === aAnt;
        }
        if (periodoSelect === 'ano_atual') return dTransacao.getFullYear() === anoAtual;
        return true; 
    });

    // 2. Extração Analítica
    let totalDespesas = 0, totalReceitas = 0;
    let maiorGasto = { valor: 0, descricao: "Nenhum" };
    const gastosPorCategoria = {};
    const agregacaoDiaria = {}; // Para o Gráfico de Evolução Tempora
    const topDespesasIsoladas = []; // Para o Gráfico de Top 5

    transacoesFiltradas.forEach(t => { 
        // Agregação Temporal (Datas)
        const dFmt = t.data_vencimento ? t.data_vencimento.split('-').reverse().slice(0, 2).join('/') : 'S/D';
        if(!agregacaoDiaria[dFmt]) agregacaoDiaria[dFmt] = { r: 0, d: 0 };

        if(t.tipo === 'despesa') {
            totalDespesas += t.valor; 
            agregacaoDiaria[dFmt].d += t.valor;
            topDespesasIsoladas.push(t);
            
            if(t.valor > maiorGasto.valor) maiorGasto = t;
            
            const catNome = categoriasGlobais.find(c => c.id === t.categoria_id)?.nome || 'Outros';
            gastosPorCategoria[catNome] = (gastosPorCategoria[catNome] || 0) + t.valor;
        } else {
            totalReceitas += t.valor;
            agregacaoDiaria[dFmt].r += t.valor;
        }
    });

    // Matemática de Resumo
    let taxa = 0;
    if (totalReceitas > 0) taxa = ((totalReceitas - totalDespesas) / totalReceitas) * 100;
    else if (totalDespesas > 0) taxa = -100;

    const diasNoPeriodo = periodoSelect === 'mes_atual' ? dataAtual.getDate() : 30; 
    const media = totalDespesas > 0 ? (totalDespesas / diasNoPeriodo) : 0;

    const categoriasOrdenadas = Object.keys(gastosPorCategoria).sort((a, b) => gastosPorCategoria[b] - gastosPorCategoria[a]);
    topDespesasIsoladas.sort((a, b) => b.valor - a.valor); // Ordena as maiores despesas individuais

    // Atualiza Memória do Coach
    statsGlobais = {
        receitas: totalReceitas, despesas: totalDespesas, saldo: totalReceitas - totalDespesas,
        taxaPoupanca: taxa, mediaDiaria: media, maiorGasto: maiorGasto,
        topCategoria: categoriasOrdenadas.length > 0 ? { nome: categoriasOrdenadas[0], valor: gastosPorCategoria[categoriasOrdenadas[0]] } : null,
        transacoesNoPeriodo: transacoesFiltradas.length
    };

    // 3. Atualiza DOM Cards
    document.getElementById('dash-media').innerText = formatarMoeda(media);
    document.getElementById('dash-taxa').innerText = `${taxa.toFixed(1)}%`;
    document.getElementById('dash-taxa').className = `text-xl md:text-2xl font-black mt-1 ${taxa >= 20 ? 'text-green-500' : (taxa > 0 ? 'text-blue-500' : 'text-red-500')}`;
    
    if (maiorGasto.valor > 0) {
        document.getElementById('dash-maior').innerText = formatarMoeda(maiorGasto.valor);
        document.getElementById('dash-maior-desc').innerText = maiorGasto.descricao;
    } else {
        document.getElementById('dash-maior').innerText = "R$ 0,00";
        document.getElementById('dash-maior-desc').innerText = "--";
    }

    const badgeStatus = document.getElementById('dash-status');
    if (taxa >= 20) { badgeStatus.innerText = "Excelente"; badgeStatus.className = "mt-1 text-xs font-black px-3 py-1 rounded-full bg-green-100 text-green-600 inline-block uppercase"; }
    else if (taxa > 0) { badgeStatus.innerText = "Estável"; badgeStatus.className = "mt-1 text-xs font-black px-3 py-1 rounded-full bg-blue-100 text-blue-600 inline-block uppercase"; }
    else { badgeStatus.innerText = "Em Risco"; badgeStatus.className = "mt-1 text-xs font-black px-3 py-1 rounded-full bg-red-100 text-red-600 inline-block uppercase"; }

    // 4. Renderiza os Gráficos
    renderizarGraficos(totalReceitas, totalDespesas, gastosPorCategoria, categoriasOrdenadas, agregacaoDiaria, topDespesasIsoladas.slice(0,5));

    // Reinicia o Coach se o Modal já estivesse aberto
    iniciarCoach();
}

// ---------------------------------------------
// ENGENHARIA VISUAL DE GRÁFICOS (CHART.JS 3D)
// ---------------------------------------------
function renderizarGraficos(receitas, despesas, gastosPorCategoria, categoriasOrdenadas, agregacaoDiaria, top5Despesas) {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b';

    // 1. GRÁFICO DE BALANÇO (BARRA 3D GLOSSY)
    const ctxB = document.getElementById('graficoBalanco').getContext('2d');
    if (grafBalanco) grafBalanco.destroy();
    
    // O Efeito 3D com Gradiente no Canvas
    const gradRec = ctxB.createLinearGradient(0, 0, 0, 400);
    gradRec.addColorStop(0, '#4ade80'); // Verde claro topo
    gradRec.addColorStop(1, '#166534'); // Verde escuro base

    const gradDes = ctxB.createLinearGradient(0, 0, 0, 400);
    gradDes.addColorStop(0, '#f87171'); // Vermelho claro topo
    gradDes.addColorStop(1, '#991b1b'); // Vermelho escuro base

    grafBalanco = new Chart(ctxB, {
        type: 'bar',
        data: {
            labels: ['Captado (Entradas)', 'Queimado (Saídas)'],
            datasets: [{
                data: [receitas, despesas],
                backgroundColor: [gradRec, gradDes],
                borderRadius: 16, // Arredonda muito para dar volume
                borderSkipped: false,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${formatarMoeda(ctx.raw)}` } } },
            scales: { y: { display: false }, x: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 'bold' } } } }
        }
    });

    // 2. GRÁFICO DE PIZZA (DOUGHNUT)
    const ctxP = document.getElementById('graficoPizza').getContext('2d');
    if (grafPizza) grafPizza.destroy();

    const paleta = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#14b8a6', '#64748b'];
    let lblP = [], datP = [];
    if (categoriasOrdenadas.length === 0) { lblP = ['Sem Gastos']; datP = [1]; } 
    else {
        let soma = 0;
        for (let i = 0; i < Math.min(5, categoriasOrdenadas.length); i++) {
            lblP.push(categoriasOrdenadas[i]); datP.push(gastosPorCategoria[categoriasOrdenadas[i]]);
            soma += gastosPorCategoria[categoriasOrdenadas[i]];
        }
        if (categoriasOrdenadas.length > 5) { lblP.push('Outros'); datP.push(despesas - soma); }
    }

    grafPizza = new Chart(ctxP, {
        type: 'doughnut',
        data: { labels: lblP, datasets: [{ data: datP, backgroundColor: categoriasOrdenadas.length === 0 ? ['#f1f5f9'] : paleta, borderWidth: 3, borderColor: '#ffffff', hoverOffset: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' } } } } }
    });

    // 3. GRÁFICO DE EVOLUÇÃO TEMPORAL (LINHAS)
    const ctxE = document.getElementById('graficoEvolucao').getContext('2d');
    if (grafEvolucao) grafEvolucao.destroy();

    const diasOrdenados = Object.keys(agregacaoDiaria).sort((a,b) => {
        if(a==='S/D') return -1; if(b==='S/D') return 1;
        return parseInt(a.split('/')[0]) - parseInt(b.split('/')[0]);
    });
    const linhaRec = diasOrdenados.map(d => agregacaoDiaria[d].r);
    const linhaDes = diasOrdenados.map(d => agregacaoDiaria[d].d);

    grafEvolucao = new Chart(ctxE, {
        type: 'line',
        data: {
            labels: diasOrdenados,
            datasets: [
                { label: 'Entradas', data: linhaRec, borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4 },
                { label: 'Saídas', data: linhaDes, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { display: false }, x: { grid: { display: false } } } }
    });

    // 4. GRÁFICO DE TOP 5 GASTOS INDIVIDUAIS (BARRAS HORIZONTAIS)
    const ctxT = document.getElementById('graficoTopGastos').getContext('2d');
    if (grafTop) grafTop.destroy();

    grafTop = new Chart(ctxT, {
        type: 'bar',
        data: {
            labels: top5Despesas.length > 0 ? top5Despesas.map(t => t.descricao) : ['Nenhum'],
            datasets: [{
                data: top5Despesas.length > 0 ? top5Despesas.map(t => t.valor) : [0],
                backgroundColor: '#f97316', // Laranja Sênior
                borderRadius: 6,
                barPercentage: 0.6
            }]
        },
        options: {
            indexAxis: 'y', // Vira o gráfico de lado
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${formatarMoeda(ctx.raw)}` } } },
            scales: { x: { display: false }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 'bold', size: 10 } } } }
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
        div.className = "bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-3 rounded-2xl rounded-tr-sm self-end max-w-[85%] text-sm font-medium shadow-sm slide-up-chat";
        div.innerText = texto;
    } else {
        div.className = "bg-white/10 text-indigo-50 p-4 rounded-2xl rounded-tl-sm self-start max-w-[90%] text-sm font-medium border border-white/10 shadow-sm slide-up-chat leading-relaxed";
        div.innerHTML = texto; 
    }
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; 
}

function iniciarCoach() {
    chatBox.innerHTML = ''; 
    let saudacao = "";
    
    if (statsGlobais.transacoesNoPeriodo === 0) {
        saudacao = "Olá! Não encontrei movimentações neste período. Filtre outro mês ali em cima ou registre novos dados na aba de Início.";
    } else if (statsGlobais.taxaPoupanca < 0) {
        saudacao = "<b>Alerta Vermelho! 🚨</b> Identifiquei que você está gastando mais do que ganha neste período. Como posso ajudar? Peça um <i>relatório</i> ou <i>onde cortar</i>.";
    } else {
        saudacao = `Tudo sob controle! Sua taxa de poupança está em <b>${statsGlobais.taxaPoupanca.toFixed(1)}%</b>. O que deseja analisar hoje?`;
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
    typingDiv.className = "text-indigo-300 text-xs italic mt-2 self-start slide-up-chat flex items-center gap-2";
    typingDiv.id = "coach-typing";
    typingDiv.innerHTML = "<i class='fa-solid fa-circle-notch fa-spin'></i> Processando algoritmos...";
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
        document.getElementById('coach-typing').remove();
        gerarRespostaIA(texto.toLowerCase());
    }, 1200); // Simulador de requisição de IA (1.2 segundos)
}

function gerarRespostaIA(pergunta) {
    let resposta = "";

    if (statsGlobais.transacoesNoPeriodo === 0) {
        resposta = "Desculpe, eu preciso de dados para trabalhar. Não há movimentações lançadas no período selecionado.";
        return adicionarMensagemNoChat(resposta, false);
    }

    if (pergunta.includes('relatório') || pergunta.includes('relatorio') || pergunta.includes('resumo')) {
        resposta = `
            📊 <b>Relatório Executivo:</b><br><br>
            <span class="text-green-400"><i class="fa-solid fa-arrow-up"></i> Entradas:</span> <b>${formatarMoeda(statsGlobais.receitas)}</b><br>
            <span class="text-red-400"><i class="fa-solid fa-arrow-down"></i> Saídas:</span> <b>${formatarMoeda(statsGlobais.despesas)}</b><br>
            <span class="text-indigo-300"><i class="fa-solid fa-scale-balanced"></i> Resultado:</span> <b class="${statsGlobais.saldo < 0 ? 'text-red-400' : 'text-green-400'} text-lg">${formatarMoeda(statsGlobais.saldo)}</b><br><br>
            Sua maior despesa unificada foi com a pasta <b>${statsGlobais.topCategoria ? statsGlobais.topCategoria.nome : 'Nada'}</b>, totalizando ${formatarMoeda(statsGlobais.topCategoria ? statsGlobais.topCategoria.valor : 0)}.
        `;
    } 
    else if (pergunta.includes('dica') || pergunta.includes('economizar') || pergunta.includes('cortar')) {
        if (!statsGlobais.topCategoria || statsGlobais.topCategoria.nome.includes('Moradia') || statsGlobais.topCategoria.nome.includes('Saúde')) {
             resposta = "Seus maiores gastos estão em pastas essenciais (Moradia/Saúde). Recomendo focar em aumentar sua captação de renda antes de fazer cortes agressivos de qualidade de vida.";
        } else {
             const economia = statsGlobais.topCategoria.valor * 0.20; 
             resposta = `💡 <b>Plano de Ação Sugerido:</b><br><br>
             Notei que sua pasta de <b>${statsGlobais.topCategoria.nome}</b> está muito pesada (${formatarMoeda(statsGlobais.topCategoria.valor)}).<br><br>
             Se você aplicar uma regra de contenção e reduzir <b>apenas 20%</b> deste gasto no próximo mês, você colocará <b>${formatarMoeda(economia)} diretos no seu caixa livre</b>. Você consegue!`;
        }
    }
    else if (pergunta.includes('previsão') || pergunta.includes('previsao') || pergunta.includes('futuro')) {
        if (statsGlobais.mediaDiaria === 0) {
            resposta = "Ainda não tenho dados de queima diária suficientes para projetar o futuro com exatidão.";
        } else {
            const gastoMensalEstimado = statsGlobais.mediaDiaria * 30;
            resposta = `🔮 <b>Projeção Matemática de Burn Rate:</b><br><br>
            Sua velocidade de queima de caixa é de <b>${formatarMoeda(statsGlobais.mediaDiaria)} por dia</b>.<br><br>
            Se você mantiver a tração atual e não frear, você terminará um mês completo consumindo <b>${formatarMoeda(gastoMensalEstimado)}</b>. Fique de olho no Gráfico de Evolução!`;
        }
    }
    else {
        resposta = "Sou um analista focado em métricas.<br>Tente pedir um <b>Relatório</b>, dicas de <b>Onde Cortar</b> ou uma <b>Previsão</b> matemática.";
    }

    adicionarMensagemNoChat(resposta, false);
}
