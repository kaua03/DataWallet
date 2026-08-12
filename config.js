// ==========================================
// CONFIGURAÇÃO GLOBAL DO BANCO DE DADOS
// ==========================================
const supabaseUrl = 'https://aoeyeleaxbwvjmzxxdib.supabase.co'; 
const supabaseKey = 'sb_publishable_Q6JiNxMGUdqObAMxj3EYSA_s_cYpFUk'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Utilitário global para moedas
const formatarMoeda = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;
