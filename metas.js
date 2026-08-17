// ==========================================
// metas.js - MOTOR DE INTELIGÊNCIA, APORTES E ESTORNO AUTOMÁTICO DE CAIXA
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let metasGlobais = [];

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

    try {
        if (typeof verificarSessaoSegura === 'function') {
            usuarioLogado = await verificarSessaoSegura();
        } else {
            const client = window.supabaseClient || supabaseClient;
            if (client) {
                const { data: { session } } = await client.auth.getSession();
                usuarioLogado = session ? session.user : null;
            }
        }

        if (!usuarioLogado) return;

        const dataPrazo = document.getElementById('meta-prazo');
        if (dataPrazo) {
            const amanha = new Date();
            amanha.setMonth(amanha.getMonth() + 3);
            dataPrazo.value = amanha.toISOString().split('T')[0];
        }

        await carregarDadosDoBanco();
    } catch (err) {
        console.error("Erro na inicialização de Metas:", err);
    }
});

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
            let parts = Math.abs(valorAtual).toFixed(2).split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            elemento.innerText = (valorAtual < 0 ? "- R$ " : "R$ ") + parts.join(',');
        } else if (formato === 'inteiro') { 
            elemento.innerText = Math.round(valorAtual); 
        }
        if (progress < 1) requestAnimationFrame(step);
        else {
            if (formato === 'moeda') {
                let parts = Math.abs(valorFinal).toFixed(2).split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                elemento.innerText = (valorFinal < 0 ? "- R$ " : "R$ ") + parts.join(',');
            } else if (formato === 'inteiro') { 
                elemento.innerText = valorFinal; 
            }
        }
    };
    requestAnimationFrame(step);
};

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
        const client = window.supabaseClient || supabaseClient;
        if (!client) throw new Error("Cliente Supabase não inicializado.");

        const [rTrans, rMetas] = await Promise.all([
            client.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id),
            client.from('metas').select('*').eq('usuario_id', usuarioLogado.id).order('criado_em', { ascending: false })
        ]);

        transacoesGlobais = rTrans.data || [];
        metasGlobais = rMetas.data || [];

        if (metasGlobais.length === 0) {
            const metaExemplo = {
                usuario_id: usuarioLogado.id,
                titulo: 'Reserva de Emergência 🛡️',
                valor_alvo: 5000.00,
                valor_atual: 0.00,
                prazo: new Date(Date.now() + 180*24*60*60*1000).toISOString().split('T')[0],
                criado_em: new Date().toISOString()
            };
            const { data: insData } = await client.from('metas').insert([metaExemplo]).select();
            if (insData) metasGlobais = insData;
        }

        processarAnaliseInteligente();
        renderizarMetas();

    } catch (e) {
        console.error("Erro ao carregar dados para metas:", e.message);
    }
}

