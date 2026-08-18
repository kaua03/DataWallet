// ==========================================
// compras.js - MOTOR MULTIPLAYER (VALIDAÇÃO UX) E AUTO-LOGIN
// ==========================================

let usuarioLogado = null;
let carrinho = []; 
let historicoPrecos = []; 
let historicoAgrupadoRecibos = [];
let precoReferenciaHistorico = 0; 
let html5QrCode = null; 
let debounceBuscaTimeout = null;
let scanOriginadoDoModal = false;

let sessaoAtualId = null;
let meuApelido = "Dono(a)"; 
let realTimeChannel = null;
let otpInterval = null;
let tempoRestanteOTP = 0;

function getDbClient() {
    return window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
}

window.abrirModalShare = abrirModalShare;

const produtosComuns = [
    { ean: "7896098900123", nome: "Sabão em Barra Ypê Verde", icone: "fa-soap", cor: "text-emerald-500" },
    { nome: "Arroz Branco 5kg", icone: "fa-bowl-rice", cor: "text-amber-500" },
    { nome: "Feijão Carioca 1kg", icone: "fa-seedling", cor: "text-amber-700" },
    { nome: "Óleo de Soja 900ml", icone: "fa-bottle-droplet", cor: "text-yellow-500" },
    { nome: "Açúcar Refinado 1kg", icone: "fa-cubes-stacked", cor: "text-slate-300" },
    { nome: "Café Torrado 500g", icone: "fa-mug-hot", cor: "text-stone-800" },
    { nome: "Leite Integral 1L", icone: "fa-cow", cor: "text-slate-400" },
    { nome: "Macarrão Espaguete", icone: "fa-plate-wheat", cor: "text-amber-400" },
    { nome: "Papel Higiênico", icone: "fa-toilet-paper", cor: "text-slate-300" },
    { nome: "Sabão em Pó", icone: "fa-box", cor: "text-blue-500" },
    { nome: "Detergente", icone: "fa-bottle-water", cor: "text-lime-500" },
    { nome: "Creme Dental", icone: "fa-pump-soap", cor: "text-teal-400" },
    { nome: "Ovos (Cartela)", icone: "fa-egg", cor: "text-orange-200" }
];

