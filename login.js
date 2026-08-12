// ==========================================
// js/login.js - MOTOR DE AUTENTICAÇÃO E CADASTRO
// ==========================================

// Ignição: Se o usuário já tiver logado antes, pula essa tela automaticamente
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.location.replace("index.html"); // Rota do roteador
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

// O NOVO SISTEMA DE CADASTRO QUE ENVIA O NOME PARA O GATILHO SQL
async function efetuarCadastro() {
    const nome = document.getElementById('nome-cad') ? document.getElementById('nome-cad').value.trim() : "Usuário";
    const email = document.getElementById('email-cad').value.trim();
    const senha = document.getElementById('senha-cad').value;
    
    if(!email || !senha || senha.length < 6) return alert("E-mail e Senha (mín. 6 caracteres) obrigatórios.");

    const btn = document.getElementById('btn-cadastrar');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

    try {
        // Envia E-mail, Senha e os "Metadados" (O Nome) para o robô do Supabase
        const { data, error } = await supabaseClient.auth.signUp({ 
            email: email, 
            password: senha,
            options: {
                data: {
                    nome: nome // É AQUI que o gatilho SQL puxa o nome!
                }
            }
        });
        
        if (error) throw error;
        
        // Setup inicial das categorias
        const usuarioLogado = data.user;
        await supabaseClient.from('categorias').insert([
            { usuario_id: usuarioLogado.id, nome: 'Alimentação', icone: 'fa-burger', cor: 'text-red-500' },
            { usuario_id: usuarioLogado.id, nome: 'Salário', icone: 'fa-building', cor: 'text-green-500' }
        ]);
        await supabaseClient.from('planos').insert([
            { usuario_id: usuarioLogado.id, nome: 'Reserva de Emergência', valor_meta: 10000, cor: 'bg-blue-500' }
        ]);

        alert("Conta criada! Redirecionando...");
        window.location.replace("index.html"); // Manda pro Roteador

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
