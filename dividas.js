// ==========================================
// dividas.js - MOTOR KANBAN DE PASSIVOS SÊNIOR
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];
let mostrandoPagas = false;

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    document.getElementById('divida-data').value = new Date().toISOString().split('T')[0];
    await carregarDadosDoBanco();
    iniciarDragToScroll(); // Inicia o motor de arrastar a tela
});

// ==========================================
// MOTOR UX: DRAG TO SCROLL (Arrastar para os lados)
// ==========================================
function iniciarDragToScroll() {
    const slider = document.getElementById('container-scroll');
    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('cursor-grabbing');
        slider.classList.remove('cursor-grab');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.classList.remove('cursor-grabbing');
        slider.classList.add('cursor-grab');
    });

    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.classList.remove('cursor-grabbing');
        slider.classList.add('cursor-grab');
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 1.5; // Velocidade do arraste
        slider.scrollLeft = scrollLeft - walk;
    });
}

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
    
    const mesAtual = hojeData.getMonth();
    const anoAtual = hojeData.getFullYear();

    const agrupamentos = {};
    let totAtrasadas = 0, totMes = 0, totFuturo = 0, totPagas = 0;

    if(!mostrandoPagas) {
        agrupamentos['Atrasadas'] = [];
        agrupamentos['Este Mês'] = [];
    }

    const mesesAbv = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    transacoesGlobais.forEach(t => {
        if (!t.data_vencimento) return; 
        
        const isPago = t.pago === true; 

        if (isPago) {
            totPagas += t.valor;
            if (mostrandoPagas) {
                const dVenc = new Date(t.data_vencimento + 'T12:00:00Z');
                const label = `${mesesAbv[dVenc.getMonth()]} / ${dVenc.getFullYear()}`;
                if (!agrupamentos[label]) agrupamentos[label] = [];
                agrupamentos[label].push(t);
            }
            return; 
        }

        if (!mostrandoPagas) {
            const dVenc = new Date(t.data_vencimento + 'T12:00:00Z');
            dVenc.setHours(0, 0, 0, 0);
            const mesVenc = dVenc.getMonth();
            const anoVenc = dVenc.getFullYear();

            if (dVenc < hojeData) {
                agrupamentos['Atrasadas'].push(t);
                totAtrasadas += t.valor;
            } 
            else if (mesVenc === mesAtual && anoVenc === anoAtual) {
                agrupamentos['Este Mês'].push(t);
                totMes += t.valor;
            } 
            else {
                const label = `${mesesAbv[mesVenc]} / ${anoVenc}`;
                if (!agrupamentos[label]) agrupamentos[label] = [];
                agrupamentos[label].push(t);
                totFuturo += t.valor;
            }
        }
    });

    document.getElementById('kpi-atrasadas').innerText = formatarMoeda(totAtrasadas);
    document.getElementById('kpi-mes').innerText = formatarMoeda(totMes);
    document.getElementById('kpi-futuro').innerText = formatarMoeda(totFuturo);
    document.getElementById('kpi-pagas').innerText = formatarMoeda(totPagas);

    renderizarColunas(agrupamentos);
}

