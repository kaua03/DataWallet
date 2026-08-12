// ==========================================
// categorias.js - MOTOR DE ORGANIZAÇÃO E ANÁLISE DE CAIXA
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
        let [resCat, resTrans] = await Promise.all([
            // Traz as categorias ordenadas alfabeticamente
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id).order('nome', { ascending: true }),
            // Traz todas as transações para análise de caixa
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id).order('data_vencimento', { ascending: false }).order('id', { ascending: false })
        ]);

        // Self-Healing: Se a tabela estiver vazia, recria as 7 pastas originais Sênior
        if (resCat.data.length === 0) {
            console.log("Sistema Self-Healing: Injetando Categorias Oficiais...");
            await supabaseClient.from('categorias').insert([
                { usuario_id: usuarioLogado.id, nome: 'Alimentação', icone: 'fa-utensils', cor: 'text-orange-500' },
                { usuario_id: usuarioLogado.id, nome: 'Veículo', icone: 'fa-car', cor: 'text-gray-700' },
                { usuario_id: usuarioLogado.id, nome: 'Moradia', icone: 'fa-house', cor: 'text-blue-500' },
                { usuario_id: usuarioLogado.id, nome: 'Estudo', icone: 'fa-graduation-cap', cor: 'text-purple-500' },
                { usuario_id: usuarioLogado.id, nome: 'Imprevistos', icone: 'fa-kit-medical', cor: 'text-teal-500' },
                { usuario_id: usuarioLogado.id, nome: 'Lazer & Pessoal', icone: 'fa-ticket', cor: 'text-pink-500' },
                { usuario_id: usuarioLogado.id, nome: 'Renda & Salário', icone: 'fa-money-bill-wave', cor: 'text-green-500' }
            ]);
            resCat = await supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id).order('nome', { ascending: true });
        }

        categoriasGlobais = resCat.data || [];
        transacoesGlobais = resTrans.data || [];

        renderizarCategorias();

    } catch (e) {
        console.error("Erro ao puxar categorias:", e.message);
    }
}

