// ==========================================
// dividas.js - MOTOR KANBAN DE CONTAS A PAGAR
// ==========================================

let usuarioLogado = null;
let despesasPendentes = [];

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    await carregarDividasDoBanco();
});

// Busca todas as transações do tipo "despesa"
async function carregarDividasDoBanco() {
    try {
        const { data, error } = await supabaseClient
            .from('transacoes')
            .select('*')
            .eq('usuario_id', usuarioLogado.id)
            .eq('tipo', 'despesa')
            // Se você tiver uma coluna "pago" no banco, descomente a linha abaixo no futuro:
            // .eq('pago', false) 
            .order('data_vencimento', { ascending: true });

        if (error) throw error;
        
        despesasPendentes = data || [];
        processarEAtualizarKanban();

    } catch (e) {
        console.error("Erro ao puxar dívidas:", e.message);
    }
}

// O Cérebro do Tempo: Separa as dívidas nas 3 colunas
function processarEAtualizarKanban() {
    const hojeData = new Date();
    hojeData.setHours(0, 0, 0, 0); // Zera as horas para comparar só o dia
    
    const mesAtual = hojeData.getMonth();
    const anoAtual = hojeData.getFullYear();

    let arrAtrasadas = [];
    let arrMes = [];
    let arrFuturo = [];

    let totAtrasadas = 0, totMes = 0, totFuturo = 0;

    despesasPendentes.forEach(d => {
        if (!d.data_vencimento) return; // Ignora se não tiver data
        
        // Corrige o fuso horário para a data do banco não voltar 1 dia
        const dVenc = new Date(d.data_vencimento + 'T12:00:00Z');
        dVenc.setHours(0, 0, 0, 0);

        const mesVenc = dVenc.getMonth();
        const anoVenc = dVenc.getFullYear();

        // LÓGICA DE DISTRIBUIÇÃO
        if (dVenc < hojeData) {
            // Se a data já passou de hoje = Atrasada
            arrAtrasadas.push(d);
            totAtrasadas += d.valor;
        } 
        else if (mesVenc === mesAtual && anoVenc === anoAtual) {
            // Se não está atrasada, e está no mesmo mês/ano atual = Este Mês
            arrMes.push(d);
            totMes += d.valor;
        } 
        else if (dVenc > hojeData) {
            // Se é maior que o mês atual = Futuro
            arrFuturo.push(d);
            totFuturo += d.valor;
        }
    });

    // Atualiza KPIs no topo da tela
    document.getElementById('kpi-atrasadas').innerText = formatarMoeda(totAtrasadas);
    document.getElementById('kpi-mes').innerText = formatarMoeda(totMes);
    document.getElementById('kpi-futuro').innerText = formatarMoeda(totFuturo);

    // Atualiza os Badges (bolinhas com números) nas colunas
    document.getElementById('badge-atrasadas').innerText = arrAtrasadas.length;
    document.getElementById('badge-mes').innerText = arrMes.length;
    document.getElementById('badge-futuro').innerText = arrFuturo.length;

    // Renderiza o HTML nas 3 colunas
    renderizarColuna('lista-atrasadas', arrAtrasadas, 'atrasada');
    renderizarColuna('lista-mes', arrMes, 'mes');
    renderizarColuna('lista-futuro', arrFuturo, 'futuro');
}

// A Fábrica de Cards Sênior
function renderizarColuna(idContainer, arrayDados, tipoColuna) {
    const container = document.getElementById(idContainer);
    
    if (arrayDados.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-8 opacity-50">
                <i class="fa-solid fa-mug-hot text-3xl text-slate-300 mb-2"></i>
                <p class="text-xs font-bold text-slate-400">Tudo limpo por aqui.</p>
            </div>`;
        return;
    }

    // Configuração de cores baseado na coluna
    let corBordaLateral = '';
    let corValor = '';
    let corIconeData = '';

    if (tipoColuna === 'atrasada') {
        corBordaLateral = 'border-l-rose-500';
        corValor = 'text-rose-600';
        corIconeData = 'text-rose-400';
    } else if (tipoColuna === 'mes') {
        corBordaLateral = 'border-l-indigo-500';
        corValor = 'text-slate-900';
        corIconeData = 'text-indigo-400';
    } else {
        corBordaLateral = 'border-l-slate-400';
        corValor = 'text-slate-500';
        corIconeData = 'text-slate-400';
    }

    const htmlCards = arrayDados.map(d => {
        const dataStr = d.data_vencimento.split('-').reverse().join('/');
        
        return `
        <div class="bg-white rounded-xl p-4 border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-l-4 ${corBordaLateral} hover:-translate-y-0.5 hover:shadow-md transition-all group relative">
            
            <div class="flex justify-between items-start gap-2 mb-3">
                <h4 class="font-bold text-sm text-slate-800 leading-tight">${d.descricao}</h4>
                <span class="font-black text-base ${corValor} whitespace-nowrap">${formatarMoeda(d.valor)}</span>
            </div>
            
            <div class="flex items-center justify-between mt-auto">
                <div class="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <i class="fa-regular fa-calendar ${corIconeData}"></i> 
                    <span>${dataStr}</span>
                </div>
                
                <!-- Botão Fake de Ação para o futuro -->
                <button title="Marcar como Pago" class="w-6 h-6 rounded bg-slate-50 text-slate-300 hover:bg-emerald-50 hover:text-emerald-500 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <i class="fa-solid fa-check"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');

    container.innerHTML = htmlCards;
}

// ---------------------------------------------
// CONTROLES DE UI (Modal)
// ---------------------------------------------
function abrirModalNovaDivida() {
    document.getElementById('modal-divida').classList.remove('hidden');
}

function fecharModalNovaDivida() {
    document.getElementById('modal-divida').classList.add('hidden');
}
