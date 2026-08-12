// ==========================================
// dividas.js - MOTOR KANBAN DE CONTAS E DÍVIDAS
// ==========================================

let usuarioLogado = null;
let dividasGlobais = [];

// Ignição da Tela
document.addEventListener('DOMContentLoaded', async () => {
    // Escudo Protetor via config.js
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    // O Auto-Preenchimento inteligente do input de data para a data de Hoje
    document.getElementById('div-data').value = new Date().toISOString().split('T')[0];

    await carregarDadosDoBanco();
});

// 1. O EXTRATOR (Puxa APENAS as dívidas)
async function carregarDadosDoBanco() {
    try {
        const { data, error } = await supabaseClient
            .from('dividas')
            .select('*')
            .eq('usuario_id', usuarioLogado.id)
            .order('data_vencimento', { ascending: true }); // Traz da mais antiga para a mais nova

        if (error) throw error;
        
        dividasGlobais = data || [];
        renderizarKanban();

    } catch (e) {
        console.error("Erro ao puxar dívidas:", e.message);
    }
}

// 2. O CÉREBRO DISTRIBUIDOR (Kanban)
function renderizarKanban() {
    const atrasadas = [];
    const atual = [];
    const futuras = [];
    
    // Captura do Mês e Ano correntes de forma segura
    const dataHoje = new Date();
    const mesAtual = dataHoje.getMonth();
    const anoAtual = dataHoje.getFullYear();

    // Filtra as dívidas nas 3 colunas baseadas na Data
    dividasGlobais.forEach(d => {
        // T12:00:00Z evita bugs de fuso horário que fazem o dia voltar para o dia anterior
        const dData = new Date(d.data_vencimento + 'T12:00:00Z');
        
        // Se a data inteira for menor que hoje E não for deste mês atual -> Atrasada
        if (dData < dataHoje && dData.getMonth() !== mesAtual) {
            atrasadas.push(d);
        } 
        // Se bater no mês e ano exatos de hoje -> Este Mês
        else if (dData.getMonth() === mesAtual && dData.getFullYear() === anoAtual) {
            atual.push(d);
        } 
        // Tudo que sobrar (meses ou anos à frente) -> Futuras
        else {
            futuras.push(d);
        }
    });

    // Função interna para desenhar cada card
    const gerarCardD = (d, corTexto, corBorda) => `
        <div class="bg-white p-3 rounded-xl border ${corBorda} shadow-sm flex justify-between items-center hover:shadow-md transition">
            <div class="truncate pr-2">
                <p class="font-bold text-gray-800 text-sm truncate">${d.descricao}</p>
                <p class="text-xs text-gray-500 font-bold mt-0.5">
                    <i class="fa-regular fa-calendar"></i> ${d.data_vencimento.split('-').reverse().join('/')}
                </p>
            </div>
            <p class="font-black ${corTexto} shrink-0">${formatarMoeda(d.valor)}</p>
        </div>
    `;

    // Função de soma do array de objetos
    const somaArr = (arr) => arr.reduce((acc, curr) => acc + curr.valor, 0);

    // 1. Injeta Coluna ATRASADAS
    document.getElementById('total-div-atrasada').innerText = formatarMoeda(somaArr(atrasadas));
    document.getElementById('col-div-atrasada').innerHTML = atrasadas.map(d => gerarCardD(d, 'text-red-600', 'border-red-100')).join('') || '<p class="text-xs text-gray-400 font-bold text-center mt-4">Nenhuma conta atrasada. Você está em dia!</p>';

    // 2. Injeta Coluna ESTE MÊS
    document.getElementById('total-div-atual').innerText = formatarMoeda(somaArr(atual));
    document.getElementById('col-div-atual').innerHTML = atual.map(d => gerarCardD(d, 'text-blue-600', 'border-blue-100')).join('') || '<p class="text-xs text-gray-400 font-bold text-center mt-4">Nenhuma conta para este mês.</p>';

    // 3. Injeta Coluna FUTURAS
    document.getElementById('total-div-futura').innerText = formatarMoeda(somaArr(futuras));
    document.getElementById('col-div-futura').innerHTML = futuras.map(d => gerarCardD(d, 'text-gray-600', 'border-gray-200')).join('') || '<p class="text-xs text-gray-400 font-bold text-center mt-4">Nenhuma previsão de gastos futuros.</p>';
}

// ---------------------------------------------
// 3. O GERADOR AUTOMÁTICO DE PARCELAS
// ---------------------------------------------
function abrirModalDivida() { 
    document.getElementById('modal-divida').classList.remove('hidden'); 
}

function fecharModalDivida() { 
    document.getElementById('modal-divida').classList.add('hidden'); 
}

async function salvarNovaDivida() {
    const desc = document.getElementById('div-desc').value.trim();
    const valorTotal = parseFloat(document.getElementById('div-valor').value);
    const parcelas = parseInt(document.getElementById('div-parcelas').value);
    const dataBase = document.getElementById('div-data').value;

    if(!desc || !valorTotal || !dataBase || isNaN(parcelas) || parcelas < 1) {
        return alert("Preencha corretamente a Descrição, Valor Total, Parcelas e Data Inicial.");
    }

    const btn = document.getElementById('btn-salvar-divida');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculando...';
    
    // Calcula o valor de cada fatia da dívida
    const valorParcela = valorTotal / parcelas;
    const parcelasParaOBanco = [];

    // O Loop de Fatiamento Temporal
    for(let i = 0; i < parcelas; i++) {
        const dataParc = new Date(dataBase + 'T12:00:00Z');
        
        // A Mágica do JS: se for Dezembro (mês 11) e somar 1, ele vira Janeiro do ano seguinte sozinho.
        dataParc.setMonth(dataParc.getMonth() + i);
        
        const stringData = dataParc.toISOString().split('T')[0];
        
        // Se for só 1 parcela, não coloca "(1/1)" no nome. Se for mais, ele enumera.
        const nomeFinal = parcelas > 1 ? `${desc} (${i+1}/${parcelas})` : desc;

        parcelasParaOBanco.push({
            usuario_id: usuarioLogado.id, 
            descricao: nomeFinal, 
            valor: valorParcela, 
            data_vencimento: stringData,
            status: 'Pendente'
        });
    }
    
    try {
        // Envio em Lote (Batch Insert) para o Supabase
        const { error } = await supabaseClient.from('dividas').insert(parcelasParaOBanco);
        
        if (error) throw error;
        
        // Limpa o formulário e recarrega
        document.getElementById('div-desc').value = '';
        document.getElementById('div-valor').value = '';
        document.getElementById('div-parcelas').value = '1';
        
        fecharModalDivida();
        await carregarDadosDoBanco(); // O Kanban será redesenhado com as parcelas novas!

    } catch(e) {
        alert("Erro ao salvar dívida na nuvem: " + e.message);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-layer-group"></i> Gerar Parcelas';
    }
}
