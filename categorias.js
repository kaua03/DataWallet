// ==========================================
// categorias.js - MOTOR DE ANÁLISE DE CAIXA
// ==========================================

let usuarioLogado = null;
let categoriasGlobais = [];
let transacoesGlobais = [];

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    await carregarDadosDoBanco();
});

async function carregarDadosDoBanco() {
    try {
        const [resCat, resTrans] = await Promise.all([
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id),
            supabaseClient.from('transacoes').select('categoria_id, valor, tipo').eq('usuario_id', usuarioLogado.id)
        ]);

        categoriasGlobais = resCat.data || [];
        transacoesGlobais = resTrans.data || [];

        renderizarCategorias();

    } catch (e) {
        console.error("Erro ao puxar pastas:", e.message);
    }
}

function renderizarCategorias() {
    const gastosPorCatId = {};
    let totalDespesas = 0;
    let totalReceitas = 0;

    // Varre todas as transações da vida do usuário
    transacoesGlobais.forEach(t => {
        if(t.tipo === 'despesa') {
            totalDespesas += t.valor;
            if (t.categoria_id) {
                gastosPorCatId[t.categoria_id] = (gastosPorCatId[t.categoria_id] || 0) + t.valor;
            }
        } else if (t.tipo === 'receita') {
            totalReceitas += t.valor;
        }
    });

    const saldoAtual = totalReceitas - totalDespesas;

    // Ordena do maior gasto para o menor
    const rankingIdsOrdenado = Object.keys(gastosPorCatId).sort((a, b) => gastosPorCatId[b] - gastosPorCatId[a]);

    const htmlCards = categoriasGlobais.map(c => {
        const totalGasto = gastosPorCatId[c.id] || 0;
        const posicaoIndex = rankingIdsOrdenado.indexOf(String(c.id));
        const badgeRanking = posicaoIndex !== -1 ? `${posicaoIndex + 1}º em gastos` : 'Sem gastos';
        
        let percGastoTexto = "0% DO TOTAL GASTO";
        let percSaldoTexto = "";

        // % Em relação a todas as despesas
        if (totalDespesas > 0 && totalGasto > 0) {
            const percDespesa = ((totalGasto / totalDespesas) * 100).toFixed(1);
            percGastoTexto = `${percDespesa}% DO TOTAL GASTO`;
        }

        // % Em relação ao Saldo Atual (Só aparece se o usuário tiver saldo positivo)
        if (saldoAtual > 0 && totalGasto > 0) {
            const percSaldo = ((totalGasto / saldoAtual) * 100).toFixed(1);
            percSaldoTexto = `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-md ml-2">${percSaldo}% DO SALDO ATUAL</span>`;
        }

        const isRenda = c.nome.includes('Renda');
        
        // Se for a pasta de Salário, a interface muda
        const conteudoValores = isRenda 
            ? `<p class="text-[10px] text-green-500 font-bold uppercase mt-2 tracking-wide">Pasta de Captação</p>`
            : `<div class="text-[10px] text-gray-500 font-bold uppercase mt-2 flex items-center tracking-wide">${percGastoTexto} ${percSaldoTexto}</div>`;

        return `
        <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between group relative overflow-hidden">
            <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center ${c.cor} text-2xl group-hover:scale-110 transition-transform">
                    <i class="fa-solid ${c.icone}"></i>
                </div>
                ${!isRenda ? `<span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${posicaoIndex === 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'} shadow-inner">${badgeRanking}</span>` : ''}
            </div>
            
            <div>
                <h4 class="font-bold text-gray-900 text-lg truncate mb-1">${c.nome}</h4>
                <div class="flex items-baseline gap-2">
                    <p class="text-2xl font-black text-gray-800">${!isRenda ? formatarMoeda(totalGasto) : '--'}</p>
                </div>
                ${conteudoValores}
            </div>
        </div>
        `;
    }).join('');

    document.getElementById('grid-categorias').innerHTML = htmlCards;
}
