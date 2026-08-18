// ==========================================
// compras.js - MOTOR DE CÂMERA, OPEN FOOD FACTS E PERSISTÊNCIA DE ESTADO
// ==========================================

let usuarioLogado = null;
let carrinho = []; 
let historicoPrecos = []; 
let historicoAgrupadoRecibos = [];
let precoReferenciaHistorico = 0; 
let html5QrCode = null; 
let debounceBuscaTimeout = null;
let scanOriginadoDoModal = false;

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
                const href = link.getAttribute('href');
                document.body.style.opacity = 0;
                document.body.style.transition = 'opacity 0.2s ease-in-out';
                setTimeout(() => window.location.href = href, 200);
            });
        }
    });

    usuarioLogado = await verificarSessaoSegura();
    if (!usuarioLogado) return;

    carregarCarrinhoLocal();
    await carregarHistoricoPrecos();
    renderizarCarrinho();
});

// ---------------------------------------------------------
// PERSISTÊNCIA DE ESTADO (LOCALSTORAGE)
// ---------------------------------------------------------
function salvarCarrinhoLocal() {
    if (usuarioLogado) {
        localStorage.setItem(`DataWallet_Carrinho_${usuarioLogado.id}`, JSON.stringify(carrinho));
    }
}

function carregarCarrinhoLocal() {
    if (usuarioLogado) {
        const salvo = localStorage.getItem(`DataWallet_Carrinho_${usuarioLogado.id}`);
        if (salvo) {
            try { carrinho = JSON.parse(salvo); } catch(e) { carrinho = []; }
        }
    }
}

function limparCarrinhoLocal() {
    if (usuarioLogado) {
        localStorage.removeItem(`DataWallet_Carrinho_${usuarioLogado.id}`);
    }
}

// ---------------------------------------------------------
// FUNÇÕES UTILITÁRIAS E NAVEGAÇÃO DE ABAS
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

function setVisibilidadeMenuGlobal(mostrar) {
    const fabContainer = document.getElementById('fab-container');
    if (fabContainer) {
        fabContainer.style.display = mostrar ? 'block' : 'none';
    }
}

// ---------------------------------------------------------
// CÂMERA E OPEN FOOD FACTS (API DE PRODUTOS)
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
        if (!devices || devices.length === 0) {
            return Swal.fire('Aviso', 'Nenhuma câmera encontrada neste dispositivo.', 'info');
        }
    } catch (err) {
        return Swal.fire('Erro na Câmera', 'Permissão de câmera negada ou indisponível.', 'error');
    }

    setVisibilidadeMenuGlobal(false);
    document.getElementById('modal-camera').classList.remove('hidden');
    
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrCode.start({ facingMode: "environment" }, config, 
        async (decodedText) => {
            tocarBipSucesso();
            await fecharLeitorCamera();
            processarCodigoDeBarras(decodedText, scanOriginadoDoModal);
        },
        (errorMessage) => { }
    ).catch((err) => {
        fecharLeitorCamera();
        Swal.fire('Erro na Câmera', 'Não foi possível acessar a câmera.', 'error');
    });
}

async function fecharLeitorCamera() {
    document.getElementById('modal-camera').classList.add('hidden');
    setVisibilidadeMenuGlobal(true);
    if (html5QrCode) {
        try { await html5QrCode.stop(); html5QrCode.clear(); } catch(e) {}
        html5QrCode = null;
    }
}

