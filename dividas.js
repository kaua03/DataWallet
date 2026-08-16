// ==========================================
// dividas.js - ERP KANBAN SEGURO (SEM DRAG & DROP DE CARDS)
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];

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

    document.getElementById('divida-data').value = new Date().toISOString().split('T')[0];
    await carregarDadosDoBanco();
    iniciarDragToScroll(); 
});

// ==========================================
// MOTOR DE FÍSICA E ANIMAÇÃO DE CONTADORES
// ==========================================
window.animarContador = function(id, valorFinal, formato = 'moeda', duracao = 1000) {
    const elemento = document.getElementById(id);
    if (!elemento) return;
    
    const startTimestamp = performance.now();
    const step = (currentTimestamp) => {
        const progress = Math.min((currentTimestamp - startTimestamp) / duracao, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4); 
        const valorAtual = easeProgress * valorFinal;
        
        if (formato === 'moeda') {
            let parts = Math.abs(valorAtual).toFixed(2).split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            elemento.innerText = (valorAtual < 0 ? "- R$ " : "R$ ") + parts.join(',');
        } else if (formato === 'porcentagem') {
            elemento.innerText = valorAtual.toFixed(1) + "%";
        }
        
        if (progress < 1) requestAnimationFrame(step);
        else {
            if (formato === 'moeda') {
                let parts = Math.abs(valorFinal).toFixed(2).split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                elemento.innerText = (valorFinal < 0 ? "- R$ " : "R$ ") + parts.join(',');
            } else if (formato === 'porcentagem') {
                elemento.innerText = valorFinal.toFixed(1) + "%";
            }
        }
    };
    requestAnimationFrame(step);
};

// ==========================================
// ARRASTAR PRANCHA KANBAN (NÃO OS CARDS)
// ==========================================
function iniciarDragToScroll() {
    const slider = document.getElementById('container-scroll');
    if(!slider) return;
    let isDown = false; let startX; let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true; slider.classList.add('cursor-grabbing'); slider.classList.remove('cursor-grab');
        startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => {
        isDown = false; slider.classList.remove('cursor-grabbing'); slider.classList.add('cursor-grab');
    });
    slider.addEventListener('mouseup', () => {
        isDown = false; slider.classList.remove('cursor-grabbing'); slider.classList.add('cursor-grab');
    });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return; e.preventDefault();
        const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 1.5; 
        slider.scrollLeft = scrollLeft - walk;
    });
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

async function carregarDadosDoBanco() {
    try {
        const [rTrans, rCat] = await Promise.all([
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id).eq('tipo', 'despesa').order('data_vencimento', { ascending: true }),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id)
        ]);

        transacoesGlobais = rTrans.data || [];
        categoriasGlobais = rCat.data || [];

        const selectCat = document.getElementById('divida-categoria');
        selectCat.innerHTML = '<option value="" disabled selected>Selecione uma pasta...</option>' + 
            categoriasGlobais.map(c => `<option class="bg-white dark:bg-slate-800 text-slate-900 dark:text-white" value="${c.id}">${c.nome}</option>`).join('');

        processarEAtualizarKanban();

    } catch (e) { console.error("Erro ao puxar dados:", e.message); }
}

function processarEAtualizarKanban() {
    const hojeData = new Date();
    hojeData.setHours(0, 0, 0, 0); 
    const mesAtual = hojeData.getMonth(); const anoAtual = hojeData.getFullYear();

    const agrupamentos = { 'Atrasadas': [], 'Este Mês': [], 'Próximos Meses': [], 'Histórico de Pagas': [] };
    
    let totAtrasadas = 0, totRisco7Dias = 0, totEmAberto = 0, totPagas = 0;

    transacoesGlobais.forEach(t => {
        if (!t.data_vencimento) return; 
        
        const isPago = t.pago === true; 
        const dVenc = new Date(t.data_vencimento + 'T12:00:00Z');
        dVenc.setHours(0, 0, 0, 0);
        
        const mesVenc = dVenc.getMonth(); const anoVenc = dVenc.getFullYear();
        
        const diffTime = dVenc - hojeData;
        const diasDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        t.diasDiff = diasDiff;

        if (isPago) {
            totPagas += t.valor;
            agrupamentos['Histórico de Pagas'].push(t);
        } else {
            totEmAberto += t.valor;
            
            if (diasDiff >= 0 && diasDiff <= 7) {
                totRisco7Dias += t.valor;
            }

            if (diasDiff < 0) { 
                agrupamentos['Atrasadas'].push(t); 
                totAtrasadas += t.valor; 
            } 
            else if (mesVenc === mesAtual && anoVenc === anoAtual) { 
                agrupamentos['Este Mês'].push(t); 
            } 
            else { 
                agrupamentos['Próximos Meses'].push(t); 
            }
        }
    });

    window.animarContador('kpi-atrasadas', totAtrasadas, 'moeda', 800);
    window.animarContador('kpi-risco', totRisco7Dias, 'moeda', 800);
    window.animarContador('kpi-aberto', totEmAberto, 'moeda', 800);
    window.animarContador('kpi-pagas', totPagas, 'moeda', 800);

    renderizarColunas(agrupamentos);
}

