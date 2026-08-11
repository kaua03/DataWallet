from fastapi import FastAPI
import database

# Aqui nós dizemos: "Pegue todos os moldes e crie as tabelas no banco de dados"
database.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="DataWallet API")

@app.get("/")
def rota_principal():
    return {"mensagem": "DataWallet operando com banco de dados conectado!"}
