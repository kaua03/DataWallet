// ==========================================
// layout.js - MOTOR GLOBAL E CONTROLE DE TELA (CLEAN URLS E ALINHAMENTO MILIMÉTRICO)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const temaSalvo = localStorage.getItem('DataWallet_Tema') || localStorage.getItem('theme');
    const prefereDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = temaSalvo === 'escuro' || temaSalvo === 'dark' || (!temaSalvo && prefereDark);

    if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.backgroundColor = '#020617';
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.backgroundColor = '#f8fafc';
    }

    injetarEstilosGlobais();

    const urlParams = new URLSearchParams(window.location.search);
    const isGuest = urlParams.has('s');

    if (!isGuest) {
        inicializarLayout(isDark);
    }
});

function injetarEstilosGlobais() {
    if (document.getElementById('global-star-style')) return;
    const style = document.createElement('style');
    style.id = 'global-star-style';
    style.innerHTML = `
        html { background-color: #f8fafc; }
        html.dark { background-color: #020617; }
        @keyframes starRise {
            0% { transform: translate(0, 0) scale(0.5) rotate(0deg); opacity: 0; }
            30% { opacity: 1; }
            60% { transform: translate(6px, -8px) scale(1.2) rotate(45deg); opacity: 1; }
            100% { transform: translate(10px, -15px) scale(0) rotate(90deg); opacity: 0; }
        }
        .animate-star { animation: starRise 1s ease-out forwards; }
        #sidebar { width: 5rem; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, background-color 0.3s; z-index: 50; }
        #sidebar:hover { width: 16rem; box-shadow: 15px 0 30px rgba(0,0,0,0.05); }
        .dark #sidebar:hover { box-shadow: 15px 0 30px rgba(0,0,0,0.4); }
        .sidebar-link { width: 3rem; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s; overflow: hidden; }
        #sidebar:hover .sidebar-link { width: 100%; }
        .sidebar-text { opacity: 0; transform: translateX(-10px); visibility: hidden; transition: all 0.2s ease-in-out; white-space: nowrap; }
        #sidebar:hover .sidebar-text { visibility: visible; opacity: 1; transform: translateX(0); transition-delay: 0.15s; }

        .sub-menu-item { max-height: 0; opacity: 0; visibility: hidden; margin-top: 0; transform: translateX(-15px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; overflow: hidden; }
        #sidebar:hover .sub-menu-item { max-height: 3rem; opacity: 1; visibility: visible; margin-top: 0.25rem; transform: translateX(0); pointer-events: auto; }

        @media (min-width: 768px) {
            #fab-container, #fab-overlay { display: none !important; }
            #sidebar { display: flex !important; }
        }
        @media (max-width: 767px) {
            #sidebar { display: none !important; }
        }
    `;
    document.head.appendChild(style);
}

window.fecharMenuEAbrirModal = function(funcaoAlvo) {
    if (window._menuMobileAberto) {
        window.toggleMobileMenu();
    }
    setTimeout(() => {
        if (typeof window[funcaoAlvo] === 'function') {
            window[funcaoAlvo]();
        } else {
            console.error('Função não encontrada:', funcaoAlvo);
        }
    }, 150);
}

