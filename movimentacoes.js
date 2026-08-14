// ==========================================
// movimentacoes.js - MOTOR DE FLUXO DE CAIXA COM LOTTIE FLUTUANTE
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let transacoesFiltradas = [];
let categoriasGlobais = [];

let isHistoricoExpandido = false; 
let reconhecimentoDeVoz = null; 

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    const inputRapido = document.getElementById('input-rapido');
    if (inputRapido) {
        inputRapido.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') processarFraseNLP(this.value);
        });
    }

    const hoje = new Date();
    document.getElementById('input-mes').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('transacao-data').value = hoje.toISOString().split('T')[0];

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

window.aplicarMascaraMoeda = aplicarMascaraMoeda;

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
        window.mudarTipoFiltroHistorico(); 

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
// HISTÓRICO COM PESQUISA E FILTROS 
// ==========================================
window.mudarTipoFiltroHistorico = function() {
    const tipo = document.getElementById('filtro-periodo').value;
    document.getElementById('box-mes').classList.add('hidden');
    document.getElementById('box-personalizado').classList.add('hidden');

    if (tipo === 'por_mes') document.getElementById('box-mes').classList.remove('hidden');
    else if (tipo === 'personalizado') document.getElementById('box-personalizado').classList.remove('hidden');

    window.aplicarFiltrosHistorico();
};

