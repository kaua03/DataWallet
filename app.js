// ==========================================
// 1. CONEXÃO DIRETA COM O SUPABASE
// ==========================================
const supabaseUrl = 'https://aoeyeleaxbwvjmzxxdib.supabase.co'; 
const supabaseKey = 'sb_publishable_Q6JiNxMGUdqObAMxj3EYSA_s_cYpFUk'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let usuarioLogado = null;
let transacoesGlobais = [];
let categoriasGlobais = [];
let dividasGlobais = [];
let planosGlobais = [];

const formatarMoeda = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;

// IGNIÇÃO SEGURA: Só roda após o HTML estar pronto (Garante que os botões existam)
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
            usuarioLogado = session.user;
            iniciarSistema();
        }
    } catch (e) {
        console.error("Erro ao checar sessão:", e.message);
    }
});

// ---------------------------------------------
// CONTROLE VISUAL DE LOGIN / CADASTRO
// ---------------------------------------------
function verificarDispositivo() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (isMobile) {
        document.getElementById('login-mobile').classList.remove('escondido');
        document.getElementById('login-desktop').classList.add('escondido');
    } else {
        document.getElementById('login-desktop').classList.remove('escondido');
        document.getElementById('login-mobile').classList.add('escondido');
    }
}
verificarDispositivo();
window.addEventListener('resize', verificarDispositivo);

function forcarLoginPadrao() {
    document.getElementById('login-mobile').classList.add('escondido');
    document.getElementById('login-desktop').classList.remove('escondido');
}

function alternarTelaAuth(tela) {
    if (tela === 'cadastro') {
        document.getElementById('form-login').classList.add('escondido');
        document.getElementById('form-cadastro').classList.remove('escondido');
        document.getElementById('texto-boas-vindas').innerText = "Crie sua conta para começar";
    } else {
        document.getElementById('form-cadastro').classList.add('escondido');
        document.getElementById('form-login').classList.remove('escondido');
        document.getElementById('texto-boas-vindas').innerText = "Seu centro de inteligência financeira";
    }
}

function fazerLoginBiometrico() { alert("Face ID acionado na versão mobile nativa."); }

// ---------------------------------------------
// 2. AUTENTICAÇÃO E CADASTRO REAL COM LGPD
// ---------------------------------------------
async function efetuarCadastro() {
    const email = document.getElementById('email-cad').value.trim();
    const senha = document.getElementById('senha-cad').value;
    
    if(!email || !senha || senha.length < 6) return alert("E-mail e Senha (mínimo 6 caracteres) são obrigatórios.");

    const btn = document.getElementById('btn-cadastrar');
    const txt = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

    try {
        const { data, error } = await supabase.auth.signUp({ email: email, password: senha });
        if (error) throw error;
        
        usuarioLogado = data.user;

        await supabase.from('categorias').insert([
            { usuario_id: usuarioLogado.id, nome: 'Alimentação', icone: 'fa-burger', cor: 'text-red-500' },
            { usuario_id: usuarioLogado.id, nome: 'Salário', icone: 'fa-building', cor: 'text-green-500' }
        ]);
        await supabase.from('planos').insert([
            { usuario_id: usuarioLogado.id, nome: 'Reserva de Emergência', valor_meta: 10000, cor: 'bg-blue-500' }
        ]);

        alert("Conta criada com sucesso!");
        iniciarSistema();

    } catch (e) {
        alert("Erro no cadastro: " + e.message);
    } finally {
        btn.innerHTML = txt;
    }
}

async function efetuarLogin() {
    const email = document.getElementById('email-login').value.trim();
    const senha = document.getElementById('senha-login').value;
    
    if(!email || !senha) return alert("Preencha e-mail e senha.");

    const btn = document.getElementById('btn-login-desk');
    const txt = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email, password: senha });
        if (error) throw error;
        
        usuarioLogado = data.user;
        iniciarSistema();

    } catch (e) {
        alert("Login falhou. Verifique as credenciais.");
    } finally {
        btn.innerHTML = txt;
    }
}

function iniciarSistema() {
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('app-principal').classList.remove('escondido');
    atualizarTudo();
}

