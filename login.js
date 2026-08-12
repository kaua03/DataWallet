// ==========================================
// login.js - MOTOR DE AUTENTICAÇÃO E CADASTRO
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.location.replace("index.html"); 
    }
});

function alternarTelaAuth(tela) {
    if (tela === 'cadastro') {
        document.getElementById('form-login').classList.add('hidden');
        document.getElementById('form-cadastro').classList.remove('hidden');
        document.getElementById('texto-boas-vindas').innerText = "Crie sua conta para começar";
    } else {
        document.getElementById('form-cadastro').classList.add('hidden');
        document.getElementById('form-login').classList.remove('hidden');
        document.getElementById('texto-boas-vindas').innerText = "Inteligência financeira na nuvem";
    }
}

async function efetuarCadastro() {
    const nome = document.getElementById('nome-cad') ? document.getElementById('nome-cad').value.trim() : "Usuário";
    const email = document.getElementById('email-cad').value.trim();
    const senha = document.getElementById('senha-cad').value;
    
    if(!email || !senha || senha.length < 6) return alert("E-mail e Senha (mín. 6 caracteres) obrigatórios.");

    const btn = document.getElementById('btn-cadastrar');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

    try {
        const { data, error } = await supabaseClient.auth.signUp({ 
            email: email, 
            password: senha,
            options: { data: { nome: nome } }
        });
        
        if (error) throw error;

        // Se o Supabase exigir confirmação de e-mail (caso você esqueça de desativar), ele previne o erro:
        if (!data.session) {
            alert("Cadastro realizado! Autopreenhendo seus dados para login.");
            document.getElementById('email-login').value = email;
            document.getElementById('senha-login').value = senha;
            alternarTelaAuth('login');
            btn.innerHTML = txtOriginal;
            return;
        }
        
        const usuarioLogado = data.user;
        await supabaseClient.from('categorias').insert([
            { usuario_id: usuarioLogado.id, nome: 'Alimentação', icone: 'fa-burger', cor: 'text-red-500' },
            { usuario_id: usuarioLogado.id, nome: 'Salário', icone: 'fa-building', cor: 'text-green-500' }
        ]);
        await supabaseClient.from('planos').insert([
            { usuario_id: usuarioLogado.id, nome: 'Reserva de Emergência', valor_meta: 10000, cor: 'bg-blue-500' }
        ]);

        window.location.replace("index.html"); 

    } catch (e) {
        alert("Erro no cadastro: " + e.message);
        btn.innerHTML = txtOriginal;
    }
}

async function efetuarLogin() {
    const email = document.getElementById('email-login').value.trim();
    const senha = document.getElementById('senha-login').value;
    
    if(!email || !senha) return alert("Preencha e-mail e senha.");

    const btn = document.getElementById('btn-login-desk');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email: email, password: senha });
        if (error) throw error;
        
        window.location.replace("index.html");

    } catch (e) {
        alert("Login falhou. Verifique as credenciais.");
        btn.innerHTML = txtOriginal;
    }
}
