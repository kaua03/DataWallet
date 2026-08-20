// ==========================================
// login.js - AUTENTICAÇÃO E ANIMAÇÃO DO MASCOTE (UX)
// ==========================================

let isLogin = true;

const emailInput = document.getElementById('email');
const passInput = document.getElementById('senha');
const botEyes = document.getElementById('bot-eyes');
const botHands = document.getElementById('bot-hands');
const togglePassBtn = document.getElementById('toggle-pass');
const iconPass = document.getElementById('icon-pass');

// 🟢 MÁGICA 1: Os olhos seguem os caracteres digitados no email
emailInput.addEventListener('input', (e) => {
    const length = e.target.value.length;
    // Cálculo sutil: move no máximo 14px para a direita
    let move = (length * 0.8) - 10; 
    if (move > 14) move = 14;
    if (move < -14) move = -14;
    botEyes.style.transform = `translateX(${move}px)`;
});

emailInput.addEventListener('focus', () => {
    botHands.classList.replace('translate-y-0', 'translate-y-[120%]');
    botEyes.style.transform = `scale(1) translateX(0px)`;
});

// 🟢 MÁGICA 2: Cobre os olhos ao focar na senha
passInput.addEventListener('focus', () => {
    if (passInput.type === 'password') {
        botHands.classList.replace('translate-y-[120%]', 'translate-y-0');
        botEyes.style.transform = `scale(1) translateX(0px)`;
    }
});

passInput.addEventListener('blur', () => {
    botHands.classList.replace('translate-y-0', 'translate-y-[120%]');
});

// 🟢 MÁGICA 3: O susto ao clicar em ver senha
togglePassBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
        passInput.type = 'text';
        iconPass.classList.replace('fa-eye', 'fa-eye-slash');
        
        // Tira as mãos e arregala os olhos!
        botHands.classList.replace('translate-y-0', 'translate-y-[120%]');
        botEyes.style.transform = 'scale(1.4)';
    } else {
        passInput.type = 'password';
        iconPass.classList.replace('fa-eye-slash', 'fa-eye');
        
        // Tampa os olhos de novo
        botHands.classList.replace('translate-y-[120%]', 'translate-y-0');
        botEyes.style.transform = 'scale(1)';
        passInput.focus(); 
    }
});

// ==========================================
// LÓGICA DE ALTERNÂNCIA (LOGIN / CADASTRO)
// ==========================================
document.getElementById('btn-toggle-mode').addEventListener('click', () => {
    isLogin = !isLogin;
    
    document.getElementById('titulo-form').innerText = isLogin ? 'Acessar DataWallet' : 'Criar Conta de Elite';
    document.getElementById('subtitulo-form').innerText = isLogin ? 'Sua inteligência financeira na nuvem.' : 'Junte-se à alta performance financeira.';
    document.getElementById('btn-submit').innerHTML = isLogin ? 'Entrar no Sistema <i class="fa-solid fa-arrow-right"></i>' : 'Cadastrar e Blindar <i class="fa-solid fa-shield-halved"></i>';
    document.getElementById('texto-rodape').innerText = isLogin ? 'Ainda não faz parte da elite?' : 'Já possui acesso de elite?';
    document.getElementById('btn-toggle-mode').innerText = isLogin ? 'Criar Conta' : 'Fazer Login';
    
    // Oculta ou mostra o termo da LGPD
    const boxLgpd = document.getElementById('box-lgpd');
    if (isLogin) {
        boxLgpd.classList.add('hidden');
        boxLgpd.classList.remove('flex');
    } else {
        boxLgpd.classList.remove('hidden');
        boxLgpd.classList.add('flex');
    }
});

// ==========================================
// INTEGRAÇÃO SEGURA COM SUPABASE (AUTH)
// ==========================================
document.getElementById('form-auth').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const senha = passInput.value.trim();

    // 🟢 DEFESA LGPD: Validação obrigatória de consentimento no cadastro
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
            // LOGIN
            const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
            if (error) throw error;
            
            Swal.fire({ icon: 'success', title: 'Acesso Liberado', showConfirmButton: false, timer: 1000 });
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
            
        } else {
            // CADASTRO (Senhas são automaticamente transformadas em Hash criptografado pelo Supabase - Em conformidade LGPD)
            const { data, error } = await client.auth.signUp({ email, password: senha });
            if (error) throw error;
            
            Swal.fire({
                icon: 'success',
                title: 'Cadastro Concluído!',
                text: 'Sua conta de elite foi criada com segurança. Verifique seu e-mail para confirmar (se exigido).',
                confirmButtonColor: '#4f46e5'
            }).then(() => {
                document.getElementById('btn-toggle-mode').click(); // Volta pro modo login
            });
        }
    } catch (err) {
        // Mensagem genérica por segurança (Evita informar se o e-mail existe ou se a senha está errada)
        Swal.fire('Falha na Autenticação', 'Verifique suas credenciais e tente novamente.', 'error');
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
});
