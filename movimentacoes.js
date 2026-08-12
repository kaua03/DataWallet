// ==========================================
// movimentacoes.js - MOTOR DE INÍCIO E NLP SEMÂNTICO
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    await carregarDadosDoBanco();
});

async function carregarDadosDoBanco() {
    try {
        const [resTrans, resCat] = await Promise.all([
            // Traz as transações ordenadas da mais nova para a mais velha
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
    
    // Filtro de Mês Atual para os cards de cima
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();

    transacoesGlobais.forEach(t => {
        // O Saldo global da carteira conta TUDO
        if(t.tipo === 'receita') saldo += t.valor;
        else saldo -= t.valor;

        // Entradas e saídas dos Cards contam só o MÊS ATUAL
        if(t.data_vencimento) {
            const d = new Date(t.data_vencimento + 'T12:00:00Z');
            if(d.getMonth() === mesAtual && d.getFullYear() === anoAtual) {
                if(t.tipo === 'receita') entradas += t.valor;
                else saidas += t.valor;
            }
        }
    });

    document.getElementById('saldo-tela').innerText = formatarMoeda(saldo);
    document.getElementById('total-entradas').innerText = formatarMoeda(entradas);
    document.getElementById('total-saidas').innerText = formatarMoeda(saidas);

    // Constrói a lista de extrato visual
    const htmlLista = transacoesGlobais.map(t => {
        const cat = categoriasGlobais.find(c => c.id === t.categoria_id) || { nome: 'Outros', icone: 'fa-tag', cor: 'text-gray-500' };
        
        // Estética da transação
        const isReceita = t.tipo === 'receita';
        const corBg = isReceita ? 'bg-green-100' : 'bg-red-100';
        const corTxt = isReceita ? 'text-green-500' : 'text-red-500';
        const sinal = isReceita ? '+' : '-';
        
        // Data formatada de DD/MM/AAAA
        const dataFormatada = t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : '--/--/----';

        return `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
            <div class="flex items-center space-x-4">
                <div class="w-12 h-12 ${corBg} rounded-full flex items-center justify-center ${corTxt} text-xl shrink-0">
                    <i class="fa-solid ${cat.icone}"></i>
                </div>
                <div class="truncate pr-2">
                    <p class="text-gray-900 font-bold truncate">${t.descricao}</p>
                    <p class="text-gray-400 text-xs font-bold truncate">${cat.nome.split(' ')[0]} • ${dataFormatada}</p>
                </div>
            </div>
            <p class="${corTxt} font-black text-lg shrink-0">${sinal} ${formatarMoeda(t.valor)}</p>
        </div>`;
    }).join('');

    document.getElementById('lista-extrato').innerHTML = htmlLista || `
        <div class="text-center mt-10">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl text-gray-300 mx-auto mb-3"><i class="fa-solid fa-leaf"></i></div>
            <p class="text-sm font-bold text-gray-400">Nenhuma transação na sua carteira.</p>
        </div>
    `;
}

// ---------------------------------------------
// O CÉREBRO NLP (Categorização Semântica)
// ---------------------------------------------
let transacaoNLP = null;

// Dicionário de Inferência (Ensina o app a ler a mente do usuário)
function inferirCategoria(texto, isReceita) {
    texto = texto.toLowerCase();

    // 1. Regra de Ouro: Se for Receita, vai obrigatoriamente para Renda/Salário
    if (isReceita) {
        const catRenda = categoriasGlobais.find(c => c.nome.toLowerCase().includes('renda') || c.nome.toLowerCase().includes('salário'));
        return catRenda ? catRenda : null;
    }

    // 2. Dicionário de Correlação para Despesas
    const dicionario = {
        'alimentação': ['ifood', 'mercado', 'comida', 'lanche', 'pizza', 'padaria', 'restaurante', 'hamburguer', 'supermercado', 'açougue'],
        'veículo': ['uber', 'gasolina', 'posto', 'carro', 'moto', 'oficina', 'estacionamento', 'passagem', 'ônibus', 'pedágio', 'mecânico'],
        'moradia': ['aluguel', 'luz', 'água', 'internet', 'casa', 'condomínio', 'reparo', 'energia', 'iptu', 'faxina'],
        'estudo': ['faculdade', 'curso', 'livro', 'escola', 'certificado', 'prova', 'material', 'aula'],
        'saúde': ['farmácia', 'remédio', 'médico', 'hospital', 'consulta', 'dentista', 'imprevisto', 'exame', 'terapia'],
        'lazer': ['jogo', 'cinema', 'festa', 'roupa', 'shopping', 'bar', 'presente', 'viagem', 'ingresso', 'steam', 'xbox', 'playstation'],
        'assinaturas': ['netflix', 'spotify', 'amazon', 'prime', 'assinatura', 'mensalidade', 'gympass', 'academia']
    };

    // Varre o dicionário procurando se a palavra digitada bate com alguma chave
    for (const [chaveCat, palavras] of Object.entries(dicionario)) {
        if (palavras.some(palavra => texto.includes(palavra))) {
            // Se bater, procura a Categoria correspondente no Banco de Dados
            const catEncontrada = categoriasGlobais.find(c => c.nome.toLowerCase().includes(chaveCat));
            if (catEncontrada) return catEncontrada;
        }
    }

    // Fallback de Segurança: Se digitou algo estranho (Ex: "Comprei um abajur 50"), joga em Lazer/Pessoal
    const catFallback = categoriasGlobais.find(c => c.nome.toLowerCase().includes('lazer'));
    return catFallback ? catFallback : null;
}

function simularEnvioVoz() {
    const input = document.getElementById('input-magico').value;
    if(!input) return alert("Digite algo para registrar.");
    
    const textoLower = input.toLowerCase();
    
    // Extrai o número
    const nums = textoLower.match(/\d+(?:[.,]\d+)?/g);
    const val = nums ? Math.max(...nums.map(n => parseFloat(n.replace(',', '.')))) : 0;
    
    // Identifica sentimento
    const palavrasReceita = ['recebi', 'ganhei', 'pix', 'salário', 'salario', 'renda', 'vendi', 'depósito'];
    const isReceita = palavrasReceita.some(p => textoLower.includes(p));

    // A MÁGICA ACONTECE AQUI: Chama o motor de inferência
    const categoriaDetectada = inferirCategoria(textoLower, isReceita);

    // Formata a Descrição (Capitaliza a primeira letra do que sobrou)
    let descLimpa = input.split(' ')[0] || 'Registro';
    // Removemos conectores se eles forem a primeira palavra
    if (['comprei', 'gastei', 'paguei', 'recebi'].includes(descLimpa.toLowerCase()) && input.split(' ').length > 1) {
        descLimpa = input.split(' ')[1];
    }
    const tituloOficial = descLimpa.charAt(0).toUpperCase() + descLimpa.slice(1);

    // Monta o Objeto para o Banco
    transacaoNLP = {
        usuario_id: usuarioLogado.id, 
        valor: val,
        tipo: isReceita ? 'receita' : 'despesa',
        descricao: tituloOficial,
        data_vencimento: new Date().toISOString().split('T')[0],
        categoria_id: categoriaDetectada ? categoriaDetectada.id : null
    };

    // ---------------------------------------------
    // RENDERIZA O MODAL
    // ---------------------------------------------
    document.getElementById('modal-titulo').innerText = isReceita ? "Registrar Entrada?" : "Registrar Saída?";
    
    document.getElementById('conf-val').innerText = `${isReceita ? '+' : '-'} ${formatarMoeda(val)}`;
    document.getElementById('conf-val').className = `text-3xl font-black ${isReceita ? 'text-green-500' : 'text-red-500'}`;
    
    document.getElementById('modal-bg-efeito').className = `absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-2xl ${isReceita ? 'bg-green-500' : 'bg-red-500'}`;
    document.getElementById('conf-data').innerText = transacaoNLP.data_vencimento.split('-').reverse().join('/');
    
    // Badge da Categoria
    const badgeBg = isReceita ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    const badgeIcone = categoriaDetectada ? categoriaDetectada.icone : 'fa-tag';
    const badgeNome = categoriaDetectada ? categoriaDetectada.nome.split(' ')[0] : 'Outros'; // Pega só a primeira palavra para caber
    
    document.getElementById('conf-cat').className = `flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold ${badgeBg}`;
    document.getElementById('conf-cat').innerHTML = `<i class="fa-solid ${badgeIcone}"></i> ${badgeNome}`;
    
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
        
        await carregarDadosDoBanco(); // Recarrega os Cards do topo e a lista!
        
        fecharModal();
        document.getElementById('input-magico').value = '';
    } catch(e) { 
        alert("Erro ao gravar: " + e.message); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar'; 
    }
}