// ---------------------------------------------------------
// INTELIGÊNCIA FINANCEIRA COM CONTADORES ANIMADOS
// ---------------------------------------------------------
function processarAnaliseInteligente() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    let receitasMes = 0;
    let despesasPagasMes = 0;
    let dividasPendentesTotal = 0;

    transacoesGlobais.forEach(t => {
        if (!t.data_vencimento) return;
        const d = new Date(t.data_vencimento + 'T12:00:00Z');
        const isMes = d.getMonth() === mesAtual && d.getFullYear() === anoAtual;

        if (t.tipo === 'receita' && isMes) {
            receitasMes += t.valor;
        } else if (t.tipo === 'despesa') {
            if (isMes && t.pago === true) {
                despesasPagasMes += t.valor;
            }
            if (t.pago !== true) {
                dividasPendentesTotal += t.valor;
            }
        }
    });

    const saldoEstimado = receitasMes - despesasPagasMes;
    let capacidadeMaximaSegura = saldoEstimado - (dividasPendentesTotal * 0.5); 
    if (capacidadeMaximaSegura < 0) capacidadeMaximaSegura = 0;

    window.animarContador('analise-receitas', receitasMes, 'moeda', 800);
    window.animarContador('analise-dividas', dividasPendentesTotal, 'moeda', 800);
    window.animarContador('analise-sugestao', capacidadeMaximaSegura, 'moeda', 800);

    const txtAnalise = document.getElementById('texto-analise-inteligente');
    const badgeStatus = document.getElementById('status-carteira-badge');
    const txtDica = document.getElementById('dica-coach-texto');

    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    document.getElementById('mes-referencia-analise').innerText = `${nomesMeses[mesAtual]} de ${anoAtual}`;

    if (dividasPendentesTotal > receitasMes) {
        badgeStatus.innerText = "Atenção Crítica ⚠️";
        badgeStatus.className = "text-rose-400 font-black";
        txtAnalise.innerHTML = `Detectamos que suas obrigações em aberto superam suas entradas previstas. Recomendamos focar em quitar passivos antes de alocar valores pesados em novas metas.`;
        txtDica.innerText = `Corte supérfluos esta semana. Negocie juros e mantenha o foco em zerar suas contas em atraso.`;
    } else if (capacidadeMaximaSegura > 0) {
        badgeStatus.innerText = "Saudável e Lucrativa 🚀";
        badgeStatus.className = "text-emerald-400 font-black";
        txtAnalise.innerHTML = `Parabéns! Suas finanças estão equilibradas. Você tem margem para guardar até <b>${formatarMoedaLocal(capacidadeMaximaSegura)}</b> este mês sem faltar nada para suas contas básicas.`;
        txtDica.innerText = `O hábito vence a genialidade. Guarde o dinheiro da meta assim que o salário cair na conta, antes de começar a gastar!`;
    } else {
        badgeStatus.innerText = "Equilíbrio Justo ⚖️";
        badgeStatus.className = "text-amber-400 font-black";
        txtAnalise.innerHTML = `Seu caixa está equilibrado, mas os compromissos futuros exigem cautela. Tente guardar valores menores e constantes (${formatarMoedaLocal(50)} a ${formatarMoedaLocal(100)}) por aporte.`;
        txtDica.innerText = `Consistência é o segredo. Mesmo quantias modestas criam o músculo financeiro necessário para grandes conquistas.`;
    }
}

// ---------------------------------------------------------
// RENDERIZAÇÃO DAS METAS
// ---------------------------------------------------------
function renderizarMetas() {
    const grid = document.getElementById('grid-metas');
    if (!grid) return;

    if (metasGlobais.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800">
                <p class="text-sm font-bold text-slate-400">Nenhuma meta cadastrada. Clique em "Nova Meta" para começar!</p>
            </div>`;
        return;
    }

    const html = metasGlobais.map(m => {
        const atual = m.valor_atual || 0;
        const alvo = m.valor_alvo || 1;
        const progresso = Math.min(Math.round((atual / alvo) * 100), 100);
        
        let corBarra = 'bg-indigo-600';
        if (progresso >= 100) corBarra = 'bg-emerald-500';
        else if (progresso > 50) corBarra = 'bg-blue-500';

        let prazoStr = m.prazo ? m.prazo.split('-').reverse().join('/') : 'Sem prazo';

        return `
        <div onclick="abrirHistoricoMeta('${m.id}')" class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden group">
            <div>
                <div class="flex justify-between items-start gap-3 mb-4">
                    <div>
                        <h4 class="font-black text-slate-900 dark:text-white text-base mb-0.5">${m.titulo}</h4>
                        <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"><i class="fa-regular fa-calendar mr-1"></i> Prazo: ${prazoStr}</p>
                    </div>
                    <span class="text-xs font-black px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-inner">${progresso}%</span>
                </div>

                <div class="space-y-1.5 mb-6">
                    <div class="flex justify-between items-baseline text-xs font-bold">
                        <span class="text-slate-500">Guardado: <strong class="text-slate-900 dark:text-white">${formatarMoedaLocal(atual)}</strong></span>
                        <span class="text-slate-400">Alvo: ${formatarMoedaLocal(alvo)}</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div class="${corBarra} h-2.5 rounded-full transition-all duration-1000" style="width: ${progresso}%"></div>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800" onclick="event.stopPropagation()">
                <button onclick="abrirModalGuardar('${m.id}', '${m.titulo.replace(/'/g, "\\'")}')" class="flex-1 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-500/30">
                    <i class="fa-solid fa-piggy-bank"></i> Guardar
                </button>
                <button onclick="abrirModalEdicaoMeta('${m.id}')" title="Editar Meta" class="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-indigo-500 hover:text-white transition flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <button onclick="excluirMeta('${m.id}')" title="Excluir Meta" class="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');

    grid.innerHTML = html;
}

// ---------------------------------------------------------
// EXIBIR HISTÓRICO DE APORTES COM OPÇÃO DE EXCLUIR APORTE (ESTORNO)
// ---------------------------------------------------------
let metaAtualHistoricoId = null;