async function sair() {
    await supabase.auth.signOut();
    usuarioLogado = null;
    document.getElementById('app-principal').classList.add('escondido');
    document.getElementById('tela-login').style.display = 'flex';
    document.getElementById('email-login').value = '';
    document.getElementById('senha-login').value = '';
}

// ---------------------------------------------
// 3. BUSCA DE DADOS (COM RLS BLINDADO)
// ---------------------------------------------
async function atualizarTudo() {
    if (!usuarioLogado) return;
    try {
        const [rTrans, rCat, rDiv, rPlan] = await Promise.all([
            supabase.from('transacoes').select('*').order('id', { ascending: false }),
            supabase.from('categorias').select('*'),
            supabase.from('dividas').select('*'),
            supabase.from('planos').select('*')
        ]);

        transacoesGlobais = rTrans.data || [];
        categoriasGlobais = rCat.data || [];
        dividasGlobais = rDiv.data || [];
        planosGlobais = rPlan.data || [];

        carregarInicio();
        atualizarDashboard();
        carregarDividas();
        carregarCategorias();
        carregarPlanos();
    } catch (erro) { console.error("Erro Crítico:", erro); }
}

// ---------------------------------------------
// RENDER: INÍCIO E GRAVAÇÃO NLP
// ---------------------------------------------
function carregarInicio() {
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
        
        // Tratamento seguro contra dados nulos
        const dataFormatada = t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : 'S/ Data';

        return `<div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between"><div class="flex items-center space-x-4"><div class="w-12 h-12 ${corBg} rounded-full flex items-center justify-center ${corTxt} text-xl"><i class="fa-solid ${cat.icone}"></i></div><div><p class="text-gray-900 font-bold">${t.descricao}</p><p class="text-gray-400 text-xs font-bold">${cat.nome} • ${dataFormatada}</p></div></div><p class="${corTxt} font-black text-lg">${t.tipo === 'despesa' ? '-' : '+'} ${formatarMoeda(t.valor)}</p></div>`;
    }).join('') || '<p class="text-center text-gray-400 py-6">Nenhuma transação.</p>';
}

let transacaoNLP = null;
function simularEnvioVoz() {
    const input = document.getElementById('input-magico').value.toLowerCase();
    if(!input) return;
    
    const nums = input.match(/\d+(?:[.,]\d+)?/g);
    const val = nums ? Math.max(...nums.map(n => parseFloat(n.replace(',', '.')))) : 0;
    const isReceita = ['recebi', 'ganhei', 'pix', 'salário'].some(p => input.includes(p));

    transacaoNLP = {
        usuario_id: usuarioLogado.id,
        valor: val,
        tipo: isReceita ? 'receita' : 'despesa',
        descricao: document.getElementById('input-magico').value.split(' ')[0] || 'Gasto',
        data_vencimento: new Date().toISOString().split('T')[0],
        categoria_id: categoriasGlobais.length > 0 ? categoriasGlobais[0].id : null
    };

    const t = document.getElementById('modal-titulo');
    const v = document.getElementById('conf-val');
    const bg = document.getElementById('modal-bg-efeito');
    
    t.innerText = isReceita ? "Registrar Entrada?" : "Registrar Saída?";
    v.innerText = `${isReceita ? '+' : '-'} ${formatarMoeda(val)}`;
    v.className = `text-3xl font-black ${isReceita ? 'text-green-500' : 'text-red-500'}`;
    bg.className = `absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-2xl ${isReceita ? 'bg-green-500' : 'bg-red-500'}`;
    
    document.getElementById('modal-confirmacao').classList.remove('hidden');
}

function fecharModal() { document.getElementById('modal-confirmacao').classList.add('hidden'); }

async function confirmarSalvamentoNLP() {
    if(!transacaoNLP || !usuarioLogado) return;
    const btn = document.getElementById('btn-salvar-modal');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const { error } = await supabase.from('transacoes').insert([transacaoNLP]);
        if (error) throw error;
        await atualizarTudo();
        fecharModal();
        document.getElementById('input-magico').value = '';
    } catch(e) { 
        alert("Erro ao gravar: " + e.message); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar'; 
    }
}

