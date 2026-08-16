// ==========================================

// dashboard.js - MOTOR DE BI COM FALSO 3D E SEM REFRESH FANTASMA

// ==========================================



let usuarioLogado = null;

let transacoesGlobais = [];

let categoriasGlobais = [];



let grafCombo = null;

let grafPizza = null;

let grafRadar = null;



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

    

    // Inicia com "por_mes" ativado

    mudarTipoFiltro();



    document.getElementById('input-coach').addEventListener('keypress', function(e) {

        if (e.key === 'Enter') enviarMensagemCoach();

    });



    await carregarDadosDoBanco();



    // O OLHO DE SAURON (MUTATION OBSERVER): Agora ele recebe o parâmetro 'true' (isThemeChange)

    const observer = new MutationObserver((mutations) => {

        mutations.forEach((mutation) => {

            if (mutation.attributeName === 'class') {

                if (transacoesGlobais.length > 0) {

                    processarEAtualizarTudo(true); // O 'true' mata a ilusão de refresh da página!

                }

            }

        });

    });

    observer.observe(document.documentElement, { attributes: true });

});



// Helper de formatação instantânea (Usado quando a animação está desativada)

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

        transacoesGlobais = rTrans.data || [];

        categoriasGlobais = rCat.data || [];

        processarEAtualizarTudo();

    } catch (e) { console.error("Erro ao puxar dados:", e.message); }

}



window.mudarTipoFiltro = function() {

    const tipo = document.getElementById('filtro-periodo').value;

    document.getElementById('box-mes').classList.add('hidden');

    document.getElementById('box-personalizado').classList.add('hidden');



    if (tipo === 'por_mes') {

        document.getElementById('box-mes').classList.remove('hidden');

    }

    else if (tipo === 'personalizado') {

        document.getElementById('box-personalizado').classList.remove('hidden');

    }



    processarEAtualizarTudo();

}



// O parâmetro 'isThemeChange' evita que tudo zere e rode a roleta na hora do Dark Mode

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

        } else if (tipoFiltro === 'personalizado') {

            const dIni = document.getElementById('input-data-inicio').value;

            const dFim = document.getElementById('input-data-fim').value;

            let valid = true;

            if (dIni) valid = valid && (dStr >= dIni);

            if (dFim) valid = valid && (dStr <= dFim);

            return valid;

        }

        return true; // "tudo" cai aqui

    });



    let totalDespesas = 0, totalReceitas = 0;

    let maiorGasto = { valor: 0, descricao: "Nenhum", categoria: "Nenhuma" };

    const gastosPorCategoria = {};

    const agrupamentoTemporal = {}; 

    let gastosPorDiaSemana = [0, 0, 0, 0, 0, 0, 0];



    // Se o filtro for Tudo ou um período Personalizado muito longo (> 40 dias), agrupa os gráficos por mês. Senão, por dia.

    let agruparPorMes = false;

    if (tipoFiltro === 'tudo') {

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



    // SE NÃO É TROCA DE TEMA: Roda a roleta e a física da barra

    if (!isThemeChange) {

        window.animarContador('kpi-saldo', totalReceitas - totalDespesas, 'moeda', 1000);

        window.animarContador('kpi-receitas', totalReceitas, 'moeda', 1000);

        window.animarContador('kpi-despesas', totalDespesas, 'moeda', 1000);

        window.animarContador('kpi-taxa-texto', taxa, 'porcentagem', 1000);

        

        barra.style.width = '0%';

        setTimeout(() => { barra.style.width = `${percentualBarra}%`; }, 50);

        barra.className = `h-2 rounded-full transition-all duration-1000 shadow-sm ${corTaxa}`;

    } 

    // SE É APENAS TROCA DE TEMA: Altera os valores instataneamente sem rodar as animações para não parecer Refresh

    else {

        document.getElementById('kpi-saldo').innerText = formatarMoedaLocal(totalReceitas - totalDespesas);

        document.getElementById('kpi-receitas').innerText = formatarMoedaLocal(totalReceitas);

        document.getElementById('kpi-despesas').innerText = formatarMoedaLocal(totalDespesas);

        document.getElementById('kpi-taxa-texto').innerText = taxa.toFixed(1) + "%";

        

        barra.style.width = `${percentualBarra}%`;

        barra.className = `h-2 rounded-full shadow-sm ${corTaxa}`; // Sem a classe transition

    }



    renderizarListaCategorias(categoriasOrdenadas, gastosPorCategoria, totalDespesas, isThemeChange);

    renderizarGraficos(agrupamentoTemporal, gastosPorCategoria, categoriasOrdenadas, gastosPorDiaSemana, isThemeChange);

}



// ==========================================

// RENDERIZAÇÃO DA UI (Listas)

// ==========================================

function renderizarListaCategorias(ordenadas, gastos, totalGeral, isThemeChange) {

    const html = ordenadas.map((cat, index) => {

        const valor = gastos[cat];

        const perc = totalGeral > 0 ? ((valor / totalGeral) * 100) : 0;

        const corBase = coresPorCategoria[cat] ? coresPorCategoria[cat].tw : coresPorCategoria['Outros'].tw;

        

        return `

        <div>

            <div class="flex justify-between items-end mb-2 gap-2">

                <span class="text-xs font-bold text-slate-700 dark:text-slate-300 truncate flex-1">${cat}</span>

                <div class="text-right flex items-center gap-2 shrink-0">

                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500" id="cat-perc-${index}">${perc.toFixed(1)}%</span>

                    <span class="text-sm font-black text-slate-900 dark:text-white whitespace-nowrap" id="cat-val-${index}">${formatarMoedaLocal(valor)}</span>

                </div>

            </div>

            <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">

                <div id="bar-cat-${index}" class="${corBase} h-2 rounded-full ${isThemeChange ? '' : 'transition-all duration-1000'} shadow-sm" style="width: ${isThemeChange ? perc + '%' : '0%'}"></div>

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

        }, 50);

    }

}
