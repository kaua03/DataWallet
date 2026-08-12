// ==========================================
// movimentacoes.js - MOTOR DE INÍCIO, CRUD E NLP SEMÂNTICO
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    // Adiciona escuta da tecla Enter no input
    document.getElementById('input-magico').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') processarFrase();
    });

    await carregarDadosDoBanco();
});

async function carregarDadosDoBanco() {
    try {
        const [resTrans, resCat] = await Promise.all([
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id).order('data_vencimento', { ascending: false }).order('id', { ascending: false }),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id)
        ]);

        transacoesGlobais = resTrans.data || [];
        categoriasGlobais = resCat.data || [];

        const selectCat = document.getElementById('modal-cat');
        selectCat.innerHTML = categoriasGlobais.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

        renderizarInterface();
    } catch (e) {
        console.error("Erro ao puxar dados:", e.message);
    }
}

function renderizarInterface() {
    let saldo = 0, entradas = 0, saidas = 0;
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();

    transacoesGlobais.forEach(t => {
        if(t.tipo === 'receita') saldo += t.valor;
        else saldo -= t.valor;

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

    const htmlLista = transacoesGlobais.map(t => {
        const cat = categoriasGlobais.find(c => c.id === t.categoria_id) || { nome: 'Outros', icone: 'fa-tag', cor: 'text-gray-500' };
        
        const isReceita = t.tipo === 'receita';
        const corBg = isReceita ? 'bg-green-100' : 'bg-red-100';
        const corTxt = isReceita ? 'text-green-500' : 'text-red-500';
        const sinal = isReceita ? '+' : '-';
        const dataFormatada = t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : '--/--/----';

        return `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between hover:shadow-md transition group gap-3 sm:gap-0">
            <div class="flex items-center space-x-4">
                <div class="w-12 h-12 ${corBg} rounded-full flex items-center justify-center ${corTxt} text-xl shrink-0">
                    <i class="fa-solid ${cat.icone}"></i>
                </div>
                <div class="truncate pr-2">
                    <p class="text-gray-900 font-bold truncate">${t.descricao}</p>
                    <p class="text-gray-400 text-xs font-bold truncate">${cat.nome.split(' ')[0]} • ${dataFormatada}</p>
                </div>
            </div>
            
            <div class="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pl-16 sm:pl-0">
                <p class="${corTxt} font-black text-lg shrink-0">${sinal} ${formatarMoeda(t.valor)}</p>
                
                <div class="flex gap-2">
                    <button onclick="abrirModalEdicao(${t.id})" class="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition flex items-center justify-center" title="Editar">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button onclick="excluirTransacao(${t.id})" class="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 transition flex items-center justify-center" title="Excluir">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
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
// O CÉREBRO NLP PADRONIZADOR
// ---------------------------------------------
// Esse banco de dados de IA cruza palavras com Títulos e Pastas
const dicionarioDeInteligencia = [
    { pasta: 'alimentação', regras: [
        { titulo: 'Delivery', palavras: ['ifood', 'delivery', 'rappi', 'zedelivery'] },
        { titulo: 'Fast Food', palavras: ['pizza', 'hamburguer', 'lanche', 'mcdonalds', 'bk', 'coxinha', 'salgado'] },
        { titulo: 'Mercado', palavras: ['mercado', 'supermercado', 'açougue', 'padaria', 'compra do mês'] },
        { titulo: 'Restaurante', palavras: ['restaurante', 'almoço', 'jantar', 'comida'] }
    ]},
    { pasta: 'veículo', regras: [
        { titulo: 'Combustível', palavras: ['gasolina', 'álcool', 'alcool', 'etanol', 'diesel', 'posto', 'combustível', 'combustivel'] },
        { titulo: 'Manutenção / Peças', palavras: ['oficina', 'mecânico', 'peça', 'pneu', 'óleo', 'revisão'] },
        { titulo: 'Serviços Auto', palavras: ['estacionamento', 'pedágio', 'lavagem', 'lava rápido'] },
        { titulo: 'Transporte', palavras: ['uber', '99', 'ônibus', 'passagem', 'metrô'] }
    ]},
    { pasta: 'moradia', regras: [
        { titulo: 'Aluguel', palavras: ['aluguel'] },
        { titulo: 'Conta de Luz', palavras: ['luz', 'energia', 'cpfl', 'cemig', 'enel'] },
        { titulo: 'Conta de Água', palavras: ['água', 'sabesp', 'sanepar', 'copasa'] },
        { titulo: 'Internet', palavras: ['internet', 'vivo', 'claro', 'tim', 'fibra'] },
        { titulo: 'Manutenção da Casa', palavras: ['reparo', 'faxina', 'limpeza', 'material de construção'] }
    ]},
    { pasta: 'estudo', regras: [
        { titulo: 'Mensalidade', palavras: ['faculdade', 'escola', 'mensalidade'] },
        { titulo: 'Cursos', palavras: ['curso', 'certificado', 'prova'] },
        { titulo: 'Material Didático', palavras: ['livro', 'caderno', 'material'] }
    ]},
    { pasta: 'saúde', regras: [
        { titulo: 'Remédios', palavras: ['farmácia', 'remédio', 'medicamento'] },
        { titulo: 'Consultas Médicas', palavras: ['médico', 'consulta', 'exame', 'dentista', 'terapia', 'psicólogo'] },
        { titulo: 'Imprevisto', palavras: ['imprevisto', 'acidente', 'pronto socorro'] }
    ]},
    { pasta: 'lazer', regras: [
        { titulo: 'Jogos', palavras: ['jogo', 'steam', 'xbox', 'playstation', 'game'] },
        { titulo: 'Passeio', palavras: ['cinema', 'festa', 'shopping', 'bar', 'show', 'viagem', 'ingresso'] },
        { titulo: 'Compras Pessoais', palavras: ['roupa', 'presente', 'tênis', 'perfume'] }
    ]},
    { pasta: 'assinaturas', regras: [
        { titulo: 'Streaming', palavras: ['netflix', 'spotify', 'amazon', 'prime', 'disney', 'hbo'] },
        { titulo: 'Serviços Recorrentes', palavras: ['assinatura', 'gympass', 'academia'] }
    ]}
];

// O Motor que processa e devolve a Pasta Exata e o Título Perfeito
function inferirCategoriaETitulo(texto, isReceita) {
    texto = texto.toLowerCase();

    if (isReceita) {
        const catRenda = categoriasGlobais.find(c => c.nome.toLowerCase().includes('renda'));
        return { 
            categoria: catRenda, 
            titulo: texto.includes('salário') || texto.includes('salario') ? 'Salário' : 'Recebimento' 
        };
    }

    // Varre o cérebro
    for (const d of dicionarioDeInteligencia) {
        for (const regra of d.regras) {
            if (regra.palavras.some(palavra => texto.includes(palavra))) {
                const catDb = categoriasGlobais.find(c => c.nome.toLowerCase().includes(d.pasta));
                return { categoria: catDb, titulo: regra.titulo };
            }
        }
    }

    // Se ele não entender o que a pessoa comprou, ele apenas limpa os verbos inúteis e joga pra "Lazer & Pessoal"
    let descLimpa = texto.split(' ')[0] || 'Registro';
    const arrTexto = texto.split(' ');
    if (['comprei', 'gastei', 'paguei', 'botei'].includes(descLimpa) && arrTexto.length > 1) {
        descLimpa = arrTexto[1];
    }
    descLimpa = descLimpa.charAt(0).toUpperCase() + descLimpa.slice(1);

    const catFallback = categoriasGlobais.find(c => c.nome.toLowerCase().includes('lazer'));
    return { categoria: catFallback, titulo: descLimpa };
}

// ---------------------------------------------
// CONTROLE DO MODAL DE EDIÇÃO E CADASTRO
// ---------------------------------------------
// ESSA FUNÇÃO RESOLVE O SUMIÇO DOS BOTÕES: Reescreve toda a classe CSS a cada clique
function atualizarCoresTipoModal() {
    const isReceita = document.querySelector('input[name="modal-tipo"][value="receita"]').checked;
    const btnDespesa = document.getElementById('btn-tipo-despesa');
    const btnReceita = document.getElementById('btn-tipo-receita');

    if (isReceita) {
        btnReceita.className = "border-2 border-green-500 bg-green-50 text-green-600 rounded-xl p-3 flex justify-center items-center gap-2 font-bold text-sm transition-all";
        btnDespesa.className = "border-2 border-gray-200 bg-gray-50 text-gray-400 rounded-xl p-3 flex justify-center items-center gap-2 font-bold text-sm transition-all hover:bg-gray-100";
    } else {
        btnDespesa.className = "border-2 border-red-500 bg-red-50 text-red-600 rounded-xl p-3 flex justify-center items-center gap-2 font-bold text-sm transition-all";
        btnReceita.className = "border-2 border-gray-200 bg-gray-50 text-gray-400 rounded-xl p-3 flex justify-center items-center gap-2 font-bold text-sm transition-all hover:bg-gray-100";
    }
}

function processarFrase() {
    const input = document.getElementById('input-magico').value;
    if(!input) return alert("Digite algo para registrar.");
    
    const textoLower = input.toLowerCase();
    const nums = textoLower.match(/\d+(?:[.,]\d+)?/g);
    const val = nums ? Math.max(...nums.map(n => parseFloat(n.replace(',', '.')))) : 0;
    
    const isReceita = ['recebi', 'ganhei', 'pix', 'salário', 'salario', 'renda', 'vendi', 'depósito'].some(p => textoLower.includes(p));

    // A MÁGICA: Extrai a Pasta e o Título Bonito ("Combustível" em vez de "gasolina")
    const inferencia = inferirCategoriaETitulo(textoLower, isReceita);

    document.getElementById('modal-id').value = ''; 
    document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-blue-600"></i> ${isReceita ? 'Registrar Entrada' : 'Registrar Saída'}`;
    
    // Injeta o Título Padronizado no Form
    document.getElementById('modal-desc').value = inferencia.titulo;
    document.getElementById('modal-valor').value = val;
    document.getElementById('modal-data').value = new Date().toISOString().split('T')[0];
    
    if (inferencia.categoria) document.getElementById('modal-cat').value = inferencia.categoria.id;

    document.querySelector(`input[name="modal-tipo"][value="${isReceita ? 'receita' : 'despesa'}"]`).checked = true;
    atualizarCoresTipoModal();

    document.getElementById('modal-transacao').classList.remove('hidden');
}

function abrirModalEdicao(id) {
    const t = transacoesGlobais.find(x => x.id === id);
    if(!t) return;

    document.getElementById('modal-id').value = t.id;
    document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-blue-600"></i> Editar Lançamento`;
    document.getElementById('modal-desc').value = t.descricao;
    document.getElementById('modal-valor').value = t.valor;
    document.getElementById('modal-data').value = t.data_vencimento;
    document.getElementById('modal-cat').value = t.categoria_id;

    document.querySelector(`input[name="modal-tipo"][value="${t.tipo}"]`).checked = true;
    atualizarCoresTipoModal();

    document.getElementById('modal-transacao').classList.remove('hidden');
}

function fecharModal() { 
    document.getElementById('modal-transacao').classList.add('hidden'); 
}

async function salvarTransacaoFinal() {
    const id = document.getElementById('modal-id').value;
    const desc = document.getElementById('modal-desc').value.trim();
    const val = parseFloat(document.getElementById('modal-valor').value);
    const dataV = document.getElementById('modal-data').value;
    const catId = parseInt(document.getElementById('modal-cat').value);
    const tipo = document.querySelector('input[name="modal-tipo"]:checked').value;

    if(!desc || isNaN(val) || val <= 0 || !dataV) return alert("Preencha Descrição, Valor e Data corretamente.");

    const payload = {
        usuario_id: usuarioLogado.id,
        descricao: desc,
        valor: val,
        data_vencimento: dataV,
        categoria_id: catId,
        tipo: tipo
    };

    const btn = document.getElementById('btn-salvar-modal');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    try {
        if (id) {
            const { error } = await supabaseClient.from('transacoes').update(payload).eq('id', id).eq('usuario_id', usuarioLogado.id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('transacoes').insert([payload]);
            if (error) throw error;
        }
        
        await carregarDadosDoBanco();
        fecharModal();
        document.getElementById('input-magico').value = '';
    } catch(e) { 
        alert("Erro ao gravar: " + e.message); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar'; 
    }
}

async function excluirTransacao(id) {
    if(!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    try {
        await supabaseClient.from('transacoes').delete().eq('id', id).eq('usuario_id', usuarioLogado.id);
        await carregarDadosDoBanco();
    } catch(e) { alert("Erro ao excluir: " + e.message); }
}

function ativarMicrofone() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Seu navegador/celular não suporta microfone nativo.");
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    const btnMic = document.getElementById('btn-mic');
    const iconeAntigo = btnMic.innerHTML;
    
    btnMic.innerHTML = '<i class="fa-solid fa-microphone-lines fa-beat text-red-500"></i>';

    recognition.onresult = (event) => {
        const transcricao = event.results[0][0].transcript;
        document.getElementById('input-magico').value = transcricao;
        processarFrase(); 
    };

    recognition.onerror = () => { btnMic.innerHTML = iconeAntigo; };
    recognition.onend = () => { btnMic.innerHTML = iconeAntigo; };

    recognition.start();
}
