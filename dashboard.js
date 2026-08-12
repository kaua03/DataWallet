// ==========================================
// dashboard.js - MOTOR DE DATA SCIENCE E COACH IA
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];
let graficoBalancoInstancia = null;
let graficoPizzaInstancia = null;

// Variáveis para a IA do Coach ler em tempo real
let statsGlobais = {
    receitas: 0, despesas: 0, saldo: 0, taxaPoupanca: 0, 
    mediaDiaria: 0, maiorGasto: null, topCategoria: null, transacoesNoPeriodo: 0
};

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    // Ouve a mudança do filtro
    document.getElementById('filtro-periodo').addEventListener('change', processarEAtualizarTudo);

    // Ouve Enter no Chat
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

    } catch (e) {
        console.error("Erro ao puxar dados:", e.message);
    }
}

// ---------------------------------------------
// O MOTOR DE PROCESSAMENTO (Matemática e Gráficos)
// ---------------------------------------------
function processarEAtualizarTudo() {
    const periodoSelect = document.getElementById('filtro-periodo').value;
    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth();
    const anoAtual = dataAtual.getFullYear();

    // 1. FILTRO DE TEMPO
    const transacoesFiltradas = transacoesGlobais.filter(t => {
        if (!t.data_vencimento) return true;
        const dTransacao = new Date(t.data_vencimento + 'T12:00:00Z');
        
        if (periodoSelect === 'mes_atual') {
            return dTransacao.getMonth() === mesAtual && dTransacao.getFullYear() === anoAtual;
        } else if (periodoSelect === 'mes_passado') {
            const mesAnt = mesAtual === 0 ? 11 : mesAtual - 1;
            const anoAnt = mesAtual === 0 ? anoAtual - 1 : anoAtual;
            return dTransacao.getMonth() === mesAnt && dTransacao.getFullYear() === anoAnt;
        } else if (periodoSelect === 'ano_atual') {
            return dTransacao.getFullYear() === anoAtual;
        }
        return true; // 'tudo'
    });

    // 2. MATEMÁTICA
    let totalDespesas = 0;
    let totalReceitas = 0;
    let maiorGasto = { valor: 0, descricao: "Nenhum" };
    const gastosPorCategoria = {};

    transacoesFiltradas.forEach(t => { 
        if(t.tipo === 'despesa') {
            totalDespesas += t.valor; 
            if(t.valor > maiorGasto.valor) maiorGasto = t;
            
            const catNome = categoriasGlobais.find(c => c.id === t.categoria_id)?.nome || 'Outros';
            gastosPorCategoria[catNome] = (gastosPorCategoria[catNome] || 0) + t.valor;
        } else {
            totalReceitas += t.valor;
        }
    });

    // Taxa de Poupança e Média Diária
    let taxa = 0;
    if (totalReceitas > 0) taxa = ((totalReceitas - totalDespesas) / totalReceitas) * 100;
    else if (totalDespesas > 0) taxa = -100;

    const diasNoPeriodo = periodoSelect === 'mes_atual' ? dataAtual.getDate() : 30; // Aproximação pra métrica diária
    const media = totalDespesas > 0 ? (totalDespesas / diasNoPeriodo) : 0;

    // Atualiza Stats Globais para o Coach ler
    const categoriasOrdenadas = Object.keys(gastosPorCategoria).sort((a, b) => gastosPorCategoria[b] - gastosPorCategoria[a]);
    
    statsGlobais = {
        receitas: totalReceitas,
        despesas: totalDespesas,
        saldo: totalReceitas - totalDespesas,
        taxaPoupanca: taxa,
        mediaDiaria: media,
        maiorGasto: maiorGasto,
        topCategoria: categoriasOrdenadas.length > 0 ? { nome: categoriasOrdenadas[0], valor: gastosPorCategoria[categoriasOrdenadas[0]] } : null,
        transacoesNoPeriodo: transacoesFiltradas.length
    };

    // 3. RENDERIZA OS CARDS (DOM)
    document.getElementById('dash-media').innerText = formatarMoeda(media);
    document.getElementById('dash-taxa').innerText = `${taxa.toFixed(1)}%`;
    document.getElementById('dash-taxa').className = `text-xl md:text-2xl font-black ${taxa >= 20 ? 'text-green-500' : (taxa > 0 ? 'text-blue-500' : 'text-red-500')}`;
    
    if (maiorGasto.valor > 0) {
        document.getElementById('dash-maior').innerText = formatarMoeda(maiorGasto.valor);
        document.getElementById('dash-maior-desc').innerText = maiorGasto.descricao;
    } else {
        document.getElementById('dash-maior').innerText = "R$ 0,00";
        document.getElementById('dash-maior-desc').innerText = "--";
    }

    const badgeStatus = document.getElementById('dash-status');
    if (taxa >= 20) { badgeStatus.innerText = "Excelente"; badgeStatus.className = "mt-2 text-xs font-black px-3 py-1 rounded-full bg-green-100 text-green-600 inline-block uppercase"; }
    else if (taxa > 0) { badgeStatus.innerText = "Estável"; badgeStatus.className = "mt-2 text-xs font-black px-3 py-1 rounded-full bg-blue-100 text-blue-600 inline-block uppercase"; }
    else { badgeStatus.innerText = "Em Risco"; badgeStatus.className = "mt-2 text-xs font-black px-3 py-1 rounded-full bg-red-100 text-red-600 inline-block uppercase"; }

    // 4. ATUALIZA GRÁFICOS (CHART.JS)
    renderizarGraficos(totalReceitas, totalDespesas, gastosPorCategoria, categoriasOrdenadas);

    // 5. MENSAGEM INICIAL DO COACH
    iniciarCoach();
}

