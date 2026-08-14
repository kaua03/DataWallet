// ==========================================
// dividas.js - KANBAN SÊNIOR COM DRAG & DROP E TOASTS DISCRETOS
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];
let mostrandoPagas = false;

document.addEventListener('DOMContentLoaded', async () => {
    
    // A MÁGICA DE NAVEGAÇÃO SPA (Anti-Flicker Simétrico)
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
// MOTOR DE ANIMAÇÃO DE CONTAGEM (Roleta)
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
        }
        
        if (progress < 1) requestAnimationFrame(step);
        else {
            if (formato === 'moeda') {
                let parts = Math.abs(valorFinal).toFixed(2).split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                elemento.innerText = (valorFinal < 0 ? "- R$ " : "R$ ") + parts.join(',');
            }
        }
    };
    requestAnimationFrame(step);
};

// ==========================================
// ANIMAÇÃO DO FAB MOBILE (Botão Flutuante)
// ==========================================
let menuMobileAberto = false;
window.toggleMobileMenu = function() {
    const items = document.getElementById('fab-items');
    const icon = document.getElementById('fab-icon');
    const btn = document.getElementById('fab-menu');
    menuMobileAberto = !menuMobileAberto;

    if (menuMobileAberto) {
        items.classList.remove('opacity-0', 'translate-x-12', 'pointer-events-none');
        items.classList.add('opacity-100', 'translate-x-0');
        btn.style.transform = 'rotate(180deg)';
        setTimeout(() => { icon.classList.replace('fa-bars', 'fa-xmark'); }, 150);
        btn.classList.replace('bg-indigo-600', 'bg-slate-800');
        btn.classList.replace('shadow-[0_4px_20px_rgba(79,70,229,0.5)]', 'shadow-[0_4px_20px_rgba(30,41,59,0.5)]');
    } else {
        items.classList.add('opacity-0', 'translate-x-12', 'pointer-events-none');
        items.classList.remove('opacity-100', 'translate-x-0');
        btn.style.transform = 'rotate(0deg)';
        setTimeout(() => { icon.classList.replace('fa-xmark', 'fa-bars'); }, 150);
        btn.classList.replace('bg-slate-800', 'bg-indigo-600');
        btn.classList.replace('shadow-[0_4px_20px_rgba(30,41,59,0.5)]', 'shadow-[0_4px_20px_rgba(79,70,229,0.5)]');
    }
};

// ==========================================
// ARRASTAR PRANCHA KANBAN NO PC
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
            categoriasGlobais.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

        processarEAtualizarKanban();

    } catch (e) { console.error("Erro ao puxar dados:", e.message); }
}

function processarEAtualizarKanban() {
    const hojeData = new Date();
    hojeData.setHours(0, 0, 0, 0); 
    const mesAtual = hojeData.getMonth(); const anoAtual = hojeData.getFullYear();

    const agrupamentos = { 'Atrasadas': [], 'Este Mês': [], 'Próximos Meses': [], 'Histórico de Pagas': [] };
    let totAtrasadas = 0, totMes = 0, totFuturo = 0, totPagas = 0;

    transacoesGlobais.forEach(t => {
        if (!t.data_vencimento) return; 
        
        const isPago = t.pago === true; 

        if (isPago) {
            totPagas += t.valor;
            agrupamentos['Histórico de Pagas'].push(t);
            return; 
        }

        const dVenc = new Date(t.data_vencimento + 'T12:00:00Z');
        dVenc.setHours(0, 0, 0, 0);
        
        const mesVenc = dVenc.getMonth(); const anoVenc = dVenc.getFullYear();

        if (dVenc < hojeData) { agrupamentos['Atrasadas'].push(t); totAtrasadas += t.valor; } 
        else if (mesVenc === mesAtual && anoVenc === anoAtual) { agrupamentos['Este Mês'].push(t); totMes += t.valor; } 
        else { agrupamentos['Próximos Meses'].push(t); totFuturo += t.valor; }
    });

    // Roleta Sênior para as Dívidas
    window.animarContador('kpi-atrasadas', totAtrasadas, 'moeda', 800);
    window.animarContador('kpi-mes', totMes, 'moeda', 800);
    window.animarContador('kpi-futuro', totFuturo, 'moeda', 800);
    window.animarContador('kpi-pagas', totPagas, 'moeda', 800);

    renderizarColunas(agrupamentos);
}