// ---------------------------------------------------------
// INTELIGÊNCIA: LOCAL -> OPEN FOOD FACTS
// ---------------------------------------------------------
async function processarCodigoDeBarras(codigo, isUpdate = false) {
    if (isUpdate) document.getElementById('prod-codigo-barras').value = codigo;

    Swal.fire({ title: 'Buscando Produto...', html: `Código: ${codigo}`, allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const achouLocal = produtosComuns.find(p => p.ean === codigo);
    if (achouLocal) {
        Swal.close();
        if (isUpdate) atualizarCamposModalProduto(achouLocal.nome, achouLocal.icone, achouLocal.cor, null, codigo);
        else abrirModalProduto(achouLocal.nome, achouLocal.icone, achouLocal.cor, -1, null, codigo);
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
            else abrirModalProduto(nomeProduto, 'fa-barcode', 'text-indigo-500', -1, imagemUrl, codigo);
        } else {
            if (isUpdate) atualizarCamposModalProduto('', 'fa-barcode', 'text-slate-500', null, codigo);
            else abrirModalProduto('', 'fa-barcode', 'text-slate-500', -1, null, codigo);
        }
    } catch (e) {
        Swal.close();
        if (isUpdate) atualizarCamposModalProduto('', 'fa-barcode', 'text-slate-500', null, codigo);
        else abrirModalProduto('', 'fa-barcode', 'text-slate-500', -1, null, codigo);
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
        btnGoogle.classList.remove('hidden');
        btnGoogle.classList.add('block');
    } else {
        btnGoogle.classList.add('hidden');
        btnGoogle.classList.remove('block');
    }

    if (nome) analisarPrecoHistoricoInicial(nome);

    if (!nome || nome.trim() === '') {
        inputNome.focus();
    } else {
        document.getElementById('prod-preco').focus();
    }
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
                        <div onclick="abrirModalProduto('${nomeP}', 'fa-barcode', 'text-slate-400', -1, '${imgP}')" class="autocomplete-item p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 cursor-pointer">
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

function abrirModalProduto(nomeProduto, icone = 'fa-barcode', cor = 'text-indigo-500', idxEdit = -1, imagemUrl = null, codigoBarras = null) {
    document.getElementById('box-autocomplete').classList.add('hidden');
    document.getElementById('input-busca-produto').value = '';
    document.getElementById('btn-limpar-busca').classList.add('hidden');
    
    setVisibilidadeMenuGlobal(false);

    const form = document.getElementById('form-produto');
    form.reset();
    
    atualizarCamposModalProduto(nomeProduto, icone, cor, imagemUrl, codigoBarras);

    if (idxEdit >= 0) {
        const item = carrinho[idxEdit];
        document.getElementById('prod-id').value = idxEdit;
        document.getElementById('prod-qtd').value = item.quantidade;
        let v = item.preco.toFixed(2).replace('.', ',');
        v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,"); v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
        document.getElementById('prod-preco').value = v;
        calcularTotalItemModal(); 
    } else {
        document.getElementById('prod-id').value = '-1';
        document.getElementById('prod-qtd').value = 1;
    }

    document.getElementById('modal-produto').classList.remove('hidden');
}

function fecharModalProduto() {
    document.getElementById('modal-produto').classList.add('hidden');
    setVisibilidadeMenuGlobal(true);
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

    if (precoReferenciaHistorico > 0 && precoAtual > 0) {
        const box = document.getElementById('box-inteligencia-preco');
        const icone = document.getElementById('icone-inteligencia');
        const texto = document.getElementById('texto-inteligencia');
        
        const diferenca = precoAtual - precoReferenciaHistorico;
        const percentual = Math.abs((diferenca / precoReferenciaHistorico) * 100).toFixed(1);

        if (diferenca > 0.01) {
            box.className = "mb-4 p-2.5 rounded-xl border flex items-center gap-2.5 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 transition-colors";
            icone.className = "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400";
            icone.innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i>';
            texto.innerHTML = `Atenção: <b class="text-rose-600 dark:text-rose-400">${formatarMoedaLocal(Math.abs(diferenca))} mais caro</b> (+${percentual}%) que a última vez.`;
        } else if (diferenca < -0.01) {
            box.className = "mb-4 p-2.5 rounded-xl border flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 transition-colors";
            icone.className = "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
            icone.innerHTML = '<i class="fa-solid fa-arrow-trend-down"></i>';
            texto.innerHTML = `Ótimo! <b class="text-emerald-600 dark:text-emerald-400">${formatarMoedaLocal(Math.abs(diferenca))} mais barato</b> (-${percentual}%) que a última vez.`;
        } else {
            box.className = "mb-4 p-2.5 rounded-xl border flex items-center gap-2.5 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 transition-colors";
            icone.className = "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
            icone.innerHTML = '<i class="fa-solid fa-equals"></i>';
            texto.innerHTML = `O preço se manteve o mesmo da última vez.`;
        }
    }
}

function salvarItemCarrinho(event) {
    event.preventDefault();
    const idx = parseInt(document.getElementById('prod-id').value);
    let nome = document.getElementById('prod-nome').value.trim();
    if (!nome) nome = "Produto Genérico";
    
    const imgUrl = document.getElementById('prod-img-hidden').value;
    const preco = desmascararMoeda(document.getElementById('prod-preco').value);
    const qtd = parseInt(document.getElementById('prod-qtd').value);

    if (preco <= 0) return Swal.fire('Atenção', 'Informe o preço.', 'warning');

    const dic = produtosComuns.find(p => removerAcentos(p.nome) === removerAcentos(nome));
    const obj = {
        nome: nome, preco: preco, quantidade: qtd, imgUrl: imgUrl,
        icone: dic ? dic.icone : 'fa-box', cor: dic ? dic.cor : 'text-slate-500'
    };

    if (idx === -1) carrinho.unshift(obj); else carrinho[idx] = obj;

    salvarCarrinhoLocal(); 

    if (navigator.vibrate) navigator.vibrate([50, 50, 50]); 
    fecharModalProduto(); renderizarCarrinho();
}

function removerItem(idx) {
    carrinho.splice(idx, 1);
    salvarCarrinhoLocal(); 
    if (navigator.vibrate) navigator.vibrate(50);
    renderizarCarrinho();
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
        if (btnFinalizarTopo) {
            btnFinalizarTopo.classList.add('hidden');
            btnFinalizarTopo.classList.remove('flex');
        }
        return;
    }

    if (btnFinalizarTopo) {
        btnFinalizarTopo.classList.remove('hidden');
        btnFinalizarTopo.classList.add('flex');
    }

    const html = carrinho.map((item, index) => {
        const sub = item.preco * item.quantidade;
        total += sub; qtdItens += item.quantidade;
        
        let miniFoto = item.imgUrl 
            ? `<img src="${item.imgUrl}" class="w-full h-full object-cover">` 
            : `<i class="fa-solid ${item.icone}"></i>`;

        return `
        <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer" onclick="abrirModalProduto('${item.nome.replace(/'/g, "\\'")}', '${item.icone}', '${item.cor}', ${index}, '${item.imgUrl}')">
            <div class="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xl shrink-0 overflow-hidden ${item.imgUrl ? '' : item.cor}">
                ${miniFoto}
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-slate-900 dark:text-white text-sm truncate">${item.nome}</h4>
                <p class="text-[10px] font-bold text-slate-400 uppercase mt-0.5">${item.quantidade}x ${formatarMoedaLocal(item.preco)}</p>
            </div>
            <div class="text-right shrink-0 flex items-center gap-3">
                <span class="font-black text-indigo-600 dark:text-indigo-400 text-base block">${formatarMoedaLocal(sub)}</span>
                <button onclick="event.stopPropagation(); removerItem(${index})" class="w-8 h-8 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400 rounded-lg flex items-center justify-center"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
    let parts = Math.abs(total).toFixed(2).split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    totalEl.innerText = "R$ " + parts.join(','); qtdEl.innerText = qtdItens;
}

// ---------------------------------------------------------
// CHECKOUT E FINALIZAÇÃO PARA O BANCO DE DADOS
// ---------------------------------------------------------
function abrirModalCheckout() {
    if (carrinho.length === 0) return;
    setVisibilidadeMenuGlobal(false);
    
    let total = 0; carrinho.forEach(i => total += (i.preco * i.quantidade));
    document.getElementById('checkout-total').innerText = formatarMoedaLocal(total);
    const hoje = new Date(); const v = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10);
    document.getElementById('checkout-data').value = v.toISOString().split('T')[0];
    toggleParcelasCheckout(); document.getElementById('modal-checkout').classList.remove('hidden');
}

function fecharModalCheckout() { 
    document.getElementById('modal-checkout').classList.add('hidden'); 
    setVisibilidadeMenuGlobal(true);
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
        const client = window.supabaseClient || supabaseClient;
        if (!client) throw new Error("Cliente Supabase não inicializado. Recarregue a página.");

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

        const idTransPrincipal = retTrans[0].id;
        const itensParaInserir = carrinho.map(item => ({ usuario_id: usuarioLogado.id, nome: item.nome, preco_unitario: item.preco, quantidade: item.quantidade, transacao_id: idTransPrincipal }));
        await client.from('mercado_itens').insert(itensParaInserir);

        fecharModalCheckout(); 
        carrinho = []; 
        limparCarrinhoLocal(); 
        renderizarCarrinho(); 
        carregarHistoricoPrecos();
        dispararOverlaySucesso("Compra Registrada no Caixa!");
    } catch (e) { Swal.fire('Erro ao Finalizar', e.message, 'error'); } finally { btn.innerHTML = htmlOriginal; btn.disabled = false; }
}

function dispararOverlaySucesso(subtexto) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh; z-index: 999999; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(8px); transition: opacity 0.3s ease; opacity: 0;';
    
    overlay.innerHTML = `
        <div class="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(16,185,129,0.5)] transform scale-0 animate-[popIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
            <i class="fa-solid fa-check text-6xl text-white"></i>
        </div>
        <p class="text-white font-black text-2xl text-center px-4 animate-[fadeInUp_0.5s_ease_0.2s_forwards] opacity-0">${subtexto}</p>
        <style>
            @keyframes popIn { to { transform: scale(1); } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        </style>
    `;
    
    document.documentElement.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');
    
    setTimeout(() => { if (document.body.contains(overlay)) { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 300); } }, 2500);
}

// ---------------------------------------------------------
// HISTÓRICO DE RECIBOS (COMPRAS ANTERIORES)
// ---------------------------------------------------------
async function carregarHistoricoPrecos() {
    try {
        const client = window.supabaseClient || supabaseClient;
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
    setVisibilidadeMenuGlobal(false);
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
    setVisibilidadeMenuGlobal(true);
}
