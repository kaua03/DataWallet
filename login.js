// ==========================================
// login.js - LÓGICA DO MASCOTE COMBO CHART (BARRA + LINHA) COM FÍSICA
// ==========================================

let isLogin = true;

const identInput = document.getElementById('identificador');
const usernameInput = document.getElementById('username');
const passInput = document.getElementById('senha');
const togglePassBtn = document.getElementById('toggle-pass');
const iconPass = document.getElementById('icon-pass');

const mascotContainer = document.getElementById('mascot-container');
const pupils = document.querySelectorAll('#pupil-l, #pupil-r');
const eyelidL = document.getElementById('eyelid-l');
const eyelidR = document.getElementById('eyelid-r');
const barLeft = document.getElementById('bar-left');
const barRight = document.getElementById('bar-right');

// Elementos da Boca
const mouthLine = document.getElementById('mouth-line');
const mP1 = document.getElementById('mouth-p1');
const mP2 = document.getElementById('mouth-p2');
const mP3 = document.getElementById('mouth-p3');
const mP4 = document.getElementById('mouth-p4');
const arrayBoca = [mouthLine, mP1, mP2, mP3, mP4];

// 🟢 FÍSICA E LOOP DE EMOÇÃO (O Segredo da Vida)
let mouseVel = 0;
let lastX = 0, lastY = 0, lastTime = Date.now();

function trackMouseSpeed(clientX, clientY) {
    const now = Date.now();
    const dt = Math.max(now - lastTime, 1);
    const dx = clientX - lastX;
    const dy = clientY - lastY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Calcula a velocidade do movimento
    mouseVel = (dist / dt) * 100;
    
    lastX = clientX;
    lastY = clientY;
    lastTime = now;
}

// 🟢 CONTROLADOR DA BOCA
function animarBoca(estado, percent = 0) {
    let y1, y2, y3, y4;

    if (estado === 'escondido') {
        y1 = 98; y2 = 100; y3 = 100; y4 = 98; // Linha reta e tensa embaixo
        arrayBoca.forEach(el => el.style.transition = '');
    } 
    else if (estado === 'revelado') {
        y1 = 70; y2 = 98; y3 = 98; y4 = 60; // Sorrisão aberto
        arrayBoca.forEach(el => el.style.transition = '');
    } 
    else if (estado === 'digitando') {
        let flutter = percent * 8; 
        y1 = 85; y2 = 95 - (flutter / 2); y3 = 90 + (flutter / 2); y4 = 70;
        arrayBoca.forEach(el => el.style.transition = '');
    } 
    else if (estado === 'rindo') {
        // Modo Gargalhada (Múltiplos pulos contínuos por segundo usando seno)
        let bounce = Math.sin(Date.now() / 60) * 10; 
        y1 = 75 + bounce; y2 = 95 + bounce; y3 = 95 + bounce; y4 = 75 + bounce;
        // Desliga o CSS para ele poder quicar loucamente em tempo real
        arrayBoca.forEach(el => el.style.transition = 'none');
    }
    else if (estado === 'sorrindo') {
        y1 = 75; y2 = 90; y3 = 90; y4 = 75; // Um sorriso amigável normal
        arrayBoca.forEach(el => el.style.transition = '');
    }
    else {
        // Neutro 😐 (Parado sem fazer nada)
        y1 = 85; y2 = 85; y3 = 85; y4 = 85;
        arrayBoca.forEach(el => el.style.transition = '');
    }

    mouthLine.setAttribute('d', `M 25,${y1} L 60,${y2} L 100,${y3} L 135,${y4}`);
    mP1.setAttribute('cy', y1);
    mP2.setAttribute('cy', y2);
    mP3.setAttribute('cy', y3);
    mP4.setAttribute('cy', y4);
}

// 🟢 O CÉREBRO CONTÍNUO DO MASCOTE (Roda 60x por segundo)
function renderMascotEmotions() {
    requestAnimationFrame(renderMascotEmotions);
    
    mouseVel *= 0.90; // Desacelera naturalmente quando você para o mouse
    
    // Se não tiver clicado em nenhum campo, a emoção segue a física do mouse
    const isFocus = identInput.matches(':focus') || passInput.matches(':focus') || usernameInput.matches(':focus');
    
    if (!isFocus) {
        if (mouseVel > 40) {
            animarBoca('rindo'); // 😂
        } else if (mouseVel > 3) {
            animarBoca('sorrindo'); // 🙂
        } else {
            animarBoca('neutro'); // 😐
        }
    }
}
requestAnimationFrame(renderMascotEmotions); // Inicia a vida dele!

