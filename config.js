// ==========================================
// js/config.js - O COFRE CENTRAL DA APLICAÇÃO
// ==========================================

const GEMINI_API_KEY = "AQ.Ab8RN6IAMsHqUOh2o_qmEVvyqKv2wtbiZcabLSvzYcvz0jLRHA";

const supabaseUrl = 'https://aoeyeleaxbwvjmzxxdib.supabase.co'; 
const supabaseKey = 'sb_publishable_Q6JiNxMGUdqObAMxj3EYSA_s_cYpFUk'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Ferramenta global de moeda para não repetir código
const formatarMoeda = (v) => {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Escudo Protetor Global: Verifica se o usuário tem permissão para estar na tela
async function verificarSessaoSegura() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session) {
        // Sem crachá? Chuta para a rua (login)
        window.location.replace('login.html');
        return null;
    }
    return session.user;
}

// Função global para o botão de Sair
async function sairDoSistema() {
    await supabaseClient.auth.signOut();
    window.location.replace('login.html');
}
