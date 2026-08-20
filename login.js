// ==========================================
// login.js - AUTENTICAÇÃO E ANIMAÇÃO SVG
// ==========================================

let isLogin = true;

const emailInput = document.getElementById('email');
const passInput = document.getElementById('senha');
const togglePassBtn = document.getElementById('toggle-pass');
const iconPass = document.getElementById('icon-pass');

// Elementos SVG
const mascotContainer = document.getElementById('mascot-container');
const pupils = document.querySelectorAll('.pupil');
const eyeLGroup = document.getElementById('eye-l-group');
const eyeRGroup = document.getElementById('eye-r-group');
const eyelidL = document.getElementById('eyelid-l');
const eyelidR = document.getElementById('eyelid-r');
const handL = document.getElementById('hand-l');
const handR = document.getElementById('hand-r');

// 🟢 OLHOS SEGUEM O MOUSE (Quando não está digitando)
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
            const distance = 6; // O quanto a pupila se move
            
            const moveX = Math.cos(angle) * distance;
            const moveY = Math.sin(angle) * distance;
            pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
    }
});

// 🟢 FUNÇÃO: Olhos acompanham a digitação (Esquerda pra Direita)
function trackTyping(inputElement) {
    const length = inputElement.value.length;
    const maxLength = 25; 
    const percent = Math.min(length / maxLength, 1);
    
    const moveX = (percent * 12) - 6; // Vai de -6px até +6px
    const moveY = 3; // Foca levemente pra baixo (onde está o teclado)

    pupils.forEach(pupil => {
        pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });
}

// 🟢 EVENTOS DO E-MAIL
emailInput.addEventListener('input', () => trackTyping(emailInput));
emailInput.addEventListener('focus', () => {
    // Garante que tudo está aberto
    eyelidL.classList.replace('scale-y-100', 'scale-y-0');
    eyelidR.classList.replace('scale-y-100', 'scale-y-0');
    handL.classList.replace('translate-y-[0px]', 'translate-y-[150px]');
    handR.classList.replace('translate-y-[30px]', 'translate-y-[150px]');
    trackTyping(emailInput);
});

// 🟢 EVENTOS DA SENHA (Mão cobrindo, um olho espiando)
passInput.addEventListener('input', () => trackTyping(passInput));
passInput.addEventListener('focus', () => {
    if (passInput.type === 'password') {
        // Mãos sobem
        handL.classList.replace('translate-y-[150px]', 'translate-y-[0px]');
        handR.classList.replace('translate-y-[150px]', 'translate-y-[30px]'); // Fica mais baixa
        
        // Fecha olho esquerdo
        eyelidL.classList.replace('scale-y-0', 'scale-y-100');
        eyelidR.classList.replace('scale-y-100', 'scale-y-0'); // Mantém o direito aberto
    }
    trackTyping(passInput);
});

passInput.addEventListener('blur', () => {
    // Mãos descem
    handL.classList.replace('translate-y-[0px]', 'translate-y-[150px]');
    handR.classList.replace('translate-y-[30px]', 'translate-y-[150px]');
    // Olho esquerdo abre
    eyelidL.classList.replace('scale-y-100', 'scale-y-0');
    
    // Centraliza pupilas
    pupils.forEach(p => p.style.transform = `translate(0px, 0px)`);
});

// 🟢 BOTÃO VER SENHA (Arregalar Olhos)
togglePassBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
        passInput.type = 'text';
        iconPass.classList.replace('fa-eye', 'fa-eye-slash');
        
        // Mãos descem com tudo
        handL.classList.replace('translate-y-[0px]', 'translate-y-[150px]');
        handR.classList.replace('translate-y-[30px]', 'translate-y-[150px]');
        
        // Olho esquerdo abre e ambos ARREGALAM
        eyelidL.classList.replace('scale-y-100', 'scale-y-0');
        eyeLGroup.classList.add('scale-125');
        eyeRGroup.classList.add('scale-125');
    } else {
        passInput.type = 'password';
        iconPass.classList.replace('fa-eye-slash', 'fa-eye');
        
        // Desfaz o arregalado
        eyeLGroup.classList.remove('scale-125');
        eyeRGroup.classList.remove('scale-125');
        
        // Volta a espiar (Mãos sobem, olho esquerdo fecha)
        handL.classList.replace('translate-y-[150px]', 'translate-y-[0px]');
        handR.classList.replace('translate-y-[150px]', 'translate-y-[30px]');
        eyelidL.classList.replace('scale-y-0', 'scale-y-100');
        
        passInput.focus(); 
    }
});

// ==========================================
// LÓGICA DE ALTERNÂNCIA (LOGIN / CADASTRO)
// ==========================================
document.getElementById('btn-toggle-mode').addEventListener('click', () => {
    isLogin = !isLogin;
    
    document.getElementById('titulo-form').innerText = isLogin ? 'Acesso Seguro' : 'Criar Conta de Elite';
    document.getElementById('subtitulo-form').innerText = isLogin ? 'O seu guardião de dados financeiros.' : 'Junte-se à alta performance financeira.';
    document.getElementById('btn-submit').innerHTML = isLogin ? 'Desbloquear Cofre <i class="fa-solid fa-unlock-keyhole"></i>' : 'Solicitar Acesso <i class="fa-solid fa-shield-halved"></i>';
    document.getElementById('texto-rodape').innerText = isLogin ? 'Ainda não faz parte da elite?' : 'Já possui acesso de elite?';
    document.getElementById('btn-toggle-mode').innerText = isLogin ? 'Criar Conta' : 'Fazer Login';
    
    const boxLgpd = document.getElementById('box-lgpd');
    if (isLogin) {
        boxLgpd.classList.add('hidden'); boxLgpd.classList.remove('flex');
    } else {
        boxLgpd.classList.remove('hidden'); boxLgpd.classList.add('flex');
    }
});

// ==========================================
// INTEGRAÇÃO SEGURA COM SUPABASE
// ==========================================
document.getElementById('form-auth').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const senha = passInput.value.trim();

    if (!isLogin && !document.getElementById('check-lgpd').checked) {
        return Swal.fire('Atenção', 'Para prosseguirmos, você deve concordar com os termos de tratamento de dados (LGPD).', 'warning');
    }

    const btn = document.getElementById('btn-submit');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Autenticando...';
    btn.disabled = true;

    try {
        const client = window.supabaseClient;

        if (isLogin) {
            const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
            if (error) throw error;
            
            Swal.fire({ icon: 'success', title: 'Acesso Liberado', showConfirmButton: false, timer: 1000 });
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
            
        } else {
            const { data, error } = await client.auth.signUp({ email, password: senha });
            if (error) throw error;
            
            // 🟢 INTEGRAÇÃO DE CADASTRO: Confirmação e Espera
            Swal.fire({
                icon: 'success',
                title: 'Solicitação Enviada!',
                text: 'Sua conta foi criada. Aguarde a aprovação do Administrador ou verifique seu e-mail.',
                confirmButtonColor: '#4f46e5'
            }).then(() => {
                document.getElementById('btn-toggle-mode').click(); 
            });
        }
    } catch (err) {
        Swal.fire('Falha na Autenticação', 'Verifique suas credenciais e tente novamente.', 'error');
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
});
