from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import models
import schemas
from database import engine, SessionLocal

# 1. A ORDEM DE CONSTRUÇÃO
# O trator do SQLAlchemy vai no Supabase e cria todas as novas tabelas (Dívidas, Planos, etc)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="DataWallet API - O Cérebro Inteligente")

# 2. O PORTEIRO DO BANCO DE DADOS
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# ROTA DE FRONTEND
# ==========================================
@app.get("/")
def ler_index():
    return FileResponse("index.html")

# ==========================================
# ROTA DE AUTENTICAÇÃO (Login com Auto-Cadastro)
# ==========================================
@app.post("/login", response_model=schemas.UsuarioResposta)
def login(credenciais: schemas.UsuarioLogin, db: Session = Depends(get_db)):
    # 1. Procura o usuário no Supabase
    usuario = db.query(models.Usuario).filter(models.Usuario.email == credenciais.email).first()
    
    # 2. Truque de Desenvolvimento: Se não achar, cria na hora!
    if not usuario:
        # Nota: Em produção, usaríamos Bcrypt para criptografar a senha aqui.
        usuario = models.Usuario(nome="Admin", email=credenciais.email, senha_hash=credenciais.senha)
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        
    # 3. Se achar, verifica se a senha bate
    elif usuario.senha_hash != credenciais.senha:
        raise HTTPException(status_code=401, detail="Senha incorreta")
        
    return usuario

# ==========================================
# ROTAS DE TRANSAÇÕES (Aba Início)
# ==========================================
@app.get("/transacoes/{usuario_id}", response_model=list[schemas.TransacaoResposta])
def listar_transacoes(usuario_id: int, db: Session = Depends(get_db)):
    return db.query(models.Transacao).filter(models.Transacao.usuario_id == usuario_id).all()

@app.post("/transacoes/", response_model=schemas.TransacaoResposta)
def criar_transacao(transacao: schemas.TransacaoCriar, usuario_id: int, db: Session = Depends(get_db)):
    # Agora a API exige saber de quem é a conta antes de guardar!
    nova_transacao = models.Transacao(**transacao.dict(), usuario_id=usuario_id)
    db.add(nova_transacao)
    db.commit()
    db.refresh(nova_transacao)
    return nova_transacao

# ==========================================
# ROTAS DE DÍVIDAS (O Kanban)
# ==========================================
@app.get("/dividas/{usuario_id}", response_model=list[schemas.DividaResposta])
def listar_dividas(usuario_id: int, db: Session = Depends(get_db)):
    return db.query(models.Divida).filter(models.Divida.usuario_id == usuario_id).all()

@app.post("/dividas/", response_model=schemas.DividaResposta)
def criar_divida(divida: schemas.DividaCriar, usuario_id: int, db: Session = Depends(get_db)):
    nova_divida = models.Divida(**divida.dict(), usuario_id=usuario_id)
    db.add(nova_divida)
    db.commit()
    db.refresh(nova_divida)
    return nova_divida

# ==========================================
# ROTAS DE CATEGORIAS
# ==========================================
@app.get("/categorias/{usuario_id}", response_model=list[schemas.CategoriaResposta])
def listar_categorias(usuario_id: int, db: Session = Depends(get_db)):
    return db.query(models.Categoria).filter(models.Categoria.usuario_id == usuario_id).all()

@app.post("/categorias/", response_model=schemas.CategoriaResposta)
def criar_categoria(categoria: schemas.CategoriaCriar, usuario_id: int, db: Session = Depends(get_db)):
    nova_categoria = models.Categoria(**categoria.dict(), usuario_id=usuario_id)
    db.add(nova_categoria)
    db.commit()
    db.refresh(nova_categoria)
    return nova_categoria

# ==========================================
# ROTAS DE PLANOS (Metas e Aportes)
# ==========================================
@app.get("/planos/{usuario_id}", response_model=list[schemas.PlanoResposta])
def listar_planos(usuario_id: int, db: Session = Depends(get_db)):
    return db.query(models.Plano).filter(models.Plano.usuario_id == usuario_id).all()

@app.post("/planos/", response_model=schemas.PlanoResposta)
def criar_plano(plano: schemas.PlanoCriar, usuario_id: int, db: Session = Depends(get_db)):
    novo_plano = models.Plano(**plano.dict(), usuario_id=usuario_id)
    db.add(novo_plano)
    db.commit()
    db.refresh(novo_plano)
    return novo_plano

@app.put("/planos/{plano_id}/aporte", response_model=schemas.PlanoResposta)
def fazer_aporte(plano_id: int, aporte: schemas.PlanoAporte, db: Session = Depends(get_db)):
    plano = db.query(models.Plano).filter(models.Plano.id == plano_id).first()
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    # A Mágica Matemática: Soma o valor que o celular enviou com o que já existe no banco
    plano.valor_atual += aporte.valor
    db.commit()
    db.refresh(plano)
    return plano
