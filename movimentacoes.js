// ==========================================
// movimentacoes.js - MOTOR DE FLUXO DE CAIXA E BUSCA INTELIGENTE
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let transacoesFiltradas = [];
let categoriasGlobais = [];

let isHistoricoExpandido = false; 

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    const inputRapido = document.getElementById('input-rapido');
    if (inputRapido) {
        inputRapido.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') processarFrase();
        });
    }

    const hoje = new Date();
    document.getElementById('input-mes').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('transacao-data').value = hoje.toISOString().split('T')[0];

    mudarTipoFiltroHistorico();
    await carregarDadosDoBanco();
});

// ==========================================
// UTILITÁRIOS
// ==========================================
function removerAcentos(texto) {
    if (!texto) return '';
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

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

        transacoesGlobais = (resTrans.data || []).filter(t => {
            if (t.tipo === 'despesa' && t.pago === false) return false; 
            return true; 
        });

        categoriasGlobais = resCat.data || [];

        const selectCat = document.getElementById('transacao-categoria');
        selectCat.innerHTML = '<option value="" disabled selected>Selecione a Pasta...</option>' + 
            categoriasGlobais.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

        atualizarTopCards();
        aplicarFiltrosHistorico(); 

    } catch (e) {
        console.error("Erro ao puxar dados:", e.message);
    }
}

function atualizarTopCards() {
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

    document.getElementById('saldo-disponivel').innerText = formatarMoeda(saldo);
    document.getElementById('entradas-mes').innerText = formatarMoeda(entradas);
    document.getElementById('saidas-mes').innerText = formatarMoeda(saidas);
}

// ==========================================
// HISTÓRICO COM PESQUISA E FILTROS (Com Lógica do Hoje)
// ==========================================
function mudarTipoFiltroHistorico() {
    const tipo = document.getElementById('filtro-periodo').value;
    document.getElementById('box-mes').classList.add('hidden');
    document.getElementById('box-personalizado').classList.add('hidden');

    if (tipo === 'por_mes') document.getElementById('box-mes').classList.remove('hidden');
    else if (tipo === 'personalizado') document.getElementById('box-personalizado').classList.remove('hidden');

    aplicarFiltrosHistorico();
}

function aplicarFiltrosHistorico() {
    isHistoricoExpandido = false; 

    const termoBusca = removerAcentos(document.getElementById('busca-historico').value);
    const tipoFiltro = document.getElementById('filtro-periodo').value;

    transacoesFiltradas = transacoesGlobais.filter(t => {
        let dataOk = true;
        if (t.data_vencimento) {
            const d = new Date(t.data_vencimento + 'T12:00:00Z');
            d.setHours(0,0,0,0);
            
            if (tipoFiltro === 'hoje') {
                // A REGRA DE OURO: "Hoje" engloba a semana inteira (Domingo a Sábado)
                const dataHoje = new Date();
                dataHoje.setHours(0,0,0,0);
                
                const inicioSemana = new Date(dataHoje);
                inicioSemana.setDate(dataHoje.getDate() - dataHoje.getDay()); // Volta pro Domingo
                
                const fimSemana = new Date(inicioSemana);
                fimSemana.setDate(inicioSemana.getDate() + 6); // Avança pro Sábado
                fimSemana.setHours(23, 59, 59, 999);
                
                dataOk = (d >= inicioSemana && d <= fimSemana);

            } else if (tipoFiltro === 'por_mes') {
                const val = document.getElementById('input-mes').value;
                if(val) {
                    const [anoF, mesF] = val.split('-');
                    dataOk = (d.getMonth() === (parseInt(mesF) - 1) && d.getFullYear() === parseInt(anoF));
                }
            } else if (tipoFiltro === 'personalizado') {
                const dIni = document.getElementById('input-data-inicio').value;
                const dFim = document.getElementById('input-data-fim').value;
                if (dIni) dataOk = dataOk && (d >= new Date(dIni + 'T12:00:00Z'));
                if (dFim) dataOk = dataOk && (d <= new Date(dFim + 'T12:00:00Z'));
            }
        }

        let buscaOk = true;
        if (termoBusca) {
            const catNome = removerAcentos(categoriasGlobais.find(c => c.id === t.categoria_id)?.nome || '');
            const desc = removerAcentos(t.descricao);
            const valorStr = t.valor.toString();
            buscaOk = desc.includes(termoBusca) || catNome.includes(termoBusca) || valorStr.includes(termoBusca);
        }

        return dataOk && buscaOk;
    });

    renderizarMiniKPIs();
    renderizarListaHistorico();
}

