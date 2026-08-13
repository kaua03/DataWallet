// ==========================================
// movimentacoes.js - MOTOR DE INÍCIO, CRUD E NLP SEMÂNTICO (UNIFICADO)
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    // Ouve o Enter no novo campo de input rápido
    const inputRapido = document.getElementById('input-rapido');
    if (inputRapido) {
        inputRapido.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') processarFrase();
        });
    }

    document.getElementById('transacao-data').value = new Date().toISOString().split('T')[0];
    await carregarDadosDoBanco();
});

// ==========================================
// FORMATAÇÃO E MÁSCARAS
// ==========================================
function aplicarMascaraMoeda(input) {
    let valor = input.value.replace(/\D/g, ''); 
    if (valor === '') { input.value = ''; return; }
    valor = (parseInt(valor) / 100).toFixed(2) + '';
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    valor = valor.replace(/(\d)(\d{3}),/g, "$1.$2,");
    input.value = valor;
}

function desmascararMoeda(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

// ==========================================
// NÚCLEO DE DADOS
// ==========================================
async function carregarDadosDoBanco() {
    try {
        const [resTrans, resCat] = await Promise.all([
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id).order('data_vencimento', { ascending: false }).order('id', { ascending: false }),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id).order('nome', { ascending: true })
        ]);

        // TRAVA DE SEGURANÇA: Bloqueia Dívidas futuras de vazarem para o saldo real
        transacoesGlobais = (resTrans.data || []).filter(t => {
            if (t.tipo === 'despesa' && t.pago === false) return false; 
            return true; 
        });

        categoriasGlobais = resCat.data || [];

        const selectCat = document.getElementById('transacao-categoria');
        selectCat.innerHTML = '<option value="" disabled selected>Selecione a Pasta...</option>' + 
            categoriasGlobais.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

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

    // Atualiza os KPIs do novo layout
    document.getElementById('saldo-disponivel').innerText = formatarMoeda(saldo);
    document.getElementById('entradas-mes').innerText = formatarMoeda(entradas);
    document.getElementById('saidas-mes').innerText = formatarMoeda(saidas);

    const htmlLista = transacoesGlobais.map(t => {
        const cat = categoriasGlobais.find(c => c.id === t.categoria_id) || { nome: 'Outros', icone: 'fa-tag', cor: 'text-gray-500' };
        
        const isReceita = t.tipo === 'receita';
        const corBg = isReceita ? 'bg-emerald-50' : 'bg-rose-50';
        const corTxt = isReceita ? 'text-emerald-500' : 'text-rose-500';
        const corValor = isReceita ? 'text-emerald-600' : 'text-rose-600';
        const sinal = isReceita ? '+' : '-';
        const iconeSinal = isReceita ? 'fa-arrow-up' : 'fa-arrow-down';
        
        let dataStr = t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : '--/--/----';
        let horaStr = '--:--';
        if (t.criado_em) {
            const dataObj = new Date(t.criado_em);
            horaStr = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' });
        }

        return `
        <div class="bg-white p-4 rounded-3xl border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:shadow-md transition-all flex items-center justify-between gap-4 group">
            <div class="flex items-center gap-4 min-w-0">
                <div class="w-12 h-12 rounded-2xl ${corBg} flex items-center justify-center ${corTxt} text-xl shadow-inner shrink-0 relative">
                    <i class="fa-solid ${cat.icone}"></i>
                    <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${corBg} border border-white flex items-center justify-center">
                        <i class="fa-solid ${iconeSinal} text-[8px] ${corTxt}"></i>
                    </div>
                </div>
                
                <div class="min-w-0">
                    <h4 class="font-bold text-sm text-slate-900 truncate">${t.descricao}</h4>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate mt-0.5">
                        ${cat.nome} • <i class="fa-regular fa-calendar ml-1"></i> ${dataStr} <i class="fa-regular fa-clock ml-1"></i> ${horaStr}
                    </p>
                </div>
            </div>

            <div class="flex items-center gap-4 shrink-0">
                <span class="font-black text-sm md:text-base ${corValor} whitespace-nowrap">${sinal} ${formatarMoeda(t.valor)}</span>
                
                <div class="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="abrirModalEdicao(${t.id})" class="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-500 hover:text-white transition flex items-center justify-center border border-slate-200"><i class="fa-solid fa-pen text-[10px]"></i></button>
                    <button onclick="excluirTransacao(${t.id})" class="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white transition flex items-center justify-center border border-slate-200"><i class="fa-solid fa-trash text-[10px]"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');

    document.getElementById('lista-transacoes').innerHTML = htmlLista || `
        <div class="bg-white rounded-3xl p-10 text-center border border-slate-200/60 shadow-sm">
            <i class="fa-solid fa-receipt text-4xl text-slate-300 mb-3"></i>
            <p class="text-sm font-bold text-slate-400">Nenhuma transação efetivada.</p>
        </div>
    `;
}

// ---------------------------------------------
// O CÉREBRO NLP DE INTELIGÊNCIA ARTIFICIAL
// ---------------------------------------------
const dicionarioDeInteligencia = [
    { pasta: 'alimentação', regras: [
        { titulo: 'Delivery', palavras: ['ifood', 'delivery', 'rappi', 'zedelivery'] },
        { titulo: 'Fast Food', palavras: ['pizza', 'hamburguer', 'lanche', 'mcdonalds', 'bk', 'coxinha', 'salgado', 'pastel'] },
        { titulo: 'Mercado', palavras: ['mercado', 'supermercado', 'açougue', 'padaria', 'compra'] },
        { titulo: 'Restaurante', palavras: ['restaurante', 'almoço', 'jantar', 'comida', 'self service'] }
    ]},
    { pasta: 'veículo', regras: [
        { titulo: 'Combustível', palavras: ['gasolina', 'álcool', 'alcool', 'etanol', 'diesel', 'posto', 'combustível', 'combustivel'] },
        { titulo: 'Peças / Manutenção', palavras: ['oficina', 'mecânico', 'peça', 'pneu', 'óleo', 'revisão'] },
        { titulo: 'Serviços Auto', palavras: ['estacionamento', 'pedágio', 'lavagem', 'lava rápido'] },
        { titulo: 'Transporte', palavras: ['uber', '99', 'ônibus', 'passagem', 'metrô'] }
    ]},
    { pasta: 'moradia', regras: [
        { titulo: 'Aluguel', palavras: ['aluguel', 'condomínio'] },
        { titulo: 'Conta de Luz', palavras: ['luz', 'energia', 'cpfl', 'cemig', 'enel'] },
        { titulo: 'Conta de Água', palavras: ['água', 'sabesp', 'sanepar', 'copasa'] },
        { titulo: 'Internet', palavras: ['internet', 'vivo', 'claro', 'tim', 'fibra'] },
        { titulo: 'Reparos e Casa', palavras: ['reparo', 'faxina', 'limpeza', 'material de construção'] }
    ]},
    { pasta: 'estudo', regras: [
        { titulo: 'Mensalidade', palavras: ['faculdade', 'escola', 'mensalidade'] },
        { titulo: 'Cursos Extras', palavras: ['curso', 'certificado', 'prova', 'concurso'] },
        { titulo: 'Material Didático', palavras: ['livro', 'caderno', 'material', 'papelaria'] }
    ]},
    { pasta: 'saúde', regras: [
        { titulo: 'Remédios', palavras: ['farmácia', 'remédio', 'medicamento'] },
        { titulo: 'Consultas Médicas', palavras: ['médico', 'consulta', 'exame', 'dentista', 'terapia', 'psicólogo'] },
        { titulo: 'Imprevisto', palavras: ['imprevisto', 'acidente', 'pronto socorro', 'hospital'] }
    ]},
    { pasta: 'lazer', regras: [
        { titulo: 'Jogos', palavras: ['jogo', 'steam', 'xbox', 'playstation', 'game'] },
        { titulo: 'Passeio', palavras: ['cinema', 'festa', 'shopping', 'bar', 'show', 'viagem', 'ingresso'] },
        { titulo: 'Compras Pessoais', palavras: ['roupa', 'presente', 'tênis', 'perfume', 'fone', 'celular'] }
    ]},
    { pasta: 'assinaturas', regras: [
        { titulo: 'Streaming', palavras: ['netflix', 'spotify', 'amazon', 'prime', 'disney', 'hbo'] },
        { titulo: 'Serviços Recorrentes', palavras: ['assinatura', 'gympass', 'academia'] }
    ]}
];

function inferirCategoriaETitulo(texto, isReceita) {
    texto = texto.toLowerCase();

    if (isReceita) {
        const catRenda = categoriasGlobais.find(c => c.nome.toLowerCase().includes('renda') || c.nome.toLowerCase().includes('salário'));
        return { categoria: catRenda, titulo: texto.includes('salário') || texto.includes('salario') ? 'Salário' : 'Recebimento' };
    }

    for (const d of dicionarioDeInteligencia) {
        for (const regra of d.regras) {
            if (regra.palavras.some(palavra => texto.includes(palavra))) {
                let busca = d.pasta === 'saúde' ? 'imprevistos' : d.pasta;
                const catDb = categoriasGlobais.find(c => c.nome.toLowerCase().includes(busca));
                return { categoria: catDb, titulo: regra.titulo };
            }
        }
    }

    let palavras = texto.split(' ');
    const palavrasInuteis = ['comprei', 'gastei', 'paguei', 'botei', 'coloquei', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'no', 'na', 'para', 'com', 'novo', 'nova'];
    while (palavras.length > 0 && palavrasInuteis.includes(palavras[0])) palavras.shift(); 

    let descLimpa = palavras.length > 0 ? palavras[0] : 'Registro';
    descLimpa = descLimpa.charAt(0).toUpperCase() + descLimpa.slice(1);

    const catFallback = categoriasGlobais.find(c => c.nome.toLowerCase().includes('lazer'));
    return { categoria: catFallback, titulo: descLimpa };
}

// ---------------------------------------------
// CONTROLE DO MODAL DE EDIÇÃO E CADASTRO
// ---------------------------------------------

// Expõe a função para o HTML chamar no botão "Registrar"
window.abrirModalComTextoRapido = function() { processarFrase(); };

function processarFrase() {
    const input = document.getElementById('input-rapido').value;
    
    // Se o usuário clicar sem digitar nada, abre o modal vazio padrão
    if(!input) {
        document.getElementById('form-transacao').reset();
        document.getElementById('transacao-id').value = '';
        document.getElementById('transacao-data').value = new Date().toISOString().split('T')[0];
        document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-money-bill-transfer text-indigo-500"></i> Lançar Valor Real`;
        document.getElementById('modal-transacao').classList.remove('hidden');
        return;
    }
    
    const textoLower = input.toLowerCase();
    const nums = textoLower.match(/\d+(?:[.,]\d+)?/g);
    const val = nums ? Math.max(...nums.map(n => parseFloat(n.replace(',', '.')))) : 0;
    
    const palavrasReceita = ['recebi', 'ganhei', 'pix', 'salário', 'salario', 'renda', 'vendi', 'depósito'];
    const isReceita = palavrasReceita.some(p => textoLower.includes(p));

    const inferencia = inferirCategoriaETitulo(textoLower, isReceita);

    document.getElementById('transacao-id').value = ''; 
    document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-indigo-600"></i> ${isReceita ? 'Registrar Entrada' : 'Registrar Saída'}`;
    
    document.getElementById('transacao-desc').value = inferencia.titulo;
    
    // Aplica a máscara no número gerado pela IA
    if(val > 0) {
        let valorStr = val.toFixed(2).replace('.', ',');
        valorStr = valorStr.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
        valorStr = valorStr.replace(/(\d)(\d{3}),/g, "$1.$2,");
        document.getElementById('transacao-valor').value = valorStr;
    } else {
        document.getElementById('transacao-valor').value = '';
    }

    document.getElementById('transacao-data').value = new Date().toISOString().split('T')[0];
    
    if (inferencia.categoria) document.getElementById('transacao-categoria').value = inferencia.categoria.id;

    document.querySelector(`input[name="tipo"][value="${isReceita ? 'receita' : 'despesa'}"]`).checked = true;

    document.getElementById('modal-transacao').classList.remove('hidden');
}

function abrirModalEdicao(id) {
    const t = transacoesGlobais.find(x => x.id === id);
    if(!t) return;

    document.getElementById('transacao-id').value = t.id;
    document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-indigo-600"></i> Editar Lançamento`;
    document.getElementById('transacao-desc').value = t.descricao;

    let valorStr = t.valor.toFixed(2).replace('.', ',');
    valorStr = valorStr.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    valorStr = valorStr.replace(/(\d)(\d{3}),/g, "$1.$2,");
    document.getElementById('transacao-valor').value = valorStr;

    document.getElementById('transacao-data').value = t.data_vencimento;
    document.getElementById('transacao-categoria').value = t.categoria_id;

    document.querySelector(`input[name="tipo"][value="${t.tipo}"]`).checked = true;

    document.getElementById('modal-transacao').classList.remove('hidden');
}

function fecharModal() { document.getElementById('modal-transacao').classList.add('hidden'); }

async function salvarTransacao(event) {
    event.preventDefault();
    const id = document.getElementById('transacao-id').value;
    const desc = document.getElementById('transacao-desc').value.trim();
    const val = desmascararMoeda(document.getElementById('transacao-valor').value);
    const dataV = document.getElementById('transacao-data').value;
    const catId = parseInt(document.getElementById('transacao-categoria').value);
    const tipo = document.querySelector('input[name="tipo"]:checked').value;

    if(!desc || isNaN(val) || val <= 0 || !dataV) return alert("Preencha Descrição, Valor e Data corretamente.");

    const payload = {
        usuario_id: usuarioLogado.id,
        descricao: desc,
        valor: val,
        data_vencimento: dataV,
        categoria_id: catId,
        tipo: tipo,
        pago: true // TRAVA: TUDO LANÇADO AQUI ESTÁ EFETIVADO (CAIXA REAL)
    };

    const btn = document.getElementById('btn-salvar-transacao');
    const conteudoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        if (id) {
            await supabaseClient.from('transacoes').update(payload).eq('id', id).eq('usuario_id', usuarioLogado.id);
        } else {
            await supabaseClient.from('transacoes').insert([payload]);
        }
        await carregarDadosDoBanco();
        fecharModal();
        document.getElementById('input-rapido').value = '';
    } catch(e) { 
        alert("Erro ao gravar: " + e.message); 
    } finally { 
        btn.innerHTML = conteudoOriginal; 
        btn.disabled = false;
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
    if (!SpeechRecognition) return alert("Seu navegador não suporta microfone nativo. Use Chrome ou Safari atualizados.");
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    const btnMic = document.getElementById('btn-mic');
    const iconeAntigo = btnMic.innerHTML;
    
    btnMic.innerHTML = '<i class="fa-solid fa-microphone-lines fa-beat text-rose-500"></i>';

    recognition.onresult = (event) => {
        document.getElementById('input-rapido').value = event.results[0][0].transcript;
        processarFrase(); 
    };

    recognition.onerror = (e) => { 
        if (e.error === 'not-allowed') alert("Permissão negada pelo navegador.");
        btnMic.innerHTML = iconeAntigo; 
    };
    recognition.onend = () => { btnMic.innerHTML = iconeAntigo; };
    recognition.start();
}