function renderizarGraficos(receitas, despesas, gastosPorCategoria, categoriasOrdenadas) {
    // Cores Padrão DataWallet
    const corReceita = '#22c55e'; // Green 500
    const corDespesa = '#ef4444'; // Red 500
    const paletaCores = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#14b8a6', '#64748b'];

    // GRÁFICO 1: Balanço (Barras)
    const ctxBalanco = document.getElementById('graficoBalanco').getContext('2d');
    if (graficoBalancoInstancia) graficoBalancoInstancia.destroy();
    
    graficoBalancoInstancia = new Chart(ctxBalanco, {
        type: 'bar',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                data: [receitas, despesas],
                backgroundColor: [corReceita, corDespesa],
                borderRadius: 8,
                borderSkipped: false,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatarMoeda(ctx.raw) } } },
            scales: { y: { beginAtZero: true, display: false }, x: { grid: { display: false } } }
        }
    });

    // GRÁFICO 2: Pizza de Despesas (Doughnut)
    const ctxPizza = document.getElementById('graficoPizza').getContext('2d');
    if (graficoPizzaInstancia) graficoPizzaInstancia.destroy();

    // Pega as top 5 categorias e agrupa o resto em "Outros"
    let labelsPizza = [];
    let dadosPizza = [];
    
    if (categoriasOrdenadas.length === 0) {
        labelsPizza = ['Sem Gastos'];
        dadosPizza = [1];
    } else {
        let somaTop5 = 0;
        for (let i = 0; i < Math.min(5, categoriasOrdenadas.length); i++) {
            labelsPizza.push(categoriasOrdenadas[i]);
            dadosPizza.push(gastosPorCategoria[categoriasOrdenadas[i]]);
            somaTop5 += gastosPorCategoria[categoriasOrdenadas[i]];
        }
        if (categoriasOrdenadas.length > 5) {
            labelsPizza.push('Outros');
            dadosPizza.push(despesas - somaTop5);
        }
    }

    graficoPizzaInstancia = new Chart(ctxPizza, {
        type: 'doughnut',
        data: {
            labels: labelsPizza,
            datasets: [{
                data: dadosPizza,
                backgroundColor: categoriasOrdenadas.length === 0 ? ['#f1f5f9'] : paletaCores,
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' } } },
                tooltip: { callbacks: { label: (ctx) => ` ${formatarMoeda(categoriasOrdenadas.length === 0 ? 0 : ctx.raw)}` } }
            }
        }
    });
}

// ---------------------------------------------
// O COACH FINANCEIRO (INTELIGÊNCIA ARTIFICIAL)
// ---------------------------------------------
const chatBox = document.getElementById('chat-box');

function adicionarMensagemNoChat(texto, isUsuario = false) {
    const div = document.createElement('div');
    if (isUsuario) {
        div.className = "bg-indigo-500 text-white p-3 rounded-2xl rounded-tr-sm self-end max-w-[85%] text-sm font-medium shadow-sm slide-up";
        div.innerText = texto;
    } else {
        div.className = "bg-white/10 text-indigo-50 p-3 rounded-2xl rounded-tl-sm self-start max-w-[90%] text-sm font-medium border border-white/10 shadow-sm slide-up";
        div.innerHTML = texto; // Permite formatação HTML na resposta do bot
    }
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; // Rola pra baixo
}

