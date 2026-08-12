// ==========================================
// movimentacoes.js - MOTOR DA ABA INÍCIO
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Roda a função global de segurança do config.js
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    await carregarDadosDoBanco();
});

async function carregarDadosDoBanco() {
    try {
        const [resTrans, resCat] = await Promise.all([
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id).order('id', { ascending: false }),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id)
        ]);

        transacoesGlobais = resTrans.data || [];
        categoriasGlobais = resCat.data || [];

        renderizarInterface();
    } catch (e) {
        console.error("Erro ao puxar dados:", e.message);
    }
}

function renderizarInterface() {
    let saldo = 0, entradas = 0, saidas = 0;
    
    transacoesGlobais.forEach(t => {
        if(t.tipo === 'receita') { entradas += t.valor; saldo += t.valor; }
        else { saidas += t.valor; saldo -= t.valor; }
    });

    document.getElementById('saldo-tela').innerText = formatarMoeda(saldo);
    document.getElementById('total-entradas').innerText = formatarMoeda(entradas);
    document.getElementById('total-saidas').innerText = formatarMoeda(saidas);

    const htmlLista = transacoesGlobais.map(t => {
        const cat = categoriasGlobais.find(c => c.id === t.categoria_id) || { nome: 'Geral', icone: 'fa-tag' };
        const corBg = t.tipo === 'despesa' ? 'bg-red-100' : 'bg-green-100';
        const corTxt = t.tipo === 'despesa' ? 'text-red-500' : 'text-green-500';
        const sinal = t.tipo === 'despesa' ? '-' : '+';
        const dataFormatada = t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : 'S/ Data';

        return `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
            <div class="flex items-center space-x-4">
                <div class="w-12 h-12 ${corBg} rounded-full flex items-center justify-center ${corTxt} text-xl"><i class="fa-solid ${cat.icone}"></i></div>
                <div><p class="text-gray-900 font-bold">${t.descricao}</p><p class="text-gray-400 text-xs font-bold">${cat.nome} • ${dataFormatada}</p></div>
            </div>
            <p class="${corTxt} font-black text-lg">${sinal} ${formatarMoeda(t.valor)}</p>
        </div>`;
    }).join('');

    document.getElementById('lista-extrato').innerHTML = htmlLista || '<p class="text-center text-gray-400 py-6">Você ainda não registrou nenhuma transação.</p>';
}

let transacaoNLP = null;

function simularEnvioVoz() {
    const input = document.getElementById('input-magico').value.toLowerCase();
    if(!input) return alert("Digite algo para registrar.");
    
    const nums = input.match(/\d+(?:[.,]\d+)?/g);
    const val = nums ? Math.max(...nums.map(n => parseFloat(n.replace(',', '.')))) : 0;
    const isReceita = ['recebi', 'ganhei', 'pix', 'salário', 'salario'].some(p => input.includes(p));

    const desc = document.getElementById('input-magico').value.split(' ')[0] || 'Registro';
    const tituloOficial = desc.charAt(0).toUpperCase() + desc.slice(1);

    transacaoNLP = {
        usuario_id: usuarioLogado.id, 
        valor: val,
        tipo: isReceita ? 'receita' : 'despesa',
        descricao: tituloOficial,
        data_vencimento: new Date().toISOString().split('T')[0],
        categoria_id: categoriasGlobais.length > 0 ? categoriasGlobais[0].id : null
    };

    document.getElementById('modal-titulo').innerText = isReceita ? "Registrar Entrada?" : "Registrar Saída?";
    document.getElementById('conf-val').innerText = `${isReceita ? '+' : '-'} ${formatarMoeda(val)}`;
    document.getElementById('conf-val').className = `text-3xl font-black ${isReceita ? 'text-green-500' : 'text-red-500'}`;
    document.getElementById('modal-bg-efeito').className = `absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-2xl ${isReceita ? 'bg-green-500' : 'bg-red-500'}`;
    document.getElementById('conf-data').innerText = transacaoNLP.data_vencimento.split('-').reverse().join('/');
    
    document.getElementById('modal-confirmacao').classList.remove('hidden');
}

function fecharModal() { document.getElementById('modal-confirmacao').classList.add('hidden'); }

async function confirmarSalvamentoNLP() {
    if(!transacaoNLP || !usuarioLogado) return;
    
    const btn = document.getElementById('btn-salvar-modal');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        const { error } = await supabaseClient.from('transacoes').insert([transacaoNLP]);
        if (error) throw error;
        
        await carregarDadosDoBanco();
        
        fecharModal();
        document.getElementById('input-magico').value = '';
    } catch(e) { 
        alert("Erro ao gravar: " + e.message); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar'; 
    }
}
