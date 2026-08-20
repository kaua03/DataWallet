// ==========================================
// login.js - LÓGICA DO GRÁFICO VIVO E TEXTOS ATUALIZADOS
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

// 🟢 OLHOS SEGUEM O MOUSE / DEDO (Quando não está focado nos inputs)
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
            const distance = 4;
            
            const moveX = Math.cos(angle) * distance;
            const moveY = Math.sin(angle) * distance;
            pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
    }
}
document.addEventListener('mousemove', (e) => rastrearOlhar(e.clientX, e.clientY));
document.addEventListener('touchmove', (e) => rastrearOlhar(e.touches[0].clientX, e.touches[0].clientY), { passive: true });


// 🟢 ACOMPANHA A DIGITAÇÃO E CONTROLA A ALTURA (O Efeito "Curiar")
function trackTyping(inputElement) {
    const length = inputElement.value.length;
    const percent = Math.min(length / 20, 1);
    const moveX = (percent * 8) - 4; // Move a pupila da esquerda para a direita
    
    const isPasswordFocus = passInput === document.activeElement;
    const isHidden = isPasswordFocus && passInput.type === 'password';

    if (isHidden) {
        // 🟢 MODO ESCONDIDO ("CURIANDO POR CIMA DO MURO")
        pupils.forEach(pupil => {
            pupil.style.transform = `translate(${moveX}px, 2px)`; // Foca um pouco pra baixo
        });
        
        // Oculta as barras rebaixando a altura delas drasticamente (Afundam atrás da base)
        barLeft.style.height = '30px';
        barRight.style.height = '35px';
    } else {
        // 🟢 MODO NORMAL (Lendo o E-mail ou Senha Exposta)
        pupils.forEach(pupil => {
            pupil.style.transform = `translate(${moveX}px, 1px)`;
        });
        
        // Se estiver na senha revelada, as barras ficam levemente mais altas que o normal (Assustado/Atento)
        if (isPasswordFocus && passInput.type === 'text') {
            barLeft.style.height = `${70 + (percent * 5)}px`;
            barRight.style.height = `${86 + (percent * 5)}px`;
        } else {
            // Digitanto o E-mail normal
            barLeft.style.height = `${64 + (percent * 8)}px`;
            barRight.style.height = `${80 + (percent * 8)}px`;
        }
    }
}

// Eventos do Email
emailInput.addEventListener('input', () => trackTyping(emailInput));
emailInput.addEventListener('focus', () => {
    eyelidL.style.transform = 'scaleY(0)';
    eyelidR.style.transform = 'scaleY(0)';
    trackTyping(emailInput);
});

// Eventos da Senha
passInput.addEventListener('input', () => trackTyping(passInput));
passInput.addEventListener('focus', () => {
    if (passInput.type === 'password') {
        // "Curiando": Pálpebras descem 60% nos dois olhos (apertando a vista)
        eyelidL.style.transform = 'scaleY(0.6)';
        eyelidR.style.transform = 'scaleY(0.6)';
    } else {
        // Senha exposta: Olhos arregalados
        eyelidL.style.transform = 'scaleY(0)';
        eyelidR.style.transform = 'scaleY(0)';
    }
    trackTyping(passInput);
});

passInput.addEventListener('blur', () => {
    // Quando sai da senha, as pálpebras abrem, as pupilas resetam e o corpo levanta
    eyelidL.style.transform = 'scaleY(0)';
    eyelidR.style.transform = 'scaleY(0)';
    pupils.forEach(p => p.style.transform = `translate(0px, 0px)`);
    barLeft.style.height = '64px';
    barRight.style.height = '80px';
});

// Botão do Olhinho (Revelar Senha)
togglePassBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
        // Revelou a senha: Pula de trás do muro e arregala os olhos
        passInput.type = 'text';
        iconPass.classList.replace('fa-eye', 'fa-eye-slash');
        
        eyelidL.style.transform = 'scaleY(0)';   
        eyelidR.style.transform = 'scaleY(0)'; 
        trackTyping(passInput); // Reposiciona as barras lá no alto
    } else {
        // Escondeu a senha: Volta a se abaixar e curiar
        passInput.type = 'password';
        iconPass.classList.replace('fa-eye-slash', 'fa-eye');
        
        eyelidL.style.transform = 'scaleY(0.6)'; 
        eyelidR.style.transform = 'scaleY(0.6)';
        passInput.focus();
        trackTyping(passInput); // Encolhe as barras novamente
    }
});

// 🟢 PISCAR AUTOMÁTICO (Vida ao mascote)
setInterval(() => {
    const isPasswordFocus = passInput === document.activeElement;
    
    // Se o mascote estiver escondido/curiando a senha, ele não pisca para não estragar o charme da pose.
    if (isPasswordFocus && passInput.type === 'password') return; 
    
    eyelidL.style.transform = 'scaleY(1)';
    eyelidR.style.transform = 'scaleY(1)';
    
    setTimeout(() => {
        // Retorna ao estado normal 
        if (!isPasswordFocus || (isPasswordFocus && passInput.type === 'text')) {
            eyelidL.style.transform = 'scaleY(0)';
            eyelidR.style.transform = 'scaleY(0)';
        }
    }, 150);
}, 4000);

// ==========================================
// ALTERNÂNCIA E SUPABASE
// ==========================================
document.getElementById('btn-toggle-mode').addEventListener('click', () => {
    isLogin = !isLogin;
    document.getElementById('titulo-form').innerText = isLogin ? 'Acesso Seguro' : 'Criar Conta';
    document.getElementById('subtitulo-form').innerText = isLogin ? 'Analytics & Inteligência Financeira.' : 'Junte-se à alta performance financeira.';
    
    document.getElementById('btn-submit').innerHTML = isLogin 
        ? 'Acessar <i class="fa-solid fa-arrow-right transition-transform duration-300 group-hover:translate-x-1.5"></i>' 
        : 'Cadastrar <i class="fa-solid fa-shield-halved transition-transform duration-300 group-hover:scale-110"></i>';
        
    document.getElementById('texto-rodape').innerText = isLogin ? 'Ainda não tem cadastro?' : 'Já possui cadastro?';
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
                text: 'Sua conta foi criada com segurança. Aguarde a liberação do Administrador.',
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
