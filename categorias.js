// ==========================================
// categorias.js - MOTOR DE ORGANIZAÇÃO E RANKING
// ==========================================

let usuarioLogado = null;
let categoriasGlobais = [];
let transacoesGlobais = [];
let corSelecionada = 'text-blue-500'; // Cor padrão

// Ignição da Tela
document.addEventListener('DOMContentLoaded', async () => {
    // Escudo Protetor via config.js
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    await carregarDadosDoBanco();
});

// 1. O EXTRATOR (Puxa Categorias e Transações para cruzar os dados)
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

// 2. O CÉREBRO RANKING E RENDERIZAÇÃO
function renderizarCategorias() {
    // A. Calcula o total gasto por Categoria ID
    const gastosPorCatId = {};
    transacoesGlobais.forEach(t => {
        if(t.tipo === 'despesa') {
            // Se a despesa tiver uma categoria (não for null), soma o valor no "balde" daquele ID
            if (t.categoria_id) {
                gastosPorCatId[t.categoria_id] = (gastosPorCatId[t.categoria_id] || 0) + t.valor;
            }
        }
    });

    // B. Cria uma lista de IDs ordenada pelo valor (do maior para o menor)
    const rankingIdsOrdenado = Object.keys(gastosPorCatId).sort((a, b) => gastosPorCatId[b] - gastosPorCatId[a]);

    // C. Constrói os Cards
    const htmlCards = categoriasGlobais.map(c => {
        // Pega o total gasto ou zero
        const totalGasto = gastosPorCatId[c.id] || 0;
        
        // Acha em qual posição este ID está no ranking
        const posicaoIndex = rankingIdsOrdenado.indexOf(String(c.id));
        
        // Define o selo do Ranking
        const badgeRanking = posicaoIndex !== -1 ? `${posicaoIndex + 1}° em gastos` : 'Sem gastos';

        return `
        <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between group">
            <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center ${c.cor} text-2xl group-hover:scale-110 transition-transform">
                    <i class="fa-solid ${c.icone}"></i>
                </div>
                <span class="text-xs font-bold px-2.5 py-1 rounded-full ${posicaoIndex === 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}">
                    ${badgeRanking}
                </span>
            </div>
            <div>
                <h4 class="font-bold text-gray-900 text-lg mb-1 truncate">${c.nome}</h4>
                <p class="text-gray-400 text-xs font-bold uppercase">Total Gasto</p>
                <p class="text-xl font-black text-gray-800">${formatarMoeda(totalGasto)}</p>
            </div>
        </div>
        `;
    }).join('');

    document.getElementById('grid-categorias').innerHTML = htmlCards || '<p class="text-gray-400 col-span-full">Você ainda não tem categorias criadas.</p>';
}

// ---------------------------------------------
// 3. CRIAÇÃO DE NOVA CATEGORIA
// ---------------------------------------------
function abrirModalCategoria() { 
    document.getElementById('modal-categoria').classList.remove('hidden'); 
}

function fecharModalCategoria() { 
    document.getElementById('modal-categoria').classList.add('hidden'); 
}

// Controle do visual dos botões de cor
function selecionarCor(corEscolhida) {
    corSelecionada = corEscolhida;
    
    // Reseta todos os botões (Tira a borda e o ícone de check)
    const botoes = document.querySelectorAll('.color-btn');
    botoes.forEach(btn => {
        btn.classList.remove(`border-${btn.classList[4].split('-')[1]}-500`); // remove a borda da cor específica
        btn.classList.add('border-transparent');
        btn.innerHTML = ''; // Limpa o check
    });

    // Ativa o botão clicado
    const btnAtivo = event.currentTarget;
    btnAtivo.classList.remove('border-transparent');
    
    // Gambiarra sênior rápida para extrair a cor base (ex: 'blue' de 'text-blue-500') e aplicar na borda
    const corBase = corEscolhida.split('-')[1];
    btnAtivo.classList.add(`border-${corBase}-500`);
    btnAtivo.innerHTML = '<i class="fa-solid fa-check text-xs"></i>';
}

async function salvarNovaCategoria() {
    const nome = document.getElementById('cat-nome').value.trim();
    let icone = document.getElementById('cat-icone').value.trim();
    
    if(!nome) return alert("Digite um nome para a pasta.");
    if(!icone.startsWith('fa-')) icone = 'fa-tag'; // Fallback de segurança

    const btn = document.getElementById('btn-salvar-categoria');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

    try {
        const { error } = await supabaseClient.from('categorias').insert([{ 
            usuario_id: usuarioLogado.id, 
            nome: nome, 
            icone: icone, 
            cor: corSelecionada 
        }]);
        
        if (error) throw error;
        
        // Limpa formulário
        document.getElementById('cat-nome').value = '';
        document.getElementById('cat-icone').value = 'fa-tag';
        selecionarCor('text-blue-500'); // Reseta a cor para o padrão
        
        fecharModalCategoria();
        await carregarDadosDoBanco(); // Recarrega o grid

    } catch(e) {
        alert("Erro ao criar pasta: " + e.message);
    } finally {
        btn.innerHTML = 'Criar Pasta';
    }
}