document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(() => document.body.classList.remove('fade-in'), 300);

    document.querySelectorAll('a').forEach(link => {
        if(link.hostname === window.location.hostname && link.target !== '_blank') {
            link.addEventListener('click', e => {
                e.preventDefault();
                document.body.style.opacity = 0; document.body.style.transition = 'opacity 0.2s';
                setTimeout(() => window.location.href = link.getAttribute('href'), 200);
            });
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const guestSessionId = urlParams.get('s');

    if (guestSessionId) {
        sessaoAtualId = guestSessionId;
        
        const savedSession = localStorage.getItem('DW_GuestSession');
        const savedName = localStorage.getItem('DW_GuestName');
        
        if (savedSession === guestSessionId && savedName) {
            const client = getDbClient();
            const { data } = await client.from('mercado_sessoes').select('status').eq('id', guestSessionId).single();
            if (data && data.status === 'ativa') {
                meuApelido = savedName;
                document.getElementById('badge-live').classList.remove('hidden');
                document.getElementById('badge-live').classList.add('inline-flex');
                await carregarCarrinhoDB();
                iniciarSubscriptionRealtime();
                return; 
            } else {
                localStorage.removeItem('DW_GuestSession');
            }
        }
        document.getElementById('modal-convidado').classList.remove('hidden');
    } else {
        usuarioLogado = await verificarSessaoSegura();
        if (!usuarioLogado) return;
        meuApelido = "Dono(a)";
        
        const btnShareDesk = document.getElementById('btn-share-desktop');
        if(btnShareDesk) { btnShareDesk.classList.remove('hidden'); btnShareDesk.classList.add('md:flex'); }
        
        await inicializarSessaoRealtimeOwner();
        await carregarHistoricoPrecos();
    }
});

// ==========================================
// MOTOR REAL-TIME, PRESENCE, E KICK GUEST
// ==========================================

async function inicializarSessaoRealtimeOwner() {
    const client = getDbClient();
    if (!client) return;

    const { data: sessoesAtivas } = await client.from('mercado_sessoes').select('id').eq('usuario_id', usuarioLogado.id).eq('status', 'ativa').order('criado_em', { ascending: false }).limit(1);
    
    if (sessoesAtivas && sessoesAtivas.length > 0) {
        sessaoAtualId = sessoesAtivas[0].id;
    } else {
        const { data: nova } = await client.from('mercado_sessoes').insert([{ usuario_id: usuarioLogado.id, status: 'ativa' }]).select('id');
        if (nova) sessaoAtualId = nova[0].id;
    }

    document.getElementById('badge-live').classList.add('hidden'); 
    await carregarCarrinhoDB();
    iniciarSubscriptionRealtime();
}

async function carregarCarrinhoDB() {
    if (!sessaoAtualId) return;
    const client = getDbClient();
    const { data } = await client.from('mercado_carrinho').select('*').eq('sessao_id', sessaoAtualId).order('criado_em', { ascending: false });
    carrinho = data || [];
    renderizarCarrinho();
}

function iniciarSubscriptionRealtime() {
    const client = getDbClient();
    if (realTimeChannel) client.removeChannel(realTimeChannel);

    realTimeChannel = client.channel(`room-${sessaoAtualId}`, {
        config: { presence: { key: meuApelido }, broadcast: { self: true } }
    });

    realTimeChannel
        .on('presence', { event: 'sync' }, () => {
            const newState = realTimeChannel.presenceState();
            const totalUsers = Object.keys(newState).length;
            const badgeLive = document.getElementById('badge-live');
            
            if (badgeLive && meuApelido === "Dono(a)") {
                if (totalUsers > 1) {
                    badgeLive.classList.remove('hidden');
                    badgeLive.classList.add('inline-flex');
                } else {
                    badgeLive.classList.add('hidden');
                    badgeLive.classList.remove('inline-flex');
                }
            }
        })
        .on('broadcast', { event: 'comando_sala' }, (payload) => {
            if (payload.payload.acao === 'kick' && payload.payload.alvo === meuApelido) {
                Swal.fire('Desconectado', 'O administrador fechou a sua conexão com a lista.', 'info').then(() => {
                    localStorage.removeItem('DW_GuestSession');
                    window.location.href = window.location.pathname; 
                });
            }
            if (payload.payload.acao === 'encerrar' && meuApelido !== "Dono(a)") {
                Swal.fire('Compra Finalizada', 'A compra foi confirmada no caixa!', 'success').then(() => {
                    localStorage.removeItem('DW_GuestSession');
                    window.location.href = window.location.pathname;
                });
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mercado_carrinho', filter: `sessao_id=eq.${sessaoAtualId}` }, payload => {
            carregarCarrinhoDB(); 
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await realTimeChannel.track({ online_at: new Date().toISOString() });
            }
        });
}

// ---------------------------------------------------------
// GERENCIADOR DE LIVE (PAINEL DE EXPULSAR)
// ---------------------------------------------------------
window.abrirGerenciadorLive = function() {
    if (meuApelido !== "Dono(a)") return Swal.fire('Visualizando', 'Apenas o administrador do carrinho pode gerenciar membros.', 'info');
    
    const state = realTimeChannel.presenceState();
    let html = '';
    for (const [user] of Object.entries(state)) {
        if (user === "Dono(a)") continue;
        html += `
            <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span class="font-bold text-slate-900 dark:text-white"><i class="fa-solid fa-user text-indigo-500 mr-2"></i> ${user}</span>
                <button onclick="expulsarUsuario('${user}')" class="text-xs bg-rose-500 hover:bg-rose-600 text-white font-black py-1.5 px-3 rounded-lg shadow active:scale-95 transition-transform">Remover</button>
            </div>
        `;
    }
    
    if (html === '') html = '<p class="text-xs font-bold text-slate-400 py-4 text-center">Ninguém mais no carrinho.</p>';
    
    document.getElementById('lista-usuarios-live').innerHTML = html;
    document.getElementById('modal-gerenciar-live').classList.remove('hidden');
}

window.expulsarUsuario = function(apelido) {
    if (!realTimeChannel) return;
    realTimeChannel.send({ type: 'broadcast', event: 'comando_sala', payload: { acao: 'kick', alvo: apelido } });
    Swal.fire({ icon: 'success', title: 'Usuário Removido', showConfirmButton: false, timer: 1000 });
}

// ---------------------------------------------------------
// COMPARTILHAR CARRINHO E GERAÇÃO DE SENHA (OTP)
// ---------------------------------------------------------
async function abrirModalShare() {
    if (!sessaoAtualId) return Swal.fire('Aviso', 'Sessão ainda não inicializada.', 'warning');
    
    const url = new URL(window.location.href);
    url.searchParams.set('s', sessaoAtualId);
    const linkStr = url.toString();
    
    document.getElementById('share-link-input').value = linkStr;
    document.getElementById('qr-code-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(linkStr)}`;
    
    document.getElementById('modal-share').classList.remove('hidden');
    await gerarNovaSenhaSessao();
}

function fecharModalShare() {
    document.getElementById('modal-share').classList.add('hidden');
    clearInterval(otpInterval);
}

async function gerarNovaSenhaSessao() {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 60000).toISOString(); 
    
    document.getElementById('share-pin').innerText = pin;
    tempoRestanteOTP = 60; 
    atualizarTimerOTP();
    
    try {
        const client = getDbClient();
        await client.from('mercado_sessoes').update({ senha: pin, senha_expira_em: expiraEm }).eq('id', sessaoAtualId);
    } catch(e) {}

    clearInterval(otpInterval);
    otpInterval = setInterval(() => {
        tempoRestanteOTP--;
        atualizarTimerOTP();
        if (tempoRestanteOTP <= 0) gerarNovaSenhaSessao(); 
    }, 1000);
}

function atualizarTimerOTP() {
    const span = document.getElementById('share-timer');
    const bar = document.getElementById('share-timer-bar');
    if(span) span.innerText = tempoRestanteOTP;
    if(bar) bar.style.width = `${(tempoRestanteOTP / 60) * 100}%`;
}

function copiarLinkShare() {
    const input = document.getElementById('share-link-input');
    input.select(); document.execCommand('copy');
    Swal.fire({ icon: 'success', title: 'Copiado!', showConfirmButton: false, timer: 1000 });
}

// ---------------------------------------------------------
// AUTENTICAÇÃO DO CONVIDADO (COM AVISOS CLAROS DE UX)
// ---------------------------------------------------------
async function entrarComoConvidado() {
    const nomeInput = document.getElementById('input-convidado-nome');
    const senhaInput = document.getElementById('input-convidado-senha');
    
    const nome = nomeInput.value.trim();
    const senha = senhaInput.value.trim();
    
    if (!nome) {
        nomeInput.classList.add('ring-2', 'ring-rose-500');
        setTimeout(() => nomeInput.classList.remove('ring-2', 'ring-rose-500'), 2000);
        return Swal.fire('Aviso', 'Por favor, informe seu nome para entrar.', 'warning');
    }
    
    if (!senha || senha.length !== 6) {
        senhaInput.classList.add('ring-2', 'ring-rose-500');
        setTimeout(() => senhaInput.classList.remove('ring-2', 'ring-rose-500'), 2000);
        return Swal.fire('Aviso', 'Informe a senha de 6 dígitos que aparece no celular de quem compartilhou.', 'warning');
    }
    
    Swal.fire({ title: 'Verificando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    
    const client = getDbClient();
    const { data, error } = await client.from('mercado_sessoes').select('senha, senha_expira_em').eq('id', sessaoAtualId).single();
        
    Swal.close();
    
    if (error || !data) return Swal.fire('Erro', 'Sessão inválida ou não existe mais.', 'error');
    if (data.senha !== senha) return Swal.fire('Acesso Negado', 'A senha está incorreta.', 'error');
    if (new Date() > new Date(data.senha_expira_em)) return Swal.fire('Acesso Negado', 'Essa senha expirou! Olhe o celular novamente e digite o novo código.', 'error');
    
    meuApelido = nome;
    
    localStorage.setItem('DW_GuestSession', sessaoAtualId);
    localStorage.setItem('DW_GuestName', meuApelido);
    
    document.getElementById('modal-convidado').classList.add('hidden');
    document.getElementById('badge-live').classList.remove('hidden');
    document.getElementById('badge-live').classList.add('inline-flex');
    
    await carregarCarrinhoDB();
    iniciarSubscriptionRealtime();
    Swal.fire({ icon: 'success', title: 'Você entrou na compra!', showConfirmButton: false, timer: 1500 });
}

// ---------------------------------------------------------
// FUNÇÕES UTILITÁRIAS
// ---------------------------------------------------------
function formatarMoedaLocal(valor) {
    let p = Math.abs(valor).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (valor < 0 ? "- R$ " : "R$ ") + p.join(',');
}

function aplicarMascaraMoeda(input) {
    let valor = input.value.replace(/\D/g, ''); 
    if (valor === '') { input.value = ''; return; }
    valor = (parseInt(valor) / 100).toFixed(2) + '';
    valor = valor.replace(".", ","); valor = valor.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,"); valor = valor.replace(/(\d)(\d{3}),/g, "$1.$2,");
    input.value = valor;
}

function desmascararMoeda(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

function removerAcentos(texto) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function mudarAba(aba) {
    const btnCar = document.getElementById('tab-carrinho');
    const btnHist = document.getElementById('tab-historico');
    const viewCar = document.getElementById('view-carrinho');
    const viewHist = document.getElementById('view-historico');

    const classeAtiva = ['bg-white', 'text-indigo-600', 'dark:bg-slate-800', 'dark:text-indigo-400', 'shadow-sm'];
    const classeInativa = ['text-indigo-100', 'hover:text-white', 'bg-transparent', 'shadow-none'];

    if (aba === 'carrinho') {
        btnHist.classList.remove(...classeAtiva); btnHist.classList.add(...classeInativa);
        btnCar.classList.remove(...classeInativa); btnCar.classList.add(...classeAtiva);
        viewHist.classList.add('hidden'); viewCar.classList.remove('hidden');
    } else {
        btnCar.classList.remove(...classeAtiva); btnCar.classList.add(...classeInativa);
        btnHist.classList.remove(...classeInativa); btnHist.classList.add(...classeAtiva);
        viewCar.classList.add('hidden'); viewHist.classList.remove('hidden');
        renderizarListaDeRecibos(); 
    }
}

// ---------------------------------------------------------
// CÂMERA E OPEN FOOD FACTS
// ---------------------------------------------------------
function tocarBipSucesso() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(1000, ctx.currentTime); 
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        osc.connect(gainNode); gainNode.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.15); 
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch(e) {}
}

async function abrirLeitorCamera(fromModal = false) {
    scanOriginadoDoModal = fromModal;
    try {
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) return Swal.fire('Aviso', 'Nenhuma câmera encontrada.', 'info');
    } catch (err) { return Swal.fire('Erro na Câmera', 'Permissão negada.', 'error'); }

    document.getElementById('modal-camera').classList.remove('hidden');
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, 
        async (decodedText) => {
            tocarBipSucesso();
            await fecharLeitorCamera();
            processarCodigoDeBarras(decodedText, scanOriginadoDoModal);
        },
        () => { }
    ).catch(() => {
        fecharLeitorCamera(); Swal.fire('Erro', 'Não foi possível acessar a câmera.', 'error');
    });
}