function inicializarLayout(isDark) {
    document.querySelectorAll('#sidebar, #fab-container, #fab-overlay').forEach(el => el.remove());

    // 🟢 INTELIGÊNCIA DE URLS LIMPAS (Vercel)
    let caminho = window.location.pathname.split('/').pop();
    if (!caminho || caminho === '') caminho = 'movimentacoes';
    
    // Arranca o .html da leitura para manter a lógica uniforme
    const paginaAtual = caminho.replace('.html', '');

    const isDashboard = paginaAtual === 'dashboard';
    const isPassivos = paginaAtual === 'dividas';
    const isMetas = paginaAtual === 'metas' || paginaAtual === 'planos';
    const isCompras = paginaAtual === 'compras';

    // 🟢 Menu também gerado com links limpos (sem .html)
    const menuItems = [
        { nome: 'Movimentações', link: 'movimentacoes', icone: 'fa-money-bill-transfer', corBg: 'indigo-50', corTxt: 'indigo-700' },
        { nome: 'Dashboard', link: 'dashboard', icone: 'fa-chart-pie', corBg: 'indigo-50', corTxt: 'indigo-700' },
        { nome: 'Dívidas', link: 'dividas', icone: 'fa-file-invoice-dollar', corBg: 'indigo-50', corTxt: 'indigo-700' },
        { nome: 'Categorias', link: 'categorias', icone: 'fa-tags', corBg: 'indigo-50', corTxt: 'indigo-700' },
        { nome: 'Metas', link: 'metas', icone: 'fa-bullseye', corBg: 'indigo-50', corTxt: 'indigo-700' },
        { nome: 'Mercado', link: 'compras', icone: 'fa-cart-shopping', corBg: 'indigo-50', corTxt: 'indigo-700' }
    ];

    let navLinksHtml = menuItems.map(item => {
        const ativo = paginaAtual === item.link;
        const classesAtivo = ativo ? `bg-${item.corBg} text-${item.corTxt} dark:bg-indigo-500/20 dark:text-indigo-400` : `text-slate-500 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400`;
        
        let html = `
            <a href="${item.link}" class="sidebar-link flex items-center h-12 px-3 rounded-xl font-bold transition-colors overflow-hidden ${classesAtivo}">
                <div class="w-6 flex items-center justify-center shrink-0"><i class="fa-solid ${item.icone} text-lg"></i></div>
                <span class="sidebar-text ml-3">${item.nome}</span>
            </a>
        `;

        if (item.link === 'compras' && isCompras) {
            html += `
                <div class="sub-menu-item pl-9 pr-1 w-full">
                    <button onclick="window.abrirModalShare()" class="w-full flex items-center h-9 px-3 rounded-lg font-bold bg-indigo-500 hover:bg-indigo-400 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-transform active:scale-95 border border-indigo-400 dark:border-indigo-500">
                        <i class="fa-solid fa-qrcode text-sm"></i>
                        <span class="ml-2 text-xs whitespace-nowrap">Compartilhar</span>
                    </button>
                </div>
            `;
            return `<div class="flex flex-col">${html}</div>`;
        }

        return html;
    }).join('');

    const textoTemaDesktop = isDark ? 'Tema Claro' : 'Tema Escuro';
    const iconeTemaDesktop = isDark ? 'fa-solid fa-sun text-lg text-amber-400' : 'fa-solid fa-moon text-lg text-white';
    const classeBotaoDesktop = isDark ? 'sidebar-link flex items-center h-12 px-3 rounded-xl font-bold bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors w-full' : 'sidebar-link flex items-center h-12 px-3 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors w-full';

    const sidebarHtml = `
        <div class="hidden md:block w-20 shrink-0"></div>
        <aside id="sidebar" class="hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800 py-6 px-4 h-full z-40 fixed left-0 top-0 overflow-hidden shadow-sm transition-colors duration-300">
            
            <div class="flex items-center justify-start mb-8 h-12 px-1 cursor-default">
                <div class="w-10 h-10 shrink-0 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                    <i class="fa-solid fa-wallet text-xl"></i>
                </div>
                <div class="sidebar-text ml-3 flex flex-col justify-center overflow-hidden w-full">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider" id="desk-saudacao">...</span>
                    <h2 class="text-base font-black text-slate-900 dark:text-white truncate w-full" id="desk-nome">Carregando</h2>
                </div>
            </div>
            
            <nav class="flex-1 space-y-2 w-full">${navLinksHtml}</nav>

            <div class="mt-auto w-full space-y-2">
                <button id="btn-dark-desktop" onclick="window.toggleDarkMode()" class="${classeBotaoDesktop}">
                    <div class="relative w-6 flex items-center justify-center shrink-0 overflow-visible">
                        <i id="icone-dark-mode" class="${iconeTemaDesktop} transition-colors duration-300"></i>
                        <i id="star-desktop" class="fa-solid fa-star absolute text-[10px] text-white opacity-0 pointer-events-none z-50"></i>
                    </div>
                    <span id="txt-dark-desktop" class="sidebar-text ml-3">${textoTemaDesktop}</span>
                </button>
                <button onclick="sairDoSistema()" class="sidebar-link flex items-center h-12 px-3 rounded-xl font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors overflow-hidden w-full">
                    <div class="w-6 flex items-center justify-center shrink-0"><i class="fa-solid fa-right-from-bracket text-lg"></i></div>
                    <span class="sidebar-text ml-3">Sair</span>
                </button>
            </div>
        </aside>
    `;

    let mobileLinksHtml = menuItems.slice().reverse().map(item => {
        const ativo = paginaAtual === item.link;
        const classesAtivo = ativo ? `bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30` : `bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700`;
        return `
            <a href="${item.link}" class="w-10 h-10 rounded-full shadow-lg flex items-center justify-center border transition-transform hover:scale-110 pointer-events-none mobile-menu-btn ${classesAtivo}">
                <i class="fa-solid ${item.icone} pointer-events-none text-sm"></i>
            </a>
        `;
    }).join('');

    let btnAcaoMobileHtml = '';
    if (isDashboard) {
        btnAcaoMobileHtml = `<button onclick="fecharMenuEAbrirModal('toggleCoach')" id="fab-action" class="absolute bottom-0 right-0 w-14 h-14 rounded-full bg-slate-900 dark:bg-black text-indigo-400 shadow-lg flex items-center justify-center text-xl transition-all duration-300 opacity-0 pointer-events-none z-[9999] border border-slate-700 dark:border-indigo-500/50"><i class="fa-solid fa-robot pointer-events-none"></i></button>`;
    } else if (isPassivos) {
        btnAcaoMobileHtml = `<button onclick="fecharMenuEAbrirModal('abrirModalNovaDivida')" id="fab-action" class="absolute bottom-0 right-0 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-[0_10px_25px_rgba(79,70,229,0.5)] flex items-center justify-center text-xl transition-all duration-300 opacity-0 pointer-events-none z-[9999] border border-indigo-400 dark:border-indigo-500/50"><i class="fa-solid fa-plus pointer-events-none"></i></button>`;
    } else if (isMetas) {
        btnAcaoMobileHtml = `<button onclick="fecharMenuEAbrirModal('abrirModalNovaMeta')" id="fab-action" class="absolute bottom-0 right-0 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-[0_10px_25px_rgba(79,70,229,0.5)] flex items-center justify-center text-xl transition-all duration-300 opacity-0 pointer-events-none z-[9999] border border-indigo-400 dark:border-indigo-500/50"><i class="fa-solid fa-plus pointer-events-none"></i></button>`;
    } else if (isCompras) {
        btnAcaoMobileHtml = `<button onclick="fecharMenuEAbrirModal('abrirModalShare')" id="fab-action" class="absolute bottom-1.5 right-1.5 w-11 h-11 rounded-full bg-indigo-500 hover:bg-indigo-400 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-[0_8px_20px_rgba(99,102,241,0.5)] flex items-center justify-center text-lg transition-all duration-300 opacity-0 pointer-events-none z-[9999] border border-indigo-400 dark:border-indigo-500"><i class="fa-solid fa-qrcode pointer-events-none"></i></button>`;
    }

    const iconeTemaMobile = isDark ? 'fa-solid fa-sun text-xl text-amber-400' : 'fa-solid fa-moon text-xl text-white';

    const mobileMenuHtml = `
        <div id="fab-overlay" onclick="toggleMobileMenu()" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9998] opacity-0 pointer-events-none transition-opacity duration-300"></div>
        
        <div id="fab-container" class="fixed bottom-6 right-6 z-[9999] flex items-end justify-end pointer-events-none">
            ${btnAcaoMobileHtml}
            
            <div id="fab-items" class="absolute bottom-16 right-0 flex flex-col items-end gap-2.5 transition-all duration-300 transform translate-y-10 opacity-0 pointer-events-none z-[9999]">
                
                <!-- PÍLULA DE SAUDAÇÃO (Mantém encostada à direita) -->
                <div class="mobile-menu-btn pointer-events-none opacity-0 transition-opacity bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl px-4 py-2 mb-2 flex items-center gap-1.5 whitespace-nowrap">
                    <span class="text-xs font-bold text-slate-500 dark:text-slate-400">
                        <span id="mob-saudacao">...</span>, <span id="mob-nome" class="text-indigo-600 dark:text-indigo-400 font-black">Carregando</span>
                    </span>
                </div>

                <!-- 🟢 COLUNA CENTRALIZADA DOS ÍCONES (mr-2 corrige a matemática de alinhamento) -->
                <div class="flex flex-col items-center gap-2.5 mr-2">
                    <button onclick="sairDoSistema()" class="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-rose-500 border border-rose-100 dark:border-rose-900/50 shadow-lg flex items-center justify-center transition-transform hover:scale-110 pointer-events-none mobile-menu-btn">
                        <i class="fa-solid fa-right-from-bracket pointer-events-none text-sm"></i>
                    </button>
                    
                    <button id="btn-dark-mobile" onclick="window.toggleDarkMode(); window.toggleMobileMenu();" class="w-10 h-10 rounded-full bg-slate-800 shadow-lg flex items-center justify-center transition-transform hover:scale-110 border border-slate-700 relative overflow-visible pointer-events-none mobile-menu-btn">
                        <i id="icone-dark-mode-mobile" class="${iconeTemaMobile} pointer-events-none"></i>
                        <i id="star-mobile" class="fa-solid fa-star absolute text-[12px] text-white opacity-0 pointer-events-none z-50"></i>
                    </button>
                    
                    <div class="w-8 h-px bg-slate-200 dark:bg-slate-700 my-1 mobile-menu-btn pointer-events-none opacity-0 transition-opacity"></div>
                    
                    ${mobileLinksHtml}
                </div>
            </div>
            
            <button onclick="toggleMobileMenu()" id="fab-menu" class="relative w-14 h-14 rounded-full bg-indigo-600 text-white shadow-[0_4px_20px_rgba(79,70,229,0.5)] flex items-center justify-center text-xl transition-all duration-300 z-[9999] pointer-events-auto hover:scale-105">
                <i class="fa-solid fa-bars transition-all duration-300 pointer-events-none" id="fab-icon"></i>
            </button>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', sidebarHtml);
    document.body.insertAdjacentHTML('beforeend', mobileMenuHtml);

    injetarSaudacaoPersonalizada();
}

async function injetarSaudacaoPersonalizada() {
    const hora = new Date().getHours();
    let saudacao = 'Boa noite';
    if (hora >= 5 && hora < 12) saudacao = 'Bom dia';
    else if (hora >= 12 && hora < 18) saudacao = 'Boa tarde';

    const elDeskSaudacao = document.getElementById('desk-saudacao');
    const elMobSaudacao = document.getElementById('mob-saudacao');
    
    if (elDeskSaudacao) elDeskSaudacao.innerText = saudacao + ',';
    if (elMobSaudacao) elMobSaudacao.innerText = saudacao;

    let nomeFinal = 'Investidor';
    try {
        const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        
        if (client) {
            const { data: { session } } = await client.auth.getSession();
            if (session && session.user) {
                const email = session.user.email;
                const { data } = await client.from('usuarios_dicionario').select('username').eq('email', email).maybeSingle();
                
                if (data && data.username) {
                    nomeFinal = data.username.charAt(0).toUpperCase() + data.username.slice(1).toLowerCase();
                } else {
                    nomeFinal = email.split('@')[0];
                    nomeFinal = nomeFinal.charAt(0).toUpperCase() + nomeFinal.slice(1).toLowerCase();
                }
            }
        }
    } catch(e) {
        console.error("Falha ao carregar nome do banco:", e);
    }

    const elDeskNome = document.getElementById('desk-nome');
    const elMobNome = document.getElementById('mob-nome');

    if (elDeskNome) elDeskNome.innerText = nomeFinal;
    if (elMobNome) elMobNome.innerText = nomeFinal;
}

window._menuMobileAberto = false;
window.toggleMobileMenu = function() {
    const overlay = document.getElementById('fab-overlay');
    const items = document.getElementById('fab-items');
    const actionBtn = document.getElementById('fab-action');
    const icon = document.getElementById('fab-icon');
    const btn = document.getElementById('fab-menu');
    const btnsSecundarios = document.querySelectorAll('.mobile-menu-btn');
    
    window._menuMobileAberto = !window._menuMobileAberto;

    if (window._menuMobileAberto) {
        if (overlay) {
            overlay.classList.remove('opacity-0', 'pointer-events-none');
            overlay.classList.add('opacity-100', 'pointer-events-auto');
        }

        if (items) {
            items.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');
            items.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
            btnsSecundarios.forEach(b => b.classList.replace('pointer-events-none', 'pointer-events-auto'));
            btnsSecundarios.forEach(b => b.classList.remove('opacity-0')); 
        }
        if (actionBtn) {
            actionBtn.classList.remove('opacity-0', 'pointer-events-none');
            actionBtn.classList.add('opacity-100', 'pointer-events-auto');
            actionBtn.style.transform = 'translateX(-70px) rotate(-360deg)';
        }
        if (btn) {
            btn.style.transform = 'rotate(180deg)';
            btn.classList.replace('bg-indigo-600', 'bg-slate-800');
            btn.classList.replace('shadow-[0_4px_20px_rgba(79,70,229,0.5)]', 'shadow-[0_4px_20px_rgba(30,41,59,0.5)]');
        }
        setTimeout(() => { if(icon) icon.classList.replace('fa-bars', 'fa-xmark'); }, 150);
    } else {
        if (overlay) {
            overlay.classList.add('opacity-0', 'pointer-events-none');
            overlay.classList.remove('opacity-100', 'pointer-events-auto');
        }

        if (items) {
            items.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
            items.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
            btnsSecundarios.forEach(b => b.classList.replace('pointer-events-auto', 'pointer-events-none'));
            btnsSecundarios.forEach(b => { if(b.tagName === 'DIV') b.classList.add('opacity-0') });
        }
        if (actionBtn) {
            actionBtn.classList.add('opacity-0', 'pointer-events-none');
            actionBtn.classList.remove('opacity-100', 'pointer-events-auto');
            actionBtn.style.transform = 'translateX(0px) rotate(0deg)';
        }
        if (btn) {
            btn.style.transform = 'rotate(0deg)';
            btn.classList.replace('bg-slate-800', 'bg-indigo-600');
            btn.classList.replace('shadow-[0_4px_20px_rgba(30,41,59,0.5)]', 'shadow-[0_4px_20px_rgba(79,70,229,0.5)]');
        }
        setTimeout(() => { if(icon) icon.classList.replace('fa-xmark', 'fa-bars'); }, 150);
    }
};

window.toggleDarkMode = function() {
    const htmlElement = document.documentElement;
    const isDark = htmlElement.classList.toggle('dark');
    localStorage.setItem('DataWallet_Tema', isDark ? 'escuro' : 'claro');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (isDark) {
        document.documentElement.style.backgroundColor = '#020617';
    } else {
        document.documentElement.style.backgroundColor = '#f8fafc';
    }
    atualizarIconesDark(isDark);
};

window.alternarTema = window.toggleDarkMode;
window.mudarTema = window.toggleDarkMode;

function atualizarIconesDark(isDark) {
    const btnPc = document.getElementById('btn-dark-desktop');
    const txtPc = document.getElementById('txt-dark-desktop');
    const iconePc = document.getElementById('icone-dark-mode');
    const iconeMobile = document.getElementById('icone-dark-mode-mobile');
    const starPc = document.getElementById('star-desktop');
    const starMobile = document.getElementById('star-mobile');
    const btnTemaGuest = document.getElementById('btn-tema-guest');
    
    if(starPc) { starPc.classList.remove('animate-star'); void starPc.offsetWidth; }
    if(starMobile) { starMobile.classList.remove('animate-star'); void starMobile.offsetWidth; }
    
    if (isDark) {
        if (iconePc) iconePc.className = 'fa-solid fa-sun text-lg text-amber-400 transition-colors duration-300';
        if (iconeMobile) iconeMobile.className = 'fa-solid fa-sun text-base text-amber-400 transition-colors duration-300';
        if (btnPc) btnPc.className = 'sidebar-link flex items-center h-12 px-3 rounded-xl font-bold bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors w-full';
        if (txtPc) txtPc.innerText = 'Tema Claro';
        if (btnTemaGuest) btnTemaGuest.innerHTML = '<i class="fa-solid fa-sun text-amber-400"></i><span class="hidden md:block">Tema Claro</span>';
    } else {
        if (iconePc) iconePc.className = 'fa-solid fa-moon text-lg text-white transition-colors duration-300';
        if (iconeMobile) iconeMobile.className = 'fa-solid fa-moon text-base text-white transition-colors duration-300';
        if (btnPc) btnPc.className = 'sidebar-link flex items-center h-12 px-3 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors w-full';
        if (txtPc) txtPc.innerText = 'Tema Escuro';
        if (btnTemaGuest) btnTemaGuest.innerHTML = '<i class="fa-solid fa-moon text-white"></i><span class="hidden md:block">Tema Escuro</span>';
        if(starPc) starPc.classList.add('animate-star');
        if(starMobile) starMobile.classList.add('animate-star');
    }
}
