// ==========================================
// login.js - LÓGICA DO GRÁFICO VIVO E TOUCH (MOBILE)
// ==========================================

let isLogin = true;

const emailInput = document.getElementById('email');
const passInput = document.getElementById('senha');
const togglePassBtn = document.getElementById('toggle-pass');
const iconPass = document.getElementById('icon-pass');

const mascotContainer = document.getElementById('mascot-container');
const pupils = document.querySelectorAll('#pupil-l, #pupil-r');
const eyelidL = document.getElementById('eyelid-l');
const eyelidR = document.getElementById('eyelid-r');
const barLeft = document.getElementById('bar-left');
const barRight = document.getElementById('bar-right');

// 🟢 RASTREAMENTO UNIVERSAL (MOUSE NO PC E DEDO NO CELULAR)
function rastrearOlhar(clientX, clientY) {
    if (!emailInput.matches(':focus') && !passInput.matches(':focus')) {
        const rect = mascotContainer.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        pupils.forEach(pupil => {
            const bounds = pupil.getBoundingClientRect();
            const pupilX = bounds.left - rect.left + bounds.width / 2;
            const pupilY = bounds.top - rect.top + bounds.height / 2;
            
            const angle = Math.atan2(y - pupilY, x - pupilX);
            const distance = 4; // Raio limite do globo ocular
            
            const moveX = Math.cos(angle) * distance;
            const moveY = Math.sin(angle) * distance;
            pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
    }
}

// Escuta o Mouse no Computador
document.addEventListener('mousemove', (e) => rastrearOlhar(e.clientX, e.clientY));

// Escuta o Deslizar do Dedo no Celular (touches[0] é o primeiro dedo na tela)
document.addEventListener('touchmove', (e) => rastrearOlhar(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

// 🟢 ACOMPANHA A DIGITAÇÃO (Cresce as barras e mexe as pupilas)
function trackTyping(inputElement) {
    const length = inputElement.value.length;
    const percent = Math.min(length / 20, 1);
    
    const moveX = (percent * 8) - 4;
    pupils.forEach(pupil => {
        pupil.style.transform = `translate(${moveX}px, 1px)`;
    });

    barLeft.style.height = `${64 + (percent * 8)}px`;
    barRight.style.height = `${80 + (percent * 8)}px`;
}

// 🟢 EVENTOS DO E-MAIL
emailInput.addEventListener('input', () => trackTyping(emailInput));
emailInput.addEventListener('focus', () => {
    eyelidL.style.transform = 'scaleY(0)';
    eyelidR.style.transform = 'scaleY(0)';
    trackTyping(emailInput);
});

// 🟢 EVENTOS DA SENHA (A Mágica da Espiadinha)
passInput.addEventListener('input', () => trackTyping(passInput));
passInput.addEventListener('focus', () => {
    if (passInput.type === 'password') {
        eyelidL.style.transform = 'scaleY(1)'; // Fecha olho esquerdo 100%
        eyelidR.style.transform = 'scaleY(1)'; // Fecha olho direito 100%
    } else {
        eyelidL.style.transform = 'scaleY(1)';   // Esquerdo continua fechado
        eyelidR.style.transform = 'scaleY(0.6)'; // Direito espiando pela fresta (60% fechado)
    }
    trackTyping(passInput);
});

passInput.addEventListener('blur', () => {
    eyelidL.style.transform = 'scaleY(0)'; // Abre
    eyelidR.style.transform = 'scaleY(0)'; // Abre
    pupils.forEach(p => p.style.transform = `translate(0px, 0px)`);
    barLeft.style.height = '64px';
    barRight.style.height = '80px';
});

// 🟢 BOTÃO VER SENHA
togglePassBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
        passInput.type = 'text';
        iconPass.classList.replace('fa-eye', 'fa-eye-slash');
        
        // O Efeito Espião: Arregala só a metade de um olho!
        eyelidL.style.transform = 'scaleY(1)';   // Mantém esquerdo trancado
        eyelidR.style.transform = 'scaleY(0.6)'; // Levanta um pouco a pálpebra direita
        
    } else {
        passInput.type = 'password';
        iconPass.classList.replace('fa-eye-slash', 'fa-eye');
        
        // Volta a fechar os dois
        eyelidL.style.transform = 'scaleY(1)'; 
        eyelidR.style.transform = 'scaleY(1)';
        passInput.focus();
    }
});

// 🟢 PISCAR AUTOMÁTICO (Com trava de inteligência)
setInterval(() => {
    const isPasswordFocus = passInput === document.activeElement;
    
    // Se o usuário estiver na senha, o sistema anula o piscar automático 
    // para não quebrar a animação dos olhos já fechados ou espiando.
    if (isPasswordFocus) return; 
    
    eyelidL.style.transform = 'scaleY(1)';
    eyelidR.style.transform = 'scaleY(1)';
    
    setTimeout(() => {
        if (!isPasswordFocus) {
            eyelidL.style.transform = 'scaleY(0)';
            eyelidR.style.transform = 'scaleY(0)';
        }
    }, 150);
}, 4000);

// ==========================================
// ALTERNÂNCIA E INTEGRAÇÃO SUPABASE
// ==========================================
document.getElementById('btn-toggle-mode').addEventListener('click', () => {
    isLogin = !isLogin;
    document.getElementById('titulo-form').innerText = isLogin ? 'Acesso Seguro' : 'Criar Conta de Elite';
    document.getElementById('subtitulo-form').innerText = isLogin ? 'Analytics & Inteligência Financeira.' : 'Junte-se à alta performance financeira.';
    document.getElementById('btn-submit').innerHTML = isLogin ? 'Acessar Painel <i class="fa-solid fa-arrow-right"></i>' : 'Solicitar Acesso <i class="fa-solid fa-shield-halved"></i>';
    document.getElementById('texto-rodape').innerText = isLogin ? 'Ainda não faz parte da elite?' : 'Já possui acesso de elite?';
    document.getElementById('btn-toggle-mode').innerText = isLogin ? 'Criar Conta' : 'Fazer Login';
    
    const boxLgpd = document.getElementById('box-lgpd');
    if (isLogin) { boxLgpd.classList.add('hidden'); boxLgpd.classList.remove('flex'); } 
    else { boxLgpd.classList.remove('hidden'); boxLgpd.classList.add('flex'); }
});

document.getElementById('form-auth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const senha = passInput.value.trim();

    if (!isLogin && !document.getElementById('check-lgpd').checked) {
        return Swal.fire('Atenção', 'Você deve concordar com os termos de tratamento de dados (LGPD).', 'warning');
    }

    const btn = document.getElementById('btn-submit');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Autenticando...';
    btn.disabled = true;

    try {
        const client = window.supabaseClient;
        if (isLogin) {
            const { error } = await client.auth.signInWithPassword({ email, password: senha });
            if (error) throw error;
            Swal.fire({ icon: 'success', title: 'Acesso Liberado', showConfirmButton: false, timer: 1000 });
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
        } else {
            const { error } = await client.auth.signUp({ email, password: senha });
            if (error) throw error;
            Swal.fire({
                icon: 'success',
                title: 'Solicitação Enviada!',
                text: 'Sua conta foi criada com segurança.',
                confirmButtonColor: '#4f46e5'
            }).then(() => { document.getElementById('btn-toggle-mode').click(); });
        }
    } catch (err) {
        Swal.fire('Falha na Autenticação', 'Verifique suas credenciais e tente novamente.', 'error');
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
});
