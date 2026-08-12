// ==========================================
// dividas.js - MOTOR KANBAN DE CONTAS A PAGAR SÊNIOR
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];
let mostrandoPagas = false;

document.addEventListener('DOMContentLoaded', async () => {
    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return; 

    // Preenche data padrão no modal de cadastro
    document.getElementById('divida-data').value = new Date().toISOString().split('T')[0];

    await carregarDadosDoBanco();
});

async function carregarDadosDoBanco() {
    try {
        const [rTrans, rCat] = await Promise.all([
            // Puxa tudo que é despesa (para filtrar pago/pendente no JS)
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id).eq('tipo', 'despesa').order('data_vencimento', { ascending: true }),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id)
        ]);

        transacoesGlobais = rTrans.data || [];
        categoriasGlobais = rCat.data || [];

        // Preenche o Select do Modal de Lançamento
        const selectCat = document.getElementById('divida-categoria');
        selectCat.innerHTML = '<option value="" disabled selected>Selecione uma pasta...</option>' + 
            categoriasGlobais.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

        processarEAtualizarKanban();

    } catch (e) {
        console.error("Erro ao puxar dados:", e.message);
    }
}

// ---------------------------------------------
// O CÉREBRO DE AGRUPAMENTO (Kanban Dinâmico)
// ---------------------------------------------
function processarEAtualizarKanban() {
    const hojeData = new Date();
    hojeData.setHours(0, 0, 0, 0); 
    
    const mesAtual = hojeData.getMonth();
    const anoAtual = hojeData.getFullYear();

    const agrupamentos = {};
    let totAtrasadas = 0, totMes = 0, totFuturo = 0, totPagas = 0;

    // Inicializa as chaves base para garantir a ordem
    if(!mostrandoPagas) {
        agrupamentos['Atrasadas'] = [];
        agrupamentos['Este Mês'] = [];
    }

    const mesesAbv = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    transacoesGlobais.forEach(t => {
        if (!t.data_vencimento) return; 
        
        // Se a coluna 'pago' não existir, assume false
        const isPago = t.pago === true; 

        if (isPago) {
            totPagas += t.valor;
            if (mostrandoPagas) {
                // Se a visão de pagas estiver ativa, agrupa pelo mês da data
                const dVenc = new Date(t.data_vencimento + 'T12:00:00Z');
                const label = `${mesesAbv[dVenc.getMonth()]} / ${dVenc.getFullYear()}`;
                if (!agrupamentos[label]) agrupamentos[label] = [];
                agrupamentos[label].push(t);
            }
            return; // Se for pago e não for visão de pagas, ignora o resto do loop
        }

        // --- LÓGICA PARA PENDENTES ---
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
                // Cria as colunas dinâmicas para o futuro (Ex: Ago / 2026)
                const label = `${mesesAbv[mesVenc]} / ${anoVenc}`;
                if (!agrupamentos[label]) agrupamentos[label] = [];
                agrupamentos[label].push(t);
                totFuturo += t.valor;
            }
        }
    });

    // Atualiza KPIs
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

    // Remove colunas que nasceram vazias dinamicamente (Mantém atrasadas e mês vazias fixas)
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
        
        // Estética da Coluna
        let config = { icon: 'fa-calendar-day', color: 'slate', titleColor: 'slate-600', badgeColor: 'bg-slate-200 text-slate-600' };
        
        if (mostrandoPagas) {
            config = { icon: 'fa-check-circle', color: 'emerald', titleColor: 'emerald-600', badgeColor: 'bg-emerald-100 text-emerald-600' };
        } else {
            if (nomeColuna === 'Atrasadas') config = { icon: 'fa-circle-exclamation', color: 'rose', titleColor: 'rose-600', badgeColor: 'bg-rose-100 text-rose-600' };
            if (nomeColuna === 'Este Mês') config = { icon: 'fa-calendar-check', color: 'indigo', titleColor: 'indigo-600', badgeColor: 'bg-indigo-100 text-indigo-600' };
        }

        const idColunaSanitizado = 'col_' + nomeColuna.replace(/\s+/g, '').replace(/\//g, '');

        // Construção dos Cards Internos
        let cardsHtml = '';
        if (transacoesDaColuna.length === 0) {
            cardsHtml = `<div class="text-center py-8 opacity-50"><i class="fa-solid fa-wind text-2xl text-slate-300 mb-2"></i><p class="text-[10px] font-bold text-slate-400 uppercase">Tudo Limpo</p></div>`;
        } else {
            cardsHtml = transacoesDaColuna.map(d => {
                const dataStr = d.data_vencimento.split('-').reverse().join('/');
                const isPago = d.pago === true;
                
                // Botão dinâmico: Se pagou, botão é vermelho pra desfazer. Se não pagou, é verde pra pagar.
                const btnAcao = isPago 
                    ? `<button onclick="alterarStatusPagamento(${d.id}, false)" title="Desfazer Pagamento" class="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition flex items-center justify-center shadow-sm"><i class="fa-solid fa-rotate-left"></i></button>`
                    : `<button onclick="alterarStatusPagamento(${d.id}, true)" title="Marcar como Pago" class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white transition flex items-center justify-center shadow-sm"><i class="fa-solid fa-check"></i></button>`;

                const classeTraco = isPago ? 'line-through text-slate-400' : 'text-slate-800';
                const corBorda = isPago ? 'border-l-emerald-400' : `border-l-${config.color}-400`;

                return `
                <div class="bg-white rounded-xl p-4 border border-slate-200/60 shadow-sm border-l-4 ${corBorda} hover:-translate-y-0.5 hover:shadow-md transition-all group">
                    <div class="flex justify-between items-start gap-3 mb-3">
                        <h4 class="font-bold text-xs ${classeTraco} leading-tight break-all">${d.descricao}</h4>
                        <span class="font-black text-sm text-slate-900 whitespace-nowrap">${formatarMoeda(d.valor)}</span>
                    </div>
                    <div class="flex items-center justify-between mt-auto">
                        <div class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                            <i class="fa-regular fa-calendar"></i> <span>${dataStr}</span>
                        </div>
                        ${btnAcao}
                    </div>
                </div>`;
            }).join('');
        }

        // Construção da Coluna
        html += `
        <div id="${idColunaSanitizado}" class="w-[320px] shrink-0 bg-slate-100/50 rounded-2xl border border-slate-200/60 flex flex-col max-h-full transition-all duration-300">
            
            <!-- HEADER DA COLUNA (Clicável para minimizar) -->
            <div onclick="toggleColuna('${idColunaSanitizado}')" class="p-4 border-b border-slate-200/80 flex justify-between items-center bg-white rounded-t-2xl shrink-0 cursor-pointer hover:bg-slate-50 transition">
                <div class="esconder-no-min flex items-center gap-2">
                    <i class="fa-solid ${config.icon} text-${config.titleColor}"></i>
                    <h3 class="font-bold text-${config.titleColor} text-sm">${nomeColuna}</h3>
                </div>
                
                <!-- Titulo Vertical (Aparece só quando minimizado) -->
                <h3 class="hidden mostrar-no-min font-black text-slate-400 text-sm tracking-widest uppercase my-4">${nomeColuna}</h3>
                
                <div class="esconder-no-min flex items-center gap-2">
                    <span class="${config.badgeColor} text-[10px] font-black px-2 py-1 rounded-md shadow-sm">${transacoesDaColuna.length}</span>
                    <i class="fa-solid fa-chevron-left text-slate-300 text-xs transition-transform transform -rotate-90"></i>
                </div>
            </div>
            
            <!-- CONTEÚDO (Cards) -->
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
    
    // Anima a setinha
    const icone = col.querySelector('.fa-chevron-left');
    if(col.classList.contains('coluna-minimizada')) {
        icone.classList.replace('-rotate-90', 'rotate-180');
    } else {
        icone.classList.replace('rotate-180', '-rotate-90');
    }
}

function alternarVisaoPagas() {
    mostrandoPagas = !mostrandoPagas;
    const btn = document.getElementById('btn-visao-pagas');
    
    if (mostrandoPagas) {
        btn.classList.replace('bg-slate-100', 'bg-emerald-100');
        btn.classList.replace('text-slate-600', 'text-emerald-600');
        btn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Ver Pendentes';
    } else {
        btn.classList.replace('bg-emerald-100', 'bg-slate-100');
        btn.classList.replace('text-emerald-600', 'text-slate-600');
        btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Ver Pagas';
    }
    
    processarEAtualizarKanban();
}

async function alterarStatusPagamento(idTransacao, novoStatusPago) {
    try {
        const { error } = await supabaseClient
            .from('transacoes')
            .update({ pago: novoStatusPago })
            .eq('id', idTransacao);

        if (error) throw error;

        // Atualiza a memória local sem precisar puxar tudo do banco de novo
        const idx = transacoesGlobais.findIndex(t => t.id === idTransacao);
        if (idx !== -1) transacoesGlobais[idx].pago = novoStatusPago;

        processarEAtualizarKanban();

    } catch (e) {
        alert("Erro ao atualizar o status: " + e.message);
    }
}

// ---------------------------------------------
// CADASTRO DIRETO DE DÍVIDAS (MODAL)
// ---------------------------------------------
function abrirModalNovaDivida() {
    document.getElementById('modal-divida').classList.remove('hidden');
}

function fecharModalNovaDivida() {
    document.getElementById('modal-divida').classList.add('hidden');
    document.getElementById('form-divida').reset();
    document.getElementById('divida-data').value = new Date().toISOString().split('T')[0];
}

async function salvarNovaDivida(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-salvar-divida');
    const conteudoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    btn.disabled = true;

    const desc = document.getElementById('divida-desc').value;
    const valor = parseFloat(document.getElementById('divida-valor').value);
    const dataVenc = document.getElementById('divida-data').value;
    const catId = document.getElementById('divida-categoria').value;

    try {
        const { data, error } = await supabaseClient.from('transacoes').insert([{
            usuario_id: usuarioLogado.id,
            tipo: 'despesa',
            descricao: desc,
            valor: valor,
            data_vencimento: dataVenc,
            categoria_id: catId,
            pago: false // Nasce pendente (Dívida)
        }]).select();

        if (error) throw error;

        // Joga pro array global e re-renderiza a tela em tempo real
        if(data && data.length > 0) transacoesGlobais.push(data[0]);
        
        fecharModalNovaDivida();
        processarEAtualizarKanban();

    } catch (e) {
        alert("Erro ao salvar dívida: " + e.message);
    } finally {
        btn.innerHTML = conteudoOriginal;
        btn.disabled = false;
    }
}
