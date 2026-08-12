// ==========================================
// dashboard.js - MOTOR DE BUSINESS INTELLIGENCE E IA (GEMINI API)
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];

let grafCombo = null;
let grafPizza = null;
let grafTop = null;

let statsGlobais = { receitas: 0, despesas: 0, saldo: 0, taxaPoupanca: 0, mediaDiaria: 0, maiorGasto: null, topCategoria: null, transacoesNoPeriodo: 0 };

const coresPorCategoria = {
    'Alimentação': { hex: '#3b82f6', tw: 'bg-blue-500' },          
    'Veículo & Transporte': { hex: '#6366f1', tw: 'bg-indigo-500' },
    'Moradia': { hex: '#14b8a6', tw: 'bg-teal-500' },              
    'Estudo & Carreira': { hex: '#a855f7', tw: 'bg-purple-500' },   
    'Saúde & Imprevistos': { hex: '#ec4899', tw: 'bg-pink-500' },  
    'Lazer & Pessoal': { hex: '#f97316', tw: 'bg-orange-500' },    
    'Assinaturas & Serviços': { hex: '#8b5cf6', tw: 'bg-violet-500' }, 
    'Renda & Salário': { hex: '#10b981', tw: 'bg-emerald-500' },   
    'Outros': { hex: '#94a3b8', tw: 'bg-slate-400' }               
};

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    const hoje = new Date();
    document.getElementById('input-mes').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('input-ano').value = hoje.getFullYear();
    
    document.getElementById('filtro-periodo').value = 'por_mes';
    mudarTipoFiltro();

    document.getElementById('input-coach').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') enviarMensagemCoach();
    });

    await carregarDadosDoBanco();
});

async function carregarDadosDoBanco() {
    try {
        const [rTrans, rCat] = await Promise.all([
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id)
        ]);
        transacoesGlobais = rTrans.data || [];
        categoriasGlobais = rCat.data || [];
        processarEAtualizarTudo();
    } catch (e) { console.error("Erro ao puxar dados:", e.message); }
}

function mudarTipoFiltro() {
    const tipo = document.getElementById('filtro-periodo').value;
    document.getElementById('box-mes').classList.add('hidden');
    document.getElementById('box-ano').classList.add('hidden');
    document.getElementById('box-personalizado').classList.add('hidden');

    if (tipo === 'por_mes') document.getElementById('box-mes').classList.remove('hidden');
    else if (tipo === 'por_ano') document.getElementById('box-ano').classList.remove('hidden');
    else if (tipo === 'personalizado') document.getElementById('box-personalizado').classList.remove('hidden');

    processarEAtualizarTudo();
}

