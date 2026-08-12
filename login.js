// ==========================================
// MOTOR DE AUTENTICAÇÃO E CADASTRO
// ==========================================

// Ignição: Se o usuário já tiver logado antes, pula essa tela automaticamente
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.location.href = "index.html"; // Redirecionamento Sênior
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
    const email = document.getElementById('email-cad').value.trim();
    const senha = document.getElementById('senha-cad').value;
    
    if(!email || !senha || senha.length < 6) return alert("E-mail e Senha (mín. 6 caracteres) obrigatórios.");

    const btn = document.getElementById('btn-cadastrar');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

    try {
        const { data, error } = await supabaseClient.auth.signUp({ email: email, password: senha });
        if (error) throw error;
        
        // Setup de ambiente seguro do usuário no banco de dados
        const usuarioLogado = data.user;
        await supabaseClient.from('categorias').insert([
            { usuario_id: usuarioLogado.id, nome: 'Alimentação', icone: 'fa-burger', cor: 'text-red-500' },
            { usuario_id: usuarioLogado.id, nome: 'Salário', icone: 'fa-building', cor: 'text-green-500' }
        ]);
        await supabaseClient.from('planos').insert([
            { usuario_id: usuarioLogado.id, nome: 'Reserva de Emergência', valor_meta: 10000, cor: 'bg-blue-500' }
        ]);

        alert("Conta criada! Redirecionando...");
        window.location.href = "index.html"; // Redirecionamento mágico

    } catch (e) {
        alert("Erro no cadastro: " + e.message);
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Criar Conta';
    }
}

async function efetuarLogin() {
    const email = document.getElementById('email-login').value.trim();
    const senha = document.getElementById('senha-login').value;
    
    if(!email || !senha) return alert("Preencha e-mail e senha.");

    const btn = document.getElementById('btn-login-desk');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email: email, password: senha });
        if (error) throw error;
        
        window.location.href = "index.html"; // Despacha para a área segura

    } catch (e) {
        alert("Login falhou. Verifique as credenciais.");
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
    }
}
