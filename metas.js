// ==========================================
// metas.js - MOTOR DE INTELIGÊNCIA DE POUPANÇA E METAS (SEM AUTO-FECHAMENTO)
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let metasGlobais = [];

document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(() => document.body.classList.remove('fade-in'), 500);

    // Transição suave entre telas
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
// INTELIGÊNCIA FINANCEIRA: ANÁLISE DE CAIXA E CAPACIDADE DE POUPANÇA
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

    document.getElementById('analise-receitas').innerText = formatarMoedaLocal(receitasMes);
    document.getElementById('analise-dividas').innerText = formatarMoedaLocal(dividasPendentesTotal);
    document.getElementById('analise-sugestao').innerText = formatarMoedaLocal(capacidadeMaximaSegura);

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
        <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden group">
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

            <div class="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button onclick="abrirModalGuardar('${m.id}', '${m.titulo.replace(/'/g, "\\'")}')" class="flex-1 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-500/30">
                    <i class="fa-solid fa-piggy-bank"></i> Guardar
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
// MODAIS E AÇÕES DE GRAVAÇÃO
// ---------------------------------------------------------
function abrirModalNovaMeta() {
    document.getElementById('form-meta').reset();
    document.getElementById('meta-id').value = '';
    document.getElementById('modal-meta-titulo').innerHTML = '<i class="fa-solid fa-bullseye text-indigo-500 mr-2"></i> Nova Meta';
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
    const titulo = document.getElementById('meta-titulo').value;
    const alvo = desmascararMoeda(document.getElementById('meta-alvo').value);
    const prazo = document.getElementById('meta-prazo').value;

    if (alvo <= 0) {
        Swal.fire('Aviso', 'O valor alvo deve ser maior que zero.', 'warning');
        return;
    }

    try {
        const client = window.supabaseClient || supabaseClient;
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
        dispararCelebracao("Meta Criada com Sucesso! 🎯", "O primeiro passo para realizar seus sonhos foi dado. Agora é manter o foco e fazer os aportes!");

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
        const client = window.supabaseClient || supabaseClient;
        const meta = metasGlobais.find(m => m.id == metaId);
        if (!meta) throw new Error("Meta não encontrada.");

        const novoValorAtual = (meta.valor_atual || 0) + valorGuardado;

        const { error } = await client.from('metas').update({ valor_atual: novoValorAtual }).eq('id', metaId);
        if (error) throw error;

        meta.valor_atual = novoValorAtual;
        renderizarMetas();
        fecharModalGuardar();

        const elogios = [
            "Você é imparável! Cada centavo guardado é um tijolo na sua muralha financeira.",
            "Sensacional! O seu eu do futuro está orgulhoso da disciplina que você demonstrou agora.",
            "Brilhante! Enquanto muitos gastam, você constrói patrimônio. Rumo ao topo!",
            "Excelente aporte! Sua consistência financeira é o passaporte direto para a liberdade."
        ];
        const elogioAleatorio = elogios[Math.floor(Math.random() * elogios.length)];

        dispararCelebracao("Depósito Realizado com Sucesso! 💰", `${elogioAleatorio}<br><br><b>+ ${formatarMoedaLocal(valorGuardado)}</b> adicionados a "${meta.titulo}".`);

    } catch (e) {
        Swal.fire('Erro', e.message, 'error');
    }
}

async function excluirMeta(metaId) {
    const isDark = document.documentElement.classList.contains('dark');
    const confirmacao = await Swal.fire({
        title: 'Excluir Meta?',
        text: "Essa ação removerá o planejamento permanentemente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sim, excluir',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#fff' : '#1e293b'
    });

    if (!confirmacao.isConfirmed) return;

    try {
        const client = window.supabaseClient || supabaseClient;
        const { error } = await client.from('metas').delete().eq('id', metaId);
        if (error) throw error;

        metasGlobais = metasGlobais.filter(m => m.id != metaId);
        renderizarMetas();

    } catch (e) {
        Swal.fire('Erro', e.message, 'error');
    }
}

// ---------------------------------------------------------
// CELEBRAÇÃO (PERMANECE ATÉ O USUÁRIO CLICAR EM CONTINUAR)
// ---------------------------------------------------------
function dispararCelebracao(titulo, mensagem) {
    document.getElementById('cel-titulo').innerText = titulo;
    document.getElementById('cel-mensagem').innerHTML = mensagem;
    document.getElementById('modal-celebracao').classList.remove('hidden');
}

function fecharCelebracao() {
    document.getElementById('modal-celebracao').classList.add('hidden');
}