function processarEAtualizarTudo() {
    const tipoFiltro = document.getElementById('filtro-periodo').value;

    const transacoesFiltradas = transacoesGlobais.filter(t => {
        if (!t.data_vencimento) return true;
        const d = new Date(t.data_vencimento + 'T12:00:00Z');
        
        if (tipoFiltro === 'por_mes') {
            const val = document.getElementById('input-mes').value;
            if(!val) return true;
            const [anoF, mesF] = val.split('-');
            return d.getMonth() === (parseInt(mesF) - 1) && d.getFullYear() === parseInt(anoF);
        } else if (tipoFiltro === 'por_ano') {
            const val = document.getElementById('input-ano').value;
            if(!val) return true;
            return d.getFullYear() === parseInt(val);
        } else if (tipoFiltro === 'personalizado') {
            const dIni = document.getElementById('input-data-inicio').value;
            const dFim = document.getElementById('input-data-fim').value;
            let valid = true;
            if (dIni) valid = valid && d >= new Date(dIni + 'T12:00:00Z');
            if (dFim) valid = valid && d <= new Date(dFim + 'T12:00:00Z');
            return valid;
        }
        return true; 
    });

    let totalDespesas = 0, totalReceitas = 0;
    let maiorGasto = { valor: 0, descricao: "Nenhum", categoria: "Nenhuma" };
    const gastosPorCategoria = {};
    const topGastos = [];
    const agrupamentoTemporal = {}; 

    const agruparPorMes = (tipoFiltro === 'por_ano' || tipoFiltro === 'tudo');

    transacoesFiltradas.forEach(t => { 
        let chaveTempo = 'S/D';
        if (t.data_vencimento) {
            const partes = t.data_vencimento.split('-'); 
            if (agruparPorMes) {
                const mesesAbv = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                chaveTempo = `${mesesAbv[parseInt(partes[1])-1]}/${partes[0].slice(2)}`; 
            } else {
                chaveTempo = `${partes[2]}/${partes[1]}`; 
            }
        }
        if(!agrupamentoTemporal[chaveTempo]) agrupamentoTemporal[chaveTempo] = { rec: 0, des: 0 };

        const catNomeBase = categoriasGlobais.find(c => c.id === t.categoria_id)?.nome || 'Outros';
        
        let catNomeCurto = catNomeBase;
        if(catNomeBase.includes('Alimentação')) catNomeCurto = 'Alimentação';
        if(catNomeBase.includes('Veículo')) catNomeCurto = 'Veículo & Transporte';
        if(catNomeBase.includes('Estudo')) catNomeCurto = 'Estudo & Carreira';
        if(catNomeBase.includes('Saúde')) catNomeCurto = 'Saúde & Imprevistos';

        if(t.tipo === 'despesa') {
            totalDespesas += t.valor; 
            agrupamentoTemporal[chaveTempo].des += t.valor;
            t.categoriaNome = catNomeCurto; 
            topGastos.push(t);
            
            if(t.valor > maiorGasto.valor) maiorGasto = { valor: t.valor, descricao: t.descricao, categoria: catNomeCurto };
            gastosPorCategoria[catNomeCurto] = (gastosPorCategoria[catNomeCurto] || 0) + t.valor;
        } else {
            totalReceitas += t.valor;
            agrupamentoTemporal[chaveTempo].rec += t.valor;
        }
    });

    let taxa = 0;
    if (totalReceitas > 0) taxa = ((totalReceitas - totalDespesas) / totalReceitas) * 100;
    else if (totalDespesas > 0) taxa = -100;

    const diasNoPeriodo = tipoFiltro === 'por_mes' ? 30 : 365; 
    const media = totalDespesas > 0 ? (totalDespesas / diasNoPeriodo) : 0;

    const categoriasOrdenadas = Object.keys(gastosPorCategoria).sort((a, b) => gastosPorCategoria[b] - gastosPorCategoria[a]);
    topGastos.sort((a, b) => b.valor - a.valor);

    statsGlobais = { receitas: totalReceitas, despesas: totalDespesas, saldo: totalReceitas - totalDespesas, taxaPoupanca: taxa, mediaDiaria: media, maiorGasto: maiorGasto, topCategoria: categoriasOrdenadas.length > 0 ? { nome: categoriasOrdenadas[0], valor: gastosPorCategoria[categoriasOrdenadas[0]] } : null, transacoesNoPeriodo: transacoesFiltradas.length };

    document.getElementById('kpi-saldo').innerText = formatarMoeda(totalReceitas - totalDespesas);
    document.getElementById('kpi-receitas').innerText = formatarMoeda(totalReceitas);
    document.getElementById('kpi-despesas').innerText = formatarMoeda(totalDespesas);
    
    let taxaTexto = taxa.toFixed(1) + "%";
    let corTaxa = taxa >= 20 ? 'bg-emerald-500' : (taxa > 0 ? 'bg-indigo-500' : 'bg-rose-500');
    document.getElementById('kpi-taxa-texto').innerText = taxaTexto;
    
    let percentualBarra = Math.min(Math.max(taxa, 0), 100); 
    const barra = document.getElementById('kpi-taxa-barra');
    barra.style.width = `${percentualBarra}%`;
    barra.className = `h-1.5 rounded-full transition-all duration-1000 ${corTaxa}`;

    renderizarListaCategorias(categoriasOrdenadas, gastosPorCategoria, totalDespesas);
    renderizarGraficos(agrupamentoTemporal, gastosPorCategoria, categoriasOrdenadas, topGastos.slice(0,5), totalDespesas);
}

