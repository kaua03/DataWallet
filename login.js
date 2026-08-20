// ==========================================
// login.js - ENGINE DE EMOÇÃO COM "CÓCEGAS" E FÍSICA REAL
// ==========================================

let isLogin = true;
let isErrorMode = false; 
let estadoMascote = 'neutro'; 

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

const mouthLine = document.getElementById('mouth-line');
const mP1 = document.getElementById('mouth-p1');
const mP2 = document.getElementById('mouth-p2');
const mP3 = document.getElementById('mouth-p3');
const mP4 = document.getElementById('mouth-p4');
const arrayBoca = [mouthLine, mP1, mP2, mP3, mP4];

// 🟢 FÍSICA DO MOUSE E "MEDIDOR DE CÓCEGAS"
let mouseVel = 0;
let lastX = 0, lastY = 0, lastTime = Date.now();
let tickleMeter = 0; // Medidor que vai de 0 a 100+

function trackMouseSpeed(clientX, clientY) {
    const now = Date.now();
    const dt = Math.max(now - lastTime, 1);
    const dx = clientX - lastX;
    const dy = clientY - lastY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    mouseVel = (dist / dt) * 100;
    lastX = clientX;
    lastY = clientY;
    lastTime = now;
}

// 🟢 CONTROLADOR MESTRE DE EXPRESSÕES
function animarBoca(estado, percent = 0) {
    let y1, y2, y3, y4;
    let bounce = 0;

    if (estado === 'escondido') {
        y1 = 98; y2 = 100; y3 = 100; y4 = 98; 
        arrayBoca.forEach(el => el.style.transition = 'all 0.3s');
        barLeft.style.transform = `translateY(0px)`;
        barRight.style.transform = `translateY(0px)`;
    } 
    else if (estado === 'revelado') {
        y1 = 70; y2 = 98; y3 = 98; y4 = 60; 
        arrayBoca.forEach(el => el.style.transition = 'all 0.3s');
        barLeft.style.transform = `translateY(0px)`;
        barRight.style.transform = `translateY(0px)`;
    } 
    else if (estado === 'digitando') {
        let flutter = percent * 8; 
        y1 = 85; y2 = 95 - (flutter / 2); y3 = 90 + (flutter / 2); y4 = 70;
        arrayBoca.forEach(el => el.style.transition = 'all 0.1s');
        barLeft.style.transform = `translateY(0px)`;
        barRight.style.transform = `translateY(0px)`;
    } 
    else if (estado === 'rindo') {
        bounce = Math.sin(Date.now() / 50) * 6; 
        y1 = 75 + bounce; y2 = 95 + bounce; y3 = 95 + bounce; y4 = 75 + bounce;
        
        arrayBoca.forEach(el => el.style.transition = 'none');
        barLeft.style.transition = 'none';
        barRight.style.transition = 'none';
        barLeft.style.transform = `translateY(${bounce}px)`;
        barRight.style.transform = `translateY(${bounce}px)`;
        
        eyelidL.style.transform = 'scaleY(1)';
        eyelidR.style.transform = 'scaleY(1)';
    }
    else if (estado === 'sorrindo') {
        y1 = 75; y2 = 90; y3 = 90; y4 = 75; 
        arrayBoca.forEach(el => el.style.transition = 'all 0.3s');
        barLeft.style.transition = 'all 0.3s';
        barRight.style.transition = 'all 0.3s';
        barLeft.style.transform = `translateY(0px)`;
        barRight.style.transform = `translateY(0px)`;
    }
    else if (estado === 'triste') {
        y1 = 92; y2 = 80; y3 = 80; y4 = 92; 
        arrayBoca.forEach(el => el.style.transition = 'all 0.3s');
        barLeft.style.transform = `translateY(0px)`;
        barRight.style.transform = `translateY(0px)`;
        eyelidL.style.transform = 'scaleY(0.5)';
        eyelidR.style.transform = 'scaleY(0.5)';
    }
    else {
        y1 = 85; y2 = 85; y3 = 85; y4 = 85;
        arrayBoca.forEach(el => el.style.transition = 'all 0.3s');
        barLeft.style.transition = 'all 0.3s';
        barRight.style.transition = 'all 0.3s';
        barLeft.style.transform = `translateY(0px)`;
        barRight.style.transform = `translateY(0px)`;
    }

    mouthLine.setAttribute('d', `M 25,${y1} L 60,${y2} L 100,${y3} L 135,${y4}`);
    mP1.setAttribute('cy', y1);
    mP2.setAttribute('cy', y2);
    mP3.setAttribute('cy', y3);
    mP4.setAttribute('cy', y4);
}

// 🟢 O MOTOR CONTÍNUO (GAME LOOP)
function renderMascotEmotions() {
    requestAnimationFrame(renderMascotEmotions);
    
    // Desacelera a velocidade do mouse e o medidor de cócegas naturalmente
    mouseVel *= 0.90; 
    tickleMeter = Math.max(0, tickleMeter - 3); // O medidor esvazia rápido se parar de fazer cócegas
    
    if (isErrorMode) {
        if (estadoMascote !== 'triste') {
            animarBoca('triste');
            estadoMascote = 'triste';
        }
        return;
    }
    
    const isFocus = identInput.matches(':focus') || passInput.matches(':focus') || usernameInput.matches(':focus');
    
    if (!isFocus) {
        // MÁGICA: Só dá gargalhada se o Medidor de Cócegas passar de 100!
        if (tickleMeter > 100) { 
            animarBoca('rindo');
            estadoMascote = 'rindo';
        } else {
            if (estadoMascote === 'rindo') {
                eyelidL.style.transform = 'scaleY(0)';
                eyelidR.style.transform = 'scaleY(0)';
            }

            if (mouseVel > 4) { // Se mexer em qualquer lugar, ele só sorri
                if (estadoMascote !== 'sorrindo') {
                    animarBoca('sorrindo');
                    estadoMascote = 'sorrindo';
                }
            } else { 
                if (estadoMascote !== 'neutro') {
                    animarBoca('neutro');
                    estadoMascote = 'neutro';
                }
            }
        }
    } else {
        estadoMascote = 'focado';
    }
}
requestAnimationFrame(renderMascotEmotions);

