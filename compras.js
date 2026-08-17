// ==========================================
// compras.js - MOTOR DE MERCADO INTELIGENTE E CHECKOUT
// ==========================================

let usuarioLogado = null;
let carrinho = [];
let historicoPrecos = []; // Trazido do Supabase para comparação

// Dicionário offline inteligente para preenchimento ultra-rápido sem depender de API paga
const produtosComuns = [
    { nome: "Arroz Branco 5kg", icone: "fa-bowl-rice", cor: "text-amber-500" },
    { nome: "Feijão Carioca 1kg", icone: "fa-seedling", cor: "text-amber-700" },
    { nome: "Óleo de Soja 900ml", icone: "fa-bottle-droplet", cor: "text-yellow-500" },
    { nome: "Açúcar Refinado 1kg", icone: "fa-cubes-stacked", cor: "text-slate-300" },
    { nome: "Café Torrado 500g", icone: "fa-mug-hot", cor: "text-stone-800" },
    { nome: "Leite Integral 1L", icone: "fa-cow", cor: "text-slate-400" },
    { nome: "Macarrão Espaguete 500g", icone: "fa-plate-wheat", cor: "text-amber-400" },
    { nome: "Molho de Tomate", icone: "fa-jar", cor: "text-rose-600" },
    { nome: "Farinha de Trigo 1kg", icone: "fa-wheat-awn", cor: "text-amber-200" },
    { nome: "Margarina", icone: "fa-cheese", cor: "text-yellow-400" },
    { nome: "Carne / Mistura", icone: "fa-drumstick-bite", cor: "text-rose-500" },
    { nome: "Frango (Peito/Coxa)", icone: "fa-drumstick-bite", cor: "text-orange-400" },
    { nome: "Papel Higiênico", icone: "fa-toilet-paper", cor: "text-slate-300" },
    { nome: "Sabão em Pó", icone: "fa-box", cor: "text-blue-500" },
    { nome: "Detergente", icone: "fa-bottle-water", cor: "text-lime-500" },
    { nome: "Amaciante", icone: "fa-bottle-droplet", cor: "text-pink-400" },
    { nome: "Sabonete", icone: "fa-soap", cor: "text-rose-300" },
    { nome: "Creme Dental", icone: "fa-pump-soap", cor: "text-teal-400" },
    { nome: "Pão de Forma", icone: "fa-bread-slice", cor: "text-amber-500" },
    { nome: "Mussarela", icone: "fa-cheese", cor: "text-yellow-400" },
    { nome: "Presunto", icone: "fa-bacon", cor: "text-rose-400" },
    { nome: "Ovos (Cartela)", icone: "fa-egg", cor: "text-orange-200" },
    { nome: "Refrigerante 2L", icone: "fa-bottle-water", cor: "text-slate-800" },
    { nome: "Cerveja", icone: "fa-beer-mug-empty", cor: "text-amber-400" },
    { nome: "Frutas e Verduras", icone: "fa-apple-whole", cor: "text-rose-500" },
    { nome: "Bolacha / Biscoito", icone: "fa-cookie", cor: "text-amber-600" }
];

document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(() => document.body.classList.remove('fade-in'), 300);

    // Fade link setup
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

    await carregarHistoricoPrecos();
    renderizarCarrinho();
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

