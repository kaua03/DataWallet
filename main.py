from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta
from pydantic import BaseModel
import models
import schemas
from database import engine, SessionLocal

# 1. A Ordem de Construção: Isso avisa o Supabase para criar as tabelas lá no banco 
# fisicamente, seguindo as plantas que desenhamos no models.py!
models.Base.metadata.create_all(bind=engine)

# 2. Ligando o Gerente da API
app = FastAPI(
    title="DataWallet API",
    description="Motor de Inteligência Financeira",
    version="1.0.0"
)

# 3. O Porteiro do Banco de Dados
# Ele abre a catraca quando o celular pede algo, e fecha a catraca quando termina.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# ROTAS (Os guichês de atendimento)
# ==========================================

@app.get("/")
def rota_principal():
    return {"mensagem": "DataWallet API Online! O motor está girando no Supabase."}

# ROTA A: Cadastrar Transação Manual
@app.post("/transacoes/", response_model=schemas.TransacaoResposta)
def criar_transacao(transacao: schemas.TransacaoCriar, db: Session = Depends(get_db)):
    nova_transacao = models.Transacao(
        valor=transacao.valor,
        tipo=transacao.tipo,
        descricao=transacao.descricao,
        data_vencimento=transacao.data_vencimento,
        usuario_id=transacao.usuario_id,
        categoria_id=transacao.categoria_id
    )
    db.add(nova_transacao) # Coloca na esteira
    db.commit()            # Aperta o botão verde "Pode Salvar!"
    db.refresh(nova_transacao)
    return nova_transacao

# ROTA B: Listar todas as transações
@app.get("/transacoes/", response_model=list[schemas.TransacaoResposta])
def listar_transacoes(db: Session = Depends(get_db)):
    return db.query(models.Transacao).all()

# ==========================================
# ROTA C: A MÁGICA DA VOZ (Inteligência NLP)
# ==========================================

# Um molde rápido só para receber o texto do celular
class ComandoVoz(BaseModel):
    texto: str

@app.post("/transacoes/analise-voz/")
def processar_voz(comando: ComandoVoz):
    # Exemplo: Se o celular enviar "Ifood 45 ontem"
    palavras = comando.texto.lower().split()
    
    # 1. Caçando o valor numérico na frase
    valor_encontrado = 0.0
    for p in palavras:
        if p.isnumeric():
            valor_encontrado = float(p)
            break
            
    # 2. Lógica de Data Inteligente
    data_conta = date.today()
    if "ontem" in palavras:
        data_conta = data_conta - timedelta(days=1)
        
    # 3. Retornamos o "Pacote Sugerido" para o celular abrir a Janela Flutuante.
    # Note que NÃO usamos db.commit() aqui. Nós NÃO salvamos no banco ainda!
    return {
        "status": "Aguardando Confirmação da Janela Flutuante",
        "sugestao_para_tela": {
            "descricao": palavras[0].capitalize() if palavras else "Desconhecido",
            "valor": valor_encontrado,
            "data_vencimento": data_conta,
            "tipo": "Despesa"
        }
    }