// ---------------------------------------------
// RENDERIZAÇÃO DO HTML
// ---------------------------------------------
function renderizarColunas(agrupamentos) {
    const board = document.getElementById('board-dividas');
    let html = '';

    const chavesParaRenderizar = Object.keys(agrupamentos).filter(k => 
        k === 'Atrasadas' || k === 'Este Mês' || agrupamentos[k].length > 0
    );

    if(chavesParaRenderizar.length === 0) {
        board.innerHTML = `<div class="w-full text-center mt-20 text-slate-400 font-bold"><i class="fa-solid fa-mug-hot text-2xl mb-2"></i><br>Nenhum registro encontrado nesta visão.</div>`;
        return;
    }

    chavesParaRenderizar.forEach(nomeColuna => {
        const transacoesDaColuna = agrupamentos[nomeColuna];
        const somaColuna = transacoesDaColuna.reduce((acc, t) => acc + t.valor, 0);
        
        let config = { icon: 'fa-calendar-day', titleColor: 'slate-600', badgeColor: 'bg-slate-200 text-slate-600' };
        
        if (mostrandoPagas) {
            config = { icon: 'fa-check-circle', titleColor: 'emerald-600', badgeColor: 'bg-emerald-100 text-emerald-600' };
        } else {
            if (nomeColuna === 'Atrasadas') config = { icon: 'fa-circle-exclamation', titleColor: 'rose-600', badgeColor: 'bg-rose-100 text-rose-600' };
            if (nomeColuna === 'Este Mês') config = { icon: 'fa-calendar-check', titleColor: 'indigo-600', badgeColor: 'bg-indigo-100 text-indigo-600' };
        }

        const idColunaSanitizado = 'col_' + nomeColuna.replace(/\s+/g, '').replace(/\//g, '');

        let cardsHtml = '';
        if (transacoesDaColuna.length === 0) {
            cardsHtml = `<div class="text-center py-8 opacity-50"><i class="fa-solid fa-wind text-2xl text-slate-300 mb-2"></i><p class="text-[10px] font-bold text-slate-400 uppercase">Tudo Limpo</p></div>`;
        } else {
            cardsHtml = transacoesDaColuna.map(d => {
                const dataStr = d.data_vencimento.split('-').reverse().join('/');
                const isPago = d.pago === true;
                
                // Botão de check principal
                const btnAcao = isPago 
                    ? `<button onclick="alterarStatusPagamento(${d.id}, false)" title="Desfazer" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition flex items-center justify-center shadow-sm"><i class="fa-solid fa-rotate-left"></i></button>`
                    : `<button onclick="alterarStatusPagamento(${d.id}, true)" title="Quitar" class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white transition flex items-center justify-center shadow-sm"><i class="fa-solid fa-check"></i></button>`;

                const classeTraco = isPago ? 'line-through text-slate-400' : 'text-slate-800';
                const corData = nomeColuna === 'Atrasadas' && !isPago ? 'text-rose-500' : 'text-slate-400';
                const corValor = nomeColuna === 'Atrasadas' && !isPago ? 'text-rose-600' : 'text-slate-900';

                // Injeta os botões de Edição e Exclusão ocultos (aparecem no hover)
                return `
                <div class="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:shadow-md transition-all group">
                    <div class="flex justify-between items-start gap-3 mb-4">
                        <h4 class="font-bold text-xs ${classeTraco} leading-tight break-all mt-0.5">${d.descricao}</h4>
                        <span class="font-black text-sm ${corValor} whitespace-nowrap">${formatarMoeda(d.valor)}</span>
                    </div>
                    <div class="flex items-center justify-between mt-auto">
                        <div class="flex items-center gap-1.5 text-[11px] font-bold ${corData}">
                            <i class="fa-regular fa-calendar"></i> <span>${dataStr}</span>
                        </div>
                        
                        <div class="flex items-center gap-1">
                            <!-- Botões CRUD que aparecem ao passar o mouse -->
                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="abrirModalEdicao(${d.id})" title="Editar" class="w-7 h-7 rounded bg-slate-50 text-slate-400 hover:bg-indigo-500 hover:text-white transition flex items-center justify-center"><i class="fa-solid fa-pen text-[10px]"></i></button>
                                <button onclick="excluirDivida(${d.id})" title="Excluir" class="w-7 h-7 rounded bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white transition flex items-center justify-center mr-1"><i class="fa-solid fa-trash text-[10px]"></i></button>
                            </div>
                            ${btnAcao}
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        html += `
        <div id="${idColunaSanitizado}" class="w-[320px] shrink-0 bg-slate-100/50 rounded-2xl border border-slate-200/60 flex flex-col max-h-full transition-all duration-300">
            
            <div onclick="toggleColuna('${idColunaSanitizado}')" class="p-4 border-b border-slate-200/80 flex justify-between items-center bg-white rounded-t-2xl shrink-0 cursor-pointer hover:bg-slate-50 transition relative">
                
                <div class="esconder-no-min flex items-center gap-2">
                    <i class="fa-solid ${config.icon} text-${config.titleColor}"></i>
                    <h3 class="font-bold text-${config.titleColor} text-sm">${nomeColuna}</h3>
                </div>
                
                <!-- VISÃO MINIMIZADA (Com Contador Inteligente) -->
                <div class="hidden mostrar-no-min flex-col items-center justify-center w-full gap-3 py-2">
                    <span class="${config.badgeColor} text-[10px] font-black px-2 py-1 rounded-md shadow-sm transform rotate-90">${transacoesDaColuna.length}</span>
                    <h3 class="font-black text-slate-400 text-xs tracking-widest uppercase transform rotate-180" style="writing-mode: vertical-rl;">${nomeColuna}</h3>
                </div>
                
                <div class="esconder-no-min flex items-center gap-2">
                    <span class="${config.badgeColor} text-[10px] font-black px-2 py-1 rounded-md shadow-sm">${transacoesDaColuna.length}</span>
                    <i class="fa-solid fa-chevron-left text-slate-300 text-xs transition-transform transform -rotate-90"></i>
                </div>
            </div>

            <div class="esconder-no-min p-3 flex-1 overflow-y-auto coluna-scroll space-y-3">
                ${cardsHtml}
                <div class="pt-2 border-t border-slate-200 border-dashed text-right px-1">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Total:</span>
                    <span class="text-xs font-black text-slate-700 ml-1">${formatarMoeda(somaColuna)}</span>
                </div>
            </div>
        </div>`;
    });

    board.innerHTML = html;
}

// ---------------------------------------------
// AÇÕES DO KANBAN
// ---------------------------------------------
function toggleColuna(id) {
    const col = document.getElementById(id);
    col.classList.toggle('coluna-minimizada');
    const icone = col.querySelector('.fa-chevron-left');
    if(icone) {
        if(col.classList.contains('coluna-minimizada')) icone.classList.replace('-rotate-90', 'rotate-180');
        else icone.classList.replace('rotate-180', '-rotate-90');
    }
}

function alternarVisaoPagas() {
    mostrandoPagas = !mostrandoPagas;
    const btn = document.getElementById('btn-visao-pagas');
    
    if (mostrandoPagas) {
        btn.classList.replace('bg-slate-100', 'bg-emerald-100');
        btn.classList.replace('text-slate-600', 'text-emerald-600');
        btn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Voltar p/ Pendentes';
    } else {
        btn.classList.replace('bg-emerald-100', 'bg-slate-100');
        btn.classList.replace('text-emerald-600', 'text-slate-600');
        btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Ver Pagas';
    }
    processarEAtualizarKanban();
}

async function alterarStatusPagamento(idTransacao, novoStatusPago) {
    try {
        const { error } = await supabaseClient.from('transacoes').update({ pago: novoStatusPago }).eq('id', idTransacao);
        if (error) throw error;

        const idx = transacoesGlobais.findIndex(t => t.id === idTransacao);
        if (idx !== -1) transacoesGlobais[idx].pago = novoStatusPago;

        processarEAtualizarKanban();
    } catch (e) { alert("Erro ao atualizar: " + e.message); }
}

// ---------------------------------------------
// CRUD: CRIAR, EDITAR E EXCLUIR
// ---------------------------------------------

function abrirModalNovaDivida() { 
    document.getElementById('form-divida').reset();
    document.getElementById('divida-id').value = ''; // Limpa o ID
    
    document.getElementById('modal-titulo').innerHTML = '<i class="fa-solid fa-file-signature text-indigo-500"></i> Lançar Contas';
    document.getElementById('modal-subtitulo').innerText = 'Contas ou parcelamentos lançados aqui entram como "Pendentes".';
    
    // Mostra o campo de parcelas e ajusta o layout
    document.getElementById('wrapper-parcelas').classList.remove('hidden');
    document.getElementById('wrapper-categoria').classList.replace('col-span-3', 'col-span-2');

    document.getElementById('divida-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-divida').classList.remove('hidden'); 
}

function abrirModalEdicao(idTransacao) {
    const t = transacoesGlobais.find(x => x.id === idTransacao);
    if (!t) return;

    document.getElementById('divida-id').value = t.id;
    document.getElementById('divida-desc').value = t.descricao;
    
    // Formata de volta pra texto pro usuário
    let valorStr = t.valor.toFixed(2).replace('.', ',');
    valorStr = valorStr.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    valorStr = valorStr.replace(/(\d)(\d{3}),/g, "$1.$2,");
    document.getElementById('divida-valor').value = valorStr;
    
    document.getElementById('divida-data').value = t.data_vencimento;
    document.getElementById('divida-categoria').value = t.categoria_id;

    document.getElementById('modal-titulo').innerHTML = '<i class="fa-solid fa-pen text-indigo-500"></i> Editar Parcela';
    document.getElementById('modal-subtitulo').innerText = 'Altere as informações deste lançamento específico.';

    // Esconde o campo de parcelas (pois você não gera lote editando um já existente)
    document.getElementById('wrapper-parcelas').classList.add('hidden');
    document.getElementById('wrapper-categoria').classList.replace('col-span-2', 'col-span-3');

    document.getElementById('modal-divida').classList.remove('hidden');
}

function fecharModalNovaDivida() {
    document.getElementById('modal-divida').classList.add('hidden');
}

async function excluirDivida(idTransacao) {
    if (!confirm("Tem certeza que deseja excluir este lançamento do seu banco de dados?")) return;

    try {
        const { error } = await supabaseClient.from('transacoes').delete().eq('id', idTransacao);
        if (error) throw error;

        // Limpa da memória global
        transacoesGlobais = transacoesGlobais.filter(t => t.id !== idTransacao);
        processarEAtualizarKanban();
    } catch (e) { alert("Erro ao excluir: " + e.message); }
}

async function salvarDivida(event) {
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
        alert("O valor não pode ser zero.");
        btn.innerHTML = conteudoOriginal; btn.disabled = false; return;
    }

    try {
        if (idExistente) {
            // ROTA DE EDIÇÃO (UPDATE)
            const { data, error } = await supabaseClient.from('transacoes').update({
                descricao: descBase,
                valor: valorFloat,
                data_vencimento: dataInicialISO,
                categoria_id: catId
            }).eq('id', idExistente).select();

            if (error) throw error;

            // Atualiza memória
            const idx = transacoesGlobais.findIndex(t => t.id == idExistente);
            if (idx !== -1 && data && data.length > 0) {
                transacoesGlobais[idx] = data[0];
            }

        } else {
            // ROTA DE CRIAÇÃO (BULK INSERT)
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
                    usuario_id: usuarioLogado.id,
                    tipo: 'despesa',
                    descricao: descFinal,
                    valor: valorFloat, 
                    data_vencimento: dataFormatada,
                    categoria_id: catId,
                    pago: false
                });
            }

            const { data, error } = await supabaseClient.from('transacoes').insert(loteInsercao).select();
            if (error) throw error;
            if(data) transacoesGlobais.push(...data);
        }
        
        fecharModalNovaDivida();
        processarEAtualizarKanban();

    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.innerHTML = conteudoOriginal;
        btn.disabled = false;
    }
}