function desmascararMoeda(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

async function carregarHistoricoPrecos() {
    try {
        const client = window.supabaseClient;
        const { data, error } = await client.from('mercado_itens').select('nome, preco_unitario, criado_em').eq('usuario_id', usuarioLogado.id).order('criado_em', { ascending: false });
        if (!error && data) {
            historicoPrecos = data;
        }
    } catch (e) { console.error("Erro ao puxar histórico:", e); }
}

function removerAcentos(texto) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ---------------------------------------------------------
// BUSCA E AUTOCOMPLETE RÁPIDO
// ---------------------------------------------------------
function buscarProdutosAutocompletar() {
    const termo = removerAcentos(document.getElementById('input-busca-produto').value);
    const box = document.getElementById('box-autocomplete');
    const btnLimpar = document.getElementById('btn-limpar-busca');

    if (termo.length === 0) {
        box.classList.add('hidden');
        btnLimpar.classList.add('hidden');
        return;
    }

    btnLimpar.classList.remove('hidden');

    let resultados = produtosComuns.filter(p => removerAcentos(p.nome).includes(termo));

    // Adiciona o que ela digitou como primeira opção caso não esteja na lista
    if (!resultados.some(r => removerAcentos(r.nome) === termo)) {
        resultados.unshift({ nome: document.getElementById('input-busca-produto').value, icone: 'fa-barcode', cor: 'text-indigo-500' });
    }

    box.innerHTML = resultados.slice(0, 6).map(p => `
        <div onclick="abrirModalProduto('${p.nome}', '${p.icone}', '${p.cor}')" class="autocomplete-item p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 cursor-pointer">
            <div class="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-lg ${p.cor}"><i class="fa-solid ${p.icone}"></i></div>
            <span class="font-bold text-slate-900 dark:text-white">${p.nome}</span>
        </div>
    `).join('');
    
    box.classList.remove('hidden');
}

function limparBusca() {
    const input = document.getElementById('input-busca-produto');
    input.value = '';
    buscarProdutosAutocompletar();
    input.focus();
}

// ---------------------------------------------------------
// MODAL DE PRODUTO & INTELIGÊNCIA DE PREÇO
// ---------------------------------------------------------
function abrirModalProduto(nomeProduto, icone = 'fa-barcode', cor = 'text-indigo-500', idxEdit = -1) {
    document.getElementById('box-autocomplete').classList.add('hidden');
    document.getElementById('input-busca-produto').value = '';
    document.getElementById('btn-limpar-busca').classList.add('hidden');

    const form = document.getElementById('form-produto');
    form.reset();
    
    document.getElementById('modal-produto-titulo').innerText = nomeProduto;
    document.getElementById('prod-nome').value = nomeProduto;
    
    if (idxEdit >= 0) {
        // Editando item existente
        const item = carrinho[idxEdit];
        document.getElementById('prod-id').value = idxEdit;
        document.getElementById('prod-qtd').value = item.quantidade;
        let v = item.preco.toFixed(2).replace('.', ',');
        v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,"); v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
        document.getElementById('prod-preco').value = v;
    } else {
        // Item novo
        document.getElementById('prod-id').value = '-1';
        document.getElementById('prod-qtd').value = 1;
    }

    calcularTotalItemModal();
    analisarPrecoHistorico(nomeProduto);

    document.getElementById('modal-produto').classList.remove('hidden');
    
    // Tenta focar no campo de preço para ser rápido
    setTimeout(() => { document.getElementById('prod-preco').focus(); }, 100);
}

function fecharModalProduto() {
    document.getElementById('modal-produto').classList.add('hidden');
}

function ajustarQtd(delta) {
    if (navigator.vibrate) navigator.vibrate(50);
    const input = document.getElementById('prod-qtd');
    let atual = parseInt(input.value) || 1;
    atual += delta;
    if (atual < 1) atual = 1;
    input.value = atual;
    calcularTotalItemModal();
}

function calcularTotalItemModal() {
    const preco = desmascararMoeda(document.getElementById('prod-preco').value) || 0;
    const qtd = parseInt(document.getElementById('prod-qtd').value) || 1;
    document.getElementById('prod-subtotal').innerText = formatarMoedaLocal(preco * qtd);
}

function analisarPrecoHistorico(nomeProduto) {
    const box = document.getElementById('box-inteligencia-preco');
    const icone = document.getElementById('icone-inteligencia');
    const texto = document.getElementById('texto-inteligencia');

    const historicoItem = historicoPrecos.filter(h => removerAcentos(h.nome) === removerAcentos(nomeProduto));
    
    if (historicoItem.length > 0) {
        // Pega o último preço pago
        const ultimoPreco = parseFloat(historicoItem[0].preco_unitario);
        
        box.classList.remove('hidden');
        box.className = "mb-6 p-3 rounded-xl border flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700";
        icone.className = "w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
        icone.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>';
        texto.innerHTML = `Última compra por <span class="text-blue-600 dark:text-blue-400">${formatarMoedaLocal(ultimoPreco)}</span>`;
        texto.className = "text-xs font-black text-slate-700 dark:text-slate-300";
    } else {
        box.classList.add('hidden');
    }
}

// ---------------------------------------------------------
// GESTÃO DO CARRINHO
// ---------------------------------------------------------
function salvarItemCarrinho(event) {
    event.preventDefault();
    const idx = parseInt(document.getElementById('prod-id').value);
    const nome = document.getElementById('prod-nome').value;
    const preco = desmascararMoeda(document.getElementById('prod-preco').value);
    const qtd = parseInt(document.getElementById('prod-qtd').value);

    if (preco <= 0) return Swal.fire('Atenção', 'Informe o preço do produto.', 'warning');

    // Identifica o icone baseado no dicionario ou poe codigo de barras
    const dic = produtosComuns.find(p => removerAcentos(p.nome) === removerAcentos(nome));
    const obj = {
        nome: nome,
        preco: preco,
        quantidade: qtd,
        icone: dic ? dic.icone : 'fa-barcode',
        cor: dic ? dic.cor : 'text-slate-500'
    };

    if (idx === -1) {
        carrinho.unshift(obj); // Coloca no topo
    } else {
        carrinho[idx] = obj;
    }

    if (navigator.vibrate) navigator.vibrate([50, 50, 50]); // Vibração de sucesso
    
    fecharModalProduto();
    renderizarCarrinho();
}

function removerItem(idx) {
    carrinho.splice(idx, 1);
    if (navigator.vibrate) navigator.vibrate(50);
    renderizarCarrinho();
}

function renderizarCarrinho() {
    const container = document.getElementById('lista-carrinho');
    const totalEl = document.getElementById('total-carrinho');
    const qtdEl = document.getElementById('qtd-itens-carrinho');
    const boxFinalizar = document.getElementById('box-finalizar-mobile');
    const btnFinalizarTopo = document.getElementById('btn-finalizar-topo');

    let total = 0;
    let qtdItens = 0;

    if (carrinho.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 opacity-60">
                <dotlottie-wc src="https://lottie.host/7e008fa9-2de6-455b-baf5-0e1ce8b8fcfa/R8B5B1bN9C.json" style="width: 150px; height: 150px;" autoplay loop></dotlottie-wc>
                <p class="text-sm font-bold text-slate-500 dark:text-slate-400 mt-2 text-center max-w-[250px]">O carrinho está vazio.<br>Busque um produto acima para começar.</p>
            </div>`;
        totalEl.innerText = "R$ 0,00";
        qtdEl.innerText = "0";
        boxFinalizar.classList.add('hidden');
        btnFinalizarTopo.classList.add('hidden');
        return;
    }

    boxFinalizar.classList.remove('hidden');
    btnFinalizarTopo.classList.remove('hidden');
    btnFinalizarTopo.classList.add('md:flex');

    const html = carrinho.map((item, index) => {
        const sub = item.preco * item.quantidade;
        total += sub;
        qtdItens += item.quantidade;

        return `
        <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform" onclick="abrirModalProduto('${item.nome.replace(/'/g, "\\'")}', '${item.icone}', '${item.cor}', ${index})">
            <div class="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xl shrink-0 ${item.cor}">
                <i class="fa-solid ${item.icone}"></i>
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-slate-900 dark:text-white text-sm truncate">${item.nome}</h4>
                <p class="text-[10px] font-bold text-slate-400 uppercase mt-0.5">${item.quantidade}x ${formatarMoedaLocal(item.preco)}</p>
            </div>
            <div class="text-right shrink-0 flex items-center gap-3">
                <span class="font-black text-indigo-600 dark:text-indigo-400 text-base block">${formatarMoedaLocal(sub)}</span>
                <button onclick="event.stopPropagation(); removerItem(${index})" class="w-8 h-8 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400 rounded-lg flex items-center justify-center"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>
        `;
    }).join('');

    container.innerHTML = html;
    
    // Anima o valor total atualizando lá em cima
    let parts = Math.abs(total).toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    totalEl.innerText = "R$ " + parts.join(',');
    
    qtdEl.innerText = qtdItens;
}

// ---------------------------------------------------------
// CHECKOUT E FINALIZAÇÃO PARA O BANCO DE DADOS
// ---------------------------------------------------------
function abrirModalCheckout() {
    if (carrinho.length === 0) return;

    let total = 0;
    carrinho.forEach(i => total += (i.preco * i.quantidade));

    document.getElementById('checkout-total').innerText = formatarMoedaLocal(total);
    
    // Calcula vencimento padrão (Mês que vem, dia 10)
    const hoje = new Date();
    const v = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10);
    document.getElementById('checkout-data').value = v.toISOString().split('T')[0];

    toggleParcelasCheckout();
    document.getElementById('modal-checkout').classList.remove('hidden');
}

function fecharModalCheckout() {
    document.getElementById('modal-checkout').classList.add('hidden');
}

function toggleParcelasCheckout() {
    const tipo = document.querySelector('input[name="pagamento"]:checked').value;
    const box = document.getElementById('box-parcelas');
    if (tipo === 'credito') {
        box.classList.remove('hidden');
        box.classList.add('grid');
    } else {
        box.classList.add('hidden');
        box.classList.remove('grid');
    }
}

async function efetivarCompra(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-processar-compra');
    const htmlOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando Caixa...';
    btn.disabled = true;

    try {
        let total = 0;
        carrinho.forEach(i => total += (i.preco * i.quantidade));

        const descLocal = document.getElementById('checkout-desc').value || "Compra no Mercado";
        const tipoPagamento = document.querySelector('input[name="pagamento"]:checked').value;
        
        // Pega a categoria Alimentação ou Mercado (Se não achar, usa a primeira que tiver)
        const { data: catData } = await window.supabaseClient.from('categorias').select('id, nome').eq('usuario_id', usuarioLogado.id);
        let idCategoria = null;
        if (catData && catData.length > 0) {
            const alimentacao = catData.find(c => c.nome.toLowerCase().includes('alimentação') || c.nome.toLowerCase().includes('mercado'));
            idCategoria = alimentacao ? alimentacao.id : catData[0].id;
        }

        const transacoesParaInserir = [];
        
        if (tipoPagamento === 'avista') {
            // Se for pix/débito, é uma transação paga na hora (afeta saldo hoje)
            transacoesParaInserir.push({
                usuario_id: usuarioLogado.id,
                tipo: 'despesa',
                descricao: descLocal,
                valor: total,
                data_vencimento: new Date().toISOString().split('T')[0],
                categoria_id: idCategoria,
                pago: true
            });
        } else {
            // Se for Crédito, gera parcelas (vai pra tela de Dívidas como Pendente)
            const numParcelas = parseInt(document.getElementById('checkout-parcelas').value) || 1;
            const dataPrimeiroVenc = document.getElementById('checkout-data').value;
            const valorParcela = total / numParcelas;

            for (let i = 0; i < numParcelas; i++) {
                let dCalc = new Date(dataPrimeiroVenc + 'T12:00:00Z');
                dCalc.setMonth(dCalc.getMonth() + i);
                
                let dFinal = numParcelas > 1 ? `${descLocal} (${i + 1}/${numParcelas})` : descLocal;

                transacoesParaInserir.push({
                    usuario_id: usuarioLogado.id,
                    tipo: 'despesa',
                    descricao: dFinal,
                    valor: valorParcela,
                    data_vencimento: dCalc.toISOString().split('T')[0],
                    categoria_id: idCategoria,
                    pago: false // Importante: Crédito nasce não pago
                });
            }
        }

        // Insere a Transação Principal
        const { data: retTrans, error: errT } = await window.supabaseClient.from('transacoes').insert(transacoesParaInserir).select();
        if (errT) throw errT;

        // Se conseguiu gerar a transação, guarda os Itens do Mercado vinculados à primeira transação gerada
        const idTransPrincipal = retTrans[0].id;
        const itensParaInserir = carrinho.map(item => ({
            usuario_id: usuarioLogado.id,
            nome: item.nome,
            preco_unitario: item.preco,
            quantidade: item.quantidade,
            transacao_id: idTransPrincipal
        }));

        const { error: errI } = await window.supabaseClient.from('mercado_itens').insert(itensParaInserir);
        if (errI) console.error("Erro ao guardar histórico dos itens, mas transação gerada.", errI);

        fecharModalCheckout();
        carrinho = []; // Limpa o carrinho
        renderizarCarrinho();

        // Animação Lottie de Sucesso (mesmo padrão das outras telas)
        dispararOverlayLottie("Compra Registrada no Caixa!");

    } catch (e) {
        Swal.fire('Erro ao Finalizar', e.message, 'error');
    } finally {
        btn.innerHTML = htmlOriginal;
        btn.disabled = false;
    }
}

// ---------------------------------------------------------
// ANIMAÇÃO LOTTIE (TELA CHEIA)
// ---------------------------------------------------------
function dispararOverlayLottie(subtexto) {
    const urlAnimacao = "https://lottie.host/78d29cd2-20ba-42fa-89bb-5471e7c8353c/EglrVN8uNB.lottie"; // Sucesso Despesa

    if (!customElements.get('dotlottie-wc')) {
        const scriptLottie = document.createElement('script');
        scriptLottie.src = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.3.0/dist/dotlottie-wc.js";
        scriptLottie.type = "module";
        document.head.appendChild(scriptLottie);
    }

    const overlayLottie = document.createElement('div');
    overlayLottie.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh; z-index: 999999; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(8px); transition: opacity 0.3s ease; opacity: 0; cursor: pointer;';
    
    overlayLottie.innerHTML = `
        <div style="width: 250px; height: 250px; display: flex; align-items: center; justify-content: center;">
            <dotlottie-wc src="${urlAnimacao}" autoplay style="width: 100%; height: 100%;"></dotlottie-wc>
        </div>
        <p style="color: #ffffff; font-family: 'Inter', sans-serif; font-weight: 900; font-size: 1.35rem; margin-top: 1rem; text-align: center; padding: 0 1.5rem; text-shadow: 0 2px 10px rgba(0,0,0,0.6);">${subtexto}</p>
    `;
    
    document.documentElement.appendChild(overlayLottie);
    
    requestAnimationFrame(() => overlayLottie.style.opacity = '1');
    
    setTimeout(() => { 
        if (document.body.contains(overlayLottie)) {
            overlayLottie.style.opacity = '0'; 
            setTimeout(() => overlayLottie.remove(), 300); 
        }
    }, 2600);
}