function atualizarDashboard() {
    let totalDespesas = 0;
    transacoesGlobais.forEach(t => { if(t.tipo === 'despesa') totalDespesas += t.valor; });
    document.getElementById('dash-media').innerText = formatarMoeda(totalDespesas / 30);
    document.getElementById('texto-coach').innerText = `O sistema detectou ${transacoesGlobais.length} transações oficiais vinculadas a você.`;
}

function carregarDividas() {
    const html = dividasGlobais.map(d => `<div class="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex justify-between"><p class="font-bold text-gray-800 text-sm">${d.descricao}</p><p class="font-black">${formatarMoeda(d.valor)}</p></div>`).join('');
    document.getElementById('col-div-atual').innerHTML = html || '<p class="text-xs text-gray-400">Limpo!</p>';
}

function abrirModalDivida() { document.getElementById('modal-divida').classList.remove('hidden'); }
function fecharModalDivida() { document.getElementById('modal-divida').classList.add('hidden'); }

async function salvarNovaDivida() {
    const desc = document.getElementById('div-desc').value;
    const valorTotal = parseFloat(document.getElementById('div-valor').value);
    const parcelas = parseInt(document.getElementById('div-parcelas').value);
    const dataBase = document.getElementById('div-data').value;

    if(!desc || !valorTotal || !dataBase) return;
    const parcelasArray = [];
    for(let i=0; i<parcelas; i++) {
        parcelasArray.push({
            usuario_id: usuarioLogado.id, descricao: `${desc} (${i+1}/${parcelas})`, 
            valor: valorTotal/parcelas, data_vencimento: dataBase
        });
    }
    
    try {
        const { error } = await supabase.from('dividas').insert(parcelasArray);
        if (error) throw error;
        await atualizarTudo();
        fecharModalDivida();
    } catch(e) {
        alert("Erro ao salvar dívida: " + e.message);
    }
}

function carregarCategorias() {
    document.getElementById('grid-categorias').innerHTML = categoriasGlobais.map(c => `
        <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"><i class="fa-solid ${c.icone} text-blue-500 text-3xl mb-2"></i><h4 class="font-bold text-lg">${c.nome}</h4></div>
    `).join('');
}
function abrirModalCategoria() { document.getElementById('modal-categoria').classList.remove('hidden'); }
function fecharModalCategoria() { document.getElementById('modal-categoria').classList.add('hidden'); }

async function salvarNovaCategoria() {
    const nome = document.getElementById('cat-nome').value;
    if(!nome) return;
    
    try {
        const { error } = await supabase.from('categorias').insert([{ usuario_id: usuarioLogado.id, nome: nome, icone: 'fa-tag', cor: 'text-blue-500' }]);
        if (error) throw error;
        await atualizarTudo();
        fecharModalCategoria();
    } catch(e) {
        alert("Erro ao criar categoria: " + e.message);
    }
}

function carregarPlanos() {
    document.getElementById('grid-planos').innerHTML = planosGlobais.map(p => {
        const perc = Math.min((p.valor_atual / p.valor_meta) * 100, 100);
        return `<div class="bg-white p-6 rounded-3xl border border-gray-100"><h3 class="font-black text-lg mb-2">${p.nome}</h3><div class="w-full bg-gray-100 rounded-full h-4"><div class="bg-blue-500 h-4 rounded-full" style="width: ${perc}%"></div></div></div>`;
    }).join('');
}
function abrirModalAporte() { document.getElementById('modal-aporte').classList.remove('hidden'); }
function fecharModalAporte() { document.getElementById('modal-aporte').classList.add('hidden'); }

async function salvarAporte() {
    const val = parseFloat(document.getElementById('aporte-valor').value);
    if(!val || planosGlobais.length === 0) return;
    const novoValor = planosGlobais[0].valor_atual + val;
    
    try {
        const { error } = await supabase.from('planos').update({ valor_atual: novoValor }).eq('id', planosGlobais[0].id).eq('usuario_id', usuarioLogado.id);
        if (error) throw error;
        await atualizarTudo();
        fecharModalAporte();
    } catch(e) {
        alert("Erro ao salvar aporte: " + e.message);
    }
}

function mudarAba(nome) {
    document.querySelectorAll('.aba-conteudo').forEach(a => a.classList.add('escondido'));
    document.getElementById(`aba-${nome}`).classList.remove('escondido');
}
