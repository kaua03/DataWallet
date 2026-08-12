// ==========================================
// movimentacoes.js - MOTOR DE INÍCIO, CRUD E NLP
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
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id).order('data_vencimento', { ascending: false }).order('id', { ascending: false }),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id)
        ]);

        transacoesGlobais = resTrans.data || [];
        categoriasGlobais = resCat.data || [];

        // Preenche o Select do Modal para a hora de editar/criar
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
                
                <!-- BOTÕES DE AÇÃO: Editar e Excluir -->
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
// MICROFONE BLINDADO
// ---------------------------------------------
function ativarMicrofone() {
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            return alert("Seu navegador não suporta microfone. Tente usar o Google Chrome ou Safari atualizado.");
        }
        
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

        recognition.onerror = (e) => {
            console.error("Erro no mic:", e);
            if (e.error === 'not-allowed') alert("Permissão do microfone negada. Autorize no cadeado ao lado da URL.");
            btnMic.innerHTML = iconeAntigo;
        };

        recognition.onend = () => {
            btnMic.innerHTML = iconeAntigo;
        };

        recognition.start();
    } catch (err) {
        alert("Falha ao iniciar o microfone.");
    }
}

// ---------------------------------------------
// O CÉREBRO NLP EXPANDIDO
// ---------------------------------------------
function inferirCategoria(texto, isReceita) {
    texto = texto.toLowerCase();

    if (isReceita) {
        const catRenda = categoriasGlobais.find(c => c.nome.toLowerCase().includes('renda') || c.nome.toLowerCase().includes('salário'));
        return catRenda ? catRenda : null;
    }

    const dicionario = {
        'alimentação': ['ifood', 'mercado', 'comida', 'lanche', 'pizza', 'padaria', 'restaurante', 'hamburguer', 'supermercado', 'açougue', 'coxinha'],
        'veículo': ['uber', 'gasolina', 'posto', 'carro', 'moto', 'oficina', 'estacionamento', 'passagem', 'ônibus', 'pedágio', 'mecânico', 'combustível', 'combustivel', 'álcool', 'alcool', 'etanol', 'diesel', 'pneu'],
        'moradia': ['aluguel', 'luz', 'água', 'internet', 'casa', 'condomínio', 'reparo', 'energia', 'iptu', 'faxina', 'limpeza'],
        'estudo': ['faculdade', 'curso', 'livro', 'escola', 'certificado', 'prova', 'material', 'aula', 'mensalidade'],
        'saúde': ['farmácia', 'remédio', 'médico', 'hospital', 'consulta', 'dentista', 'imprevisto', 'exame', 'terapia', 'psicólogo'],
        'lazer': ['jogo', 'cinema', 'festa', 'roupa', 'shopping', 'bar', 'presente', 'viagem', 'ingresso', 'steam', 'xbox', 'playstation', 'sorvete', 'show'],
        'assinaturas': ['netflix', 'spotify', 'amazon', 'prime', 'assinatura', 'gympass', 'academia']
    };

    for (const [chaveCat, palavras] of Object.entries(dicionario)) {
        if (palavras.some(palavra => texto.includes(palavra))) {
            const catEncontrada = categoriasGlobais.find(c => c.nome.toLowerCase().includes(chaveCat));
            if (catEncontrada) return catEncontrada;
        }
    }

    const catFallback = categoriasGlobais.find(c => c.nome.toLowerCase().includes('lazer'));
    return catFallback ? catFallback : null;
}

// ---------------------------------------------
// LÓGICA DO MODAL (Criar e Editar)
// ---------------------------------------------
function atualizarCoresTipoModal() {
    const isReceita = document.querySelector('input[name="modal-tipo"][value="receita"]').checked;
    const btnDespesa = document.getElementById('btn-tipo-despesa');
    const btnReceita = document.getElementById('btn-tipo-receita');

    if (isReceita) {
        btnReceita.classList.replace('text-gray-500', 'text-green-600');
        btnReceita.classList.replace('border-gray-200', 'border-green-600');
        btnDespesa.classList.replace('text-red-600', 'text-gray-500');
        btnDespesa.classList.replace('border-red-600', 'border-gray-200');
    } else {
        btnDespesa.classList.replace('text-gray-500', 'text-red-600');
        btnDespesa.classList.replace('border-gray-200', 'border-red-600');
        btnReceita.classList.replace('text-green-600', 'text-gray-500');
        btnReceita.classList.replace('border-green-600', 'border-gray-200');
    }
}

// NOVA TRANSAÇÃO
function processarFrase() {
    const input = document.getElementById('input-magico').value;
    if(!input) return alert("Digite algo para registrar.");
    
    const textoLower = input.toLowerCase();
    const nums = textoLower.match(/\d+(?:[.,]\d+)?/g);
    const val = nums ? Math.max(...nums.map(n => parseFloat(n.replace(',', '.')))) : 0;
    
    const palavrasReceita = ['recebi', 'ganhei', 'pix', 'salário', 'salario', 'renda', 'vendi', 'depósito'];
    const isReceita = palavrasReceita.some(p => textoLower.includes(p));

    const categoriaDetectada = inferirCategoria(textoLower, isReceita);

    let descLimpa = input.split(' ')[0] || 'Registro';
    if (['comprei', 'gastei', 'paguei', 'recebi', 'botei', 'coloquei'].includes(descLimpa.toLowerCase()) && input.split(' ').length > 1) {
        descLimpa = input.split(' ')[1];
    }
    const tituloOficial = descLimpa.charAt(0).toUpperCase() + descLimpa.slice(1);

    document.getElementById('modal-id').value = ''; 
    document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-blue-600"></i> ${isReceita ? 'Registrar Entrada' : 'Registrar Saída'}`;
    document.getElementById('modal-desc').value = tituloOficial;
    document.getElementById('modal-valor').value = val;
    document.getElementById('modal-data').value = new Date().toISOString().split('T')[0];
    
    if (categoriaDetectada) document.getElementById('modal-cat').value = categoriaDetectada.id;

    document.querySelector(`input[name="modal-tipo"][value="${isReceita ? 'receita' : 'despesa'}"]`).checked = true;
    atualizarCoresTipoModal();

    // ID CORRETO: modal-transacao
    document.getElementById('modal-transacao').classList.remove('hidden');
}

// EDIÇÃO DE TRANSAÇÃO
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

    // ID CORRETO: modal-transacao
    document.getElementById('modal-transacao').classList.remove('hidden');
}

function fecharModal() { 
    // ID CORRETO: modal-transacao
    document.getElementById('modal-transacao').classList.add('hidden'); 
}

// SALVAR (Insert ou Update)
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

// EXCLUIR
async function excluirTransacao(id) {
    if(!confirm("Tem certeza que deseja excluir este lançamento?")) return;

    try {
        const { error } = await supabaseClient.from('transacoes').delete().eq('id', id).eq('usuario_id', usuarioLogado.id);
        if (error) throw error;
        
        await carregarDadosDoBanco();
    } catch(e) {
        alert("Erro ao excluir: " + e.message);
    }
}
