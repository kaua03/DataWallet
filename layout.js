// ==========================================
// layout.js - MOTOR DE COMPONENTIZAÇÃO E DARK MODE SÊNIOR
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    injetarEstilosGlobais();
    inicializarLayout();
    verificarDarkMode();
});

function injetarEstilosGlobais() {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes starRise {
            0% { transform: translate(0, 0) scale(0.5) rotate(0deg); opacity: 0; }
            30% { opacity: 1; }
            60% { transform: translate(6px, -8px) scale(1.2) rotate(45deg); opacity: 1; }
            100% { transform: translate(10px, -15px) scale(0) rotate(90deg); opacity: 0; }
        }
        .animate-star { animation: starRise 1s ease-out forwards; }
    `;
    document.head.appendChild(style);
}

function inicializarLayout() {
    const paginaAtual = window.location.pathname.split('/').pop() || 'movimentacoes.html';
    const isDashboard = paginaAtual === 'dashboard.html';

    const menuItems = [
        { nome: 'Movimentações', link: 'movimentacoes.html', icone: 'fa-money-bill-transfer', corBg: 'indigo-50', corTxt: 'indigo-700' },
        { nome: 'Dashboard', link: 'dashboard.html', icone: 'fa-chart-pie', corBg: 'indigo-50', corTxt: 'indigo-700' },
        { nome: 'Dívidas', link: 'dividas.html', icone: 'fa-file-invoice-dollar', corBg: 'indigo-50', corTxt: 'indigo-700' },
        { nome: 'Categorias', link: 'categorias.html', icone: 'fa-tags', corBg: 'indigo-50', corTxt: 'indigo-700' },
        { nome: 'Metas', link: 'planos.html', icone: 'fa-bullseye', corBg: 'indigo-50', corTxt: 'indigo-700' },
        { nome: 'Mercado', link: 'compras.html', icone: 'fa-cart-shopping', corBg: 'indigo-50', corTxt: 'indigo-700' }
    ];

    let navLinksHtml = menuItems.map(item => {
        const ativo = paginaAtual === item.link;
        const classesAtivo = ativo ? `bg-${item.corBg} text-${item.corTxt} dark:bg-indigo-500/20 dark:text-indigo-400` : `text-slate-500 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400`;
        return `
            <a href="${item.link}" class="sidebar-link flex items-center h-12 px-3 rounded-xl font-bold transition-colors overflow-hidden ${classesAtivo}">
                <div class="w-6 flex items-center justify-center shrink-0"><i class="fa-solid ${item.icone} text-lg"></i></div>
                <span class="sidebar-text ml-3">${item.nome}</span>
            </a>
        `;
    }).join('');

    const sidebarHtml = `
        <div class="hidden md:block w-20 shrink-0"></div>
        <aside id="sidebar" class="hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800 py-6 px-4 h-full z-40 fixed left-0 top-0 overflow-hidden shadow-sm">
            <div class="flex items-center justify-start mb-10 h-12 px-1">
                <div class="w-10 h-10 shrink-0 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                    <i class="fa-solid fa-wallet text-xl"></i>
                </div>
                <h2 class="sidebar-text text-2xl font-black text-slate-900 dark:text-white tracking-tight ml-3">DataWallet</h2>
            </div>
            <nav class="flex-1 space-y-2 w-full">${navLinksHtml}</nav>
            <div class="mt-auto w-full space-y-2">
                <button id="btn-dark-desktop" onclick="window.toggleDarkMode()" class="sidebar-link flex items-center h-12 px-3 rounded-xl font-bold transition-colors w-full">
                    <div class="relative w-6 flex items-center justify-center shrink-0 overflow-visible">
                        <i id="icone-dark-mode" class="fa-solid fa-moon text-lg transition-colors duration-300"></i>
                        <i id="star-desktop" class="fa-solid fa-star absolute text-[10px] text-white opacity-0 pointer-events-none z-50"></i>
                    </div>
                    <span id="txt-dark-desktop" class="sidebar-text ml-3">Tema Escuro</span>
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
            <a href="${item.link}" class="w-12 h-12 rounded-full shadow-lg flex items-center justify-center border transition-transform hover:scale-110 ${classesAtivo}">
                <i class="fa-solid ${item.icone}"></i>
            </a>
        `;
    }).join('');

    const btnIARotacionado = isDashboard ? `
        <button onclick="toggleCoach()" class="w-12 h-12 rounded-full bg-slate-900 text-indigo-400 dark:bg-black border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center justify-center transition-transform hover:scale-110">
            <i class="fa-solid fa-robot"></i>
        </button>
    ` : '';

    const mobileMenuHtml = `
        <div class="md:hidden fixed bottom-10 right-6 z-[60] flex flex-col items-center gap-3">
            <div id="fab-items" class="flex flex-col items-center gap-3 transition-all duration-500 transform translate-y-12 opacity-0 pointer-events-none mb-2">
                <button onclick="sairDoSistema()" class="w-12 h-12 rounded-full bg-white dark:bg-slate-800 text-rose-500 border border-rose-100 dark:border-rose-900/50 shadow-lg flex items-center justify-center transition-transform hover:scale-110">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
                <button id="btn-dark-mobile" onclick="window.toggleDarkMode()" class="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 border relative overflow-visible">
                    <i id="icone-dark-mode-mobile" class="fa-solid fa-moon transition-colors duration-300"></i>
                    <i id="star-mobile" class="fa-solid fa-star absolute text-[12px] text-white opacity-0 pointer-events-none z-50"></i>
                </button>
                ${btnIARotacionado}
                <div class="w-8 h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                ${mobileLinksHtml}
            </div>
            
            <button onclick="toggleMobileMenu()" id="fab-menu" class="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-[0_4px_20px_rgba(79,70,229,0.5)] flex items-center justify-center text-xl transition-all duration-500 z-50 hover:scale-105">
                <i class="fa-solid fa-bars transition-all duration-300" id="fab-icon"></i>
            </button>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', sidebarHtml);
    document.body.insertAdjacentHTML('beforeend', mobileMenuHtml);
}

