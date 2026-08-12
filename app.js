// ==========================================
// MOTOR PRINCIPAL DO APLICATIVO SAAS
// ==========================================

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];
let dividasGlobais = [];
let planosGlobais = [];

// Escudo Protetor (Guarda-Costas)
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session) {
        // Sem crachá? De volta pra rua.
        window.location.href = "login.html";
        return;
    }
    
    usuarioLogado = session.user;
    
    // Libera a tela
    document.getElementById('loader-seguranca').classList.add('hidden');
    
    // Inicia a busca de dados
    await atualizarTudo();
});

async function sair() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

// ---------------------------------------------
// SISTEMA DE ABAS (Navegação SPA sem recarregar a tela)
// ---------------------------------------------
function mudarAba(nome) {
    document.querySelectorAll('.aba-conteudo').forEach(a => {
        a.classList.add('hidden');
        a.classList.remove('fade-in'); // Reset de animação
    });
    
    document.querySelectorAll('.menu-desk').forEach(b => { 
        b.classList.remove('bg-blue-50', 'text-blue-600'); 
        b.classList.add('text-gray-500'); 
    });
    
    const telaAtiva = document.getElementById(`aba-${nome}`);
    telaAtiva.classList.remove('hidden');
    telaAtiva.classList.add('fade-in');
    
    if(document.getElementById(`nav-desk-${nome}`)) {
        document.getElementById(`nav-desk-${nome}`).classList.add('bg-blue-50', 'text-blue-600');
    }
}

// ---------------------------------------------
// MOTOR DE BUSCA (Sincronização com Supabase)
// ---------------------------------------------
async function atualizarTudo() {
    try {
        const [rTrans, rCat, rDiv, rPlan] = await Promise.all([
            supabaseClient.from('transacoes').select('*').eq('usuario_id', usuarioLogado.id).order('id', { ascending: false }),
            supabaseClient.from('categorias').select('*').eq('usuario_id', usuarioLogado.id),
            supabaseClient.from('dividas').select('*').eq('usuario_id', usuarioLogado.id),
            supabaseClient.from('planos').select('*').eq('usuario_id', usuarioLogado.id)
        ]);

        transacoesGlobais = rTrans.data || [];
        categoriasGlobais = rCat.data || [];
        dividasGlobais = rDiv.data || [];
        planosGlobais = rPlan.data || [];

        renderizarInicio();
        renderizarDashboard();
        renderizarDividas();
        renderizarCategorias();
        renderizarPlanos();
    } catch (erro) { 
        console.error("Erro Crítico ao carregar dados:", erro); 
    }
}

// ---------------------------------------------
// MÓDULOS DE RENDERIZAÇÃO (Para isolamento de lógica)
// ---------------------------------------------
function renderizarInicio() {
    let saldo = 0, entradas = 0, saidas = 0;
    transacoesGlobais.forEach(t => {
        if(t.tipo === 'receita') { entradas += t.valor; saldo += t.valor; }
        else { saidas += t.valor; saldo -= t.valor; }
    });
    
    document.getElementById('saldo-tela').innerText = formatarMoeda(saldo);
    document.getElementById('total-entradas').innerText = formatarMoeda(entradas);
    document.getElementById('total-saidas').innerText = formatarMoeda(saidas);

    document.getElementById('lista-extrato').innerHTML = transacoesGlobais.map(t => {
        const cat = categoriasGlobais.find(c => c.id === t.categoria_id) || { nome: 'Geral', icone: 'fa-tag' };
        const corBg = t.tipo === 'despesa' ? 'bg-red-100' : 'bg-green-100';
        const corTxt = t.tipo === 'despesa' ? 'text-red-500' : 'text-green-500';
        const dataF = t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : '';

        return `<div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition"><div class="flex items-center space-x-4"><div class="w-12 h-12 ${corBg} rounded-full flex items-center justify-center ${corTxt} text-xl"><i class="fa-solid ${cat.icone}"></i></div><div><p class="text-gray-900 font-bold">${t.descricao}</p><p class="text-gray-400 text-xs font-bold">${cat.nome} • ${dataF}</p></div></div><p class="${corTxt} font-black text-lg">${t.tipo === 'despesa' ? '-' : '+'} ${formatarMoeda(t.valor)}</p></div>`;
    }).join('') || '<p class="text-center text-gray-400 py-6">Nenhuma transação registrada.</p>';
}

function renderizarDashboard() {
    const totaisCat = {};
    transacoesGlobais.forEach(t => { 
        if(t.tipo === 'despesa') {
            const cNome = categoriasGlobais.find(c => c.id === t.categoria_id)?.nome || 'Outros';
            totaisCat[cNome] = (totaisCat[cNome] || 0) + t.valor;
        }
    });

    document.getElementById('texto-coach').innerText = `O sistema detectou ${transacoesGlobais.length} transações oficiais em segurança.`;

    document.getElementById('grafico-categorias').innerHTML = Object.keys(totaisCat).map(cat => {
        const val = totaisCat[cat];
        const perc = Math.min((val / 1000) * 100, 100);
        return `<div class="mb-3"><div class="flex justify-between items-end mb-1"><span class="text-sm font-bold text-gray-700">${cat}</span><span class="text-xs font-bold text-gray-500">${formatarMoeda(val)}</span></div><div class="w-full bg-gray-100 rounded-full h-2.5"><div class="bg-blue-600 h-2.5 rounded-full" style="width: ${perc}%"></div></div></div>`;
    }).join('') || '<p class="text-xs text-gray-400">Gere despesas para ver a análise.</p>';
}

function renderizarDividas() {
    document.getElementById('col-div-atual').innerHTML = dividasGlobais.map(d => `
        <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex justify-between"><p class="font-bold text-gray-800 text-sm">${d.descricao}</p><p class="font-black text-red-500">${formatarMoeda(d.valor)}</p></div>
    `).join('') || '<p class="text-xs text-gray-400">Nenhuma dívida cadastrada.</p>';
}

function renderizarCategorias() {
    document.getElementById('grid-categorias').innerHTML = categoriasGlobais.map(c => `
        <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center"><i class="fa-solid ${c.icone} ${c.cor} text-3xl mb-2"></i><h4 class="font-bold text-lg">${c.nome}</h4></div>
    `).join('');
}

function renderizarPlanos() {
    document.getElementById('grid-planos').innerHTML = planosGlobais.map(p => {
        const perc = Math.min((p.valor_atual / p.valor_meta) * 100, 100);
        return `<div class="bg-white p-6 rounded-3xl border border-gray-100"><h3 class="font-black text-lg mb-2">${p.nome}</h3><div class="w-full bg-gray-100 rounded-full h-4 mb-2"><div class="bg-blue-500 h-4 rounded-full" style="width: ${perc}%"></div></div><div class="flex justify-between text-sm font-bold text-gray-500"><span>Atual: ${formatarMoeda(p.valor_atual)}</span><span>Meta: ${formatarMoeda(p.valor_meta)}</span></div></div>`;
    }).join('');
}
