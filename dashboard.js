// ==========================================
// dashboard.js - MOTOR DE BI COM DUAL-AXIS FAB E SEM REFRESH FANTASMA
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];

let grafCombo = null;
let grafPizza = null;
let grafRadar = null;

let statsGlobais = { receitas: 0, despesas: 0, saldo: 0, taxaPoupanca: 0, mediaDiaria: 0, maiorGasto: null, topCategoria: null, transacoesNoPeriodo: 0 };
let menuMobileAberto = false; 
let inicializacaoCompleta = false; // Trava de Segurança do Observer

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
    
    setTimeout(() => document.body.classList.remove('fade-in'), 500);

    document.querySelectorAll('a').forEach(link => {
        if(link.hostname === window.location.hostname && link.target !== '_blank') {
            link.addEventListener('click', e => {
                e.preventDefault();
                const href = link.getAttribute('href');
                document.body.style.opacity = 0;
                document.body.style.transition = 'opacity 0.2s ease-in-out';
                setTimeout(() => window.location.href = href, 200);
            });
        }
    });

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
    inicializacaoCompleta = true; 

    // O OLHO DE SAURON (MUTATION OBSERVER)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && inicializacaoCompleta) {
                if (transacoesGlobais.length > 0) {
                    processarEAtualizarTudo(true); 
                }
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true });
});

// A MÁGICA DA EXPANSÃO EM DOIS EIXOS (L-Shape Mobile)
window.toggleMobileMenu = function() {
    const items = document.getElementById('fab-items');
    const actionBtn = document.getElementById('fab-action');
    const icon = document.getElementById('fab-icon');
    const btn = document.getElementById('fab-menu');
    
    menuMobileAberto = !menuMobileAberto;

    if (menuMobileAberto) {
        items.classList.remove('opacity-0', 'translate-y-12', 'pointer-events-none');
        items.classList.add('opacity-100');
        
        if (actionBtn) {
            actionBtn.classList.remove('opacity-0', 'pointer-events-none');
            actionBtn.classList.add('opacity-100', 'pointer-events-auto');
            actionBtn.style.left = '0px';
            actionBtn.style.transform = 'rotate(-360deg)';
        }

        btn.style.transform = 'rotate(180deg)';
        setTimeout(() => { icon.classList.replace('fa-bars', 'fa-xmark'); }, 150);
    } else {
        items.classList.add('opacity-0', 'translate-y-12', 'pointer-events-none');
        items.classList.remove('opacity-100');

        if (actionBtn) {
            actionBtn.classList.add('opacity-0', 'pointer-events-none');
            actionBtn.classList.remove('opacity-100', 'pointer-events-auto');
            actionBtn.style.left = 'calc(100% - 56px)';
            actionBtn.style.transform = 'rotate(0deg)';
        }

        btn.style.transform = 'rotate(0deg)';
        setTimeout(() => { icon.classList.replace('fa-xmark', 'fa-bars'); }, 150);
    }
};

function formatarMoedaLocal(valor) {
    let p = Math.abs(valor).toFixed(2).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (valor < 0 ? "- R$ " : "R$ ") + p.join(',');
}

window.animarContador = function(id, valorFinal, formato = 'moeda', duracao = 1000) {
    const elemento = document.getElementById(id);
    if (!elemento) return;
    
    const startTimestamp = performance.now();
    const step = (currentTimestamp) => {
        const progress = Math.min((currentTimestamp - startTimestamp) / duracao, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4); 
        const valorAtual = easeProgress * valorFinal;
        
        if (formato === 'moeda') {
            elemento.innerText = formatarMoedaLocal(valorAtual);
        } else if (formato === 'porcentagem') {
            elemento.innerText = valorAtual.toFixed(1) + "%";
        }
        
        if (progress < 1) requestAnimationFrame(step);
        else {
            if (formato === 'moeda') {
                elemento.innerText = formatarMoedaLocal(valorFinal);
            } else if (formato === 'porcentagem') {
                elemento.innerText = valorFinal.toFixed(1) + "%";
            }
        }
    };
    requestAnimationFrame(step);
};

async function carregarDadosDoBanco() {
    try {
        const [rTrans, rCat] = await Promise.all([
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id)
        ]);
        // Ignora despesas não pagas no balanço geral do Dashboard
        transacoesGlobais = (rTrans.data || []).filter(t => t.tipo !== 'despesa' || t.pago === true);
        categoriasGlobais = rCat.data || [];
        processarEAtualizarTudo();
    } catch (e) { console.error("Erro ao puxar dados:", e.message); }
}

