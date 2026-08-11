# 🚀 DataWallet - Inteligência Financeira (SaaS)

Um sistema de gestão financeira de alta fidelidade desenvolvido com foco absoluto em **Performance, Segurança (LGPD) e Experiência do Usuário (UX)**. 

O DataWallet atua como um Coach Financeiro virtual, interpretando dados através de processamento de linguagem natural (NLP) e oferecendo insights para tomada de decisão.

## 🏗️ Arquitetura do Sistema

Este projeto adota uma arquitetura **Serverless / BaaS (Backend as a Service)**, hospedado via GitHub Pages e utilizando o **Supabase** como núcleo de banco de dados e autenticação, garantindo latência zero e alta escalabilidade.

- **Frontend:** HTML5, Tailwind CSS (Mobile-First, Totalmente Responsivo), JavaScript Vanilla (ES6+).
- **Backend & Database:** Supabase (PostgreSQL).
- **Autenticação:** Supabase Auth com JWT (JSON Web Tokens).
- **Segurança de Dados:** Implementação rigorosa de **RLS (Row Level Security)** nativo no PostgreSQL. Acesso a dados multitenant isolado cirurgicamente na camada de banco de dados.

## ✨ Funcionalidades Principais (Core Features)

1. **🔒 Portaria Inteligente (Auth):**
   - Fallback de segurança (Login padrão vs. Tela de bloqueio mobile).
   - Cadastro integrado com hashing automático de senhas (Cofre Supabase).
2. **🎙️ Motor NLP (Natural Language Processing):**
   - Inserção de dados "No-Friction". O sistema lê frases como *"Recebi meu salário de 2500"* ou *"Ifood 45 ontem"*, classifica o sentimento (Receita/Despesa), extrai o valor matemático, identifica entidades e prepara a transação automaticamente.
3. **📊 Dashboard Analítico & Coach Financeiro:**
   - Filtros dinâmicos de período (Mês atual, anterior, ano).
   - Algoritmo que lê o volume de gastos por categoria e gera alertas ou dicas personalizadas.
4. **💳 Kanban de Dívidas (Parcelamento Lógico):**
   - Cálculo automático de fatiamento de dívidas longo prazo, distribuindo as parcelas corretamente nos próximos meses e dividindo entre "Atrasadas", "Mês Atual" e "Próximos Meses".
5. **🛡️ Safe To Save (Metas Inteligentes):**
   - Sistema protetivo que cruza o caixa atual com as dívidas pendentes do mês para informar ao usuário exatamente qual a sua margem livre segura para investir/poupar sem gerar inadimplência.

## 💡 Aos Recrutadores e Tech Leads

A base deste projeto demonstra proficiência em conceitos avançados de engenharia de software:
- Operações Assíncronas (`async/await` com Promises simultâneas).
- Single Page Application (SPA) Routing manual sem frameworks pesados.
- Integração de Banco de Dados Relacional e Proteção de Endpoint.
- Lógica de Negócios (Business Intelligence) aplicada no Front-end.

---
*Desenvolvido por Kauã Raysson.*