async function fecharLeitorCamera() {
    document.getElementById('modal-camera').classList.add('hidden');
    if (html5QrCode) { try { await html5QrCode.stop(); html5QrCode.clear(); } catch(e) {} html5QrCode = null; }
}

async function processarCodigoDeBarras(codigo, isUpdate = false) {
    if (isUpdate) document.getElementById('prod-codigo-barras').value = codigo;
    Swal.fire({ title: 'Buscando Produto...', html: `Código: ${codigo}`, allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const achouLocal = produtosComuns.find(p => p.ean === codigo);
    if (achouLocal) {
        Swal.close();
        if (isUpdate) atualizarCamposModalProduto(achouLocal.nome, achouLocal.icone, achouLocal.cor, null, codigo);
        else abrirModalProduto(achouLocal.nome, achouLocal.icone, achouLocal.cor, null, null, codigo);
        return;
    }

    try {
        const resOFF = await fetch(`https://world.openfoodfacts.org/api/v0/product/${codigo}.json`);
        const jsonOFF = await resOFF.json();
        Swal.close();

        if (jsonOFF.status === 1 && jsonOFF.product) {
            const nomeProduto = jsonOFF.product.product_name_pt || jsonOFF.product.product_name || '';
            const imagemUrl = jsonOFF.product.image_front_url || null;
            if (isUpdate) atualizarCamposModalProduto(nomeProduto, 'fa-barcode', 'text-indigo-500', imagemUrl, codigo);
            else abrirModalProduto(nomeProduto, 'fa-barcode', 'text-indigo-500', null, imagemUrl, codigo);
        } else {
            if (isUpdate) atualizarCamposModalProduto('', 'fa-barcode', 'text-slate-500', null, codigo);
            else abrirModalProduto('', 'fa-barcode', 'text-slate-500', null, null, codigo);
        }
    } catch (e) {
        Swal.close();
        if (isUpdate) atualizarCamposModalProduto('', 'fa-barcode', 'text-slate-500', null, codigo);
        else abrirModalProduto('', 'fa-barcode', 'text-slate-500', null, null, codigo);
    }
}

function atualizarCamposModalProduto(nome, icone, cor, imgUrl, codigo) {
    const inputNome = document.getElementById('prod-nome');
    if (nome) inputNome.value = nome;
    document.getElementById('prod-img-hidden').value = imgUrl || '';
    document.getElementById('prod-codigo-barras').value = codigo || '';
    
    const imgContainer = document.getElementById('prod-img-container');
    if (imgUrl) {
        imgContainer.innerHTML = `<img src="${imgUrl}" class="w-full h-full object-cover">`;
        imgContainer.className = "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden bg-white";
    } else {
        imgContainer.innerHTML = `<i class="fa-solid ${icone}"></i>`;
        imgContainer.className = `w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm overflow-hidden bg-slate-50 dark:bg-slate-800 ${cor}`;
    }

    const btnGoogle = document.getElementById('btn-google-fallback');
    if ((!nome || nome.trim() === '') && codigo) {
        btnGoogle.href = `https://www.google.com/search?q=${codigo}`;
        btnGoogle.classList.remove('hidden'); btnGoogle.classList.add('block');
    } else {
        btnGoogle.classList.add('hidden'); btnGoogle.classList.remove('block');
    }

    if (nome && meuApelido === "Dono(a)") analisarPrecoHistoricoInicial(nome);
    if (!nome || nome.trim() === '') inputNome.focus(); else document.getElementById('prod-preco').focus();
}

function buscarProdutosAutocompletar() {
    const inputStr = document.getElementById('input-busca-produto').value;
    const termo = removerAcentos(inputStr);
    const box = document.getElementById('box-autocomplete');
    const btnLimpar = document.getElementById('btn-limpar-busca');

    if (termo.length === 0) { box.classList.add('hidden'); btnLimpar.classList.add('hidden'); return; }

    btnLimpar.classList.remove('hidden');
    let resultadosHTML = produtosComuns.filter(p => removerAcentos(p.nome).includes(termo)).slice(0, 4).map(p => `
        <div onclick="abrirModalProduto('${p.nome.replace(/'/g, "\\'")}', '${p.icone}', '${p.cor}')" class="autocomplete-item p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 cursor-pointer">
            <div class="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-lg ${p.cor}"><i class="fa-solid ${p.icone}"></i></div>
            <span class="font-bold text-slate-900 dark:text-white">${p.nome}</span>
        </div>
    `).join('');

    resultadosHTML = `
        <div onclick="abrirModalProduto('${inputStr.replace(/'/g, "\\'")}', 'fa-box', 'text-indigo-500')" class="autocomplete-item p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 cursor-pointer bg-indigo-50/50 dark:bg-indigo-900/10">
            <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center text-lg text-indigo-600 dark:text-indigo-300"><i class="fa-solid fa-plus"></i></div>
            <span class="font-black text-indigo-700 dark:text-indigo-300">Adicionar "${inputStr}"</span>
        </div>
    ` + resultadosHTML;

    box.innerHTML = resultadosHTML + `<div id="spinner-api-busca" class="p-3 text-center text-slate-400 text-xs font-bold"><i class="fa-solid fa-spinner fa-spin"></i> Buscando online...</div>`;
    box.classList.remove('hidden');

    clearTimeout(debounceBuscaTimeout);
    if (termo.length >= 3) {
        debounceBuscaTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${termo}&search_simple=1&action=process&json=1&page_size=3`);
                const json = await res.json();
                const spinner = document.getElementById('spinner-api-busca');
                if(spinner) spinner.remove();

                if (json.products && json.products.length > 0) {
                    const apiHTML = json.products.map(p => {
                        const nomeP = (p.product_name_pt || p.product_name || 'Produto').replace(/'/g, "");
                        const imgP = p.image_front_small_url || '';
                        const imgTag = imgP ? `<img src="${imgP}" class="w-full h-full object-cover rounded-full">` : `<i class="fa-solid fa-barcode"></i>`;
                        return `
                        <div onclick="abrirModalProduto('${nomeP}', 'fa-barcode', 'text-slate-400', null, '${imgP}')" class="autocomplete-item p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 cursor-pointer">
                            <div class="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-lg text-slate-400 border border-slate-200 dark:border-slate-700 overflow-hidden">${imgTag}</div>
                            <span class="font-bold text-slate-900 dark:text-white line-clamp-1">${nomeP}</span>
                        </div>`;
                    }).join('');
                    box.innerHTML += apiHTML;
                }
            } catch (e) {}
        }, 800);
    } else {
        const spinner = document.getElementById('spinner-api-busca');
        if(spinner) spinner.remove();
    }
}

function limparBusca() {
    const input = document.getElementById('input-busca-produto');
    input.value = ''; buscarProdutosAutocompletar(); input.focus();
}

async function abrirModalProduto(nomeProduto, icone = 'fa-barcode', cor = 'text-indigo-500', dbId = null, imagemUrl = null, codigoBarras = null) {
    document.getElementById('box-autocomplete').classList.add('hidden');
    document.getElementById('input-busca-produto').value = '';
    document.getElementById('btn-limpar-busca').classList.add('hidden');

    const form = document.getElementById('form-produto');
    form.reset();

    if (dbId && dbId !== 'null') {
        const item = carrinho.find(i => i.id === dbId);
        if (item) {
            if (item.editando_por && item.editando_por !== meuApelido) {
                return Swal.fire('Bloqueado', `Sendo alterado por: <b>${item.editando_por}</b>. Aguarde.`, 'warning');
            }
            
            const client = getDbClient();
            await client.from('mercado_carrinho').update({ editando_por: meuApelido }).eq('id', dbId);
            
            document.getElementById('prod-qtd').value = item.quantidade;
            document.getElementById('prod-obs').value = item.obs || '';
            let v = item.preco.toFixed(2).replace('.', ',');
            v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,"); v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
            document.getElementById('prod-preco').value = v;
            
            atualizarCamposModalProduto(item.nome, item.icone, item.cor, item.img_url, item.ean);
            document.getElementById('prod-id').value = dbId;
            calcularTotalItemModal(); 
        }
    } else {
        atualizarCamposModalProduto(nomeProduto, icone, cor, imagemUrl, codigoBarras);
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-qtd').value = 1;
        document.getElementById('prod-obs').value = '';
        document.getElementById('prod-subtotal').innerText = 'R$ 0,00';
    }

    document.getElementById('modal-produto').classList.remove('hidden');
}

async function fecharModalProduto() {
    document.getElementById('modal-produto').classList.add('hidden');
    
    const dbId = document.getElementById('prod-id').value;
    if (dbId) {
        const client = getDbClient();
        await client.from('mercado_carrinho').update({ editando_por: null }).eq('id', dbId);
    }
}

function ajustarQtd(delta) {
    if (navigator.vibrate) navigator.vibrate(50);
    const input = document.getElementById('prod-qtd');
    let atual = parseInt(input.value) || 1;
    atual += delta; if (atual < 1) atual = 1;
    input.value = atual;
    calcularTotalItemModal();
}

function analisarPrecoHistoricoInicial(nomeProduto) {
    const box = document.getElementById('box-inteligencia-preco');
    if (meuApelido !== "Dono(a)") { box.classList.add('hidden'); precoReferenciaHistorico = 0; return; }

    const icone = document.getElementById('icone-inteligencia');
    const texto = document.getElementById('texto-inteligencia');
    const nomeNormalizado = removerAcentos(nomeProduto);
    if (!nomeNormalizado) { box.classList.add('hidden'); precoReferenciaHistorico = 0; return; }

    const historicoItem = historicoPrecos.find(h => removerAcentos(h.nome) === nomeNormalizado);
    
    if (historicoItem) {
        precoReferenciaHistorico = parseFloat(historicoItem.preco_unitario);
        box.classList.remove('hidden');
        box.className = "mb-4 p-2.5 rounded-xl border flex items-center gap-2.5 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 transition-colors";
        icone.className = "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
        icone.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>';
        texto.innerHTML = `Última vez pago: <b>${formatarMoedaLocal(precoReferenciaHistorico)}</b>. Digite o preço atual.`;
    } else {
        precoReferenciaHistorico = 0;
        box.classList.add('hidden');
    }
}

function calcularTotalItemModal() {
    const precoAtual = desmascararMoeda(document.getElementById('prod-preco').value) || 0;
    const qtd = parseInt(document.getElementById('prod-qtd').value) || 1;
    document.getElementById('prod-subtotal').innerText = formatarMoedaLocal(precoAtual * qtd);

    if (precoReferenciaHistorico > 0 && precoAtual > 0 && meuApelido === "Dono(a)") {
        const box = document.getElementById('box-inteligencia-preco');
        const icone = document.getElementById('icone-inteligencia');
        const texto = document.getElementById('texto-inteligencia');
        
        const diferenca = precoAtual - precoReferenciaHistorico;
        const percentual = Math.abs((diferenca / precoReferenciaHistorico) * 100).toFixed(1);

        if (diferenca > 0.01) {
            box.className = "mb-4 p-2.5 rounded-xl border flex items-center gap-2.5 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 transition-colors";
            icone.className = "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400";
            icone.innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i>';
            texto.innerHTML = `Atenção: <b class="text-rose-600 dark:text-rose-400">${formatarMoedaLocal(Math.abs(diferenca))} mais caro</b> (+${percentual}%)`;
        } else if (diferenca < -0.01) {
            box.className = "mb-4 p-2.5 rounded-xl border flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 transition-colors";
            icone.className = "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
            icone.innerHTML = '<i class="fa-solid fa-arrow-trend-down"></i>';
            texto.innerHTML = `Ótimo! <b class="text-emerald-600 dark:text-emerald-400">${formatarMoedaLocal(Math.abs(diferenca))} mais barato</b> (-${percentual}%)`;
        } else {
            box.className = "mb-4 p-2.5 rounded-xl border flex items-center gap-2.5 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 transition-colors";
            icone.className = "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
            icone.innerHTML = '<i class="fa-solid fa-equals"></i>';
            texto.innerHTML = `O preço cravou o mesmo da última compra.`;
        }
    }
}

async function salvarItemCarrinho(event) {
    event.preventDefault();
    if (!sessaoAtualId) return Swal.fire('Erro', 'Sessão Perdida. Recarregue a página.', 'error');

    const dbId = document.getElementById('prod-id').value;
    let nome = document.getElementById('prod-nome').value.trim();
    if (!nome) nome = "Produto Genérico";
    
    const obs = document.getElementById('prod-obs').value.trim();
    const imgUrl = document.getElementById('prod-img-hidden').value;
    const ean = document.getElementById('prod-codigo-barras').value;
    const preco = desmascararMoeda(document.getElementById('prod-preco').value);
    const qtd = parseInt(document.getElementById('prod-qtd').value);

    if (preco <= 0) return Swal.fire('Atenção', 'Informe o preço.', 'warning');

    const dic = produtosComuns.find(p => removerAcentos(p.nome) === removerAcentos(nome));
    
    const payload = {
        sessao_id: sessaoAtualId,
        nome: nome,
        preco: preco,
        quantidade: qtd,
        obs: obs,
        img_url: imgUrl,
        ean: ean,
        icone: dic ? dic.icone : 'fa-box',
        cor: dic ? dic.cor : 'text-slate-500',
        editando_por: null 
    };

    if (dbId && dbId !== 'null') payload.id = dbId;

    if (navigator.vibrate) navigator.vibrate([50, 50, 50]); 
    document.getElementById('modal-produto').classList.add('hidden'); 

    const client = getDbClient();
    await client.from('mercado_carrinho').upsert(payload);
}

async function removerItem(dbId) {
    const item = carrinho.find(i => i.id === dbId);
    if (item && item.editando_por && item.editando_por !== meuApelido) {
        return Swal.fire('Bloqueado', `Sendo editado por: ${item.editando_por}`, 'warning');
    }
    if (navigator.vibrate) navigator.vibrate(50);
    const client = getDbClient();
    await client.from('mercado_carrinho').delete().eq('id', dbId);
}

function renderizarCarrinho() {
    const container = document.getElementById('lista-carrinho');
    const totalEl = document.getElementById('total-carrinho');
    const qtdEl = document.getElementById('qtd-itens-carrinho');
    const btnFinalizarTopo = document.getElementById('btn-finalizar-topo');

    let total = 0; let qtdItens = 0;

    if (carrinho.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 opacity-60">
                <div class="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-basket-shopping text-4xl text-slate-400"></i>
                </div>
                <p class="text-sm font-bold text-slate-500 dark:text-slate-400 text-center max-w-[250px]">O carrinho está vazio.<br>Bipe ou digite o nome de um produto.</p>
            </div>`;
        totalEl.innerText = "R$ 0,00"; qtdEl.innerText = "0";
        if (btnFinalizarTopo) { btnFinalizarTopo.classList.add('hidden'); btnFinalizarTopo.classList.remove('flex'); }
        return;
    }

    if (btnFinalizarTopo && meuApelido === "Dono(a)") { 
        btnFinalizarTopo.classList.remove('hidden'); btnFinalizarTopo.classList.add('flex');
    }

    const html = carrinho.map((item) => {
        const sub = item.preco * item.quantidade;
        total += sub; qtdItens += item.quantidade;
        
        let miniFoto = item.img_url 
            ? `<img src="${item.img_url}" class="w-full h-full object-cover">` 
            : `<i class="fa-solid ${item.icone}"></i>`;

        let travaHtml = item.editando_por 
            ? `<div class="absolute top-2 right-2 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow z-10"><i class="fa-solid fa-lock mr-1"></i>${item.editando_por} editando</div>` 
            : '';

        let obsHtml = item.obs ? `<p class="text-[9px] font-bold text-amber-500 dark:text-amber-400 mt-1"><i class="fa-solid fa-info-circle mr-1"></i>${item.obs}</p>` : '';

        return `
        <div class="relative bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer ${item.editando_por ? 'opacity-50 ring-2 ring-amber-500/50' : ''}" onclick="abrirModalProduto('${item.nome.replace(/'/g, "\\'")}', '${item.icone}', '${item.cor}', '${item.id}', '${item.img_url}', '${item.ean}')">
            ${travaHtml}
            <div class="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xl shrink-0 overflow-hidden ${item.img_url ? '' : item.cor}">
                ${miniFoto}
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-slate-900 dark:text-white text-sm truncate">${item.nome}</h4>
                <p class="text-[10px] font-bold text-slate-400 uppercase mt-0.5">${item.quantidade}x ${formatarMoedaLocal(item.preco)}</p>
                ${obsHtml}
            </div>
            <div class="text-right shrink-0 flex items-center gap-3">
                <span class="font-black text-indigo-600 dark:text-indigo-400 text-base block">${formatarMoedaLocal(sub)}</span>
                <button onclick="event.stopPropagation(); removerItem('${item.id}')" class="w-8 h-8 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400 rounded-lg flex items-center justify-center z-10"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
    let parts = Math.abs(total).toFixed(2).split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    totalEl.innerText = "R$ " + parts.join(','); qtdEl.innerText = qtdItens;
}

// ---------------------------------------------------------
// FINALIZAÇÃO DE COMPRA
// ---------------------------------------------------------
function abrirModalCheckout() {
    if (carrinho.length === 0) return;
    
    let total = 0; carrinho.forEach(i => total += (i.preco * i.quantidade));
    document.getElementById('checkout-total').innerText = formatarMoedaLocal(total);
    const hoje = new Date(); const v = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10);
    document.getElementById('checkout-data').value = v.toISOString().split('T')[0];
    toggleParcelasCheckout(); document.getElementById('modal-checkout').classList.remove('hidden');
}

function fecharModalCheckout() { 
    document.getElementById('modal-checkout').classList.add('hidden'); 
}

function toggleParcelasCheckout() {
    const tipo = document.querySelector('input[name="pagamento"]:checked').value;
    const box = document.getElementById('box-parcelas');
    if (tipo === 'credito') { box.classList.remove('hidden'); box.classList.add('grid'); } else { box.classList.add('hidden'); box.classList.remove('grid'); }
}

async function efetivarCompra(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-processar-compra');
    const htmlOriginal = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...'; btn.disabled = true;

    try {
        const client = getDbClient();
        if (!client) throw new Error("Cliente não encontrado.");

        let total = 0; carrinho.forEach(i => total += (i.preco * i.quantidade));
        const descLocal = document.getElementById('checkout-desc').value || "Compra no Mercado";
        const tipoPagamento = document.querySelector('input[name="pagamento"]:checked').value;
        
        const { data: catData } = await client.from('categorias').select('id, nome').eq('usuario_id', usuarioLogado.id);
        let idCategoria = null;
        if (catData && catData.length > 0) {
            const alimentacao = catData.find(c => c.nome.toLowerCase().includes('alimentação') || c.nome.toLowerCase().includes('mercado'));
            idCategoria = alimentacao ? alimentacao.id : catData[0].id;
        }

        const transacoesParaInserir = [];
        if (tipoPagamento === 'avista') {
            transacoesParaInserir.push({ usuario_id: usuarioLogado.id, tipo: 'despesa', descricao: descLocal, valor: total, data_vencimento: new Date().toISOString().split('T')[0], categoria_id: idCategoria, pago: true });
        } else {
            const numParcelas = parseInt(document.getElementById('checkout-parcelas').value) || 1;
            const dataPrimeiroVenc = document.getElementById('checkout-data').value;
            const valorParcela = total / numParcelas;
            for (let i = 0; i < numParcelas; i++) {
                let dCalc = new Date(dataPrimeiroVenc + 'T12:00:00Z'); dCalc.setMonth(dCalc.getMonth() + i);
                let dFinal = numParcelas > 1 ? `${descLocal} (${i + 1}/${numParcelas})` : descLocal;
                transacoesParaInserir.push({ usuario_id: usuarioLogado.id, tipo: 'despesa', descricao: dFinal, valor: valorParcela, data_vencimento: dCalc.toISOString().split('T')[0], categoria_id: idCategoria, pago: false });
            }
        }

        const { data: retTrans, error: errT } = await client.from('transacoes').insert(transacoesParaInserir).select();
        if (errT) throw errT;

        const itensParaInserir = carrinho.map(item => ({ usuario_id: usuarioLogado.id, nome: item.nome, preco_unitario: item.preco, quantidade: item.quantidade, transacao_id: retTrans[0].id }));
        await client.from('mercado_itens').insert(itensParaInserir);

        await client.from('mercado_sessoes').update({status: 'finalizada'}).eq('id', sessaoAtualId);
        
        if (realTimeChannel) realTimeChannel.send({ type: 'broadcast', event: 'comando_sala', payload: { acao: 'encerrar' } });

        fecharModalCheckout(); 
        await inicializarSessaoRealtimeOwner(); 
        await carregarHistoricoPrecos();
        dispararOverlaySucesso("Compra Registrada!");
    } catch (e) { Swal.fire('Erro ao Finalizar', e.message, 'error'); } finally { btn.innerHTML = htmlOriginal; btn.disabled = false; }
}

// ---------------------------------------------------------
// ANIMAÇÃO LOTTIE COM CANCELAMENTO GARANTIDO
// ---------------------------------------------------------
window.fecharOverlaySucesso = function() {
    const overlay = document.getElementById('overlay-sucesso');
    if (overlay && !overlay.classList.contains('hidden')) {
        overlay.classList.add('hidden');
        if (window.lottieInstance) {
            window.lottieInstance.destroy();
            window.lottieInstance = null;
        }
        clearTimeout(window.fecharOverlayTimeout);
    }
};

function dispararOverlaySucesso(subtexto) {
    const overlay = document.getElementById('overlay-sucesso');
    if (!overlay) return;

    document.getElementById('overlay-texto').innerText = subtexto;
    overlay.classList.remove('hidden');

    if (window.lottieInstance) window.lottieInstance.destroy();

    if (window.DotLottie) {
        window.lottieInstance = new window.DotLottie({
            autoplay: true,
            loop: true, 
            canvas: document.getElementById("canvas-lottie"),
            src: "https://lottie.host/2ce5f1a7-2937-4da3-9a5c-caa2e7700556/3Pv1oQDKS5.lottie",
        });
    }

    window.fecharOverlayTimeout = setTimeout(() => { window.fecharOverlaySucesso(); }, 3500);
}

// ---------------------------------------------------------
// HISTÓRICO DE RECIBOS E CONTA DO DONO
// ---------------------------------------------------------
async function carregarHistoricoPrecos() {
    try {
        const client = getDbClient();
        if (!client) return;

        const { data: itensDB } = await client.from('mercado_itens').select('*').eq('usuario_id', usuarioLogado.id).order('criado_em', { ascending: false });
        if (itensDB) historicoPrecos = itensDB;

        const { data: transacoesMercado } = await client.from('transacoes').select('id, descricao, data_vencimento').eq('usuario_id', usuarioLogado.id).order('data_vencimento', { ascending: false });
        
        if (itensDB && transacoesMercado) {
            let recibosMap = {};
            itensDB.forEach(item => {
                if(item.transacao_id) {
                    if(!recibosMap[item.transacao_id]) {
                        const transPai = transacoesMercado.find(t => t.id === item.transacao_id);
                        recibosMap[item.transacao_id] = { id: item.transacao_id, descricao: transPai ? transPai.descricao : "Compra", data: transPai ? transPai.data_vencimento : item.criado_em.split('T')[0], itens: [], total: 0 };
                    }
                    recibosMap[item.transacao_id].itens.push(item);
                    recibosMap[item.transacao_id].total += (item.preco_unitario * item.quantidade);
                }
            });
            historicoAgrupadoRecibos = Object.values(recibosMap).sort((a,b) => new Date(b.data) - new Date(a.data));
        }
    } catch (e) {}
}

function renderizarListaDeRecibos() {
    const container = document.getElementById('lista-historico-recibos');
    if (historicoAgrupadoRecibos.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400"><i class="fa-solid fa-receipt text-3xl mb-2 opacity-50"></i><p class="text-xs font-bold uppercase">Nenhum recibo salvo.</p></div>`; return;
    }
    container.innerHTML = historicoAgrupadoRecibos.map(recibo => {
        let dStr = recibo.data.split('-').reverse().join('/');
        return `
        <div onclick="abrirReciboHistorico(${recibo.id})" class="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 active:scale-95 transition-transform cursor-pointer hover:border-indigo-300">
            <div class="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xl shrink-0"><i class="fa-solid fa-store"></i></div>
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-slate-900 dark:text-white text-base truncate">${recibo.descricao}</h4>
                <p class="text-[10px] font-bold text-slate-400 uppercase mt-0.5"><i class="fa-regular fa-calendar mr-1"></i> ${dStr} • ${recibo.itens.length} itens</p>
            </div>
            <div class="text-right shrink-0">
                <span class="font-black text-slate-900 dark:text-white text-lg block">${formatarMoedaLocal(recibo.total)}</span>
            </div>
        </div>`;
    }).join('');
}

function abrirReciboHistorico(transacaoId) {
    const recibo = historicoAgrupadoRecibos.find(r => r.id === transacaoId);
    if(!recibo) return;
    document.getElementById('recibo-titulo').innerText = recibo.descricao;
    document.getElementById('recibo-data').innerText = recibo.data.split('-').reverse().join('/');
    document.getElementById('recibo-total').innerText = formatarMoedaLocal(recibo.total);
    const lista = document.getElementById('lista-itens-recibo');
    lista.innerHTML = recibo.itens.map(item => `
        <div class="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
            <div>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${item.nome}</p>
                <p class="text-[10px] font-bold text-slate-400">${item.quantidade}x ${formatarMoedaLocal(item.preco_unitario)}</p>
            </div>
            <span class="text-sm font-black text-slate-900 dark:text-white">${formatarMoedaLocal(item.quantidade * item.preco_unitario)}</span>
        </div>
    `).join('');
    document.getElementById('modal-recibo').classList.remove('hidden');
}

function fecharModalRecibo() { 
    document.getElementById('modal-recibo').classList.add('hidden'); 
}