function renderizarMiniKPIs() {
    let qtdEntradas = 0, qtdSaidas = 0, somaEntradas = 0, somaSaidas = 0;

    transacoesFiltradas.forEach(t => {
        if(t.tipo === 'receita') { qtdEntradas++; somaEntradas += t.valor; }
        else { qtdSaidas++; somaSaidas += t.valor; }
    });

    const balanco = somaEntradas - somaSaidas;
    const corBalanco = balanco >= 0 ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-rose-100 text-rose-700 border-rose-200';
    const sinalBalanco = balanco >= 0 ? '+' : '-';

    document.getElementById('mini-kpis-historico').innerHTML = `
        <span class="bg-emerald-100 text-emerald-700 text-[10px] px-2.5 py-1.5 rounded-lg font-black shadow-sm flex items-center gap-1.5 border border-emerald-200" title="Total financeiro de entradas neste filtro">
            <i class="fa-solid fa-arrow-trend-up"></i> ${qtdEntradas} Entradas • ${formatarMoeda(somaEntradas)}
        </span>
        <span class="bg-rose-100 text-rose-700 text-[10px] px-2.5 py-1.5 rounded-lg font-black shadow-sm flex items-center gap-1.5 border border-rose-200" title="Total financeiro de saídas neste filtro">
            <i class="fa-solid fa-arrow-trend-down"></i> ${qtdSaidas} Saídas • ${formatarMoeda(somaSaidas)}
        </span>
        <span class="${corBalanco} text-[10px] px-2.5 py-1.5 rounded-lg font-black shadow-sm flex items-center gap-1.5 border" title="Seu fluxo de caixa final neste filtro">
            Fluxo: ${sinalBalanco} ${formatarMoeda(Math.abs(balanco))}
        </span>
    `;
}

// ---------------------------------------------
// O MOTOR DE SANFONA
// ---------------------------------------------
function toggleExpandirHistorico() {
    isHistoricoExpandido = !isHistoricoExpandido;
    renderizarListaHistorico();
}

function renderizarListaHistorico() {
    const container = document.getElementById('lista-transacoes');
    const btnToggle = document.getElementById('btn-toggle-historico');
    
    if (transacoesFiltradas.length === 0) {
        container.innerHTML = `<div class="bg-slate-50 rounded-2xl p-8 text-center border border-slate-200 border-dashed"><i class="fa-solid fa-magnifying-glass text-2xl text-slate-300 mb-2"></i><p class="text-xs font-bold text-slate-400">Nenhum registro encontrado nesta visão.</p></div>`;
        btnToggle.classList.add('hidden');
        return;
    }

    const transacoesExibidas = isHistoricoExpandido ? transacoesFiltradas : transacoesFiltradas.slice(0, 5);

    const htmlLista = transacoesExibidas.map(t => {
        const cat = categoriasGlobais.find(c => c.id === t.categoria_id) || { nome: 'Outros', icone: 'fa-tag', cor: 'text-gray-500' };
        
        const isReceita = t.tipo === 'receita';
        const corBg = isReceita ? 'bg-emerald-50' : 'bg-rose-50';
        const corTxt = isReceita ? 'text-emerald-500' : 'text-rose-500';
        const corValor = isReceita ? 'text-emerald-600' : 'text-rose-600';
        const sinal = isReceita ? '+' : '-';
        const iconeSinal = isReceita ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
        
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
                        ${cat.nome} • <i class="fa-regular fa-calendar ml-1"></i> ${dataStr}
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

    container.innerHTML = htmlLista;

    if (transacoesFiltradas.length > 5) {
        btnToggle.classList.remove('hidden');
        if (isHistoricoExpandido) {
            btnToggle.innerHTML = '<i class="fa-solid fa-chevron-up"></i> Minimizar Lista';
        } else {
            const restante = transacoesFiltradas.length - 5;
            btnToggle.innerHTML = `<i class="fa-solid fa-chevron-down"></i> Mostrar mais ${restante} transações`;
        }
    } else {
        btnToggle.classList.add('hidden');
    }
}

// ---------------------------------------------
// O CÉREBRO NLP E CRUD
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

window.abrirModalComTextoRapido = function() { processarFrase(); };

function processarFrase() {
    const input = document.getElementById('input-rapido').value;
    
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
    
    if(val > 0) {
        let valorStr = val.toFixed(2).replace('.', ',');
        valorStr = valorStr.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
        valorStr = valorStr.replace(/(\d)(\d{3}),/g, "$1.$2,");
        document.getElementById('transacao-valor').value = valorStr;
    } else { document.getElementById('transacao-valor').value = ''; }

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
        usuario_id: usuarioLogado.id, descricao: desc, valor: val, data_vencimento: dataV, categoria_id: catId, tipo: tipo, pago: true
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
    if (!SpeechRecognition) return alert("Navegador não suporta microfone nativo.");
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    const btnMic = document.getElementById('btn-mic');
    const iconeAntigo = btnMic.innerHTML;
    
    btnMic.innerHTML = '<i class="fa-solid fa-microphone-lines fa-beat text-rose-500"></i>';

    recognition.onresult = (event) => {
        document.getElementById('input-rapido').value = event.results[0][0].transcript;
        processarFrase(); 
    };

    recognition.onerror = () => { btnMic.innerHTML = iconeAntigo; };
    recognition.onend = () => { btnMic.innerHTML = iconeAntigo; };
    recognition.start();
}
