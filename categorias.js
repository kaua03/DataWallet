// ==========================================
// categorias.js - MOTOR DE ORGANIZAÇÃO, SELF-HEALING E EXTRATO
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
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id),
            // Traz TUDO das transações, incluindo a nova coluna criado_em
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id).order('id', { ascending: false })
        ]);

        // ========================================================
        // O SISTEMA SELF-HEALING (Auto-Curável)
        // Se deletamos as categorias no SQL, o JS reconstrói tudo sozinho!
        // ========================================================
        if (resCat.data.length === 0) {
            console.log("Sistema Self-Healing ativado: Injetando Pastas Oficiais...");
            await supabaseClient.from('categorias').insert([
                { usuario_id: usuarioLogado.id, nome: 'Alimentação (Mercado, Delivery)', icone: 'fa-utensils', cor: 'text-orange-500' },
                { usuario_id: usuarioLogado.id, nome: 'Veículo & Transporte', icone: 'fa-car', cor: 'text-gray-700' },
                { usuario_id: usuarioLogado.id, nome: 'Moradia (Aluguel, Contas)', icone: 'fa-house', cor: 'text-blue-500' },
                { usuario_id: usuarioLogado.id, nome: 'Estudo & Carreira', icone: 'fa-graduation-cap', cor: 'text-purple-500' },
                { usuario_id: usuarioLogado.id, nome: 'Saúde & Imprevistos', icone: 'fa-kit-medical', cor: 'text-teal-500' },
                { usuario_id: usuarioLogado.id, nome: 'Lazer & Pessoal', icone: 'fa-ticket', cor: 'text-pink-500' },
                { usuario_id: usuarioLogado.id, nome: 'Assinaturas & Serviços', icone: 'fa-rotate', cor: 'text-indigo-500' },
                { usuario_id: usuarioLogado.id, nome: 'Renda & Salário', icone: 'fa-money-bill-wave', cor: 'text-green-500' }
            ]);
            // Busca de novo após injetar
            resCat = await supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id);
        }

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

    transacoesGlobais.forEach(t => {
        if(t.tipo === 'despesa') {
            totalDespesas += t.valor;
            if (t.categoria_id) gastosPorCatId[t.categoria_id] = (gastosPorCatId[t.categoria_id] || 0) + t.valor;
        } else if (t.tipo === 'receita') {
            totalReceitas += t.valor;
        }
    });

    const saldoAtual = totalReceitas - totalDespesas;
    const rankingIdsOrdenado = Object.keys(gastosPorCatId).sort((a, b) => gastosPorCatId[b] - gastosPorCatId[a]);

    const htmlCards = categoriasGlobais.map(c => {
        const totalGasto = gastosPorCatId[c.id] || 0;
        const posicaoIndex = rankingIdsOrdenado.indexOf(String(c.id));
        const badgeRanking = posicaoIndex !== -1 ? `${posicaoIndex + 1}º em gastos` : 'Sem gastos';
        
        let percGastoTexto = "0% DO TOTAL";
        let percSaldoTexto = "";

        if (totalDespesas > 0 && totalGasto > 0) {
            percGastoTexto = `${((totalGasto / totalDespesas) * 100).toFixed(1)}% DO TOTAL`;
        }

        if (saldoAtual > 0 && totalGasto > 0) {
            percSaldoTexto = `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-md ml-2">${((totalGasto / saldoAtual) * 100).toFixed(1)}% DO SALDO</span>`;
        }

        const isRenda = c.nome.includes('Renda');
        const conteudoValores = isRenda 
            ? `<p class="text-[10px] text-green-500 font-bold uppercase mt-2 tracking-wide">Pasta de Captação</p>`
            : `<div class="text-[10px] text-gray-500 font-bold uppercase mt-2 flex items-center tracking-wide">${percGastoTexto} ${percSaldoTexto}</div>`;

        // O 'onclick' passa o ID para o Motor de Extrato Flutuante
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
                    <p class="text-2xl font-black text-gray-800">${!isRenda ? formatarMoeda(totalGasto) : '--'}</p>
                </div>
                ${conteudoValores}
            </div>
        </div>
        `;
    }).join('');

    document.getElementById('grid-categorias').innerHTML = htmlCards;
}

// ---------------------------------------------
// O MOTOR DE EXTRATO (O clique no Card)
// ---------------------------------------------
function abrirExtrato(idCategoria, nome, cor, icone) {
    // UI Setup do Modal Lateral
    document.getElementById('extrato-titulo').innerText = nome;
    document.getElementById('extrato-icone').innerHTML = `<i class="fa-solid ${icone} ${cor}"></i>`;
    
    // Filtra as transações apenas desta categoria
    const historico = transacoesGlobais.filter(t => t.categoria_id === idCategoria);
    
    let somaPasta = 0;
    const isReceita = nome.includes('Renda');

    const htmlLista = historico.map(t => {
        somaPasta += t.valor;
        
        // Tratamento da Data e Hora Exata
        let dataStr = '';
        let horaStr = '';
        
        if (t.criado_em) {
            const dataObj = new Date(t.criado_em);
            dataStr = dataObj.toLocaleDateString('pt-BR');
            horaStr = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' });
        } else if (t.data_vencimento) {
            // Fallback para transações antigas que só tinham a data
            dataStr = t.data_vencimento.split('-').reverse().join('/');
            horaStr = '--:--';
        }

        const corValor = isReceita ? 'text-green-500' : 'text-gray-900';
        const sinal = isReceita ? '+' : '-';

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

    document.getElementById('extrato-total').innerText = formatarMoeda(somaPasta);
    document.getElementById('modal-extrato').classList.remove('hidden');
}

function fecharExtrato() {
    document.getElementById('modal-extrato').classList.add('hidden');
}