function renderizarListaCategorias(ordenadas, gastos, totalGeral) {
    const html = ordenadas.map(cat => {
        const valor = gastos[cat];
        const perc = totalGeral > 0 ? ((valor / totalGeral) * 100).toFixed(1) : 0;
        const corBase = coresPorCategoria[cat] ? coresPorCategoria[cat].tw : coresPorCategoria['Outros'].tw;
        
        return `
        <div>
            <div class="flex justify-between items-end mb-1.5 gap-2">
                <span class="text-xs font-bold text-slate-700 truncate flex-1" title="${cat}">${cat}</span>
                <div class="text-right flex items-center gap-2 shrink-0">
                    <span class="text-[10px] font-bold text-slate-400">${perc}%</span>
                    <span class="text-sm font-black text-slate-900 whitespace-nowrap">${formatarMoeda(valor)}</span>
                </div>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2">
                <div class="${corBase} h-2 rounded-full transition-all duration-1000" style="width: ${perc}%"></div>
            </div>
        </div>
        `;
    }).join('');
    document.getElementById('lista-categorias-progress').innerHTML = html || '<p class="text-xs text-slate-400 font-bold">Sem despesas.</p>';
}

function renderizarGraficos(agrupamentoTemporal, gastosPorCategoria, categoriasOrdenadas, top5, totalDespesas) {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#94a3b8'; 

    const tooltipPro = { backgroundColor: '#0f172a', titleFont: { size: 12, family: 'Inter', weight: 'bold' }, bodyFont: { size: 13, family: 'Inter', weight: 'bold' }, padding: 12, cornerRadius: 6, displayColors: true, boxPadding: 4 };

    const chavesTempo = Object.keys(agrupamentoTemporal).sort((a,b) => {
        if(a==='S/D') return -1; if(b==='S/D') return 1;
        return 1; 
    });
    
    const labelsT = [], dadosRec = [], dadosDes = [], dadosAcumulados = [];
    let acumuladoAtual = 0;

    chavesTempo.forEach(c => {
        labelsT.push(c);
        dadosRec.push(agrupamentoTemporal[c].rec);
        dadosDes.push(-Math.abs(agrupamentoTemporal[c].des)); 
        acumuladoAtual += (agrupamentoTemporal[c].rec - agrupamentoTemporal[c].des);
        dadosAcumulados.push(acumuladoAtual);
    });

    const ctxC = document.getElementById('graficoCombo').getContext('2d');
    if (grafCombo) grafCombo.destroy();

    grafCombo = new Chart(ctxC, {
        type: 'bar',
        data: {
            labels: labelsT.length > 0 ? labelsT : ['Sem Dados'],
            datasets: [
                {
                    type: 'line', label: 'Saldo Acumulado', data: dadosAcumulados, borderColor: '#4f46e5', borderWidth: 3, tension: 0.1, 
                    pointBackgroundColor: '#ffffff', pointBorderColor: '#4f46e5', pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 7, fill: false
                },
                {
                    type: 'bar', label: 'Entradas', data: dadosRec, backgroundColor: '#10b981', borderRadius: 2, maxBarThickness: 40, 
                },
                {
                    type: 'bar', label: 'Saídas', data: dadosDes, backgroundColor: '#ef4444', borderRadius: 2, maxBarThickness: 40,
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false }, tooltip: { ...tooltipPro, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatarMoeda(Math.abs(ctx.raw))}` } } },
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } },
                y: { 
                    stacked: true, 
                    grid: { color: (ctx) => ctx.tick.value === 0 ? '#334155' : '#e2e8f0', lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1, borderDash: (ctx) => ctx.tick.value === 0 ? [] : [4, 4] }, 
                    border: { display: false }, 
                    ticks: { font: { size: 10, weight: 'bold' }, callback: (value) => value >= 0 ? `R$ ${value}` : `-R$ ${Math.abs(value)}` } 
                }
            }
        }
    });

    const ctxP = document.getElementById('graficoPizza').getContext('2d');
    if (grafPizza) grafPizza.destroy();

    let lblP = [], datP = [], coresP = [];
    if (categoriasOrdenadas.length === 0) { lblP = ['Vazio']; datP = [1]; coresP = ['#f1f5f9']; } 
    else {
        let soma = 0;
        for (let i = 0; i < Math.min(5, categoriasOrdenadas.length); i++) {
            const nomeCat = categoriasOrdenadas[i];
            lblP.push(nomeCat); datP.push(gastosPorCategoria[nomeCat]);
            coresP.push(coresPorCategoria[nomeCat] ? coresPorCategoria[nomeCat].hex : coresPorCategoria['Outros'].hex);
            soma += gastosPorCategoria[nomeCat];
        }
        if (categoriasOrdenadas.length > 5) { lblP.push('Outros'); datP.push(totalDespesas - soma); coresP.push(coresPorCategoria['Outros'].hex); }
    }

    document.getElementById('pizza-total').innerText = formatarMoeda(totalDespesas);

    grafPizza = new Chart(ctxP, {
        type: 'doughnut',
        data: { labels: lblP, datasets: [{ data: datP, backgroundColor: coresP, borderWidth: 3, borderColor: '#ffffff', borderRadius: 4, hoverOffset: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { ...tooltipPro, callbacks: { label: (ctx) => ` ${formatarMoeda(categoriasOrdenadas.length === 0 ? 0 : ctx.raw)}` } } } }
    });

    const ctxT = document.getElementById('graficoTopGastos').getContext('2d');
    if (grafTop) grafTop.destroy();

    grafTop = new Chart(ctxT, {
        type: 'bar',
        data: {
            labels: top5.length > 0 ? top5.map(t => t.descricao.length > 15 ? t.descricao.substring(0, 15) + '...' : t.descricao) : ['Nenhum'],
            datasets: [{
                data: top5.length > 0 ? top5.map(t => t.valor) : [0],
                backgroundColor: top5.length > 0 ? top5.map(t => coresPorCategoria[t.categoriaNome] ? coresPorCategoria[t.categoriaNome].hex : coresPorCategoria['Outros'].hex) : '#94a3b8',
                borderRadius: 4, maxBarThickness: 16 
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { ...tooltipPro, callbacks: { label: (ctx) => ` ${formatarMoeda(ctx.raw)}` } } },
            scales: { x: { display: false }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 'bold', size: 11 }, color: '#334155' } } }
        }
    });
}

// ==========================================
// MÓDULO DA INTERFACE DO COACH (UI)
// ==========================================
function toggleCoach() {
    const janela = document.getElementById('janela-coach');
    if (janela.classList.contains('hidden')) {
        janela.classList.remove('hidden');
        if(document.getElementById('chat-box').innerHTML === "") iniciarCoach();
    } else {
        janela.classList.add('hidden');
    }
}

const chatBox = document.getElementById('chat-box');

function adicionarMensagemNoChat(texto, isUsuario = false) {
    const div = document.createElement('div');
    if (isUsuario) {
        div.className = "bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-sm self-end max-w-[85%] text-sm font-medium shadow-sm slide-up-chat";
        div.innerText = texto;
    } else {
        div.className = "bg-slate-800 border border-slate-700 text-slate-100 p-4 rounded-2xl rounded-tl-sm self-start max-w-[90%] text-sm font-medium shadow-sm slide-up-chat leading-relaxed";
        div.innerHTML = texto; 
    }
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; 
}

function iniciarCoach() {
    chatBox.innerHTML = ''; 
    adicionarMensagemNoChat("Olá, Kauã! Sou o seu Consultor de IA. Estou conectado aos seus dados em tempo real.<br><br>Você pode me fazer perguntas naturais como: <br><i>'Como estou este mês?'</i><br><i>'Minha carteira corre perigo?'</i><br><i>'Qual foi o meu ralo de dinheiro?'</i>", false);
}

function atalhoCoach(comando) {
    document.getElementById('input-coach').value = comando;
    enviarMensagemCoach();
}

function enviarMensagemCoach() {
    const input = document.getElementById('input-coach');
    const texto = input.value.trim();
    if (!texto) return;

    adicionarMensagemNoChat(texto, true);
    input.value = '';

    const typingDiv = document.createElement('div');
    typingDiv.className = "text-slate-500 text-xs italic mt-2 self-start slide-up-chat flex items-center gap-2";
    typingDiv.id = "coach-typing";
    typingDiv.innerHTML = "<i class='fa-solid fa-circle-notch fa-spin text-indigo-500'></i> Processando na Nuvem...";
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Envia para o motor da IA
    gerarRespostaIA(texto);
}

// ==========================================
// MOTOR DE INTELIGÊNCIA ARTIFICIAL (GEMINI VIA API)
// ==========================================
async function gerarRespostaIA(pergunta) {
    if (statsGlobais.transacoesNoPeriodo === 0) {
        document.getElementById('coach-typing')?.remove();
        return adicionarMensagemNoChat("O algoritmo requer dados populados para gerar predições. Altere o período analisado no painel superior.", false);
    }

    // 1. O RAG (O Contexto Invisível que alimenta o raciocínio da IA)
    const promptDeSistema = `
Você é o Consultor IA do DataWallet, um aplicativo financeiro corporativo de elite construído pelo Kauã.
Sua postura é profissional, direta, inteligente e analítica. Evite textos extremamente longos. Vá direto ao ponto.
Sempre formate sua resposta em HTML limpo para exibir na tela web (use <b>, <i>, e <br>). NÃO use Markdown comum como ** ou *.

AQUI ESTÃO OS DADOS REAIS E MATEMÁTICOS DO USUÁRIO NESTE EXATO MOMENTO:
- Total Captado (Entradas): R$ ${statsGlobais.receitas.toFixed(2)}
- Total Queimado (Saídas): R$ ${statsGlobais.despesas.toFixed(2)}
- Saldo Líquido do Período: R$ ${statsGlobais.saldo.toFixed(2)}
- Margem de Poupança (Retenção): ${statsGlobais.taxaPoupanca.toFixed(1)}%
- Burn Rate (Queima Média Diária): R$ ${statsGlobais.mediaDiaria.toFixed(2)} / dia
- Centro de custo mais oneroso: ${statsGlobais.topCategoria ? statsGlobais.topCategoria.nome : 'Nenhum'} (R$ ${statsGlobais.topCategoria ? statsGlobais.topCategoria.valor.toFixed(2) : 0})
- Maior gasto isolado (o vilão individual): ${statsGlobais.maiorGasto.descricao} (R$ ${statsGlobais.maiorGasto.valor.toFixed(2)})

REGRA ESTRITA: Responda à pergunta do usuário usando APENAS a intenção dele cruzada com os dados acima. Aja como um humano sênior analisando a carteira. Se a margem for negativa, alerte severamente sobre a queima de caixa.
    `;

    const payload = {
        contents: [{
            parts: [{ text: promptDeSistema + "\n\nPergunta real do usuário: " + pergunta }]
        }]
    };

    try {

        console.log("A chave que o sistema está usando é: ", GEMINI_API_KEY);
        
        // 2. A Chamada Segura para o Navegador (Chave na URL)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const respostaDaNuvem = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!respostaDaNuvem.ok) {
            const erroDetalhe = await respostaDaNuvem.json();
            console.error("Motivo do bloqueio pela API:", erroDetalhe);
            throw new Error("Acesso bloqueado pela API do Google.");
        }

        const dados = await respostaDaNuvem.json();
        let textoRespostaIA = dados.candidates[0].content.parts[0].text;

        // O Gemini às vezes teima em usar **, vamos limpar isso via Regex para garantir HTML perfeito
        textoRespostaIA = textoRespostaIA.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

        document.getElementById('coach-typing')?.remove();
        adicionarMensagemNoChat(textoRespostaIA, false);

    } catch (erro) {
        console.error("Falha no Catch do Fetch:", erro);
        document.getElementById('coach-typing')?.remove();
        adicionarMensagemNoChat("<b>Erro de Conexão:</b> Não consegui me conectar aos servidores do Google no momento. Verifique se o seu GEMINI_API_KEY no config.js está correto.", false);
    }
}