// 🟢 OLHOS SEGUEM O MOUSE E DETECTAM AS CÓCEGAS
function rastrearOlhar(clientX, clientY) {
    trackMouseSpeed(clientX, clientY);
    
    // Verifica se o mouse está exatamente EM CIMA do mascote
    const rect = mascotContainer.getBoundingClientRect();
    const isHoveringMascot = clientX >= rect.left && clientX <= rect.right &&
                             clientY >= rect.top && clientY <= rect.bottom;
                             
    // Se passar rápido POR CIMA DELE, enche o medidor de cócegas!
    if (isHoveringMascot && mouseVel > 20) {
        tickleMeter += 20; 
    }
    
    if (!identInput.matches(':focus') && !passInput.matches(':focus') && !usernameInput.matches(':focus')) {
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        pupils.forEach(pupil => {
            const bounds = pupil.getBoundingClientRect();
            const pupilX = bounds.left - rect.left + bounds.width / 2;
            const pupilY = bounds.top - rect.top + bounds.height / 2;
            const angle = Math.atan2(y - pupilY, x - pupilX);
            const moveX = Math.cos(angle) * 4;
            const moveY = Math.sin(angle) * 4;
            pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
    }
}
document.addEventListener('mousemove', (e) => rastrearOlhar(e.clientX, e.clientY));
document.addEventListener('touchmove', (e) => rastrearOlhar(e.touches[0].clientX, e.touches[0].clientY), { passive: true });


// 🟢 ACOMPANHA A DIGITAÇÃO
function trackTyping(inputElement) {
    if (isErrorMode) return; 
    
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

[identInput, usernameInput].forEach(el => {
    el.addEventListener('input', () => trackTyping(el));
    el.addEventListener('focus', () => {
        if (!isErrorMode) {
            eyelidL.style.transform = 'scaleY(0)';
            eyelidR.style.transform = 'scaleY(0)';
            trackTyping(el);
        }
    });
});

passInput.addEventListener('input', () => trackTyping(passInput));
passInput.addEventListener('focus', () => {
    if (!isErrorMode) {
        if (passInput.type === 'password') {
            eyelidL.style.transform = 'scaleY(0.6)';
            eyelidR.style.transform = 'scaleY(0.6)';
        } else {
            eyelidL.style.transform = 'scaleY(0)';
            eyelidR.style.transform = 'scaleY(0)';
        }
        trackTyping(passInput);
    }
});

passInput.addEventListener('blur', () => {
    if (!isErrorMode) {
        eyelidL.style.transform = 'scaleY(0)';
        eyelidR.style.transform = 'scaleY(0)';
        pupils.forEach(p => p.style.transform = `translate(0px, 0px)`);
        barLeft.style.height = '64px';
        barRight.style.height = '80px';
    }
});

togglePassBtn.addEventListener('click', () => {
    if (isErrorMode) return;
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
    if (isErrorMode || estadoMascote === 'rindo') return; 
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
// MODO TELA E SISTEMA DE ERROS (TREMOR)
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

function dispararErroVisual() {
    isErrorMode = true; 
    const containers = [
        identInput.closest('.group'), 
        passInput.closest('.group'), 
        usernameInput.closest('.group')
    ];
    containers.forEach(c => { if(c) c.classList.add('error-state'); });
    
    const limparErro = () => {
        isErrorMode = false;
        containers.forEach(c => { if(c) c.classList.remove('error-state'); });
        
        identInput.removeEventListener('input', limparErro);
        passInput.removeEventListener('input', limparErro);
        usernameInput.removeEventListener('input', limparErro);
        
        if (document.activeElement === identInput) { trackTyping(identInput); eyelidL.style.transform = 'scaleY(0)'; eyelidR.style.transform = 'scaleY(0)'; }
        if (document.activeElement === passInput) trackTyping(passInput);
    };
    
    identInput.addEventListener('input', limparErro);
    passInput.addEventListener('input', limparErro);
    usernameInput.addEventListener('input', limparErro);
}

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
            if (userExiste && userExiste.length > 0) throw new Error('user already registered'); 

            const { data: authData, error: authErr } = await client.auth.signUp({ email: identificador, password: senha });
            if (authErr) throw authErr;

            if (authData?.user?.identities?.length === 0) throw new Error('user already registered');

            const { error: insertErr } = await client.from('usuarios_dicionario').insert([{ username: username, email: identificador }]);
            if (insertErr) throw insertErr;

            Swal.fire({
                icon: 'success',
                title: 'Cadastro Concluído!',
                text: 'Sua conta foi criada com segurança. Faça o login para continuar.',
                confirmButtonColor: '#2563eb'
            }).then(() => { 
                alternarModoTela(); 
                identInput.value = username; 
                passInput.value = '';
            });
        }
    } catch (err) {
        dispararErroVisual();
        const msgAmigavel = traduzirErroSupabase(err.message || err.error_description || JSON.stringify(err));
        Swal.fire('Falha na Autenticação', msgAmigavel, 'error');
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
});
