from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
import database
import models
import schemas # Importando nossa alfândega

# Cria as tabelas lá no Supabase (se já não existirem)
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="DataWallet API")

# Isso é o porteiro do banco de dados. Ele abre a catraca quando uma 
# requisição chega e fecha quando ela vai embora.
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ROTA DE CRIAÇÃO (POST): Aqui nós enviamos novos dados
@app.post("/transacoes/", response_model=schemas.TransacaoResposta)
def criar_transacao(transacao_entrada: schemas.TransacaoCriar, db: Session = Depends(get_db)):
    # Pegamos o JSON validado e transformamos no objeto do nosso models.py
    nova_transacao = models.Transacao(
        valor=transacao_entrada.valor,
        tipo=transacao_entrada.tipo,
        descricao=transacao_entrada.descricao,
        data_vencimento=transacao_entrada.data_vencimento,
        usuario_id=transacao_entrada.usuario_id,
        categoria_id=transacao_entrada.categoria_id
    )
    
    # Colocamos na esteira de salvamento
    db.add(nova_transacao)
    # Commit = Apertar o botão verde que diz "Pode Salvar Definitivamente!"
    db.commit()
    # Atualiza a nova_transacao com o ID gerado lá no Supabase
    db.refresh(nova_transacao) 
    
    return nova_transacao

# ROTA DE LEITURA (GET): Aqui nós buscamos as informações
@app.get("/transacoes/")
def listar_transacoes(db: Session = Depends(get_db)):
    # Pede pro banco: "Me dê TODAS as linhas da tabela transacoes"
    contas = db.query(models.Transacao).all()
    return contas