let menuMobileAberto = false;
window.toggleMobileMenu = function() {
    const items = document.getElementById('fab-items');
    const icon = document.getElementById('fab-icon');
    const btn = document.getElementById('fab-menu');
    menuMobileAberto = !menuMobileAberto;

    if (menuMobileAberto) {
        items.classList.remove('opacity-0', 'translate-y-12', 'pointer-events-none');
        items.classList.add('opacity-100', 'translate-y-0');
        btn.style.transform = 'rotate(180deg)';
        setTimeout(() => { icon.classList.replace('fa-bars', 'fa-xmark'); }, 150);
        btn.classList.replace('bg-indigo-600', 'bg-slate-800');
        btn.classList.replace('shadow-[0_4px_20px_rgba(79,70,229,0.5)]', 'shadow-[0_4px_20px_rgba(30,41,59,0.5)]');
    } else {
        items.classList.add('opacity-0', 'translate-y-12', 'pointer-events-none');
        items.classList.remove('opacity-100', 'translate-y-0');
        btn.style.transform = 'rotate(0deg)';
        setTimeout(() => { icon.classList.replace('fa-xmark', 'fa-bars'); }, 150);
        btn.classList.replace('bg-slate-800', 'bg-indigo-600');
        btn.classList.replace('shadow-[0_4px_20px_rgba(30,41,59,0.5)]', 'shadow-[0_4px_20px_rgba(79,70,229,0.5)]');
    }
};

window.toggleDarkMode = function() {
    const htmlElement = document.documentElement;
    const isDark = htmlElement.classList.toggle('dark');
    localStorage.setItem('DataWallet_Tema', isDark ? 'escuro' : 'claro');
    atualizarIconesDark(isDark);
};

function verificarDarkMode() {
    const temaSalvo = localStorage.getItem('DataWallet_Tema');
    const htmlElement = document.documentElement;

    let isDark = false;
    if (temaSalvo === 'escuro') {
        htmlElement.classList.add('dark');
        isDark = true;
    } else {
        htmlElement.classList.remove('dark');
    }
    atualizarIconesDark(isDark);
}

function atualizarIconesDark(isDark) {
    const btnPc = document.getElementById('btn-dark-desktop');
    const txtPc = document.getElementById('txt-dark-desktop');
    const iconePc = document.getElementById('icone-dark-mode');
    const btnMobile = document.getElementById('btn-dark-mobile');
    const iconeMobile = document.getElementById('icone-dark-mode-mobile');
    const starPc = document.getElementById('star-desktop');
    const starMobile = document.getElementById('star-mobile');
    
    if(starPc) { starPc.classList.remove('animate-star'); void starPc.offsetWidth; }
    if(starMobile) { starMobile.classList.remove('animate-star'); void starMobile.offsetWidth; }
    
    if (isDark) {
        if (iconePc) iconePc.className = 'fa-solid fa-sun text-lg text-amber-400 transition-colors duration-300';
        if (iconeMobile) iconeMobile.className = 'fa-solid fa-sun text-xl text-amber-400 transition-colors duration-300';
        if (btnPc) btnPc.className = 'sidebar-link flex items-center h-12 px-3 rounded-xl font-bold bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors w-full';
        if (txtPc) txtPc.innerText = 'Tema Claro';
        if (btnMobile) btnMobile.className = 'w-12 h-12 rounded-full bg-slate-800 shadow-lg flex items-center justify-center transition-transform hover:scale-110 border border-slate-700 relative overflow-visible';
    } else {
        if (iconePc) iconePc.className = 'fa-solid fa-moon text-lg text-white transition-colors duration-300';
        if (iconeMobile) iconeMobile.className = 'fa-solid fa-moon text-xl text-white transition-colors duration-300';
        if (btnPc) btnPc.className = 'sidebar-link flex items-center h-12 px-3 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors w-full';
        if (txtPc) txtPc.innerText = 'Tema Escuro';
        if (btnMobile) btnMobile.className = 'w-12 h-12 rounded-full bg-slate-800 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110 border border-slate-700 relative overflow-visible';
        
        if(starPc) starPc.classList.add('animate-star');
        if(starMobile) starMobile.classList.add('animate-star');
    }
}