// O BUG FOI RESOLVIDO AQUI: Removidas as classes de Grid do campo Flex e protegido as referências
window.mudarTipoFiltro = function() {
    const tipo = document.getElementById('filtro-periodo').value;
    const boxMes = document.getElementById('box-mes');
    const boxAno = document.getElementById('box-ano');
    const boxPers = document.getElementById('box-personalizado');

    if(boxMes) { boxMes.classList.add('hidden'); boxMes.classList.remove('flex'); }
    if(boxAno) { boxAno.classList.add('hidden'); boxAno.classList.remove('flex'); }
    if(boxPers) { boxPers.classList.add('hidden'); boxPers.classList.remove('flex'); } 

    if (tipo === 'por_mes' && boxMes) {
        boxMes.classList.remove('hidden'); boxMes.classList.add('flex');
    }
    else if (tipo === 'por_ano' && boxAno) {
        boxAno.classList.remove('hidden'); boxAno.classList.add('flex');
    }
    else if (tipo === 'personalizado' && boxPers) {
        boxPers.classList.remove('hidden'); boxPers.classList.add('flex');
    }

    processarEAtualizarTudo();
}

window.processarEAtualizarTudo = function(isThemeChange = false) {
    const tipoFiltro = document.getElementById('filtro-periodo').value;

    const transacoesFiltradas = transacoesGlobais.filter(t => {
        if (!t.data_vencimento) return true;
        const dStr = t.data_vencimento; 
        const d = new Date(t.data_vencimento + 'T12:00:00Z');
        
        if (tipoFiltro === 'essa_semana') {
            d.setHours(0,0,0,0);
            const dataHoje = new Date(); dataHoje.setHours(0,0,0,0);
            const inicioSemana = new Date(dataHoje); inicioSemana.setDate(dataHoje.getDate() - dataHoje.getDay()); 
            const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6); fimSemana.setHours(23, 59, 59, 999);
            return (d >= inicioSemana && d <= fimSemana);
        } else if (tipoFiltro === 'por_mes') {
            const val = document.getElementById('input-mes').value;
            if(!val) return true;
            return dStr.startsWith(val);
        } else if (tipoFiltro === 'por_ano') {
            const val = document.getElementById('input-ano').value;
            if(!val) return true;
            return d.getFullYear() === parseInt(val);
        } else if (tipoFiltro === 'personalizado') {
            const dIni = document.getElementById('input-data-inicio').value;
            const dFim = document.getElementById('input-data-fim').value;
            let valid = true;
            if (dIni) valid = valid && (dStr >= dIni);
            if (dFim) valid = valid && (dStr <= dFim);
            return valid;
        }
        return true; 
    });

    let totalDespesas = 0, totalReceitas = 0;
    let maiorGasto = { valor: 0, descricao: "Nenhum", categoria: "Nenhuma" };
    const gastosPorCategoria = {};
    const agrupamentoTemporal = {}; 
    let gastosPorDiaSemana = [0, 0, 0, 0, 0, 0, 0];

    let agruparPorMes = false;
    if (tipoFiltro === 'tudo' || tipoFiltro === 'por_ano') {
        agruparPorMes = true;
    } else if (tipoFiltro === 'personalizado') {
        const dIni = document.getElementById('input-data-inicio').value;
        const dFim = document.getElementById('input-data-fim').value;
        if (dIni && dFim) {
            const diffTime = Math.abs(new Date(dFim) - new Date(dIni));
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays > 40) agruparPorMes = true;
        } else {
            agruparPorMes = true;
        }
    }

    transacoesFiltradas.forEach(t => { 
        let chaveTempo = 'S/D';
        if (t.data_vencimento) {
            const dObjeto = new Date(t.data_vencimento + 'T12:00:00Z');
            const partes = t.data_vencimento.split('-'); 
            
            if (agruparPorMes) {
                const mesesAbv = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                chaveTempo = `${mesesAbv[parseInt(partes[1])-1]}/${partes[0].slice(2)}`; 
            } else {
                chaveTempo = `${partes[2]}/${partes[1]}`; 
            }
            
            if(t.tipo === 'despesa') gastosPorDiaSemana[dObjeto.getDay()] += t.valor;
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

    statsGlobais = { receitas: totalReceitas, despesas: totalDespesas, saldo: totalReceitas - totalDespesas, taxaPoupanca: taxa, mediaDiaria: media, maiorGasto: maiorGasto, topCategoria: categoriasOrdenadas.length > 0 ? { nome: categoriasOrdenadas[0], valor: gastosPorCategoria[categoriasOrdenadas[0]] } : null, transacoesNoPeriodo: transacoesFiltradas.length };

    const barra = document.getElementById('kpi-taxa-barra');
    let percentualBarra = Math.min(Math.max(taxa, 0), 100); 
    let corTaxa = taxa >= 20 ? 'bg-emerald-500' : (taxa > 0 ? 'bg-indigo-500' : 'bg-rose-500');

    if (!isThemeChange) {
        window.animarContador('kpi-saldo', totalReceitas - totalDespesas, 'moeda', 1000);
        window.animarContador('kpi-receitas', totalReceitas, 'moeda', 1000);
        window.animarContador('kpi-despesas', totalDespesas, 'moeda', 1000);
        window.animarContador('kpi-taxa-texto', taxa, 'porcentagem', 1000);
        
        barra.style.width = '0%';
        setTimeout(() => { barra.style.width = `${percentualBarra}%`; }, 100);
        barra.className = `h-1.5 md:h-2 rounded-full transition-all duration-1000 ease-out shadow-sm ${corTaxa}`;
    } 
    else {
        document.getElementById('kpi-saldo').innerText = formatarMoedaLocal(totalReceitas - totalDespesas);
        document.getElementById('kpi-receitas').innerText = formatarMoedaLocal(totalReceitas);
        document.getElementById('kpi-despesas').innerText = formatarMoedaLocal(totalDespesas);
        document.getElementById('kpi-taxa-texto').innerText = taxa.toFixed(1) + "%";
        
        barra.style.width = `${percentualBarra}%`;
        barra.className = `h-1.5 md:h-2 rounded-full shadow-sm ${corTaxa}`; 
    }

    renderizarListaCategorias(categoriasOrdenadas, gastosPorCategoria, totalDespesas, isThemeChange);
    renderizarGraficos(agrupamentoTemporal, gastosPorCategoria, categoriasOrdenadas, gastosPorDiaSemana, isThemeChange);
}

// ==========================================
// RENDERIZAÇÃO DA UI (Listas em Cascata)
// ==========================================
function renderizarListaCategorias(ordenadas, gastos, totalGeral, isThemeChange) {
    const html = ordenadas.map((cat, index) => {
        const valor = gastos[cat];
        const perc = totalGeral > 0 ? ((valor / totalGeral) * 100) : 0;
        const corBase = coresPorCategoria[cat] ? coresPorCategoria[cat].tw : coresPorCategoria['Outros'].tw;
        
        return `
        <div>
            <div class="flex justify-between items-end mb-1.5 md:mb-2 gap-2">
                <span class="text-[11px] md:text-xs font-bold text-slate-700 dark:text-slate-300 truncate flex-1">${cat}</span>
                <div class="text-right flex items-center gap-2 shrink-0">
                    <span class="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500" id="cat-perc-${index}">${perc.toFixed(1)}%</span>
                    <span class="text-xs md:text-sm font-black text-slate-900 dark:text-white whitespace-nowrap" id="cat-val-${index}">${formatarMoedaLocal(valor)}</span>
                </div>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 md:h-2">
                <div id="bar-cat-${index}" class="${corBase} h-1.5 md:h-2 rounded-full ${isThemeChange ? '' : 'transition-all duration-1000 ease-out'} shadow-sm" style="width: ${isThemeChange ? perc + '%' : '0%'}"></div>
            </div>
        </div>
        `;
    }).join('');
    
    document.getElementById('lista-categorias-progress').innerHTML = html || '<p class="text-xs text-slate-400 font-bold">Sem despesas no período.</p>';

    if (!isThemeChange) {
        setTimeout(() => {
            ordenadas.forEach((cat, index) => {
                const valor = gastos[cat];
                const perc = totalGeral > 0 ? ((valor / totalGeral) * 100) : 0;
                const bar = document.getElementById(`bar-cat-${index}`);
                if(bar) bar.style.width = `${perc}%`;
                
                window.animarContador(`cat-val-${index}`, valor, 'moeda', 1000);
                window.animarContador(`cat-perc-${index}`, perc, 'porcentagem', 1000);
            });
        }, 150);
    }
}

// ==========================================
// MOTOR DE GRÁFICOS (DUAL Y-AXIS SÊNIOR)
// ==========================================
function renderizarGraficos(agrupamentoTemporal, gastosPorCategoria, categoriasOrdenadas, gastosPorDiaSemana, isThemeChange) {
    
    const isDark = document.documentElement.classList.contains('dark');
    const corTexto = isDark ? '#94a3b8' : '#64748b'; 
    const corGrid = isDark ? '#1e293b' : '#f1f5f9';  
    const corBordaRosca = isDark ? '#0f172a' : '#ffffff'; 

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = corTexto; 

    const tooltipPro = { 
        backgroundColor: isDark ? '#1e293b' : '#0f172a', 
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        titleFont: { size: 12, family: 'Inter', weight: 'bold' }, 
        bodyFont: { size: 13, family: 'Inter', weight: 'bold' }, 
        padding: 12, cornerRadius: 8, displayColors: true, boxPadding: 4 
    };

    const ctxC = document.getElementById('graficoCombo').getContext('2d');
    if (grafCombo) grafCombo.destroy();

    const chavesTempo = Object.keys(agrupamentoTemporal).sort((a,b) => {
        if(a==='S/D') return -1; if(b==='S/D') return 1; return 1; 
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

    let gradVerde = ctxC.createLinearGradient(0, 0, 0, 400);
    gradVerde.addColorStop(0, '#10b981'); 
    gradVerde.addColorStop(1, isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.5)');

    let gradVermelho = ctxC.createLinearGradient(0, 0, 0, 400);
    gradVermelho.addColorStop(0, '#f43f5e'); 
    gradVermelho.addColorStop(1, isDark ? 'rgba(244,63,94,0.1)' : 'rgba(244,63,94,0.5)');

    grafCombo = new Chart(ctxC, {
        type: 'bar',
        data: {
            labels: labelsT.length > 0 ? labelsT : ['Sem Dados'],
            datasets: [
                {
                    type: 'line', label: 'Saldo Acumulado', data: dadosAcumulados, yAxisID: 'y1',
                    borderColor: '#6366f1', borderWidth: 4, tension: 0.4, 
                    pointBackgroundColor: isDark ? '#0f172a' : '#ffffff', 
                    pointBorderColor: '#6366f1', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6, fill: false
                },
                { type: 'bar', label: 'Entradas', data: dadosRec, backgroundColor: gradVerde, borderRadius: 4, maxBarThickness: 30, yAxisID: 'y' },
                { type: 'bar', label: 'Saídas', data: dadosDes, backgroundColor: gradVermelho, borderRadius: 4, maxBarThickness: 30, yAxisID: 'y' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            animation: isThemeChange ? false : { duration: 1200, easing: 'easeOutQuart' },
            plugins: { legend: { display: false }, tooltip: { ...tooltipPro, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${Math.abs(ctx.raw).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}` } } },
            scales: {
                x: { stacked: true, grid: { display: false }, border: {display: false}, ticks: { font: { size: 11, weight: 'bold' } } },
                y: { 
                    type: 'linear', position: 'left', stacked: true, border: { display: false },
                    grid: { color: corGrid, lineWidth: 1, borderDash: [4, 4] }, 
                    ticks: { font: { size: 10, weight: 'bold' }, callback: (value) => value >= 0 ? `R$ ${value}` : `-R$ ${Math.abs(value)}` } 
                },
                y1: { type: 'linear', position: 'right', display: false, grid: { drawOnChartArea: false } }
            }
        }
    });

    const ctxP = document.getElementById('graficoPizza').getContext('2d');
    if (grafPizza) grafPizza.destroy();

    let lblP = [], datP = [], coresP = [];
    if (categoriasOrdenadas.length === 0) { lblP = ['Vazio']; datP = [1]; coresP = [corGrid]; } 
    else {
        let soma = 0;
        for (let i = 0; i < Math.min(5, categoriasOrdenadas.length); i++) {
            const nomeCat = categoriasOrdenadas[i];
            lblP.push(nomeCat); datP.push(gastosPorCategoria[nomeCat]);
            coresP.push(coresPorCategoria[nomeCat] ? coresPorCategoria[nomeCat].hex : coresPorCategoria['Outros'].hex);
            soma += gastosPorCategoria[nomeCat];
        }
        if (categoriasOrdenadas.length > 5) { 
            const totalGastoGlobal = categoriasOrdenadas.reduce((acc, cat) => acc + gastosPorCategoria[cat], 0);
            lblP.push('Outros'); datP.push(totalGastoGlobal - soma); coresP.push(coresPorCategoria['Outros'].hex); 
        }
    }

    grafPizza = new Chart(ctxP, {
        type: 'doughnut',
        data: { labels: lblP, datasets: [{ data: datP, backgroundColor: coresP, borderWidth: 4, borderColor: corBordaRosca, hoverOffset: 10 }] },
        options: { animation: isThemeChange ? false : { duration: 1200, easing: 'easeOutQuart' }, responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { ...tooltipPro, callbacks: { label: (ctx) => ` ${categoriasOrdenadas.length === 0 ? 'R$ 0,00' : ctx.raw.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}` } } } }
    });

    const ctxR = document.getElementById('graficoRadar').getContext('2d');
    if (grafRadar) grafRadar.destroy();

    let gradRadar = ctxR.createRadialGradient(0, 0, 0, 0, 0, 200);
    gradRadar.addColorStop(0, isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.6)');
    gradRadar.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    grafRadar = new Chart(ctxR, {
        type: 'radar',
        data: {
            labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
            datasets: [{
                label: 'Queima de Caixa',
                data: gastosPorDiaSemana,
                backgroundColor: gradRadar,
                borderColor: '#6366f1',
                borderWidth: 3,
                pointBackgroundColor: isDark ? '#0f172a' : '#ffffff',
                pointBorderColor: '#6366f1',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            animation: isThemeChange ? false : { duration: 1200, easing: 'easeOutQuart' },
            responsive: true, maintainAspectRatio: false,
            scales: {
                r: { angleLines: { color: corGrid }, grid: { color: corGrid, circular: true }, pointLabels: { color: corTexto, font: { family: 'Inter', weight: 'bold', size: 11 } }, ticks: { display: false } }
            },
            plugins: { legend: { display: false }, tooltip: { ...tooltipPro, callbacks: { label: (ctx) => ` R$ ${ctx.raw.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` } } }
        }
    });
}

// ==========================================
// MÓDULO DA INTERFACE DO COACH
// ==========================================
window.toggleCoach = function() {
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

window.enviarMensagemCoach = function() {
    const input = document.getElementById('input-coach');
    const texto = input.value.trim();
    if (!texto) return;

    adicionarMensagemNoChat(texto, true);
    input.value = '';

    const typingDiv = document.createElement('div');
    typingDiv.className = "text-slate-500 text-xs italic mt-2 self-start slide-up-chat flex items-center gap-2";
    typingDiv.id = "coach-typing";
    typingDiv.innerHTML = "<i class='fa-solid fa-circle-notch fa-spin text-indigo-500'></i> Processando...";
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    gerarRespostaIA(texto);
}

async function gerarRespostaIA(pergunta) {
    if (statsGlobais.transacoesNoPeriodo === 0) {
        document.getElementById('coach-typing')?.remove();
        return adicionarMensagemNoChat("O algoritmo requer dados populados para gerar predições.", false);
    }

    const promptDeSistema = `Você é o Consultor IA do DataWallet, um aplicativo financeiro corporativo de elite construído pelo Kauã.
Sua postura é profissional, direta, inteligente e analítica. Evite textos extremamente longos. Vá direto ao ponto.
Sempre formate sua resposta em HTML limpo para exibir na tela web (use <b>, <i>, e <br>). NÃO use Markdown comum como ** ou *.

AQUI ESTÃO OS DADOS REAIS:
- Total Captado: R$ ${statsGlobais.receitas.toFixed(2)}
- Total Queimado: R$ ${statsGlobais.despesas.toFixed(2)}
- Saldo Líquido: R$ ${statsGlobais.saldo.toFixed(2)}
- Retenção: ${statsGlobais.taxaPoupanca.toFixed(1)}%
- Queima Média Diária: R$ ${statsGlobais.mediaDiaria.toFixed(2)} / dia
- Top Categoria Gasto: ${statsGlobais.topCategoria ? statsGlobais.topCategoria.nome : 'Nenhum'}
- Maior gasto isolado: ${statsGlobais.maiorGasto.descricao} (R$ ${statsGlobais.maiorGasto.valor.toFixed(2)})

REGRA ESTRITA: Responda à pergunta do usuário cruzando os dados acima. Aja como um humano sênior.`;

    const payload = { contents: [{ parts: [{ text: promptDeSistema + "\n\nPergunta: " + pergunta }] }] };

    try {
        const chaveLimpa = GEMINI_API_KEY.trim();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${chaveLimpa}`;
        
        const respostaDaNuvem = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

        if (!respostaDaNuvem.ok) {
            const erroDetalhe = await respostaDaNuvem.json();
            throw new Error(erroDetalhe.error?.message || "Erro desconhecido do servidor.");
        }

        const dados = await respostaDaNuvem.json();
        let textoRespostaIA = dados.candidates[0].content.parts[0].text;
        textoRespostaIA = textoRespostaIA.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

        document.getElementById('coach-typing')?.remove();
        adicionarMensagemNoChat(textoRespostaIA, false);

    } catch (erro) {
        document.getElementById('coach-typing')?.remove();
        adicionarMensagemNoChat(`<b class="text-rose-500">Erro:</b><br><i class="text-slate-400">"${erro.message}"</i>`, false);
    }
}