// 🟢 OLHOS SEGUEM O MOUSE E CAPTURAM VELOCIDADE
function rastrearOlhar(clientX, clientY) {
    trackMouseSpeed(clientX, clientY);
    
    if (!identInput.matches(':focus') && !passInput.matches(':focus') && !usernameInput.matches(':focus')) {
        const rect = mascotContainer.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        pupils.forEach(pupil => {
            const bounds = pupil.getBoundingClientRect();
            const pupilX = bounds.left - rect.left + bounds.width / 2;
            const pupilY = bounds.top - rect.top + bounds.height / 2;
            
            const angle = Math.atan2(y - pupilY, x - pupilX);
            const distance = 4;
            
            const moveX = Math.cos(angle) * distance;
            const moveY = Math.sin(angle) * distance;
            pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
    }
}
document.addEventListener('mousemove', (e) => rastrearOlhar(e.clientX, e.clientY));
document.addEventListener('touchmove', (e) => rastrearOlhar(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

// 🟢 ACOMPANHA A DIGITAÇÃO
function trackTyping(inputElement) {
    const length = inputElement.value.length;
    const percent = Math.min(length / 20, 1);
    const moveX = (percent * 8) - 4; 
    
    const isPasswordFocus = passInput === document.activeElement;
    const isHidden = isPasswordFocus && passInput.type === 'password';

    if (isHidden) {
        pupils.forEach(pupil => { pupil.style.transform = `translate(${moveX}px, 2px)`; });
        barLeft.style.height = '30px';
        barRight.style.height = '35px';
        animarBoca('escondido');
    } else {
        pupils.forEach(pupil => { pupil.style.transform = `translate(${moveX}px, 1px)`; });
        
        if (isPasswordFocus && passInput.type === 'text') {
            barLeft.style.height = `${70 + (percent * 5)}px`;
            barRight.style.height = `${86 + (percent * 5)}px`;
            animarBoca('revelado');
        } else {
            barLeft.style.height = `${64 + (percent * 8)}px`;
            barRight.style.height = `${80 + (percent * 8)}px`;
            animarBoca('digitando', percent);
        }
    }
}

// Eventos dos Inputs
[identInput, usernameInput].forEach(el => {
    el.addEventListener('input', () => trackTyping(el));
    el.addEventListener('focus', () => {
        eyelidL.style.transform = 'scaleY(0)';
        eyelidR.style.transform = 'scaleY(0)';
        trackTyping(el);
    });
});

passInput.addEventListener('input', () => trackTyping(passInput));
passInput.addEventListener('focus', () => {
    if (passInput.type === 'password') {
        eyelidL.style.transform = 'scaleY(0.6)';
        eyelidR.style.transform = 'scaleY(0.6)';
    } else {
        eyelidL.style.transform = 'scaleY(0)';
        eyelidR.style.transform = 'scaleY(0)';
    }
    trackTyping(passInput);
});

passInput.addEventListener('blur', () => {
    eyelidL.style.transform = 'scaleY(0)';
    eyelidR.style.transform = 'scaleY(0)';
    pupils.forEach(p => p.style.transform = `translate(0px, 0px)`);
    barLeft.style.height = '64px';
    barRight.style.height = '80px';
    // O Game Loop assume a boca automaticamente ao dar blur
});

togglePassBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
        passInput.type = 'text';
        iconPass.classList.replace('fa-eye', 'fa-eye-slash');
        eyelidL.style.transform = 'scaleY(0)';   
        eyelidR.style.transform = 'scaleY(0)'; 
        trackTyping(passInput); 
    } else {
        passInput.type = 'password';
        iconPass.classList.replace('fa-eye-slash', 'fa-eye');
        eyelidL.style.transform = 'scaleY(0.6)'; 
        eyelidR.style.transform = 'scaleY(0.6)';
        passInput.focus();
        trackTyping(passInput); 
    }
});

// PISCAR AUTOMÁTICO
setInterval(() => {
    const isPasswordFocus = passInput === document.activeElement;
    if (isPasswordFocus && passInput.type === 'password') return; 
    eyelidL.style.transform = 'scaleY(1)';
    eyelidR.style.transform = 'scaleY(1)';
    setTimeout(() => {
        if (!isPasswordFocus || (isPasswordFocus && passInput.type === 'text')) {
            eyelidL.style.transform = 'scaleY(0)';
            eyelidR.style.transform = 'scaleY(0)';
        }
    }, 150);
}, 4000);


// ==========================================
// ALTERNÂNCIA E AUTENTICAÇÃO (MANTIDA INTACTA)
// ==========================================
function alternarModoTela() {
    isLogin = !isLogin;
    
    document.getElementById('titulo-form').innerText = isLogin ? 'Acesso Seguro' : 'Criar Conta';
    document.getElementById('subtitulo-form').innerText = isLogin ? 'Analytics & Inteligência Financeira.' : 'Junte-se à alta performance financeira.';
    
    document.getElementById('btn-submit').innerHTML = isLogin 
        ? 'Acessar <i class="fa-solid fa-arrow-right transition-transform duration-300 group-hover:translate-x-1.5"></i>' 
        : 'Cadastrar <i class="fa-solid fa-shield-halved transition-transform duration-300 group-hover:scale-110"></i>';
    
    const boxLgpd = document.getElementById('box-lgpd');
    const boxUsername = document.getElementById('box-username');
    const labelIdent = document.getElementById('label-identificador');
    const iconIdent = document.getElementById('icon-identificador');
    const btnVoltar = document.getElementById('btn-voltar');
    const boxRodape = document.getElementById('box-rodape');
    
    if (isLogin) { 
        btnVoltar.classList.add('hidden');
        boxRodape.classList.remove('hidden');
        boxLgpd.classList.add('hidden'); boxLgpd.classList.remove('flex');
        boxUsername.classList.add('hidden', 'opacity-0');
        usernameInput.required = false;
        labelIdent.innerText = "E-mail ou Usuário";
        iconIdent.className = "fa-solid fa-user absolute left-4 text-slate-500 transition-colors duration-300 group-focus-within:text-blue-400";
    } else { 
        btnVoltar.classList.remove('hidden');
        boxRodape.classList.add('hidden'); 
        boxLgpd.classList.remove('hidden'); boxLgpd.classList.add('flex');
        boxUsername.classList.remove('hidden'); 
        setTimeout(() => boxUsername.classList.remove('opacity-0'), 50); 
        usernameInput.required = true;
        labelIdent.innerText = "E-mail"; 
        iconIdent.className = "fa-solid fa-envelope absolute left-4 text-slate-500 transition-colors duration-300 group-focus-within:text-blue-400";
    }
}

document.getElementById('btn-toggle-mode').addEventListener('click', alternarModoTela);
document.getElementById('btn-voltar').addEventListener('click', alternarModoTela);

function traduzirErroSupabase(mensagem) {
    if (!mensagem) return 'Erro de conexão. Verifique sua internet.';
    const msg = mensagem.toLowerCase();
    
    if (msg.includes('invalid login credentials')) return 'E-mail, usuário ou senha incorretos.';
    if (msg.includes('password should be at least')) return 'A senha deve ter no mínimo 6 caracteres.';
    if (msg.includes('user already registered') || msg.includes('already exists')) return 'Este e-mail ou usuário já está em uso.';
    if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento.';
    
    return `Alerta do Banco de Dados: ${mensagem}`;
}

document.getElementById('form-auth').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const identificador = identInput.value.trim().toLowerCase();
    const senha = passInput.value.trim();
    const username = usernameInput.value.trim().toLowerCase();

    if (!isLogin && !document.getElementById('check-lgpd').checked) {
        return Swal.fire('Atenção', 'Você deve concordar com os termos de tratamento de dados (LGPD).', 'warning');
    }

    const btn = document.getElementById('btn-submit');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processando...';
    btn.disabled = true;

    try {
        const client = window.supabaseClient;

        if (isLogin) {
            let emailLogin = identificador;
            
            if (!identificador.includes('@')) {
                const { data, error: errUser } = await client.from('usuarios_dicionario').select('email').eq('username', identificador).maybeSingle();
                if (errUser || !data) throw new Error('invalid login credentials'); 
                emailLogin = data.email; 
            }

            const { error } = await client.auth.signInWithPassword({ email: emailLogin, password: senha });
            if (error) throw error;
            
            Swal.fire({ icon: 'success', title: 'Acesso Liberado', showConfirmButton: false, timer: 1000 });
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
            
        } else {
            const { data: userExiste, error: errBusca } = await client.from('usuarios_dicionario').select('username').eq('username', username);
            if (errBusca) throw errBusca; 
            
            if (userExiste && userExiste.length > 0) {
                throw new Error('user already registered'); 
            }

            const { data: authData, error: authErr } = await client.auth.signUp({ email: identificador, password: senha });
            if (authErr) throw authErr;

            if (authData?.user?.identities?.length === 0) {
                throw new Error('user already registered');
            }

            const { error: insertErr } = await client.from('usuarios_dicionario').insert([{ username: username, email: identificador }]);
            if (insertErr) throw insertErr;

            Swal.fire({
                icon: 'success',
                title: 'Cadastro Concluído!',
                text: 'Sua conta de elite foi criada com segurança. Faça o login para continuar.',
                confirmButtonColor: '#2563eb'
            }).then(() => { 
                alternarModoTela(); 
                identInput.value = username; 
                passInput.value = '';
            });
        }
    } catch (err) {
        console.error("LOG DE ERRO TÉCNICO PARA O KAUÃ:", err);
        const msgAmigavel = traduzirErroSupabase(err.message || err.error_description || JSON.stringify(err));
        Swal.fire('Falha na Autenticação', msgAmigavel, 'error');
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
});
