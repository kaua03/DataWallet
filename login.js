// ==========================================
// login.js - LÓGICA DO GRÁFICO E LOGIN DUPLO (EMAIL/USER)
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

// 🟢 OLHOS SEGUEM O MOUSE
function rastrearOlhar(clientX, clientY) {
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
    } else {
        pupils.forEach(pupil => { pupil.style.transform = `translate(${moveX}px, 1px)`; });
        
        if (isPasswordFocus && passInput.type === 'text') {
            barLeft.style.height = `${70 + (percent * 5)}px`;
            barRight.style.height = `${86 + (percent * 5)}px`;
        } else {
            barLeft.style.height = `${64 + (percent * 8)}px`;
            barRight.style.height = `${80 + (percent * 8)}px`;
        }
    }
}

// Eventos de Input Text (Email e Username)
[identInput, usernameInput].forEach(el => {
    el.addEventListener('input', () => trackTyping(el));
    el.addEventListener('focus', () => {
        eyelidL.style.transform = 'scaleY(0)';
        eyelidR.style.transform = 'scaleY(0)';
        trackTyping(el);
    });
});

// Eventos da Senha
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
// ALTERNÂNCIA E SUPABASE (DUAL LOGIN)
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
    
    // Transições de campos do Formulário
    const boxLgpd = document.getElementById('box-lgpd');
    const boxUsername = document.getElementById('box-username');
    const labelIdent = document.getElementById('label-identificador');
    const iconIdent = document.getElementById('icon-identificador');
    
    if (isLogin) { 
        boxLgpd.classList.add('hidden'); boxLgpd.classList.remove('flex');
        boxUsername.classList.add('hidden', 'opacity-0');
        usernameInput.required = false;
        labelIdent.innerText = "E-mail ou Usuário";
        identInput.placeholder = "Ex: kaua ou kaua@email.com";
        iconIdent.className = "fa-solid fa-user absolute left-4 text-slate-500 transition-colors duration-300 group-focus-within:text-blue-400";
    } else { 
        boxLgpd.classList.remove('hidden'); boxLgpd.classList.add('flex');
        boxUsername.classList.remove('hidden'); 
        setTimeout(() => boxUsername.classList.remove('opacity-0'), 50); // Efeito fade
        usernameInput.required = true;
        labelIdent.innerText = "Seu E-mail";
        identInput.placeholder = "Ex: kaua@email.com";
        iconIdent.className = "fa-solid fa-envelope absolute left-4 text-slate-500 transition-colors duration-300 group-focus-within:text-blue-400";
    }
});

// Tradutor de erros do Supabase
function traduzirErroSupabase(mensagem) {
    const msg = mensagem.toLowerCase();
    if (msg.includes('invalid login credentials')) return 'E-mail, usuário ou senha incorretos.';
    if (msg.includes('password should be at least')) return 'A senha deve ter no mínimo 6 caracteres.';
    if (msg.includes('user already registered')) return 'Este e-mail ou usuário já está cadastrado.';
    if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento.';
    return 'Erro interno. Verifique seus dados e tente novamente.';
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
            // LÓGICA DE LOGIN DUPLO
            let emailLogin = identificador;
            
            // Se o cara não digitou "@", assumimos que é o Username. Vamos consultar o "Dicionário"!
            if (!identificador.includes('@')) {
                const { data, error: errUser } = await client.from('usuarios_dicionario').select('email').eq('username', identificador).single();
                
                if (errUser || !data) {
                    throw new Error('invalid login credentials'); // Força erro padrão para não dar dicas a hackers
                }
                emailLogin = data.email; // Achamos o email dele!
            }

            const { error } = await client.auth.signInWithPassword({ email: emailLogin, password: senha });
            if (error) throw error;
            
            Swal.fire({ icon: 'success', title: 'Acesso Liberado', showConfirmButton: false, timer: 1000 });
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
            
        } else {
            // LÓGICA DE CADASTRO
            // 1. Verifica se o username já existe no Dicionário
            const { data: userExiste } = await client.from('usuarios_dicionario').select('username').eq('username', username).single();
            if (userExiste) throw new Error('user already registered');

            // 2. Cria a conta no Supabase Auth
            const { data: authData, error: authErr } = await client.auth.signUp({ email: identificador, password: senha });
            if (authErr) throw authErr;

            // 3. Salva o nickname no Dicionário para logins futuros
            await client.from('usuarios_dicionario').insert([{ username: username, email: identificador }]);

            Swal.fire({
                icon: 'success',
                title: 'Cadastro Concluído!',
                text: 'Sua conta de elite foi criada com segurança. Você já pode fazer login.',
                confirmButtonColor: '#2563eb'
            }).then(() => { 
                document.getElementById('btn-toggle-mode').click(); 
                identInput.value = username; // Preenche o usuário para ele
                passInput.value = '';
            });
        }
    } catch (err) {
        // Agora você vai saber EXATAMENTE o que deu errado (fim da Síndrome do Impostor)
        const msgAmigavel = traduzirErroSupabase(err.message);
        Swal.fire('Falha na Autenticação', msgAmigavel, 'error');
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
});