// ==========================================
// RENDERIZAÇÃO KANBAN ERP (Sem Arrastar Cards)
// ==========================================
function renderizarColunas(agrupamentos) {
    const board = document.getElementById('board-dividas');
    let html = '';

    const mesesExtenso = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const ordemColunas = ['Atrasadas', 'Este Mês', 'Próximos Meses', 'Histórico de Pagas'];

    ordemColunas.forEach(nomeColuna => {
        const transacoesDaColuna = agrupamentos[nomeColuna];
        
        let config = { icon: 'fa-calendar-day', titleColor: 'slate-600 dark:text-slate-300', badgeColor: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300', borderColor: 'border-slate-200/60 dark:border-slate-700' };
        if (nomeColuna === 'Atrasadas') config = { icon: 'fa-circle-exclamation', titleColor: 'rose-600 dark:text-rose-400', badgeColor: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400', borderColor: 'border-rose-200/60 dark:border-rose-500/30' };
        if (nomeColuna === 'Este Mês') config = { icon: 'fa-calendar-check', titleColor: 'indigo-600 dark:text-indigo-400', badgeColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400', borderColor: 'border-indigo-200/60 dark:border-indigo-500/30' };
        if (nomeColuna === 'Próximos Meses') config = { icon: 'fa-forward-fast', titleColor: 'slate-500 dark:text-slate-400', badgeColor: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400', borderColor: 'border-slate-200/60 dark:border-slate-700' };
        if (nomeColuna === 'Histórico de Pagas') config = { icon: 'fa-check-double', titleColor: 'emerald-600 dark:text-emerald-400', badgeColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400', borderColor: 'border-emerald-200/60 dark:border-emerald-500/30' };

        const idColunaSanitizado = 'col_' + nomeColuna.replace(/\s+/g, '').replace(/\//g, '');

        let cardsHtml = '';
        if (transacoesDaColuna.length === 0) {
            cardsHtml = `<div class="text-center py-8 opacity-50"><i class="fa-solid fa-wind text-2xl text-slate-300 dark:text-slate-600 mb-2"></i><p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tudo Limpo</p></div>`;
        } else {
            let mesAnoCorrente = ''; 
            cardsHtml = transacoesDaColuna.map(d => {
                const isPago = d.pago === true;
                const dVencObj = new Date(d.data_vencimento + 'T12:00:00Z');
                const dataStr = dVencObj.toLocaleDateString('pt-BR').substring(0, 5); 
                const mesAnoAtualDoCard = `${mesesExtenso[dVencObj.getMonth()]} ${dVencObj.getFullYear()}`;
                
                let htmlDivisor = '';
                if ((nomeColuna === 'Próximos Meses' || nomeColuna === 'Histórico de Pagas') && mesAnoAtualDoCard !== mesAnoCorrente) {
                    htmlDivisor = `
                    <div class="divisor-mes flex items-center gap-3 mt-6 mb-3 first:mt-1 cursor-default pointer-events-none">
                        <div class="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                        <span class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">${mesAnoAtualDoCard}</span>
                        <div class="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                    </div>`;
                    mesAnoCorrente = mesAnoAtualDoCard;
                }
                
                let badgeUrgencia = '';
                if (!isPago) {
                    if (d.diasDiff < 0) badgeUrgencia = `<span class="bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase">Atrasado ${Math.abs(d.diasDiff)}d</span>`;
                    else if (d.diasDiff === 0) badgeUrgencia = `<span class="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase">Vence Hoje</span>`;
                    else if (d.diasDiff <= 7) badgeUrgencia = `<span class="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase">Vence em ${d.diasDiff}d</span>`;
                }

                const btnAcao = isPago 
                    ? `<button onclick="window.alterarStatusPagamento(${d.id}, false)" title="Desfazer" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition flex items-center justify-center shadow-sm shrink-0 border border-slate-200 dark:border-slate-700"><i class="fa-solid fa-rotate-left"></i></button>`
                    : `<button onclick="window.alterarStatusPagamento(${d.id}, true)" title="Quitar" class="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition flex items-center justify-center shadow-sm shrink-0 border border-emerald-200 dark:border-emerald-500/30"><i class="fa-solid fa-check"></i></button>`;

                const classeTraco = isPago ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200';
                const corData = nomeColuna === 'Atrasadas' && !isPago ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500';
                const corValor = nomeColuna === 'Atrasadas' && !isPago ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white';

                const cardHtmlCru = `
                <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 mb-3 border border-slate-200/60 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:shadow-md transition-all group flex flex-col gap-3">
                    <div class="flex justify-between items-start gap-3 w-full">
                        <h4 class="font-bold text-xs ${classeTraco} leading-tight break-words whitespace-normal mt-0.5 flex-1">${d.descricao}</h4>
                        <span class="font-black text-sm ${corValor} whitespace-nowrap shrink-0">R$ ${d.valor.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="flex items-center justify-between w-full">
                        <div class="flex items-center gap-2 text-[11px] font-bold ${corData}">
                            <div class="flex items-center gap-1.5"><i class="fa-regular fa-calendar"></i> <span>${dataStr}</span></div>
                            ${badgeUrgencia}
                        </div>
                        
                        <div class="flex items-center gap-1.5">
                            <div class="flex items-center gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="window.abrirModalEdicao(${d.id})" title="Editar" class="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-indigo-500 hover:text-white transition flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700"><i class="fa-solid fa-pen text-[10px]"></i></button>
                                <button onclick="window.excluirDivida(${d.id})" title="Excluir" class="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700"><i class="fa-solid fa-trash text-[10px]"></i></button>
                            </div>
                            <div class="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 hidden md:block"></div>
                            ${btnAcao}
                        </div>
                    </div>
                </div>`;

                return htmlDivisor + cardHtmlCru;
            }).join('');
        }

        html += `
        <div id="${idColunaSanitizado}" class="w-[300px] md:w-[340px] shrink-0 bg-slate-100/50 dark:bg-slate-800/20 rounded-3xl ${config.borderColor} border flex flex-col max-h-full transition-all duration-300 relative">
            <div onclick="window.toggleColuna('${idColunaSanitizado}')" class="p-4 border-b border-slate-200/80 dark:border-slate-700/50 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-3xl shrink-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition relative z-10">
                <div class="esconder-no-min flex items-center gap-2">
                    <i class="fa-solid ${config.icon} ${config.titleColor}"></i>
                    <h3 class="font-bold ${config.titleColor} text-sm">${nomeColuna}</h3>
                </div>
                
                <div class="hidden mostrar-no-min flex-col items-center justify-start w-full gap-3 pt-2">
                    <span class="${config.badgeColor} text-[10px] font-black px-2 py-1 rounded-md shadow-sm">${transacoesDaColuna.length}</span>
                    <h3 class="font-black text-slate-400 dark:text-slate-500 text-xs tracking-widest uppercase transform rotate-180" style="writing-mode: vertical-rl;">${nomeColuna}</h3>
                </div>
                
                <div class="esconder-no-min flex items-center gap-2">
                    <span class="${config.badgeColor} text-[10px] font-black px-2 py-1 rounded-md shadow-sm">${transacoesDaColuna.length}</span>
                    <i class="fa-solid fa-chevron-left text-slate-300 dark:text-slate-600 text-xs transition-transform transform -rotate-90"></i>
                </div>
            </div>

            <div class="esconder-no-min p-3 flex-1 overflow-y-auto coluna-scroll pb-6" id="lista-cards-${idColunaSanitizado}">
                ${cardsHtml}
            </div>
        </div>`;
    });

    board.innerHTML = html;
}

window.toggleColuna = function(id) {
    const col = document.getElementById(id);
    col.classList.toggle('coluna-minimizada');
    const icone = col.querySelector('.fa-chevron-left');
    if(icone) {
        if(col.classList.contains('coluna-minimizada')) icone.classList.replace('-rotate-90', 'rotate-180');
        else icone.classList.replace('rotate-180', '-rotate-90');
    }
};

window.alterarStatusPagamento = async function(idTransacao, novoStatusPago) {
    try {
        const { error } = await supabaseClient.from('transacoes').update({ pago: novoStatusPago }).eq('id', idTransacao);
        if (error) throw error;
        
        const idx = transacoesGlobais.findIndex(t => t.id == idTransacao);
        if (idx !== -1) transacoesGlobais[idx].pago = novoStatusPago;
        
        processarEAtualizarKanban();
        
        if (novoStatusPago) {
            const isDark = document.documentElement.classList.contains('dark');
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true, background: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#1e293b' });
            Toast.fire({ icon: 'success', title: 'Conta Liquidada!' });
        }
    } catch (e) { 
        Swal.fire('Erro', e.message, 'error'); 
    }
};

window.abrirModalNovaDivida = function() { 
    document.getElementById('form-divida').reset();
    document.getElementById('divida-id').value = ''; 
    document.getElementById('modal-titulo').innerHTML = '<i class="fa-solid fa-file-signature text-indigo-500"></i> Lançar Contas';
    document.getElementById('modal-subtitulo').innerText = 'Contas ou parcelamentos lançados aqui entram como "Pendentes".';
    document.getElementById('wrapper-parcelas').classList.remove('hidden');
    document.getElementById('wrapper-categoria').classList.replace('col-span-3', 'col-span-2');
    document.getElementById('divida-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-divida').classList.remove('hidden'); 
};

window.abrirModalEdicao = function(idTransacao) {
    const t = transacoesGlobais.find(x => x.id == idTransacao);
    if (!t) return;
    document.getElementById('divida-id').value = t.id;
    document.getElementById('divida-desc').value = t.descricao;
    
    let valorStr = t.valor.toFixed(2).replace('.', ',');
    valorStr = valorStr.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    valorStr = valorStr.replace(/(\d)(\d{3}),/g, "$1.$2,");
    document.getElementById('divida-valor').value = valorStr;
    
    document.getElementById('divida-data').value = t.data_vencimento;
    document.getElementById('divida-categoria').value = t.categoria_id;

    document.getElementById('modal-titulo').innerHTML = '<i class="fa-solid fa-pen text-indigo-500"></i> Editar Parcela';
    document.getElementById('modal-subtitulo').innerText = 'Altere as informações deste lançamento específico.';
    document.getElementById('wrapper-parcelas').classList.add('hidden');
    document.getElementById('wrapper-categoria').classList.replace('col-span-2', 'col-span-3');
    document.getElementById('modal-divida').classList.remove('hidden');
};

window.fecharModalNovaDivida = function() { document.getElementById('modal-divida').classList.add('hidden'); };

window.excluirDivida = async function(idTransacao) {
    const isDark = document.documentElement.classList.contains('dark');
    const confirmacao = await Swal.fire({
        title: 'Excluir Transação?',
        text: "Essa ação apagará este registro permanentemente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sim, excluir',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#fff' : '#1e293b'
    });

    if(!confirmacao.isConfirmed) return;

    try {
        const { error } = await supabaseClient.from('transacoes').delete().eq('id', idTransacao);
        if (error) throw error;
        transacoesGlobais = transacoesGlobais.filter(t => t.id != idTransacao);
        processarEAtualizarKanban();
    } catch (e) { Swal.fire('Erro', e.message, 'error'); }
};

window.salvarDivida = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-salvar-divida');
    const conteudoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    const idExistente = document.getElementById('divida-id').value;
    const descBase = document.getElementById('divida-desc').value;
    const valorFloat = desmascararMoeda(document.getElementById('divida-valor').value);
    const dataInicialISO = document.getElementById('divida-data').value;
    const catId = document.getElementById('divida-categoria').value;

    if (valorFloat <= 0) {
        Swal.fire('Aviso', 'O valor não pode ser zero.', 'warning');
        btn.innerHTML = conteudoOriginal; btn.disabled = false; return;
    }

    try {
        if (idExistente) {
            const { data, error } = await supabaseClient.from('transacoes').update({
                descricao: descBase, valor: valorFloat, data_vencimento: dataInicialISO, categoria_id: catId
            }).eq('id', idExistente).select();

            if (error) throw error;
            const idx = transacoesGlobais.findIndex(t => t.id == idExistente);
            if (idx !== -1 && data && data.length > 0) transacoesGlobais[idx] = data[0];
            
            transacoesGlobais.sort((a,b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));

        } else {
            const qtdParcelas = parseInt(document.getElementById('divida-parcelas').value) || 1;
            let loteInsercao = [];

            for (let i = 0; i < qtdParcelas; i++) {
                let dataCalc = new Date(dataInicialISO + 'T12:00:00Z');
                let diaOriginal = dataCalc.getDate();
                dataCalc.setMonth(dataCalc.getMonth() + i);
                if (dataCalc.getDate() !== diaOriginal) dataCalc.setDate(0); 

                let dataFormatada = dataCalc.toISOString().split('T')[0];
                let descFinal = qtdParcelas > 1 ? `${descBase} (${i + 1}/${qtdParcelas})` : descBase;

                loteInsercao.push({
                    usuario_id: usuarioLogado.id, tipo: 'despesa', descricao: descFinal, valor: valorFloat, data_vencimento: dataFormatada, categoria_id: catId, pago: false
                });
            }

            const { data, error } = await supabaseClient.from('transacoes').insert(loteInsercao).select();
            if (error) throw error;
            if(data) {
                transacoesGlobais.push(...data);
                transacoesGlobais.sort((a,b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
            }
        }
        
        window.fecharModalNovaDivida();
        processarEAtualizarKanban();

        const isDark = document.documentElement.classList.contains('dark');
        const Toast = Swal.mixin({
            toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true, background: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#1e293b'
        });
        Toast.fire({ icon: 'success', title: 'Registro guardado!' });

    } catch (e) {
        Swal.fire('Erro', e.message, 'error');
    } finally {
        btn.innerHTML = conteudoOriginal;
        btn.disabled = false;
    }
};
