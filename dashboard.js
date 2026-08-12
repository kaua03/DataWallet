// ==========================================
// js/dashboard.js - MOTOR DE BUSINESS INTELLIGENCE
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];
let dividasGlobais = [];

// Ignição da Tela
document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return;

    // Escuta a mudança do filtro de período para recalcular os dados na hora
    document.getElementById('filtro-periodo').addEventListener('change', renderizarDashboard);

    await carregarDadosDoBanco();
});

// 1. O EXTRATOR (Puxa os dados isolados do usuário)
async function carregarDadosDoBanco() {
    try {
        const [rTrans, rCat, rDiv] = await Promise.all([
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id),
            supabaseClient.from('dividas').select('*').eq('usuario_id', usuarioLogado.id)
        ]);

        transacoesGlobais = rTrans.data || [];
        categoriasGlobais = rCat.data || [];
        dividasGlobais = rDiv.data || [];

        renderizarDashboard();
    } catch (e) {
        console.error("Erro ao puxar dados para análise:", e.message);
    }
}

// 2. O CÉREBRO ANALÍTICO (Processa o Período e a Matemática)
function renderizarDashboard() {
    const periodoSelect = document.getElementById('filtro-periodo').value;
    const dataAtual = new Date();
    
    // Filtragem de Transações por Data
    const transacoesFiltradas = transacoesGlobais.filter(t => {
        if (!t.data_vencimento) return false;
        
        const dTransacao = new Date(t.data_vencimento + 'T12:00:00Z');
        
        if (periodoSelect === 'mes_atual') {
            return dTransacao.getMonth() === dataAtual.getMonth() && dTransacao.getFullYear() === dataAtual.getFullYear();
        } else if (periodoSelect === 'mes_anterior') {
            // Lógica robusta para virada de ano (ex: Janeiro -> Dezembro do ano passado)
            const mesAnt = dataAtual.getMonth() === 0 ? 11 : dataAtual.getMonth() - 1;
            const anoAnt = dataAtual.getMonth() === 0 ? dataAtual.getFullYear() - 1 : dataAtual.getFullYear();
            return dTransacao.getMonth() === mesAnt && dTransacao.getFullYear() === anoAnt;
        } else if (periodoSelect === 'ano_atual') {
            return dTransacao.getFullYear() === dataAtual.getFullYear();
        }
        return true;
    });

    // Matemática Financeira do Período
    let totalDespesas = 0;
    let totalReceitas = 0;
    let maiorGasto = { valor: 0, descricao: "Nenhum" };
    const totaisCat = {};

    transacoesFiltradas.forEach(t => { 
        if(t.tipo === 'despesa') {
            totalDespesas += t.valor; 
            if(t.valor > maiorGasto.valor) maiorGasto = t; // Encontra o maior gasto
            
            const cNome = categoriasGlobais.find(c => c.id === t.categoria_id)?.nome || 'Outros';
            totaisCat[cNome] = (totaisCat[cNome] || 0) + t.valor;
        } else {
            totalReceitas += t.valor;
        }
    });

    // 3. ATUALIZAÇÃO DAS MÉTRICAS EXTRAS
    const diasNoPeriodo = periodoSelect === 'ano_atual' ? 365 : 30; // Aproximação Sênior
    const mediaDiaria = totalDespesas > 0 ? (totalDespesas / diasNoPeriodo) : 0;
    
    // Taxa de Poupança = ((Receitas - Despesas) / Receitas) * 100
    let taxaPoupanca = 0;
    let corTaxa = 'text-gray-500';
    if (totalReceitas > 0) {
        taxaPoupanca = ((totalReceitas - totalDespesas) / totalReceitas) * 100;
        if (taxaPoupanca >= 20) corTaxa = 'text-green-500';
        else if (taxaPoupanca > 0) corTaxa = 'text-blue-500';
        else corTaxa = 'text-red-500';
    }

    document.getElementById('dash-media').innerText = formatarMoeda(mediaDiaria);
    document.getElementById('dash-maior').innerHTML = `${formatarMoeda(maiorGasto.valor)} <br><span class="text-xs font-medium text-gray-400">(${maiorGasto.descricao})</span>`;
    document.getElementById('dash-taxa').innerText = `${taxaPoupanca.toFixed(1)}%`;
    document.getElementById('dash-taxa').className = `text-2xl font-black ${corTaxa}`;

    // 4. ATUALIZAÇÃO DO GRÁFICO (Barras de Categoria)
    // Ordena do maior para o menor
    const categoriasOrdenadas = Object.keys(totaisCat).sort((a, b) => totaisCat[b] - totaisCat[a]);
    
    document.getElementById('grafico-categorias').innerHTML = categoriasOrdenadas.map(cat => {
        const val = totaisCat[cat];
        const limite = totalReceitas > 0 ? totalReceitas * 0.4 : 1000; // O limite da barra é 40% das receitas ou R$1000
        const perc = Math.min((val / limite) * 100, 100);
        return `
            <div class="mb-3">
                <div class="flex justify-between items-end mb-1">
                    <span class="text-sm font-bold text-gray-700">${cat}</span>
                    <span class="text-xs font-bold text-gray-500">${formatarMoeda(val)}</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2.5">
                    <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-1000" style="width: ${perc}%"></div>
                </div>
            </div>
        `;
    }).join('') || '<p class="text-sm font-bold text-gray-400 text-center py-4">Sem dados no período.</p>';

    // 5. INTELIGÊNCIA DO COACH FINANCEIRO & ALERTAS
    gerarCoachEAlertas(taxaPoupanca, totalDespesas, totalReceitas, transacoesFiltradas.length);
}