window.aplicarFiltrosHistorico = function() {
    isHistoricoExpandido = false; 

    const termoBusca = removerAcentos(document.getElementById('busca-historico').value);
    const tipoFiltro = document.getElementById('filtro-periodo').value;

    transacoesFiltradas = transacoesGlobais.filter(t => {
        let dataOk = true;
        if (t.data_vencimento) {
            const dStr = t.data_vencimento; 
            
            if (tipoFiltro === 'essa_semana') {
                const d = new Date(t.data_vencimento + 'T12:00:00Z');
                d.setHours(0,0,0,0);
                const dataHoje = new Date();
                dataHoje.setHours(0,0,0,0);
                
                const inicioSemana = new Date(dataHoje);
                inicioSemana.setDate(dataHoje.getDate() - dataHoje.getDay()); 
                
                const fimSemana = new Date(inicioSemana);
                fimSemana.setDate(inicioSemana.getDate() + 6); 
                fimSemana.setHours(23, 59, 59, 999);
                
                dataOk = (d >= inicioSemana && d <= fimSemana);

            } else if (tipoFiltro === 'por_mes') {
                const val = document.getElementById('input-mes').value; 
                if(val) dataOk = dStr.startsWith(val);
            } else if (tipoFiltro === 'personalizado') {
                const dIni = document.getElementById('input-data-inicio').value;
                const dFim = document.getElementById('input-data-fim').value;
                if (dIni) dataOk = dataOk && (dStr >= dIni);
                if (dFim) dataOk = dataOk && (dStr <= dFim);
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
};

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
        <span class="bg-emerald-100 text-emerald-700 text-[10px] px-2.5 py-1.5 rounded-lg font-black shadow-sm flex items-center gap-1.5 border border-emerald-200" title="Total financeiro de entradas">
            <i class="fa-solid fa-arrow-trend-up"></i> ${qtdEntradas} Entradas • ${formatarMoeda(somaEntradas)}
        </span>
        <span class="bg-rose-100 text-rose-700 text-[10px] px-2.5 py-1.5 rounded-lg font-black shadow-sm flex items-center gap-1.5 border border-rose-200" title="Total financeiro de saídas">
            <i class="fa-solid fa-arrow-trend-down"></i> ${qtdSaidas} Saídas • ${formatarMoeda(somaSaidas)}
        </span>
        <span class="${corBalanco} text-[10px] px-2.5 py-1.5 rounded-lg font-black shadow-sm flex items-center gap-1.5 border" title="Seu fluxo de caixa final">
            Fluxo: ${sinalBalanco} ${formatarMoeda(Math.abs(balanco))}
        </span>
    `;
}

window.toggleExpandirHistorico = function() {
    isHistoricoExpandido = !isHistoricoExpandido;
    renderizarListaHistorico();
};

function renderizarListaHistorico() {
    const container = document.getElementById('lista-transacoes');
    const btnToggle = document.getElementById('btn-toggle-historico');
    
    if (transacoesFiltradas.length === 0) {
        container.innerHTML = `<div class="bg-slate-50 rounded-2xl p-8 text-center border border-slate-200 border-dashed"><i class="fa-solid fa-magnifying-glass text-2xl text-slate-300 mb-2"></i><p class="text-xs font-bold text-slate-400 mt-2">Nenhum registro encontrado nesta visão.</p></div>`;
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

        return `
        <div class="bg-white p-4 rounded-3xl border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
            <div class="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                <div class="w-12 h-12 rounded-2xl ${corBg} flex items-center justify-center ${corTxt} text-xl shadow-inner shrink-0 relative">
                    <i class="fa-solid ${cat.icone}"></i>
                    <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${corBg} border border-white flex items-center justify-center">
                        <i class="fa-solid ${iconeSinal} text-[8px] ${corTxt}"></i>
                    </div>
                </div>
                <div class="min-w-0 flex-1">
                    <h4 class="font-bold text-sm text-slate-900 break-words whitespace-normal leading-tight">${t.descricao}</h4>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                        ${cat.nome} • <i class="fa-regular fa-calendar ml-0.5"></i> ${dataStr}
                    </p>
                </div>
            </div>
            <div class="flex flex-row sm:flex-col md:flex-row items-center sm:items-end md:items-center justify-between sm:justify-center gap-3 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                <span class="font-black text-base md:text-lg ${corValor} whitespace-nowrap">${sinal} ${formatarMoeda(t.valor)}</span>
                <div class="flex items-center gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="window.abrirModalEdicao(${t.id})" class="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-indigo-500 hover:text-white transition flex items-center justify-center border border-slate-200"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="window.excluirTransacao(${t.id})" class="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-rose-500 hover:text-white transition flex items-center justify-center border border-slate-200"><i class="fa-solid fa-trash text-xs"></i></button>
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

// ==========================================
// CÉREBRO NLP PIPELINE
// ==========================================
const dicionarioDeInteligencia = [
    { pasta: 'alimentação', regras: [
        { titulo: 'Delivery', palavras: ['ifood', 'delivery', 'rappi', 'zedelivery'] },
        { titulo: 'Fast Food', palavras: ['pizza', 'hamburguer', 'lanche', 'mcdonalds', 'bk', 'coxinha', 'salgado', 'pastel', 'mequi'] },
        { titulo: 'Mercado', palavras: ['mercado', 'supermercado', 'açougue', 'padaria', 'compra', 'compras'] },
        { titulo: 'Restaurante', palavras: ['restaurante', 'almoço', 'jantar', 'comida', 'self service'] }
    ]},
    { pasta: 'veículo', regras: [
        { titulo: 'Combustível', palavras: ['gasolina', 'álcool', 'alcool', 'etanol', 'diesel', 'posto', 'combustível', 'combustivel', 'abasteci'] },
        { titulo: 'Peças / Manutenção', palavras: ['oficina', 'mecânico', 'peça', 'pneu', 'óleo', 'revisão', 'carro', 'moto'] },
        { titulo: 'Serviços Auto', palavras: ['estacionamento', 'pedágio', 'lavagem', 'lava rápido'] },
        { titulo: 'Transporte', palavras: ['uber', '99', 'ônibus', 'passagem', 'metrô', 'táxi', 'taxi'] }
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
        { titulo: 'Compras Pessoais', palavras: ['roupa', 'presente', 'tênis', 'perfume', 'fone', 'celular', 'compras'] }
    ]},
    { pasta: 'assinaturas', regras: [
        { titulo: 'Streaming', palavras: ['netflix', 'spotify', 'amazon', 'prime', 'disney', 'hbo'] },
        { titulo: 'Serviços Recorrentes', palavras: ['assinatura', 'gympass', 'academia'] }
    ]}
];

function processarFraseNLP(fraseBruta) {
    if(!fraseBruta || fraseBruta.trim() === '') {
        document.getElementById('form-transacao').reset();
        document.getElementById('transacao-id').value = '';
        document.getElementById('transacao-data').value = new Date().toISOString().split('T')[0];
        document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-money-bill-transfer text-indigo-500"></i> Lançar Valor Real`;
        document.getElementById('modal-transacao').classList.remove('hidden');
        return;
    }

    let texto = removerAcentos(fraseBruta.toLowerCase());
    let dataCalculada = new Date();
    dataCalculada.setHours(12,0,0,0);
    
    let isMesPassado = false;
    if (texto.includes('mes passado')) {
        isMesPassado = true;
        texto = texto.replace(/do mes passado|no mes passado|mes passado/g, '');
    }

    if (texto.includes('anteontem')) {
        dataCalculada.setDate(dataCalculada.getDate() - 2);
        texto = texto.replace('anteontem', '');
    } else if (texto.includes('ontem')) {
        dataCalculada.setDate(dataCalculada.getDate() - 1);
        texto = texto.replace('ontem', '');
    } else if (texto.includes('hoje')) {
        texto = texto.replace('hoje', '');
    }

    const matchDataBarra = texto.match(/(?:dia\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
    const matchDia = texto.match(/(?:no )?dia\s*(\d{1,2})/i);

    if (matchDataBarra) {
        dataCalculada.setDate(1); 
        dataCalculada.setMonth(parseInt(matchDataBarra[2]) - 1);
        dataCalculada.setDate(parseInt(matchDataBarra[1]));
        if (matchDataBarra[3]) {
            let ano = parseInt(matchDataBarra[3]);
            if (ano < 100) ano += 2000;
            dataCalculada.setFullYear(ano);
        } else if (dataCalculada > new Date()) {
            dataCalculada.setFullYear(dataCalculada.getFullYear() - 1);
        }
        texto = texto.replace(matchDataBarra[0], ''); 
    } else if (matchDia) {
        let diaNum = parseInt(matchDia[1]);
        const mesAtual = new Date().getMonth();
        dataCalculada.setDate(1); 
        if (isMesPassado || diaNum > new Date().getDate()) {
            dataCalculada.setMonth(mesAtual - 1);
        }
        dataCalculada.setDate(diaNum);
        texto = texto.replace(matchDia[0], ''); 
    } else if (isMesPassado) {
        dataCalculada.setMonth(dataCalculada.getMonth() - 1);
    }

    texto = texto.replace(/\br\$\b|\breais\b|\breal\b|\$/gi, '');
    const nums = texto.match(/\d+(?:[.,]\d+)?/g);
    const valorExtraido = nums ? Math.max(...nums.map(n => parseFloat(n.replace(',', '.')))) : 0;
    if(nums) nums.forEach(n => texto = texto.replace(n, '')); 

    const palavrasReceita = ['recebi', 'ganhei', 'pix', 'salario', 'renda', 'vendi', 'deposito'];
    const isReceita = palavrasReceita.some(p => texto.includes(p) || removerAcentos(fraseBruta.toLowerCase()).includes(p));

    let catDetectada = null;
    let tituloFinal = '';

    if (isReceita) {
        catDetectada = categoriasGlobais.find(c => removerAcentos(c.nome.toLowerCase()).includes('renda') || removerAcentos(c.nome.toLowerCase()).includes('salario'));
        tituloFinal = removerAcentos(fraseBruta.toLowerCase()).includes('salario') ? 'Salário' : 'Recebimento';
    } else {
        for (const d of dicionarioDeInteligencia) {
            for (const regra of d.regras) {
                if (regra.palavras.some(p => texto.includes(removerAcentos(p)))) {
                    let busca = removerAcentos(d.pasta === 'saúde' ? 'imprevistos' : d.pasta);
                    catDetectada = categoriasGlobais.find(c => removerAcentos(c.nome.toLowerCase()).includes(busca));
                    tituloFinal = regra.titulo;
                    break;
                }
            }
            if (catDetectada || tituloFinal) break;
        }
    }

    if (!tituloFinal) {
        let palavras = texto.split(' ');
        const stopWords = ['eu', 'gastei', 'paguei', 'pague', 'botei', 'coloquei', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'no', 'na', 'para', 'com', 'novo', 'nova', 'meu', 'minha', 'fui', 'o', 'a', 'os', 'as', 'em', 'por', 'pra'];
        palavras = palavras.filter(p => p.trim() !== '' && !stopWords.includes(p.trim()) && isNaN(p));
        
        if (palavras.length > 0) {
            tituloFinal = palavras[0].charAt(0).toUpperCase() + palavras[0].slice(1); 
        } else {
            tituloFinal = 'Registro Rápido';
        }
        if (!catDetectada) {
            catDetectada = categoriasGlobais.find(c => removerAcentos(c.nome.toLowerCase()).includes('lazer') || removerAcentos(c.nome.toLowerCase()).includes('outros'));
        }
    }

    document.getElementById('transacao-id').value = ''; 
    document.getElementById('modal-titulo').innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-indigo-600"></i> ${isReceita ? 'Registrar Entrada' : 'Registrar Saída'}`;
    document.getElementById('transacao-desc').value = tituloFinal;
    
    if(valorExtraido > 0) {
        let valorStr = valorExtraido.toFixed(2).replace('.', ',');
        valorStr = valorStr.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
        valorStr = valorStr.replace(/(\d)(\d{3}),/g, "$1.$2,");
        document.getElementById('transacao-valor').value = valorStr;
    } else { document.getElementById('transacao-valor').value = ''; }

    document.getElementById('transacao-data').value = dataCalculada.toISOString().split('T')[0];
    
    if (catDetectada) {
        document.getElementById('transacao-categoria').value = catDetectada.id;
    }
    
    document.querySelector(`input[name="tipo"][value="${isReceita ? 'receita' : 'despesa'}"]`).checked = true;
    document.getElementById('modal-transacao').classList.remove('hidden');
}

window.abrirModalComTextoRapido = function() { 
    const input = document.getElementById('input-rapido').value;
    processarFraseNLP(input); 
};

// ---------------------------------------------
// MICROFONE REATIVO POR EVENTOS E SWEETALERT
// ---------------------------------------------
window.ativarMicrofone = function() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        return Swal.fire({
            icon: 'error',
            title: 'Ops!',
            text: 'Seu navegador não suporta microfone nativo. Use o Google Chrome.',
            confirmButtonColor: '#4f46e5'
        });
    }
    
    reconhecimentoDeVoz = new SpeechRecognition();
    reconhecimentoDeVoz.lang = 'pt-BR';
    reconhecimentoDeVoz.interimResults = true; 
    reconhecimentoDeVoz.continuous = false; 

    const modalMic = document.getElementById('modal-microfone');
    const textoInterim = document.getElementById('texto-interim');
    const wave1 = document.getElementById('mic-wave-1');
    const wave2 = document.getElementById('mic-wave-2');

    modalMic.classList.remove('hidden');
    textoInterim.innerText = "Fale agora...";

    if(wave1 && wave2) {
        wave1.style.transform = 'scale(1.1)';
        wave2.style.transform = 'scale(1.05)';
    }

    reconhecimentoDeVoz.onresult = (event) => {
        let textoTemporario = '';
        let textoFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                textoFinal += event.results[i][0].transcript;
            } else {
                textoTemporario += event.results[i][0].transcript;
            }
        }
        
        if(wave1 && wave2) {
            let fatorVolumeFake = 1.1 + (textoTemporario.length % 5) * 0.15; 
            wave1.style.transform = `scale(${fatorVolumeFake * 1.3})`;
            wave2.style.transform = `scale(${fatorVolumeFake * 1.1})`;
            
            setTimeout(() => {
                wave1.style.transform = 'scale(1.1)';
                wave2.style.transform = 'scale(1.05)';
            }, 150);
        }

        let transcricaoAoVivo = textoFinal || textoTemporario;
        if (transcricaoAoVivo.length > 0) {
            transcricaoAoVivo = transcricaoAoVivo.replace(/\br\$\b|\breais\b/gi, "R$");
            transcricaoAoVivo = transcricaoAoVivo.charAt(0).toUpperCase() + transcricaoAoVivo.slice(1);
            textoInterim.innerText = transcricaoAoVivo;
        }

        if (textoFinal && textoFinal.trim() !== '') {
            document.getElementById('input-rapido').value = textoFinal;
            setTimeout(() => {
                window.cancelarMicrofone();
                processarFraseNLP(textoFinal); 
            }, 750);
        }
    };

    reconhecimentoDeVoz.onerror = (e) => { 
        window.cancelarMicrofone(); 
        if (e.error === 'not-allowed') {
            Swal.fire({
                icon: 'warning',
                title: 'Microfone Bloqueado',
                text: 'Libere a permissão de microfone no cadeado do navegador.',
                confirmButtonColor: '#4f46e5'
            });
        }
    };
    
    reconhecimentoDeVoz.onend = () => { 
        setTimeout(() => {
            if(!modalMic.classList.contains('hidden') && (textoInterim.innerText === "Fale agora..." || textoInterim.innerText === '')) {
                window.cancelarMicrofone();
            }
        }, 1200);
    };

    reconhecimentoDeVoz.start();
};

window.cancelarMicrofone = function() {
    if(reconhecimentoDeVoz) {
        reconhecimentoDeVoz.onresult = null;
        reconhecimentoDeVoz.onerror = null;
        reconhecimentoDeVoz.onend = null;
        reconhecimentoDeVoz.abort();
    }
    reconhecimentoDeVoz = null;
    document.getElementById('modal-microfone').classList.add('hidden');
};

// ==========================================
// FUNÇÕES DE CRUD (COM LOTTIE INVISÍVEL SÊNIOR)
// ==========================================
window.abrirModalEdicao = function(id) {
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
};

window.fecharModal = function() { 
    document.getElementById('modal-transacao').classList.add('hidden'); 
};

window.salvarTransacao = async function(event) {
    event.preventDefault();
    const id = document.getElementById('transacao-id').value;
    const desc = document.getElementById('transacao-desc').value.trim();
    const val = desmascararMoeda(document.getElementById('transacao-valor').value);
    const dataV = document.getElementById('transacao-data').value;
    const catId = parseInt(document.getElementById('transacao-categoria').value);
    const tipo = document.querySelector('input[name="tipo"]:checked').value;

    if(!desc || isNaN(val) || val <= 0 || !dataV) {
        return Swal.fire({
            icon: 'warning',
            title: 'Dados Incompletos',
            text: 'Preencha a descrição, valor e a data corretamente.',
            confirmButtonColor: '#4f46e5'
        });
    }

    const payload = {
        usuario_id: usuarioLogado.id, descricao: desc, valor: val, data_vencimento: dataV, categoria_id: catId, tipo: tipo, pago: true
    };

    const btn = document.getElementById('btn-salvar-transacao');
    const conteudoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    try {
        if (id) {
            await supabaseClient.from('transacoes').update(payload).eq('id', id).eq('usuario_id', usuarioLogado.id);
        } else {
            await supabaseClient.from('transacoes').insert([payload]);
        }
        await carregarDadosDoBanco();
        window.fecharModal();
        document.getElementById('input-rapido').value = '';
        
        // A MÁGICA PURA: Efeito Lottie Sticker Flutuante
        Swal.fire({
            html: `
                <div class="flex justify-center items-center">
                    <dotlottie-wc
                      src="https://lottie.host/85450f21-2b79-46bd-8e77-a0d7fc86ceaf/63OdW0EjZh.json"
                      style="width: 300px; height: 300px;"
                      autoplay
                      loop>
                    </dotlottie-wc>
                </div>
            `,
            showConfirmButton: false,
            timer: 3500, // Durando mais na tela a seu pedido
            background: 'transparent', // Arranca o fundo branco
            backdrop: 'rgba(15, 23, 42, 0.7)', // Tela do fundo escura com desfoque nativo
            customClass: {
                popup: 'shadow-none bg-transparent border-none' // Destrói qualquer sombra residual
            }
        });

    } catch(e) { 
        Swal.fire({
            icon: 'error',
            title: 'Erro de Conexão',
            text: e.message,
            confirmButtonColor: '#4f46e5'
        });
    } finally { 
        btn.innerHTML = conteudoOriginal; 
        btn.disabled = false;
    }
};

window.excluirTransacao = async function(id) {
    const confirmacao = await Swal.fire({
        title: 'Excluir Transação?',
        text: "Essa ação apagará este registro do seu fluxo de caixa.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    });

    if(!confirmacao.isConfirmed) return;

    try {
        await supabaseClient.from('transacoes').delete().eq('id', id).eq('usuario_id', usuarioLogado.id);
        await carregarDadosDoBanco();
        
        Swal.fire({
            icon: 'success',
            title: 'Excluído!',
            showConfirmButton: false,
            timer: 1500
        });

    } catch(e) { 
        Swal.fire({
            icon: 'error',
            title: 'Erro ao excluir',
            text: e.message,
            confirmButtonColor: '#4f46e5'
        });
    }
};