function renderizarCategorias() {
    const totaisPorCatId = {};
    let totalDespesasGerais = 0;
    let totalReceitasGerais = 0;

    // Acumula os valores e prepara a matemática global
    transacoesGlobais.forEach(t => {
        if (!totaisPorCatId[t.categoria_id]) totaisPorCatId[t.categoria_id] = 0;
        
        totaisPorCatId[t.categoria_id] += t.valor; // Soma tudo daquela categoria

        if(t.tipo === 'despesa') totalDespesasGerais += t.valor;
        else if (t.tipo === 'receita') totalReceitasGerais += t.valor;
    });

    const saldoAtual = totalReceitasGerais - totalDespesasGerais;

    // Filtra apenas categorias de DESPESA para gerar o Ranking (Renda não é Gasto)
    const gastosParaRanking = {};
    transacoesGlobais.forEach(t => {
        if(t.tipo === 'despesa' && t.categoria_id) {
            gastosParaRanking[t.categoria_id] = (gastosParaRanking[t.categoria_id] || 0) + t.valor;
        }
    });
    
    // Do maior para o menor gasto
    const rankingIdsOrdenado = Object.keys(gastosParaRanking).sort((a, b) => gastosParaRanking[b] - gastosParaRanking[a]);

    const htmlCards = categoriasGlobais.map(c => {
        const isRenda = c.nome.includes('Renda') || c.nome.includes('Salário');
        const totalMovimentado = totaisPorCatId[c.id] || 0;
        
        const posicaoIndex = rankingIdsOrdenado.indexOf(String(c.id));
        const badgeRanking = posicaoIndex !== -1 ? `${posicaoIndex + 1}º em gastos` : 'Sem gastos';
        
        let percGastoTexto = "0% DO TOTAL GASTO";
        let percSaldoTexto = "";

        // Só calcula porcentagem se não for a categoria de Renda
        if (!isRenda) {
            if (totalDespesasGerais > 0 && totalMovimentado > 0) {
                percGastoTexto = `${((totalMovimentado / totalDespesasGerais) * 100).toFixed(1)}% DO TOTAL GASTO`;
            }
            if (saldoAtual > 0 && totalMovimentado > 0) {
                percSaldoTexto = `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-md ml-2">${((totalMovimentado / saldoAtual) * 100).toFixed(1)}% DO SALDO ATUAL</span>`;
            }
        }

        const conteudoValores = isRenda 
            ? `<p class="text-[10px] text-green-500 font-bold uppercase mt-2 tracking-wide"><i class="fa-solid fa-arrow-trend-up"></i> Pasta de Captação</p>`
            : `<div class="text-[10px] text-gray-500 font-bold uppercase mt-2 flex items-center tracking-wide">${percGastoTexto} ${percSaldoTexto}</div>`;

        const corValor = isRenda && totalMovimentado > 0 ? 'text-green-500' : 'text-gray-800';

        return `
        <div onclick="abrirExtrato(${c.id}, '${c.nome}', '${c.cor}', '${c.icone}')" class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden">
            <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center ${c.cor} text-2xl group-hover:scale-110 transition-transform">
                    <i class="fa-solid ${c.icone}"></i>
                </div>
                ${!isRenda ? `<span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${posicaoIndex === 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'} shadow-inner">${badgeRanking}</span>` : ''}
            </div>
            
            <div>
                <h4 class="font-bold text-gray-900 text-lg truncate mb-1" title="${c.nome}">${c.nome}</h4>
                <div class="flex items-baseline gap-2">
                    <p class="text-2xl font-black ${corValor}">${formatarMoeda(totalMovimentado)}</p>
                </div>
                ${conteudoValores}
            </div>
        </div>
        `;
    }).join('');

    document.getElementById('grid-categorias').innerHTML = htmlCards;
}

// ---------------------------------------------
// O MOTOR DE EXTRATO (Aba Lateral)
// ---------------------------------------------
function abrirExtrato(idCategoria, nome, cor, icone) {
    document.getElementById('extrato-titulo').innerText = nome;
    document.getElementById('extrato-icone').innerHTML = `<i class="fa-solid ${icone} ${cor}"></i>`;
    
    // Puxa as transações apenas desta categoria
    const historico = transacoesGlobais.filter(t => t.categoria_id === idCategoria);
    let somaPasta = 0;
    const isReceitaCat = nome.includes('Renda');

    const htmlLista = historico.map(t => {
        // Soma o valor independentemente de ser entrada ou saída para o total da pasta
        somaPasta += t.valor; 
        
        let dataStr = t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : '--/--/----';
        let horaStr = '--:--';
        
        // Verifica se existe o timestamp real da transação
        if (t.criado_em) {
            const dataObj = new Date(t.criado_em);
            horaStr = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' });
        }

        const corValor = (t.tipo === 'receita') ? 'text-green-500' : 'text-gray-900';
        const sinal = (t.tipo === 'receita') ? '+' : '-';

        return `
        <div class="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
            <div>
                <p class="font-bold text-gray-900 text-sm mb-1">${t.descricao}</p>
                <div class="flex gap-2 items-center">
                    <span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><i class="fa-regular fa-calendar"></i> ${dataStr}</span>
                    <span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><i class="fa-regular fa-clock"></i> ${horaStr}</span>
                </div>
            </div>
            <p class="${corValor} font-black">${sinal} ${formatarMoeda(t.valor)}</p>
        </div>`;
    }).join('');

    document.getElementById('extrato-lista').innerHTML = htmlLista || `
        <div class="text-center mt-10">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl text-gray-300 mx-auto mb-3"><i class="fa-solid fa-ghost"></i></div>
            <p class="text-sm font-bold text-gray-400">Nenhum registro encontrado nesta pasta.</p>
        </div>
    `;

    document.getElementById('extrato-total').className = `text-2xl font-black ${isReceitaCat && somaPasta > 0 ? 'text-green-500' : 'text-gray-900'}`;
    document.getElementById('extrato-total').innerText = formatarMoeda(somaPasta);
    document.getElementById('modal-extrato').classList.remove('hidden');
}

function fecharExtrato() {
    document.getElementById('modal-extrato').classList.add('hidden');
}
