// ==========================================
// login.js - AUTENTICAÇÃO E MASCOTE GUARDIÃO (UX DE ELITE)
// ==========================================

let isLogin = true;

const emailInput = document.getElementById('email');
const passInput = document.getElementById('senha');
const pupilL = document.getElementById('pupil-l');
const pupilR = document.getElementById('pupil-r');
const eyelidL = document.getElementById('eyelid-l');
const eyelidR = document.getElementById('eyelid-r');
const vaultDial = document.getElementById('vault-dial');
const togglePassBtn = document.getElementById('toggle-pass');
const iconPass = document.getElementById('icon-pass');

// 🟢 FUNÇÕES DO MASCOTE
function fecharOlho(olho) { olho.classList.replace('scale-y-0', 'scale-y-100'); }
function abrirOlho(olho) { olho.classList.replace('scale-y-100', 'scale-y-0'); }

function seguirTexto(inputElement) {
    const length = inputElement.value.length;
    const maxLength = 25; 
    const percent = Math.min(length / maxLength, 1);
    
    // Movimento X da pupila (-5px até +5px) e Y levemente para baixo (focando no input)
    const moveX = (percent * 10) - 5;
    const moveY = 2;

    pupilL.style.transform = `translate(${moveX}px, ${moveY}px)`;
    pupilR.style.transform = `translate(${moveX}px, ${moveY}px)`;
    
    // O Dial (tranca do cofre) gira junto com a digitação!
    vaultDial.style.transform = `rotate(${percent * 180}deg)`;
}

// 🟢 EVENTOS DO E-MAIL
emailInput.addEventListener('input', () => seguirTexto(emailInput));
emailInput.addEventListener('focus', () => {
    abrirOlho(eyelidL);
    abrirOlho(eyelidR);
    seguirTexto(emailInput);
});

// 🟢 EVENTOS DA SENHA (A Mágica do Olho Fechado)
passInput.addEventListener('input', () => seguirTexto(passInput));
passInput.addEventListener('focus', () => {
    if (passInput.type === 'password') {
        fecharOlho(eyelidL); // Fecha o olho esquerdo!
        abrirOlho(eyelidR);  // Mantém o direito aberto focando!
    } else {
        abrirOlho(eyelidL);
        abrirOlho(eyelidR);
    }
    seguirTexto(passInput);
});

passInput.addEventListener('blur', () => {
    abrirOlho(eyelidL); // Abre os dois ao sair
    pupilL.style.transform = `translate(0px, 0px)`;
    pupilR.style.transform = `translate(0px, 0px)`;
    vaultDial.style.transform = `rotate(0deg)`;
});

// 🟢 BOTÃO VER SENHA
togglePassBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
        passInput.type = 'text';
        iconPass.classList.replace('fa-eye', 'fa-eye-slash');
        // Arregala os dois olhos quando a senha aparece
        abrirOlho(eyelidL);
        abrirOlho(eyelidR);
    } else {
        passInput.type = 'password';
        iconPass.classList.replace('fa-eye-slash', 'fa-eye');
        // Fecha o olho esquerdo novamente
        fecharOlho(eyelidL);
        passInput.focus(); 
    }
});

// 🟢 PISCAR AUTOMÁTICO (Vida ao mascote)
setInterval(() => {
    // Se o olho esquerdo já estiver fechado (modo senha), não pisca ele.
    const isPasswordHidden = passInput === document.activeElement && passInput.type === 'password';
    
    if (!isPasswordHidden) fecharOlho(eyelidL);
    fecharOlho(eyelidR);
    
    setTimeout(() => {
        if (!isPasswordHidden) abrirOlho(eyelidL);
        abrirOlho(eyelidR);
    }, 150); // Pisca super rápido
}, 3500); // A cada 3.5 segundos

// ==========================================
// LÓGICA DE ALTERNÂNCIA (LOGIN / CADASTRO)
// ==========================================
document.getElementById('btn-toggle-mode').addEventListener('click', () => {
    isLogin = !isLogin;
    
    document.getElementById('titulo-form').innerText = isLogin ? 'Acesso Seguro' : 'Criar Conta de Elite';
    document.getElementById('subtitulo-form').innerText = isLogin ? 'O seu guardião de dados financeiros.' : 'Junte-se à alta performance financeira.';
    document.getElementById('btn-submit').innerHTML = isLogin ? 'Desbloquear Cofre <i class="fa-solid fa-unlock-keyhole"></i>' : 'Cadastrar e Blindar <i class="fa-solid fa-shield-halved"></i>';
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
// INTEGRAÇÃO SEGURA COM SUPABASE (AUTH)
// ==========================================
document.getElementById('form-auth').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const senha = passInput.value.trim();

    // 🟢 DEFESA LGPD
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
            
            Swal.fire({
                icon: 'success',
                title: 'Cadastro Concluído!',
                text: 'Sua conta de elite foi criada com segurança. Verifique seu e-mail para confirmar (se exigido).',
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
