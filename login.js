// ==========================================
// login.js - LÓGICA DO GRÁFICO VIVO DE BARRA
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

// 🟢 OLHOS SEGUEM O MOUSE
document.addEventListener('mousemove', (e) => {
    if (!emailInput.matches(':focus') && !passInput.matches(':focus')) {
        const rect = mascotContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

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
});

// 🟢 ACOMPANHA A DIGITAÇÃO (Cresce levemente as barras e mexe as pupilas)
function trackTyping(inputElement) {
    const length = inputElement.value.length;
    const percent = Math.min(length / 20, 1);
    
    const moveX = (percent * 8) - 4;
    pupils.forEach(pupil => {
        pupil.style.transform = `translate(${moveX}px, 1px)`;
    });

    // Reação visual: As barras esticam levemente para cima conforme você digita dados
    barLeft.style.height = `${64 + (percent * 8)}px`;
    barRight.style.height = `${80 + (percent * 8)}px`;
}

// 🟢 EVENTOS DE FOCO
emailInput.addEventListener('input', () => trackTyping(emailInput));
emailInput.addEventListener('focus', () => {
    eyelidL.style.transform = 'scaleY(0)';
    eyelidR.style.transform = 'scaleY(0)';
    trackTyping(emailInput);
});

passInput.addEventListener('input', () => trackTyping(passInput));
passInput.addEventListener('focus', () => {
    if (passInput.type === 'password') {
        eyelidL.style.transform = 'scaleY(1)'; // Fecha o olho esquerdo (espiando)
        eyelidR.style.transform = 'scaleY(0)'; // Mantém o direito aberto
    }
    trackTyping(passInput);
});

passInput.addEventListener('blur', () => {
    eyelidL.style.transform = 'scaleY(0)';
    pupils.forEach(p => p.style.transform = `translate(0px, 0px)`);
    barLeft.style.height = '64px';
    barRight.style.height = '80px';
});

// 🟢 BOTÃO VER SENHA
togglePassBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
        passInput.type = 'text';
        iconPass.classList.replace('fa-eye', 'fa-eye-slash');
        eyelidL.style.transform = 'scaleY(0);'; // Abre os dois olhos com tudo
        eyelidR.style.transform = 'scaleY(0)';
    } else {
        passInput.type = 'password';
        iconPass.classList.replace('fa-eye-slash', 'fa-eye');
        eyelidL.style.transform = 'scaleY(1)'; // Fecha o esquerdo de novo
        passInput.focus();
    }
});

// 🟢 PISCAR AUTOMÁTICO DAS BARRAS
setInterval(() => {
    const isPasswordHidden = passInput === document.activeElement && passInput.type === 'password';
    
    if (!isPasswordHidden) eyelidL.style.transform = 'scaleY(1)';
    eyelidR.style.transform = 'scaleY(1)';
    
    setTimeout(() => {
        if (!isPasswordHidden) eyelidL.style.transform = 'scaleY(0)';
        eyelidR.style.transform = 'scaleY(0)';
    }, 150);
}, 4000);

// ==========================================
// ALTERNÂNCIA E SUPABASE
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