function iniciarCoach() {
    chatBox.innerHTML = ''; // Limpa o chat
    let saudacao = "";
    
    if (statsGlobais.transacoesNoPeriodo === 0) {
        saudacao = "Olá! Não encontrei movimentações neste período. Filtre outro mês ou registre novos dados na aba de Início.";
    } else if (statsGlobais.taxaPoupanca < 0) {
        saudacao = "<b>Alerta Vermelho!</b> Identifiquei que você está gastando mais do que ganha neste período. Como posso ajudar? Peça um <i>relatório</i> ou <i>dicas</i>.";
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

    // 1. Mostra a mensagem do usuário
    adicionarMensagemNoChat(texto, true);
    input.value = '';

    // 2. Simula o "Digitando..."
    const typingDiv = document.createElement('div');
    typingDiv.className = "text-indigo-300 text-xs italic mt-2 self-start slide-up";
    typingDiv.id = "coach-typing";
    typingDiv.innerText = "Processando dados...";
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    // 3. Processa a resposta após 1 segundo (pra dar efeito de IA real)
    setTimeout(() => {
        document.getElementById('coach-typing').remove();
        gerarRespostaIA(texto.toLowerCase());
    }, 1000);
}

function gerarRespostaIA(pergunta) {
    let resposta = "";

    if (statsGlobais.transacoesNoPeriodo === 0) {
        resposta = "Desculpe, eu preciso de dados para trabalhar. Não há movimentações lançadas no período selecionado.";
        return adicionarMensagemNoChat(resposta, false);
    }

    // LÓGICA DE INFERÊNCIA DO COACH
    if (pergunta.includes('relatório') || pergunta.includes('relatorio') || pergunta.includes('resumo')) {
        resposta = `
            📊 <b>Relatório Executivo:</b><br><br>
            Entradas: <span class="text-green-400 font-bold">${formatarMoeda(statsGlobais.receitas)}</span><br>
            Saídas: <span class="text-red-400 font-bold">${formatarMoeda(statsGlobais.despesas)}</span><br>
            Resultado do Período: <b>${formatarMoeda(statsGlobais.saldo)}</b><br><br>
            Sua maior despesa unificada foi com <b>${statsGlobais.topCategoria ? statsGlobais.topCategoria.nome : 'Nada'}</b>, totalizando ${formatarMoeda(statsGlobais.topCategoria ? statsGlobais.topCategoria.valor : 0)}.
        `;
    } 
    else if (pergunta.includes('dica') || pergunta.includes('economizar') || pergunta.includes('cortar')) {
        if (!statsGlobais.topCategoria || statsGlobais.topCategoria.nome.includes('Moradia') || statsGlobais.topCategoria.nome.includes('Saúde')) {
             resposta = "Seus maiores gastos estão em pastas essenciais (Moradia/Saúde). Recomendo focar em aumentar sua renda antes de fazer cortes agressivos de qualidade de vida.";
        } else {
             const economia = statsGlobais.topCategoria.valor * 0.20; // Sugere corte de 20%
             resposta = `💡 <b>Sugestão de Corte:</b><br><br>
             Notei que sua pasta de <b>${statsGlobais.topCategoria.nome}</b> está alta (${formatarMoeda(statsGlobais.topCategoria.valor)}).<br><br>
             Se você conseguir reduzir apenas 20% deste gasto no próximo mês, você colocaria <b>${formatarMoeda(economia)} diretos no seu bolso</b>. Topa o desafio?`;
        }
    }
    else if (pergunta.includes('previsão') || pergunta.includes('previsao') || pergunta.includes('futuro')) {
        if (statsGlobais.mediaDiaria === 0) {
            resposta = "Não há saídas suficientes para calcular a sua taxa de queima diária.";
        } else {
            const gastoMensalEstimado = statsGlobais.mediaDiaria * 30;
            resposta = `🔮 <b>Projeção Matemática:</b><br><br>
            Você está gastando em média <b>${formatarMoeda(statsGlobais.mediaDiaria)} por dia</b>.<br><br>
            Se mantiver esse ritmo (sem frear), você terminará um mês de 30 dias com <b>${formatarMoeda(gastoMensalEstimado)}</b> em saídas. Planeje-se!`;
        }
    }
    else {
        resposta = "Eu sou um Coach Focado em Dados. Tente me pedir um <b>Relatório</b>, dicas de <b>Onde Economizar</b> ou uma <b>Previsão</b> financeira baseada no seu caixa atual.";
    }

    adicionarMensagemNoChat(resposta, false);
}