// ==========================================
// RENDERIZAÇÃO E MOTOR DRAG & DROP KANBAN
// ==========================================
function renderizarColunas(agrupamentos) {
    const board = document.getElementById('board-dividas');
    let html = '';

    const mesesExtenso = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const ordemColunas = ['Atrasadas', 'Este Mês', 'Próximos Meses', 'Histórico de Pagas'];

    ordemColunas.forEach(nomeColuna => {
        const transacoesDaColuna = agrupamentos[nomeColuna];
        
        let config = { icon: 'fa-calendar-day', titleColor: 'slate-600', badgeColor: 'bg-slate-200 text-slate-600' };
        if (nomeColuna === 'Atrasadas') config = { icon: 'fa-circle-exclamation', titleColor: 'rose-600', badgeColor: 'bg-rose-100 text-rose-600' };
        if (nomeColuna === 'Este Mês') config = { icon: 'fa-calendar-check', titleColor: 'indigo-600', badgeColor: 'bg-indigo-100 text-indigo-600' };
        if (nomeColuna === 'Próximos Meses') config = { icon: 'fa-forward-fast', titleColor: 'slate-500', badgeColor: 'bg-slate-200 text-slate-600' };
        if (nomeColuna === 'Histórico de Pagas') config = { icon: 'fa-check-double', titleColor: 'emerald-600', badgeColor: 'bg-emerald-100 text-emerald-600' };

        const idColunaSanitizado = 'col_' + nomeColuna.replace(/\s+/g, '').replace(/\//g, '');

        let cardsHtml = '';
        if (transacoesDaColuna.length === 0) {
            cardsHtml = `<div class="text-center py-8 opacity-50"><i class="fa-solid fa-wind text-2xl text-slate-300 mb-2"></i><p class="text-[10px] font-bold text-slate-400 uppercase">Tudo Limpo</p></div>`;
        } else {
            let mesAnoCorrente = ''; 
            cardsHtml = transacoesDaColuna.map(d => {
                const isPago = d.pago === true;
                const dVencObj = new Date(d.data_vencimento + 'T12:00:00Z');
                const dataStr = dVencObj.toLocaleDateString('pt-BR');
                const mesAnoAtualDoCard = `${mesesExtenso[dVencObj.getMonth()]} ${dVencObj.getFullYear()}`;
                
                let htmlDivisor = '';
                if ((nomeColuna === 'Próximos Meses' || nomeColuna === 'Histórico de Pagas') && mesAnoAtualDoCard !== mesAnoCorrente) {
                    htmlDivisor = `
                    <div class="divisor-mes flex items-center gap-3 mt-6 mb-3 first:mt-1 cursor-default pointer-events-none">
                        <div class="h-px bg-slate-200/80 flex-1"></div>
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${mesAnoAtualDoCard}</span>
                        <div class="h-px bg-slate-200/80 flex-1"></div>
                    </div>`;
                    mesAnoCorrente = mesAnoAtualDoCard;
                }
                
                const btnAcao = isPago 
                    ? `<button onclick="window.alterarStatusPagamento(${d.id}, false)" title="Desfazer" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition flex items-center justify-center shadow-sm shrink-0"><i class="fa-solid fa-rotate-left"></i></button>`
                    : `<button onclick="window.alterarStatusPagamento(${d.id}, true)" title="Quitar" class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white transition flex items-center justify-center shadow-sm shrink-0"><i class="fa-solid fa-check"></i></button>`;

                const classeTraco = isPago ? 'line-through text-slate-400' : 'text-slate-800';
                const corData = nomeColuna === 'Atrasadas' && !isPago ? 'text-rose-500' : 'text-slate-400';
                const corValor = nomeColuna === 'Atrasadas' && !isPago ? 'text-rose-600' : 'text-slate-900';

                const cardHtmlCru = `
                <div data-id="${d.id}" class="bg-white rounded-2xl p-4 mb-3 border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:shadow-md transition-all group flex flex-col gap-3 cursor-grab">
                    <div class="flex justify-between items-start gap-3 w-full">
                        <h4 class="font-bold text-xs ${classeTraco} leading-tight break-words whitespace-normal mt-0.5 flex-1">${d.descricao}</h4>
                        <span class="font-black text-sm ${corValor} whitespace-nowrap shrink-0">${formatarMoeda(d.valor)}</span>
                    </div>
                    <div class="flex items-center justify-between w-full">
                        <div class="flex items-center gap-1.5 text-[11px] font-bold ${corData}">
                            <i class="fa-regular fa-calendar"></i> <span>${dataStr}</span>
                        </div>
                        
                        <div class="flex items-center gap-1">
                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="window.abrirModalEdicao(${d.id})" title="Editar" class="w-7 h-7 rounded bg-slate-50 text-slate-400 hover:bg-indigo-500 hover:text-white transition flex items-center justify-center shrink-0"><i class="fa-solid fa-pen text-[10px]"></i></button>
                                <button onclick="window.excluirDivida(${d.id})" title="Excluir" class="w-7 h-7 rounded bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white transition flex items-center justify-center mr-1 shrink-0"><i class="fa-solid fa-trash text-[10px]"></i></button>
                            </div>
                            ${btnAcao}
                        </div>
                    </div>
                </div>`;

                return htmlDivisor + cardHtmlCru;
            }).join('');
        }

        html += `
        <div id="${idColunaSanitizado}" class="w-[340px] shrink-0 bg-slate-100/50 rounded-2xl border border-slate-200/60 flex flex-col max-h-full transition-all duration-300 relative">
            <div onclick="window.toggleColuna('${idColunaSanitizado}')" class="p-4 border-b border-slate-200/80 flex justify-between items-center bg-white rounded-t-2xl shrink-0 cursor-pointer hover:bg-slate-50 transition relative z-10">
                <div class="esconder-no-min flex items-center gap-2">
                    <i class="fa-solid ${config.icon} text-${config.titleColor}"></i>
                    <h3 class="font-bold text-${config.titleColor} text-sm">${nomeColuna}</h3>
                </div>
                
                <div class="hidden mostrar-no-min flex-col items-center justify-start w-full gap-3 pt-2">
                    <span class="${config.badgeColor} text-[10px] font-black px-2 py-1 rounded-md shadow-sm">${transacoesDaColuna.length}</span>
                    <h3 class="font-black text-slate-400 text-xs tracking-widest uppercase transform rotate-180" style="writing-mode: vertical-rl;">${nomeColuna}</h3>
                </div>
                
                <div class="esconder-no-min flex items-center gap-2">
                    <span class="${config.badgeColor} text-[10px] font-black px-2 py-1 rounded-md shadow-sm">${transacoesDaColuna.length}</span>
                    <i class="fa-solid fa-chevron-left text-slate-300 text-xs transition-transform transform -rotate-90"></i>
                </div>
            </div>

            <div class="esconder-no-min p-3 flex-1 overflow-y-auto coluna-scroll pb-6" id="lista-cards-${idColunaSanitizado}">
                ${cardsHtml}
            </div>
        </div>`;
    });

    board.innerHTML = html;

    // INJEÇÃO DA BIBLIOTECA SORTABLE.JS NAS COLUNAS (O SEGREDO DO DRAG & DROP)
    ordemColunas.forEach(nomeColuna => {
        const idColunaSanitizado = 'col_' + nomeColuna.replace(/\s+/g, '').replace(/\//g, '');
        const el = document.getElementById(`lista-cards-${idColunaSanitizado}`);
        
        if(el && el.innerHTML.indexOf('Tudo Limpo') === -1) {
            new Sortable(el, {
                group: 'kanban', // Permite arrastar entre colunas
                animation: 150,
                ghostClass: 'sortable-ghost',
                filter: '.divisor-mes', // Impede que os textos divisores de mês sejam arrastados
                onMove: function (evt) { return evt.related.className.indexOf('divisor-mes') === -1; },
                onEnd: async function (evt) {
                    const idTransacao = evt.item.getAttribute('data-id');
                    const colunaDestino = evt.to.id;
                    const colunaOrigem = evt.from.id;

                    if (colunaDestino !== colunaOrigem) {
                        // Regra de Negócio: Se jogou no "Histórico de Pagas", vira PAGO.
                        if (colunaDestino === 'lista-cards-col_HistóricodePagas') {
                            await window.alterarStatusPagamento(idTransacao, true, true);
                        } 
                        // Se tirou do "Histórico de Pagas", vira PENDENTE.
                        else if (colunaOrigem === 'lista-cards-col_HistóricodePagas') {
                            await window.alterarStatusPagamento(idTransacao, false, true);
                        } 
                        // Se tentou pular entre Atrasado/MêsAtual sem pagar, avisa que a coluna é cravada na data.
                        else {
                            Swal.fire({
                                icon: 'info',
                                title: 'Regra de Sistema',
                                text: 'Para mover entre colunas pendentes, clique no lápis e edite a Data de Vencimento.',
                                confirmButtonColor: '#4f46e5'
                            });
                            processarEAtualizarKanban(); // Devolve o card pro lugar original magicamente
                        }
                    }
                },
            });
        }
    });
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

window.alterarStatusPagamento = async function(idTransacao, novoStatusPago, isDragAndDrop = false) {
    try {
        const { error } = await supabaseClient.from('transacoes').update({ pago: novoStatusPago }).eq('id', idTransacao);
        if (error) throw error;
        
        const idx = transacoesGlobais.findIndex(t => t.id == idTransacao);
        if (idx !== -1) transacoesGlobais[idx].pago = novoStatusPago;
        
        processarEAtualizarKanban();
        
        if (!isDragAndDrop && novoStatusPago) {
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true });
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
    const confirmacao = await Swal.fire({
        title: 'Excluir Transação?',
        text: "Essa ação apagará este registo permanentemente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sim, excluir'
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

        // TOAST DISCRETO EM VEZ DO LOTTIE CELEBRATIVO
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
        Toast.fire({
            icon: 'success',
            title: 'Registo guardado!'
        });

    } catch (e) {
        Swal.fire('Erro', e.message, 'error');
    } finally {
        btn.innerHTML = conteudoOriginal;
        btn.disabled = false;
    }
};