function gerarCoachEAlertas(taxa, despesas, receitas, qtdTransacoes) {
    const coach = document.getElementById('texto-coach');
    const alertas = document.getElementById('lista-alertas');
    let listaAlertasHTML = '';

    // Lógica do Coach
    if (qtdTransacoes === 0) {
        coach.innerHTML = "Não encontrei registros neste período. Lance suas despesas na aba Início para eu poder analisá-las.";
    } else if (taxa < 0) {
        coach.innerHTML = "<strong>Atenção Vermelha!</strong> Você gastou mais do que ganhou neste período. O seu sistema está operando no prejuízo. Corte gastos não essenciais imediatamente.";
    } else if (taxa >= 20) {
        coach.innerHTML = `Excepcional! Você manteve uma Taxa de Poupança de ${taxa.toFixed(1)}%. Isso é o padrão ouro de saúde financeira. Você está no caminho da liberdade.`;
    } else {
        coach.innerHTML = `Sua carteira está estável, mas você está poupando apenas ${taxa.toFixed(1)}%. O ideal recomendado é guardar no mínimo 20% do que você ganha.`;
    }

    // Lógica de Alertas Baseado em Dívidas Vencendo
    const hoje = new Date();
    const dataLimite = new Date();
    dataLimite.setDate(hoje.getDate() + 15); // Alerta para dívidas nos próximos 15 dias

    const dividasProximas = dividasGlobais.filter(d => {
        const v = new Date(d.data_vencimento + 'T12:00:00Z');
        return v >= hoje && v <= dataLimite;
    });

    if (dividasProximas.length > 0) {
        dividasProximas.forEach(d => {
            listaAlertasHTML += `
            <div class="flex items-center gap-3 bg-red-50 p-3 rounded-xl border border-red-200">
                <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-red-500 shadow-sm"><i class="fa-solid fa-calendar-xmark"></i></div>
                <div><p class="text-sm font-bold text-red-900">${d.descricao}</p><p class="text-xs text-red-700">${formatarMoeda(d.valor)} vence nos próximos dias.</p></div>
            </div>`;
        });
    }

    if (despesas > (receitas * 0.8) && receitas > 0) {
        listaAlertasHTML += `
        <div class="flex items-center gap-3 bg-yellow-50 p-3 rounded-xl border border-yellow-200">
            <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-yellow-500 shadow-sm"><i class="fa-solid fa-lightbulb"></i></div>
            <p class="text-sm font-medium text-yellow-800">Seus gastos já consumiram mais de 80% da sua receita do período.</p>
        </div>`;
    }

    alertas.innerHTML = listaAlertasHTML || `
        <div class="flex items-center gap-3 bg-green-50 p-3 rounded-xl border border-green-200 h-full">
            <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-500 shadow-sm"><i class="fa-solid fa-check"></i></div>
            <p class="text-sm font-bold text-green-800">Nenhum risco detectado na carteira.</p>
        </div>
    `;
}