function abrirHistoricoMeta(metaId) {
    metaAtualHistoricoId = metaId;
    const meta = metasGlobais.find(m => m.id == metaId);
    if (!meta) return;

    document.getElementById('hist-meta-titulo').innerText = meta.titulo;
    renderizarListaAportesModal(meta);
    document.getElementById('modal-historico-meta').classList.remove('hidden');
}

function renderizarListaAportesModal(meta) {
    const aportes = transacoesGlobais.filter(t => t.tipo === 'despesa' && t.descricao === `Aporte: ${meta.titulo}`);
    const container = document.getElementById('hist-meta-lista');
    let somaAportesListados = 0;

    if (aportes.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 text-slate-400">
                <i class="fa-solid fa-piggy-bank text-3xl mb-2 opacity-50"></i>
                <p class="text-xs font-bold uppercase">Nenhum aporte registrado ainda.</p>
            </div>`;
    } else {
        container.innerHTML = aportes.map(a => {
            somaAportesListados += a.valor;
            let dataStr = a.data_vencimento ? a.data_vencimento.split('-').reverse().join('/') : '--/--/----';
            return `
            <div class="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                        <i class="fa-solid fa-arrow-down"></i>
                    </div>
                    <div>
                        <p class="font-bold text-sm text-slate-900 dark:text-white">${a.descricao}</p>
                        <p class="text-[10px] font-bold text-slate-400"><i class="fa-regular fa-calendar mr-1"></i> ${dataStr}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-black text-emerald-600 dark:text-emerald-400 text-sm">+ ${formatarMoedaLocal(a.valor)}</span>
                    <button onclick="excluirAporte('${a.id}', '${meta.id}')" title="Retirar da caixinha (Estornar)" class="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition flex items-center justify-center">
                        <i class="fa-solid fa-rotate-left text-xs"></i>
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    document.getElementById('hist-meta-total').innerText = formatarMoedaLocal(meta.valor_atual || somaAportesListados);
}

// Estorna o valor do aporte para o saldo livre ao excluir o lançamento
async function excluirAporte(transacaoId, metaId) {
    const isDark = document.documentElement.classList.contains('dark');
    const confirmacao = await Swal.fire({
        title: 'Retirar dinheiro da caixinha?',
        text: "O valor deste aporte retornará para o seu saldo disponível.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sim, retirar',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#fff' : '#1e293b'
    });

    if (!confirmacao.isConfirmed) return;

    try {
        const client = window.supabaseClient || supabaseClient;
        
        // 1. Encontra a transação de aporte para saber o valor exato
        const transacao = transacoesGlobais.find(t => t.id == transacaoId);
        if (!transacao) throw new Error("Aporte não encontrado.");

        // 2. Apaga a transação de despesa do banco (devolvendo o dinheiro para o caixa)
        const { error: errTrans } = await client.from('transacoes').delete().eq('id', transacaoId);
        if (errTrans) throw errTrans;

        transacoesGlobais = transacoesGlobais.filter(t => t.id != transacaoId);

        // 3. Atualiza o valor guardado na meta
        const meta = metasGlobais.find(m => m.id == metaId);
        if (meta) {
            meta.valor_atual = Math.max(0, (meta.valor_atual || 0) - transacao.valor);
            await client.from('metas').update({ valor_atual: meta.valor_atual }).eq('id', metaId);
        }

        // Recarrega as análises e atualiza a lista no modal
        processarAnaliseInteligente();
        renderizarMetas();
        renderizarListaAportesModal(meta);

        Swal.fire({ icon: 'success', title: 'Valor estornado com sucesso!', showConfirmButton: false, timer: 1500 });

    } catch (e) {
        Swal.fire('Erro', e.message, 'error');
    }
}

function fecharHistoricoMeta() {
    document.getElementById('modal-historico-meta').classList.add('hidden');
    metaAtualHistoricoId = null;
}

// ---------------------------------------------------------
// MODAIS E AÇÕES DE GRAVAÇÃO
// ---------------------------------------------------------
function abrirModalNovaMeta() {
    document.getElementById('form-meta').reset();
    document.getElementById('meta-id').value = '';
    document.getElementById('modal-meta-titulo').innerHTML = '<i class="fa-solid fa-bullseye text-indigo-500 mr-2"></i> Nova Meta';
    document.getElementById('modal-meta').classList.remove('hidden');
}

function abrirModalEdicaoMeta(id) {
    const m = metasGlobais.find(x => x.id == id);
    if (!m) return;
    document.getElementById('meta-id').value = m.id;
    document.getElementById('meta-titulo').value = m.titulo;
    
    let valorStr = m.valor_alvo.toFixed(2).replace('.', ',');
    valorStr = valorStr.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    valorStr = valorStr.replace(/(\d)(\d{3}),/g, "$1.$2,");
    document.getElementById('meta-alvo').value = valorStr;
    
    document.getElementById('meta-prazo').value = m.prazo || '';
    document.getElementById('modal-meta-titulo').innerHTML = '<i class="fa-solid fa-pen text-indigo-500 mr-2"></i> Editar Meta';
    document.getElementById('modal-meta').classList.remove('hidden');
}

function fecharModalMeta() {
    document.getElementById('modal-meta').classList.add('hidden');
}

function abrirModalGuardar(idMeta, tituloMeta) {
    document.getElementById('form-guardar').reset();
    document.getElementById('guardar-meta-id').value = idMeta;
    document.getElementById('guardar-meta-nome').innerText = `Adicionando fundos para: "${tituloMeta}"`;
    document.getElementById('modal-guardar').classList.remove('hidden');
}

function fecharModalGuardar() {
    document.getElementById('modal-guardar').classList.add('hidden');
}

async function salvarMeta(event) {
    event.preventDefault();
    const idExistente = document.getElementById('meta-id').value;
    const titulo = document.getElementById('meta-titulo').value;
    const alvo = desmascararMoeda(document.getElementById('meta-alvo').value);
    const prazo = document.getElementById('meta-prazo').value;

    if (alvo <= 0) {
        Swal.fire('Aviso', 'O valor alvo deve ser maior que zero.', 'warning');
        return;
    }

    try {
        const client = window.supabaseClient || supabaseClient;

        if (idExistente) {
            const { error } = await client.from('metas').update({
                titulo: titulo,
                valor_alvo: alvo,
                prazo: prazo
            }).eq('id', idExistente);

            if (error) throw error;

            const idx = metasGlobais.findIndex(m => m.id == idExistente);
            if (idx !== -1) {
                metasGlobais[idx].titulo = titulo;
                metasGlobais[idx].valor_alvo = alvo;
                metasGlobais[idx].prazo = prazo;
            }

            fecharModalMeta();
            renderizarMetas();
            Swal.fire({ icon: 'success', title: 'Meta Atualizada!', showConfirmButton: false, timer: 1500 });

        } else {
            const novaMeta = {
                usuario_id: usuarioLogado.id,
                titulo: titulo,
                valor_alvo: alvo,
                valor_atual: 0.00,
                prazo: prazo,
                criado_em: new Date().toISOString()
            };

            const { data, error } = await client.from('metas').insert([novaMeta]).select();
            if (error) throw error;

            if (data) {
                metasGlobais.unshift(data[0]);
                renderizarMetas();
            }

            fecharModalMeta();
            dispararOverlayLottie("Meta Criada com Sucesso! 🎯");
        }

    } catch (e) {
        Swal.fire('Erro', e.message, 'error');
    }
}

async function efetivarGuardar(event) {
    event.preventDefault();
    const metaId = document.getElementById('guardar-meta-id').value;
    const valorGuardado = desmascararMoeda(document.getElementById('guardar-valor').value);

    if (valorGuardado <= 0) {
        Swal.fire('Aviso', 'Insira um valor válido para guardar.', 'warning');
        return;
    }

    try {
        let totalReceitas = 0;
        let totalDespesas = 0;
        transacoesGlobais.forEach(t => {
            if (t.tipo === 'receita') totalReceitas += t.valor;
            else if (t.tipo === 'despesa') totalDespesas += t.valor;
        });
        const saldoDisponivel = totalReceitas - totalDespesas;

        if (valorGuardado > saldoDisponivel) {
            Swal.fire({
                icon: 'warning',
                title: 'Saldo Insuficiente',
                text: `Você está tentando guardar ${formatarMoedaLocal(valorGuardado)}, mas seu saldo disponível atual é de ${formatarMoedaLocal(saldoDisponivel)}.`,
                confirmButtonColor: '#4f46e5'
            });
            return;
        }

        const client = window.supabaseClient || supabaseClient;
        const meta = metasGlobais.find(m => m.id == metaId);
        if (!meta) throw new Error("Meta não encontrada.");

        const novaDespesaAporte = {
            usuario_id: usuarioLogado.id,
            tipo: 'despesa',
            descricao: `Aporte: ${meta.titulo}`,
            valor: valorGuardado,
            data_vencimento: new Date().toISOString().split('T')[0],
            pago: true
        };

        const { data: transData, error: errTrans } = await client.from('transacoes').insert([novaDespesaAporte]).select();
        if (errTrans) throw errTrans;
        if (transData) transacoesGlobais.unshift(transData[0]);

        const novoValorAtual = (meta.valor_atual || 0) + valorGuardado;
        const { error: errMeta } = await client.from('metas').update({ valor_atual: novoValorAtual }).eq('id', metaId);
        if (errMeta) throw errMeta;

        meta.valor_atual = novoValorAtual;
        
        processarAnaliseInteligente();
        renderizarMetas();
        fecharModalGuardar();

        dispararOverlayLottie(`+ ${formatarMoedaLocal(valorGuardado)} adicionados a "${meta.titulo}"`);

    } catch (e) {
        Swal.fire('Erro', e.message, 'error');
    }
}

// AO EXCLUIR A META INTEIRA, ESTORNA TODOS OS APORTES VINCULADOS PARA O CAIXA
async function excluirMeta(metaId) {
    const meta = metasGlobais.find(m => m.id == metaId);
    const isDark = document.documentElement.classList.contains('dark');
    
    const confirmacao = await Swal.fire({
        title: 'Excluir Meta?',
        text: "Essa ação removerá o planejamento e estornará todo o valor guardado para o seu saldo livre.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sim, excluir e estornar',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#fff' : '#1e293b'
    });

    if (!confirmacao.isConfirmed) return;

    try {
        const client = window.supabaseClient || supabaseClient;

        if (meta) {
            // Apaga todas as transações de aporte associadas a esta meta
            const { error: errTrans } = await client.from('transacoes').delete().eq('usuario_id', usuarioLogado.id).eq('descricao', `Aporte: ${meta.titulo}`);
            if (errTrans) throw errTrans;

            // Remove da lista local
            transacoesGlobais = transacoesGlobais.filter(t => t.descricao !== `Aporte: ${meta.titulo}`);
        }

        // Apaga a meta do banco
        const { error } = await client.from('metas').delete().eq('id', metaId);
        if (error) throw error;

        metasGlobais = metasGlobais.filter(m => m.id != metaId);
        
        processarAnaliseInteligente();
        renderizarMetas();
        fecharHistoricoMeta();

        Swal.fire({ icon: 'success', title: 'Meta excluída e valores estornados!', showConfirmButton: false, timer: 1500 });

    } catch (e) {
        Swal.fire('Erro', e.message, 'error');
    }
}

// ---------------------------------------------------------
// ANIMAÇÃO LOTTIE COM 6 SEGUNDOS DE DURAÇÃO
// ---------------------------------------------------------
function dispararOverlayLottie(subtexto = "Depósito Realizado com Sucesso!") {
    const urlAnimacao = "https://lottie.host/896876fe-ed06-4076-a17b-5d6704174739/9BiS4WTolI.lottie";

    const overlayLottie = document.createElement('div');
    overlayLottie.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh; z-index: 999999; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(6px); transition: opacity 0.3s ease; opacity: 0; cursor: pointer;';
    
    overlayLottie.innerHTML = `
        <dotlottie-wc src="${urlAnimacao}" style="width: 300px; height: 300px;" autoplay loop></dotlottie-wc>
        <p style="color: #ffffff; font-family: 'Inter', sans-serif; font-weight: 900; font-size: 1.25rem; margin-top: 1rem; text-align: center; padding: 0 1rem; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">${subtexto}</p>
    `;
    
    overlayLottie.onclick = () => {
        overlayLottie.style.opacity = '0';
        setTimeout(() => overlayLottie.remove(), 300);
    };
    
    document.documentElement.appendChild(overlayLottie);
    
    requestAnimationFrame(() => overlayLottie.style.opacity = '1');
    
    setTimeout(() => { 
        if (document.body.contains(overlayLottie) || document.documentElement.contains(overlayLottie)) {
            overlayLottie.style.opacity = '0'; 
            setTimeout(() => overlayLottie.remove(), 300); 
        }
    }, 6000);
}
